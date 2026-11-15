import type { AiModelPricing, AiProviderModel, AiTokenRates } from './aiProviderCatalog';

/**
 * MODAUI AI Provider Gateway — 成本核算（纯逻辑，无网络、无 Prisma）。
 *
 * 设计要求（docs/engineering/architecture/MODaUI-AI-TOOLS-PLATFORM.md §7）：
 * - 供应商成本与商家售价分开；本文件只算**供应商成本**。
 * - DeepSeek 价格随峰谷时段变化，必须按调用时刻动态核算，不能取一个固定值。
 * - 缺少该时段价格时返回 `PEAK_RATE_NOT_CONFIGURED`，**不允许**估成 0 或猜一个数字。
 * - 金额以整数「微美元」（1e-6 USD）计算，避免浮点累计误差；写库时再折算成分。
 */

/** 一天内的时段窗口，以 UTC 分钟表示（0 = 00:00 UTC）。支持跨零点。 */
export type AiPricingWindow = {
  id: string;
  /** 优惠时段（非高峰）起始分钟。 */
  offPeakStartMinuteUtc: number;
  /** 优惠时段结束分钟，可小于起始分钟表示跨零点。 */
  offPeakEndMinuteUtc: number;
};

/**
 * DeepSeek 官方优惠时段为北京时间 00:30–08:30（= UTC 16:30–00:30）。
 * 这是运营参数：可用 `AI_PRICING_OFFPEAK_WINDOWS_JSON` 覆盖，改时段不需要改代码。
 */
export const DEFAULT_AI_PRICING_WINDOWS: AiPricingWindow[] = [
  { id: 'deepseek_offpeak', offPeakStartMinuteUtc: 16 * 60 + 30, offPeakEndMinuteUtc: 30 }
];

export const AI_PRICING_WINDOWS_ENV_KEY = 'AI_PRICING_OFFPEAK_WINDOWS_JSON';

export type AiPricingPeriod = 'off_peak' | 'peak';

export function resolveAiPricingPeriod(
  now: Date,
  windows: readonly AiPricingWindow[] = DEFAULT_AI_PRICING_WINDOWS
): AiPricingPeriod {
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  for (const window of windows) {
    const { offPeakStartMinuteUtc: start, offPeakEndMinuteUtc: end } = window;
    if (start === end) continue;
    const inWindow = start < end
      ? minutes >= start && minutes < end
      : minutes >= start || minutes < end;
    if (inWindow) return 'off_peak';
  }
  return 'peak';
}

export type AiCostUsage =
  | { kind: 'token'; inputCacheHitTokens: number; inputCacheMissTokens: number; outputTokens: number }
  | { kind: 'image'; count: number; resolutionKey: string }
  | { kind: 'video'; seconds: number; resolutionKey: string }
  | { kind: 'tts'; characters: number }
  | { kind: 'asr'; minutes: number }
  | { kind: 'search'; requests: number }
  | { kind: 'compute'; cpuSeconds?: number };

export type AiCostFailureReason =
  | 'PRICING_KIND_MISMATCH'
  | 'PEAK_RATE_NOT_CONFIGURED'
  | 'RESOLUTION_NOT_PRICED'
  | 'USAGE_INVALID';

export type AiCostEstimate =
  | {
      ok: true;
      /** 供应商成本，单位微美元（整数）。 */
      usdMicro: number;
      usd: number;
      /** 向上取整到分：任何真实成本都不会被记成 0。 */
      cents: number;
      period: AiPricingPeriod;
      breakdown: { label: string; usd: number }[];
      /** 自建算力成本不由供应商 API 计费，单独标记。 */
      computeOnly: boolean;
    }
  | { ok: false; reason: AiCostFailureReason };

const USD_MICRO_PER_USD = 1_000_000;
const USD_MICRO_PER_CENT = 10_000;

function toUsdMicro(usd: number): number {
  if (!Number.isFinite(usd) || usd <= 0) return 0;
  return Math.round(usd * USD_MICRO_PER_USD);
}

function isNonNegativeFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function tokenRatesFor(
  pricing: Extract<AiModelPricing, { kind: 'token' }>,
  period: AiPricingPeriod
): AiTokenRates | null {
  if (period === 'off_peak') return pricing.offPeak;
  return pricing.peak ?? null;
}

/**
 * 计算一次调用的供应商成本。
 *
 * `now` 决定峰谷时段；`model.pricing.kind` 必须与 `usage.kind` 匹配，否则明确报错，
 * 不做「按调用次数硬套 token 价」这类失真折算。
 */
export function estimateAiProviderCost(input: {
  model: Pick<AiProviderModel, 'modelId' | 'pricing'>;
  usage: AiCostUsage;
  now?: Date;
  windows?: readonly AiPricingWindow[];
}): AiCostEstimate {
  const now = input.now ?? new Date();
  const period = resolveAiPricingPeriod(now, input.windows ?? DEFAULT_AI_PRICING_WINDOWS);
  const pricing = input.model.pricing;
  const usage = input.usage;

  if (usage.kind === 'compute') {
    if (pricing.kind !== 'compute') return { ok: false, reason: 'PRICING_KIND_MISMATCH' };
    return { ok: true, usdMicro: 0, usd: 0, cents: 0, period, breakdown: [], computeOnly: true };
  }

  if (usage.kind === 'token') {
    if (pricing.kind !== 'token') return { ok: false, reason: 'PRICING_KIND_MISMATCH' };
    const { inputCacheHitTokens, inputCacheMissTokens, outputTokens } = usage;
    if (
      !isNonNegativeFinite(inputCacheHitTokens)
      || !isNonNegativeFinite(inputCacheMissTokens)
      || !isNonNegativeFinite(outputTokens)
    ) return { ok: false, reason: 'USAGE_INVALID' };
    const rates = tokenRatesFor(pricing, period);
    // 高峰价未配置时拒绝估算：宁可返回不可用，也不能按非高峰价低估成本。
    if (!rates) return { ok: false, reason: 'PEAK_RATE_NOT_CONFIGURED' };
    const hitUsd = (inputCacheHitTokens / 1_000_000) * rates.cacheHitInput;
    const missUsd = (inputCacheMissTokens / 1_000_000) * rates.cacheMissInput;
    const outputUsd = (outputTokens / 1_000_000) * rates.output;
    const usdMicro = toUsdMicro(hitUsd) + toUsdMicro(missUsd) + toUsdMicro(outputUsd);
    return {
      ok: true,
      usdMicro,
      usd: usdMicro / USD_MICRO_PER_USD,
      cents: Math.ceil(usdMicro / USD_MICRO_PER_CENT),
      period,
      breakdown: [
        { label: 'input_cache_hit', usd: hitUsd },
        { label: 'input_cache_miss', usd: missUsd },
        { label: 'output', usd: outputUsd }
      ],
      computeOnly: false
    };
  }

  if (usage.kind === 'image') {
    if (pricing.kind !== 'image') return { ok: false, reason: 'PRICING_KIND_MISMATCH' };
    if (!isNonNegativeFinite(usage.count) || usage.count <= 0) return { ok: false, reason: 'USAGE_INVALID' };
    const unit = pricing.perImageUsd[usage.resolutionKey];
    if (unit === undefined) return { ok: false, reason: 'RESOLUTION_NOT_PRICED' };
    const usdMicro = toUsdMicro(unit * usage.count);
    return {
      ok: true,
      usdMicro,
      usd: usdMicro / USD_MICRO_PER_USD,
      cents: Math.ceil(usdMicro / USD_MICRO_PER_CENT),
      period,
      breakdown: [{ label: `image:${usage.resolutionKey}`, usd: unit * usage.count }],
      computeOnly: false
    };
  }

  if (usage.kind === 'video') {
    if (pricing.kind !== 'video') return { ok: false, reason: 'PRICING_KIND_MISMATCH' };
    if (!isNonNegativeFinite(usage.seconds) || usage.seconds <= 0) return { ok: false, reason: 'USAGE_INVALID' };
    const unit = pricing.perSecondUsd[usage.resolutionKey];
    if (unit === undefined) return { ok: false, reason: 'RESOLUTION_NOT_PRICED' };
    const usdMicro = toUsdMicro(unit * usage.seconds);
    return {
      ok: true,
      usdMicro,
      usd: usdMicro / USD_MICRO_PER_USD,
      cents: Math.ceil(usdMicro / USD_MICRO_PER_CENT),
      period,
      breakdown: [{ label: `video:${usage.resolutionKey}`, usd: unit * usage.seconds }],
      computeOnly: false
    };
  }

  if (usage.kind === 'tts') {
    if (pricing.kind !== 'tts') return { ok: false, reason: 'PRICING_KIND_MISMATCH' };
    if (!isNonNegativeFinite(usage.characters) || usage.characters <= 0) return { ok: false, reason: 'USAGE_INVALID' };
    const usd = (usage.characters / 1_000_000) * pricing.perMillionCharsUsd;
    const usdMicro = toUsdMicro(usd);
    return {
      ok: true,
      usdMicro,
      usd: usdMicro / USD_MICRO_PER_USD,
      cents: Math.ceil(usdMicro / USD_MICRO_PER_CENT),
      period,
      breakdown: [{ label: 'tts_characters', usd }],
      computeOnly: false
    };
  }

  if (usage.kind === 'asr') {
    if (pricing.kind !== 'asr') return { ok: false, reason: 'PRICING_KIND_MISMATCH' };
    if (!isNonNegativeFinite(usage.minutes) || usage.minutes <= 0) return { ok: false, reason: 'USAGE_INVALID' };
    const usd = usage.minutes * pricing.perMinuteUsd;
    const usdMicro = toUsdMicro(usd);
    return {
      ok: true,
      usdMicro,
      usd: usdMicro / USD_MICRO_PER_USD,
      cents: Math.ceil(usdMicro / USD_MICRO_PER_CENT),
      period,
      breakdown: [{ label: 'asr_minutes', usd }],
      computeOnly: false
    };
  }

  if (!isNonNegativeFinite(usage.requests) || usage.requests <= 0) return { ok: false, reason: 'USAGE_INVALID' };
  if (pricing.kind !== 'search') return { ok: false, reason: 'PRICING_KIND_MISMATCH' };
  const usd = (usage.requests / 1000) * pricing.perThousandRequestsUsd;
  const usdMicro = toUsdMicro(usd);
  return {
    ok: true,
    usdMicro,
    usd: usdMicro / USD_MICRO_PER_USD,
    cents: Math.ceil(usdMicro / USD_MICRO_PER_CENT),
    period,
    breakdown: [{ label: 'search_requests', usd }],
    computeOnly: false
  };
}

/**
 * 把成本估算映射为 `ModaGptAiUsageRecord` 的成本字段。
 * `cents` 写入 `actualCostMinor`；估算不可用时显式返回 null，由调用方按「未计价」处理，
 * 不允许把未知成本写成 0。
 */
export function buildAiUsageCostFields(estimate: AiCostEstimate): {
  actualCostMinor: number | null;
  priced: boolean;
} {
  if (!estimate.ok) return { actualCostMinor: null, priced: false };
  if (estimate.computeOnly) return { actualCostMinor: 0, priced: true };
  return { actualCostMinor: estimate.cents, priced: true };
}

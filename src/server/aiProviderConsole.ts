import type { AiModelPricing, AiProviderModel } from './aiProviderCatalog';

/**
 * MODAUI AI 服务商控制台 — 纯逻辑（无 Prisma / 无网络 / 无密钥）。
 *
 * 约束（见 docs/engineering/modules/modaui-ai-provider-console.md）：
 * - 本文件只处理「人可以看的元数据」：脱敏尾号、模型启用状态、参考价、调用聚合。
 * - 不接收、不返回、不缓存任何明文密钥；`maskProviderSecret` 只取末 4 位。
 * - 价格单位统一为「分」，避免前端浮点误差；未知价格返回 null，绝不用 0 冒充。
 */

export const AI_PROVIDER_CALL_STATUSES = [
  'pending',
  'succeeded',
  'failed',
  'timeout',
  'cancelled',
  'rejected'
] as const;
export type AiProviderCallStatus = (typeof AI_PROVIDER_CALL_STATUSES)[number];

export const AI_PROVIDER_TASK_TYPES = ['image', 'image_edit', 'video', 'voice'] as const;
export type AiProviderTaskType = (typeof AI_PROVIDER_TASK_TYPES)[number];

export const AI_PROVIDER_CALL_STATUS_LABELS: Record<AiProviderCallStatus, string> = {
  pending: '进行中',
  succeeded: '成功',
  failed: '供应商失败',
  timeout: '供应商超时',
  cancelled: '已取消',
  rejected: '已拦截'
};

export const AI_PROVIDER_TASK_TYPE_LABELS: Record<AiProviderTaskType, string> = {
  image: '图片生成',
  image_edit: '图片编辑',
  video: '视频生成',
  voice: '语音合成'
};

export type AiProviderModelOverride = {
  enabled?: boolean;
  /** 覆盖后的参考价（分），与目录单位一致。 */
  priceCents?: number;
  updatedAt?: string;
  updatedBy?: string;
};

export type AiProviderModelOverrides = Record<string, AiProviderModelOverride>;

export type AiProviderModelTestResult = {
  ok: boolean;
  status: string;
  modelId: string;
  checkedAt: string;
};

export type AiProviderModelTestResults = Record<string, AiProviderModelTestResult>;

export type AiProviderModelRow = {
  modelId: string;
  label: string;
  capabilities: string[];
  tier: string;
  status: string;
  taskType: AiProviderTaskType;
  requestMode: 'runsync' | 'run';
  pricingUnit: string;
  catalogPriceCents: number | null;
  priceCents: number | null;
  priceOverridden: boolean;
  enabled: boolean;
  enabledOverridden: boolean;
  lastTest: AiProviderModelTestResult | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

/** 只显示末 4 位；过短或空一律回 `****`，不泄露长度。 */
export function maskProviderSecret(secret: string | null | undefined): string {
  const value = typeof secret === 'string' ? secret.trim() : '';
  if (value.length <= 4) return '****';
  return `****${value.slice(-4)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** 参考价（分）。价格目录以美元计价，这里换算成分；未登记的档位返回 null。 */
export function referencePriceCents(pricing: AiModelPricing): number | null {
  const toCents = (usd: number) => Math.round(usd * 100);
  if (pricing.kind === 'image') {
    const values = Object.values(pricing.perImageUsd).filter(value => Number.isFinite(value) && value > 0);
    if (!values.length) return null;
    return toCents(Math.max(...values));
  }
  if (pricing.kind === 'video') {
    const values = Object.values(pricing.perSecondUsd).filter(value => Number.isFinite(value) && value > 0);
    if (!values.length) return null;
    return toCents(Math.max(...values));
  }
  if (pricing.kind === 'tts') {
    // 目录价是「美元 / 百万字符」，控制台按「分 / 千字符」展示，与计量单位一致。
    if (!Number.isFinite(pricing.perMillionCharsUsd) || pricing.perMillionCharsUsd <= 0) return null;
    return Math.round((pricing.perMillionCharsUsd * 100) / 1000);
  }
  if (pricing.kind === 'asr') {
    if (!Number.isFinite(pricing.perMinuteUsd) || pricing.perMinuteUsd <= 0) return null;
    return toCents(pricing.perMinuteUsd);
  }
  return null;
}

export function pricingUnitLabel(pricing: AiModelPricing): string {
  if (pricing.kind === 'image') return '美分 / 张';
  if (pricing.kind === 'video') return '美分 / 秒';
  if (pricing.kind === 'tts') return '美分 / 千字符';
  if (pricing.kind === 'asr') return '美分 / 分钟';
  if (pricing.kind === 'token') return '美分 / 百万 Token';
  return '按量';
}

export function taskTypeForCapabilities(capabilities: readonly string[]): AiProviderTaskType {
  if (capabilities.includes('video_generate')) return 'video';
  if (capabilities.includes('tts')) return 'voice';
  if (capabilities.includes('image_edit')) return 'image_edit';
  return 'image';
}

export function requestModeForTaskType(taskType: AiProviderTaskType): 'runsync' | 'run' {
  return taskType === 'video' ? 'run' : 'runsync';
}

/** 价格覆盖只接受非负整数（分），上限 100 万分以避免误填；其余返回 null 表示无效输入。 */
export function parsePriceCents(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numeric = typeof value === 'string' ? Number(value.trim()) : value;
  if (typeof numeric !== 'number' || !Number.isFinite(numeric)) return null;
  const rounded = Math.round(numeric);
  if (rounded !== numeric) return null;
  if (rounded < 0 || rounded > 1_000_000) return null;
  return rounded;
}

/**
 * 解析配置里保存的覆盖项。只保留目录中真实存在的 modelId，
 * 避免旧配置残留把已下架模型重新「变出来」。
 */
export function parseModelOverrides(value: unknown, allowedModelIds: readonly string[]): AiProviderModelOverrides {
  if (!isRecord(value)) return {};
  const allowed = new Set(allowedModelIds);
  const overrides: AiProviderModelOverrides = {};
  for (const [modelId, raw] of Object.entries(value)) {
    if (!allowed.has(modelId) || !isRecord(raw)) continue;
    const entry: AiProviderModelOverride = {};
    if (typeof raw.enabled === 'boolean') entry.enabled = raw.enabled;
    const price = parsePriceCents(raw.priceCents);
    if (price !== null) entry.priceCents = price;
    if (typeof raw.updatedAt === 'string' && raw.updatedAt.length <= 32) entry.updatedAt = raw.updatedAt;
    if (typeof raw.updatedBy === 'string' && raw.updatedBy.length <= 64) entry.updatedBy = raw.updatedBy;
    if (Object.keys(entry).length) overrides[modelId] = entry;
  }
  return overrides;
}

export function parseModelTestResults(value: unknown, allowedModelIds: readonly string[]): AiProviderModelTestResults {
  if (!isRecord(value)) return {};
  const allowed = new Set(allowedModelIds);
  const results: AiProviderModelTestResults = {};
  for (const [modelId, raw] of Object.entries(value)) {
    if (!allowed.has(modelId) || !isRecord(raw)) continue;
    if (typeof raw.ok !== 'boolean' || typeof raw.status !== 'string' || raw.status.length > 32) continue;
    if (typeof raw.checkedAt !== 'string' || raw.checkedAt.length > 32) continue;
    results[modelId] = { ok: raw.ok, status: raw.status, modelId, checkedAt: raw.checkedAt };
  }
  return results;
}

/** 模型列表：目录是基线，覆盖项只调「启停」与「参考价」。 */
export function buildProviderModelRows(input: {
  models: readonly AiProviderModel[];
  overrides: AiProviderModelOverrides;
  testResults: AiProviderModelTestResults;
}): AiProviderModelRow[] {
  return input.models.map(model => {
    const override = input.overrides[model.modelId];
    const catalogPriceCents = referencePriceCents(model.pricing);
    const taskType = taskTypeForCapabilities(model.capabilities);
    const enabled = typeof override?.enabled === 'boolean' ? override.enabled : model.status !== 'disabled';
    return {
      modelId: model.modelId,
      label: model.label,
      capabilities: [...model.capabilities],
      tier: model.tier,
      status: model.status,
      taskType,
      requestMode: requestModeForTaskType(taskType),
      pricingUnit: pricingUnitLabel(model.pricing),
      catalogPriceCents,
      priceCents: override?.priceCents ?? catalogPriceCents,
      priceOverridden: typeof override?.priceCents === 'number',
      enabled,
      enabledOverridden: typeof override?.enabled === 'boolean',
      lastTest: input.testResults[model.modelId] ?? null,
      updatedAt: override?.updatedAt ?? null,
      updatedBy: override?.updatedBy ?? null
    };
  });
}

export function isProviderCallStatus(value: unknown): value is AiProviderCallStatus {
  return typeof value === 'string' && (AI_PROVIDER_CALL_STATUSES as readonly string[]).includes(value);
}

export type AiProviderCallRow = {
  status: string;
  modelId: string;
  taskType: string;
  costCents: number | null;
  estimatedCents: number | null;
};

export type AiProviderCallSummary = {
  totals: {
    count: number;
    succeeded: number;
    failed: number;
    succeededCostCents: number;
    succeededEstimatedCents: number;
    unknownCostCount: number;
  };
  byStatus: Array<{ status: string; count: number }>;
  byModel: Array<{ modelId: string; count: number; costCents: number; estimatedCents: number }>;
};

/**
 * 只把「真实费用」累加进成本；估算单独一列，未知费用只计数不补 0，
 * 避免统计口径把估算当成已发生支出。
 */
export function summarizeProviderCalls(rows: readonly AiProviderCallRow[]): AiProviderCallSummary {
  const byStatusMap = new Map<string, number>();
  const byModelMap = new Map<string, { count: number; costCents: number; estimatedCents: number }>();
  const summary: AiProviderCallSummary = {
    totals: { count: 0, succeeded: 0, failed: 0, succeededCostCents: 0, succeededEstimatedCents: 0, unknownCostCount: 0 },
    byStatus: [],
    byModel: []
  };
  for (const row of rows) {
    summary.totals.count += 1;
    byStatusMap.set(row.status, (byStatusMap.get(row.status) ?? 0) + 1);
    const model = byModelMap.get(row.modelId) ?? { count: 0, costCents: 0, estimatedCents: 0 };
    model.count += 1;
    if (row.status === 'succeeded') {
      summary.totals.succeeded += 1;
      if (typeof row.costCents === 'number') {
        summary.totals.succeededCostCents += row.costCents;
        model.costCents += row.costCents;
      } else if (typeof row.estimatedCents === 'number') {
        summary.totals.succeededEstimatedCents += row.estimatedCents;
        model.estimatedCents += row.estimatedCents;
      } else {
        summary.totals.unknownCostCount += 1;
      }
    }
    if (row.status === 'failed' || row.status === 'timeout' || row.status === 'rejected') summary.totals.failed += 1;
    byModelMap.set(row.modelId, model);
  }
  summary.byStatus = [...byStatusMap.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);
  summary.byModel = [...byModelMap.entries()]
    .map(([modelId, value]) => ({ modelId, ...value }))
    .sort((a, b) => b.count - a.count);
  return summary;
}

export type AiProviderCallQuery = {
  status: AiProviderCallStatus | null;
  modelId: string | null;
  merchantId: string | null;
  page: number;
  pageSize: number;
};

/** 列表筛选参数：非法值一律忽略，不把非法输入当成合法筛选。 */
export function normalizeCallQuery(query: Record<string, unknown>): AiProviderCallQuery {
  const takeInt = (value: unknown, fallback: number, min: number, max: number) => {
    const numeric = typeof value === 'string' ? Number(value) : value;
    if (typeof numeric !== 'number' || !Number.isSafeInteger(numeric)) return fallback;
    return Math.min(Math.max(numeric, min), max);
  };
  const modelId = typeof query.modelId === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(query.modelId) ? query.modelId : null;
  const merchantId = typeof query.merchantId === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(query.merchantId)
    ? query.merchantId
    : null;
  return {
    status: isProviderCallStatus(query.status) ? query.status : null,
    modelId,
    merchantId,
    page: takeInt(query.page, 1, 1, 10_000),
    pageSize: takeInt(query.pageSize, 20, 1, 100)
  };
}

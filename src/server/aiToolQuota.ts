import type { ModaGptPlanCode } from './modagptBilling';

/**
 * MODAUI AI Tools 的调用额度与用量记账（纯逻辑，便于单元测试）。
 *
 * 设计文档：docs/engineering/architecture/MODaUI-AI-Tools-PLATFORM.md §P1
 * 数据归属：用量写 `ModaGptAiUsageRecord`（已有表，不新增模型），`feature='ai.tools'`，
 * `model` 记录 toolId，`idempotencyKey` 由 merchantId + taskId 生成，重复写入不会重复计数。
 * 额度上下限可通过 `ModaGptBillingFeature('ai.tools').config` 覆盖，不需要改代码发版。
 */

/** 用量表中代表本平台调用的 feature 键（同时也是计费特性键）。 */
export const AI_TOOL_USAGE_FEATURE = 'ai.tools' as const;

export type AiToolQuotaLimits = {
  dailyCalls: number;
  monthlyCalls: number;
};

/**
 * 默认额度：免费额度用于试用期体验，付费档位随套餐提升。
 * 这是可运营参数，产品可在 `ModaGptBillingFeature('ai.tools').config` 中覆盖；
 * 覆盖值必须通过 `parseAiToolQuotaLimits` 校验后才会生效。
 */
export const AI_TOOL_QUOTA_DEFAULTS: Record<ModaGptPlanCode, AiToolQuotaLimits> = {
  FREE: { dailyCalls: 20, monthlyCalls: 200 },
  PLUS: { dailyCalls: 100, monthlyCalls: 1000 },
  PRO: { dailyCalls: 200, monthlyCalls: 2000 },
  BUSINESS: { dailyCalls: 500, monthlyCalls: 5000 },
  FASHION_PRO: { dailyCalls: 1000, monthlyCalls: 10000 }
};

export type AiToolQuotaDenialReason = 'quota_exceeded_daily' | 'quota_exceeded_monthly';

export type AiToolQuotaState = {
  planId: ModaGptPlanCode;
  limits: AiToolQuotaLimits;
  used: { daily: number; monthly: number };
  remaining: { daily: number; monthly: number };
};

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

/**
 * 从计费特性配置里读取额度覆盖值。
 * 配置非法时整体忽略并回退默认值，避免一条坏配置把商家额度清成 0。
 */
export function parseAiToolQuotaLimits(
  config: string | null | undefined,
  planId: ModaGptPlanCode
): AiToolQuotaLimits {
  const fallback = AI_TOOL_QUOTA_DEFAULTS[planId] ?? AI_TOOL_QUOTA_DEFAULTS.FREE;
  if (typeof config !== 'string' || !config.trim()) return { ...fallback };
  let parsed: unknown;
  try {
    parsed = JSON.parse(config);
  } catch {
    return { ...fallback };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...fallback };
  const record = parsed as Record<string, unknown>;
  const daily = record.dailyCalls;
  const monthly = record.monthlyCalls;
  return {
    dailyCalls: isPositiveInteger(daily) ? daily : fallback.dailyCalls,
    monthlyCalls: isPositiveInteger(monthly) ? monthly : fallback.monthlyCalls
  };
}

/** 自然日与自然月窗口（UTC，与 ModaGPT 既有用量周期一致）。 */
export function getAiToolUsageWindows(now = new Date()): { dayStart: Date; monthStart: Date } {
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { dayStart, monthStart };
}

export function evaluateAiToolQuota(input: {
  planId: ModaGptPlanCode;
  limits: AiToolQuotaLimits;
  used: { daily: number; monthly: number };
}): { allowed: boolean; reason: AiToolQuotaDenialReason | null; remaining: { daily: number; monthly: number } } {
  const remaining = {
    daily: Math.max(0, input.limits.dailyCalls - input.used.daily),
    monthly: Math.max(0, input.limits.monthlyCalls - input.used.monthly)
  };
  if (input.used.monthly >= input.limits.monthlyCalls) {
    return { allowed: false, reason: 'quota_exceeded_monthly', remaining };
  }
  if (input.used.daily >= input.limits.dailyCalls) {
    return { allowed: false, reason: 'quota_exceeded_daily', remaining };
  }
  return { allowed: true, reason: null, remaining };
}

/** 用量记录的唯一键：同一 taskId 重复写只会命中 upsert 更新，不会重复计数。 */
export function buildAiToolUsageIdempotencyKey(input: { merchantId: string; taskId: string }): string {
  return `${AI_TOOL_USAGE_FEATURE}:${input.merchantId}:${input.taskId}`;
}

export type AiToolUsageRecordInput = {
  merchantId: string;
  planId: ModaGptPlanCode;
  toolId: string;
  taskId: string;
  credits: number;
  latencyMs: number | null;
  status: 'succeeded' | 'failed';
  agentId?: string | null;
};

/**
 * 生成写入 `ModaGptAiUsageRecord` 的数据。
 * `credits` 只来自 Manifest 中声明的真实成本，未接通计费时恒为 0，不虚报消费。
 */
export function buildAiToolUsageRecord(input: AiToolUsageRecordInput) {
  return {
    merchantId: input.merchantId,
    planId: input.planId,
    feature: AI_TOOL_USAGE_FEATURE,
    agentId: input.agentId ?? null,
    taskId: input.taskId,
    provider: 'modaui',
    model: input.toolId.slice(0, 120),
    credits: Number.isSafeInteger(input.credits) && input.credits > 0 ? input.credits : 0,
    imageUnits: 0,
    videoSeconds: 0,
    voiceSeconds: 0,
    latencyMs: input.latencyMs,
    status: input.status,
    idempotencyKey: buildAiToolUsageIdempotencyKey(input)
  };
}

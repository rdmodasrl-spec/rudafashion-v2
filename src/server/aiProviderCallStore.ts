import {
  AI_PROVIDER_TASK_TYPES,
  isProviderCallStatus,
  summarizeProviderCalls,
  type AiProviderCallQuery,
  type AiProviderCallSummary,
  type AiProviderCallStatus
} from './aiProviderConsole';

/**
 * MODAUI AI 服务商调用记录 — 唯一写入路径。
 *
 * 约束（见 docs/engineering/modules/modaui-ai-provider-console.md §7）：
 * - 只记录真实发生的调用；`succeeded` 必须带结果地址，禁止空结果标记成功。
 * - 记录失败不得影响商家侧生成：表未迁移或写入异常时返回 null / 空列表，由调用方降级。
 * - Prisma 以最小结构类型注入，便于用纯 stub 验证查询条件，不需要真实数据库。
 */

type JsonRecord = Record<string, unknown>;

export type AiProviderCallPrismaLike = {
  aiProviderCall: {
    create(args: any): Promise<any>;
    update(args: any): Promise<any>;
    updateMany(args: any): Promise<any>;
    findMany(args: any): Promise<any[]>;
    count(args: any): Promise<number>;
  };
};

export type AiProviderCallDraft = {
  providerId: string;
  modelId: string;
  taskType: string;
  jobId?: string | null;
  merchantId?: string | null;
  appId?: string | null;
  estimatedCents?: number | null;
  pricingVersion?: string | null;
  createdBy?: string | null;
};

export type AiProviderCallFinish = {
  id: string;
  status: AiProviderCallStatus;
  costCents?: number | null;
  estimatedCents?: number | null;
  assetId?: string | null;
  assetUrl?: string | null;
  errorCode?: string | null;
  failureReason?: string | null;
  durationMs?: number | null;
};

const MAX = {
  modelId: 64,
  taskType: 24,
  jobId: 128,
  merchantId: 120,
  appId: 64,
  assetId: 128,
  assetUrl: 1024,
  errorCode: 48,
  failureReason: 400,
  pricingVersion: 32,
  createdBy: 64
} as const;

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function count(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return null;
  return value;
}

/** Prisma 的「表不存在」（P2021 / 42P01）在这里统一识别，用于降级而不是崩溃。 */
export function isProviderCallStorageMissing(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: unknown }).code;
  if (code === 'P2021' || code === '42P01') return true;
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' && /AiProviderCall|42P01|does not exist/i.test(message);
}

/** 新建记录：返回 id；存储不可用时返回 null，调用方继续业务流程。 */
export async function startProviderCall(
  prisma: AiProviderCallPrismaLike,
  draft: AiProviderCallDraft
): Promise<string | null> {
  const modelId = text(draft.modelId, MAX.modelId);
  const taskType = text(draft.taskType, MAX.taskType);
  if (!modelId || !taskType || !(AI_PROVIDER_TASK_TYPES as readonly string[]).includes(taskType)) return null;
  if (!text(draft.providerId, 32)) return null;
  try {
    const row = await prisma.aiProviderCall.create({
      data: {
        providerId: draft.providerId,
        modelId,
        taskType,
        jobId: text(draft.jobId, MAX.jobId),
        merchantId: text(draft.merchantId, MAX.merchantId),
        appId: text(draft.appId, MAX.appId),
        status: 'pending',
        costCents: null,
        costSource: null,
        estimatedCents: count(draft.estimatedCents),
        pricingVersion: text(draft.pricingVersion, MAX.pricingVersion),
        createdBy: text(draft.createdBy, MAX.createdBy)
      },
      select: { id: true }
    });
    return typeof row?.id === 'string' ? row.id : null;
  } catch (error) {
    if (!isProviderCallStorageMissing(error)) {
      console.error('[ai-provider-call-start]', error instanceof Error ? error.message : 'failed');
    }
    return null;
  }
}

/** 组装结束记录的字段；不满足「成功带结果、失败带原因」时返回 null。 */
function finishData(finish: Omit<AiProviderCallFinish, 'id'>): JsonRecord | null {
  if (!isProviderCallStatus(finish.status)) return null;
  const assetUrl = text(finish.assetUrl, MAX.assetUrl);
  if (finish.status === 'succeeded' && !assetUrl) return null;
  const errorCode = text(finish.errorCode, MAX.errorCode);
  if (finish.status !== 'succeeded' && !errorCode) return null;
  const costCents = count(finish.costCents);
  const estimatedCents = count(finish.estimatedCents);
  return {
    status: finish.status,
    costCents,
    costSource: costCents !== null ? 'provider' : estimatedCents !== null ? 'estimate' : 'unknown',
    estimatedCents,
    assetId: text(finish.assetId, MAX.assetId),
    assetUrl,
    errorCode: finish.status === 'succeeded' ? null : errorCode,
    failureReason: text(finish.failureReason, MAX.failureReason),
    durationMs: count(finish.durationMs),
    finishedAt: new Date()
  };
}

/** 结束记录：成功必须有结果地址、失败必须有错误码；不满足条件时拒绝写入。 */
export async function finishProviderCall(
  prisma: AiProviderCallPrismaLike,
  finish: AiProviderCallFinish
): Promise<boolean> {
  if (!finish.id) return false;
  const data = finishData(finish);
  if (!data) return false;
  try {
    await prisma.aiProviderCall.update({ where: { id: finish.id }, data });
    return true;
  } catch (error) {
    if (!isProviderCallStorageMissing(error)) {
      console.error('[ai-provider-call-finish]', error instanceof Error ? error.message : 'failed');
    }
    return false;
  }
}

/**
 * 异步任务（视频）在轮询到终态时按 jobId 结束记录。
 * 只更新仍为 pending 的行，重复轮询不会覆盖已结束结果。
 */
export async function finishProviderCallByJob(
  prisma: AiProviderCallPrismaLike,
  finish: Omit<AiProviderCallFinish, 'id'> & { jobId: string }
): Promise<boolean> {
  if (!finish.jobId) return false;
  const data = finishData(finish);
  if (!data) return false;
  try {
    const result = await prisma.aiProviderCall.updateMany({
      where: { jobId: finish.jobId, status: 'pending' },
      data
    });
    return Boolean(result);
  } catch (error) {
    if (!isProviderCallStorageMissing(error)) {
      console.error('[ai-provider-call-finish-job]', error instanceof Error ? error.message : 'failed');
    }
    return false;
  }
}

export type AiProviderCallListResult = {
  calls: any[];
  total: number;
  migrationPending: boolean;
};

export async function listProviderCalls(
  prisma: AiProviderCallPrismaLike,
  input: { providerId: string; query: AiProviderCallQuery }
): Promise<AiProviderCallListResult> {
  const where: JsonRecord = { providerId: input.providerId };
  if (input.query.status) where.status = input.query.status;
  if (input.query.modelId) where.modelId = input.query.modelId;
  if (input.query.merchantId) where.merchantId = input.query.merchantId;
  try {
    const [rows, total] = await Promise.all([
      prisma.aiProviderCall.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (input.query.page - 1) * input.query.pageSize,
        take: input.query.pageSize
      }),
      prisma.aiProviderCall.count({ where })
    ]);
    return {
      calls: Array.isArray(rows) ? rows : [],
      total: typeof total === 'number' ? total : 0,
      migrationPending: false
    };
  } catch (error) {
    if (!isProviderCallStorageMissing(error)) {
      console.error('[ai-provider-call-list]', error instanceof Error ? error.message : 'failed');
    }
    return { calls: [], total: 0, migrationPending: true };
  }
}

export type AiProviderCallSummaryResult = {
  summary: AiProviderCallSummary;
  migrationPending: boolean;
};

/** 汇总只取窗口内的行，按状态/模型聚合；表缺失时返回空汇总并标记 migrationPending。 */
export async function getProviderCallSummary(
  prisma: AiProviderCallPrismaLike,
  input: { providerId: string; days: number; now?: Date }
): Promise<AiProviderCallSummaryResult> {
  const days = Number.isSafeInteger(input.days) ? Math.min(Math.max(input.days, 1), 90) : 7;
  const since = new Date((input.now ?? new Date()).getTime() - days * 24 * 60 * 60 * 1000);
  try {
    const rows = await prisma.aiProviderCall.findMany({
      where: { providerId: input.providerId, createdAt: { gte: since } },
      select: { status: true, modelId: true, taskType: true, costCents: true, estimatedCents: true },
      take: 5000
    });
    return { summary: summarizeProviderCalls(Array.isArray(rows) ? rows : []), migrationPending: false };
  } catch (error) {
    if (!isProviderCallStorageMissing(error)) {
      console.error('[ai-provider-call-summary]', error instanceof Error ? error.message : 'failed');
    }
    return { summary: summarizeProviderCalls([]), migrationPending: true };
  }
}

import { apiPost, ApiError } from './client';

/**
 * ModaUI 图片/试衣生成客户端。
 *
 * 服务端 `POST /api/merchant/modagpt/images` 是**同步**接口：生成完成后直接返回
 * `status: 'completed'` + `imageDataUrl`，不存在异步任务查询路由。
 * 因此这里不再轮询、不做「刷新恢复」，避免请求并不存在的异步任务查询路由。
 */

export type ModaGptImageTaskResult = {
  success: true;
  status: 'completed';
  taskId: string;
  task: 'imageGeneration' | 'tryOn';
  garmentStorageKey?: string;
  imageDataUrl: string;
  expiresAt: string;
  quota?: { used: number; limit: number; remaining: number };
  credits?: { used: number; remaining: number };
};

export class ModaGptImageTaskUnknownError extends Error {
  constructor(code: string) {
    super(code || 'MODAGPT_IMAGE_TASK_RESULT_UNKNOWN');
    this.name = 'ModaGptImageTaskUnknownError';
  }
}

export function isModaGptImageTaskUnknownError(error: unknown): error is ModaGptImageTaskUnknownError {
  return error instanceof ModaGptImageTaskUnknownError;
}

const IDEMPOTENCY_KEY_PATTERN = /^image-[A-Za-z0-9._-]{8,80}$/;

export function createModaGptImageTaskKey(): string {
  return `image-${crypto.randomUUID()}`;
}

export async function requestModaGptImage(
  body: unknown,
  merchantId: string,
  timeoutMs = 180_000
): Promise<ModaGptImageTaskResult> {
  const key = createModaGptImageTaskKey();
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) throw new Error('MODAGPT_IMAGE_TASK_ID_INVALID');
  void merchantId;
  const result = await apiPost<ModaGptImageTaskResult | { success: true; status?: string; error?: string }>(
    '/api/merchant/modagpt/images',
    body,
    timeoutMs,
    { 'Idempotency-Key': key }
  );
  if (result?.status === 'completed' && typeof (result as ModaGptImageTaskResult).imageDataUrl === 'string') {
    return result as ModaGptImageTaskResult;
  }
  if (result?.status === 'failed') {
    throw new Error((result as { error?: string }).error || 'MODAGPT_IMAGE_TASK_FAILED');
  }
  throw new ModaGptImageTaskUnknownError((result as { error?: string })?.error || 'MODAGPT_IMAGE_TASK_RESULT_UNKNOWN');
}

export { ApiError };

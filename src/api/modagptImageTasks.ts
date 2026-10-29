import { apiGet, apiPost, ApiError } from './client';

const pendingImageTaskStorageKeyPrefix = 'ruda.modagpt.pending-image-tasks.v1.';
const pendingImageTaskKeyPattern = /^image-[A-Za-z0-9._-]{8,80}$/;

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

type ModaGptImageTaskStatus =
  | ModaGptImageTaskResult
  | {
    success: true;
    status: 'processing';
    taskId: string;
    task?: 'imageGeneration' | 'tryOn';
    garmentStorageKey?: string;
  }
  | {
    success: true;
    status: 'unknown';
    taskId: string;
    task?: 'imageGeneration' | 'tryOn';
    garmentStorageKey?: string;
    error: string;
  }
  | {
    success: true;
    status: 'failed';
    taskId: string;
    task?: 'imageGeneration' | 'tryOn';
    garmentStorageKey?: string;
    error: string;
  };

class ModaGptImageTaskUnknownError extends Error {
  constructor(code: string) {
    super(code || 'MODAGPT_IMAGE_TASK_RESULT_UNKNOWN');
    this.name = 'ModaGptImageTaskUnknownError';
  }
}

class ModaGptImageTaskTypeMismatchError extends Error {}

export function isModaGptImageTaskUnknownError(error: unknown): error is ModaGptImageTaskUnknownError {
  return error instanceof ModaGptImageTaskUnknownError;
}

function getSessionStorage(): Storage {
  if (typeof window === 'undefined') throw new Error('MODAGPT_IMAGE_RECOVERY_STORAGE_UNAVAILABLE');
  try {
    return window.sessionStorage;
  } catch {
    throw new Error('MODAGPT_IMAGE_RECOVERY_STORAGE_UNAVAILABLE');
  }
}

function getPendingStorageKey(merchantId: string): string {
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(merchantId)) throw new Error('MODAGPT_IMAGE_TASK_MERCHANT_INVALID');
  return `${pendingImageTaskStorageKeyPrefix}${merchantId}`;
}

function readPendingKeys(merchantId: string, storage = getSessionStorage()): string[] {
  const raw = storage.getItem(getPendingStorageKey(merchantId));
  if (!raw) return [];
  let values: unknown;
  try {
    values = JSON.parse(raw);
  } catch {
    throw new Error('MODAGPT_IMAGE_RECOVERY_STATE_INVALID');
  }
  if (!Array.isArray(values) || values.some(value =>
    typeof value !== 'string' || !pendingImageTaskKeyPattern.test(value)
  )) throw new Error('MODAGPT_IMAGE_RECOVERY_STATE_INVALID');
  return [...new Set(values)];
}

function writePendingKeys(merchantId: string, keys: string[], storage = getSessionStorage()): void {
  if (keys.length > 20) throw new Error('MODAGPT_IMAGE_RECOVERY_LIMIT_REACHED');
  storage.setItem(getPendingStorageKey(merchantId), JSON.stringify(keys));
}

function rememberPendingKey(key: string, merchantId: string): void {
  writePendingKeys(merchantId, [...new Set([...readPendingKeys(merchantId), key])]);
}

export function getPendingModaGptImageTaskKeys(merchantId: string): string[] {
  return readPendingKeys(merchantId);
}

export function forgetPendingModaGptImageTask(key: string, merchantId: string): void {
  writePendingKeys(merchantId, readPendingKeys(merchantId).filter(value => value !== key));
}

async function loadImageTask(key: string, merchantId: string): Promise<ModaGptImageTaskStatus | null> {
  try {
    return await apiGet<ModaGptImageTaskStatus>(
      `/api/merchant/modagpt/images/tasks/${encodeURIComponent(key)}`
    );
  } catch (error) {
    if (error instanceof ApiError && error.code === 'MODAGPT_IMAGE_TASK_NOT_FOUND') return null;
    if (error instanceof ApiError && error.code === 'MODAGPT_IMAGE_TASK_EXPIRED') {
      forgetPendingModaGptImageTask(key, merchantId);
    }
    throw error;
  }
}

function taskError(task: Extract<ModaGptImageTaskStatus, { status: 'failed' }>): Error {
  return new Error(task.error || 'MODAGPT_IMAGE_TASK_FAILED');
}

async function waitForImageTask(
  key: string,
  merchantId: string,
  initial?: ModaGptImageTaskStatus,
  expectedTask?: 'imageGeneration' | 'tryOn',
  expectedGarmentStorageKey?: string
): Promise<ModaGptImageTaskResult> {
  const deadline = Date.now() + 180_000;
  let task = initial;
  while (Date.now() < deadline) {
    task ??= await loadImageTask(key, merchantId) ?? undefined;
    if (!task) throw new ApiError('MODAGPT_IMAGE_TASK_NOT_FOUND', 404, 'MODAGPT_IMAGE_TASK_NOT_FOUND');
    if (expectedTask && task.task && task.task !== expectedTask) {
      throw new ModaGptImageTaskTypeMismatchError();
    }
    if (expectedGarmentStorageKey && task.task === 'tryOn'
      && task.garmentStorageKey !== expectedGarmentStorageKey) {
      throw new ModaGptImageTaskTypeMismatchError();
    }
    if (task.status === 'completed') {
      forgetPendingModaGptImageTask(key, merchantId);
      return task;
    }
    if (task.status === 'failed') {
      forgetPendingModaGptImageTask(key, merchantId);
      throw taskError(task);
    }
    if (task.status === 'unknown') throw new ModaGptImageTaskUnknownError(task.error);
    await new Promise(resolve => setTimeout(resolve, 1_000));
    task = undefined;
  }
  throw new Error('MODAGPT_IMAGE_TASK_STILL_PROCESSING');
}

export async function recoverModaGptImageTask(
  key: string,
  merchantId: string,
  expectedTask?: 'imageGeneration' | 'tryOn',
  expectedGarmentStorageKey?: string
): Promise<ModaGptImageTaskResult | null> {
  if (!pendingImageTaskKeyPattern.test(key)) throw new Error('MODAGPT_IMAGE_TASK_ID_INVALID');
  const task = await loadImageTask(key, merchantId);
  if (!task) {
    forgetPendingModaGptImageTask(key, merchantId);
    return null;
  }
  try {
    return await waitForImageTask(key, merchantId, task, expectedTask, expectedGarmentStorageKey);
  } catch (error) {
    if (error instanceof ModaGptImageTaskTypeMismatchError) return null;
    throw error;
  }
}

export async function requestModaGptImage(
  body: unknown,
  merchantId: string,
  timeoutMs = 180_000
): Promise<ModaGptImageTaskResult> {
  const key = `image-${crypto.randomUUID()}`;
  rememberPendingKey(key, merchantId);
  try {
    const result = await apiPost<ModaGptImageTaskStatus>(
      '/api/merchant/modagpt/images',
      body,
      timeoutMs,
      { 'Idempotency-Key': key }
    );
    if (result.status === 'completed') {
      forgetPendingModaGptImageTask(key, merchantId);
      return result;
    }
    if (result.status === 'failed') {
      forgetPendingModaGptImageTask(key, merchantId);
      throw taskError(result);
    }
    return await waitForImageTask(key, merchantId, result);
  } catch (error) {
    if (error instanceof ModaGptImageTaskUnknownError) throw error;
    if (error instanceof Error && error.message === 'MODAGPT_IMAGE_TASK_FAILED') throw error;
    try {
      const task = await loadImageTask(key, merchantId);
      if (!task) {
        forgetPendingModaGptImageTask(key, merchantId);
        throw error;
      }
      return await waitForImageTask(key, merchantId, task);
    } catch (recoveryError) {
      if (recoveryError instanceof ApiError && recoveryError.code === 'MODAGPT_IMAGE_TASK_NOT_FOUND') {
        forgetPendingModaGptImageTask(key, merchantId);
      }
      throw recoveryError === error ? error : recoveryError;
    }
  }
}

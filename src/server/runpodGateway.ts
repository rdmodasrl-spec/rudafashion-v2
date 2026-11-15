/**
 * MODAUI Runpod 公共端点网关（服务端专用，纯网络客户端，无 Prisma）。
 *
 * 规格见 docs/engineering/modules/modaui-runpod-gateway.md。
 *
 * 硬约束：
 * - API Key 只从服务端环境变量读取，任何返回值、错误信息、日志都不得包含密钥。
 * - 只允许调用 `aiProviderCatalog` 里登记的 slug；不认识的 slug 在发请求前就失败。
 * - 价格算不出来（目录缺模型或缺该分辨率单价）时**不发起付费调用**。
 * - 输出提取不到 http(s) 媒体链接时报 `RUNPOD_OUTPUT_INVALID`，绝不拼接或猜测 URL。
 */

import {
  createDefaultAiProviderCatalog,
  findAiProviderModel,
  type AiProviderCatalog,
  type AiProviderModel
} from './aiProviderCatalog';
import { estimateAiProviderCost, type AiCostEstimate } from './aiProviderPricing';

export const RUNPOD_API_KEY_ENV = 'RUNPOD_API_KEY';
export const RUNPOD_API_BASE_ENV = 'RUNPOD_API_BASE_URL';
export const RUNPOD_DEFAULT_BASE_URL = 'https://api.runpod.ai';

/** 单次请求的硬上限（代码护栏，不是运营参数）。 */
export const RUNPOD_MAX_IMAGES_PER_REQUEST = 4;
export const RUNPOD_MAX_VIDEO_SECONDS = 10;
export const RUNPOD_MAX_TTS_CHARACTERS = 3000;

/** 默认超时：同步 90s、提交 30s、查询状态 30s、轮询总截止 300s。 */
export const RUNPOD_DEFAULT_RUNSYNC_TIMEOUT_MS = 90_000;
export const RUNPOD_DEFAULT_SUBMIT_TIMEOUT_MS = 30_000;
export const RUNPOD_DEFAULT_STATUS_TIMEOUT_MS = 30_000;
export const RUNPOD_DEFAULT_POLL_DEADLINE_MS = 300_000;

export type RunpodErrorCode =
  | 'RUNPOD_NOT_CONFIGURED'
  | 'RUNPOD_MODEL_NOT_ALLOWED'
  | 'RUNPOD_USAGE_LIMIT'
  | 'RUNPOD_PRICE_UNKNOWN'
  | 'RUNPOD_INVALID_INPUT'
  | 'RUNPOD_UNAUTHORIZED'
  | 'RUNPOD_RATE_LIMITED'
  | 'RUNPOD_UPSTREAM_ERROR'
  | 'RUNPOD_TIMEOUT'
  | 'RUNPOD_JOB_FAILED'
  | 'RUNPOD_OUTPUT_INVALID';

export class RunpodError extends Error {
  readonly code: RunpodErrorCode;
  readonly httpStatus?: number;
  readonly retryAfterMs?: number;
  readonly jobId?: string;

  constructor(
    code: RunpodErrorCode,
    message: string,
    extra: { httpStatus?: number; retryAfterMs?: number; jobId?: string } = {}
  ) {
    super(message);
    this.name = 'RunpodError';
    this.code = code;
    this.httpStatus = extra.httpStatus;
    this.retryAfterMs = extra.retryAfterMs;
    this.jobId = extra.jobId;
  }
}

export type RunpodConfig = {
  /** 未配置时为 null；配置状态下也只在本模块内部使用，永不外传。 */
  apiKey: string | null;
  baseUrl: string;
  configured: boolean;
};

/** 读取运行配置。只判断存在性，任何日志都不得打印 `apiKey`。 */
export function readRunpodConfig(env: Record<string, string | undefined> = process.env): RunpodConfig {
  const rawKey = env[RUNPOD_API_KEY_ENV]?.trim();
  const apiKey = rawKey ? rawKey : null;
  const rawBase = env[RUNPOD_API_BASE_ENV]?.trim();
  const baseUrl = (rawBase ? rawBase : RUNPOD_DEFAULT_BASE_URL).replace(/\/+$/, '');
  return { apiKey, baseUrl, configured: Boolean(apiKey) };
}

/** 目录里已登记的 Runpod slug（唯一事实来源：aiProviderCatalog）。 */
export function listRunpodModelIds(catalog: AiProviderCatalog = createDefaultAiProviderCatalog()): string[] {
  return catalog.models.filter(model => model.providerId === 'runpod').map(model => model.modelId);
}

function resolveRunpodModel(catalog: AiProviderCatalog, modelId: string): AiProviderModel {
  const model = findAiProviderModel(catalog, modelId);
  if (!model || model.providerId !== 'runpod') {
    throw new RunpodError('RUNPOD_MODEL_NOT_ALLOWED', `Unregistered Runpod model: ${modelId}`);
  }
  if (model.status === 'disabled') {
    throw new RunpodError('RUNPOD_MODEL_NOT_ALLOWED', `Runpod model disabled in catalog: ${modelId}`);
  }
  return model;
}

export type RunpodUsage =
  | { kind: 'image'; count: number; resolutionKey?: string }
  | { kind: 'video'; seconds: number; resolutionKey?: string }
  | { kind: 'tts'; characters: number };

export type RunpodCostGuard =
  | { ok: true; usd: number; modelId: string }
  | { ok: false; reason: 'RUNPOD_PRICE_UNKNOWN' | 'RUNPOD_USAGE_LIMIT'; detail: string };

/** 调用前的成本守门：先查用量上限与价格，算不出就拒绝调用（不按 0 记账）。 */
export function estimateRunpodRequestCost(input: {
  modelId: string;
  usage: RunpodUsage;
  catalog?: AiProviderCatalog;
  now?: Date;
}): RunpodCostGuard {
  const usage = input.usage;
  if (usage.kind === 'image'
    && (!Number.isFinite(usage.count) || usage.count <= 0 || usage.count > RUNPOD_MAX_IMAGES_PER_REQUEST)) {
    return { ok: false, reason: 'RUNPOD_USAGE_LIMIT', detail: `image count must be 1..${RUNPOD_MAX_IMAGES_PER_REQUEST}` };
  }
  if (usage.kind === 'video'
    && (!Number.isFinite(usage.seconds) || usage.seconds <= 0 || usage.seconds > RUNPOD_MAX_VIDEO_SECONDS)) {
    return { ok: false, reason: 'RUNPOD_USAGE_LIMIT', detail: `video seconds must be 0..${RUNPOD_MAX_VIDEO_SECONDS}` };
  }
  if (usage.kind === 'tts'
    && (!Number.isFinite(usage.characters) || usage.characters <= 0 || usage.characters > RUNPOD_MAX_TTS_CHARACTERS)) {
    return { ok: false, reason: 'RUNPOD_USAGE_LIMIT', detail: `tts characters must be 1..${RUNPOD_MAX_TTS_CHARACTERS}` };
  }

  const catalog = input.catalog ?? createDefaultAiProviderCatalog();
  const model = findAiProviderModel(catalog, input.modelId);
  if (!model || model.providerId !== 'runpod') {
    return { ok: false, reason: 'RUNPOD_PRICE_UNKNOWN', detail: `model not in catalog: ${input.modelId}` };
  }

  const estimate: AiCostEstimate = usage.kind === 'image'
    ? estimateAiProviderCost({
      model,
      usage: { kind: 'image', count: usage.count, resolutionKey: usage.resolutionKey ?? '1k' },
      now: input.now
    })
    : usage.kind === 'video'
      ? estimateAiProviderCost({
        model,
        usage: { kind: 'video', seconds: usage.seconds, resolutionKey: usage.resolutionKey ?? '720p' },
        now: input.now
      })
      : estimateAiProviderCost({ model, usage: { kind: 'tts', characters: usage.characters }, now: input.now });

  if (estimate.ok === false) {
    return { ok: false, reason: 'RUNPOD_PRICE_UNKNOWN', detail: estimate.reason };
  }
  return { ok: true, usd: estimate.usd, modelId: model.modelId };
}

export type RunpodHttpResponse = {
  ok: boolean;
  status: number;
  headers?: { get(name: string): string | null };
  text(): Promise<string>;
};

export type RunpodFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal }
) => Promise<RunpodHttpResponse>;

export type RunpodJobResult = {
  jobId: string;
  status: 'COMPLETED';
  mediaUrls: string[];
  delayTimeMs?: number;
  executionTimeMs?: number;
};

export type RunpodJobHandle = {
  jobId: string;
  status: string;
};

export type RunpodRequestContext = {
  config?: RunpodConfig;
  catalog?: AiProviderCatalog;
  fetchImpl?: RunpodFetch;
  timeoutMs?: number;
};

const RUNPOD_TERMINAL_FAILURES = new Set(['FAILED', 'CANCELLED', 'TIMED_OUT']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 递归收集 http(s) 媒体链接；重复链接去重，保持出现顺序。 */
export function extractRunpodMediaUrls(output: unknown): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  const walk = (value: unknown, depth: number) => {
    if (depth > 6 || value === null || value === undefined) return;
    if (typeof value === 'string') {
      if (/^https?:\/\/\S+$/i.test(value) && !seen.has(value)) {
        seen.add(value);
        found.push(value);
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(item => walk(item, depth + 1));
      return;
    }
    if (isRecord(value)) {
      Object.values(value).forEach(item => walk(item, depth + 1));
    }
  };
  walk(output, 0);
  return found;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function parseJsonBody(text: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(text) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function truncate(value: string, limit = 300): string {
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}

function mapHttpFailure(status: number, body: string, retryAfterHeader?: string | null): RunpodError {
  const detail = truncate(body.trim());
  if (status === 401 || status === 403) {
    return new RunpodError('RUNPOD_UNAUTHORIZED', 'Runpod rejected the API key', { httpStatus: status });
  }
  if (status === 429) {
    const retryAfterSeconds = Number(retryAfterHeader);
    return new RunpodError('RUNPOD_RATE_LIMITED', 'Runpod rate limit hit', {
      httpStatus: status,
      retryAfterMs: Number.isFinite(retryAfterSeconds) ? Math.max(0, retryAfterSeconds) * 1000 : undefined
    });
  }
  if (status >= 500) {
    return new RunpodError('RUNPOD_UPSTREAM_ERROR', `Runpod upstream error: ${detail}`, { httpStatus: status });
  }
  return new RunpodError('RUNPOD_INVALID_INPUT', `Runpod rejected the request: ${detail}`, { httpStatus: status });
}

async function requestJson(
  url: string,
  options: { method: 'GET' | 'POST'; body?: unknown; context: RunpodRequestContext; timeoutMs: number }
): Promise<{ status: number; body: Record<string, unknown> }> {
  const config = options.context.config ?? readRunpodConfig();
  if (!config.configured || !config.apiKey) {
    throw new RunpodError('RUNPOD_NOT_CONFIGURED', 'RUNPOD_API_KEY is not configured');
  }
  const fetchImpl = options.context.fetchImpl ?? (globalThis.fetch as unknown as RunpodFetch | undefined);
  if (!fetchImpl) {
    throw new RunpodError('RUNPOD_UPSTREAM_ERROR', 'fetch is not available in this runtime');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: options.method,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal
    });
    const text = await response.text();
    if (!response.ok) {
      throw mapHttpFailure(response.status, text, response.headers?.get('retry-after') ?? null);
    }
    return { status: response.status, body: parseJsonBody(text) };
  } catch (error) {
    if (error instanceof RunpodError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new RunpodError('RUNPOD_TIMEOUT', `Runpod request exceeded ${options.timeoutMs}ms`);
    }
    throw new RunpodError(
      'RUNPOD_UPSTREAM_ERROR',
      `Runpod request failed: ${truncate(error instanceof Error ? error.message : String(error))}`
    );
  } finally {
    clearTimeout(timer);
  }
}

function toJobResult(payload: Record<string, unknown>, jobId: string): RunpodJobResult {
  const mediaUrls = extractRunpodMediaUrls(payload.output);
  if (mediaUrls.length === 0) {
    const dataUriOnly = JSON.stringify(payload.output ?? '').includes('data:');
    throw new RunpodError(
      'RUNPOD_OUTPUT_INVALID',
      dataUriOnly
        ? 'Runpod returned inline base64 media, which this gateway does not accept'
        : 'Runpod returned no media URL',
      { jobId }
    );
  }
  return {
    jobId,
    status: 'COMPLETED',
    mediaUrls,
    delayTimeMs: readNumber(payload.delayTime),
    executionTimeMs: readNumber(payload.executionTime)
  };
}

function readJobId(payload: Record<string, unknown>): string | undefined {
  return readString(payload.id) ?? readString(payload.jobId);
}

function readJobStatus(payload: Record<string, unknown>): string {
  return (readString(payload.status) ?? '').toUpperCase();
}

function jobFailureText(payload: Record<string, unknown>): string | undefined {
  const error = payload.error;
  if (typeof error === 'string') return truncate(error);
  if (isRecord(error)) {
    return truncate(readString(error.message) ?? readString(error.error) ?? JSON.stringify(error));
  }
  return undefined;
}

/** 同步任务（图片、短配音）。若供应商把任务排进队列，则自动转为轮询到完成。 */
export async function runpodRunsync(input: {
  modelId: string;
  input: Record<string, unknown>;
  context?: RunpodRequestContext;
}): Promise<RunpodJobResult> {
  const context = input.context ?? {};
  const catalog = context.catalog ?? createDefaultAiProviderCatalog();
  const model = resolveRunpodModel(catalog, input.modelId);
  const config = context.config ?? readRunpodConfig();
  const { body } = await requestJson(`${config.baseUrl}/v2/${model.modelId}/runsync`, {
    method: 'POST',
    body: { input: input.input },
    context: { ...context, config },
    timeoutMs: context.timeoutMs ?? RUNPOD_DEFAULT_RUNSYNC_TIMEOUT_MS
  });

  const jobId = readJobId(body) ?? 'unknown';
  const status = readJobStatus(body);
  if (status === 'COMPLETED') return toJobResult(body, jobId);
  if (RUNPOD_TERMINAL_FAILURES.has(status)) {
    throw new RunpodError('RUNPOD_JOB_FAILED', jobFailureText(body) ?? `Runpod job ${status}`, { jobId });
  }
  if (status === 'IN_QUEUE' || status === 'IN_PROGRESS') {
    return runpodWaitForJob({ modelId: model.modelId, jobId, context: { ...context, config } });
  }
  throw new RunpodError('RUNPOD_OUTPUT_INVALID', `Unexpected Runpod status: ${status || 'unknown'}`, { jobId });
}

/** 异步任务提交（视频）。返回 jobId，由调用方决定何时轮询。 */
export async function runpodRun(input: {
  modelId: string;
  input: Record<string, unknown>;
  context?: RunpodRequestContext;
}): Promise<RunpodJobHandle> {
  const context = input.context ?? {};
  const catalog = context.catalog ?? createDefaultAiProviderCatalog();
  const model = resolveRunpodModel(catalog, input.modelId);
  const config = context.config ?? readRunpodConfig();
  const { body } = await requestJson(`${config.baseUrl}/v2/${model.modelId}/run`, {
    method: 'POST',
    body: { input: input.input },
    context: { ...context, config },
    timeoutMs: context.timeoutMs ?? RUNPOD_DEFAULT_SUBMIT_TIMEOUT_MS
  });
  const jobId = readJobId(body);
  if (!jobId) {
    throw new RunpodError('RUNPOD_OUTPUT_INVALID', 'Runpod did not return a job id');
  }
  return { jobId, status: readJobStatus(body) || 'IN_QUEUE' };
}

/** 查询一次任务状态；完成时返回媒体链接，失败时抛 `RUNPOD_JOB_FAILED`。 */
export async function runpodStatus(input: {
  modelId: string;
  jobId: string;
  context?: RunpodRequestContext;
}): Promise<{ status: string; result?: RunpodJobResult }> {
  const context = input.context ?? {};
  const catalog = context.catalog ?? createDefaultAiProviderCatalog();
  const model = resolveRunpodModel(catalog, input.modelId);
  const config = context.config ?? readRunpodConfig();
  const { body } = await requestJson(
    `${config.baseUrl}/v2/${model.modelId}/status/${encodeURIComponent(input.jobId)}`,
    {
      method: 'GET',
      context: { ...context, config },
      timeoutMs: context.timeoutMs ?? RUNPOD_DEFAULT_STATUS_TIMEOUT_MS
    }
  );
  const status = readJobStatus(body);
  if (status === 'COMPLETED') {
    return { status, result: toJobResult(body, input.jobId) };
  }
  if (RUNPOD_TERMINAL_FAILURES.has(status)) {
    throw new RunpodError('RUNPOD_JOB_FAILED', jobFailureText(body) ?? `Runpod job ${status}`, {
      jobId: input.jobId
    });
  }
  return { status: status || 'UNKNOWN' };
}

export type RunpodSleep = (ms: number) => Promise<void>;

export type RunpodHealth =
  | { ok: true; status: 'healthy'; modelId: string }
  | { ok: false; status: 'not_configured' | 'unauthorized' | 'not_supported' | 'upstream_error'; modelId: string; detail?: string };

/**
 * 凭据/端点可用性探测：`GET /v2/{slug}/health`。
 *
 * 只用于平台后台「测试连接」：200 表示端点可达且凭据被接受；401/403 表示密钥无效；
 * 4xx（如 404）表示该公共端点未提供 health 探测，**不代表密钥无效**；其余算上游异常。
 */
export async function runpodHealth(input: {
  modelId?: string;
  context?: RunpodRequestContext;
}): Promise<RunpodHealth> {
  const context = input.context ?? {};
  const catalog = context.catalog ?? createDefaultAiProviderCatalog();
  const modelId = input.modelId ?? 'z-image-turbo';
  const model = resolveRunpodModel(catalog, modelId);
  const config = context.config ?? readRunpodConfig();
  if (!config.configured) return { ok: false, status: 'not_configured', modelId };

  try {
    await requestJson(`${config.baseUrl}/v2/${model.modelId}/health`, {
      method: 'GET',
      context: { ...context, config },
      timeoutMs: context.timeoutMs ?? RUNPOD_DEFAULT_STATUS_TIMEOUT_MS
    });
    return { ok: true, status: 'healthy', modelId };
  } catch (error) {
    if (!(error instanceof RunpodError)) {
      return { ok: false, status: 'upstream_error', modelId };
    }
    if (error.code === 'RUNPOD_UNAUTHORIZED') return { ok: false, status: 'unauthorized', modelId };
    if (error.code === 'RUNPOD_INVALID_INPUT' || error.code === 'RUNPOD_OUTPUT_INVALID') {
      return { ok: false, status: 'not_supported', modelId };
    }
    if (error.code === 'RUNPOD_NOT_CONFIGURED') return { ok: false, status: 'not_configured', modelId };
    return { ok: false, status: 'upstream_error', modelId, detail: error.code };
  }
}


/** 轮询到完成或截止时间；截止即 `RUNPOD_TIMEOUT`（带 jobId，调用方可自行继续查询）。 */
export async function runpodWaitForJob(input: {
  modelId: string;
  jobId: string;
  context?: RunpodRequestContext;
  pollIntervalMs?: number;
  maxPollIntervalMs?: number;
  deadlineMs?: number;
  sleepImpl?: RunpodSleep;
  nowImpl?: () => number;
}): Promise<RunpodJobResult> {
  const sleep = input.sleepImpl ?? ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)));
  const now = input.nowImpl ?? (() => Date.now());
  const startedAt = now();
  const deadline = input.deadlineMs ?? RUNPOD_DEFAULT_POLL_DEADLINE_MS;
  let interval = input.pollIntervalMs ?? 2_000;
  const maxInterval = input.maxPollIntervalMs ?? 8_000;

  for (;;) {
    const { status, result } = await runpodStatus({
      modelId: input.modelId,
      jobId: input.jobId,
      context: input.context
    });
    if (result && status === 'COMPLETED') return result;
    if (now() - startedAt >= deadline) {
      throw new RunpodError('RUNPOD_TIMEOUT', `Runpod job ${input.jobId} did not finish within ${deadline}ms`, {
        jobId: input.jobId
      });
    }
    await sleep(interval);
    interval = Math.min(Math.round(interval * 1.5), maxInterval);
  }
}

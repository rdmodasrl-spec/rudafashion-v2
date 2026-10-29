import { getStoredPartnerReferral } from '../utils/share';
import { PORTAL_DOMAINS } from '../shared/portalDomains';

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly retryAfter?: number;
  readonly retryable: boolean;
  readonly requestId?: string;
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    status: number,
    code?: string,
    retryAfter?: number,
    retryable = false,
    requestId?: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
    this.retryable = retryable;
    this.requestId = requestId;
    this.details = details;
  }
}

export function resolveApiUrl(
  input: string,
  hostname = typeof window === 'undefined' ? '' : window.location.hostname
): string {
  if (typeof hostname !== 'string' || hostname.toLowerCase() !== PORTAL_DOMAINS.admin || !/^\/api(?:\/|$|\?)/.test(input)) {
    return input;
  }
  return new URL(input, `https://${PORTAL_DOMAINS.merchant}`).toString();
}

function getRetryAfterSeconds(response: Response): number | undefined {
  const value = response.headers.get('Retry-After');
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds;
  const retryAt = Date.parse(value);
  return Number.isFinite(retryAt) ? Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)) : undefined;
}

function toApiError(payload: unknown, status: number, retryAfter?: number): ApiError {
  const body = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const error = body.error;
  const structuredError = error && typeof error === 'object'
    ? error as Record<string, unknown>
    : undefined;
  const legacyCode = typeof error === 'string' ? error : undefined;
  const code = typeof structuredError?.code === 'string'
    ? structuredError.code
    : legacyCode || `REQUEST_FAILED_${status}`;
  const message = typeof structuredError?.message === 'string'
    ? structuredError.message
    : legacyCode || `REQUEST_FAILED_${status}`;
  const responseRetryAfter = typeof body.retryAfter === 'number' ? body.retryAfter : retryAfter;
  const details = structuredError?.details && typeof structuredError.details === 'object'
    ? structuredError.details as Record<string, unknown>
    : undefined;
  return new ApiError(
    message,
    status,
    code,
    responseRetryAfter,
    structuredError?.retryable === true,
    typeof body.requestId === 'string' ? body.requestId : undefined,
    details
  );
}

const apiCache = new Map<string, { data: any; expiry: number }>();

/**
 * Clears the shared GET cache. Auth/tenant transitions must call this so a
 * response cached for one merchant can never be served to another session.
 */
export function clearApiCache(pathPrefix?: string): void {
  if (!pathPrefix) {
    apiCache.clear();
    return;
  }
  for (const key of apiCache.keys()) {
    if (key.startsWith(pathPrefix)) apiCache.delete(key);
  }
}

export async function apiRequest<T>(
  input: string,
  init: RequestInit = {},
  timeoutMs = 15_000
): Promise<T> {
  const isGet = !init.method || init.method.toUpperCase() === 'GET';
  if (!isGet) {
    apiCache.clear();
  }
  const canRetry = isGet;
  const requestUrl = resolveApiUrl(input);
  let referralHeaders: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    const path = new URL(requestUrl, window.location.origin).pathname;
    if (path.startsWith('/api/auth/register/') || path === '/api/auth/register/buyer' || path === '/api/auth/login/google') {
      const referral = getStoredPartnerReferral();
      if (referral) {
        referralHeaders = {
          ...(referral.clickId ? { 'X-Ruda-Referral-Click': referral.clickId } : {}),
          'X-Ruda-Referral-Code': referral.partnerCode,
          'X-Ruda-Referral-Campaign': referral.campaignCode,
          'X-Ruda-Referral-Visitor': referral.visitorKey,
          'X-Ruda-Referral-Source': 'link',
          'X-Ruda-Referral-Landing': referral.landingPath
        };
      }
    }
  }
  for (let attempt = 0; attempt < (canRetry ? 2 : 1); attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const abortOnCallerSignal = () => controller.abort();
    init.signal?.addEventListener('abort', abortOnCallerSignal, { once: true });
    let response: Response;
    try {
      response = await fetch(requestUrl, {
        ...init,
        credentials: init.credentials || 'include',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...referralHeaders,
          ...init.headers
        }
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        if (init.signal?.aborted) {
          throw error;
        }
        throw new ApiError('REQUEST_TIMEOUT', 408, 'REQUEST_TIMEOUT');
      }
      if (canRetry && attempt === 0) {
        await new Promise(resolve => setTimeout(resolve, 250));
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      init.signal?.removeEventListener('abort', abortOnCallerSignal);
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.success === false) {
      if (canRetry && attempt === 0 && [408, 500, 502, 503, 504].includes(response.status)) {
        await new Promise(resolve => setTimeout(resolve, 250));
        continue;
      }
      throw toApiError(payload, response.status, getRetryAfterSeconds(response));
    }
    if (payload === null && response.status !== 204) {
      throw new ApiError('INVALID_API_RESPONSE', response.status, 'INVALID_API_RESPONSE');
    }
    return payload as T;
  }
  throw new ApiError('REQUEST_FAILED', 500, 'REQUEST_FAILED');
}

export function apiGet<T>(input: string, cacheMs = 0): Promise<T> {
  if (cacheMs > 0) {
    const cached = apiCache.get(input);
    if (cached && cached.expiry > Date.now()) {
      return Promise.resolve(cached.data as T);
    }
  }
  return apiRequest<T>(input).then(data => {
    if (cacheMs > 0) {
      apiCache.set(input, { data, expiry: Date.now() + cacheMs });
    }
    return data;
  });
}

export function apiPost<T>(input: string, body: unknown, timeoutMs?: number, headers?: HeadersInit): Promise<T> {
  const requestBody = body instanceof Blob ? body : JSON.stringify(body);
  return apiRequest<T>(input, {
    method: 'POST',
    body: requestBody,
    ...(headers ? { headers } : {})
  }, timeoutMs);
}

export function apiPostWithUploadProgress<T>(
  input: string,
  body: FormData,
  timeoutMs: number,
  onProgress: (loaded: number, total: number) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', resolveApiUrl(input));
    request.withCredentials = true;
    request.timeout = timeoutMs;
    request.setRequestHeader('Accept', 'application/json');
    request.upload.onprogress = event => {
      if (event.lengthComputable) onProgress(event.loaded, event.total);
    };
    request.onerror = () => reject(new ApiError('NETWORK_ERROR', 0, 'NETWORK_ERROR'));
    request.ontimeout = () => reject(new ApiError('REQUEST_TIMEOUT', 408, 'REQUEST_TIMEOUT'));
    request.onabort = () => reject(new ApiError('REQUEST_ABORTED', 0, 'REQUEST_ABORTED'));
    request.onload = () => {
      let payload: Record<string, unknown> | null = null;
      try {
        const parsed: unknown = JSON.parse(request.responseText);
        if (parsed && typeof parsed === 'object') payload = parsed as Record<string, unknown>;
      } catch {
        payload = null;
      }
      if (request.status < 200 || request.status >= 300 || payload?.success === false || !payload) {
        reject(toApiError(payload, request.status));
        return;
      }
      resolve(payload as T);
    };
    request.send(body);
  });
}

export function apiPut<T>(input: string, body: unknown): Promise<T> {
  return apiRequest<T>(input, { method: 'PUT', body: JSON.stringify(body) });
}

export function apiPatch<T>(input: string, body: unknown): Promise<T> {
  return apiRequest<T>(input, { method: 'PATCH', body: JSON.stringify(body) });
}

export function apiDelete<T>(input: string): Promise<T> {
  return apiRequest<T>(input, { method: 'DELETE' });
}

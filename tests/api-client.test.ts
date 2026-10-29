import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError, apiGet, resolveApiUrl } from '../src/api/client';

test('admin portal API requests use the production API host', () => {
  assert.equal(
    resolveApiUrl('/api/admin/health?fresh=1', 'admin.ruda.fashion'),
    'https://ruda.fashion/api/admin/health?fresh=1'
  );
});

test('API URL resolution leaves other hosts and non-API URLs unchanged', () => {
  assert.equal(resolveApiUrl('/api/admin/health', 'ruda.fashion'), '/api/admin/health');
  assert.equal(resolveApiUrl('/api/catalog', 'modaui.com'), '/api/catalog');
  assert.equal(resolveApiUrl('/assets/admin.js', 'admin.ruda.fashion'), '/assets/admin.js');
  assert.equal(resolveApiUrl('https://storage.example.com/upload', 'admin.ruda.fashion'), 'https://storage.example.com/upload');
  assert.equal(resolveApiUrl('/api/admin/health', undefined as unknown as string), '/api/admin/health');
});

test('admin API requests target the API host and preserve credentials', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let requestedUrl = '';
  let credentials: RequestCredentials | undefined;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { hostname: 'admin.ruda.fashion' } } });
  globalThis.fetch = async (input, init) => {
    requestedUrl = String(input);
    credentials = init?.credentials;
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  try {
    await apiGet('/api/admin/health');
    assert.equal(requestedUrl, 'https://ruda.fashion/api/admin/health');
    assert.equal(credentials, 'include');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('GET requests do not immediately retry rate limits and expose Retry-After', async () => {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  globalThis.fetch = async () => {
    requestCount += 1;
    return new Response(JSON.stringify({ success: false, error: 'API_RATE_LIMITED' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '120' }
    });
  };

  try {
    await assert.rejects(apiGet('/api/test'), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.code, 'API_RATE_LIMITED');
      assert.equal(error.retryAfter, 120);
      return true;
    });
    assert.equal(requestCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('API errors preserve the standard error code, retry hint, and request id', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    success: false,
    error: {
      code: 'PROVIDER_UNAVAILABLE',
      message: 'The provider is temporarily unavailable',
      retryable: true
    },
    requestId: 'request-123',
    retryAfter: 45
  }), {
    status: 502,
    headers: { 'Content-Type': 'application/json' }
  });

  try {
    await assert.rejects(apiGet('/api/test'), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.message, 'The provider is temporarily unavailable');
      assert.equal(error.code, 'PROVIDER_UNAVAILABLE');
      assert.equal(error.retryable, true);
      assert.equal(error.retryAfter, 45);
      assert.equal(error.requestId, 'request-123');
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('successful empty JSON responses are rejected instead of returned as valid data', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('null', {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });

  try {
    await assert.rejects(apiGet('/api/test'), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.code, 'INVALID_API_RESPONSE');
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

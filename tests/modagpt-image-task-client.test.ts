import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  isModaGptImageTaskUnknownError,
  requestModaGptImage
} from '../src/api/modagptImageTasks';

const merchantId = 'merchant-test-01';
const completedTask = {
  success: true,
  status: 'completed',
  taskId: 'image-123e4567-e89b-12d3-a456-426614174000',
  task: 'imageGeneration',
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  imageDataUrl: 'data:image/webp;base64,dGVzdA=='
};

const withFetch = async (handler: (url: string, init: RequestInit | undefined) => Response | Promise<Response>, run: () => Promise<void>) => {
  const originalFetch = globalThis.fetch;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      location: { hostname: 'merchant.ruda.fashion', origin: 'https://merchant.ruda.fashion' }
    }
  });
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => handler(String(input), init)) as typeof fetch;
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
    Reflect.deleteProperty(globalThis, 'window');
  }
};

test('image client returns the synchronous completed result and sends an idempotency key', async () => {
  let requestKey = '';
  let calls = 0;
  await withFetch((url, init) => {
    calls += 1;
    if (!url.endsWith('/api/merchant/modagpt/images')) throw new Error(`Unexpected request: ${url}`);
    requestKey = new Headers(init?.headers).get('Idempotency-Key') || '';
    return new Response(JSON.stringify(completedTask), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }, async () => {
    const result = await requestModaGptImage({ task: 'imageGeneration', prompt: 'A coat' }, merchantId);
    assert.equal(result.imageDataUrl, completedTask.imageDataUrl);
    assert.equal(result.status, 'completed');
  });
  assert.match(requestKey, /^image-[0-9a-f-]{36}$/i);
  assert.equal(calls, 1, 'synchronous contract must not trigger a follow-up task poll');
});

test('image client surfaces an unknown result instead of pretending success', async () => {
  await withFetch(() => new Response(JSON.stringify({ success: true, status: 'processing' }), {
    status: 202,
    headers: { 'Content-Type': 'application/json' }
  }), async () => {
    await assert.rejects(
      () => requestModaGptImage({ task: 'imageGeneration', prompt: 'A coat' }, merchantId),
      (error: unknown) => isModaGptImageTaskUnknownError(error)
    );
  });
});

test('image client never calls the removed async task route and the server answers synchronously', () => {
  const client = readFileSync(path.join(process.cwd(), 'src/api/modagptImageTasks.ts'), 'utf8');
  assert.doesNotMatch(client, /images\/tasks\//);
  const server = readFileSync(path.join(process.cwd(), 'server.ts'), 'utf8');
  const start = server.indexOf("'/api/merchant/modagpt/images'");
  assert.ok(start > 0, 'modagpt images route must exist');
  const block = server.slice(start, start + 40_000);
  assert.match(block, /status: 'completed' as const/);
  assert.match(block, /imageDataUrl: `data:image\/webp;base64,/);
});

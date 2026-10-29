import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getPendingModaGptImageTaskKeys,
  requestModaGptImage
} from '../src/api/modagptImageTasks';

const merchantId = 'merchant-test-01';
const completedTask = {
  success: true,
  status: 'completed',
  taskId: '123e4567-e89b-12d3-a456-426614174000',
  task: 'imageGeneration',
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  imageDataUrl: 'data:image/webp;base64,dGVzdA=='
};

test('image client polls an accepted task and clears its session recovery key', async () => {
  const originalFetch = globalThis.fetch;
  let storageValue: string | null = null;
  let requestKey = '';
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      location: { hostname: 'merchant.ruda.fashion', origin: 'https://merchant.ruda.fashion' },
      sessionStorage: {
        getItem: () => storageValue,
        setItem: (_key: string, value: string) => { storageValue = value; }
      }
    }
  });
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith('/api/merchant/modagpt/images')) {
      requestKey = new Headers(init?.headers).get('Idempotency-Key') || '';
      return new Response(JSON.stringify({
        success: true,
        status: 'processing',
        taskId: completedTask.taskId
      }), { status: 202, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.includes('/api/merchant/modagpt/images/tasks/')) {
      return new Response(JSON.stringify(completedTask), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    throw new Error(`Unexpected image task request: ${url}`);
  };
  try {
    const result = await requestModaGptImage({ task: 'imageGeneration', prompt: 'A coat' }, merchantId);
    assert.equal(result.imageDataUrl, completedTask.imageDataUrl);
    assert.match(requestKey, /^image-[0-9a-f-]{36}$/i);
    assert.deepEqual(getPendingModaGptImageTaskKeys(merchantId), []);
  } finally {
    globalThis.fetch = originalFetch;
    Reflect.deleteProperty(globalThis, 'window');
  }
});

test('image client recovers a completed result after the submit response is lost', async () => {
  const originalFetch = globalThis.fetch;
  let storageValue: string | null = null;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      location: { hostname: 'merchant.ruda.fashion', origin: 'https://merchant.ruda.fashion' },
      sessionStorage: {
        getItem: () => storageValue,
        setItem: (_key: string, value: string) => { storageValue = value; }
      }
    }
  });
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith('/api/merchant/modagpt/images')) {
      const key = new Headers(init?.headers).get('Idempotency-Key') || '';
      storageValue = JSON.stringify([key]);
      throw new Error('connection lost after server accepted the request');
    }
    if (url.includes('/api/merchant/modagpt/images/tasks/')) {
      return new Response(JSON.stringify(completedTask), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    throw new Error(`Unexpected image task request: ${url}`);
  };
  try {
    const result = await requestModaGptImage({ task: 'imageGeneration', prompt: 'A coat' }, merchantId);
    assert.equal(result.imageDataUrl, completedTask.imageDataUrl);
    assert.deepEqual(getPendingModaGptImageTaskKeys(merchantId), []);
  } finally {
    globalThis.fetch = originalFetch;
    Reflect.deleteProperty(globalThis, 'window');
  }
});

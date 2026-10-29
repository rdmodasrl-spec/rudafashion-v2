import assert from 'node:assert/strict';
import test from 'node:test';
import { AiProviderCircuitBreaker } from '../src/server/aiProviderCircuitBreaker';

test('provider circuit opens after consecutive failures and rejects calls without invoking the provider', async () => {
  let now = 1000;
  const breaker = new AiProviderCircuitBreaker(3, 30_000, () => now);
  let calls = 0;
  const failingAction = async () => {
    calls += 1;
    throw new Error('provider unavailable');
  };

  await assert.rejects(breaker.execute('reasoning_deepseek', failingAction), /provider unavailable/);
  await assert.rejects(breaker.execute('reasoning_deepseek', failingAction), /provider unavailable/);
  assert.equal(breaker.getSnapshots().reasoning_deepseek.state, 'closed');
  await assert.rejects(breaker.execute('reasoning_deepseek', failingAction), /provider unavailable/);
  assert.deepEqual(breaker.getSnapshots().reasoning_deepseek, {
    state: 'open',
    consecutiveFailures: 3,
    retryAfterMs: 30_000
  });

  await assert.rejects(
    breaker.execute('reasoning_deepseek', failingAction),
    /AI_PROVIDER_CIRCUIT_OPEN/
  );
  assert.equal(calls, 3);
  now += 30_000;
  assert.equal(breaker.getSnapshots().reasoning_deepseek.state, 'half_open');
});

test('half-open allows one probe, remains open after probe failure, and closes after probe success', async () => {
  let now = 0;
  const breaker = new AiProviderCircuitBreaker(1, 100, () => now);
  await assert.rejects(
    breaker.execute('vision_gemini', async () => { throw new Error('offline'); }),
    /offline/
  );
  now = 100;

  let releaseProbe!: (value: string) => void;
  const pendingProbe = breaker.execute('vision_gemini', () => new Promise<string>(resolve => {
    releaseProbe = resolve;
  }));
  await assert.rejects(
    breaker.execute('vision_gemini', async () => 'second probe'),
    /AI_PROVIDER_CIRCUIT_OPEN/
  );
  releaseProbe('healthy');
  assert.equal(await pendingProbe, 'healthy');
  assert.deepEqual(breaker.getSnapshots().vision_gemini, {
    state: 'closed',
    consecutiveFailures: 0,
    retryAfterMs: 0
  });

  await assert.rejects(
    breaker.execute('vision_gemini', async () => { throw new Error('offline again'); }),
    /offline again/
  );
  now += 100;
  await assert.rejects(
    breaker.execute('vision_gemini', async () => { throw new Error('probe failed'); }),
    /probe failed/
  );
  assert.deepEqual(breaker.getSnapshots().vision_gemini, {
    state: 'open',
    consecutiveFailures: 2,
    retryAfterMs: 100
  });
});

test('provider circuits are isolated, resettable, and reject invalid keys', async () => {
  const breaker = new AiProviderCircuitBreaker(1, 100, () => 0);
  await assert.rejects(
    breaker.execute('reasoning_deepseek', async () => { throw new Error('offline'); }),
    /offline/
  );
  assert.equal(breaker.getSnapshots().reasoning_deepseek.state, 'open');
  assert.equal(Object.hasOwn(breaker.getSnapshots(), 'advanced_openai'), false);
  await assert.rejects(breaker.execute('provider.secret', async () => 'bad key'), /AI_PROVIDER_CIRCUIT_KEY_INVALID/);
  breaker.clear();
  assert.deepEqual(breaker.getSnapshots(), {});
});

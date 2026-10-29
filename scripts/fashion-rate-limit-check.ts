import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';
import { consumeSharedRateLimit } from '../src/server/fashionRateLimit';

/**
 * Integration check for the shared (PostgreSQL-backed) fashion rate limiter.
 *
 * Verifies three behaviours the previous in-memory Map could not provide:
 *   1. concurrent callers cannot exceed the limit (single atomic upsert),
 *   2. the counter survives a client/process restart,
 *   3. an expired window restarts at count 1.
 *
 * It writes only rows whose key starts with `test:ratelimit:` and deletes them
 * before exiting.
 */
const run = async () => {
  const key = `test:ratelimit:${crypto.randomUUID()}`;
  const windowKey = `test:ratelimit:window:${crypto.randomUUID()}`;
  const first = new PrismaClient();
  const results: Record<string, unknown> = {};
  let ok = true;
  try {
    const limit = 10;
    const attempts = 40;
    const decisions = await Promise.all(Array.from({ length: attempts }, () =>
      consumeSharedRateLimit(first, key, limit, 60_000)
    ));
    const allowed = decisions.filter(Boolean).length;
    results.concurrentAllowed = allowed;
    results.concurrentAttempts = attempts;
    if (allowed !== limit) {
      ok = false;
      results.concurrentError = `expected exactly ${limit} allowed, got ${allowed}`;
    }

    await first.$disconnect();
    const second = new PrismaClient();
    try {
      const afterRestart = await consumeSharedRateLimit(second, key, limit, 60_000);
      results.allowedAfterRestart = afterRestart;
      if (afterRestart) {
        ok = false;
        results.restartError = 'counter reset after reconnect; limits would not survive restarts';
      }

      const windowDecisions: boolean[] = [];
      for (let index = 0; index < 4; index += 1) {
        windowDecisions.push(await consumeSharedRateLimit(second, windowKey, 3, 1_000));
      }
      results.windowFirstBurst = windowDecisions;
      await new Promise(resolve => setTimeout(resolve, 1_200));
      const afterWindow = await consumeSharedRateLimit(second, windowKey, 3, 1_000);
      results.allowedAfterWindow = afterWindow;
      if (windowDecisions.filter(Boolean).length !== 3 || !afterWindow) {
        ok = false;
        results.windowError = 'window did not reset as expected';
      }
    } finally {
      await second.$executeRawUnsafe('DELETE FROM "RateLimitCounter" WHERE "key" = $1 OR "key" = $2', key, windowKey);
      await second.$disconnect();
    }
  } catch (error) {
    ok = false;
    results.error = error instanceof Error ? error.message : String(error);
  }
  console.log(JSON.stringify({ ok, ...results }, null, 2));
  process.exit(ok ? 0 : 1);
};

void run();

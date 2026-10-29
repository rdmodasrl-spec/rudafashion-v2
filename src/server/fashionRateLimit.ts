import type { PrismaClient } from '@prisma/client';

/**
 * Shared, database-backed rate limiting for the fashion community.
 *
 * The previous implementation used a process-local Map, so two workers (or a
 * restart) each kept their own counters. This performs one atomic upsert and
 * returns the count for the current window, which makes the limit hold across
 * processes and restarts.
 *
 * The caller is responsible for falling back to an in-memory limiter if the
 * database is unavailable; this function throws in that case.
 */
export async function consumeSharedRateLimit(
  client: PrismaClient,
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const rows = await client.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "RateLimitCounter" ("key", "count", "windowStart", "expiresAt", "updatedAt")
    VALUES (${key}, 1, NOW(), NOW() + (CAST(${windowMs} AS text) || ' milliseconds')::interval, NOW())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitCounter"."expiresAt" <= NOW() THEN 1 ELSE "RateLimitCounter"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimitCounter"."expiresAt" <= NOW() THEN NOW() ELSE "RateLimitCounter"."windowStart" END,
      "expiresAt" = CASE WHEN "RateLimitCounter"."expiresAt" <= NOW()
        THEN NOW() + (CAST(${windowMs} AS text) || ' milliseconds')::interval
        ELSE "RateLimitCounter"."expiresAt" END,
      "updatedAt" = NOW()
    RETURNING "count"
  `;
  return Number(rows[0]?.count ?? limit + 1) <= limit;
}

/** Removes long-expired counters. Safe to call opportunistically. */
export async function purgeExpiredRateLimits(client: PrismaClient): Promise<void> {
  await client.$executeRaw`DELETE FROM "RateLimitCounter" WHERE "expiresAt" < NOW() - interval '1 hour'`;
}

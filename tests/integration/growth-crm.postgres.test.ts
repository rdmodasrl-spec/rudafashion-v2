import 'dotenv/config';
import assert from 'node:assert/strict';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import { createGrowthCrmAutomationFollowUps } from '../../src/server/growthCrm';

const databaseUrl = process.env.PARTNER_TEST_DATABASE_URL;
if (process.env.NODE_ENV !== 'test') throw new Error('GROWTH_CRM_POSTGRES_INTEGRATION_REQUIRES_NODE_ENV_TEST');
if (!databaseUrl) throw new Error('PARTNER_TEST_DATABASE_URL_REQUIRED');

const parsedTestUrl = new URL(databaseUrl);
const databaseName = decodeURIComponent(parsedTestUrl.pathname.replace(/^\//, '').split('/')[0] || '');
if (!/(^|[-_])(test|e2e)([-_]|$)/i.test(databaseName)) {
  throw new Error('GROWTH_CRM_TEST_DATABASE_NAME_MUST_INCLUDE_TEST_OR_E2E');
}
if (process.env.DATABASE_URL) {
  const configuredUrl = new URL(process.env.DATABASE_URL);
  if (configuredUrl.host === parsedTestUrl.host && configuredUrl.pathname === parsedTestUrl.pathname) {
    throw new Error('GROWTH_CRM_TEST_DATABASE_MUST_NOT_MATCH_APPLICATION_DATABASE');
  }
}
if (!['localhost', '127.0.0.1', '::1'].includes(parsedTestUrl.hostname)
  && process.env.ALLOW_REMOTE_PARTNER_TEST_DATABASE !== 'true') {
  throw new Error('REMOTE_GROWTH_CRM_TEST_DATABASE_REQUIRES_EXPLICIT_OPT_IN');
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

test('PostgreSQL CRM candidates are recalculated from Customer lifecycle facts and inserted idempotently', async () => {
  const suffix = crypto.randomUUID().replaceAll('-', '');
  const consumerIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  const now = new Date();
  const staleRegistration = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
  const staleLogin = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
  try {
    await prisma.consumer.createMany({
      data: [
        {
          id: consumerIds[0],
          email: `growth-crm-activation-${suffix}@example.test`,
          passwordHash: 'integration-hash',
          firstName: 'Activation',
          lastName: 'Candidate',
          status: 'active',
          ordersCount: 0,
          createdAt: staleRegistration
        },
        {
          id: consumerIds[1],
          email: `growth-crm-retention-${suffix}@example.test`,
          passwordHash: 'integration-hash',
          firstName: 'Retention',
          lastName: 'Candidate',
          status: 'active',
          ordersCount: 1,
          createdAt: staleRegistration,
          lastLoginAt: staleLogin
        },
        {
          id: consumerIds[2],
          email: `growth-crm-current-${suffix}@example.test`,
          passwordHash: 'integration-hash',
          firstName: 'Current',
          lastName: 'Customer',
          status: 'active',
          ordersCount: 0,
          createdAt: now
        }
      ]
    });

    const counts = await Promise.all([
      createGrowthCrmAutomationFollowUps(prisma, now),
      createGrowthCrmAutomationFollowUps(prisma, now)
    ]);
    assert.equal(counts.reduce((total, count) => total + count, 0), 2);
    const followUps = await prisma.growthCrmFollowUp.findMany({
      where: { consumerId: { in: consumerIds } },
      select: { consumerId: true, category: true, automationKey: true }
    });
    assert.deepEqual(
      followUps.map(item => [item.consumerId, item.category]).sort(),
      [[consumerIds[0], 'activation'], [consumerIds[1], 'retention']].sort()
    );
    assert.ok(followUps.every(item => item.automationKey));
    assert.equal(await createGrowthCrmAutomationFollowUps(prisma, now), 0);

    await prisma.consumer.update({
      where: { id: consumerIds[0] },
      data: { ordersCount: 1, lastLoginAt: now }
    });
    assert.equal(await createGrowthCrmAutomationFollowUps(prisma, now), 0);
  } finally {
    await prisma.growthCrmFollowUp.deleteMany({ where: { consumerId: { in: consumerIds } } });
    await prisma.consumer.deleteMany({ where: { id: { in: consumerIds } } });
    await prisma.$disconnect();
  }
});

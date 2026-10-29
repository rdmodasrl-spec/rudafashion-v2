import 'dotenv/config';
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { grantModaGptCredits, reserveModaGptCredits, settleModaGptCreditReservation } from '../../src/server/modagptBilling';

const databaseUrl = process.env.BILLING_TEST_DATABASE_URL;
if (process.env.NODE_ENV !== 'test') throw new Error('BILLING_POSTGRES_INTEGRATION_REQUIRES_NODE_ENV_TEST');
if (!databaseUrl) throw new Error('BILLING_TEST_DATABASE_URL_REQUIRED');

const parsedTestUrl = new URL(databaseUrl);
const databaseName = decodeURIComponent(parsedTestUrl.pathname.replace(/^\//, '').split('/')[0] || '');
if (!/(^|[-_])(test|e2e)([-_]|$)/i.test(databaseName)) {
  throw new Error('BILLING_TEST_DATABASE_NAME_MUST_INCLUDE_TEST_OR_E2E');
}
if (process.env.DATABASE_URL) {
  const configuredUrl = new URL(process.env.DATABASE_URL);
  if (configuredUrl.host === parsedTestUrl.host && configuredUrl.pathname === parsedTestUrl.pathname) {
    throw new Error('BILLING_TEST_DATABASE_MUST_NOT_MATCH_APPLICATION_DATABASE');
  }
}
if (!['localhost', '127.0.0.1', '::1'].includes(parsedTestUrl.hostname)
  && process.env.ALLOW_REMOTE_BILLING_TEST_DATABASE !== 'true') {
  throw new Error('REMOTE_BILLING_TEST_DATABASE_REQUIRES_EXPLICIT_OPT_IN');
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
class RollbackIntegrationRun extends Error {}

test('PostgreSQL serializes Billing credit mutations and rolls back failed task transactions', async () => {
  const merchant = await prisma.merchant.findFirst({
    where: {
      billingSubscriptions: { none: { status: { in: ['TRIAL', 'ACTIVE', 'GRACE_PERIOD'] } } },
      creditLedgerEntries: { none: {} }
    },
    select: { id: true }
  });
  assert.ok(merchant, 'Seed the isolated Billing test database with an unused merchant first');
  const unique = randomUUID();
  const grantKey = `billing-it:${unique}:grant`;
  const reservationKey = `billing-it:${unique}:reservation`;
  const subscriptionKey = `billing-it:${unique}:subscription`;

  await assert.rejects(prisma.$transaction(async tx => {
    await tx.modaGptBillingFeature.update({
      where: { featureKey: 'ai.basic_chat' },
      data: { enabled: true, creditCost: 2, minimumPlan: 'FREE' }
    });
    const plan = await tx.modaGptBillingPlan.findUniqueOrThrow({ where: { id: 'BUSINESS' } });
    await tx.modaGptBillingSubscription.create({
      data: {
        merchantId: merchant.id,
        planId: plan.id,
        status: 'ACTIVE',
        idempotencyKey: subscriptionKey,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        planSnapshot: JSON.stringify({
          id: plan.id,
          monthlyPriceMinor: plan.monthlyPriceMinor,
          monthlyCredits: 8
        })
      }
    });

    const firstGrant = await grantModaGptCredits(tx, {
      merchantId: merchant.id,
      amount: 8,
      referenceType: 'integration_test',
      referenceId: unique,
      idempotencyKey: grantKey
    });
    const duplicateGrant = await grantModaGptCredits(tx, {
      merchantId: merchant.id,
      amount: 8,
      referenceType: 'integration_test',
      referenceId: unique,
      idempotencyKey: grantKey
    });
    assert.equal(firstGrant.entry.id, duplicateGrant.entry.id);
    assert.equal(duplicateGrant.balance, 8);

    const firstReservation = await reserveModaGptCredits(tx, {
      merchantId: merchant.id,
      feature: 'ai.basic_chat',
      idempotencyKey: reservationKey
    });
    const duplicateReservation = await reserveModaGptCredits(tx, {
      merchantId: merchant.id,
      feature: 'ai.basic_chat',
      idempotencyKey: reservationKey
    });
    assert.equal(firstReservation.reservation.id, duplicateReservation.reservation.id);
    assert.equal(duplicateReservation.balance, 6);

    const consumed = await settleModaGptCreditReservation(tx, {
      merchantId: merchant.id,
      reservationId: firstReservation.reservation.id,
      action: 'CONSUME',
      idempotencyKey: `${reservationKey}:consume`
    });
    const duplicateConsume = await settleModaGptCreditReservation(tx, {
      merchantId: merchant.id,
      reservationId: firstReservation.reservation.id,
      action: 'CONSUME',
      idempotencyKey: `${reservationKey}:consume`
    });
    assert.equal(consumed.balance, duplicateConsume.balance);
    assert.equal(consumed.balance, 6);
    throw new RollbackIntegrationRun();
  }), RollbackIntegrationRun);

  assert.equal(await prisma.modaGptBillingSubscription.findUnique({ where: { idempotencyKey: subscriptionKey } }), null);
  assert.equal(await prisma.modaGptCreditLedgerEntry.findUnique({ where: { idempotencyKey: grantKey } }), null);
  assert.equal(
    await prisma.modaGptCreditReservation.findUnique({
      where: { merchantId_idempotencyKey: { merchantId: merchant.id, idempotencyKey: reservationKey } }
    }),
    null
  );
});

test('PostgreSQL has the append-only trigger and Billing idempotency constraints', async () => {
  const rows = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT indexname AS name
    FROM pg_indexes
    WHERE schemaname = current_schema()
      AND tablename IN (
        'ModaGptCreditLedgerEntry',
        'ModaGptCreditReservation',
        'ModaGptBillingWebhookEvent',
        'ModaGptBillingPayment',
        'ModaGptBillingSubscription'
      )
      AND indexdef ILIKE '%UNIQUE%'
  `;
  const uniqueIndexNames = new Set(rows.map(row => row.name));
  assert.ok(uniqueIndexNames.has('ModaGptCreditLedgerEntry_idempotencyKey_key'));
  assert.ok(uniqueIndexNames.has('ModaGptCreditReservation_merchantId_idempotencyKey_key'));
  assert.ok(uniqueIndexNames.has('ModaGptBillingWebhookEvent_provider_providerEventId_key'));
  assert.ok(uniqueIndexNames.has('ModaGptBillingPayment_idempotencyKey_key'));
  assert.ok(uniqueIndexNames.has('ModaGptBillingSubscription_idempotencyKey_key'));

  const triggers = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT tgname AS name
    FROM pg_trigger
    WHERE tgrelid = '"ModaGptCreditLedgerEntry"'::regclass
      AND NOT tgisinternal
  `;
  assert.ok(triggers.some(trigger => trigger.name === 'ModaGptCreditLedgerEntry_append_only'));
});

test.after(async () => {
  await prisma.$disconnect();
});

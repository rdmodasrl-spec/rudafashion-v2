import assert from 'node:assert/strict';
import test from 'node:test';
import type { Prisma, PrismaClient } from '@prisma/client';
import {
  canUseModaGptBillingFeature,
  calculateModaGptCreditCost,
  loadModaGptBillingCatalog,
  modaGptFeatureKeys,
  modaGptPlanCodes,
  parseModaGptFeatureConfig,
  parsePlanFeatureEntitlements,
  parseUsageLimits,
  reserveModaGptCredits,
  serializePlanCatalogItem,
  settleModaGptCreditReservation,
  grantModaGptCredits,
  transitionModaGptSubscriptionStatus,
  isModaGptBillingCheckoutReady
} from '../src/server/modagptBilling';

function billingTransaction(creditCost = 3, config = '{}') {
  const ledger: Array<Record<string, any>> = [];
  const reservations = new Map<string, Record<string, any>>();
  const tx = {
    $queryRaw: async () => [{ id: 'merchant-a' }],
    modaGptBillingFeature: {
      findUnique: async () => ({
        featureKey: 'ai.image',
        enabled: true,
        creditCost,
        config,
        riskLevel: 'LOW'
      })
    },
    modaGptBillingSubscription: {
      findFirst: async () => ({
        id: 'subscription-a',
        plan: {
          id: 'FASHION_PRO',
          displayName: 'Fashion Pro',
          monthlyPriceMinor: 15900,
          currency: 'EUR',
          interval: 'month',
          status: 'active',
          purchaseEnabled: false,
          featured: false,
          recommended: false,
          monthlyCredits: 12000,
          rolloverPolicy: 'none',
          expirationPolicy: 'period_end',
          featureEntitlements: '{"ai.image":true}',
          usageLimits: '{}',
          version: 1
        }
      })
    },
    modaGptCreditLedgerEntry: {
      aggregate: async ({ where }: { where: { merchantId: string } }) => ({
        _sum: {
          amount: ledger.filter(entry => entry.merchantId === where.merchantId)
            .reduce((sum, entry) => sum + entry.amount, 0)
        }
      }),
      findUnique: async ({ where }: { where: { idempotencyKey: string } }) =>
        ledger.find(entry => entry.idempotencyKey === where.idempotencyKey) || null,
      create: async ({ data }: { data: Record<string, any> }) => {
        const entry = { id: `entry-${ledger.length + 1}`, ...data };
        ledger.push(entry);
        return entry;
      }
    },
    modaGptCreditReservation: {
      findUnique: async ({ where }: { where: { merchantId_idempotencyKey: { idempotencyKey: string } } }) =>
        reservations.get(where.merchantId_idempotencyKey.idempotencyKey) || null,
      create: async ({ data }: { data: Record<string, any> }) => {
        const reservation = { id: `reservation-${reservations.size + 1}`, ...data };
        reservations.set(data.idempotencyKey, reservation);
        return reservation;
      },
      findFirst: async ({ where }: { where: { id: string; merchantId: string } }) =>
        [...reservations.values()].find(row => row.id === where.id && row.merchantId === where.merchantId) || null,
      update: async ({ where, data }: { where: { id: string }; data: Record<string, any> }) => {
        const reservation = [...reservations.values()].find(row => row.id === where.id)!;
        Object.assign(reservation, data);
        return reservation;
      },
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) =>
        [...reservations.values()].find(row => row.id === where.id)
    }
  } as unknown as Prisma.TransactionClient;
  return { tx, ledger, reservations };
}

const planFixture = {
  id: 'BUSINESS',
  displayName: 'Business',
  monthlyPriceMinor: 9900,
  currency: 'EUR',
  interval: 'month',
  status: 'active',
  purchaseEnabled: false,
  featured: true,
  recommended: true,
  monthlyCredits: 12000,
  rolloverPolicy: 'none',
  expirationPolicy: 'period_end',
  featureEntitlements: '{"ai.basic_chat":true,"payment.collection":true}',
  usageLimits: '{}',
  version: 1
};

test('billing plan catalog contains only the fixed five EUR monthly plans with Business featured', () => {
  const plan = serializePlanCatalogItem(planFixture);
  assert.deepEqual(modaGptPlanCodes, ['FREE', 'PLUS', 'PRO', 'BUSINESS', 'FASHION_PRO']);
  assert.equal(plan.monthlyPriceMinor, 9900);
  assert.equal(plan.featured, true);
  assert.equal(plan.recommended, true);
  assert.equal(plan.monthlyCredits, 12000);
  assert.equal(modaGptFeatureKeys.length, 24);
});

test('billing catalog only queries supported monthly plan ids', async () => {
  let receivedWhere: unknown;
  const prisma = {
    modaGptBillingPlan: {
      findMany: async (args: { where: unknown }) => {
        receivedWhere = args.where;
        return [planFixture];
      }
    }
  } as unknown as PrismaClient;
  const catalog = await loadModaGptBillingCatalog(prisma);
  assert.deepEqual(receivedWhere, {
    status: 'active',
    id: { in: [...modaGptPlanCodes] }
  });
  assert.equal(catalog.length, 1);
  assert.equal(catalog[0].id, 'BUSINESS');
});

test('annual placeholder plans stay outside the catalog contract', () => {
  assert.throws(
    () => serializePlanCatalogItem({ ...planFixture, id: 'PLUS_YEAR', interval: 'year' }),
    /MODAGPT_BILLING_PLAN_CONFIG_INVALID/
  );
});

test('billing configuration parsers reject unknown features and unbounded or invalid limits', () => {
  const plan = serializePlanCatalogItem(planFixture);
  assert.throws(() => parsePlanFeatureEntitlements('{"ai.unknown":true}'), /MODAGPT_BILLING_PLAN_CONFIG_INVALID/);
  assert.throws(() => parsePlanFeatureEntitlements('{"ai.image":"yes"}'), /MODAGPT_BILLING_PLAN_CONFIG_INVALID/);
  assert.throws(() => parseUsageLimits('{"chat":-1}'), /MODAGPT_BILLING_PLAN_CONFIG_INVALID/);
  assert.throws(() => parseUsageLimits('{"chat":1.25}'), /MODAGPT_BILLING_PLAN_CONFIG_INVALID/);
  assert.equal(canUseModaGptBillingFeature(plan, 'payment.collection', true), true);
  assert.equal(canUseModaGptBillingFeature(plan, 'payment.collection', false), false);
  assert.equal(canUseModaGptBillingFeature(plan, 'payment.payout', true), false);
  assert.equal(canUseModaGptBillingFeature(plan, 'payment.collection', true, 'FASHION_PRO'), false);
  assert.equal(canUseModaGptBillingFeature(
    { ...plan, id: 'FASHION_PRO' },
    'payment.collection',
    true,
    'BUSINESS'
  ), false);
});

test('AI credit prices are centrally configurable by capability unit and model', () => {
  const config = JSON.stringify({
    creditPricing: {
      unit: 'token',
      default: { creditsPerUnit: 2, unitsPerCredit: 1000 },
      models: {
        'provider/model-a': { creditsPerUnit: 3, unitsPerCredit: 500 }
      }
    }
  });
  assert.equal(calculateModaGptCreditCost({
    featureCreditCost: 1,
    config,
    units: 1001
  }).credits, 4);
  assert.equal(calculateModaGptCreditCost({
    featureCreditCost: 1,
    config,
    model: 'provider/model-a',
    units: 1001
  }).credits, 9);
  assert.equal(calculateModaGptCreditCost({
    featureCreditCost: 2,
    config: '{}',
    units: 3
  }).credits, 6);
  assert.equal(parseModaGptFeatureConfig(JSON.stringify({
    version: 1,
    creditPricing: {
      unit: 'video_second',
      default: { creditsPerUnit: 2, unitsPerCredit: 5 },
      models: {}
    }
  })).creditPricing?.unit, 'video_second');
  assert.throws(() => parseModaGptFeatureConfig(JSON.stringify({
    creditPricing: { unit: 'usd', default: { creditsPerUnit: 1, unitsPerCredit: 1 }, models: {} }
  })), /MODAGPT_BILLING_FEATURE_CONFIG_INVALID/);
  assert.throws(() => calculateModaGptCreditCost({
    featureCreditCost: 1,
    config: '{}',
    units: 0
  }), /MODAGPT_CREDIT_UNITS_INVALID/);
});

test('credit reservations apply the configured model price before deducting from the ledger', async () => {
  const config = JSON.stringify({
    creditPricing: {
      unit: 'image',
      default: { creditsPerUnit: 2, unitsPerCredit: 1 },
      models: {
        'fal/model-premium': { creditsPerUnit: 7, unitsPerCredit: 1 }
      }
    }
  });
  const { tx } = billingTransaction(2, config);
  await grantModaGptCredits(tx, {
    merchantId: 'merchant-a',
    amount: 20,
    referenceType: 'test',
    referenceId: 'grant-model-cost',
    idempotencyKey: 'grant:model-cost'
  });
  const reservation = await reserveModaGptCredits(tx, {
    merchantId: 'merchant-a',
    feature: 'ai.image',
    idempotencyKey: 'image:model-premium',
    model: 'fal/model-premium',
    units: 2
  });
  assert.equal(reservation.reservation.credits, 14);
  assert.equal(reservation.balance, 6);
});

test('subscription state transitions reject illegal state changes and checkout readiness requires all controls', () => {
  assert.equal(transitionModaGptSubscriptionStatus('TRIAL', 'PAYMENT_SUCCEEDED'), 'ACTIVE');
  assert.equal(transitionModaGptSubscriptionStatus('ACTIVE', 'PAYMENT_FAILED'), 'PAST_DUE');
  assert.equal(transitionModaGptSubscriptionStatus('PAST_DUE', 'PAYMENT_SUCCEEDED'), 'ACTIVE');
  assert.equal(transitionModaGptSubscriptionStatus('ACTIVE', 'CANCELLED'), 'CANCELLED');
  assert.equal(transitionModaGptSubscriptionStatus('CANCELLED', 'PERIOD_ENDED'), 'EXPIRED');
  assert.throws(
    () => transitionModaGptSubscriptionStatus('EXPIRED', 'PAYMENT_SUCCEEDED'),
    /MODAGPT_SUBSCRIPTION_TRANSITION_INVALID/
  );
  assert.equal(isModaGptBillingCheckoutReady({
    supportsSubscriptions: true,
    webhookConfigured: true,
    automaticTaxConfigured: true,
    billingMode: 'test',
    stripeTestMode: true,
    stripeLiveMode: false,
    billingTestPurchasesEnabled: true,
    billingLivePurchasesEnabled: false
  }), true);
  assert.equal(isModaGptBillingCheckoutReady({
    supportsSubscriptions: true,
    webhookConfigured: true,
    automaticTaxConfigured: false,
    billingMode: 'test',
    stripeTestMode: true,
    stripeLiveMode: false,
    billingTestPurchasesEnabled: true,
    billingLivePurchasesEnabled: false
  }), false);
  assert.equal(isModaGptBillingCheckoutReady({
    supportsSubscriptions: true,
    webhookConfigured: true,
    automaticTaxConfigured: true,
    billingMode: 'test',
    stripeTestMode: false,
    stripeLiveMode: true,
    billingTestPurchasesEnabled: false,
    billingLivePurchasesEnabled: true
  }), false);
  assert.equal(isModaGptBillingCheckoutReady({
    supportsSubscriptions: true,
    webhookConfigured: true,
    automaticTaxConfigured: true,
    billingMode: 'live',
    stripeTestMode: false,
    stripeLiveMode: true,
    billingTestPurchasesEnabled: false,
    billingLivePurchasesEnabled: true
  }), true);
});

test('credit grants and reservations are tenant-locked, idempotent, and release safely after failures', async () => {
  const { tx, ledger, reservations } = billingTransaction();
  const grantInput = {
    merchantId: 'merchant-a',
    amount: 10,
    referenceType: 'manual_bonus',
    referenceId: 'bonus-1',
    idempotencyKey: 'bonus:merchant-a:1'
  };
  assert.equal((await grantModaGptCredits(tx, grantInput)).balance, 10);
  assert.equal((await grantModaGptCredits(tx, grantInput)).balance, 10);

  const reservation = await reserveModaGptCredits(tx, {
    merchantId: 'merchant-a',
    feature: 'ai.image',
    idempotencyKey: 'image-task:task-1'
  });
  assert.equal(reservation.balance, 7);
  assert.equal(reservations.size, 1);
  const released = await settleModaGptCreditReservation(tx, {
    merchantId: 'merchant-a',
    reservationId: reservation.reservation.id,
    action: 'RELEASE',
    idempotencyKey: 'release:image-task:task-1'
  });
  assert.equal(released.balance, 10);
  assert.equal(ledger.filter(entry => entry.entryType === 'GRANT').length, 1);
  assert.equal(ledger.filter(entry => entry.entryType === 'RESERVE').length, 1);
  assert.equal(ledger.filter(entry => entry.entryType === 'RELEASE').length, 1);
  await assert.rejects(
    reserveModaGptCredits(tx, {
      merchantId: 'merchant-a',
      feature: 'ai.image',
      idempotencyKey: 'image-task:task-1'
    }),
    /MODAGPT_CREDIT_RESERVATION_ALREADY_SETTLED/
  );
});

test('credit consumption is idempotent and does not return consumed credits', async () => {
  const { tx } = billingTransaction(4);
  await grantModaGptCredits(tx, {
    merchantId: 'merchant-a',
    amount: 6,
    referenceType: 'grant',
    referenceId: 'grant-1',
    idempotencyKey: 'grant:1'
  });
  const reservation = await reserveModaGptCredits(tx, {
    merchantId: 'merchant-a',
    feature: 'ai.image',
    idempotencyKey: 'image-task:task-2'
  });
  const input = {
    merchantId: 'merchant-a',
    reservationId: reservation.reservation.id,
    action: 'CONSUME' as const,
    idempotencyKey: 'consume:image-task:task-2'
  };
  assert.equal((await settleModaGptCreditReservation(tx, input)).balance, 2);
  assert.equal((await settleModaGptCreditReservation(tx, input)).balance, 2);
});

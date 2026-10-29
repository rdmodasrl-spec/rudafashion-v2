import { createHash, randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';

export const modaGptPlanCodes = ['FREE', 'PLUS', 'PRO', 'BUSINESS', 'FASHION_PRO'] as const;
export type ModaGptPlanCode = (typeof modaGptPlanCodes)[number];

export const modaGptFeatureKeys = [
  'ai.basic_chat',
  'ai.advanced_reasoning',
  'ai.product',
  'ai.inventory',
  'ai.sales',
  'ai.finance',
  'ai.automation',
  'ai.workflow',
  'ai.image',
  'ai.image_advanced',
  'ai.try_on',
  'ai.video',
  'ai.voice',
  'ai.design',
  'ai.batch_creative',
  'payment.channels',
  'payment.collection',
  'payment.payout',
  'payment.refund',
  'multi_store',
  'team',
  'knowledge_base',
  'advanced_analytics'
] as const;
export type ModaGptFeatureKey = (typeof modaGptFeatureKeys)[number];
export type ModaGptCreditUnit = 'request' | 'token' | 'image' | 'video_second' | 'voice_second';

type ModaGptCreditPricingRule = {
  creditsPerUnit: number;
  unitsPerCredit: number;
};

type ModaGptFeatureConfig = {
  creditPricing?: {
    unit: ModaGptCreditUnit;
    default: ModaGptCreditPricingRule;
    models: Record<string, ModaGptCreditPricingRule>;
  };
};

export type ModaGptPlanCatalogItem = {
  id: ModaGptPlanCode;
  displayName: string;
  monthlyPriceMinor: number;
  currency: 'EUR';
  interval: 'month';
  status: string;
  purchaseEnabled: boolean;
  featured: boolean;
  recommended: boolean;
  monthlyCredits: number | null;
  rolloverPolicy: string;
  expirationPolicy: string;
  featureEntitlements: Partial<Record<ModaGptFeatureKey, boolean>>;
  usageLimits: Record<string, number>;
  version: number;
};

export type ModaGptSubscriptionStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'GRACE_PERIOD'
  | 'PAUSED'
  | 'CANCELLED'
  | 'EXPIRED';

export type ModaGptSubscriptionEvent =
  | 'PAYMENT_SUCCEEDED'
  | 'PAYMENT_FAILED'
  | 'CANCELLED'
  | 'PERIOD_ENDED';

export function transitionModaGptSubscriptionStatus(
  current: ModaGptSubscriptionStatus,
  event: ModaGptSubscriptionEvent
): ModaGptSubscriptionStatus {
  const transitions: Record<ModaGptSubscriptionEvent, Partial<Record<ModaGptSubscriptionStatus, ModaGptSubscriptionStatus>>> = {
    PAYMENT_SUCCEEDED: { TRIAL: 'ACTIVE', ACTIVE: 'ACTIVE', PAST_DUE: 'ACTIVE', GRACE_PERIOD: 'ACTIVE' },
    PAYMENT_FAILED: { TRIAL: 'PAST_DUE', ACTIVE: 'PAST_DUE', PAST_DUE: 'PAST_DUE', GRACE_PERIOD: 'PAST_DUE' },
    CANCELLED: { TRIAL: 'CANCELLED', ACTIVE: 'CANCELLED', PAST_DUE: 'CANCELLED', GRACE_PERIOD: 'CANCELLED', PAUSED: 'CANCELLED' },
    PERIOD_ENDED: { TRIAL: 'EXPIRED', ACTIVE: 'EXPIRED', PAST_DUE: 'EXPIRED', GRACE_PERIOD: 'EXPIRED', PAUSED: 'EXPIRED', CANCELLED: 'EXPIRED' }
  };
  const result = transitions[event][current];
  if (!result) throw new Error('MODAGPT_SUBSCRIPTION_TRANSITION_INVALID');
  return result;
}

export function isModaGptBillingCheckoutReady(status: {
  supportsSubscriptions: boolean;
  webhookConfigured: boolean;
  automaticTaxConfigured: boolean;
  billingMode: 'test' | 'live' | null;
  stripeTestMode: boolean;
  stripeLiveMode: boolean;
  billingTestPurchasesEnabled: boolean;
  billingLivePurchasesEnabled: boolean;
}) {
  const selectedModeReady = status.billingMode === 'test'
    ? status.stripeTestMode && status.billingTestPurchasesEnabled
    : status.billingMode === 'live'
      ? status.stripeLiveMode && status.billingLivePurchasesEnabled
      : false;
  return status.supportsSubscriptions
    && status.webhookConfigured
    && status.automaticTaxConfigured
    && selectedModeReady;
}

const validFeatureKeys = new Set<string>(modaGptFeatureKeys);
const plansAtOrAboveMinimum: Record<ModaGptPlanCode, readonly ModaGptPlanCode[]> = {
  FREE: ['FREE', 'PLUS', 'PRO', 'BUSINESS', 'FASHION_PRO'],
  PLUS: ['PLUS', 'PRO', 'BUSINESS', 'FASHION_PRO'],
  PRO: ['PRO', 'BUSINESS', 'FASHION_PRO'],
  BUSINESS: ['BUSINESS'],
  FASHION_PRO: ['FASHION_PRO']
};

export function parsePlanFeatureEntitlements(value: string): Partial<Record<ModaGptFeatureKey, boolean>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('MODAGPT_BILLING_PLAN_CONFIG_INVALID');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('MODAGPT_BILLING_PLAN_CONFIG_INVALID');
  }
  const result: Partial<Record<ModaGptFeatureKey, boolean>> = {};
  for (const [key, enabled] of Object.entries(parsed)) {
    if (!validFeatureKeys.has(key) || typeof enabled !== 'boolean') {
      throw new Error('MODAGPT_BILLING_PLAN_CONFIG_INVALID');
    }
    result[key as ModaGptFeatureKey] = enabled;
  }
  return result;
}

export function parseUsageLimits(value: string): Record<string, number> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('MODAGPT_BILLING_PLAN_CONFIG_INVALID');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('MODAGPT_BILLING_PLAN_CONFIG_INVALID');
  }
  const limits: Record<string, number> = {};
  for (const [key, limit] of Object.entries(parsed)) {
    if (!/^[a-z][a-z0-9_.-]{0,63}$/.test(key)
      || typeof limit !== 'number'
      || !Number.isSafeInteger(limit)
      || limit < 0) {
      throw new Error('MODAGPT_BILLING_PLAN_CONFIG_INVALID');
    }
    limits[key] = limit;
  }
  return limits;
}

function parseCreditPricingRule(value: unknown): ModaGptCreditPricingRule {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('MODAGPT_BILLING_FEATURE_CONFIG_INVALID');
  }
  const rule = value as Record<string, unknown>;
  if (!Number.isSafeInteger(rule.creditsPerUnit)
    || (rule.creditsPerUnit as number) < 1
    || (rule.creditsPerUnit as number) > 1_000_000
    || !Number.isSafeInteger(rule.unitsPerCredit)
    || (rule.unitsPerCredit as number) < 1
    || (rule.unitsPerCredit as number) > 1_000_000) {
    throw new Error('MODAGPT_BILLING_FEATURE_CONFIG_INVALID');
  }
  return {
    creditsPerUnit: rule.creditsPerUnit as number,
    unitsPerCredit: rule.unitsPerCredit as number
  };
}

export function parseModaGptFeatureConfig(value: string): ModaGptFeatureConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('MODAGPT_BILLING_FEATURE_CONFIG_INVALID');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('MODAGPT_BILLING_FEATURE_CONFIG_INVALID');
  }
  const config = parsed as Record<string, unknown>;
  if (!Object.hasOwn(config, 'creditPricing')) return {};
  const pricing = config.creditPricing;
  if (!pricing || typeof pricing !== 'object' || Array.isArray(pricing)) {
    throw new Error('MODAGPT_BILLING_FEATURE_CONFIG_INVALID');
  }
  const rawPricing = pricing as Record<string, unknown>;
  const units: ModaGptCreditUnit[] = ['request', 'token', 'image', 'video_second', 'voice_second'];
  if (!units.includes(rawPricing.unit as ModaGptCreditUnit)
    || !rawPricing.models
    || typeof rawPricing.models !== 'object'
    || Array.isArray(rawPricing.models)) {
    throw new Error('MODAGPT_BILLING_FEATURE_CONFIG_INVALID');
  }
  const models: Record<string, ModaGptCreditPricingRule> = {};
  for (const [model, rule] of Object.entries(rawPricing.models)) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/.test(model)) {
      throw new Error('MODAGPT_BILLING_FEATURE_CONFIG_INVALID');
    }
    models[model] = parseCreditPricingRule(rule);
  }
  return {
    creditPricing: {
      unit: rawPricing.unit as ModaGptCreditUnit,
      default: parseCreditPricingRule(rawPricing.default),
      models
    }
  };
}

export function calculateModaGptCreditCost(input: {
  featureCreditCost: number;
  config: string;
  model?: string | null;
  units?: number;
}) {
  if (!Number.isSafeInteger(input.featureCreditCost)
    || input.featureCreditCost < 1
    || input.featureCreditCost > 1_000_000) {
    throw new Error('MODAGPT_FEATURE_COST_INVALID');
  }
  const units = input.units ?? 1;
  if (!Number.isSafeInteger(units) || units < 1 || units > 1_000_000) {
    throw new Error('MODAGPT_CREDIT_UNITS_INVALID');
  }
  const config = parseModaGptFeatureConfig(input.config);
  const pricing = config.creditPricing;
  const rule = pricing
    ? (input.model ? pricing.models[input.model] : undefined) || pricing.default
    : null;
  const credits = rule
    ? Math.ceil(units / rule.unitsPerCredit) * rule.creditsPerUnit
    : input.featureCreditCost * units;
  if (!Number.isSafeInteger(credits) || credits < 1 || credits > 10_000_000) {
    throw new Error('MODAGPT_FEATURE_COST_INVALID');
  }
  return {
    credits,
    unit: pricing?.unit || 'request'
  };
}

export function serializePlanCatalogItem(plan: {
  id: string;
  displayName: string;
  monthlyPriceMinor: number;
  currency: string;
  interval: string;
  status: string;
  purchaseEnabled: boolean;
  featured: boolean;
  recommended: boolean;
  monthlyCredits: number | null;
  rolloverPolicy: string;
  expirationPolicy: string;
  featureEntitlements: string;
  usageLimits: string;
  version: number;
}): ModaGptPlanCatalogItem {
  if (!modaGptPlanCodes.includes(plan.id as ModaGptPlanCode)
    || !Number.isSafeInteger(plan.monthlyPriceMinor)
    || plan.monthlyPriceMinor < 0
    || plan.currency !== 'EUR'
    || plan.interval !== 'month'
    || (plan.monthlyCredits !== null && (!Number.isSafeInteger(plan.monthlyCredits) || plan.monthlyCredits < 0))) {
    throw new Error('MODAGPT_BILLING_PLAN_CONFIG_INVALID');
  }
  return {
    id: plan.id as ModaGptPlanCode,
    displayName: plan.displayName,
    monthlyPriceMinor: plan.monthlyPriceMinor,
    currency: 'EUR',
    interval: 'month',
    status: plan.status,
    purchaseEnabled: plan.purchaseEnabled,
    featured: plan.featured,
    recommended: plan.recommended,
    monthlyCredits: plan.monthlyCredits,
    rolloverPolicy: plan.rolloverPolicy,
    expirationPolicy: plan.expirationPolicy,
    featureEntitlements: parsePlanFeatureEntitlements(plan.featureEntitlements),
    usageLimits: parseUsageLimits(plan.usageLimits),
    version: plan.version
  };
}

export async function loadModaGptBillingCatalog(prisma: PrismaClient) {
  const rows = await prisma.modaGptBillingPlan.findMany({
    // Annual plans are pre-seeded as disabled placeholders and are not supported by
    // the checkout/serialization contract yet. Restrict the query so they cannot
    // break the whole merchant catalog.
    where: { status: 'active', id: { in: [...modaGptPlanCodes] } },
    orderBy: [{ monthlyPriceMinor: 'asc' }, { id: 'asc' }]
  });
  return rows.map(serializePlanCatalogItem);
}

export async function getModaGptBillingPlanForMerchant(
  prisma: PrismaClient,
  merchantId: string,
  legacyPlan: 'free' | 'pro'
) {
  const subscription = await prisma.modaGptBillingSubscription.findFirst({
    where: {
      merchantId,
      status: { in: ['TRIAL', 'ACTIVE', 'GRACE_PERIOD'] },
      OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: new Date() } }]
    },
    include: { plan: true },
    orderBy: { createdAt: 'desc' }
  });
  if (subscription) {
    return {
      subscription,
      plan: serializePlanCatalogItem(subscription.plan),
      legacy: false
    };
  }
  const planId: ModaGptPlanCode = legacyPlan === 'pro' ? 'PRO' : 'FREE';
  const plan = await prisma.modaGptBillingPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error('MODAGPT_BILLING_CATALOG_NOT_INITIALIZED');
  return {
    subscription: null,
    plan: serializePlanCatalogItem(plan),
    legacy: true
  };
}

export function canUseModaGptBillingFeature(
  plan: Pick<ModaGptPlanCatalogItem, 'id' | 'featureEntitlements'>,
  feature: ModaGptFeatureKey,
  registryEnabled: boolean,
  minimumPlan?: string | null
) {
  const minimum = modaGptPlanCodes.find(code => code === minimumPlan?.toUpperCase());
  return registryEnabled
    && plan.featureEntitlements[feature] === true
    && (!minimumPlan || (minimum !== undefined && plansAtOrAboveMinimum[minimum].includes(plan.id)));
}

type BillingTransaction = Prisma.TransactionClient;

async function lockMerchant(tx: BillingTransaction, merchantId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Merchant" WHERE "id" = ${merchantId} FOR UPDATE
  `;
  if (!rows.length) throw new Error('MODAGPT_MERCHANT_NOT_FOUND');
}

async function getCreditBalance(tx: BillingTransaction, merchantId: string) {
  const aggregate = await tx.modaGptCreditLedgerEntry.aggregate({
    where: { merchantId },
    _sum: { amount: true }
  });
  return aggregate._sum.amount || 0;
}

export async function grantModaGptCredits(
  tx: BillingTransaction,
  input: {
    merchantId: string;
    amount: number;
    referenceType: string;
    referenceId: string;
    idempotencyKey: string;
    actorId?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
    throw new Error('MODAGPT_CREDIT_AMOUNT_INVALID');
  }
  if (!input.idempotencyKey || input.idempotencyKey.length > 180) {
    throw new Error('MODAGPT_BILLING_IDEMPOTENCY_KEY_INVALID');
  }
  await lockMerchant(tx, input.merchantId);
  const existing = await tx.modaGptCreditLedgerEntry.findUnique({
    where: { idempotencyKey: input.idempotencyKey }
  });
  if (existing) {
    if (existing.merchantId !== input.merchantId
      || existing.amount !== input.amount
      || existing.entryType !== 'GRANT'
      || existing.referenceType !== input.referenceType
      || existing.referenceId !== input.referenceId) {
      throw new Error('MODAGPT_CREDIT_IDEMPOTENCY_CONFLICT');
    }
    return { entry: existing, balance: await getCreditBalance(tx, input.merchantId) };
  }
  const entry = await tx.modaGptCreditLedgerEntry.create({
    data: {
      merchantId: input.merchantId,
      actorId: input.actorId || null,
      entryType: 'GRANT',
      amount: input.amount,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      idempotencyKey: input.idempotencyKey,
      metadata: JSON.stringify(input.metadata || {})
    }
  });
  return { entry, balance: await getCreditBalance(tx, input.merchantId) };
}

export async function reserveModaGptCredits(
  tx: BillingTransaction,
  input: {
    merchantId: string;
    feature: ModaGptFeatureKey;
    idempotencyKey: string;
    model?: string | null;
    units?: number;
    actorId?: string | null;
    expiresAt?: Date | null;
  }
) {
  if (!input.idempotencyKey || input.idempotencyKey.length > 180) {
    throw new Error('MODAGPT_BILLING_IDEMPOTENCY_KEY_INVALID');
  }
  if (input.model !== undefined && input.model !== null
    && (typeof input.model !== 'string' || input.model.length < 1 || input.model.length > 160)) {
    throw new Error('MODAGPT_BILLING_MODEL_INVALID');
  }
  await lockMerchant(tx, input.merchantId);
  const [feature, subscription] = await Promise.all([
    tx.modaGptBillingFeature.findUnique({ where: { featureKey: input.feature } }),
    tx.modaGptBillingSubscription.findFirst({
      where: {
        merchantId: input.merchantId,
        status: { in: ['TRIAL', 'ACTIVE', 'GRACE_PERIOD'] },
        OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: new Date() } }]
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' }
    })
  ]);
  if (!feature?.enabled || feature.creditCost === null) throw new Error('MODAGPT_FEATURE_NOT_ENTITLED');
  const selectedPlan = subscription
    ? serializePlanCatalogItem(subscription.plan)
    : null;
  if (!selectedPlan || !canUseModaGptBillingFeature(
    selectedPlan,
    input.feature,
    feature.enabled,
    feature.minimumPlan
  )) {
    throw new Error('MODAGPT_FEATURE_NOT_ENTITLED');
  }
  const metering = calculateModaGptCreditCost({
    featureCreditCost: feature.creditCost,
    config: feature.config,
    model: input.model,
    units: input.units
  });
  const credits = metering.credits;
  const existing = await tx.modaGptCreditReservation.findUnique({
    where: { merchantId_idempotencyKey: { merchantId: input.merchantId, idempotencyKey: input.idempotencyKey } }
  });
  if (existing) {
    if (existing.feature !== input.feature || existing.credits !== credits) {
      throw new Error('MODAGPT_CREDIT_IDEMPOTENCY_CONFLICT');
    }
    if (existing.status !== 'reserved') throw new Error('MODAGPT_CREDIT_RESERVATION_ALREADY_SETTLED');
    return {
      reservation: existing,
      balance: await getCreditBalance(tx, input.merchantId),
      idempotentReplay: true
    };
  }
  const balance = await getCreditBalance(tx, input.merchantId);
  if (balance < credits) throw new Error('MODAGPT_CREDITS_INSUFFICIENT');
  const reservation = await tx.modaGptCreditReservation.create({
    data: {
      merchantId: input.merchantId,
      feature: input.feature,
      credits,
      status: 'reserved',
      idempotencyKey: input.idempotencyKey,
      expiresAt: input.expiresAt || null
    }
  });
  await tx.modaGptCreditLedgerEntry.create({
    data: {
      merchantId: input.merchantId,
      actorId: input.actorId || null,
      entryType: 'RESERVE',
      amount: -credits,
      referenceType: 'credit_reservation',
      referenceId: reservation.id,
      idempotencyKey: `reserve:${reservation.id}`,
      reservationId: reservation.id,
      metadata: JSON.stringify({ feature: input.feature, model: input.model || null, units: input.units || 1, unit: metering.unit })
    }
  });
  return {
    reservation,
    balance: await getCreditBalance(tx, input.merchantId),
    idempotentReplay: false
  };
}

export async function settleModaGptCreditReservation(
  tx: BillingTransaction,
  input: { merchantId: string; reservationId: string; action: 'CONSUME' | 'RELEASE'; idempotencyKey: string }
) {
  await lockMerchant(tx, input.merchantId);
  const reservation = await tx.modaGptCreditReservation.findFirst({
    where: { id: input.reservationId, merchantId: input.merchantId }
  });
  if (!reservation) throw new Error('MODAGPT_CREDIT_RESERVATION_NOT_FOUND');
  const existing = await tx.modaGptCreditLedgerEntry.findUnique({
    where: { idempotencyKey: input.idempotencyKey }
  });
  if (existing) {
    if (existing.merchantId !== input.merchantId || existing.reservationId !== reservation.id) {
      throw new Error('MODAGPT_CREDIT_IDEMPOTENCY_CONFLICT');
    }
    if (existing.entryType !== input.action) throw new Error('MODAGPT_CREDIT_IDEMPOTENCY_CONFLICT');
    return { reservation, balance: await getCreditBalance(tx, input.merchantId) };
  }
  if (reservation.status !== 'reserved') throw new Error('MODAGPT_CREDIT_RESERVATION_ALREADY_SETTLED');
  const now = new Date();
  const status = input.action === 'CONSUME' ? 'consumed' : 'released';
  await tx.modaGptCreditReservation.update({
    where: { id: reservation.id },
    data: {
      status,
      ...(input.action === 'CONSUME' ? { consumedAt: now } : { releasedAt: now })
    }
  });
  await tx.modaGptCreditLedgerEntry.create({
    data: {
      merchantId: input.merchantId,
      entryType: input.action,
      amount: input.action === 'RELEASE' ? reservation.credits : 0,
      referenceType: 'credit_reservation',
      referenceId: reservation.id,
      idempotencyKey: input.idempotencyKey,
      reservationId: reservation.id,
      metadata: '{}'
    }
  });
  const updated = await tx.modaGptCreditReservation.findUniqueOrThrow({ where: { id: reservation.id } });
  return { reservation: updated, balance: await getCreditBalance(tx, input.merchantId) };
}

export async function recordModaGptAiUsage(
  prisma: PrismaClient | BillingTransaction,
  input: {
    merchantId: string;
    planId: ModaGptPlanCode;
    feature: ModaGptFeatureKey;
    idempotencyKey: string;
    subscriptionId?: string | null;
    agentId?: string | null;
    taskId?: string | null;
    provider?: string | null;
    model?: string | null;
    credits?: number;
    tokens?: number | null;
    imageUnits?: number;
    videoSeconds?: number;
    voiceSeconds?: number;
    latencyMs?: number | null;
    actualCostMinor?: number | null;
    status?: string;
  }
) {
  const result = await prisma.modaGptAiUsageRecord.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    create: {
      ...input,
      credits: input.credits ?? 0,
      tokens: input.tokens ?? null,
      imageUnits: input.imageUnits ?? 0,
      videoSeconds: input.videoSeconds ?? 0,
      voiceSeconds: input.voiceSeconds ?? 0,
      latencyMs: input.latencyMs ?? null,
      actualCostMinor: input.actualCostMinor ?? null,
      status: input.status || 'succeeded'
    },
    update: {}
  });
  if (result.merchantId !== input.merchantId || result.planId !== input.planId || result.feature !== input.feature) {
    throw new Error('MODAGPT_USAGE_IDEMPOTENCY_CONFLICT');
  }
  return result;
}

export function hashBillingPayload(payload: string) {
  return createHash('sha256').update(payload).digest('hex');
}

export function makeBillingIdempotencyKey(prefix: string) {
  if (!/^[a-z][a-z0-9:_-]{0,140}$/i.test(prefix)) throw new Error('MODAGPT_BILLING_IDEMPOTENCY_KEY_INVALID');
  return `${prefix}:${randomUUID()}`;
}

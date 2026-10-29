import { createHash, randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { grantModaGptCredits, transitionModaGptSubscriptionStatus, type ModaGptSubscriptionStatus } from './modagptBilling';

type StripeTaxLine = {
  amount?: unknown;
  tax_rate_details?: { percentage_decimal?: unknown; percentage?: unknown };
  tax_rate?: { percentage_decimal?: unknown; percentage?: unknown };
};

type StripeBillingObject = {
  [key: string]: unknown;
  id?: unknown;
  subscription?: unknown;
  payment_intent?: unknown;
  customer?: unknown;
  metadata?: Record<string, unknown>;
  parent?: { subscription_details?: { subscription?: unknown; metadata?: Record<string, unknown> } };
  subscription_details?: { subscription?: unknown; metadata?: Record<string, unknown> };
  currency?: unknown;
  subtotal?: unknown;
  total?: unknown;
  amount_paid?: unknown;
  total_discount_amounts?: StripeTaxLine[];
  total_taxes?: StripeTaxLine[];
  total_tax_amounts?: StripeTaxLine[];
  automatic_tax?: { enabled?: unknown; status?: unknown };
  lines?: { data?: Array<{ period?: { start?: unknown; end?: unknown } }> };
  customer_tax_ids?: Array<{ value?: unknown }>;
  customer_address?: { country?: unknown };
  customer_details?: { address?: { country?: unknown } };
  period_start?: unknown;
  period_end?: unknown;
  current_period_start?: unknown;
  current_period_end?: unknown;
  status?: unknown;
  cancel_at_period_end?: unknown;
};

type StripeBillingEvent = {
  id?: unknown;
  type?: unknown;
  livemode?: unknown;
  data?: { object?: StripeBillingObject };
};

const stripeId = (value: unknown): string | null => {
  if (typeof value === 'string' && value.length <= 180) return value;
  if (value && typeof value === 'object' && !Array.isArray(value) && 'id' in value
    && typeof (value as Record<string, unknown>).id === 'string') {
    return (value as Record<string, string>).id;
  }
  return null;
};

function isSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function billingMetadata(invoice: StripeBillingObject) {
  return invoice.parent?.subscription_details?.metadata
    || invoice.subscription_details?.metadata
    || invoice.metadata
    || {};
}

function billingPeriod(invoice: StripeBillingObject) {
  const line = invoice.lines?.data?.find(candidate =>
    isSafeInteger(candidate?.period?.start) && isSafeInteger(candidate?.period?.end)
  );
  const start = line?.period?.start ?? invoice.period_start;
  const end = line?.period?.end ?? invoice.period_end;
  if (!isSafeInteger(start) || !isSafeInteger(end) || end <= start) {
    throw new Error('MODAGPT_BILLING_INVOICE_PERIOD_INVALID');
  }
  return { start: new Date(start * 1000), end: new Date(end * 1000) };
}

function taxSnapshot(invoice: StripeBillingObject) {
  const taxItems = Array.isArray(invoice.total_taxes)
    ? invoice.total_taxes
    : Array.isArray(invoice.total_tax_amounts)
      ? invoice.total_tax_amounts
      : [];
  const taxMinor = taxItems.length
    ? taxItems.reduce((sum, item) => sum + Number(item.amount || 0), 0)
    : Number(invoice.total || 0) - Number(invoice.subtotal || 0) + Number(invoice.total_discount_amounts?.reduce(
      (sum, item) => sum + Number(item.amount || 0), 0
    ) || 0);
  const rates = taxItems.map(item => {
    const details = item.tax_rate_details || item.tax_rate || {};
    const percent = Number(details.percentage_decimal ?? details.percentage);
    return Number.isFinite(percent) && percent >= 0 ? Math.round(percent * 100) : null;
  });
  const taxRateBasisPoints = rates.length && rates.every((rate: number | null) => rate !== null && rate === rates[0])
    ? rates[0]
    : null;
  const taxIds = Array.isArray(invoice.customer_tax_ids) ? invoice.customer_tax_ids : [];
  const address = invoice.customer_address || invoice.customer_details?.address || {};
  const discountMinor = Array.isArray(invoice.total_discount_amounts)
    ? invoice.total_discount_amounts.reduce((sum, item) => sum + Number(item.amount || 0), 0)
    : 0;
  if (!Number.isSafeInteger(taxMinor) || taxMinor < 0 || !Number.isSafeInteger(discountMinor) || discountMinor < 0) {
    throw new Error('MODAGPT_BILLING_TAX_SNAPSHOT_INVALID');
  }
  return {
    taxMinor,
    taxRateBasisPoints,
    discountMinor,
    billingCountry: typeof address.country === 'string' && /^[A-Z]{2}$/.test(address.country)
      ? address.country
      : null,
    taxIdSnapshot: typeof taxIds[0]?.value === 'string' ? taxIds[0].value.slice(0, 80) : null
  };
}

function parsePlanSnapshot(value: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('MODAGPT_BILLING_PLAN_SNAPSHOT_INVALID');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('MODAGPT_BILLING_PLAN_SNAPSHOT_INVALID');
  }
  const snapshot = parsed as Record<string, unknown>;
  if (typeof snapshot.id !== 'string'
    || !Number.isSafeInteger(snapshot.monthlyPriceMinor)
    || !Number.isSafeInteger(snapshot.monthlyCredits)
    || Number(snapshot.monthlyCredits) < 1) {
    throw new Error('MODAGPT_BILLING_PLAN_SNAPSHOT_INVALID');
  }
  return {
    id: snapshot.id,
    monthlyPriceMinor: Number(snapshot.monthlyPriceMinor),
    monthlyCredits: Number(snapshot.monthlyCredits)
  };
}

function invoiceTaxStatusIsSettled(invoice: StripeBillingObject) {
  return invoice.automatic_tax?.enabled === true
    && ['complete', 'not_collecting'].includes(String(invoice.automatic_tax?.status));
}

function stripeSubscriptionStatus(value: unknown): ModaGptSubscriptionStatus {
  const statuses: Record<string, ModaGptSubscriptionStatus> = {
    trialing: 'TRIAL',
    active: 'ACTIVE',
    past_due: 'PAST_DUE',
    unpaid: 'PAST_DUE',
    paused: 'PAUSED',
    canceled: 'CANCELLED'
  };
  if (typeof value !== 'string' || !statuses[value]) {
    throw new Error('MODAGPT_BILLING_SUBSCRIPTION_STATUS_UNSUPPORTED');
  }
  return statuses[value];
}

async function saveFailedEvent(
  prisma: PrismaClient,
  eventId: string,
  eventType: string,
  payloadHash: string,
  errorCode: string
) {
  const existing = await prisma.modaGptBillingWebhookEvent.findUnique({
    where: { provider_providerEventId: { provider: 'stripe', providerEventId: eventId } },
    select: { id: true, status: true }
  });
  if (existing?.status === 'processed') return;
  if (existing) {
    await prisma.modaGptBillingWebhookEvent.updateMany({
      where: { id: existing.id, status: { not: 'processed' } },
      data: {
        status: 'failed',
        attempts: { increment: 1 },
        lastErrorCode: errorCode
      }
    });
  } else {
    await prisma.modaGptBillingWebhookEvent.createMany({
      data: [{
        id: randomUUID(),
        provider: 'stripe',
        providerEventId: eventId,
        eventType,
        payloadHash,
        status: 'failed',
        attempts: 1,
        lastErrorCode: errorCode
      }],
      skipDuplicates: true
    });
  }
}

async function processInvoicePaid(tx: Prisma.TransactionClient, invoice: StripeBillingObject) {
  const providerInvoiceId = stripeId(invoice.id);
  const providerSubscriptionId = stripeId(invoice.subscription || invoice.parent?.subscription_details?.subscription);
  const metadata = billingMetadata(invoice);
  const billingPaymentId = typeof metadata.billingId === 'string' ? metadata.billingId : null;
  const merchantMetadataId = typeof metadata.merchantId === 'string' ? metadata.merchantId : null;
  const planMetadataId = typeof metadata.planId === 'string' ? metadata.planId : null;
  const currency = String(invoice.currency || '').toUpperCase();
  const subtotalMinor = Number(invoice.subtotal);
  const totalMinor = Number(invoice.total);
  const amountPaidMinor = Number(invoice.amount_paid);
  if (!providerInvoiceId || !providerSubscriptionId || currency !== 'EUR'
    || !Number.isSafeInteger(subtotalMinor) || !Number.isSafeInteger(totalMinor)
    || !Number.isSafeInteger(amountPaidMinor) || amountPaidMinor !== totalMinor
    || !invoiceTaxStatusIsSettled(invoice)) {
    throw new Error('MODAGPT_BILLING_PROVIDER_INVOICE_INVALID');
  }
  const period = billingPeriod(invoice);
  const tax = taxSnapshot(invoice);
  const providerPaymentId = stripeId(invoice.payment_intent);

  let subscription = await tx.modaGptBillingSubscription.findUnique({
    where: { providerSubscriptionId },
    include: { plan: true }
  });
  let payment = !subscription && billingPaymentId
    ? await tx.modaGptBillingPayment.findUnique({ where: { id: billingPaymentId }, include: { invoice: true } })
    : null;
  if (!subscription && (!payment || payment.provider !== 'stripe'
    || payment.merchantId !== merchantMetadataId
    || !['draft', 'failed', 'open'].includes(payment.invoice.status)
    || payment.invoice.subtotalMinor !== subtotalMinor
    || payment.invoice.currency !== currency
    || payment.invoice.planSnapshot === ''
    || !planMetadataId)) {
    throw new Error('MODAGPT_BILLING_CHECKOUT_REFERENCE_INVALID');
  }

  if (subscription) {
    const snapshot = parsePlanSnapshot(subscription.planSnapshot);
    if (snapshot.id !== subscription.planId || snapshot.monthlyPriceMinor !== subtotalMinor) {
      throw new Error('MODAGPT_BILLING_SUBSCRIPTION_PRICE_MISMATCH');
    }
  } else {
    const snapshot = parsePlanSnapshot(payment!.invoice.planSnapshot);
    if (snapshot.id !== planMetadataId || snapshot.monthlyPriceMinor !== subtotalMinor) {
      throw new Error('MODAGPT_BILLING_CHECKOUT_PLAN_MISMATCH');
    }
  }

  const existingProviderInvoice = await tx.modaGptBillingInvoice.findUnique({
    where: { providerInvoiceId }
  });
  if (existingProviderInvoice?.status === 'paid') return { action: 'invoice_already_paid' };

  const merchantId = subscription?.merchantId || payment!.merchantId;
  await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Merchant" WHERE "id" = ${merchantId} FOR UPDATE`;

  if (!subscription) {
    const activeSubscription = await tx.modaGptBillingSubscription.findFirst({
      where: { merchantId, status: { notIn: ['CANCELLED', 'EXPIRED'] } },
      select: { id: true }
    });
    if (activeSubscription) throw new Error('MODAGPT_SUBSCRIPTION_ALREADY_ACTIVE');
    const plan = await tx.modaGptBillingPlan.findUnique({ where: { id: planMetadataId! } });
    if (!plan) throw new Error('MODAGPT_BILLING_PLAN_UNAVAILABLE');
    subscription = await tx.modaGptBillingSubscription.create({
      data: {
        merchantId,
        planId: plan.id,
        status: 'ACTIVE',
        provider: 'stripe',
        providerCustomerId: stripeId(invoice.customer),
        providerSubscriptionId,
        idempotencyKey: `stripe-subscription:${providerSubscriptionId}`,
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        planSnapshot: payment!.invoice.planSnapshot
      },
      include: { plan: true }
    });
  } else {
    const nextStatus = transitionModaGptSubscriptionStatus(
      subscription.status as ModaGptSubscriptionStatus,
      'PAYMENT_SUCCEEDED'
    );
    subscription = await tx.modaGptBillingSubscription.update({
      where: { id: subscription.id },
      data: {
        status: nextStatus,
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        providerCustomerId: stripeId(invoice.customer) || subscription.providerCustomerId
      },
      include: { plan: true }
    });
  }

  let localInvoice = existingProviderInvoice;
  if (!localInvoice && payment) localInvoice = payment.invoice;
  if (localInvoice) {
    if (localInvoice.merchantId !== merchantId || localInvoice.subtotalMinor !== subtotalMinor) {
      throw new Error('MODAGPT_BILLING_INVOICE_MISMATCH');
    }
    localInvoice = await tx.modaGptBillingInvoice.update({
      where: { id: localInvoice.id },
      data: {
        subscriptionId: subscription.id,
        providerInvoiceId,
        status: 'paid',
        subtotalMinor,
        taxMinor: tax.taxMinor,
        taxRateBasisPoints: tax.taxRateBasisPoints,
        discountMinor: tax.discountMinor,
        totalMinor,
        billingCountry: tax.billingCountry,
        taxIdSnapshot: tax.taxIdSnapshot,
        periodStart: period.start,
        periodEnd: period.end,
        issuedAt: localInvoice.issuedAt || new Date(),
        paidAt: new Date()
      }
    });
  } else {
    localInvoice = await tx.modaGptBillingInvoice.create({
      data: {
        merchantId,
        subscriptionId: subscription.id,
        providerInvoiceId,
        invoiceNumber: `AI-${Date.now()}-${randomUUID().slice(0, 8)}`,
        status: 'paid',
        currency,
        subtotalMinor,
        taxMinor: tax.taxMinor,
        taxRateBasisPoints: tax.taxRateBasisPoints,
        discountMinor: tax.discountMinor,
        totalMinor,
        billingCountry: tax.billingCountry,
        taxIdSnapshot: tax.taxIdSnapshot,
        periodStart: period.start,
        periodEnd: period.end,
        planSnapshot: subscription.planSnapshot,
        lineItemsSnapshot: JSON.stringify(invoice.lines?.data || []),
        issuedAt: new Date(),
        paidAt: new Date()
      }
    });
  }

  if (payment) {
    payment = await tx.modaGptBillingPayment.update({
      where: { id: payment.id },
      data: {
        invoiceId: localInvoice.id,
        providerPaymentId,
        amountMinor: amountPaidMinor,
        currency,
        status: 'paid'
      },
      include: { invoice: true }
    });
  } else {
    const idempotencyKey = `stripe-invoice:${providerInvoiceId}`;
    payment = await tx.modaGptBillingPayment.findUnique({ where: { idempotencyKey }, include: { invoice: true } });
    if (payment) {
      await tx.modaGptBillingPayment.update({
        where: { id: payment.id },
        data: { providerPaymentId, amountMinor: amountPaidMinor, currency, status: 'paid', invoiceId: localInvoice.id }
      });
    } else {
      await tx.modaGptBillingPayment.create({
        data: {
          merchantId,
          invoiceId: localInvoice.id,
          provider: 'stripe',
          providerPaymentId,
          amountMinor: amountPaidMinor,
          currency,
          status: 'paid',
          idempotencyKey
        }
      });
    }
  }

  const snapshot = parsePlanSnapshot(subscription.planSnapshot);
  await grantModaGptCredits(tx, {
    merchantId,
    amount: snapshot.monthlyCredits,
    referenceType: 'subscription_period',
    referenceId: `${subscription.id}:${period.start.toISOString()}`,
    idempotencyKey: `subscription:${subscription.id}:period:${period.start.getTime()}`,
    metadata: { planId: subscription.planId, providerInvoiceId }
  });
  return { action: 'invoice_paid' };
}

async function processInvoiceFailed(tx: Prisma.TransactionClient, invoice: StripeBillingObject) {
  const providerInvoiceId = stripeId(invoice.id);
  const providerSubscriptionId = stripeId(invoice.subscription || invoice.parent?.subscription_details?.subscription);
  const metadata = billingMetadata(invoice);
  const billingPaymentId = typeof metadata.billingId === 'string' ? metadata.billingId : null;
  const period = billingPeriod(invoice);
  const subscription = providerSubscriptionId
    ? await tx.modaGptBillingSubscription.findUnique({ where: { providerSubscriptionId } })
    : null;
  if (subscription) {
    const status = transitionModaGptSubscriptionStatus(
      subscription.status as ModaGptSubscriptionStatus,
      'PAYMENT_FAILED'
    );
    await tx.modaGptBillingSubscription.update({ where: { id: subscription.id }, data: { status } });
  }
  const payment = !subscription && billingPaymentId
    ? await tx.modaGptBillingPayment.findUnique({ where: { id: billingPaymentId }, include: { invoice: true } })
    : null;
  if (payment) {
    await tx.modaGptBillingPayment.update({ where: { id: payment.id }, data: { status: 'failed' } });
    await tx.modaGptBillingInvoice.update({ where: { id: payment.invoiceId }, data: { status: 'failed' } });
    return { action: 'initial_payment_failed' };
  }
  if (!subscription || !providerInvoiceId) return { action: 'unlinked_payment_failed' };
  const existing = await tx.modaGptBillingInvoice.findUnique({ where: { providerInvoiceId } });
  if (existing) {
    await tx.modaGptBillingInvoice.update({ where: { id: existing.id }, data: { status: 'failed', periodStart: period.start, periodEnd: period.end } });
  } else {
    const snapshot = parsePlanSnapshot(subscription.planSnapshot);
    const createdInvoice = await tx.modaGptBillingInvoice.create({
      data: {
        merchantId: subscription.merchantId,
        subscriptionId: subscription.id,
        providerInvoiceId,
        invoiceNumber: `AI-${Date.now()}-${randomUUID().slice(0, 8)}`,
        status: 'failed',
        currency: 'EUR',
        subtotalMinor: Number(invoice.subtotal || snapshot.monthlyPriceMinor),
        totalMinor: Number(invoice.total || invoice.subtotal || snapshot.monthlyPriceMinor),
        periodStart: period.start,
        periodEnd: period.end,
        planSnapshot: subscription.planSnapshot,
        lineItemsSnapshot: JSON.stringify(invoice.lines?.data || [])
      }
    });
    const idempotencyKey = `stripe-invoice:${providerInvoiceId}`;
    await tx.modaGptBillingPayment.upsert({
      where: { idempotencyKey },
      create: {
        merchantId: subscription.merchantId,
        invoiceId: createdInvoice.id,
        provider: 'stripe',
        providerPaymentId: stripeId(invoice.payment_intent),
        amountMinor: createdInvoice.totalMinor,
        currency: 'EUR',
        status: 'failed',
        idempotencyKey
      },
      update: { status: 'failed', amountMinor: createdInvoice.totalMinor }
    });
  }
  return { action: 'renewal_payment_failed' };
}

export async function handleStripeModaGptBillingWebhook(
  prisma: PrismaClient,
  event: StripeBillingEvent,
  payload: Buffer,
  expectedLiveMode: boolean
) {
  const eventId = typeof event.id === 'string' ? event.id : '';
  const eventType = typeof event.type === 'string' ? event.type : '';
  const invoice = event.data?.object || {};
  if (!eventId || eventId.length > 180 || !eventType || eventType.length > 80) {
    throw new Error('MODAGPT_BILLING_WEBHOOK_EVENT_INVALID');
  }
  if (event.livemode !== expectedLiveMode) throw new Error('MODAGPT_BILLING_WEBHOOK_MODE_MISMATCH');
  const payloadHash = createHash('sha256').update(payload).digest('hex');
  try {
    return await prisma.$transaction(async tx => {
      const previous = await tx.modaGptBillingWebhookEvent.findUnique({
        where: { provider_providerEventId: { provider: 'stripe', providerEventId: eventId } }
      });
      if (previous && (previous.payloadHash !== payloadHash || previous.eventType !== eventType)) {
        throw new Error('MODAGPT_BILLING_WEBHOOK_EVENT_CONFLICT');
      }
      if (previous?.status === 'processed') return { duplicate: true, action: 'duplicate' };
      const savedEvent = previous
        ? await tx.modaGptBillingWebhookEvent.update({
          where: { id: previous.id },
          data: { status: 'received', attempts: { increment: 1 }, lastErrorCode: null, payloadHash, eventType }
        })
        : await tx.modaGptBillingWebhookEvent.create({
          data: { id: randomUUID(), provider: 'stripe', providerEventId: eventId, eventType, payloadHash }
        });
      let result = { action: 'ignored' };
      if (eventType === 'invoice.paid') result = await processInvoicePaid(tx, invoice);
      else if (eventType === 'invoice.payment_failed') result = await processInvoiceFailed(tx, invoice);
      else if (eventType === 'customer.subscription.deleted') {
        const providerSubscriptionId = stripeId(invoice.id);
        const subscription = providerSubscriptionId
          ? await tx.modaGptBillingSubscription.findUnique({ where: { providerSubscriptionId } })
          : null;
        if (subscription && subscription.status !== 'CANCELLED' && subscription.status !== 'EXPIRED') {
          const status = transitionModaGptSubscriptionStatus(
            subscription.status as ModaGptSubscriptionStatus,
            'CANCELLED'
          );
          await tx.modaGptBillingSubscription.update({
            where: { id: subscription.id },
            data: { status, cancelAtPeriodEnd: false, endedAt: new Date() }
          });
        }
        result = { action: 'subscription_cancelled' };
      } else if (eventType === 'customer.subscription.updated') {
        const providerSubscriptionId = stripeId(invoice.id);
        const subscription = providerSubscriptionId
          ? await tx.modaGptBillingSubscription.findUnique({ where: { providerSubscriptionId } })
          : null;
        if (subscription) {
          const nextStatus = stripeSubscriptionStatus(invoice.status);
          const hasStart = invoice.current_period_start !== undefined;
          const hasEnd = invoice.current_period_end !== undefined;
          let currentPeriodStart: Date | undefined;
          let currentPeriodEnd: Date | undefined;
          if (hasStart || hasEnd) {
            if (!isSafeInteger(invoice.current_period_start)
              || !isSafeInteger(invoice.current_period_end)
              || Number(invoice.current_period_end) <= Number(invoice.current_period_start)) {
              throw new Error('MODAGPT_BILLING_SUBSCRIPTION_PERIOD_INVALID');
            }
            currentPeriodStart = new Date(Number(invoice.current_period_start) * 1000);
            currentPeriodEnd = new Date(Number(invoice.current_period_end) * 1000);
          }
          await tx.modaGptBillingSubscription.update({
            where: { id: subscription.id },
            data: {
              status: nextStatus,
              ...(typeof invoice.cancel_at_period_end === 'boolean'
                ? { cancelAtPeriodEnd: invoice.cancel_at_period_end }
                : {}),
              ...(currentPeriodStart ? { currentPeriodStart, currentPeriodEnd } : {}),
              providerCustomerId: stripeId(invoice.customer) || subscription.providerCustomerId,
              ...(nextStatus === 'CANCELLED' ? { endedAt: new Date() } : {})
            }
          });
        }
        result = { action: subscription ? 'subscription_updated' : 'subscription_not_linked' };
      }
      await tx.modaGptBillingWebhookEvent.update({
        where: { id: savedEvent.id },
        data: { status: 'processed', processedAt: new Date(), lastErrorCode: null }
      });
      return { duplicate: false, ...result };
    });
  } catch (error) {
    const committedEvent = await prisma.modaGptBillingWebhookEvent.findUnique({
      where: { provider_providerEventId: { provider: 'stripe', providerEventId: eventId } }
    }).catch(() => null);
    if (committedEvent?.status === 'processed'
      && committedEvent.payloadHash === payloadHash
      && committedEvent.eventType === eventType) {
      return { duplicate: true, action: 'duplicate' };
    }
    const errorCode = error instanceof Error ? error.message.slice(0, 80) : 'MODAGPT_BILLING_WEBHOOK_PROCESSING_FAILED';
    try {
      await saveFailedEvent(prisma, eventId, eventType, payloadHash, errorCode);
    } catch (persistError) {
      console.error('[modagpt-billing-webhook-failure-persist]', persistError instanceof Error ? persistError.message : 'unknown error');
    }
    throw error;
  }
}

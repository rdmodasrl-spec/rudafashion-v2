import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { handleStripeModaGptBillingWebhook } from '../src/server/stripeModaGptBillingWebhook';

function createBillingStore() {
  const planSnapshot = JSON.stringify({
    id: 'BUSINESS',
    displayName: 'Business',
    monthlyPriceMinor: 9900,
    monthlyCredits: 1000,
    currency: 'EUR',
    interval: 'month',
    version: 1
  });
  const invoice: Record<string, any> = {
    id: 'invoice-local-1',
    merchantId: 'merchant-1',
    subscriptionId: null,
    providerInvoiceId: null,
    invoiceNumber: 'AI-test-initial',
    status: 'draft',
    currency: 'EUR',
    subtotalMinor: 9900,
    taxMinor: 0,
    discountMinor: 0,
    totalMinor: 9900,
    planSnapshot,
    lineItemsSnapshot: '[]',
    issuedAt: null,
    paidAt: null
  };
  const payment: Record<string, any> = {
    id: 'payment-local-1',
    merchantId: 'merchant-1',
    invoiceId: invoice.id,
    provider: 'stripe',
    providerPaymentId: null,
    amountMinor: 9900,
    currency: 'EUR',
    status: 'pending',
    idempotencyKey: 'checkout:merchant-1:test-key',
    invoice
  };
  const subscriptions = new Map<string, Record<string, any>>();
  const invoicesByProviderId = new Map<string, Record<string, any>>();
  const events = new Map<string, Record<string, any>>();
  const ledger: Array<Record<string, any>> = [];
  const tx: Record<string, any> = {
    $queryRaw: async () => [{ id: 'merchant-1' }],
    modaGptBillingSubscription: {
      findUnique: async ({ where }: any) => subscriptions.get(where.providerSubscriptionId) || null,
      findFirst: async () => null,
      create: async ({ data }: any) => {
        const row = { id: 'subscription-local-1', ...data, plan: { id: 'BUSINESS' } };
        subscriptions.set(data.providerSubscriptionId, row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = [...subscriptions.values()].find(candidate => candidate.id === where.id)!;
        Object.assign(row, data);
        return row;
      }
    },
    modaGptBillingPlan: {
      findUnique: async () => ({ id: 'BUSINESS', status: 'active' })
    },
    modaGptBillingInvoice: {
      findUnique: async ({ where }: any) => invoicesByProviderId.get(where.providerInvoiceId) || null,
      update: async ({ where, data }: any) => {
        const row = where.id === invoice.id
          ? invoice
          : invoicesByProviderId.get(where.providerInvoiceId);
        assert.ok(row);
        Object.assign(row, data);
        if (row.providerInvoiceId) invoicesByProviderId.set(row.providerInvoiceId, row);
        return row;
      },
      create: async ({ data }: any) => {
        const row = { id: 'invoice-renewal', ...data };
        invoicesByProviderId.set(data.providerInvoiceId, row);
        return row;
      }
    },
    modaGptBillingPayment: {
      findUnique: async ({ where }: any) => where.id === payment.id ? payment : null,
      update: async ({ where, data }: any) => {
        assert.equal(where.id, payment.id);
        Object.assign(payment, data);
        return payment;
      },
      create: async () => {
        throw new Error('Unexpected renewal payment creation');
      },
      upsert: async () => {
        throw new Error('Unexpected renewal payment upsert');
      }
    },
    modaGptCreditLedgerEntry: {
      aggregate: async () => ({ _sum: { amount: ledger.reduce((sum, entry) => sum + entry.amount, 0) } }),
      findUnique: async ({ where }: any) => ledger.find(entry => entry.idempotencyKey === where.idempotencyKey) || null,
      create: async ({ data }: any) => {
        const entry = { id: `credit-${ledger.length + 1}`, ...data };
        ledger.push(entry);
        return entry;
      }
    },
    modaGptBillingWebhookEvent: {
      findUnique: async ({ where }: any) => events.get(where.provider_providerEventId.providerEventId) || null,
      create: async ({ data }: any) => {
        const row = { ...data, status: 'received', attempts: 0 };
        events.set(data.providerEventId, row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = [...events.values()].find(candidate => candidate.id === where.id)!;
        Object.assign(row, data);
        return row;
      },
      upsert: async ({ where, create, update }: any) => {
        const current = events.get(where.provider_providerEventId.providerEventId);
        if (current) {
          Object.assign(current, update, { attempts: current.attempts + 1 });
          return current;
        }
        events.set(create.providerEventId, create);
        return create;
      }
    }
  };
  const prisma = {
    ...tx,
    $transaction: async (operation: (transaction: unknown) => unknown) => operation(tx)
  } as unknown as PrismaClient;
  return { prisma, invoice, payment, ledger, events };
}

test('verified paid subscription invoice activates the plan and monthly credits only once', async () => {
  const { prisma, invoice, payment, ledger, events } = createBillingStore();
  const stripeInvoice = {
    id: 'in_provider_1',
    subscription: 'sub_provider_1',
    customer: 'cus_1',
    payment_intent: 'pi_1',
    currency: 'eur',
    subtotal: 9900,
    total: 9900,
    amount_paid: 9900,
    total_discount_amounts: [],
    total_taxes: [],
    automatic_tax: { enabled: true, status: 'not_collecting' },
    lines: { data: [{ period: { start: 1_800_000_000, end: 1_802_592_000 } }] },
    parent: {
      subscription_details: {
        subscription: 'sub_provider_1',
        metadata: {
          billingId: payment.id,
          merchantId: payment.merchantId,
          planId: 'BUSINESS'
        }
      }
    }
  };
  const failedEvent = {
    id: 'evt_invoice_failed_1',
    type: 'invoice.payment_failed',
    livemode: false,
    data: { object: stripeInvoice }
  };
  await handleStripeModaGptBillingWebhook(prisma, failedEvent, Buffer.from(JSON.stringify(failedEvent)), false);
  assert.equal(payment.status, 'failed');
  assert.equal(invoice.status, 'failed');

  const event = {
    id: 'evt_invoice_paid_1',
    type: 'invoice.paid',
    livemode: false,
    data: { object: stripeInvoice }
  };
  const raw = Buffer.from(JSON.stringify(event));

  const result = await handleStripeModaGptBillingWebhook(prisma, event, raw, false);
  assert.deepEqual(result, { duplicate: false, action: 'invoice_paid' });
  assert.equal(payment.status, 'paid');
  assert.equal(invoice.status, 'paid');
  assert.equal(invoice.providerInvoiceId, 'in_provider_1');
  assert.equal(ledger.filter(entry => entry.entryType === 'GRANT').length, 1);
  assert.equal(ledger[0].amount, 1000);
  assert.equal([...events.values()][0].status, 'processed');

  const duplicate = await handleStripeModaGptBillingWebhook(prisma, event, raw, false);
  assert.deepEqual(duplicate, { duplicate: true, action: 'duplicate' });
  assert.equal(ledger.filter(entry => entry.entryType === 'GRANT').length, 1);

  await assert.rejects(
    handleStripeModaGptBillingWebhook(
      prisma,
      { ...event, data: { object: { ...stripeInvoice, total: 9901 } } },
      Buffer.from(JSON.stringify({ ...event, data: { object: { ...stripeInvoice, total: 9901 } } })),
      false
    ),
    /MODAGPT_BILLING_WEBHOOK_EVENT_CONFLICT/
  );
  assert.equal(ledger.filter(entry => entry.entryType === 'GRANT').length, 1);
});

test('Stripe Billing webhook rejects events from the wrong Stripe mode', async () => {
  const { prisma } = createBillingStore();
  const event = {
    id: 'evt_live_1',
    type: 'invoice.paid',
    livemode: true,
    data: { object: {} }
  };
  await assert.rejects(
    handleStripeModaGptBillingWebhook(prisma, event, Buffer.from(JSON.stringify(event)), false),
    /MODAGPT_BILLING_WEBHOOK_MODE_MISMATCH/
  );
});

test('Stripe Billing webhook applies live-mode paid invoices and grants monthly credits', async () => {
  const { prisma, invoice, payment, ledger, events } = createBillingStore();
  const event = {
    id: 'evt_live_accepted_1',
    type: 'invoice.paid',
    livemode: true,
    data: {
      object: {
        id: 'in_live_provider_1',
        subscription: 'sub_live_provider_1',
        customer: 'cus_live_1',
        payment_intent: 'pi_live_1',
        currency: 'eur',
        subtotal: 9900,
        total: 9900,
        amount_paid: 9900,
        total_discount_amounts: [],
        total_taxes: [],
        automatic_tax: { enabled: true, status: 'not_collecting' },
        lines: { data: [{ period: { start: 1_800_000_000, end: 1_802_592_000 } }] },
        parent: {
          subscription_details: {
            subscription: 'sub_live_provider_1',
            metadata: {
              billingId: payment.id,
              merchantId: payment.merchantId,
              planId: 'BUSINESS'
            }
          }
        }
      }
    }
  };
  const result = await handleStripeModaGptBillingWebhook(
    prisma,
    event,
    Buffer.from(JSON.stringify(event)),
    true
  );
  assert.deepEqual(result, { duplicate: false, action: 'invoice_paid' });
  assert.equal(payment.status, 'paid');
  assert.equal(invoice.status, 'paid');
  assert.equal(ledger.filter(entry => entry.entryType === 'GRANT').length, 1);
  assert.equal([...events.values()][0].status, 'processed');
});

test('subscription update webhook synchronizes Stripe status, period and cancellation state', async () => {
  const { prisma, invoice, payment } = createBillingStore();
  const paidEvent = {
    id: 'evt_invoice_paid_2',
    type: 'invoice.paid',
    livemode: false,
    data: {
      object: {
        id: 'in_provider_2',
        subscription: 'sub_provider_2',
        customer: 'cus_2',
        payment_intent: 'pi_2',
        currency: 'eur',
        subtotal: 9900,
        total: 9900,
        amount_paid: 9900,
        total_discount_amounts: [],
        total_taxes: [],
        automatic_tax: { enabled: true, status: 'not_collecting' },
        lines: { data: [{ period: { start: 1_800_000_000, end: 1_802_592_000 } }] },
        parent: {
          subscription_details: {
            subscription: 'sub_provider_2',
            metadata: {
              billingId: payment.id,
              merchantId: payment.merchantId,
              planId: 'BUSINESS'
            }
          }
        }
      }
    }
  };
  await handleStripeModaGptBillingWebhook(prisma, paidEvent, Buffer.from(JSON.stringify(paidEvent)), false);

  const updateEvent = {
    id: 'evt_subscription_updated_1',
    type: 'customer.subscription.updated',
    livemode: false,
    data: {
      object: {
        id: 'sub_provider_2',
        customer: 'cus_updated',
        status: 'past_due',
        cancel_at_period_end: true,
        current_period_start: 1_802_592_000,
        current_period_end: 1_805_184_000
      }
    }
  };
  const result = await handleStripeModaGptBillingWebhook(
    prisma,
    updateEvent,
    Buffer.from(JSON.stringify(updateEvent)),
    false
  );
  assert.deepEqual(result, { duplicate: false, action: 'subscription_updated' });
  const subscription = await (prisma as any).modaGptBillingSubscription.findUnique({
    where: { providerSubscriptionId: 'sub_provider_2' }
  });
  assert.equal(subscription.status, 'PAST_DUE');
  assert.equal(subscription.cancelAtPeriodEnd, true);
  assert.equal(subscription.providerCustomerId, 'cus_updated');
  assert.equal(subscription.currentPeriodStart.toISOString(), new Date(1_802_592_000 * 1000).toISOString());
  assert.equal(subscription.currentPeriodEnd.toISOString(), new Date(1_805_184_000 * 1000).toISOString());
  assert.equal(invoice.status, 'paid');
});

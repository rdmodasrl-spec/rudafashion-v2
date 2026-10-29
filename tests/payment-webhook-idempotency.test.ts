import assert from 'node:assert/strict';
import test from 'node:test';
import { WebhookIdempotencyStore, isEmptyProviderPaymentId } from '../src/payment/webhookIdempotency';

test('isEmptyProviderPaymentId returns true for null/undefined/empty', () => {
  assert.equal(isEmptyProviderPaymentId(null), true);
  assert.equal(isEmptyProviderPaymentId(undefined), true);
  assert.equal(isEmptyProviderPaymentId(''), true);
  assert.equal(isEmptyProviderPaymentId('   '), true);
  assert.equal(isEmptyProviderPaymentId('pi_123'), false);
});

test('WebhookIdempotencyStore tracks and dedupes events', async () => {
  const recorded: Array<{ provider: string; providerEventId: string }> = [];
  const prisma = {
    paymentWebhookEvent: {
      findUnique: async (args: any) => {
        const where = args?.where;
        const found = recorded.find(e =>
          e.provider === where.provider_providerEventId.provider &&
          e.providerEventId === where.provider_providerEventId.providerEventId
        );
        return found || null;
      },
      createMany: async (data: any) => {
        let count = 0;
        for (const row of data.data) {
          const dup = recorded.find(e => e.provider === row.provider && e.providerEventId === row.providerEventId);
          if (!dup) {
            recorded.push({ provider: row.provider, providerEventId: row.providerEventId });
            count++;
          }
        }
        return { count };
      }
    }
  } as any;

  const store = new WebhookIdempotencyStore(prisma);

  assert.equal(await store.isAlreadyProcessed('stripe', 'evt_123'), false);

  const result1 = await store.recordEvent({
    id: 'id-1', provider: 'stripe', providerEventId: 'evt_123',
    eventType: 'payment.succeeded', payload: '{}'
  });
  assert.equal(result1, true);

  assert.equal(await store.isAlreadyProcessed('stripe', 'evt_123'), true);

  const result2 = await store.recordEvent({
    id: 'id-2', provider: 'stripe', providerEventId: 'evt_123',
    eventType: 'payment.succeeded', payload: '{}'
  });
  assert.equal(result2, false);

  assert.equal(await store.isAlreadyProcessed('stripe', 'evt_999'), false);
});

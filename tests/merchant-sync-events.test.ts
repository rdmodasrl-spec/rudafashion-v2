import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MerchantSyncEventHub,
  merchantSyncResourcesForMutation
} from '../src/server/merchantSyncEvents';

test('merchant sync events are delivered only to subscribers in the matching tenant', () => {
  const hub = new MerchantSyncEventHub();
  const merchantA: unknown[] = [];
  const merchantB: unknown[] = [];
  hub.subscribe('merchant-a', event => merchantA.push(event));
  hub.subscribe('merchant-b', event => merchantB.push(event));

  hub.publish('merchant-a', ['products', 'inventory'], new Date('2026-10-16T00:00:00.000Z'));

  assert.equal(merchantA.length, 1);
  assert.equal(merchantB.length, 0);
  assert.deepEqual(merchantA[0], {
    ...(merchantA[0] as { id: string }),
    occurredAt: '2026-10-16T00:00:00.000Z',
    resources: ['products', 'inventory']
  });
  assert.match((merchantA[0] as { id: string }).id, /^[0-9a-f-]{36}$/);
});

test('merchant sync hub enforces subscriber limits and removes closed subscriptions', () => {
  const hub = new MerchantSyncEventHub(1);
  const unsubscribe = hub.subscribe('merchant-a', () => {});

  assert.equal(typeof unsubscribe, 'function');
  assert.equal(hub.subscribe('merchant-a', () => {}), null);
  assert.equal(hub.subscriberCount('merchant-a'), 1);
  unsubscribe?.();
  assert.equal(hub.subscriberCount('merchant-a'), 0);
  const nextUnsubscribe = hub.subscribe('merchant-a', () => {});
  unsubscribe?.();
  assert.equal(hub.subscriberCount('merchant-a'), 1);
  assert.equal(typeof nextUnsubscribe, 'function');
});

test('merchant mutations map to bounded resource invalidation categories', () => {
  assert.deepEqual(merchantSyncResourcesForMutation('PUT', '/products/product-1'), ['products']);
  assert.deepEqual(merchantSyncResourcesForMutation('POST', '/orders/order-1/shipments'), ['orders']);
  assert.deepEqual(merchantSyncResourcesForMutation('PATCH', '/inventory/adjustments'), ['inventory']);
  assert.deepEqual(merchantSyncResourcesForMutation('POST', '/quotes'), ['orders']);
  assert.deepEqual(merchantSyncResourcesForMutation('PUT', '/payouts/payout-1/status'), ['finance']);
  assert.deepEqual(merchantSyncResourcesForMutation('PATCH', '/ai-employees/agent-1/status'), ['settings']);
  assert.deepEqual(merchantSyncResourcesForMutation('PUT', '/products/product-1/bom'), ['products', 'production']);
  assert.deepEqual(merchantSyncResourcesForMutation('PUT', '/settings'), ['settings']);
  assert.deepEqual(merchantSyncResourcesForMutation('PUT', '/pos/settings'), ['settings']);
  assert.deepEqual(merchantSyncResourcesForMutation('PUT', '/storefront'), ['content']);
  assert.deepEqual(merchantSyncResourcesForMutation('POST', '/pos/shifts/shift-1/cash-movements'), ['orders']);
  assert.deepEqual(merchantSyncResourcesForMutation('POST', '/pos/returns'), ['orders', 'customers']);
  assert.deepEqual(merchantSyncResourcesForMutation('POST', '/purchase-orders/order-1/receipts'), ['inventory', 'production']);
  assert.deepEqual(merchantSyncResourcesForMutation('POST', '/gallery'), ['content']);
  assert.deepEqual(merchantSyncResourcesForMutation('PATCH', '/modagpt/designs/design-1/favorite'), ['content']);
  assert.deepEqual(merchantSyncResourcesForMutation('PUT', '/workspace-drafts/content'), ['content']);
  assert.deepEqual(merchantSyncResourcesForMutation('PUT', '/workspace-drafts/growth'), ['growth']);
  assert.deepEqual(merchantSyncResourcesForMutation('POST', '/installations'), ['settings']);
  assert.deepEqual(merchantSyncResourcesForMutation('DELETE', '/installations/ruda-business-email'), ['settings']);
  assert.deepEqual(merchantSyncResourcesForMutation('POST', '/email/domains'), ['settings']);
  assert.deepEqual(merchantSyncResourcesForMutation('POST', '/email/domains/domain-1/verify'), ['settings']);
  assert.deepEqual(merchantSyncResourcesForMutation('POST', '/ai-order-drafts'), ['orders']);
  assert.deepEqual(merchantSyncResourcesForMutation('GET', '/products'), []);
  assert.deepEqual(merchantSyncResourcesForMutation('POST', '/assistant/query'), []);
});

test('a broken sync subscriber does not block other subscribers', () => {
  const hub = new MerchantSyncEventHub();
  let delivered = false;
  const originalError = console.error;
  console.error = () => {};
  try {
    hub.subscribe('merchant-a', () => { throw new Error('closed stream'); });
    hub.subscribe('merchant-a', () => { delivered = true; });
    hub.publish('merchant-a', ['orders']);
  } finally {
    console.error = originalError;
  }
  assert.equal(delivered, true);
  assert.equal(hub.subscriberCount('merchant-a'), 1);
});

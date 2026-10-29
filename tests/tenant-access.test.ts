import test from 'node:test';
import assert from 'node:assert/strict';
import {
  merchantOrderItemIds,
  merchantOwnsEntireOrder,
  merchantOwnsOrder,
  merchantOwnsOrderItem,
  merchantOwnsShipment
} from '../src/server/tenantAccess';

test('merchant ownership is limited to its own order items', () => {
  const order = {
    merchantId: null,
    items: [
      { id: 'item-a', merchantId: 'merchant-a' },
      { id: 'item-b', merchantId: 'merchant-b' }
    ]
  };

  assert.equal(merchantOwnsOrder(order, 'merchant-a'), true);
  assert.equal(merchantOwnsOrderItem(order, 'merchant-a', order.items[0]), true);
  assert.equal(merchantOwnsOrderItem(order, 'merchant-a', order.items[1]), false);
  assert.deepEqual([...merchantOrderItemIds(order, 'merchant-a')], ['item-a']);
});

test('merchant parent ownership includes legacy unassigned items only for that merchant', () => {
  const order = {
    merchantId: 'merchant-a',
    items: [
      { id: 'item-a', merchantId: null },
      { id: 'item-b', merchantId: 'merchant-b' }
    ]
  };

  assert.deepEqual([...merchantOrderItemIds(order, 'merchant-a')], ['item-a']);
  assert.equal(merchantOwnsOrder(order, 'merchant-b'), true);
  assert.equal(merchantOwnsOrderItem(order, 'merchant-b', order.items[0]), false);
});

test('whole-order operations are denied when an order contains another merchant items', () => {
  const sharedOrder = {
    merchantId: 'merchant-a',
    items: [
      { id: 'item-a', merchantId: 'merchant-a' },
      { id: 'item-b', merchantId: 'merchant-b' }
    ]
  };

  assert.equal(merchantOwnsOrder(sharedOrder, 'merchant-a'), true);
  assert.equal(merchantOwnsEntireOrder(sharedOrder, 'merchant-a'), false);
  assert.equal(merchantOwnsShipment(sharedOrder, 'merchant-a', [{ orderItemId: 'item-b' }]), false);
  assert.equal(merchantOwnsShipment(sharedOrder, 'merchant-a', []), false);
});

test('merchant-owned shipments allow only wholly owned order items and legacy full-order shipments', () => {
  const order = {
    merchantId: null,
    items: [
      { id: 'item-a', merchantId: 'merchant-a' },
      { id: 'item-b', merchantId: 'merchant-b' }
    ]
  };
  const singleMerchantOrder = {
    merchantId: 'merchant-a',
    items: [
      { id: 'item-a', merchantId: null },
      { id: 'item-b', merchantId: 'merchant-a' }
    ]
  };

  assert.equal(merchantOwnsEntireOrder(order, 'merchant-a'), false);
  assert.equal(merchantOwnsShipment(order, 'merchant-a', [{ orderItemId: 'item-a' }]), true);
  assert.equal(merchantOwnsShipment(order, 'merchant-a', [{ orderItemId: 'item-a' }, { orderItemId: 'item-b' }]), false);
  assert.equal(merchantOwnsEntireOrder(singleMerchantOrder, 'merchant-a'), true);
  assert.equal(merchantOwnsShipment(singleMerchantOrder, 'merchant-a', []), true);
});

test('merchant drafts are editable only through the dedicated draft endpoints', () => {
  const draft = {
    merchantId: 'merchant-a',
    status: 'draft',
    items: []
  };

  assert.equal(merchantOwnsOrder(draft, 'merchant-a'), false);
  assert.equal(merchantOwnsEntireOrder(draft, 'merchant-a'), false);
  assert.equal(merchantOwnsShipment(draft, 'merchant-a', []), false);
});

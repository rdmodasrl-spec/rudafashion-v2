import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeRestaurantPurchaseOrderCreate,
  normalizeRestaurantPurchaseReceipt,
  normalizeRestaurantPurchaseTransition
} from '../src/server/restaurantProcurement';

test('restaurant purchase order input normalizes currency and decimal strings', () => {
  assert.deepEqual(normalizeRestaurantPurchaseOrderCreate({
    supplierId: 'supplier-1',
    currency: 'eur',
    notes: '  Weekly order  ',
    items: [{ ingredientId: 'ingredient-1', orderedQuantity: '2.5', quotedUnitCost: '1.2' }]
  }), {
    supplierId: 'supplier-1',
    currency: 'EUR',
    notes: 'Weekly order',
    items: [{ ingredientId: 'ingredient-1', orderedQuantity: '2.500', quotedUnitCost: '1.2000' }]
  });
});

test('restaurant purchase orders reject invalid, duplicate, or imprecise lines', () => {
  const order = {
    supplierId: 'supplier-1',
    currency: 'EUR',
    items: [{ ingredientId: 'ingredient-1', orderedQuantity: '1', quotedUnitCost: '0' }]
  };
  assert.equal(normalizeRestaurantPurchaseOrderCreate({ ...order, items: [{ ...order.items[0], orderedQuantity: '0' }] }), null);
  assert.equal(normalizeRestaurantPurchaseOrderCreate({ ...order, items: [{ ...order.items[0], orderedQuantity: '1.0001' }] }), null);
  assert.equal(normalizeRestaurantPurchaseOrderCreate({ ...order, items: [order.items[0], order.items[0]] }), null);
  assert.equal(normalizeRestaurantPurchaseOrderCreate({ ...order, unknown: true }), null);
  assert.equal(normalizeRestaurantPurchaseOrderCreate({ ...order, currency: 'EURO' }), null);
});

test('restaurant purchase transitions require a positive integer version', () => {
  assert.deepEqual(normalizeRestaurantPurchaseTransition({ expectedVersion: 3 }), { expectedVersion: 3 });
  assert.equal(normalizeRestaurantPurchaseTransition({ expectedVersion: 0 }), null);
  assert.equal(normalizeRestaurantPurchaseTransition({ expectedVersion: '3' }), null);
});

test('restaurant receipts require actual quantity and unit cost per unique order line', () => {
  assert.deepEqual(normalizeRestaurantPurchaseReceipt({
    expectedVersion: 2,
    note: 'received today',
    items: [{ itemId: 'item-1', quantity: '0.5', unitCost: '3.125' }]
  }), {
    expectedVersion: 2,
    note: 'received today',
    items: [{ itemId: 'item-1', quantity: '0.500', unitCost: '3.1250' }]
  });
  assert.equal(normalizeRestaurantPurchaseReceipt({
    expectedVersion: 2,
    items: [{ itemId: 'item-1', quantity: '1', unitCost: '1' }, { itemId: 'item-1', quantity: '2', unitCost: '1' }]
  }), null);
  assert.equal(normalizeRestaurantPurchaseReceipt({
    expectedVersion: 2,
    items: [{ itemId: 'item-1', quantity: '1', unitCost: '-1' }]
  }), null);
});

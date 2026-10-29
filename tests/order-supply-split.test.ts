import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateOrderSupplySplit } from '../src/server/orderSupplySplit';

test('acceptance splits available stock from backorder demand by SKU', () => {
  assert.deepEqual(calculateOrderSupplySplit(30, 16, true), {
    inStockQuantity: 16,
    preorderQuantity: 14
  });
});

test('acceptance blocks backorder for SKUs explicitly marked unavailable', () => {
  assert.equal(calculateOrderSupplySplit(30, 16, false), null);
  assert.deepEqual(calculateOrderSupplySplit(16, 16, false), {
    inStockQuantity: 16,
    preorderQuantity: 0
  });
});

test('invalid quantities and inventory values cannot be allocated', () => {
  assert.equal(calculateOrderSupplySplit(0, 4, true), null);
  assert.equal(calculateOrderSupplySplit(3.5, 4, true), null);
  assert.equal(calculateOrderSupplySplit(3, -1, true), null);
});

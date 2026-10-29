import assert from 'node:assert/strict';
import test from 'node:test';
import { isEmployeeOrderReplayMatch } from '../src/server/employeeOrderIdempotency';

const existing = {
  merchantId: 'merchant-a',
  customerId: null,
  paymentMethod: 'cash',
  posShiftId: 'shift-a',
  orderNo: 'POS-20260930-ORDER1',
  items: [
    { productId: 'product-a', sku: 'SKU-1', quantity: 2 },
    { productId: 'product-b', sku: 'SKU-2', quantity: 1 }
  ]
};

const request = {
  merchantId: 'merchant-a',
  customerId: null,
  paymentMethod: 'cash',
  posShiftId: 'shift-a',
  isPosSale: true,
  items: [
    { productId: 'product-b', sku: 'SKU-2', quantity: 1 },
    { productId: 'product-a', sku: 'SKU-1', quantity: 2 }
  ]
};

test('employee order idempotency accepts an exact request regardless of item ordering', () => {
  assert.equal(isEmployeeOrderReplayMatch(existing, request), true);
});

test('employee order idempotency rejects cross-merchant and changed-order replays', () => {
  assert.equal(isEmployeeOrderReplayMatch(existing, { ...request, merchantId: 'merchant-b' }), false);
  assert.equal(isEmployeeOrderReplayMatch(existing, { ...request, paymentMethod: 'card' }), false);
  assert.equal(isEmployeeOrderReplayMatch(existing, { ...request, posShiftId: null }), false);
  assert.equal(isEmployeeOrderReplayMatch(existing, { ...request, items: [{ productId: 'product-a', sku: 'SKU-1', quantity: 3 }] }), false);
  assert.equal(isEmployeeOrderReplayMatch(existing, { ...request, isPosSale: false }), false);
});

test('employee order idempotency rejects invalid replay item data', () => {
  assert.equal(isEmployeeOrderReplayMatch(existing, { ...request, items: [{ productId: 'product-a', sku: 'SKU-1', quantity: 0 }] }), false);
});

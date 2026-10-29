import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BULK_WHOLESALE_MINIMUM_QUANTITY,
  getProductWholesalePriceForQuantity
} from '../src/shared/productPricing';

test('uses the regular wholesale price below the 100-piece threshold', () => {
  assert.equal(getProductWholesalePriceForQuantity(22, 20, 99), 22);
});

test('uses the 100-piece wholesale price at and above the threshold', () => {
  assert.equal(BULK_WHOLESALE_MINIMUM_QUANTITY, 100);
  assert.equal(getProductWholesalePriceForQuantity(22, 20, 100), 20);
  assert.equal(getProductWholesalePriceForQuantity(22, 20, 125), 20);
});

test('keeps the regular wholesale price when no bulk price is configured', () => {
  assert.equal(getProductWholesalePriceForQuantity(22, null, 100), 22);
});

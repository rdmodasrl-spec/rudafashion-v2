import assert from 'node:assert/strict';
import test from 'node:test';
import { isSameCartLine } from '../src/utils/cart';

test('merges the same SKU for the same product only', () => {
  const firstProduct = { productId: 'product-a', sku: 'STYLE-BLK-M' };
  assert.equal(isSameCartLine(firstProduct, { ...firstProduct }), true);
  assert.equal(isSameCartLine(firstProduct, { productId: 'product-b', sku: firstProduct.sku }), false);
  assert.equal(isSameCartLine(firstProduct, { productId: firstProduct.productId, sku: 'STYLE-WHT-M' }), false);
});

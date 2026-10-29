import assert from 'node:assert/strict';
import test from 'node:test';
import { calculatePromotion, type PromotionCalculationItem } from '../src/utils/promotion-calculator.ts';

const items: PromotionCalculationItem[] = [
  { productId: 'p1', merchantId: 'm1', categoryId: 'shirts', quantity: 2, unitPrice: 50 },
  { productId: 'p2', merchantId: 'm2', categoryId: 'shoes', quantity: 1, unitPrice: 100 }
];

test('calculates and caps percentage discounts using eligible products only', () => {
  const result = calculatePromotion({
    type: 'percent_discount', scope: 'merchant', appliesOn: 'wholesale',
    merchantIds: ['m1'], percentOff: 25
  }, items);
  assert.equal(result.discountAmount, 25);
  assert.deepEqual(result.itemDiscounts, [25, 0]);
  assert.equal(result.eligibleSubtotal, 100);
});

test('applies fixed discounts without exceeding eligible subtotal', () => {
  const result = calculatePromotion({
    type: 'fixed_amount', scope: 'sitewide', appliesOn: 'both', fixedAmountOff: 500
  }, items);
  assert.equal(result.discountAmount, 200);
  assert.deepEqual(result.itemDiscounts, [100, 100]);
});

test('applies buy-X-get-Y discount to the cheapest eligible units', () => {
  const result = calculatePromotion({
    type: 'buy_x_get_y', scope: 'sitewide', appliesOn: 'wholesale',
    buyQty: 2, getQty: 1, getPercentOff: 100
  }, [
    { productId: 'p1', merchantId: 'm1', categoryId: 'shirts', quantity: 2, unitPrice: 20 },
    { productId: 'p2', merchantId: 'm1', categoryId: 'shirts', quantity: 1, unitPrice: 10 }
  ]);
  assert.equal(result.discountAmount, 10);
  assert.deepEqual(result.itemDiscounts, [0, 10]);
});

test('uses the strongest matching tier and honors minimum thresholds', () => {
  const rule = {
    type: 'tiered_discount' as const, scope: 'sitewide' as const, appliesOn: 'wholesale' as const,
    minSubtotal: 250,
    tiers: [
      { thresholdAmount: 100, percentOff: 10 },
      { thresholdAmount: 200, percentOff: 20 }
    ]
  };
  assert.equal(calculatePromotion(rule, items).discountAmount, 0);
  assert.equal(calculatePromotion(rule, [...items, { ...items[1], quantity: 2 }]).discountAmount, 80);
});

test('free shipping discounts only the available shipping charge', () => {
  const result = calculatePromotion({
    type: 'free_shipping', scope: 'sitewide', appliesOn: 'both', minSubtotal: 250
  }, [...items, { ...items[1], quantity: 1 }], 45);
  assert.equal(result.shippingDiscount, 45);
  assert.equal(result.discountAmount, 0);
});

test('honors exclusion and quantity thresholds for bundles', () => {
  const result = calculatePromotion({
    type: 'bundle_deal', scope: 'sitewide', appliesOn: 'wholesale',
    minQty: 4, fixedAmountOff: 20, excludeSaleItems: true
  }, [
    { ...items[0], quantity: 3 },
    { ...items[1], quantity: 2, isSaleItem: true }
  ]);
  assert.equal(result.eligibleQuantity, 3);
  assert.equal(result.discountAmount, 0);
});

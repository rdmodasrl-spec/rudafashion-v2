import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MERCHANT_SALES_COUNTED_RETURN_STATUSES,
  MERCHANT_SALES_EXCLUDED_ORDER_STATUSES,
  countsAsMerchantSale,
  isMerchantSaleReturn,
  summarizeMerchantProductSales,
  type MerchantSaleOrderLine
} from '../src/server/merchantProductSales';
import { buildMerchantProductSalesIndex } from '../src/shared/merchantProductSales';

const line = (overrides: Partial<MerchantSaleOrderLine> = {}): MerchantSaleOrderLine => ({
  orderId: 'order-1',
  productId: 'product-1',
  sku: 'SKU-1',
  quantity: 2,
  orderStatus: 'delivered',
  paymentStatus: 'paid',
  refundStatus: 'none',
  orderedAt: '2026-10-20T09:00:00.000Z',
  ...overrides
});

test('cancelled, draft and fully refunded orders never count as sales', () => {
  assert.deepEqual([...MERCHANT_SALES_EXCLUDED_ORDER_STATUSES], ['draft', 'cancelled']);
  assert.equal(countsAsMerchantSale({ status: 'draft', paymentStatus: 'unpaid' }), false);
  assert.equal(countsAsMerchantSale({ status: 'cancelled', paymentStatus: 'payment_failed' }), false);
  assert.equal(countsAsMerchantSale({ status: 'delivered', paymentStatus: 'refunded' }), false);
  assert.equal(countsAsMerchantSale({ status: 'delivered', paymentStatus: 'paid', refundStatus: 'completed' }), false);
  assert.equal(countsAsMerchantSale({ status: 'delivered', paymentStatus: 'partially_refunded', refundStatus: 'partially_refunded' }), true);
  assert.equal(countsAsMerchantSale({ status: 'shipped', paymentStatus: 'unpaid' }), true);
});

test('only received or refunded returns reduce sold units', () => {
  assert.deepEqual([...MERCHANT_SALES_COUNTED_RETURN_STATUSES], ['received', 'refunded']);
  assert.equal(isMerchantSaleReturn('requested'), false);
  assert.equal(isMerchantSaleReturn('approved'), false);
  assert.equal(isMerchantSaleReturn('received'), true);
  assert.equal(isMerchantSaleReturn('refunded'), true);
});

test('sales summary counts real order lines per product and ignores cancelled orders', () => {
  const summary = summarizeMerchantProductSales([
    line({ orderId: 'order-1', productId: 'product-1', quantity: 3 }),
    line({ orderId: 'order-2', productId: 'product-1', quantity: 2, orderedAt: '2026-10-22T10:00:00.000Z' }),
    line({ orderId: 'order-3', productId: 'product-1', quantity: 5, orderStatus: 'cancelled' }),
    line({ orderId: 'order-4', productId: 'product-1', quantity: 4, orderStatus: 'draft' }),
    line({ orderId: 'order-5', productId: 'product-2', quantity: 1, paymentStatus: 'refunded' }),
    line({ orderId: 'order-6', productId: 'product-3', quantity: 1, refundStatus: 'completed' })
  ]);

  assert.deepEqual(summary.products.map(product => product.productId), ['product-1']);
  assert.equal(summary.products[0]?.soldUnits, 5);
  assert.equal(summary.products[0]?.orderCount, 2);
  assert.equal(summary.products[0]?.lastSoldAt, '2026-10-22T10:00:00.000Z');
  assert.equal(summary.totalSoldUnits, 5);
});

test('received returns subtract per order, product and SKU without going negative', () => {
  const summary = summarizeMerchantProductSales(
    [
      line({ orderId: 'order-1', productId: 'product-1', sku: 'SKU-A', quantity: 3 }),
      line({ orderId: 'order-1', productId: 'product-1', sku: 'SKU-B', quantity: 2 }),
      line({ orderId: 'order-2', productId: 'product-1', sku: 'SKU-A', quantity: 4 })
    ],
    [
      { orderId: 'order-1', items: [{ productId: 'product-1', sku: 'SKU-A', quantity: 2 }] },
      { orderId: 'order-2', items: [{ productId: 'product-1', sku: 'SKU-A', quantity: 99 }] },
      { orderId: 'order-3', items: [{ productId: 'product-1', sku: 'SKU-A', quantity: 5 }] }
    ]
  );

  // SKU-A: 3 - 2 + (4 - 4 封顶) = 1；SKU-B 未退货 = 2；未知订单的退货不扣减。
  assert.equal(summary.products[0]?.productId, 'product-1');
  assert.equal(summary.products[0]?.soldUnits, 3);
  assert.equal(summary.totalSoldUnits, 3);
});

test('a product only counts as sold when it has real sales, never because of stock', () => {
  const summary = summarizeMerchantProductSales([
    line({ orderId: 'order-1', productId: 'always-in-stock', quantity: 6 }),
    line({ orderId: 'order-2', productId: 'fully-returned', quantity: 2 })
  ], [
    { orderId: 'order-2', items: [{ productId: 'fully-returned', sku: 'SKU-1', quantity: 2 }] }
  ]);

  // 汇总逻辑不读取库存：仍在销售的商品保留；全部退货后不再算已售出；从未成交的商品不会出现。
  assert.deepEqual(summary.products.map(product => product.productId), ['always-in-stock']);
  assert.equal(summary.products[0]?.soldUnits, 6);
  assert.equal(summary.products.some(product => product.productId === 'never-sold'), false);
});

test('sold index only exposes products with positive net units', () => {
  const index = buildMerchantProductSalesIndex({
    totalSoldUnits: 7,
    products: [
      { productId: 'p1', soldUnits: 5, orderCount: 2, lastSoldAt: null },
      { productId: 'p2', soldUnits: 0, orderCount: 0, lastSoldAt: null },
      { productId: 'p3', soldUnits: -1, orderCount: 0, lastSoldAt: null },
      { productId: '', soldUnits: 2, orderCount: 1, lastSoldAt: null },
      { productId: 'p4', soldUnits: 2, orderCount: 1, lastSoldAt: null }
    ]
  });

  assert.deepEqual([...index.soldProductIds].sort(), ['p1', 'p4']);
  assert.equal(index.soldUnitsByProduct.get('p1'), 5);
  assert.equal(index.soldUnitsByProduct.get('p2'), undefined);
  assert.equal(buildMerchantProductSalesIndex(null).soldProductIds.size, 0);
});

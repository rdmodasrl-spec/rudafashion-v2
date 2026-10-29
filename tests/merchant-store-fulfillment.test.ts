import assert from 'node:assert/strict';
import test from 'node:test';
import { selectStoreForOrder } from '../src/server/merchantStoreFulfillment';

const stores = [
  { id: 'store-a', code: 'A', status: 'active' },
  { id: 'store-b', code: 'B', status: 'active' }
];

test('selects one store that can fulfill every SKU and prefers the greatest available stock', () => {
  const selected = selectStoreForOrder({
    stores,
    items: [
      { productId: 'product-1', sku: 'sku-1', quantity: 3 },
      { productId: 'product-2', sku: 'sku-2', quantity: 2 }
    ],
    stock: [
      { storeId: 'store-a', productId: 'product-1', sku: 'sku-1', quantity: 5 },
      { storeId: 'store-a', productId: 'product-2', sku: 'sku-2', quantity: 2 },
      { storeId: 'store-b', productId: 'product-1', sku: 'sku-1', quantity: 8 },
      { storeId: 'store-b', productId: 'product-2', sku: 'sku-2', quantity: 4 }
    ],
    reservations: [
      { location: 'store:store-b', productId: 'product-1', sku: 'sku-1', quantity: 3, status: 'reserved' }
    ]
  });

  assert.equal(selected, 'store-b');
});

test('uses deterministic store-code ordering for equal availability', () => {
  const selected = selectStoreForOrder({
    stores: [...stores].reverse(),
    items: [{ productId: 'product-1', sku: 'sku-1', quantity: 1 }],
    stock: [
      { storeId: 'store-a', productId: 'product-1', sku: 'sku-1', quantity: 4 },
      { storeId: 'store-b', productId: 'product-1', sku: 'sku-1', quantity: 4 }
    ],
    reservations: []
  });

  assert.equal(selected, 'store-a');
});

test('rejects insufficient explicit and employee-bound stores without falling back', () => {
  const input = {
    stores,
    items: [{ productId: 'product-1', sku: 'sku-1', quantity: 3 }],
    stock: [{ storeId: 'store-b', productId: 'product-1', sku: 'sku-1', quantity: 5 }],
    reservations: [{ location: 'store:store-b', productId: 'product-1', sku: 'sku-1', quantity: 3, status: 'active' }]
  };

  assert.throws(() => selectStoreForOrder({ ...input, requestedStoreId: 'store-a' }), /STORE_STOCK_INSUFFICIENT/);
  assert.throws(() => selectStoreForOrder({ ...input, employeeStoreId: 'store-a' }), /STORE_STOCK_INSUFFICIENT/);
  assert.throws(() => selectStoreForOrder({ ...input, requestedStoreId: 'store-b', employeeStoreId: 'store-a' }), /STORE_ACCESS_DENIED/);
});

test('only active or reserved rows reduce sellable store stock', () => {
  const selected = selectStoreForOrder({
    stores,
    items: [{ productId: 'product-1', sku: 'sku-1', quantity: 3 }],
    stock: [{ storeId: 'store-a', productId: 'product-1', sku: 'sku-1', quantity: 3 }],
    reservations: [
      { location: 'store:store-a', productId: 'product-1', sku: 'sku-1', quantity: 2, status: 'released' },
      { location: 'store:store-a', productId: 'product-1', sku: 'sku-1', quantity: 1, status: 'consumed' }
    ]
  });

  assert.equal(selected, 'store-a');
});

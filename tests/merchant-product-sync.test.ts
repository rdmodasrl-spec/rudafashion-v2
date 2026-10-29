import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mergePublicProductsPreservingMerchant,
  replaceMerchantProducts
} from '../src/shared/merchantProductSync';

type ProductRef = { id: string; merchantId?: string; name: string };

test('public catalog refresh does not erase the signed-in merchant catalog', () => {
  const current: ProductRef[] = [
    { id: 'merchant-draft', merchantId: 'merchant-a', name: 'Draft' },
    { id: 'public-stale', merchantId: 'merchant-a', name: 'Merchant copy' },
    { id: 'other-public', merchantId: 'merchant-b', name: 'Other merchant' }
  ];
  const publicProducts: ProductRef[] = [
    { id: 'public-stale', merchantId: 'merchant-a', name: 'Public copy' },
    { id: 'new-public', merchantId: 'merchant-b', name: 'New public item' }
  ];

  assert.deepEqual(
    mergePublicProductsPreservingMerchant(publicProducts, current, 'merchant-a'),
    [
      { id: 'new-public', merchantId: 'merchant-b', name: 'New public item' },
      { id: 'merchant-draft', merchantId: 'merchant-a', name: 'Draft' },
      { id: 'public-stale', merchantId: 'merchant-a', name: 'Merchant copy' }
    ]
  );
});

test('merchant refresh replaces only that merchant data and retains public products', () => {
  const current: ProductRef[] = [
    { id: 'public', merchantId: 'merchant-b', name: 'Public item' },
    { id: 'old', merchantId: 'merchant-a', name: 'Old merchant item' }
  ];
  const refreshed: ProductRef[] = [
    { id: 'new', merchantId: 'merchant-a', name: 'New merchant item' },
    { id: 'not-owned', merchantId: 'merchant-b', name: 'Not owned response' }
  ];

  assert.deepEqual(replaceMerchantProducts(current, 'merchant-a', refreshed), [
    { id: 'public', merchantId: 'merchant-b', name: 'Public item' },
    { id: 'new', merchantId: 'merchant-a', name: 'New merchant item' }
  ]);
});

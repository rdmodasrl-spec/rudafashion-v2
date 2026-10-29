import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAuthorizedProductVisibility,
  getBuyerVaultAccessStatus,
  isActiveVaultAuthorization,
  isPublicProduct,
  isPublicStorefront,
  PUBLIC_PRODUCT_VISIBILITY_FILTER,
  PUBLIC_STOREFRONT_MERCHANT_FILTER,
  sanitizePublicProduct
} from '../src/server/publicProductVisibility';

test('anonymous and unapproved buyers can see only public non-exclusive products', () => {
  const publicOnly = [{ visibility: 'public', isExclusiveProtected: false }];

  assert.deepEqual(buildAuthorizedProductVisibility(null, ['merchant-a']), publicOnly);
  assert.deepEqual(buildAuthorizedProductVisibility('pending', ['merchant-a']), publicOnly);
});

test('approved buyers can additionally see public wholesale products', () => {
  assert.deepEqual(buildAuthorizedProductVisibility('approved', []), [
    { visibility: 'public', isExclusiveProtected: false },
    { visibility: 'wholesale', isExclusiveProtected: false }
  ]);
});

test('private and exclusive products are limited to merchants with approved vault access', () => {
  const visibility = buildAuthorizedProductVisibility('approved', [
    'merchant-a',
    'merchant-a',
    'merchant-b',
    ''
  ]);

  assert.deepEqual(visibility[2], {
    merchantId: { in: ['merchant-a', 'merchant-b'] },
    OR: [{ visibility: 'private' }, { isExclusiveProtected: true }]
  });
});

test('expired, revoked, and malformed vault authorizations do not grant access', () => {
  const now = new Date('2026-10-16T20:00:00.000Z');

  assert.equal(isActiveVaultAuthorization('approved', '2026-10-16T20:00:01.000Z', now), true);
  assert.equal(isActiveVaultAuthorization('approved', null, now), true);
  assert.equal(isActiveVaultAuthorization('approved', '2026-10-16T19:59:59.000Z', now), false);
  assert.equal(isActiveVaultAuthorization('rejected', '2026-10-16T21:00:00.000Z', now), false);
  assert.equal(isActiveVaultAuthorization('approved', 'not-a-date', now), false);
});

test('supplier vault status is limited to the authenticated approved buyer and active request', () => {
  const now = new Date('2026-10-16T20:00:00.000Z');

  assert.equal(getBuyerVaultAccessStatus(null, { status: 'approved' }, now), 'none');
  assert.equal(getBuyerVaultAccessStatus('pending', { status: 'approved' }, now), 'none');
  assert.equal(getBuyerVaultAccessStatus('approved', { status: 'pending' }, now), 'pending');
  assert.equal(getBuyerVaultAccessStatus('approved', {
    status: 'approved',
    expiresAt: '2026-10-16T19:59:59.000Z'
  }, now), 'none');
  assert.equal(getBuyerVaultAccessStatus('approved', {
    status: 'approved',
    expiresAt: '2026-10-16T20:00:01.000Z'
  }, now), 'approved');
});

test('public catalog filter excludes wholesale and exclusive products', () => {
  assert.deepEqual(PUBLIC_PRODUCT_VISIBILITY_FILTER, {
    visibility: 'public',
    isExclusiveProtected: false
  });
  assert.equal(isPublicProduct({ visibility: 'public', isExclusiveProtected: false }), true);
  assert.equal(isPublicProduct({ visibility: 'wholesale', isExclusiveProtected: false }), false);
  assert.equal(isPublicProduct({ visibility: 'public', isExclusiveProtected: true }), false);
});

test('public storefront filter allows enabled stores and verified legacy stores only', () => {
  assert.deepEqual(PUBLIC_STOREFRONT_MERCHANT_FILTER, {
    OR: [{ storefrontEnabled: true }, { isVerified: true, storefrontEnabled: null }]
  });
  assert.equal(isPublicStorefront({ storefrontEnabled: true, isVerified: false }), true);
  assert.equal(isPublicStorefront({ storefrontEnabled: null, isVerified: true }), true);
  assert.equal(isPublicStorefront({ storefrontEnabled: false, isVerified: true }), false);
  assert.equal(isPublicStorefront({ storefrontEnabled: null, isVerified: false }), false);
});

test('public product payload omits cost price and internal media and SKU fields', () => {
  const product = sanitizePublicProduct({
    id: 'product-1',
    costPrice: 4,
    wholesalePrice: 10,
    media: [{ id: 'media-1', url: 'https://cdn.example.test/image.jpg', storageKey: 'private/key' }],
    skus: [{ sku: 'sku-1', cost: 2, color: 'black' }]
  });

  assert.deepEqual(product, {
    id: 'product-1',
    wholesalePrice: 10,
    media: [{ id: 'media-1', url: 'https://cdn.example.test/image.jpg' }],
    skus: [{ sku: 'sku-1', color: 'black' }]
  });
});

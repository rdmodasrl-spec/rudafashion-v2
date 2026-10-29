import assert from 'node:assert/strict';
import test from 'node:test';
import {
  makeUniqueMerchantStoreSlug,
  merchantStorefrontUrl
} from '../src/shared/merchantStoreUrl';

test('creates a DNS-safe unique store subdomain from the merchant name', () => {
  assert.equal(
    makeUniqueMerchantStoreSlug("SKY BLUE SOCIETA'", ['sky-blue-societa'], 'merchant-new'),
    'sky-blue-societa-2'
  );
  assert.equal(
    makeUniqueMerchantStoreSlug('Admin', ['admin-2'], 'merchant-new'),
    'admin-3'
  );
});

test('builds localized canonical store URLs and preserves query parameters', () => {
  assert.equal(
    merchantStorefrontUrl('sky-blue-societa', 'zh', '?ref=partner'),
    'https://sky-blue-societa.ruda.fashion/zh/?ref=partner'
  );
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeMerchantWebsiteUrl } from '../src/shared/merchantWebsiteUrl';

test('normalizes bare domains and full-width punctuation to secure website URLs', () => {
  assert.equal(normalizeMerchantWebsiteUrl('www。ruda.com'), 'https://www.ruda.com/');
  assert.equal(normalizeMerchantWebsiteUrl('http://example.com/shop'), 'http://example.com/shop');
});

test('rejects invalid and unsafe merchant website URLs', () => {
  assert.equal(normalizeMerchantWebsiteUrl('javascript:alert(1)'), '');
  assert.equal(normalizeMerchantWebsiteUrl('https://user:pass@example.com'), '');
  assert.equal(normalizeMerchantWebsiteUrl('company'), '');
  assert.equal(normalizeMerchantWebsiteUrl(`https://${'a'.repeat(205)}.com`), '');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hasMerchantEmailDomainVerificationRecord,
  merchantEmailDomainVerificationHost,
  normalizeMerchantEmailDomain
} from '../src/server/merchantEmailDomain';

test('merchant email domains are normalized and validated as DNS hostnames', () => {
  assert.equal(normalizeMerchantEmailDomain(' Example.COM. '), 'example.com');
  assert.equal(normalizeMerchantEmailDomain('münich.example'), 'xn--mnich-kva.example');
  for (const value of [
    null,
    '',
    'localhost',
    'https://example.com',
    'user@example.com',
    'example.com/path',
    '-invalid.example',
    'invalid..example'
  ]) {
    assert.equal(normalizeMerchantEmailDomain(value), null);
  }
});

test('TXT verification joins segmented DNS strings and requires an exact token match', () => {
  assert.equal(merchantEmailDomainVerificationHost('example.com'), '_ruda-verification.example.com');
  assert.equal(
    hasMerchantEmailDomainVerificationRecord([['ruda-domain-', 'verification=token-123']], 'ruda-domain-verification=token-123'),
    true
  );
  assert.equal(
    hasMerchantEmailDomainVerificationRecord([['ruda-domain-verification=other-token']], 'ruda-domain-verification=token-123'),
    false
  );
});

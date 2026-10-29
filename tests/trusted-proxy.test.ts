import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTrustProxyHops } from '../src/server/trustedProxy';

test('trust proxy hops defaults to a single hop when unset', () => {
  assert.deepEqual(parseTrustProxyHops(undefined), { hops: 1, invalid: null });
  assert.deepEqual(parseTrustProxyHops('  '), { hops: 1, invalid: null });
});

test('trust proxy hops accepts an explicit integer hop count', () => {
  assert.deepEqual(parseTrustProxyHops('2'), { hops: 2, invalid: null });
  assert.deepEqual(parseTrustProxyHops(' 3 '), { hops: 3, invalid: null });
  assert.deepEqual(parseTrustProxyHops('5'), { hops: 5, invalid: null });
});

test('trust proxy hops rejects values that would trust too many hops', () => {
  for (const raw of ['0', '-1', '6', '99', '1.5', 'all', 'true']) {
    assert.deepEqual(parseTrustProxyHops(raw), { hops: 1, invalid: raw }, `value ${raw}`);
  }
});

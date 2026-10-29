import test from 'node:test';
import assert from 'node:assert/strict';
import { getProductZone, getProductZoneUpdates } from '../src/utils/productZone';

test('maps products to the requested storefront zones with private access taking precedence', () => {
  assert.equal(getProductZone({ status: 'new', visibility: 'public' }), 'new');
  assert.equal(getProductZone({ status: 'clearance', visibility: 'public' }), 'clearance');
  assert.equal(getProductZone({ status: 'clearance', visibility: 'private' }), 'private');
  assert.equal(getProductZone({ status: 'new', isExclusiveProtected: true }), 'private');
});

test('updates zone status and buyer visibility together', () => {
  assert.deepEqual(getProductZoneUpdates('new'), {
    status: 'new',
    visibility: 'public',
    isExclusiveProtected: false,
    protectionLevel: 'public'
  });
  assert.deepEqual(getProductZoneUpdates('clearance'), {
    status: 'clearance',
    visibility: 'public',
    isExclusiveProtected: false,
    protectionLevel: 'public'
  });
  assert.deepEqual(getProductZoneUpdates('private'), {
    status: 'new',
    visibility: 'private',
    isExclusiveProtected: true,
    protectionLevel: 'exclusive_vault'
  });
});

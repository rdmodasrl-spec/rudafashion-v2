import assert from 'node:assert/strict';
import test from 'node:test';
import { mergePublicMerchantsPreservingAuthenticated } from '../src/shared/merchantDirectorySync';

type MerchantRef = { id: string; name: string };

test('public merchant refresh retains the authenticated merchant when it is not public', () => {
  const authenticatedMerchant = { id: 'merchant-private', name: 'Private merchant' };
  const publicMerchants = [{ id: 'merchant-public', name: 'Public merchant' }];

  assert.deepEqual(
    mergePublicMerchantsPreservingAuthenticated(
      publicMerchants,
      [authenticatedMerchant],
      authenticatedMerchant.id
    ),
    [authenticatedMerchant, ...publicMerchants]
  );
});

test('authenticated merchant data takes precedence over its public directory entry', () => {
  const authenticatedMerchant = { id: 'merchant-a', name: 'Signed-in profile' };
  const publicMerchants: MerchantRef[] = [
    { id: 'merchant-a', name: 'Public profile' },
    { id: 'merchant-b', name: 'Another merchant' }
  ];

  assert.deepEqual(
    mergePublicMerchantsPreservingAuthenticated(
      publicMerchants,
      [authenticatedMerchant],
      authenticatedMerchant.id
    ),
    [authenticatedMerchant, publicMerchants[1]]
  );
});

test('public merchant refresh is unchanged when there is no authenticated merchant', () => {
  const publicMerchants = [{ id: 'merchant-a', name: 'Public merchant' }];

  assert.equal(
    mergePublicMerchantsPreservingAuthenticated(publicMerchants, [], null),
    publicMerchants
  );
});

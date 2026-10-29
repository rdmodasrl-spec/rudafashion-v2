import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateVerifiedAccountLink, type IdentityLinkAccount } from '../src/utils/accountIdentity';

const verifiedAt = new Date('2026-01-01T00:00:00.000Z');
const comparePassword = async (password: string, passwordHash: string) => password === passwordHash;

function account(overrides: Partial<IdentityLinkAccount> = {}): IdentityLinkAccount {
  return {
    identityId: null,
    passwordHash: 'shared-password',
    emailVerifiedAt: verifiedAt,
    phone: null,
    phoneVerifiedAt: null,
    ...overrides
  };
}

test('automatically links verified accounts that already share a password', async () => {
  const decision = await evaluateVerifiedAccountLink(
    [account(), account()],
    null,
    'shared-password',
    comparePassword
  );

  assert.deepEqual(decision, {
    eligible: true,
    passwordHash: 'shared-password',
    phone: null,
    phoneVerifiedAt: null
  });
});

test('routes accounts with an unverified email to manual review', async () => {
  const decision = await evaluateVerifiedAccountLink(
    [account(), account({ emailVerifiedAt: null })],
    null,
    'shared-password',
    comparePassword
  );

  assert.deepEqual(decision, { eligible: false });
});

test('routes accounts with conflicting passwords to manual review', async () => {
  const decision = await evaluateVerifiedAccountLink(
    [account(), account({ passwordHash: 'different-password' })],
    null,
    'shared-password',
    comparePassword
  );

  assert.deepEqual(decision, { eligible: false });
});

test('shares a single verified phone and rejects conflicting verified phones', async () => {
  const samePhone = await evaluateVerifiedAccountLink(
    [
      account({ phone: '+393331234567', phoneVerifiedAt: verifiedAt }),
      account({ phone: '+393331234567', phoneVerifiedAt: verifiedAt })
    ],
    null,
    'shared-password',
    comparePassword
  );
  const differentPhones = await evaluateVerifiedAccountLink(
    [
      account({ phone: '+393331234567', phoneVerifiedAt: verifiedAt }),
      account({ phone: '+393339876543', phoneVerifiedAt: verifiedAt })
    ],
    null,
    'shared-password',
    comparePassword
  );

  assert.deepEqual(samePhone, {
    eligible: true,
    passwordHash: 'shared-password',
    phone: '+393331234567',
    phoneVerifiedAt: verifiedAt
  });
  assert.deepEqual(differentPhones, { eligible: false });
});

test('rejects conflicting or missing linked identities', async () => {
  const conflictingIds = await evaluateVerifiedAccountLink(
    [account({ identityId: 'identity-a' }), account({ identityId: 'identity-b' })],
    null,
    'shared-password',
    comparePassword
  );
  const missingIdentity = await evaluateVerifiedAccountLink(
    [account({ identityId: 'identity-a' })],
    null,
    'shared-password',
    comparePassword
  );

  assert.deepEqual(conflictingIds, { eligible: false });
  assert.deepEqual(missingIdentity, { eligible: false });
});

test('uses the existing shared password only when it is confirmed', async () => {
  const decision = await evaluateVerifiedAccountLink(
    [account({ identityId: 'identity-a', phone: '+393331234567', phoneVerifiedAt: verifiedAt })],
    { id: 'identity-a', passwordHash: 'existing-password', phone: null, phoneVerifiedAt: null },
    'existing-password',
    comparePassword
  );
  const mismatch = await evaluateVerifiedAccountLink(
    [account({ identityId: 'identity-a' })],
    { id: 'identity-a', passwordHash: 'existing-password', phone: null, phoneVerifiedAt: null },
    'wrong-password',
    comparePassword
  );

  assert.deepEqual(decision, {
    eligible: true,
    passwordHash: 'existing-password',
    phone: '+393331234567',
    phoneVerifiedAt: verifiedAt
  });
  assert.deepEqual(mismatch, { eligible: false });
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { isValidGoogleSignInCsrf } from '../src/server/googleSignInCsrf';

test('accepts matching Google double-submit CSRF tokens', () => {
  assert.equal(isValidGoogleSignInCsrf('csrf-token', 'csrf-token'), true);
});

test('rejects missing, non-string, and mismatched Google CSRF tokens', () => {
  assert.equal(isValidGoogleSignInCsrf(undefined, 'csrf-token'), false);
  assert.equal(isValidGoogleSignInCsrf('csrf-token', null), false);
  assert.equal(isValidGoogleSignInCsrf('csrf-token', 'other-token'), false);
});

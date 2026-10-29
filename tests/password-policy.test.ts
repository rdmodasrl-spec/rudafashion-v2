import assert from 'node:assert/strict';
import test from 'node:test';
import { meetsMinimumPasswordLength, MINIMUM_PASSWORD_LENGTH } from '../src/shared/passwordPolicy';

test('password policy requires at least twelve non-whitespace characters', () => {
  assert.equal(MINIMUM_PASSWORD_LENGTH, 12);
  assert.equal(meetsMinimumPasswordLength('short-pass'), false);
  assert.equal(meetsMinimumPasswordLength('            '), false);
  assert.equal(meetsMinimumPasswordLength('long-enough-password'), true);
});
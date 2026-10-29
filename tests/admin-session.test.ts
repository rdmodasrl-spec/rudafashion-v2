import assert from 'node:assert/strict';
import test from 'node:test';
import { isAdminSessionCurrent } from '../src/server/adminSession';

test('admin session credential version must match the persisted account version', () => {
  const updatedAt = new Date('2026-10-06T12:00:00.123Z');
  assert.equal(isAdminSessionCurrent(updatedAt.getTime(), undefined, updatedAt), true);
  assert.equal(isAdminSessionCurrent(updatedAt.getTime() - 1, undefined, updatedAt), false);
});

test('legacy admin tokens remain current only if issued after the persisted credential update', () => {
  const updatedAt = new Date('2026-10-06T12:00:00.000Z');
  assert.equal(isAdminSessionCurrent(undefined, updatedAt.getTime() / 1000, updatedAt), true);
  assert.equal(isAdminSessionCurrent(undefined, updatedAt.getTime() / 1000 - 1, updatedAt), false);
  assert.equal(isAdminSessionCurrent(undefined, undefined, updatedAt), false);
});
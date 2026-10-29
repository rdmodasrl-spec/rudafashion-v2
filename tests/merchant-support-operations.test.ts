import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getMerchantSupportFirstResponseDueAt,
  getMerchantSupportSlaState,
  isMerchantSupportPriority
} from '../src/server/merchantSupportOperations';

test('uses the selected first human response SLA for each priority', () => {
  const createdAt = new Date('2026-09-26T10:00:00.000Z');
  assert.equal(getMerchantSupportFirstResponseDueAt(createdAt, 'urgent').toISOString(), '2026-09-26T11:00:00.000Z');
  assert.equal(getMerchantSupportFirstResponseDueAt(createdAt, 'high').toISOString(), '2026-09-26T14:00:00.000Z');
  assert.equal(getMerchantSupportFirstResponseDueAt(createdAt, 'normal').toISOString(), '2026-09-27T10:00:00.000Z');
  assert.equal(getMerchantSupportFirstResponseDueAt(createdAt, 'urgent', { urgent: 180, high: 480, normal: 2880 }).toISOString(), '2026-09-26T13:00:00.000Z');
});

test('validates priority values and measures first response against its deadline', () => {
  assert.equal(isMerchantSupportPriority('urgent'), true);
  assert.equal(isMerchantSupportPriority('critical'), false);
  assert.equal(getMerchantSupportSlaState('2026-09-26T11:00:00Z', null, new Date('2026-09-26T12:00:00Z')), 'overdue');
  assert.equal(getMerchantSupportSlaState('2026-09-26T11:00:00Z', '2026-09-26T10:59:00Z'), 'on_time');
  assert.equal(getMerchantSupportSlaState('2026-09-26T11:00:00Z', '2026-09-26T11:01:00Z'), 'late');
});

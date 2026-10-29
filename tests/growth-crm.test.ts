import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGrowthCrmAutomationCandidates,
  buildGrowthCrmDueReminder,
  buildGrowthCrmDueReminderIdempotencyKey,
  isGrowthCrmCategory,
  isGrowthCrmFollowUpStatus,
  validateGrowthCrmFollowUpFilter,
  validateGrowthCrmFollowUpInput,
  validateGrowthCrmFollowUpStatus,
  validateGrowthCrmFollowUpResolution,
  validateGrowthCrmFollowUpUpdate,
  validateGrowthCrmSubjectFilter,
  serializeGrowthCrmReferralAttribution
} from '../src/server/growthCrm';

const validFollowUp = {
  subjectType: 'consumer',
  subjectId: 'consumer_12345678',
  category: 'activation',
  note: 'Check whether the customer needs help completing profile setup.',
  dueAt: '2026-10-08T10:00:00.000Z'
};

test('creates deterministic internal activation and retention candidates at exact thresholds', () => {
  const now = new Date('2026-10-10T12:00:00.000Z');
  const candidates = buildGrowthCrmAutomationCandidates([
    {
      id: 'consumer_activation_1',
      status: 'active',
      createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      ordersCount: 0,
      lastLoginAt: null
    },
    {
      id: 'consumer_recent_1',
      status: 'active',
      createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000 + 1),
      ordersCount: 0,
      lastLoginAt: null
    },
    {
      id: 'consumer_retention_1',
      status: 'active',
      createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      ordersCount: 1,
      lastLoginAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    },
    {
      id: 'consumer_inactive_1',
      status: 'disabled',
      createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      ordersCount: 2,
      lastLoginAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    },
    {
      id: 'consumer_no_login_1',
      status: 'active',
      createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      ordersCount: 2,
      lastLoginAt: null
    }
  ], now);
  assert.deepEqual(candidates.map(candidate => [candidate.consumerId, candidate.category]), [
    ['consumer_activation_1', 'activation'],
    ['consumer_retention_1', 'retention']
  ]);
  assert.equal(candidates[0].dueAt, now);
  assert.equal(candidates[0].automationKey, `growth-crm:activation:v1:consumer_activation_1:${new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).getTime()}`);
  assert.equal(candidates[1].automationKey, `growth-crm:retention:v1:consumer_retention_1:${new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).getTime()}`);
});

test('validates and normalizes internal CRM follow-up tasks', () => {
  const result = validateGrowthCrmFollowUpInput({ ...validFollowUp, note: '  Follow up  ' });
  assert.equal(result.note, 'Follow up');
  assert.equal(result.dueAt, '2026-10-08T10:00:00.000Z');
  assert.equal(result.subjectType, 'consumer');
});

test('rejects invalid subjects, unsafe notes, unsupported categories, and invalid dates', () => {
  assert.throws(() => validateGrowthCrmFollowUpInput({ ...validFollowUp, subjectType: 'merchant' }), {
    message: 'GROWTH_CRM_FOLLOW_UP_INVALID'
  });
  assert.throws(() => validateGrowthCrmFollowUpInput({ ...validFollowUp, subjectId: 'short' }), {
    message: 'GROWTH_CRM_FOLLOW_UP_INVALID'
  });
  assert.throws(() => validateGrowthCrmFollowUpInput({ ...validFollowUp, category: 'email_blast' }), {
    message: 'GROWTH_CRM_FOLLOW_UP_INVALID'
  });
  assert.throws(() => validateGrowthCrmFollowUpInput({ ...validFollowUp, note: 'x\u0000y' }), {
    message: 'GROWTH_CRM_FOLLOW_UP_INVALID'
  });
  assert.throws(() => validateGrowthCrmFollowUpInput({ ...validFollowUp, dueAt: 'not-a-date' }), {
    message: 'GROWTH_CRM_FOLLOW_UP_INVALID'
  });
});

test('validates partial edits of an open CRM follow-up', () => {
  assert.deepEqual(validateGrowthCrmFollowUpUpdate({
    dueAt: '2026-10-09T12:30:00.000Z',
    note: '  Reschedule after the buyer returns.  '
  }), {
    dueAt: '2026-10-09T12:30:00.000Z',
    note: 'Reschedule after the buyer returns.'
  });
  assert.deepEqual(validateGrowthCrmFollowUpUpdate({ category: 'retention' }), { category: 'retention' });
  for (const invalid of [
    {},
    { dueAt: 'invalid' },
    { note: '  ' },
    { category: 'broadcast' },
    { status: 'completed', dueAt: validFollowUp.dueAt },
    { resolutionNote: 'not allowed' }
  ]) {
    assert.throws(() => validateGrowthCrmFollowUpUpdate(invalid), {
      message: 'GROWTH_CRM_FOLLOW_UP_UPDATE_INVALID'
    });
  }
});

test('permits only terminal CRM follow-up decisions', () => {
  assert.equal(validateGrowthCrmFollowUpStatus('completed'), 'completed');
  assert.equal(validateGrowthCrmFollowUpStatus('cancelled'), 'cancelled');
  assert.equal(isGrowthCrmFollowUpStatus('open'), true);
  assert.equal(isGrowthCrmFollowUpStatus('unexpected'), false);
  assert.throws(() => validateGrowthCrmFollowUpResolution({ status: 'open' }), {
    message: 'GROWTH_CRM_FOLLOW_UP_STATUS_INVALID'
  });
});

test('requires a safe completion result and records optional cancellation context', () => {
  assert.deepEqual(validateGrowthCrmFollowUpResolution({
    status: 'completed',
    resolutionNote: '  Customer requested a product catalog.  '
  }), {
    status: 'completed',
    resolutionNote: 'Customer requested a product catalog.'
  });
  assert.deepEqual(validateGrowthCrmFollowUpResolution({ status: 'cancelled' }), {
    status: 'cancelled',
    resolutionNote: null
  });
  assert.throws(() => validateGrowthCrmFollowUpResolution({ status: 'completed' }), {
    message: 'GROWTH_CRM_FOLLOW_UP_RESOLUTION_REQUIRED'
  });
  assert.throws(() => validateGrowthCrmFollowUpResolution({
    status: 'completed',
    resolutionNote: 'x\u0000y'
  }), {
    message: 'GROWTH_CRM_FOLLOW_UP_RESOLUTION_INVALID'
  });
});

test('accepts only supported CRM history filters', () => {
  assert.equal(validateGrowthCrmFollowUpFilter(undefined), 'open');
  assert.equal(validateGrowthCrmFollowUpFilter('completed'), 'completed');
  assert.equal(validateGrowthCrmFollowUpFilter('cancelled'), 'cancelled');
  assert.equal(validateGrowthCrmFollowUpFilter('all'), 'all');
  assert.throws(() => validateGrowthCrmFollowUpFilter('pending'), {
    message: 'GROWTH_CRM_FOLLOW_UP_FILTER_INVALID'
  });
});

test('validates paired CRM customer history filters', () => {
  assert.equal(validateGrowthCrmSubjectFilter(undefined, undefined), null);
  assert.deepEqual(validateGrowthCrmSubjectFilter('consumer', 'consumer_12345678'), {
    subjectType: 'consumer',
    subjectId: 'consumer_12345678'
  });
  assert.deepEqual(validateGrowthCrmSubjectFilter('customer', 'customer_12345678'), {
    subjectType: 'customer',
    subjectId: 'customer_12345678'
  });
  assert.throws(() => validateGrowthCrmSubjectFilter('consumer', undefined), {
    message: 'GROWTH_CRM_SUBJECT_FILTER_INVALID'
  });
  assert.throws(() => validateGrowthCrmSubjectFilter(undefined, 'consumer_12345678'), {
    message: 'GROWTH_CRM_SUBJECT_FILTER_INVALID'
  });
  assert.throws(() => validateGrowthCrmSubjectFilter('merchant', 'merchant_12345678'), {
    message: 'GROWTH_CRM_SUBJECT_FILTER_INVALID'
  });
});

test('serializes only persisted partner attribution and preserves unlinked records', () => {
  assert.equal(serializeGrowthCrmReferralAttribution(null), null);
  const attribution = serializeGrowthCrmReferralAttribution({
    source: 'link',
    registeredAt: new Date('2026-10-01T10:00:00.000Z'),
    firstClickAt: new Date('2026-09-30T10:00:00.000Z'),
    firstPaidAt: null,
    partner: { partnerCode: 'AG000001', name: 'Agent Milano' },
    cityPartner: { partnerCode: 'CITY000001', name: 'City Milano' },
    networkPartner: null,
    campaign: { name: 'Autumn Instagram', channel: 'instagram' }
  });
  assert.deepEqual(attribution, {
    source: 'link',
    registeredAt: '2026-10-01T10:00:00.000Z',
    firstClickAt: '2026-09-30T10:00:00.000Z',
    firstPaidAt: null,
    partner: { partnerCode: 'AG000001', name: 'Agent Milano' },
    cityPartner: { partnerCode: 'CITY000001', name: 'City Milano' },
    networkPartner: null,
    campaign: { name: 'Autumn Instagram', channel: 'instagram' }
  });
});

test('builds an idempotent in-app reminder without copying private notes', () => {
  const dueAt = new Date('2026-10-08T10:00:00.000Z');
  const reminder = buildGrowthCrmDueReminder({
    id: 'followup_12345678',
    category: 'sales',
    dueAt
  });
  assert.equal(reminder.eventType, 'growth.crm.follow_up.due');
  assert.equal(reminder.channel, 'in_app');
  assert.equal(reminder.status, 'sent');
  assert.equal(reminder.idempotencyKey, buildGrowthCrmDueReminderIdempotencyKey('followup_12345678', dueAt));
  assert.equal(reminder.idempotencyKey, `growth-crm-follow-up-due:followup_12345678:${dueAt.getTime()}`);
  assert.deepEqual(JSON.parse(reminder.payload), {
    referenceId: 'followup_12345678',
    category: 'sales',
    dueAt: dueAt.toISOString()
  });

  test('validates identifiers and timestamps used by reminder deduplication', () => {
    assert.throws(() => buildGrowthCrmDueReminderIdempotencyKey('bad id', new Date()), {
      message: 'GROWTH_CRM_REMINDER_IDENTITY_INVALID'
    });
    assert.throws(() => buildGrowthCrmDueReminderIdempotencyKey('followup_12345678', new Date(Number.NaN)), {
      message: 'GROWTH_CRM_REMINDER_IDENTITY_INVALID'
    });
  });
  assert.equal(isGrowthCrmCategory('sales'), true);
  assert.equal(isGrowthCrmCategory('untrusted'), false);
});

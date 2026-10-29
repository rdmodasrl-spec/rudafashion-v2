import assert from 'node:assert/strict';
import test from 'node:test';
import {
  prepareMarketingEventBackfill,
  validateMarketingEventBackfillDatabaseUrl
} from '../src/server/marketingEventBackfill';

const now = new Date('2026-10-05T12:00:00.000Z');
const baseEvent = {
  event: 'page_view',
  page: 'home',
  source: 'instagram',
  medium: 'social',
  campaign: 'autumn',
  createdAt: '2026-10-04T12:00:00.000Z'
};

test('legacy marketing backfill filters invalid and expired rows and sanitizes tags', () => {
  const result = prepareMarketingEventBackfill([
    baseEvent,
    { ...baseEvent, createdAt: '2026-07-06T11:59:59.999Z' },
    { ...baseEvent, event: 'unknown_event' },
    { ...baseEvent, page: '/home?email=user@example.test' },
    null
  ], now);

  assert.equal(result.records.length, 1);
  assert.equal(result.skipped, 4);
  assert.equal(result.records[0].source, 'instagram');
  assert.equal(result.records[0].createdAt.toISOString(), baseEvent.createdAt);
});

test('legacy marketing backfill produces stable distinct IDs for duplicate events', () => {
  const first = prepareMarketingEventBackfill([baseEvent, baseEvent], now);
  const repeated = prepareMarketingEventBackfill([baseEvent, baseEvent], now);

  assert.equal(first.records[0].id, repeated.records[0].id);
  assert.equal(first.records[1].id, repeated.records[1].id);
  assert.notEqual(first.records[0].id, first.records[1].id);
});

test('legacy marketing backfill strips contact-like campaign tags', () => {
  const result = prepareMarketingEventBackfill([{
    ...baseEvent,
    source: 'agent@example.test',
    medium: '+39 123 456 789',
    campaign: 'promo!2026'
  }], now);

  assert.equal(result.records[0].source, '');
  assert.equal(result.records[0].medium, '');
  assert.equal(result.records[0].campaign, 'promo2026');
});

test('legacy marketing backfill rejects a non-array payload', () => {
  assert.throws(
    () => prepareMarketingEventBackfill({ events: [baseEvent] }, now),
    { message: 'LEGACY_MARKETING_EVENTS_MUST_BE_AN_ARRAY' }
  );
});

test('marketing backfill writes require an explicitly configured loopback test database', () => {
  assert.throws(
    () => validateMarketingEventBackfillDatabaseUrl(undefined),
    { message: 'GROWTH_MARKETING_BACKFILL_DATABASE_URL_REQUIRED' }
  );
  assert.throws(
    () => validateMarketingEventBackfillDatabaseUrl('postgresql://localhost/ruda_prod'),
    { message: 'GROWTH_MARKETING_BACKFILL_DATABASE_MUST_BE_LOOPBACK_TEST_OR_E2E' }
  );
  assert.equal(
    validateMarketingEventBackfillDatabaseUrl('postgresql://localhost/ruda_growth_test'),
    'postgresql://localhost/ruda_growth_test'
  );
});

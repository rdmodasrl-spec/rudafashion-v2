import { createHash } from 'node:crypto';

const eventNames = new Set([
  'page_view',
  'ai_open',
  'ai_question',
  'buyer_registration_view',
  'merchant_application_view'
]);
const pageNames = new Set([
  'home', 'catalog', 'purchase_order', 'orders', 'product_detail', 'showrooms',
  'merchant_store', 'fashion_trends', 'cart', 'checkout', 'account', 'register_wholesale',
  'about', 'requirement_doc', 'merchant_onboarding'
]);
const retentionMs = 90 * 24 * 60 * 60 * 1000;
const maximumEvents = 50_000;

export type MarketingEventBackfillRecord = {
  id: string;
  event: string;
  page: string;
  source: string;
  medium: string;
  campaign: string;
  createdAt: Date;
};

export type MarketingEventBackfillResult = {
  records: MarketingEventBackfillRecord[];
  skipped: number;
};

export function validateMarketingEventBackfillDatabaseUrl(value: string | undefined): string {
  if (!value) throw new Error('GROWTH_MARKETING_BACKFILL_DATABASE_URL_REQUIRED');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('GROWTH_MARKETING_BACKFILL_DATABASE_URL_INVALID');
  }
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol)
    || !loopbackHosts.has(url.hostname)
    || !/(^|[_-])(test|e2e)([_-]|$)/i.test(databaseName)
  ) {
    throw new Error('GROWTH_MARKETING_BACKFILL_DATABASE_MUST_BE_LOOPBACK_TEST_OR_E2E');
  }
  return value;
}

function safeTag(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  const raw = value.trim();
  if (raw.includes('@') || /^\+?[\d\s().-]{8,}$/.test(raw)) return '';
  return raw.replace(/[^a-z0-9_-]/gi, '').slice(0, maxLength);
}

export function prepareMarketingEventBackfill(
  input: unknown,
  now = new Date()
): MarketingEventBackfillResult {
  if (!Array.isArray(input)) throw new Error('LEGACY_MARKETING_EVENTS_MUST_BE_AN_ARRAY');

  const cutoff = now.getTime() - retentionMs;
  const occurrences = new Map<string, number>();
  const valid: Omit<MarketingEventBackfillRecord, 'id'>[] = [];
  let skipped = 0;

  for (const value of input) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      skipped += 1;
      continue;
    }
    const candidate = value as Record<string, unknown>;
    const createdAt = typeof candidate.createdAt === 'string' ? new Date(candidate.createdAt) : new Date(NaN);
    const event = candidate.event;
    const page = typeof candidate.page === 'string' ? candidate.page.trim().slice(0, 80) : '';
    if (
      typeof event !== 'string'
      || !eventNames.has(event)
      || !pageNames.has(page)
      || !Number.isFinite(createdAt.getTime())
      || createdAt.getTime() < cutoff
      || createdAt.getTime() > now.getTime()
    ) {
      skipped += 1;
      continue;
    }
    valid.push({
      event,
      page,
      source: safeTag(candidate.source, 64),
      medium: safeTag(candidate.medium, 64),
      campaign: safeTag(candidate.campaign, 100),
      createdAt
    });
  }

  const retained = valid.slice(-maximumEvents);
  skipped += valid.length - retained.length;
  const records = retained.map(record => {
    const canonical = JSON.stringify({
      event: record.event,
      page: record.page,
      source: record.source,
      medium: record.medium,
      campaign: record.campaign,
      createdAt: record.createdAt.toISOString()
    });
    const occurrence = occurrences.get(canonical) ?? 0;
    occurrences.set(canonical, occurrence + 1);
    const digest = createHash('sha256').update(`${canonical}\n${occurrence}`).digest('hex');
    return { ...record, id: `legacy_marketing_${digest}` };
  });

  return { records, skipped };
}

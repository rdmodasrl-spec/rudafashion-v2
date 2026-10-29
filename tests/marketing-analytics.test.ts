import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getMarketingAnalyticsConsent,
  setMarketingAnalyticsConsent,
  trackMarketingEvent
} from '../src/utils/marketingAnalytics';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value)
  }
});

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    location: {
      origin: 'https://ruda.fashion',
      search: '?utm_source=instagram&utm_medium=social&utm_campaign=autumn'
    }
  }
});

test('analytics events are not sent when the visitor has not opted in', async () => {
  storage.clear();
  let requestCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    requestCount += 1;
    return new Response(JSON.stringify({ success: true }), { status: 202 });
  };
  try {
    assert.equal(getMarketingAnalyticsConsent(), 'unknown');
    await trackMarketingEvent('page_view', 'home');
    assert.equal(requestCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('opted-in analytics contain only the approved event and campaign fields', async () => {
  storage.clear();
  assert.equal(setMarketingAnalyticsConsent('granted'), true);
  let sentBody = '';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    sentBody = String(init?.body || '');
    return new Response(JSON.stringify({ success: true }), { status: 202 });
  };
  try {
    await trackMarketingEvent('ai_question', 'home');
    assert.deepEqual(JSON.parse(sentBody), {
      event: 'ai_question',
      consent: true,
      page: 'home',
      source: 'instagram',
      campaign: 'autumn',
      medium: 'social'
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

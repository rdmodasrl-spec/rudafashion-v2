import assert from 'node:assert/strict';
import test from 'node:test';
import { rememberReferral } from '../src/utils/share';

test('records each referral campaign click while preserving first-touch registration attribution', async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const originalFetch = globalThis.fetch;
  const values = new Map<string, string>();
  const clicks: Array<Record<string, string>> = [];
  let clickNumber = 0;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    }
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      location: {
        search: '',
        pathname: '/landing',
        hash: ''
      }
    }
  });
  globalThis.fetch = async (_input, init) => {
    clicks.push(JSON.parse(String(init?.body)) as Record<string, string>);
    clickNumber += 1;
    return new Response(JSON.stringify({ success: true, clickId: `click-${clickNumber}` }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  const setLandingUrl = (search: string) => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        location: {
          search,
          pathname: '/landing',
          hash: ''
        }
      }
    });
  };
  const waitForClick = () => new Promise(resolve => setTimeout(resolve, 0));

  try {
    setLandingUrl('?ref=AG000001&campaign=instagram');
    rememberReferral();
    await waitForClick();

    setLandingUrl('?ref=AG000002&campaign=whatsapp');
    rememberReferral();
    await waitForClick();

    const firstTouch = JSON.parse(values.get('ruda_partner_referral') || 'null');
    assert.equal(clicks.length, 2);
    assert.deepEqual(
      clicks.map(({ partnerCode, campaignCode }) => [partnerCode, campaignCode]),
      [['AG000001', 'instagram'], ['AG000002', 'whatsapp']]
    );
    assert.equal(firstTouch.partnerCode, 'AG000001');
    assert.equal(firstTouch.campaignCode, 'instagram');
    assert.equal(firstTouch.clickId, 'click-1');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

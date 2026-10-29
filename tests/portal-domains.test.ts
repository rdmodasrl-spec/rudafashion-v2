import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CANONICAL_PORTAL_ORIGINS,
  getMerchantMobileTabForHost,
  getLegacyPortalRedirectHost,
  getPortalZoneForHost,
  PORTAL_DOMAINS
} from '../src/shared/portalDomains';

test('maps only the canonical merchant, admin, and employee domains to portals', () => {
  assert.equal(PORTAL_DOMAINS.public, 'modaui.com');
  assert.equal(PORTAL_DOMAINS.merchant, 'ruda.fashion');
  assert.equal(getPortalZoneForHost(PORTAL_DOMAINS.merchant), 'merchant');
  assert.equal(getPortalZoneForHost(PORTAL_DOMAINS.ai), 'merchant');
  assert.equal(getPortalZoneForHost(PORTAL_DOMAINS.store), 'merchant');
  assert.equal(getPortalZoneForHost(PORTAL_DOMAINS.products), 'merchant');
  assert.equal(getPortalZoneForHost(PORTAL_DOMAINS.inventory), 'merchant');
  assert.equal(getPortalZoneForHost(PORTAL_DOMAINS.orders), 'merchant');
  assert.equal(getPortalZoneForHost(PORTAL_DOMAINS.admin), 'admin');
  assert.equal(getPortalZoneForHost(PORTAL_DOMAINS.employee), 'employee');
  assert.equal(getPortalZoneForHost(PORTAL_DOMAINS.public), null);
  assert.equal(getPortalZoneForHost('ruda.fashion'), 'merchant');
  assert.equal(getPortalZoneForHost('B2B.RUDA.FASHION'), null);
  assert.equal(getPortalZoneForHost('merchant.ruda.fashion'), null);
  assert.equal(getPortalZoneForHost('xs.ruda.fashion'), null);
  assert.equal(getPortalZoneForHost('constructor'), null);
});

test('redirects retired portal domains to their canonical domains', () => {
  assert.equal(getLegacyPortalRedirectHost('www.ruda.fashion'), PORTAL_DOMAINS.public);
  assert.equal(getLegacyPortalRedirectHost('b2b.ruda.fashion'), PORTAL_DOMAINS.merchant);
  assert.equal(getLegacyPortalRedirectHost('www.modaui.com'), PORTAL_DOMAINS.public);
  assert.equal(getLegacyPortalRedirectHost('bos.ruda.fashion'), PORTAL_DOMAINS.merchant);
  assert.equal(getLegacyPortalRedirectHost('vip.ruda.fashion'), PORTAL_DOMAINS.merchant);
  assert.equal(getLegacyPortalRedirectHost('xs.ruda.fashion'), PORTAL_DOMAINS.employee);
  assert.equal(getLegacyPortalRedirectHost('buyer.ruda.fashion'), PORTAL_DOMAINS.public);
  assert.equal(getLegacyPortalRedirectHost('ruda.fashion'), null);
  assert.equal(getLegacyPortalRedirectHost('modagpt.ruda.fashion'), PORTAL_DOMAINS.ai);
  assert.equal(getLegacyPortalRedirectHost('constructor'), null);
});

test('publishes the canonical site, portal, and mobile workspace origins', () => {
  assert.deepEqual(CANONICAL_PORTAL_ORIGINS, [
    'https://modaui.com',
    'https://www.modaui.com',
    'https://ruda.fashion',
    'https://shop.ruda.fashion',
    'https://product.ruda.fashion',
    'https://stock.ruda.fashion',
    'https://ai.ruda.fashion',
    'https://order.ruda.fashion',
    'https://video.ruda.fashion',
    'https://admin.ruda.fashion',
    'https://a.ruda.fashion'
  ]);
});

test('maps each mobile workspace hostname directly to its mobile navigation tab', () => {
  assert.equal(getMerchantMobileTabForHost(PORTAL_DOMAINS.store), 'store');
  assert.equal(getMerchantMobileTabForHost(PORTAL_DOMAINS.products), 'products');
  assert.equal(getMerchantMobileTabForHost(PORTAL_DOMAINS.inventory), 'inventory');
  assert.equal(getMerchantMobileTabForHost(PORTAL_DOMAINS.ai), 'ai_home');
  assert.equal(getMerchantMobileTabForHost(PORTAL_DOMAINS.orders), 'orders');
  assert.equal(getMerchantMobileTabForHost(PORTAL_DOMAINS.merchant), null);
});

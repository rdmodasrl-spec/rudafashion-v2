import assert from 'node:assert/strict';
import test from 'node:test';
import type { MerchantIndustryModuleKey } from '../src/constants/merchantIndustryCapabilities';
import {
  merchantMobileIndustrySectionByTab,
  merchantMobileTabByIndustrySection,
  merchantPortalIndustrySectionByTab,
  merchantPortalTabByIndustrySection,
  shouldRenderIndustryWorkspaceForTab
} from '../src/apps/merchant-admin-industries/shared/legacyNavigation';

const moduleKeys: MerchantIndustryModuleKey[] = [
  'dashboard',
  'products',
  'inventory',
  'orders',
  'customers',
  'suppliers',
  'procurement',
  'pos',
  'pos_sales',
  'pos_shifts',
  'stores',
  'transfers',
  'team',
  'messages',
  'settings'
];

test('all industry sections map into the existing desktop navigation', () => {
  for (const key of moduleKeys) {
    assert.ok(merchantPortalTabByIndustrySection[key], `desktop mapping missing for ${key}`);
  }

  assert.equal(merchantPortalIndustrySectionByTab.sku_matrix, 'products');
  assert.equal(merchantPortalIndustrySectionByTab.vault_requests, 'customers');
  assert.equal(merchantPortalIndustrySectionByTab.growth, undefined);
});

test('all industry sections map into the existing mobile navigation', () => {
  for (const key of moduleKeys) {
    assert.ok(merchantMobileTabByIndustrySection[key], `mobile mapping missing for ${key}`);
  }

  assert.equal(merchantMobileIndustrySectionByTab.profile, 'settings');
  assert.equal(merchantMobileIndustrySectionByTab.ai_home, undefined);
  assert.equal(merchantMobileIndustrySectionByTab.more, undefined);
});

test('all industries use the legacy shared home while industry modules remain available', () => {
  assert.equal(
    shouldRenderIndustryWorkspaceForTab('dashboard', 'dashboard', merchantPortalIndustrySectionByTab),
    false
  );
  assert.equal(
    shouldRenderIndustryWorkspaceForTab('dashboard', 'dashboard', merchantMobileIndustrySectionByTab),
    false
  );
  assert.equal(
    shouldRenderIndustryWorkspaceForTab('products', 'dashboard', merchantPortalIndustrySectionByTab),
    true
  );
  assert.equal(
    shouldRenderIndustryWorkspaceForTab('products', 'dashboard', merchantMobileIndustrySectionByTab),
    true
  );
  assert.equal(
    shouldRenderIndustryWorkspaceForTab('dashboard', 'messages', merchantPortalIndustrySectionByTab),
    true
  );
  assert.equal(
    shouldRenderIndustryWorkspaceForTab('more', 'dashboard', merchantMobileIndustrySectionByTab),
    false
  );
});

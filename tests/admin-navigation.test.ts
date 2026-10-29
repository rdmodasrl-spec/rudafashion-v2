import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ADMIN_AREAS,
  ADMIN_AREA_ITEMS,
  ADMIN_NAV_GROUPS,
  getAdminAreaForTab,
  getAdminNavGroupForTab,
  normalizeAdminTab,
  type AdminTab
} from '../src/apps/platform-admin-common/components/admin/adminNavigation';

test('admin navigation assigns every visible workspace to one of four areas', () => {
  const visibleTabs = ADMIN_NAV_GROUPS.flatMap(group => group.items.map(item => item.key));

  assert.deepEqual(ADMIN_AREAS.map(area => area.label), ['业务管理', '增长运营', '客服中心', '平台管理']);
  assert.deepEqual(ADMIN_NAV_GROUPS.map(group => group.area), ADMIN_AREAS.map(area => area.key));
  assert.equal(ADMIN_NAV_GROUPS.length, 4);
  assert.equal(new Set(visibleTabs).size, visibleTabs.length);

  for (const area of ADMIN_AREAS) {
    assert.match(area.label, /^[\u4e00-\u9fff]{4}$/);
    const items = ADMIN_AREA_ITEMS[area.key];
    assert.ok(items.length > 0, `${area.label} has visible pages`);
    for (const item of items) {
      assert.equal(Array.from(item.label).length, 4, `${item.key} uses a four-character name`);
      assert.match(item.label, /^[\u4e00-\u9fff]{4}$/, `${item.key} has a Chinese four-character label`);
      assert.equal(getAdminAreaForTab(item.key), area.key);
      assert.equal(getAdminNavGroupForTab(item.key)?.area, area.key);
    }
  }
});

test('growth, AI configuration, billing, and appointments have one reachable route each', () => {
  const expectedTabs: AdminTab[] = [
    'overview', 'merchants', 'account_identities', 'customers', 'products', 'vault_requests',
    'orders', 'inventory', 'showrooms', 'appointments', 'pos', 'finance',
    'growth_workbench', 'growth_acquisition', 'growth_content', 'growth_analytics', 'fashion_content',
    'merchant_support', 'support_requests', 'ai_support', 'merchant_support_settings',
    'settings', 'feature_flags', 'ai_center', 'modagpt_operator', 'ai_provider_settings', 'modagpt_billing', 'risk_monitor', 'app_store_mgmt', 'notifications',
    'database_center', 'audit_logs'
  ];
  const visibleTabs = ADMIN_NAV_GROUPS.flatMap(group => group.items.map(item => item.key));

  assert.deepEqual(new Set(visibleTabs), new Set(expectedTabs));
  for (const tab of expectedTabs) {
    assert.equal(visibleTabs.filter(visibleTab => visibleTab === tab).length, 1, `${tab} is registered once`);
    assert.ok(getAdminNavGroupForTab(tab), `${tab} has a navigation group`);
  }
});

test('growth area exposes exactly four operation tools plus fashion design', () => {
  const growthTabs = ADMIN_AREA_ITEMS.growth.map(item => item.key);
  assert.deepEqual(growthTabs, ['growth_workbench', 'growth_acquisition', 'growth_content', 'growth_analytics', 'fashion_content']);
  assert.deepEqual(ADMIN_AREA_ITEMS.growth.map(item => item.label), ['增长总览', '招商获客', '内容推广', '增长数据', '时尚设计']);
});

test('legacy growth links resolve to a single growth tool', () => {
  const aliases: Array<[AdminTab, AdminTab]> = [
    ['growth', 'growth_workbench'],
    ['partners', 'growth_acquisition'],
    ['promotions', 'growth_content'],
    ['marketing_attribution', 'growth_analytics'],
    ['bi_dashboard', 'growth_analytics']
  ];
  for (const [legacy, expected] of aliases) {
    assert.equal(normalizeAdminTab(legacy), expected);
    assert.equal(getAdminNavGroupForTab(legacy)?.area, 'growth');
    assert.equal(getAdminAreaForTab(legacy), 'growth');
  }
});

test('legacy content links resolve to the unified fashion content page', () => {
  for (const tab of ['gallery', 'fashion_community', 'website_collector'] as const) {
    assert.equal(normalizeAdminTab(tab), 'fashion_content');
    assert.equal(getAdminNavGroupForTab(tab)?.area, 'growth');
    assert.equal(getAdminAreaForTab(tab), 'growth');
  }
});

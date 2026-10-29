import assert from 'node:assert/strict';
import test from 'node:test';
import {
  merchantMobileMoreGroups,
  merchantMobilePrimaryTabs
} from '../src/apps/merchant-admin-common/components/merchant/merchantMobileNavigation';
import { UI_COPY_CATALOG } from '../src/i18n/uiCopyCatalog';

test('merchant mobile navigation keeps five primary destinations with ModaUI in the center', () => {
  assert.deepEqual(
    merchantMobilePrimaryTabs.map(tab => tab.id),
    ['dashboard', 'products', 'ai_home', 'orders', 'more']
  );
  assert.deepEqual(merchantMobilePrimaryTabs.map(tab => tab.zh), ['首页', '商品', 'ModaUI', '订单', '更多']);
  assert.equal(merchantMobilePrimaryTabs[2]!.id, 'ai_home');
  assert.equal(merchantMobilePrimaryTabs[2]!.zh, 'ModaUI');
  assert.equal(merchantMobilePrimaryTabs[2]!.it, 'ModaUI');
});

test('merchant mobile navigation uses consistent four-character titles and eight-character descriptions', () => {
  const labels = merchantMobileMoreGroups.flatMap(group => [group.zh, ...group.items.map(item => item.zh)]);
  const descriptions = merchantMobileMoreGroups.flatMap(group =>
    group.items.map(item => item.descriptionZh)
  );

  assert.ok(labels.every(label => [...label].length === 4));
  assert.ok(descriptions.every(description => [...description].length <= 8));
});

test('merchant mobile more menu keeps secondary tools reachable by category', () => {
  const items = merchantMobileMoreGroups.flatMap(group => group.items.map(item => item.id));
  assert.equal(merchantMobilePrimaryTabs.filter(tab => tab.id === 'ai_home').length, 1);
  assert.equal(items.includes('ai_home' as (typeof items)[number]), false);
  assert.equal(new Set(items).size, items.length);
  for (const item of [
    'materials', 'procurement', 'production', 'counterparties', 'vault',
    'finance', 'growth', 'inventory', 'store', 'domains', 'site_content', 'media',
    'ai_employees', 'team', 'notifications', 'settings', 'support', 'privacy'
  ]) {
    assert.ok(items.includes(item as (typeof items)[number]), `${item} is reachable from More`);
  }
  assert.equal(items.filter(item => item === 'counterparties').length, 1);
  assert.equal(items.includes('customers' as (typeof items)[number]), false);
  assert.equal(items.filter(item => item === 'support').length, 1);
  assert.equal(items.filter(item => item === 'privacy').length, 1);
});

test('merchant mobile navigation labels are available in the UI copy catalog', () => {
  const labels = [
    ...merchantMobilePrimaryTabs,
    ...merchantMobileMoreGroups.flatMap(group => [
      group,
      ...group.items.flatMap(item => [
        { zh: item.zh, it: item.it },
        { zh: item.descriptionZh, it: item.descriptionIt }
      ])
    ])
  ];
  for (const { zh, it } of labels) {
    assert.ok(
      UI_COPY_CATALOG.some(copy => copy.zh === zh && copy.it === it),
      `Missing translation catalog entry for ${zh}`
    );
  }
});

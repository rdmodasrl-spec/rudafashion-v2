import assert from 'node:assert/strict';
import test from 'node:test';
import { isMerchantMobileDefaultTab, merchantMobileDefaultTabs } from '../src/shared/merchantMobileSettings';

test('merchant mobile default tabs include every configurable merchant workspace', () => {
  assert.deepEqual(merchantMobileDefaultTabs, [
    'dashboard',
    'products',
    'orders',
    'inventory',
    'customers',
    'store',
    'profile',
    'finance',
    'growth',
    'production',
    'procurement',
    'content'
  ]);
  for (const tab of merchantMobileDefaultTabs) assert.equal(isMerchantMobileDefaultTab(tab), true);
});

test('merchant mobile default tab validation rejects non-workspace routes', () => {
  for (const value of [null, undefined, '', 'ai_home', 'pos', 'new_styles', 'admin']) {
    assert.equal(isMerchantMobileDefaultTab(value), false);
  }
});

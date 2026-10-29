import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDemoProducts } from '../scripts/seed-miniprogram-demo-employee.js';
import {
  getMiniProgramDemoAccountIds,
  isIsolatedMiniProgramDemoMerchant,
  MINI_PROGRAM_DEMO_ACCOUNTS,
  PUBLIC_DEMO_MERCHANT_MARKER
} from '../src/server/miniprogramDemo.js';

test('mini program demo seed creates several stocked products scoped to its merchant', () => {
  const products = buildDemoProducts('test-merchant-1', 'Test Merchant');

  assert.equal(products.length, 3);
  assert.ok(products.every(product => product.merchantId === 'test-merchant-1'));
  assert.ok(products.every(product => product.name.startsWith('【RUDA小程序演示】')));
  assert.ok(products.every(product => product.lifecycleStatus === 'published'));
  assert.ok(products.every(product => product.skus.length > 0 && product.sku.stockCentral > 0));
  assert.equal(new Set(products.map(product => product.styleNo)).size, 3);
});

test('mini program demo credentials require a marked, isolated demo merchant', () => {
  const merchant = {
    id: 'ruda-demo-merchant-03',
    code: 'RUDA-DEMO-03',
    storeSlug: 'ruda-demo-03',
    industrySource: 'ADMIN',
    settings: JSON.stringify({ rudaDemoSeed: PUBLIC_DEMO_MERCHANT_MARKER }),
    storefrontSeoTitle: 'RUDA DEMO · Atelier Alba'
  };

  assert.equal(isIsolatedMiniProgramDemoMerchant(merchant), true);
  assert.equal(isIsolatedMiniProgramDemoMerchant({ ...merchant, id: 'real-merchant' }), false);
  assert.equal(isIsolatedMiniProgramDemoMerchant({ ...merchant, settings: '{}' }), false);
});

test('mini program demo provides distinct merchant, employee, and partner accounts', () => {
  const ids = getMiniProgramDemoAccountIds('ruda-demo-merchant-03');
  const emails = Object.values(MINI_PROGRAM_DEMO_ACCOUNTS).map(account => account.email);

  assert.equal(new Set(emails).size, 3);
  assert.equal(ids.partnerCode.startsWith('AG'), true);
  assert.equal(ids.partnerId.startsWith('ruda-mini-demo-partner-'), true);
});

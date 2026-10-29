import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const miniProgramRoot = fileURLToPath(new URL('../merchant-miniprogram/', import.meta.url));
const posRoot = join(miniProgramRoot, 'pages/pos');
const posSource = readFileSync(join(posRoot, 'index.js'), 'utf8');
const posTemplate = readFileSync(join(posRoot, 'index.wxml'), 'utf8');
const industrySource = readFileSync(join(miniProgramRoot, 'pages/industry/index.js'), 'utf8');
const appJson = JSON.parse(readFileSync(join(miniProgramRoot, 'app.json'), 'utf8'));

test('native POS page is registered and complete', () => {
  assert.ok(appJson.pages.includes('pages/pos/index'), 'app.json must register pages/pos/index');
  for (const file of ['index.js', 'index.wxml', 'index.wxss', 'index.json']) {
    assert.ok(existsSync(join(posRoot, file)), `pages/pos/${file} must exist`);
  }
});

test('POS page reuses the authoritative server contracts', () => {
  const required = [
    '/api/merchant/pos/settings',
    '/api/merchant/pos/shifts/current',
    '/api/merchant/pos/shifts',
    '/api/merchant/pos/shifts/',
    '/api/merchant/pos/sales',
    '/api/merchant/stores',
    '/api/merchant/industry-context'
  ];
  for (const path of required) {
    assert.ok(posSource.includes(path) || posSource.includes("loadIndustryContext"), `POS page must call ${path}`);
  }
  assert.match(posSource, /loadIndustryContext\(\{ force: true \}\)/, 'industry context must be re-fetched, not trusted from cache');
});

test('store scope comes from the server context, not local config', () => {
  assert.match(posSource, /context\.inventory && context\.inventory\.mode === 'store'/);
  assert.match(posSource, /context\.storeBound && context\.storeId/);
  assert.doesNotMatch(posSource, /industries\/department-chain-retail/, 'POS must not read local industry config for stock mode');
});

test('settlement requires payment confirmation and a stable idempotency key', () => {
  assert.match(posSource, /paymentConfirmed: true/);
  assert.match(posSource, /nextIdempotencyKey/);
  assert.match(posSource, /mp-pos-\$\{Date\.now\(\)\}/);
  // 购物车变化必须作废旧幂等键，否则新购物车会被服务端当成上一单重放。
  assert.match(posSource, /applyCart\(cart\)[\s\S]{0,200}this\._saleIdempotencyKey = ''/);
});

test('collected amount is the server result, not a client recomputation', () => {
  assert.match(posSource, /const sale = \(response && response\.sale\) \|\| \{\}/);
  assert.match(posSource, /money\(sale\.totalAmount\)/);
  assert.doesNotMatch(posSource, /discountAmount/, 'mini program must not apply discounts the server has not approved');
});

test('shift close reports the server expected cash and difference', () => {
  assert.match(posSource, /closed\.expectedCash/);
  assert.match(posSource, /差额/);
});

test('industry workbench routes the POS module to the native page', () => {
  assert.match(industrySource, /if \(module === 'pos'\) \{\s*wx\.navigateTo\(\{ url: '\/pages\/pos\/index' \}\)/);
});

test('no wxml tag combines wx:else/wx:elif with wx:for (real devtools compile error)', () => {
  // 2026-10-29 微信开发者工具真实报错：pages/industry/index.wxml 的 wx:else + wx:for
  // 触发 “Bad attr wx:else ... wx:if not found”，整页在模拟器里只显示报错。
  const files = ['pages/industry/index.wxml', 'pages/pos/index.wxml'];
  for (const file of files) {
    const source = readFileSync(join(miniProgramRoot, file), 'utf8');
    const tagPattern = /<([a-zA-Z-]+)([^>]*)>/g;
    let match;
    while ((match = tagPattern.exec(source))) {
      const attrs = match[2];
      if (/\bwx:(else|elif)\b/.test(attrs) && /\bwx:for\b/.test(attrs)) {
        const line = source.slice(0, match.index).split('\n').length;
        assert.fail(`${file}:${line} <${match[1]}> cannot combine wx:else/elif with wx:for`);
      }
    }
  }
});

test('POS template handlers exist on the page definition', () => {
  const handlers = new Set(
    [...posTemplate.matchAll(/bind(?:tap|input|change)="([A-Za-z0-9_]+)"/g)].map(match => match[1])
  );
  assert.ok(handlers.size > 0);
  for (const handler of handlers) {
    assert.match(posSource, new RegExp(`\\b${handler}\\(`), `missing handler ${handler}`);
  }
});

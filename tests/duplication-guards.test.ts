import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');

function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

test('merchant mobile product list shows the total product count once', () => {
  const mobile = source('src/apps/merchant-admin-mobile/MerchantMobileApp.tsx');
  const start = mobile.indexOf("{activeTab === 'products' && (");
  const end = mobile.indexOf("{activeTab === 'inventory' && (", start);
  assert.ok(start > -1 && end > start, 'merchant mobile product workspace is present');

  const productWorkspace = mobile.slice(start, end);
  assert.equal(
    productWorkspace.match(/productQuickFilterCounts\[filter\]/g)?.length ?? 0,
    1,
    'only the active filter chip owns the total product count'
  );
  assert.equal(
    productWorkspace.match(/merchantProducts\.length(?!\s*===)/g)?.length ?? 0,
    0,
    'the product workspace must read the precomputed counts instead of recomputing totals inline'
  );
  assert.equal(
    mobile.match(/countMerchantProductQuickFilters\(merchantProducts(?:,\s*\{[^}]*\})?\)/g)?.length ?? 0,
    1,
    'the permission-scoped total is computed exactly once'
  );
  assert.equal(
    source('src/shared/merchantProductBrowse.ts').match(/all: products\.length,/g)?.length ?? 0,
    1,
    'the shared browse rules own the single total-count definition'
  );
  assert.doesNotMatch(productWorkspace, /\[['"]商品['"],\s*merchantProducts\.length\]/, 'no duplicate product stat');
  assert.doesNotMatch(productWorkspace, /共 \{visibleProducts\.length\} 件商品/, 'no duplicate unfiltered result count');
});

test('merchant mobile product quick filters and business zones stay separate layers', () => {
  const mobile = source('src/apps/merchant-admin-mobile/MerchantMobileApp.tsx');
  const start = mobile.indexOf("{activeTab === 'products' && (");
  const end = mobile.indexOf("{activeTab === 'inventory' && (", start);
  const productWorkspace = mobile.slice(start, end);

  assert.match(productWorkspace, /setProductQuickFilter\(filter\)/, 'quick filters own their own state');
  assert.match(productWorkspace, /setProductZoneFilter\(zone\)/, 'business zones own their own state');
  assert.doesNotMatch(productWorkspace, /setProductQuickFilter\([^)]*zone/, 'quick filters never write the zone state');
  assert.doesNotMatch(productWorkspace, /setProductZoneFilter\([^)]*filter/, 'business zones never write the quick-filter state');
  assert.doesNotMatch(productWorkspace, /['"]unlisted['"]/, 'legacy lifecycle filter values are removed');
  assert.doesNotMatch(productWorkspace, /setProductFilter\b/, 'legacy lifecycle filter state is removed');
  assert.match(productWorkspace, /sticky top-0/, 'the list header stays fixed while the list scrolls');

  const quickFilterStart = productWorkspace.indexOf("aria-label={mobileText('快捷筛选'");
  const quickFilterEnd = productWorkspace.indexOf("aria-label={mobileText('商品分区'", quickFilterStart);
  assert.ok(quickFilterStart > -1 && quickFilterEnd > quickFilterStart, 'quick filter row is present');
  const quickFilterRow = productWorkspace.slice(quickFilterStart, quickFilterEnd);
  for (const filter of ["'all'", "'low_stock'", "'new_arrival'", "'sold'"]) {
    assert.match(quickFilterRow, new RegExp(`filter: ${filter}`), `quick filter ${filter} is a real entry`);
  }
  assert.match(quickFilterRow, /<button/, 'every quick filter is a clickable button');
  assert.doesNotMatch(quickFilterRow, /productEditUnlocked|setProductEditUnlocked/, 'the edit lock stays out of the quick filter row');
});

test('merchant mobile dashboard lists pending orders once', () => {
  const mobile = source('src/apps/merchant-admin-mobile/MerchantMobileApp.tsx');
  const start = mobile.indexOf("{activeTab === 'dashboard' && (");
  const end = mobile.indexOf("{activeTab === 'products' && (", start);
  assert.ok(start > -1 && end > start, 'merchant mobile dashboard is present');

  const dashboard = mobile.slice(start, end);
  assert.equal(
    dashboard.match(/待处理订单/g)?.length ?? 0,
    1,
    'dashboard keeps the pending-order metric only in the top stat row'
  );
});

test('merchant web dashboard does not ship the hidden legacy duplicate panels', () => {
  const portal = source('src/apps/merchant-admin-web/MerchantPortal.tsx');
  assert.doesNotMatch(portal, /<div className="hidden">\s*\{operationsIntelligence && \(/, 'hidden legacy analytics block is removed');
});

test('production overview keeps numeric badges off the summary tab', () => {
  const production = source('src/apps/merchant-admin-common/components/merchant/ProductionChain.tsx');
  assert.match(production, /badge: tab === 'home' \? undefined : summary\?\.openOrders/);
  assert.match(production, /badge: tab === 'home' \? undefined : summary\?\.pendingStatements/);
});

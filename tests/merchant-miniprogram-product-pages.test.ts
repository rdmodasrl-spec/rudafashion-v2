import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const require = createRequire(import.meta.url);
const productCategories = require('../merchant-miniprogram/utils/product-categories.js');

const listSource = readFileSync(new URL('../merchant-miniprogram/pages/products/index.js', import.meta.url), 'utf8');
const listMarkup = readFileSync(new URL('../merchant-miniprogram/pages/products/index.wxml', import.meta.url), 'utf8');
const detailMarkup = readFileSync(new URL('../merchant-miniprogram/pages/product-detail/index.wxml', import.meta.url), 'utf8');
const detailStyles = readFileSync(new URL('../merchant-miniprogram/pages/product-detail/index.wxss', import.meta.url), 'utf8');

function createProductListPage(options: {
  request?: (path: string) => Promise<Record<string, any>>;
  auth?: Record<string, any> | null;
} = {}) {
  let definition: Record<string, any> | undefined;
  runInNewContext(listSource, {
    Page: (page: Record<string, any>) => { definition = page; },
    require: (specifier: string) => {
      if (specifier === '../../utils/api') return { request: options.request || (async () => ({})), getAssetUrl: (value: string) => value };
      if (specifier === '../../utils/page-auth') return { requireMerchantSession: async () => options.auth || null };
      if (specifier === '../../utils/permissions') return { canAccessPermissions: () => true, canAccessTab: () => true, canAccessWorkspace: () => false };
      if (specifier === '../../utils/inventory') return { loadMerchantInventoryBalances: async () => [] };
      if (specifier === '../../utils/tabbar') return { syncTabBar: () => undefined };
      if (specifier === '../../utils/product-categories') return productCategories;
      throw new Error(`Unexpected module: ${specifier}`);
    },
    wx: {},
    console,
    setTimeout,
    clearTimeout
  });
  assert.ok(definition);
  return Object.assign({}, definition, {
    data: JSON.parse(JSON.stringify(definition.data)),
    setData(update: Record<string, unknown>) {
      Object.assign(this.data, update);
    }
  });
}

test('product list remains visible when category loading fails', async () => {
  const page = createProductListPage({
    auth: {
      session: { role: 'merchant' },
      response: { merchant: { storeSlug: 'test-store' } }
    },
    request: async path => {
      if (path === '/api/merchant/products') {
        return {
          products: [{
            id: 'product-1',
            name: 'Jacket',
            styleNo: 'RD-1',
            lifecycleStatus: 'published',
            wholesalePrice: 40,
            skus: []
          }]
        };
      }
      if (path === '/api/merchant/store-categories') throw new Error('category service unavailable');
      throw new Error(`Unexpected request: ${path}`);
    }
  });

  await page.loadProducts();

  assert.equal(page.data.products.length, 1, page.data.error || page.data.categoryLoadError);
  assert.equal(page.data.visibleProducts.length, 1);
  assert.equal(page.data.categoryLoadError, 'category service unavailable');
  assert.equal(page.data.error, '');
});

test('mini program product list mirrors the mobile app filters and compact row actions', () => {
  const page = createProductListPage();
  page.data.products = [
    { id: 'live', name: 'Jacket', styleNo: 'RD-1', lifecycleStatus: 'published', wholesalePrice: 40, stockQuantity: 5, moq: 2, images: ['coat.jpg'], skus: [{ sku: 'RD-1-BLK-M', color: 'Black', size: 'M' }] },
    { id: 'draft', name: 'Trouser', styleNo: 'RD-2', lifecycleStatus: 'draft', wholesalePrice: 25, stockQuantity: 0, moq: 1, images: [], skus: [] }
  ];
  page.data.canViewStock = true;
  page.data.filter = 'published';
  page.applyFilter();
  assert.deepEqual(page.data.visibleProducts.map((product: { id: string }) => product.id), ['live']);

  page.data.filter = 'all';
  page.data.extraFilter = 'low_stock';
  page.applyFilter();
  assert.deepEqual(page.data.visibleProducts.map((product: { id: string }) => product.id), ['draft']);

  for (const section of ['筛选 / 排序', '批量选择', '最低价', '商品分类', '编辑商品', '复制商品', '分享商品', '归档商品']) {
    assert.ok(listMarkup.includes(section), `missing mobile app product-list section/action: ${section}`);
  }
});

test('product search is the first section and its add icon uses the existing upload action', () => {
  const searchStart = listMarkup.indexOf('class="search-container"');
  const summaryStart = listMarkup.indexOf('class="mobile-summary-card product-summary-card"');

  assert.ok(searchStart >= 0 && searchStart < summaryStart, 'search must appear before product summary');
  assert.match(listMarkup, /class="search-heading-title">智能搜款</);
  assert.match(listMarkup, /款号 · 名称 · SKU · 条码/);
  assert.match(listMarkup, /wx:if="\{\{canManageProducts\}\}" class="search-add-btn"[^>]*catchtap="createProduct"/);
  assert.match(listMarkup, /class="search-add-icon" src="\/assets\/icons\/plus_light\.png"/);
});

test('mini program product detail includes the mobile app price, variant, media, share and edit sections', () => {
  for (const section of ['detail-price-grid', 'detail-color-size', 'displaySkus', 'detail-gallery', '发送整个商品', '编辑']) {
    assert.ok(detailMarkup.includes(section), `missing mobile app product-detail section/action: ${section}`);
  }
  assert.match(detailMarkup, /class="detail-edit ui-button ui-button--primary"/);
  assert.match(detailMarkup, /class="detail-share ui-button ui-button--secondary"/);
  assert.doesNotMatch(detailStyles, /#(?:b99a5d|806b42|d9c9a6|f5f0e4|f8f6f0)/i);
});

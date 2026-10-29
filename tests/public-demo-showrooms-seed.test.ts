import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDemoProducts,
  DEMO_BUYER_EMAIL,
  DEMO_EMPLOYEE_EMAILS,
  DEMO_SHOWROOMS
} from '../scripts/seed-public-demo-showrooms.js';

test('public demo seed contains ten stores across all supported industries', () => {
  assert.equal(DEMO_SHOWROOMS.length, 10);
  assert.deepEqual(
    [...new Set(DEMO_SHOWROOMS.map(showroom => showroom.industry))].sort(),
    ['DEPARTMENT_STORE', 'FASHION_COMPANY', 'LEATHER_GOODS', 'RESTAURANT', 'RETAIL_STORE', 'TRADING_COMPANY'].sort()
  );
});

test('public demo seed assigns ten store managers and the separate buyer account', () => {
  assert.deepEqual(DEMO_EMPLOYEE_EMAILS, [
    '03@ruda.fashion', '04@ruda.fashion', '05@ruda.fashion', '06@ruda.fashion', '07@ruda.fashion',
    '08@ruda.fashion', '09@ruda.fashion', '10@ruda.fashion', '11@ruda.fashion', '12@ruda.fashion'
  ]);
  assert.equal(DEMO_BUYER_EMAIL, '13@ruda.fashion');
});

test('each fashion company has public, verified and discounted products', () => {
  const products = buildDemoProducts();

  assert.equal(products.length, 23);
  for (const number of ['03', '04', '05']) {
    const storeProducts = products.filter(product => product.merchantId === `ruda-demo-merchant-${number}`);
    const publicProduct = storeProducts.find(product => product.visibility === 'public' && !product.featuredOnSale);
    const verifiedProduct = storeProducts.find(product => product.visibility === 'wholesale');
    const discountedProduct = storeProducts.find(product => product.featuredOnSale);

    assert.equal(storeProducts.length, 3);
    assert.ok(publicProduct);
    assert.ok(verifiedProduct);
    assert.ok(discountedProduct);
    assert.equal(discountedProduct.status, 'clearance');
    assert.ok(discountedProduct.wholesalePrice < publicProduct.wholesalePrice);
  }
});

test('public demo seed gives each product a three-image gallery and zero sellable stock', () => {
  const products = buildDemoProducts();

  assert.equal(products.length, 23);
  assert.equal(new Set(products.map(product => product.id)).size, 23);
  for (const product of products) {
    assert.equal(product.lifecycleStatus, 'published');
    assert.equal(product.isExclusiveProtected, false);
    assert.equal(product.inventoryStatus, 'coming_soon');
    assert.equal(JSON.parse(product.skus)[0].stockCentral, 0);
    const images = JSON.parse(product.images);
    const media = JSON.parse(product.media);
    assert.equal(images.length, 3);
    assert.equal(media.length, 3);
    // Demo media is served from the current public frontend domain; b2b.ruda.fashion is a legacy alias that redirects.
    assert.ok(images.every((image: string) => /^https:\/\/modaui\.com\/demo-products\/[\w-]+\.jpg$/.test(image)));
    assert.match(product.name_zh, /^【演示商品】/);
    assert.match(product.description_zh, /不可实际采购或履约/);
  }
});

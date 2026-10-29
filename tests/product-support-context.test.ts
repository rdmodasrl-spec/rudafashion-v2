import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createProductSupportTicketPrefill } from '../src/shared/productSupportContext';

test('product support prefill includes product, style, and exact selected SKU quantities', () => {
  const prefill = createProductSupportTicketPrefill({
    productId: 'product-42',
    productName: 'Linen Jacket',
    styleNo: 'JKT-042',
    selectedSkus: [
      { sku: 'JKT-042-BLK-S', color: 'Black', size: 'S', quantity: 2 },
      { sku: 'JKT-042-RED-M', color: 'Red', size: 'M', quantity: 1 }
    ]
  });

  assert.match(prefill.subject, /Linen Jacket/);
  assert.match(prefill.subject, /JKT-042/);
  assert.match(prefill.message, /product-42/);
  assert.match(prefill.message, /JKT-042-BLK-S × 2/);
  assert.match(prefill.message, /JKT-042-RED-M × 1/);
});

test('support widget opens the human ticket tab with context while preserving ticket submission rules', () => {
  const widget = readFileSync(new URL('../src/apps/shared/components/common/PlatformSupportWidget.tsx', import.meta.url), 'utf8');
  assert.match(widget, /setActiveTab\('ticket'\)/);
  assert.match(widget, /createProductSupportTicketPrefill\(detail\)/);
  assert.match(widget, /if \(!ticket\.email\.trim\(\) && !ticket\.phone\.trim\(\)\)/);
  assert.match(widget, /apiPost\('\/api\/support-requests'/);
});

test('responsive product detail uses the three fixed actions and supports backorder quantity entry', () => {
  const detail = readFileSync(new URL('../src/apps/shared/components/frontend/ProductDetailView.tsx', import.meta.url), 'utf8');
  assert.equal((detail.match(/onClick=\{openProductSupport\}/g) || []).length, 2);
  assert.doesNotMatch(detail, /handleReserveSelection|预订/);
  assert.equal((detail.match(/onClick={handleOrderAndOpenCart}|onClick={handleBatchOrderAndOpenCart}/g) || []).length, 2);
  assert.equal((detail.match(/ShoppingCart className/g) || []).length, 2);
  assert.equal((detail.match(/space-y-3 lg:hidden/g) || []).length, 2);
  assert.match(detail, /全车 \{\{RUDA_ARG_0\}\} 件/);
  assert.match(detail, /sku\.allowBackorder !== false/);
  assert.match(detail, /setCurrentView\('checkout'\)/);
});

test('mobile product view starts with one SKU-backed color and collapses the other color groups', () => {
  const detail = readFileSync(new URL('../src/apps/shared/components/frontend/ProductDetailView.tsx', import.meta.url), 'utf8');
  const miniTemplate = readFileSync(new URL('../miniprogram/pages/product/index.wxml', import.meta.url), 'utf8');
  const miniPage = readFileSync(new URL('../miniprogram/pages/product/index.js', import.meta.url), 'utf8');

  assert.match(detail, /colorSelectionByProduct\[product\.id\] \?\? allProductColors\.slice\(0, 1\)/);
  assert.equal((detail.match(/<details key=\{colorOption\.color\} open=\{colorIndex === 0\}/g) || []).length, 2);
  assert.match(detail, /getLocalizedSizeLabel\(sku\.size\)/);
  assert.match(miniPage, /initialColors\.slice\(0, 1\)/);
  assert.match(miniPage, /const colorSizes = \[\.\.\.new Set\(colorSkus\.map/);
  assert.match(miniTemplate, /expandedColor === item\.color/);
  assert.doesNotMatch(miniTemplate, /颜色尺码可混批|工坊 \{\{product\.brand/);
});

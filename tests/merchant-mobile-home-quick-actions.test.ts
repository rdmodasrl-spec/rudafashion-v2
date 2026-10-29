import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { UI_COPY_CATALOG } from '../src/i18n/uiCopyCatalog';
import { merchantStorefrontUrl } from '../src/shared/merchantStoreUrl';

const root = path.resolve(import.meta.dirname, '..');

function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const mobile = source('src/apps/merchant-admin-mobile/MerchantMobileApp.tsx');
const orderWorkspace = source('src/apps/merchant-admin-mobile/MerchantMobileOrderWorkspace.tsx');

function homeQuickActions() {
  const start = mobile.indexOf('ruda-home-action-grid');
  const end = mobile.indexOf("activeTab === 'inventory' || activeTab === 'customers'", start);
  assert.ok(start > -1 && end > start, 'merchant mobile home quick action row is present');
  return mobile.slice(start, end);
}


test('merchant mobile home quick actions stay one compact five-column row', () => {
  const quickActions = homeQuickActions();
  assert.match(quickActions, /ruda-home-action-grid grid grid-cols-5 gap-1\.5/, 'the five entries share a single row');
  assert.doesNotMatch(quickActions, /grid-cols-(?:2|3|6)\b/, 'the quick action row must not wrap into multiple rows');
  assert.match(quickActions, /min-h-\[62px\]/, 'the compact entries keep a 62px minimum height');
  assert.doesNotMatch(quickActions, /min-h-\[82px\]/, 'the old large card height must be gone');
  assert.match(quickActions, /h-8 w-8 place-items-center rounded-lg/, 'icons use the compact 32px tile');
  assert.match(quickActions, /text-\[10px\] font-medium/, 'labels use the compact 10px label size');

  const labels = Array.from(quickActions.matchAll(/label: mobileText\('([^']+)', '([^']+)'\)/g)).map(match => match[1]);
  assert.deepEqual(labels, ['开单', '网站', '客户', '库存', '新增'], 'the five entries keep the fixed business order');
});

test('开单 reuses the existing POS sales screen and leaves it back to the home tab', () => {
  const quickActions = homeQuickActions();
  assert.match(
    quickActions,
    /label: mobileText\('开单'[^}]*action: \(\) => \{ setPosReturnTab\('dashboard'\); setActiveTab\('pos'\); \}/,
    '开单 opens the existing POS sales screen instead of the order list'
  );
  assert.doesNotMatch(quickActions, /label: mobileText\('开单'[^}]*setActiveTab\('orders'\)/, '开单 must not jump to the order list');
  assert.doesNotMatch(quickActions, /label: mobileText\('开单'[^}]*openCreateOrderRequest/, '开单 must not re-implement the create-order chooser');

  const posBlock = mobile.slice(mobile.indexOf("activeTab === 'pos' && currentMerchant"), mobile.indexOf("activeTab === 'dashboard' && ("));
  assert.ok(posBlock.length > 0, 'the POS workspace block is present');
  assert.match(posBlock, /onClick=\{\(\) => setActiveTab\(posReturnTab\)\}/, 'the POS back button returns to the tab that opened it');
  assert.match(mobile, /const \[posReturnTab, setPosReturnTab\] = useState<'dashboard' \| 'orders'>\('orders'\)/, 'POS keeps the existing order-tab return as the default');
  assert.match(mobile, /onOpenPos=\{\(\) => \{ setPosReturnTab\('orders'\); setActiveTab\('pos'\); \}\}/, 'the order workspace still opens POS with the order-tab return');
});

test('网站 opens the merchant real storefront domain in a new tab', () => {
  const quickActions = homeQuickActions();
  assert.match(quickActions, /label: mobileText\('网站'[^}]*href: merchantStoreHref \?\? undefined/, '网站 is bound to the real storefront address');
  assert.match(quickActions, /<a key=\{item\.label\} href=\{item\.href\} target="_blank" rel="noopener noreferrer"/, 'the storefront opens in a new tab');
  assert.match(
    mobile,
    /const merchantStoreHref = currentMerchant\?\.storeSlug\s*\n\s*\? merchantStorefrontUrl\(currentMerchant\.storeSlug, mobileItalian \? 'it' : 'zh'\)\s*\n\s*: null;/,
    'the storefront address comes from the assigned storeSlug, not a hardcoded or mock domain'
  );
  assert.doesNotMatch(mobile, /merchantStoreHref = .*https?:\/\//, 'no hardcoded domain is used for the storefront entry');
  assert.equal(merchantStorefrontUrl('sky-blue-societa', 'it'), 'https://sky-blue-societa.ruda.fashion/it/');
  assert.equal(merchantStorefrontUrl('sky-blue-societa', 'zh'), 'https://sky-blue-societa.ruda.fashion/zh/');
});

test('客户、库存、新增 reuse existing pages and keep the order tab', () => {
  const quickActions = homeQuickActions();
  assert.match(quickActions, /label: mobileText\('客户'[^}]*action: \(\) => setActiveTab\('customers'\)/, '客户 opens the existing customer workspace');
  assert.match(quickActions, /label: mobileText\('库存'[^}]*action: \(\) => setActiveTab\('inventory'\)/, '库存 opens the existing inventory workspace');
  assert.match(quickActions, /label: mobileText\('新增'[^}]*action: \(\) => void beginMobileProductCreation\('quick'\)/, '新增 reuses the shared product creation entry');
  assert.doesNotMatch(mobile, /showNewProductDialog/, 'the dead new-product dialog state must not come back');
  assert.doesNotMatch(mobile, /openOrderCreateRequest|setOpenOrderCreateRequest/, 'the temporary create-order request plumbing is removed');
  assert.doesNotMatch(orderWorkspace, /openCreateOrderRequest|onCreateOrderRequestHandled/, 'the order workspace keeps its own create chooser without extra props');
  assert.match(orderWorkspace, /setShowCreateChoices\(true\)/, 'the existing order create chooser stays available from the order workspace');
  assert.match(mobile, /orders: Truck/, 'the bottom navigation order entry is not renamed or removed');
});

test('home quick action copy is approved for localization', () => {
  const expected = [
    ['快捷入口', 'Azioni rapide'],
    ['开单', 'Ordine'],
    ['网站', 'Sito'],
    ['客户', 'Clienti'],
    ['库存', 'Scorte'],
    ['新增', 'Nuovo']
  ];
  for (const [zh, it] of expected) {
    assert.ok(UI_COPY_CATALOG.some(copy => copy.zh === zh && copy.it === it), `${zh} / ${it} is missing from the shared catalog`);
  }
});

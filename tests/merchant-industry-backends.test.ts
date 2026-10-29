import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { merchantIndustryTemplates, openMerchantIndustryTemplates } from '../src/constants/merchantIndustryTemplates';
import {
  getMerchantIndustryAttributeKeys,
  getMerchantIndustryCapability,
  isMerchantIndustryModuleEnabled,
  merchantIndustryCapabilities
} from '../src/constants/merchantIndustryCapabilities';
import {
  canTransitionStoreTransfer,
  normalizePosCart,
  normalizeStoreInput,
  resolvePosUnitPrice
} from '../src/server/merchantIndustryStore';
import { industryWorkspaceModules } from '../src/apps/merchant-admin-industries/registry';
import { apparelWholesaleManifest } from '../src/apps/merchant-admin-industries/apparel-wholesale/manifest';
import { tradingWholesaleManifest } from '../src/apps/merchant-admin-industries/trading-wholesale/manifest';
import { departmentWholesaleManifest } from '../src/apps/merchant-admin-industries/department-wholesale/manifest';
import { bagsWholesaleManifest } from '../src/apps/merchant-admin-industries/bags-wholesale/manifest';
import { generalRetailManifest } from '../src/apps/merchant-admin-industries/general-retail/manifest';
import { departmentChainRetailManifest } from '../src/apps/merchant-admin-industries/department-chain-retail/manifest';

const root = process.cwd();
const industriesRoot = path.join(root, 'src', 'apps', 'merchant-admin-industries');
const serverSource = readFileSync(path.join(root, 'server.ts'), 'utf8');
const schemaSource = readFileSync(path.join(root, 'prisma', 'schema.prisma'), 'utf8');
const migrationSource = readFileSync(
  path.join(root, 'prisma', 'migrations', '20261028120000_merchant_industry_stores_pos', 'migration.sql'),
  'utf8'
);
const moduleSpec = readFileSync(path.join(root, 'docs', 'engineering', 'modules', 'merchant-industry-backends.md'), 'utf8');

const manifests = {
  apparel_wholesale: apparelWholesaleManifest,
  trading_wholesale: tradingWholesaleManifest,
  department_wholesale: departmentWholesaleManifest,
  bags_wholesale: bagsWholesaleManifest,
  general_retail: generalRetailManifest,
  department_chain_retail: departmentChainRetailManifest
} as const;

const manifetsFolderById: Record<string, string> = {
  apparel_wholesale: 'apparel-wholesale',
  trading_wholesale: 'trading-wholesale',
  department_wholesale: 'department-wholesale',
  bags_wholesale: 'bags-wholesale',
  general_retail: 'general-retail',
  department_chain_retail: 'department-chain-retail'
};

function listFiles(directory: string): string[] {
  return readdirSync(directory).flatMap(entry => {
    const full = path.join(directory, entry);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

test('seven industry templates map to seven independent front-end modules', () => {
  assert.equal(merchantIndustryTemplates.length, 7);
  assert.equal(openMerchantIndustryTemplates.length, 7);
  assert.equal(Object.keys(industryWorkspaceModules).length, 7);
  assert.equal(industryWorkspaceModules.apparel_production_wholesale, null, 'existing apparel portal stays in place');
  for (const template of merchantIndustryTemplates) {
    assert.ok(Object.hasOwn(industryWorkspaceModules, template.id), `${template.id} has a registry entry`);
  }
  for (const [templateId] of Object.entries(manifetsFolderById)) {
    const directory = path.join(industriesRoot, manifetsFolderById[templateId]);
    assert.ok(existsSync(path.join(directory, 'manifest.ts')), `${templateId} manifest exists`);
    assert.ok(existsSync(path.join(directory, 'index.tsx')), `${templateId} page module exists`);
  }
  for (const [templateId, manifest] of Object.entries(manifests)) {
    assert.equal(manifest.templateId, templateId);
  }
});

test('industry modules never import another industry module', () => {
  for (const [templateId, folder] of Object.entries(manifetsFolderById)) {
    const directory = path.join(industriesRoot, folder);
    for (const file of listFiles(directory).filter(file => file.endsWith('.ts') || file.endsWith('.tsx'))) {
      const source = readFileSync(file, 'utf8');
      for (const other of Object.values(manifetsFolderById)) {
        if (other === folder) continue;
        assert.doesNotMatch(source, new RegExp(`from '(\\.\\./)+${other}/`), `${file} must not import ${other}`);
      }
    }
  }
});

test('shared layer does not branch on merchant template ids', () => {
  const sharedDirectory = path.join(industriesRoot, 'shared');
  for (const file of listFiles(sharedDirectory).filter(file => file.endsWith('.ts') || file.endsWith('.tsx'))) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /templateId\s*===/, `${file} must not switch on templateId`);
    assert.doesNotMatch(source, /apparel_production_wholesale|bags_wholesale|general_retail/, `${file} must not hardcode industry ids`);
  }
});

test('industry navigation only exposes modules declared in its capability', () => {
  for (const [templateId, manifest] of Object.entries(manifests)) {
    const capability = getMerchantIndustryCapability(templateId);
    assert.ok(capability, `${templateId} capability exists`);
    const navKeys = manifest.nav.map(item => item.key);
    assert.equal(new Set(navKeys).size, navKeys.length, `${templateId} nav keys unique`);
    for (const key of navKeys) {
      assert.ok(capability!.modules.includes(key), `${templateId} nav key ${key} is enabled`);
      assert.equal(manifest.capability.modules.includes(key), true);
    }
    assert.equal(capability!.features.pos, navKeys.includes('pos'));
    assert.equal(capability!.features.stores, navKeys.includes('stores'));
    assert.equal(capability!.features.procurement, navKeys.includes('procurement'));
  }
});

test('product attributes follow industry semantics instead of apparel defaults', () => {
  const trading = merchantIndustryCapabilities.trading_wholesale;
  const retail = merchantIndustryCapabilities.general_retail;
  const bags = merchantIndustryCapabilities.bags_wholesale;
  const apparel = merchantIndustryCapabilities.apparel_wholesale;

  assert.equal(trading.variant.requiresColor, false);
  assert.equal(trading.variant.requiresSize, false);
  assert.equal(retail.variant.requiresColor, false);
  assert.equal(retail.pricing.primary, 'retail');
  assert.equal(retail.pricing.moq, false);
  assert.equal(apparel.variant.requiresColor, true);
  assert.equal(apparel.variant.requiresSize, true);
  assert.equal(apparel.pricing.primary, 'wholesale');
  assert.ok(getMerchantIndustryAttributeKeys('bags_wholesale').includes('material'));
  assert.ok(getMerchantIndustryAttributeKeys('bags_wholesale').includes('dimensions'));
  assert.ok(getMerchantIndustryAttributeKeys('general_retail').includes('spec'));
  assert.ok(bags.productFields.some(field => field.key === 'material' && field.required));
  assert.deepEqual(getMerchantIndustryAttributeKeys('apparel_production_wholesale'), []);
});

test('industry module guard is declared and protects store, transfer and POS routes', () => {
  assert.match(serverSource, /function requireMerchantIndustryModule\(moduleKey: MerchantIndustryModuleKey\)/);
  assert.match(serverSource, /INDUSTRY_MODULE_UNAVAILABLE/);
  const guardedRoutes: Array<[string, string]> = [
    ["app.get('/api/merchant/stores'", 'stores'],
    ["app.get('/api/merchant/store-transfers'", 'transfers'],
    ["app.post('/api/merchant/pos/sales'", 'pos']
  ];
  for (const [route, moduleKey] of guardedRoutes) {
    const start = serverSource.indexOf(route);
    assert.ok(start >= 0, `${route} exists`);
    const lineEnd = serverSource.indexOf('\n', start);
    const line = serverSource.slice(start, lineEnd);
    assert.match(line, new RegExp(`requireMerchantIndustryModule\\('${moduleKey}'\\)`), `${route} is industry guarded`);
  }
  assert.equal(isMerchantIndustryModuleEnabled('apparel_production_wholesale', 'stores'), false);
  assert.equal(isMerchantIndustryModuleEnabled('department_chain_retail', 'stores'), true);
  assert.equal(isMerchantIndustryModuleEnabled('general_retail', 'transfers'), false);
});

test('store transfers change stock inside transactions and follow the documented state machine', () => {
  assert.equal(canTransitionStoreTransfer('requested', 'dispatched'), true);
  assert.equal(canTransitionStoreTransfer('dispatched', 'received'), true);
  assert.equal(canTransitionStoreTransfer('requested', 'cancelled'), true);
  assert.equal(canTransitionStoreTransfer('requested', 'received'), false);
  assert.equal(canTransitionStoreTransfer('received', 'cancelled'), false);
  assert.equal(canTransitionStoreTransfer('cancelled', 'dispatched'), false);

  const transferRoute = serverSource.slice(
    serverSource.indexOf("app.patch('/api/merchant/store-transfers/:id'"),
    serverSource.indexOf("app.get('/api/merchant/pos/sales'")
  );
  assert.match(transferRoute, /prisma\.\$transaction/);
  assert.match(transferRoute, /STORE_STOCK_INSUFFICIENT/);
  assert.match(transferRoute, /quantity: \{ decrement: item\.quantity \}/);
  assert.match(transferRoute, /quantity: \{ increment: item\.quantity \}/);
  assert.match(transferRoute, /canTransitionStoreTransfer/);
});


test('POS sales validate cart, price on the server and deduct stock', () => {
  assert.deepEqual(normalizePosCart([{ productId: 'p1', sku: 'S1', quantity: 2 }]), [{ productId: 'p1', sku: 'S1', quantity: 2 }]);
  assert.equal(normalizePosCart([]), null);
  assert.equal(normalizePosCart([{ productId: 'p1', sku: '', quantity: 1 }]), null);
  assert.equal(normalizePosCart([
    { productId: 'p1', sku: 'S1', quantity: 1 },
    { productId: 'p1', sku: 'S1', quantity: 2 }
  ]), null);
  assert.equal(resolvePosUnitPrice({ rrpPrice: '19.90', wholesalePrice: '10.00' }), 19.9);
  assert.equal(resolvePosUnitPrice({ rrpPrice: 0, wholesalePrice: 8 }), 8);

  const posRoute = serverSource.slice(
    serverSource.indexOf("app.post('/api/merchant/pos/sales'"),
    serverSource.indexOf("  // GET /api/merchant/customers")
  );
  assert.match(posRoute, /resolvePosUnitPrice/);
  assert.match(posRoute, /applyInventoryLedgerChanges/);
  assert.match(posRoute, /merchantStoreStock\.update/);
  assert.match(posRoute, /STORE_STOCK_INSUFFICIENT/);
  assert.match(posRoute, /POS_PRICE_UNAVAILABLE/);
});

test('store input normalization rejects missing name/code and caps text', () => {
  assert.equal(normalizeStoreInput({ name: '', code: 'A1' }), null);
  assert.equal(normalizeStoreInput({ name: 'Milano', code: '' }), null);
  const store = normalizeStoreInput({ name: ' Milano Duomo ', code: 'mi-01', city: 'Milano', status: 'suspended' });
  assert.ok(store);
  assert.equal(store!.name, 'Milano Duomo');
  assert.equal(store!.code, 'MI-01');
  assert.equal(store!.status, 'suspended');
});

test('schema and migration add store, transfer and POS tables without touching merchant ownership', () => {
  assert.match(schemaSource, /\bindustryAttributes\b/, 'industryAttributes is in Product schema');
  assert.match(migrationSource, /"industryAttributes"/, 'industryAttributes is in migration');
  for (const model of ['MerchantStore', 'MerchantStoreStock', 'MerchantStoreTransfer', 'MerchantStoreTransferItem', 'MerchantPosSale', 'MerchantPosSaleItem']) {
    assert.match(schemaSource, new RegExp(`model ${model} \\{`), `${model} model exists`);
    assert.match(migrationSource, new RegExp(`CREATE TABLE "${model}"`), `${model} table exists`);
  }
  for (const model of ['MerchantStore', 'MerchantStoreStock', 'MerchantStoreTransfer', 'MerchantPosSale']) {
    assert.match(schemaSource, new RegExp(`model ${model} \\{[\\s\\S]*?merchantId[\\s\\S]*?merchant\\s+Merchant`), `${model} keeps tenant ownership`);
  }
  assert.match(schemaSource, /model MerchantStoreStock[\s\S]*?@@unique\(\[storeId, productId, sku\]\)/);
});

test('module spec records isolation, API contracts and acceptance status', () => {
  assert.match(moduleSpec, /七种行业商家后台/);
  assert.match(moduleSpec, /INDUSTRY_MODULE_UNAVAILABLE/);
  assert.match(moduleSpec, /门店/);
  assert.match(moduleSpec, /调拨/);
  assert.match(moduleSpec, /POS/);
  assert.match(moduleSpec, /待验证/);
});


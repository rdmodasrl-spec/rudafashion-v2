import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

test('merchant product detail is a tenant-scoped, uncached authoritative read', () => {
  const server = read('server.ts');
  assert.match(
    server,
    /app\.get\('\/api\/merchant\/products\/:id',[\s\S]*?prisma\.product\.findFirst\(\{[\s\S]*?where:\s*\{\s*id:\s*req\.params\.id,\s*merchantId\s*\}/
  );
  assert.match(server, /MERCHANT_PRODUCT_NOT_FOUND/);
  assert.match(server, /res\.setHeader\('Cache-Control', 'no-store'\)/);
  assert.match(server, /serializeMerchantProductForRequest\(row, req\)/);
});

test('merchant product writes keep inventory authoritative and reject stale versions', () => {
  const server = read('server.ts');
  assert.match(server, /new Date\(currentRow\.updatedAt\)\.getTime\(\) !== expectedUpdatedAt/);
  assert.match(server, /PRODUCT_VERSION_INVALID/);
  assert.match(server, /stockCentral:\s*Number\(existing\?\.stockCentral \?\? 0\)/);
  assert.match(server, /stockMestre:\s*Number\(existing\?\.stockMestre \?\? 0\)/);
  assert.match(server, /stockMilano:\s*Number\(existing\?\.stockMilano \?\? 0\)/);
  assert.match(server, /reserved:\s*Number\(existing\?\.reserved \?\? 0\)/);
  assert.match(server, /tx\.product\.updateMany\(\{[\s\S]*?updatedAt:\s*currentRow\.updatedAt/);
  assert.match(server, /status\(409\)\.json\(\{[\s\S]*?PRODUCT_VERSION_CONFLICT/);
  assert.match(server, /brand:\s*String\(nextProduct\.brand \|\| current\.brand \|\| ''\)/);
  assert.match(server, /bulkPriceMinimumQuantity/);
  assert.match(server, /requiresFullCarton/);
  assert.match(server, /FULL_CARTON_PACK_SIZE_REQUIRED/);
});

test('merchant settings writes reject stale versions instead of silently overwriting', () => {
  const server = read('server.ts');
  assert.match(server, /app\.get\('\/api\/merchant\/settings'[\s\S]*?updatedAt:\s*true/);
  assert.match(server, /expectedUpdatedAt/);
  assert.match(server, /prisma\.merchant\.updateMany\(\{[\s\S]*?updatedAt:\s*expectedUpdatedAt \?\? existingMerchant\.updatedAt/);
  assert.match(server, /MERCHANT_SETTINGS_CONFLICT/);
});

test('merchant web and mobile clients invalidate cached reads on identity changes and surface partial failures', () => {
  const client = read('src/api/client.ts');
  const context = read('src/context/B2BContext.tsx');
  const web = read('src/apps/merchant-admin-web/MerchantPortal.tsx');
  const mobile = read('src/apps/merchant-admin-mobile/MerchantMobileApp.tsx');

  assert.match(client, /export function clearApiCache\(pathPrefix\?: string\)/);
  assert.match(context, /useEffect\(\(\) => \{\s*clearApiCache\(\);\s*\}, \[authRole, authMerchantId\]\)/);
  assert.match(context, /const results = await Promise\.allSettled\(\[[\s\S]*?\/api\/merchant\/products', 0\)/);
  assert.match(context, /addEventListener\('open',[\s\S]*?syncMerchantCollections\(\)/);
  assert.match(context, /PRODUCT_VERSION_CONFLICT[\s\S]*?syncMerchantData/);

  assert.match(web, /const results = await Promise\.allSettled\(\[[\s\S]*?\/api\/merchant\/products'/);
  assert.match(web, /settingsSyncNonce/);
  assert.match(web, /MERCHANT_SETTINGS_CONFLICT/);
  assert.match(web, /void refreshMerchantOperations\(\)/);

  assert.match(mobile, /const results = await Promise\.allSettled\(\[[\s\S]*?\/api\/merchant\/materials'/);
  assert.match(mobile, /settingsSyncNonce/);
  assert.match(mobile, /MERCHANT_SETTINGS_CONFLICT/);
});

test('merchant mini program refreshes visible lists and detail without destroying local state', () => {
  const products = read('merchant-miniprogram/pages/products/index.js');
  const orders = read('merchant-miniprogram/pages/orders/index.js');
  const detail = read('merchant-miniprogram/pages/product-detail/index.js');
  const form = read('merchant-miniprogram/pages/product-form/index.js');

  for (const source of [products, orders]) {
    assert.match(source, /setInterval\(\(\) => \{\s*this\.load(Products|Orders)\(\{ silent: true \}\);\s*\}, 30000\)/);
    assert.match(source, /onHide\(\) \{[\s\S]*?this\.stopDataRefresh\(\)/);
    assert.match(source, /onUnload\(\) \{[\s\S]*?this\.stopDataRefresh\(\)/);
    assert.match(source, /if \(!silent\) this\.setData\(\{ loading: false \}\)/);
    assert.match(source, /if \(!silent\) this\.setData\(\{ error: error\.message/);
  }
  assert.match(detail, /onShow\(\)[\s\S]*?this\.loadProduct\(\{ silent: true \}\)/);
  assert.match(detail, /setInterval\([\s\S]*?this\.loadProduct\(\{ silent: true \}\)[\s\S]*?30000/);
  assert.match(detail, /onHide\(\)[\s\S]*?this\.stopDataRefresh\(\)/);
  assert.match(detail, /if \(!silent\) this\.setData\(\{ error: error\.message/);
  assert.match(detail, /\/api\/merchant\/products\/\$\{encodeURIComponent\(this\.productId\)\}/);
  assert.match(form, /updatedAt:\s*copyMode \? '' : String\(product\.updatedAt \|\| ''\)/);
  assert.match(form, /product\.expectedUpdatedAt = this\.data\.updatedAt/);
  assert.match(form, /PRODUCT_VERSION_CONFLICT/);
});

test('Restaurant menu entry uses exact industry/module gating and the shared restaurant API on mobile clients', () => {
  const mobile = read('src/apps/merchant-admin-mobile/MerchantMobileApp.tsx');
  const miniConfig = read('merchant-miniprogram/industries/restaurant-ordering.js');
  const miniPage = read('merchant-miniprogram/pages/restaurant-menu/index.js');
  const miniApp = JSON.parse(read('merchant-miniprogram/app.json'));

  assert.match(mobile, /currentMerchant\?\.industry === 'RESTAURANT'[\s\S]*?industryTemplate === 'restaurant_ordering'[\s\S]*?modules\.includes\('restaurant_menu'\)/);
  assert.match(mobile, /restaurantMenuAvailable[\s\S]*?<RestaurantMenuWorkspace \/>/);
  assert.match(miniConfig, /module: 'restaurant_menu'[\s\S]*?\/pages\/restaurant-menu\/index/);
  assert.match(miniPage, /context\.templateId !== 'restaurant_ordering'[\s\S]*?hasModule\(context, 'restaurant_menu'\)/);
  assert.match(miniPage, /hasPermission\(context, 'product\.import\.draft'\)/);
  assert.match(miniPage, /hasPermission\(context, 'purchase\.manage'\)/);
  assert.match(miniPage, /\/api\/merchant\/restaurant\/menus\?limit=100/);
  assert.match(miniPage, /\/api\/merchant\/restaurant\/dishes\?limit=100/);
  for (const endpoint of [
    '/api/merchant/restaurant/ingredients',
    '/api/merchant/suppliers',
    '/api/merchant/restaurant/purchase-orders',
    '/submit',
    '/receipts',
    '/recipes',
    '/cost',
    'publish',
    'unpublish'
  ]) {
    assert.ok(miniPage.includes(endpoint), `Restaurant mini-program must use the shared ${endpoint} contract`);
  }
  const webWorkspace = read('src/apps/merchant-admin-common/components/merchant/RestaurantMenuWorkspace.tsx');
  for (const endpoint of [
    '/api/merchant/restaurant/ingredients',
    '/api/merchant/suppliers',
    '/api/merchant/restaurant/purchase-orders',
    '/submit',
    '/receipts',
    '/recipes',
    '/cost',
    'publish',
    'unpublish'
  ]) {
    assert.ok(webWorkspace.includes(endpoint), `Restaurant Web workspace must use the shared ${endpoint} contract`);
  }
  assert.match(webWorkspace, /'Idempotency-Key': purchaseCreateRequest\.current\.idempotencyKey/);
  assert.match(webWorkspace, /expectedVersion: receivingOrder\.version/);
  assert.match(webWorkspace, /按实际到货数量和发票单价收货/);
  assert.ok((miniApp.pages as string[]).includes('pages/restaurant-menu/index'));
});

test('Restaurant table directory uses one tenant-scoped API and exact Restaurant module gating across merchant clients', () => {
  const mobile = read('src/apps/merchant-admin-mobile/MerchantMobileApp.tsx');
  const web = read('src/apps/merchant-admin-web/MerchantPortal.tsx');
  const sharedTables = read('src/apps/merchant-admin-common/components/merchant/RestaurantTableWorkspace.tsx');
  const miniConfig = read('merchant-miniprogram/industries/restaurant-ordering.js');
  const miniPage = read('merchant-miniprogram/pages/restaurant-tables/index.js');
  const miniApp = JSON.parse(read('merchant-miniprogram/app.json'));
  const server = read('src/server/restaurantCatalogRoutes.ts');

  assert.match(mobile, /modules\.includes\('restaurant_tables'\)[\s\S]*?<RestaurantTableWorkspace \/>/);
  assert.match(web, /activeTab === 'restaurant_tables'[\s\S]*?<RestaurantTableWorkspace \/>/);
  assert.match(miniConfig, /module: 'restaurant_tables'[\s\S]*?permission: 'employees\.manage'[\s\S]*?\/pages\/restaurant-tables\/index/);
  assert.match(miniPage, /context\.templateId !== 'restaurant_ordering'[\s\S]*?hasModule\(context, 'restaurant_tables'\)/);
  assert.match(miniPage, /hasPermission\(context, 'employees\.manage'\)/);
  assert.ok((miniApp.pages as string[]).includes('pages/restaurant-tables/index'));
  for (const endpoint of ['/api/merchant/restaurant/table-stores', '/api/merchant/restaurant/tables']) {
    assert.ok(sharedTables.includes(endpoint), `Web table workspace must use ${endpoint}`);
    assert.ok(miniPage.includes(endpoint), `Mini-program table page must use ${endpoint}`);
    assert.ok(server.includes(endpoint), `Restaurant server must expose ${endpoint}`);
  }
  assert.match(miniPage, /'Idempotency-Key': this\._createRequest\.key/);
  assert.match(miniPage, /expectedVersion: table\.version/);
  assert.match(server, /tableReadGuards = \[[\s\S]*?requireRestaurantTablesModule[\s\S]*?requireRestaurantMerchant/);
  assert.match(server, /tableWriteGuards = \[\.\.\.tableReadGuards, requireMenuPublishPermission\]/);
  const appServer = read('server.ts');
  assert.match(appServer, /requireRestaurantTablesModule: requireMerchantIndustryModule\('restaurant_tables'\)/);
  assert.match(server, /version: expectedVersion/);
});

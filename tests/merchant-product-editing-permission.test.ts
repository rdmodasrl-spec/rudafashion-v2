import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const serverSource = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const mobileSource = readFileSync(
  new URL('../src/apps/merchant-admin-mobile/MerchantMobileApp.tsx', import.meta.url),
  'utf8'
);

test('merchant product edit lock is enforced by every existing product mutation route', () => {
  for (const route of [
    "app.put('/api/merchant/products/batch'",
    "app.put('/api/merchant/products/:id'",
    "app.delete('/api/merchant/products/:id'",
    "app.put('/api/merchant/products/:id/bom'"
  ]) {
    const routeIndex = serverSource.indexOf(route);
    assert.notEqual(routeIndex, -1, `missing product mutation route ${route}`);
    const middlewareList = serverSource.slice(routeIndex, serverSource.indexOf('async (req', routeIndex));
    assert.match(middlewareList, /requireMerchantProductEditingEnabled\(\)/, `${route} must enforce the merchant edit lock`);
  }
});

test('merchant product edit lock is persisted and manageable only with employee management permission', () => {
  assert.match(serverSource, /settings\.productEditingEnabled !== true/);
  assert.match(serverSource, /app\.put\('\/api\/merchant\/settings\/product-editing', requireMerchantTenant, requireEmployeePermission\('employees\.manage'\)/);
  assert.match(serverSource, /MERCHANT_PRODUCT_EDITING_PERMISSION_UPDATED/);
  assert.match(serverSource, /canManageProductEditing: !req\.merchant\?\.employeeId \|\| employeeHasPermission\(req, 'employees\.manage'\)/);
});

test('mobile product detail displays persisted edit permission separately from publishing', () => {
  assert.match(mobileSource, /\/api\/merchant\/settings\/product-editing/);
  assert.match(
    mobileSource,
    /productEditUnlocked \? mobileText\('已开启', 'Attivo'\) : mobileText\('已关闭', 'Chiuso'\)/,
    'the product detail sheet renders the persisted edit-lock state'
  );
  assert.match(mobileSource, /role="switch"\s+aria-checked=\{productEditUnlocked\}/);
  assert.match(mobileSource, /disabled=\{!productEditPermissionLoaded \|\| productEditPermissionBusy\}/);
  assert.match(
    mobileSource,
    /disabled=\{creatingProductDefaultsBusy\}\s+onClick=\{\(\) => void beginMobileProductCreation\(null as any\)\}/,
    'uploading products stays a separate entry from the edit lock'
  );
});

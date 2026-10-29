import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { MERCHANT_MINIPROGRAM_MODAUI_ENABLED_KEY } from '../src/server/featureFlags';

const root = process.cwd();
const serverSource = readFileSync(path.join(root, 'server.ts'), 'utf8');
const miniRoot = path.join(root, 'merchant-miniprogram');
const readMini = (relativePath: string) => readFileSync(path.join(miniRoot, relativePath), 'utf8');
const requireFromTest = createRequire(import.meta.url);

function sliceFrom(source: string, startNeedle: string, endNeedle: string): string {
  const start = source.indexOf(startNeedle);
  assert.notEqual(start, -1, `missing ${startNeedle}`);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.notEqual(end, -1, `missing ${endNeedle} after ${startNeedle}`);
  return source.slice(start, end);
}

test('admin flag endpoints require admin auth plus the feature settings permission', () => {
  assert.match(
    serverSource,
    /app\.get\('\/api\/admin\/feature-flags', requireAdminAuth, requireAdminPermission\('settings\.features'\)/
  );
  assert.match(
    serverSource,
    /app\.patch\('\/api\/admin\/feature-flags\/:key', requireAdminAuth, requireAdminPermission\('settings\.features'\)/
  );
  assert.match(serverSource, /'FEATURE_FLAG_UPDATED'/);
  assert.match(serverSource, /Cache-Control', 'no-store'/);
});

test('merchant flag endpoint is tenant scoped and never leaks the operator', () => {
  const route = sliceFrom(serverSource, "app.get('/api/merchant/feature-flags'", '});');
  assert.match(route, /requireMerchantTenant/);
  assert.match(route, /buildMerchantFeatureFlagPayload\(featureFlagStore\)/);
  assert.doesNotMatch(route, /updatedBy/);
  assert.doesNotMatch(route, /updatedAt/);
});

test('generation endpoints reject mini-program traffic before reserving credits or creating tasks', () => {
  const imagesRoute = sliceFrom(serverSource, "'/api/merchant/modagpt/images',", 'reserveModaGptCredits');
  assert.match(imagesRoute, /isMerchantMiniprogramModauiBlocked\(req\)/);
  assert.match(imagesRoute, /sendModauiMiniprogramDisabled\(res\)/);

  const designsRoute = sliceFrom(serverSource, "app.post('/api/merchant/modagpt/designs'", 'const clientRequestId');
  assert.match(designsRoute, /isMerchantMiniprogramModauiBlocked\(req\)/);

  const brainRoute = sliceFrom(serverSource, "'/api/merchant/modagpt/brain/documents',", 'const body = req.body;');
  assert.match(brainRoute, /isMerchantMiniprogramModauiBlocked\(req\)/);

  const assistantRoute = sliceFrom(serverSource, "app.post('/api/merchant/assistant/query'", 'const question =');
  assert.match(assistantRoute, /isMerchantMiniprogramModauiBlocked\(req\)/);
});

test('gate only applies to the mini-program client and fails closed', () => {
  const helper = sliceFrom(serverSource, 'async function isMerchantMiniprogramModauiBlocked', 'function sendModauiMiniprogramDisabled');
  assert.match(helper, /if \(!isMerchantMiniprogramRequest\(req\)\) return false;/);
  assert.match(helper, /return !featureFlagStore\.isEnabled\(MERCHANT_MINIPROGRAM_MODAUI_ENABLED_KEY\)/);
  assert.match(serverSource, /error: \{ code: 'MODAUI_MINIPROGRAM_DISABLED', message: '该功能暂未开放' \}/);
});

test('mini-program reads the flag from the authoritative endpoint with fail-closed defaults', () => {
  const api = readMini('utils/api.js');
  assert.match(api, /'X-Ruda-Client'/);
  assert.match(api, /'merchant-miniprogram'/);

  const flags = readMini('utils/feature-flags.js');
  assert.match(flags, /request\('\/api\/merchant\/feature-flags'\)/);
  assert.match(flags, /MODAUI_FLAG_DEFAULT = false/);

  const clientFlags = requireFromTest('../merchant-miniprogram/utils/feature-flags.js');
  assert.equal(clientFlags.MODAUI_FLAG_KEY, MERCHANT_MINIPROGRAM_MODAUI_ENABLED_KEY);
  assert.equal(clientFlags.isModauiEnabled(), false);
  assert.equal(clientFlags.getFlag('unknown_key'), false);
});

test('mini-program ModaUI visibility follows the flag instead of a hardcoded switch', () => {
  const review = readMini('utils/review-features.js');
  assert.match(review, /require\('\.\/feature-flags'\)/);
  assert.match(review, /return isModauiEnabled\(\);/);
  assert.doesNotMatch(review, /AI_FEATURES_ENABLED/);

  assert.match(readMini('app.js'), /refreshFeatureFlags\(\)/);
  assert.match(readMini('pages/more/index.js'), /await refreshFeatureFlags\(\)/);

  const assistant = readMini('pages/assistant/index.js');
  assert.match(assistant, /if \(!isModauiEnabled\(\)\) \{/);
  assert.match(assistant, /modauiBlocked: true/);
  assert.match(assistant, /if \(this\.data\.modauiBlocked\) return;/);

  const markup = readMini('pages/assistant/index.wxml');
  assert.match(markup, /wx:if="\{\{modauiBlocked\}\}"/);
  assert.match(markup, /该功能暂未开放/);
  assert.match(markup, /bindtap="goBack"/);
  assert.match(readMini('pages/assistant/index.wxss'), /\.modaui-blocked \{/);
});

test('platform admin exposes the feature flag tab on web and mobile', () => {
  const navigation = readFileSync(
    path.join(root, 'src/apps/platform-admin-common/components/admin/adminNavigation.ts'),
    'utf8'
  );
  assert.match(navigation, /'feature_flags'/);
  assert.match(navigation, /label: '功能开关'/);
  assert.match(readFileSync(path.join(root, 'src/apps/platform-admin-web/PlatformAdmin.tsx'), 'utf8'), /AdminFeatureFlags/);
  assert.match(readFileSync(path.join(root, 'src/apps/platform-admin-mobile/PlatformAdminMobile.tsx'), 'utf8'), /AdminFeatureFlags/);

  const component = readFileSync(
    path.join(root, 'src/apps/platform-admin-common/components/admin/AdminFeatureFlags.tsx'),
    'utf8'
  );
  assert.match(component, /role="switch"/);
  assert.match(component, /expectedUpdatedAt/);
  assert.match(component, /\/api\/admin\/feature-flags/);
});
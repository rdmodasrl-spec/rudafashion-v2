import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');
const serverSource = read('server.ts');

function sliceFrom(source: string, startNeedle: string, endNeedle: string): string {
  const start = source.indexOf(startNeedle);
  assert.notEqual(start, -1, `missing ${startNeedle}`);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.notEqual(end, -1, `missing ${endNeedle} after ${startNeedle}`);
  return source.slice(start, end);
}

test('fashion module kill switch is mounted before every user-facing fashion route', () => {
  const guardIndex = serverSource.indexOf("app.use('/api/fashion', requireFashionEnabled)");
  const firstRouteIndex = serverSource.indexOf("app.get('/api/fashion/editorial'");
  assert.notEqual(guardIndex, -1, 'fashion guard missing');
  assert.notEqual(firstRouteIndex, -1, 'fashion routes missing');
  assert.ok(guardIndex < firstRouteIndex, 'fashion guard must be registered before fashion routes');
  assert.match(serverSource, /code: 'FASHION_MODULE_DISABLED'[\s\S]{0,80}该功能暂未开放/);
  // 后台管理接口不得被用户侧门禁拦截，管理员必须始终能重新开启。
  assert.equal(serverSource.includes("'/api/admin/fashion', requireFashionEnabled"), false);
});

test('one public endpoint exposes only the two global switches', () => {
  const route = sliceFrom(serverSource, "app.get('/api/public/feature-flags'", '});');
  assert.match(route, /buildPublicFeatureFlagPayload\(featureFlagStore\)/);
  assert.match(route, /Cache-Control', 'no-store'/);
  assert.doesNotMatch(route, /updatedBy/);
  assert.doesNotMatch(route, /requireAdminAuth/);
});

test('every AI write entry rejects new work while ModaUI is globally closed', () => {
  const gatedRoutes = [
    "app.post('/api/modagpt/public/chat', requireModauiEnabled",
    "app.post(\n    '/api/merchant/modagpt/images',\n    requireMerchantTenant,\n    requireModauiEnabled",
    "app.post('/api/merchant/modagpt/designs', requireMerchantTenant, requireModauiEnabled",
    "app.post(\n    '/api/merchant/modagpt/brain/documents',\n    requireMerchantTenant,\n    requireModauiEnabled",
    "app.post('/api/merchant/assistant/query', requireMerchantTenant, requireModauiEnabled"
  ];
  for (const expected of gatedRoutes) {
    assert.ok(serverSource.includes(expected), `missing gate: ${expected}`);
  }
  assert.match(serverSource, /code: 'MODAUI_DISABLED'[\s\S]{0,80}该功能暂未开放/);
});

test('miniprogram feature endpoint honours both the global gate and the review flag', () => {
  const route = sliceFrom(serverSource, "app.get('/api/miniprogram/features'", '});');
  assert.match(route, /aiSectionEnabled: globallyEnabled && featureFlagStore\.isEnabled\(MINIPROGRAM_MODAUI_ENABLED_KEY\)/);
  assert.match(route, /fashionSectionEnabled/);
  assert.match(route, /MODAUI_ENABLED_KEY/);
});

test('web and mobile entries hide fashion and ModaUI from a single shared snapshot', () => {
  assert.match(read('src/apps/shared/moduleAvailability.ts'), /refreshModuleAvailability/);
  assert.match(read('src/apps/shared/moduleAvailability.ts'), /fashion_enabled/);
  assert.match(read('src/apps/shared/moduleAvailability.ts'), /modaui_enabled/);
  assert.match(read('src/apps/shared/components/Header.tsx'), /fashionEnabled \|\| item\.view !== 'fashion_trends'/);
  assert.match(read('src/apps/shared/components/Footer.tsx'), /fashionEnabled \|\| link\.view !== 'fashion_trends'/);
  assert.match(read('src/apps/shared/components/MobileBottomNav.tsx'), /modauiEnabled \|\| tab\.id !== 'ai'/);
  assert.match(read('src/apps/shared/PublicFrontendApp.tsx'), /ModuleUnavailableView/);
  assert.match(read('src/apps/shared/PublicFrontendApp.tsx'), /modauiEnabled \?/);
});

test('merchant web and mobile hide the ModaUI workspace and render the shared notice', () => {
  const web = read('src/apps/merchant-admin-web/MerchantPortal.tsx');
  const mobile = read('src/apps/merchant-admin-mobile/MerchantMobileApp.tsx');
  assert.match(web, /modauiEnabled && <button type="button" id="merchant-sidebar-tab-modagpt"/);
  assert.match(web, /if \(!modauiEnabled\) \{/);
  assert.match(mobile, /\.filter\(tab => modauiEnabled \|\| tab\.id !== 'ai_home'\)/);
  assert.match(mobile, /activeTab === 'ai_home' && \(modauiEnabled \?/);
});

test('user miniprogram reads the public switches and hides the matching tabs', () => {
  const flags = read('miniprogram/utils/module-flags.js');
  assert.match(flags, /ruda_module_flags/);
  assert.match(flags, /'\/api\/public\/feature-flags', \{ auth: false \}/);
  assert.match(flags, /return true;/);
  const tabBar = read('miniprogram/custom-tab-bar/index.js');
  assert.match(tabBar, /isFashionEnabled\(\)/);
  assert.match(tabBar, /isModauiEnabled\(\)/);
  assert.match(tabBar, /refreshModuleFlags\(\)/);
  const fashionPage = read('miniprogram/pages/fashion/index.js');
  assert.match(fashionPage, /refreshModuleFlags\(\{ force: true \}\)/);
  assert.match(fashionPage, /该功能暂未开放/);
});

test('merchant miniprogram intersects the merchant flag with the global switch', () => {
  const flags = read('merchant-miniprogram/utils/feature-flags.js');
  assert.match(flags, /GLOBAL_MODAUI_FLAG_KEY = 'modaui_enabled'/);
  assert.match(flags, /if \(!getFlag\(MODAUI_FLAG_KEY\)\) return false;/);
  assert.match(flags, /cached\.flags\[GLOBAL_MODAUI_FLAG_KEY\]/);
});

test('admin page confirms disabling and reports the saved result', () => {
  const admin = read('src/apps/platform-admin-common/components/admin/AdminFeatureFlags.tsx');
  assert.match(admin, /role="alertdialog"/);
  assert.match(admin, /确认关闭/);
  assert.match(admin, /role="status"/);
  assert.match(admin, /保存成功/);
});

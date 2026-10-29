import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const read = (relative: string) => readFileSync(path.join(process.cwd(), relative), 'utf8');

test('platform admin app store reads through the shared API client and never renders [object Object]', () => {
  const source = read('src/apps/platform-admin-common/components/admin/AdminAppStoreMgmt.tsx');

  assert.doesNotMatch(source, /fetch\(['"`]\/api\/admin\/app-store/, 'must not bypass the API client');
  assert.match(source, /apiGet<\{ success: true; apps: App\[\] \}>\('\/api\/admin\/app-store\/apps'\)/);
  assert.match(source, /apiGet<\{ success: true; categories: Category\[\] \}>\('\/api\/admin\/app-store\/categories'\)/);
  assert.match(source, /apiPost<\{ success: true \}>\('\/api\/admin\/app-store\/apps'/);
  assert.match(source, /apiPut<\{ success: true \}>\(`\/api\/admin\/app-store\/apps\/\$\{currentApp\.id\}`/);

  // 服务端错误体是 { error: { code, message } }：必须解析，不能直接拼进字符串。
  assert.match(source, /import \{ describeAppStoreError \} from '\.\.\/\.\.\/appStoreErrors';/);
  assert.match(source, /describeAppStoreError\(error, /);
  assert.match(source, /setLoadError\(message\)/);
  const helper = read('src/apps/platform-admin-common/appStoreErrors.ts');
  assert.match(helper, /export function describeAppStoreError\(/);
  assert.match(helper, /error instanceof ApiError/);
  assert.doesNotMatch(helper, /String\(error\)/, 'must never stringify error objects');
  assert.match(source, /onClick=\{\(\) => void fetchData\(\)\}/);
  assert.doesNotMatch(source, /new Error\(appsData\.error/);
});

test('merchant web sidebar exposes a first-level app store entry above settings', () => {
  const source = read('src/apps/merchant-admin-web/MerchantPortal.tsx');
  const appStoreIndex = source.indexOf('id="merchant-sidebar-tab-app-store"');
  const settingsIndex = source.indexOf('id="merchant-sidebar-tab-settings"');

  assert.ok(appStoreIndex > 0, 'app store sidebar entry missing');
  assert.ok(settingsIndex > appStoreIndex, 'app store entry must sit above 系统设置');
  const block = source.slice(appStoreIndex, settingsIndex);
  assert.match(block, /setActiveTab\('app_store'\)/);
  assert.match(block, /localizeCopy\('应用商店', 'App store'\)/);
});

test('merchant mobile menu exposes the app store entry and opens the same store', () => {
  const nav = read('src/apps/merchant-admin-common/components/merchant/merchantMobileNavigation.ts');
  const app = read('src/apps/merchant-admin-mobile/MerchantMobileApp.tsx');

  assert.match(nav, /\{ id: 'app_store', zh: '应用商店', it: 'App store'/, 'mobile menu entry missing');
  const storeEntryIndex = nav.indexOf("id: 'app_store'");
  const settingsEntryIndex = nav.indexOf("id: 'settings'");
  assert.ok(storeEntryIndex > 0 && settingsEntryIndex > storeEntryIndex, 'app store entry must sit above 系统设置');
  assert.match(app, /case 'app_store':\s*\n\s*setSettingsSection\('apps'\);/);
  // 底部导航结构不变：仍是 5 个固定 Tab。
  assert.match(nav, /merchantMobilePrimaryTabs = \[\s*\n\s*\{ id: 'dashboard'[\s\S]*?\{ id: 'more', zh: '更多'/);
  assert.doesNotMatch(nav, /merchantMobilePrimaryTabs = \[[\s\S]{0,400}app_store/);
});

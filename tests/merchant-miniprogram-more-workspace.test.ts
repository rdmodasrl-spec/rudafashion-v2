import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const miniRoot = new URL('../merchant-miniprogram/', import.meta.url);
const moreSource = readFileSync(new URL('pages/more/index.js', miniRoot), 'utf8');
const moreMarkup = readFileSync(new URL('pages/more/index.wxml', miniRoot), 'utf8');
const moreStyles = readFileSync(new URL('pages/more/index.wxss', miniRoot), 'utf8');
const app = JSON.parse(readFileSync(new URL('app.json', miniRoot), 'utf8'));
const requireFromTest = createRequire(import.meta.url);
const permissions = requireFromTest('../merchant-miniprogram/utils/permissions.js');

function createMorePage() {
  let definition: Record<string, any> | undefined;
  const routes: Array<{ kind: string; url: string }> = [];
  const toasts: string[] = [];
  let modalOptions: { success: (result: { confirm: boolean }) => void } | undefined;
  let sessionCleared = false;
  const auth = {
    session: { role: 'employee', profile: { name: 'Test employee', email: 'employee@example.test' } },
    response: { merchant: { name: 'Test merchant', logo: '/merchant-logo.png' }, employee: { permissions: ['*'] } }
  };
  runInNewContext(moreSource, {
    Page: (page: Record<string, any>) => { definition = page; },
    require: (specifier: string) => {
      if (specifier === '../../utils/auth') return { clearSession() { sessionCleared = true; }, verifySession: async () => auth };
      if (specifier === '../../utils/api') return {
        getAssetUrl: (value: string) => `https://assets.example.test${value}`,
        request: async () => ({ unread: 3, notifications: [] })
      };
      if (specifier === '../../utils/constants') return { PUBLIC_SITE_URL: 'https://modaui.example.test' };
      if (specifier === '../../utils/permissions') return permissions;
      if (specifier === '../../utils/tabbar') return { syncTabBar() {} };
      if (specifier === '../../utils/feature-flags') return { refreshFeatureFlags: async () => ({ modaui: false }) };
      if (specifier === '../../utils/qrcode-generator') {
        return () => ({ addData() {}, make() {}, getModuleCount: () => 1, isDark: () => false });
      }
      throw new Error(`Unexpected module: ${specifier}`);
    },
    wx: {
      switchTab: ({ url }: { url: string }) => routes.push({ kind: 'tab', url }),
      navigateTo: ({ url }: { url: string }) => routes.push({ kind: 'page', url }),
      showModal: (options: typeof modalOptions) => { modalOptions = options; },
      showToast: ({ title }: { title: string }) => toasts.push(title)
    },
    console
  });

  assert.ok(definition);
  return Object.assign({}, definition, {
    data: JSON.parse(JSON.stringify(definition.data)),
    routes,
    toasts,
    getModalOptions: () => modalOptions,
    wasSessionCleared: () => sessionCleared,
    setData(update: Record<string, unknown>) {
      Object.assign(this.data, update);
    }
  });
}

test('hidden AI modules cannot be opened directly before mini-program approval', () => {
  const page = createMorePage();
  for (const id of ['ai_home', 'tryon', 'ai_employees']) {
    page.openModule({ currentTarget: { dataset: { id } } });
  }

  assert.deepEqual(page.routes, []);
  assert.equal(page.toasts.length, 3);
  assert.ok(page.toasts.every((message: string) => message.includes('审核通过后开放')));
});

test('every visible mini program More module has a recognized permission and opens a registered page', async () => {
  const page = createMorePage();
  await page.loadProfile();
  const items = page.data.groups.flatMap((group: Record<string, any>) => group.items);
  assert.ok(items.length > 0);
  const registeredPages = new Set(app.pages as string[]);
  const registeredTabs = new Set((app.tabBar.list as Array<{ pagePath: string }>).map(item => item.pagePath));

  for (const item of items) {
    const hasWorkspacePermission = permissions.canAccessWorkspace({
      session: { role: 'employee' },
      response: { employee: { permissions: ['*'] } }
    }, item.id);
    if (!hasWorkspacePermission) throw new Error(`${item.id} must have a workspace permission mapping`);
    page.openModule({ currentTarget: { dataset: { id: item.id } } });
    const route = page.routes.at(-1);
    if (!route) throw new Error(`${item.id} must open a destination`);
    const pagePath = route.url.split('?')[0].replace(/^\//, '');
    const isRegistered = route.kind === 'tab' ? registeredTabs.has(pagePath) : registeredPages.has(pagePath);
    if (!isRegistered) throw new Error(`${item.id} points to an unregistered mini program page: ${route.url}`);
  }
});

test('More uses grouped white function lists without duplicating bottom product, order, POS or stock modules', async () => {
  const page = createMorePage();
  await page.loadProfile();
  const items = page.data.groups.flatMap((group: Record<string, any>) => group.items);
  const ids = items.map((item: Record<string, string>) => item.id);

  assert.ok(moreMarkup.includes('class="module-container ruda-card ui-card"'));
  assert.ok(moreStyles.includes('background: #fff'));
  assert.ok(moreMarkup.includes('more-company-header'));
  assert.ok(moreMarkup.includes('退出登录'));
  assert.ok(moreMarkup.includes('module-badge'));
  assert.equal(page.data.merchantLogo, 'https://assets.example.test/merchant-logo.png');
  assert.equal(page.data.unreadNotificationCount, 3);
  assert.equal(ids.includes('products'), false);
  assert.equal(ids.includes('orders'), false);
  assert.equal(ids.includes('pos'), false);
  assert.equal(ids.includes('inventory'), false);
  assert.equal(ids.includes('ai_home'), false);
  assert.equal(ids.includes('tryon'), false);
  assert.equal(ids.includes('ai_employees'), false);
});

test('More settings and business card open their registered child pages', () => {
  const page = createMorePage();
  page.data.canManageSettings = true;
  page.openSettings();
  page.openBusinessCard();

  assert.deepEqual(page.routes, [
    { kind: 'page', url: '/pages/workspace/index?id=settings' },
    { kind: 'page', url: '/pages/business-card/index' }
  ]);
});

test('More logout requires confirmation and clears the merchant session only after confirmation', () => {
  const page = createMorePage();
  page.logout();
  assert.equal(page.wasSessionCleared(), false);

  page.getModalOptions()?.success({ confirm: false });
  assert.equal(page.wasSessionCleared(), false);

  page.logout();
  page.getModalOptions()?.success({ confirm: true });
  assert.equal(page.wasSessionCleared(), true);
  assert.deepEqual(page.routes.at(-1), { kind: 'page', url: '/pages/login/index' });
});

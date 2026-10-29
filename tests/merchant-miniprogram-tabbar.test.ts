import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';

const root = process.cwd();
const miniRoot = path.join(root, 'merchant-miniprogram');
const requireFromTest = createRequire(import.meta.url);
const app = JSON.parse(readFileSync(path.join(miniRoot, 'app.json'), 'utf8'));
const permissions = requireFromTest('../merchant-miniprogram/utils/permissions.js');

function miniProgramJavaScriptFiles(directory: string): string[] {
  return readdirSync(directory).flatMap(name => {
    const filePath = path.join(directory, name);
    const stats = statSync(filePath);
    if (stats.isDirectory()) {
      return name === 'node_modules' ? [] : miniProgramJavaScriptFiles(filePath);
    }
    return name.endsWith('.js') ? [filePath] : [];
  });
}

test('mini-program JavaScript avoids array destructuring that requires the missing SWC runtime', () => {
  for (const filePath of miniProgramJavaScriptFiles(miniRoot)) {
    const source = readFileSync(filePath, 'utf8');
    assert.doesNotMatch(source, /\b(?:const|let|var)\s*\[[^\]]+\]\s*(?:=|of|in)\b/, filePath);
  }
});

test('custom tab bar has no eager permission module dependency', () => {
  const source = readFileSync(path.join(miniRoot, 'custom-tab-bar', 'index.js'), 'utf8');
  const markup = readFileSync(path.join(miniRoot, 'custom-tab-bar', 'index.wxml'), 'utf8');
  const styles = readFileSync(path.join(miniRoot, 'custom-tab-bar', 'index.wxss'), 'utf8');
  assert.doesNotMatch(source, /require\(['"]\.\.\/utils\/permissions['"]\)/);
  assert.match(source, /setHidden\(hidden\)\s*\{[\s\S]*?this\.setData\(\{ hidden: Boolean\(hidden\) \}\)/);
  assert.match(markup, /class="tab-bar \{\{hidden \? 'tab-bar-hidden' : ''\}\}"/);
  assert.match(styles, /\.tab-bar-hidden\s*\{[^}]*transform:\s*translateY\(100%\)[^}]*pointer-events:\s*none/);

  let component: Record<string, any> | undefined;
  vm.runInNewContext(source, {
    Component(definition: Record<string, any>) {
      component = definition;
    },
    wx: { switchTab() {} }
  });
  assert.ok(component);
  const data: Record<string, unknown> = {};
  component.methods.setAccess.call({
    setData(values: Record<string, unknown>) {
      Object.assign(data, values);
    }
  }, [{ id: 'dashboard' }, { id: 'more' }], 'more');
  assert.deepEqual(JSON.parse(JSON.stringify(data)), {
    list: [{ id: 'dashboard' }, { id: 'more' }],
    selected: 'more'
  });
});

test('tab bar visibility remains permission-filtered when pages synchronize it', () => {
  const source = readFileSync(path.join(miniRoot, 'utils', 'tabbar.js'), 'utf8');
  const permissions = {
    isEmployeeWorkMode: (auth: any) => auth.session.role === 'employee',
    canAccessTab: (_auth: unknown, id: string) => id === 'orders'
  };
  const module = { exports: {} as Record<string, unknown> };
  vm.runInNewContext(source, {
    module,
    require(id: string) {
      if (id === './permissions') return permissions;
      throw new Error(`Unexpected module: ${id}`);
    }
  });
  const syncTabBar = module.exports.syncTabBar as (
    page: Record<string, any>,
    auth: Record<string, any>,
    selected: string
  ) => void;
  const calls: unknown[][] = [];
  const page = {
    getTabBar: () => ({
      setAccess(...args: unknown[]) {
        calls.push(args);
      }
    })
  };

  syncTabBar(page, { session: { role: 'merchant' } }, 'dashboard');
  syncTabBar(page, { session: { role: 'employee' } }, 'orders');

  const ownerTabs = calls[0][0] as Array<{ id: string }>;
  const employeeTabs = calls[1][0] as Array<{ id: string }>;
  assert.deepEqual(JSON.parse(JSON.stringify(ownerTabs.map(tab => tab.id))), ['dashboard', 'products', 'orders', 'more']);
  assert.deepEqual(JSON.parse(JSON.stringify(employeeTabs.map(tab => tab.id))), ['dashboard', 'orders', 'more']);
  assert.equal(calls[1][1], 'orders');
});

test('review build hides AI tabs, pages, and workspace modules until approval', () => {
  const workspace = readFileSync(path.join(miniRoot, 'utils', 'permissions.js'), 'utf8');
  const featureFlags = requireFromTest('../merchant-miniprogram/utils/feature-flags.js');
  const reviewFeatures = requireFromTest('../merchant-miniprogram/utils/review-features.js');
  const tabIds = (app.tabBar.list as Array<{ pagePath: string }>).map(item => item.pagePath);

  // 平台功能开关默认关闭（总后台未开启时保持评审期隐藏）。
  assert.equal(featureFlags.MODAUI_FLAG_DEFAULT, false);
  assert.equal(featureFlags.isModauiEnabled(), false);
  assert.equal(reviewFeatures.isWorkspaceEnabled('ai_home'), false);
  assert.equal(permissions.canAccessTab({ session: { role: 'merchant' } }, 'assistant'), false);
  for (const id of ['ai_home', 'tryon', 'ai_employees']) {
    assert.equal(permissions.canAccessWorkspace({ session: { role: 'merchant' } }, id), false);
  }
  assert.equal(tabIds.some(page => page.includes('assistant')), false);
  assert.equal((app.pages as string[]).some(page => page.includes('assistant') || page.includes('tryon')), false);
  assert.match(workspace, /isWorkspaceEnabled\(item\.id\)/);
});

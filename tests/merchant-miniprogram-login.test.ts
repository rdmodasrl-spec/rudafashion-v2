import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const miniProgramRoot = fileURLToPath(new URL('../merchant-miniprogram/', import.meta.url));
const loginSource = readFileSync(join(miniProgramRoot, 'pages/login/index.js'), 'utf8');
const loginTemplate = readFileSync(join(miniProgramRoot, 'pages/login/index.wxml'), 'utf8');
const permissionsSource = readFileSync(join(miniProgramRoot, 'utils/permissions.js'), 'utf8');
const tabBarSource = readFileSync(join(miniProgramRoot, 'custom-tab-bar/index.js'), 'utf8');
const requireFromTest = createRequire(import.meta.url);

function collectJavaScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : collectJavaScriptFiles(path);
    return entry.isFile() && entry.name.endsWith('.js') ? [path] : [];
  });
}

function createLoginPage(responses: Array<Record<string, unknown>>) {
  let definition: Record<string, any> | undefined;
  const requests: Array<{ path: string; options: Record<string, any> }> = [];
  const sessions: Array<{ role: string; response: Record<string, unknown> }> = [];
  const navigations: Array<Record<string, unknown>> = [];
  const flags: Array<{ source: string; force: boolean }> = [];

  runInNewContext(loginSource, {
    Page: (page: Record<string, any>) => { definition = page; },
    require: (specifier: string) => {
      if (specifier === '../../utils/api') {
        return {
          request: async (path: string, options: Record<string, any>) => {
            requests.push({ path, options });
            return responses.shift() || {};
          }
        };
      }
      if (specifier === '../../utils/auth') {
        return { saveSession: (role: string, response: Record<string, unknown>) => sessions.push({ role, response }) };
      }
      if (specifier === '../../utils/industry') {
        return { clearIndustryContext: () => undefined };
      }
      if (specifier === '../../utils/feature-flags') {
        return {
          refreshFeatureFlags: (options: Record<string, any>) => {
            flags.push({ source: 'login', force: options && options.force === true });
            return Promise.resolve({});
          }
        };
      }
      throw new Error(`Unexpected module: ${specifier}`);
    },
    wx: {
      showToast: (value: Record<string, unknown>) => navigations.push({ action: 'toast', ...value }),
      switchTab: (value: Record<string, unknown>) => navigations.push({ action: 'switchTab', ...value }),
      reLaunch: (value: Record<string, unknown>) => navigations.push({ action: 'reLaunch', ...value }),
      navigateTo: (value: Record<string, unknown>) => navigations.push({ action: 'navigateTo', ...value })
    }
  });

  assert.ok(definition);
  const page = Object.assign({}, definition, {
    data: Object.assign({}, definition.data),
    setData(update: Record<string, unknown>) {
      Object.assign(this.data, update);
    }
  });
  return { page, requests, sessions, navigations, flags };
}

function acceptLoginLegalDocuments(page: Record<string, any>) {
  page.onLegalConsentChange({ detail: { value: ['terms', 'privacy'] } });
}

test('merchant mini program login uses one account form without a role selector', () => {
  assert.match(loginTemplate, /class="login-card card"/);
  assert.match(loginTemplate, /class="page-title">企业中心/);
  assert.doesNotMatch(loginTemplate, /RUDA FASHION|MERCHANT PORTAL|商家工作台/);
  assert.doesNotMatch(loginTemplate, /login-subtitle/);
  assert.match(loginTemplate, /placeholder="邮箱、手机号或商家编码"/);
  assert.doesNotMatch(loginTemplate, /data-role=|role-switch/);
  assert.doesNotMatch(loginTemplate, /login-privacy-note|手机号由你主动输入并提交/);
  assert.match(loginTemplate, /《用户服务协议》/);
  assert.match(loginTemplate, /《隐私政策》/);
  assert.match(loginTemplate, /bindchange="onLegalConsentChange"/);
  const loginMode = loginTemplate.split('<block wx:else>')[1];
  assert.ok(loginMode.indexOf('class="login-consent-group"') < loginMode.indexOf('bindtap="onSubmit"'));
  assert.ok(loginMode.indexOf('class="login-consent-group"') < loginMode.indexOf('bindtap="openEnterpriseRegistration"'));
  const resetMode = loginTemplate.split('<block wx:if="{{resetMode}}">')[1].split('</block>\n      <block wx:else>')[0];
  assert.ok(resetMode.indexOf('class="login-consent-group"') < resetMode.indexOf('bindtap="requestPasswordResetCode"'));
  assert.doesNotMatch(loginSource, /selectRole|auth\/login\/\$\{/);
  assert.match(loginSource, /onLegalConsentChange/);
  assert.match(loginSource, /请先阅读并同意用户服务协议和隐私政策/);
  assert.match(readFileSync(join(miniProgramRoot, 'pages/login/index.wxss'), 'utf8'), /\.page-title\s*\{[^}]*font-size:\s*44rpx/s);
  assert.match(loginTemplate, /bindtap="onSubmit"/);
});

test('merchant login offers a small enterprise registration link and a password reset flow', () => {
  const loginStyles = readFileSync(join(miniProgramRoot, 'pages/login/index.wxss'), 'utf8');
  assert.match(loginTemplate, /class="text-button forgot-password-link" bindtap="openForgotPassword"/);
  assert.match(loginTemplate, /class="text-button registration-button" bindtap="openEnterpriseRegistration">邮箱注册<\/text>/);
  assert.match(loginStyles, /\.forgot-password-link,\s*\.registration-button\s*\{[^}]*font-size:\s*22rpx/s);
  assert.match(loginTemplate, /bindtap="requestPasswordResetCode"/);
  assert.match(loginTemplate, /bindtap="submitPasswordReset"/);
  assert.match(loginSource, /\/api\/auth\/login\/merchant\/password-reset\/request/);
  assert.match(loginSource, /\/api\/auth\/login\/merchant\/password-reset\/complete/);
});

test('登录成功后按新令牌强制刷新平台功能开关', async () => {
  const { page, flags } = createLoginPage([
    { success: true, accountType: 'merchant', token: 'merchant-token', merchant: { id: 'merchant-1' } }
  ]);
  page.onAccountInput({ detail: { value: 'owner@example.test' } });
  page.onPasswordInput({ detail: { value: 'password' } });
  acceptLoginLegalDocuments(page);
  await page.onSubmit();
  assert.equal(flags.length, 1);
  assert.equal(flags[0].force, true);
});

test('employee identity is detected automatically and supports merchant selection', async () => {
  const employeeResponse = {
    success: true,
    accountType: 'employee',
    token: 'employee-token',
    employee: { id: 'employee-1' }
  };
  const { page, requests, sessions, navigations } = createLoginPage([
    { accountType: 'employee', requiresMerchantSelection: true, merchants: [{ id: 'merchant-1', name: 'RUDA' }] },
    employeeResponse
  ]);

  page.onAccountInput({ detail: { value: 'staff@example.test' } });
  page.onPasswordInput({ detail: { value: 'password' } });
  acceptLoginLegalDocuments(page);
  await page.onSubmit();

  assert.equal(requests[0].path, '/api/miniprogram/auth/login');
  assert.equal(requests[0].options.auth, false);
  assert.equal(requests[0].options.data.account, 'staff@example.test');
  assert.equal(requests[0].options.data.password, 'password');
  assert.equal(requests[0].options.data.account, 'staff@example.test');
  assert.equal(requests[0].options.data.password, 'password');
  assert.equal('acceptedTerms' in requests[0].options.data, false);
  assert.equal('acceptedPrivacy' in requests[0].options.data, false);
  assert.equal(page.data.merchantChoices.length, 1);

  await page.selectMerchant({ currentTarget: { dataset: { id: 'merchant-1' } } });
  assert.equal(requests[1].path, '/api/miniprogram/auth/login');
  assert.equal(requests[1].options.data.merchantId, 'merchant-1');
  assert.equal(sessions[0].role, 'employee');
  assert.equal(sessions[0].response.accountType, 'employee');
  assert.equal(sessions[0].response.token, 'employee-token');
  const workbenchNavigation = navigations.find(item => item.action === 'reLaunch');
  assert.equal(workbenchNavigation?.url, '/pages/industry/index');
});

test('merchant login requires privacy and service agreement consent before sending login details', async () => {
  const { page, requests } = createLoginPage([{ accountType: 'merchant', token: 'merchant-token' }]);
  page.onAccountInput({ detail: { value: '+393331234567' } });
  page.onPasswordInput({ detail: { value: 'password' } });

  await page.onSubmit();
  assert.equal(requests.length, 0);
  assert.match(page.data.error, /阅读并同意用户服务协议和隐私政策/);

  acceptLoginLegalDocuments(page);
  await page.onSubmit();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.data.account, '+393331234567');
});

test('password reset requests a code by email and submits the verified code with a new password', async () => {
  const { page, requests, navigations } = createLoginPage([{}, { success: true }]);

  page.openForgotPassword();
  page.onResetInput({ currentTarget: { dataset: { field: 'resetEmail' } }, detail: { value: 'MERCHANT@example.test' } });
  await page.requestPasswordResetCode();
  assert.equal(requests.length, 0);
  assert.match(page.data.error, /阅读并同意用户服务协议和隐私政策/);
  acceptLoginLegalDocuments(page);
  await page.requestPasswordResetCode();
  assert.equal(requests[0].path, '/api/auth/login/merchant/password-reset/request');
  assert.equal(requests[0].options.data.email, 'merchant@example.test');
  assert.equal(requests[0].options.auth, false);
  assert.equal(page.data.resetCodeSent, true);

  page.onResetInput({ currentTarget: { dataset: { field: 'resetCode' } }, detail: { value: '123456' } });
  page.onResetInput({ currentTarget: { dataset: { field: 'resetPassword' } }, detail: { value: 'new-password-123' } });
  await page.submitPasswordReset();
  assert.equal(requests[1].path, '/api/auth/login/merchant/password-reset/complete');
  assert.equal(requests[1].options.data.email, 'merchant@example.test');
  assert.equal(requests[1].options.data.code, '123456');
  assert.equal(requests[1].options.data.password, 'new-password-123');
  assert.equal(page.data.resetMode, false);
  assert.equal(page.data.account, 'merchant@example.test');
  assert.equal(navigations.some(item => item.title === '密码已重置，请登录'), true);
});

test('merchant identity is detected automatically from the same account field', async () => {
  const merchantResponse = {
    success: true,
    accountType: 'merchant',
    token: 'merchant-token',
    merchant: { id: 'merchant-1' }
  };
  const { page, requests, sessions } = createLoginPage([merchantResponse]);

  page.onAccountInput({ detail: { value: 'RUDA-STORE-1' } });
  page.onPasswordInput({ detail: { value: 'password' } });
  acceptLoginLegalDocuments(page);
  await page.onSubmit();

  assert.equal(requests[0].path, '/api/miniprogram/auth/login');
  assert.equal(requests[0].options.data.account, 'RUDA-STORE-1');
  assert.equal(sessions[0].role, 'merchant');
});

test('isolated merchant, employee, and partner demo credentials are listed', async () => {
  const response = {
    enabled: true,
    password: 'demo-test-password',
    partnerUrl: 'https://modaui.com/partner',
    accounts: [
      { type: 'merchant', label: '商家', email: 'merchant.demo@ruda.test' },
      { type: 'employee', label: '员工', email: 'employee.demo@ruda.test' },
      { type: 'partner', label: '代理', email: 'agent.demo@ruda.test' }
    ]
  };
  const { page, requests, navigations } = createLoginPage([response]);

  await page.loadDemoCredentials();
  assert.equal(requests[0].path, '/api/miniprogram/auth/demo-credentials');
  assert.equal(requests[0].options.auth, false);
  assert.equal(page.data.demoCredentials.accounts.length, 3);
  assert.equal(page.data.demoCredentials.password, response.password);
  assert.equal(page.data.demoCredentials.partnerUrl, response.partnerUrl);

  page.useDemoCredentials({ currentTarget: { dataset: { email: 'employee.demo@ruda.test' } } });
  assert.equal(page.data.account, 'employee.demo@ruda.test');
  assert.equal(page.data.password, response.password);
  page.openPartnerDemo();
  assert.deepEqual(navigations.find(item => item.action === 'navigateTo'), {
    action: 'navigateTo',
    url: '/pages/enterprise-register/index?portal=partner'
  });

  const loginTemplate = readFileSync(join(miniProgramRoot, 'pages/login/index.wxml'), 'utf8');
  assert.match(loginTemplate, /demoCredentials\.accounts/);
  assert.match(loginTemplate, /openPartnerDemo/);
});

test('employee workspaces and tabs are limited to granted permissions', () => {
  const module = { exports: {} as Record<string, any> };
  runInNewContext(permissionsSource, {
    module,
    exports: module.exports,
    require(specifier: string) {
      if (specifier === './review-features') return requireFromTest('../merchant-miniprogram/utils/review-features.js');
      throw new Error(`Unexpected module: ${specifier}`);
    }
  });
  const permissions = module.exports;
  const employee = {
    session: { role: 'employee' },
    response: { employee: { role: 'warehouse', permissions: ['warehouse.pick', 'warehouse.ship'] } }
  };

  assert.equal(permissions.canAccessTab(employee, 'orders'), true);
  assert.equal(permissions.canAccessTab(employee, 'products'), false);
  assert.equal(permissions.canAccessTab(employee, 'assistant'), false);
  assert.equal(permissions.canAccessWorkspace(employee, 'inventory'), true);
  assert.equal(permissions.canAccessWorkspace(employee, 'finance'), false);
  const catalogReader = {
    session: { role: 'employee' },
    response: { employee: { role: 'custom', permissions: ['product.catalog.read'] } }
  };
  assert.equal(permissions.canAccessTab(catalogReader, 'products'), true);
  assert.equal(permissions.canAccessPermissions(catalogReader, ['product.publish']), false);

  let component: Record<string, any> | undefined;
  runInNewContext(tabBarSource, {
    Component: (definition: Record<string, any>) => { component = definition; },
    require: (specifier: string) => {
      if (specifier === '../utils/permissions') return permissions;
      throw new Error(`Unexpected module: ${specifier}`);
    }
  });
  assert.ok(component);
  const visibleTabs: string[] = [];
  const tabBar = Object.assign({}, component.methods, {
    data: Object.assign({}, component.data),
    setData(update: Record<string, any>) {
      Object.assign(this.data, update);
    }
  });
  tabBar.setAccess(employee, 'orders');
  tabBar.data.list.forEach((tab: { id: string }) => visibleTabs.push(tab.id));
  assert.deepEqual(visibleTabs, ['dashboard', 'more']);
});

test('merchant mini program JavaScript avoids SWC object spread helpers', () => {
  const sourceFiles = collectJavaScriptFiles(miniProgramRoot).filter(file =>
    !file.includes('/pages/assistant/') && !file.includes('/pages/tryon/')
  );
  assert.ok(sourceFiles.length > 0);
  for (const file of sourceFiles) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /\.\.\./, `${file} must not use spread syntax`);
    assert.doesNotMatch(source, /[,{]\s*\[[^\]]+\]\s*:/, `${file} must not use computed object keys`);
  }
});

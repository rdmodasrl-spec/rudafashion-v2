import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const root = new URL('../miniprogram/', import.meta.url);
const loginSource = readFileSync(new URL('pages/login/index.js', root), 'utf8');
const loginTemplate = readFileSync(new URL('pages/login/index.wxml', root), 'utf8');
const serverSource = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const app = JSON.parse(readFileSync(new URL('app.json', root), 'utf8'));

function createLoginHarness() {
  let definition: Record<string, any> | undefined;
  const calls: Array<{ name: string; args: unknown[] }> = [];
  const pageInstance = {
    Page: (page: Record<string, any>) => { definition = page; },
    require: () => ({
      bindWechatIdentity: async (...args: unknown[]) => { calls.push({ name: 'bindWechatIdentity', args }); return {}; },
      login: async (...args: unknown[]) => { calls.push({ name: 'login', args }); return {}; },
      loginWithWechat: async (...args: unknown[]) => { calls.push({ name: 'loginWithWechat', args }); return {}; },
      getAuthSession: () => null,
      saveAuthSession: () => {}
    }),
    wx: {
      login: (options: { success: (value: { code: string }) => void }) => options.success({ code: 'single-use-code' }),
      switchTab: () => {},
      navigateTo: () => {},
      showToast: () => {},
      showModal: () => {}
    }
  };
  runInNewContext(loginSource, pageInstance);
  assert.ok(definition);
  const page = Object.assign({}, definition, {
    data: Object.assign({}, definition.data),
    setData(update: Record<string, unknown>) { Object.assign(this.data, update); }
  });
  return { page, calls };
}

test('buyer password and WeChat login do not require registration consent', async () => {
  const { page, calls } = createLoginHarness();

  page.onAccountInput({ detail: { value: '+390000000000' } });
  page.onPasswordInput({ detail: { value: 'password' } });
  await page.onSubmit();
  await page.onWechatLogin();
  assert.equal(calls.length, 2);
  assert.match(loginTemplate, /wx:if="\{\{registerMode \? registerStep === 1 : selectedRole !== 'buyer'\}\}" class="legal-consent"/);
  assert.equal(calls[0].name, 'login');
  const credentials = calls[0].args[1] as Record<string, unknown>;
  assert.equal(credentials.password, 'password');
  assert.equal(credentials.phone, '+390000000000');
  assert.equal(calls[1].name, 'loginWithWechat');
  assert.equal(calls[1].args[0], 'single-use-code');
  assert.equal(calls[1].args.length, 1);
});

test('registration surfaces retain agreement and privacy consent', () => {
  const merchantRegistration = readFileSync(new URL('../merchant-miniprogram/pages/enterprise-register/index.wxml', import.meta.url), 'utf8');
  const consumerRegistration = readFileSync(new URL('../src/apps/shared/components/consumer/ConsumerAuth.tsx', import.meta.url), 'utf8');
  const merchantApp = JSON.parse(readFileSync(new URL('../merchant-miniprogram/app.json', import.meta.url), 'utf8'));
  for (const pages of [app.pages, merchantApp.pages]) {
    assert.ok(pages.includes('pages/privacy/index'));
    assert.ok(pages.includes('pages/service-agreement/index'));
  }
  assert.match(merchantRegistration, /我已阅读并同意/);
  assert.match(consumerRegistration, /我已阅读并同意/);
  assert.doesNotMatch(merchantRegistration, /font-size:\s*22rpx/);
});

test('login endpoints do not require registration consent; registration and orders still do', () => {
  assert.match(serverSource, /api\/miniprogram\/auth\/login\/buyer', \(req, res\)/);
  assert.match(serverSource, /api\/miniprogram\/auth\/login\/merchant', \(req, res\)/);
  assert.match(serverSource, /api\/miniprogram\/auth\/login\/employee', \(req, res\)/);
  assert.match(serverSource, /api\/miniprogram\/auth\/wechat\/login', async/);
  assert.match(serverSource, /api\/miniprogram\/auth\/wechat\/bind', requireBuyerAuth/);
  assert.match(serverSource, /app\.post\('\/api\/consumers\/register', async \(req, res\) => \{\s*if \(req\.body\?\.acceptedTerms !== true \|\| req\.body\?\.acceptedPrivacy !== true\)/);
  assert.match(serverSource, /input\.miniprogram === true[\s\S]*input\.acceptedTerms !== true \|\| input\.acceptedPrivacy !== true/);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const settingsSource = readFileSync(new URL('../miniprogram/pages/settings/index.js', import.meta.url), 'utf8');
const miniProgramConfig = JSON.parse(readFileSync(new URL('../miniprogram/app.json', import.meta.url), 'utf8'));
const merchantProjectConfig = JSON.parse(readFileSync(new URL('../merchant-miniprogram/project.config.json', import.meta.url), 'utf8'));
const settingsTemplate = readFileSync(new URL('../miniprogram/pages/settings/index.wxml', import.meta.url), 'utf8');

function createSettingsHarness() {
  let definition: Record<string, any> | undefined;
  const navigations: Array<Record<string, any>> = [];
  const toasts: string[] = [];
  const context = {
    Page(value: Record<string, any>) {
      definition = value;
    },
    require(specifier: string) {
      if (specifier === '../../utils/auth') return { clearAuthSession() {}, getAuthSession: () => null };
      if (specifier === '../../utils/preferences') {
        return {
          LANGUAGES: [],
          CURRENCIES: [],
          getPreferences() {},
          getPreferenceIdentity() {},
          loadPreferencesFromAccount() {},
          loadExchangeRates() {},
          saveLocalPreferences() {},
          savePreferences() {}
        };
      }
      if (specifier === '../../utils/api') {
        return {
          activateFashionAccount() {},
          getAssetUrl: (value: string) => value,
          getFashionAccountMe() {},
          updateFashionAccountProfile() {}
        };
      }
      throw new Error(`Unexpected module ${specifier}`);
    },
    wx: {
      navigateToMiniProgram(options: Record<string, any>) {
        navigations.push(options);
      },
      showToast(options: { title: string }) {
        toasts.push(options.title);
      }
    },
    console: { error() {} }
  };
  runInNewContext(settingsSource, context);
  assert.ok(definition);
  return { page: definition, navigations, toasts };
}

test('enterprise center opens the existing merchant mini program release', () => {
  const { page, navigations } = createSettingsHarness();
  page.openEnterpriseCenter();
  assert.equal(navigations.length, 1);
  assert.equal(navigations[0].appId, merchantProjectConfig.appid);
  assert.equal(navigations[0].path, 'pages/dashboard/index');
  assert.equal(navigations[0].envVersion, 'release');
  assert.ok(miniProgramConfig.navigateToMiniProgramAppIdList.includes(merchantProjectConfig.appid));
  assert.match(settingsTemplate, /打开 RUDA 商家后台小程序/);
  assert.doesNotMatch(settingsTemplate, /hasMerchantAccess \?/);
});

test('enterprise center reports a clear message when WeChat cannot open the merchant app', () => {
  const { page, navigations, toasts } = createSettingsHarness();
  page.openEnterpriseCenter();
  navigations[0].fail(new Error('MINIPROGRAM_NOT_AVAILABLE'));
  assert.deepEqual(toasts, ['暂时无法打开商家后台，请稍后重试']);
});

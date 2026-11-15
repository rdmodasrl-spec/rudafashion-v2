import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const registrationPage = readFileSync(new URL('../merchant-miniprogram/pages/enterprise-register/index.js', import.meta.url), 'utf8');
const registrationTemplate = readFileSync(new URL('../merchant-miniprogram/pages/enterprise-register/index.wxml', import.meta.url), 'utf8');
const serverSource = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

test('registration does not request or verify a phone/email before both legal consents', async () => {
  let definition: Record<string, any> | undefined;
  const requests: string[] = [];
  runInNewContext(registrationPage, {
    Page: (value: Record<string, any>) => { definition = value; },
    require(specifier: string) {
      if (specifier === '../../utils/api') return { request: async (path: string) => { requests.push(path); return {}; } };
      if (specifier === '../../utils/constants') return { PUBLIC_SITE_URL: 'https://modaui.example.test' };
      throw new Error(`Unexpected module: ${specifier}`);
    },
    wx: { showToast() {}, navigateBack() {}, setNavigationBarTitle() {} },
    setInterval,
    clearInterval
  });
  assert.ok(definition);
  const page = Object.assign({}, definition, {
    data: Object.assign({}, definition.data),
    setData(update: Record<string, unknown>) {
      for (const [path, value] of Object.entries(update)) {
        const [parent, key] = path.split('.');
        if (key) this.data[parent][key] = value;
        else this.data[path] = value;
      }
    }
  });

  await page.requestVerification();
  assert.equal(requests.length, 0);
  assert.match(page.data.error, /再获取验证码/);

  await page.verifyContact();
  assert.equal(requests.length, 0);
  assert.match(page.data.error, /阅读并同意用户服务协议和隐私政策/);
});

test('enterprise registration accepts and verifies one email address', async () => {
  let definition: Record<string, any> | undefined;
  const requests: Array<{ path: string; options: Record<string, any> }> = [];
  runInNewContext(registrationPage, {
    Page: (value: Record<string, any>) => { definition = value; },
    require(specifier: string) {
      if (specifier === '../../utils/api') return {
        request: async (path: string, options: Record<string, any>) => {
          requests.push({ path, options });
          return { retryAfter: 60 };
        }
      };
      if (specifier === '../../utils/constants') return { PUBLIC_SITE_URL: 'https://modaui.example.test' };
      throw new Error(`Unexpected module: ${specifier}`);
    },
    wx: { showToast() {}, navigateBack() {}, setNavigationBarTitle() {} },
    setInterval: () => 1,
    clearInterval() {}
  });
  assert.ok(definition);
  const page = Object.assign({}, definition, {
    data: Object.assign({}, definition.data),
    setData(update: Record<string, unknown>) {
      for (const [path, value] of Object.entries(update)) {
        const [parent, key] = path.split('.');
        if (key) this.data[parent][key] = value;
        else this.data[path] = value;
      }
    }
  });
  page.onFormInput({
    currentTarget: { dataset: { field: 'email' } },
    detail: { value: '  OWNER@EXAMPLE.COM  ' }
  });
  page.onConsentChange({ detail: { value: ['terms', 'privacy'] } });

  assert.equal(page.data.form.email, '  OWNER@EXAMPLE.COM  ');
  assert.equal(page.getVerificationDestination(), 'owner@example.com');
  await page.requestVerification();

  assert.equal(requests.length, 1);
  assert.equal(requests[0].path, '/api/auth/register/company/request-verification');
  assert.deepEqual(
    JSON.parse(JSON.stringify(requests[0].options.data)),
    { channel: 'email', destination: 'owner@example.com' }
  );
});

test('mini-program registration loads the shared formal industry options and submits a restaurant identity', async () => {
  let definition: Record<string, any> | undefined;
  const requests: Array<{ path: string; options: Record<string, any> }> = [];
  const industries = [{
    id: 'RETAIL_RESTAURANT',
    label: '餐饮',
    businessModel: 'RETAIL',
    capabilityIds: [],
    categories: ['RESTAURANT', 'CAFE', 'TAKEAWAY', 'BAKERY', 'CATERING', 'OTHER']
  }];
  runInNewContext(registrationPage, {
    Page: (value: Record<string, any>) => { definition = value; },
    require(specifier: string) {
      if (specifier === '../../utils/api') return {
        request: async (path: string, options: Record<string, any>) => {
          requests.push({ path, options });
          if (path === '/api/merchant/industry-options') return { success: true, industries };
          return { success: true, status: 'ACTIVE', merchantLoginAvailable: true };
        }
      };
      if (specifier === '../../utils/constants') return { PUBLIC_SITE_URL: 'https://modaui.example.test' };
      throw new Error(`Unexpected module: ${specifier}`);
    },
    wx: { showToast() {}, navigateBack() {}, setNavigationBarTitle() {} },
    setInterval: () => 1,
    clearInterval() {}
  });
  assert.ok(definition);
  const page = Object.assign({}, definition, {
    data: Object.assign({}, definition.data, { form: { ...definition.data.form } }),
    setData(update: Record<string, unknown>) {
      for (const [path, value] of Object.entries(update)) {
        const [parent, key] = path.split('.');
        if (key) this.data[parent][key] = value;
        else this.data[path] = value;
      }
    }
  });
  page.data.form.email = 'owner@example.com';
  page.data.form.password = 'valid-password';
  page.data.form.displayName = 'Sample Restaurant';
  page.data.form.country = 'Italy';
  page.data.form.city = 'Prato';
  page.data.form.acceptedTerms = true;
  page.data.form.acceptedPrivacy = true;
  page.data.verificationToken = 'verified-registration-token';

  await page.loadIndustryOptions();
  assert.equal(requests[0].path, '/api/merchant/industry-options');
  page.onIndustryChange({ detail: { value: 0 } });
  assert.equal(page.data.industry, 'RETAIL_RESTAURANT');
  assert.equal(page.data.role, 'RESTAURANT_OPERATOR');
  assert.deepEqual(JSON.parse(JSON.stringify(page.data.roleOptions.map((option: { id: string }) => option.id))), ['RESTAURANT_OPERATOR']);
  assert.deepEqual(JSON.parse(JSON.stringify(page.data.categoryOptions.map((option: { id: string }) => option.id))), [
    'RESTAURANT', 'CAFE', 'TAKEAWAY', 'BAKERY', 'CATERING', 'OTHER'
  ]);
  page.toggleCategory({ currentTarget: { dataset: { id: 'TAKEAWAY' } } });
  await page.submitRegistration();

  assert.equal(requests.length, 2);
  assert.equal(requests[1].path, '/api/auth/register/company');
  assert.deepEqual(JSON.parse(JSON.stringify(requests[1].options.data.roles)), ['RESTAURANT_OPERATOR']);
  assert.deepEqual(JSON.parse(JSON.stringify(requests[1].options.data.categories)), ['TAKEAWAY']);
  assert.equal(requests[1].options.data.formalIndustryId, 'RETAIL_RESTAURANT');
  assert.deepEqual(JSON.parse(JSON.stringify(requests[1].options.data.capabilityIds)), []);
  assert.equal(requests[1].options.data.industryTemplate, undefined);
});

test('apparel registration exposes optional own-production capability and submits formal identity', async () => {
  let definition: Record<string, any> | undefined;
  const requests: Array<{ path: string; options: Record<string, any> }> = [];
  const industries = [{
    id: 'WHOLESALE_APPAREL',
    label: '服装批发',
    businessModel: 'WHOLESALE',
    capabilityIds: ['APPAREL_OWN_PRODUCTION'],
    categories: ['WOMENSWEAR', 'MENSWEAR', 'OTHER']
  }];
  runInNewContext(registrationPage, {
    Page: (value: Record<string, any>) => { definition = value; },
    require(specifier: string) {
      if (specifier === '../../utils/api') return {
        request: async (path: string, options: Record<string, any>) => {
          requests.push({ path, options });
          if (path === '/api/merchant/industry-options') return { success: true, industries };
          return { success: true, status: 'ACTIVE', merchantLoginAvailable: true };
        }
      };
      if (specifier === '../../utils/constants') return { PUBLIC_SITE_URL: 'https://modaui.example.test' };
      throw new Error(`Unexpected module: ${specifier}`);
    },
    wx: { showToast() {}, navigateBack() {}, setNavigationBarTitle() {} },
    setInterval: () => 1,
    clearInterval() {}
  });
  assert.ok(definition);
  const page = Object.assign({}, definition, {
    data: Object.assign({}, definition.data, { form: { ...definition.data.form } }),
    setData(update: Record<string, unknown>) {
      for (const [path, value] of Object.entries(update)) {
        const [parent, key] = path.split('.');
        if (key) this.data[parent][key] = value;
        else this.data[path] = value;
      }
    }
  });
  page.data.form.displayName = 'Sample Apparel';
  page.data.form.acceptedTerms = true;
  page.data.form.acceptedPrivacy = true;
  page.data.verificationToken = 'verified-registration-token';
  await page.loadIndustryOptions();
  page.onIndustryChange({ detail: { value: 0 } });
  assert.equal(page.data.industry, 'WHOLESALE_APPAREL');
  assert.deepEqual(JSON.parse(JSON.stringify(page.data.roleOptions.map((option: { id: string }) => option.id))), ['PRODUCER', 'WHOLESALER']);
  assert.equal(page.data.capabilityOptions[0].label, '启用自有服装生产');
  page.onCapabilityChange({ detail: { value: ['APPAREL_OWN_PRODUCTION'] } });
  page.toggleRole({ currentTarget: { dataset: { id: 'WHOLESALER' } } });
  page.toggleCategory({ currentTarget: { dataset: { id: 'WOMENSWEAR' } } });
  await page.submitRegistration();

  const submission = requests.find(request => request.path === '/api/auth/register/company');
  assert.ok(submission);
  assert.equal(submission.options.data.formalIndustryId, 'WHOLESALE_APPAREL');
  assert.deepEqual(JSON.parse(JSON.stringify(submission.options.data.capabilityIds)), ['APPAREL_OWN_PRODUCTION']);
  assert.equal(submission.options.data.industryTemplate, undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(submission.options.data.categories)), ['WOMENSWEAR']);
});

test('merchant mini-program registration is a native two-step enterprise flow', () => {
  assert.match(registrationTemplate, /step === 1/);
  assert.match(registrationTemplate, /step === 2/);
  assert.match(registrationTemplate, /补充资料（选填）/);
  assert.doesNotMatch(registrationPage, /deferEmailVerification|emailVerificationDeferred/);
  assert.match(registrationPage, /\/api\/auth\/register\/company\/request-verification/);
  assert.match(registrationPage, /\/api\/auth\/register\/company\/verify/);
  assert.match(registrationPage, /\/api\/auth\/register\/company/);
  assert.match(registrationPage, /\/api\/merchant\/industry-options/);
  assert.match(registrationPage, /formalIndustryId: industry/);
  assert.match(registrationPage, /id: 'RESTAURANT_OPERATOR', label: '餐饮经营者'/);
  assert.match(registrationTemplate, /邮箱注册/);
  assert.match(registrationTemplate, /class="field-label">邮箱 /);
  assert.doesNotMatch(registrationTemplate, /企业邮箱/);
  assert.match(registrationTemplate, /data-field="email" value="{{form\.email}}"/);
  assert.match(registrationTemplate, /class="password-field email-field"[\s\S]*?class="form-input email-address-input"[\s\S]*?class="email-verify-button"[^>]*>验证<\/button>/);
  assert.doesNotMatch(registrationTemplate, /手机号验证|data-field="phone"|phone-country-picker/);
  assert.doesNotMatch(registrationPage, /verificationMethod|onVerificationMethodChange|onPhoneCountryChange/);
  assert.match(
    readFileSync(new URL('../merchant-miniprogram/pages/enterprise-register/index.wxss', import.meta.url), 'utf8'),
    /\.email-verify-button\s*\{[^}]*position:\s*absolute/s
  );
  assert.doesNotMatch(registrationTemplate, /class="privacy-note"|手机号由你主动填写/);
  assert.match(registrationTemplate, /《用户服务协议》/);
  assert.match(registrationTemplate, /《隐私政策》/);
  assert.equal((registrationTemplate.match(/class="consent-group"/g) || []).length, 1);
  assert.match(
    registrationTemplate,
    /<\/block>\s*<view wx:if="\{\{error\}\}" class="form-error">\{\{error\}\}<\/view>\s*<checkbox-group class="consent-group"[\s\S]*?《用户服务协议》[\s\S]*?《隐私政策》[\s\S]*?<\/checkbox-group>\s*<view class="form-actions">/
  );
  assert.ok(
    registrationTemplate.indexOf('class="consent-group"') > registrationTemplate.indexOf('<block wx:elif="{{step === 2}}"')
  );
  assert.ok(registrationTemplate.indexOf('class="consent-group"') < registrationTemplate.indexOf('bindtap="submitRegistration"'));
  assert.doesNotMatch(registrationPage, /register-wholesale|MERCHANT_REGISTRATION_URL/);
  assert.match(
    registrationPage,
    /options\.portal === 'merchant-registration'[\s\S]{0,200}?wx\.setNavigationBarTitle\(\{ title: '商家注册' \}\);/
  );
  assert.match(registrationPage, /async requestVerification\(\)[\s\S]*?请先阅读并同意用户服务协议和隐私政策，再获取验证码/);
  assert.match(registrationPage, /async verifyContact\(\)[\s\S]*?请先阅读并同意用户服务协议和隐私政策/);
  assert.match(serverSource, /if \(registrationConfig\.requireVerification \|\| f\.verificationToken\)/);
  assert.match(serverSource, /app\.get\('\/api\/merchant\/industry-options'[\s\S]{0,180}?getMerchantIndustryRegistrationOptions/);
  assert.doesNotMatch(serverSource, /deferEmailVerification/);
});

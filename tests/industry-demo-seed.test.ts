import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEMO_ACCOUNT_PASSWORD_ENV,
  DEMO_SEED_CONFIRMATION,
  demoMerchantSeeds
} from '../scripts/seed-industry-demo-merchants.js';
import {
  getMerchantIndustryDemoEmail,
  merchantIndustryDemoAccounts
} from '../src/constants/merchantIndustryDemoAccounts.js';
import {
  merchantIndustryTemplates,
  openMerchantIndustryTemplates
} from '../src/constants/merchantIndustryTemplates.js';
import { getMerchantIndustryCapability } from '../src/constants/merchantIndustryCapabilities.js';

test('industry demo seed covers the seven open industry templates exactly once', () => {
  assert.equal(demoMerchantSeeds.length, 7);
  assert.deepEqual(
    demoMerchantSeeds.map(seed => seed.templateId).sort(),
    merchantIndustryTemplates.map(template => template.id).sort()
  );
  assert.deepEqual(
    demoMerchantSeeds.map(seed => seed.templateId).sort(),
    openMerchantIndustryTemplates.map(template => template.id).sort()
  );
});

test('industry demo seed uses one isolated email and store identity per industry', () => {
  const emails = demoMerchantSeeds.map(seed => getMerchantIndustryDemoEmail(seed.templateId));
  assert.equal(new Set(emails).size, emails.length);
  for (const email of emails) {
    assert.match(email || '', /^00[1-7]@ruda\.fashion$/);
  }
  assert.deepEqual(
    merchantIndustryDemoAccounts.map(account => account.code),
    ['001', '002', '003', '004', '005', '006', '007']
  );
  assert.deepEqual(
    merchantIndustryDemoAccounts.map(account => account.templateId),
    demoMerchantSeeds.map(seed => seed.templateId)
  );
  const keys = demoMerchantSeeds.map(seed => seed.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const key of keys) {
    assert.match(key, /^[a-z-]+$/);
  }
});

test('industry demo seed requires explicit confirmation and a password supplied by the environment', () => {
  assert.equal(DEMO_SEED_CONFIRMATION, 'CREATE_RUDA_INDUSTRY_DEMO_MERCHANTS');
  assert.equal(DEMO_ACCOUNT_PASSWORD_ENV, 'INDUSTRY_DEMO_ACCOUNT_PASSWORD');
});

test('industry demo products match the capability requirements of their template', () => {
  for (const seed of demoMerchantSeeds) {
    const capability = getMerchantIndustryCapability(seed.templateId);
    assert.ok(capability, `missing capability for ${seed.templateId}`);
    assert.equal(seed.products.length, 3);
    const attributeKeys = new Set(
      capability.productFields
        .filter(field => !field.column && field.type !== 'media' && field.type !== 'variants')
        .map(field => field.key)
    );
    const requiredAttributeKeys = capability.productFields
      .filter(field => field.required && !field.column && field.type !== 'media' && field.type !== 'variants')
      .map(field => field.key);
    for (const product of seed.products) {
      const attributes = product.attributes || {};
      for (const key of Object.keys(attributes)) {
        assert.ok(attributeKeys.has(key), `${seed.templateId}: unexpected attribute ${key}`);
      }
      for (const key of requiredAttributeKeys) {
        assert.ok(attributes[key], `${seed.templateId}: missing required attribute ${key}`);
      }
      assert.ok(product.name.length > 0);
      assert.ok(product.category.length > 0);
      if (capability.pricing.primary === 'retail') {
        assert.ok(product.rrpPrice > 0, `${seed.templateId}: retail industry needs a retail price`);
      } else {
        assert.ok(product.wholesalePrice > 0, `${seed.templateId}: wholesale industry needs a wholesale price`);
      }
    }
  }
});

test('only the department chain demo merchant seeds physical stores', () => {
  const withStores = demoMerchantSeeds.filter(seed => (seed.stores || []).length > 0);
  assert.deepEqual(withStores.map(seed => seed.templateId), ['department_chain_retail']);
  assert.deepEqual(withStores[0].stores?.map(store => store.code), ['MILANO-01', 'ROMA-01']);
  for (const seed of demoMerchantSeeds.filter(item => item !== withStores[0])) {
    assert.equal((seed.stores || []).length, 0, `${seed.templateId} must not seed stores`);
  }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getMerchantStorefrontTemplate,
  isMerchantStorefrontTemplate,
  MERCHANT_STOREFRONT_TEMPLATES,
  isStorefrontTemplateAllowedForIndustry,
  withMerchantStorefrontTemplate
} from '../src/shared/merchantStorefrontTemplate';

test('merchant storefront templates expose the three supported themes', () => {
  assert.deepEqual(MERCHANT_STOREFRONT_TEMPLATES.map(template => template.id), [
    'fashion_monochrome',
    'luxury_black_gold',
    'ecommerce_standard'
  ]);
  assert.ok(MERCHANT_STOREFRONT_TEMPLATES.every(template => template.name && template.description && template.colors.length === 3));
});

test('storefront template validation only accepts supported identifiers', () => {
  assert.equal(isMerchantStorefrontTemplate('luxury_black_gold'), true);
  assert.equal(isMerchantStorefrontTemplate('bags_editorial'), true);
  assert.equal(isMerchantStorefrontTemplate('apparel_line_sheet'), true);
  assert.equal(isMerchantStorefrontTemplate('custom_theme'), false);
  assert.equal(isMerchantStorefrontTemplate(null), false);
});

test('structural storefront templates are restricted to their database industry', () => {
  assert.equal(isStorefrontTemplateAllowedForIndustry('bags_editorial', 'bags_wholesale'), true);
  assert.equal(isStorefrontTemplateAllowedForIndustry('bags_editorial', 'department_wholesale'), false);
  assert.equal(isStorefrontTemplateAllowedForIndustry('retail_quick_shop', 'general_retail'), true);
  assert.equal(isStorefrontTemplateAllowedForIndustry('retail_quick_shop', null), false);
  assert.equal(isStorefrontTemplateAllowedForIndustry('fashion_monochrome', null), true);
});

test('stored storefront theme is read safely with the monochrome theme as fallback', () => {
  assert.equal(getMerchantStorefrontTemplate('{"storefrontTemplate":"ecommerce_standard"}'), 'ecommerce_standard');
  assert.equal(getMerchantStorefrontTemplate('{"storefrontTemplate":"bags_editorial"}'), 'bags_editorial');
  assert.equal(getMerchantStorefrontTemplate({ storefrontTemplate: 'luxury_black_gold' }), 'luxury_black_gold');
  assert.equal(getMerchantStorefrontTemplate('not-json'), 'fashion_monochrome');
  assert.equal(getMerchantStorefrontTemplate('{"storefrontTemplate":"unsupported"}'), 'fashion_monochrome');
});

test('updating the storefront theme preserves other merchant settings', () => {
  const settings = withMerchantStorefrontTemplate('{"websiteUrl":"https://example.com","mapLatitude":43.8}', 'luxury_black_gold');
  assert.deepEqual(settings, {
    websiteUrl: 'https://example.com',
    mapLatitude: 43.8,
    storefrontTemplate: 'luxury_black_gold'
  });
  assert.deepEqual(withMerchantStorefrontTemplate('invalid-json', 'ecommerce_standard'), {
    storefrontTemplate: 'ecommerce_standard'
  });
});

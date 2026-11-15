import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PUBLIC_PRODUCT_FIELD_ALLOWLIST,
  pickPublicProductFields,
  sanitizePublicProduct
} from '../src/server/publicProductVisibility';
import {
  merchantIndustryCapabilities,
  getMerchantIndustryCapability,
  isMerchantIndustryModuleEnabled
} from '../src/constants/merchantIndustryCapabilities';
import {
  getMerchantIndustryTemplate,
  merchantIndustryTemplates,
  openMerchantIndustryTemplates,
  merchantWorkspaceTemplates
} from '../src/constants/merchantIndustryTemplates';

const allTemplateIds = openMerchantIndustryTemplates
  .filter(template => template.id !== 'restaurant_ordering')
  .map(template => template.id);

test('public product serialization is whitelist based and drops internal columns', () => {
  const row = {
    id: 'p1',
    styleNo: 'ST-1',
    name: '外套',
    skus: [{ sku: 'ST-1-BLK-M', cost: 12, stockCentral: 3 }],
    media: [{ url: 'https://cdn.example.com/a.jpg', storageKey: 'private/key.jpg' }],
    wholesalePrice: 40,
    rrpPrice: 99,
    costPrice: 21,
    creationRequestKey: 'internal-key',
    inventoryVersion: 7,
    isExclusiveProtected: true,
    protectionLevel: 'vault',
    visibility: 'private',
    mallReviewedBy: 'admin',
    industryAttributes: '{"material":"羊毛"}'
  };
  const picked = pickPublicProductFields(row);
  const serialized = sanitizePublicProduct(picked) as Record<string, any>;

  for (const forbidden of ['costPrice', 'creationRequestKey', 'inventoryVersion', 'isExclusiveProtected', 'protectionLevel', 'visibility', 'mallReviewedBy']) {
    assert.equal(Object.hasOwn(serialized, forbidden), false, `${forbidden} must not be exposed publicly`);
  }
  assert.equal(serialized.styleNo, 'ST-1');
  assert.equal(serialized.industryAttributes, '{"material":"羊毛"}');
  assert.equal(serialized.skus[0].cost, undefined);
  assert.equal(serialized.skus[0].stockCentral, 3);
  assert.equal(serialized.media[0].storageKey, undefined);
  assert.equal(serialized.media[0].url, 'https://cdn.example.com/a.jpg');
});

test('public whitelist stays explicit and free of duplicated fields', () => {
  const whitelist: readonly string[] = PUBLIC_PRODUCT_FIELD_ALLOWLIST;
  assert.equal(new Set(whitelist).size, whitelist.length);
  assert.ok(whitelist.includes('industryAttributes'));
  assert.ok(!whitelist.includes('costPrice'));
});

test('every industry exposes team and message modules while keeping POS scoped', () => {
  assert.equal(allTemplateIds.length, 7);
  for (const templateId of allTemplateIds) {
    const capability = getMerchantIndustryCapability(templateId);
    assert.ok(capability, `${templateId} capability must exist`);
    assert.ok(capability!.modules.includes('team'), `${templateId} must expose team module`);
    assert.ok(capability!.modules.includes('messages'), `${templateId} must expose messages module`);
    assert.equal(capability!.modules.includes('pos'), capability!.features.pos, `${templateId} POS module must match feature flag`);
    assert.equal(capability!.modules.includes('stores'), capability!.features.stores, `${templateId} stores module must match feature flag`);
    assert.equal(capability!.modules.includes('transfers'), capability!.features.transfers, `${templateId} transfers module must match feature flag`);
  }
});

test('restaurant template exposes only its menu and table-directory capabilities', () => {
  const template = getMerchantIndustryTemplate('restaurant_ordering');
  const capability = getMerchantIndustryCapability('restaurant_ordering');
  assert.equal(merchantIndustryTemplates.length, 8);
  assert.equal(openMerchantIndustryTemplates.length, 8);
  assert.equal(template?.status, 'open');
  assert.equal(template?.industryCode, 'restaurant');
  assert.equal(template?.studioCode, 'restaurant_studio');
  assert.equal(template?.knowledgeNamespace, 'restaurant');
  assert.deepEqual(capability?.modules, ['restaurant_menu', 'restaurant_tables']);
  assert.equal(isMerchantIndustryModuleEnabled('restaurant_ordering', 'restaurant_menu'), true);
  assert.equal(isMerchantIndustryModuleEnabled('restaurant_ordering', 'restaurant_tables'), true);
  assert.equal(isMerchantIndustryModuleEnabled('restaurant_ordering', 'pos'), false);
  assert.equal(isMerchantIndustryModuleEnabled('restaurant_ordering', 'products'), false);
  assert.ok(capability && Object.values(capability.features).every(enabled => !enabled));
  assert.deepEqual(capability?.productFields, []);
});

test('industry templates expose the fixed Studio and knowledge namespace mapping', () => {
  const expected = {
    apparel_production_wholesale: ['apparel_production_wholesale', 'apparel_studio', 'apparel'],
    apparel_wholesale: ['apparel_wholesale', 'apparel_studio', 'apparel'],
    trading_wholesale: ['trade_wholesale', 'trade_studio', 'trade'],
    department_wholesale: ['department_wholesale', 'department_wholesale_studio', 'department_wholesale'],
    bags_wholesale: ['leather_bag_wholesale', 'leather_studio', 'leather'],
    department_chain_retail: ['department_store_chain', 'retail_chain_studio', 'retail_chain'],
    general_retail: ['general_retail', 'retail_studio', 'retail'],
    restaurant_ordering: ['restaurant', 'restaurant_studio', 'restaurant']
  } as const;

  const industryCodes = merchantIndustryTemplates.map(template => template.industryCode);
  assert.ok(industryCodes.every(Boolean), 'every registered industry must have a stable industry code');
  assert.equal(new Set(industryCodes).size, industryCodes.length, 'industry codes must be unique');

  for (const [templateId, [industryCode, studioCode, knowledgeNamespace]] of Object.entries(expected)) {
    const template = getMerchantIndustryTemplate(templateId);
    assert.ok(template, `${templateId} must remain registered`);
    assert.deepEqual(
      [template!.industryCode, template!.studioCode, template!.knowledgeNamespace],
      [industryCode, studioCode, knowledgeNamespace],
      `${templateId} mapping must not drift`
    );
  }
});

test('POS and store modules stay unreachable for wholesale-only industries', () => {
  const wholesaleOnly = ['apparel_production_wholesale', 'apparel_wholesale', 'trading_wholesale', 'department_wholesale', 'bags_wholesale'];
  for (const templateId of wholesaleOnly) {
    assert.equal(isMerchantIndustryModuleEnabled(templateId, 'pos'), false, `${templateId} must not enable POS`);
    assert.equal(isMerchantIndustryModuleEnabled(templateId, 'stores'), false, `${templateId} must not enable stores`);
    assert.equal(isMerchantIndustryModuleEnabled(templateId, 'transfers'), false, `${templateId} must not enable transfers`);
  }
  assert.equal(isMerchantIndustryModuleEnabled('department_chain_retail', 'stores'), true);
  assert.equal(isMerchantIndustryModuleEnabled('general_retail', 'pos'), true);
});

test('legacy workspace template modules stay aligned with industry capability', () => {
  for (const templateId of allTemplateIds) {
    // 服装生产批发商仍由旧版 MerchantPortal 承载，其 POS 入口不来自行业能力清单。
    if (templateId === 'apparel_production_wholesale') continue;
    const capability = getMerchantIndustryCapability(templateId);
    const template = getMerchantIndustryTemplate(templateId);
    assert.ok(capability && template);
    const workspace = template!.workspaceTemplateId ? merchantWorkspaceTemplates[template!.workspaceTemplateId] : null;
    assert.ok(workspace, `${templateId} must map to a workspace template`);
    if (template!.status !== 'open') {
      assert.deepEqual(workspace!.modules, [], `${templateId} closed workspace must expose no modules`);
      continue;
    }
    assert.equal(
      workspace!.modules.includes('pos'),
      capability!.features.pos,
      `${templateId} workspace POS entry must match capability`
    );
    assert.equal(
      workspace!.modules.includes('procurement'),
      capability!.features.procurement,
      `${templateId} workspace procurement entry must match capability`
    );
  }
});

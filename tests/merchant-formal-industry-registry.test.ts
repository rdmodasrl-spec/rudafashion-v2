import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getMerchantFormalIndustry,
  merchantFormalIndustries,
  resolveFormalMerchantIndustry
} from '../src/constants/merchantIndustryTemplates';
import {
  getMerchantIndustryRegistrationOptions,
  resolveMerchantRegistrationTemplate
} from '../src/server/merchantIndustryTemplates';
import { createFormalStudioEntitlementData } from '../src/server/merchantStudioAccess';

test('formal industry registry defines eight unique identities, Studios and knowledge spaces', () => {
  assert.equal(merchantFormalIndustries.length, 8);
  assert.equal(new Set(merchantFormalIndustries.map(item => item.id)).size, 8);
  assert.equal(new Set(merchantFormalIndustries.map(item => item.studioCode)).size, 8);
  assert.equal(new Set(merchantFormalIndustries.map(item => item.knowledgeNamespace)).size, 8);
  assert.ok(merchantFormalIndustries.every(item => item.studioCode.length <= 32));
  assert.equal(getMerchantFormalIndustry(' wholesale_comprehensive ')?.id, 'WHOLESALE_COMPREHENSIVE');
});

test('public registration options expose only open formal industries and registry-backed capabilities/categories', () => {
  const options = getMerchantIndustryRegistrationOptions();
  assert.equal(options.some(option => option.id === 'RETAIL_BEAUTY_HAIR'), false);

  const apparel = options.find(option => option.id === 'WHOLESALE_APPAREL');
  assert.ok(apparel);
  assert.deepEqual(apparel.capabilityIds, ['APPAREL_OWN_PRODUCTION']);
  assert.ok(apparel.categories.includes('WOMENSWEAR'));

  const leather = options.find(option => option.id === 'WHOLESALE_LEATHER_GOODS');
  assert.ok(leather);
  assert.deepEqual(leather.capabilityIds, ['LEATHER_OWN_PRODUCTION']);

  const department = options.find(option => option.id === 'WHOLESALE_GENERAL_MERCHANDISE');
  const comprehensive = options.find(option => option.id === 'WHOLESALE_COMPREHENSIVE');
  assert.ok(department);
  assert.ok(comprehensive);
  assert.deepEqual(comprehensive.categories, department.categories);
});

test('formal registration maps Apparel production to one industry and its explicit capability', () => {
  const wholesale = resolveMerchantRegistrationTemplate({ formalIndustryId: 'WHOLESALE_APPAREL' });
  assert.equal(wholesale.ok, true);
  if (!wholesale.ok) return;
  assert.equal(wholesale.formalIndustryId, 'WHOLESALE_APPAREL');
  assert.equal(wholesale.template.id, 'apparel_wholesale');
  assert.deepEqual(wholesale.capabilityIds, []);

  const production = resolveMerchantRegistrationTemplate({
    formalIndustryId: 'WHOLESALE_APPAREL',
    capabilityIds: ['APPAREL_OWN_PRODUCTION']
  });
  assert.equal(production.ok, true);
  if (!production.ok) return;
  assert.equal(production.formalIndustryId, 'WHOLESALE_APPAREL');
  assert.equal(production.template.id, 'apparel_production_wholesale');
  assert.deepEqual(production.capabilityIds, ['APPAREL_OWN_PRODUCTION']);
});

test('formal adapters preserve independent comprehensive wholesale identity', () => {
  const general = resolveFormalMerchantIndustry({ formalIndustryId: 'WHOLESALE_GENERAL_MERCHANDISE' });
  const comprehensive = resolveFormalMerchantIndustry({ formalIndustryId: 'WHOLESALE_COMPREHENSIVE' });
  assert.equal(general.ok, true);
  assert.equal(comprehensive.ok, true);
  if (!general.ok || !comprehensive.ok) return;
  assert.equal(general.template.id, comprehensive.template.id);
  assert.notEqual(general.industry.id, comprehensive.industry.id);
  assert.notEqual(general.industry.knowledgeNamespace, comprehensive.industry.knowledgeNamespace);
  assert.notEqual(general.industry.studioCode, comprehensive.industry.studioCode);
});

test('formal registration rejects unknown, closed, disallowed capabilities and conflicting adapters', () => {
  assert.deepEqual(resolveFormalMerchantIndustry({ formalIndustryId: 'TRADE' }), {
    ok: false,
    error: 'INVALID_FORMAL_INDUSTRY_ID'
  });

  test('formal studio entitlement data uses registry mappings and capability allowlists', () => {
    const leather = resolveMerchantRegistrationTemplate({
      formalIndustryId: 'WHOLESALE_LEATHER_GOODS',
      capabilityIds: ['LEATHER_OWN_PRODUCTION']
    });
    assert.equal(leather.ok, true);
    if (!leather.ok) return;
    assert.ok(leather.formalIndustryId);
    assert.deepEqual(
      createFormalStudioEntitlementData({
        formalIndustryId: leather.formalIndustryId,
        template: leather.template,
        capabilityIds: leather.capabilityIds || [],
        source: leather.source
      }),
      {
        formalIndustryId: 'WHOLESALE_LEATHER_GOODS',
        industryCode: 'leather_bag_wholesale',
        industryTemplate: 'bags_wholesale',
        studioCode: 'leather_studio',
        mode: 'default',
        status: 'active',
        capabilities: { LEATHER_OWN_PRODUCTION: true },
        source: 'SELF_SELECTED'
      }
    );
    assert.throws(() => createFormalStudioEntitlementData({
      formalIndustryId: 'WHOLESALE_COMPREHENSIVE',
      template: leather.template,
      capabilityIds: [],
      source: 'SELF_SELECTED'
    }), /FORMAL_INDUSTRY_ENTITLEMENT_MAPPING_INVALID/);
  });
  assert.deepEqual(resolveFormalMerchantIndustry({ formalIndustryId: 'RETAIL_BEAUTY_HAIR' }), {
    ok: false,
    error: 'FORMAL_INDUSTRY_NOT_OPEN'
  });
  assert.deepEqual(resolveFormalMerchantIndustry({
    formalIndustryId: 'WHOLESALE_LEATHER_GOODS',
    capabilityIds: ['APPAREL_OWN_PRODUCTION']
  }), {
    ok: false,
    error: 'INVALID_INDUSTRY_CAPABILITY'
  });
  assert.deepEqual(resolveFormalMerchantIndustry({
    formalIndustryId: 'WHOLESALE_APPAREL',
    capabilityIds: ['APPAREL_OWN_PRODUCTION'],
    industryTemplate: 'apparel_wholesale'
  }), {
    ok: false,
    error: 'INVALID_FORMAL_INDUSTRY_ID'
  });
});

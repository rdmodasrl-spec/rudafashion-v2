import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEntitlementStudioAccess,
  buildCompatibilityStudioAccess,
  hasStudioCapability,
  resolveMerchantStudioAccesses
} from '../src/server/merchantStudioAccess';
import { getMerchantIndustryTemplate } from '../src/constants/merchantIndustryTemplates';
import type { PrismaClient } from '@prisma/client';

test('active Studio entitlements use stable registry IDs and explicitly granted capabilities', () => {
  const production = buildEntitlementStudioAccess({
    industryCode: 'apparel_production_wholesale',
    industryTemplate: 'apparel_production_wholesale',
    studioCode: 'apparel_studio',
    mode: 'production',
    status: 'active',
    capabilities: { apparelPatternEngineering: true }
  });
  const wholesale = buildEntitlementStudioAccess({
    industryCode: 'apparel_wholesale',
    industryTemplate: 'apparel_wholesale',
    studioCode: 'apparel_studio',
    mode: 'wholesale',
    status: 'active',
    capabilities: { apparelPatternEngineering: true }
  });

  assert.equal(production?.source, 'entitlement');
  assert.equal(production?.capabilities.apparelPatternEngineering, true);
  assert.equal(wholesale?.capabilities.apparelPatternEngineering, false);
  assert.equal(buildEntitlementStudioAccess({
    industryCode: 'apparel_production_wholesale',
    industryTemplate: 'apparel_production_wholesale',
    studioCode: 'apparel_studio',
    mode: 'production',
    status: 'pending',
    capabilities: { apparelPatternEngineering: true }
  }), null);
});

test('entitlement resolver rejects mismatched mappings and unknown capability grants', () => {
  assert.equal(buildEntitlementStudioAccess({
    industryCode: 'restaurant',
    industryTemplate: 'bags_wholesale',
    studioCode: 'leather_studio',
    mode: 'wholesale',
    status: 'active',
    capabilities: { apparelPatternEngineering: true }
  }), null);

  const leather = buildEntitlementStudioAccess({
    industryCode: 'leather_bag_wholesale',
    industryTemplate: 'bags_wholesale',
    studioCode: 'leather_studio',
    mode: 'default',
    status: 'active',
    capabilities: { apparelPatternEngineering: true, unrestricted: true }
  });
  assert.ok(leather);
  assert.equal(leather.capabilities.apparelPatternEngineering, false);
});

test('formal entitlements require a matching industry, adapter and explicit capability grant', () => {
  const apparelWholesale = buildEntitlementStudioAccess({
    formalIndustryId: 'WHOLESALE_APPAREL',
    industryCode: 'apparel_wholesale',
    industryTemplate: 'apparel_wholesale',
    studioCode: 'apparel_studio',
    mode: 'wholesale',
    status: 'active',
    capabilities: {}
  });
  assert.equal(apparelWholesale?.capabilities.apparelOwnProduction, false);

  const apparelProduction = buildEntitlementStudioAccess({
    formalIndustryId: 'WHOLESALE_APPAREL',
    industryCode: 'apparel_production_wholesale',
    industryTemplate: 'apparel_production_wholesale',
    studioCode: 'apparel_studio',
    mode: 'production',
    status: 'active',
    capabilities: { APPAREL_OWN_PRODUCTION: true }
  });
  assert.equal(apparelProduction?.capabilities.apparelOwnProduction, true);

  const leather = buildEntitlementStudioAccess({
    formalIndustryId: 'WHOLESALE_LEATHER_GOODS',
    industryCode: 'leather_bag_wholesale',
    industryTemplate: 'bags_wholesale',
    studioCode: 'leather_studio',
    mode: 'default',
    status: 'active',
    capabilities: { LEATHER_OWN_PRODUCTION: true }
  });
  assert.equal(leather?.formalIndustryId, 'WHOLESALE_LEATHER_GOODS');
  assert.equal(leather?.capabilities.leatherOwnProduction, true);
  assert.deepEqual(leather?.capabilityIds, ['LEATHER_OWN_PRODUCTION']);

  assert.equal(buildEntitlementStudioAccess({
    formalIndustryId: 'WHOLESALE_COMPREHENSIVE',
    industryCode: 'leather_bag_wholesale',
    industryTemplate: 'bags_wholesale',
    studioCode: 'comprehensive_wholesale_studio',
    mode: 'default',
    status: 'active',
    capabilities: {}
  }), null);
  assert.equal(buildEntitlementStudioAccess({
    formalIndustryId: 'UNKNOWN_FORMAL_INDUSTRY',
    industryCode: 'leather_bag_wholesale',
    industryTemplate: 'bags_wholesale',
    studioCode: 'leather_studio',
    mode: 'default',
    status: 'active',
    capabilities: {}
  }), null);
});

test('apparel production template resolves production studio access with pattern engineering', () => {
  const template = getMerchantIndustryTemplate('apparel_production_wholesale');
  assert.ok(template);
  const access = buildCompatibilityStudioAccess(template);
  assert.ok(access);
  assert.equal(access.studioCode, 'apparel_studio');
  assert.equal(access.industryCode, 'apparel_production_wholesale');
  assert.equal(access.mode, 'production');
  assert.equal(access.status, 'active');
  assert.equal(access.source, 'compatibility_merchant_template');
  assert.equal(hasStudioCapability(access, 'apparelPatternEngineering'), true);
});

test('apparel wholesale template resolves same studio but no production pattern engineering', () => {
  const template = getMerchantIndustryTemplate('apparel_wholesale');
  assert.ok(template);
  const access = buildCompatibilityStudioAccess(template);
  assert.ok(access);
  assert.equal(access.studioCode, 'apparel_studio');
  assert.equal(access.industryCode, 'apparel_wholesale');
  assert.equal(access.mode, 'wholesale');
  assert.equal(hasStudioCapability(access, 'apparelPatternEngineering'), false);
});

test('leather and other open templates resolve stable studio mapping', () => {
  const cases: Array<[string, string, string, string]> = [
    ['bags_wholesale', 'leather_bag_wholesale', 'leather_studio', 'leather'],
    ['trading_wholesale', 'trade_wholesale', 'trade_studio', 'trade'],
    ['department_wholesale', 'department_wholesale', 'department_wholesale_studio', 'department_wholesale'],
    ['department_chain_retail', 'department_store_chain', 'retail_chain_studio', 'retail_chain'],
    ['general_retail', 'general_retail', 'retail_studio', 'retail'],
    ['restaurant_ordering', 'restaurant', 'restaurant_studio', 'restaurant']
  ];
  for (const [templateId, industryCode, studioCode, namespace] of cases) {
    const template = getMerchantIndustryTemplate(templateId);
    assert.ok(template, `missing template ${templateId}`);
    const access = buildCompatibilityStudioAccess(template);
    assert.ok(access, `missing access for ${templateId}`);
    assert.equal(access.industryCode, industryCode);
    assert.equal(access.studioCode, studioCode);
    assert.equal(access.knowledgeNamespace, namespace);
    assert.equal(access.status, 'active');
  }
});

test('hasStudioCapability is false for null access', () => {
  assert.equal(hasStudioCapability(null, 'apparelPatternEngineering'), false);
  assert.equal(hasStudioCapability(undefined, 'apparelPatternEngineering'), false);
});

test('missing entitlement table falls back to the merchant primary template only', async () => {
  const warning = console.warn;
  const warnings: unknown[][] = [];
  console.warn = (...args: unknown[]) => warnings.push(args);
  try {
    const prisma = {
      merchantStudioEntitlement: {
        findMany: async () => {
          throw Object.assign(new Error('The table `public.MerchantStudioEntitlement` does not exist'), {
            code: 'P2021',
            meta: { modelName: 'MerchantStudioEntitlement', table: 'public.MerchantStudioEntitlement' }
          });
        }
      },
      merchant: {
        findUnique: async () => ({
          industry: 'FASHION_COMPANY',
          industryTemplate: 'apparel_production_wholesale'
        })
      }
    } as unknown as PrismaClient;

    const accesses = await resolveMerchantStudioAccesses(prisma, 'merchant-a');
    assert.equal(accesses.length, 1);
    assert.equal(accesses[0]?.industryTemplate, 'apparel_production_wholesale');
    assert.equal(accesses[0]?.source, 'compatibility_merchant_template');
    assert.equal(warnings.length, 1);
  } finally {
    console.warn = warning;
  }
});

test('missing entitlement table never broadens access beyond the merchant industry', async () => {
  const prisma = {
    merchantStudioEntitlement: {
      findMany: async () => {
        throw Object.assign(new Error('The table `public.MerchantStudioEntitlement` does not exist'), {
          code: 'P2021',
          meta: { modelName: 'MerchantStudioEntitlement', table: 'public.MerchantStudioEntitlement' }
        });
      }
    },
    merchant: {
      findUnique: async () => ({
        industry: 'FASHION_WHOLESALE',
        industryTemplate: 'apparel_production_wholesale'
      })
    }
  } as unknown as PrismaClient;

  assert.deepEqual(await resolveMerchantStudioAccesses(prisma, 'merchant-a'), []);
});

test('other entitlement storage errors remain visible', async () => {
  const storageError = Object.assign(new Error('database connection unavailable'), { code: 'P1001' });
  const prisma = {
    merchantStudioEntitlement: { findMany: async () => { throw storageError; } },
    merchant: { findUnique: async () => { throw new Error('compatibility fallback must not run'); } }
  } as unknown as PrismaClient;

  await assert.rejects(resolveMerchantStudioAccesses(prisma, 'merchant-a'), error => error === storageError);
});

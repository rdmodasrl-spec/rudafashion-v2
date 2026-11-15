/**
 * Merchant Studio access and entitlement compatibility layer.
 *
 * The server-side entry point for Studio authorization decisions. Persisted
 * entitlements take precedence; single-template inference is legacy compatibility only.
 *
 * Compatibility behavior:
 * - Reads the merchant's current `industryTemplate` and `industry` from the database.
 * - Only open templates with a stable `studioCode`/`industryCode` mapping are eligible.
 * - Compatibility access requires the template's `merchantIndustry` to match the
 *   merchant record.
 * - Apparel Production vs Wholesale remain distinct `industryCode`/mode contexts even
 *   though they share `apparel_studio`; production-only capabilities must be checked
 *   separately by capability guards (not granted here).
 *
 * Entitlement records are checked against the single template registry so persisted
 * capability JSON cannot grant an industry or capability the registry does not allow.
 */

import type { PrismaClient } from '@prisma/client';
import {
  getFormalIndustryForLegacyTemplate,
  getMerchantFormalIndustry,
  getMerchantIndustryTemplate,
  type MerchantFormalIndustryId,
  type MerchantIndustryCapabilityId,
  type MerchantIndustryTemplateSource,
  type MerchantIndustryTemplate
} from '../constants/merchantIndustryTemplates';

export type MerchantStudioMode = 'production' | 'wholesale' | 'default';

export type MerchantStudioAccess = {
  templateId: string;
  formalIndustryId: MerchantFormalIndustryId | null;
  industryCode: string;
  studioCode: string;
  knowledgeNamespace: string;
  industryTemplate: string;
  merchantIndustry: string;
  mode: MerchantStudioMode;
  status: 'active';
  source: 'entitlement' | 'compatibility_merchant_template';
  capabilityIds: MerchantIndustryCapabilityId[];
  capabilities: {
    /** Apparel professional pattern/CAD tools are limited to production edition. */
    apparelPatternEngineering: boolean;
    apparelOwnProduction: boolean;
    leatherOwnProduction: boolean;
  };
};

export type MerchantStudioEntitlementRecord = {
  formalIndustryId?: string | null;
  industryCode: string;
  industryTemplate: string;
  studioCode: string;
  mode: string;
  status: string;
  capabilities: unknown;
  revokedAt?: Date | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isMissingStudioEntitlementTable(error: unknown): boolean {
  if (!isRecord(error) || error.code !== 'P2021' || !isRecord(error.meta)) return false;
  return error.meta.modelName === 'MerchantStudioEntitlement'
    && error.meta.table === 'public.MerchantStudioEntitlement';
}

function modeForTemplate(template: MerchantIndustryTemplate): MerchantStudioMode {
  if (template.id === 'apparel_production_wholesale') return 'production';
  if (template.id === 'apparel_wholesale') return 'wholesale';
  return 'default';
}

export function createFormalStudioEntitlementData(input: {
  formalIndustryId: MerchantFormalIndustryId;
  template: MerchantIndustryTemplate;
  capabilityIds: readonly MerchantIndustryCapabilityId[];
  source: MerchantIndustryTemplateSource;
}) {
  const formalIndustry = getMerchantFormalIndustry(input.formalIndustryId);
  if (
    !formalIndustry
    || !formalIndustry.workspaceAdapterTemplateIds.includes(input.template.id)
    || !input.template.industryCode
    || input.capabilityIds.some(capability => !formalIndustry.capabilityIds.includes(capability))
  ) {
    throw new Error('FORMAL_INDUSTRY_ENTITLEMENT_MAPPING_INVALID');
  }
  const capabilities: Record<string, boolean> = Object.fromEntries(
    input.capabilityIds.map(capability => [capability, true])
  );
  if (
    input.formalIndustryId === 'WHOLESALE_APPAREL'
    && input.template.id === 'apparel_production_wholesale'
    && input.capabilityIds.includes('APPAREL_OWN_PRODUCTION')
  ) {
    capabilities.apparelPatternEngineering = true;
  }
  return {
    formalIndustryId: formalIndustry.id,
    industryCode: input.template.industryCode,
    industryTemplate: input.template.id,
    studioCode: formalIndustry.studioCode,
    mode: modeForTemplate(input.template),
    status: 'active',
    capabilities,
    source: input.source
  };
}

function capabilitiesForTemplate(template: MerchantIndustryTemplate): MerchantStudioAccess['capabilities'] {
  const apparelOwnProduction = template.id === 'apparel_production_wholesale';
  return {
    apparelPatternEngineering: apparelOwnProduction,
    apparelOwnProduction,
    leatherOwnProduction: false
  };
}

export function buildCompatibilityStudioAccess(
  template: MerchantIndustryTemplate
): MerchantStudioAccess | null {
  if (
    template.status !== 'open'
    || !template.industryCode
    || !template.studioCode
    || !template.knowledgeNamespace
  ) return null;
  const formalIndustry = getFormalIndustryForLegacyTemplate(template.id);
  const capabilityIds: MerchantIndustryCapabilityId[] = formalIndustry?.id === 'WHOLESALE_APPAREL'
    && template.id === 'apparel_production_wholesale'
    ? ['APPAREL_OWN_PRODUCTION']
    : [];
  return {
    templateId: template.id,
    formalIndustryId: formalIndustry?.id || null,
    industryCode: template.industryCode,
    studioCode: template.studioCode,
    knowledgeNamespace: template.knowledgeNamespace,
    industryTemplate: template.id,
    merchantIndustry: template.merchantIndustry,
    mode: modeForTemplate(template),
    status: 'active',
    source: 'compatibility_merchant_template',
    capabilityIds,
    capabilities: capabilitiesForTemplate(template)
  };
}

export function buildEntitlementStudioAccess(
  entitlement: MerchantStudioEntitlementRecord
): MerchantStudioAccess | null {
  if (entitlement.status !== 'active' || entitlement.revokedAt != null) return null;
  const template = getMerchantIndustryTemplate(entitlement.industryTemplate);
  const formalIndustry = entitlement.formalIndustryId
    ? getMerchantFormalIndustry(entitlement.formalIndustryId)
    : null;
  if (
    !template
    || template.status !== 'open'
    || (entitlement.formalIndustryId && !formalIndustry)
    || template.industryCode !== entitlement.industryCode
    || modeForTemplate(template) !== entitlement.mode
  ) return null;
  if (entitlement.formalIndustryId) {
    if (
      !formalIndustry
      || formalIndustry.registrationStatus !== 'open'
      || !formalIndustry.workspaceAdapterTemplateIds.includes(template.id)
      || formalIndustry.studioCode !== entitlement.studioCode
    ) return null;
  } else if (template.studioCode !== entitlement.studioCode) {
    return null;
  }
  const templateCapabilities = capabilitiesForTemplate(template);
  const grantedCapabilities = isRecord(entitlement.capabilities) ? entitlement.capabilities : {};
  const capabilityIds: MerchantIndustryCapabilityId[] = formalIndustry
    ? formalIndustry.capabilityIds.filter(capability => grantedCapabilities[capability] === true)
    : getFormalIndustryForLegacyTemplate(template.id)?.capabilityIds.filter(capability =>
        grantedCapabilities[capability] === true
      ) || [];
  const apparelOwnProduction = capabilityIds.includes('APPAREL_OWN_PRODUCTION')
    || (formalIndustry === null && templateCapabilities.apparelOwnProduction);
  const leatherOwnProduction = capabilityIds.includes('LEATHER_OWN_PRODUCTION');
  const studioCode = formalIndustry?.studioCode || template.studioCode;
  const knowledgeNamespace = formalIndustry?.knowledgeNamespace || template.knowledgeNamespace;
  if (!studioCode || !knowledgeNamespace) return null;
  return {
    templateId: template.id,
    formalIndustryId: formalIndustry?.id || getFormalIndustryForLegacyTemplate(template.id)?.id || null,
    industryCode: template.industryCode,
    studioCode,
    knowledgeNamespace,
    industryTemplate: template.id,
    merchantIndustry: template.merchantIndustry,
    mode: modeForTemplate(template),
    status: 'active',
    source: 'entitlement',
    capabilityIds: apparelOwnProduction && !capabilityIds.includes('APPAREL_OWN_PRODUCTION')
      ? [...capabilityIds, 'APPAREL_OWN_PRODUCTION']
      : capabilityIds,
    capabilities: {
      apparelPatternEngineering:
        templateCapabilities.apparelPatternEngineering
        && (grantedCapabilities.apparelPatternEngineering === true || apparelOwnProduction),
      apparelOwnProduction,
      leatherOwnProduction
    }
  };
}

export async function resolveMerchantStudioAccesses(
  prisma: PrismaClient,
  merchantId: string
): Promise<MerchantStudioAccess[]> {
  try {
    const entitlements = await prisma.merchantStudioEntitlement.findMany({
      where: { merchantId },
      orderBy: [{ grantedAt: 'asc' }, { id: 'asc' }]
    });
    if (entitlements.length > 0) {
      return entitlements
        .map(buildEntitlementStudioAccess)
        .filter((access): access is MerchantStudioAccess => access !== null);
    }
  } catch (error) {
    if (!isMissingStudioEntitlementTable(error)) throw error;
    console.warn('[merchant-studio-entitlements] entitlement table is missing; using primary-template compatibility access');
  }

  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { industry: true, industryTemplate: true }
  });
  if (!merchant) return [];
  const template = getMerchantIndustryTemplate(merchant.industryTemplate);
  if (!template) return [];
  // Refuse mismatched records: template must be open and match the merchant's industry pack.
  if (template.status !== 'open') return [];
  if (merchant.industry && template.merchantIndustry !== merchant.industry) return [];
  const access = buildCompatibilityStudioAccess(template);
  return access ? [access] : [];
}

export async function resolveMerchantStudioAccess(
  prisma: PrismaClient,
  merchantId: string,
  studioCode?: string,
  industryTemplate?: string
): Promise<MerchantStudioAccess | null> {
  const accesses = await resolveMerchantStudioAccesses(prisma, merchantId);
  const matches = accesses.filter(item =>
    (!studioCode || item.studioCode === studioCode)
    && (!industryTemplate || item.industryTemplate === industryTemplate)
  );
  if (matches.length === 1) return matches[0];
  if (matches.length === 0 || industryTemplate) return null;
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { industryTemplate: true }
  });
  return matches.find(item => item.industryTemplate === merchant?.industryTemplate) || null;
}

export function hasStudioCapability(
  access: MerchantStudioAccess | null | undefined,
  capability: keyof MerchantStudioAccess['capabilities']
): boolean {
  if (!access) return false;
  return access.capabilities[capability] === true;
}

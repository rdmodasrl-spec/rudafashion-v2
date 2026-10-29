/**
 * 商家经营类型模板的服务端规则。
 *
 * 所有商家创建、登录、会话与商家 API 校验必须调用本文件，不允许在路由内重复实现模板判断。
 * 纯函数，不直接访问数据库，便于单元测试。
 */

import {
  DEFAULT_MERCHANT_INDUSTRY_TEMPLATE_ID,
  findOpenMerchantIndustryTemplateByIndustry,
  getMerchantIndustryTemplate,
  getMerchantWorkspaceTemplate,
  merchantIndustryTemplates,
  type MerchantIndustryTemplate,
  type MerchantIndustryTemplateId,
  type MerchantIndustryTemplateSource,
  type MerchantOperatingModel,
  type MerchantRegistrationProfile,
  type MerchantWorkspaceSnapshot
} from '../constants/merchantIndustryTemplates';

export type MerchantRegistrationTemplateErrorCode =
  | 'REQUIRE_INDUSTRY_TEMPLATE'
  | 'INVALID_INDUSTRY_TEMPLATE'
  | 'INDUSTRY_TEMPLATE_NOT_OPEN';

export type MerchantRegistrationTemplateResolution =
  | { ok: true; template: MerchantIndustryTemplate; source: MerchantIndustryTemplateSource }
  | { ok: false; error: MerchantRegistrationTemplateErrorCode };

/**
 * 注册时的模板解析：
 * 1. 客户端传 `industryTemplate` → 必须存在且已开放。
 * 2. 只有旧 `industry`（ModaGPT 行业包）→ 仅已开放模板可命中，用于兼容旧页面缓存。
 * 3. 都没有 → 拒绝。
 */
export function resolveMerchantRegistrationTemplate(
  input: { industryTemplate?: unknown; industry?: unknown } | null | undefined
): MerchantRegistrationTemplateResolution {
  const rawTemplate = input?.industryTemplate;
  const hasTemplateInput = typeof rawTemplate === 'string' && rawTemplate.trim().length > 0;
  if (hasTemplateInput) {
    const template = getMerchantIndustryTemplate(rawTemplate);
    if (!template) return { ok: false, error: 'INVALID_INDUSTRY_TEMPLATE' };
    if (template.status !== 'open') return { ok: false, error: 'INDUSTRY_TEMPLATE_NOT_OPEN' };
    return { ok: true, template, source: 'SELF_SELECTED' };
  }
  const rawIndustry = input?.industry;
  const hasIndustryInput = typeof rawIndustry === 'string' && rawIndustry.trim().length > 0;
  if (hasIndustryInput) {
    const legacyMatch = findOpenMerchantIndustryTemplateByIndustry(rawIndustry);
    if (!legacyMatch) return { ok: false, error: 'INDUSTRY_TEMPLATE_NOT_OPEN' };
    return { ok: true, template: legacyMatch, source: 'SELF_SELECTED' };
  }
  return { ok: false, error: 'REQUIRE_INDUSTRY_TEMPLATE' };
}

/**
 * 平台后台/内部接口指定模板：允许指定尚未开放模板（记录照常创建，但工作区不可用），
 * 便于平台提前建档；来源记为 ADMIN，不冒充商家自选。
 */
export function resolveAdminMerchantTemplateAssignment(
  input: { industryTemplate?: unknown; industry?: unknown } | null | undefined
): { templateId: MerchantIndustryTemplateId | null; source: MerchantIndustryTemplateSource } {
  const direct = getMerchantIndustryTemplate(input?.industryTemplate);
  if (direct) return { templateId: direct.id, source: 'ADMIN' };
  const industry = typeof input?.industry === 'string' ? input.industry.trim().toUpperCase() : '';
  if (industry) {
    const matched = merchantIndustryTemplates.find(item => item.merchantIndustry === industry);
    if (matched) return { templateId: matched.id, source: 'ADMIN' };
  }
  return { templateId: null, source: 'ADMIN' };
}

const merchantRoleValues = ['PRODUCER', 'WHOLESALER', 'RETAILER'] as const;
const operatingModelValues: MerchantOperatingModel[] = ['production', 'wholesale', 'both'];

function normalizeStringList(value: unknown, allowed?: readonly string[]): string[] {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  const result: string[] = [];
  for (const entry of list) {
    if (typeof entry !== 'string') continue;
    const normalized = entry.trim().toUpperCase();
    if (!normalized) continue;
    if (allowed && !allowed.some(item => item.toUpperCase() === normalized)) continue;
    if (!result.includes(normalized)) result.push(normalized);
  }
  return result;
}

function normalizeBoolean(value: unknown): boolean | undefined {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return undefined;
}

/**
 * 注册经营信息白名单归一化：只保留模板声明允许的品类与已知业务身份，
 * 未知值静默丢弃而不是原样落库，避免脏数据进入报表。
 */
export function resolveMerchantRegistrationProfile(
  template: MerchantIndustryTemplate,
  raw: unknown
): MerchantRegistrationProfile {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
  const operatingModelRaw = typeof input.operatingModel === 'string' ? input.operatingModel.trim().toLowerCase() : '';
  const operatingModel = operatingModelValues.find(item => item === operatingModelRaw);
  const hasProductionCapacity = normalizeBoolean(input.hasProductionCapacity);
  const carriesMaterials = normalizeBoolean(input.carriesMaterials);
  return {
    ...(operatingModel ? { operatingModel } : {}),
    ...(hasProductionCapacity !== undefined ? { hasProductionCapacity } : {}),
    ...(carriesMaterials !== undefined ? { carriesMaterials } : {}),
    categories: normalizeStringList(input.categories, template.categories),
    roles: normalizeStringList(input.roles, merchantRoleValues)
  };
}

export type MerchantTemplateRow = {
  industryTemplate?: string | null;
  industryTemplateSource?: string | null;
  industry?: string | null;
};

function templateForRow(row: MerchantTemplateRow): MerchantIndustryTemplate | null {
  return getMerchantIndustryTemplate(row.industryTemplate)
    || findOpenMerchantIndustryTemplateByIndustry(row.industry);
}

/**
 * 商家后台工作区快照，随商家对象返回给三端，保证同一商家三端看到同一工作区。
 * 历史数据（无模板）按行业包回退：服装行业仍可用现有后台，其他行业保留访问但无工作区声明。
 */
export function resolveMerchantWorkspaceState(row: MerchantTemplateRow): MerchantWorkspaceSnapshot {
  const template = templateForRow(row);
  const templateSource = String(row.industryTemplateSource || 'LEGACY_PENDING_REVIEW');
  if (template) {
    const workspace = getMerchantWorkspaceTemplate(template.workspaceTemplateId);
    const active = template.status === 'open' && !!workspace;
    return {
      templateSource,
      templateId: template.id,
      templateNameZh: template.zh,
      templateNameIt: template.it,
      workspaceTemplateId: workspace?.id ?? null,
      workspaceNameZh: workspace?.zh ?? null,
      workspaceNameIt: workspace?.it ?? null,
      modules: workspace ? [...workspace.modules] : [],
      status: active ? 'active' : 'unavailable',
      accessAllowed: active
    };
  }
  const legacyApparel = String(row.industry || '').trim().toUpperCase() === 'FASHION_COMPANY';
  const workspace = legacyApparel
    ? getMerchantWorkspaceTemplate('merchant_admin_apparel_production_wholesale')
    : null;
  return {
    templateSource,
    templateId: null,
    templateNameZh: null,
    templateNameIt: null,
    workspaceTemplateId: workspace?.id ?? null,
    workspaceNameZh: workspace?.zh ?? null,
    workspaceNameIt: workspace?.it ?? null,
    modules: workspace ? [...workspace.modules] : [],
    status: 'legacy_review',
    accessAllowed: true
  };
}

export function isMerchantWorkspaceAccessible(row: MerchantTemplateRow | null | undefined): boolean {
  if (!row) return false;
  return resolveMerchantWorkspaceState(row).accessAllowed;
}

/** 新商家默认模板：用于内部兜底，不替代注册/后台显式选择。 */
export const defaultMerchantIndustryTemplateId = DEFAULT_MERCHANT_INDUSTRY_TEMPLATE_ID;

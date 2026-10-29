/**
 * 商家经营类型模板（单一事实来源）。
 *
 * - `merchantIndustry` 写入 `Merchant.industry`，仍是 ModaGPT 行业包 ID，语义不变。
 * - `workspaceTemplateId` 指向商家后台工作区；7 个行业各自有独立工作区。
 * - 服务端 `src/server/merchantIndustryTemplates.ts` 与所有前端共用本文件，禁止另建第二份清单。
 */

export type MerchantIndustryTemplateId =
  | 'apparel_production_wholesale'
  | 'apparel_wholesale'
  | 'trading_wholesale'
  | 'department_wholesale'
  | 'bags_wholesale'
  | 'department_chain_retail'
  | 'general_retail';

export type MerchantWorkspaceTemplateId =
  | 'merchant_admin_apparel_production_wholesale'
  | 'merchant_admin_apparel_wholesale'
  | 'merchant_admin_trading_wholesale'
  | 'merchant_admin_department_wholesale'
  | 'merchant_admin_bags_wholesale'
  | 'merchant_admin_department_chain_retail'
  | 'merchant_admin_general_retail';

export type MerchantIndustryTemplateStatus = 'open' | 'coming_soon';

export type MerchantOperatingModel = 'production' | 'wholesale' | 'both';

export type MerchantIndustryTemplateSource =
  | 'SELF_SELECTED'
  | 'GOOGLE_ONBOARDING'
  | 'ADMIN'
  | 'LEGACY_MIGRATED'
  | 'LEGACY_PENDING_REVIEW'
  | 'MERCHANT_UPDATED';

export type MerchantWorkspaceModuleId =
  | 'dashboard'
  | 'pos'
  | 'products'
  | 'sku_matrix'
  | 'materials'
  | 'production'
  | 'inventory'
  | 'procurement'
  | 'orders'
  | 'vault_requests'
  | 'customers'
  | 'finance'
  | 'growth'
  | 'content'
  | 'gallery'
  | 'ai_employees'
  | 'fashion_studio'
  | 'modagpt'
  | 'profile'
  | 'settings';

export type MerchantWorkspaceTemplate = {
  id: MerchantWorkspaceTemplateId;
  zh: string;
  it: string;
  /** 与 `MerchantPortal` 的 `activeTab` 取值保持一致。 */
  modules: readonly MerchantWorkspaceModuleId[];
};

export const merchantWorkspaceTemplates: Readonly<Record<MerchantWorkspaceTemplateId, MerchantWorkspaceTemplate>> = {
  merchant_admin_apparel_production_wholesale: {
    id: 'merchant_admin_apparel_production_wholesale',
    zh: '服装生产批发商后台',
    it: 'Backoffice produzione e ingrosso abbigliamento',
    modules: [
      'dashboard', 'pos', 'products', 'sku_matrix', 'materials', 'production', 'inventory',
      'procurement', 'orders', 'vault_requests', 'customers', 'finance', 'growth', 'content',
      'gallery', 'ai_employees', 'fashion_studio', 'modagpt', 'profile', 'settings'
    ]
  },
  merchant_admin_apparel_wholesale: {
    id: 'merchant_admin_apparel_wholesale',
    zh: '服装批发商后台',
    it: 'Backoffice ingrosso abbigliamento',
    modules: [
      'dashboard', 'products', 'sku_matrix', 'inventory', 'procurement',
      'orders', 'vault_requests', 'customers', 'finance', 'growth', 'content',
      'gallery', 'ai_employees', 'modagpt', 'profile', 'settings'
    ]
  },
  merchant_admin_trading_wholesale: {
    id: 'merchant_admin_trading_wholesale',
    zh: '贸易批发商后台',
    it: 'Backoffice trading wholesale',
    modules: [
      'dashboard', 'products', 'inventory', 'procurement', 'orders', 'customers',
      'finance', 'growth', 'content', 'gallery', 'ai_employees', 'modagpt',
      'profile', 'settings'
    ]
  },
  merchant_admin_department_wholesale: {
    id: 'merchant_admin_department_wholesale',
    zh: '百货批发商后台',
    it: 'Backoffice ingrosso department',
    // 旧版 MerchantPortal 标签清单；行业后台以 merchantIndustryCapabilities 为准。
    // 该行业未开放 POS（features.pos=false），这里也不得列出 pos，避免菜单与接口不一致。
    modules: [
      'dashboard', 'products', 'sku_matrix', 'inventory', 'procurement',
      'orders', 'customers', 'finance', 'growth', 'content', 'gallery',
      'ai_employees', 'modagpt', 'profile', 'settings'
    ]
  },
  merchant_admin_bags_wholesale: {
    id: 'merchant_admin_bags_wholesale',
    zh: '箱包批发商后台',
    it: 'Backoffice ingrosso borse',
    modules: [
      'dashboard', 'products', 'sku_matrix', 'inventory', 'procurement',
      'orders', 'customers', 'finance', 'growth', 'content', 'gallery',
      'ai_employees', 'modagpt', 'profile', 'settings'
    ]
  },
  merchant_admin_department_chain_retail: {
    id: 'merchant_admin_department_chain_retail',
    zh: '百货连锁店后台',
    it: 'Backoffice catena department store',
    // 连锁店不做总部采购，pos 仍由门店收银承载。
    modules: [
      'dashboard', 'pos', 'products', 'sku_matrix', 'inventory',
      'orders', 'customers', 'finance', 'growth', 'content', 'gallery',
      'ai_employees', 'modagpt', 'profile', 'settings'
    ]
  },
  merchant_admin_general_retail: {
    id: 'merchant_admin_general_retail',
    zh: '综合零售商后台',
    it: 'Backoffice retail generalista',
    modules: [
      'dashboard', 'pos', 'products', 'sku_matrix', 'inventory', 'procurement',
      'orders', 'customers', 'finance', 'growth', 'content', 'gallery',
      'ai_employees', 'modagpt', 'profile', 'settings'
    ]
  }
};

/** 与注册页 `categoryOptions`、`/api/auth/register/company` 的 `allowedCategories` 对齐。 */
const apparelCategories = [
  'WOMENSWEAR', 'MENSWEAR', 'KIDSWEAR', 'BABYWEAR', 'CLOTHING', 'LINGERIE',
  'SPORTSWEAR', 'OUTERWEAR', 'DENIM', 'ACCESSORIES', 'LEATHER_GOODS',
  'TEXTILES', 'FABRICS_TRIMS', 'OTHER'
] as const;

export type MerchantIndustryTemplate = {
  id: MerchantIndustryTemplateId;
  zh: string;
  it: string;
  merchantIndustry: string;
  workspaceTemplateId: MerchantWorkspaceTemplateId | null;
  status: MerchantIndustryTemplateStatus;
  categories: readonly string[];
  asksOperatingModel: boolean;
  asksProductionCapacity: boolean;
  asksMaterials: boolean;
};

function buildTemplate(
  id: MerchantIndustryTemplateId,
  zh: string,
  it: string,
  merchantIndustry: string,
  workspaceTemplateId: MerchantWorkspaceTemplateId | null,
  status: MerchantIndustryTemplateStatus,
  categories: readonly string[] = apparelCategories,
  asksOperatingModel = false,
  asksProductionCapacity = false,
  asksMaterials = false
): MerchantIndustryTemplate {
  return {
    id, zh, it, merchantIndustry, workspaceTemplateId, status,
    categories, asksOperatingModel, asksProductionCapacity, asksMaterials
  };
}

export const merchantIndustryTemplates: readonly MerchantIndustryTemplate[] = [
  // 7 个正式开放模板；服装生产批发商继续绑定现有后台。
  buildTemplate(
    'apparel_production_wholesale', '服装生产批发商', 'Produzione e ingrosso abbigliamento',
    'FASHION_COMPANY', 'merchant_admin_apparel_production_wholesale', 'open',
    apparelCategories, true, true, true
  ),
  buildTemplate('apparel_wholesale', '服装批发商', 'Ingrosso abbigliamento', 'FASHION_WHOLESALE', 'merchant_admin_apparel_wholesale', 'open', apparelCategories),
  buildTemplate('trading_wholesale', '贸易批发商', 'Grossista trading multi-brand', 'TRADING_COMPANY', 'merchant_admin_trading_wholesale', 'open'),
  buildTemplate('department_wholesale', '百货批发商', 'Grossista department multi-categoria', 'DEPARTMENT_STORE', 'merchant_admin_department_wholesale', 'open'),
  buildTemplate('bags_wholesale', '箱包批发商', 'Ingrosso borse e valigeria', 'LEATHER_GOODS', 'merchant_admin_bags_wholesale', 'open'),
  buildTemplate('department_chain_retail', '百货连锁店', 'Catena retail department store', 'DEPARTMENT_STORE', 'merchant_admin_department_chain_retail', 'open'),
  buildTemplate('general_retail', '综合零售商', 'Retail generalista', 'RETAIL_STORE', 'merchant_admin_general_retail', 'open')
];

export const DEFAULT_MERCHANT_INDUSTRY_TEMPLATE_ID: MerchantIndustryTemplateId = 'apparel_production_wholesale';

export function getMerchantIndustryTemplate(value: unknown): MerchantIndustryTemplate | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  return merchantIndustryTemplates.find(item => item.id === normalized) || null;
}

export function isOpenMerchantIndustryTemplate(value: unknown): boolean {
  return getMerchantIndustryTemplate(value)?.status === 'open';
}

export const openMerchantIndustryTemplates: readonly MerchantIndustryTemplate[] =
  merchantIndustryTemplates.filter(item => item.status === 'open');

/** 旧客户端只传 ModaGPT 行业包时的回退映射：仅已开放模板可命中。 */
export function findOpenMerchantIndustryTemplateByIndustry(industry: unknown): MerchantIndustryTemplate | null {
  if (typeof industry !== 'string') return null;
  const normalized = industry.trim().toUpperCase();
  if (!normalized) return null;
  return openMerchantIndustryTemplates.find(item => item.merchantIndustry === normalized) || null;
}

export function getMerchantWorkspaceTemplate(value: unknown): MerchantWorkspaceTemplate | null {
  if (typeof value !== 'string') return null;
  return (merchantWorkspaceTemplates as Record<string, MerchantWorkspaceTemplate>)[value] || null;
}

export type MerchantRegistrationProfile = {
  operatingModel?: MerchantOperatingModel;
  hasProductionCapacity?: boolean;
  carriesMaterials?: boolean;
  categories: string[];
  roles: string[];
};

export type MerchantWorkspaceStatus = 'active' | 'legacy_review' | 'unavailable';

export type MerchantWorkspaceSnapshot = {
  templateId: string | null;
  templateNameZh: string | null;
  templateNameIt: string | null;
  templateSource: string;
  workspaceTemplateId: string | null;
  workspaceNameZh: string | null;
  workspaceNameIt: string | null;
  modules: string[];
  status: MerchantWorkspaceStatus;
  accessAllowed: boolean;
};

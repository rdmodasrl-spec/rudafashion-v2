/**
 * 商家经营类型模板（单一事实来源）。
 *
 * - `merchantIndustry` 写入 `Merchant.industry`，仍是 ModaGPT 行业包 ID，语义不变。
 * - `workspaceTemplateId` 指向商家后台工作区；已开放模板各自有独立工作区。
 * - 服务端 `src/server/merchantIndustryTemplates.ts` 与所有前端共用本文件，禁止另建第二份清单。
 */

export type MerchantIndustryTemplateId =
  | 'apparel_production_wholesale'
  | 'apparel_wholesale'
  | 'trading_wholesale'
  | 'department_wholesale'
  | 'bags_wholesale'
  | 'department_chain_retail'
  | 'general_retail'
  | 'restaurant_ordering';

export type MerchantWorkspaceTemplateId =
  | 'merchant_admin_apparel_production_wholesale'
  | 'merchant_admin_apparel_wholesale'
  | 'merchant_admin_trading_wholesale'
  | 'merchant_admin_department_wholesale'
  | 'merchant_admin_bags_wholesale'
  | 'merchant_admin_department_chain_retail'
  | 'merchant_admin_general_retail'
  | 'merchant_admin_restaurant_ordering';

export type MerchantIndustryTemplateStatus = 'open' | 'coming_soon';

export type MerchantOperatingModel = 'production' | 'wholesale' | 'both';

export type MerchantFormalIndustryId =
  | 'WHOLESALE_APPAREL'
  | 'WHOLESALE_LEATHER_GOODS'
  | 'WHOLESALE_GENERAL_MERCHANDISE'
  | 'WHOLESALE_COMPREHENSIVE'
  | 'RETAIL_GENERAL_MERCHANDISE'
  | 'RETAIL_ECOMMERCE'
  | 'RETAIL_RESTAURANT'
  | 'RETAIL_BEAUTY_HAIR';

export type MerchantIndustryCapabilityId = 'APPAREL_OWN_PRODUCTION' | 'LEATHER_OWN_PRODUCTION';

export type MerchantFormalIndustry = {
  id: MerchantFormalIndustryId;
  zh: string;
  it: string;
  businessModel: 'WHOLESALE' | 'RETAIL';
  studioCode: string;
  knowledgeNamespace: string;
  workspaceAdapterTemplateIds: readonly MerchantIndustryTemplateId[];
  legacyTemplateIds: readonly MerchantIndustryTemplateId[];
  registrationStatus: 'open' | 'coming_soon';
  capabilityIds: readonly MerchantIndustryCapabilityId[];
};

/**
 * V2.2 product identity registry. Legacy templates below remain workspace adapters;
 * they are not aliases for every formal industry and never grant access by themselves.
 */
export const merchantFormalIndustries: readonly MerchantFormalIndustry[] = [
  {
    id: 'WHOLESALE_APPAREL',
    zh: '服装批发',
    it: 'Ingrosso abbigliamento',
    businessModel: 'WHOLESALE',
    studioCode: 'apparel_studio',
    knowledgeNamespace: 'apparel',
    workspaceAdapterTemplateIds: ['apparel_wholesale', 'apparel_production_wholesale'],
    legacyTemplateIds: ['apparel_wholesale', 'apparel_production_wholesale'],
    registrationStatus: 'open',
    capabilityIds: ['APPAREL_OWN_PRODUCTION']
  },
  {
    id: 'WHOLESALE_LEATHER_GOODS',
    zh: '皮具箱包批发',
    it: 'Ingrosso pelletteria e borse',
    businessModel: 'WHOLESALE',
    studioCode: 'leather_studio',
    knowledgeNamespace: 'leather',
    workspaceAdapterTemplateIds: ['bags_wholesale'],
    legacyTemplateIds: ['bags_wholesale'],
    registrationStatus: 'open',
    capabilityIds: ['LEATHER_OWN_PRODUCTION']
  },
  {
    id: 'WHOLESALE_GENERAL_MERCHANDISE',
    zh: '百货批发',
    it: 'Ingrosso articoli vari',
    businessModel: 'WHOLESALE',
    studioCode: 'department_wholesale_studio',
    knowledgeNamespace: 'department_wholesale',
    workspaceAdapterTemplateIds: ['department_wholesale'],
    legacyTemplateIds: ['department_wholesale'],
    registrationStatus: 'open',
    capabilityIds: []
  },
  {
    id: 'WHOLESALE_COMPREHENSIVE',
    zh: '综合批发',
    it: 'Ingrosso multi-categoria',
    businessModel: 'WHOLESALE',
    studioCode: 'comprehensive_wholesale_studio',
    knowledgeNamespace: 'comprehensive_wholesale',
    workspaceAdapterTemplateIds: ['department_wholesale'],
    legacyTemplateIds: [],
    registrationStatus: 'open',
    capabilityIds: []
  },
  {
    id: 'RETAIL_GENERAL_MERCHANDISE',
    zh: '百货零售',
    it: 'Vendita al dettaglio articoli vari',
    businessModel: 'RETAIL',
    studioCode: 'retail_general_studio',
    knowledgeNamespace: 'retail_general_merchandise',
    workspaceAdapterTemplateIds: ['department_chain_retail'],
    legacyTemplateIds: ['department_chain_retail'],
    registrationStatus: 'open',
    capabilityIds: []
  },
  {
    id: 'RETAIL_ECOMMERCE',
    zh: '电商',
    it: 'E-commerce',
    businessModel: 'RETAIL',
    studioCode: 'ecommerce_studio',
    knowledgeNamespace: 'ecommerce',
    workspaceAdapterTemplateIds: ['general_retail'],
    legacyTemplateIds: [],
    registrationStatus: 'open',
    capabilityIds: []
  },
  {
    id: 'RETAIL_RESTAURANT',
    zh: '餐饮',
    it: 'Ristorazione',
    businessModel: 'RETAIL',
    studioCode: 'restaurant_studio',
    knowledgeNamespace: 'restaurant',
    workspaceAdapterTemplateIds: ['restaurant_ordering'],
    legacyTemplateIds: ['restaurant_ordering'],
    registrationStatus: 'open',
    capabilityIds: []
  },
  {
    id: 'RETAIL_BEAUTY_HAIR',
    zh: '美容美发',
    it: 'Bellezza e parrucchiere',
    businessModel: 'RETAIL',
    studioCode: 'beauty_hair_studio',
    knowledgeNamespace: 'beauty_hair',
    workspaceAdapterTemplateIds: [],
    legacyTemplateIds: [],
    registrationStatus: 'coming_soon',
    capabilityIds: []
  }
];

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
  | 'restaurant_menu'
  | 'restaurant_tables'
  | 'profile'
  | 'settings';

export type MerchantWorkspaceTemplate = {
  id: MerchantWorkspaceTemplateId;
  zh: string;
  it: string;
  /** 与 `MerchantPortal` 的 `activeTab` 取值保持一致。 */
  modules: readonly MerchantWorkspaceModuleId[];
};

export type MerchantFormalIndustryResolution =
  | {
    ok: true;
    industry: MerchantFormalIndustry;
    template: MerchantIndustryTemplate;
    capabilityIds: MerchantIndustryCapabilityId[];
  }
  | {
    ok: false;
    error: 'INVALID_FORMAL_INDUSTRY_ID' | 'FORMAL_INDUSTRY_NOT_OPEN' | 'INVALID_INDUSTRY_CAPABILITY';
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
  },
  merchant_admin_restaurant_ordering: {
    id: 'merchant_admin_restaurant_ordering',
    zh: 'RUDA 餐饮后台',
    it: 'Backoffice RUDA Restaurant',
    modules: ['restaurant_menu', 'restaurant_tables']
  }
};

/** Registration UI and API both use the selected template's category whitelist. */
const merchantCategories = [
  'WOMENSWEAR', 'MENSWEAR', 'KIDSWEAR', 'BABYWEAR', 'CLOTHING', 'LINGERIE',
  'SPORTSWEAR', 'OUTERWEAR', 'DENIM', 'BAGS', 'SHOES', 'JEWELRY', 'WATCHES',
  'ACCESSORIES', 'LEATHER_GOODS', 'TEXTILES', 'FABRICS_TRIMS',
  'BEAUTY_COSMETICS', 'PERFUME', 'HOME_LIFESTYLE', 'HOME_DECOR',
  'GIFT_STATIONERY', 'LUGGAGE_TRAVEL', 'PET_PRODUCTS', 'OTHER'
] as const;

const restaurantCategories = [
  'RESTAURANT', 'CAFE', 'TAKEAWAY', 'BAKERY', 'CATERING', 'OTHER'
] as const;

export type MerchantIndustryTemplate = {
  id: MerchantIndustryTemplateId;
  zh: string;
  it: string;
  industryCode?: string;
  studioCode?: string;
  knowledgeNamespace?: string;
  studioImageGuidance?: string;
  modauiPrompts?: readonly MerchantIndustryChatPrompt[];
  merchantIndustry: string;
  workspaceTemplateId: MerchantWorkspaceTemplateId | null;
  status: MerchantIndustryTemplateStatus;
  categories: readonly string[];
  asksOperatingModel: boolean;
  asksProductionCapacity: boolean;
  asksMaterials: boolean;
};

export type MerchantIndustryChatPrompt = {
  labelZh: string;
  labelIt: string;
  promptZh: string;
  promptIt: string;
};

function buildTemplate(
  id: MerchantIndustryTemplateId,
  zh: string,
  it: string,
  merchantIndustry: string,
  workspaceTemplateId: MerchantWorkspaceTemplateId | null,
  status: MerchantIndustryTemplateStatus,
  categories: readonly string[] = merchantCategories,
  asksOperatingModel = false,
  asksProductionCapacity = false,
  asksMaterials = false,
  studioMapping?: Pick<MerchantIndustryTemplate, 'industryCode' | 'studioCode' | 'knowledgeNamespace'>
): MerchantIndustryTemplate {
  return {
    id, zh, it, merchantIndustry, workspaceTemplateId, status,
    categories, asksOperatingModel, asksProductionCapacity, asksMaterials,
    ...studioMapping
  };
}

const modauiIndustryChatPrompts: Partial<Record<MerchantIndustryTemplateId, readonly MerchantIndustryChatPrompt[]>> = {
  trading_wholesale: [
    {
      labelZh: '分析供应商供货表现',
      labelIt: 'Analizza le prestazioni dei fornitori',
      promptZh: '分析当前商家的供应商供货表现，包括历史采购和到货数据；没有数据时请明确说明。',
      promptIt: 'Analizza le prestazioni dei fornitori usando gli acquisti e le consegne storiche del commerciante corrente; segnala chiaramente se i dati mancano.'
    },
    {
      labelZh: '准备采购草稿',
      labelIt: 'Prepara una bozza d’acquisto',
      promptZh: '帮我创建一张采购草稿。',
      promptIt: 'Prepara una bozza d’acquisto.'
    }
  ],
  department_wholesale: [
    {
      labelZh: '检查商品规格资料',
      labelIt: 'Controlla i dati prodotto',
      promptZh: '检查当前百货商品的包装规格、计量单位和资料缺项，只使用当前商家的真实商品数据。',
      promptIt: 'Controlla confezioni, unità di misura e dati mancanti dei prodotti del commerciante corrente usando solo i dati reali disponibili.'
    }
  ],
  bags_wholesale: [
    {
      labelZh: '检查箱包商品资料',
      labelIt: 'Controlla i dati degli articoli',
      promptZh: '整理当前箱包商品的材质、尺寸与 SKU 资料，并列出缺失字段。',
      promptIt: 'Riepiloga materiali, dimensioni e SKU degli articoli disponibili e indica i campi mancanti.'
    }
  ],
  department_chain_retail: [
    {
      labelZh: '分析门店销售与库存',
      labelIt: 'Analizza vendite e scorte dei negozi',
      promptZh: '分析当前商家各门店的销售和库存，列出有数据依据的调拨候选；不要执行调拨。',
      promptIt: 'Analizza vendite e scorte dei negozi del commerciante corrente, suggerisci trasferimenti basati sui dati e non eseguire alcun trasferimento.'
    }
  ],
  general_retail: [
    {
      labelZh: '分析销售与补货',
      labelIt: 'Analizza vendite e riassortimento',
      promptZh: '分析当前商家的 POS 销售和库存，列出有数据依据的补货候选；不要修改库存。',
      promptIt: 'Analizza vendite POS e scorte del commerciante corrente, suggerisci riassortimenti basati sui dati e non modificare l’inventario.'
    }
  ]
};

const modauiStudioImageGuidance: Readonly<Record<MerchantIndustryTemplateId, string>> = {
  apparel_production_wholesale: '服装生产批发概念图：优先准确呈现用户描述的服装廓形、结构、颜色和可见面料质感；不输出打版、尺寸或生产结论。',
  apparel_wholesale: '服装批发商品展示图：突出清楚的服装商品与目录展示效果；不得暗示已完成虚拟试穿或保证不同候选图款式一致。',
  trading_wholesale: '贸易批发商品目录图：突出用户描述的商品本体与清晰背景；不要添加不存在的商标、认证、包装文字或来源信息。',
  department_wholesale: '百货批发商品图：呈现单一、易识别的商品及适合目录的构图；不得虚构包装规格、数量、条码或产品功效。',
  bags_wholesale: '箱包商品展示图：保持用户描述的包袋外形、结构、颜色与五金可见特征；不得仅凭生成图证明真实材质、尺寸或工艺。',
  department_chain_retail: '百货连锁营销概念图：呈现商品或活动氛围，不要虚构门店、销售数据、价格、折扣或已批准的促销信息。',
  general_retail: '综合零售商品展示图：让商品清晰可辨并适合零售目录或营销素材；不得添加未经确认的价格、功效、认证或品牌。',
  restaurant_ordering: '餐饮概念菜品图：必须作为 AI 创作的概念素材，不得声称是门店实际出餐或保证与顾客收到的菜品一致；不得捏造食材、过敏原、营养或食品安全信息。'
};

export const merchantIndustryTemplates: readonly MerchantIndustryTemplate[] = [
  // 7 个模板保持开放；餐饮映射先登记为关闭状态，待业务能力逐阶段验收后开放。
  buildTemplate(
    'apparel_production_wholesale', '服装生产批发商', 'Produzione e ingrosso abbigliamento',
    'FASHION_COMPANY', 'merchant_admin_apparel_production_wholesale', 'open',
    merchantCategories, true, true, true,
    { industryCode: 'apparel_production_wholesale', studioCode: 'apparel_studio', knowledgeNamespace: 'apparel' }
  ),
  buildTemplate(
    'apparel_wholesale', '服装批发商', 'Ingrosso abbigliamento',
    'FASHION_WHOLESALE', 'merchant_admin_apparel_wholesale', 'open', merchantCategories,
    false, false, false,
    { industryCode: 'apparel_wholesale', studioCode: 'apparel_studio', knowledgeNamespace: 'apparel' }
  ),
  buildTemplate(
    'trading_wholesale', '贸易批发商', 'Grossista trading multi-brand',
    'TRADING_COMPANY', 'merchant_admin_trading_wholesale', 'open',
    merchantCategories, false, false, false,
    { industryCode: 'trade_wholesale', studioCode: 'trade_studio', knowledgeNamespace: 'trade' }
  ),
  buildTemplate(
    'department_wholesale', '百货批发商', 'Grossista department multi-categoria',
    'DEPARTMENT_STORE', 'merchant_admin_department_wholesale', 'open',
    merchantCategories, false, false, false,
    { industryCode: 'department_wholesale', studioCode: 'department_wholesale_studio', knowledgeNamespace: 'department_wholesale' }
  ),
  buildTemplate(
    'bags_wholesale', '箱包批发商', 'Ingrosso borse e valigeria',
    'LEATHER_GOODS', 'merchant_admin_bags_wholesale', 'open',
    merchantCategories, false, false, false,
    { industryCode: 'leather_bag_wholesale', studioCode: 'leather_studio', knowledgeNamespace: 'leather' }
  ),
  buildTemplate(
    'department_chain_retail', '百货连锁店', 'Catena retail department store',
    'DEPARTMENT_STORE', 'merchant_admin_department_chain_retail', 'open',
    merchantCategories, false, false, false,
    { industryCode: 'department_store_chain', studioCode: 'retail_chain_studio', knowledgeNamespace: 'retail_chain' }
  ),
  buildTemplate(
    'general_retail', '综合零售商', 'Retail generalista',
    'RETAIL_STORE', 'merchant_admin_general_retail', 'open',
    merchantCategories, false, false, false,
    { industryCode: 'general_retail', studioCode: 'retail_studio', knowledgeNamespace: 'retail' }
  ),
  buildTemplate(
    'restaurant_ordering', 'RUDA Restaurant', 'RUDA Restaurant',
    'RESTAURANT', 'merchant_admin_restaurant_ordering', 'open',
    restaurantCategories, false, false, false,
    { industryCode: 'restaurant', studioCode: 'restaurant_studio', knowledgeNamespace: 'restaurant' }
  )
].map(template => ({
  ...template,
  studioImageGuidance: modauiStudioImageGuidance[template.id],
  modauiPrompts: modauiIndustryChatPrompts[template.id]
}));

export const DEFAULT_MERCHANT_INDUSTRY_TEMPLATE_ID: MerchantIndustryTemplateId = 'apparel_production_wholesale';

export function getMerchantIndustryTemplate(value: unknown): MerchantIndustryTemplate | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  return merchantIndustryTemplates.find(item => item.id === normalized) || null;
}

export function getMerchantFormalIndustry(value: unknown): MerchantFormalIndustry | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  if (!normalized) return null;
  return merchantFormalIndustries.find(item => item.id === normalized) || null;
}

export function getFormalIndustryForLegacyTemplate(value: unknown): MerchantFormalIndustry | null {
  const template = getMerchantIndustryTemplate(value);
  if (!template) return null;
  return merchantFormalIndustries.find(item => item.legacyTemplateIds.includes(template.id)) || null;
}

export function resolveFormalMerchantIndustry(
  input: { formalIndustryId?: unknown; capabilityIds?: unknown; industryTemplate?: unknown } | null | undefined
): MerchantFormalIndustryResolution {
  const industry = getMerchantFormalIndustry(input?.formalIndustryId);
  if (!industry) return { ok: false, error: 'INVALID_FORMAL_INDUSTRY_ID' };
  if (industry.registrationStatus !== 'open' || industry.workspaceAdapterTemplateIds.length === 0) {
    return { ok: false, error: 'FORMAL_INDUSTRY_NOT_OPEN' };
  }

  const requestedCapabilities = Array.isArray(input?.capabilityIds)
    ? [...new Set(input.capabilityIds.filter((value): value is string => typeof value === 'string').map(value => value.trim().toUpperCase()).filter(Boolean))]
    : [];
  const allowedCapabilities = new Set<string>(industry.capabilityIds);
  if (requestedCapabilities.some(value => !allowedCapabilities.has(value))) {
    return { ok: false, error: 'INVALID_INDUSTRY_CAPABILITY' };
  }

  const legacyTemplateId = industry.id === 'WHOLESALE_APPAREL'
    && requestedCapabilities.includes('APPAREL_OWN_PRODUCTION')
    ? 'apparel_production_wholesale'
    : industry.workspaceAdapterTemplateIds[0];
  if (!legacyTemplateId) return { ok: false, error: 'FORMAL_INDUSTRY_NOT_OPEN' };
  const requestedTemplate = typeof input?.industryTemplate === 'string' && input.industryTemplate.trim()
    ? getMerchantIndustryTemplate(input.industryTemplate)
    : null;
  if (input?.industryTemplate && (!requestedTemplate || requestedTemplate.id !== legacyTemplateId)) {
    return { ok: false, error: 'INVALID_FORMAL_INDUSTRY_ID' };
  }
  const template = getMerchantIndustryTemplate(legacyTemplateId);
  if (!template || template.status !== 'open') return { ok: false, error: 'FORMAL_INDUSTRY_NOT_OPEN' };
  return {
    ok: true,
    industry,
    template,
    capabilityIds: industry.capabilityIds.filter(capability => requestedCapabilities.includes(capability))
  };
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

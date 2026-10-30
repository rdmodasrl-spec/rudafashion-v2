import type { ModaGptAgentRole } from './modagptRuntime';
import type { MerchantIndustry } from '../constants/merchantIndustries';
import type { MerchantIndustryTemplateId } from '../constants/merchantIndustryTemplates';

export type ModaGptIndustry =
  | MerchantIndustry
  | 'FASHION_WHOLESALE'
  | 'WHOLESALE_COMPANY'
  | 'OTHER';

export type ModaGptIndustrySource =
  | 'SELF_SELECTED'
  | 'GOOGLE_ONBOARDING'
  | 'ADMIN'
  | 'MERCHANT_UPDATED'
  | 'LEGACY_INFERENCE';

export const MODAGPT_INDUSTRY_PACK_VERSION = '1.0.0' as const;

export type ModaGptIndustryPack = {
  id: ModaGptIndustry;
  businessTypes: readonly string[];
  workflows: readonly string[];
  employees: Record<ModaGptAgentRole, {
    agentId: ModaGptAgentRole;
    agentType: 'core_employee';
    industry: ModaGptIndustry;
    displayName: string;
    skills: readonly string[];
    tools: readonly string[];
    defaultPermissions: readonly string[];
    memoryScope: readonly ('MERCHANT' | 'BRAND' | 'PRODUCT' | 'AGENT')[];
    knowledgeScope: readonly string[];
    knowledgeTags: readonly string[];
    modelPolicy: { requiredCapabilities: readonly ('text' | 'vision' | 'image')[]; allowProviderSelection: false };
    riskPolicy: { maxAutonomousRisk: 'LOW'; writesRequireApproval: true };
    version: typeof MODAGPT_INDUSTRY_PACK_VERSION;
    status: 'pilot';
  }>;
};

export type ModaGptIndustryTemplateAssistantProfile = {
  templateId: MerchantIndustryTemplateId;
  agentId: ModaGptAgentRole;
  displayName: string;
  skills: readonly string[];
  tools: readonly [string];
  knowledgeTags: readonly string[];
  intentPattern: RegExp;
};

const templateAssistantProfiles: Partial<Record<MerchantIndustryTemplateId, ModaGptIndustryTemplateAssistantProfile>> = {
  department_wholesale: {
    templateId: 'department_wholesale',
    agentId: 'business-manager',
    displayName: '百货批发商品资料分析助手',
    skills: ['assortment_data_quality', 'packaging_and_unit_analysis', 'barcode_catalog_review'],
    tools: ['department_wholesale_catalog_analysis'],
    knowledgeTags: ['department_wholesale', 'packaging', 'units', 'barcode', 'assortment'],
    intentPattern: /(?:百货.{0,12}(?:商品|包装|规格|单位|目录)|商品.{0,12}(?:包装规格|计量单位|资料完整)|包装规格|计量单位|混批资料|条码资料)/i
  },
  bags_wholesale: {
    templateId: 'bags_wholesale',
    agentId: 'business-manager',
    displayName: '箱包商品资料分析助手',
    skills: ['bag_material_and_dimension_review', 'sku_catalog_quality', 'wholesale_assortment_analysis'],
    tools: ['bags_wholesale_catalog_analysis'],
    knowledgeTags: ['bags', 'leather_goods', 'materials', 'dimensions', 'capacity', 'sku'],
    intentPattern: /(?:箱包|手袋|皮具|包袋).{0,24}(?:分析|材质|尺寸|容量|SKU|商品资料|目录)|(?:材质|尺寸|容量).{0,16}(?:箱包|手袋|皮具|包袋)|箱包商品资料/i
  },
  department_chain_retail: {
    templateId: 'department_chain_retail',
    agentId: 'business-manager',
    displayName: '百货连锁门店经营分析助手',
    skills: ['multi_store_performance', 'store_stock_distribution', 'transfer_recommendation'],
    tools: ['department_chain_store_analysis'],
    knowledgeTags: ['department_chain_retail', 'stores', 'pos', 'store_stock', 'transfer'],
    intentPattern: /(?:门店|分店|连锁|跨店|调拨建议).{0,24}(?:分析|销售|库存|补货|表现|对比|建议)?|(?:分析|比较|对比).{0,20}(?:门店|分店|连锁)|门店.{0,12}调拨/i
  },
  general_retail: {
    templateId: 'general_retail',
    agentId: 'business-manager',
    displayName: '综合零售 POS 经营分析助手',
    skills: ['pos_sales_analysis', 'barcode_catalog_quality', 'retail_replenishment_review'],
    tools: ['general_retail_pos_analysis'],
    knowledgeTags: ['general_retail', 'pos', 'barcode', 'sales', 'replenishment'],
    intentPattern: /(?:POS|收银|条码|零售).{0,24}(?:分析|销售|商品|补货|表现|经营)?|(?:分析|查看).{0,20}(?:零售销售|收银|条码)|零售.{0,12}(?:补货|销售)/i
  }
};

export function getModaGptIndustryTemplateAssistantProfile(
  templateId: unknown
): ModaGptIndustryTemplateAssistantProfile | null {
  if (typeof templateId !== 'string'
    || !Object.prototype.hasOwnProperty.call(templateAssistantProfiles, templateId)) return null;
  return templateAssistantProfiles[templateId as MerchantIndustryTemplateId] || null;
}

const coreAgentRoles: readonly ModaGptAgentRole[] = [
  'business-manager',
  'product-creative-manager',
  'sales-customer-manager',
  'supply-chain-finance-manager'
];

function employee(
  agentId: ModaGptAgentRole,
  industry: ModaGptIndustry,
  displayName: string,
  skills: readonly string[],
  tools: readonly string[],
  knowledgeTags: readonly string[],
  capabilities: readonly ('text' | 'vision' | 'image')[] = ['text']
) {
  const defaultPermissions = [
    ...(tools.includes('product_search') ? ['product.catalog.read'] : []),
    ...(tools.includes('inventory_search') ? ['inventory.stock.read', 'sales.summary.read'] : []),
    ...(tools.includes('sales_summary') ? ['sales.summary.read'] : []),
    ...(tools.includes('get_suppliers') || tools.includes('create_procurement_draft') || tools.includes('get_supplier_performance')
      ? ['purchase.manage']
      : []),
    ...(tools.includes('currency_convert') ? ['business.analytics.read'] : [])
  ];
  return {
    agentId,
    agentType: 'core_employee' as const,
    industry,
    displayName,
    skills,
    tools,
    defaultPermissions,
    memoryScope: ['MERCHANT', 'BRAND', 'PRODUCT', 'AGENT'] as const,
    knowledgeScope: knowledgeTags,
    knowledgeTags,
    modelPolicy: {
      requiredCapabilities: capabilities,
      allowProviderSelection: false as const
    },
    riskPolicy: {
      maxAutonomousRisk: 'LOW' as const,
      writesRequireApproval: true as const
    },
    version: MODAGPT_INDUSTRY_PACK_VERSION,
    status: 'pilot' as const
  };
}

function createPack(input: {
  id: ModaGptIndustry;
  businessTypes: readonly string[];
  names: readonly [string, string, string, string];
  skills: readonly [readonly string[], readonly string[], readonly string[], readonly string[]];
  tags: readonly string[];
  workflows: readonly string[];
  extraTools?: Partial<Record<ModaGptAgentRole, string[]>>;
}): ModaGptIndustryPack {
  return {
    id: input.id,
    businessTypes: input.businessTypes,
    workflows: input.workflows,
    employees: {
      'business-manager': employee(
        'business-manager',
        input.id,
        input.names[0],
        input.skills[0],
        input.extraTools?.['business-manager'] || [],
        input.tags
      ),
      'product-creative-manager': employee(
        'product-creative-manager',
        input.id,
        input.names[1],
        input.skills[1],
        ['product_search', ...(input.extraTools?.['product-creative-manager'] || [])],
        [...input.tags, 'product_catalog'],
        ['text', 'vision', 'image']
      ),
      'sales-customer-manager': employee(
        'sales-customer-manager',
        input.id,
        input.names[2],
        input.skills[2],
        ['sales_summary', ...(input.extraTools?.['sales-customer-manager'] || [])],
        [...input.tags, 'customer_operations']
      ),
      'supply-chain-finance-manager': employee(
        'supply-chain-finance-manager',
        input.id,
        input.names[3],
        input.skills[3],
        ['inventory_search', 'replenishment_analysis', ...(input.extraTools?.['supply-chain-finance-manager'] || [])],
        [...input.tags, 'supply_chain']
      )
    }
  };
}

export const modaGptIndustryPacks: Readonly<Record<ModaGptIndustry, ModaGptIndustryPack>> = {
  FASHION_COMPANY: createPack({
    id: 'FASHION_COMPANY',
    businessTypes: ['apparel', 'leather', 'tailor', 'atelier', 'brand_supplier', 'manufacturer'],
    names: ['AI 经营总管', 'AI 商品与创意经理', 'AI 销售与客户经理', 'AI 供应链与财务经理'],
    skills: [
      ['fashion_business_analysis', 'task_coordination'],
      ['fashion_merchandising', 'product_catalog', 'creative_brief', 'fashion_design'],
      ['wholesale_sales', 'customer_relationships', 'quote_preparation'],
      ['sku_inventory', 'replenishment_analysis', 'supplier_operations']
    ],
    tags: ['fashion', 'apparel', 'seasonal_collection', 'fashion_wholesale'],
    workflows: ['inventory_low_replenishment']
  }),
  FASHION_WHOLESALE: createPack({
    id: 'FASHION_WHOLESALE',
    businessTypes: ['fashion_wholesale'],
    names: ['AI 批发经营总管', 'AI 商品与创意经理', 'AI 批发销售经理', 'AI 供应链与财务经理'],
    skills: [
      ['wholesale_business_analysis', 'task_coordination'],
      ['fashion_merchandising', 'product_catalog', 'creative_brief'],
      ['b2b_sales', 'customer_relationships', 'quote_preparation'],
      ['bulk_inventory', 'replenishment_analysis', 'supplier_operations']
    ],
    tags: ['fashion', 'wholesale', 'b2b', 'assortment'],
    workflows: ['inventory_low_replenishment']
  }),
  LEATHER_GOODS: createPack({
    id: 'LEATHER_GOODS',
    businessTypes: ['leather_wholesale', 'leather_goods_wholesale'],
    names: ['AI 皮包批发经营总管', 'AI 皮具商品经理', 'AI 批发销售经理', 'AI 皮具库存与供应链经理'],
    skills: [
      ['wholesale_business_analysis', 'task_coordination'],
      ['fashion_merchandising', 'product_catalog', 'creative_brief'],
      ['b2b_sales', 'customer_relationships', 'quote_preparation'],
      ['bulk_inventory', 'replenishment_analysis', 'supplier_operations']
    ],
    tags: ['leather_goods', 'bags', 'wholesale', 'b2b', 'assortment'],
    workflows: ['inventory_low_replenishment']
  }),
  DEPARTMENT_STORE: createPack({
    id: 'DEPARTMENT_STORE',
    businessTypes: ['department', 'department_store'],
    names: ['AI 百货经营总管', 'AI 商品与营销经理', 'AI 客户与销售经理', 'AI 库存与财务经理'],
    skills: [
      ['retail_performance', 'task_coordination'],
      ['retail_assortment', 'product_catalog', 'visual_merchandising'],
      ['retail_sales_analysis', 'customer_relationships'],
      ['store_inventory', 'replenishment_analysis', 'financial_reporting']
    ],
    tags: ['department_store', 'retail', 'assortment', 'sell_through'],
    workflows: ['inventory_low_replenishment']
  }),
  RETAIL_STORE: createPack({
    id: 'RETAIL_STORE',
    businessTypes: ['retail', 'retailer', 'boutique', 'retail_store'],
    names: ['AI 店铺经营总管', 'AI 商品与营销经理', 'AI 客户与销售经理', 'AI 库存与财务经理'],
    skills: [
      ['retail_performance', 'task_coordination'],
      ['retail_assortment', 'product_catalog', 'visual_merchandising'],
      ['retail_sales_analysis', 'customer_relationships'],
      ['store_inventory', 'replenishment_analysis', 'financial_reporting']
    ],
    tags: ['retail', 'store_operations', 'assortment', 'sell_through'],
    workflows: ['inventory_low_replenishment']
  }),
  TRADING_COMPANY: createPack({
    id: 'TRADING_COMPANY',
    businessTypes: ['trading', 'trader', 'import_export'],
    names: ['AI 贸易经营总管', 'AI 商品与业务经理', 'AI 客户与销售经理', 'AI 供应链与财务经理'],
    skills: [
      ['trading_business_analysis', 'task_coordination'],
      ['catalog_merchandising', 'product_catalog'],
      ['b2b_sales', 'customer_relationships', 'quote_preparation'],
      ['trade_supply_chain', 'inventory_search', 'financial_reporting']
    ],
    tags: ['trading', 'import_export', 'supplier_operations', 'b2b'],
    workflows: ['inventory_low_replenishment'],
    extraTools: {
      'product-creative-manager': ['get_suppliers'],
      'sales-customer-manager': ['currency_convert'],
      'supply-chain-finance-manager': ['get_suppliers', 'create_procurement_draft', 'get_supplier_performance', 'currency_convert']
    }
  }),
  WHOLESALE_COMPANY: createPack({
    id: 'WHOLESALE_COMPANY',
    businessTypes: ['wholesale', 'wholesaler', 'distributor'],
    names: ['AI 批发经营总管', 'AI 商品与业务经理', 'AI 客户与销售经理', 'AI 供应链与财务经理'],
    skills: [
      ['wholesale_business_analysis', 'task_coordination'],
      ['catalog_merchandising', 'product_catalog'],
      ['b2b_sales', 'customer_relationships', 'quote_preparation'],
      ['bulk_inventory', 'replenishment_analysis', 'supplier_operations']
    ],
    tags: ['wholesale', 'b2b', 'assortment', 'supplier_operations'],
    workflows: ['inventory_low_replenishment']
  }),
  RESTAURANT: createPack({
    id: 'RESTAURANT',
    businessTypes: ['restaurant', 'food_service'],
    names: ['AI 餐厅经营总管', 'AI 菜品与内容经理', 'AI 客户与销售经理', 'AI 采购与财务经理'],
    skills: [
      ['restaurant_business_analysis', 'task_coordination'],
      ['menu_merchandising', 'menu_content', 'dish_creative_brief'],
      ['restaurant_sales_analysis', 'customer_relationships'],
      ['ingredient_inventory', 'supplier_operations', 'financial_reporting']
    ],
    tags: ['restaurant', 'food_service', 'menu', 'dish', 'ingredient_supply'],
    workflows: []
  }),
  OTHER: createPack({
    id: 'OTHER',
    businessTypes: ['other'],
    names: ['AI 经营总管', 'AI 商品与内容经理', 'AI 客户与销售经理', 'AI 供应链与财务助手'],
    skills: [
      ['business_analysis', 'task_coordination'],
      ['product_content'],
      ['customer_relationships', 'sales_summary'],
      ['inventory_search', 'financial_reporting']
    ],
    tags: ['general_business', 'merchant_operations'],
    workflows: []
  })
};

export function parseModaGptIndustry(value: unknown): ModaGptIndustry | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(modaGptIndustryPacks, normalized)
    ? normalized as ModaGptIndustry
    : null;
}

export function requireModaGptIndustry(value: unknown): ModaGptIndustry {
  const industry = parseModaGptIndustry(value);
  if (!industry) throw new Error('REQUIRE_INDUSTRY');
  return industry;
}

export function resolveNewModaGptIndustry(
  value: unknown
): { industry: ModaGptIndustry; error?: never } | { industry?: never; error: 'REQUIRE_INDUSTRY' | 'INVALID_INDUSTRY' } {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    return { error: 'REQUIRE_INDUSTRY' };
  }
  const industry = parseModaGptIndustry(value);
  return industry ? { industry } : { error: 'INVALID_INDUSTRY' };
}

export function inferModaGptIndustryFromBusinessType(businessType: string | null | undefined): ModaGptIndustry {
  const normalized = businessType?.trim().toLocaleLowerCase() || '';
  for (const pack of Object.values(modaGptIndustryPacks)) {
    if (pack.businessTypes.includes(normalized)) return pack.id;
  }
  return 'OTHER';
}

export function resolveModaGptIndustryPack(industry: string | null | undefined): ModaGptIndustryPack {
  const parsed = parseModaGptIndustry(industry);
  return parsed ? modaGptIndustryPacks[parsed] : modaGptIndustryPacks.OTHER;
}

export function getModaGptCoreAgentRoles(): readonly ModaGptAgentRole[] {
  return coreAgentRoles;
}

export function isCompleteModaGptCoreTeam(assignments: readonly { agentId: string }[]): boolean {
  return assignments.length === coreAgentRoles.length
    && coreAgentRoles.every(agentId => assignments.some(assignment => assignment.agentId === agentId));
}

export function isCurrentModaGptCoreTeam(
  assignments: readonly { agentId: string; packVersion: string }[]
): boolean {
  return isCompleteModaGptCoreTeam(assignments)
    && assignments.every(assignment => assignment.packVersion === MODAGPT_INDUSTRY_PACK_VERSION);
}

export function selectModaGptCoreAgentForLegacyCapability(
  capability: 'product_search' | 'inventory_search' | 'replenishment_analysis' | 'sales_summary'
): ModaGptAgentRole {
  if (capability === 'product_search') return 'product-creative-manager';
  if (capability === 'sales_summary') return 'sales-customer-manager';
  if (capability === 'inventory_search' || capability === 'replenishment_analysis') {
    return 'supply-chain-finance-manager';
  }
  return 'business-manager';
}

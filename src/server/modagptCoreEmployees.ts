import type { ModaGptAgentRole } from './modagptRuntime';
import type { MerchantIndustry } from '../constants/merchantIndustries';

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
  const defaultPermissions = tools.includes('product_search')
    ? ['product.catalog.read']
    : tools.includes('inventory_search')
      ? ['inventory.stock.read', 'sales.summary.read']
      : tools.includes('sales_summary')
        ? ['sales.summary.read']
        : [];
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
}): ModaGptIndustryPack {
  return {
    id: input.id,
    businessTypes: input.businessTypes,
    workflows: input.workflows,
    employees: {
      'business-manager': employee('business-manager', input.id, input.names[0], input.skills[0], [], input.tags),
      'product-creative-manager': employee(
        'product-creative-manager',
        input.id,
        input.names[1],
        input.skills[1],
        ['product_search'],
        [...input.tags, 'product_catalog'],
        ['text', 'vision', 'image']
      ),
      'sales-customer-manager': employee(
        'sales-customer-manager',
        input.id,
        input.names[2],
        input.skills[2],
        ['sales_summary'],
        [...input.tags, 'customer_operations']
      ),
      'supply-chain-finance-manager': employee(
        'supply-chain-finance-manager',
        input.id,
        input.names[3],
        input.skills[3],
        ['inventory_search', 'replenishment_analysis'],
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
    workflows: ['inventory_low_replenishment']
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

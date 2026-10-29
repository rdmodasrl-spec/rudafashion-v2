export const modaGptCoreCapabilities = [
  'product_search',
  'inventory_search',
  'replenishment_analysis',
  'sales_summary'
] as const;

export type ModaGptCoreCapability = (typeof modaGptCoreCapabilities)[number];
export type ModaGptCoreAgent = 'product-manager' | 'inventory-manager' | 'sales-manager';

const capabilityAgents: Record<ModaGptCoreCapability, ModaGptCoreAgent> = {
  product_search: 'product-manager',
  inventory_search: 'inventory-manager',
  replenishment_analysis: 'inventory-manager',
  sales_summary: 'sales-manager'
};

const intentPatterns: Record<ModaGptCoreCapability, RegExp> = {
  product_search: /(?:\b(product|products|catalog|catalogue|style number|style no|sku|brand|category)\b|商品|产品|目录|款号|品牌|分类)/i,
  inventory_search: /(?:\b(inventory|stock|available|on hand|warehouse)\b|库存|存货|在库|仓库|可用数量)/i,
  replenishment_analysis: /(?:\b(replenish|replenishment|reorder|restock)\b|补货|补仓|采购建议)/i,
  sales_summary: /(?:\b(sales|revenue|orders|order status|sold|turnover)\b|销售|营业额|订单|销量|成交)/i
};

export type ModaGptSupervisorDecision = {
  agentRequired: boolean;
  agent: ModaGptCoreAgent | null;
  capabilities: ModaGptCoreCapability[];
  requiresClarification: boolean;
  reason: 'authorized_capability_match' | 'no_authorized_capability' | 'ambiguous_or_unsupported';
};

export function superviseModaGptRequest(
  request: string,
  availableCapabilities: readonly ModaGptCoreCapability[]
): ModaGptSupervisorDecision {
  if (typeof request !== 'string' || !request.trim() || request.length > 2_000) {
    throw new Error('MODAGPT_SUPERVISOR_REQUEST_INVALID');
  }
  if (
    !Array.isArray(availableCapabilities)
    || availableCapabilities.some(capability => !modaGptCoreCapabilities.includes(capability))
  ) throw new Error('MODAGPT_SUPERVISOR_CAPABILITY_INVALID');

  const available = [...new Set(availableCapabilities)];
  const requested = modaGptCoreCapabilities.filter(capability => intentPatterns[capability].test(request));
  const matched = requested.filter(capability => available.includes(capability));
  if (!matched.length) {
    const unsupportedIntent = requested.length > 0;
    return {
      agentRequired: false,
      agent: null,
      capabilities: [],
      requiresClarification: !unsupportedIntent,
      reason: unsupportedIntent ? 'no_authorized_capability' : 'ambiguous_or_unsupported'
    };
  }

  const agents = [...new Set(matched.map(capability => capabilityAgents[capability]))];
  return {
    agentRequired: true,
    agent: agents.length === 1 ? agents[0] : null,
    capabilities: matched,
    requiresClarification: false,
    reason: 'authorized_capability_match'
  };
}

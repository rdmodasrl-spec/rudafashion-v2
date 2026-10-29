import type { ModaGptAgentRole } from './modagptRuntime';

export const modaGptCoreWorkflowIds = [
  'low_inventory_review',
  'product_publish',
  'customer_quote_creation',
  'business_analysis',
  'fashion_creative_generation'
] as const;

export type ModaGptCoreWorkflowId = (typeof modaGptCoreWorkflowIds)[number];

export type ModaGptCoreTaskRoute = {
  workflow: ModaGptCoreWorkflowId;
  goal: string;
  agents: readonly ModaGptAgentRole[];
  tools: readonly string[];
  execution: 'ready' | 'workflow_unavailable' | 'agent_unavailable' | 'tools_unavailable';
  missingAgents: readonly ModaGptAgentRole[];
  missingTools: readonly string[];
};

const intentRules: ReadonlyArray<{
  workflow: ModaGptCoreWorkflowId;
  pattern: RegExp;
  goal: string;
  agents: readonly ModaGptAgentRole[];
  tools: readonly string[];
}> = [
  {
    workflow: 'product_publish',
    pattern: /(?:\b(?:publish|unpublish|update|edit|list|add|create)\s+(?:a\s+)?products?\b|上架.{0,20}商品|下架.{0,20}商品|发布.{0,20}商品|新增.{0,20}商品|创建.{0,20}商品|更新.{0,20}商品|修改.{0,20}商品)/i,
    goal: 'Prepare a merchant-owned product for human-reviewed publishing.',
    agents: ['product-creative-manager', 'business-manager'],
    tools: ['get_products', 'create_product_draft', 'update_product_draft', 'publish_product', 'unpublish_product']
  },
  {
    workflow: 'customer_quote_creation',
    pattern: /(?:\b(?:quote|quotation|customer analysis|analyze customer)\b|分析.{0,12}客户|客户分析|准备报价|创建报价|报价)/i,
    goal: 'Analyze a merchant-authorized customer and prepare a quote for review.',
    agents: ['sales-customer-manager', 'business-manager'],
    tools: [
      'get_customers',
      'get_products',
      'create_quote_draft',
      'get_quote',
      'update_quote',
      'submit_quote',
      'send_quote'
    ]
  },
  {
    workflow: 'fashion_creative_generation',
    pattern: /(?:\b(?:fashion collection|design a collection|fashion design|try[- ]?on|creative image)\b|服装.{0,20}系列|设计系列|服装设计|设计图|试穿)/i,
    goal: 'Prepare a fashion collection creative brief and reviewed visual draft.',
    agents: ['product-creative-manager', 'business-manager'],
    tools: ['generate_creative_draft', 'verify_creative_artifact']
  },
  {
    workflow: 'low_inventory_review',
    pattern: /(?:\b(?:inventory|stock|replenish|replenishment|reorder|restock)\b|库存|存货|补货|补仓|采购建议)/i,
    goal: 'Revalidate merchant inventory and provide a read-only replenishment recommendation.',
    agents: ['supply-chain-finance-manager', 'sales-customer-manager'],
    tools: ['get_inventory', 'get_sales']
  },
  {
    workflow: 'business_analysis',
    pattern: /(?:\b(?:business analysis|business performance|monthly performance|financial analysis|revenue analysis|analyze.{0,16}business|best[- ]selling products|top[- ]selling products|today.{0,12}sales)\b|经营.{0,12}分析|经营.{0,12}情况|经营状况|本月.{0,12}经营|财务分析|营业额分析|营业情况|今天.{0,12}营业|哪些.{0,12}商品.{0,12}(?:卖得最好|最畅销|销量最高)|(?:帮我)?分析.{0,16}(?:生意|经营|销售))/i,
    goal: 'Summarize the merchant business using authorized sales and supply-chain facts.',
    agents: ['business-manager', 'sales-customer-manager', 'supply-chain-finance-manager'],
    tools: [
      'order_summary',
      'sales_summary',
      'inventory_summary',
      'product_performance',
      'customer_performance',
      'finance_summary'
    ]
  }
];

export function superviseModaGptCoreTask(input: {
  request: string;
  assignedAgents: readonly string[];
  registeredWorkflows: readonly string[];
  registeredTools: readonly string[];
}): ModaGptCoreTaskRoute | null {
  if (typeof input.request !== 'string' || !input.request.trim() || input.request.length > 2_000) {
    throw new Error('MODAGPT_SUPERVISOR_REQUEST_INVALID');
  }
  if (input.assignedAgents.some(agent => ![
    'business-manager',
    'product-creative-manager',
    'sales-customer-manager',
    'supply-chain-finance-manager'
  ].includes(agent))) throw new Error('MODAGPT_SUPERVISOR_AGENT_INVALID');
  if (input.registeredWorkflows.some(workflow => !modaGptCoreWorkflowIds.includes(workflow as ModaGptCoreWorkflowId))) {
    throw new Error('MODAGPT_SUPERVISOR_WORKFLOW_INVALID');
  }
  if (input.registeredTools.some(tool => !/^[a-z][a-z0-9_]{1,79}$/.test(tool))) {
    throw new Error('MODAGPT_SUPERVISOR_TOOL_INVALID');
  }

  const match = intentRules.find(rule => rule.pattern.test(input.request));
  if (!match) return null;
  const assigned = new Set(input.assignedAgents);
  const registeredTools = new Set(input.registeredTools);
  const missingAgents = match.agents.filter(agent => !assigned.has(agent));
  const missingTools = match.tools.filter(tool => !registeredTools.has(tool));
  const workflowAvailable = input.registeredWorkflows.includes(match.workflow);
  return {
    workflow: match.workflow,
    goal: match.goal,
    agents: match.agents.filter(agent => assigned.has(agent)),
    tools: match.tools.filter(tool => registeredTools.has(tool)),
    execution: !workflowAvailable
      ? 'workflow_unavailable'
      : missingAgents.length
        ? 'agent_unavailable'
        : missingTools.length
          ? 'tools_unavailable'
          : 'ready',
    missingAgents,
    missingTools
  };
}

import assert from 'node:assert/strict';
import test from 'node:test';
import { superviseModaGptCoreTask } from '../src/server/modagptTaskSupervisor';

const allAgents = [
  'business-manager',
  'product-creative-manager',
  'sales-customer-manager',
  'supply-chain-finance-manager'
] as const;

test('supervisor maps five common merchant intents to the fixed four Core employees', () => {
  const cases = [
    {
      request: '帮我上架这个商品',
      workflow: 'product_publish',
      agents: ['product-creative-manager', 'business-manager']
    },
    {
      request: '看看哪些商品库存不足并给补货建议',
      workflow: 'low_inventory_review',
      agents: ['supply-chain-finance-manager', 'sales-customer-manager']
    },
    {
      request: '分析这个客户并准备报价',
      workflow: 'customer_quote_creation',
      agents: ['sales-customer-manager', 'business-manager']
    },
    {
      request: '分析我这个月的经营情况',
      workflow: 'business_analysis',
      agents: ['business-manager', 'sales-customer-manager', 'supply-chain-finance-manager']
    },
    {
      request: '帮我设计一个秋冬服装系列并生成设计图',
      workflow: 'fashion_creative_generation',
      agents: ['product-creative-manager', 'business-manager']
    }
  ] as const;

  for (const scenario of cases) {
    const route = superviseModaGptCoreTask({
      request: scenario.request,
      assignedAgents: allAgents,
      registeredWorkflows: [],
      registeredTools: []
    });
    assert.ok(route);
    assert.equal(route.workflow, scenario.workflow);
    assert.deepEqual(route.agents, scenario.agents);
    assert.equal(route.execution, 'workflow_unavailable');
  }
});

test('supervisor marks inventory execution ready only when the workflow, agents, and tools are registered', () => {
  const route = superviseModaGptCoreTask({
    request: 'Check inventory and recommend replenishment',
    assignedAgents: allAgents,
    registeredWorkflows: ['low_inventory_review'],
    registeredTools: ['get_inventory', 'get_sales']
  });
  assert.equal(route?.execution, 'ready');

  const missingSales = superviseModaGptCoreTask({
    request: 'Review low stock and restock',
    assignedAgents: allAgents,
    registeredWorkflows: ['low_inventory_review'],
    registeredTools: ['get_inventory']
  });
  assert.equal(missingSales?.execution, 'tools_unavailable');
  assert.deepEqual(missingSales?.missingTools, ['get_sales']);
});

test('supervisor routes top-selling products and today business status to read-only business analysis', () => {
  for (const request of ['哪些商品卖得最好', '今天营业情况怎么样']) {
    const route = superviseModaGptCoreTask({
      request,
      assignedAgents: allAgents,
      registeredWorkflows: ['business_analysis'],
      registeredTools: [
        'order_summary',
        'sales_summary',
        'inventory_summary',
        'product_performance',
        'customer_performance',
        'finance_summary'
      ]
    });
    assert.equal(route?.workflow, 'business_analysis');
    assert.equal(route?.execution, 'ready');
  }
});

test('supervisor does not route unsupported intents or grant unassigned agent capability', () => {
  assert.equal(superviseModaGptCoreTask({
    request: '帮我把生意做得更好',
    assignedAgents: allAgents,
    registeredWorkflows: [],
    registeredTools: []
  }), null);

  const missingAgent = superviseModaGptCoreTask({
    request: 'Create a quote for this customer',
    assignedAgents: ['product-creative-manager'],
    registeredWorkflows: ['customer_quote_creation'],
    registeredTools: ['get_customers', 'get_products', 'create_quote_draft']
  });
  assert.equal(missingAgent?.execution, 'agent_unavailable');
  assert.deepEqual(missingAgent?.missingAgents, ['sales-customer-manager', 'business-manager']);
  assert.throws(() => superviseModaGptCoreTask({
    request: 'query',
    assignedAgents: ['marketing-manager'],
    registeredWorkflows: [],
    registeredTools: []
  }), /MODAGPT_SUPERVISOR_AGENT_INVALID/);
});

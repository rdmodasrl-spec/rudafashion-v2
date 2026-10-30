import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { getModaGptIndustryTemplateAssistantProfile } from '../src/server/modagptCoreEmployees';
import {
  createModaGptIndustryTools,
  resolveModaGptIndustryTemplate
} from '../src/server/modagptIndustryTools';
import { createModaGptToolRuntime } from '../src/server/modagptRuntime';
import { superviseModaGptCoreTask } from '../src/server/modagptTaskSupervisor';

const coreTools = [
  'order_summary',
  'sales_summary',
  'inventory_summary',
  'product_performance',
  'customer_performance',
  'finance_summary'
];
const agents = [
  'business-manager',
  'product-creative-manager',
  'sales-customer-manager',
  'supply-chain-finance-manager'
];

function prismaFixture(overrides: Record<string, unknown> = {}) {
  const calls: Array<{ model: string; args: Record<string, any> }> = [];
  const prisma = {
    product: {
      findMany: async (args: Record<string, any>) => {
        calls.push({ model: 'product', args });
        return [];
      }
    },
    merchantStore: {
      findMany: async (args: Record<string, any>) => {
        calls.push({ model: 'merchantStore', args });
        return [];
      }
    },
    merchantStoreStock: {
      findMany: async (args: Record<string, any>) => {
        calls.push({ model: 'merchantStoreStock', args });
        return [];
      }
    },
    merchantPosSale: {
      findMany: async (args: Record<string, any>) => {
        calls.push({ model: 'merchantPosSale', args });
        return [];
      }
    },
    inventoryBalance: {
      findMany: async (args: Record<string, any>) => {
        calls.push({ model: 'inventoryBalance', args });
        return [];
      }
    },
    ...overrides
  } as unknown as PrismaClient;
  return { prisma, calls };
}

function product(input: {
  id: string;
  category?: string;
  packaging?: string;
  fabric?: string;
  attributes?: string | null;
  variants?: Array<{ sku: string; barcode: string | null; isActive: boolean }>;
}) {
  return {
    id: input.id,
    styleNo: input.id,
    name: input.id,
    category: input.category || '',
    packaging: input.packaging || '',
    fabric: input.fabric || '',
    industryAttributes: input.attributes === undefined ? '{}' : input.attributes,
    variants: input.variants || []
  };
}

test('four industry templates register only their own read-only assistant tool', () => {
  const expected = {
    department_wholesale: 'department_wholesale_catalog_analysis',
    bags_wholesale: 'bags_wholesale_catalog_analysis',
    department_chain_retail: 'department_chain_store_analysis',
    general_retail: 'general_retail_pos_analysis'
  } as const;
  for (const [industryTemplate, toolId] of Object.entries(expected)) {
    const tools = createModaGptIndustryTools({
      prisma: prismaFixture().prisma,
      industryTemplate
    });
    assert.deepEqual(tools.definitions.map(definition => definition.name), [toolId]);
    assert.deepEqual(Object.keys(tools.handlers), [toolId]);
    assert.equal(tools.definitions[0].permission, 'business.analytics.read');
    assert.equal(tools.definitions[0].riskLevel, 'LOW');
    assert.equal(tools.definitions[0].requiresApproval, false);
    assert.equal(tools.definitions[0].retryPolicy.idempotent, true);
  }
  assert.deepEqual(createModaGptIndustryTools({
    prisma: prismaFixture().prisma,
    industryTemplate: 'apparel_wholesale'
  }), { definitions: [], handlers: {} });
});

test('department wholesale catalog analysis reports real missing packaging fields and tenant-scopes reads', async () => {
  const fixture = prismaFixture({
    product: {
      findMany: async (args: Record<string, any>) => {
        fixture.calls.push({ model: 'product', args });
        return [
          product({
            id: 'department-complete',
            category: 'home_living',
            packaging: '12 per carton',
            attributes: JSON.stringify({ spec: '500ml', unit: 'bottle' }),
            variants: [{ sku: 'D-1', barcode: '123456', isActive: true }]
          }),
          product({ id: 'department-incomplete' })
        ];
      }
    }
  });
  const tools = createModaGptIndustryTools({ prisma: fixture.prisma, industryTemplate: 'department_wholesale' });
  const result = await tools.handlers.department_wholesale_catalog_analysis(
    'merchant-a',
    {},
    new AbortController().signal
  ) as Record<string, any>;

  assert.equal(result.productCount, 2);
  assert.equal(result.activeVariantCount, 1);
  assert.deepEqual(result.missingFields, {
    category: 1,
    specification: 1,
    unit: 1,
    packaging: 1,
    barcode: 1
  });
  assert.deepEqual(result.productsNeedingReview, [{
    styleNo: 'department-incomplete',
    name: 'department-incomplete',
    missingFields: ['分类', '规格', '计量单位', '包装', '条码']
  }]);
  assert.match(result.summary, /department-incomplete（缺分类、规格、计量单位、包装、条码）/);
  assert.match(result.summary, /不进行换算/);
  assert.deepEqual(fixture.calls[0].args.where, { merchantId: 'merchant-a' });
});

test('bags catalog analysis uses recorded attributes and reports malformed JSON instead of claiming image recognition', async () => {
  const fixture = prismaFixture({
    product: {
      findMany: async (args: Record<string, any>) => {
        fixture.calls.push({ model: 'product', args });
        return [
          product({
            id: 'bag-complete',
            category: 'bags',
            fabric: 'leather',
            attributes: JSON.stringify({ dimensions: '30x20x10cm', capacity: '5L' }),
            variants: [{ sku: 'B-1', barcode: '654321', isActive: true }]
          }),
          product({ id: 'bag-invalid-json', attributes: '{bad json' })
        ];
      }
    }
  });
  const tools = createModaGptIndustryTools({ prisma: fixture.prisma, industryTemplate: 'bags_wholesale' });
  const result = await tools.handlers.bags_wholesale_catalog_analysis(
    'merchant-a',
    {},
    new AbortController().signal
  ) as Record<string, any>;

  assert.equal(result.productCount, 2);
  assert.equal(result.invalidAttributeRows, 1);
  assert.deepEqual(result.missingFields, {
    category: 1,
    material: 1,
    dimensions: 1,
    sku: 1,
    barcode: 1
  });
  assert.equal(result.capacityRecorded, 1);
  assert.deepEqual(result.productsNeedingReview, [{
    styleNo: 'bag-invalid-json',
    name: 'bag-invalid-json',
    missingFields: ['品类', '材质', '尺寸', 'SKU', '条码', '行业属性 JSON']
  }]);
  assert.match(result.summary, /bag-invalid-json（缺品类、材质、尺寸、SKU、条码、行业属性 JSON）/);
  assert.match(result.summary, /不代表 AI 视觉识别材质/);
});

test('chain retail suggests transfers from tenant store sales and stock without writing transfer records', async () => {
  const fixture = prismaFixture({
    merchantStore: {
      findMany: async (args: Record<string, any>) => {
        fixture.calls.push({ model: 'merchantStore', args });
        return [{ id: 'store-a', name: 'A 店' }, { id: 'store-b', name: 'B 店' }];
      }
    },
    merchantStoreStock: {
      findMany: async (args: Record<string, any>) => {
        fixture.calls.push({ model: 'merchantStoreStock', args });
        return [
          { storeId: 'store-a', productId: 'product-1', sku: 'SKU-1', productName: '保温杯', quantity: 100 },
          { storeId: 'store-b', productId: 'product-1', sku: 'SKU-1', productName: '保温杯', quantity: 1 }
        ];
      }
    },
    merchantPosSale: {
      findMany: async (args: Record<string, any>) => {
        fixture.calls.push({ model: 'merchantPosSale', args });
        return [{
          storeId: 'store-b',
          totalAmount: 100,
          currency: 'EUR',
          items: [{ productId: 'product-1', sku: 'SKU-1', productName: '保温杯', quantity: 10 }]
        }];
      }
    }
  });
  const tools = createModaGptIndustryTools({ prisma: fixture.prisma, industryTemplate: 'department_chain_retail' });
  const result = await tools.handlers.department_chain_store_analysis(
    'merchant-a',
    { days: 30 },
    new AbortController().signal
  ) as Record<string, any>;

  assert.equal(result.storeCount, 2);
  assert.equal(result.salesCount, 1);
  assert.deepEqual(result.salesByCurrency, { EUR: 100 });
  assert.equal(result.transferSuggestions[0].suggestedQuantity, 3);
  assert.equal(result.transferSuggestions[0].fromStore, 'A 店');
  assert.equal(result.transferSuggestions[0].toStore, 'B 店');
  assert.match(result.summary, /均须人工核实/);
  assert.match(result.summary, /示例：保温杯 SKU-1：A 店 → B 店 3 件/);
  assert.equal(fixture.calls.length, 3);
  assert.ok(fixture.calls.every(call => call.args.where.merchantId === 'merchant-a'));
});

test('general retail analysis reports POS sales and barcode coverage without inventing margin', async () => {
  const fixture = prismaFixture({
    merchantPosSale: {
      findMany: async (args: Record<string, any>) => {
        fixture.calls.push({ model: 'merchantPosSale', args });
        return [{
          totalAmount: 45,
          currency: 'EUR',
          items: [
            { productId: 'product-1', productName: '商品 A', sku: 'A-1', quantity: 3, lineTotal: 30 },
            { productId: 'product-2', productName: '商品 B', sku: 'B-1', quantity: 1, lineTotal: 15 }
          ]
        }];
      }
    },
    inventoryBalance: {
      findMany: async (args: Record<string, any>) => {
        fixture.calls.push({ model: 'inventoryBalance', args });
        return [
          {
            onHandQuantity: 1,
            reservedQuantity: 1,
            inTransitQuantity: 0,
            variant: {
              productId: 'product-1',
              sku: 'A-1',
              product: { merchantId: 'merchant-a', name: '商品 A' }
            }
          },
          {
            onHandQuantity: 0,
            reservedQuantity: 0,
            inTransitQuantity: 1,
            variant: {
              productId: 'product-1',
              sku: 'A-1',
              product: { merchantId: 'merchant-a', name: '商品 A' }
            }
          },
          {
            onHandQuantity: 10,
            reservedQuantity: 0,
            inTransitQuantity: 0,
            variant: {
              productId: 'product-2',
              sku: 'B-1',
              product: { merchantId: 'merchant-a', name: '商品 B' }
            }
          },
          {
            onHandQuantity: 0,
            reservedQuantity: 0,
            inTransitQuantity: 0,
            variant: {
              productId: 'product-other-tenant',
              sku: 'C-1',
              product: { merchantId: 'merchant-b', name: '跨商家商品' }
            }
          }
        ];
      }
    },
    product: {
      findMany: async (args: Record<string, any>) => {
        fixture.calls.push({ model: 'product', args });
        return [
          product({ id: 'product-1', attributes: '{"barcode":"123"}' }),
          product({ id: 'product-2', variants: [{ sku: 'B-1', barcode: null, isActive: true }] })
        ];
      }
    }
  });
  const tools = createModaGptIndustryTools({ prisma: fixture.prisma, industryTemplate: 'general_retail' });
  const result = await tools.handlers.general_retail_pos_analysis(
    'merchant-a',
    { days: 30 },
    new AbortController().signal
  ) as Record<string, any>;

  assert.equal(result.salesCount, 1);
  assert.deepEqual(result.salesByCurrency, { EUR: 45 });
  assert.equal(result.unitsSold, 4);
  assert.equal(result.productsWithBarcode, 1);
  assert.equal(result.topProducts[0].productName, '商品 A');
  assert.equal(result.inventoryDataAvailable, true);
  assert.equal(result.inventorySkuCount, 2);
  assert.equal(result.salesSkuCount, 2);
  assert.equal(result.matchedSalesSkuCount, 2);
  assert.equal(result.replenishmentTargetDays, 14);
  assert.deepEqual(result.replenishmentCandidates, [{
    productId: 'product-1',
    sku: 'A-1',
    productName: '商品 A',
    unitsSold: 3,
    available: 1,
    targetStock: 2,
    suggestedQuantity: 1
  }]);
  assert.match(result.summary, /不计算净销售额或毛利/);
  assert.match(result.summary, /建议 1 件/);
  assert.ok(fixture.calls.every(call => call.args.where.merchantId === 'merchant-a'));
});

test('general retail never treats missing or truncated inventory and sales as zero-stock proof', async () => {
  const noInventory = prismaFixture({
    merchantPosSale: {
      findMany: async () => [{
        totalAmount: 10,
        currency: 'EUR',
        items: [{ productId: 'product-1', productName: '商品 A', sku: 'A-1', quantity: 3, lineTotal: 10 }]
      }]
    },
    product: {
      findMany: async () => [product({ id: 'product-1' })]
    },
    inventoryBalance: {
      findMany: async () => []
    }
  });
  const tools = createModaGptIndustryTools({ prisma: noInventory.prisma, industryTemplate: 'general_retail' });
  const noInventoryResult = await tools.handlers.general_retail_pos_analysis(
    'merchant-a',
    { days: 30 },
    new AbortController().signal
  ) as Record<string, any>;
  assert.equal(noInventoryResult.inventoryDataAvailable, false);
  assert.deepEqual(noInventoryResult.replenishmentCandidates, []);
  assert.match(noInventoryResult.summary, /未把缺失库存当作零库存/);

  const truncated = prismaFixture({
    merchantPosSale: {
      findMany: async () => [{
        totalAmount: 100,
        currency: 'EUR',
        items: Array.from({ length: 100 }, (_, index) => ({
          productId: 'product-1',
          productName: '商品 A',
          sku: `A-${index}`,
          quantity: 1,
          lineTotal: 1
        }))
      }]
    },
    product: {
      findMany: async () => [product({ id: 'product-1' })]
    },
    inventoryBalance: {
      findMany: async () => [{
        onHandQuantity: 0,
        reservedQuantity: 0,
        inTransitQuantity: 0,
        variant: {
          productId: 'product-1',
          sku: 'A-0',
          product: { merchantId: 'merchant-a', name: '商品 A' }
        }
      }]
    }
  });
  const truncatedTools = createModaGptIndustryTools({
    prisma: truncated.prisma,
    industryTemplate: 'general_retail'
  });
  const truncatedResult = await truncatedTools.handlers.general_retail_pos_analysis(
    'merchant-a',
    { days: 30 },
    new AbortController().signal
  ) as Record<string, any>;
  assert.equal(truncatedResult.truncated, true);
  assert.deepEqual(truncatedResult.replenishmentCandidates, []);
  assert.match(truncatedResult.summary, /未生成补货数量/);
});

test('supervisor distinguishes department wholesale and department chain with the same coarse industry', () => {
  const cases = [
    {
      industryTemplate: 'department_wholesale',
      message: '分析百货商品包装规格和单位',
      toolId: 'department_wholesale_catalog_analysis'
    },
    {
      industryTemplate: 'department_chain_retail',
      message: '分析门店销售和库存，给出调拨建议',
      toolId: 'department_chain_store_analysis'
    },
    {
      industryTemplate: 'bags_wholesale',
      message: '分析手袋材质尺寸资料',
      toolId: 'bags_wholesale_catalog_analysis'
    },
    {
      industryTemplate: 'general_retail',
      message: '分析 POS 销售和条码资料',
      toolId: 'general_retail_pos_analysis'
    }
  ] as const;
  for (const scenario of cases) {
    const tools = createModaGptIndustryTools({
      prisma: prismaFixture().prisma,
      industryTemplate: scenario.industryTemplate
    });
    const route = superviseModaGptCoreTask({
      request: scenario.message,
      assignedAgents: agents,
      registeredWorkflows: ['business_analysis'],
      registeredTools: [...coreTools, ...tools.definitions.map(definition => definition.name)],
      industryTemplate: scenario.industryTemplate
    });
    assert.equal(route?.workflow, 'business_analysis');
    assert.equal(route?.execution, 'ready');
    assert.equal(route?.industryTemplate, scenario.industryTemplate);
    assert.ok(route?.tools.includes(scenario.toolId));
    assert.equal(route?.tools.filter(toolId => toolId.includes('department_') || toolId.includes('bags_') || toolId.includes('general_retail_')).length, 1);
  }
});

test('industry template resolver rejects stale or mismatched coarse industry mappings', () => {
  assert.equal(resolveModaGptIndustryTemplate({
    industry: 'department_store',
    industryTemplate: 'department_chain_retail'
  }), 'department_chain_retail');
  assert.equal(resolveModaGptIndustryTemplate({
    industry: 'DEPARTMENT_STORE',
    industryTemplate: null
  }), null);
  assert.throws(() => resolveModaGptIndustryTemplate({
    industry: 'RETAIL_STORE',
    industryTemplate: 'department_chain_retail'
  }), /MODAGPT_INDUSTRY_TEMPLATE_MISMATCH/);
  assert.throws(() => resolveModaGptIndustryTemplate({
    industry: 'RETAIL_STORE',
    industryTemplate: 'not-a-template'
  }), /MODAGPT_INDUSTRY_TEMPLATE_INVALID/);
});

test('runtime denies a specialist tool call across merchant tenants before its handler runs', async () => {
  const fixture = prismaFixture();
  const tools = createModaGptIndustryTools({
    prisma: fixture.prisma,
    industryTemplate: 'department_wholesale'
  });
  let handlerCalled = false;
  const runtime = createModaGptToolRuntime({
    principal: {
      tenantId: 'merchant-a',
      actorId: 'employee-a',
      active: true,
      permissions: ['business.analytics.read'],
      agentPermissions: { 'business-manager': ['business.analytics.read'] }
    },
    definitions: tools.definitions,
    handlers: {
      ...tools.handlers,
      department_wholesale_catalog_analysis: async () => {
        handlerCalled = true;
        return {};
      }
    },
    recordAudit: async () => undefined
  });
  await assert.rejects(runtime.execute({
    taskId: 'tenant-isolation-task',
    tenantId: 'merchant-b',
    agentId: 'business-manager',
    toolId: 'department_wholesale_catalog_analysis',
    input: {}
  }), /MODAGPT_POLICY_TENANT_DENIED/);
  assert.equal(handlerCalled, false);
});

test('template assistant profiles are limited to the four intended commerce industries', () => {
  assert.equal(getModaGptIndustryTemplateAssistantProfile('apparel_wholesale'), null);
  assert.equal(getModaGptIndustryTemplateAssistantProfile('trading_wholesale'), null);
  assert.equal(getModaGptIndustryTemplateAssistantProfile('department_chain_retail')?.agentId, 'business-manager');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { createModaGptMerchantTools } from '../src/server/modagptMerchantTools';
import { createModaGptToolRuntime } from '../src/server/modagptRuntime';
import { superviseModaGptCoreTask } from '../src/server/modagptTaskSupervisor';

function createPrismaFixture() {
  const suppliers: Array<Record<string, any>> = [
    { id: 'supp-1', name: 'Supplier One', merchantId: 'merchant-a', status: 'active', contactName: 'Alice', email: 'alice@supp1.test', leadTimeDays: 7 },
    { id: 'supp-2', name: 'Supplier Two', merchantId: 'merchant-a', status: 'inactive', contactName: 'Bob', email: 'bob@supp2.test', leadTimeDays: 14 },
    { id: 'supp-3', name: 'Other Merchant Supplier', merchantId: 'merchant-b', status: 'active', contactName: 'Charlie', email: 'charlie@supp3.test', leadTimeDays: 5 }
  ];
  const products: Array<Record<string, any>> = [
    {
      id: 'prod-1',
      merchantId: 'merchant-a',
      name: 'Trade Shirt',
      styleNo: 'TS-001',
      brand: 'RUDA TRADING',
      variants: [{ id: 'var-1', sku: 'TS-001-B-M', color: 'Blue', size: 'M' }]
    }
  ];
  const pos: Array<Record<string, any>> = [];
  const poItems: Array<Record<string, any>> = [];
  const receipts: Array<Record<string, any>> = [];

  const prisma: Record<string, any> = {
    supplier: {
      findMany: async ({ where }: any) => suppliers.filter(s =>
        s.merchantId === where.merchantId &&
        (!where.status || s.status === where.status) &&
        (!where.OR || where.OR.some((c: any) =>
          s.name?.includes(c.name?.contains || '\u0000') ||
          s.contactName?.includes(c.contactName?.contains || '\u0000')
        ))
      ),
      findFirst: async ({ where }: any) => suppliers.find(s => s.id === where.id && s.merchantId === where.merchantId && s.status === where.status) || null,
      findUnique: async ({ where }: any) => suppliers.find(s => s.id === where.id) || null
    },
    product: {
      findMany: async ({ where }: any) => products.filter(p => p.merchantId === where.merchantId && where.id.in.includes(p.id)),
      findFirst: async ({ where }: any) => products.find(p => p.id === where.id && p.merchantId === where.merchantId) || null
    },
    merchantPurchaseOrder: {
      findFirst: async ({ where }: any) => pos.find(p => p.id === where.id && p.merchantId === where.merchantId) || null,
      findUnique: async ({ where }: any) => pos.find(p => p.idempotencyKey === where.idempotencyKey) || null,
      findMany: async ({ where }: any) => pos.filter(p =>
        p.supplierId === where.supplierId
        && p.merchantId === where.merchantId
        && (!where.status?.in || where.status.in.includes(p.status))
      ),
      create: async ({ data }: any) => {
        const { items, ...poData } = data;
        const newPo = {
          ...poData,
          id: poData.id || `po-${pos.length + 1}`,
          status: 'draft',
          createdAt: new Date(),
          items: items?.create ? items.create.map((i: any) => ({ ...i, orderedQuantity: i.orderedQuantity || i.quantity })) : []
        };
        pos.push(newPo);
        poItems.push(...newPo.items);
        return newPo;
      }
    },
    $transaction: async (fn: any) => {
      return fn(prisma);
    }
  };

  return { prisma, suppliers, products, pos, poItems, receipts };
}

test('Trading Wholesale: get_supplier_performance calculates metrics correctly', async (t) => {
  const fixture = createPrismaFixture();
  const tools = createModaGptMerchantTools({
    prisma: fixture.prisma as any,
    taskId: 'perf-task',
    actorId: 'user-1',
    employeeId: null
  });

  const signal = new AbortController().signal;

  // Mock historical data for performance calculation
  const baseOrder = {
    id: 'po-partial',
    merchantId: 'merchant-a',
    supplierId: 'supp-1',
    status: 'partially_received',
    orderedAt: new Date('2026-10-01'),
    items: [{ orderedQuantity: 100, receivedQuantity: 95 }],
    receipts: [{ receivedAt: new Date('2026-10-07') }]
  };
  fixture.pos.push(baseOrder);
  fixture.pos.push({
    id: 'po-received',
    merchantId: 'merchant-a',
    supplierId: 'supp-1',
    status: 'received',
    orderedAt: new Date('2026-10-01'),
    items: [{ orderedQuantity: 100, receivedQuantity: 100 }],
    receipts: [{ receivedAt: new Date('2026-10-08') }]
  });

  const result = await tools.handlers.get_supplier_performance('merchant-a', { supplierId: 'supp-1' }, signal);
  const metrics = (result as any).metrics;
  assert.equal(metrics.totalOrders, 2);
  assert.equal(metrics.fulfillmentRate, 0.975);
  assert.equal(metrics.averageLeadTimeDays, 7);
  assert.equal(metrics.ordersWithLeadTime, 1);
  await assert.rejects(
    tools.handlers.get_supplier_performance('merchant-a', { supplierId: 'supp-3' }, signal),
    /MODAGPT_SUPPLIER_NOT_FOUND/
  );
});

test('Trading Wholesale: get_suppliers handles merchant isolation and search', async () => {
  const fixture = createPrismaFixture();
  const tools = createModaGptMerchantTools({
    prisma: fixture.prisma as any,
    taskId: 'test-task',
    actorId: 'user-1',
    employeeId: null
  });

  const signal = new AbortController().signal;

  // Test merchant A
  const resultA = await tools.handlers.get_suppliers('merchant-a', { query: 'Supplier' }, signal);
  assert.equal((resultA as any).suppliers.length, 1); // Only active 'Supplier One'
  assert.equal((resultA as any).suppliers[0].id, 'supp-1');

  // Test merchant B
  const resultB = await tools.handlers.get_suppliers('merchant-b', {}, signal);
  assert.equal((resultB as any).suppliers.length, 1);
  assert.equal((resultB as any).suppliers[0].id, 'supp-3');
});

test('Trading Wholesale: create_procurement_draft validates inputs and merchant scope', async () => {
  const fixture = createPrismaFixture();
  const tools = createModaGptMerchantTools({
    prisma: fixture.prisma as any,
    taskId: 'po-task-1',
    actorId: 'user-1',
    employeeId: null
  });

  const validPo = {
    supplierId: 'supp-1',
    items: [{ productId: 'prod-1', variantId: 'var-1', quantity: 10, unitCost: 15.5 }],
    currency: 'USD'
  };

  const signal = new AbortController().signal;

  // Valid creation
  const result = await tools.handlers.create_procurement_draft('merchant-a', validPo, signal);
  assert.equal((result as any).status, 'draft');
  assert.equal((result as any).totalAmount, 155);
  assert.equal(fixture.pos.length, 1);
  assert.equal(fixture.poItems.length, 1);
  assert.equal(fixture.pos[0].merchantId, 'merchant-a');
  const retry = await tools.handlers.create_procurement_draft('merchant-a', validPo, signal);
  assert.equal((retry as any).purchaseOrderId, (result as any).purchaseOrderId);
  assert.equal(fixture.pos.length, 1);
  await assert.rejects(
    tools.handlers.create_procurement_draft('merchant-a', {
      ...validPo,
      items: [{ ...validPo.items[0], unitCost: 16 }]
    }, signal),
    /MODAGPT_PROCUREMENT_IDEMPOTENCY_CONFLICT/
  );
  assert.equal(fixture.pos.length, 1);
  await assert.rejects(
    tools.handlers.create_procurement_draft('merchant-a', {
      ...validPo,
      items: [{ ...validPo.items[0], quantity: 0 }]
    }, signal),
    /MODAGPT_PROCUREMENT_DRAFT_INPUT_INVALID/
  );
  await assert.rejects(
    tools.handlers.create_procurement_draft('merchant-a', {
      ...validPo,
      supplierId: 'supp-2'
    }, signal),
    /MODAGPT_SUPPLIER_UNAVAILABLE/
  );

  // Isolation test: Merchant B cannot use Merchant A's supplier
  await assert.rejects(
    tools.handlers.create_procurement_draft('merchant-b', validPo, signal),
    /MODAGPT_SUPPLIER_UNAVAILABLE/
  );
});

test('Trading Wholesale: procurement totals round exact decimal values half up', async () => {
  const fixture = createPrismaFixture();
  const tools = createModaGptMerchantTools({
    prisma: fixture.prisma as any,
    taskId: 'po-rounding-task',
    actorId: 'user-1',
    employeeId: null
  });

  const result = await tools.handlers.create_procurement_draft('merchant-a', {
    supplierId: 'supp-1',
    items: [{ productId: 'prod-1', variantId: 'var-1', quantity: 1, unitCost: 1.005 }],
    currency: 'EUR'
  }, new AbortController().signal);

  assert.equal((result as any).totalAmount, 1.01);
  assert.equal(fixture.poItems[0].unitCost, 1.005);
});

test('Trading Wholesale: currency_convert provides dated reference rates', async () => {
  const fixture = createPrismaFixture();
  const tools = createModaGptMerchantTools({
    prisma: fixture.prisma as any,
    taskId: 'conv-task',
    actorId: 'user-1',
    employeeId: null,
    fetchExchangeRates: async () => ({
      base: 'EUR',
      rates: { EUR: 1, USD: 1.08, CNY: 7.8, GBP: 0.86, JPY: 160, CHF: 0.97 },
      rateDate: '2026-10-08',
      updatedAt: '2026-10-08T00:00:00.000Z',
      source: 'Frankfurter'
    })
  });

  const signal = new AbortController().signal;

  const result = await tools.handlers.currency_convert('merchant-a', { amount: 100, from: 'EUR', to: 'USD' }, signal);
  assert.equal((result as any).amount, 108);
  assert.equal((result as any).rate, 1.08);
  assert.equal((result as any).from, 'EUR');
  assert.equal((result as any).rateSource, 'Frankfurter');
  assert.equal((result as any).rateDate, '2026-10-08');
  assert.equal((result as any).rateType, 'daily_reference');

  const reverse = await tools.handlers.currency_convert('merchant-a', { amount: 108, from: 'USD', to: 'EUR' }, signal);
  assert.equal((reverse as any).amount, 100);

  await assert.rejects(
    tools.handlers.currency_convert('merchant-a', { amount: 100, from: 'CAD', to: 'USD' }, signal),
    /MODAGPT_CURRENCY_NOT_SUPPORTED/
  );
});

test('Trading Wholesale: supplier performance rejects inconsistent completed orders', async () => {
  const fixture = createPrismaFixture();
  const tools = createModaGptMerchantTools({
    prisma: fixture.prisma as any,
    taskId: 'perf-task',
    actorId: 'user-1',
    employeeId: null
  });

  const signal = new AbortController().signal;

  fixture.pos.push({
    id: 'po-invalid',
    merchantId: 'merchant-a',
    supplierId: 'supp-1',
    status: 'received',
    orderedAt: new Date('2026-10-01T10:00:00Z'),
    items: [{ orderedQuantity: 100, receivedQuantity: 95 }],
    receipts: [{ receivedAt: new Date('2026-10-08T10:00:00Z') }]
  });

  await assert.rejects(
    tools.handlers.get_supplier_performance('merchant-a', { supplierId: 'supp-1' }, signal),
    /MODAGPT_SUPPLIER_PERFORMANCE_DATA_INVALID/
  );
});

test('Trading Wholesale: an unauthorized Core employee cannot call procurement tools', async () => {
  const fixture = createPrismaFixture();
  const tools = createModaGptMerchantTools({
    prisma: fixture.prisma as any,
    taskId: 'permission-task',
    actorId: 'user-1',
    employeeId: 'employee-1'
  });
  const runtime = createModaGptToolRuntime({
    principal: {
      tenantId: 'merchant-a',
      actorId: 'user-1',
      active: true,
      permissions: ['purchase.manage'],
      agentPermissions: { 'product-creative-manager': ['product.catalog.read'] },
      approvedActions: []
    },
    definitions: tools.definitions,
    handlers: tools.handlers,
    recordAudit: async () => {}
  });

  await assert.rejects(
    runtime.execute({
      taskId: 'permission-task',
      tenantId: 'merchant-a',
      agentId: 'product-creative-manager',
      toolId: 'get_suppliers',
      input: {}
    }),
    /MODAGPT_POLICY_PERMISSION_DENIED/
  );
});

test('Trading Wholesale: Supervisor routes procurement intent correctly', async () => {
  const route = superviseModaGptCoreTask({
    request: '我想分析一下供应商 Supplier One 的绩效并创建一个补货订单',
    assignedAgents: ['supply-chain-finance-manager', 'business-manager'],
    registeredWorkflows: ['procurement_management'],
    registeredTools: ['get_suppliers', 'get_supplier_performance', 'create_procurement_draft']
  });

  assert.ok(route);
  assert.equal(route.workflow, 'procurement_management');
  assert.ok(route.tools.includes('get_supplier_performance'));
  assert.ok(route.tools.includes('create_procurement_draft'));
});

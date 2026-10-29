import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { executeModaGptMerchantTask } from '../src/server/modagptMerchantTaskExecutor';
import {
  createModaGptMerchantTools,
  parseProductFactsFromRequest,
  parseQuoteFactsFromRequest,
  quoteSnapshotFingerprint
} from '../src/server/modagptMerchantTools';
import { superviseModaGptCoreTask } from '../src/server/modagptTaskSupervisor';

const agents = [
  'business-manager',
  'product-creative-manager',
  'sales-customer-manager',
  'supply-chain-finance-manager'
];

function createPrismaFixture() {
  const products: Array<Record<string, any>> = [];
  const quotes: Array<Record<string, any>> = [];
  const audit: Array<Record<string, any>> = [];
  const approvals: Array<Record<string, any>> = [];
  const orders: Array<Record<string, any>> = [];
  const orderItems: Array<Record<string, any>> = [];
  const balances: Array<Record<string, any>> = [];
  const invoices: Array<Record<string, any>> = [];
  const customers = new Set(['customer-1']);
  let customerEmail = 'buyer@example.test';
  let customerStatus = 'approved';
  const matchesWhere = (record: Record<string, any>, where: Record<string, any>) =>
    Object.entries(where).every(([key, value]) => {
      if (key === 'OR') return value.some((condition: Record<string, any>) => matchesWhere(record, condition));
      if (key === 'AND') return value.every((condition: Record<string, any>) => matchesWhere(record, condition));
      if (value && typeof value === 'object' && 'in' in value) return value.in.includes(record[key]);
      if (value && typeof value === 'object' && 'notIn' in value) return !value.notIn.includes(record[key]);
      if (value && typeof value === 'object' && 'not' in value) return record[key] !== value.not;
      if (value && typeof value === 'object' && 'gt' in value) return record[key] > value.gt;
      if (value && typeof value === 'object' && 'gte' in value) return record[key] >= value.gte;
      if (value && typeof value === 'object' && 'contains' in value) {
        return String(record[key] || '').toLowerCase().includes(String(value.contains).toLowerCase());
      }
      if (value === null) return record[key] === null || record[key] === undefined;
      return record[key] === value;
    });
  const prisma: Record<string, any> = {
    merchant: {
      findUnique: async ({ where }: any) => where.id === 'merchant-a' ? { id: 'merchant-a', name: 'Atelier A' } : null
    },
    merchantEmployee: {
      findFirst: async () => null
    },
    merchantStoreCategory: {
      findFirst: async ({ where }: any) => where.merchantId === 'merchant-a' && where.slug === 'women'
        ? { slug: 'women' }
        : null
    },
    modaGptApproval: {
      findFirst: async ({ where }: any) => approvals.find(approval =>
        matchesWhere(approval, where)
      ) || null,
      create: async ({ data }: any) => {
        const approval = { id: `approval-${approvals.length + 1}`, status: 'pending', ...data };
        approvals.push(approval);
        return approval;
      },
      updateMany: async ({ where, data }: any) => {
        const found = approvals.find(approval => matchesWhere(approval, where));
        if (!found) return { count: 0 };
        Object.assign(found, data);
        return { count: 1 };
      }
    },
    employeeAuditLog: {
      create: async ({ data }: any) => { audit.push(data); return data; }
    },
    product: {
      findFirst: async ({ where }: any) => products.find(product =>
        product.merchantId === where.merchantId
        && (typeof where.id === 'string'
          ? product.id === where.id
          : where.id?.not
            ? product.id !== where.id.not
            : product.id === where.id || product.styleNo === where.styleNo)
        && (!where.styleNo || product.styleNo === where.styleNo)
        && (!where.lifecycleStatus || product.lifecycleStatus === where.lifecycleStatus)
      ) || null,
      findMany: async ({ where }: any) => products.filter(product =>
        product.merchantId === where.merchantId
        && (!where.OR || where.OR.some((condition: any) =>
          product.name.includes(condition.name?.contains || '\u0000')
          || product.styleNo.includes(condition.styleNo?.contains || '\u0000')
        ))
        && (!where.lifecycleStatus || product.lifecycleStatus === where.lifecycleStatus)
      ).map(({ id, styleNo, name, category, wholesalePrice, lifecycleStatus, moq, packSize, skus }) => ({
        id, styleNo, name, category, wholesalePrice, lifecycleStatus, moq, packSize, skus
      })),
      updateMany: async ({ where, data }: any) => {
        const product = products.find(candidate => candidate.id === where.id
          && candidate.merchantId === where.merchantId
          && (!where.lifecycleStatus || candidate.lifecycleStatus === where.lifecycleStatus));
        if (!product) return { count: 0 };
        Object.assign(product, data);
        return { count: 1 };
      },
      create: async ({ data }: any) => {
        const created = { ...data, lifecycleStatus: data.lifecycleStatus || 'published' };
        products.push(created);
        return Object.fromEntries(Object.keys(data).map(key => [key, created[key]]));
      }
    },
    customer: {
      findFirst: async ({ where }: any) => where.id === 'customer-1' && customers.has(where.id)
        ? { id: 'customer-1', discountRate: 0.9, status: customerStatus, email: customerEmail, companyName: 'Buyer GmbH' }
        : null,
      findMany: async () => [{ id: 'customer-1', companyName: 'Buyer GmbH', contactPerson: 'Buyer', country: 'DE' }]
    },
    salesQuote: {
      findFirst: async ({ where }: any) => {
        const quote = quotes.find(candidate => matchesWhere(candidate, where));
        return quote ? {
          ...quote,
          customer: { id: 'customer-1', email: customerEmail, status: customerStatus, companyName: 'Buyer GmbH' }
        } : null;
      },
      updateMany: async ({ where, data }: any) => {
        const quote = quotes.find(candidate => matchesWhere(candidate, where));
        if (!quote) return { count: 0 };
        Object.assign(quote, data, { updatedAt: new Date() });
        return { count: 1 };
      }
    },
    order: {
      findMany: async ({ where }: any) => orders.filter(order => matchesWhere(order, where))
    },
    orderItem: {
      findMany: async ({ where }: any) => orderItems.filter(item =>
        item.merchantId === where.merchantId
        && item.order?.merchantId === where.order.merchantId
        && item.order?.createdAt >= where.order.createdAt.gte
        && !where.order.status.notIn.includes(item.order.status)
      )
    },
    inventoryBalance: {
      findMany: async ({ where }: any) => balances.filter(balance => balance.merchantId === where.merchantId)
    },
    orderInvoice: {
      findMany: async ({ where }: any) => invoices.filter(invoice => matchesWhere(invoice, where))
    }
  };
  const tx = {
    customer: prisma.customer,
    product: {
      findMany: async ({ where }: any) => products.filter(product =>
        product.merchantId === where.merchantId
        && where.id.in.includes(product.id)
        && product.lifecycleStatus === where.lifecycleStatus
      ),
      findFirst: async ({ where }: any) => products.find(product =>
        product.id === where.id
        && product.merchantId === where.merchantId
        && (!where.lifecycleStatus || product.lifecycleStatus === where.lifecycleStatus)
      ) || null,
      updateMany: async ({ where, data }: any) => {
        const product = products.find(candidate => candidate.id === where.id
          && candidate.merchantId === where.merchantId
          && candidate.lifecycleStatus === where.lifecycleStatus);
        if (!product) return { count: 0 };
        Object.assign(product, data);
        return { count: 1 };
      }
    },
    merchantStoreCategory: prisma.merchantStoreCategory,
    modaGptApproval: prisma.modaGptApproval,
    employeeAuditLog: prisma.employeeAuditLog,
    salesQuote: {
      findFirst: async ({ where }: any) => quotes.find(quote => matchesWhere(quote, where)) || null,
      create: async ({ data }: any) => {
        const quote = {
          ...data,
          items: data.items.create,
          totalAmount: data.totalAmount
        };
        quotes.push(quote);
        return {
          id: quote.id,
          quoteNo: quote.quoteNo,
          status: quote.status,
          totalQty: quote.totalQty,
          totalAmount: quote.totalAmount,
          currency: quote.currency
        };
      },
      updateMany: async ({ where, data }: any) => {
        const quote = quotes.find(candidate => matchesWhere(candidate, where));
        if (!quote) return { count: 0 };
        Object.assign(quote, data, { updatedAt: new Date() });
        return { count: 1 };
      },
      update: async ({ where, data }: any) => {
        const quote = quotes.find(candidate => candidate.id === where.id);
        if (!quote) throw new Error('QUOTE_NOT_FOUND');
        Object.assign(quote, data);
        if (data.items?.deleteMany) quote.items = [];
        if (data.items?.create) quote.items.push(...data.items.create);
        return quote;
      }
    },
    salesQuoteItem: {
      deleteMany: async ({ where }: any) => {
        const quote = quotes.find(candidate => candidate.id === where.quoteId);
        if (!quote) return { count: 0 };
        const count = quote.items.length;
        quote.items = [];
        return { count };
      },
      createMany: async ({ data }: any) => {
        const quoteId = data[0]?.quoteId;
        const quote = quotes.find(candidate => candidate.id === quoteId);
        if (!quote) throw new Error('QUOTE_NOT_FOUND');
        quote.items.push(...data.map(({ quoteId: _quoteId, ...item }: any) => item));
        return { count: data.length };
      }
    }
  };
  prisma.$transaction = async (operation: (transaction: unknown) => unknown) => operation(tx);
  return {
    prisma: prisma as unknown as PrismaClient,
    products,
    quotes,
    audit,
    approvals,
    transaction: tx,
    setCustomerEmail: (email: string) => { customerEmail = email; },
    orders,
    orderItems,
    balances,
    invoices
  };
}

function makeRoute(message: string, toolNames: string[]) {
  const route = superviseModaGptCoreTask({
    request: message,
    assignedAgents: agents,
    registeredWorkflows: ['product_publish', 'customer_quote_creation'],
    registeredTools: toolNames
  });
  assert.ok(route);
  assert.equal(route.execution, 'ready');
  return route;
}

test('Quote approval fingerprint binds validity, commercial terms, lead time, and line items', () => {
  const quote = {
    id: 'quote-fingerprint',
    merchantId: 'merchant-a',
    customerId: 'customer-1',
    status: 'draft',
    totalQty: 2,
    totalAmount: 80,
    notes: null,
    validUntil: new Date('2026-12-31T00:00:00.000Z'),
    paymentTerms: 'Net 30',
    deliveryTerms: 'FOB',
    leadTimeDays: 14,
    items: [{ productId: 'product-a', sku: 'A-S', quantity: 2, unitPrice: 40 }]
  };
  const fingerprint = quoteSnapshotFingerprint(quote);
  assert.notEqual(quoteSnapshotFingerprint({ ...quote, validUntil: new Date('2027-01-31T00:00:00.000Z') }), fingerprint);
  assert.notEqual(quoteSnapshotFingerprint({ ...quote, paymentTerms: 'Prepaid' }), fingerprint);
  assert.notEqual(quoteSnapshotFingerprint({ ...quote, leadTimeDays: 21 }), fingerprint);
  assert.notEqual(quoteSnapshotFingerprint({
    ...quote,
    items: [{ ...quote.items[0], unitPrice: 41 }]
  }), fingerprint);
});

test('ModaGPT Supervisor and Runtime create a verified private RUDA product draft with tenant scope and audit', async () => {
  const fixture = createPrismaFixture();
  const message = '帮我上架这个商品';
  const inputs = {
    product: {
      styleNo: 'AT-100',
      name: 'Linen Blazer',
      category: 'women',
      subCategory: 'blazer',
      season: '2026 SS',
      wholesalePrice: 42,
      rrpPrice: 119,
      moq: 6,
      packSize: 3,
      description: 'Linen tailored blazer',
      skus: [{ sku: 'AT-100-BLK-S', color: 'Black', size: 'S' }]
    }
  };
  const tools = createModaGptMerchantTools({
    prisma: fixture.prisma,
    taskId: 'task-product-1',
    actorId: 'merchant-user',
    employeeId: null
  });
  const route = makeRoute(message, tools.definitions.map(tool => tool.name));
  const result = await executeModaGptMerchantTask({
    prisma: fixture.prisma,
    merchantId: 'merchant-a',
    taskId: 'task-product-1',
    traceId: 'trace-product-1',
    actorId: 'merchant-user',
    employeeId: null,
    message,
    inputs,
    route
  });

  assert.equal(result.status, 'draft_created');
  assert.equal(result.employee, 'product-creative-manager');
  assert.deepEqual(result.toolCalls.map(call => call.toolId), ['create_product_draft', 'get_products']);
  assert.equal(result.artifacts.length, 1);
  assert.equal(result.approvalRequired, false);
  assert.equal(result.creditsUsed, 0);
  assert.equal(fixture.products.length, 1);
  assert.equal(fixture.products[0].merchantId, 'merchant-a');
  assert.equal(fixture.products[0].visibility, 'private');
  assert.equal(fixture.products[0].lifecycleStatus, 'draft');
  assert.deepEqual(fixture.audit.map(event => event.action), [
    'MODAGPT_TOOL_STARTED',
    'MODAGPT_TOOL_SUCCEEDED',
    'MODAGPT_TOOL_STARTED',
    'MODAGPT_TOOL_SUCCEEDED'
  ]);
  const retry = await tools.handlers.create_product_draft('merchant-a', inputs.product, new AbortController().signal);
  assert.equal((retry as { productId: string }).productId, fixture.products[0].id);
  assert.equal(fixture.products.length, 1);
  await assert.rejects(
    tools.handlers.create_product_draft('merchant-a', { ...inputs.product, description: 'Changed after first execution' }, new AbortController().signal),
    /MODAGPT_TOOL_IDEMPOTENCY_CONFLICT/
  );
});

test('ModaGPT Supervisor and Runtime create and verify a tenant-scoped RUDA quote draft from persisted pricing facts', async () => {
  const fixture = createPrismaFixture();
  fixture.products.push({
    id: 'product-a',
    merchantId: 'merchant-a',
    styleNo: 'AT-100',
    name: 'Linen Blazer',
    wholesalePrice: 42,
    moq: 6,
    packSize: 3,
    skus: JSON.stringify([{ sku: 'AT-100-BLK-S', color: 'Black', size: 'S' }]),
    lifecycleStatus: 'published'
  });
  const message = '给客户创建一个报价';
  const inputs = {
    quote: {
      customerId: 'customer-1',
      items: [{ productId: 'product-a', sku: 'AT-100-BLK-S', quantity: 6 }],
      currency: 'EUR',
      notes: 'Draft only'
    }
  };
  const tools = createModaGptMerchantTools({
    prisma: fixture.prisma,
    taskId: 'task-quote-1',
    actorId: 'merchant-user',
    employeeId: null
  });
  const route = makeRoute(message, tools.definitions.map(tool => tool.name));
  const result = await executeModaGptMerchantTask({
    prisma: fixture.prisma,
    merchantId: 'merchant-a',
    taskId: 'task-quote-1',
    traceId: 'trace-quote-1',
    actorId: 'merchant-user',
    employeeId: null,
    message,
    inputs,
    route
  });

  assert.equal(result.status, 'draft_created');
  assert.equal(result.employee, 'sales-customer-manager');
  assert.deepEqual(result.toolCalls.map(call => call.toolId), ['create_quote_draft', 'get_quote']);
  assert.equal(result.approvalRequired, false);
  assert.equal(fixture.quotes.length, 1);
  assert.equal(fixture.quotes[0].merchantId, 'merchant-a');
  assert.equal(fixture.quotes[0].customerId, 'customer-1');
  assert.equal(fixture.quotes[0].status, 'draft');
  assert.equal(fixture.quotes[0].totalQty, 6);
  assert.equal(fixture.quotes[0].totalAmount, 226.8);
  assert.equal(fixture.quotes[0].currency, 'EUR');
  assert.equal(fixture.quotes[0].items[0].unitPrice, 37.8);
  const retry = await tools.handlers.create_quote_draft('merchant-a', inputs.quote, new AbortController().signal);
  assert.equal((retry as { quoteId: string }).quoteId, fixture.quotes[0].id);
  assert.equal(fixture.quotes.length, 1);
  await assert.rejects(
    tools.handlers.create_quote_draft('merchant-a', {
      ...inputs.quote,
      items: [{ ...inputs.quote.items[0], quantity: 9 }]
    }, new AbortController().signal),
    /MODAGPT_TOOL_IDEMPOTENCY_CONFLICT/
  );
});

test('Quote update requires snapshot-bound approval and executes the persisted Tool Runtime action', async () => {
  const fixture = createPrismaFixture();
  fixture.products.push({
    id: 'product-a',
    merchantId: 'merchant-a',
    styleNo: 'AT-100',
    name: 'Linen Blazer',
    wholesalePrice: 42,
    moq: 6,
    packSize: 3,
    skus: JSON.stringify([{ sku: 'AT-100-BLK-S', color: 'Black', size: 'S' }]),
    lifecycleStatus: 'published'
  });
  fixture.quotes.push({
    id: 'quote-update',
    quoteNo: 'Q-UPDATE',
    merchantId: 'merchant-a',
    customerId: 'customer-1',
    createdBy: 'merchant-user',
    status: 'draft',
    updatedAt: new Date(),
    totalQty: 6,
    totalAmount: 226.8,
    notes: 'Before',
    items: [{ productId: 'product-a', sku: 'AT-100-BLK-S', quantity: 6, unitPrice: 37.8 }]
  });
  const tools = createModaGptMerchantTools({
    prisma: fixture.prisma,
    taskId: 'task-quote-update',
    actorId: 'merchant-user',
    employeeId: null
  });
  const message = '修改报价';
  const route = makeRoute(message, tools.definitions.map(tool => tool.name));
  const inputs = {
    quoteAction: 'update',
    quoteId: 'quote-update',
    items: [{ productId: 'product-a', sku: 'AT-100-BLK-S', quantity: 9, unitPrice: 40 }],
    currency: 'EUR',
    notes: 'Updated price'
  };
  const requested = await executeModaGptMerchantTask({
    prisma: fixture.prisma,
    merchantId: 'merchant-a',
    taskId: 'task-quote-update',
    traceId: 'trace-quote-update',
    actorId: 'merchant-user',
    employeeId: null,
    message,
    inputs,
    route
  });
  assert.equal(requested.status, 'approval_required');
  assert.equal(fixture.quotes[0].totalQty, 6);
  assert.equal(fixture.approvals[0].toolId, 'update_quote');
  fixture.approvals[0].status = 'approved';
  const approved = await executeModaGptMerchantTask({
    prisma: fixture.prisma,
    merchantId: 'merchant-a',
    taskId: 'task-quote-update-approved',
    traceId: 'trace-quote-update-approved',
    actorId: 'merchant-admin',
    employeeId: null,
    message,
    inputs: { quoteAction: 'update', quoteId: 'quote-update' },
    route,
    approvalId: fixture.approvals[0].id
  });
  assert.equal(approved.status, 'draft_created');
  assert.deepEqual(approved.toolCalls.map(call => call.toolId), ['update_quote']);
  assert.equal(fixture.quotes[0].totalQty, 9);
  assert.equal(Number(fixture.quotes[0].totalAmount), 360);
  assert.equal(fixture.quotes[0].currency, 'EUR');
  assert.equal(fixture.quotes[0].status, 'draft');
  assert.equal(fixture.approvals[0].status, 'consumed');
  const duplicate = await executeModaGptMerchantTask({
    prisma: fixture.prisma,
    merchantId: 'merchant-a',
    taskId: 'task-quote-update-approved',
    traceId: 'trace-quote-update-approved',
    actorId: 'merchant-admin',
    employeeId: null,
    message,
    inputs: { quoteAction: 'update', quoteId: 'quote-update' },
    route,
    approvalId: fixture.approvals[0].id
  });
  assert.equal(duplicate.status, 'draft_created');
  assert.equal(fixture.quotes[0].items.length, 1);
  assert.ok(fixture.audit.some(entry => entry.metadata.includes('"toolId":"update_quote"')));
});

test('Quote currency can be confirmed through an approved update without changing stored line-item values', async () => {
  const fixture = createPrismaFixture();
  fixture.products.push({
    id: 'product-currency',
    merchantId: 'merchant-a',
    styleNo: 'AT-CURRENCY',
    name: 'Currency Test Product',
    moq: 1,
    packSize: 1,
    skus: JSON.stringify([{ sku: 'AT-CURRENCY-BLK-S', color: 'Black', size: 'S' }]),
    lifecycleStatus: 'published'
  });
  fixture.quotes.push({
    id: 'quote-currency',
    quoteNo: 'Q-CURRENCY',
    merchantId: 'merchant-a',
    customerId: 'customer-1',
    createdBy: 'merchant-user',
    status: 'draft',
    updatedAt: new Date(),
    totalQty: 2,
    totalAmount: 80,
    currency: null,
    notes: 'Preserve this note',
    items: [{ productId: 'product-currency', sku: 'AT-CURRENCY-BLK-S', quantity: 2, unitPrice: 40 }]
  });
  const tools = createModaGptMerchantTools({
    prisma: fixture.prisma,
    taskId: 'task-quote-currency',
    actorId: 'merchant-user',
    employeeId: null
  });
  const route = makeRoute('修改报价', tools.definitions.map(tool => tool.name));
  const inputs = { quoteAction: 'update', quoteId: 'quote-currency', currency: 'USD' };
  const requested = await executeModaGptMerchantTask({
    prisma: fixture.prisma,
    merchantId: 'merchant-a',
    taskId: 'task-quote-currency',
    traceId: 'trace-quote-currency',
    actorId: 'merchant-user',
    employeeId: null,
    message: '修改报价',
    inputs,
    route
  });
  assert.equal(requested.status, 'approval_required');
  fixture.approvals[0].status = 'approved';
  const updated = await executeModaGptMerchantTask({
    prisma: fixture.prisma,
    merchantId: 'merchant-a',
    taskId: 'task-quote-currency-worker',
    traceId: 'trace-quote-currency-worker',
    actorId: 'merchant-admin',
    employeeId: null,
    message: '修改报价',
    inputs,
    route,
    approvalId: fixture.approvals[0].id
  });
  assert.equal(updated.status, 'draft_created');
  assert.equal(fixture.quotes[0].currency, 'USD');
  assert.equal(fixture.quotes[0].notes, 'Preserve this note');
  assert.equal(fixture.quotes[0].totalAmount, 80);
  assert.equal(fixture.quotes[0].items[0].unitPrice, 40);
  assert.equal(fixture.approvals[0].status, 'consumed');
});

test('Quote submit and send each require approval; external send uses provider idempotency and persists delivery evidence', async () => {
  const fixture = createPrismaFixture();
  fixture.quotes.push({
    id: 'quote-send',
    quoteNo: 'Q-SEND',
    merchantId: 'merchant-a',
    customerId: 'customer-1',
    createdBy: 'merchant-user',
    status: 'draft',
    updatedAt: new Date(),
    totalQty: 6,
    totalAmount: 226.8,
    currency: 'EUR',
    notes: null,
    items: [{ productId: 'product-a', sku: 'AT-100-BLK-S', styleNo: 'AT-100', productName: 'Linen Blazer', quantity: 6, unitPrice: 37.8 }]
  });
  const message = '报价';
  const tools = createModaGptMerchantTools({
    prisma: fixture.prisma,
    taskId: 'task-quote-submit',
    actorId: 'merchant-user',
    employeeId: null
  });
  const route = makeRoute(message, tools.definitions.map(tool => tool.name));
  const submitRequest = await executeModaGptMerchantTask({
    prisma: fixture.prisma,
    merchantId: 'merchant-a',
    taskId: 'task-quote-submit',
    traceId: 'trace-quote-submit',
    actorId: 'merchant-user',
    employeeId: null,
    message,
    inputs: { quoteAction: 'submit', quoteId: 'quote-send' },
    route
  });
  assert.equal(submitRequest.status, 'approval_required');
  fixture.approvals[0].status = 'approved';
  const submitted = await executeModaGptMerchantTask({
    prisma: fixture.prisma,
    merchantId: 'merchant-a',
    taskId: 'task-quote-submit-worker',
    traceId: 'trace-quote-submit-worker',
    actorId: 'merchant-admin',
    employeeId: null,
    message,
    inputs: { quoteAction: 'submit', quoteId: 'quote-send' },
    route,
    approvalId: fixture.approvals[0].id
  });
  assert.equal(submitted.status, 'approved');
  assert.equal(fixture.quotes[0].status, 'approved');

  const sendTools = createModaGptMerchantTools({
    prisma: fixture.prisma,
    taskId: 'task-quote-send',
    actorId: 'merchant-user',
    employeeId: null,
    sendQuote: async (_merchantId, quote, idempotencyKey) => {
      assert.equal(quote.recipient, 'buyer@example.test');
      return { provider: 'resend', providerMessageId: `resend-${idempotencyKey}` };
    }
  });
  const sendRoute = makeRoute(message, sendTools.definitions.map(tool => tool.name));
  const sendRequest = await executeModaGptMerchantTask({
    prisma: fixture.prisma,
    merchantId: 'merchant-a',
    taskId: 'task-quote-send',
    traceId: 'trace-quote-send',
    actorId: 'merchant-user',
    employeeId: null,
    message,
    inputs: { quoteAction: 'send', quoteId: 'quote-send' },
    route: sendRoute
  });
  assert.equal(sendRequest.status, 'approval_required');
  fixture.approvals[1].status = 'approved';
  let providerCalls = 0;
  let sentIdempotencyKey = '';
  const sent = await executeModaGptMerchantTask({
    prisma: fixture.prisma,
    merchantId: 'merchant-a',
    taskId: 'task-quote-send-worker',
    traceId: 'trace-quote-send-worker',
    actorId: 'merchant-admin',
    employeeId: null,
    message,
    inputs: { quoteAction: 'send', quoteId: 'quote-send' },
    route: sendRoute,
    approvalId: fixture.approvals[1].id,
    sendQuote: async (_merchantId, quote, idempotencyKey) => {
      providerCalls += 1;
      assert.equal(quote.taskId, 'task-quote-send-worker');
      assert.equal(quote.traceId, 'trace-quote-send-worker');
      sentIdempotencyKey = idempotencyKey;
      return {
        provider: 'resend',
        providerMessageId: `resend-${idempotencyKey}-${quote.quoteNo}`
      };
    }
  });
  assert.equal(sent.status, 'sent');
  assert.equal(fixture.quotes[0].status, 'sent');
  assert.equal(fixture.quotes[0].sentRecipient, 'buyer@example.test');
  assert.ok(fixture.quotes[0].sentAt instanceof Date);
  assert.ok(String(fixture.quotes[0].sendProviderMessageId).startsWith('resend-'));
  assert.equal(fixture.approvals[1].status, 'consumed');
  const duplicateSend = await executeModaGptMerchantTask({
    prisma: fixture.prisma,
    merchantId: 'merchant-a',
    taskId: 'task-quote-send-worker',
    traceId: 'trace-quote-send-worker',
    actorId: 'merchant-admin',
    employeeId: null,
    message,
    inputs: { quoteAction: 'send', quoteId: 'quote-send' },
    route: sendRoute,
    approvalId: fixture.approvals[1].id,
    sendQuote: async () => {
      providerCalls += 1;
      throw new Error('DUPLICATE_PROVIDER_SEND');
    }
  });
  assert.equal(duplicateSend.status, 'sent');
  assert.equal(providerCalls, 1);
  assert.equal(fixture.quotes[0].sendProviderMessageId, `resend-${sentIdempotencyKey}-Q-SEND`);
  assert.equal(fixture.quotes[0].deliveryStatus, 'SENT');
  assert.equal(fixture.quotes[0].sendProvider, 'resend');
  assert.equal(fixture.quotes[0].sendTaskId, 'task-quote-send-worker');
  assert.equal(fixture.quotes[0].sendTraceId, 'trace-quote-send-worker');
  assert.equal(fixture.quotes[0].sendFailureReason, null);
  assert.ok(fixture.audit.some(entry => entry.action === 'MODAGPT_QUOTE_SENT'
    && entry.metadata.includes('trace-quote-send-worker')));
});

test('Quote approval is expired when the persisted quote changes before execution', async () => {
  const fixture = createPrismaFixture();
  fixture.quotes.push({
    id: 'quote-stale',
    quoteNo: 'Q-STALE',
    merchantId: 'merchant-a',
    customerId: 'customer-1',
    createdBy: 'merchant-user',
    status: 'draft',
    updatedAt: new Date(),
    totalQty: 6,
    totalAmount: 226.8,
    notes: null,
    items: [{ productId: 'product-a', sku: 'AT-100-BLK-S', quantity: 6, unitPrice: 37.8 }]
  });
  const message = '修改报价';
  const tools = createModaGptMerchantTools({
    prisma: fixture.prisma,
    taskId: 'task-quote-stale',
    actorId: 'merchant-user',
    employeeId: null
  });
  const route = makeRoute(message, tools.definitions.map(tool => tool.name));
  const requestInputs = {
    quoteAction: 'update',
    quoteId: 'quote-stale',
    items: [{ productId: 'product-a', sku: 'AT-100-BLK-S', quantity: 9, unitPrice: 40 }]
  };
  await executeModaGptMerchantTask({
    prisma: fixture.prisma,
    merchantId: 'merchant-a',
    taskId: 'task-quote-stale',
    traceId: 'trace-quote-stale',
    actorId: 'merchant-user',
    employeeId: null,
    message,
    inputs: requestInputs,
    route
  });
  fixture.approvals[0].status = 'approved';
  fixture.quotes[0].notes = 'Changed after approval';
  await assert.rejects(executeModaGptMerchantTask({
    prisma: fixture.prisma,
    merchantId: 'merchant-a',
    taskId: 'task-quote-stale-worker',
    traceId: 'trace-quote-stale-worker',
    actorId: 'merchant-admin',
    employeeId: null,
    message,
    inputs: { quoteAction: 'update', quoteId: 'quote-stale' },
    route,
    approvalId: fixture.approvals[0].id
  }), /MODAGPT_APPROVAL_STALE/);
  assert.equal(fixture.approvals[0].status, 'expired');
  assert.equal(fixture.quotes[0].totalQty, 6);
});

test('Quote submit detects a concurrent draft update and expires the stale approval', async () => {
  const fixture = createPrismaFixture();
  fixture.quotes.push({
    id: 'quote-submit-race',
    quoteNo: 'Q-RACE',
    merchantId: 'merchant-a',
    customerId: 'customer-1',
    createdBy: 'merchant-user',
    status: 'draft',
    updatedAt: new Date(),
    totalQty: 6,
    totalAmount: 226.8,
    notes: null,
    items: [{ productId: 'product-a', sku: 'AT-100-BLK-S', quantity: 6, unitPrice: 37.8 }]
  });
  const message = '提交报价';
  const tools = createModaGptMerchantTools({
    prisma: fixture.prisma,
    taskId: 'task-quote-submit-race',
    actorId: 'merchant-user',
    employeeId: null
  });
  const route = makeRoute(message, tools.definitions.map(tool => tool.name));
  const request = await executeModaGptMerchantTask({
    prisma: fixture.prisma,
    merchantId: 'merchant-a',
    taskId: 'task-quote-submit-race',
    traceId: 'trace-quote-submit-race',
    actorId: 'merchant-user',
    employeeId: null,
    message,
    inputs: { quoteAction: 'submit', quoteId: 'quote-submit-race' },
    route
  });
  assert.equal(request.status, 'approval_required');
  fixture.approvals[0].status = 'approved';
  fixture.transaction.salesQuote.updateMany = async () => ({ count: 0 });
  await assert.rejects(executeModaGptMerchantTask({
    prisma: fixture.prisma,
    merchantId: 'merchant-a',
    taskId: 'task-quote-submit-race-worker',
    traceId: 'trace-quote-submit-race-worker',
    actorId: 'merchant-admin',
    employeeId: null,
    message,
    inputs: { quoteAction: 'submit', quoteId: 'quote-submit-race' },
    route,
    approvalId: fixture.approvals[0].id
  }), /MODAGPT_APPROVAL_STALE/);
  assert.equal(fixture.quotes[0].status, 'draft');
  assert.equal(fixture.approvals[0].status, 'expired');
});

test('Quote send approval expires when the customer recipient changes before execution', async () => {
  const fixture = createPrismaFixture();
  fixture.quotes.push({
    id: 'quote-recipient-change',
    quoteNo: 'Q-RECIPIENT',
    merchantId: 'merchant-a',
    customerId: 'customer-1',
    createdBy: 'merchant-user',
    status: 'approved',
    updatedAt: new Date(),
    totalQty: 6,
    totalAmount: 226.8,
    currency: 'EUR',
    notes: null,
    items: [{ productId: 'product-a', sku: 'AT-100-BLK-S', quantity: 6, unitPrice: 37.8 }]
  });
  const message = '发送报价';
  const tools = createModaGptMerchantTools({
    prisma: fixture.prisma,
    taskId: 'task-quote-recipient-change',
    actorId: 'merchant-user',
    employeeId: null
  });
  const route = makeRoute('报价', tools.definitions.map(tool => tool.name));
  const request = await executeModaGptMerchantTask({
    prisma: fixture.prisma,
    merchantId: 'merchant-a',
    taskId: 'task-quote-recipient-change',
    traceId: 'trace-quote-recipient-change',
    actorId: 'merchant-user',
    employeeId: null,
    message,
    inputs: { quoteAction: 'send', quoteId: 'quote-recipient-change' },
    route
  });
  assert.equal(request.status, 'approval_required');
  fixture.approvals[0].status = 'approved';
  fixture.setCustomerEmail('changed@example.test');
  const reapproval = await executeModaGptMerchantTask({
    prisma: fixture.prisma,
    merchantId: 'merchant-a',
    taskId: 'task-quote-recipient-change-worker',
    traceId: 'trace-quote-recipient-change-worker',
    actorId: 'merchant-admin',
    employeeId: null,
    message,
    inputs: { quoteAction: 'send', quoteId: 'quote-recipient-change' },
    route,
    approvalId: fixture.approvals[0].id,
    sendQuote: async () => {
      throw new Error('SEND_MUST_NOT_BE_CALLED');
    }
  });
  assert.equal(reapproval.status, 'approval_required');
  assert.notEqual(reapproval.approvalId, fixture.approvals[0].id);
  assert.equal(fixture.approvals[0].status, 'expired');
  assert.equal(fixture.approvals[1].status, 'pending');
  assert.match(fixture.approvals[1].payload, /changed@example\.test/);
  assert.equal(fixture.quotes[0].status, 'approved');
});

test('Quote send failures persist error evidence and can safely retry the same approved delivery', async () => {
  const fixture = createPrismaFixture();
  fixture.quotes.push({
    id: 'quote-retry',
    quoteNo: 'Q-RETRY',
    merchantId: 'merchant-a',
    customerId: 'customer-1',
    createdBy: 'merchant-user',
    status: 'approved',
    updatedAt: new Date(),
    totalQty: 6,
    totalAmount: 226.8,
    currency: 'EUR',
    notes: null,
    items: [{ productId: 'product-a', sku: 'AT-100-BLK-S', styleNo: 'AT-100', productName: 'Linen Blazer', quantity: 6, unitPrice: 37.8 }]
  });
  const message = '发送报价';
  const tools = createModaGptMerchantTools({
    prisma: fixture.prisma,
    taskId: 'task-quote-send-retry',
    actorId: 'merchant-user',
    employeeId: null
  });
  const route = makeRoute('报价', tools.definitions.map(tool => tool.name));
  const request = await executeModaGptMerchantTask({
    prisma: fixture.prisma,
    merchantId: 'merchant-a',
    taskId: 'task-quote-send-retry',
    traceId: 'trace-quote-send-retry',
    actorId: 'merchant-user',
    employeeId: null,
    message,
    inputs: { quoteAction: 'send', quoteId: 'quote-retry' },
    route
  });
  assert.equal(request.status, 'approval_required');
  fixture.approvals[0].status = 'approved';
  let failedKey = '';
  const continuation = {
    prisma: fixture.prisma,
    merchantId: 'merchant-a',
    taskId: 'task-quote-send-retry-worker',
    traceId: 'trace-quote-send-retry-worker',
    actorId: 'merchant-admin',
    employeeId: null,
    message,
    inputs: { quoteAction: 'send', quoteId: 'quote-retry' },
    route,
    approvalId: fixture.approvals[0].id
  };
  await assert.rejects(executeModaGptMerchantTask({
    ...continuation,
    sendQuote: async (_merchantId, _quote, idempotencyKey) => {
      failedKey = idempotencyKey;
      throw new Error('RESEND_TEMPORARILY_UNAVAILABLE');
    }
  }), /RESEND_TEMPORARILY_UNAVAILABLE/);
  assert.equal(fixture.quotes[0].status, 'approved');
  assert.equal(fixture.quotes[0].sendError, 'RESEND_TEMPORARILY_UNAVAILABLE');
  assert.equal(fixture.quotes[0].deliveryStatus, 'FAILED');
  assert.equal(fixture.quotes[0].sendFailureReason, 'RESEND_TEMPORARILY_UNAVAILABLE');
  assert.equal(fixture.quotes[0].sendTaskId, 'task-quote-send-retry-worker');
  assert.equal(fixture.quotes[0].sendTraceId, 'trace-quote-send-retry-worker');
  assert.equal(fixture.approvals[0].status, 'processing');
  const retried = await executeModaGptMerchantTask({
    ...continuation,
    sendQuote: async (_merchantId, _quote, idempotencyKey) => {
      assert.equal(idempotencyKey, failedKey);
      return { provider: 'resend', providerMessageId: 'resend-retry-id' };
    }
  });
  assert.equal(retried.status, 'sent');
  assert.equal(fixture.quotes[0].status, 'sent');
  assert.equal(fixture.quotes[0].sendError, null);
  assert.equal(fixture.quotes[0].deliveryStatus, 'SENT');
});

test('Quote send requests require an explicitly stored currency before approval or delivery', async () => {
  const fixture = createPrismaFixture();
  fixture.quotes.push({
    id: 'quote-no-currency',
    quoteNo: 'Q-NO-CURRENCY',
    merchantId: 'merchant-a',
    customerId: 'customer-1',
    createdBy: 'merchant-user',
    status: 'approved',
    updatedAt: new Date(),
    totalQty: 1,
    totalAmount: 40,
    currency: null,
    notes: null,
    items: [{ productId: 'product-a', sku: 'AT-100-BLK-S', quantity: 1, unitPrice: 40 }]
  });
  const tools = createModaGptMerchantTools({
    prisma: fixture.prisma,
    taskId: 'task-quote-no-currency',
    actorId: 'merchant-user',
    employeeId: null
  });
  const route = makeRoute('发送报价', tools.definitions.map(tool => tool.name));
  const result = await executeModaGptMerchantTask({
    prisma: fixture.prisma,
    merchantId: 'merchant-a',
    taskId: 'task-quote-no-currency',
    traceId: 'trace-quote-no-currency',
    actorId: 'merchant-user',
    employeeId: null,
    message: '发送报价',
    inputs: { quoteAction: 'send', quoteId: 'quote-no-currency' },
    route
  });
  assert.equal(result.status, 'needs_input');
  assert.equal(fixture.approvals.length, 0);
  assert.equal(fixture.quotes[0].deliveryStatus, undefined);
});

test('business analysis calls all six read-only RUDA tools and verifies tenant-filtered aggregation', async () => {
  const fixture = createPrismaFixture();
  const createdAt = new Date();
  fixture.orders.push({
    id: 'order-a', merchantId: 'merchant-a', totalQty: 4, totalAmount: 120,
    refundAmount: 10, customerId: 'customer-1',
    status: 'shipped', paymentStatus: 'paid', createdAt
  });
  fixture.orders.push({
    id: 'order-cancelled', merchantId: 'merchant-a', totalQty: 20, totalAmount: 500,
    refundAmount: 500, customerId: 'customer-1',
    status: 'cancelled', paymentStatus: 'refunded', createdAt
  });
  fixture.orders.push({
    id: 'order-returned', merchantId: 'merchant-a', totalQty: 12, totalAmount: 300,
    refundAmount: 300, customerId: 'customer-1',
    status: 'returned', paymentStatus: 'refunded', createdAt
  });
  fixture.orders.push({
    id: 'order-other-tenant', merchantId: 'merchant-b', totalQty: 50, totalAmount: 1000,
    refundAmount: 0, customerId: 'customer-1',
    status: 'shipped', paymentStatus: 'paid', createdAt
  });
  fixture.orderItems.push({
    merchantId: 'merchant-a',
    order: { merchantId: 'merchant-a', createdAt, status: 'shipped' },
    productId: 'product-a',
    styleNo: 'AT-100',
    productName: 'Linen Blazer',
    sku: 'AT-100-BLK-S',
    quantity: 4,
    unitPrice: 30
  });
  fixture.orderItems.push({
    merchantId: 'merchant-a',
    order: { merchantId: 'merchant-a', createdAt, status: 'cancelled' },
    productId: 'product-cancelled',
    styleNo: 'AT-200',
    productName: 'Cancelled Coat',
    sku: 'AT-200-BLK-S',
    quantity: 20,
    unitPrice: 25
  });
  fixture.balances.push({
    merchantId: 'merchant-a',
    onHandQuantity: 10,
    reservedQuantity: 2,
    inTransitQuantity: 3,
    variant: {
      sku: 'AT-100-BLK-S',
      product: { id: 'product-a', name: 'Linen Blazer', merchantId: 'merchant-a' }
    }
  });
  fixture.invoices.push({ id: 'invoice-a', merchantId: 'merchant-a', issueDate: createdAt, totalAmount: 120, currency: 'EUR', status: 'issued' });
  fixture.invoices.push({ id: 'invoice-b', merchantId: 'merchant-a', issueDate: createdAt, totalAmount: 55, currency: 'USD', status: 'issued' });
  fixture.invoices.push({ id: 'invoice-void', merchantId: 'merchant-a', issueDate: createdAt, totalAmount: 30, currency: 'EUR', status: 'void' });
  const message = '帮我分析最近30天生意';
  const tools = createModaGptMerchantTools({
    prisma: fixture.prisma,
    taskId: 'task-business-analysis',
    actorId: 'merchant-user',
    employeeId: null
  });
  const route = superviseModaGptCoreTask({
    request: message,
    assignedAgents: agents,
    registeredWorkflows: ['product_publish', 'customer_quote_creation', 'business_analysis'],
    registeredTools: tools.definitions.map(tool => tool.name)
  });
  assert.ok(route);
  assert.equal(route.workflow, 'business_analysis');
  assert.equal(route.execution, 'ready');
  const result = await executeModaGptMerchantTask({
    prisma: fixture.prisma,
    merchantId: 'merchant-a',
    taskId: 'task-business-analysis',
    traceId: 'trace-business-analysis',
    actorId: 'merchant-user',
    employeeId: null,
    message,
    inputs: {},
    route
  });
  assert.equal(result.status, 'analysis_completed');
  assert.equal(result.employee, 'business-manager');
  assert.deepEqual(result.toolCalls.map(call => call.toolId), [
    'order_summary', 'sales_summary', 'inventory_summary',
    'product_performance', 'customer_performance', 'finance_summary'
  ]);
  assert.match(result.summary, /1 笔非取消\/退货订单/);
  assert.match(result.summary, /订单金额 120，已记录退款 10，扣减已记录退款后 110/);
  assert.match(result.summary, /issued 120 EUR/);
  assert.match(result.summary, /issued 55 USD/);
  assert.match(result.summary, /void 30 EUR/);
  assert.doesNotMatch(result.summary, /€120/);
  assert.doesNotMatch(result.summary, /Cancelled Coat/);
  assert.equal(fixture.audit.filter(entry => entry.action === 'MODAGPT_TOOL_SUCCEEDED').length, 6);
});

test('product draft tool rejects a mismatched tenant before writing', async () => {
  const fixture = createPrismaFixture();
  const tools = createModaGptMerchantTools({
    prisma: fixture.prisma,
    taskId: 'task-product-denied',
    actorId: 'merchant-user',
    employeeId: null
  });
  await assert.rejects(
    tools.handlers.create_product_draft('merchant-b', {
      styleNo: 'AT-100',
      name: 'Linen Blazer',
      category: 'women',
      subCategory: 'blazer',
      season: '2026 SS',
      wholesalePrice: 42,
      rrpPrice: 119,
      moq: 6,
      packSize: 3,
      description: '',
      skus: [{ sku: 'AT-100-BLK-S', color: 'Black', size: 'S' }]
    }, new AbortController().signal),
    /MODAGPT_MERCHANT_NOT_FOUND/
  );
  assert.equal(fixture.products.length, 0);
});

test('product draft tool rechecks the worker lease after validation and before writing', async () => {
  const fixture = createPrismaFixture();
  const tools = createModaGptMerchantTools({
    prisma: fixture.prisma,
    taskId: 'task-product-lease-lost',
    actorId: 'merchant-user',
    employeeId: null,
    assertLease: async () => { throw new Error('MODAGPT_TASK_LEASE_LOST'); }
  });
  await assert.rejects(
    tools.handlers.create_product_draft('merchant-a', {
      styleNo: 'AT-100',
      name: 'Linen Blazer',
      category: 'women',
      subCategory: 'blazer',
      season: '2026 SS',
      wholesalePrice: 42,
      rrpPrice: 119,
      moq: 6,
      packSize: 3,
      description: '',
      skus: [{ sku: 'AT-100-BLK-S', color: 'Black', size: 'S' }]
    }, new AbortController().signal),
    /MODAGPT_TASK_LEASE_LOST/
  );
  assert.equal(fixture.products.length, 0);
});

test('incomplete product publishing requests ask for required facts without invoking write tools', async () => {
  const fixture = createPrismaFixture();
  const message = '帮我上架这个商品';
  const tools = createModaGptMerchantTools({
    prisma: fixture.prisma,
    taskId: 'task-product-incomplete',
    actorId: 'merchant-user',
    employeeId: null
  });
  const route = makeRoute(message, tools.definitions.map(tool => tool.name));
  const result = await executeModaGptMerchantTask({
    prisma: fixture.prisma,
    merchantId: 'merchant-a',
    taskId: 'task-product-incomplete',
    traceId: 'trace-product-incomplete',
    actorId: 'merchant-user',
    employeeId: null,
    message,
    inputs: {},
    route
  });

  assert.equal(result.status, 'needs_input');
  assert.equal(result.toolCalls.length, 0);
  assert.equal(fixture.products.length, 0);
});

test('natural-language product facts are extracted without inventing SKU, category, or pricing fields', () => {
  assert.deepEqual(
    parseProductFactsFromRequest('帮我上架这件黑色连衣裙，批发价39.9，MOQ 10，尺码 S-XL'),
    { name: '黑色连衣裙', wholesalePrice: 39.9, moq: 10 }
  );
});

test('natural-language quote facts are extracted explicitly without resolving identities or inventing currency', () => {
  assert.deepEqual(
    parseQuoteFactsFromRequest('给客户 ABC 做一个报价，黑色连衣裙 100 件，每件 39.9 欧元，打 5% 折。'),
    {
      customerQuery: 'ABC',
      productQuery: '黑色连衣裙',
      quantity: 100,
      unitPrice: 39.9,
      currency: 'EUR',
      discountPercent: 5
    }
  );
  assert.deepEqual(
    parseQuoteFactsFromRequest('给客户 ABC 做一个报价'),
    {
      customerQuery: 'ABC',
      productQuery: null,
      quantity: null,
      unitPrice: null,
      currency: null,
      discountPercent: null
    }
  );
});

test('incomplete natural-language quote requests search tenant data and stop for confirmation', async () => {
  const fixture = createPrismaFixture();
  fixture.products.push({
    id: 'product-a',
    merchantId: 'merchant-a',
    styleNo: 'AT-100',
    name: '黑色连衣裙',
    category: 'women',
    wholesalePrice: 39.9,
    moq: 10,
    packSize: 5,
    skus: JSON.stringify([{ sku: 'AT-100-BLK-S', color: 'Black', size: 'S' }]),
    lifecycleStatus: 'published'
  });
  const message = '给客户 ABC 做一个报价，黑色连衣裙 100 件，每件 39.9 欧元，打 5% 折。';
  const tools = createModaGptMerchantTools({
    prisma: fixture.prisma,
    taskId: 'task-quote-natural',
    actorId: 'merchant-user',
    employeeId: null
  });
  const result = await executeModaGptMerchantTask({
    prisma: fixture.prisma,
    merchantId: 'merchant-a',
    taskId: 'task-quote-natural',
    traceId: 'trace-quote-natural',
    actorId: 'merchant-user',
    employeeId: null,
    message,
    inputs: {},
    route: makeRoute(message, tools.definitions.map(tool => tool.name))
  });
  assert.equal(result.status, 'needs_input');
  assert.deepEqual(result.toolCalls.map(call => call.toolId), ['get_customers', 'get_products']);
  assert.match(result.summary, /请确认客户 ID/);
  assert.match(result.summary, /请确认商品 ID 和 SKU/);
  assert.match(result.summary, /39.9 EUR/);
  assert.equal(fixture.quotes.length, 0);
});

test('ModaGPT updates a tenant-owned product draft through the Runtime and verifies the persisted draft', async () => {
  const fixture = createPrismaFixture();
  fixture.products.push({
    id: 'product-update',
    merchantId: 'merchant-a',
    styleNo: 'AT-300',
    name: 'Old Dress',
    category: 'women',
    subCategory: 'dress',
    season: '2026 SS',
    wholesalePrice: 30,
    rrpPrice: 80,
    moq: 5,
    packSize: 5,
    description: 'Old description',
    skus: JSON.stringify([{ sku: 'AT-300-BLK-S', color: 'Black', size: 'S' }]),
    lifecycleStatus: 'draft'
  });
  const tools = createModaGptMerchantTools({
    prisma: fixture.prisma,
    taskId: 'task-product-update',
    actorId: 'merchant-user',
    employeeId: null
  });
  const route = makeRoute('更新商品', tools.definitions.map(tool => tool.name));
  const result = await executeModaGptMerchantTask({
    prisma: fixture.prisma,
    merchantId: 'merchant-a',
    taskId: 'task-product-update',
    traceId: 'trace-product-update',
    actorId: 'merchant-user',
    employeeId: null,
    message: '更新商品',
    inputs: {
      productAction: 'update',
      productId: 'product-update',
      product: {
        styleNo: 'AT-300',
        name: 'Updated Dress',
        category: 'women',
        subCategory: 'dress',
        season: '2026 SS',
        wholesalePrice: 35,
        rrpPrice: 90,
        moq: 5,
        packSize: 5,
        description: 'Updated description',
        skus: [{ sku: 'AT-300-BLK-S', color: 'Black', size: 'S' }]
      }
    },
    route
  });
  assert.equal(result.status, 'draft_created');
  assert.equal(fixture.products[0].name, 'Updated Dress');
  assert.equal(fixture.products[0].wholesalePrice, 35);
  assert.equal(fixture.products[0].lifecycleStatus, 'draft');
  assert.deepEqual(result.toolCalls.map(call => call.toolId), ['update_product_draft', 'get_products']);
});

test('product publication waits for persisted approval and executes through the verified Tool Runtime', async () => {
  const fixture = createPrismaFixture();
  fixture.products.push({
    id: 'product-publish',
    merchantId: 'merchant-a',
    styleNo: 'AT-200',
    name: 'Black Dress',
    category: 'women',
    wholesalePrice: 39.9,
    rrpPrice: 99,
    moq: 10,
    packSize: 5,
    skus: JSON.stringify([{ sku: 'AT-200-BLK-S', color: 'Black', size: 'S' }]),
    images: JSON.stringify(['https://merchant.example/dress.jpg']),
    media: JSON.stringify([{ id: 'cover', type: 'image', url: 'https://merchant.example/dress.jpg' }]),
    lifecycleStatus: 'draft'
  });
  const route = makeRoute('发布商品', createModaGptMerchantTools({
    prisma: fixture.prisma,
    taskId: 'task-product-publish',
    actorId: 'merchant-user',
    employeeId: null
  }).definitions.map(tool => tool.name));
  const requested = await executeModaGptMerchantTask({
    prisma: fixture.prisma,
    merchantId: 'merchant-a',
    taskId: 'task-product-publish',
    traceId: 'trace-product-publish',
    actorId: 'merchant-user',
    employeeId: null,
    message: '发布商品',
    inputs: { productAction: 'publish', productId: 'product-publish' },
    route
  });
  assert.equal(requested.status, 'approval_required');
  assert.equal(fixture.products[0].lifecycleStatus, 'draft');
  assert.equal(fixture.approvals.length, 1);
  assert.equal(fixture.approvals[0].status, 'pending');

  fixture.approvals[0].status = 'approved';
  const published = await executeModaGptMerchantTask({
    prisma: fixture.prisma,
    merchantId: 'merchant-a',
    taskId: 'task-product-publish-approved',
    traceId: 'trace-product-publish-approved',
    actorId: 'merchant-admin',
    employeeId: null,
    message: '发布商品',
    inputs: { productAction: 'publish', productId: 'product-publish' },
    route,
    approvalId: fixture.approvals[0].id
  });
  assert.equal(published.status, 'published');
  assert.equal(published.artifacts[0], 'Product:product-publish');
  assert.equal(fixture.products[0].lifecycleStatus, 'published');
  assert.equal(fixture.approvals[0].status, 'consumed');
  assert.ok(fixture.audit.some(event => event.action === 'MODAGPT_TOOL_SUCCEEDED'));

  const unpublishRoute = makeRoute('下架商品', createModaGptMerchantTools({
    prisma: fixture.prisma,
    taskId: 'task-product-unpublish',
    actorId: 'merchant-user',
    employeeId: null
  }).definitions.map(tool => tool.name));
  const unpublishRequest = await executeModaGptMerchantTask({
    prisma: fixture.prisma,
    merchantId: 'merchant-a',
    taskId: 'task-product-unpublish',
    traceId: 'trace-product-unpublish',
    actorId: 'merchant-user',
    employeeId: null,
    message: '下架商品',
    inputs: { productAction: 'unpublish', productId: 'product-publish' },
    route: unpublishRoute
  });
  assert.equal(unpublishRequest.status, 'approval_required');
  const unpublishApproval = fixture.approvals[1];
  unpublishApproval.status = 'approved';
  const unpublished = await executeModaGptMerchantTask({
    prisma: fixture.prisma,
    merchantId: 'merchant-a',
    taskId: 'task-product-unpublish-approved',
    traceId: 'trace-product-unpublish-approved',
    actorId: 'merchant-admin',
    employeeId: null,
    message: '下架商品',
    inputs: { productAction: 'unpublish', productId: 'product-publish' },
    route: unpublishRoute,
    approvalId: unpublishApproval.id
  });
  assert.equal(unpublished.status, 'unpublished');
  assert.equal(fixture.products[0].lifecycleStatus, 'draft');
  assert.equal(unpublishApproval.status, 'consumed');
});

test('product approval is invalidated when the approved product snapshot changes before publishing', async () => {
  const fixture = createPrismaFixture();
  fixture.products.push({
    id: 'product-publish-stale',
    merchantId: 'merchant-a',
    styleNo: 'AT-201',
    name: 'Black Dress',
    category: 'women',
    wholesalePrice: 39.9,
    rrpPrice: 99,
    moq: 10,
    packSize: 5,
    skus: JSON.stringify([{ sku: 'AT-201-BLK-S', color: 'Black', size: 'S' }]),
    images: JSON.stringify(['https://merchant.example/dress.jpg']),
    media: JSON.stringify([{ id: 'cover', type: 'image', url: 'https://merchant.example/dress.jpg' }]),
    lifecycleStatus: 'draft'
  });
  const tools = createModaGptMerchantTools({
    prisma: fixture.prisma,
    taskId: 'task-product-publish-stale',
    actorId: 'merchant-user',
    employeeId: null
  });
  const route = makeRoute('发布商品', tools.definitions.map(tool => tool.name));
  const requested = await executeModaGptMerchantTask({
    prisma: fixture.prisma,
    merchantId: 'merchant-a',
    taskId: 'task-product-publish-stale',
    traceId: 'trace-product-publish-stale',
    actorId: 'merchant-user',
    employeeId: null,
    message: '发布商品',
    inputs: { productAction: 'publish', productId: 'product-publish-stale' },
    route
  });
  assert.equal(requested.status, 'approval_required');

  fixture.approvals[0].status = 'approved';
  fixture.products[0].name = 'Red Dress';
  await assert.rejects(executeModaGptMerchantTask({
    prisma: fixture.prisma,
    merchantId: 'merchant-a',
    taskId: 'task-product-publish-stale-approved',
    traceId: 'trace-product-publish-stale-approved',
    actorId: 'merchant-admin',
    employeeId: null,
    message: '发布商品',
    inputs: { productAction: 'publish', productId: 'product-publish-stale' },
    route,
    approvalId: fixture.approvals[0].id
  }), /MODAGPT_APPROVAL_STALE/);
  assert.equal(fixture.products[0].lifecycleStatus, 'draft');
  assert.equal(fixture.approvals[0].status, 'expired');
  assert.ok(fixture.audit.some(event => event.action === 'MODAGPT_TOOL_FAILED'));
});

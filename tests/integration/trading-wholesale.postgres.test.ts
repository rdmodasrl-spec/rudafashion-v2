import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { fork, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { getIsolatedPostgresTestDatabaseUrl } from '../../scripts/isolatedPostgresTestDatabase';
import { provisionModaGptIndustryTeam } from '../../src/server/modagptIndustryProvisioning';

if (process.env.NODE_ENV !== 'test') throw new Error('TRADING_WHOLESALE_INTEGRATION_REQUIRES_NODE_ENV_TEST');

const databaseUrl = getIsolatedPostgresTestDatabaseUrl({
  nodeEnv: process.env.NODE_ENV,
  testDatabaseUrl: process.env.TRADING_WHOLESALE_TEST_DATABASE_URL,
  applicationDatabaseUrl: process.env.RUDA_APPLICATION_DATABASE_URL,
  runId: process.env.TRADING_WHOLESALE_TEST_RUN_ID,
  containerId: process.env.TRADING_WHOLESALE_TEST_CONTAINER_ID
});
const merchantSecret = process.env.JWT_MERCHANT_SECRET;
if (!merchantSecret) throw new Error('TRADING_WHOLESALE_INTEGRATION_JWT_SECRET_REQUIRED');

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
type HttpResult = { status: number; body: Record<string, any> };

async function getFreePort(): Promise<number> {
  const listener = net.createServer();
  await new Promise<void>((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolve);
  });
  const address = listener.address();
  if (!address || typeof address === 'string') throw new Error('TRADING_WHOLESALE_TEST_PORT_UNAVAILABLE');
  await new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
  return address.port;
}

async function request(baseUrl: string, route: string, options: {
  method?: string;
  token?: string;
  idempotencyKey?: string;
  body?: unknown;
} = {}): Promise<HttpResult> {
  const response = await fetch(`${baseUrl}${route}`, {
    method: options.method || 'GET',
    headers: {
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' })
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(20_000)
  });
  const text = await response.text();
  let body: Record<string, any> = {};
  try {
    body = text ? JSON.parse(text) as Record<string, any> : {};
  } catch {
    body = { text };
  }
  return { status: response.status, body };
}

function merchantToken(merchantId: string, employeeId?: string): string {
  return jwt.sign({
    id: employeeId || merchantId,
    merchantId,
    role: employeeId ? 'employee' : 'merchant',
    ...(employeeId ? { employeeId } : {})
  }, merchantSecret!, { expiresIn: '20m' });
}

async function waitForReady(baseUrl: string, child: ChildProcess, logs: () => string): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`TRADING_WHOLESALE_SERVER_EXITED:${child.exitCode}:${logs()}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health/ready`, { signal: AbortSignal.timeout(1_500) });
      if (response.ok) return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 400));
    }
  }
  throw new Error(`TRADING_WHOLESALE_SERVER_START_TIMEOUT:${logs()}`);
}

async function waitForTask(
  baseUrl: string,
  token: string,
  taskId: string,
  logs: () => string,
  timeoutMs = 60_000
): Promise<Record<string, any>> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await request(baseUrl, `/api/merchant/modagpt/task/${encodeURIComponent(taskId)}`, { token });
    if (response.status !== 200) {
      throw new Error(`TRADING_WHOLESALE_TASK_POLL_FAILED:${response.status}:${JSON.stringify(response.body)}:${logs()}`);
    }
    if (['completed', 'failed', 'dead_letter', 'cancelled'].includes(response.body.runtimeStatus)) {
      return response.body;
    }
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error(`TRADING_WHOLESALE_TASK_TIMEOUT:${taskId}:${logs()}`);
}

async function createMerchant(suffix: string, label: string): Promise<string> {
  const id = crypto.randomUUID();
  await prisma.merchant.create({
    data: {
      id,
      name: `Trading ${label} ${suffix}`,
      companyLegalName: `Trading ${label} ${suffix} Ltd`,
      code: `TRADING-${label}-${suffix}`,
      country: 'Italy',
      city: 'Prato',
      showroomAddress: 'Isolated test address',
      showroomArea: 'Test',
      showroomImage: '',
      logo: '',
      banner: '',
      tagline: 'Isolated trading test',
      description: 'Test-only merchant fixture.',
      specialties: '[]',
      foundedYear: 2020,
      contactPerson: 'Integration Test',
      contactPhone: '+390000000000',
      contactEmail: `trading-${label}-${suffix}@example.test`,
      storeSlug: `trading-${label}-${suffix}`,
      industry: 'TRADING_COMPANY'
    }
  });
  return id;
}

test('ModaUI procurement HTTP workflow persists tenant-scoped drafts and returns polled results', async () => {
  const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 20);
  const merchantIds: string[] = [];
  let server: ChildProcess | undefined;
  const serverLogs: string[] = [];
  const logs = () => serverLogs.join('').slice(-20_000);
  let taskIds: string[] = [];

  try {
    const merchantA = await createMerchant(suffix, 'A');
    merchantIds.push(merchantA);
    const merchantB = await createMerchant(suffix, 'B');
    merchantIds.push(merchantB);

    await Promise.all([merchantA, merchantB].map((merchantId, index) =>
      prisma.$transaction(tx => provisionModaGptIndustryTeam({
        tx,
        merchantId,
        industry: 'TRADING_COMPANY',
        idempotencyKey: `trading-wholesale-test:${suffix}:${index}`
      }))
    ));

    const supplierA = await prisma.supplier.create({
      data: { merchantId: merchantA, name: `Supplier A ${suffix}`, status: 'active', leadTimeDays: 7 }
    });
    await prisma.supplier.create({
      data: { merchantId: merchantA, name: `Inactive Supplier A ${suffix}`, status: 'inactive' }
    });
    const supplierB = await prisma.supplier.create({
      data: { merchantId: merchantB, name: `Supplier B ${suffix}`, status: 'active' }
    });
    const productId = `trade-product-${suffix}`;
    const variantId = `trade-variant-${suffix}`;
    await prisma.product.create({
      data: {
        id: productId,
        merchantId: merchantA,
        styleNo: `TR-${suffix}`,
        name: `Trade Product ${suffix}`,
        category: 'general',
        subCategory: 'test',
        brand: 'RUDA Test',
        season: 'test',
        images: '[]',
        wholesalePrice: 10,
        rrpPrice: 20,
        status: 'new',
        inventoryStatus: 'coming_soon',
        origin: 'Italy',
        fabric: 'test',
        composition: 'test',
        weight: 'test',
        packaging: 'test',
        washCare: 'test',
        description: 'Isolated trade procurement integration fixture.',
        skus: JSON.stringify([{ sku: `SKU-${suffix}`, color: 'Blue', size: 'M' }]),
        lifecycleStatus: 'draft',
        variants: {
          create: [{ id: variantId, sku: `SKU-${suffix}`, color: 'Blue', size: 'M' }]
        }
      }
    });

    const orderedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1_000);
    const receivedAt = new Date(orderedAt.getTime() + 7 * 24 * 60 * 60 * 1_000);
    const historicalOrder = await prisma.merchantPurchaseOrder.create({
      data: {
        id: `trade-history-${suffix}`,
        purchaseOrderNo: `PO-HISTORY-${suffix}`,
        merchantId: merchantA,
        supplierId: supplierA.id,
        status: 'received',
        orderedAt,
        items: {
          create: [{
            productId,
            variantId,
            styleNo: `TR-${suffix}`,
            productName: `Trade Product ${suffix}`,
            sku: `SKU-${suffix}`,
            color: 'Blue',
            size: 'M',
            orderedQuantity: 10,
            receivedQuantity: 10,
            unitCost: 5
          }]
        }
      },
      include: { items: true }
    });
    await prisma.merchantPurchaseReceipt.create({
      data: {
        purchaseOrderId: historicalOrder.id,
        merchantId: merchantA,
        idempotencyKey: `trading-history-receipt:${suffix}`,
        payloadHash: crypto.createHash('sha256').update(suffix).digest('hex'),
        receivedAt,
        items: {
          create: [{
            purchaseOrderItemId: historicalOrder.items[0].id,
            quantity: 10,
            unitCost: 5
          }]
        }
      }
    });

    const restrictedEmployeeId = crypto.randomUUID();
    await prisma.merchantEmployee.create({
      data: {
        id: restrictedEmployeeId,
        merchantId: merchantB,
        email: `trading-restricted-${suffix}@example.test`,
        name: 'Restricted integration employee',
        passwordHash: 'not-used-by-this-api-test',
        role: 'sales',
        permissions: '[]'
      }
    });
    const purchaseEmployeeId = crypto.randomUUID();
    await prisma.merchantEmployee.create({
      data: {
        id: purchaseEmployeeId,
        merchantId: merchantA,
        email: `trading-purchase-${suffix}@example.test`,
        name: 'Purchase integration employee',
        passwordHash: 'not-used-by-this-api-test',
        role: 'sales',
        permissions: JSON.stringify(['purchase.manage'])
      }
    });

    const port = await getFreePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    server = fork(path.resolve('server.ts'), [], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'test',
        P0_HTTP_TEST_MODE: 'true',
        P0_HTTP_TEST_ENABLE_MODAGPT_WORKER: 'true',
        DATABASE_URL: databaseUrl,
        PORT: String(port),
        JWT_MERCHANT_SECRET: merchantSecret!,
        JWT_ADMIN_SECRET: process.env.JWT_ADMIN_SECRET || 'trading-test-admin-secret-0123456789abcdef',
        JWT_BUYER_SECRET: 'trading-test-buyer-secret-0123456789abcdef',
        SHARE_LINK_SECRET: 'trading-test-share-secret-0123456789abcdef',
        ADMIN_TOTP_ENCRYPTION_KEY: 'trading-test-totp-secret-0123456789abcdef',
        PAYMENT_ENABLED: 'false',
        MODAGPT_BRAIN_ENABLED: 'false',
        OBJECT_STORAGE_ENDPOINT: '',
        OBJECT_STORAGE_BUCKET: '',
        OBJECT_STORAGE_ACCESS_KEY_ID: '',
        OBJECT_STORAGE_SECRET_ACCESS_KEY: ''
      },
      execArgv: ['--import', 'tsx'],
      stdio: ['ignore', 'pipe', 'pipe', 'ipc']
    });
    server.stdout?.on('data', chunk => serverLogs.push(String(chunk)));
    server.stderr?.on('data', chunk => serverLogs.push(String(chunk)));
    await waitForReady(baseUrl, server, logs);

    const ownerA = merchantToken(merchantA);
    const ownerB = merchantToken(merchantB);
    const restrictedB = merchantToken(merchantB, restrictedEmployeeId);
    const purchaseEmployeeA = merchantToken(merchantA, purchaseEmployeeId);
    const productCatalogA = await request(baseUrl, '/api/merchant/products', { token: purchaseEmployeeA });
    assert.equal(productCatalogA.status, 200);
    const catalogProductA = productCatalogA.body.products.find((product: { id: string }) => product.id === productId);
    assert.ok(catalogProductA);
    assert.equal(catalogProductA.skus.find((sku: { sku: string }) => sku.sku === `SKU-${suffix}`).variantId, variantId);
    const productCatalogB = await request(baseUrl, '/api/merchant/products', { token: ownerB });
    assert.equal(productCatalogB.status, 200);
    assert.equal(productCatalogB.body.products.some((product: { id: string }) => product.id === productId), false);
    assert.equal((await request(baseUrl, '/api/merchant/products', { token: restrictedB })).status, 403);
    const supplierQueryKey = `trading-${suffix}-supplier`;
    const supplierQueryBody = { message: '请查询供应商绩效', inputs: {} };
    const supplierPreview = await request(baseUrl, '/api/merchant/modagpt/task/preview', {
      method: 'POST',
      token: ownerA,
      body: { message: supplierQueryBody.message }
    });
    assert.equal(supplierPreview.status, 200, JSON.stringify(supplierPreview.body));
    assert.equal(supplierPreview.body.workflow, 'procurement_management');
    assert.ok(supplierPreview.body.tools.includes('get_suppliers'));
    assert.ok(supplierPreview.body.tools.includes('get_supplier_performance'));
    const supplierQueryResponse = await request(baseUrl, '/api/merchant/modagpt/task', {
      method: 'POST',
      token: ownerA,
      idempotencyKey: supplierQueryKey,
      body: supplierQueryBody
    });
    assert.equal(supplierQueryResponse.status, 202, JSON.stringify(supplierQueryResponse.body));
    taskIds.push(supplierQueryResponse.body.taskId);
    const analysis = await waitForTask(baseUrl, ownerA, supplierQueryResponse.body.taskId, logs);
    assert.equal(analysis.runtimeStatus, 'completed');
    assert.equal(analysis.status, 'analysis_completed');
    assert.match(analysis.summary, new RegExp(`Supplier A ${suffix}`));
    assert.match(analysis.summary, /到货率 1/);
    assert.match(analysis.summary, /完整交付平均 7 天/);
    assert.ok(analysis.toolCalls.some((call: { toolId: string }) => call.toolId === 'get_suppliers'));
    assert.ok(analysis.toolCalls.some((call: { toolId: string }) => call.toolId === 'get_supplier_performance'));
    assert.equal((await request(baseUrl, `/api/merchant/modagpt/task/${supplierQueryResponse.body.taskId}`, {
      token: ownerB
    })).status, 404);

    const supplierQueryRetry = await request(baseUrl, '/api/merchant/modagpt/task', {
      method: 'POST',
      token: ownerA,
      idempotencyKey: supplierQueryKey,
      body: supplierQueryBody
    });
    assert.equal(supplierQueryRetry.status, 202);
    assert.equal(supplierQueryRetry.body.taskId, supplierQueryResponse.body.taskId);
    assert.equal(supplierQueryRetry.body.deduplicated, true);
    const conflictingRetry = await request(baseUrl, '/api/merchant/modagpt/task', {
      method: 'POST',
      token: ownerA,
      idempotencyKey: supplierQueryKey,
      body: { message: '请查询供应商列表', inputs: {} }
    });
    assert.equal(conflictingRetry.status, 409);

    const merchantBQuery = await request(baseUrl, '/api/merchant/modagpt/task', {
      method: 'POST',
      token: ownerB,
      idempotencyKey: `trading-${suffix}-merchant-b`,
      body: { message: '查询供应商列表', inputs: {} }
    });
    assert.equal(merchantBQuery.status, 202, JSON.stringify(merchantBQuery.body));
    taskIds.push(merchantBQuery.body.taskId);
    const merchantBResult = await waitForTask(baseUrl, ownerB, merchantBQuery.body.taskId, logs);
    assert.equal(merchantBResult.runtimeStatus, 'completed');
    const supplierBToolAudit = await prisma.employeeAuditLog.count({
      where: {
        merchantId: merchantB,
        entityId: merchantBQuery.body.taskId,
        action: 'MODAGPT_TOOL_SUCCEEDED'
      }
    });
    assert.equal(supplierBToolAudit, 1);
    const activeSuppliersA = await prisma.supplier.findMany({
      where: { merchantId: merchantA, status: 'active' },
      select: { id: true }
    });
    assert.deepEqual(activeSuppliersA.map(supplier => supplier.id), [supplierA.id]);
    const activeSuppliersB = await prisma.supplier.findMany({
      where: { merchantId: merchantB, status: 'active' },
      select: { id: true }
    });
    assert.deepEqual(activeSuppliersB.map(supplier => supplier.id), [supplierB.id]);

    const deniedEmployee = await request(baseUrl, '/api/merchant/modagpt/task', {
      method: 'POST',
      token: restrictedB,
      idempotencyKey: `trading-${suffix}-denied`,
      body: { message: '创建采购草稿', inputs: {} }
    });
    assert.equal(deniedEmployee.status, 403);
    assert.equal(
      typeof deniedEmployee.body.error === 'string' ? deniedEmployee.body.error : deniedEmployee.body.error?.code,
      'MODAGPT_TASK_PERMISSION_REQUIRED'
    );
    const deniedPreview = await request(baseUrl, '/api/merchant/modagpt/task/preview', {
      method: 'POST',
      token: restrictedB,
      body: { message: '创建采购草稿' }
    });
    assert.equal(deniedPreview.status, 403);

    const procurementInput = {
      supplierId: supplierA.id,
      items: [
        { productId, variantId, quantity: 10, unitCost: 12.5 },
        { productId, variantId, quantity: 1, unitCost: 1.005 }
      ],
      currency: 'EUR',
      notes: `Integration ${suffix}`
    };
    const procurementKey = `trading-${suffix}-procurement`;
    const procurementBody = {
      message: '请创建采购草稿',
      inputs: { create_procurement_draft: procurementInput }
    };
    const procurementPreview = await request(baseUrl, '/api/merchant/modagpt/task/preview', {
      method: 'POST',
      token: ownerA,
      body: { message: procurementBody.message }
    });
    assert.equal(procurementPreview.status, 200, JSON.stringify(procurementPreview.body));
    assert.equal(procurementPreview.body.workflow, 'procurement_management');
    assert.ok(procurementPreview.body.tools.includes('create_procurement_draft'));
    const procurementResponse = await request(baseUrl, '/api/merchant/modagpt/task', {
      method: 'POST',
      token: ownerA,
      idempotencyKey: procurementKey,
      body: procurementBody
    });
    assert.equal(procurementResponse.status, 202, JSON.stringify(procurementResponse.body));
    taskIds.push(procurementResponse.body.taskId);
    const duplicateProcurementResponse = await request(baseUrl, '/api/merchant/modagpt/task', {
      method: 'POST',
      token: ownerA,
      idempotencyKey: procurementKey,
      body: procurementBody
    });
    assert.equal(duplicateProcurementResponse.status, 202);
    assert.equal(duplicateProcurementResponse.body.taskId, procurementResponse.body.taskId);
    assert.equal(duplicateProcurementResponse.body.deduplicated, true);

    const procurementResult = await waitForTask(baseUrl, ownerA, procurementResponse.body.taskId, logs);
    assert.equal(procurementResult.runtimeStatus, 'completed');
    assert.equal(procurementResult.status, 'draft_created');
    assert.ok(procurementResult.toolCalls.some((call: { toolId: string }) => call.toolId === 'get_suppliers'));
    assert.ok(procurementResult.toolCalls.some((call: { toolId: string }) => call.toolId === 'create_procurement_draft'));
    const purchaseOrderId = procurementResult.artifacts.find((artifact: string) =>
      artifact.startsWith('MerchantPurchaseOrder:')
    )?.split(':')[1];
    assert.ok(purchaseOrderId);
    const savedOrder = await prisma.merchantPurchaseOrder.findFirst({
      where: { id: purchaseOrderId, merchantId: merchantA },
      include: { items: true }
    });
    assert.ok(savedOrder);
    assert.equal(savedOrder.status, 'draft');
    assert.equal(savedOrder.supplierId, supplierA.id);
    assert.equal(savedOrder.orderedAt, null);
    assert.equal(savedOrder.items.length, 2);
    assert.equal(savedOrder.items[0].productId, productId);
    assert.equal(savedOrder.items[0].orderedQuantity, 10);
    assert.equal(Number(savedOrder.items[0].unitCost), 12.5);
    assert.equal(Number(savedOrder.items[1].unitCost), 1.005);
    assert.equal(procurementResult.summary.includes('126.01 EUR'), true);
    assert.equal(await prisma.merchantPurchaseOrder.count({
      where: {
        merchantId: merchantA,
        idempotencyKey: `modaui-procurement:${merchantA}:${procurementResponse.body.taskId}`
      }
    }), 1);

    const invalidProcurementResponse = await request(baseUrl, '/api/merchant/modagpt/task', {
      method: 'POST',
      token: ownerA,
      idempotencyKey: `trading-${suffix}-invalid`,
      body: {
        message: '请创建采购草稿',
        inputs: {
          create_procurement_draft: {
            ...procurementInput,
            items: [{ ...procurementInput.items[0], productId: `missing-${suffix}` }]
          }
        }
      }
    });
    assert.equal(invalidProcurementResponse.status, 202);
    taskIds.push(invalidProcurementResponse.body.taskId);
    const failedResult = await waitForTask(baseUrl, ownerA, invalidProcurementResponse.body.taskId, logs);
    assert.ok(['dead_letter', 'failed'].includes(failedResult.runtimeStatus));
    assert.ok(failedResult.errors.includes('MODAGPT_PRODUCT_UNAVAILABLE'));
    assert.equal(await prisma.merchantPurchaseOrder.count({ where: { merchantId: merchantA, status: 'draft' } }), 1);
    console.log('TRADING_WHOLESALE_HTTP_E2E', JSON.stringify({
      supplierAnalysis: {
        taskId: analysis.taskId,
        runtimeStatus: analysis.runtimeStatus,
        resultStatus: analysis.status,
        toolCalls: analysis.toolCalls.map((call: { toolId: string }) => call.toolId),
        summary: analysis.summary
      },
      procurement: {
        taskId: procurementResult.taskId,
        runtimeStatus: procurementResult.runtimeStatus,
        resultStatus: procurementResult.status,
        purchaseOrderId,
        persistedStatus: savedOrder.status,
        persistedTotal: 126.01,
        duplicateRequest: duplicateProcurementResponse.body.deduplicated
      },
      deniedEmployeeStatus: deniedEmployee.status,
      invalidInputStatus: failedResult.runtimeStatus,
      invalidInputError: failedResult.errors[0],
      crossTenantTaskReadStatus: 404
    }));
  } finally {
    if (server && server.exitCode === null && server.signalCode === null) {
      await new Promise<void>(resolve => {
        const timer = setTimeout(() => {
          server?.kill('SIGKILL');
          resolve();
        }, 15_000);
        server?.once('exit', () => {
          clearTimeout(timer);
          resolve();
        });
        server?.kill('SIGTERM');
      });
    }
    if (merchantIds.length) {
      await prisma.modaGptTask.deleteMany({ where: { id: { in: taskIds } } });
      await prisma.merchantPurchaseReceipt.deleteMany({ where: { merchantId: { in: merchantIds } } });
      await prisma.merchantPurchaseOrder.deleteMany({ where: { merchantId: { in: merchantIds } } });
      await prisma.product.deleteMany({ where: { merchantId: { in: merchantIds } } });
      await prisma.supplier.deleteMany({ where: { merchantId: { in: merchantIds } } });
      await prisma.merchant.deleteMany({ where: { id: { in: merchantIds } } });
    }
    await prisma.$disconnect();
  }
});

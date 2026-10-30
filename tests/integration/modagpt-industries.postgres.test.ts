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

if (process.env.NODE_ENV !== 'test') throw new Error('MODAGPT_INDUSTRIES_INTEGRATION_REQUIRES_NODE_ENV_TEST');

const databaseUrl = getIsolatedPostgresTestDatabaseUrl({
  nodeEnv: process.env.NODE_ENV,
  testDatabaseUrl: process.env.MODAGPT_INDUSTRIES_TEST_DATABASE_URL,
  applicationDatabaseUrl: process.env.RUDA_APPLICATION_DATABASE_URL,
  runId: process.env.MODAGPT_INDUSTRIES_TEST_RUN_ID,
  containerId: process.env.MODAGPT_INDUSTRIES_TEST_CONTAINER_ID
});
const merchantSecret = process.env.JWT_MERCHANT_SECRET;
if (!merchantSecret) throw new Error('MODAGPT_INDUSTRIES_INTEGRATION_JWT_SECRET_REQUIRED');

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
type HttpResult = { status: number; body: Record<string, any> };
type IndustryCase = {
  templateId: 'department_wholesale' | 'bags_wholesale' | 'department_chain_retail' | 'general_retail';
  industry: 'DEPARTMENT_STORE' | 'LEATHER_GOODS' | 'RETAIL_STORE';
  message: string;
  toolId: string;
};

async function getFreePort(): Promise<number> {
  const listener = net.createServer();
  await new Promise<void>((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolve);
  });
  const address = listener.address();
  if (!address || typeof address === 'string') throw new Error('MODAGPT_INDUSTRIES_TEST_PORT_UNAVAILABLE');
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
      throw new Error(`MODAGPT_INDUSTRIES_SERVER_EXITED:${child.exitCode}:${logs()}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health/ready`, { signal: AbortSignal.timeout(1_500) });
      if (response.ok) return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 400));
    }
  }
  throw new Error(`MODAGPT_INDUSTRIES_SERVER_START_TIMEOUT:${logs()}`);
}

async function waitForTask(
  baseUrl: string,
  token: string,
  taskId: string,
  logs: () => string
): Promise<Record<string, any>> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const response = await request(baseUrl, `/api/merchant/modagpt/task/${encodeURIComponent(taskId)}`, { token });
    if (response.status !== 200) {
      throw new Error(`MODAGPT_INDUSTRIES_TASK_POLL_FAILED:${response.status}:${JSON.stringify(response.body)}:${logs()}`);
    }
    if (['completed', 'failed', 'dead_letter', 'cancelled'].includes(response.body.runtimeStatus)) {
      return response.body;
    }
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error(`MODAGPT_INDUSTRIES_TASK_TIMEOUT:${taskId}:${logs()}`);
}

async function createMerchant(suffix: string, templateId: IndustryCase['templateId'], industry: IndustryCase['industry']) {
  const id = crypto.randomUUID();
  await prisma.merchant.create({
    data: {
      id,
      name: `ModaUI ${templateId} ${suffix}`,
      companyLegalName: `ModaUI ${templateId} ${suffix} Ltd`,
      code: `AI-${templateId}-${suffix}`,
      country: 'Italy',
      city: 'Prato',
      showroomAddress: 'Isolated test address',
      showroomArea: 'Test',
      showroomImage: '',
      logo: '',
      banner: '',
      tagline: 'Isolated ModaUI industry test',
      description: 'Test-only merchant fixture.',
      specialties: '[]',
      foundedYear: 2020,
      contactPerson: 'Integration Test',
      contactPhone: '+390000000000',
      contactEmail: `modaui-${templateId}-${suffix}@example.test`,
      storeSlug: `ai-${templateId}-${suffix}`,
      industry,
      industryTemplate: templateId
    }
  });
  await prisma.$transaction(tx => provisionModaGptIndustryTeam({
    tx,
    merchantId: id,
    industry,
    idempotencyKey: `modaui-industry:${suffix}:${templateId}`
  }));
  return id;
}

async function createProduct(merchantId: string, suffix: string, industryAttributes: string, barcode?: string) {
  const productId = `industry-product-${suffix}`;
  await prisma.product.create({
    data: {
      id: productId,
      merchantId,
      styleNo: `AI-${suffix}`,
      name: `Industry product ${suffix}`,
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
      fabric: '',
      composition: '',
      weight: '',
      packaging: '',
      washCare: '',
      description: 'Isolated ModaUI industry fixture.',
      skus: JSON.stringify([{ sku: `SKU-${suffix}`, color: '', size: '' }]),
      lifecycleStatus: 'published',
      industryAttributes,
      variants: {
        create: [{ id: `industry-variant-${suffix}`, sku: `SKU-${suffix}`, barcode: barcode || null }]
      }
    }
  });
  return productId;
}

async function waitForExit(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>(resolve => {
    child.once('exit', () => resolve());
    child.kill('SIGTERM');
    setTimeout(() => resolve(), 5_000).unref();
  });
}

test.after(async () => prisma.$disconnect());

test('four industry ModaUI tasks use isolated PostgreSQL data through authenticated HTTP', async () => {
  const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 18);
  const cases: IndustryCase[] = [
    {
      templateId: 'department_wholesale',
      industry: 'DEPARTMENT_STORE',
      message: '分析百货商品包装规格和单位',
      toolId: 'department_wholesale_catalog_analysis'
    },
    {
      templateId: 'bags_wholesale',
      industry: 'LEATHER_GOODS',
      message: '分析手袋材质尺寸资料',
      toolId: 'bags_wholesale_catalog_analysis'
    },
    {
      templateId: 'department_chain_retail',
      industry: 'DEPARTMENT_STORE',
      message: '分析门店销售和库存，给出调拨建议',
      toolId: 'department_chain_store_analysis'
    },
    {
      templateId: 'general_retail',
      industry: 'RETAIL_STORE',
      message: '分析 POS 销售和条码资料',
      toolId: 'general_retail_pos_analysis'
    }
  ];
  const merchantIds = new Map<string, string>();
  const serverLogs: string[] = [];
  const logs = () => serverLogs.join('').slice(-20_000);
  let server: ChildProcess | undefined;
  let chainTransferCount = 0;
  try {
    for (const scenario of cases) {
      const merchantId = await createMerchant(suffix, scenario.templateId, scenario.industry);
      merchantIds.set(scenario.templateId, merchantId);
      if (scenario.templateId === 'department_wholesale') {
        await createProduct(merchantId, `${suffix}-dept`, '{"spec":"500ml","unit":"bottle"}', '10000001');
      } else if (scenario.templateId === 'bags_wholesale') {
        await createProduct(merchantId, `${suffix}-bags`, '{"material":"leather","dimensions":"30x20x10cm","capacity":"5L"}', '10000002');
      } else if (scenario.templateId === 'department_chain_retail') {
        const productId = await createProduct(merchantId, `${suffix}-chain`, '{}', '10000003');
        const source = await prisma.merchantStore.create({
          data: { merchantId, code: `A-${suffix}`, name: `Chain A ${suffix}`, status: 'active' }
        });
        const target = await prisma.merchantStore.create({
          data: { merchantId, code: `B-${suffix}`, name: `Chain B ${suffix}`, status: 'active' }
        });
        await prisma.merchantStore.create({
          data: {
            merchantId: merchantIds.get('department_wholesale')!,
            code: `X-${suffix}`,
            name: `Other tenant store ${suffix}`,
            status: 'active'
          }
        });
        await prisma.merchantStoreStock.createMany({
          data: [
            { merchantId, storeId: source.id, productId, sku: `SKU-${suffix}-chain`, productName: 'Chain product', quantity: 100 },
            { merchantId, storeId: target.id, productId, sku: `SKU-${suffix}-chain`, productName: 'Chain product', quantity: 1 }
          ]
        });
        await prisma.merchantPosSale.create({
          data: {
            merchantId,
            storeId: target.id,
            saleNo: `POS-${suffix}-chain`,
            totalAmount: 100,
            currency: 'EUR',
            paymentMethod: 'cash',
            items: {
              create: [{
                productId,
                sku: `SKU-${suffix}-chain`,
                productName: 'Chain product',
                quantity: 10,
                unitPrice: 10,
                lineTotal: 100
              }]
            }
          }
        });
      } else {
        const productId = await createProduct(merchantId, `${suffix}-retail`, '{}', '10000004');
        const location = await prisma.warehouseLocation.create({
          data: {
            merchantId,
            code: `RETAIL-${suffix}`,
            name: `Retail stock ${suffix}`,
            type: 'warehouse'
          }
        });
        await prisma.inventoryBalance.create({
          data: {
            merchantId,
            variantId: `industry-variant-${suffix}-retail`,
            locationId: location.id,
            onHandQuantity: 1,
            reservedQuantity: 0,
            inTransitQuantity: 0
          }
        });
        await prisma.merchantPosSale.create({
          data: {
            merchantId,
            saleNo: `POS-${suffix}-retail`,
            totalAmount: 45,
            currency: 'EUR',
            paymentMethod: 'cash',
            items: {
              create: [{
                productId,
                sku: `SKU-${suffix}-retail`,
                productName: 'Retail product',
                quantity: 3,
                unitPrice: 15,
                lineTotal: 45
              }]
            }
          }
        });
      }
    }

    const restrictedMerchantId = merchantIds.get('department_wholesale')!;
    const restrictedEmployeeId = crypto.randomUUID();
    await prisma.merchantEmployee.create({
      data: {
        id: restrictedEmployeeId,
        merchantId: restrictedMerchantId,
        email: `modaui-restricted-${suffix}@example.test`,
        name: 'Restricted integration employee',
        passwordHash: 'not-used-by-this-api-test',
        role: 'sales',
        permissions: '[]'
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
        JWT_ADMIN_SECRET: process.env.JWT_ADMIN_SECRET || 'modaui-industries-test-admin-secret-0123456789abcdef',
        JWT_BUYER_SECRET: 'modaui-industries-test-buyer-secret-0123456789abcdef',
        SHARE_LINK_SECRET: 'modaui-industries-test-share-secret-0123456789abcdef',
        ADMIN_TOTP_ENCRYPTION_KEY: 'modaui-industries-test-totp-secret-0123456789abcdef',
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

    const ownerTokens = new Map<string, string>();
    for (const [templateId, merchantId] of merchantIds) ownerTokens.set(templateId, merchantToken(merchantId));
    const taskIds: string[] = [];
    for (const scenario of cases) {
      const token = ownerTokens.get(scenario.templateId)!;
      const preview = await request(baseUrl, '/api/merchant/modagpt/task/preview', {
        method: 'POST',
        token,
        body: { message: scenario.message }
      });
      assert.equal(preview.status, 200, JSON.stringify(preview.body));
      assert.equal(preview.body.workflow, 'business_analysis');
      assert.ok(preview.body.tools.includes(scenario.toolId));
      const otherSpecialists = cases.map(candidate => candidate.toolId).filter(toolId => toolId !== scenario.toolId);
      assert.ok(otherSpecialists.every(toolId => !preview.body.tools.includes(toolId)));

      const idempotencyKey = `industry-${scenario.templateId}-${suffix}`;
      const created = await request(baseUrl, '/api/merchant/modagpt/task', {
        method: 'POST',
        token,
        idempotencyKey,
        body: { message: scenario.message }
      });
      assert.equal(created.status, 202, JSON.stringify(created.body));
      taskIds.push(created.body.taskId);
      const duplicate = await request(baseUrl, '/api/merchant/modagpt/task', {
        method: 'POST',
        token,
        idempotencyKey,
        body: { message: scenario.message }
      });
      assert.equal(duplicate.status, 202, JSON.stringify(duplicate.body));
      assert.equal(duplicate.body.taskId, created.body.taskId);
      assert.equal(duplicate.body.deduplicated, true);

      const completed = await waitForTask(baseUrl, token, created.body.taskId, logs);
      assert.equal(completed.runtimeStatus, 'completed', JSON.stringify(completed));
      assert.ok(completed.toolCalls.some((call: { toolId: string }) => call.toolId === scenario.toolId));
      assert.match(completed.summary, /RUDA 实际数据|目录读取|门店|POS 销售/);
      if (scenario.templateId === 'general_retail') {
        assert.match(completed.summary, /生成 1 个补货候选：Retail product SKU-[^ ]+ 建议 1 件/);
        assert.equal(await prisma.inventoryMovement.count({ where: { merchantId: merchantIds.get('general_retail') } }), 0);
      }
    }

    const deniedPreview = await request(baseUrl, '/api/merchant/modagpt/task/preview', {
      method: 'POST',
      token: merchantToken(restrictedMerchantId, restrictedEmployeeId),
      body: { message: '分析百货商品包装规格和单位' }
    });
    assert.equal(deniedPreview.status, 403, JSON.stringify(deniedPreview.body));
    assert.equal(deniedPreview.body.error.code, 'MODAGPT_TASK_PERMISSION_REQUIRED');

    const chainTask = await request(
      baseUrl,
      `/api/merchant/modagpt/task/${encodeURIComponent(taskIds[2])}`,
      { token: ownerTokens.get('department_wholesale') }
    );
    assert.equal(chainTask.status, 404);
    chainTransferCount = await prisma.merchantStoreTransfer.count({
      where: { merchantId: merchantIds.get('department_chain_retail') }
    });
    assert.equal(chainTransferCount, 0);

    const auditRows = await prisma.employeeAuditLog.count({
      where: {
        merchantId: { in: [...merchantIds.values()] },
        action: 'MODAGPT_TOOL_SUCCEEDED'
      }
    });
    assert.ok(auditRows >= cases.length * 7, `expected core + specialist tool audit rows, got ${auditRows}`);
  } finally {
    if (server) await waitForExit(server);
  }
});

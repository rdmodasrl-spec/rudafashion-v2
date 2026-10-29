import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { fork, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

if (process.env.NODE_ENV !== 'test') {
  throw new Error('PRODUCTION_CHAIN_INTEGRATION_REQUIRES_NODE_ENV_TEST');
}

const databaseUrl = process.env.PRODUCTION_CHAIN_TEST_DATABASE_URL || '';
if (!databaseUrl) throw new Error('PRODUCTION_CHAIN_TEST_DATABASE_URL_REQUIRED');
const parsedDatabaseUrl = new URL(databaseUrl);
const databaseName = parsedDatabaseUrl.pathname.replace(/^\//, '');
if (!['127.0.0.1', 'localhost'].includes(parsedDatabaseUrl.hostname)
  || !/test|check/i.test(databaseName)
  || databaseUrl === process.env.DATABASE_URL) {
  throw new Error('PRODUCTION_CHAIN_TEST_DATABASE_NOT_ISOLATED');
}

const merchantSecret = process.env.JWT_MERCHANT_SECRET || 'production-chain-test-merchant-secret';
const adminSecret = process.env.JWT_ADMIN_SECRET || 'production-chain-test-admin-secret';
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const appId = 'ruda-production-chain';

type HttpResult = { status: number; body: Record<string, any> };

async function getFreePort(): Promise<number> {
  const listener = net.createServer();
  await new Promise<void>((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolve);
  });
  const address = listener.address();
  if (!address || typeof address === 'string') throw new Error('PRODUCTION_CHAIN_TEST_PORT_UNAVAILABLE');
  await new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
  return address.port;
}

async function request(baseUrl: string, route: string, options: {
  method?: string;
  token?: string;
  body?: unknown;
} = {}): Promise<HttpResult> {
  const response = await fetch(`${baseUrl}${route}`, {
    method: options.method || 'GET',
    headers: {
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' })
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(30_000)
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

function errorCode(body: Record<string, any>): string | undefined {
  return typeof body.error === 'string' ? body.error : body.error?.code;
}

function merchantToken(merchantId: string): string {
  return jwt.sign({ id: merchantId, merchantId, role: 'merchant' }, merchantSecret, { expiresIn: '30m' });
}

async function waitForReady(baseUrl: string, child: ChildProcess, logs: () => string): Promise<void> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`PRODUCTION_CHAIN_SERVER_EXITED:${child.exitCode}:${logs()}`);
    try {
      const response = await fetch(`${baseUrl}/api/health/ready`, { signal: AbortSignal.timeout(1_500) });
      if (response.ok) return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 400));
    }
  }
  throw new Error(`PRODUCTION_CHAIN_SERVER_START_TIMEOUT:${logs()}`);
}

async function createMerchant(suffix: string, label: string): Promise<string> {
  const id = crypto.randomUUID();
  await prisma.merchant.create({
    data: {
      id,
      name: `生产链测试 ${label} ${suffix}`,
      companyLegalName: `Production Chain ${label} ${suffix} Ltd`,
      code: `PRODCHAIN-${label}-${suffix}`,
      country: 'Italy',
      city: 'Milan',
      showroomAddress: 'Isolated test address',
      showroomArea: 'Test',
      showroomImage: '',
      logo: '',
      banner: '',
      tagline: 'Isolated production chain test',
      description: 'Test-only merchant fixture.',
      specialties: '[]',
      foundedYear: 2020,
      contactPerson: 'Integration Test',
      contactPhone: '+390000000000',
      contactEmail: `prodchain-${label}-${suffix}@example.test`,
      storeSlug: `prodchain-${label}-${suffix}`,
      industry: 'FASHION_COMPANY'
    }
  });
  return id;
}

async function createProductFixture(merchantId: string, suffix: string) {
  const productId = crypto.randomUUID();
  await prisma.product.create({
    data: {
      id: productId,
      styleNo: `PC-${suffix}`,
      name: 'Production chain test jacket',
      category: 'women',
      subCategory: 'outerwear',
      brand: 'Production Chain',
      season: '2026',
      images: JSON.stringify(['https://example.test/jacket.jpg']),
      wholesalePrice: 40,
      rrpPrice: 80,
      status: 'new',
      inventoryStatus: 'in_stock',
      origin: 'Italy',
      fabric: 'Wool',
      composition: '100% wool',
      weight: '0.8kg',
      packaging: 'Standard',
      washCare: 'Dry clean',
      description: 'Isolated production chain test product.',
      skus: '[]',
      merchantId
    }
  });
  const variants = await Promise.all([
    prisma.productVariant.create({ data: { productId, sku: `PC-${suffix}-IVORY-S`, color: '米白', size: 'S' } }),
    prisma.productVariant.create({ data: { productId, sku: `PC-${suffix}-IVORY-M`, color: '米白', size: 'M' } }),
    prisma.productVariant.create({ data: { productId, sku: `PC-${suffix}-BLACK-S`, color: '黑色', size: 'S' } }),
    prisma.productVariant.create({ data: { productId, sku: `PC-${suffix}-BLACK-M`, color: '黑色', size: 'M' } })
  ]);
  return { productId, variants };
}

test('production chain covers install gate, factory workspace, pickups, inspection, monthly statement and payments', async () => {
  const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
  const merchantId = await createMerchant(suffix, 'A');
  const otherMerchantId = await createMerchant(suffix, 'B');
  const fixtures = await createProductFixture(merchantId, suffix);
  const periodMonth = new Date().toISOString().slice(0, 7);

  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const serverLogs: string[] = [];
  const logs = () => serverLogs.join('').slice(-14_000);
  const server = fork(path.resolve('server.ts'), [], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      P0_HTTP_TEST_MODE: 'true',
      DATABASE_URL: databaseUrl,
      PORT: String(port),
      JWT_MERCHANT_SECRET: merchantSecret,
      JWT_ADMIN_SECRET: adminSecret,
      JWT_BUYER_SECRET: 'production-chain-test-buyer-secret-0123456789',
      SHARE_LINK_SECRET: 'production-chain-test-share-secret-0123456789',
      ADMIN_TOTP_ENCRYPTION_KEY: 'production-chain-test-totp-secret-0123456789',
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

  const owner = merchantToken(merchantId);
  const otherOwner = merchantToken(otherMerchantId);

  try {
    await waitForReady(baseUrl, server, logs);

    const beforeInstall = await request(baseUrl, '/api/production/summary', { token: owner });
    assert.equal(beforeInstall.status, 403);
    assert.equal(errorCode(beforeInstall.body), 'PRODUCTION_APP_NOT_INSTALLED');

    const install = await request(baseUrl, '/api/app-store/installations', {
      method: 'POST', token: owner, body: { appId }
    });
    assert.equal(install.status, 201);
    const enable = await request(baseUrl, `/api/app-store/installations/${appId}/enable`, {
      method: 'POST', token: owner, body: {}
    });
    assert.equal(enable.status, 200);

    const otherBeforeInstall = await request(baseUrl, '/api/production/summary', { token: otherOwner });
    assert.equal(otherBeforeInstall.status, 403);


    const factoryResponse = await request(baseUrl, '/api/production/factories', {
      method: 'POST',
      token: owner,
      body: { name: `加工厂 ${suffix}`, contactName: '工厂负责人', email: `factory-${suffix}@example.test`, settlementTerms: '月结 30 天' }
    });
    assert.equal(factoryResponse.status, 201, logs());
    const factoryId = factoryResponse.body.factory.id as string;
    const inviteToken = factoryResponse.body.inviteToken as string;
    assert.ok(inviteToken && inviteToken.length >= 40);

    const accept = await request(baseUrl, '/api/production/factory/accept-invite', {
      method: 'POST',
      body: { token: inviteToken, name: '工厂负责人', email: `owner-${suffix}@example.test`, password: 'factory-pass-2026' }
    });
    assert.equal(accept.status, 201, logs());
    const factoryToken = accept.body.token as string;
    assert.ok(factoryToken);

    const login = await request(baseUrl, '/api/production/factory/login', {
      method: 'POST', body: { email: `owner-${suffix}@example.test`, password: 'factory-pass-2026' }
    });
    assert.equal(login.status, 200);
    assert.ok(login.body.token);
    const loginToken = login.body.token as string;
    const loginSession = await request(baseUrl, '/api/production/factory/me', { token: loginToken });
    assert.equal(loginSession.status, 200);
    assert.ok(loginSession.body.factory.name);

    const wrongLogin = await request(baseUrl, '/api/production/factory/login', {
      method: 'POST', body: { email: `owner-${suffix}@example.test`, password: 'wrong-password' }
    });
    assert.equal(wrongLogin.status, 401);

    const quantities = [10, 11, 12, 13];
    const orderCreate = await request(baseUrl, '/api/production/orders', {
      method: 'POST',
      token: owner,
      body: {
        productId: fixtures.productId,
        factoryId,
        unitPrice: 2.5,
        pickupDate: '2026-10-20',
        dueDate: '2026-12-20',
        items: fixtures.variants.map((variant, index) => ({ variantId: variant.id, quantity: quantities[index] }))
      }
    });
    assert.equal(orderCreate.status, 201, logs());
    const orderId = orderCreate.body.order.id as string;
    assert.equal(orderCreate.body.order.plannedQuantity, 46);
    assert.equal(orderCreate.body.order.plannedAmount, 115);
    assert.equal(orderCreate.body.order.status, 'draft');

    const detailDraft = await request(baseUrl, `/api/production/orders/${orderId}`, { token: owner });
    assert.equal(detailDraft.status, 200);
    assert.equal(detailDraft.body.pickups.length, 0);
    assert.equal(detailDraft.body.deliveries.length, 0);
    const orderItems = detailDraft.body.order.items as { id: string; sku: string; plannedQuantity: number }[];
    assert.equal(orderItems.length, 4);

    const submit = await request(baseUrl, `/api/production/orders/${orderId}/submit`, {
      method: 'POST', token: owner, body: {}
    });
    assert.equal(submit.status, 200);
    assert.equal(submit.body.order.status, 'pending_factory');

    const factoryOrders = await request(baseUrl, '/api/production/factory/orders', { token: factoryToken });
    assert.equal(factoryOrders.status, 200);
    const factoryOrder = factoryOrders.body.orders.find((item: { id: string }) => item.id === orderId);
    assert.ok(factoryOrder);
    assert.equal(factoryOrder.status, 'pending_factory');

    const ownerOnFactoryRoute = await request(baseUrl, '/api/production/factory/orders', { token: owner });
    assert.equal(ownerOnFactoryRoute.status, 401);

    const acceptOrder = await request(baseUrl, `/api/production/factory/orders/${orderId}/accept`, {
      method: 'POST', token: factoryToken, body: {}
    });
    assert.equal(acceptOrder.status, 200);
    const afterAccept = await request(baseUrl, `/api/production/orders/${orderId}`, { token: owner });
    assert.equal(afterAccept.body.order.status, 'accepted');


    const pickup = await request(baseUrl, `/api/production/orders/${orderId}/pickups`, {
      method: 'POST', token: owner, body: { pickupDate: '2026-10-21', pieces: 50, packages: 3, note: '裁片已备好' }
    });
    assert.equal(pickup.status, 201, logs());
    const pickupId = pickup.body.pickup.id as string;
    assert.equal(pickup.body.pickup.status, 'pending');

    const pickupConfirm = await request(baseUrl, `/api/production/factory/pickups/${pickupId}/confirm`, {
      method: 'POST', token: factoryToken, body: { receivedPieces: 48 }
    });
    assert.equal(pickupConfirm.status, 200);
    assert.equal(pickupConfirm.body.pickup.receivedPieces, 48);
    assert.equal(pickupConfirm.body.pickup.difference, 2);

    const repeatPickupConfirm = await request(baseUrl, `/api/production/factory/pickups/${pickupId}/confirm`, {
      method: 'POST', token: factoryToken, body: { receivedPieces: 48 }
    });
    assert.equal(repeatPickupConfirm.status, 409);

    const start = await request(baseUrl, `/api/production/factory/orders/${orderId}/start`, {
      method: 'POST', token: factoryToken, body: {}
    });
    assert.equal(start.status, 200);

    const delivery = await request(baseUrl, `/api/production/factory/orders/${orderId}/deliveries`, {
      method: 'POST',
      token: factoryToken,
      body: { items: orderItems.map(item => ({ orderItemId: item.id, declaredQuantity: item.plannedQuantity })) }
    });
    assert.equal(delivery.status, 201, logs());
    const deliveryId = delivery.body.delivery.id as string;
    const deliveryItems = delivery.body.delivery.items as { id: string; orderItemId: string; declaredQuantity: number }[];
    assert.equal(deliveryItems.length, 4);

    const oversizedDelivery = await request(baseUrl, `/api/production/factory/orders/${orderId}/deliveries`, {
      method: 'POST',
      token: factoryToken,
      body: { items: [{ orderItemId: orderItems[0].id, declaredQuantity: 1 }] }
    });
    assert.equal(oversizedDelivery.status, 409);

    const inspectionLines = [
      { received: 13, accepted: 12, rejected: 1 },
      { received: 12, accepted: 12, rejected: 0 },
      { received: 11, accepted: 11, rejected: 0 },
      { received: 10, accepted: 9, rejected: 1 }
    ];
    const inspect = await request(baseUrl, `/api/production/orders/${orderId}/deliveries/${deliveryId}/inspect`, {
      method: 'POST',
      token: owner,
      body: {
        note: '抽检完成',
        items: deliveryItems.map((item, index) => {
          const line = inspectionLines[index];
          return {
            deliveryItemId: item.id,
            receivedQuantity: line.received,
            acceptedQuantity: line.accepted,
            rejectedQuantity: line.rejected,
            reworkQuantity: line.rejected
          };
        })
      }
    });
    assert.equal(inspect.status, 200, logs());
    assert.equal(inspect.body.order.acceptedQuantity, 44);
    assert.equal(inspect.body.order.rejectedQuantity, 2);
    assert.equal(inspect.body.order.reworkQuantity, 2);
    assert.equal(inspect.body.order.status, 'in_production');

    const reinspect = await request(baseUrl, `/api/production/orders/${orderId}/deliveries/${deliveryId}/inspect`, {
      method: 'POST', token: owner, body: { items: [] }
    });
    assert.equal(reinspect.status, 409);
    assert.equal(errorCode(reinspect.body), 'PRODUCTION_DELIVERY_ALREADY_INSPECTED');


    const message = await request(baseUrl, '/api/production/messages', {
      method: 'POST', token: owner, body: { scopeType: 'order', scopeId: orderId, body: '请确认返工 2 件' }
    });
    assert.equal(message.status, 201);
    const factoryMessages = await request(baseUrl, `/api/production/factory/messages?scopeType=order&scopeId=${orderId}`, { token: factoryToken });
    assert.equal(factoryMessages.status, 200);
    assert.equal(factoryMessages.body.messages.length, 1);

    const statement = await request(baseUrl, '/api/production/statements', {
      method: 'POST', token: owner, body: { factoryId, periodMonth, note: '首期对账' }
    });
    assert.equal(statement.status, 201, logs());
    const statementId = statement.body.statement.id as string;
    assert.equal(statement.body.statement.status, 'draft');
    assert.equal(statement.body.statement.laborAmount, 110);
    assert.equal(statement.body.statement.openingBalance, 0);
    assert.equal(statement.body.statement.totalAmount, 110);
    assert.equal(statement.body.statement.closingBalance, 110);
    assert.equal(statement.body.statement.lines.length, 1);
    assert.equal(statement.body.statement.lines[0].quantity, 44);

    const adjustment = await request(baseUrl, `/api/production/statements/${statementId}/adjustments`, {
      method: 'POST', token: owner, body: { amount: -10, reason: '线头返工扣减' }
    });
    assert.equal(adjustment.status, 201);
    assert.equal(adjustment.body.statement.totalAmount, 100);
    assert.equal(adjustment.body.statement.closingBalance, 100);

    const submitStatement = await request(baseUrl, `/api/production/statements/${statementId}/submit`, {
      method: 'POST', token: owner, body: {}
    });
    assert.equal(submitStatement.status, 200);
    assert.equal(submitStatement.body.statement.status, 'pending_factory');

    const factoryStatements = await request(baseUrl, '/api/production/factory/statements', { token: factoryToken });
    assert.equal(factoryStatements.status, 200);
    assert.ok(factoryStatements.body.statements.some((item: { id: string }) => item.id === statementId));

    const dispute = await request(baseUrl, `/api/production/factory/statements/${statementId}/dispute`, {
      method: 'POST', token: factoryToken, body: { reason: '扣减金额需复核' }
    });
    assert.equal(dispute.status, 200);
    const afterDispute = await request(baseUrl, `/api/production/statements/${statementId}`, { token: owner });
    assert.equal(afterDispute.body.statement.status, 'disputed');
    assert.equal(afterDispute.body.statement.disputeReason, '扣减金额需复核');

    const resubmit = await request(baseUrl, `/api/production/statements/${statementId}/submit`, {
      method: 'POST', token: owner, body: {}
    });
    assert.equal(resubmit.status, 200);

    const factoryConfirm = await request(baseUrl, `/api/production/factory/statements/${statementId}/confirm`, {
      method: 'POST', token: factoryToken, body: {}
    });
    assert.equal(factoryConfirm.status, 200);
    assert.equal(factoryConfirm.body.statement.status, 'confirmed');
    assert.ok(factoryConfirm.body.statement.confirmedAt);

    const regenerate = await request(baseUrl, '/api/production/statements', {
      method: 'POST', token: owner, body: { factoryId, periodMonth }
    });
    assert.equal(regenerate.status, 409);
    assert.equal(errorCode(regenerate.body), 'PRODUCTION_STATEMENT_CONFIRMED');

    const payment = await request(baseUrl, '/api/production/payments', {
      method: 'POST',
      token: owner,
      body: {
        factoryId, statementId, amount: 40, method: 'bank_transfer', reference: `PAY-${suffix}`,
        idempotencyKey: `pay-${suffix}-0001`
      }
    });
    assert.equal(payment.status, 201, logs());
    const afterPayment = await request(baseUrl, `/api/production/statements/${statementId}`, { token: owner });
    assert.equal(afterPayment.body.statement.paidAmount, 40);
    assert.equal(afterPayment.body.statement.closingBalance, 60);

    const replayPayment = await request(baseUrl, '/api/production/payments', {
      method: 'POST',
      token: owner,
      body: {
        factoryId, statementId, amount: 40, method: 'bank_transfer', reference: `PAY-${suffix}`,
        idempotencyKey: `pay-${suffix}-0001`
      }
    });
    assert.equal(replayPayment.status, 200);
    assert.equal(replayPayment.body.idempotent, true);

    const overPayment = await request(baseUrl, '/api/production/payments', {
      method: 'POST',
      token: owner,
      body: { factoryId, statementId, amount: 100, idempotencyKey: `pay-${suffix}-0002` }
    });
    assert.equal(overPayment.status, 409);
    assert.equal(errorCode(overPayment.body), 'PRODUCTION_PAYMENT_EXCEEDS_OUTSTANDING');


    const secondFactory = await request(baseUrl, '/api/production/factories', {
      method: 'POST', token: owner, body: { name: `第二加工厂 ${suffix}` }
    });
    assert.equal(secondFactory.status, 201);
    const secondAccept = await request(baseUrl, '/api/production/factory/accept-invite', {
      method: 'POST',
      body: {
        token: secondFactory.body.inviteToken,
        name: '第二工厂负责人',
        email: `second-${suffix}@example.test`,
        password: 'factory-pass-2026'
      }
    });
    assert.equal(secondAccept.status, 201);
    const secondFactoryToken = secondAccept.body.token as string;

    const crossFactoryOrder = await request(baseUrl, `/api/production/factory/orders/${orderId}`, { token: secondFactoryToken });
    assert.equal(crossFactoryOrder.status, 404);
    const crossFactoryStatement = await request(baseUrl, `/api/production/factory/statements/${statementId}`, { token: secondFactoryToken });
    assert.equal(crossFactoryStatement.status, 404);

    const crossTenantOrder = await request(baseUrl, `/api/production/orders/${orderId}`, { token: otherOwner });
    assert.equal(crossTenantOrder.status, 403);
    const crossTenantStatement = await request(baseUrl, `/api/production/statements/${statementId}`, { token: otherOwner });
    assert.equal(crossTenantStatement.status, 403);

    const summary = await request(baseUrl, '/api/production/summary', { token: owner });
    assert.equal(summary.status, 200);
    assert.equal(summary.body.summary.openOrders, 1);
    assert.equal(summary.body.summary.outstanding, 60);

    const disable = await request(baseUrl, `/api/app-store/installations/${appId}/disable`, {
      method: 'POST', token: owner, body: {}
    });
    assert.equal(disable.status, 200);
    const afterDisable = await request(baseUrl, '/api/production/summary', { token: owner });
    assert.equal(afterDisable.status, 403);
    assert.equal(errorCode(afterDisable.body), 'PRODUCTION_APP_NOT_INSTALLED');

    const factoryAfterDisable = await request(baseUrl, '/api/production/factory/orders', { token: factoryToken });
    assert.equal(factoryAfterDisable.status, 403);
    assert.equal(errorCode(factoryAfterDisable.body), 'PRODUCTION_FACTORY_ACCESS_REVOKED');

    const persistedOrder = await prisma.productionOrder.findFirst({ where: { id: orderId } });
    assert.ok(persistedOrder, 'disabling the app keeps production history');
    const persistedItems = await prisma.productionOrderItem.findMany({ where: { orderId } });
    assert.equal(persistedItems.reduce((sum, item) => sum + item.acceptedQuantity, 0), 44);
  } finally {
    server.kill('SIGTERM');
    await prisma.productionMessage.deleteMany({ where: { merchantId } }).catch(() => undefined);
    await prisma.productionPayment.deleteMany({ where: { merchantId } }).catch(() => undefined);
    await prisma.productionStatementAdjustment.deleteMany({ where: { statement: { merchantId } } }).catch(() => undefined);
    await prisma.productionStatementLine.deleteMany({ where: { statement: { merchantId } } }).catch(() => undefined);
    await prisma.productionDeliveryItem.deleteMany({ where: { delivery: { merchantId } } }).catch(() => undefined);
    await prisma.productionQualityInspection.deleteMany({ where: { delivery: { merchantId } } }).catch(() => undefined);
    await prisma.productionStatement.deleteMany({ where: { merchantId } }).catch(() => undefined);
    await prisma.productionDelivery.deleteMany({ where: { merchantId } }).catch(() => undefined);
    await prisma.productionPickup.deleteMany({ where: { merchantId } }).catch(() => undefined);
    await prisma.productionOrderEvent.deleteMany({ where: { merchantId } }).catch(() => undefined);
    await prisma.productionOrder.deleteMany({ where: { merchantId } }).catch(() => undefined);
    await prisma.productionFactoryMember.deleteMany({ where: { factory: { merchantId } } }).catch(() => undefined);
    await prisma.productionFactory.deleteMany({ where: { merchantId } }).catch(() => undefined);
    await prisma.appInstallation.deleteMany({ where: { merchantId } }).catch(() => undefined);
    await prisma.productVariant.deleteMany({ where: { productId: fixtures.productId } }).catch(() => undefined);
    await prisma.product.deleteMany({ where: { id: fixtures.productId } }).catch(() => undefined);
    await prisma.merchant.deleteMany({ where: { id: { in: [merchantId, otherMerchantId] } } }).catch(() => undefined);
    await prisma.$disconnect();
  }
});


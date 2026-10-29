import 'dotenv/config';
import assert from 'node:assert/strict';
import { fork, type ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const databaseUrl = process.env.ORDER_CHAT_TEST_DATABASE_URL;
if (process.env.NODE_ENV !== 'test') throw new Error('ORDER_CHAT_POSTGRES_INTEGRATION_REQUIRES_NODE_ENV_TEST');
if (!databaseUrl) throw new Error('ORDER_CHAT_TEST_DATABASE_URL_REQUIRED');

const parsedTestUrl = new URL(databaseUrl);
const databaseName = decodeURIComponent(parsedTestUrl.pathname.replace(/^\//, '').split('/')[0] || '');
if (!/(^|[-_])(test|e2e)([-_]|$)/i.test(databaseName)) {
  throw new Error('ORDER_CHAT_TEST_DATABASE_NAME_MUST_INCLUDE_TEST_OR_E2E');
}
if (process.env.DATABASE_URL) {
  const configuredUrl = new URL(process.env.DATABASE_URL);
  if (configuredUrl.host === parsedTestUrl.host && configuredUrl.pathname === parsedTestUrl.pathname) {
    throw new Error('ORDER_CHAT_TEST_DATABASE_MUST_NOT_MATCH_APPLICATION_DATABASE');
  }
}
if (!['localhost', '127.0.0.1', '::1'].includes(parsedTestUrl.hostname)) {
  throw new Error('REMOTE_ORDER_CHAT_TEST_DATABASE_REQUIRES_EXPLICIT_OPT_IN');
}

const buyerSecret = 'order-chat-test-buyer-secret-0123456789abcdef';
const merchantSecret = 'order-chat-test-merchant-secret-0123456789abcdef';
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

type HttpResult = { status: number; body: Record<string, any> };

async function getFreePort(): Promise<number> {
  const listener = net.createServer();
  await new Promise<void>((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolve);
  });
  const address = listener.address();
  if (!address || typeof address === 'string') throw new Error('ORDER_CHAT_TEST_PORT_UNAVAILABLE');
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
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
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

async function waitForReady(baseUrl: string, child: ChildProcess, logs: () => string): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`ORDER_CHAT_SERVER_EXITED:${child.exitCode}:${logs()}`);
    try {
      const response = await fetch(`${baseUrl}/api/health/ready`, { signal: AbortSignal.timeout(1_500) });
      if (response.ok) return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 400));
    }
  }
  throw new Error(`ORDER_CHAT_SERVER_START_TIMEOUT:${logs()}`);
}

function stopServer(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
    }, 10_000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill('SIGTERM');
  });
}

function merchantToken(merchantId: string): string {
  return jwt.sign({ id: merchantId, role: 'merchant', merchantId }, merchantSecret, { expiresIn: '10m' });
}

function buyerToken(customerId: string): string {
  return jwt.sign({ id: customerId, role: 'buyer', customerId }, buyerSecret, { expiresIn: '10m' });
}

async function createMerchant(suffix: string, label: string): Promise<string> {
  const id = crypto.randomUUID();
  await prisma.merchant.create({
    data: {
      id,
      name: `Order Chat ${label} ${suffix}`,
      companyLegalName: `Order Chat ${label} ${suffix} Ltd`,
      code: `ORDER-CHAT-${label}-${suffix}`,
      country: 'Italy',
      city: 'Milan',
      showroomAddress: 'Isolated test address',
      showroomArea: 'Test',
      showroomImage: '',
      logo: '',
      banner: '',
      tagline: 'Isolated order chat test',
      description: 'Test-only merchant fixture.',
      specialties: '[]',
      foundedYear: 2020,
      contactPerson: 'Integration Test',
      contactPhone: '+390000000000',
      contactEmail: `order-chat-${label}-${suffix}@example.test`,
      storeSlug: `order-chat-${label}-${suffix}`,
      industry: 'FASHION_COMPANY'
    }
  });
  return id;
}

async function createCustomer(suffix: string, label: string): Promise<string> {
  const id = crypto.randomUUID();
  await prisma.customer.create({
    data: {
      id,
      companyName: `Order Chat ${label} ${suffix}`,
      vatNumber: `ORDER-CHAT-${label}-${suffix}`,
      address: 'Isolated test address',
      city: 'Milan',
      country: 'Italy',
      contactPerson: 'Integration Test',
      phone: '+390000000000',
      email: `order-chat-buyer-${label}-${suffix}@example.test`,
      registrationDate: new Date().toISOString()
    }
  });
  return id;
}

async function createOrder(input: { customerId: string; merchantId: string; suffix: string }): Promise<string> {
  const id = crypto.randomUUID();
  await prisma.order.create({
    data: {
      id,
      orderNo: `OC-${input.suffix}-${crypto.randomUUID().slice(0, 8)}`,
      date: new Date().toISOString(),
      customerId: input.customerId,
      companyName: 'Order Chat Integration',
      totalQty: 12,
      totalAmount: 840,
      status: 'shipped',
      deliveryType: 'shipping',
      paymentMethod: 'card',
      paymentStatus: 'partially_paid',
      timeline: '[]',
      shippingStreet: 'Isolated test address',
      shippingCity: 'Milan',
      shippingCountry: 'Italy',
      shippingZip: '20100',
      merchantId: input.merchantId,
      merchantName: 'Order Chat Integration'
    }
  });
  await prisma.orderItem.create({
    data: {
      id: crypto.randomUUID(),
      orderId: id,
      productId: crypto.randomUUID(),
      styleNo: 'OC-BLAZER',
      productName: 'Test blazer',
      image: '',
      sku: `OC-SKU-${input.suffix}`,
      color: 'Black',
      size: 'M',
      quantity: 12,
      unitPrice: 70,
      merchantId: input.merchantId,
      merchantName: 'Order Chat Integration'
    }
  });
  return id;
}

async function waitForNotification(recipient: string): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const notification = await prisma.notificationEvent.findFirst({
      where: { eventType: 'order.message.needs_merchant', recipient, channel: 'in_app' }
    });
    if (notification) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('ORDER_CHAT_ESCALATION_NOTIFICATION_NOT_PERSISTED');
}

test('order chat API persists, answers, escalates, isolates tenants, and handles idempotent retries', async () => {
  const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
  const customerId = await createCustomer(suffix, 'A');
  const otherCustomerId = await createCustomer(suffix, 'B');
  const merchantId = await createMerchant(suffix, 'A');
  const otherMerchantId = await createMerchant(suffix, 'B');
  const orderId = await createOrder({ customerId, merchantId, suffix });
  const otherOrderId = await createOrder({ customerId: otherCustomerId, merchantId: otherMerchantId, suffix });
  await prisma.orderItem.create({
    data: {
      id: crypto.randomUUID(),
      orderId,
      productId: crypto.randomUUID(),
      styleNo: 'OC-OTHER-MERCHANT',
      productName: 'Other merchant item',
      image: '',
      sku: `OC-OTHER-SKU-${suffix}`,
      color: 'White',
      size: 'S',
      quantity: 1,
      unitPrice: 10,
      merchantId: otherMerchantId,
      merchantName: 'Other merchant'
    }
  });
  const paymentId = crypto.randomUUID();
  const shipmentId = crypto.randomUUID();
  const trackingId = crypto.randomUUID();
  await prisma.paymentTransaction.create({
    data: { id: paymentId, orderId, provider: 'integration_test', amount: 300, currency: 'EUR', status: 'paid' }
  });
  await prisma.fulfillmentShipment.create({
    data: {
      id: shipmentId,
      orderId,
      shipmentNo: `OC-${suffix}`,
      carrier: 'Test carrier',
      trackingNumber: `TRACK-${suffix}`,
      status: 'in_transit',
      shippedAt: new Date()
    }
  });
  await prisma.shipmentTrackingEvent.create({
    data: {
      id: trackingId,
      shipmentId,
      status: '运输中',
      location: '米兰',
      description: '已到达分拨中心',
      occurredAt: new Date('2026-10-24T12:30:00.000Z')
    }
  });

  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const serverLogs: string[] = [];
  const logs = () => serverLogs.join('').slice(-12_000);
  const server = fork(path.resolve('server.ts'), [], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      P0_HTTP_TEST_MODE: 'true',
      DATABASE_URL: databaseUrl,
      PORT: String(port),
      JWT_BUYER_SECRET: buyerSecret,
      JWT_MERCHANT_SECRET: merchantSecret,
      JWT_ADMIN_SECRET: 'order-chat-test-admin-secret-0123456789abcdef',
      SHARE_LINK_SECRET: 'order-chat-test-share-secret-0123456789abcdef',
      ADMIN_TOTP_ENCRYPTION_KEY: 'order-chat-test-totp-secret-0123456789abcdef',
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

  try {
    await waitForReady(baseUrl, server, logs);
    const buyer = buyerToken(customerId);
    const merchant = merchantToken(merchantId);
    const otherBuyer = buyerToken(otherCustomerId);
    const otherMerchant = merchantToken(otherMerchantId);
    const messageId = crypto.randomUUID();
    const factual = await request(baseUrl, `/api/orders/${orderId}/messages`, {
      method: 'POST',
      token: buyer,
      body: { content: '订单现在到哪一步了？', clientMessageId: messageId }
    });
    assert.equal(factual.status, 201);
    assert.equal(factual.body.message.source, 'human');
    assert.equal(factual.body.automaticReply.source, 'automatic');
    assert.equal(factual.body.automaticReply.senderRole, 'system');
    assert.match(factual.body.automaticReply.content, /运输中/);

    const retry = await request(baseUrl, `/api/orders/${orderId}/messages`, {
      method: 'POST',
      token: buyer,
      body: { content: '订单现在到哪一步了？', clientMessageId: messageId }
    });
    assert.equal(retry.status, 201);
    assert.equal(retry.body.message.id, factual.body.message.id);
    assert.equal(retry.body.automaticReply.id, factual.body.automaticReply.id);

    const paymentQuestion = await request(baseUrl, `/api/orders/${orderId}/messages`, {
      method: 'POST',
      token: buyer,
      body: { content: '付款确认了吗？', clientMessageId: crypto.randomUUID() }
    });
    assert.match(paymentQuestion.body.automaticReply.content, /净收款 €300\.00/);
    const trackingQuestion = await request(baseUrl, `/api/orders/${orderId}/messages`, {
      method: 'POST',
      token: buyer,
      body: { content: '包裹到哪里了？', clientMessageId: crypto.randomUUID() }
    });
    assert.match(trackingQuestion.body.automaticReply.content, /米兰/);

    const bargain = await request(baseUrl, `/api/orders/${orderId}/messages`, {
      method: 'POST',
      token: buyer,
      body: { content: '能不能便宜一点？', clientMessageId: crypto.randomUUID() }
    });
    assert.equal(bargain.status, 201);
    assert.equal(bargain.body.message.requiresMerchantReply, true);
    assert.equal(bargain.body.automaticReply, undefined);

    await waitForNotification(`order-chat-A-${suffix}@example.test`);
    assert.equal(await prisma.notificationEvent.count({
      where: {
        eventType: 'order.message.needs_merchant',
        recipient: `order-chat-B-${suffix}@example.test`
      }
    }), 0);

    const merchantMessages = await request(baseUrl, `/api/merchant/orders/${orderId}/messages`, { token: merchant });
    assert.equal(merchantMessages.status, 200);
    assert.equal(merchantMessages.body.messages.length, 7);
    assert.equal(merchantMessages.body.messages.find((message: { id: string }) => message.id === bargain.body.message.id).requiresMerchantReply, true);

    const otherTenantRead = await request(baseUrl, `/api/merchant/orders/${orderId}/messages`, { token: otherMerchant });
    assert.equal(otherTenantRead.status, 404);
    const otherBuyerRead = await request(baseUrl, `/api/orders/${orderId}/messages`, { token: otherBuyer });
    assert.equal(otherBuyerRead.status, 404);
    const separateOrderRead = await request(baseUrl, `/api/orders/${otherOrderId}/messages`, { token: otherBuyer });
    assert.equal(separateOrderRead.body.messages.length, 0);

    const merchantUnread = await request(baseUrl, '/api/merchant/orders', { token: merchant });
    const merchantOrder = merchantUnread.body.orders.find((candidate: { id: string }) => candidate.id === orderId);
    assert.equal(merchantOrder.unreadMessageCount, 4);
    assert.equal(merchantOrder.pendingMerchantReplyCount, 1);

    const markedRead = await request(baseUrl, `/api/merchant/orders/${orderId}/messages/read`, {
      method: 'POST',
      token: merchant,
      body: {}
    });
    assert.equal(markedRead.status, 200);
    const clearedMerchantUnread = await request(baseUrl, '/api/merchant/orders', { token: merchant });
    assert.equal(clearedMerchantUnread.body.orders.find((candidate: { id: string }) => candidate.id === orderId).unreadMessageCount, 0);
    const merchantReply = await request(baseUrl, `/api/merchant/orders/${orderId}/messages`, {
      method: 'POST',
      token: merchant,
      body: { content: '我来为您核对报价。', clientMessageId: crypto.randomUUID() }
    });
    assert.equal(merchantReply.status, 201);
    assert.equal(merchantReply.body.message.source, 'human');
    const clearedEscalation = await request(baseUrl, '/api/merchant/orders', { token: merchant });
    assert.equal(clearedEscalation.body.orders.find((candidate: { id: string }) => candidate.id === orderId).pendingMerchantReplyCount, 0);

    const persistedAfterRefresh = await request(baseUrl, `/api/orders/${orderId}/messages`, { token: buyer });
    assert.equal(persistedAfterRefresh.status, 200);
    assert.equal(persistedAfterRefresh.body.messages.length, 8);
    const escalation = persistedAfterRefresh.body.messages.find((message: { id: string }) => message.id === bargain.body.message.id);
    assert.ok(escalation.merchantRepliedAt);
    const buyerOrderList = await request(baseUrl, '/api/orders', { token: buyer });
    assert.equal(buyerOrderList.body.orders.find((candidate: { id: string }) => candidate.id === orderId).unreadMessageCount, 1);
    const buyerMarkedRead = await request(baseUrl, `/api/orders/${orderId}/messages/read`, { method: 'POST', token: buyer, body: {} });
    assert.equal(buyerMarkedRead.status, 200);
    const clearedBuyerUnread = await request(baseUrl, '/api/orders', { token: buyer });
    assert.equal(clearedBuyerUnread.body.orders.find((candidate: { id: string }) => candidate.id === orderId).unreadMessageCount, 0);
  } finally {
    await stopServer(server);
    await prisma.notificationEvent.deleteMany({ where: { recipient: { contains: suffix } } });
    await prisma.order.deleteMany({ where: { id: { in: [orderId, otherOrderId] } } });
    await prisma.customer.deleteMany({ where: { id: { in: [customerId, otherCustomerId] } } });
    await prisma.merchant.deleteMany({ where: { id: { in: [merchantId, otherMerchantId] } } });
  }
});

test.after(async () => {
  await prisma.$disconnect();
});

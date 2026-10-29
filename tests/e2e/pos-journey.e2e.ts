import 'dotenv/config';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { request, type APIRequestContext } from 'playwright';
import { getIsolatedE2ETestDatabaseUrl } from '../../scripts/e2eTestDatabaseSafety';

const baseURL = process.env.E2E_BASE_URL;
const merchantId = process.env.E2E_MERCHANT_ID || 'e2e_merchant';
const employeeEmail = process.env.E2E_MERCHANT_EMAIL;
const employeePassword = process.env.E2E_MERCHANT_PASSWORD;
const productId = process.env.E2E_PRODUCT_ID || 'e2e_product';
getIsolatedE2ETestDatabaseUrl({
  nodeEnv: process.env.NODE_ENV,
  testDatabaseUrl: process.env.E2E_TEST_DATABASE_URL,
  applicationDatabaseUrl: process.env.DATABASE_URL,
  allowRemoteDatabase: process.env.E2E_ALLOW_REMOTE_DATABASE
});
let api: APIRequestContext;
let shiftId = '';

before(async () => {
  if (!baseURL || !employeeEmail || !employeePassword) {
    throw new Error('E2E_BASE_URL_AND_TEST_EMPLOYEE_CREDENTIALS_REQUIRED');
  }
  const target = new URL(baseURL);
  if (!['http:', 'https:'].includes(target.protocol)) throw new Error('E2E_TARGET_MUST_USE_HTTP_OR_HTTPS');
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(target.hostname) && process.env.E2E_ALLOW_REMOTE_TARGET !== 'true') {
    throw new Error('E2E_REMOTE_TARGET_REQUIRES_E2E_ALLOW_REMOTE_TARGET');
  }
  api = await request.newContext({ baseURL, extraHTTPHeaders: { Accept: 'application/json' } });
  const login = await api.post('/api/auth/login/employee', {
    data: { email: employeeEmail, password: employeePassword, merchantId }
  });
  assert.equal(login.status(), 200, 'test employee login should succeed');
  assert.equal((await login.json()).success, true);
});

after(async () => {
  if (shiftId) {
    const current = await api.get('/api/merchant/pos/shifts/current');
    if (current.ok()) {
      const payload = await current.json();
      if (payload.shift?.id === shiftId && payload.shift.status === 'open') {
        await api.post(`/api/merchant/pos/shifts/${encodeURIComponent(shiftId)}/close`, {
          data: { closingCash: Number(payload.shift.expectedCash), note: 'E2E cleanup' }
        });
      }
    }
  }
  await api?.dispose();
});

test('POS shift, sale idempotency, and audit trail complete end to end', async () => {
  const readiness = await api.get('/api/health/ready');
  assert.equal(readiness.status(), 200, 'application and database should be ready');

  const opened = await api.post('/api/merchant/pos/shifts', {
    data: { openingCash: '100.00', note: 'E2E test shift' }
  });
  assert.equal(opened.status(), 201);
  const openedPayload = await opened.json();
  shiftId = openedPayload.shift.id;

  const idempotencyKey = `e2e-pos-${crypto.randomUUID()}`;
  const sale = {
    source: 'pos',
    paymentMethod: 'cash',
    paymentConfirmed: true,
    posShiftId: shiftId,
    items: [{ productId, sku: 'E2E-SKU-1', quantity: 1 }],
    idempotencyKey
  };
  const created = await api.post('/api/merchant/employee-orders', { data: sale });
  assert.equal(created.status(), 201);
  const firstResult = await created.json();
  assert.match(firstResult.order.orderNo, /^POS-/);

  const replay = await api.post('/api/merchant/employee-orders', { data: sale });
  assert.equal(replay.status(), 200);
  assert.equal((await replay.json()).idempotentReplay, true);

  const conflict = await api.post('/api/merchant/employee-orders', {
    data: { ...sale, items: [{ productId, sku: 'E2E-SKU-1', quantity: 2 }] }
  });
  assert.equal(conflict.status(), 409);
  assert.equal((await conflict.json()).error, 'IDEMPOTENCY_KEY_CONFLICT');

  const activity = await api.get('/api/merchant/pos/activity');
  assert.equal(activity.status(), 200);
  const activities = (await activity.json()).activities as Array<{ action: string; entityId: string }>;
  assert.ok(activities.some(item => item.action === 'POS_ORDER_CREATED' && item.entityId === firstResult.orderId));

  const current = await api.get('/api/merchant/pos/shifts/current');
  assert.equal(current.status(), 200);
  const currentShift = (await current.json()).shift;
  assert.equal(currentShift.id, shiftId);
  assert.equal(currentShift.cashSales, firstResult.order.totalAmount);

  const returnRequest = {
    orderId: firstResult.orderId,
    reason: 'E2E full return',
    refundConfirmed: true,
    idempotencyKey: `e2e-return-${crypto.randomUUID()}`,
    items: [{ productId, sku: 'E2E-SKU-1', quantity: 1 }]
  };
  const returned = await api.post('/api/merchant/pos/returns', { data: returnRequest });
  assert.equal(returned.status(), 200);
  const refund = await returned.json();
  assert.equal(refund.success, true);
  assert.equal(refund.refundAmount, firstResult.order.totalAmount);

  const refundReplay = await api.post('/api/merchant/pos/returns', { data: returnRequest });
  assert.equal(refundReplay.status(), 200);
  assert.equal((await refundReplay.json()).idempotentReplay, true);

  const afterRefund = await api.get('/api/merchant/pos/shifts/current');
  assert.equal(afterRefund.status(), 200);
  const refundedShift = (await afterRefund.json()).shift;
  assert.equal(refundedShift.cashRefunds, firstResult.order.totalAmount);
  assert.equal(refundedShift.expectedCash, refundedShift.openingCash);

  const closed = await api.post(`/api/merchant/pos/shifts/${encodeURIComponent(shiftId)}/close`, {
    data: { closingCash: refundedShift.expectedCash, note: 'E2E close after cash refund' }
  });
  assert.equal(closed.status(), 200);
  assert.equal((await closed.json()).shift.status, 'closed');
});

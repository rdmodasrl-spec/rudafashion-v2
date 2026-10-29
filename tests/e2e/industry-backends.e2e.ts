/**
 * 七种行业后台端到端回归（必须在隔离测试库上执行）。
 *
 * 覆盖：商家登录 → 资料读取 → 员工/门店列表 → 行业模块 403/200 矩阵 →
 * 收银开班 → 销售幂等 → 退货退款 → 交班。
 *
 * 运行前提（缺一不可）：
 *   NODE_ENV=test
 *   E2E_TEST_DATABASE_URL=postgresql://…/ruda_e2e（库名必须包含 test/e2e）
 *   E2E_BASE_URL=http://127.0.0.1:PORT
 *   测试库已执行 `INDUSTRY_DEMO_SEED_CONFIRM=CREATE_RUDA_INDUSTRY_DEMO_MERCHANTS npx tsx scripts/seed-industry-demo-merchants.ts`
 *
 * 不使用生产库：`getIsolatedE2ETestDatabaseUrl` 会在库名或主机不满足隔离条件时直接失败。
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { after, before, test } from 'node:test';
import jwt from 'jsonwebtoken';
import { request, type APIRequestContext } from 'playwright';
import { getIsolatedE2ETestDatabaseUrl } from '../../scripts/e2eTestDatabaseSafety';
import { getMerchantIndustryCapability } from '../../src/constants/merchantIndustryCapabilities';
import type { MerchantIndustryTemplateId } from '../../src/constants/merchantIndustryTemplates';

const baseURL = process.env.E2E_BASE_URL;
const password = process.env.E2E_INDUSTRY_DEMO_PASSWORD;
const buyerSecret = process.env.JWT_BUYER_SECRET;

const industries: Array<{ templateId: MerchantIndustryTemplateId; email: string; key: string }> = [
  { templateId: 'apparel_production_wholesale', email: '001@ruda.fashion', key: 'apparel-production' },
  { templateId: 'apparel_wholesale', email: '002@ruda.fashion', key: 'apparel-wholesale' },
  { templateId: 'trading_wholesale', email: '003@ruda.fashion', key: 'trading-wholesale' },
  { templateId: 'department_wholesale', email: '004@ruda.fashion', key: 'department-wholesale' },
  { templateId: 'bags_wholesale', email: '005@ruda.fashion', key: 'bags-wholesale' },
  { templateId: 'department_chain_retail', email: '006@ruda.fashion', key: 'department-chain-retail' },
  { templateId: 'general_retail', email: '007@ruda.fashion', key: 'general-retail' }
];

const contexts: APIRequestContext[] = [];

before(() => {
  getIsolatedE2ETestDatabaseUrl({
    nodeEnv: process.env.NODE_ENV,
    testDatabaseUrl: process.env.E2E_TEST_DATABASE_URL,
    applicationDatabaseUrl: process.env.DATABASE_URL,
    allowRemoteDatabase: process.env.E2E_ALLOW_REMOTE_DATABASE
  });
  if (!baseURL) throw new Error('E2E_BASE_URL_REQUIRED');
  if (!password || password.length < 8) throw new Error('E2E_INDUSTRY_DEMO_PASSWORD_REQUIRED');
  if (!buyerSecret) throw new Error('E2E_BUYER_JWT_SECRET_REQUIRED');
  const target = new URL(baseURL);
  if (!['http:', 'https:'].includes(target.protocol)) throw new Error('E2E_TARGET_MUST_USE_HTTP_OR_HTTPS');
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(target.hostname) && process.env.E2E_ALLOW_REMOTE_TARGET !== 'true') {
    throw new Error('E2E_REMOTE_TARGET_REQUIRES_E2E_ALLOW_REMOTE_TARGET');
  }
});

after(async () => {
  await Promise.all(contexts.map(context => context.dispose().catch(() => undefined)));
});

const merchantIds = new Map<string, string>();
const merchantApiByEmail = new Map<string, APIRequestContext>();

async function loginAs(email: string): Promise<APIRequestContext> {
  const cached = merchantApiByEmail.get(email);
  if (cached) return cached;
  const api = await request.newContext({ baseURL, extraHTTPHeaders: { Accept: 'application/json' } });
  contexts.push(api);
  const response = await api.post('/api/auth/login/merchant', { data: { email, password } });
  assert.equal(response.status(), 200, `login should succeed for ${email}`);
  const payload = await response.json();
  const merchantId = payload?.merchant?.id;
  if (merchantId) merchantIds.set(email, String(merchantId));
  merchantApiByEmail.set(email, api);
  return api;
}

async function loginAsEmployee(email: string, merchantId: string): Promise<APIRequestContext> {
  const api = await request.newContext({ baseURL, extraHTTPHeaders: { Accept: 'application/json' } });
  contexts.push(api);
  const response = await api.post('/api/auth/login/employee', { data: { email, password, merchantId } });
  assert.equal(response.status(), 200, `employee login should succeed for ${email}`);
  return api;
}

/** 读取中心仓 SKU 快照库存，用于验证采购入库/销售是否真的落到库存记录。 */
async function readCentralStock(api: APIRequestContext, productId: string, sku: string): Promise<number> {
  const response = await api.get('/api/merchant/products');
  assert.equal(response.status(), 200);
  const products = ((await response.json()).products ?? []) as Array<{ id?: string; skus?: Array<{ sku?: string; stockCentral?: number }> }>;
  const product = products.find(row => row.id === productId);
  const skuRow = (product?.skus ?? []).find(row => row.sku === sku);
  return Number(skuRow?.stockCentral ?? 0);
}

async function readStoreStock(api: APIRequestContext, storeId: string, productId: string, sku: string): Promise<number> {
  const response = await api.get(`/api/merchant/stores/${encodeURIComponent(storeId)}/stock`);
  assert.equal(response.status(), 200);
  const stock = ((await response.json()).stock ?? []) as Array<{ productId?: string; sku?: string; quantity?: number }>;
  const row = stock.find(item => item.productId === productId && item.sku === sku);
  return Number(row?.quantity ?? 0);
}

async function readStoreStockSnapshot(
  api: APIRequestContext,
  storeId: string,
  productId: string,
  sku: string
): Promise<{ quantity: number; reservedQuantity: number; availableQuantity: number }> {
  const response = await api.get(`/api/merchant/stores/${encodeURIComponent(storeId)}/stock`);
  assert.equal(response.status(), 200);
  const stock = ((await response.json()).stock ?? []) as Array<{
    productId?: string;
    sku?: string;
    quantity?: number;
    reservedQuantity?: number;
    availableQuantity?: number;
  }>;
  const row = stock.find(item => item.productId === productId && item.sku === sku);
  return {
    quantity: Number(row?.quantity ?? 0),
    reservedQuantity: Number(row?.reservedQuantity ?? 0),
    availableQuantity: Number(row?.availableQuantity ?? 0)
  };
}

test('seven-industry demo login uses only fixed seeded merchants', async () => {
  const invalidApi = await request.newContext({ baseURL, extraHTTPHeaders: { Accept: 'application/json' } });
  contexts.push(invalidApi);
  const invalid = await invalidApi.post('/api/auth/demo/merchant/login', {
    data: { industryTemplateId: 'formal-company', merchantId: 'formal-company' }
  });
  assert.equal(invalid.status(), 400);
  assert.equal((await invalid.json()).error, 'DEMO_INDUSTRY_INVALID');

  for (const industry of industries) {
    const api = await request.newContext({ baseURL, extraHTTPHeaders: { Accept: 'application/json' } });
    contexts.push(api);
    const response = await api.post('/api/auth/demo/merchant/login', {
      data: {
        industryTemplateId: industry.templateId,
        merchantId: 'formal-company',
        email: 'owner@example.invalid',
        password: 'must-not-be-used'
      }
    });
    assert.equal(response.status(), 200, `${industry.templateId} demo entry should authenticate`);
    const payload = await response.json();
    assert.equal(payload.merchant.id, `demo-industry-${industry.key}`);
    assert.equal(payload.merchant.industryTemplate, industry.templateId);
    assert.equal(payload.demoMode, true);
    assert.equal(Object.hasOwn(payload, 'token'), false, 'demo login must not expose a bearer token');

    const contextResponse = await api.get('/api/merchant/industry-context');
    assert.equal(contextResponse.status(), 200);
    const context = (await contextResponse.json()).context;
    assert.equal(context.templateId, industry.templateId, 'session must use the selected merchant industry');
  }
});

test('retail industries complete shift, idempotent sale and refund', async () => {
  for (const industry of industries) {
    const capability = getMerchantIndustryCapability(industry.templateId);
    if (!capability?.features.pos) continue;
    const api = await loginAs(industry.email);

    const productsResponse = await api.get('/api/merchant/products');
    assert.equal(productsResponse.status(), 200);
    const productsPayload = await productsResponse.json();
    const products: any[] = Array.isArray(productsPayload.products) ? productsPayload.products : [];
    const published = products.filter(product => (product.lifecycleStatus || 'published') === 'published');
    assert.ok(published.length > 0, `${industry.templateId} demo merchant needs a published product`);

    let storeId = '';
    if (capability.inventory.mode === 'store') {
      const storesResponse = await api.get('/api/merchant/stores');
      const storesPayload = await storesResponse.json();
      const activeStore = (storesPayload.stores || []).find((store: any) => store.status === 'active');
      assert.ok(activeStore, `${industry.templateId} needs an active store`);
      storeId = activeStore.id;
      const stockResponse = await api.get(`/api/merchant/stores/${encodeURIComponent(storeId)}/stock`);
      const stockPayload = await stockResponse.json();
      const stocked = (stockPayload.stock || []).find((row: any) => Number(row.quantity) > 0);
      assert.ok(stocked, `${industry.templateId} needs store stock for POS`);
      published.sort((left, right) => (left.id === stocked.productId ? -1 : right.id === stocked.productId ? 1 : 0));
    }

    const product = published[0];
    const sku = (product.skus || []).find((item: any) => item.isActive !== false && (capability.inventory.mode === 'store' || Number(item.stockCentral) > 0))
      || (product.skus || [])[0];
    assert.ok(sku, `${industry.templateId} demo product needs a SKU`);

    const shiftQuery = storeId ? `?storeId=${encodeURIComponent(storeId)}` : '';
    const current = await api.get(`/api/merchant/pos/shifts/current${shiftQuery}`);
    const currentPayload = await current.json();
    let shiftId: string = currentPayload.shift?.id || '';
    if (!shiftId) {
      const opened = await api.post('/api/merchant/pos/shifts', { data: { openingCash: '50.00', note: 'industry e2e', ...(storeId ? { storeId } : {}) } });
      assert.ok([201, 409].includes(opened.status()), 'shift open should succeed or report already open');
      if (opened.status() === 201) {
        shiftId = (await opened.json()).shift.id;
      } else {
        const retry = await api.get(`/api/merchant/pos/shifts/current${shiftQuery}`);
        shiftId = (await retry.json()).shift?.id || '';
      }
    }
    assert.ok(shiftId, `${industry.templateId} needs an open shift`);

    const idempotencyKey = `e2e-industry-${industry.templateId}-${Date.now()}`;
    const salePayload = {
      items: [{ productId: product.id, sku: sku.sku, quantity: 1 }],
      paymentMethod: 'cash',
      paymentConfirmed: true,
      posShiftId: shiftId,
      ...(storeId ? { storeId } : {}),
      idempotencyKey
    };
    const firstSale = await api.post('/api/merchant/pos/sales', { data: salePayload });
    assert.equal(firstSale.status(), 201, `${industry.templateId} POS sale should be created`);
    const firstSalePayload = await firstSale.json();
    assert.ok(firstSalePayload.sale?.saleNo?.startsWith('POS-'), 'POS sale number must use POS- prefix');

    const replay = await api.post('/api/merchant/pos/sales', { data: salePayload });
    assert.ok([200, 409].includes(replay.status()), 'duplicate sale must replay or conflict, never double charge');
    if (replay.status() === 200) {
      assert.equal((await replay.json()).idempotentReplay, true);
    }

    const refundKey = `e2e-industry-refund-${industry.templateId}-${Date.now()}`;
    const refundPayload = {
      orderId: firstSalePayload.sale.id,
      items: [{ productId: product.id, sku: sku.sku, quantity: 1 }],
      reason: 'industry e2e return',
      refundConfirmed: true,
      idempotencyKey: refundKey
    };
    const refund = await api.post('/api/merchant/pos/returns', { data: refundPayload });
    assert.equal(refund.status(), 200, `${industry.templateId} refund should succeed`);
    assert.ok(Number((await refund.json()).refundAmount) > 0, 'refund amount must be positive');

    const refundReplay = await api.post('/api/merchant/pos/returns', { data: refundPayload });
    assert.equal(refundReplay.status(), 200);
    assert.equal((await refundReplay.json()).idempotentReplay, true, 'repeated refund must not refund twice');

    const closed = await api.post(`/api/merchant/pos/shifts/${encodeURIComponent(shiftId)}/close`, {
      data: { closingCash: '50.00', note: 'industry e2e close' }
    });
    assert.equal(closed.status(), 200, `${industry.templateId} shift close should succeed`);
  }
});

test('pos refunds, cash accounting and shift history stay consistent', async () => {
  const chain = industries.find(industry => industry.templateId === 'department_chain_retail');
  assert.ok(chain, 'chain retail demo merchant must be configured');
  const api = await loginAs(chain!.email);

  const storesResponse = await api.get('/api/merchant/stores');
  assert.equal(storesResponse.status(), 200);
  const stores = ((await storesResponse.json()).stores ?? []) as Array<{ id: string; name: string; code: string }>;
  assert.ok(stores.length >= 2, 'chain demo merchant needs at least two stores');

  // 找到门店库存里至少有 2 件的 SKU，用于部分退货与全部退货。
  let storeId = '';
  let stocked: { productId: string; sku: string; quantity: number } | null = null;
  for (const store of stores) {
    const stockResponse = await api.get(`/api/merchant/stores/${encodeURIComponent(store.id)}/stock`);
    if (stockResponse.status() !== 200) continue;
    const rows = ((await stockResponse.json()).stock ?? []) as Array<{ productId: string; sku: string; quantity: number }>;
    const candidate = rows
      .filter(row => Number(row.quantity) >= 2)
      .sort((left, right) => Number(right.quantity) - Number(left.quantity))[0];
    if (candidate) {
      storeId = store.id;
      stocked = candidate;
      break;
    }
  }
  assert.ok(storeId && stocked, 'chain demo store needs a SKU with at least two units on hand');

  const stockOf = async (): Promise<number> => {
    const response = await api.get(`/api/merchant/stores/${encodeURIComponent(storeId)}/stock`);
    const rows = ((await response.json()).stock ?? []) as Array<{ productId: string; sku: string; quantity: number }>;
    const row = rows.find(item => item.productId === stocked!.productId && item.sku === stocked!.sku);
    return Number(row?.quantity ?? Number.NaN);
  };

  const currentShift = await api.get(`/api/merchant/pos/shifts/current?storeId=${encodeURIComponent(storeId)}`);
  const openShift = (await currentShift.json()).shift;
  if (openShift) {
    const closedExisting = await api.post(`/api/merchant/pos/shifts/${encodeURIComponent(openShift.id)}/close`, {
      data: { closingCash: String(openShift.expectedCash), note: 'e2e cash test cleanup' }
    });
    assert.equal(closedExisting.status(), 200, 'existing shift should close before the cash test');
  }

  const openedResponse = await api.post('/api/merchant/pos/shifts', {
    data: { openingCash: '100.00', note: 'e2e cash accounting', storeId }
  });
  assert.equal(openedResponse.status(), 201, 'cash test needs a fresh shift');
  const shiftId = (await openedResponse.json()).shift.id as string;

  const saleQuantity = 2;
  const stockBeforeSale = await stockOf();
  const saleResponse = await api.post('/api/merchant/pos/sales', {
    data: {
      items: [{ productId: stocked!.productId, sku: stocked!.sku, quantity: saleQuantity }],
      paymentMethod: 'cash',
      paymentConfirmed: true,
      posShiftId: shiftId,
      storeId,
      idempotencyKey: `e2e-cash-sale-${Date.now()}`
    }
  });
  assert.equal(saleResponse.status(), 201, 'cash sale should be created');
  const sale = (await saleResponse.json()).sale as { id: string; totalAmount: number };
  const saleTotal = Number(sale.totalAmount);
  assert.ok(saleTotal > 0, 'cash sale must have a positive total');
  assert.equal(await stockOf(), stockBeforeSale - saleQuantity, 'sale must deduct store stock');

  const shiftAfterSale = (await (await api.get(`/api/merchant/pos/shifts/current?storeId=${encodeURIComponent(storeId)}`)).json()).shift;
  assert.equal(shiftAfterSale.cashSales, saleTotal, 'shift cash sales must equal the sale total');
  assert.equal(shiftAfterSale.expectedCash, Number((100 + saleTotal).toFixed(2)), 'expected cash includes opening cash + cash sales');

  // 超量退货必须被拒绝，且不影响库存。
  const overReturn = await api.post('/api/merchant/pos/returns', {
    data: {
      orderId: sale.id,
      items: [{ productId: stocked!.productId, sku: stocked!.sku, quantity: saleQuantity + 1 }],
      reason: 'e2e over return',
      refundConfirmed: true,
      idempotencyKey: `e2e-over-return-${Date.now()}`
    }
  });
  assert.ok([400, 409].includes(overReturn.status()), 'over-quantity refund must be rejected');
  assert.equal(await stockOf(), stockBeforeSale - saleQuantity, 'rejected refund must not touch stock');

  // 部分退货 1 件。
  const partialRefundKey = `e2e-partial-refund-${Date.now()}`;
  const partialRefundPayload = {
    orderId: sale.id,
    items: [{ productId: stocked!.productId, sku: stocked!.sku, quantity: 1 }],
    reason: 'e2e partial return',
    refundConfirmed: true,
    idempotencyKey: partialRefundKey
  };
  const partialResponse = await api.post('/api/merchant/pos/returns', { data: partialRefundPayload });
  assert.equal(partialResponse.status(), 200, 'partial refund should succeed');
  const partialAmount = Number((await partialResponse.json()).refundAmount);
  assert.ok(partialAmount > 0, 'partial refund amount must be positive');
  const stockAfterPartial = await stockOf();
  assert.equal(stockAfterPartial, stockBeforeSale - saleQuantity + 1, 'partial refund restores one unit');

  const partialReplay = await api.post('/api/merchant/pos/returns', { data: partialRefundPayload });
  assert.equal(partialReplay.status(), 200, 'duplicate refund request must replay');
  assert.equal((await partialReplay.json()).idempotentReplay, true, 'duplicate refund must not refund twice');
  assert.equal(await stockOf(), stockAfterPartial, 'duplicate refund must not restock twice');

  // 全部退货：把剩余 1 件退完，库存必须回到销售前。
  const restRefundResponse = await api.post('/api/merchant/pos/returns', {
    data: {
      orderId: sale.id,
      items: [{ productId: stocked!.productId, sku: stocked!.sku, quantity: saleQuantity - 1 }],
      reason: 'e2e remaining return',
      refundConfirmed: true,
      idempotencyKey: `e2e-rest-refund-${Date.now()}`
    }
  });
  assert.equal(restRefundResponse.status(), 200, 'remaining refund should succeed');
  const restAmount = Number((await restRefundResponse.json()).refundAmount);
  const totalRefund = Number((partialAmount + restAmount).toFixed(2));
  assert.ok(totalRefund <= saleTotal + 0.009, 'total refund must not exceed the paid amount');
  assert.equal(await stockOf(), stockBeforeSale, 'full refund must restore stock to the pre-sale level');

  // 现金收入 / 支出（重复提交不重复入账）。
  const cashInKey = `e2e-cash-in-${Date.now()}`;
  const cashInResponse = await api.post(`/api/merchant/pos/shifts/${encodeURIComponent(shiftId)}/cash-movements`, {
    data: { direction: 'in', amount: '20.00', reason: 'e2e 备用金', idempotencyKey: cashInKey }
  });
  assert.equal(cashInResponse.status(), 201, 'cash in should be recorded');
  const cashInReplay = await api.post(`/api/merchant/pos/shifts/${encodeURIComponent(shiftId)}/cash-movements`, {
    data: { direction: 'in', amount: '20.00', reason: 'e2e 备用金', idempotencyKey: cashInKey }
  });
  assert.equal(cashInReplay.status(), 200, 'duplicate cash movement must replay');
  assert.equal((await cashInReplay.json()).idempotentReplay, true);
  const cashOutResponse = await api.post(`/api/merchant/pos/shifts/${encodeURIComponent(shiftId)}/cash-movements`, {
    data: { direction: 'out', amount: '5.00', reason: 'e2e 零钱兑换', idempotencyKey: `e2e-cash-out-${Date.now()}` }
  });
  assert.equal(cashOutResponse.status(), 201, 'cash out should be recorded');

  const expectedCash = Number((100 + saleTotal - totalRefund + 20 - 5).toFixed(2));
  const shiftBeforeClose = (await (await api.get(`/api/merchant/pos/shifts/current?storeId=${encodeURIComponent(storeId)}`)).json()).shift;
  assert.equal(shiftBeforeClose.cashRefunds, totalRefund, 'shift cash refunds must equal the cash refund records');
  assert.equal(shiftBeforeClose.cashIn, 20, 'shift cash in must equal recorded movements');
  assert.equal(shiftBeforeClose.cashOut, 5, 'shift cash out must exclude refunds');
  assert.equal(shiftBeforeClose.expectedCash, expectedCash, 'expected cash = opening + cash sales + in - refunds - out');

  const closingCash = Number((expectedCash - 2).toFixed(2));
  const closeResponse = await api.post(`/api/merchant/pos/shifts/${encodeURIComponent(shiftId)}/close`, {
    data: { closingCash: closingCash.toFixed(2), note: 'e2e cash close' }
  });
  assert.equal(closeResponse.status(), 200, 'shift close should succeed');
  const closedShift = (await closeResponse.json()).shift;
  assert.equal(closedShift.expectedCash, expectedCash, 'closed shift must freeze the expected cash');
  assert.equal(closedShift.cashDifference, -2, 'cash difference must be actual minus expected');

  const closeAgain = await api.post(`/api/merchant/pos/shifts/${encodeURIComponent(shiftId)}/close`, {
    data: { closingCash: '0.00' }
  });
  assert.ok([404, 409].includes(closeAgain.status()), 'a closed shift cannot be settled twice');

  // 班次历史：门店 + 日期范围 + 状态过滤，数值与交班冻结值一致。
  const today = new Date().toISOString().slice(0, 10);
  const historyResponse = await api.get(
    `/api/merchant/pos/shifts?storeId=${encodeURIComponent(storeId)}&from=${today}&to=${today}&status=closed&limit=50`
  );
  assert.equal(historyResponse.status(), 200, 'shift history should be readable');
  const historyPayload = await historyResponse.json();
  const historyRow = (historyPayload.shifts ?? []).find((row: any) => row.id === shiftId);
  assert.ok(historyRow, 'closed shift must appear in history');
  assert.equal(historyRow.storeId, storeId);
  assert.equal(historyRow.expectedCash, expectedCash);
  assert.equal(historyRow.cashDifference, -2);
  assert.equal(historyRow.cashRefunds, totalRefund);
  assert.equal(historyRow.cashSales, saleTotal);
  assert.equal(historyRow.status, 'closed');

  const detailResponse = await api.get(`/api/merchant/pos/shifts/${encodeURIComponent(shiftId)}`);
  assert.equal(detailResponse.status(), 200, 'shift detail should be readable');
  const detail = await detailResponse.json();
  assert.equal(detail.shift.id, shiftId);
  assert.equal(detail.shift.cashDifference, -2);
  assert.equal(detail.sales.length, 1, 'shift detail must list the real sale');
  assert.ok(detail.refunds.length >= 2, 'shift detail must list refund records');
  assert.ok(
    detail.movements.some((movement: any) => movement.direction === 'out' && String(movement.reason).startsWith('POS 退货')),
    'cash refunds must be visible as cash movements'
  );
  assert.ok(detail.movements.some((movement: any) => movement.direction === 'in' && Number(movement.amount) === 20));

  const invalidRange = await api.get('/api/merchant/pos/shifts?from=not-a-date');
  assert.equal(invalidRange.status(), 400, 'invalid date range must be rejected');

  // 门店员工：只能查询自己门店的历史，跨门店必须 403。
  const merchantId = merchantIds.get(chain!.email);
  assert.ok(merchantId, 'chain merchant id must be known');
  const employeeApi = await loginAsEmployee(`demo-team-${chain!.key}@ruda.fashion`, merchantId!);
  const ownStoresResponse = await employeeApi.get('/api/merchant/stores');
  const ownStores = ((await ownStoresResponse.json()).stores ?? []) as Array<{ id: string }>;
  assert.equal(ownStores.length, 1, 'store-bound employee must only see the bound store');
  const otherStore = stores.find(store => store.id !== ownStores[0].id);
  assert.ok(otherStore, 'a store outside the employee scope must exist');
  const deniedHistory = await employeeApi.get(`/api/merchant/pos/shifts?storeId=${encodeURIComponent(otherStore!.id)}`);
  assert.equal(deniedHistory.status(), 403, 'store-bound employee must not read another store history');
  const ownHistory = await employeeApi.get(`/api/merchant/pos/shifts?storeId=${encodeURIComponent(ownStores[0].id)}`);
  assert.equal(ownHistory.status(), 200, 'store-bound employee may read own store history');
});

test('every industry backend exposes real profile, employees and module gates', async () => {
  for (const industry of industries) {
    const capability = getMerchantIndustryCapability(industry.templateId);
    assert.ok(capability, `${industry.templateId} capability must exist`);
    const api = await loginAs(industry.email);

    const settings = await api.get('/api/merchant/settings');
    assert.equal(settings.status(), 200, `${industry.templateId} settings should be readable`);
    const settingsPayload = await settings.json();
    assert.ok(settingsPayload.merchant?.name, `${industry.templateId} merchant profile must be present`);

    const employees = await api.get('/api/merchant/employees');
    assert.equal(employees.status(), 200, `${industry.templateId} employees should be readable by owner`);
    const employeesPayload = await employees.json();
    assert.ok(Array.isArray(employeesPayload.employees), `${industry.templateId} employees payload must be an array`);

    const gates: Array<{ path: string; enabled: boolean }> = [
      { path: '/api/merchant/stores', enabled: capability!.features.stores },
      { path: '/api/merchant/store-transfers', enabled: capability!.features.transfers },
      { path: '/api/merchant/pos/sales', enabled: capability!.features.pos }
    ];
    for (const gate of gates) {
      const response = await api.get(gate.path);
      assert.equal(
        response.status(),
        gate.enabled ? 200 : 403,
        `${industry.templateId} ${gate.path} should be ${gate.enabled ? 200 : 403}`
      );
      if (!gate.enabled) {
        const payload = await response.json();
        const errorCode = typeof payload.error === 'string'
          ? payload.error
          : payload.error?.code ?? payload.code;
        assert.equal(
          errorCode,
          'INDUSTRY_MODULE_UNAVAILABLE',
          `${industry.templateId} ${gate.path} must reject with INDUSTRY_MODULE_UNAVAILABLE`
        );
      }
    }
  }
});

test('merchant and store isolation hold for products, orders and store-bound employees', async () => {
  for (const industry of industries) {
    const api = await loginAs(industry.email);

    const productsResponse = await api.get('/api/merchant/products');
    assert.equal(productsResponse.status(), 200, `${industry.templateId} products should be readable`);
    const products = ((await productsResponse.json()).products ?? []) as Array<{ id?: string }>;
    assert.ok(products.length > 0, `${industry.templateId} must expose its seeded products`);
    const ownProductPrefix = `demo-industry-${industry.key}-`;
    const foreignProducts = products
      .map(product => String(product.id ?? ''))
      .filter(id => id.startsWith('demo-industry-') && !id.startsWith(ownProductPrefix));
    assert.deepEqual(foreignProducts, [], `${industry.templateId} must not read other merchants' products`);

    const ordersResponse = await api.get('/api/merchant/orders');
    assert.equal(ordersResponse.status(), 200, `${industry.templateId} orders should be readable`);
    const orders = ((await ordersResponse.json()).orders ?? []) as Array<{ id?: string }>;
    const ownOrderPrefix = `demo-industry-order-${industry.key}-`;
    const foreignOrders = orders
      .map(order => String(order.id ?? ''))
      .filter(id => id.startsWith('demo-industry-order-') && !id.startsWith(ownOrderPrefix));
    assert.deepEqual(foreignOrders, [], `${industry.templateId} must not read other merchants' orders`);
  }

  // 连锁店：员工绑定单个门店后，不得读写其他门店。
  const chain = industries.find(industry => industry.templateId === 'department_chain_retail');
  assert.ok(chain, 'chain retail demo merchant must be configured');
  const ownerApi = await loginAs(chain!.email);
  const merchantId = merchantIds.get(chain!.email);
  assert.ok(merchantId, 'chain merchant id must be known after login');

  const allStoresResponse = await ownerApi.get('/api/merchant/stores');
  assert.equal(allStoresResponse.status(), 200);
  const allStores = ((await allStoresResponse.json()).stores ?? []) as Array<{ id: string; code: string }>;
  assert.ok(allStores.length >= 2, 'chain demo merchant needs at least two stores');

  const employeeApi = await loginAsEmployee(`demo-team-${chain!.key}@ruda.fashion`, merchantId!);
  const employeeStoresResponse = await employeeApi.get('/api/merchant/stores');
  assert.equal(employeeStoresResponse.status(), 200);
  const employeeStores = ((await employeeStoresResponse.json()).stores ?? []) as Array<{ id: string; code: string }>;
  assert.equal(employeeStores.length, 1, 'store-bound employee must only see the bound store');

  const otherStore = allStores.find(store => store.code !== employeeStores[0].code);
  assert.ok(otherStore, 'a store outside the employee scope must exist');

  const deniedStock = await employeeApi.get(`/api/merchant/stores/${encodeURIComponent(otherStore!.id)}/stock`);
  assert.equal(deniedStock.status(), 403, 'store-bound employee must not read another store stock');

  const deniedAdjust = await employeeApi.post(
    `/api/merchant/stores/${encodeURIComponent(otherStore!.id)}/stock/adjustments`,
    { data: { productId: 'demo-foreign-product', sku: 'DEMO-FOREIGN-SKU', quantity: 1, note: 'e2e scope check' } }
  );
  assert.equal(deniedAdjust.status(), 403, 'store-bound employee must not adjust another store stock');

  // 交接班同样按门店隔离：店员只能开自己门店的班，不能查/开其他门店。
  const ownStoreId = employeeStores[0].id;
  const deniedShiftRead = await employeeApi.get(`/api/merchant/pos/shifts/current?storeId=${encodeURIComponent(otherStore!.id)}`);
  assert.equal(deniedShiftRead.status(), 403, 'store-bound employee must not read another store shift');

  const deniedShiftOpen = await employeeApi.post('/api/merchant/pos/shifts', {
    data: { openingCash: '0.00', note: 'e2e scope check', storeId: otherStore!.id }
  });
  assert.equal(deniedShiftOpen.status(), 403, 'store-bound employee must not open another store shift');

  const ownShiftOpen = await employeeApi.post('/api/merchant/pos/shifts', {
    data: { openingCash: '0.00', note: 'e2e own store', storeId: ownStoreId }
  });
  assert.ok([201, 409].includes(ownShiftOpen.status()), 'store-bound employee should open own store shift');
  if (ownShiftOpen.status() === 201) {
    const ownShift = (await ownShiftOpen.json()).shift;
    assert.equal(ownShift.storeId, ownStoreId, 'shift must record the store it belongs to');
    const deniedCash = await employeeApi.post(`/api/merchant/pos/shifts/${encodeURIComponent(ownShift.id)}/cash-movements`, {
      data: { direction: 'in', amount: '1.00', reason: 'e2e cash', idempotencyKey: `e2e-cash-${Date.now()}` }
    });
    assert.equal(deniedCash.status(), 201, 'store-bound employee records cash on own store shift');
    const closeOwn = await employeeApi.post(`/api/merchant/pos/shifts/${encodeURIComponent(ownShift.id)}/close`, {
      data: { closingCash: '1.00', note: 'e2e own store close' }
    });
    assert.equal(closeOwn.status(), 200, 'store-bound employee closes own store shift');
  }
});

test('procurement receipts record partial arrivals exactly once', async () => {
  for (const industry of industries) {
    const capability = getMerchantIndustryCapability(industry.templateId);
    if (!capability?.features.procurement) continue;
    const api = await loginAs(industry.email);

    const listResponse = await api.get('/api/merchant/purchase-orders');
    assert.equal(listResponse.status(), 200, `${industry.templateId} purchase orders should be readable`);
    const purchaseOrders = ((await listResponse.json()).purchaseOrders ?? []) as Array<{
      id: string;
      status: string;
      items?: Array<{ id: string; productId: string; sku: string; orderedQuantity: number; receivedQuantity: number }>;
    }>;
    const partial = purchaseOrders.find(order => order.status === 'partially_received'
      && (order.items ?? []).some(item => item.orderedQuantity > item.receivedQuantity));
    assert.ok(partial, `${industry.templateId} demo merchant needs a partially received purchase order`);
    const pending = partial!.items!.find(item => item.orderedQuantity > item.receivedQuantity)!;
    const remaining = pending.orderedQuantity - pending.receivedQuantity;

    const stockBefore = await readCentralStock(api, pending.productId, pending.sku);
    const receiptKey = `e2e-industry-receipt-${industry.templateId}-${Date.now()}`;
    const receiptPayload = {
      items: [{ itemId: pending.id, quantity: remaining }],
      note: 'industry e2e partial receipt',
      idempotencyKey: receiptKey
    };
    const receiptPath = `/api/merchant/purchase-orders/${encodeURIComponent(partial!.id)}/receipts`;

    const receipt = await api.post(receiptPath, { data: receiptPayload });
    assert.equal(
      receipt.status(),
      201,
      `${industry.templateId} remaining receipt should be accepted (${await receipt.text()})`
    );
    assert.equal(
      await readCentralStock(api, pending.productId, pending.sku),
      stockBefore + remaining,
      `${industry.templateId} receipt must increase central stock by exactly the received quantity`
    );

    const replay = await api.post(receiptPath, { data: receiptPayload });
    assert.equal(replay.status(), 200, 'repeated receipt must replay instead of failing');
    assert.equal((await replay.json()).idempotent, true, 'repeated receipt must be flagged idempotent');
    assert.equal(
      await readCentralStock(api, pending.productId, pending.sku),
      stockBefore + remaining,
      'repeated receipt must never add stock twice'
    );

    const overReceipt = await api.post(receiptPath, {
      data: {
        items: [{ itemId: pending.id, quantity: 1 }],
        note: 'industry e2e over receipt',
        idempotencyKey: `${receiptKey}-over`
      }
    });
    assert.equal(overReceipt.status(), 409, 'a fully received purchase order must not accept more stock');

    const refreshed = await api.get('/api/merchant/purchase-orders');
    const refreshedOrders = ((await refreshed.json()).purchaseOrders ?? []) as Array<{ id: string; status: string }>;
    const finalOrder = refreshedOrders.find(order => order.id === partial!.id);
    assert.equal(finalOrder?.status, 'received', `${industry.templateId} purchase order must be marked received`);
  }
});

test('chain store transfer moves stock between isolated stores exactly once', async () => {
  const chain = industries.find(industry => industry.templateId === 'department_chain_retail');
  assert.ok(chain, 'chain retail demo merchant must be configured');
  const api = await loginAs(chain!.email);

  const storesResponse = await api.get('/api/merchant/stores');
  assert.equal(storesResponse.status(), 200);
  const stores = ((await storesResponse.json()).stores ?? []) as Array<{ id: string; code: string }>;
  assert.ok(stores.length >= 2, 'chain demo merchant needs at least two stores');

  const fromStore = stores[0];
  const toStore = stores[1];
  const fromStockResponse = await api.get(`/api/merchant/stores/${encodeURIComponent(fromStore.id)}/stock`);
  assert.equal(fromStockResponse.status(), 200);
  const fromStock = ((await fromStockResponse.json()).stock ?? []) as Array<{ productId: string; sku: string; quantity: number }>;
  const source = fromStock.find(row => Number(row.quantity) >= 3);
  assert.ok(source, 'source store needs at least three units for the transfer test');

  const quantity = 2;
  const fromBefore = Number(source!.quantity);
  const toBefore = await readStoreStock(api, toStore.id, source!.productId, source!.sku);
  const createPayload = {
    fromStoreId: fromStore.id,
    toStoreId: toStore.id,
    idempotencyKey: `e2e-industry-transfer-${Date.now()}`,
    note: 'industry e2e transfer',
    items: [{ productId: source!.productId, sku: source!.sku, quantity }]
  };

  const created = await api.post('/api/merchant/store-transfers', { data: createPayload });
  assert.equal(created.status(), 201, 'store transfer should be created');
  const transferId = String((await created.json()).transfer.id);

  const replayed = await api.post('/api/merchant/store-transfers', { data: createPayload });
  assert.equal(replayed.status(), 200, 'duplicate transfer request must replay');
  assert.equal((await replayed.json()).idempotentReplay, true, 'duplicate transfer must be flagged as replay');
  assert.equal(
    await readStoreStock(api, fromStore.id, source!.productId, source!.sku),
    fromBefore,
    'duplicate transfer must not deduct stock twice'
  );

  const patchPath = `/api/merchant/store-transfers/${encodeURIComponent(transferId)}`;
  const dispatched = await api.patch(patchPath, { data: { status: 'dispatched' } });
  assert.equal(dispatched.status(), 200, 'transfer should dispatch');
  assert.equal(
    await readStoreStock(api, fromStore.id, source!.productId, source!.sku),
    fromBefore - quantity,
    'dispatch must deduct the source store stock'
  );

  const received = await api.patch(patchPath, { data: { status: 'received' } });
  assert.equal(received.status(), 200, 'transfer should be received');
  assert.equal(
    await readStoreStock(api, toStore.id, source!.productId, source!.sku),
    toBefore + quantity,
    'receipt must add the destination store stock'
  );

  const repeatedReceipt = await api.patch(patchPath, { data: { status: 'received' } });
  assert.equal(repeatedReceipt.status(), 409, 'a received transfer must not be received twice');
  assert.equal((await repeatedReceipt.json()).error, 'TRANSFER_STATUS_CONFLICT');
  assert.equal(
    await readStoreStock(api, toStore.id, source!.productId, source!.sku),
    toBefore + quantity,
    'repeated receipt must not inflate destination stock'
  );
});

test('industry product attributes are validated per industry', async () => {
  for (const [index, industry] of industries.entries()) {
    const capability = getMerchantIndustryCapability(industry.templateId);
    assert.ok(capability, `${industry.templateId} capability must exist`);
    const api = await loginAs(industry.email);
    const styleNo = `E2E${Date.now()}${index}`;
    const baseProduct = {
      styleNo,
      name: 'E2E 属性校验商品',
      lifecycleStatus: 'draft',
      wholesalePrice: 10,
      rrpPrice: 20
    };

    const forbidden = await api.post('/api/merchant/products', {
      data: { ...baseProduct, industryAttributes: { __e2e_forbidden_field__: 'x' } }
    });
    assert.equal(forbidden.status(), 400, `${industry.templateId} must reject attributes outside its own schema`);
    assert.equal((await forbidden.json()).error, 'INDUSTRY_PRODUCT_FIELDS_INVALID');

    const requiredAttributes: Record<string, string> = {};
    for (const field of capability!.productFields) {
      if (!field.required || field.column || field.type === 'media' || field.type === 'variants') continue;
      requiredAttributes[field.key] = 'E2E';
    }

    const accepted = await api.post('/api/merchant/products', {
      data: { ...baseProduct, industryAttributes: requiredAttributes }
    });
    assert.equal(accepted.status(), 201, `${industry.templateId} must accept its own attributes`);
    const created = (await accepted.json()).product as {
      id: string;
      industryAttributes?: string | Record<string, string>;
    };
    const echoed = typeof created.industryAttributes === 'string'
      ? JSON.parse(created.industryAttributes)
      : created.industryAttributes ?? {};
    assert.deepEqual(echoed, requiredAttributes, `${industry.templateId} must persist exactly its own attributes`);

    const listed = await api.get('/api/merchant/products');
    const ids = (((await listed.json()).products ?? []) as Array<{ id?: string }>).map(product => product.id);
    assert.ok(ids.includes(created.id), `${industry.templateId} created product must appear in its own catalog`);
  }
});

test('industry context is server-authoritative and cannot be spoofed by client params', async () => {
  for (const industry of industries) {
    const capability = getMerchantIndustryCapability(industry.templateId);
    assert.ok(capability, `${industry.templateId} capability must exist`);
    const api = await loginAs(industry.email);

    // 故意传入其他行业模板参数，服务端必须忽略。
    const response = await api.get('/api/merchant/industry-context?templateId=general_retail&industry=general_retail');
    assert.equal(response.status(), 200, `${industry.templateId} industry context should be readable`);
    const context = (await response.json()).context as {
      templateId?: string;
      templateLabel?: string;
      modules?: string[];
      productFields?: Array<{ key?: string }>;
      requiresIndustrySetup?: boolean;
      permissions?: string[];
      role?: string;
    };
    assert.equal(context.templateId, industry.templateId, 'context must use the stored merchant template');
    assert.equal(context.requiresIndustrySetup, false);
    assert.ok(context.templateLabel, 'context must expose a human readable template label');
    assert.deepEqual(context.modules, [...capability!.modules], 'context modules must match the authoritative capability');
    assert.ok((context.productFields ?? []).length > 0, 'context must expose industry product fields');
    assert.ok(Array.isArray(context.permissions), 'context must expose employee permissions array');

    // 另一个商家读取到的仍是自己的行业，不受上一个请求影响。
    const other = industries.find(candidate => candidate.key !== industry.key)!;
    const otherApi = await loginAs(other.email);
    const otherResponse = await otherApi.get('/api/merchant/industry-context');
    assert.equal(otherResponse.status(), 200);
    const otherContext = (await otherResponse.json()).context;
    assert.equal(otherContext.templateId, other.templateId, 'each merchant must resolve its own industry');
  }
});
test('order lifecycle deducts and releases inventory exactly once per transition', async () => {
  for (const industry of industries) {
    const api = await loginAs(industry.email);
    const listResponse = await api.get('/api/merchant/orders');
    assert.equal(listResponse.status(), 200, `${industry.templateId} orders should be readable`);
    const orders = ((await listResponse.json()).orders ?? []) as Array<{
      id: string;
      status: string;
      storeId?: string | null;
      items?: Array<{ productId: string; sku: string; quantity: number }>;
    }>;
    const pendingOrder = orders.find(order => order.status === 'pending');
    assert.ok(pendingOrder, `${industry.templateId} demo seeded order must start pending`);
    const shippedOrder = orders.find(order => order.status === 'shipped');
    assert.ok(shippedOrder, `${industry.templateId} demo seeded order must exist in shipped status`);
    const item = (pendingOrder!.items ?? [])[0];
    assert.ok(item, `${industry.templateId} pending order must contain an item`);

    const fulfill = (orderId: string, data: Record<string, unknown>) =>
      api.put(`/api/merchant/orders/${encodeURIComponent(orderId)}/fulfill`, { data });
    const readOrderStatus = async (orderId: string) => {
      const ordersResponse = await api.get('/api/merchant/orders');
      assert.equal(ordersResponse.status(), 200);
      const rows = ((await ordersResponse.json()).orders ?? []) as Array<{ id: string; status: string }>;
      return rows.find(row => row.id === orderId)?.status;
    };

    const stockBefore = await readCentralStock(api, item.productId, item.sku);
    // 连锁店库存归属门店（inventory.mode='store'），在线订单履约不走中心仓，
    // 因此只对中心仓行业断言扣减；门店行业的真实扣减由 POS/调拨用例覆盖。
    const capability = getMerchantIndustryCapability(industry.templateId)!;
    const deductsCentralStock = capability.inventory.mode !== 'store';
    const storeOrder = capability.inventory.mode === 'store';
    if (storeOrder) assert.ok(pendingOrder!.storeId, 'chain order must have an explicit fulfillment store');
    const storeSnapshotBefore = storeOrder
      ? await readStoreStockSnapshot(api, pendingOrder!.storeId!, item.productId, item.sku)
      : null;
    if (storeOrder) {
      assert.ok(
        (storeSnapshotBefore?.reservedQuantity ?? 0) >= Number(item.quantity),
        'pending chain order must have its store quantity reserved'
      );
      const reservedStockAdjustment = await api.post(
        `/api/merchant/stores/${encodeURIComponent(pendingOrder!.storeId!)}/stock/adjustments`,
        {
          data: {
            productId: item.productId,
            sku: item.sku,
            quantity: -(storeSnapshotBefore!.availableQuantity + 1),
            note: 'e2e must preserve reserved order inventory'
          }
        }
      );
      assert.equal(reservedStockAdjustment.status(), 409, 'manual adjustment must not consume reserved inventory');
      assert.equal((await reservedStockAdjustment.json()).error, 'STORE_STOCK_RESERVED');
      assert.deepEqual(
        await readStoreStockSnapshot(api, pendingOrder!.storeId!, item.productId, item.sku),
        storeSnapshotBefore,
        'rejected adjustment must leave store stock and reservation unchanged'
      );
    }

    // 租户隔离：其他商家不能推进本商家订单。
    const otherIndustry = industries.find(candidate => candidate.key !== industry.key)!;
    const otherApi = await loginAs(otherIndustry.email);
    const forbidden = await otherApi.put(`/api/merchant/orders/${encodeURIComponent(pendingOrder!.id)}/fulfill`, {
      data: { status: 'confirmed' }
    });
    assert.equal(forbidden.status(), 403, 'another merchant must not fulfill this order');

    // 非法状态跳转必须被拒绝，且不改变库存。
    const invalidJump = await fulfill(pendingOrder!.id, { status: 'shipped' });
    assert.equal(invalidJump.status(), 409, 'pending order cannot jump to shipped');
    assert.equal((await invalidJump.json()).error, 'INVALID_ORDER_TRANSITION');
    assert.equal(await readCentralStock(api, item.productId, item.sku), stockBefore, 'invalid transition must not touch stock');

    // 确认订单：库存按订单数量扣减一次。
    const confirmed = await fulfill(pendingOrder!.id, { status: 'confirmed' });
    assert.equal(confirmed.status(), 200, 'pending order should be confirmable');
    assert.equal((await confirmed.json()).order.status, 'confirmed');
    const stockAfterConfirm = await readCentralStock(api, item.productId, item.sku);
    assert.equal(
      stockAfterConfirm,
      deductsCentralStock ? stockBefore - Number(item.quantity) : stockBefore,
      deductsCentralStock
        ? `${industry.templateId} confirmation must deduct the ordered quantity once`
        : `${industry.templateId} store-mode confirmation must not move central warehouse stock`
    );
    if (storeOrder) {
      assert.deepEqual(
        await readStoreStockSnapshot(api, pendingOrder!.storeId!, item.productId, item.sku),
        storeSnapshotBefore,
        'confirmation must not reserve or deduct chain store inventory a second time'
      );
    }

    // 重复确认：409 且不得二次扣减。
    const repeatedConfirm = await fulfill(pendingOrder!.id, { status: 'confirmed' });
    assert.equal(repeatedConfirm.status(), 409, 'repeated confirmation must be rejected');
    assert.equal(await readCentralStock(api, item.productId, item.sku), stockAfterConfirm, 'repeated confirmation must not deduct stock twice');

    // 未收款不能拣货（正式业务规则），状态与库存保持不变。
    const unpaidPicking = await fulfill(pendingOrder!.id, { status: 'picking' });
    assert.equal(unpaidPicking.status(), 409, 'unpaid order must not move to picking');
    assert.equal((await unpaidPicking.json()).error, 'ORDER_PAYMENT_REQUIRED');
    assert.equal(await readOrderStatus(pendingOrder!.id), 'confirmed');
    assert.equal(await readCentralStock(api, item.productId, item.sku), stockAfterConfirm);

    // 并发取消：只有一次成功，库存只回补一次。
    const [cancelA, cancelB] = await Promise.all([
      fulfill(pendingOrder!.id, { status: 'cancelled', reason: 'e2e concurrent cancel' }),
      fulfill(pendingOrder!.id, { status: 'cancelled', reason: 'e2e concurrent cancel' })
    ]);
    const cancelStatuses = [cancelA.status(), cancelB.status()].sort((left, right) => left - right);
    assert.deepEqual(cancelStatuses, [200, 409], 'concurrent cancels must succeed exactly once');
    assert.equal(await readOrderStatus(pendingOrder!.id), 'cancelled');
    assert.equal(
      await readCentralStock(api, item.productId, item.sku),
      stockBefore,
      `${industry.templateId} cancellation must restore the deducted stock exactly once`
    );
    if (storeOrder) {
      const storeSnapshotAfterCancel = await readStoreStockSnapshot(api, pendingOrder!.storeId!, item.productId, item.sku);
      assert.equal(storeSnapshotAfterCancel.quantity, storeSnapshotBefore!.quantity, 'cancel must not change store on-hand stock');
      assert.equal(
        storeSnapshotAfterCancel.reservedQuantity,
        storeSnapshotBefore!.reservedQuantity - Number(item.quantity),
        'cancel must release this order reservation exactly once'
      );
      assert.equal(
        storeSnapshotAfterCancel.availableQuantity,
        storeSnapshotBefore!.availableQuantity + Number(item.quantity),
        'released reservation must become available stock'
      );
    }

    // 已取消订单不能被再次取消或发货。
    const cancelAgain = await fulfill(pendingOrder!.id, { status: 'cancelled' });
    assert.equal(cancelAgain.status(), 409, 'cancelled order cannot be cancelled twice');
    const shipCancelled = await fulfill(pendingOrder!.id, { status: 'shipped' });
    assert.equal(shipCancelled.status(), 409, 'cancelled order cannot be shipped');
    assert.equal(await readCentralStock(api, item.productId, item.sku), stockBefore, 'rejected transitions must not move stock');

    if (storeOrder) {
      const confirmedStoreOrder = orders.find(order => order.status === 'confirmed');
      assert.ok(confirmedStoreOrder?.storeId, 'chain fixture must include a confirmed order assigned to a store');
      const confirmedItem = (confirmedStoreOrder.items ?? [])[0];
      assert.ok(confirmedItem, 'confirmed chain order must contain a line item');
      const storesResponse = await api.get('/api/merchant/stores');
      assert.equal(storesResponse.status(), 200);
      const stores = ((await storesResponse.json()).stores ?? []) as Array<{ id: string }>;
      const otherStore = stores.find(store => store.id !== confirmedStoreOrder.storeId);
      assert.ok(otherStore, 'chain fixture must include a second store');
      const storeBeforeShip = await readStoreStockSnapshot(
        api,
        confirmedStoreOrder.storeId!,
        confirmedItem.productId,
        confirmedItem.sku
      );
      const otherStoreBeforeShip = await readStoreStockSnapshot(
        api,
        otherStore!.id,
        confirmedItem.productId,
        confirmedItem.sku
      );
      assert.ok(storeBeforeShip.reservedQuantity >= confirmedItem.quantity, 'confirmed chain order must retain its reservation');
      const centralBeforeShip = await readCentralStock(api, confirmedItem.productId, confirmedItem.sku);

      const picking = await fulfill(confirmedStoreOrder.id, { status: 'picking' });
      assert.equal(picking.status(), 200, 'paid chain order should enter picking');
      assert.deepEqual(
        await readStoreStockSnapshot(api, confirmedStoreOrder.storeId!, confirmedItem.productId, confirmedItem.sku),
        storeBeforeShip,
        'picking must not consume on-hand stock or reservation'
      );
      const shipped = await fulfill(confirmedStoreOrder.id, { status: 'shipped' });
      assert.equal(shipped.status(), 200, 'chain order should ship from its assigned store');
      const storeAfterShip = await readStoreStockSnapshot(
        api,
        confirmedStoreOrder.storeId!,
        confirmedItem.productId,
        confirmedItem.sku
      );
      assert.equal(storeAfterShip.quantity, storeBeforeShip.quantity - confirmedItem.quantity);
      assert.equal(storeAfterShip.reservedQuantity, storeBeforeShip.reservedQuantity - confirmedItem.quantity);
      assert.equal(storeAfterShip.availableQuantity, storeBeforeShip.availableQuantity);
      assert.deepEqual(
        await readStoreStockSnapshot(api, otherStore!.id, confirmedItem.productId, confirmedItem.sku),
        otherStoreBeforeShip,
        'shipping must not change another store inventory'
      );
      assert.equal(await readCentralStock(api, confirmedItem.productId, confirmedItem.sku), centralBeforeShip);
      const repeatedShip = await fulfill(confirmedStoreOrder.id, { status: 'shipped' });
      assert.equal(repeatedShip.status(), 409, 'shipped chain order must not consume inventory twice');
      assert.deepEqual(
        await readStoreStockSnapshot(api, confirmedStoreOrder.storeId!, confirmedItem.productId, confirmedItem.sku),
        storeAfterShip
      );
      const returnReceived = await api.post(
        '/api/merchant/returns/demo-industry-return-department-chain-retail/receive'
      );
      const returnReceivedPayload = await returnReceived.json();
      assert.equal(returnReceived.status(), 200, `approved chain return should restock its original store: ${JSON.stringify(returnReceivedPayload)}`);
      const storeAfterReturn = await readStoreStockSnapshot(
        api,
        confirmedStoreOrder.storeId!,
        confirmedItem.productId,
        confirmedItem.sku
      );
      assert.equal(storeAfterReturn.quantity, storeBeforeShip.quantity, 'return must replenish the shipped store quantity');
      assert.equal(
        storeAfterReturn.reservedQuantity,
        storeBeforeShip.reservedQuantity - confirmedItem.quantity,
        'return must not recreate consumed reservations'
      );
      assert.equal(storeAfterReturn.availableQuantity, storeBeforeShip.availableQuantity + confirmedItem.quantity);
      assert.deepEqual(
        await readStoreStockSnapshot(api, otherStore!.id, confirmedItem.productId, confirmedItem.sku),
        otherStoreBeforeShip,
        'return must not replenish another store'
      );
      assert.equal(await readCentralStock(api, confirmedItem.productId, confirmedItem.sku), centralBeforeShip);
      const repeatedReturn = await api.post(
        '/api/merchant/returns/demo-industry-return-department-chain-retail/receive'
      );
      assert.equal(repeatedReturn.status(), 409, 'return receipt must not replenish store stock twice');
      assert.deepEqual(
        await readStoreStockSnapshot(api, confirmedStoreOrder.storeId!, confirmedItem.productId, confirmedItem.sku),
        storeAfterReturn
      );
    }

    // 已发货订单：不能取消、不能回退；可以且只能送达一次。
    const cancelShipped = await fulfill(shippedOrder!.id, { status: 'cancelled' });
    assert.equal(cancelShipped.status(), 409, 'shipped order cannot be cancelled');
    const backToPicking = await fulfill(shippedOrder!.id, { status: 'picking' });
    assert.equal(backToPicking.status(), 409, 'shipped order cannot move back to picking');
    const delivered = await fulfill(shippedOrder!.id, { status: 'delivered' });
    assert.equal(delivered.status(), 200, 'shipped order should be completable');
    assert.equal((await delivered.json()).order.status, 'delivered');
    const repeatDelivered = await fulfill(shippedOrder!.id, { status: 'delivered' });
    assert.equal(repeatDelivered.status(), 409, 'completed order cannot be processed twice');
  }
});

test('chain store reservations serialize buyer, employee and quote orders', async () => {
  const chain = industries.find(industry => industry.templateId === 'department_chain_retail');
  assert.ok(chain);
  const owner = await loginAs(chain!.email);
  const storesResponse = await owner.get('/api/merchant/stores');
  assert.equal(storesResponse.status(), 200);
  const stores = ((await storesResponse.json()).stores ?? []) as Array<{ id: string; code: string }>;
  assert.ok(stores.length >= 2, 'chain fixture needs two stores');

  const productsResponse = await owner.get('/api/merchant/products');
  assert.equal(productsResponse.status(), 200);
  const products = ((await productsResponse.json()).products ?? []) as Array<{
    id: string;
    lifecycleStatus?: string;
    wholesalePrice?: number;
    moq?: number;
    packSize?: number;
    skus?: Array<{ sku: string; isActive?: boolean }>;
  }>;
  const product = products.find(row =>
    row.lifecycleStatus === 'published' && Number(row.wholesalePrice) > 0
  );
  assert.ok(product);
  const sku = (product!.skus ?? []).find(row => row.isActive !== false);
  assert.ok(sku);

  const storeSnapshots = await Promise.all(stores.map(async store => ({
    store,
    snapshot: await readStoreStockSnapshot(owner, store.id, product!.id, sku!.sku)
  })));
  const source = storeSnapshots
    .filter(row => row.snapshot.availableQuantity >= 2)
    .sort((left, right) => right.snapshot.availableQuantity - left.snapshot.availableQuantity)[0];
  assert.ok(source, 'one store needs available stock for reservation contention');
  const destination = stores.find(store => store.id !== source!.store.id)!;
  const targetQuantity = Math.floor(source!.snapshot.availableQuantity / 2) + 1;
  const customerId = 'demo-industry-customer-department-chain-retail';
  const buyerToken = jwt.sign({
    id: `buyer-${customerId}`,
    role: 'buyer',
    customerId
  }, buyerSecret!);
  const buyer = await request.newContext({
    baseURL,
    extraHTTPHeaders: { Accept: 'application/json', Authorization: `Bearer ${buyerToken}` }
  });
  contexts.push(buyer);

  const createdOrderIds: string[] = [];
  let shiftId = '';
  let transferId = '';
  try {
    const makeBuyerOrder = (orderNo: string) => buyer.post('/api/orders', {
      data: {
        masterOrder: {
          orderNo,
          date: new Date().toISOString(),
          storeId: source!.store.id,
          items: [{ productId: product!.id, sku: sku!.sku, quantity: targetQuantity }],
          paymentMethod: 'bank_transfer',
          deliveryType: 'shipping',
          shippingAddress: { street: 'Demo Street 1', city: 'Prato', country: 'IT', zip: '00000' }
        }
      }
    });
    const attempts = await Promise.all([
      makeBuyerOrder(`E2E-CHAIN-${crypto.randomUUID()}`),
      makeBuyerOrder(`E2E-CHAIN-${crypto.randomUUID()}`)
    ]);
    assert.deepEqual(
      attempts.map(response => response.status()).sort(),
      [201, 409],
      `concurrent order responses: ${JSON.stringify(await Promise.all(attempts.map(response => response.text())))}`
    );
    const rejected = attempts.find(response => response.status() === 409)!;
    assert.ok(
      ['STORE_STOCK_INSUFFICIENT', 'INVENTORY_CHANGED_RETRY_ORDER'].includes((await rejected.json()).error),
      'the competing order must fail as insufficient stock or a retryable inventory conflict'
    );
    const createdResponse = attempts.find(response => response.status() === 201)!;
    const created = await createdResponse.json();
    const buyerOrder = created.orders[0] as { id: string; storeId?: string };
    createdOrderIds.push(buyerOrder.id);
    assert.equal(buyerOrder.storeId, source!.store.id);

    const reservedSnapshot = await readStoreStockSnapshot(owner, source!.store.id, product!.id, sku!.sku);
    assert.equal(reservedSnapshot.quantity, source!.snapshot.quantity);
    assert.equal(reservedSnapshot.reservedQuantity, source!.snapshot.reservedQuantity + targetQuantity);
    assert.equal(reservedSnapshot.availableQuantity, source!.snapshot.availableQuantity - targetQuantity);
    assert.deepEqual(
      await readStoreStockSnapshot(owner, destination.id, product!.id, sku!.sku),
      storeSnapshots.find(row => row.store.id === destination.id)!.snapshot,
      'source-store reservations must not affect another store'
    );

    const adjustment = await owner.post(`/api/merchant/stores/${encodeURIComponent(source!.store.id)}/stock/adjustments`, {
      data: {
        productId: product!.id,
        sku: sku!.sku,
        quantity: reservedSnapshot.reservedQuantity - 1 - reservedSnapshot.quantity,
        note: 'E2E reserved inventory protection'
      }
    });
    assert.equal(adjustment.status(), 409);
    assert.equal((await adjustment.json()).error, 'STORE_STOCK_RESERVED');

    const transfer = await owner.post('/api/merchant/store-transfers', {
      data: {
        fromStoreId: source!.store.id,
        toStoreId: destination.id,
        idempotencyKey: `e2e-reserved-transfer-${crypto.randomUUID()}`,
        note: 'E2E reserved inventory protection',
        items: [{ productId: product!.id, sku: sku!.sku, quantity: reservedSnapshot.availableQuantity + 1 }]
      }
    });
    assert.equal(transfer.status(), 201);
    transferId = String((await transfer.json()).transfer.id);
    const dispatchTransfer = await owner.patch(`/api/merchant/store-transfers/${encodeURIComponent(transferId)}`, {
      data: { status: 'dispatched' }
    });
    assert.equal(dispatchTransfer.status(), 409);
    assert.equal((await dispatchTransfer.json()).error, 'STORE_STOCK_INSUFFICIENT');

    const openedShift = await owner.post('/api/merchant/pos/shifts', {
      data: { openingCash: '100.00', storeId: source!.store.id }
    });
    assert.equal(openedShift.status(), 201);
    shiftId = String((await openedShift.json()).shift.id);
    const posAttempt = await owner.post('/api/merchant/pos/sales', {
      data: {
        items: [{ productId: product!.id, sku: sku!.sku, quantity: reservedSnapshot.availableQuantity + 1 }],
        paymentMethod: 'card',
        paymentConfirmed: true,
        idempotencyKey: `e2e-reserved-pos-${crypto.randomUUID()}`,
        storeId: source!.store.id,
        posShiftId: shiftId
      }
    });
    assert.equal(posAttempt.status(), 409);
    assert.equal((await posAttempt.json()).error, 'STORE_STOCK_INSUFFICIENT');
    assert.deepEqual(
      await readStoreStockSnapshot(owner, source!.store.id, product!.id, sku!.sku),
      reservedSnapshot,
      'rejected adjustments, transfers, and POS sales must preserve the reservation'
    );

    const employee = await loginAsEmployee(
      'demo-team-department-chain-retail@ruda.fashion',
      'demo-industry-department-chain-retail'
    );
    const employeeContextResponse = await employee.get('/api/merchant/industry-context');
    assert.equal(employeeContextResponse.status(), 200);
    const employeeStoreId = String((await employeeContextResponse.json()).context.storeId);
    assert.ok(stores.some(store => store.id === employeeStoreId), 'employee must be bound to one of this merchant’s stores');
    const employeePayload = {
      customerId,
      storeId: employeeStoreId,
      paymentMethod: 'bank_transfer',
      items: [{ productId: product!.id, sku: sku!.sku, quantity: 1 }],
      idempotencyKey: `e2e-employee-order-${crypto.randomUUID()}`
    };
    const employeeOrderResponse = await employee.post('/api/merchant/employee-orders', { data: employeePayload });
    assert.equal(employeeOrderResponse.status(), 201, await employeeOrderResponse.text());
    const employeeOrderId = String((await employeeOrderResponse.json()).orderId);
    createdOrderIds.push(employeeOrderId);
    const employeeReplay = await employee.post('/api/merchant/employee-orders', { data: employeePayload });
    assert.equal(employeeReplay.status(), 200);
    assert.equal((await employeeReplay.json()).idempotentReplay, true);
    const employeeOrders = ((await (await owner.get('/api/merchant/orders')).json()).orders ?? []) as Array<{ id: string; storeId?: string }>;
    assert.equal(employeeOrders.find(order => order.id === employeeOrderId)?.storeId, employeeStoreId);

    const minimumQuantity = Number(product!.moq) || 1;
    const packSize = Math.max(Number(product!.packSize) || 1, 1);
    const quoteQuantity = Math.ceil(minimumQuantity / packSize) * packSize;
    const quoteResponse = await owner.post('/api/merchant/quotes', {
      data: {
        customerId,
        items: [{ productId: product!.id, sku: sku!.sku, quantity: quoteQuantity }]
      }
    });
    assert.equal(quoteResponse.status(), 201, await quoteResponse.text());
    const quotePayload = await quoteResponse.json();
    const shareToken = String(quotePayload.shareUrl).match(/\/api\/quotes\/([^/]+)$/)?.[1];
    assert.ok(shareToken, 'quote response must provide the existing signed confirmation URL');
    const quoteConversion = await owner.post(`/api/quotes/${encodeURIComponent(shareToken!)}/confirm`);
    assert.equal(quoteConversion.status(), 200, await quoteConversion.text());
    const conversionPayload = await quoteConversion.json();
    assert.equal(conversionPayload.success, true);
    assert.equal(conversionPayload.idempotent, false);
    const convertedOrderId = String(conversionPayload.orderId);
    createdOrderIds.push(convertedOrderId);
    const quoteReplay = await owner.post(`/api/quotes/${encodeURIComponent(shareToken!)}/confirm`);
    assert.equal(quoteReplay.status(), 200);
    assert.equal((await quoteReplay.json()).idempotent, true);
    const convertedOrders = ((await (await owner.get('/api/merchant/orders')).json()).orders ?? []) as Array<{ id: string; storeId?: string }>;
    assert.ok(convertedOrders.find(order => order.id === convertedOrderId)?.storeId);
  } finally {
    if (shiftId) {
      const current = await owner.get('/api/merchant/pos/shifts/current?storeId=' + encodeURIComponent(source!.store.id));
      const currentShift = (await current.json()).shift;
      if (currentShift?.id === shiftId) {
        await owner.post(`/api/merchant/pos/shifts/${encodeURIComponent(shiftId)}/close`, {
          data: { closingCash: String(currentShift.expectedCash || 100), note: 'E2E cleanup' }
        });
      }
    }
    if (transferId) {
      await owner.patch(`/api/merchant/store-transfers/${encodeURIComponent(transferId)}`, {
        data: { status: 'cancelled' }
      });
    }
    for (const orderId of createdOrderIds) {
      await owner.put(`/api/merchant/orders/${encodeURIComponent(orderId)}/fulfill`, {
        data: { status: 'cancelled', reason: 'E2E cleanup' }
      });
    }
  }

  assert.deepEqual(
    await readStoreStockSnapshot(owner, source!.store.id, product!.id, sku!.sku),
    source!.snapshot,
    'cancelling buyer, employee, and quote orders must release each source-store reservation'
  );
});

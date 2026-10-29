import 'dotenv/config';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { after, before, test } from 'node:test';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { request, type APIRequestContext } from 'playwright';
import { SINGLE_WAREHOUSE_CODE } from '../../src/server/warehouse';
import { getIsolatedE2ETestDatabaseUrl } from '../../scripts/e2eTestDatabaseSafety';

const baseURL = process.env.E2E_BASE_URL;
const buyerId = process.env.E2E_BUYER_ID || 'e2e_buyer';
const otherBuyerId = 'e2e_other_buyer';
const productId = process.env.E2E_PRODUCT_ID || 'e2e_product';
const buyerSecret = process.env.JWT_BUYER_SECRET;
const e2eDatabaseUrl = getIsolatedE2ETestDatabaseUrl({
  nodeEnv: process.env.NODE_ENV,
  testDatabaseUrl: process.env.E2E_TEST_DATABASE_URL,
  applicationDatabaseUrl: process.env.DATABASE_URL,
  allowRemoteDatabase: process.env.E2E_ALLOW_REMOTE_DATABASE
});
let api: APIRequestContext;
let otherBuyerApi: APIRequestContext;
let anonymousApi: APIRequestContext;
const prisma = new PrismaClient({ datasources: { db: { url: e2eDatabaseUrl } } });

before(async () => {
  if (!baseURL || !buyerSecret) throw new Error('E2E_BASE_URL_AND_BUYER_SECRET_REQUIRED');
  const target = new URL(baseURL);
  if (!['http:', 'https:'].includes(target.protocol)) throw new Error('E2E_TARGET_MUST_USE_HTTP_OR_HTTPS');
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(target.hostname) && process.env.E2E_ALLOW_REMOTE_TARGET !== 'true') {
    throw new Error('E2E_REMOTE_TARGET_REQUIRES_E2E_ALLOW_REMOTE_TARGET');
  }
  api = await request.newContext({
    baseURL,
    extraHTTPHeaders: {
      Accept: 'application/json',
      Authorization: `Bearer ${jwt.sign({ id: buyerId, role: 'buyer', customerId: buyerId }, buyerSecret, { expiresIn: '10m' })}`
    }
  });
  otherBuyerApi = await request.newContext({
    baseURL,
    extraHTTPHeaders: {
      Accept: 'application/json',
      Authorization: `Bearer ${jwt.sign({ id: otherBuyerId, role: 'buyer', customerId: otherBuyerId }, buyerSecret, { expiresIn: '10m' })}`
    }
  });
  anonymousApi = await request.newContext({ baseURL, extraHTTPHeaders: { Accept: 'application/json' } });
});

after(async () => {
  await api?.dispose();
  await otherBuyerApi?.dispose();
  await anonymousApi?.dispose();
  await prisma.$disconnect();
});

test('public product APIs filter private data and bind vault access to the authenticated buyer', async () => {
  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
  const merchantId = product.merchantId;
  assert.ok(merchantId);
  const merchant = await prisma.merchant.findUniqueOrThrow({
    where: { id: merchantId },
    select: { storefrontEnabled: true, storefrontAiEnabled: true, isVerified: true }
  });
  const otherBuyer = await prisma.customer.upsert({
    where: { id: otherBuyerId },
    update: { status: 'approved' },
    create: {
      id: otherBuyerId,
      companyName: 'E2E Other Buyer Ltd',
      vatNumber: 'E2E-OTHER-BUYER-VAT',
      address: 'E2E Other Test Address',
      city: 'Milan',
      country: 'IT',
      contactPerson: 'E2E Other Buyer',
      phone: '+390000000002',
      email: 'other-buyer@example.test',
      status: 'approved',
      registrationDate: new Date().toISOString()
    }
  });
  const otherBuyerAuthorization = await prisma.vaultAccessRequest.create({
    data: {
      merchantId,
      merchantName: 'E2E Test Merchant',
      customerId: otherBuyer.id,
      companyName: otherBuyer.companyName,
      contactPerson: otherBuyer.contactPerson,
      phone: otherBuyer.phone,
      businessType: 'retailer',
      status: 'approved',
      appliedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    }
  });
  const promotionCode = `E2E${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
  const promotion = await prisma.promotionRule.create({
    data: {
      code: promotionCode,
      type: 'fixed_amount',
      scope: 'sitewide',
      appliesOn: 'both',
      name: 'E2E visibility promotion',
      fixedAmountOff: 5,
      startsAt: new Date(Date.now() - 60_000),
      isActive: true
    }
  });

  try {
    await prisma.product.update({
      where: { id: productId },
      data: {
        visibility: 'public',
        isExclusiveProtected: false,
        costPrice: 77.77,
        skus: JSON.stringify([{ sku: 'E2E-SKU-1', color: 'Black', size: 'M', cost: 77.77 }])
      }
    });
    const publicDetail = await anonymousApi.get(`/api/products/${encodeURIComponent(productId)}`);
    assert.equal(publicDetail.status(), 200);
    const publicProduct = (await publicDetail.json()).product;
    assert.equal('costPrice' in publicProduct, false);
    assert.equal('cost' in publicProduct.skus[0], false);
    const publicSingleItemLink = await anonymousApi.post('/api/storefront/single-item-link', {
      data: { productId, sku: 'E2E-SKU-1' }
    });
    // Single-item links open a paid checkout, so the endpoint refuses while PAYMENT_ENABLED=false.
    // The link shape is only observable with a configured provider, which this isolated run does not
    // have; the visible-product branch is therefore asserted through the gate response.
    assert.equal(publicSingleItemLink.status(), 503, await publicSingleItemLink.text());
    assert.equal((await publicSingleItemLink.json()).error, 'ONLINE_PAYMENT_NOT_CONFIGURED');
    const anonymousPromotionQuote = await anonymousApi.post('/api/promotions/quote', {
      data: { code: promotionCode, items: [{ productId, sku: 'E2E-SKU-1', quantity: 1 }] }
    });
    assert.equal(anonymousPromotionQuote.status(), 401);
    const authorizedPromotionQuote = await api.post('/api/promotions/quote', {
      data: { code: promotionCode, items: [{ productId, sku: 'E2E-SKU-1', quantity: 1 }] }
    });
    assert.equal(authorizedPromotionQuote.status(), 200, await authorizedPromotionQuote.text());
    const publicSitemap = await anonymousApi.get('/sitemap.xml', {
      headers: { Host: 'e2e-test-merchant.ruda.fashion' }
    });
    assert.equal(publicSitemap.status(), 200);
    assert.match(await publicSitemap.text(), new RegExp(`/product/${productId}`));

    const supplierResponse = await api.get(`/api/suppliers?customerId=${encodeURIComponent(otherBuyerId)}`);
    assert.equal(supplierResponse.status(), 200);
    const supplier = (await supplierResponse.json()).suppliers.find((item: { id: string }) => item.id === merchantId);
    assert.equal(supplier.privateCollection.accessStatus, 'none');
    assert.equal(supplier.privateCollection.hasAccess, false);
    assert.equal(supplier.store.publicCount, 1);
    assert.equal('costPrice' in supplier.store.topProducts[0], false);

    await prisma.product.update({
      where: { id: productId },
      data: {
        visibility: 'private',
        isExclusiveProtected: true,
        styleNo: 'E2E-PRIVATE-SENTINEL',
        name: 'E2E-PRIVATE-SENTINEL'
      }
    });
    const anonymousProducts = await anonymousApi.get('/api/products');
    assert.equal(anonymousProducts.status(), 200);
    assert.equal(
      (await anonymousProducts.json()).products.some((item: { id: string }) => item.id === productId),
      false
    );
    const privateDetail = await anonymousApi.get(`/api/products/${encodeURIComponent(productId)}`);
    assert.equal(privateDetail.status(), 404);
    const privateSingleItemLink = await anonymousApi.post('/api/storefront/single-item-link', {
      data: { productId, sku: 'E2E-SKU-1' }
    });
    assert.equal(privateSingleItemLink.status(), 404);
    await prisma.merchant.update({
      where: { id: merchantId },
      data: { storefrontEnabled: true, storefrontAiEnabled: true, isVerified: true }
    });
    const storefrontAssistant = await anonymousApi.post('/api/merchant-ai/support/chat', {
      data: { merchantId, message: '有哪些商品现货？' }
    });
    assert.equal(storefrontAssistant.status(), 200);
    // The assistant copy is generated from the live catalog, so the invariant under test is that the
    // private sentinel product is never disclosed to an anonymous buyer.
    const storefrontAssistantReply = (await storefrontAssistant.json()).reply as string;
    assert.equal(typeof storefrontAssistantReply, 'string');
    assert.ok(storefrontAssistantReply.trim().length > 0);
    assert.doesNotMatch(storefrontAssistantReply, /E2E-PRIVATE-SENTINEL/);
    const privatePromotionQuote = await api.post('/api/promotions/quote', {
      data: { code: promotionCode, items: [{ productId, sku: 'E2E-SKU-1', quantity: 1 }] }
    });
    assert.equal(privatePromotionQuote.status(), 409);
    assert.equal((await privatePromotionQuote.json()).error, 'PRODUCT_NOT_AVAILABLE');
    const privateSitemap = await anonymousApi.get('/sitemap.xml', {
      headers: { Host: 'e2e-test-merchant.ruda.fashion' }
    });
    assert.equal(privateSitemap.status(), 200);
    assert.doesNotMatch(await privateSitemap.text(), new RegExp(`/product/${productId}`));

    const unauthorizedOcr = await api.post('/api/po/ocr-parse', {
      data: { text: 'E2E-PRIVATE-SENTINEL Black M 6' }
    });
    assert.equal(unauthorizedOcr.status(), 200);
    assert.equal((await unauthorizedOcr.json()).matchedItems.length, 0);
    const authorizedOcr = await otherBuyerApi.post('/api/po/ocr-parse', {
      data: { text: 'E2E-PRIVATE-SENTINEL Black M 6' }
    });
    assert.equal(authorizedOcr.status(), 200);
    assert.equal((await authorizedOcr.json()).matchedItems[0].productId, productId);

    await prisma.vaultAccessRequest.create({
      data: {
        merchantId,
        merchantName: 'E2E Test Merchant',
        customerId: buyerId,
        companyName: 'E2E Test Buyer Ltd',
        contactPerson: 'E2E Buyer',
        phone: '+390000000001',
        businessType: 'retailer',
        status: 'approved',
        appliedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() - 60_000).toISOString()
      }
    });
    const expiredAuthorizationOrder = await api.post('/api/orders', {
      data: {
        masterOrder: {
          orderNo: `E2E-VAULT-EXPIRED-${crypto.randomUUID()}`,
          date: new Date().toISOString(),
          items: [{ productId, sku: 'E2E-SKU-1', quantity: 1, color: 'Black', size: 'M' }],
          paymentMethod: 'bank_transfer',
          deliveryType: 'shipping',
          shippingAddress: { street: 'Test Street 1', city: 'Milan', country: 'IT', zip: '20100' }
        }
      }
    });
    assert.equal(expiredAuthorizationOrder.status(), 409);
    assert.equal((await expiredAuthorizationOrder.json()).error, 'PRIVATE_PRODUCT_NOT_AUTHORIZED');

    await prisma.vaultAccessRequest.update({
      where: { id: otherBuyerAuthorization.id },
      data: { expiresAt: new Date(Date.now() - 60_000).toISOString() }
    });
  } finally {
    await prisma.product.update({
      where: { id: productId },
      data: {
        visibility: product.visibility,
        isExclusiveProtected: product.isExclusiveProtected,
        costPrice: product.costPrice,
        skus: product.skus,
        styleNo: product.styleNo,
        name: product.name
      }
    });
    await prisma.merchant.update({
      where: { id: merchantId },
      data: {
        storefrontEnabled: merchant.storefrontEnabled,
        storefrontAiEnabled: merchant.storefrontAiEnabled,
        isVerified: merchant.isVerified
      }
    });
    await prisma.vaultAccessRequest.deleteMany({ where: { customerId: { in: [buyerId, otherBuyerId] }, merchantId } });
    await prisma.promotionRule.delete({ where: { id: promotion.id } });
    await prisma.customer.deleteMany({ where: { id: otherBuyerId } });
  }
});

test('B2C checkout validates ownership, replays idempotently, and cancels without stock drift', async () => {
  const ready = await api.get('/api/health/ready');
  assert.equal(ready.status(), 200);

  const orderNo = `E2E-B2C-${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
  const checkout = {
    masterOrder: {
      orderNo,
      date: new Date().toISOString(),
      items: [{ productId, sku: 'E2E-SKU-1', quantity: 1, color: 'Black', size: 'M' }],
      paymentMethod: 'bank_transfer',
      deliveryType: 'shipping',
      shippingAddress: { street: 'Test Street 1', city: 'Milan', country: 'IT', zip: '20100' }
    }
  };

  const created = await api.post('/api/orders', { data: checkout });
  assert.equal(created.status(), 201, await created.text());
  const createdPayload = await created.json();
  assert.equal(createdPayload.success, true);
  // 现行下单合同：只创建待商家确认的银行转账订单，不在下单阶段发起在线支付。
  assert.equal(createdPayload.payment, undefined);
  assert.equal(createdPayload.orders[0].status, 'pending');
  assert.equal(createdPayload.orders[0].paymentStatus, 'unpaid');
  assert.equal(createdPayload.orders[0].paymentMethod, 'bank_transfer');
  const orderId = createdPayload.orders[0].id as string;

  const replay = await api.post('/api/orders', { data: checkout });
  assert.equal(replay.status(), 200);
  assert.equal((await replay.json()).idempotentReplay, true);

  const location = await prisma.warehouseLocation.findFirstOrThrow({
    where: { merchantId: null, code: SINGLE_WAREHOUSE_CODE },
    select: { id: true }
  });
  const variant = await prisma.productVariant.findUniqueOrThrow({
    where: { productId_sku: { productId, sku: 'E2E-SKU-1' } },
    select: { id: true }
  });
  const balance = () => prisma.inventoryBalance.findUniqueOrThrow({
    where: { variantId_locationId: { variantId: variant.id, locationId: location.id } },
    select: { onHandQuantity: true }
  });
  // 银行转账订单在商家确认前不动库存；确认 / 拣货阶段才按既有规则处理。
  assert.equal((await balance()).onHandQuantity, 20);

  const foreignPayment = await otherBuyerApi.post(`/api/orders/${encodeURIComponent(orderId)}/payment`);
  assert.equal(foreignPayment.status(), 404);
  assert.equal((await foreignPayment.json()).error, 'ORDER_NOT_FOUND');

  // 银行转账订单需先由商家确认协议才能付款；确认前发起付款返回 409。
  const paymentRetry = await api.post(`/api/orders/${encodeURIComponent(orderId)}/payment`);
  assert.equal(paymentRetry.status(), 409);
  assert.equal((await paymentRetry.json()).error, 'AGREEMENT_CONFIRMATION_REQUIRED');

  const cancelled = await api.post(`/api/orders/${encodeURIComponent(orderId)}/cancel`, { data: { reason: 'E2E payment unavailable' } });
  assert.equal(cancelled.status(), 200);
  assert.equal((await cancelled.json()).order.status, 'cancelled');
  assert.equal((await balance()).onHandQuantity, 20);
});
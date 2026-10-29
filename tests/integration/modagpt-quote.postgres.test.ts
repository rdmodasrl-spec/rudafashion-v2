import 'dotenv/config';
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import {
  createModaGptMerchantTools,
  quoteSnapshotFingerprint
} from '../../src/server/modagptMerchantTools';
import { executeModaGptMerchantTask } from '../../src/server/modagptMerchantTaskExecutor';
import { superviseModaGptCoreTask } from '../../src/server/modagptTaskSupervisor';

const databaseUrl = process.env.BILLING_TEST_DATABASE_URL;
if (process.env.NODE_ENV !== 'test') throw new Error('MODAGPT_POSTGRES_INTEGRATION_REQUIRES_NODE_ENV_TEST');
if (!databaseUrl) throw new Error('BILLING_TEST_DATABASE_URL_REQUIRED');

const parsedTestUrl = new URL(databaseUrl);
const databaseName = decodeURIComponent(parsedTestUrl.pathname.replace(/^\//, '').split('/')[0] || '');
if (!/(^|[-_])(test|e2e)([-_]|$)/i.test(databaseName)) {
  throw new Error('BILLING_TEST_DATABASE_NAME_MUST_INCLUDE_TEST_OR_E2E');
}
if (process.env.DATABASE_URL) {
  const configuredUrl = new URL(process.env.DATABASE_URL);
  if (configuredUrl.host === parsedTestUrl.host && configuredUrl.pathname === parsedTestUrl.pathname) {
    throw new Error('BILLING_TEST_DATABASE_MUST_NOT_MATCH_APPLICATION_DATABASE');
  }
}
if (!['localhost', '127.0.0.1', '::1'].includes(parsedTestUrl.hostname)
  && process.env.ALLOW_REMOTE_BILLING_TEST_DATABASE !== 'true') {
  throw new Error('REMOTE_BILLING_TEST_DATABASE_REQUIRES_EXPLICIT_OPT_IN');
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
class RollbackQuoteIntegrationRun extends Error {}

test('PostgreSQL persists approval, CAS, quote delivery evidence, audit, tenant isolation, and rollback', async () => {
  const merchantCustomer = await prisma.merchantCustomerLink.findFirst({
    select: { merchantId: true, customerId: true }
  });
  assert.ok(merchantCustomer, 'Seed the isolated test database with a merchant-customer link first');

  const suffix = randomUUID();
  const quoteId = `quote-it-${suffix}`;
  const quoteNo = `Q-IT-${suffix}`;
  const approvalTaskId = `quote-send-it-${suffix}`;
  const traceId = `trace-it-${suffix}`;
  const expiresAt = new Date(Date.now() + 60_000);

  await assert.rejects(prisma.$transaction(async tx => {
    const quote = await tx.salesQuote.create({
      data: {
        id: quoteId,
        quoteNo,
        merchantId: merchantCustomer.merchantId,
        customerId: merchantCustomer.customerId,
        createdBy: 'modagpt-postgres-integration',
        status: 'draft',
        totalAmount: 25,
        items: {
          create: [{
            productId: `product-it-${suffix}`,
            sku: `SKU-${suffix}`,
            styleNo: 'IT-QUOTE',
            productName: 'Integration test quote item',
            color: 'test',
            size: 'test',
            quantity: 1,
            unitPrice: 25
          }]
        }
      }
    });
    const approval = await tx.modaGptApproval.create({
      data: {
        merchantId: merchantCustomer.merchantId,
        taskId: approvalTaskId,
        toolId: 'send_quote',
        resourceId: quoteId,
        payload: JSON.stringify({ quoteId, fingerprint: `fingerprint-${suffix}`, recipient: 'integration@example.test' }),
        status: 'pending',
        requestedBy: 'integration-user',
        expiresAt
      }
    });
    const pendingUpdateApproval = await tx.modaGptApproval.create({
      data: {
        merchantId: merchantCustomer.merchantId,
        taskId: `quote-update-it-${suffix}`,
        toolId: 'update_quote',
        resourceId: quoteId,
        payload: JSON.stringify({ quoteId, fingerprint: `old-${suffix}` }),
        status: 'pending',
        requestedBy: 'integration-user',
        expiresAt
      }
    });

    const approved = await tx.modaGptApproval.updateMany({
      where: { id: approval.id, merchantId: merchantCustomer.merchantId, status: 'pending' },
      data: { status: 'approved' }
    });
    assert.equal(approved.count, 1);
    const claimed = await tx.salesQuote.updateMany({
      where: { id: quote.id, merchantId: merchantCustomer.merchantId, status: 'draft', updatedAt: quote.updatedAt },
      data: {
        status: 'approved',
        deliveryStatus: 'SENDING',
        sendProvider: 'resend',
        sentRecipient: 'integration@example.test',
        sendTaskId: approvalTaskId,
        sendTraceId: traceId
      }
    });
    assert.equal(claimed.count, 1);
    const staleCas = await tx.salesQuote.updateMany({
      where: { id: quote.id, merchantId: merchantCustomer.merchantId, status: 'draft', updatedAt: quote.updatedAt },
      data: { status: 'sent' }
    });
    assert.equal(staleCas.count, 0);

    const otherTenantQuote = await tx.salesQuote.findFirst({
      where: { id: quote.id, merchantId: `not-${merchantCustomer.merchantId}` }
    });
    assert.equal(otherTenantQuote, null);

    await tx.modaGptApproval.updateMany({
      where: { id: approval.id, merchantId: merchantCustomer.merchantId, status: 'approved' },
      data: { status: 'processing' }
    });
    const sentAt = new Date();
    const sent = await tx.salesQuote.updateMany({
      where: {
        id: quote.id,
        merchantId: merchantCustomer.merchantId,
        customerId: merchantCustomer.customerId,
        status: 'approved',
        deliveryStatus: 'SENDING',
        sendTaskId: approvalTaskId,
        sendTraceId: traceId
      },
      data: {
        status: 'sent',
        deliveryStatus: 'SENT',
        sentAt,
        sendProvider: 'resend',
        sendProviderMessageId: `resend-${suffix}`,
        sendResult: JSON.stringify({ status: 'SENT', taskId: approvalTaskId, traceId }),
        sendFailureReason: null
      }
    });
    assert.equal(sent.count, 1);
    const savedDelivery = await tx.salesQuote.findFirst({
      where: {
        id: quote.id,
        merchantId: merchantCustomer.merchantId,
        deliveryStatus: 'SENT',
        sendProvider: 'resend',
        sendTaskId: approvalTaskId,
        sendTraceId: traceId,
        sendProviderMessageId: `resend-${suffix}`
      }
    });
    assert.ok(savedDelivery);
    const consumed = await tx.modaGptApproval.updateMany({
      where: { id: approval.id, merchantId: merchantCustomer.merchantId, status: 'processing' },
      data: { status: 'consumed' }
    });
    assert.equal(consumed.count, 1);
    const invalidated = await tx.modaGptApproval.updateMany({
      where: { id: pendingUpdateApproval.id, merchantId: merchantCustomer.merchantId, status: 'pending' },
      data: { status: 'expired', decisionNote: 'Quote changed after approval.' }
    });
    assert.equal(invalidated.count, 1);
    const duplicateRetry = await tx.salesQuote.updateMany({
      where: { id: quote.id, merchantId: merchantCustomer.merchantId, status: 'approved' },
      data: { status: 'sent' }
    });
    assert.equal(duplicateRetry.count, 0);
    await tx.employeeAuditLog.create({
      data: {
        id: `audit-${suffix}`,
        merchantId: merchantCustomer.merchantId,
        action: 'MODAGPT_QUOTE_SENT',
        entityType: 'SalesQuote',
        entityId: quote.id,
        metadata: JSON.stringify({ taskId: approvalTaskId, traceId, providerMessageId: `resend-${suffix}` })
      }
    });
    throw new RollbackQuoteIntegrationRun();
  }), RollbackQuoteIntegrationRun);

  assert.equal(await prisma.salesQuote.findUnique({ where: { id: quoteId } }), null);
  assert.equal(await prisma.modaGptApproval.findUnique({
    where: { merchantId_taskId_toolId: { merchantId: merchantCustomer.merchantId, taskId: approvalTaskId, toolId: 'send_quote' } }
  }), null);
  assert.equal(await prisma.employeeAuditLog.findUnique({ where: { id: `audit-${suffix}` } }), null);
});

test('PostgreSQL Quote Tool sends once, persists provider evidence, and retries a failed delivery', async () => {
  const merchantCustomer = await prisma.merchantCustomerLink.findFirst({
    where: { customer: { status: 'approved', email: { not: '' } } },
    select: { merchantId: true, customerId: true, customer: { select: { email: true } } }
  });
  assert.ok(merchantCustomer, 'Seed an approved merchant-linked customer with an email in the isolated test database');

  const suffix = randomUUID();
  const quoteId = `quote-send-it-${suffix}`;
  const quoteNo = `Q-SEND-IT-${suffix}`;
  const approvalTaskId = `quote-send-task-${suffix}`;
  const traceId = `quote-send-trace-${suffix}`;
  let providerAttempts = 0;
  let failFirstAttempt = true;

  try {
    const quote = await prisma.salesQuote.create({
      data: {
        id: quoteId,
        quoteNo,
        merchantId: merchantCustomer.merchantId,
        customerId: merchantCustomer.customerId,
        createdBy: 'modagpt-postgres-integration',
        status: 'approved',
        currency: 'EUR',
        totalQty: 1,
        totalAmount: 25,
        items: {
          create: [{
            productId: `product-send-it-${suffix}`,
            sku: `SKU-SEND-${suffix}`,
            styleNo: 'IT-QUOTE-SEND',
            productName: 'Integration test delivery',
            color: 'test',
            size: 'test',
            quantity: 1,
            unitPrice: 25
          }]
        }
      },
      include: { items: true }
    });
    const approval = await prisma.modaGptApproval.create({
      data: {
        merchantId: merchantCustomer.merchantId,
        taskId: approvalTaskId,
        toolId: 'send_quote',
        resourceId: quoteId,
        payload: JSON.stringify({
          action: 'send',
          quoteId,
          fingerprint: quoteSnapshotFingerprint(quote),
          recipient: merchantCustomer.customer.email.trim().toLowerCase()
        }),
        status: 'approved',
        requestedBy: 'integration-user',
        expiresAt: new Date(Date.now() + 60_000)
      }
    });

    const tools = createModaGptMerchantTools({
      prisma,
      taskId: approvalTaskId,
      traceId,
      actorId: 'integration-worker',
      employeeId: null,
      sendQuote: async () => {
        providerAttempts += 1;
        if (failFirstAttempt) {
          failFirstAttempt = false;
          throw new Error('RESEND_TEST_TRANSIENT_FAILURE');
        }
        return { provider: 'resend', providerMessageId: `resend-test-${suffix}` };
      }
    });
    const sendInput = { quoteId, approvalId: approval.id };
    await assert.rejects(
      tools.handlers.send_quote(merchantCustomer.merchantId, sendInput, new AbortController().signal),
      /RESEND_TEST_TRANSIENT_FAILURE/
    );

    const failedQuote = await prisma.salesQuote.findFirst({
      where: { id: quoteId, merchantId: merchantCustomer.merchantId }
    });
    assert.equal(failedQuote?.status, 'approved');
    assert.equal(failedQuote?.deliveryStatus, 'FAILED');
    assert.equal(failedQuote?.sendFailureReason, 'RESEND_TEST_TRANSIENT_FAILURE');
    assert.equal(failedQuote?.sendTaskId, approvalTaskId);
    assert.equal(failedQuote?.sendTraceId, traceId);
    assert.equal((await prisma.modaGptApproval.findUnique({ where: { id: approval.id } }))?.status, 'processing');

    const sent = await tools.handlers.send_quote(
      merchantCustomer.merchantId,
      sendInput,
      new AbortController().signal
    ) as { status: string; verified: boolean; providerMessageId: string };
    assert.equal(sent.status, 'sent');
    assert.equal(sent.verified, true);
    assert.equal(sent.providerMessageId, `resend-test-${suffix}`);
    assert.equal(providerAttempts, 2);

    const persisted = await prisma.salesQuote.findFirst({
      where: {
        id: quoteId,
        merchantId: merchantCustomer.merchantId,
        status: 'sent',
        deliveryStatus: 'SENT',
        sendProvider: 'resend',
        sendProviderMessageId: `resend-test-${suffix}`,
        sentRecipient: merchantCustomer.customer.email,
        sendTaskId: approvalTaskId,
        sendTraceId: traceId
      }
    });
    assert.ok(persisted?.sentAt);
    assert.equal(persisted?.sendFailureReason, null);
    assert.equal((await prisma.modaGptApproval.findUnique({ where: { id: approval.id } }))?.status, 'consumed');
    assert.ok(await prisma.employeeAuditLog.findFirst({
      where: {
        merchantId: merchantCustomer.merchantId,
        entityType: 'SalesQuote',
        entityId: quoteId,
        action: 'MODAGPT_QUOTE_SENT'
      }
    }));

    const duplicate = await tools.handlers.send_quote(
      merchantCustomer.merchantId,
      sendInput,
      new AbortController().signal
    ) as { status: string; providerMessageId: string };
    assert.equal(duplicate.status, 'sent');
    assert.equal(duplicate.providerMessageId, `resend-test-${suffix}`);
    assert.equal(providerAttempts, 2);
  } finally {
    await prisma.employeeAuditLog.deleteMany({
      where: { merchantId: merchantCustomer.merchantId, entityType: 'SalesQuote', entityId: quoteId }
    });
    await prisma.modaGptApproval.deleteMany({
      where: { merchantId: merchantCustomer.merchantId, resourceId: quoteId }
    });
    await prisma.salesQuote.deleteMany({
      where: { id: quoteId, merchantId: merchantCustomer.merchantId }
    });
  }
});

test('PostgreSQL ModaGPT Product Tool approves, publishes, verifies, and unpublishes a merchant product', async () => {
  const merchant = await prisma.merchant.findFirst({ select: { id: true } });
  assert.ok(merchant, 'Seed the isolated test database with a merchant first');

  const suffix = randomUUID();
  const productId = `product-it-${suffix}`;
  const categorySlug = `it-${suffix}`;
  const publishTaskId = `product-publish-it-${suffix}`;
  const unpublishTaskId = `product-unpublish-it-${suffix}`;
  const toolset = createModaGptMerchantTools({
    prisma,
    taskId: publishTaskId,
    traceId: `trace-product-it-${suffix}`,
    actorId: 'modagpt-postgres-integration',
    employeeId: null
  });
  const route = superviseModaGptCoreTask({
    request: '发布商品',
    assignedAgents: ['product-creative-manager', 'business-manager'],
    registeredWorkflows: ['product_publish'],
    registeredTools: toolset.definitions.map(definition => definition.name)
  });
  assert.ok(route);
  assert.equal(route.execution, 'ready');

  try {
    await prisma.merchantStoreCategory.create({
      data: {
        merchantId: merchant.id,
        name: `Integration ${suffix}`,
        slug: categorySlug,
        isActive: true
      }
    });
    const product = await prisma.product.create({
      data: {
        id: productId,
        merchantId: merchant.id,
        styleNo: `IT-${suffix}`,
        name: 'Integration Product',
        category: categorySlug,
        subCategory: 'test',
        brand: 'ModaGPT Integration',
        season: 'test',
        images: JSON.stringify(['https://example.test/integration-product.jpg']),
        media: JSON.stringify([{ id: 'cover', type: 'image', url: 'https://example.test/integration-product.jpg' }]),
        wholesalePrice: 12.5,
        rrpPrice: 25,
        moq: 2,
        packSize: 1,
        status: 'new',
        inventoryStatus: 'coming_soon',
        origin: 'test',
        fabric: 'test',
        composition: 'test',
        weight: 'test',
        packaging: 'test',
        washCare: 'test',
        description: 'PostgreSQL integration fixture',
        skus: JSON.stringify([{ sku: `IT-${suffix}-BLK-S`, color: 'Black', size: 'S' }]),
        lifecycleStatus: 'draft'
      },
      select: {
        styleNo: true,
        name: true,
        category: true,
        subCategory: true,
        season: true,
        wholesalePrice: true,
        rrpPrice: true,
        moq: true,
        packSize: true,
        description: true,
        skus: true,
        images: true,
        media: true,
        updatedAt: true
      }
    });
    const request = await executeModaGptMerchantTask({
      prisma,
      merchantId: merchant.id,
      taskId: publishTaskId,
      traceId: `trace-product-it-${suffix}`,
      actorId: 'modagpt-postgres-integration',
      employeeId: null,
      message: '发布商品',
      inputs: { productAction: 'publish', productId },
      route
    });
    assert.equal(request.status, 'approval_required');
    assert.ok(request.approvalId);
    assert.equal((await prisma.product.findUnique({ where: { id: productId } }))?.lifecycleStatus, 'draft');

    const approved = await prisma.modaGptApproval.updateMany({
      where: { id: request.approvalId, merchantId: merchant.id, status: 'pending' },
      data: { status: 'approved' }
    });
    assert.equal(approved.count, 1);
    const published = await executeModaGptMerchantTask({
      prisma,
      merchantId: merchant.id,
      taskId: `product-publish-worker-${suffix}`,
      traceId: `trace-product-publish-worker-${suffix}`,
      actorId: 'modagpt-postgres-integration',
      employeeId: null,
      message: '发布商品',
      inputs: { productAction: 'publish', productId },
      route,
      approvalId: request.approvalId
    });
    assert.equal(published.status, 'published');
    const persistedPublished = await prisma.product.findFirst({
      where: { id: productId, merchantId: merchant.id },
      select: { lifecycleStatus: true, styleNo: true, wholesalePrice: true, moq: true, skus: true }
    });
    assert.equal(persistedPublished?.lifecycleStatus, 'published');
    assert.equal(persistedPublished?.styleNo, product.styleNo);
    assert.equal(Number(persistedPublished?.wholesalePrice), 12.5);
    assert.equal(persistedPublished?.moq, 2);
    assert.equal((await prisma.modaGptApproval.findFirst({
      where: { id: request.approvalId, merchantId: merchant.id }
    }))?.status, 'consumed');

    const unpublishTools = createModaGptMerchantTools({
      prisma,
      taskId: unpublishTaskId,
      traceId: `trace-product-unpublish-it-${suffix}`,
      actorId: 'modagpt-postgres-integration',
      employeeId: null
    });
    const unpublishRoute = superviseModaGptCoreTask({
      request: '下架商品',
      assignedAgents: ['product-creative-manager', 'business-manager'],
      registeredWorkflows: ['product_publish'],
      registeredTools: unpublishTools.definitions.map(definition => definition.name)
    });
    assert.ok(unpublishRoute);
    assert.equal(unpublishRoute.execution, 'ready');
    const unpublishRequest = await executeModaGptMerchantTask({
      prisma,
      merchantId: merchant.id,
      taskId: unpublishTaskId,
      traceId: `trace-product-unpublish-it-${suffix}`,
      actorId: 'modagpt-postgres-integration',
      employeeId: null,
      message: '下架商品',
      inputs: { productAction: 'unpublish', productId },
      route: unpublishRoute
    });
    assert.equal(unpublishRequest.status, 'approval_required');
    assert.ok(unpublishRequest.approvalId);
    await prisma.modaGptApproval.updateMany({
      where: { id: unpublishRequest.approvalId, merchantId: merchant.id, status: 'pending' },
      data: { status: 'approved' }
    });
    const unpublished = await executeModaGptMerchantTask({
      prisma,
      merchantId: merchant.id,
      taskId: `product-unpublish-worker-${suffix}`,
      traceId: `trace-product-unpublish-worker-${suffix}`,
      actorId: 'modagpt-postgres-integration',
      employeeId: null,
      message: '下架商品',
      inputs: { productAction: 'unpublish', productId },
      route: unpublishRoute,
      approvalId: unpublishRequest.approvalId
    });
    assert.equal(unpublished.status, 'unpublished');
    assert.equal((await prisma.product.findFirst({
      where: { id: productId, merchantId: merchant.id },
      select: { lifecycleStatus: true }
    }))?.lifecycleStatus, 'draft');

    const otherMerchant = await prisma.merchant.findFirst({
      where: { id: { not: merchant.id } },
      select: { id: true }
    });
    if (otherMerchant) {
      assert.equal(await prisma.product.findFirst({
        where: { id: productId, merchantId: otherMerchant.id },
        select: { id: true }
      }), null);
    }
    assert.ok(await prisma.employeeAuditLog.findFirst({
      where: {
        merchantId: merchant.id,
        entityType: 'ModaGptTask',
        action: 'MODAGPT_TOOL_SUCCEEDED'
      }
    }));
  } finally {
    await prisma.employeeAuditLog.deleteMany({
      where: { merchantId: merchant.id, entityType: 'ModaGptTask', entityId: { in: [publishTaskId, unpublishTaskId, `product-publish-worker-${suffix}`, `product-unpublish-worker-${suffix}`] } }
    });
    await prisma.modaGptApproval.deleteMany({
      where: { merchantId: merchant.id, resourceId: productId }
    });
    await prisma.product.deleteMany({ where: { id: productId, merchantId: merchant.id } });
    await prisma.merchantStoreCategory.deleteMany({ where: { merchantId: merchant.id, slug: categorySlug } });
  }
});

test.after(async () => {
  await prisma.$disconnect();
});

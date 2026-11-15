import 'dotenv/config';
import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { ModaGptBrainService } from '../../src/server/modagptBrainService';

const databaseUrl = process.env.MODAGPT_TEST_DATABASE_URL || process.env.BILLING_TEST_DATABASE_URL;
if (process.env.NODE_ENV !== 'test') throw new Error('MODAGPT_POSTGRES_INTEGRATION_REQUIRES_NODE_ENV_TEST');
if (!databaseUrl) throw new Error('MODAGPT_TEST_DATABASE_URL_REQUIRED');

const parsedTestUrl = new URL(databaseUrl);
const databaseName = decodeURIComponent(parsedTestUrl.pathname.replace(/^\//, '').split('/')[0] || '');
if (!/(^|[-_])(test|e2e)([-_]|$)/i.test(databaseName)) {
  throw new Error('MODAGPT_TEST_DATABASE_NAME_MUST_INCLUDE_TEST_OR_E2E');
}
if (process.env.DATABASE_URL) {
  const configuredUrl = new URL(process.env.DATABASE_URL);
  if (configuredUrl.host === parsedTestUrl.host && configuredUrl.pathname === parsedTestUrl.pathname) {
    throw new Error('MODAGPT_TEST_DATABASE_MUST_NOT_MATCH_APPLICATION_DATABASE');
  }
}
if (!['localhost', '127.0.0.1', '::1'].includes(parsedTestUrl.hostname)
  && process.env.ALLOW_REMOTE_MODAGPT_TEST_DATABASE !== 'true') {
  throw new Error('REMOTE_MODAGPT_TEST_DATABASE_REQUIRES_EXPLICIT_OPT_IN');
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const service = new ModaGptBrainService(prisma);

after(async () => prisma.$disconnect());

test('PostgreSQL knowledge lifecycle gates retrieval on review, permissions, versioning, expiry, and tenant', async () => {
  const merchantCustomer = await prisma.merchantCustomerLink.findFirst({
    select: { merchantId: true }
  });
  assert.ok(merchantCustomer, 'Seed the isolated test database with a merchant-customer link first');

  const suffix = randomUUID().replace(/-/g, '');
  const sourceId = `brain-integration-${suffix}`;
  const tenantId = merchantCustomer.merchantId;
  const context = {
    tenantId,
    merchantId: tenantId,
    actorId: 'modagpt-brain-integration',
    permissions: ['brain.read', 'brain.write'],
    scopes: ['MERCHANT'] as const
  };
  const resolvedContext = await service.resolveMerchantAccessContext(context);
  const reviewer = { ...resolvedContext, permissions: ['brain.read', 'brain.knowledge.review'] };
  const authorizedReader = { ...resolvedContext, permissions: ['brain.read', 'inventory.read'] };
  const firstToken = `zibraquartz${suffix}`;
  const secondToken = `cobaltvelour${suffix}`;
  const apparelMemoryToken = `apparelmemory${suffix}`;
  const tradeMemoryToken = `tradememory${suffix}`;
  const legacyMemoryToken = `legacymemory${suffix}`;
  const otherTenantId = `other-${tenantId}`;
  const createdDocumentIds: string[] = [];
  const createdMemoryIds: string[] = [];

  try {
    const first = await service.ingestTextDocument(resolvedContext, {
      sourceType: 'DOCUMENT',
      sourceId,
      title: 'Inventory guide',
      mimeType: 'text/markdown',
      authorization: { requiredPermissions: ['inventory.read'] },
      content: `# Replenishment\n\n${firstToken} requires review before inventory updates.`
    });
    createdDocumentIds.push(first.id);
    assert.equal(first.version, 1);
    assert.equal(first.status, 'ingested');
    assert.deepEqual(
      (await service.retrieveBrainContext(resolvedContext, firstToken)).results.map(result => result.sourceRef),
      []
    );
    await assert.rejects(
      service.reviewDocument(resolvedContext, first.id, 'approve'),
      /MODAGPT_BRAIN_KNOWLEDGE_REVIEW_PERMISSION_REQUIRED/
    );
    await service.reviewDocument(reviewer, first.id, 'approve');
    assert.deepEqual(
      (await service.retrieveBrainContext(resolvedContext, firstToken)).results.map(result => result.sourceRef),
      []
    );
    assert.ok((await service.retrieveBrainContext(authorizedReader, firstToken)).results.some(
      result => result.sourceRef === `DOCUMENT:${sourceId}`
    ));

    const second = await service.ingestTextDocument(resolvedContext, {
      sourceType: 'DOCUMENT',
      sourceId,
      title: 'Updated inventory guide',
      mimeType: 'text/markdown',
      content: `${secondToken} replaces the earlier replenishment guidance.`
    });
    createdDocumentIds.push(second.id);
    assert.equal(second.version, 2);
    await service.reviewDocument(reviewer, second.id, 'approve');

    const previous = await prisma.modaGptBrainDocument.findFirst({
      where: { id: first.id, tenantId, merchantId: tenantId },
      select: { status: true }
    });
    assert.equal(previous?.status, 'superseded');
    assert.deepEqual(
      (await service.retrieveBrainContext(resolvedContext, firstToken)).results.map(result => result.sourceRef),
      []
    );
    assert.ok((await service.retrieveBrainContext(resolvedContext, secondToken)).results.some(
      result => result.sourceRef === `DOCUMENT:${sourceId}`
    ));
    const expiredChunks = await prisma.modaGptBrainChunk.updateMany({
      where: { documentId: second.id, tenantId, merchantId: tenantId },
      data: { expiresAt: new Date(Date.now() - 1_000) }
    });
    assert.equal(expiredChunks.count, 1);
    assert.deepEqual(
      (await service.retrieveBrainContext(resolvedContext, secondToken)).results.map(result => result.sourceRef),
      []
    );
    await prisma.modaGptBrainChunk.updateMany({
      where: { documentId: second.id, tenantId, merchantId: tenantId },
      data: { expiresAt: null }
    });
    assert.ok((await service.retrieveBrainContext(resolvedContext, secondToken)).results.some(
      result => result.sourceRef === `DOCUMENT:${sourceId}`
    ));

    const rejectedSourceId = `${sourceId}:rejected`;
    const rejected = await service.ingestTextDocument(resolvedContext, {
      sourceType: 'DOCUMENT',
      sourceId: rejectedSourceId,
      title: 'Rejected guidance',
      content: `rejectedguidance${suffix} must never be published.`
    });
    createdDocumentIds.push(rejected.id);
    await service.reviewDocument(reviewer, rejected.id, 'reject');
    assert.deepEqual(
      (await service.retrieveBrainContext(resolvedContext, `rejectedguidance${suffix}`)).results.map(result => result.sourceRef),
      []
    );

    const staleSourceId = `${sourceId}:out-of-order`;
    const stale = await service.ingestTextDocument(resolvedContext, {
      sourceType: 'DOCUMENT',
      sourceId: staleSourceId,
      title: 'Stale guidance',
      content: `staleguidance${suffix} is an older version.`
    });
    createdDocumentIds.push(stale.id);
    const latest = await service.ingestTextDocument(resolvedContext, {
      sourceType: 'DOCUMENT',
      sourceId: staleSourceId,
      title: 'Latest guidance',
      content: `latestguidance${suffix} replaces the stale version.`
    });
    createdDocumentIds.push(latest.id);
    await service.reviewDocument(reviewer, latest.id, 'approve');
    await assert.rejects(
      service.reviewDocument(reviewer, stale.id, 'approve'),
      /MODAGPT_BRAIN_DOCUMENT_NOT_REVIEWABLE/
    );
    const latestState = await prisma.modaGptBrainDocument.findFirst({
      where: { id: latest.id, tenantId, merchantId: tenantId },
      select: { status: true }
    });
    assert.equal(latestState?.status, 'published');

    const otherTenantSourceId = `${sourceId}:other`;
    const otherTenantToken = `privatetenant${suffix}`;
    const otherTenantDocument = await prisma.modaGptBrainDocument.create({
      data: {
        tenantId: otherTenantId,
        merchantId: otherTenantId,
        industryId: resolvedContext.industryId,
        studioId: resolvedContext.studioId,
        knowledgeNamespace: resolvedContext.knowledgeNamespace,
        sourceType: 'DOCUMENT',
        sourceId: otherTenantSourceId,
        title: 'Other tenant document',
        status: 'published',
        sourceTrust: 'verified',
        chunks: {
          create: [{
            tenantId: otherTenantId,
            merchantId: otherTenantId,
            industryId: resolvedContext.industryId,
            studioId: resolvedContext.studioId,
            knowledgeNamespace: resolvedContext.knowledgeNamespace,
            chunkIndex: 0,
            content: otherTenantToken,
            keywordText: otherTenantToken,
            metadata: '{}',
            authorization: '{}',
            source: 'HUMAN_REVIEW',
            verificationStatus: 'verified'
          }]
        }
      },
      select: { id: true }
    });
    createdDocumentIds.push(otherTenantDocument.id);
    assert.deepEqual(
      (await service.retrieveBrainContext(resolvedContext, otherTenantToken)).results.map(result => result.sourceRef),
      []
    );

    const isolatedToken = `isolatedtrade${suffix}`;
    const otherStudioDocument = await prisma.modaGptBrainDocument.create({
      data: {
        tenantId,
        merchantId: tenantId,
        industryId: 'trade_wholesale',
        studioId: 'trade_studio',
        knowledgeNamespace: 'trade',
        sourceType: 'DOCUMENT',
        sourceId: `${sourceId}:other-studio`,
        title: 'Other industry document',
        status: 'published',
        sourceTrust: 'verified',
        chunks: {
          create: [{
            tenantId,
            merchantId: tenantId,
            industryId: 'trade_wholesale',
            studioId: 'trade_studio',
            knowledgeNamespace: 'trade',
            chunkIndex: 0,
            content: isolatedToken,
            keywordText: isolatedToken,
            metadata: '{}',
            authorization: '{}',
            source: 'HUMAN_REVIEW',
            verificationStatus: 'verified'
          }]
        }
      },
      select: { id: true }
    });
    createdDocumentIds.push(otherStudioDocument.id);
    assert.deepEqual(
      (await service.retrieveBrainContext(resolvedContext, isolatedToken)).results.map(result => result.sourceRef),
      []
    );

    const legacyToken = `legacyunclassified${suffix}`;
    const legacyDocument = await prisma.modaGptBrainDocument.create({
      data: {
        tenantId,
        merchantId: tenantId,
        sourceType: 'DOCUMENT',
        sourceId: `${sourceId}:legacy`,
        title: 'Unclassified historical document',
        status: 'published',
        sourceTrust: 'verified',
        chunks: {
          create: [{
            tenantId,
            merchantId: tenantId,
            chunkIndex: 0,
            content: legacyToken,
            keywordText: legacyToken,
            metadata: '{}',
            authorization: '{}',
            source: 'HUMAN_REVIEW',
            verificationStatus: 'verified'
          }]
        }
      },
      select: { id: true }
    });
    createdDocumentIds.push(legacyDocument.id);
    assert.deepEqual(
      (await service.retrieveBrainContext(resolvedContext, legacyToken)).results.map(result => result.sourceRef),
      []
    );

    await service.invalidateDocument(reviewer, second.id);
    assert.deepEqual(
      (await service.retrieveBrainContext(resolvedContext, secondToken)).results.map(result => result.sourceRef),
      []
    );
    const auditActions = await prisma.employeeAuditLog.findMany({
      where: { entityType: 'ModaGptBrainDocument', entityId: { in: createdDocumentIds } },
      select: { action: true }
    });
    assert.ok(auditActions.some(record => record.action === 'MODAGPT_BRAIN_DOCUMENT_INGESTED'));
    assert.ok(auditActions.some(record => record.action === 'MODAGPT_BRAIN_DOCUMENT_APPROVE'));
    assert.ok(auditActions.some(record => record.action === 'MODAGPT_BRAIN_DOCUMENT_REJECT'));
    assert.ok(auditActions.some(record => record.action === 'MODAGPT_BRAIN_DOCUMENT_INVALIDATED'));

    const apparelMemory = await service.createMemoryCandidate(resolvedContext, {
      category: 'operating_rule',
      scope: 'MERCHANT',
      content: apparelMemoryToken
    });
    createdMemoryIds.push(apparelMemory.id);
    assert.ok((await service.retrieveBrainContext(resolvedContext, apparelMemoryToken)).results
      .some(result => result.id === apparelMemory.id));

    const tradeMemory = await prisma.merchantAiEmployeeMemory.create({
      data: {
        tenantId,
        merchantId: tenantId,
        industryId: 'trade_wholesale',
        studioId: 'trade_studio',
        knowledgeNamespace: 'trade',
        category: 'preference',
        content: tradeMemoryToken
      },
      select: { id: true }
    });
    createdMemoryIds.push(tradeMemory.id);
    const legacyMemory = await prisma.merchantAiEmployeeMemory.create({
      data: {
        tenantId,
        merchantId: tenantId,
        category: 'preference',
        content: legacyMemoryToken
      },
      select: { id: true }
    });
    createdMemoryIds.push(legacyMemory.id);
    const apparelResultsForTradeToken = (await service.retrieveBrainContext(resolvedContext, tradeMemoryToken))
      .results.map(result => result.id);
    const apparelResultsForLegacyToken = (await service.retrieveBrainContext(resolvedContext, legacyMemoryToken))
      .results.map(result => result.id);
    assert.equal(apparelResultsForTradeToken.includes(tradeMemory.id), false);
    assert.equal(apparelResultsForLegacyToken.includes(legacyMemory.id), false);
  } finally {
    await prisma.merchantAiEmployeeMemory.deleteMany({
      where: { id: { in: createdMemoryIds }, merchantId: tenantId }
    });
    await prisma.employeeAuditLog.deleteMany({
      where: { entityType: 'ModaGptBrainDocument', entityId: { in: createdDocumentIds } }
    });
    await prisma.modaGptBrainDocument.deleteMany({
      where: { id: { in: createdDocumentIds } }
    });
  }
});

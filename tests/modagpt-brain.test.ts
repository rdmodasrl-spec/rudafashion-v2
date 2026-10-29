import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@prisma/client';
import {
  evaluateModaGptLessonPromotion,
  isModaGptBrainCandidateEligible,
  rankModaGptBrainCandidates,
  validateModaGptBrainAccessContext,
  type ModaGptBrainAccessContext,
  type ModaGptBrainCandidate
} from '../src/server/modagptBrain';
import { chunkModaGptKnowledgeText, ModaGptBrainService } from '../src/server/modagptBrainService';

const now = new Date('2026-10-01T00:00:00.000Z');
const context: ModaGptBrainAccessContext = {
  tenantId: 'merchant-a',
  merchantId: 'merchant-a',
  actorId: 'employee-a',
  permissions: ['brain.read', 'product.catalog.read'],
  scopes: ['MERCHANT', 'BRAND', 'PRODUCT', 'AGENT']
};

test('knowledge text chunking normalizes Markdown paragraphs and bounds Unicode chunks', () => {
  const chunks = chunkModaGptKnowledgeText('# Inventory\r\n\r\nFirst\tparagraph.\r\n\r\n' + '🧵'.repeat(4_001));

  assert.equal(chunks.length, 3);
  assert.ok(chunks[0].startsWith('# Inventory\n\nFirst    paragraph.'));
  assert.ok(chunks.every(chunk => Array.from(chunk).length <= 4_000));
  assert.equal(chunks.join('').replace(/\n\n/g, '').endsWith('🧵'.repeat(4_001)), true);
});

test('knowledge text chunking rejects empty, control-character and oversized documents', () => {
  assert.throws(() => chunkModaGptKnowledgeText(' \n\t '), /MODAGPT_BRAIN_DOCUMENT_CONTENT_INVALID/);
  assert.throws(() => chunkModaGptKnowledgeText('bad\u0000text'), /MODAGPT_BRAIN_DOCUMENT_CONTENT_INVALID/);
  assert.throws(() => chunkModaGptKnowledgeText('🧵'.repeat(140_000)), /MODAGPT_BRAIN_DOCUMENT_CONTENT_INVALID/);
  assert.equal(chunkModaGptKnowledgeText('🧵'.repeat(128_000)).length, 32);
});

function candidate(overrides: Partial<ModaGptBrainCandidate> = {}): ModaGptBrainCandidate {
  return {
    id: 'memory-1',
    tenantId: 'merchant-a',
    merchantId: 'merchant-a',
    kind: 'memory',
    scope: 'MERCHANT',
    content: 'brand prefers seasonal fashion colors',
    source: 'USER',
    status: 'active',
    verificationStatus: 'human_confirmed',
    confidence: 1,
    importance: 0.8,
    accessCount: 2,
    createdAt: new Date('2026-09-30T00:00:00.000Z'),
    expiresAt: null,
    ...overrides
  };
}

test('brain retrieval enforces exact tenant, merchant, scope and permission filters before ranking', () => {
  const allowed = candidate();
  const results = rankModaGptBrainCandidates('seasonal fashion colors', [
    allowed,
    candidate({ id: 'other-tenant', tenantId: 'merchant-b', merchantId: 'merchant-b' }),
    candidate({ id: 'other-merchant', merchantId: 'merchant-b' }),
    candidate({ id: 'wrong-scope', scope: 'CUSTOMER' }),
    candidate({ id: 'forbidden', requiredPermissions: ['finance.read'] })
  ], context, { now });

  assert.deepEqual(results.map(item => item.id), ['memory-1']);
  assert.equal(isModaGptBrainCandidateEligible(
    candidate({ tenantId: 'merchant-b', merchantId: 'merchant-b' }),
    context,
    now
  ), false);
});

test('brain retrieval supports explicit all-permission principals without bypassing tenant scope', () => {
  const ownerContext = { ...context, permissions: ['brain.read', '*'] };
  const protectedKnowledge = candidate({
    id: 'restricted-knowledge',
    kind: 'knowledge',
    status: 'published',
    verificationStatus: 'verified',
    content: 'inventory replenishment guide',
    requiredPermissions: ['finance.read']
  });
  assert.equal(isModaGptBrainCandidateEligible(protectedKnowledge, context, now), false);
  assert.equal(isModaGptBrainCandidateEligible(protectedKnowledge, ownerContext, now), true);
  assert.equal(isModaGptBrainCandidateEligible(
    { ...protectedKnowledge, tenantId: 'merchant-b', merchantId: 'merchant-b' },
    ownerContext,
    now
  ), false);
});

test('brain ranking can isolate approved knowledge from memories and other record types', () => {
  const results = rankModaGptBrainCandidates('inventory replenishment guide', [
    candidate({
      id: 'matching-memory',
      content: 'inventory replenishment guide',
      confidence: 1,
      importance: 1
    }),
    candidate({
      id: 'approved-knowledge',
      kind: 'knowledge',
      status: 'published',
      verificationStatus: 'verified',
      content: 'inventory replenishment guide',
      confidence: 0.8,
      importance: 0.6
    })
  ], context, { now, kinds: ['knowledge'] });

  assert.deepEqual(results.map(result => result.id), ['approved-knowledge']);
});

test('brain retrieval excludes unverified facts, lessons, stale and future evidence', () => {
  const results = rankModaGptBrainCandidates('black fashion inventory', [
    candidate({ id: 'unverified-fact', kind: 'fact', status: 'candidate', verificationStatus: 'candidate' }),
    candidate({ id: 'unverified-knowledge', kind: 'knowledge', status: 'published', verificationStatus: 'unverified' }),
    candidate({ id: 'unpublished-lesson', kind: 'lesson', status: 'pending_review', verificationStatus: 'verified' }),
    candidate({ id: 'expired', expiresAt: new Date('2026-09-30T23:59:59.000Z') }),
    candidate({ id: 'not-yet-valid', validFrom: new Date('2026-10-02T00:00:00.000Z') })
  ], context, { now });

  assert.deepEqual(results, []);
});

test('brain ranking combines keyword relevance, confidence, recency, importance and optional semantic score', () => {
  const recent = candidate({ id: 'recent', content: 'black dress stock', confidence: 0.9, importance: 0.8 });
  const stale = candidate({
    id: 'stale',
    content: 'black dress stock',
    confidence: 0.7,
    importance: 0.4,
    createdAt: new Date('2024-10-01T00:00:00.000Z')
  });
  const semantic = candidate({
    id: 'semantic',
    content: 'fashion inventory',
    confidence: 0.9,
    importance: 0.8
  });
  const results = rankModaGptBrainCandidates('black dress stock', [stale, semantic, recent], context, {
    now,
    semanticScores: new Map([['semantic', 1]])
  });

  assert.equal(results[0].id, 'recent');
  assert.ok(Math.abs(results.find(item => item.id === 'semantic')!.score - 0.565) < 0.002);
  assert.ok(results.find(item => item.id === 'recent')!.score > results.find(item => item.id === 'stale')!.score);
});

test('lesson promotion requires repeated verified outcomes and penalizes old or contradictory evidence', () => {
  const single = evaluateModaGptLessonPromotion({
    lessonType: 'replenishment',
    evidence: [{ success: true, verified: true, occurredAt: now }],
    riskLevel: 'low',
    contradictionCount: 0,
    now
  });
  assert.equal(single.status, 'candidate');
  assert.equal(single.reason, 'INSUFFICIENT_EVIDENCE');

  const evidence = Array.from({ length: 8 }, (_, index) => ({
    success: true,
    verified: true,
    occurredAt: new Date(now.getTime() - index * 86_400_000)
  }));
  const lowRisk = evaluateModaGptLessonPromotion({
    lessonType: 'replenishment',
    evidence,
    riskLevel: 'low',
    contradictionCount: 0,
    now
  });
  assert.equal(lowRisk.status, 'published');
  assert.equal(lowRisk.evidenceCount, 8);

  const highRisk = evaluateModaGptLessonPromotion({
    lessonType: 'pricing-policy',
    evidence,
    riskLevel: 'high',
    contradictionCount: 0,
    now
  });
  assert.equal(highRisk.status, 'pending_review');
  assert.equal(highRisk.requiresApproval, true);

  const conflicted = evaluateModaGptLessonPromotion({
    lessonType: 'replenishment',
    evidence,
    riskLevel: 'low',
    contradictionCount: 1,
    now
  });
  assert.equal(conflicted.status, 'candidate');
  assert.equal(conflicted.reason, 'CONTRADICTORY_EVIDENCE');

  const unverified = evaluateModaGptLessonPromotion({
    lessonType: 'replenishment',
    evidence: [...evidence, { success: true, verified: false, occurredAt: now }],
    riskLevel: 'low',
    contradictionCount: 0,
    now
  });
  assert.equal(unverified.evidenceCount, 8);
});

test('brain tenant identity cannot be selected independently from the merchant tenant', () => {
  assert.throws(
    () => validateModaGptBrainAccessContext({ ...context, tenantId: 'merchant-b' }),
    /MODAGPT_BRAIN_ACCESS_CONTEXT_INVALID/
  );
});

test('Prisma Brain retrieval applies tenant and merchant filters before building agent context', async () => {
  const memoryWhere: Array<Record<string, unknown>> = [];
  const ownMemory = {
    id: 'memory-a',
    tenantId: 'merchant-a',
    merchantId: 'merchant-a',
    scope: 'MERCHANT',
    content: 'Prefers seasonal dresses',
    category: 'preference',
    memoryType: 'preference',
    source: 'USER',
    status: 'active',
    verificationStatus: 'human_confirmed',
    confidence: 1,
    importance: 0.8,
    accessCount: 0,
    createdAt: now,
    expiresAt: null,
    validFrom: null,
    validUntil: null,
    lastVerifiedAt: now,
    updatedAt: now
  };
  const otherMerchantMemory = { ...ownMemory, id: 'memory-b', tenantId: 'merchant-b', merchantId: 'merchant-b' };
  const prismaMock = {
    merchantAiEmployeeMemory: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        memoryWhere.push(args.where);
        return [ownMemory, otherMerchantMemory];
      },
      updateMany: async () => ({ count: 1 })
    },
    modaGptBrainChunk: {
      findMany: async () => [],
      updateMany: async () => ({ count: 1 })
    },
    modaGptBrainFact: { findMany: async () => [] },
    modaGptBrainEntity: { findMany: async () => [] },
    modaGptBrainExperience: { findMany: async () => [] },
    modaGptBrainLesson: { findMany: async () => [] },
    modaGptBrainRetrievalLog: { create: async () => ({ id: 'log-a' }) },
    $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations)
  } as unknown as PrismaClient;
  const service = new ModaGptBrainService(prismaMock, () => now);

  const result = await service.retrieveBrainContext(context, 'seasonal dresses', { scopes: ['MERCHANT'] });

  assert.equal(memoryWhere[0].tenantId, 'merchant-a');
  assert.equal(memoryWhere[0].merchantId, 'merchant-a');
  assert.deepEqual(result.results.map(candidate => candidate.id), ['memory-a']);
  assert.equal(result.results[0].kind, 'memory');
});

test('knowledge-only Brain retrieval does not query or rank memory and agent records', async () => {
  const prismaMock = {
    modaGptBrainChunk: { findMany: async () => [] },
    modaGptBrainRetrievalLog: { create: async () => ({ id: 'log-knowledge' }) },
    merchantAiEmployeeMemory: { findMany: async () => { throw new Error('MEMORY_QUERY_MUST_NOT_RUN'); } },
    modaGptBrainFact: { findMany: async () => { throw new Error('FACT_QUERY_MUST_NOT_RUN'); } },
    modaGptBrainEntity: { findMany: async () => { throw new Error('ENTITY_QUERY_MUST_NOT_RUN'); } },
    modaGptBrainExperience: { findMany: async () => { throw new Error('EXPERIENCE_QUERY_MUST_NOT_RUN'); } },
    modaGptBrainLesson: { findMany: async () => { throw new Error('LESSON_QUERY_MUST_NOT_RUN'); } },
    $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations)
  } as unknown as PrismaClient;

  const result = await new ModaGptBrainService(prismaMock, () => now)
    .retrieveBrainContext(context, 'verified inventory policy', {
      scopes: ['MERCHANT'],
      kinds: ['knowledge']
    });

  assert.deepEqual(result.results, []);
});

test('Brain retrieval follows verified graph relations from tenant-matched entities', async () => {
  const entityWhere: Array<Record<string, unknown>> = [];
  const factWhere: Array<Record<string, unknown>> = [];
  const graphFact = {
    id: 'fact-brand-product',
    tenantId: 'merchant-a',
    merchantId: 'merchant-a',
    subjectEntityId: 'entity-brand',
    predicate: 'owns',
    objectEntityId: 'entity-product',
    value: null,
    source: 'DATABASE',
    status: 'verified',
    verificationStatus: 'verified',
    confidence: 1,
    updatedAt: now,
    expiresAt: null,
    validFrom: null,
    validUntil: null,
    lastVerifiedAt: now,
    sourceRef: 'product:p-1',
    subject: { displayName: 'Moda brand' },
    object: { displayName: '产品 dress-1' }
  };
  const prismaMock = {
    merchantAiEmployeeMemory: { findMany: async () => [], updateMany: async () => ({ count: 1 }) },
    modaGptBrainChunk: { findMany: async () => [], updateMany: async () => ({ count: 1 }) },
    modaGptBrainFact: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        factWhere.push(args.where);
        return args.where.OR ? [graphFact] : [];
      }
    },
    modaGptBrainEntity: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        entityWhere.push(args.where);
        return [{ id: 'entity-brand' }];
      }
    },
    modaGptBrainExperience: { findMany: async () => [] },
    modaGptBrainLesson: { findMany: async () => [] },
    modaGptBrainRetrievalLog: { create: async () => ({ id: 'log-graph' }) },
    $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations)
  } as unknown as PrismaClient;

  const result = await new ModaGptBrainService(prismaMock, () => now)
    .retrieveBrainContext(context, '产品', { scopes: ['MERCHANT'] });

  assert.equal(entityWhere[0].tenantId, context.tenantId);
  assert.equal(entityWhere[0].merchantId, context.merchantId);
  assert.ok(Array.isArray(factWhere[1].OR));
  assert.deepEqual(result.results.map(item => item.id), ['fact-brand-product']);
  assert.match(result.results[0].content, /owns/);
});

test('only a passed RUDA verifier promotes a recorded employee experience to verified context', async () => {
  const created: Array<Record<string, unknown>> = [];
  const prismaMock = {
    modaGptBrainExperience: {
      create: async (args: { data: Record<string, unknown> }) => {
        created.push(args.data);
        return { id: `experience-${created.length}` };
      }
    }
  } as unknown as PrismaClient;
  const service = new ModaGptBrainService(prismaMock, () => now);
  const writeContext = { ...context, permissions: [...context.permissions, 'brain.write'] };
  const baseInput = {
    agentSlug: 'product-manager',
    goal: 'Complete authorized product_search for the current merchant',
    result: 'The RUDA answer verifier accepted the completed response.',
    verification: {
      verifier: 'RUDA_VERIFIER' as const,
      status: 'passed' as const,
      checks: ['response_shape', 'language', 'numeric_grounding']
    },
    success: true
  };

  await service.recordExperience(writeContext, baseInput);
  await service.recordExperience(writeContext, {
    ...baseInput,
    verification: { verifier: 'RUDA_VERIFIER', status: 'failed' }
  });

  assert.equal(created[0].tenantId, writeContext.tenantId);
  assert.equal(created[0].merchantId, writeContext.merchantId);
  assert.equal(created[0].status, 'verified');
  assert.match(String(created[0].verification), /"status":"passed"/);
  assert.equal(created[0].verifiedAt, now);
  assert.equal(created[1].status, 'candidate');
  assert.match(String(created[1].verification), /"status":"failed"/);
  assert.equal(created[1].verifiedAt, null);
});

test('workflow experience and evaluation upserts are tenant-bound and idempotent', async () => {
  const experienceRows: Array<Record<string, unknown>> = [];
  const evaluationRows: Array<Record<string, unknown>> = [];
  const prismaMock = {
    modaGptBrainExperience: {
      upsert: async (args: {
        where: { idempotencyKey: string };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        assert.deepEqual(args.update, {});
        const existing = experienceRows.find(row => row.idempotencyKey === args.where.idempotencyKey);
        if (existing) return existing;
        const row = { id: `experience-${experienceRows.length + 1}`, ...args.create };
        experienceRows.push(row);
        return row;
      },
      findFirst: async () => ({ id: 'experience-1' })
    },
    modaGptBrainEvaluation: {
      upsert: async (args: {
        where: { idempotencyKey: string };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        assert.deepEqual(args.update, {});
        const existing = evaluationRows.find(row => row.idempotencyKey === args.where.idempotencyKey);
        if (existing) return existing;
        const row = { id: `evaluation-${evaluationRows.length + 1}`, ...args.create };
        evaluationRows.push(row);
        return row;
      }
    }
  } as unknown as PrismaClient;
  const service = new ModaGptBrainService(prismaMock, () => now);
  const writeContext = { ...context, permissions: [...context.permissions, 'brain.write'] };
  const experienceInput = {
    idempotencyKey: 'workflow-experience:task-1',
    taskId: 'task-1',
    agentSlug: 'inventory-manager',
    goal: 'Review low inventory',
    result: 'Current stock was reviewed.',
    verification: { verifier: 'RUDA_VERIFIER' as const, status: 'passed' as const },
    success: true
  };
  const experience = await service.recordExperience(writeContext, experienceInput);
  const replayedExperience = await service.recordExperience(writeContext, experienceInput);

  assert.equal(experience.id, replayedExperience.id);
  assert.equal(experienceRows.length, 1);

  const evaluationInput = {
    idempotencyKey: 'workflow-evaluation:task-1',
    evaluationType: 'workflow',
    verificationResult: 'passed' as const
  };
  const evaluation = await service.recordEvaluation(writeContext, experience.id as string, evaluationInput);
  const replayedEvaluation = await service.recordEvaluation(writeContext, experience.id as string, evaluationInput);

  assert.equal(evaluation.id, replayedEvaluation.id);
  assert.equal(evaluationRows.length, 1);

  await assert.rejects(
    service.recordExperience(
      { ...writeContext, tenantId: 'merchant-b', merchantId: 'merchant-b' },
      experienceInput
    ),
    /MODAGPT_BRAIN_EXPERIENCE_IDEMPOTENCY_CONFLICT/
  );
});

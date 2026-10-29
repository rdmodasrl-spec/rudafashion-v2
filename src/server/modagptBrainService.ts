import { createHash, randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import {
  evaluateModaGptLessonPromotion,
  isModaGptBrainCandidateEligible,
  modaGptBrainScopes,
  normalizeModaGptBrainSource,
  rankModaGptBrainCandidates,
  validateModaGptBrainAccessContext,
  type ModaGptBrainAccessContext,
  type ModaGptBrainCandidate,
  type ModaGptBrainRecordKind,
  type ModaGptBrainRankedCandidate,
  type ModaGptBrainScope
} from './modagptBrain';

const MAX_RECORD_BYTES = 32 * 1024;
const MAX_RETRIEVAL_RESULTS = 20;
const MAX_KNOWLEDGE_DOCUMENT_BYTES = 512 * 1024;
const MAX_KNOWLEDGE_CHUNK_CHARACTERS = 4_000;

type JsonRecord = Record<string, unknown>;

export type ModaGptBrainServiceInputContext = ModaGptBrainAccessContext;

export type ModaGptBrainExperienceInput = {
  idempotencyKey?: string;
  taskId?: string;
  agentSlug: string;
  goal: string;
  context?: JsonRecord;
  actions?: unknown[];
  toolsUsed?: string[];
  modelUsed?: string;
  result: string;
  verification: {
    verifier: 'RUDA_VERIFIER';
    status: 'passed' | 'failed' | 'not_run';
    checks?: string[];
  };
  businessOutcome?: string;
  success?: boolean;
  source?: string;
  sourceRef?: string;
  agentVersion?: string;
  promptVersion?: string;
  modelVersion?: string;
  toolVersion?: string;
  workflowVersion?: string;
  latencyMs?: number;
  costUsd?: number;
  confidence?: number;
  expiresAt?: Date;
};

export type ModaGptBrainEvaluationInput = {
  idempotencyKey?: string;
  evaluationType: string;
  quality?: number;
  accuracy?: number;
  relevance?: number;
  toolSuccess?: boolean;
  verificationResult: 'passed' | 'failed' | 'not_run';
  userFeedback?: string;
  businessOutcome?: string;
  latencyMs?: number;
  costUsd?: number;
  evaluator?: string;
  datasetVersion?: string;
  promptVersion?: string;
  modelVersion?: string;
  details?: JsonRecord;
};

export type ModaGptBrainFeedbackInput = {
  experienceId?: string;
  messageId?: string;
  feedbackType: 'thumbs_up' | 'thumbs_down' | 'accepted' | 'rejected' | 'edited' | 'cancelled' | 'approved' | 'failed' | 'completed' | 'business_outcome';
  original?: string;
  edited?: string;
  outcome?: string;
};

export type ModaGptBrainFactInput = {
  subjectType: string;
  subjectKey: string;
  subjectName: string;
  predicate: string;
  value?: string;
  objectType?: string;
  objectKey?: string;
  objectName?: string;
  source: string;
  sourceRef?: string;
  confidence: number;
  validFrom?: Date;
  validUntil?: Date;
  expiresAt?: Date;
};

export type ModaGptBrainLessonInput = {
  lessonType: string;
  pattern: string;
  condition: string;
  recommendation: string;
  evidenceExperienceIds: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  sourceRef?: string;
  contradictionCount?: number;
  expiresAt?: Date;
};

export type ModaGptBrainDocumentInput = {
  sourceType: string;
  sourceId?: string;
  sourceUrl?: string;
  title: string;
  mimeType?: string;
  authorization?: { requiredPermissions?: string[] };
  metadata?: JsonRecord;
  chunks: string[];
};

export type ModaGptBrainEventInput = {
  eventType: string;
  eventId: string;
  occurredAt: Date;
  payload: JsonRecord;
};

export type ModaGptBrainRetrievalResult = {
  results: ModaGptBrainRankedCandidate[];
  retrievalVersion: string;
};

export interface ModaGptEmbeddingProvider {
  embed(texts: readonly string[]): Promise<readonly (readonly number[])[]>;
}

export interface ModaGptVectorStore {
  storeEmbedding(input: {
    tenantId: string;
    merchantId: string;
    recordId: string;
    model: string;
    vector: readonly number[];
  }): Promise<void>;
  searchSimilar(input: {
    tenantId: string;
    merchantId: string;
    queryVector: readonly number[];
    topK: number;
    permissions: readonly string[];
  }): Promise<Array<{ recordId: string; similarity: number }>>;
  hybridSearch(input: {
    tenantId: string;
    merchantId: string;
    query: string;
    queryVector: readonly number[];
    topK: number;
    permissions: readonly string[];
  }): Promise<Array<{ recordId: string; similarity: number }>>;
  deleteEmbedding(input: { tenantId: string; merchantId: string; recordId: string }): Promise<void>;
  updateEmbedding(input: {
    tenantId: string;
    merchantId: string;
    recordId: string;
    model: string;
    vector: readonly number[];
  }): Promise<void>;
}

function serializeBounded(value: unknown, maxBytes = MAX_RECORD_BYTES): string {
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new Error('MODAGPT_BRAIN_PAYLOAD_INVALID');
  }
  if (serialized === undefined || Buffer.byteLength(serialized, 'utf8') > maxBytes) {
    throw new Error('MODAGPT_BRAIN_PAYLOAD_INVALID');
  }
  return serialized;
}

function boundedText(value: string, maxLength: number, errorCode: string, allowEmpty = false): string {
  const text = value.trim();
  if (
    (!allowEmpty && !text)
    || text.length > maxLength
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)
  ) throw new Error(errorCode);
  return text;
}

export function chunkModaGptKnowledgeText(content: string): string[] {
  if (typeof content !== 'string') throw new Error('MODAGPT_BRAIN_DOCUMENT_CONTENT_INVALID');
  const normalized = content
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, '    ')
    .trim();
  if (!normalized || Buffer.byteLength(normalized, 'utf8') > MAX_KNOWLEDGE_DOCUMENT_BYTES) {
    throw new Error('MODAGPT_BRAIN_DOCUMENT_CONTENT_INVALID');
  }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(normalized)) {
    throw new Error('MODAGPT_BRAIN_DOCUMENT_CONTENT_INVALID');
  }

  const chunks: string[] = [];
  let current = '';
  const append = (paragraph: string) => {
    const text = paragraph.trim();
    if (!text) return;
    const pieces: string[] = [];
    const characters = Array.from(text);
    for (let offset = 0; offset < characters.length; offset += MAX_KNOWLEDGE_CHUNK_CHARACTERS) {
      pieces.push(characters.slice(offset, offset + MAX_KNOWLEDGE_CHUNK_CHARACTERS).join(''));
    }
    for (const piece of pieces) {
      const next = current ? `${current}\n\n${piece}` : piece;
      if (Array.from(next).length <= MAX_KNOWLEDGE_CHUNK_CHARACTERS) {
        current = next;
      } else {
        chunks.push(current);
        current = piece;
      }
    }
  };

  for (const paragraph of normalized.split(/\n\s*\n/)) append(paragraph);
  if (current) chunks.push(current);
  if (!chunks.length || chunks.length > 500) {
    throw new Error('MODAGPT_BRAIN_DOCUMENT_CHUNKS_INVALID');
  }
  return chunks;
}

function boundedScore(value: number | undefined, errorCode: string, fallback = 0.5): number {
  const score = value ?? fallback;
  if (!Number.isFinite(score) || score < 0 || score > 1) throw new Error(errorCode);
  return score;
}

function parseAuthorization(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
    const permissions = (parsed as Record<string, unknown>).requiredPermissions;
    return Array.isArray(permissions)
      ? permissions.filter((permission): permission is string => typeof permission === 'string')
      : [];
  } catch {
    return [];
  }
}

function getMemoryPermissions(content: string): string[] {
  return content.startsWith('[restricted:')
    ? content.match(/^\[restricted:([a-z0-9.,:_-]+)\]/i)?.[1].split(',').filter(Boolean) || []
    : [];
}

function containsSensitiveEventField(value: unknown, depth = 0): boolean {
  if (depth > 8) return true;
  if (Array.isArray(value)) return value.some(item => containsSensitiveEventField(item, depth + 1));
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, item]) => {
    const normalizedKey = key.replace(/[^a-z]/gi, '').toLowerCase();
    return /(?:email|phone|address|card|iban|password|token|ip|fullname)$/.test(normalizedKey)
      || containsSensitiveEventField(item, depth + 1);
  });
}

function graphSearchTerms(query: string): string[] {
  const latinTerms = query.match(/[\p{L}\p{N}_-]+/gu) || [];
  const cjkRuns = query.match(/\p{Script=Han}+/gu) || [];
  const cjkTerms = cjkRuns.flatMap(run => {
    if (run.length < 2) return [run];
    return Array.from({ length: run.length - 1 }, (_, index) => run.slice(index, index + 2));
  });
  return [...new Set([...latinTerms, ...cjkTerms]
    .map(term => term.trim())
    .filter(term => term.length >= 2))]
    .slice(0, 12);
}

function assertMerchantWriteContext(context: ModaGptBrainAccessContext): void {
  validateModaGptBrainAccessContext(context);
  if (!context.permissions.includes('brain.write')) throw new Error('MODAGPT_BRAIN_WRITE_PERMISSION_REQUIRED');
}

export class ModaGptBrainService {
  constructor(private readonly prisma: PrismaClient, private readonly now: () => Date = () => new Date()) {}

  private async recordDocumentAudit(
    transaction: Prisma.TransactionClient,
    context: ModaGptBrainServiceInputContext,
    action: string,
    documentId: string,
    metadata: Record<string, string | number>
  ): Promise<void> {
    const employee = context.actorId === context.merchantId
      ? null
      : await transaction.merchantEmployee.findFirst({
        where: { id: context.actorId, merchantId: context.merchantId },
        select: { id: true }
      });
    await transaction.employeeAuditLog.create({
      data: {
        id: randomUUID(),
        merchantId: context.merchantId,
        employeeId: employee?.id || null,
        action,
        entityType: 'ModaGptBrainDocument',
        entityId: documentId,
        metadata: JSON.stringify({ actorId: context.actorId, ...metadata })
      }
    });
  }

  async retrieveBrainContext(
    context: ModaGptBrainServiceInputContext,
    query: string,
    options: {
      topK?: number;
      scopes?: readonly ModaGptBrainScope[];
      kinds?: readonly ModaGptBrainRecordKind[];
    } = {}
  ): Promise<ModaGptBrainRetrievalResult> {
    validateModaGptBrainAccessContext(context);
    const searchQuery = boundedText(query, 1000, 'MODAGPT_BRAIN_QUERY_INVALID');
    const topK = options.topK ?? 8;
    if (!Number.isInteger(topK) || topK < 1 || topK > MAX_RETRIEVAL_RESULTS) {
      throw new Error('MODAGPT_BRAIN_TOP_K_INVALID');
    }
    const scopes = options.scopes ?? context.scopes;
    if (scopes.some(scope => !modaGptBrainScopes.includes(scope) || !context.scopes.includes(scope))) {
      throw new Error('MODAGPT_BRAIN_SCOPE_FORBIDDEN');
    }
    const validRecordKinds: readonly ModaGptBrainRecordKind[] = ['memory', 'knowledge', 'fact', 'experience', 'lesson'];
    if (options.kinds?.some(kind => !validRecordKinds.includes(kind))) {
      throw new Error('MODAGPT_BRAIN_KIND_INVALID');
    }
    const includesKind = (kind: ModaGptBrainRecordKind) => !options.kinds || options.kinds.includes(kind);
    const now = this.now();
    const knowledgeTerms = graphSearchTerms(searchQuery);
    const [memories, chunks, facts, experiences, lessons] = await Promise.all([
      includesKind('memory') ? this.prisma.merchantAiEmployeeMemory.findMany({
        where: {
          tenantId: context.tenantId,
          merchantId: context.merchantId,
          scope: { in: [...scopes] },
          status: { in: ['active', 'persistent'] },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
        },
        orderBy: { updatedAt: 'desc' },
        take: 100,
        select: {
          id: true, tenantId: true, merchantId: true, scope: true, content: true,
          category: true, memoryType: true, source: true, status: true,
          verificationStatus: true, confidence: true, importance: true,
          accessCount: true, createdAt: true, expiresAt: true, validFrom: true,
          validUntil: true, lastVerifiedAt: true, updatedAt: true
        }
      }) : Promise.resolve([]),
      includesKind('knowledge') ? this.prisma.modaGptBrainChunk.findMany({
        where: {
          tenantId: context.tenantId,
          merchantId: context.merchantId,
          verificationStatus: 'verified',
          document: { tenantId: context.tenantId, merchantId: context.merchantId, status: 'published' },
          AND: [
            {
              OR: knowledgeTerms.length
                ? knowledgeTerms.map(term => ({
                  keywordText: { contains: term, mode: 'insensitive' as const }
                }))
                : [{ id: '__no_matching_knowledge__' }]
            },
            { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }
          ]
        },
        include: { document: { select: { title: true, sourceType: true, sourceId: true, status: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 100
      }) : Promise.resolve([]),
      includesKind('fact') ? this.prisma.modaGptBrainFact.findMany({
        where: {
          tenantId: context.tenantId,
          merchantId: context.merchantId,
          status: 'verified',
          verificationStatus: 'verified',
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
        },
        include: {
          subject: { select: { displayName: true } },
          object: { select: { displayName: true } }
        },
        orderBy: { updatedAt: 'desc' },
        take: 100
      }) : Promise.resolve([]),
      includesKind('experience') ? this.prisma.modaGptBrainExperience.findMany({
        where: {
          tenantId: context.tenantId,
          merchantId: context.merchantId,
          status: 'verified',
          success: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
        },
        orderBy: { updatedAt: 'desc' },
        take: 100
      }) : Promise.resolve([]),
      includesKind('lesson') ? this.prisma.modaGptBrainLesson.findMany({
        where: {
          tenantId: context.tenantId,
          merchantId: context.merchantId,
          status: 'published',
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          AND: [{ OR: [{ requiresApproval: false }, { reviewedAt: { not: null } }] }]
        },
        orderBy: { updatedAt: 'desc' },
        take: 100
      }) : Promise.resolve([])
    ]);
    const entityTerms = graphSearchTerms(searchQuery);
    const graphEntities = includesKind('fact') && entityTerms.length
      ? await this.prisma.modaGptBrainEntity.findMany({
        where: {
          tenantId: context.tenantId,
          merchantId: context.merchantId,
          status: 'verified',
          OR: entityTerms.flatMap(term => [
            { displayName: { contains: term, mode: 'insensitive' as const } },
            { canonicalKey: { contains: term, mode: 'insensitive' as const } }
          ])
        },
        select: { id: true },
        take: 20
      })
      : [];
    const graphEntityIds = graphEntities.map(entity => entity.id);
    const graphFacts = graphEntityIds.length
      ? await this.prisma.modaGptBrainFact.findMany({
        where: {
          tenantId: context.tenantId,
          merchantId: context.merchantId,
          status: 'verified',
          verificationStatus: 'verified',
          OR: [
            { subjectEntityId: { in: graphEntityIds } },
            { objectEntityId: { in: graphEntityIds } }
          ],
          AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }]
        },
        include: {
          subject: { select: { displayName: true } },
          object: { select: { displayName: true } }
        },
        orderBy: { updatedAt: 'desc' },
        take: 100
      })
      : [];
    const factsById = new Map([...facts, ...graphFacts].map(fact => [fact.id, fact]));

    const candidates: ModaGptBrainCandidate[] = [
      ...memories.map(memory => ({
        id: memory.id,
        tenantId: memory.tenantId,
        merchantId: memory.merchantId,
        kind: 'memory' as const,
        scope: memory.scope as ModaGptBrainScope,
        content: `${memory.category}: ${memory.content}`,
        source: memory.source,
        status: memory.status,
        verificationStatus: memory.verificationStatus,
        confidence: memory.confidence,
        importance: memory.importance,
        accessCount: memory.accessCount,
        createdAt: memory.updatedAt,
        expiresAt: memory.expiresAt,
        validFrom: memory.validFrom,
        validUntil: memory.validUntil,
        lastVerifiedAt: memory.lastVerifiedAt,
        requiredPermissions: getMemoryPermissions(memory.content),
        sourceRef: memory.id
      })),
      ...chunks.map(chunk => ({
        id: chunk.id,
        tenantId: chunk.tenantId,
        merchantId: chunk.merchantId,
        kind: 'knowledge' as const,
        scope: 'MERCHANT' as const,
        content: `${chunk.document.title}\n${chunk.content}`,
        source: chunk.source,
        status: chunk.document.status,
        verificationStatus: chunk.verificationStatus,
        confidence: chunk.confidence,
        importance: 0.6,
        accessCount: chunk.accessCount,
        createdAt: chunk.updatedAt,
        expiresAt: chunk.expiresAt,
        validFrom: chunk.validFrom,
        validUntil: chunk.validUntil,
        lastVerifiedAt: chunk.lastVerifiedAt,
        requiredPermissions: parseAuthorization(chunk.authorization),
        sourceRef: `${chunk.document.sourceType}:${chunk.document.sourceId || chunk.document.title}`
      })),
      ...[...factsById.values()].map(fact => ({
        id: fact.id,
        tenantId: fact.tenantId,
        merchantId: fact.merchantId,
        kind: 'fact' as const,
        scope: 'MERCHANT' as const,
        content: `${fact.subject?.displayName || ''} ${fact.predicate} ${fact.object?.displayName || fact.value || ''}`.trim(),
        source: fact.source,
        status: fact.status,
        verificationStatus: fact.verificationStatus,
        confidence: fact.confidence,
        importance: 0.8,
        accessCount: 0,
        createdAt: fact.updatedAt,
        expiresAt: fact.expiresAt,
        validFrom: fact.validFrom,
        validUntil: fact.validUntil,
        lastVerifiedAt: fact.lastVerifiedAt,
        sourceRef: fact.sourceRef
      })),
      ...experiences.map(experience => ({
        id: experience.id,
        tenantId: experience.tenantId,
        merchantId: experience.merchantId,
        kind: 'experience' as const,
        scope: 'AGENT' as const,
        content: `${experience.goal}\n${experience.result}`,
        source: experience.source,
        status: experience.status,
        verificationStatus: 'verified',
        confidence: experience.confidence,
        importance: 0.55,
        accessCount: 0,
        createdAt: experience.updatedAt,
        expiresAt: experience.expiresAt,
        sourceRef: experience.id
      })),
      ...lessons.map(lesson => ({
        id: lesson.id,
        tenantId: lesson.tenantId,
        merchantId: lesson.merchantId,
        kind: 'lesson' as const,
        scope: 'MERCHANT' as const,
        content: `${lesson.pattern}\n${lesson.condition}\n${lesson.recommendation}`,
        source: lesson.source,
        status: lesson.status,
        verificationStatus: 'verified',
        confidence: lesson.confidence,
        importance: 0.75,
        accessCount: lesson.evidenceCount,
        createdAt: lesson.updatedAt,
        expiresAt: lesson.expiresAt,
        validFrom: lesson.validFrom,
        validUntil: lesson.validUntil,
        sourceRef: lesson.id
      }))
    ];

    const results = rankModaGptBrainCandidates(searchQuery, candidates, { ...context, scopes }, {
      topK,
      now,
      kinds: options.kinds
    });
    const selectedMemoryIds = results.filter(item => item.kind === 'memory').map(item => item.id);
    const selectedChunkIds = results.filter(item => item.kind === 'knowledge').map(item => item.id);
    const operations = [
      ...selectedMemoryIds.map(id => this.prisma.merchantAiEmployeeMemory.updateMany({
        where: { id, tenantId: context.tenantId, merchantId: context.merchantId },
        data: { accessCount: { increment: 1 }, lastAccessedAt: now }
      })),
      ...selectedChunkIds.map(id => this.prisma.modaGptBrainChunk.updateMany({
        where: { id, tenantId: context.tenantId, merchantId: context.merchantId },
        data: { accessCount: { increment: 1 }, lastAccessedAt: now }
      })),
      this.prisma.modaGptBrainRetrievalLog.create({
        data: {
          tenantId: context.tenantId,
          merchantId: context.merchantId,
          actorId: context.actorId,
          queryHash: createHash('sha256').update(searchQuery).digest('hex'),
          scopes: serializeBounded(scopes),
          permissions: serializeBounded([...new Set(context.permissions)].sort()),
          resultRefs: serializeBounded(results.map(({ kind, id, sourceRef }) => ({ kind, id, sourceRef }))),
          resultCount: results.length,
          retrievalVersion: '1'
        }
      })
    ];
    await this.prisma.$transaction(operations);
    return { results, retrievalVersion: '1' };
  }

  async recordExperience(
    context: ModaGptBrainServiceInputContext,
    input: ModaGptBrainExperienceInput
  ) {
    assertMerchantWriteContext(context);
    const source = normalizeModaGptBrainSource(input.source ?? 'AGENT');
    const passedVerification = input.verification.verifier === 'RUDA_VERIFIER'
      && input.verification.status === 'passed';
    const latencyMs = input.latencyMs;
    if (latencyMs !== undefined && (!Number.isInteger(latencyMs) || latencyMs < 0 || latencyMs > 86_400_000)) {
      throw new Error('MODAGPT_BRAIN_LATENCY_INVALID');
    }
    const costUsd = input.costUsd;
    if (costUsd !== undefined && (!Number.isFinite(costUsd) || costUsd < 0 || costUsd > 100_000)) {
      throw new Error('MODAGPT_BRAIN_COST_INVALID');
    }
    const data = {
        idempotencyKey: input.idempotencyKey
          ? boundedText(input.idempotencyKey, 160, 'MODAGPT_BRAIN_IDEMPOTENCY_KEY_INVALID')
          : null,
        tenantId: context.tenantId,
        merchantId: context.merchantId,
        taskId: input.taskId ? boundedText(input.taskId, 160, 'MODAGPT_BRAIN_TASK_ID_INVALID') : null,
        agentSlug: boundedText(input.agentSlug, 80, 'MODAGPT_BRAIN_AGENT_INVALID'),
        goal: boundedText(input.goal, 2_000, 'MODAGPT_BRAIN_GOAL_INVALID'),
        context: serializeBounded(input.context ?? {}),
        actions: serializeBounded(input.actions ?? []),
        toolsUsed: serializeBounded(input.toolsUsed ?? []),
        modelUsed: input.modelUsed ? boundedText(input.modelUsed, 120, 'MODAGPT_BRAIN_MODEL_INVALID') : null,
        result: boundedText(input.result, 8_000, 'MODAGPT_BRAIN_RESULT_INVALID'),
        verification: serializeBounded(input.verification),
        businessOutcome: input.businessOutcome
          ? boundedText(input.businessOutcome, 4_000, 'MODAGPT_BRAIN_OUTCOME_INVALID')
          : null,
        success: input.success ?? null,
        status: passedVerification ? 'verified' : 'candidate',
        source,
        sourceRef: input.sourceRef ? boundedText(input.sourceRef, 160, 'MODAGPT_BRAIN_SOURCE_REF_INVALID') : null,
        agentVersion: input.agentVersion || null,
        promptVersion: input.promptVersion || null,
        modelVersion: input.modelVersion || null,
        toolVersion: input.toolVersion || null,
        workflowVersion: input.workflowVersion || null,
        latencyMs: latencyMs ?? null,
        costUsd: costUsd ?? null,
        confidence: boundedScore(input.confidence, 'MODAGPT_BRAIN_CONFIDENCE_INVALID'),
        verifiedAt: passedVerification ? this.now() : null,
        expiresAt: input.expiresAt
      };
    if (!data.idempotencyKey) return this.prisma.modaGptBrainExperience.create({ data });
    const experience = await this.prisma.modaGptBrainExperience.upsert({
      where: { idempotencyKey: data.idempotencyKey },
      create: data,
      update: {}
    });
    if (
      experience.tenantId !== data.tenantId
      || experience.merchantId !== data.merchantId
      || experience.taskId !== data.taskId
      || experience.agentSlug !== data.agentSlug
      || experience.goal !== data.goal
      || experience.result !== data.result
      || experience.verification !== data.verification
    ) throw new Error('MODAGPT_BRAIN_EXPERIENCE_IDEMPOTENCY_CONFLICT');
    return experience;
  }

  async recordEvaluation(
    context: ModaGptBrainServiceInputContext,
    experienceId: string,
    input: ModaGptBrainEvaluationInput
  ) {
    validateModaGptBrainAccessContext(context);
    const experience = await this.prisma.modaGptBrainExperience.findFirst({
      where: { id: boundedText(experienceId, 160, 'MODAGPT_BRAIN_EXPERIENCE_ID_INVALID'), tenantId: context.tenantId, merchantId: context.merchantId },
      select: { id: true }
    });
    if (!experience) throw new Error('MODAGPT_BRAIN_EXPERIENCE_NOT_FOUND');
    for (const value of [input.quality, input.accuracy, input.relevance]) {
      if (value !== undefined) boundedScore(value, 'MODAGPT_BRAIN_EVALUATION_SCORE_INVALID');
    }
    const data = {
        idempotencyKey: input.idempotencyKey
          ? boundedText(input.idempotencyKey, 160, 'MODAGPT_BRAIN_IDEMPOTENCY_KEY_INVALID')
          : null,
        tenantId: context.tenantId,
        merchantId: context.merchantId,
        experienceId,
        evaluationType: boundedText(input.evaluationType, 32, 'MODAGPT_BRAIN_EVALUATION_TYPE_INVALID'),
        quality: input.quality ?? null,
        accuracy: input.accuracy ?? null,
        relevance: input.relevance ?? null,
        toolSuccess: input.toolSuccess ?? null,
        verificationResult: input.verificationResult,
        userFeedback: input.userFeedback ? boundedText(input.userFeedback, 24, 'MODAGPT_BRAIN_FEEDBACK_INVALID') : null,
        businessOutcome: input.businessOutcome ? boundedText(input.businessOutcome, 24, 'MODAGPT_BRAIN_OUTCOME_INVALID') : null,
        latencyMs: input.latencyMs ?? null,
        costUsd: input.costUsd ?? null,
        evaluator: input.evaluator ? boundedText(input.evaluator, 24, 'MODAGPT_BRAIN_EVALUATOR_INVALID') : 'SYSTEM',
        datasetVersion: input.datasetVersion || null,
        promptVersion: input.promptVersion || null,
        modelVersion: input.modelVersion || null,
        details: serializeBounded(input.details ?? {})
      };
    if (!data.idempotencyKey) return this.prisma.modaGptBrainEvaluation.create({ data });
    const evaluation = await this.prisma.modaGptBrainEvaluation.upsert({
      where: { idempotencyKey: data.idempotencyKey },
      create: data,
      update: {}
    });
    if (
      evaluation.tenantId !== data.tenantId
      || evaluation.merchantId !== data.merchantId
      || evaluation.experienceId !== data.experienceId
      || evaluation.evaluationType !== data.evaluationType
    ) throw new Error('MODAGPT_BRAIN_EVALUATION_IDEMPOTENCY_CONFLICT');
    return evaluation;
  }

  async recordFeedback(context: ModaGptBrainServiceInputContext, input: ModaGptBrainFeedbackInput) {
    validateModaGptBrainAccessContext(context);
    if (input.experienceId) {
      const experience = await this.prisma.modaGptBrainExperience.findFirst({
        where: { id: input.experienceId, tenantId: context.tenantId, merchantId: context.merchantId },
        select: { id: true }
      });
      if (!experience) throw new Error('MODAGPT_BRAIN_EXPERIENCE_NOT_FOUND');
    }
    const messageId = input.messageId
      ? boundedText(input.messageId, 160, 'MODAGPT_BRAIN_MESSAGE_ID_INVALID')
      : null;
    const data = {
        tenantId: context.tenantId,
        merchantId: context.merchantId,
        experienceId: input.experienceId ?? null,
        messageId,
        actorId: context.actorId,
        feedbackType: input.feedbackType,
        original: input.original ? boundedText(input.original, 8_000, 'MODAGPT_BRAIN_FEEDBACK_CONTENT_INVALID') : null,
        edited: input.edited ? boundedText(input.edited, 8_000, 'MODAGPT_BRAIN_FEEDBACK_CONTENT_INVALID') : null,
        outcome: input.outcome ? boundedText(input.outcome, 4_000, 'MODAGPT_BRAIN_OUTCOME_INVALID') : null,
        source: 'USER'
      };
    if (!messageId) return this.prisma.modaGptBrainFeedback.create({ data });
    const existing = await this.prisma.modaGptBrainFeedback.findUnique({
      where: { tenantId_messageId: { tenantId: context.tenantId, messageId } }
    });
    if (existing && existing.merchantId !== context.merchantId) {
      throw new Error('MODAGPT_BRAIN_FEEDBACK_TENANT_CONFLICT');
    }
    return this.prisma.modaGptBrainFeedback.upsert({
      where: { tenantId_messageId: { tenantId: context.tenantId, messageId } },
      create: data,
      update: {
        feedbackType: data.feedbackType,
        original: data.original,
        edited: data.edited,
        outcome: data.outcome,
        actorId: data.actorId,
        createdAt: this.now()
      }
    });
  }

  async ingestDocument(context: ModaGptBrainServiceInputContext, input: ModaGptBrainDocumentInput) {
    assertMerchantWriteContext(context);
    if (!Array.isArray(input.chunks) || input.chunks.length < 1 || input.chunks.length > 500) {
      throw new Error('MODAGPT_BRAIN_DOCUMENT_CHUNKS_INVALID');
    }
    const chunks = input.chunks.map(chunk => boundedText(chunk, 8_000, 'MODAGPT_BRAIN_CHUNK_INVALID'));
    if (Buffer.byteLength(chunks.join('\n'), 'utf8') > 512 * 1024) {
      throw new Error('MODAGPT_BRAIN_DOCUMENT_TOO_LARGE');
    }
    const sourceType = boundedText(input.sourceType, 32, 'MODAGPT_BRAIN_DOCUMENT_SOURCE_INVALID').toUpperCase();
    if (!['DOCUMENT', 'PRODUCT', 'BRAND', 'FASHION_ARTICLE', 'PLATFORM', 'BUSINESS_FACT'].includes(sourceType)) {
      throw new Error('MODAGPT_BRAIN_DOCUMENT_SOURCE_INVALID');
    }
    const authorization = input.authorization ?? {};
    const requiredPermissions = authorization.requiredPermissions ?? [];
    if (
      !Array.isArray(requiredPermissions)
      || requiredPermissions.length > 20
      || requiredPermissions.some(permission => typeof permission !== 'string' || !/^[a-z][a-z0-9._:-]{0,79}$/.test(permission))
    ) throw new Error('MODAGPT_BRAIN_AUTHORIZATION_INVALID');
    const sourceId = input.sourceId ? boundedText(input.sourceId, 160, 'MODAGPT_BRAIN_DOCUMENT_SOURCE_INVALID') : null;
    return this.prisma.$transaction(async transaction => {
      const merchant = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Merchant" WHERE "id" = ${context.merchantId} FOR UPDATE
      `;
      if (!merchant.length) throw new Error('MODAGPT_MERCHANT_NOT_FOUND');
      const priorVersion = sourceId
        ? await transaction.modaGptBrainDocument.findFirst({
          where: {
            tenantId: context.tenantId,
            merchantId: context.merchantId,
            sourceType,
            sourceId
          },
          orderBy: { version: 'desc' },
          select: { version: true }
        })
        : null;
      const document = await transaction.modaGptBrainDocument.create({
        data: {
          tenantId: context.tenantId,
          merchantId: context.merchantId,
          sourceType,
          sourceId,
          sourceUrl: input.sourceUrl ? boundedText(input.sourceUrl, 2_000, 'MODAGPT_BRAIN_DOCUMENT_URL_INVALID') : null,
          title: boundedText(input.title, 240, 'MODAGPT_BRAIN_DOCUMENT_TITLE_INVALID'),
          mimeType: input.mimeType ? boundedText(input.mimeType, 120, 'MODAGPT_BRAIN_DOCUMENT_MIME_INVALID') : null,
          authorization: serializeBounded({ requiredPermissions }),
          metadata: serializeBounded(input.metadata ?? {}),
          status: 'ingested',
          version: (priorVersion?.version || 0) + 1,
          sourceTrust: 'unverified',
          createdBy: context.actorId,
          chunks: {
            create: chunks.map((content, chunkIndex) => ({
              tenantId: context.tenantId,
              merchantId: context.merchantId,
              chunkIndex,
              content,
              keywordText: content,
              metadata: '{}',
              authorization: serializeBounded({ requiredPermissions }),
              source: 'DOCUMENT',
              confidence: 0.5,
              verificationStatus: 'unverified'
            }))
          }
        },
        select: { id: true, status: true, version: true, createdAt: true }
      });
      await this.recordDocumentAudit(transaction, context, 'MODAGPT_BRAIN_DOCUMENT_INGESTED', document.id, {
        sourceType,
        version: document.version
      });
      return document;
    });
  }

  async ingestTextDocument(
    context: ModaGptBrainServiceInputContext,
    input: Omit<ModaGptBrainDocumentInput, 'chunks'> & { content: string }
  ) {
    return this.ingestDocument(context, {
      ...input,
      chunks: chunkModaGptKnowledgeText(input.content)
    });
  }

  async reviewDocument(
    context: ModaGptBrainServiceInputContext,
    documentId: string,
    decision: 'approve' | 'reject'
  ) {
    validateModaGptBrainAccessContext(context);
    if (!context.permissions.includes('brain.knowledge.review')) {
      throw new Error('MODAGPT_BRAIN_KNOWLEDGE_REVIEW_PERMISSION_REQUIRED');
    }
    const id = boundedText(documentId, 160, 'MODAGPT_BRAIN_DOCUMENT_ID_INVALID');
    return this.prisma.$transaction(async transaction => {
      const merchant = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Merchant" WHERE "id" = ${context.merchantId} FOR UPDATE
      `;
      if (!merchant.length) throw new Error('MODAGPT_MERCHANT_NOT_FOUND');
      const document = await transaction.modaGptBrainDocument.findFirst({
        where: { id, tenantId: context.tenantId, merchantId: context.merchantId, status: 'ingested' },
        select: { id: true, sourceType: true, sourceId: true, version: true }
      });
      if (!document) throw new Error('MODAGPT_BRAIN_DOCUMENT_NOT_REVIEWABLE');
      const now = this.now();
      if (decision === 'approve' && document.sourceId) {
        const newerVersion = await transaction.modaGptBrainDocument.findFirst({
          where: {
            tenantId: context.tenantId,
            merchantId: context.merchantId,
            sourceType: document.sourceType,
            sourceId: document.sourceId,
            version: { gt: document.version }
          },
          select: { id: true }
        });
        if (newerVersion) throw new Error('MODAGPT_BRAIN_DOCUMENT_NOT_REVIEWABLE');
        await transaction.modaGptBrainDocument.updateMany({
          where: {
            tenantId: context.tenantId,
            merchantId: context.merchantId,
            sourceType: document.sourceType,
            sourceId: document.sourceId,
            version: { lt: document.version },
            status: 'published'
          },
          data: { status: 'superseded', updatedAt: now }
        });
      }
      const updated = await transaction.modaGptBrainDocument.updateMany({
        where: {
          id: document.id,
          tenantId: context.tenantId,
          merchantId: context.merchantId,
          status: 'ingested'
        },
        data: {
          status: decision === 'approve' ? 'published' : 'rejected',
          sourceTrust: decision === 'approve' ? 'verified' : 'unverified',
          lastVerifiedAt: decision === 'approve' ? now : null,
          updatedAt: now
        }
      });
      if (updated.count !== 1) throw new Error('MODAGPT_BRAIN_DOCUMENT_NOT_REVIEWABLE');
      await transaction.modaGptBrainChunk.updateMany({
        where: { documentId: id, tenantId: context.tenantId, merchantId: context.merchantId },
        data: {
          verificationStatus: decision === 'approve' ? 'verified' : 'rejected',
          source: 'HUMAN_REVIEW',
          lastVerifiedAt: decision === 'approve' ? now : null,
          updatedAt: now
        }
      });
      await this.recordDocumentAudit(transaction, context, `MODAGPT_BRAIN_DOCUMENT_${decision.toUpperCase()}`, id, {
        status: decision === 'approve' ? 'published' : 'rejected'
      });
      return { id, status: decision === 'approve' ? 'published' : 'rejected' };
    });
  }

  async invalidateDocument(
    context: ModaGptBrainServiceInputContext,
    documentId: string
  ) {
    validateModaGptBrainAccessContext(context);
    if (!context.permissions.includes('brain.knowledge.review')) {
      throw new Error('MODAGPT_BRAIN_KNOWLEDGE_REVIEW_PERMISSION_REQUIRED');
    }
    const id = boundedText(documentId, 160, 'MODAGPT_BRAIN_DOCUMENT_ID_INVALID');
    return this.prisma.$transaction(async transaction => {
      const updated = await transaction.modaGptBrainDocument.updateMany({
        where: {
          id,
          tenantId: context.tenantId,
          merchantId: context.merchantId,
          status: { in: ['ingested', 'published'] }
        },
        data: {
          status: 'invalidated',
          sourceTrust: 'unverified',
          lastVerifiedAt: null,
          updatedAt: this.now()
        }
      });
      if (updated.count !== 1) throw new Error('MODAGPT_BRAIN_DOCUMENT_NOT_INVALIDATABLE');
      await transaction.modaGptBrainChunk.updateMany({
        where: { documentId: id, tenantId: context.tenantId, merchantId: context.merchantId },
        data: {
          verificationStatus: 'invalidated',
          lastVerifiedAt: null,
          updatedAt: this.now()
        }
      });
      await this.recordDocumentAudit(transaction, context, 'MODAGPT_BRAIN_DOCUMENT_INVALIDATED', id, {
        status: 'invalidated'
      });
      return { id, status: 'invalidated' };
    });
  }

  async recordBusinessEvent(context: ModaGptBrainServiceInputContext, input: ModaGptBrainEventInput) {
    assertMerchantWriteContext(context);
    const eventType = boundedText(input.eventType, 80, 'MODAGPT_BRAIN_EVENT_TYPE_INVALID');
    if (!/^[a-z][a-z0-9_.-]{0,79}$/.test(eventType)) throw new Error('MODAGPT_BRAIN_EVENT_TYPE_INVALID');
    const eventId = boundedText(input.eventId, 160, 'MODAGPT_BRAIN_EVENT_ID_INVALID');
    if (!Number.isFinite(input.occurredAt.getTime()) || input.occurredAt.getTime() > this.now().getTime() + 60_000) {
      throw new Error('MODAGPT_BRAIN_EVENT_TIME_INVALID');
    }
    if (containsSensitiveEventField(input.payload)) throw new Error('MODAGPT_BRAIN_EVENT_PII_NOT_ALLOWED');
    const payload = serializeBounded(input.payload, 64 * 1024);
    const existing = await this.prisma.modaGptBrainEvent.findUnique({
      where: {
        tenantId_eventType_eventId: {
          tenantId: context.tenantId,
          eventType,
          eventId
        }
      }
    });
    if (existing) {
      if (existing.merchantId !== context.merchantId || existing.payload !== payload) {
        throw new Error('MODAGPT_BRAIN_EVENT_IDEMPOTENCY_CONFLICT');
      }
      return { id: existing.id, deduplicated: true, status: existing.status };
    }
    const event = await this.prisma.modaGptBrainEvent.create({
      data: {
        tenantId: context.tenantId,
        merchantId: context.merchantId,
        eventType,
        eventId,
        payload,
        status: 'processed',
        source: 'BUSINESS_EVENT',
        occurredAt: input.occurredAt,
        processedAt: this.now()
      },
      select: { id: true, status: true }
    });
    return { ...event, deduplicated: false };
  }

  async createMemoryCandidate(
    context: ModaGptBrainServiceInputContext,
    input: {
      category: string;
      scope: 'MERCHANT' | 'BRAND' | 'AGENT';
      content: string;
      importance?: number;
      confidence?: number;
      sourceRef?: string;
      expiresAt?: Date;
    }
  ) {
    assertMerchantWriteContext(context);
    const category = boundedText(input.category, 24, 'MODAGPT_BRAIN_MEMORY_CATEGORY_INVALID');
    if (!['preference', 'brand_voice', 'operating_rule'].includes(category)) {
      throw new Error('MODAGPT_BRAIN_MEMORY_CATEGORY_INVALID');
    }
    if (!['MERCHANT', 'BRAND', 'AGENT'].includes(input.scope)) throw new Error('MODAGPT_BRAIN_SCOPE_INVALID');
    const confidence = boundedScore(input.confidence, 'MODAGPT_BRAIN_CONFIDENCE_INVALID', 1);
    const importance = boundedScore(input.importance, 'MODAGPT_BRAIN_IMPORTANCE_INVALID', 0.6);
    const createdBy = context.actorId;
    return this.prisma.merchantAiEmployeeMemory.create({
      data: {
        tenantId: context.tenantId,
        merchantId: context.merchantId,
        category,
        scope: input.scope,
        memoryType: category,
        content: boundedText(input.content, 500, 'MODAGPT_BRAIN_MEMORY_INVALID'),
        status: 'active',
        importance,
        confidence,
        source: 'USER',
        sourceRef: input.sourceRef ? boundedText(input.sourceRef, 160, 'MODAGPT_BRAIN_SOURCE_REF_INVALID') : null,
        verificationStatus: 'human_confirmed',
        lastVerifiedAt: this.now(),
        expiresAt: input.expiresAt,
        createdBy,
        updatedBy: createdBy
      }
    });
  }

  async recordFactCandidate(context: ModaGptBrainServiceInputContext, input: ModaGptBrainFactInput) {
    assertMerchantWriteContext(context);
    const source = normalizeModaGptBrainSource(input.source);
    const subjectType = boundedText(input.subjectType, 40, 'MODAGPT_BRAIN_ENTITY_TYPE_INVALID');
    const subjectKey = boundedText(input.subjectKey, 200, 'MODAGPT_BRAIN_ENTITY_KEY_INVALID');
    const predicate = boundedText(input.predicate, 80, 'MODAGPT_BRAIN_PREDICATE_INVALID');
    const value = input.value ? boundedText(input.value, 2_000, 'MODAGPT_BRAIN_FACT_VALUE_INVALID') : null;
    if (!value && (!input.objectType || !input.objectKey || !input.objectName)) {
      throw new Error('MODAGPT_BRAIN_FACT_OBJECT_REQUIRED');
    }
    const confidence = boundedScore(input.confidence, 'MODAGPT_BRAIN_CONFIDENCE_INVALID');
    const contradictionGroupId = createHash('sha256')
      .update(JSON.stringify([context.tenantId, context.merchantId, subjectType, subjectKey, predicate]))
      .digest('hex');

    return this.prisma.$transaction(async transaction => {
      const subject = await transaction.modaGptBrainEntity.upsert({
        where: {
          tenantId_merchantId_entityType_canonicalKey: {
            tenantId: context.tenantId,
            merchantId: context.merchantId,
            entityType: subjectType,
            canonicalKey: subjectKey
          }
        },
        create: {
          tenantId: context.tenantId,
          merchantId: context.merchantId,
          entityType: subjectType,
          canonicalKey: subjectKey,
          displayName: boundedText(input.subjectName, 240, 'MODAGPT_BRAIN_ENTITY_NAME_INVALID'),
          source,
          confidence,
          status: source === 'DATABASE' || source === 'HUMAN_REVIEW' ? 'verified' : 'candidate'
        },
        update: {}
      });
      const object = input.objectType && input.objectKey && input.objectName
        ? await transaction.modaGptBrainEntity.upsert({
          where: {
            tenantId_merchantId_entityType_canonicalKey: {
              tenantId: context.tenantId,
              merchantId: context.merchantId,
              entityType: boundedText(input.objectType, 40, 'MODAGPT_BRAIN_ENTITY_TYPE_INVALID'),
              canonicalKey: boundedText(input.objectKey, 200, 'MODAGPT_BRAIN_ENTITY_KEY_INVALID')
            }
          },
          create: {
            tenantId: context.tenantId,
            merchantId: context.merchantId,
            entityType: boundedText(input.objectType, 40, 'MODAGPT_BRAIN_ENTITY_TYPE_INVALID'),
            canonicalKey: boundedText(input.objectKey, 200, 'MODAGPT_BRAIN_ENTITY_KEY_INVALID'),
            displayName: boundedText(input.objectName, 240, 'MODAGPT_BRAIN_ENTITY_NAME_INVALID'),
            source,
            confidence,
            status: source === 'DATABASE' || source === 'HUMAN_REVIEW' ? 'verified' : 'candidate'
          },
          update: {}
        })
        : null;
      const existing = await transaction.modaGptBrainFact.findMany({
        where: {
          tenantId: context.tenantId,
          merchantId: context.merchantId,
          subjectEntityId: subject.id,
          predicate,
          status: 'verified'
        },
        orderBy: { version: 'desc' },
        take: 20
      });
      const current = existing.find(fact =>
        (fact.objectEntityId || null) !== (object?.id || null)
        || (fact.value || '').trim().toLocaleLowerCase() !== (value || '').trim().toLocaleLowerCase()
      );
      if (existing.some(fact =>
        fact.objectEntityId === (object?.id || null)
        && (fact.value || '').trim().toLocaleLowerCase() === (value || '').trim().toLocaleLowerCase()
      )) {
        return { fact: existing.find(fact =>
          fact.objectEntityId === (object?.id || null)
          && (fact.value || '').trim().toLocaleLowerCase() === (value || '').trim().toLocaleLowerCase()
        )!, contradiction: false, deduplicated: true };
      }
      if (current) {
        await transaction.modaGptBrainFact.updateMany({
          where: {
            tenantId: context.tenantId,
            merchantId: context.merchantId,
            subjectEntityId: subject.id,
            predicate,
            status: 'verified'
          },
          data: { status: 'conflicted', contradictionGroupId, updatedAt: this.now() }
        });
      }
      const fact = await transaction.modaGptBrainFact.create({
        data: {
          tenantId: context.tenantId,
          merchantId: context.merchantId,
          subjectEntityId: subject.id,
          predicate,
          objectEntityId: object?.id || null,
          value,
          source,
          sourceRef: input.sourceRef ? boundedText(input.sourceRef, 160, 'MODAGPT_BRAIN_SOURCE_REF_INVALID') : null,
          sourceTrust: source === 'DATABASE' || source === 'HUMAN_REVIEW' ? 'verified' : 'unverified',
          confidence,
          verificationStatus: source === 'DATABASE' || source === 'HUMAN_REVIEW' ? 'verified' : 'candidate',
          status: current ? 'conflicted' : source === 'DATABASE' || source === 'HUMAN_REVIEW' ? 'verified' : 'candidate',
          contradictionGroupId: current ? contradictionGroupId : null,
          version: existing.reduce((max, item) => Math.max(max, item.version), 0) + 1,
          validFrom: input.validFrom,
          validUntil: input.validUntil,
          expiresAt: input.expiresAt,
          lastVerifiedAt: source === 'DATABASE' || source === 'HUMAN_REVIEW' ? this.now() : null,
          reviewedBy: source === 'HUMAN_REVIEW' ? context.actorId : null,
          reviewedAt: source === 'HUMAN_REVIEW' ? this.now() : null
        }
      });
      return { fact, contradiction: Boolean(current), deduplicated: false };
    });
  }

  async proposeLesson(context: ModaGptBrainServiceInputContext, input: ModaGptBrainLessonInput) {
    assertMerchantWriteContext(context);
    const evidenceExperienceIds = [...new Set(input.evidenceExperienceIds)];
    if (!evidenceExperienceIds.length || evidenceExperienceIds.length > 100) {
      throw new Error('MODAGPT_BRAIN_LESSON_EVIDENCE_INVALID');
    }
    const evidenceRecords = await this.prisma.modaGptBrainExperience.findMany({
      where: {
        id: { in: evidenceExperienceIds },
        tenantId: context.tenantId,
        merchantId: context.merchantId,
        status: 'verified',
        success: { not: null }
      },
      select: { id: true, success: true, verifiedAt: true, createdAt: true }
    });
    if (evidenceRecords.length !== evidenceExperienceIds.length) {
      throw new Error('MODAGPT_BRAIN_LESSON_EVIDENCE_NOT_VERIFIED');
    }
    const decision = evaluateModaGptLessonPromotion({
      lessonType: input.lessonType,
      evidence: evidenceRecords.map(record => ({
        success: record.success === true,
        verified: true,
        occurredAt: record.verifiedAt || record.createdAt
      })),
      riskLevel: input.riskLevel,
      contradictionCount: input.contradictionCount ?? 0,
      now: this.now()
    });
    const sourceRef = input.sourceRef
      ? boundedText(input.sourceRef, 160, 'MODAGPT_BRAIN_SOURCE_REF_INVALID')
      : null;
    try {
      const lesson = await this.prisma.modaGptBrainLesson.create({
        data: {
          tenantId: context.tenantId,
          merchantId: context.merchantId,
          lessonType: boundedText(input.lessonType, 40, 'MODAGPT_BRAIN_LESSON_TYPE_INVALID'),
          pattern: boundedText(input.pattern, 2_000, 'MODAGPT_BRAIN_LESSON_INVALID'),
          condition: boundedText(input.condition, 2_000, 'MODAGPT_BRAIN_LESSON_INVALID'),
          recommendation: boundedText(input.recommendation, 2_000, 'MODAGPT_BRAIN_LESSON_INVALID'),
          confidence: decision.confidence,
          evidenceCount: decision.evidenceCount,
          successRate: decision.successRate,
          status: decision.status,
          riskLevel: input.riskLevel,
          requiresApproval: decision.requiresApproval,
          source: 'AGENT',
          sourceRef,
          contradictionCount: input.contradictionCount ?? 0,
          expiresAt: input.expiresAt,
          validFrom: this.now(),
          evidence: {
            createMany: {
              data: evidenceRecords.map(record => ({
                experienceId: record.id,
                outcome: record.success ? 'success' : 'failure'
              }))
            }
          }
        }
      });
      return { lesson, decision };
    } catch (error) {
      if (
        !sourceRef
        || !error || typeof error !== 'object'
        || !('code' in error)
        || error.code !== 'P2002'
      ) throw error;
      const existing = await this.prisma.modaGptBrainLesson.findFirst({
        where: { tenantId: context.tenantId, merchantId: context.merchantId, sourceRef }
      });
      if (!existing) throw error;
      return { lesson: existing, decision };
    }
  }

  async reviewLesson(
    context: ModaGptBrainServiceInputContext,
    lessonId: string,
    decision: 'approve' | 'reject'
  ) {
    validateModaGptBrainAccessContext(context);
    if (!context.permissions.includes('brain.lessons.review')) {
      throw new Error('MODAGPT_BRAIN_REVIEW_PERMISSION_REQUIRED');
    }
    const result = await this.prisma.modaGptBrainLesson.updateMany({
      where: {
        id: boundedText(lessonId, 160, 'MODAGPT_BRAIN_LESSON_ID_INVALID'),
        tenantId: context.tenantId,
        merchantId: context.merchantId,
        status: 'pending_review',
        requiresApproval: true
      },
      data: {
        status: decision === 'approve' ? 'published' : 'rejected',
        reviewedBy: context.actorId,
        reviewedAt: this.now(),
        version: { increment: 1 }
      }
    });
    if (result.count !== 1) throw new Error('MODAGPT_BRAIN_LESSON_NOT_REVIEWABLE');
    return { id: lessonId, status: decision === 'approve' ? 'published' : 'rejected' };
  }

  async resolveFactContradiction(
    context: ModaGptBrainServiceInputContext,
    factId: string,
    decision: 'keep' | 'reject'
  ) {
    validateModaGptBrainAccessContext(context);
    if (!context.permissions.includes('brain.facts.review')) {
      throw new Error('MODAGPT_BRAIN_FACT_REVIEW_PERMISSION_REQUIRED');
    }
    const id = boundedText(factId, 160, 'MODAGPT_BRAIN_FACT_ID_INVALID');
    return this.prisma.$transaction(async transaction => {
      const fact = await transaction.modaGptBrainFact.findFirst({
        where: {
          id,
          tenantId: context.tenantId,
          merchantId: context.merchantId,
          status: 'conflicted',
          contradictionGroupId: { not: null }
        },
        select: { id: true, contradictionGroupId: true }
      });
      if (!fact?.contradictionGroupId) throw new Error('MODAGPT_BRAIN_FACT_NOT_REVIEWABLE');
      const now = this.now();
      await transaction.modaGptBrainFact.updateMany({
        where: {
          tenantId: context.tenantId,
          merchantId: context.merchantId,
          contradictionGroupId: fact.contradictionGroupId,
          status: 'conflicted'
        },
        data: {
          status: 'rejected',
          reviewedBy: context.actorId,
          reviewedAt: now,
          version: { increment: 1 },
          updatedAt: now
        }
      });
      if (decision === 'keep') {
        const kept = await transaction.modaGptBrainFact.updateMany({
          where: { id: fact.id, tenantId: context.tenantId, merchantId: context.merchantId },
          data: {
            status: 'verified',
            verificationStatus: 'verified',
            reviewedBy: context.actorId,
            reviewedAt: now,
            lastVerifiedAt: now,
            version: { increment: 1 },
            updatedAt: now
          }
        });
        if (kept.count !== 1) throw new Error('MODAGPT_BRAIN_FACT_NOT_REVIEWABLE');
      }
      return { id, status: decision === 'keep' ? 'verified' : 'rejected' };
    });
  }

  isCandidateAllowed(candidate: ModaGptBrainCandidate, context: ModaGptBrainAccessContext): boolean {
    return isModaGptBrainCandidateEligible(candidate, context, this.now());
  }
}

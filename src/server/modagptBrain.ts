export const modaGptBrainScopes = [
  'SHORT_TERM',
  'SESSION',
  'TASK',
  'MERCHANT',
  'BRAND',
  'PRODUCT',
  'CUSTOMER',
  'AGENT',
  'ORGANIZATION',
  'PLATFORM'
] as const;

export type ModaGptBrainScope = (typeof modaGptBrainScopes)[number];
export type ModaGptBrainRecordKind = 'memory' | 'knowledge' | 'fact' | 'experience' | 'lesson';

export type ModaGptBrainAccessContext = {
  tenantId: string;
  merchantId: string;
  actorId: string;
  permissions: readonly string[];
  scopes: readonly ModaGptBrainScope[];
};

export type ModaGptBrainCandidate = {
  id: string;
  tenantId: string;
  merchantId: string | null;
  kind: ModaGptBrainRecordKind;
  scope: ModaGptBrainScope;
  content: string;
  source: string;
  status: string;
  verificationStatus: string;
  confidence: number;
  importance: number;
  accessCount: number;
  createdAt: Date;
  expiresAt: Date | null;
  validFrom?: Date | null;
  validUntil?: Date | null;
  lastVerifiedAt?: Date | null;
  requiredPermissions?: readonly string[];
  semanticSimilarity?: number;
  sourceRef?: string | null;
};

export type ModaGptBrainRankedCandidate = ModaGptBrainCandidate & { score: number };

export type ModaGptLessonEvidence = {
  success: boolean;
  verified: boolean;
  occurredAt: Date;
};

export type ModaGptLessonPromotionInput = {
  lessonType: string;
  evidence: readonly ModaGptLessonEvidence[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  contradictionCount: number;
  now?: Date;
};

export type ModaGptLessonPromotionDecision = {
  status: 'candidate' | 'pending_review' | 'published';
  evidenceCount: number;
  successRate: number;
  confidence: number;
  requiresApproval: boolean;
  reason: string;
};

function tokenize(value: string): Set<string> {
  return new Set(value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .match(/[\p{L}\p{N}_-]+/gu) || []);
}

export function validateModaGptBrainAccessContext(
  context: ModaGptBrainAccessContext
): void {
  if (
    !/^[A-Za-z0-9_-]{1,120}$/.test(context.tenantId)
    || !/^[A-Za-z0-9_-]{1,120}$/.test(context.merchantId)
    || !/^[A-Za-z0-9_-]{1,160}$/.test(context.actorId)
    || context.tenantId !== context.merchantId
    || !Array.isArray(context.permissions)
    || !Array.isArray(context.scopes)
    || context.scopes.some(scope => !modaGptBrainScopes.includes(scope))
  ) throw new Error('MODAGPT_BRAIN_ACCESS_CONTEXT_INVALID');
}

export function isModaGptBrainCandidateEligible(
  candidate: ModaGptBrainCandidate,
  context: ModaGptBrainAccessContext,
  now: Date = new Date()
): boolean {
  validateModaGptBrainAccessContext(context);
  if (candidate.tenantId !== context.tenantId) return false;
  if (candidate.merchantId !== context.merchantId) return false;
  if (!context.scopes.includes(candidate.scope)) return false;
  if (
    !context.permissions.includes('*')
    && (candidate.requiredPermissions || []).some(permission => !context.permissions.includes(permission))
  ) return false;
  if (
    !Number.isFinite(candidate.confidence)
    || candidate.confidence < 0
    || candidate.confidence > 1
    || !Number.isFinite(candidate.importance)
    || candidate.importance < 0
    || candidate.importance > 1
  ) return false;
  if (candidate.expiresAt && candidate.expiresAt.getTime() <= now.getTime()) return false;
  if (candidate.validFrom && candidate.validFrom.getTime() > now.getTime()) return false;
  if (candidate.validUntil && candidate.validUntil.getTime() <= now.getTime()) return false;
  if (
    (candidate.kind === 'fact' || candidate.kind === 'experience')
    && (candidate.status !== 'verified' || candidate.verificationStatus !== 'verified')
  ) return false;
  if (candidate.kind === 'lesson' && candidate.status !== 'published') return false;
  if (
    candidate.kind === 'knowledge'
    && (candidate.status !== 'published' || candidate.verificationStatus !== 'verified')
  ) return false;
  if (candidate.kind === 'memory' && !['active', 'persistent'].includes(candidate.status)) return false;
  if (candidate.kind === 'memory' && candidate.verificationStatus === 'invalidated') return false;
  return true;
}

export function rankModaGptBrainCandidates(
  query: string,
  candidates: readonly ModaGptBrainCandidate[],
  context: ModaGptBrainAccessContext,
  options: {
    topK?: number;
    now?: Date;
    semanticScores?: ReadonlyMap<string, number>;
    kinds?: readonly ModaGptBrainRecordKind[];
  } = {}
): ModaGptBrainRankedCandidate[] {
  const topK = options.topK ?? 8;
  const now = options.now ?? new Date();
  if (!query.trim() || query.length > 1000) throw new Error('MODAGPT_BRAIN_QUERY_INVALID');
  if (!Number.isInteger(topK) || topK < 1 || topK > 20) throw new Error('MODAGPT_BRAIN_TOP_K_INVALID');
  if (options.kinds?.some(kind => !['memory', 'knowledge', 'fact', 'experience', 'lesson'].includes(kind))) {
    throw new Error('MODAGPT_BRAIN_KIND_INVALID');
  }

  const queryTokens = tokenize(query);
  const maxAccessCount = Math.max(1, ...candidates.map(candidate => candidate.accessCount));
  return candidates
    .filter(candidate => !options.kinds || options.kinds.includes(candidate.kind))
    .filter(candidate => isModaGptBrainCandidateEligible(candidate, context, now))
    .map(candidate => {
      const candidateTokens = tokenize(candidate.content);
      let overlap = 0;
      for (const token of queryTokens) if (candidateTokens.has(token)) overlap += 1;
      const keywordScore = queryTokens.size ? overlap / queryTokens.size : 0;
      const semanticScore = options.semanticScores?.get(candidate.id)
        ?? candidate.semanticSimilarity
        ?? 0;
      if (!Number.isFinite(semanticScore) || semanticScore < 0 || semanticScore > 1) {
        throw new Error('MODAGPT_BRAIN_SEMANTIC_SCORE_INVALID');
      }
      const ageDays = Math.max(0, (now.getTime() - candidate.createdAt.getTime()) / 86_400_000);
      const recencyScore = Math.exp(-ageDays / 180);
      const usageScore = Math.min(1, Math.log1p(candidate.accessCount) / Math.log1p(maxAccessCount));
      const score = keywordScore * 0.4
        + semanticScore * 0.25
        + candidate.confidence * 0.15
        + candidate.importance * 0.1
        + recencyScore * 0.07
        + usageScore * 0.03;
      return { ...candidate, score };
    })
    .filter(candidate => candidate.score > 0.08)
    .sort((left, right) =>
      right.score - left.score
      || right.createdAt.getTime() - left.createdAt.getTime()
      || left.id.localeCompare(right.id)
    )
    .slice(0, topK);
}

export function evaluateModaGptLessonPromotion(
  input: ModaGptLessonPromotionInput
): ModaGptLessonPromotionDecision {
  const now = input.now ?? new Date();
  if (!input.lessonType.trim() || input.lessonType.length > 40) {
    throw new Error('MODAGPT_BRAIN_LESSON_TYPE_INVALID');
  }
  if (!Number.isInteger(input.contradictionCount) || input.contradictionCount < 0) {
    throw new Error('MODAGPT_BRAIN_CONTRADICTION_COUNT_INVALID');
  }
  const evidence = input.evidence.filter(item =>
    item.verified
    && Number.isFinite(item.occurredAt.getTime())
    && item.occurredAt.getTime() <= now.getTime()
  );
  const evidenceCount = evidence.length;
  const successRate = evidenceCount
    ? evidence.filter(item => item.success).length / evidenceCount
    : 0;
  const mostRecentAt = evidence.reduce<Date | null>(
    (latest, item) => !latest || item.occurredAt > latest ? item.occurredAt : latest,
    null
  );
  const recency = mostRecentAt
    ? Math.exp(-Math.max(0, now.getTime() - mostRecentAt.getTime()) / (180 * 86_400_000))
    : 0;
  const sampleConfidence = evidenceCount ? 1 - Math.exp(-evidenceCount / 8) : 0;
  const confidence = Math.max(0, Math.min(1,
    successRate * sampleConfidence * recency * Math.exp(-input.contradictionCount / 2)
  ));
  const requiresApproval = input.riskLevel === 'medium'
    || input.riskLevel === 'high'
    || input.riskLevel === 'critical';

  if (evidenceCount < 5) {
    return { status: 'candidate', evidenceCount, successRate, confidence, requiresApproval, reason: 'INSUFFICIENT_EVIDENCE' };
  }
  if (input.contradictionCount > 0) {
    return { status: 'candidate', evidenceCount, successRate, confidence, requiresApproval, reason: 'CONTRADICTORY_EVIDENCE' };
  }
  if (successRate < 0.8 || confidence < 0.5) {
    return { status: 'candidate', evidenceCount, successRate, confidence, requiresApproval, reason: 'CONFIDENCE_BELOW_THRESHOLD' };
  }
  if (requiresApproval) {
    return { status: 'pending_review', evidenceCount, successRate, confidence, requiresApproval, reason: 'HUMAN_APPROVAL_REQUIRED' };
  }
  return { status: 'published', evidenceCount, successRate, confidence, requiresApproval, reason: 'PROMOTION_POLICY_PASSED' };
}

export function normalizeModaGptBrainSource(source: string): string {
  const normalized = source.trim().toUpperCase();
  if (!/^(USER|SYSTEM|DATABASE|AGENT|WEB|DOCUMENT|BUSINESS_EVENT|MODEL|HUMAN_REVIEW)$/.test(normalized)) {
    throw new Error('MODAGPT_BRAIN_SOURCE_INVALID');
  }
  return normalized;
}

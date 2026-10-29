import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

export const growthCrmCategories = ['sales', 'activation', 'retention', 'service'] as const;
export type GrowthCrmCategory = (typeof growthCrmCategories)[number];
export type GrowthCrmSubjectType = 'consumer' | 'customer' | 'prospect';
export type GrowthCrmFollowUpInput = {
  subjectType: GrowthCrmSubjectType;
  subjectId: string;
  category: GrowthCrmCategory;
  note: string;
  dueAt: string;
};
export type GrowthCrmFollowUpUpdate = Partial<Pick<GrowthCrmFollowUpInput, 'category' | 'note' | 'dueAt'>>;
export type GrowthCrmFollowUpStatus = 'open' | 'completed' | 'cancelled';
export type GrowthCrmFollowUpFilter = GrowthCrmFollowUpStatus | 'all';
export type GrowthCrmSubjectFilter = {
  subjectType: GrowthCrmSubjectType;
  subjectId: string;
} | null;
export type GrowthCrmReferralAttribution = {
  source: string;
  registeredAt: string;
  firstClickAt: string | null;
  firstPaidAt: string | null;
  partner: { partnerCode: string; name: string };
  cityPartner: { partnerCode: string; name: string } | null;
  networkPartner: { partnerCode: string; name: string } | null;
  campaign: { name: string; channel: string } | null;
};
export type GrowthCrmAutomationCandidate = {
  consumerId: string;
  category: 'activation' | 'retention';
  note: string;
  dueAt: Date;
  automationKey: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function buildGrowthCrmAutomationCandidates(
  consumers: Array<{
    id: string;
    status: string;
    createdAt: Date;
    ordersCount: number;
    lastLoginAt: Date | null;
  }>,
  now: Date
): GrowthCrmAutomationCandidate[] {
  const activationCutoff = now.getTime() - 3 * DAY_MS;
  const inactiveCutoff = now.getTime() - 7 * DAY_MS;
  const candidates: GrowthCrmAutomationCandidate[] = [];
  for (const consumer of consumers) {
    if (consumer.status !== 'active') continue;
    if (consumer.ordersCount === 0 && consumer.createdAt.getTime() <= activationCutoff) {
      candidates.push({
        consumerId: consumer.id,
        category: 'activation',
        note: '账号注册已超过 3 天且当前订单数为 0。请人工核实其是否需要开通或选购协助；本任务仅用于内部跟进。',
        dueAt: now,
        automationKey: `growth-crm:activation:v1:${consumer.id}:${consumer.createdAt.getTime()}`
      });
    }
    if (consumer.ordersCount > 0 && consumer.lastLoginAt && consumer.lastLoginAt.getTime() <= inactiveCutoff) {
      candidates.push({
        consumerId: consumer.id,
        category: 'retention',
        note: '有历史订单的账号已超过 7 天未登录。请人工核实是否需要服务协助；本任务仅用于内部跟进。',
        dueAt: now,
        automationKey: `growth-crm:retention:v1:${consumer.id}:${consumer.lastLoginAt.getTime()}`
      });
    }
  }
  return candidates;
}

export async function createGrowthCrmAutomationFollowUps(
  prisma: Pick<PrismaClient, '$queryRaw' | 'growthCrmFollowUp'>,
  now: Date
): Promise<number> {
  type ConsumerAutomationCandidate = {
    id: string;
    status: string;
    createdAt: Date;
    ordersCount: number;
    lastLoginAt: Date | null;
  };
  const consumers = await prisma.$queryRaw<ConsumerAutomationCandidate[]>`
    SELECT c."id", c."status", c."createdAt", c."ordersCount", c."lastLoginAt"
    FROM "Consumer" c
    WHERE c."status" = 'active'
      AND (
        (
          c."ordersCount" = 0
          AND c."createdAt" <= ${new Date(now.getTime() - 3 * DAY_MS)}
          AND NOT EXISTS (
            SELECT 1 FROM "GrowthCrmFollowUp" f
            WHERE f."consumerId" = c."id"
              AND f."category" = 'activation'
              AND f."status" = 'open'
          )
          AND NOT EXISTS (
            SELECT 1 FROM "GrowthCrmFollowUp" f
            WHERE f."automationKey" = CONCAT(
              'growth-crm:activation:v1:', c."id", ':',
              ((EXTRACT(EPOCH FROM c."createdAt") * 1000)::BIGINT)::TEXT
            )
          )
        )
        OR (
          c."ordersCount" > 0
          AND c."lastLoginAt" IS NOT NULL
          AND c."lastLoginAt" <= ${new Date(now.getTime() - 7 * DAY_MS)}
          AND NOT EXISTS (
            SELECT 1 FROM "GrowthCrmFollowUp" f
            WHERE f."consumerId" = c."id"
              AND f."category" = 'retention'
              AND f."status" = 'open'
          )
          AND NOT EXISTS (
            SELECT 1 FROM "GrowthCrmFollowUp" f
            WHERE f."automationKey" = CONCAT(
              'growth-crm:retention:v1:', c."id", ':',
              ((EXTRACT(EPOCH FROM c."lastLoginAt") * 1000)::BIGINT)::TEXT
            )
          )
        )
      )
    ORDER BY c."id"
    LIMIT 500
  `;
  const candidates = buildGrowthCrmAutomationCandidates(consumers, now);
  if (!candidates.length) return 0;
  const result = await prisma.growthCrmFollowUp.createMany({
    data: candidates.map(candidate => ({
      id: randomUUID(),
      consumerId: candidate.consumerId,
      category: candidate.category,
      note: candidate.note,
      dueAt: candidate.dueAt,
      createdBy: 'Growth OS automation',
      automationKey: candidate.automationKey
    })),
    skipDuplicates: true
  });
  return result.count;
}

export function validateGrowthCrmFollowUpInput(value: unknown): GrowthCrmFollowUpInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('GROWTH_CRM_FOLLOW_UP_INVALID');
  }
  const body = value as Record<string, unknown>;
  const subjectType = body.subjectType;
  const subjectId = typeof body.subjectId === 'string' ? body.subjectId.trim() : '';
  const category = body.category;
  const note = typeof body.note === 'string' ? body.note.trim() : '';
  const dueAt = typeof body.dueAt === 'string' ? body.dueAt : '';
  if (
    (subjectType !== 'consumer' && subjectType !== 'customer' && subjectType !== 'prospect')
    || !/^[A-Za-z0-9_-]{8,80}$/.test(subjectId)
    || !growthCrmCategories.includes(category as GrowthCrmCategory)
    || !note
    || note.length > 1_000
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(note)
    || !Number.isFinite(Date.parse(dueAt))
  ) throw new Error('GROWTH_CRM_FOLLOW_UP_INVALID');
  return {
    subjectType,
    subjectId,
    category: category as GrowthCrmCategory,
    note,
    dueAt: new Date(dueAt).toISOString()
  };
}

export function validateGrowthCrmFollowUpUpdate(value: unknown): GrowthCrmFollowUpUpdate {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('GROWTH_CRM_FOLLOW_UP_UPDATE_INVALID');
  }
  const body = value as Record<string, unknown>;
  const allowedKeys = new Set(['category', 'note', 'dueAt']);
  if (Object.keys(body).some(key => !allowedKeys.has(key))) {
    throw new Error('GROWTH_CRM_FOLLOW_UP_UPDATE_INVALID');
  }
  const update: GrowthCrmFollowUpUpdate = {};
  if ('category' in body) {
    if (!growthCrmCategories.includes(body.category as GrowthCrmCategory)) {
      throw new Error('GROWTH_CRM_FOLLOW_UP_UPDATE_INVALID');
    }
    update.category = body.category as GrowthCrmCategory;
  }
  if ('note' in body) {
    const note = typeof body.note === 'string' ? body.note.trim() : '';
    if (!note || note.length > 1_000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(note)) {
      throw new Error('GROWTH_CRM_FOLLOW_UP_UPDATE_INVALID');
    }
    update.note = note;
  }
  if ('dueAt' in body) {
    const dueAt = typeof body.dueAt === 'string' ? body.dueAt : '';
    if (!Number.isFinite(Date.parse(dueAt))) {
      throw new Error('GROWTH_CRM_FOLLOW_UP_UPDATE_INVALID');
    }
    update.dueAt = new Date(dueAt).toISOString();
  }
  if (!Object.keys(update).length) throw new Error('GROWTH_CRM_FOLLOW_UP_UPDATE_INVALID');
  return update;
}

export function validateGrowthCrmFollowUpStatus(value: unknown): Exclude<GrowthCrmFollowUpStatus, 'open'> {
  if (value !== 'completed' && value !== 'cancelled') {
    throw new Error('GROWTH_CRM_FOLLOW_UP_STATUS_INVALID');
  }
  return value;
}

export function validateGrowthCrmFollowUpResolution(value: unknown): {
  status: Exclude<GrowthCrmFollowUpStatus, 'open'>;
  resolutionNote: string | null;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('GROWTH_CRM_FOLLOW_UP_STATUS_INVALID');
  }
  const body = value as Record<string, unknown>;
  const status = validateGrowthCrmFollowUpStatus(body.status);
  const resolutionNote = typeof body.resolutionNote === 'string' ? body.resolutionNote.trim() : '';
  if (resolutionNote.length > 1_000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(resolutionNote)) {
    throw new Error('GROWTH_CRM_FOLLOW_UP_RESOLUTION_INVALID');
  }
  if (status === 'completed' && !resolutionNote) {
    throw new Error('GROWTH_CRM_FOLLOW_UP_RESOLUTION_REQUIRED');
  }
  return { status, resolutionNote: resolutionNote || null };
}

export function isGrowthCrmFollowUpStatus(value: unknown): value is GrowthCrmFollowUpStatus {
  return value === 'open' || value === 'completed' || value === 'cancelled';
}

export function validateGrowthCrmFollowUpFilter(value: unknown): GrowthCrmFollowUpFilter {
  if (value === undefined || value === 'open') return 'open';
  if (value === 'all' || isGrowthCrmFollowUpStatus(value)) return value;
  throw new Error('GROWTH_CRM_FOLLOW_UP_FILTER_INVALID');
}

export function validateGrowthCrmSubjectFilter(subjectType: unknown, subjectId: unknown): GrowthCrmSubjectFilter {
  if (subjectType === undefined && subjectId === undefined) return null;
  if (
    (subjectType !== 'consumer' && subjectType !== 'customer' && subjectType !== 'prospect')
    || typeof subjectId !== 'string'
    || !/^[A-Za-z0-9_-]{8,80}$/.test(subjectId)
  ) throw new Error('GROWTH_CRM_SUBJECT_FILTER_INVALID');
  return { subjectType, subjectId };
}

export function serializeGrowthCrmReferralAttribution(
  referral: {
    source: string;
    registeredAt: Date;
    firstClickAt: Date | null;
    firstPaidAt: Date | null;
    partner: { partnerCode: string; name: string };
    cityPartner: { partnerCode: string; name: string } | null;
    networkPartner: { partnerCode: string; name: string } | null;
    campaign: { name: string; channel: string } | null;
  } | null
): GrowthCrmReferralAttribution | null {
  if (!referral) return null;
  return {
    source: referral.source,
    registeredAt: referral.registeredAt.toISOString(),
    firstClickAt: referral.firstClickAt?.toISOString() ?? null,
    firstPaidAt: referral.firstPaidAt?.toISOString() ?? null,
    partner: referral.partner,
    cityPartner: referral.cityPartner,
    networkPartner: referral.networkPartner,
    campaign: referral.campaign
  };
}

export function isGrowthCrmCategory(value: unknown): value is GrowthCrmCategory {
  return growthCrmCategories.some(category => category === value);
}

export function buildGrowthCrmDueReminder(followUp: {
  id: string;
  category: GrowthCrmCategory;
  dueAt: Date;
}) {
  const dueAt = followUp.dueAt.toISOString();
  return {
    eventType: 'growth.crm.follow_up.due',
    channel: 'in_app',
    recipient: 'admin',
    payload: JSON.stringify({
      referenceId: followUp.id,
      category: followUp.category,
      dueAt
    }),
    status: 'sent',
    idempotencyKey: buildGrowthCrmDueReminderIdempotencyKey(followUp.id, followUp.dueAt)
  };
}

export function buildGrowthCrmDueReminderIdempotencyKey(followUpId: string, dueAt: Date): string {
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(followUpId) || !Number.isFinite(dueAt.getTime())) {
    throw new Error('GROWTH_CRM_REMINDER_IDENTITY_INVALID');
  }
  return `growth-crm-follow-up-due:${followUpId}:${dueAt.getTime()}`;
}

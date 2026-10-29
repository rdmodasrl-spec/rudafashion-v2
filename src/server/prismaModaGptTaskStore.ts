import { createHash, randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  ModaGptTask,
  ModaGptTaskStatus,
  ModaGptTaskStore,
  ModaGptTaskType
} from './modagptTaskQueue';

type ClaimedTaskRow = { id: string };
type GrowthMissionReviewTaskInput = {
  missionId: string;
  recommendationIndex: number;
  reviewRound: number;
};

type GrowthMissionReviewTaskRow = {
  id: string;
  status: string;
  taskType: string;
  merchantId: string | null;
  tenantId: string | null;
  actorId: string | null;
  traceId: string;
  parentTaskId: string | null;
  goal: string;
  priority: number;
  agentId: string | null;
  payload: string;
  context: string;
  plan: string | null;
  idempotencyKey: string | null;
};

export class PrismaModaGptTaskStore implements ModaGptTaskStore {
  constructor(private readonly prisma: PrismaClient, private readonly now: () => Date = () => new Date()) {}

  static async pauseGrowthMissionReviewTasks(
    transaction: Prisma.TransactionClient,
    missionId: string,
    now = new Date()
  ): Promise<number> {
    return this.stopGrowthMissionReviewTasks(transaction, missionId, 'GROWTH_MISSION_PAUSED', now);
  }

  static async cancelGrowthMissionReviewTasks(
    transaction: Prisma.TransactionClient,
    missionId: string,
    now = new Date()
  ): Promise<number> {
    return this.stopGrowthMissionReviewTasks(transaction, missionId, 'GROWTH_MISSION_CANCELLED', now);
  }

  static async resumeGrowthMissionReviewTasks(
    transaction: Prisma.TransactionClient,
    missionId: string,
    now = new Date()
  ): Promise<number> {
    if (!/^[A-Za-z0-9_-]{8,40}$/.test(missionId)) {
      throw new Error('MODAGPT_GROWTH_REVIEW_TASK_INVALID');
    }
    const resumed = await transaction.modaGptTask.updateMany({
      where: {
        taskType: 'growth.mission.review',
        tenantId: 'platform',
        merchantId: null,
        status: 'cancelled',
        lastErrorCode: 'GROWTH_MISSION_PAUSED',
        payload: { contains: `"missionId":"${missionId}"` }
      },
      data: {
        status: 'queued',
        availableAt: now,
        lockedBy: null,
        lockedUntil: null,
        lastErrorCode: null,
        error: null,
        completedAt: null
      }
    });
    return resumed.count;
  }

  private static async stopGrowthMissionReviewTasks(
    transaction: Prisma.TransactionClient,
    missionId: string,
    reason: 'GROWTH_MISSION_PAUSED' | 'GROWTH_MISSION_CANCELLED',
    now: Date
  ): Promise<number> {
    if (!/^[A-Za-z0-9_-]{8,40}$/.test(missionId)) {
      throw new Error('MODAGPT_GROWTH_REVIEW_TASK_INVALID');
    }
    const stopped = await transaction.modaGptTask.updateMany({
      where: {
        taskType: 'growth.mission.review',
        tenantId: 'platform',
        merchantId: null,
        status: { in: ['queued', 'planning', 'running', 'waiting_approval', 'verifying', 'retrying'] },
        payload: { contains: `"missionId":"${missionId}"` }
      },
      data: {
        status: 'cancelled',
        lastErrorCode: reason,
        error: JSON.stringify({ code: reason }),
        completedAt: now,
        lockedBy: null,
        lockedUntil: null
      }
    });
    return stopped.count;
  }

  static async enqueueGrowthMissionReviewBatch(
    transaction: Prisma.TransactionClient,
    inputs: GrowthMissionReviewTaskInput[]
  ): Promise<{
    tasks: Array<{ id: string; status: ModaGptTaskStatus; deduplicated: boolean }>;
    createdCount: number;
  }> {
    const prepared = inputs.map(input => {
      if (!/^[A-Za-z0-9_-]{8,40}$/.test(input.missionId)
        || !Number.isInteger(input.recommendationIndex) || input.recommendationIndex < 0 || input.recommendationIndex > 11
        || !Number.isSafeInteger(input.reviewRound) || input.reviewRound < 0 || input.reviewRound >= 1_000_000) {
        throw new Error('MODAGPT_GROWTH_REVIEW_TASK_INVALID');
      }
      const legacyKey = input.reviewRound === 0
        ? `growth-mission-review:${input.missionId}:v1:${input.recommendationIndex}`
        : `growth-mission-review:${input.missionId}:v1:${input.recommendationIndex}:r${input.reviewRound}`;
      const idempotencyKey = `tenant:${createHash('sha256').update(JSON.stringify(['platform', legacyKey])).digest('hex')}`;
      const payload = JSON.stringify({
        version: 1,
        missionId: input.missionId,
        recommendationIndex: input.recommendationIndex
      });
      const context = JSON.stringify({
        missionId: input.missionId,
        recommendationIndex: input.recommendationIndex,
        reviewRound: input.reviewRound
      });
      return {
        id: randomUUID(),
        taskType: 'growth.mission.review',
        merchantId: null,
        tenantId: 'platform',
        actorId: 'growth-mission-system',
        traceId: `growth-mission-${input.missionId}-${input.recommendationIndex}-${input.reviewRound}`,
        parentTaskId: null,
        goal: `Prepare internal human review for Growth Mission ${input.missionId}`,
        priority: 0,
        agentId: null,
        payload,
        context,
        plan: null,
        idempotencyKey,
        legacyKey,
        maxAttempts: 3
      };
    });
    const keys = prepared.flatMap(({ idempotencyKey, legacyKey }) => [idempotencyKey, legacyKey]);
    const existingRows = keys.length
      ? await transaction.modaGptTask.findMany({
        where: { idempotencyKey: { in: keys } },
        select: {
          id: true,
          status: true,
          taskType: true,
          merchantId: true,
          tenantId: true,
          actorId: true,
          traceId: true,
          parentTaskId: true,
          goal: true,
          priority: true,
          agentId: true,
          payload: true,
          context: true,
          plan: true,
          idempotencyKey: true
        }
      })
      : [];
    const existingByKey = new Map(existingRows.map(row => [row.idempotencyKey, row]));
    const matched = prepared.map(input => {
      const existing = existingByKey.get(input.idempotencyKey) ?? existingByKey.get(input.legacyKey);
      if (existing && (
        existing.taskType !== input.taskType
        || existing.merchantId !== input.merchantId
        || existing.tenantId !== input.tenantId
        || existing.payload !== input.payload
        || (existing.idempotencyKey !== input.legacyKey && (
          existing.actorId !== input.actorId
          || existing.traceId !== input.traceId
          || existing.parentTaskId !== input.parentTaskId
          || existing.goal !== input.goal
          || existing.priority !== input.priority
          || existing.agentId !== input.agentId
          || existing.context !== input.context
          || existing.plan !== input.plan
        ))
      )) throw new Error('MODAGPT_TASK_IDEMPOTENCY_CONFLICT');
      return { input, existing };
    });
    const missing = matched.filter(item => !item.existing);
    const created = missing.length
      ? await transaction.modaGptTask.createMany({
        data: missing.map(({ input }) => ({
          id: input.id,
          taskType: input.taskType,
          merchantId: input.merchantId,
          tenantId: input.tenantId,
          actorId: input.actorId,
          traceId: input.traceId,
          parentTaskId: input.parentTaskId,
          goal: input.goal,
          priority: input.priority,
          agentId: input.agentId,
          payload: input.payload,
          context: input.context,
          plan: input.plan,
          idempotencyKey: input.idempotencyKey,
          maxAttempts: input.maxAttempts
        })),
        skipDuplicates: true
      })
      : { count: 0 };
    const persistedRows = keys.length
      ? await transaction.modaGptTask.findMany({
        where: { idempotencyKey: { in: keys } },
        select: {
          id: true,
          status: true,
          taskType: true,
          merchantId: true,
          tenantId: true,
          actorId: true,
          traceId: true,
          parentTaskId: true,
          goal: true,
          priority: true,
          agentId: true,
          payload: true,
          context: true,
          plan: true,
          idempotencyKey: true
        }
      })
      : [];
    const persistedByKey = new Map(persistedRows.map(row => [row.idempotencyKey, row]));
    const tasks = prepared.map(input => {
      const row = persistedByKey.get(input.idempotencyKey) ?? persistedByKey.get(input.legacyKey);
      if (!row) throw new Error('MODAGPT_GROWTH_REVIEW_TASK_PERSISTENCE_FAILED');
      if (
        row.taskType !== input.taskType
        || row.merchantId !== input.merchantId
        || row.tenantId !== input.tenantId
        || row.payload !== input.payload
        || (row.idempotencyKey !== input.legacyKey && (
          row.actorId !== input.actorId
          || row.traceId !== input.traceId
          || row.parentTaskId !== input.parentTaskId
          || row.goal !== input.goal
          || row.priority !== input.priority
          || row.agentId !== input.agentId
          || row.context !== input.context
          || row.plan !== input.plan
        ))
      ) throw new Error('MODAGPT_TASK_IDEMPOTENCY_CONFLICT');
      return {
        id: row.id,
        status: row.status as ModaGptTaskStatus,
        deduplicated: row.id !== input.id
      };
    });
    return { tasks, createdCount: created.count };
  }

  async enqueue(input: {
    taskType: ModaGptTaskType;
    payload: string;
    merchantId: string | null;
    tenantId: string | null;
    actorId: string | null;
    traceId: string;
    parentTaskId: string | null;
    goal: string;
    priority: number;
    agentId: string | null;
    context: string;
    plan: string | null;
    idempotencyKey: string | null;
    legacyIdempotencyKey?: string | null;
    maxAttempts: number;
  }): Promise<{ id: string; status: ModaGptTaskStatus; deduplicated: boolean }> {
    const data = {
      taskType: input.taskType,
      payload: input.payload,
      merchantId: input.merchantId,
      tenantId: input.tenantId,
      actorId: input.actorId,
      traceId: input.traceId,
      parentTaskId: input.parentTaskId,
      goal: input.goal,
      priority: input.priority,
      agentId: input.agentId,
      context: input.context,
      plan: input.plan,
      idempotencyKey: input.idempotencyKey,
      maxAttempts: input.maxAttempts
    };
    if (input.idempotencyKey) {
      try {
        const task = await this.prisma.modaGptTask.create({
          data,
          select: { id: true, status: true }
        });
        return { ...task, status: task.status as ModaGptTaskStatus, deduplicated: false };
      } catch (error) {
        if (
          !error || typeof error !== 'object'
          || !('code' in error)
          || error.code !== 'P2002'
        ) throw error;
        let existing = await this.prisma.modaGptTask.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          select: {
            id: true, status: true, taskType: true, merchantId: true, tenantId: true,
            actorId: true, traceId: true, parentTaskId: true, goal: true, priority: true,
            agentId: true, payload: true, context: true, plan: true
          }
        });
        let matchedLegacyKey = false;
        if (!existing && input.legacyIdempotencyKey && input.legacyIdempotencyKey !== input.idempotencyKey) {
          existing = await this.prisma.modaGptTask.findUnique({
            where: { idempotencyKey: input.legacyIdempotencyKey },
            select: {
              id: true, status: true, taskType: true, merchantId: true, tenantId: true,
              actorId: true, traceId: true, parentTaskId: true, goal: true, priority: true,
              agentId: true, payload: true, context: true, plan: true
            }
          });
          matchedLegacyKey = Boolean(existing);
        }
        if (!existing) throw error;
        if (
          existing.taskType !== input.taskType
          || existing.merchantId !== input.merchantId
          || existing.tenantId !== input.tenantId
          || existing.payload !== input.payload
          || (!matchedLegacyKey && (
            existing.actorId !== input.actorId
            || existing.traceId !== input.traceId
            || existing.parentTaskId !== input.parentTaskId
            || existing.goal !== input.goal
            || existing.priority !== input.priority
            || existing.agentId !== input.agentId
            || existing.context !== input.context
            || existing.plan !== input.plan
          ))
        ) throw new Error('MODAGPT_TASK_IDEMPOTENCY_CONFLICT');
        return { ...existing, status: existing.status as ModaGptTaskStatus, deduplicated: true };
      }
    }

    const task = await this.prisma.modaGptTask.create({
      data: { ...data, idempotencyKey: null },
      select: { id: true, status: true }
    });
    return { ...task, status: task.status as ModaGptTaskStatus, deduplicated: false };
  }

  async claim(workerId: string, leaseMs: number): Promise<ModaGptTask<string> | null> {
    return this.prisma.$transaction(async transaction => {
      const now = this.now();
      await transaction.$executeRaw`
        UPDATE "ModaGptTask"
        SET "status" = 'dead_letter',
            "lockedBy" = NULL,
            "lockedUntil" = NULL,
            "lastErrorCode" = 'MODAGPT_TASK_LEASE_EXPIRED',
            "error" = '{"code":"MODAGPT_TASK_LEASE_EXPIRED"}',
            "completedAt" = ${now},
            "updatedAt" = ${now}
        WHERE "status" IN ('planning', 'running', 'verifying')
          AND "lockedUntil" <= (now() AT TIME ZONE 'UTC')
          AND "attempts" >= "maxAttempts"
      `;
      const rows = await transaction.$queryRaw<ClaimedTaskRow[]>`
        SELECT "id"
        FROM "ModaGptTask"
        WHERE (
          ("status" IN ('queued', 'retrying') AND "availableAt" <= (now() AT TIME ZONE 'UTC'))
          OR ("status" IN ('planning', 'running', 'verifying') AND "lockedUntil" <= (now() AT TIME ZONE 'UTC') AND "attempts" < "maxAttempts")
        )
        ORDER BY "priority" DESC, "availableAt" ASC, "createdAt" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `;
      const candidate = rows[0];
      if (!candidate) return null;
      const claimed = await transaction.modaGptTask.update({
        where: { id: candidate.id },
        data: {
          status: 'running',
          attempts: { increment: 1 },
          lockedBy: workerId,
          lockedUntil: new Date(now.getTime() + leaseMs),
          startedAt: { set: now }
        }
      });
      return {
        id: claimed.id,
        merchantId: claimed.merchantId,
        tenantId: claimed.tenantId,
        actorId: claimed.actorId,
        traceId: claimed.traceId,
        parentTaskId: claimed.parentTaskId,
        goal: claimed.goal,
        taskType: claimed.taskType as ModaGptTaskType,
        status: claimed.status as ModaGptTaskStatus,
        priority: claimed.priority,
        agentId: claimed.agentId,
        payload: claimed.payload,
        context: claimed.context,
        plan: claimed.plan,
        attempts: claimed.attempts,
        retryCount: claimed.retryCount,
        maxAttempts: claimed.maxAttempts,
        idempotencyKey: claimed.idempotencyKey,
        lockedBy: claimed.lockedBy,
        error: claimed.error
      };
    });
  }

  async renewLease(id: string, workerId: string, leaseMs: number): Promise<boolean> {
    const now = this.now();
    const renewed = await this.prisma.modaGptTask.updateMany({
      where: {
        id,
        status: { in: ['planning', 'running', 'verifying'] },
        lockedBy: workerId,
        lockedUntil: { gt: now }
      },
      data: { lockedUntil: new Date(now.getTime() + leaseMs) }
    });
    return renewed.count === 1;
  }

  async persistPlan(id: string, workerId: string, plan: string): Promise<boolean> {
    const updated = await this.prisma.modaGptTask.updateMany({
      where: {
        id,
        status: { in: ['planning', 'running', 'verifying'] },
        lockedBy: workerId
      },
      data: { plan }
    });
    return updated.count === 1;
  }

  async complete(
    id: string,
    workerId: string,
    result: string,
    status: 'completed' | 'waiting_approval'
  ): Promise<boolean> {
    const updated = await this.prisma.modaGptTask.updateMany({
      where: { id, status: { in: ['running', 'verifying'] }, lockedBy: workerId },
      data: {
        status,
        result,
        error: null,
        lockedBy: null,
        lockedUntil: null,
        lastErrorCode: null,
        completedAt: status === 'completed' ? this.now() : null
      }
    });
    return updated.count === 1;
  }

  async transition(input: {
    id: string;
    expectedStatus: ModaGptTaskStatus;
    status: ModaGptTaskStatus;
    workerId?: string;
  }): Promise<boolean> {
    const keepCancelledWorkerLease = input.status === 'cancelled' && Boolean(input.workerId);
    const releasesLease = ['waiting_approval', 'completed', 'failed', 'dead_letter', 'cancelled'].includes(input.status)
      && !keepCancelledWorkerLease;
    const requeues = input.status === 'queued' || input.status === 'retrying';
    const updated = await this.prisma.modaGptTask.updateMany({
      where: {
        id: input.id,
        status: input.expectedStatus,
        ...(input.workerId ? { lockedBy: input.workerId } : {})
      },
      data: {
        status: input.status,
        ...(releasesLease ? { lockedBy: null, lockedUntil: null } : {}),
        ...(requeues ? {
          availableAt: this.now(),
          lockedBy: null,
          lockedUntil: null,
          lastErrorCode: null,
          error: null,
          completedAt: null
        } : {}),
        ...(['completed', 'failed', 'dead_letter', 'cancelled'].includes(input.status)
          ? { completedAt: this.now() }
          : { completedAt: null })
      }
    });
    return updated.count === 1;
  }

  async fail(input: {
    id: string;
    workerId: string;
    errorCode: string;
    retryAt: Date | null;
  }): Promise<boolean> {
    return this.prisma.$transaction(async transaction => {
      const updated = await transaction.modaGptTask.updateMany({
        where: { id: input.id, status: { in: ['planning', 'running', 'verifying'] }, lockedBy: input.workerId },
        data: {
          status: input.retryAt ? 'retrying' : 'dead_letter',
          ...(input.retryAt ? { retryCount: { increment: 1 } } : {}),
          availableAt: input.retryAt ?? this.now(),
          lockedBy: null,
          lockedUntil: null,
          lastErrorCode: input.errorCode,
          error: JSON.stringify({ code: input.errorCode }),
          completedAt: input.retryAt ? null : this.now()
        }
      });
      if (updated.count !== 1) return false;
      if (!input.retryAt) {
        const task = await transaction.modaGptTask.findUniqueOrThrow({
          where: { id: input.id },
          select: { taskType: true, tenantId: true }
        });
        const eventType = 'modagpt.task.dead_letter';
        await transaction.notificationEvent.createMany({
          data: [{
            id: randomUUID(),
            eventType,
            channel: 'in_app',
            recipient: 'admin',
            payload: JSON.stringify({
              referenceId: input.id,
              taskType: task.taskType,
              tenantId: task.tenantId,
              errorCode: input.errorCode
            }),
            status: 'sent',
            idempotencyKey: `${eventType}:in_app:admin:${input.id}`
          }],
          skipDuplicates: true
        });
      }
      return true;
    });
  }
}

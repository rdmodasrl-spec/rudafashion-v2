import 'dotenv/config';
import assert from 'node:assert/strict';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import { ModaGptTaskRuntime } from '../../src/server/modagptTaskQueue';
import { PrismaModaGptTaskStore } from '../../src/server/prismaModaGptTaskStore';

const databaseUrl = process.env.MODAGPT_TEST_DATABASE_URL;
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
const store = new PrismaModaGptTaskStore(prisma);
const runtime = new ModaGptTaskRuntime(store);

test('PostgreSQL enforces tenant idempotency, lease-guarded phases, and expired-lease recovery', async () => {
  const taskIds: string[] = [];
  const auditLogIds: string[] = [];
  try {
    const missionId = `g-${crypto.randomUUID()}`;
    const reviewInputs = [
      { missionId, recommendationIndex: 0, reviewRound: 0 },
      { missionId, recommendationIndex: 1, reviewRound: 0 }
    ];
    const rolledBackAuditId = crypto.randomUUID();
    await assert.rejects(prisma.$transaction(async transaction => {
      const batch = await PrismaModaGptTaskStore.enqueueGrowthMissionReviewBatch(transaction, reviewInputs);
      taskIds.push(...batch.tasks.map(task => task.id));
      await transaction.auditLog.create({
        data: {
          id: rolledBackAuditId,
          userId: 'usr-system',
          userName: 'integration-test',
          role: 'system',
          action: 'GROWTH_MISSION_REVIEW_TASKS_QUEUED',
          entity: 'GrowthMission',
          entityId: missionId
        }
      });
      throw new Error('INTEGRATION_FORCE_TRANSACTION_ROLLBACK');
    }), /INTEGRATION_FORCE_TRANSACTION_ROLLBACK/);
    assert.equal(await prisma.modaGptTask.count({ where: { id: { in: taskIds } } }), 0);
    assert.equal(await prisma.auditLog.count({ where: { id: rolledBackAuditId } }), 0);
    taskIds.length = 0;

    const committedAuditId = crypto.randomUUID();
    auditLogIds.push(committedAuditId);
    const committedBatch = await prisma.$transaction(async transaction => {
      const batch = await PrismaModaGptTaskStore.enqueueGrowthMissionReviewBatch(transaction, reviewInputs);
      await transaction.auditLog.create({
        data: {
          id: committedAuditId,
          userId: 'usr-system',
          userName: 'integration-test',
          role: 'system',
          action: 'GROWTH_MISSION_REVIEW_TASKS_QUEUED',
          entity: 'GrowthMission',
          entityId: missionId
        }
      });
      return batch;
    });
    taskIds.push(...committedBatch.tasks.map(task => task.id));
    assert.equal(committedBatch.createdCount, 2);
    assert.equal(await prisma.auditLog.count({ where: { id: committedAuditId } }), 1);
    const replayBatch = await prisma.$transaction(transaction =>
      PrismaModaGptTaskStore.enqueueGrowthMissionReviewBatch(transaction, reviewInputs)
    );
    assert.equal(replayBatch.createdCount, 0);
    assert.deepEqual(replayBatch.tasks.map(task => task.id), committedBatch.tasks.map(task => task.id));
    await prisma.modaGptTask.updateMany({
      where: { id: { in: committedBatch.tasks.map(task => task.id) } },
      data: { priority: 100 }
    });
    const [reviewClaimA, reviewClaimB] = await Promise.all([
      store.claim('growth-review-worker-a', 60_000),
      store.claim('growth-review-worker-b', 60_000)
    ]);
    assert.deepEqual(
      new Set([reviewClaimA?.id, reviewClaimB?.id]),
      new Set(committedBatch.tasks.map(task => task.id))
    );
    assert.deepEqual(new Set([reviewClaimA?.lockedBy, reviewClaimB?.lockedBy]), new Set([
      'growth-review-worker-a',
      'growth-review-worker-b'
    ]));
    assert.equal(await prisma.$transaction(transaction =>
      PrismaModaGptTaskStore.pauseGrowthMissionReviewTasks(transaction, missionId)
    ), 2);
    assert.equal(await prisma.modaGptTask.count({
      where: { id: { in: committedBatch.tasks.map(task => task.id) }, status: 'cancelled', lastErrorCode: 'GROWTH_MISSION_PAUSED' }
    }), 2);
    assert.equal(await prisma.$transaction(transaction =>
      PrismaModaGptTaskStore.resumeGrowthMissionReviewTasks(transaction, missionId)
    ), 2);
    assert.equal(await prisma.$transaction(transaction =>
      PrismaModaGptTaskStore.cancelGrowthMissionReviewTasks(transaction, missionId)
    ), 2);
    assert.equal(await prisma.modaGptTask.count({
      where: { id: { in: committedBatch.tasks.map(task => task.id) }, status: 'cancelled', lastErrorCode: 'GROWTH_MISSION_CANCELLED' }
    }), 2);

    const input = {
      taskType: 'ai.workflow.run' as const,
      merchantId: 'modagpt-integration-tenant-a',
      tenantId: 'modagpt-integration-tenant-a',
      actorId: 'modagpt-postgres-integration',
      goal: 'Verify durable task transitions',
      idempotencyKey: `postgres-integration:${crypto.randomUUID()}`,
      payload: { workflow: 'integration_probe' },
      maxAttempts: 3
    };
    const created = await runtime.enqueue(input);
    taskIds.push(created.id);
    assert.equal(created.deduplicated, false);
    const replay = await runtime.enqueue(input);
    assert.equal(replay.id, created.id);
    assert.equal(replay.deduplicated, true);

    await assert.rejects(
      runtime.enqueue({ ...input, payload: { workflow: 'changed_payload' } }),
      /MODAGPT_TASK_IDEMPOTENCY_CONFLICT/
    );

    const otherTenant = await runtime.enqueue({
      ...input,
      merchantId: 'modagpt-integration-tenant-b',
      tenantId: 'modagpt-integration-tenant-b'
    });
    taskIds.push(otherTenant.id);
    assert.notEqual(otherTenant.id, created.id);
    assert.equal(await store.transition({
      id: otherTenant.id,
      expectedStatus: 'queued',
      status: 'cancelled'
    }), true);

    const firstClaim = await store.claim('integration-worker-a', 60_000);
    assert.equal(firstClaim?.id, created.id);
    assert.equal(firstClaim?.status, 'running');
    assert.equal(firstClaim?.attempts, 1);
    const plan = JSON.stringify({
      plan_id: `integration-plan:${created.id}`,
      task_id: created.id,
      trace_id: firstClaim?.traceId,
      tenant_id: firstClaim?.tenantId,
      goal: firstClaim?.goal,
      steps: [{
        step_id: 'verify_queue_store',
        dependencies: [],
        agent: 'business-manager',
        tool: null,
        expected_result: 'Persisted task plan remains tenant and lease bound.',
        risk_level: 'LOW',
        status: 'planned'
      }],
      risk_level: 'LOW',
      status: 'planning',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    assert.equal(await store.persistPlan(created.id, 'integration-worker-b', plan), false);
    assert.equal(await store.persistPlan(created.id, 'integration-worker-a', plan), true);
    assert.equal(await store.transition({
      id: created.id,
      expectedStatus: 'running',
      status: 'planning',
      workerId: 'integration-worker-b'
    }), false);
    assert.equal(await store.transition({
      id: created.id,
      expectedStatus: 'running',
      status: 'planning',
      workerId: 'integration-worker-a'
    }), true);
    assert.equal(await store.transition({
      id: created.id,
      expectedStatus: 'planning',
      status: 'verifying',
      workerId: 'integration-worker-a'
    }), true);

    await prisma.modaGptTask.update({
      where: { id: created.id },
      data: { lockedUntil: new Date(Date.now() - 1_000) }
    });
    const restartedStore = new PrismaModaGptTaskStore(prisma);
    const recovered = await restartedStore.claim('integration-worker-b', 60_000);
    assert.equal(recovered?.id, created.id);
    assert.equal(recovered?.status, 'running');
    assert.equal(recovered?.attempts, 2);
    assert.equal(recovered?.traceId, firstClaim?.traceId);
    assert.equal(recovered?.plan, plan);
    assert.equal(await store.persistPlan(created.id, 'integration-worker-a', '{"stale":true}'), false);
    assert.equal(await store.complete(created.id, 'integration-worker-a', '{"stale":true}', 'completed'), false);
    assert.equal(await store.complete(created.id, 'integration-worker-b', '{"verified":true}', 'completed'), true);

    const persisted = await prisma.modaGptTask.findUnique({
      where: { id: created.id },
      select: { status: true, attempts: true, result: true, lockedBy: true, lockedUntil: true }
    });
    assert.deepEqual(persisted, {
      status: 'completed',
      attempts: 2,
      result: '{"verified":true}',
      lockedBy: null,
      lockedUntil: null
    });

    const approvalTask = await runtime.enqueue({
      ...input,
      idempotencyKey: `postgres-approval:${crypto.randomUUID()}`,
      payload: { workflow: 'human_approval' },
      maxAttempts: 2
    });
    taskIds.push(approvalTask.id);
    await prisma.modaGptTask.update({ where: { id: approvalTask.id }, data: { priority: 100 } });
    const approvalClaim = await store.claim('approval-worker', 60_000);
    assert.equal(approvalClaim?.id, approvalTask.id);
    assert.equal(await store.complete(approvalTask.id, 'approval-worker', '{"approvalRequired":true}', 'waiting_approval'), true);
    assert.equal(await prisma.modaGptTask.findUniqueOrThrow({ where: { id: approvalTask.id } }).then(task => task.status), 'waiting_approval');
    assert.equal(await store.claim('approval-worker-blocked', 60_000), null);
    assert.equal(await store.transition({
      id: approvalTask.id,
      expectedStatus: 'waiting_approval',
      status: 'queued'
    }), true);
    const humanApprovedClaim = await store.claim('human-approved-worker', 60_000);
    assert.equal(humanApprovedClaim?.id, approvalTask.id);
    assert.equal(await store.complete(approvalTask.id, 'human-approved-worker', '{"completed":true}', 'completed'), true);

    const retryTask = await runtime.enqueue({
      ...input,
      idempotencyKey: `postgres-retry:${crypto.randomUUID()}`,
      payload: { workflow: 'retry_dead_letter' },
      maxAttempts: 2
    });
    taskIds.push(retryTask.id);
    await prisma.modaGptTask.update({ where: { id: retryTask.id }, data: { priority: 100 } });
    const firstRetryClaim = await store.claim('retry-worker-a', 60_000);
    assert.equal(firstRetryClaim?.id, retryTask.id);
    assert.equal(await store.fail({
      id: retryTask.id,
      workerId: 'retry-worker-a',
      errorCode: 'INTEGRATION_RETRY',
      retryAt: new Date(Date.now() + 60_000)
    }), true);
    const deadLetterNotificationKey = `modagpt.task.dead_letter:in_app:admin:${retryTask.id}`;
    assert.equal(await prisma.notificationEvent.count({ where: { idempotencyKey: deadLetterNotificationKey } }), 0);
    assert.equal(await store.claim('retry-worker-not-yet-due', 60_000), null);
    await prisma.modaGptTask.update({ where: { id: retryTask.id }, data: { availableAt: new Date(Date.now() - 1_000) } });
    const secondRetryClaim = await store.claim('retry-worker-b', 60_000);
    assert.equal(secondRetryClaim?.id, retryTask.id);
    assert.equal(secondRetryClaim?.attempts, 2);
    assert.equal(await store.fail({
      id: retryTask.id,
      workerId: 'retry-worker-b',
      errorCode: 'INTEGRATION_DEAD_LETTER',
      retryAt: null
    }), true);
    assert.equal(await prisma.modaGptTask.findUniqueOrThrow({ where: { id: retryTask.id } }).then(task => task.status), 'dead_letter');
    const deadLetterNotification = await prisma.notificationEvent.findUniqueOrThrow({
      where: { idempotencyKey: deadLetterNotificationKey }
    });
    assert.equal(deadLetterNotification.eventType, 'modagpt.task.dead_letter');
    assert.equal(deadLetterNotification.channel, 'in_app');
    assert.equal(deadLetterNotification.recipient, 'admin');
    assert.deepEqual(JSON.parse(deadLetterNotification.payload), {
      referenceId: retryTask.id,
      taskType: input.taskType,
      tenantId: input.tenantId,
      errorCode: 'INTEGRATION_DEAD_LETTER'
    });
    assert.equal(await prisma.notificationEvent.count({ where: { idempotencyKey: deadLetterNotificationKey } }), 1);
    assert.equal(await store.claim('dead-letter-worker', 60_000), null);
  } finally {
    if (taskIds.length) {
      await prisma.notificationEvent.deleteMany({
        where: { idempotencyKey: { in: taskIds.map(id => `modagpt.task.dead_letter:in_app:admin:${id}`) } }
      });
    }
    if (taskIds.length) await prisma.modaGptTask.deleteMany({ where: { id: { in: taskIds } } });
    if (auditLogIds.length) await prisma.auditLog.deleteMany({ where: { id: { in: auditLogIds } } });
    await prisma.$disconnect();
  }
});

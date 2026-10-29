import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canTransitionModaGptTask,
  ModaGptTaskRuntime,
  ModaGptTaskQueue,
  modaGptTaskStatuses,
  type ModaGptTask,
  type ModaGptTaskStatus,
  type ModaGptTaskStore,
  type ModaGptTaskType
} from '../src/server/modagptTaskQueue';
import {
  createModaGptEventTaskInput,
  enqueueModaGptEventsInTransaction,
  publishModaGptEvent
} from '../src/server/modagptEvents';
import { startModaGptTaskWorker } from '../src/server/modagptTaskWorker';
import { PrismaModaGptTaskStore } from '../src/server/prismaModaGptTaskStore';

class MemoryTaskStore implements ModaGptTaskStore {
  private nextId = 1;
  readonly phaseChanges: Array<{ id: string; status: ModaGptTaskStatus }> = [];
  private tasks: Array<ModaGptTask<string> & { result?: string; availableAt: number; lockedUntil?: number | null; lastErrorCode?: string }> = [];
  constructor(private readonly now: () => number = Date.now) {}

  async enqueue(input: Parameters<ModaGptTaskStore['enqueue']>[0]): Promise<{ id: string; status: ModaGptTaskStatus; deduplicated: boolean }> {
    const existing = input.idempotencyKey
      ? this.tasks.find(task => task.idempotencyKey === input.idempotencyKey)
      : undefined;
    if (existing) {
      if (
        existing.taskType !== input.taskType
        || existing.merchantId !== input.merchantId
        || existing.payload !== input.payload
      ) throw new Error('MODAGPT_TASK_IDEMPOTENCY_CONFLICT');
      return { id: existing.id, status: existing.status, deduplicated: true };
    }
    const task: ModaGptTask<string> & { availableAt: number } = {
      id: String(this.nextId++),
      merchantId: input.merchantId,
      tenantId: input.tenantId,
      actorId: input.actorId,
      traceId: input.traceId,
      parentTaskId: input.parentTaskId,
      goal: input.goal,
      taskType: input.taskType,
      status: 'queued',
      priority: input.priority,
      agentId: input.agentId,
      payload: input.payload,
      context: input.context,
      plan: input.plan,
      attempts: 0,
      retryCount: 0,
      maxAttempts: input.maxAttempts,
      idempotencyKey: input.idempotencyKey,
      lockedBy: null,
      error: null,
      availableAt: 0
    };
    this.tasks.push(task);
    return { id: task.id, status: task.status, deduplicated: false };
  }

  async claim(workerId: string, leaseMs: number): Promise<ModaGptTask<string> | null> {
    const task = this.tasks.find(item =>
      ((item.status === 'queued' || item.status === 'retrying') && item.availableAt <= this.now())
      || (['planning', 'running', 'verifying'].includes(item.status) && (item.lockedUntil ?? 0) <= this.now())
    );
    if (!task) return null;
    task.status = 'running';
    task.attempts += 1;
    task.lockedBy = workerId;
    task.lockedUntil = this.now() + leaseMs;
    return { ...task };
  }

  async renewLease(id: string, workerId: string, leaseMs: number): Promise<boolean> {
    const task = this.tasks.find(item =>
      item.id === id
      && ['planning', 'running', 'verifying'].includes(item.status)
      && item.lockedBy === workerId
      && (item.lockedUntil ?? 0) > this.now()
    );
    if (!task) return false;
    task.lockedUntil = this.now() + leaseMs;
    return true;
  }

  async complete(id: string, workerId: string, result: string, status: 'completed' | 'waiting_approval'): Promise<boolean> {
    const task = this.tasks.find(item =>
      item.id === id && ['running', 'verifying'].includes(item.status) && item.lockedBy === workerId
    );
    if (!task) return false;
    task.status = status;
    task.result = result;
    task.lockedBy = null;
    task.lockedUntil = null;
    return true;
  }

  async persistPlan(id: string, workerId: string, plan: string): Promise<boolean> {
    const task = this.tasks.find(item =>
      item.id === id && ['planning', 'running', 'verifying'].includes(item.status) && item.lockedBy === workerId
    );
    if (!task) return false;
    task.plan = plan;
    return true;
  }

  async transition(input: {
    id: string;
    expectedStatus: ModaGptTaskStatus;
    status: ModaGptTaskStatus;
    workerId?: string;
  }): Promise<boolean> {
    const task = this.tasks.find(item => item.id === input.id
      && item.status === input.expectedStatus
      && (!input.workerId || item.lockedBy === input.workerId));
    if (!task) return false;
    task.status = input.status;
    this.phaseChanges.push({ id: input.id, status: input.status });
    if (['waiting_approval', 'completed', 'failed', 'dead_letter', 'cancelled', 'queued', 'retrying'].includes(input.status)) {
      task.lockedBy = null;
      task.lockedUntil = null;
    }
    return true;
  }

  async fail(input: { id: string; workerId: string; errorCode: string; retryAt: Date | null }): Promise<boolean> {
    const task = this.tasks.find(item =>
      item.id === input.id && item.status === 'running' && item.lockedBy === input.workerId
    );
    if (!task) return false;
    task.status = input.retryAt ? 'retrying' : 'dead_letter';
    task.availableAt = input.retryAt?.getTime() ?? Date.now();
    task.lastErrorCode = input.errorCode;
    task.error = { code: input.errorCode };
    if (input.retryAt) task.retryCount += 1;
    task.lockedBy = null;
    task.lockedUntil = null;
    return true;
  }

  get(id: string) {
    return this.tasks.find(task => task.id === id);
  }
}

test('queue validates payloads and deduplicates repeated requests with an idempotency key', async () => {
  const store = new MemoryTaskStore();
  const queue = new ModaGptTaskQueue(store);
  const input = { taskType: 'ai.event' as const, payload: { event: 'inventory.low' }, idempotencyKey: 'evt:123' };

  const first = await queue.enqueue(input);
  const replay = await queue.enqueue(input);
  assert.equal(first.deduplicated, false);
  assert.equal(replay.deduplicated, true);
  assert.equal(replay.id, first.id);
  const otherTenant = await queue.enqueue({ ...input, merchantId: 'merchant-2', tenantId: 'merchant-2' });
  assert.notEqual(otherTenant.id, first.id);
  await assert.rejects(
    queue.enqueue({ ...input, payload: { event: 'order.created' } }),
    /MODAGPT_TASK_IDEMPOTENCY_CONFLICT/
  );
  await assert.rejects(
    queue.enqueue({ taskType: 'ai.event', payload: 'x'.repeat(65_537) }),
    /MODAGPT_TASK_PAYLOAD_INVALID/
  );
  await assert.rejects(
    queue.enqueue({ taskType: 'not.allowed' as ModaGptTaskType, payload: {} }),
    /MODAGPT_TASK_TYPE_INVALID/
  );
  await assert.rejects(
    queue.enqueue({ ...input, merchantId: 'merchant-1', tenantId: 'merchant-2' }),
    /MODAGPT_TASK_TENANT_MISMATCH/
  );
});

test('platform Growth Mission review tasks require a constrained platform principal and deduplicate', async () => {
  const store = new MemoryTaskStore();
  const queue = new ModaGptTaskRuntime(store);
  const input = {
    taskType: 'growth.mission.review' as const,
    tenantId: 'platform',
    actorId: 'growth-mission-system',
    traceId: 'growth-mission-12345678-0',
    goal: 'Prepare internal recommendation review',
    idempotencyKey: 'growth-mission-review:12345678:v1:0',
    payload: { version: 1, missionId: '12345678', recommendationIndex: 0 }
  };
  const first = await queue.enqueue(input);
  const duplicate = await queue.enqueue(input);
  assert.equal(first.status, 'queued');
  assert.equal(first.deduplicated, false);
  assert.equal(duplicate.id, first.id);
  assert.equal(duplicate.deduplicated, true);

  await assert.rejects(queue.enqueue({ ...input, tenantId: 'merchant-1' }), /MODAGPT_GROWTH_REVIEW_TASK_INVALID/);
  await assert.rejects(queue.enqueue({ ...input, merchantId: 'merchant-1' }), /MODAGPT_GROWTH_REVIEW_TASK_INVALID/);
  await assert.rejects(queue.enqueue({ ...input, idempotencyKey: undefined }), /MODAGPT_GROWTH_REVIEW_TASK_INVALID/);
  await assert.rejects(
    queue.enqueue({ ...input, payload: { ...input.payload, recommendationIndex: 12 } }),
    /MODAGPT_GROWTH_REVIEW_TASK_INVALID/
  );
});

test('studio video trim tasks require a validated platform-only payload', async () => {
  const queue = new ModaGptTaskRuntime(new MemoryTaskStore());
  const input = {
    taskType: 'studio.video.trim' as const,
    tenantId: 'platform',
    actorId: 'platform-admin',
    payload: {
      version: 1,
      sourcePostId: 'fashion-post-123',
      startSeconds: 0,
      endSeconds: 15
    }
  };
  assert.equal((await queue.enqueue(input)).status, 'queued');
  await assert.rejects(queue.enqueue({ ...input, tenantId: 'merchant-1' }), /MODAGPT_STUDIO_VIDEO_TRIM_TASK_INVALID/);
  await assert.rejects(queue.enqueue({ ...input, merchantId: 'merchant-1' }), /MODAGPT_STUDIO_VIDEO_TRIM_TASK_INVALID/);
  await assert.rejects(
    queue.enqueue({ ...input, payload: { ...input.payload, endSeconds: 200 } }),
    /MODAGPT_STUDIO_VIDEO_TRIM_TASK_INVALID/
  );
  assert.equal((await queue.enqueue({
    ...input,
    payload: {
      version: 2,
      sourcePostId: 'fashion-post-123',
      clips: [
        { id: 'first', startSeconds: 20, endSeconds: 28 },
        { id: 'second', startSeconds: 3, endSeconds: 10 }
      ]
    }
  })).status, 'queued');
  assert.equal((await queue.enqueue({
    ...input,
    payload: {
      version: 3,
      sourcePostId: 'fashion-post-123',
      clips: [{ id: 'with-audio', startSeconds: 0, endSeconds: 10 }],
      audioVolume: 0.4
    }
  })).status, 'queued');
  await assert.rejects(
    queue.enqueue({
      ...input,
      payload: {
        version: 3,
        sourcePostId: 'fashion-post-123',
        clips: [{ id: 'invalid-audio', startSeconds: 0, endSeconds: 10 }],
        audioVolume: 5
      }
    }),
    /MODAGPT_STUDIO_VIDEO_TRIM_TASK_INVALID/
  );
  assert.equal((await queue.enqueue({
    ...input,
    payload: {
      version: 4,
      sourcePostId: 'fashion-post-123',
      clips: [{ id: 'with-background-music', startSeconds: 0, endSeconds: 10 }],
      audioVolume: 0.7,
      audioTrack: {
        assetId: 'f3a34c4e-2b88-4d5a-946d-8d9e55204ab1',
        fileName: 'runway-music.mp3',
        contentType: 'audio/mpeg',
        durationSeconds: 30,
        trimStartSeconds: 1,
        trimEndSeconds: 20,
        volume: 0.4
      }
    }
  })).status, 'queued');
});

test('Growth Mission review recommendations stop at the administrator approval boundary', async () => {
  const store = new MemoryTaskStore();
  const queue = new ModaGptTaskRuntime(store);
  const task = await queue.enqueue({
    taskType: 'growth.mission.review',
    tenantId: 'platform',
    actorId: 'growth-mission-system',
    traceId: 'growth-mission-12345678-review',
    goal: 'Prepare internal review',
    idempotencyKey: 'growth-mission-review:12345678:v1:0',
    payload: { version: 1, missionId: '12345678', recommendationIndex: 0 }
  });

  assert.equal(await queue.runOne('worker-a', {
    'growth.mission.review': async () => ({
      status: 'ready_for_human_review',
      approvalRequired: true,
      externalExecution: false
    })
  }), 'waiting_approval');
  assert.equal(store.get(task.id)?.status, 'waiting_approval');
  assert.equal(await queue.transitionTask(task.id, 'waiting_approval', 'completed'), true);
  assert.equal(store.get(task.id)?.status, 'completed');
});

test('worker executes a task, stores only JSON results, and is idempotent after completion', async () => {
  const store = new MemoryTaskStore();
  const queue = new ModaGptTaskRuntime(store);
  const task = await queue.enqueue({
    taskType: 'ops.health_check',
    tenantId: 'merchant-1',
    actorId: 'actor-1',
    traceId: 'trace-1',
    parentTaskId: 'parent-1',
    goal: 'Check service health',
    priority: 10,
    agentId: 'business-manager',
    payload: { probe: true },
    context: { locale: 'zh-CN' },
    plan: { steps: ['probe'] }
  });
  let executions = 0;

  assert.equal(task.status, 'queued');
  assert.equal(await queue.runOne('worker-a', {
    'ops.health_check': async job => {
      executions += 1;
      assert.equal(job.tenantId, 'merchant-1');
      assert.equal(job.actorId, 'actor-1');
      assert.equal(job.traceId, 'trace-1');
      assert.equal(job.parentTaskId, 'parent-1');
      assert.deepEqual(job.context, { locale: 'zh-CN' });
      assert.deepEqual(job.plan, { steps: ['probe'] });
      return { taskId: job.id, healthy: true };
    }
  }), 'completed');
  assert.equal(executions, 1);
  assert.equal(store.get(task.id)?.status, 'completed');
  assert.equal(store.get(task.id)?.result, JSON.stringify({ taskId: task.id, healthy: true }));
  assert.equal(await queue.runOne('worker-a', { 'ops.health_check': async () => ({ healthy: true }) }), 'idle');
});

test('concurrent workers claim distinct tasks and never execute the same lease twice', { timeout: 5_000 }, async () => {
  const store = new MemoryTaskStore();
  const queue = new ModaGptTaskRuntime(store);
  const first = await queue.enqueue({ taskType: 'ops.health_check', payload: { item: 1 } });
  const second = await queue.enqueue({ taskType: 'ops.health_check', payload: { item: 2 } });
  const startedIds: string[] = [];
  let releaseHandlers: (() => void) | undefined;
  const handlersReleased = new Promise<void>(resolve => { releaseHandlers = resolve; });
  let signalBothStarted: (() => void) | undefined;
  const bothStarted = new Promise<void>(resolve => { signalBothStarted = resolve; });
  const handler = async (task: ModaGptTask) => {
    startedIds.push(task.id);
    if (startedIds.length === 2) signalBothStarted?.();
    await handlersReleased;
    return { taskId: task.id };
  };

  const runs = [
    queue.runOne('worker-a', { 'ops.health_check': handler }),
    queue.runOne('worker-b', { 'ops.health_check': handler })
  ];
  await bothStarted;
  assert.deepEqual(new Set(startedIds), new Set([first.id, second.id]));
  releaseHandlers?.();
  assert.deepEqual(await Promise.all(runs), ['completed', 'completed']);
  assert.equal(store.get(first.id)?.status, 'completed');
  assert.equal(store.get(second.id)?.status, 'completed');
});

test('task handlers persist planning, execution, verification, and replan phases under the active lease', async () => {
  const store = new MemoryTaskStore();
  const queue = new ModaGptTaskRuntime(store);
  const task = await queue.enqueue({ taskType: 'ai.workflow.run', payload: {} });
  assert.equal(await queue.runOne('worker-a', {
    'ai.workflow.run': async (_job, execution) => {
      await execution.setPhase('planning');
      await execution.persistPlan({
        plan_id: `plan:${task.id}`,
        task_id: task.id,
        tenant_id: 'tenant-a',
        goal: 'Test plan persistence',
        steps: [{
          step_id: 'execute_and_verify',
          dependencies: [],
          agent: 'business-manager',
          tool: 'get_sales',
          expected_result: 'Persisted plan is owned by the current lease.',
          risk_level: 'LOW',
          status: 'planned'
        }],
        status: 'planning'
      });
      await execution.setPhase('running');
      await execution.setPhase('verifying');
      await execution.setPhase('planning');
      await execution.setPhase('running');
      await execution.setPhase('verifying');
      return { verified: true };
    }
  }), 'completed');
  assert.deepEqual(
    store.phaseChanges.filter(change => change.id === task.id).map(change => change.status),
    ['planning', 'running', 'verifying', 'planning', 'running', 'verifying']
  );
  assert.equal(store.get(task.id)?.status, 'completed');
  assert.deepEqual(JSON.parse(String(store.get(task.id)?.plan)), {
    plan_id: `plan:${task.id}`,
    task_id: task.id,
    tenant_id: 'tenant-a',
    goal: 'Test plan persistence',
    steps: [{
      step_id: 'execute_and_verify',
      dependencies: [],
      agent: 'business-manager',
      tool: 'get_sales',
      expected_result: 'Persisted plan is owned by the current lease.',
      risk_level: 'LOW',
      status: 'planned'
    }],
    status: 'planning'
  });
});

test('worker retries with a bounded delay, then moves terminal failures to the dead-letter state', async () => {
  let now = 1_000;
  const store = new MemoryTaskStore(() => now);
  const queue = new ModaGptTaskQueue(store, () => now);
  const task = await queue.enqueue({ taskType: 'ai.workflow.run', payload: {}, maxAttempts: 2 });
  const fail = { 'ai.workflow.run': async () => { throw new Error('PROVIDER_UNAVAILABLE'); } };

  assert.equal(await queue.runOne('worker-a', fail), 'retrying');
  assert.equal(store.get(task.id)?.lastErrorCode, 'PROVIDER_UNAVAILABLE');
  now += 1_000;
  assert.equal(await queue.runOne('worker-a', fail), 'dead_letter');
  assert.equal(store.get(task.id)?.status, 'dead_letter');
  assert.equal(store.get(task.id)?.lastErrorCode, 'PROVIDER_UNAVAILABLE');
});

test('a worker restart reclaims an expired task lease without losing task identity', async () => {
  let now = 5_000;
  const store = new MemoryTaskStore(() => now);
  const queue = new ModaGptTaskRuntime(store, () => now);
  const task = await queue.enqueue({
    taskType: 'ai.workflow.run',
    tenantId: 'merchant-1',
    actorId: 'actor-1',
    traceId: 'trace-recovery',
    goal: 'Resume after worker restart',
    merchantId: 'merchant-1',
    payload: { version: 1 }
  });
  const abandonedLease = await store.claim('worker-old', 1_000);
  assert.equal(abandonedLease?.status, 'running');
  assert.equal(abandonedLease?.attempts, 1);
  store.get(task.id)!.status = 'planning';

  now += 1_001;
  const recoveredLease = await store.claim('worker-new', 1_000);
  assert.equal(recoveredLease?.id, task.id);
  assert.equal(recoveredLease?.lockedBy, 'worker-new');
  assert.equal(recoveredLease?.attempts, 2);
  assert.equal(recoveredLease?.traceId, 'trace-recovery');
  assert.equal(recoveredLease?.goal, 'Resume after worker restart');
  assert.equal(await queue.transitionTask(task.id, 'running', 'verifying', 'worker-new'), true);
  now += 1_001;
  const verificationRecovery = await store.claim('worker-final', 1_000);
  assert.equal(verificationRecovery?.id, task.id);
  assert.equal(verificationRecovery?.attempts, 3);
});

test('worker rejects invalid leases and reports loss of task ownership', async () => {
  const store = new MemoryTaskStore();
  const queue = new ModaGptTaskQueue(store);
  await assert.rejects(queue.runOne('worker-a', {}, 100), /MODAGPT_TASK_LEASE_INVALID/);
  await assert.rejects(queue.runOne('bad worker', {}), /MODAGPT_WORKER_ID_INVALID/);

  const losingStore: ModaGptTaskStore = {
    enqueue: store.enqueue.bind(store),
    claim: async workerId => ({
      id: 'lost', merchantId: null, tenantId: null, actorId: null, traceId: 'trace-lost',
      parentTaskId: null, goal: 'lost', taskType: 'ops.health_check', status: 'running', priority: 0,
      agentId: null, payload: '{}', context: {}, plan: null, attempts: 1, retryCount: 0,
      maxAttempts: 1, idempotencyKey: null, lockedBy: workerId, error: null
    }),
    renewLease: async () => true,
    persistPlan: async () => false,
    complete: async () => false,
    transition: async () => false,
    fail: async () => false
  };
  await assert.rejects(
    new ModaGptTaskQueue(losingStore).runOne('worker-a', {
      'ops.health_check': async () => ({ ok: true })
    }),
    /MODAGPT_TASK_LEASE_LOST/
  );
});

test('worker renews long task leases so another worker cannot reclaim an active task', { timeout: 5_000 }, async () => {
  const store = new MemoryTaskStore();
  const queue = new ModaGptTaskRuntime(store);
  const task = await queue.enqueue({ taskType: 'ops.health_check', payload: { test: 'long-running' } });
  let executions = 0;
  const firstRun = queue.runOne('worker-a', {
    'ops.health_check': async (_task, execution) => {
      executions += 1;
      await new Promise(resolve => setTimeout(resolve, 1_300));
      assert.equal(execution.signal.aborted, false);
      return { completed: true };
    }
  }, 1_000);

  await new Promise(resolve => setTimeout(resolve, 1_100));
  assert.equal(await queue.runOne('worker-b', {
    'ops.health_check': async () => {
      executions += 1;
      return { duplicate: true };
    }
  }, 1_000), 'idle');
  assert.equal(await firstRun, 'completed');
  assert.equal(executions, 1);
  assert.equal(store.get(task.id)?.attempts, 1);
});

test('worker aborts its execution context when the task lease is cancelled', async () => {
  const store = new MemoryTaskStore();
  const queue = new ModaGptTaskRuntime(store);
  const task = await queue.enqueue({ taskType: 'ops.health_check', payload: { test: 'cancelled' } });
  let signal: AbortSignal | undefined;
  const running = queue.runOne('worker-a', {
    'ops.health_check': async (_job, execution) => {
      signal = execution.signal;
      await new Promise(resolve => setTimeout(resolve, 350));
      return { completed: true };
    }
  }, 1_000);
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(await queue.transitionTask(task.id, 'running', 'cancelled', 'worker-a'), true);
  assert.equal(await running, 'cancelled');
  assert.equal(signal?.aborted, true);
  assert.equal(store.get(task.id)?.status, 'cancelled');
  assert.equal(store.get(task.id)?.lastErrorCode, undefined);
});

test('approval results pause tasks and an approved child task resolves its parent', async () => {
  const store = new MemoryTaskStore();
  const runtime = new ModaGptTaskRuntime(store);
  const parent = await runtime.enqueue({ taskType: 'ai.workflow.run', merchantId: 'merchant-1', payload: { step: 'draft' } });

  assert.equal(await runtime.runOne('worker-a', {
    'ai.workflow.run': async () => ({ status: 'approval_required', approvalRequired: true })
  }), 'waiting_approval');
  assert.equal(store.get(parent.id)?.status, 'waiting_approval');

  const child = await runtime.enqueue({
    taskType: 'ai.workflow.run',
    merchantId: 'merchant-1',
    parentTaskId: parent.id,
    payload: { step: 'approved_execution' }
  });
  assert.equal(await runtime.runOne('worker-b', {
    'ai.workflow.run': async () => ({ status: 'published', approvalRequired: false })
  }), 'completed');
  assert.equal(store.get(child.id)?.status, 'completed');
  assert.equal(store.get(parent.id)?.status, 'completed');
});

test('task runtime rejects illegal persisted transitions and supports approval cancellation', async () => {
  const store = new MemoryTaskStore();
  const runtime = new ModaGptTaskRuntime(store);
  const task = await runtime.enqueue({ taskType: 'ai.workflow.run', merchantId: 'merchant-1', payload: {} });
  await assert.rejects(runtime.transitionTask(task.id, 'queued', 'running'), /MODAGPT_TASK_WORKER_REQUIRED/);
  assert.equal(await runtime.runOne('worker-a', {
    'ai.workflow.run': async () => ({ approvalRequired: true })
  }), 'waiting_approval');
  assert.equal(await runtime.transitionTask(task.id, 'waiting_approval', 'cancelled'), true);
  await assert.rejects(runtime.transitionTask(task.id, 'cancelled', 'queued'), /MODAGPT_TASK_TRANSITION_INVALID/);
});

test('task runtime exposes only the canonical states and rejects illegal transitions', () => {
  assert.deepEqual(modaGptTaskStatuses, [
    'queued', 'planning', 'running', 'waiting_approval', 'verifying',
    'retrying', 'completed', 'failed', 'dead_letter', 'cancelled'
  ]);
  assert.equal(canTransitionModaGptTask('queued', 'running'), true);
  assert.equal(canTransitionModaGptTask('running', 'waiting_approval'), true);
  assert.equal(canTransitionModaGptTask('verifying', 'completed'), true);
  assert.equal(canTransitionModaGptTask('dead_letter', 'retrying'), true);
  assert.equal(canTransitionModaGptTask('running', 'cancelled'), true);
  assert.equal(canTransitionModaGptTask('completed', 'running'), false);
  assert.equal(canTransitionModaGptTask('cancelled', 'queued'), false);
});

test('Prisma store persists task context and uses compare-and-set lifecycle writes', async () => {
  let createdData: Record<string, unknown> | undefined;
  const updates: Array<Record<string, unknown>> = [];
  const store = new PrismaModaGptTaskStore({
    modaGptTask: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        createdData = data;
        return { id: 'task-prisma-1', status: 'queued' };
      },
      updateMany: async (input: Record<string, unknown>) => {
        updates.push(input);
        return { count: 1 };
      }
    }
  } as never);
  const enqueued = await store.enqueue({
    taskType: 'ai.workflow.run',
    payload: JSON.stringify({ workflow: 'product_publish' }),
    merchantId: 'merchant-1',
    tenantId: 'merchant-1',
    actorId: 'actor-1',
    traceId: 'trace-prisma-1',
    parentTaskId: null,
    goal: 'Publish an approved product',
    priority: 5,
    agentId: 'product-creative-manager',
    context: JSON.stringify({ productId: 'product-1' }),
    plan: JSON.stringify({ version: 1 }),
    idempotencyKey: 'tenant:scoped-hash',
    maxAttempts: 3
  });
  assert.equal(enqueued.status, 'queued');
  assert.equal(createdData?.tenantId, 'merchant-1');
  assert.equal(createdData?.traceId, 'trace-prisma-1');
  assert.equal(createdData?.priority, 5);
  assert.equal(createdData?.context, JSON.stringify({ productId: 'product-1' }));

  assert.equal(await store.renewLease('task-prisma-1', 'worker-1', 15_000), true);
  const renewal = updates[0];
  const renewalWhere = renewal.where as Record<string, unknown>;
  const activeUntil = renewalWhere.lockedUntil as { gt: Date };
  const renewedUntil = (renewal.data as { lockedUntil: Date }).lockedUntil;
  assert.equal(renewalWhere.id, 'task-prisma-1');
  assert.deepEqual(renewalWhere.status, { in: ['planning', 'running', 'verifying'] });
  assert.equal(renewalWhere.lockedBy, 'worker-1');
  assert.ok(activeUntil.gt instanceof Date);
  assert.ok(renewedUntil > activeUntil.gt);
  assert.equal(await store.persistPlan('task-prisma-1', 'worker-1', '{"plan_id":"plan-1"}'), true);
  assert.deepEqual(updates[1], {
    where: {
      id: 'task-prisma-1',
      status: { in: ['planning', 'running', 'verifying'] },
      lockedBy: 'worker-1'
    },
    data: { plan: '{"plan_id":"plan-1"}' }
  });

  assert.equal(await store.complete('task-prisma-1', 'worker-1', '{"approvalRequired":true}', 'waiting_approval'), true);
  assert.deepEqual(updates[2], {
    where: { id: 'task-prisma-1', status: { in: ['running', 'verifying'] }, lockedBy: 'worker-1' },
    data: {
      status: 'waiting_approval',
      result: '{"approvalRequired":true}',
      error: null,
      lockedBy: null,
      lockedUntil: null,
      lastErrorCode: null,
      completedAt: null
    }
  });
  assert.equal(await store.transition({
    id: 'task-prisma-1',
    expectedStatus: 'waiting_approval',
    status: 'cancelled'
  }), true);
  assert.deepEqual(updates[3].where, { id: 'task-prisma-1', status: 'waiting_approval' });
});

test('Prisma store retains an active worker lease when cancelling so dependent assets remain protected', async () => {
  const updates: Array<Record<string, unknown>> = [];
  const now = new Date('2026-10-18T00:00:00.000Z');
  const store = new PrismaModaGptTaskStore({
    modaGptTask: {
      updateMany: async (input: Record<string, unknown>) => {
        updates.push(input);
        return { count: 1 };
      }
    }
  } as never, () => now);

  assert.equal(await store.transition({
    id: 'studio-task-active',
    expectedStatus: 'running',
    status: 'cancelled',
    workerId: 'worker-studio'
  }), true);
  assert.deepEqual(updates[0], {
    where: { id: 'studio-task-active', status: 'running', lockedBy: 'worker-studio' },
    data: { status: 'cancelled', completedAt: now }
  });

  assert.equal(await store.transition({
    id: 'studio-task-queued',
    expectedStatus: 'queued',
    status: 'cancelled'
  }), true);
  assert.deepEqual(updates[1], {
    where: { id: 'studio-task-queued', status: 'queued' },
    data: {
      status: 'cancelled',
      lockedBy: null,
      lockedUntil: null,
      completedAt: now
    }
  });
});

test('Prisma store deduplicates matching legacy tasks during tenant-key migration', async () => {
  const lookupKeys: string[] = [];
  const store = new PrismaModaGptTaskStore({
    modaGptTask: {
      create: async () => { throw { code: 'P2002' }; },
      findUnique: async ({ where }: { where: { idempotencyKey: string } }) => {
        lookupKeys.push(where.idempotencyKey);
        if (where.idempotencyKey !== 'merchant-task:merchant-1:client-key') return null;
        return {
          id: 'legacy-task-1',
          status: 'queued',
          taskType: 'ai.workflow.run',
          merchantId: 'merchant-1',
          tenantId: 'merchant-1',
          actorId: null,
          traceId: 'legacy-task-1',
          parentTaskId: null,
          goal: 'ai.workflow.run',
          priority: 0,
          agentId: null,
          payload: '{"workflow":"merchant_task"}',
          context: '{"workflow":"merchant_task"}',
          plan: null
        };
      }
    }
  } as never);
  const result = await store.enqueue({
    taskType: 'ai.workflow.run',
    payload: '{"workflow":"merchant_task"}',
    merchantId: 'merchant-1',
    tenantId: 'merchant-1',
    actorId: 'actor-1',
    traceId: 'new-trace',
    parentTaskId: null,
    goal: 'Run merchant task',
    priority: 0,
    agentId: 'product-creative-manager',
    context: '{}',
    plan: null,
    idempotencyKey: 'tenant:new-scoped-hash',
    legacyIdempotencyKey: 'merchant-task:merchant-1:client-key',
    maxAttempts: 3
  });

  assert.equal(result.id, 'legacy-task-1');
  assert.equal(result.deduplicated, true);
  assert.deepEqual(lookupKeys, ['tenant:new-scoped-hash', 'merchant-task:merchant-1:client-key']);
});

test('Growth Mission review batches persist atomically through a transaction and replay idempotently', async () => {
  const rows: Array<Record<string, unknown>> = [];
  const transaction = {
    modaGptTask: {
      findMany: async ({ where }: { where: { idempotencyKey: { in: string[] } } }) =>
        rows.filter(row => where.idempotencyKey.in.includes(String(row.idempotencyKey))),
      createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
        let count = 0;
        for (const item of data) {
          if (rows.some(row => row.idempotencyKey === item.idempotencyKey)) continue;
          rows.push({ ...item, status: 'queued' });
          count += 1;
        }
        return { count };
      }
    }
  } as never;
  const input = [
    { missionId: 'growth-mission-123', recommendationIndex: 0, reviewRound: 0 },
    { missionId: 'growth-mission-123', recommendationIndex: 1, reviewRound: 2 }
  ];

  const first = await PrismaModaGptTaskStore.enqueueGrowthMissionReviewBatch(transaction, input);
  assert.equal(first.createdCount, 2);
  assert.equal(first.tasks.length, 2);
  assert.deepEqual(first.tasks.map(task => [task.status, task.deduplicated]), [
    ['queued', false],
    ['queued', false]
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].payload, '{"version":1,"missionId":"growth-mission-123","recommendationIndex":0}');
  assert.equal(rows[1].context, '{"missionId":"growth-mission-123","recommendationIndex":1,"reviewRound":2}');

  const replay = await PrismaModaGptTaskStore.enqueueGrowthMissionReviewBatch(transaction, input);
  assert.equal(replay.createdCount, 0);
  assert.deepEqual(replay.tasks.map(task => [task.id, task.deduplicated]), [
    [first.tasks[0].id, true],
    [first.tasks[1].id, true]
  ]);
  assert.equal(rows.length, 2);
});

test('Growth Mission review batches reject invalid inputs before writing any task', async () => {
  let createCalls = 0;
  const transaction = {
    modaGptTask: {
      findMany: async () => [],
      createMany: async () => {
        createCalls += 1;
        return { count: 0 };
      }
    }
  } as never;
  await assert.rejects(
    PrismaModaGptTaskStore.enqueueGrowthMissionReviewBatch(transaction, [
      { missionId: 'growth-mission-123', recommendationIndex: 0, reviewRound: 0 },
      { missionId: 'growth-mission-123', recommendationIndex: 12, reviewRound: 0 }
    ]),
    /MODAGPT_GROWTH_REVIEW_TASK_INVALID/
  );
  assert.equal(createCalls, 0);
});

test('Growth Mission pause stops review work and resume only requeues paused reviews', async () => {
  const updates: Array<Record<string, unknown>> = [];
  const transaction = {
    modaGptTask: {
      updateMany: async (input: Record<string, unknown>) => {
        updates.push(input);
        return { count: 2 };
      }
    }
  } as never;
  const now = new Date('2026-10-05T00:00:00.000Z');

  assert.equal(await PrismaModaGptTaskStore.pauseGrowthMissionReviewTasks(transaction, 'growth-mission-123', now), 2);
  assert.deepEqual(updates[0].where, {
    taskType: 'growth.mission.review',
    tenantId: 'platform',
    merchantId: null,
    status: { in: ['queued', 'planning', 'running', 'waiting_approval', 'verifying', 'retrying'] },
    payload: { contains: '"missionId":"growth-mission-123"' }
  });
  assert.equal((updates[0].data as Record<string, unknown>).lastErrorCode, 'GROWTH_MISSION_PAUSED');
  assert.equal(await PrismaModaGptTaskStore.resumeGrowthMissionReviewTasks(transaction, 'growth-mission-123', now), 2);
  assert.deepEqual(updates[1].where, {
    taskType: 'growth.mission.review',
    tenantId: 'platform',
    merchantId: null,
    status: 'cancelled',
    lastErrorCode: 'GROWTH_MISSION_PAUSED',
    payload: { contains: '"missionId":"growth-mission-123"' }
  });
  assert.equal((updates[1].data as Record<string, unknown>).status, 'queued');
  assert.equal(await PrismaModaGptTaskStore.cancelGrowthMissionReviewTasks(transaction, 'growth-mission-123', now), 2);
  assert.equal((updates[2].data as Record<string, unknown>).lastErrorCode, 'GROWTH_MISSION_CANCELLED');
  await assert.rejects(
    PrismaModaGptTaskStore.pauseGrowthMissionReviewTasks(transaction, 'bad id', now),
    /MODAGPT_GROWTH_REVIEW_TASK_INVALID/
  );
});

test('business events become tenant-scoped idempotent queue tasks and reject personal fields', async () => {
  const store = new MemoryTaskStore();
  const queue = new ModaGptTaskQueue(store);
  const event = {
    type: 'inventory.low' as const,
    eventId: 'stock:style-42',
    merchantId: 'merchant_1',
    occurredAt: '2026-10-01T00:00:00.000Z',
    data: { sku: 'SKU-42', availableUnits: 3 }
  };
  const first = await publishModaGptEvent(queue, event);
  const replay = await publishModaGptEvent(queue, event);
  assert.equal(first.deduplicated, false);
  assert.equal(replay.deduplicated, true);
  assert.equal(replay.id, first.id);
  const otherTenantEvent = await publishModaGptEvent(queue, {
    ...event,
    merchantId: 'merchant_2'
  });
  assert.notEqual(otherTenantEvent.id, first.id);
  const outboxFirst = createModaGptEventTaskInput(event);
  const outboxReplay = createModaGptEventTaskInput(event);
  assert.deepEqual(outboxFirst, outboxReplay);
  assert.equal(outboxFirst.taskType, 'ai.event');
  assert.equal(outboxFirst.merchantId, event.merchantId);
    assert.equal(outboxFirst.tenantId, event.merchantId);
    assert.equal(outboxFirst.actorId, 'system:outbox');
    assert.equal(outboxFirst.traceId, outboxFirst.idempotencyKey);
    assert.equal(outboxFirst.goal, 'Process inventory.low event stock:style-42');
    await assert.rejects(
    publishModaGptEvent(queue, { ...event, data: { buyerEmail: 'buyer@example.test' } }),
    /MODAGPT_EVENT_PAYLOAD_INVALID/
  );
});

test('transactional outbox creates tenant-scoped queue rows and surfaces failures to abort the business transaction', async () => {
  const outboxEvent = {
    type: 'inventory.low' as const,
    eventId: 'stock:outbox-1',
    merchantId: 'merchant_1',
    occurredAt: '2026-10-01T00:00:00.000Z',
    data: { sku: 'SKU-42', availableUnits: 3 }
  };
  let savedRows: unknown[] = [];
  const tx = {
    modaGptTask: {
      createMany: async ({ data }: { data: unknown[] }) => {
        savedRows = data;
        return { count: data.length };
      }
    }
  };
  await enqueueModaGptEventsInTransaction(tx as never, [outboxEvent]);
  assert.equal(savedRows.length, 1);
  assert.deepEqual(savedRows[0], {
    taskType: 'ai.event',
    merchantId: outboxEvent.merchantId,
      tenantId: outboxEvent.merchantId,
      actorId: 'system:outbox',
      traceId: createModaGptEventTaskInput(outboxEvent).traceId,
      parentTaskId: null,
      goal: 'Process inventory.low event stock:outbox-1',
      priority: 0,
      agentId: null,
      context: JSON.stringify(createModaGptEventTaskInput(outboxEvent).context),
      plan: null,
    idempotencyKey: createModaGptEventTaskInput(outboxEvent).idempotencyKey,
    payload: JSON.stringify(createModaGptEventTaskInput(outboxEvent).payload),
    maxAttempts: 5
  });

  const failingTx = {
    modaGptTask: {
      createMany: async () => { throw new Error('OUTBOX_INSERT_FAILED'); }
    }
  };
  await assert.rejects(
    enqueueModaGptEventsInTransaction(failingTx as never, [outboxEvent]),
    /OUTBOX_INSERT_FAILED/
  );
});

test('worker stops promptly while waiting for its next poll', async () => {
  const worker = startModaGptTaskWorker(
    new ModaGptTaskQueue(new MemoryTaskStore()),
    'worker-test',
    {},
    { pollIntervalMs: 10_000 }
  );
  await worker.stop();
});

test('worker shutdown aborts in-flight work and leaves the lease recoverable by a replacement worker', async () => {
  let now = Date.now();
  const store = new MemoryTaskStore(() => now);
  const runtime = new ModaGptTaskRuntime(store, () => now);
  const task = await runtime.enqueue({ taskType: 'ops.health_check', payload: { test: 'worker-shutdown' } });
  let handlerStarted: (() => void) | undefined;
  const started = new Promise<void>(resolve => { handlerStarted = resolve; });
  let handlerAborted = false;
  const worker = startModaGptTaskWorker(runtime, 'worker-before-restart', {
    'ops.health_check': async (_task, execution) => {
      handlerStarted?.();
      await new Promise<void>(resolve => {
        execution.signal.addEventListener('abort', () => {
          handlerAborted = true;
          resolve();
        }, { once: true });
      });
      return { completed: true };
    }
  }, { pollIntervalMs: 100, leaseMs: 1_000 });

  await started;
  await worker.stop();
  assert.equal(handlerAborted, true);
  assert.equal(store.get(task.id)?.status, 'running');
  assert.equal(store.get(task.id)?.attempts, 1);

  now += 1_001;
  assert.equal(await runtime.runOne('worker-after-restart', {
    'ops.health_check': async () => ({ recovered: true })
  }, 1_000), 'completed');
  assert.equal(store.get(task.id)?.attempts, 2);
  assert.deepEqual(JSON.parse(String(store.get(task.id)?.result)), { recovered: true });
});

import { createHash, randomUUID } from 'node:crypto';
import { parseFashionVideoTrimTaskPayload } from './fashionVideoEditor';

export const modaGptTaskTypes = [
  'ai.event',
  'ai.workflow.run',
  'ops.health_check',
  'growth.mission.review',
  'studio.social.import',
  'studio.video.trim'
] as const;

export type ModaGptTaskType = (typeof modaGptTaskTypes)[number];
export const modaGptTaskStatuses = [
  'queued', 'planning', 'running', 'waiting_approval', 'verifying',
  'retrying', 'completed', 'failed', 'dead_letter', 'cancelled'
] as const;
export type ModaGptTaskStatus = (typeof modaGptTaskStatuses)[number];

export const modaGptTaskTransitions: Readonly<Record<ModaGptTaskStatus, readonly ModaGptTaskStatus[]>> = {
  queued: ['planning', 'running', 'cancelled'],
  planning: ['running', 'waiting_approval', 'retrying', 'failed', 'dead_letter', 'cancelled'],
  running: ['planning', 'waiting_approval', 'verifying', 'completed', 'retrying', 'failed', 'dead_letter', 'cancelled'],
  waiting_approval: ['queued', 'completed', 'failed', 'cancelled'],
  verifying: ['planning', 'completed', 'retrying', 'failed', 'dead_letter', 'cancelled'],
  retrying: ['running', 'cancelled'],
  completed: [],
  failed: [],
  dead_letter: ['retrying'],
  cancelled: []
};

export function canTransitionModaGptTask(from: ModaGptTaskStatus, to: ModaGptTaskStatus): boolean {
  return modaGptTaskTransitions[from].includes(to);
}

export type ModaGptTask<TPayload = unknown> = {
  id: string;
  merchantId: string | null;
  tenantId: string | null;
  actorId: string | null;
  traceId: string;
  parentTaskId: string | null;
  goal: string;
  taskType: ModaGptTaskType;
  status: ModaGptTaskStatus;
  priority: number;
  agentId: string | null;
  payload: TPayload;
  context: unknown;
  plan: unknown | null;
  attempts: number;
  retryCount: number;
  maxAttempts: number;
  idempotencyKey: string | null;
  lockedBy: string | null;
  error: unknown | null;
};

export type ModaGptTaskInput = {
  taskType: ModaGptTaskType;
  payload: unknown;
  merchantId?: string;
  tenantId?: string;
  actorId?: string;
  traceId?: string;
  parentTaskId?: string;
  goal?: string;
  priority?: number;
  agentId?: string;
  context?: unknown;
  plan?: unknown;
  idempotencyKey?: string;
  maxAttempts?: number;
};

export type ModaGptTaskStore = {
  enqueue(input: {
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
  }): Promise<{ id: string; status: ModaGptTaskStatus; deduplicated: boolean }>;
  claim(workerId: string, leaseMs: number): Promise<ModaGptTask<string> | null>;
  renewLease(id: string, workerId: string, leaseMs: number): Promise<boolean>;
  persistPlan(id: string, workerId: string, plan: string): Promise<boolean>;
  complete(id: string, workerId: string, result: string, status: 'completed' | 'waiting_approval'): Promise<boolean>;
  transition(input: {
    id: string;
    expectedStatus: ModaGptTaskStatus;
    status: ModaGptTaskStatus;
    workerId?: string;
  }): Promise<boolean>;
  fail(input: {
    id: string;
    workerId: string;
    errorCode: string;
    retryAt: Date | null;
  }): Promise<boolean>;
};

export type ModaGptTaskExecutionContext = {
  signal: AbortSignal;
  assertLease: () => Promise<void>;
  setPhase: (phase: 'planning' | 'running' | 'verifying') => Promise<void>;
  persistPlan: (plan: unknown) => Promise<void>;
};
export type ModaGptTaskHandler = (
  task: ModaGptTask,
  execution: ModaGptTaskExecutionContext
) => Promise<unknown>;
export type ModaGptTaskRunResult =
  | 'idle'
  | 'completed'
  | 'waiting_approval'
  | 'retrying'
  | 'dead_letter'
  | 'cancelled';

const MAX_PAYLOAD_BYTES = 64 * 1024;
const MAX_RESULT_BYTES = 64 * 1024;
const MAX_RETRY_DELAY_MS = 60 * 60 * 1000;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function serializeJson(value: unknown, maxBytes: number, errorCode: string): string {
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new Error(errorCode);
  }
  if (serialized === undefined || Buffer.byteLength(serialized, 'utf8') > maxBytes) {
    throw new Error(errorCode);
  }
  return serialized;
}

export class ModaGptTaskRuntime {
  constructor(
    private readonly store: ModaGptTaskStore,
    private readonly now: () => number = Date.now,
    private readonly onTaskError: (task: ModaGptTask, error: unknown) => void = () => undefined
  ) {}

  async enqueue(input: ModaGptTaskInput): Promise<{ id: string; status: ModaGptTaskStatus; deduplicated: boolean }> {
    if (!modaGptTaskTypes.includes(input.taskType)) throw new Error('MODAGPT_TASK_TYPE_INVALID');
    if (input.taskType === 'growth.mission.review') {
      const payload = input.payload;
      if (
        input.merchantId !== undefined
        || input.tenantId !== 'platform'
        || !input.actorId
        || !input.idempotencyKey
        || !payload || typeof payload !== 'object' || Array.isArray(payload)
        || Object.keys(payload).length !== 3
        || !Object.hasOwn(payload, 'version')
        || !Object.hasOwn(payload, 'missionId')
        || !Object.hasOwn(payload, 'recommendationIndex')
        || (payload as Record<string, unknown>).version !== 1
        || typeof (payload as Record<string, unknown>).missionId !== 'string'
        || !/^[A-Za-z0-9_-]{8,40}$/.test((payload as Record<string, unknown>).missionId as string)
        || !Number.isInteger((payload as Record<string, unknown>).recommendationIndex)
        || Number((payload as Record<string, unknown>).recommendationIndex) < 0
        || Number((payload as Record<string, unknown>).recommendationIndex) > 11
      ) throw new Error('MODAGPT_GROWTH_REVIEW_TASK_INVALID');
    }
    if (
      input.taskType === 'studio.social.import'
      && (input.merchantId !== undefined
        || input.tenantId !== 'platform'
        || !input.actorId
        || !isPlainRecord(input.payload)
        || typeof input.payload.version !== 'number'
        || input.payload.version !== 1
        || typeof input.payload.url !== 'string'
        || !/^https:\/\//.test(input.payload.url)
        || typeof input.payload.title !== 'string'
        || !['4', '8', '12', '16'].includes(String(input.payload.clipCount))
        || typeof input.payload.rightsConfirmed !== 'boolean')
    ) throw new Error('MODAGPT_STUDIO_SOCIAL_IMPORT_TASK_INVALID');
    if (
      input.taskType === 'studio.video.trim'
      && (input.merchantId !== undefined
        || input.tenantId !== 'platform'
        || !input.actorId
        || !parseFashionVideoTrimTaskPayload(input.payload))
    ) throw new Error('MODAGPT_STUDIO_VIDEO_TRIM_TASK_INVALID');
    if (input.merchantId !== undefined && !/^[A-Za-z0-9_-]{1,120}$/.test(input.merchantId)) {
      throw new Error('MODAGPT_TASK_MERCHANT_INVALID');
    }
    const tenantId = input.tenantId ?? input.merchantId ?? null;
    if (tenantId !== null && !/^[A-Za-z0-9_-]{1,120}$/.test(tenantId)) {
      throw new Error('MODAGPT_TASK_TENANT_INVALID');
    }
    if (input.merchantId && tenantId !== input.merchantId) {
      throw new Error('MODAGPT_TASK_TENANT_MISMATCH');
    }
    const actorId = input.actorId ?? null;
    if (actorId !== null && (!actorId.trim() || actorId.length > 160 || /[\u0000-\u001f\u007f]/.test(actorId))) {
      throw new Error('MODAGPT_TASK_ACTOR_INVALID');
    }
    const traceId = input.traceId ?? (input.idempotencyKey
      ? `task-${createHash('sha256').update(JSON.stringify([tenantId, input.idempotencyKey])).digest('hex')}`
      : randomUUID());
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(traceId)) throw new Error('MODAGPT_TASK_TRACE_INVALID');
    const parentTaskId = input.parentTaskId ?? null;
    if (parentTaskId !== null && !/^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/.test(parentTaskId)) {
      throw new Error('MODAGPT_TASK_PARENT_INVALID');
    }
    const goal = input.goal ?? input.taskType;
    if (!goal.trim() || goal.length > 2_000 || /[\u0000-\u001f\u007f]/.test(goal)) {
      throw new Error('MODAGPT_TASK_GOAL_INVALID');
    }
    const priority = input.priority ?? 0;
    if (!Number.isInteger(priority) || priority < -100 || priority > 100) {
      throw new Error('MODAGPT_TASK_PRIORITY_INVALID');
    }
    const agentId = input.agentId ?? null;
    if (agentId !== null && !/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(agentId)) {
      throw new Error('MODAGPT_TASK_AGENT_INVALID');
    }
    if (
      input.idempotencyKey !== undefined
      && (input.idempotencyKey.length < 1 || input.idempotencyKey.length > 160
        || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(input.idempotencyKey))
    ) throw new Error('MODAGPT_TASK_IDEMPOTENCY_KEY_INVALID');
    const maxAttempts = input.maxAttempts ?? 5;
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) {
      throw new Error('MODAGPT_TASK_ATTEMPTS_INVALID');
    }
    const payload = serializeJson(input.payload, MAX_PAYLOAD_BYTES, 'MODAGPT_TASK_PAYLOAD_INVALID');
    const context = serializeJson(input.context ?? {}, MAX_PAYLOAD_BYTES, 'MODAGPT_TASK_CONTEXT_INVALID');
    const plan = input.plan === undefined
      ? null
      : serializeJson(input.plan, MAX_PAYLOAD_BYTES, 'MODAGPT_TASK_PLAN_INVALID');
    const idempotencyKey = input.idempotencyKey === undefined
      ? null
      : `tenant:${createHash('sha256').update(JSON.stringify([tenantId, input.idempotencyKey])).digest('hex')}`;
    return this.store.enqueue({
      taskType: input.taskType,
      payload,
      merchantId: input.merchantId ?? null,
      tenantId,
      actorId,
      traceId,
      parentTaskId,
      goal,
      priority,
      agentId,
      context,
      plan,
      idempotencyKey,
      legacyIdempotencyKey: input.idempotencyKey ?? null,
      maxAttempts
    });
  }

  async runOne(
    workerId: string,
    handlers: Partial<Record<ModaGptTaskType, ModaGptTaskHandler>>,
    leaseMs = 60_000,
    options: { signal?: AbortSignal } = {}
  ): Promise<ModaGptTaskRunResult> {
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(workerId)) {
      throw new Error('MODAGPT_WORKER_ID_INVALID');
    }
    if (!Number.isInteger(leaseMs) || leaseMs < 1_000 || leaseMs > 15 * 60_000) {
      throw new Error('MODAGPT_TASK_LEASE_INVALID');
    }
    if (options.signal?.aborted) return 'cancelled';
    const task = await this.store.claim(workerId, leaseMs);
    if (!task) return 'idle';

    let activeStatus: ModaGptTaskStatus = task.status;
    const controller = new AbortController();
    let heartbeatError: unknown;
    const abortForWorkerStop = () => {
      heartbeatError = new Error('MODAGPT_WORKER_STOPPING');
      controller.abort(heartbeatError);
    };
    options.signal?.addEventListener('abort', abortForWorkerStop, { once: true });
    if (options.signal?.aborted) abortForWorkerStop();
    let heartbeatPending = false;
    const heartbeat = setInterval(() => {
      if (heartbeatPending || controller.signal.aborted) return;
      heartbeatPending = true;
      void this.store.renewLease(task.id, workerId, leaseMs).then(renewed => {
        if (!renewed) {
          heartbeatError = new Error('MODAGPT_TASK_LEASE_LOST');
          controller.abort(heartbeatError);
        }
      }).catch(error => {
        heartbeatError = error;
        controller.abort(error);
      }).finally(() => {
        heartbeatPending = false;
      });
    }, Math.max(100, Math.min(5_000, Math.floor(leaseMs / 3))));
    try {
      if (controller.signal.aborted) return 'cancelled';
      const handler = handlers[task.taskType];
      if (!handler) throw new Error('MODAGPT_TASK_HANDLER_NOT_REGISTERED');
      const payload = JSON.parse(task.payload) as unknown;
      const result = await handler({
        ...task,
        payload,
        context: task.context ? JSON.parse(String(task.context)) as unknown : null,
        plan: task.plan ? JSON.parse(String(task.plan)) as unknown : null
      }, {
        signal: controller.signal,
        assertLease: async () => {
          if (controller.signal.aborted) {
            throw heartbeatError instanceof Error ? heartbeatError : new Error('MODAGPT_TASK_LEASE_LOST');
          }
          try {
            const renewed = await this.store.renewLease(task.id, workerId, leaseMs);
            if (renewed) return;
            heartbeatError = new Error('MODAGPT_TASK_LEASE_LOST');
            controller.abort(heartbeatError);
            throw heartbeatError;
          } catch (error) {
            heartbeatError = error;
            controller.abort(error);
            throw error;
          }
        },
        setPhase: async phase => {
          if (controller.signal.aborted) {
            throw heartbeatError instanceof Error ? heartbeatError : new Error('MODAGPT_TASK_LEASE_LOST');
          }
          if (phase === activeStatus) return;
          if (!canTransitionModaGptTask(activeStatus, phase)) {
            throw new Error('MODAGPT_TASK_TRANSITION_INVALID');
          }
          const transitioned = await this.store.transition({
            id: task.id,
            expectedStatus: activeStatus,
            status: phase,
            workerId
          });
          if (!transitioned) throw new Error('MODAGPT_TASK_LEASE_LOST');
          activeStatus = phase;
        },
        persistPlan: async plan => {
          if (controller.signal.aborted) {
            throw heartbeatError instanceof Error ? heartbeatError : new Error('MODAGPT_TASK_LEASE_LOST');
          }
          const serializedPlan = serializeJson(plan, MAX_PAYLOAD_BYTES, 'MODAGPT_TASK_PLAN_INVALID');
          if (!await this.store.persistPlan(task.id, workerId, serializedPlan)) {
            throw new Error('MODAGPT_TASK_LEASE_LOST');
          }
        }
      });
      if (controller.signal.aborted) {
        throw heartbeatError instanceof Error ? heartbeatError : new Error('MODAGPT_TASK_LEASE_LOST');
      }
      const serializedResult = serializeJson(result, MAX_RESULT_BYTES, 'MODAGPT_TASK_RESULT_INVALID');
      const waitingForApproval = Boolean(result && typeof result === 'object'
        && 'approvalRequired' in result && result.approvalRequired === true);
      const completionStatus = waitingForApproval ? 'waiting_approval' : 'completed';
      if (!canTransitionModaGptTask(activeStatus, completionStatus)) {
        throw new Error('MODAGPT_TASK_TRANSITION_INVALID');
      }
      if (!await this.store.complete(task.id, workerId, serializedResult, completionStatus)) {
        throw new Error('MODAGPT_TASK_LEASE_LOST');
      }
      if (completionStatus === 'completed' && task.parentTaskId) {
        await this.transitionTask(task.parentTaskId, 'waiting_approval', 'completed');
      }
      return completionStatus;
    } catch (error) {
      if (controller.signal.aborted) return 'cancelled';
      this.onTaskError(task, error);
      const errorCode = error instanceof Error && /^[A-Z][A-Z0-9_]{0,79}$/.test(error.message)
        ? error.message
        : 'MODAGPT_TASK_EXECUTION_FAILED';
      const willRetry = task.attempts < task.maxAttempts;
      const retryDelay = Math.min(1_000 * (2 ** Math.max(0, task.attempts - 1)), MAX_RETRY_DELAY_MS);
      const failureStatus = willRetry ? 'retrying' : 'dead_letter';
      if (!canTransitionModaGptTask(activeStatus, failureStatus)) {
        throw new Error('MODAGPT_TASK_TRANSITION_INVALID');
      }
      const updated = await this.store.fail({
        id: task.id,
        workerId,
        errorCode,
        retryAt: willRetry ? new Date(this.now() + retryDelay) : null
      });
      if (!updated) throw new Error('MODAGPT_TASK_LEASE_LOST');
      return failureStatus;
    } finally {
      clearInterval(heartbeat);
      options.signal?.removeEventListener('abort', abortForWorkerStop);
    }
  }

  async transitionTask(
    id: string,
    expectedStatus: ModaGptTaskStatus,
    status: ModaGptTaskStatus,
    workerId?: string
  ): Promise<boolean> {
    if (!canTransitionModaGptTask(expectedStatus, status)) {
      throw new Error('MODAGPT_TASK_TRANSITION_INVALID');
    }
    if (['planning', 'running', 'verifying'].includes(status) && !workerId) {
      throw new Error('MODAGPT_TASK_WORKER_REQUIRED');
    }
    if (['planning', 'running', 'verifying'].includes(expectedStatus) && !workerId) {
      throw new Error('MODAGPT_TASK_WORKER_REQUIRED');
    }
    return this.store.transition({ id, expectedStatus, status, workerId });
  }
}

export { ModaGptTaskRuntime as ModaGptTaskQueue };

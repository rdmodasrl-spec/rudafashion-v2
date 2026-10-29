export type ModaGptExecutionPlan = {
  id: string;
  taskId: string;
  tenantId: string;
  workflow: string;
  version: number;
  goal: string;
  steps: readonly string[];
  constraints: readonly string[];
  maxReplans: number;
};

export type ModaGptVerification = {
  passed: boolean;
  checks: string[];
  reason?: string;
};

export type ModaGptOrchestrationResult<TResult> = {
  plan: ModaGptExecutionPlan;
  result: TResult;
  verification: ModaGptVerification;
  replans: number;
  attempts: number;
};

export function createModaGptExecutionPlan(input: {
  taskId: string;
  tenantId: string;
  workflow: string;
  goal: string;
  steps: readonly string[];
  constraints: readonly string[];
  maxReplans: number;
}): ModaGptExecutionPlan {
  for (const value of [input.taskId, input.tenantId, input.workflow, input.goal]) {
    if (!value.trim() || value.length > 2_000 || /[\u0000-\u001f\u007f]/.test(value)) {
      throw new Error('MODAGPT_PLAN_INPUT_INVALID');
    }
  }
  if (
    !/^[a-z][a-z0-9_]{1,79}$/.test(input.workflow)
    || !input.steps.length
    || input.steps.length > 8
    || input.steps.some(step => !/^[a-z][a-z0-9_]{1,79}$/.test(step))
    || !Number.isInteger(input.maxReplans)
    || input.maxReplans < 0
    || input.maxReplans > 2
  ) throw new Error('MODAGPT_PLAN_DEFINITION_INVALID');
  return {
    id: `${input.workflow}:${input.taskId}`,
    taskId: input.taskId,
    tenantId: input.tenantId,
    workflow: input.workflow,
    version: 1,
    goal: input.goal,
    steps: [...input.steps],
    constraints: input.constraints.slice(0, 20).map(constraint => {
      if (!constraint.trim() || constraint.length > 500) throw new Error('MODAGPT_PLAN_DEFINITION_INVALID');
      return constraint;
    }),
    maxReplans: input.maxReplans
  };
}

export function createModaGptLowInventoryPlan(input: {
  taskId: string;
  tenantId: string;
  productId: string;
  sku: string;
  sourceEventId: string;
}): ModaGptExecutionPlan {
  for (const value of [input.taskId, input.tenantId, input.productId, input.sku, input.sourceEventId]) {
    if (!value.trim() || value.length > 160 || /[\u0000-\u001f\u007f]/.test(value)) {
      throw new Error('MODAGPT_PLAN_INPUT_INVALID');
    }
  }
  return createModaGptExecutionPlan({
    taskId: input.taskId,
    tenantId: input.tenantId,
    workflow: 'low_inventory_review',
    goal: `Verify low stock for ${input.sku} and provide a read-only replenishment suggestion.`,
    steps: ['retrieve_brain', 'check_inventory', 'analyze_sales_if_low', 'verify'],
    constraints: [
      'All reads must use the trusted task tenant.',
      'Re-read current inventory before using historical sales.',
      'Never alter stock, create a purchase, publish content, or contact customers.'
    ],
    maxReplans: 1
  });
}

export async function executeModaGptPlanWithVerification<TResult>(input: {
  plan: ModaGptExecutionPlan;
  execute: (plan: ModaGptExecutionPlan, signal: AbortSignal) => Promise<TResult>;
  verify: (result: TResult, plan: ModaGptExecutionPlan) => ModaGptVerification;
  replan: (
    previous: ModaGptExecutionPlan,
    verification: ModaGptVerification,
    replanNumber: number
  ) => ModaGptExecutionPlan;
  timeoutMs?: number;
  signal?: AbortSignal;
  onPhase?: (
    phase: 'planning' | 'running' | 'verifying',
    plan: ModaGptExecutionPlan
  ) => Promise<void> | void;
}): Promise<ModaGptOrchestrationResult<TResult>> {
  const timeoutMs = input.timeoutMs ?? 45_000;
  if (!Number.isInteger(input.plan.maxReplans) || input.plan.maxReplans < 0 || input.plan.maxReplans > 2) {
    throw new Error('MODAGPT_PLAN_REPLAN_LIMIT_INVALID');
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120_000) {
    throw new Error('MODAGPT_PLAN_TIMEOUT_INVALID');
  }
  if (input.signal?.aborted) throw new Error('MODAGPT_PLAN_CANCELLED');

  let plan = input.plan;
  let replans = 0;
  let attempts = 0;
  const deadline = Date.now() + timeoutMs;
  let lastVerification: ModaGptVerification = {
    passed: false,
    checks: [],
    reason: 'EXECUTION_NOT_STARTED'
  };

  while (attempts <= input.plan.maxReplans) {
    if (input.signal?.aborted) throw new Error('MODAGPT_PLAN_CANCELLED');
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('MODAGPT_PLAN_TIMEOUT');
    await input.onPhase?.('planning', plan);
    if (input.signal?.aborted) throw new Error('MODAGPT_PLAN_CANCELLED');
    attempts += 1;
    const controller = new AbortController();
    const abortFromParent = () => controller.abort();
    input.signal?.addEventListener('abort', abortFromParent, { once: true });
    const cancellation = new Promise<never>((_, reject) => {
      controller.signal.addEventListener('abort', () => {
        reject(new Error(input.signal?.aborted ? 'MODAGPT_PLAN_CANCELLED' : 'MODAGPT_PLAN_TIMEOUT'));
      }, { once: true });
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await input.onPhase?.('running', plan);
      const result = await Promise.race([
        input.execute(plan, controller.signal),
        cancellation,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error('MODAGPT_PLAN_TIMEOUT'));
          }, remaining);
        })
      ]);
      if (input.signal?.aborted) throw new Error('MODAGPT_PLAN_CANCELLED');
      await input.onPhase?.('verifying', plan);
      lastVerification = input.verify(result, plan);
      if (lastVerification.passed) {
        return { plan, result, verification: lastVerification, replans, attempts };
      }
      if (replans >= input.plan.maxReplans) {
        throw new Error('MODAGPT_PLAN_VERIFICATION_FAILED');
      }
      replans += 1;
      const nextPlan = input.replan(plan, lastVerification, replans);
      if (
        nextPlan.id !== input.plan.id
        || nextPlan.taskId !== input.plan.taskId
        || nextPlan.tenantId !== input.plan.tenantId
        || nextPlan.workflow !== input.plan.workflow
        || nextPlan.version !== plan.version + 1
        || nextPlan.maxReplans !== input.plan.maxReplans
        || nextPlan.steps.length > 8
      ) throw new Error('MODAGPT_REPLAN_INVALID');
      plan = nextPlan;
    } catch (error) {
      if (controller.signal.aborted && input.signal?.aborted) {
        throw new Error('MODAGPT_PLAN_CANCELLED');
      }
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
      input.signal?.removeEventListener('abort', abortFromParent);
    }
  }
  throw new Error(lastVerification.reason || 'MODAGPT_PLAN_EXECUTION_FAILED');
}

export function replanModaGptPlan(
  previous: ModaGptExecutionPlan,
  verification: ModaGptVerification,
  replanNumber: number
): ModaGptExecutionPlan {
  if (
    !Number.isInteger(replanNumber)
    || replanNumber < 1
    || replanNumber > previous.maxReplans
    || verification.passed
    || !verification.reason
  ) throw new Error('MODAGPT_REPLAN_INVALID');
  return {
    ...previous,
    version: previous.version + 1,
    constraints: [
      ...previous.constraints,
      `Replan ${replanNumber}: repeat all source reads because verification failed (${verification.reason}).`
    ]
  };
}

export const replanModaGptLowInventory = replanModaGptPlan;

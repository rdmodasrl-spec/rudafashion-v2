import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createModaGptLowInventoryPlan,
  executeModaGptPlanWithVerification,
  replanModaGptLowInventory
} from '../src/server/modagptOrchestration';

const plan = createModaGptLowInventoryPlan({
  taskId: 'task-a',
  tenantId: 'merchant-a',
  productId: 'product-a',
  sku: 'SKU-A',
  sourceEventId: 'event-a'
});

test('planner, executor, verifier and bounded replanner repeat source execution once then pass', async () => {
  let executions = 0;
  const phases: string[] = [];
  const result = await executeModaGptPlanWithVerification({
    plan,
    onPhase: phase => { phases.push(phase); },
    execute: async currentPlan => {
      executions += 1;
      return { planVersion: currentPlan.version, value: executions === 1 ? 'stale' : 'fresh' };
    },
    verify: output => output.value === 'fresh'
      ? { passed: true, checks: ['fresh_source'] }
      : { passed: false, checks: [], reason: 'STALE_SOURCE' },
    replan: replanModaGptLowInventory
  });

  assert.equal(executions, 2);
  assert.equal(result.attempts, 2);
  assert.equal(result.replans, 1);
  assert.equal(result.plan.version, 2);
  assert.deepEqual(result.verification.checks, ['fresh_source']);
  assert.deepEqual(phases, ['planning', 'running', 'verifying', 'planning', 'running', 'verifying']);
});

test('planner stops after the configured maximum replans without entering an infinite loop', async () => {
  let executions = 0;
  await assert.rejects(executeModaGptPlanWithVerification({
    plan,
    execute: async () => {
      executions += 1;
      return { ok: false };
    },
    verify: () => ({ passed: false, checks: [], reason: 'SOURCE_INVALID' }),
    replan: replanModaGptLowInventory
  }), /MODAGPT_PLAN_VERIFICATION_FAILED/);
  assert.equal(executions, 2);
});

test('planner preserves trusted tenant and task identity across replanning', async () => {
  await assert.rejects(executeModaGptPlanWithVerification({
    plan,
    execute: async () => ({ ok: false }),
    verify: () => ({ passed: false, checks: [], reason: 'SOURCE_INVALID' }),
    replan: previous => ({
      ...replanModaGptLowInventory(previous, { passed: false, checks: [], reason: 'SOURCE_INVALID' }, 1),
      tenantId: 'merchant-b'
    })
  }), /MODAGPT_REPLAN_INVALID/);
});

test('planner honors cancellation before work and reports an aborted active execution', async () => {
  const alreadyCancelled = new AbortController();
  alreadyCancelled.abort();
  await assert.rejects(executeModaGptPlanWithVerification({
    plan,
    execute: async () => ({ ok: true }),
    verify: () => ({ passed: true, checks: [] }),
    replan: replanModaGptLowInventory,
    signal: alreadyCancelled.signal
  }), /MODAGPT_PLAN_CANCELLED/);

  const activeCancellation = new AbortController();
  const pending = executeModaGptPlanWithVerification({
    plan,
    execute: async (_plan, signal) => new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(new Error('MODAGPT_PLAN_CANCELLED')), { once: true });
    }),
    verify: () => ({ passed: true, checks: [] }),
    replan: replanModaGptLowInventory,
    signal: activeCancellation.signal
  });
  activeCancellation.abort();
  await assert.rejects(pending, /MODAGPT_PLAN_CANCELLED/);
});

test('planner enforces bounds for plan input, replan count and timeout', async () => {
  assert.throws(() => createModaGptLowInventoryPlan({
    taskId: '',
    tenantId: 'merchant-a',
    productId: 'product-a',
    sku: 'SKU-A',
    sourceEventId: 'event-a'
  }), /MODAGPT_PLAN_INPUT_INVALID/);
  await assert.rejects(executeModaGptPlanWithVerification({
    plan: { ...plan, maxReplans: 10 },
    execute: async () => ({ ok: true }),
    verify: () => ({ passed: true, checks: [] }),
    replan: replanModaGptLowInventory
  }), /MODAGPT_PLAN_REPLAN_LIMIT_INVALID/);
  await assert.rejects(executeModaGptPlanWithVerification({
    plan,
    execute: async () => ({ ok: true }),
    verify: () => ({ passed: true, checks: [] }),
    replan: replanModaGptLowInventory,
    timeoutMs: 10
  }), /MODAGPT_PLAN_TIMEOUT_INVALID/);
});

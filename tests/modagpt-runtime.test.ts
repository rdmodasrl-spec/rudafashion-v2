import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createModaGptAgentContext,
  createModaGptInventoryReadTools,
  createModaGptToolRuntime,
  runModaGptAgentHandoff,
  runModaGptInventoryAgentHandoff,
  type ModaGptToolDefinition
} from '../src/server/modagptRuntime';

const recordAudit = async () => undefined;

function readToolRuntime(
  merchantId: string,
  calls: string[],
  inventory: Array<Record<string, unknown>>,
  soldUnits: number
) {
  const tools = createModaGptInventoryReadTools({
    getInventory: async (tenantId, sku, productId) => {
      calls.push(`inventory:${tenantId}:${sku}:${productId}`);
      return { inventory };
    },
    getSales: async (tenantId, sku) => {
      calls.push(`sales:${tenantId}:${sku}`);
      return { soldUnits };
    }
  });
  return createModaGptToolRuntime({
    principal: {
      tenantId: merchantId,
      actorId: 'modagpt-worker',
      active: true,
      permissions: ['inventory.read', 'sales.aggregate.read'],
      agentPermissions: {
        'supply-chain-finance-manager': ['inventory.read'],
        'sales-customer-manager': ['sales.aggregate.read']
      }
    },
    definitions: tools.definitions,
    handlers: tools.handlers,
    recordAudit
  });
}

test('inventory and sales agents hand off only compact tenant-scoped context through authorized tools', async () => {
  const calls: string[] = [];
  const runtime = readToolRuntime('merchant-a', calls, [{
    productId: 'product-a',
    sku: 'SKU-A',
    availableQuantity: 2
  }], 12);
  const context = createModaGptAgentContext({
    taskId: 'task-a',
    traceId: 'trace-a',
    tenantId: 'merchant-a',
    goal: 'Review this SKU and produce a read-only replenishment recommendation.',
    constraints: ['No purchase or inventory write.'],
    inputs: { productId: 'product-a', sku: 'SKU-A' }
  });

  const run = await runModaGptInventoryAgentHandoff({ context, threshold: 15, runtime });

  assert.deepEqual(calls, [
    'inventory:merchant-a:SKU-A:product-a',
    'sales:merchant-a:SKU-A'
  ]);
  assert.deepEqual(run.handoffs, ['supply-chain-finance-manager', 'sales-customer-manager']);
  assert.equal(run.soldUnits, 12);
  assert.deepEqual(run.toolResults.map(item => item.toolId), ['get_inventory', 'get_sales']);
  assert.equal(context.tenant_id, 'merchant-a');
  assert.match(context.summary, /sales-customer-manager/);
  assert.equal('conversationHistory' in context, false);
});

test('sales handoff is skipped when revalidated inventory is above threshold', async () => {
  const calls: string[] = [];
  const runtime = readToolRuntime('merchant-a', calls, [{
    productId: 'product-a',
    sku: 'SKU-A',
    availableQuantity: 20
  }], 12);
  const context = createModaGptAgentContext({
    taskId: 'task-a',
    tenantId: 'merchant-a',
    goal: 'Review low stock.',
    inputs: { productId: 'product-a', sku: 'SKU-A' }
  });

  const run = await runModaGptInventoryAgentHandoff({ context, threshold: 15, runtime });

  assert.deepEqual(calls, ['inventory:merchant-a:SKU-A:product-a']);
  assert.deepEqual(run.handoffs, ['supply-chain-finance-manager']);
  assert.equal(run.soldUnits, null);
});

test('generic handoffs transfer bounded AgentContext across multiple Core employees', async () => {
  let context = createModaGptAgentContext({
    taskId: 'task-multi',
    traceId: 'trace-multi',
    tenantId: 'merchant-a',
    goal: 'Prepare a verified merchant business summary.',
    inputs: { periodDays: 30 }
  });
  const visited: string[] = [];
  for (const agentId of [
    'business-manager',
    'sales-customer-manager',
    'supply-chain-finance-manager'
  ] as const) {
    const handoff = await runModaGptAgentHandoff({
      context,
      agentId,
      outputKey: `step_${visited.length + 1}`,
      decision: `Completed bounded handoff ${visited.length + 1}.`,
      execute: async agentContext => {
        visited.push(agentId);
        assert.equal(agentContext.task_id, 'task-multi');
        assert.equal(agentContext.trace_id, 'trace-multi');
        assert.equal(agentContext.tenant_id, 'merchant-a');
        assert.equal('conversationHistory' in agentContext, false);
        return {
          output: { agentId },
          toolResults: [{ toolId: `read_${visited.length}`, result: { scoped: true } }]
        };
      }
    });
    context = handoff.context;
  }
  assert.deepEqual(visited, [
    'business-manager',
    'sales-customer-manager',
    'supply-chain-finance-manager'
  ]);
  assert.deepEqual(context.decisions.map(item => item.agent_id), visited);
  assert.deepEqual(context.tool_results.map(item => item.tool_id), ['read_1', 'read_2', 'read_3']);
  assert.equal(context.outputs.step_1 !== undefined, true);
});

test('tool runtime denies cross-tenant, inactive, and ungranted tool access before database handlers', async () => {
  const calls: string[] = [];
  const runtime = readToolRuntime('merchant-a', calls, [], 0);
  const call = {
    taskId: 'task-a',
    tenantId: 'merchant-b',
    agentId: 'supply-chain-finance-manager' as const,
    toolId: 'get_inventory',
    input: { sku: 'SKU-B', productId: 'product-b' }
  };
  await assert.rejects(runtime.execute(call), /MODAGPT_POLICY_TENANT_DENIED/);

  const tools = createModaGptInventoryReadTools({
    getInventory: async () => {
      calls.push('unauthorized-handler');
      return { inventory: [] };
    },
    getSales: async () => ({ soldUnits: 0 })
  });
  const denied = createModaGptToolRuntime({
    principal: {
      tenantId: 'merchant-a',
      actorId: 'worker',
      active: false,
      permissions: ['inventory.read'],
      agentPermissions: { 'supply-chain-finance-manager': ['inventory.read'] }
    },
    definitions: tools.definitions,
    handlers: tools.handlers,
    recordAudit
  });
  await assert.rejects(denied.execute({ ...call, tenantId: 'merchant-a' }), /MODAGPT_POLICY_TENANT_DENIED/);
  assert.deepEqual(calls, []);
});

test('tool runtime enforces the agent permission grant before execution', async () => {
  let invoked = false;
  const tools = createModaGptInventoryReadTools({
    getInventory: async () => {
      invoked = true;
      return { inventory: [] };
    },
    getSales: async () => ({ soldUnits: 0 })
  });
  const runtime = createModaGptToolRuntime({
    principal: {
      tenantId: 'merchant-a',
      actorId: 'worker',
      active: true,
      permissions: ['inventory.read'],
      agentPermissions: {}
    },
    definitions: tools.definitions,
    handlers: tools.handlers,
    recordAudit
  });
  await assert.rejects(runtime.execute({
    taskId: 'task-a',
    tenantId: 'merchant-a',
    agentId: 'supply-chain-finance-manager',
    toolId: 'get_inventory',
    input: { sku: 'SKU-A', productId: 'product-a' }
  }), /MODAGPT_POLICY_PERMISSION_DENIED/);
  assert.equal(invoked, false);
});

test('HIGH and CRITICAL tools require matching unexpired approval before handler execution', async () => {
  let called = 0;
  const definition: ModaGptToolDefinition = {
    name: 'release_payment',
    description: 'Release a payment after explicit approval.',
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    permission: 'finance.write',
    riskLevel: 'CRITICAL',
    requiresApproval: true,
    timeoutMs: 1_000,
    retryPolicy: { maxAttempts: 1, idempotent: false },
    auditPolicy: 'required',
    validateInput: value => !!value && typeof value === 'object',
    validateOutput: value => !!value && typeof value === 'object'
  };
  const base = {
    tenantId: 'merchant-a',
    actorId: 'worker',
    active: true,
    permissions: ['finance.write'],
    agentPermissions: { 'supply-chain-finance-manager': ['finance.write'] }
  } as const;
  const handlers = { release_payment: async () => { called += 1; return { ok: true }; } };
  const noApproval = createModaGptToolRuntime({
    principal: base,
    definitions: [definition],
    handlers,
    recordAudit
  });
  const call = {
    taskId: 'task-a',
    tenantId: 'merchant-a',
    agentId: 'supply-chain-finance-manager' as const,
    toolId: 'release_payment',
    input: {}
  };
  await assert.rejects(noApproval.execute(call), /MODAGPT_APPROVAL_REQUIRED/);
  assert.equal(called, 0);

  const approved = createModaGptToolRuntime({
    principal: {
      ...base,
      approvedActions: [{
        taskId: 'task-a',
        toolId: 'release_payment',
        tenantId: 'merchant-a',
        expiresAt: new Date(Date.now() + 60_000)
      }]
    },
    definitions: [definition],
    handlers,
    recordAudit
  });
  assert.deepEqual((await approved.execute(call)).result, { ok: true });
  assert.equal(called, 1);
});

test('tool runtime records audit lifecycle and rejects invalid output', async () => {
  const audit: string[] = [];
  const tools = createModaGptInventoryReadTools({
    getInventory: async () => ({ inventory: [{ sku: 'SKU-A', productId: 'product-a', availableQuantity: 'unknown' }] }),
    getSales: async () => ({ soldUnits: 0 })
  });
  const runtime = createModaGptToolRuntime({
    principal: {
      tenantId: 'merchant-a',
      actorId: 'worker',
      active: true,
      permissions: ['inventory.read'],
      agentPermissions: { 'supply-chain-finance-manager': ['inventory.read'] }
    },
    definitions: tools.definitions,
    handlers: tools.handlers,
    recordAudit: async event => { audit.push(event.status); }
  });
  await assert.rejects(runtime.execute({
    taskId: 'task-a',
    tenantId: 'merchant-a',
    agentId: 'supply-chain-finance-manager',
    toolId: 'get_inventory',
    input: { sku: 'SKU-A', productId: 'product-a' }
  }), /MODAGPT_TOOL_OUTPUT_INVALID/);
  assert.deepEqual(audit, ['started', 'failed']);
});

test('tool definitions reject unsafe retries for non-idempotent actions', () => {
  assert.throws(() => createModaGptToolRuntime({
    principal: {
      tenantId: 'merchant-a',
      actorId: 'worker',
      active: true,
      permissions: [],
      agentPermissions: {}
    },
    definitions: [{
      name: 'unsafe_write',
      description: 'Non-idempotent write.',
      inputSchema: {},
      outputSchema: {},
      permission: 'write',
      riskLevel: 'HIGH',
      requiresApproval: true,
      timeoutMs: 1_000,
      retryPolicy: { maxAttempts: 2, idempotent: false },
      auditPolicy: 'required',
      validateInput: () => true,
      validateOutput: () => true
    }],
    handlers: { unsafe_write: async () => ({ ok: true }) },
    recordAudit
  }), /MODAGPT_TOOL_DEFINITION_INVALID/);
});

test('tool runtime rejects work that exceeds the registered timeout', async () => {
  const tool: ModaGptToolDefinition = {
    name: 'slow_read',
    description: 'A bounded read operation.',
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    permission: 'data.read',
    riskLevel: 'LOW',
    requiresApproval: false,
    timeoutMs: 100,
    retryPolicy: { maxAttempts: 1, idempotent: true },
    auditPolicy: 'required',
    validateInput: value => !!value && typeof value === 'object',
    validateOutput: value => !!value && typeof value === 'object'
  };
  const runtime = createModaGptToolRuntime({
    principal: {
      tenantId: 'merchant-a',
      actorId: 'worker',
      active: true,
      permissions: ['data.read'],
      agentPermissions: { 'business-manager': ['data.read'] }
    },
    definitions: [tool],
    handlers: {
      slow_read: async () => new Promise(resolve => setTimeout(() => resolve({ ok: true }), 200))
    },
    recordAudit
  });
  await assert.rejects(runtime.execute({
    taskId: 'task-a',
    tenantId: 'merchant-a',
    agentId: 'business-manager',
    toolId: 'slow_read',
    input: {}
  }), /MODAGPT_TOOL_TIMEOUT/);
});

test('tool runtime aborts an in-flight tool on worker cancellation without retrying it', async () => {
  const controller = new AbortController();
  const audits: string[] = [];
  const tool: ModaGptToolDefinition = {
    name: 'cancellable_read',
    description: 'A cancellable read operation.',
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    permission: 'data.read',
    riskLevel: 'LOW',
    requiresApproval: false,
    timeoutMs: 5_000,
    retryPolicy: { maxAttempts: 3, idempotent: true },
    auditPolicy: 'required',
    validateInput: value => !!value && typeof value === 'object',
    validateOutput: value => !!value && typeof value === 'object'
  };
  const runtime = createModaGptToolRuntime({
    principal: {
      tenantId: 'merchant-a',
      actorId: 'worker',
      active: true,
      permissions: ['data.read'],
      agentPermissions: { 'business-manager': ['data.read'] }
    },
    definitions: [tool],
    handlers: {
      cancellable_read: async (_tenantId, _input, signal) => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('HANDLER_ABORTED')), { once: true });
        setTimeout(() => resolve({ ok: true }), 2_000);
      })
    },
    signal: controller.signal,
    recordAudit: async event => { audits.push(event.status); }
  });
  const execution = runtime.execute({
    taskId: 'task-a',
    tenantId: 'merchant-a',
    agentId: 'business-manager',
    toolId: 'cancellable_read',
    input: {}
  });
  await new Promise(resolve => setTimeout(resolve, 20));
  controller.abort();
  await assert.rejects(execution, /MODAGPT_TOOL_CANCELLED/);
  assert.deepEqual(audits, ['started', 'failed']);
});

test('tool runtime revalidates the worker lease immediately before invoking a tool handler', async () => {
  let leaseChecks = 0;
  let handlerCalls = 0;
  const tool: ModaGptToolDefinition = {
    name: 'guarded_write',
    description: 'A lease-guarded write operation.',
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    permission: 'data.write',
    riskLevel: 'LOW',
    requiresApproval: false,
    timeoutMs: 1_000,
    retryPolicy: { maxAttempts: 1, idempotent: false },
    auditPolicy: 'required',
    validateInput: value => !!value && typeof value === 'object',
    validateOutput: value => !!value && typeof value === 'object'
  };
  const runtime = createModaGptToolRuntime({
    principal: {
      tenantId: 'merchant-a',
      actorId: 'worker',
      active: true,
      permissions: ['data.write'],
      agentPermissions: { 'business-manager': ['data.write'] }
    },
    definitions: [tool],
    handlers: {
      guarded_write: async () => {
        handlerCalls += 1;
        return { ok: true };
      }
    },
    assertLease: async () => {
      leaseChecks += 1;
      throw new Error('MODAGPT_TASK_LEASE_LOST');
    },
    recordAudit
  });

  await assert.rejects(runtime.execute({
    taskId: 'task-a',
    tenantId: 'merchant-a',
    agentId: 'business-manager',
    toolId: 'guarded_write',
    input: {}
  }), /MODAGPT_TASK_LEASE_LOST/);
  assert.equal(leaseChecks, 1);
  assert.equal(handlerCalls, 0);
});

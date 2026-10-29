import { randomUUID } from 'node:crypto';

export const modaGptRiskLevels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type ModaGptRiskLevel = (typeof modaGptRiskLevels)[number];

export const modaGptCoreAgentIds = [
  'business-manager',
  'product-creative-manager',
  'sales-customer-manager',
  'supply-chain-finance-manager'
] as const;

export type ModaGptAgentRole = (typeof modaGptCoreAgentIds)[number];

export type ModaGptAgentContext = {
  task_id: string;
  trace_id: string;
  tenant_id: string;
  goal: string;
  constraints: string[];
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  artifacts: string[];
  decisions: Array<{ agent_id: ModaGptAgentRole; decision: string }>;
  tool_results: Array<{ tool_id: string; result: unknown }>;
  memory_refs: string[];
  knowledge_refs: string[];
  summary: string;
};

export type ModaGptAgentDecision = {
  type: 'continue' | 'finish' | 'needs_input' | 'approval_required';
  reason: string;
};

export type ModaGptAgentTask = {
  taskId: string;
  parentTaskId: string | null;
  traceId: string;
  tenantId: string;
  actorId: string;
  goal: string;
  agentId: ModaGptAgentRole;
  inputs: Record<string, unknown>;
  constraints: readonly string[];
  permissions: readonly string[];
};

export type ModaGptAgentExecution = {
  status: 'completed' | 'needs_input' | 'approval_required' | 'failed';
  decision: ModaGptAgentDecision;
  output: unknown;
  toolResults?: Array<{ toolId: string; result: unknown }>;
  artifacts?: string[];
};

export type ModaGptAgentResult = {
  taskId: string;
  parentTaskId: string | null;
  traceId: string;
  tenantId: string;
  actorId: string;
  agentId: ModaGptAgentRole;
  agentVersion: string;
  status: ModaGptAgentExecution['status'];
  decision: ModaGptAgentDecision;
  output: unknown;
  toolResults: Array<{ toolId: string; result: unknown }>;
  artifacts: string[];
  memoryRefs: string[];
  knowledgeRefs: string[];
};

export type ModaGptAgentDefinition = {
  agentId: ModaGptAgentRole;
  version: string;
  skills: readonly string[];
  allowedTools: readonly string[];
  requiredPermissions: readonly string[];
  execute: (task: ModaGptAgentTask, context: ModaGptAgentContext) => Promise<ModaGptAgentExecution>;
};

export type ModaGptTrustedPrincipal = {
  tenantId: string;
  actorId: string;
  active: boolean;
  permissions: readonly string[];
  agentPermissions: Partial<Record<ModaGptAgentRole, readonly string[]>>;
  approvedActions?: readonly {
    taskId: string;
    toolId: string;
    tenantId: string;
    expiresAt: Date;
  }[];
};

export type ModaGptToolDefinition = {
  name: string;
  description: string;
  inputSchema: Readonly<Record<string, unknown>>;
  outputSchema: Readonly<Record<string, unknown>>;
  permission: string;
  riskLevel: ModaGptRiskLevel;
  requiresApproval: boolean;
  timeoutMs: number;
  retryPolicy: { maxAttempts: number; idempotent: boolean };
  auditPolicy: 'required';
  validateInput: (value: unknown) => boolean;
  validateOutput: (value: unknown) => boolean;
};

export type ModaGptToolCall = {
  taskId: string;
  agentId: ModaGptAgentRole;
  toolId: string;
  input: unknown;
};

export type ModaGptToolRuntimeOptions = {
  principal: ModaGptTrustedPrincipal;
  definitions: readonly ModaGptToolDefinition[];
  handlers: Readonly<Record<string, (tenantId: string, input: unknown, signal: AbortSignal) => Promise<unknown>>>;
  signal?: AbortSignal;
  assertLease?: () => Promise<void>;
  recordAudit: (event: {
    taskId: string;
    tenantId: string;
    actorId: string;
    agentId: ModaGptAgentRole;
    toolId: string;
    riskLevel: ModaGptRiskLevel;
    attempt: number;
    status: 'started' | 'succeeded' | 'failed';
    errorCode?: string;
  }) => Promise<void>;
  now?: () => Date;
};

const approvalRiskLevels = new Set<ModaGptRiskLevel>(['HIGH', 'CRITICAL']);
const MAX_CONTEXT_BYTES = 24 * 1024;
const MAX_CONTEXT_ENTRIES = 40;

function boundedText(value: string, maxLength: number): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength || /[\u0000-\u001f\u007f]/.test(trimmed)) {
    throw new Error('MODAGPT_CONTEXT_INVALID');
  }
  return trimmed;
}

function contextBytes(context: ModaGptAgentContext): number {
  return Buffer.byteLength(JSON.stringify(context), 'utf8');
}

export function createModaGptAgentContext(input: {
  taskId: string;
  traceId?: string;
  tenantId: string;
  goal: string;
  constraints?: readonly string[];
  inputs?: Record<string, unknown>;
}): ModaGptAgentContext {
  const context: ModaGptAgentContext = {
    task_id: boundedText(input.taskId, 160),
    trace_id: boundedText(input.traceId || randomUUID(), 160),
    tenant_id: boundedText(input.tenantId, 120),
    goal: boundedText(input.goal, 2_000),
    constraints: (input.constraints || []).slice(0, MAX_CONTEXT_ENTRIES).map(item => boundedText(item, 500)),
    inputs: input.inputs || {},
    outputs: {},
    artifacts: [],
    decisions: [],
    tool_results: [],
    memory_refs: [],
    knowledge_refs: [],
    summary: ''
  };
  if (contextBytes(context) > MAX_CONTEXT_BYTES) throw new Error('MODAGPT_CONTEXT_TOO_LARGE');
  return context;
}

export function summarizeModaGptAgentContext(context: ModaGptAgentContext): ModaGptAgentContext {
  const summary = JSON.stringify({
    goal: context.goal,
    brainEvidence: context.summary.slice(0, 2_000),
    inputs: context.inputs,
    outputs: context.outputs,
    decisions: context.decisions.slice(-10),
    tools: context.tool_results.slice(-10).map(item => item.tool_id),
    memory_refs: context.memory_refs.slice(-10),
    knowledge_refs: context.knowledge_refs.slice(-10)
  });
  const compacted: ModaGptAgentContext = {
    ...context,
    constraints: context.constraints.slice(0, 12),
    inputs: Object.fromEntries(Object.entries(context.inputs).slice(0, MAX_CONTEXT_ENTRIES)),
    outputs: Object.fromEntries(Object.entries(context.outputs).slice(-MAX_CONTEXT_ENTRIES)),
    artifacts: context.artifacts.slice(-MAX_CONTEXT_ENTRIES),
    decisions: context.decisions.slice(-10),
    tool_results: context.tool_results.slice(-10),
    memory_refs: context.memory_refs.slice(-10),
    knowledge_refs: context.knowledge_refs.slice(-10),
    summary: summary.slice(0, 6_000)
  };
  if (contextBytes(compacted) > MAX_CONTEXT_BYTES) throw new Error('MODAGPT_CONTEXT_TOO_LARGE');
  return compacted;
}

function authorizeToolCall(
  call: ModaGptToolCall & { tenantId: string },
  tool: ModaGptToolDefinition,
  principal: ModaGptTrustedPrincipal,
  now: Date
): void {
  if (
    !principal.active
    || principal.tenantId !== call.tenantId
  ) throw new Error('MODAGPT_POLICY_TENANT_DENIED');
  const allowedAgentPermissions = principal.agentPermissions[call.agentId] || [];
  if (
    !principal.permissions.includes(tool.permission)
    || !allowedAgentPermissions.includes(tool.permission)
  ) throw new Error('MODAGPT_POLICY_PERMISSION_DENIED');
  if (tool.requiresApproval || approvalRiskLevels.has(tool.riskLevel)) {
    const approved = principal.approvedActions?.some(action =>
      action.taskId === call.taskId
      && action.toolId === call.toolId
      && action.tenantId === principal.tenantId
      && action.expiresAt.getTime() > now.getTime()
    );
    if (!approved) throw new Error('MODAGPT_APPROVAL_REQUIRED');
  }
}

export function createModaGptToolRuntime(options: ModaGptToolRuntimeOptions) {
  const now = options.now || (() => new Date());
  const definitions = new Map<string, ModaGptToolDefinition>();
  for (const definition of options.definitions) {
    if (definitions.has(definition.name)) throw new Error('MODAGPT_TOOL_DUPLICATE');
    if (
      !definition.name
      || !definition.permission
      || !modaGptRiskLevels.includes(definition.riskLevel)
      || definition.auditPolicy !== 'required'
      || !Number.isInteger(definition.timeoutMs)
      || definition.timeoutMs < 100
      || definition.timeoutMs > 60_000
      || !Number.isInteger(definition.retryPolicy.maxAttempts)
      || definition.retryPolicy.maxAttempts < 1
      || definition.retryPolicy.maxAttempts > 3
      || (definition.retryPolicy.maxAttempts > 1 && !definition.retryPolicy.idempotent)
    ) throw new Error('MODAGPT_TOOL_DEFINITION_INVALID');
    definitions.set(definition.name, definition);
  }

  return {
    async execute(call: ModaGptToolCall & { tenantId: string }) {
      if (options.signal?.aborted) throw new Error('MODAGPT_TOOL_CANCELLED');
      const tool = definitions.get(call.toolId);
      const handler = options.handlers[call.toolId];
      if (!tool || !handler) throw new Error('MODAGPT_TOOL_NOT_REGISTERED');
      if (call.tenantId !== options.principal.tenantId) throw new Error('MODAGPT_POLICY_TENANT_DENIED');
      authorizeToolCall(call, tool, options.principal, now());
      if (!tool.validateInput(call.input)) throw new Error('MODAGPT_TOOL_INPUT_INVALID');

      await options.recordAudit({
        taskId: call.taskId,
        tenantId: options.principal.tenantId,
        actorId: options.principal.actorId,
        agentId: call.agentId,
        toolId: call.toolId,
        riskLevel: tool.riskLevel,
        attempt: 1,
        status: 'started'
      });
      let lastError: unknown;
      for (let attempt = 1; attempt <= tool.retryPolicy.maxAttempts; attempt += 1) {
        let timeout: ReturnType<typeof setTimeout> | undefined;
        const controller = new AbortController();
        const abortFromParent = () => controller.abort(options.signal?.reason);
        try {
          if (options.signal?.aborted) throw new Error('MODAGPT_TOOL_CANCELLED');
          await options.assertLease?.();
          if (options.signal?.aborted) throw new Error('MODAGPT_TOOL_CANCELLED');
          options.signal?.addEventListener('abort', abortFromParent, { once: true });
          const result = await Promise.race([
            handler(options.principal.tenantId, call.input, controller.signal),
            new Promise<never>((_, reject) => {
              controller.signal.addEventListener('abort', () => {
                reject(new Error(options.signal?.aborted ? 'MODAGPT_TOOL_CANCELLED' : 'MODAGPT_TOOL_TIMEOUT'));
              }, { once: true });
            }),
            new Promise<never>((_, reject) => {
              timeout = setTimeout(() => {
                controller.abort();
                reject(new Error('MODAGPT_TOOL_TIMEOUT'));
              }, tool.timeoutMs);
            })
          ]);
          if (options.signal?.aborted) throw new Error('MODAGPT_TOOL_CANCELLED');
          if (!tool.validateOutput(result)) throw new Error('MODAGPT_TOOL_OUTPUT_INVALID');
          await options.recordAudit({
            taskId: call.taskId,
            tenantId: options.principal.tenantId,
            actorId: options.principal.actorId,
            agentId: call.agentId,
            toolId: call.toolId,
            riskLevel: tool.riskLevel,
            attempt,
            status: 'succeeded'
          });
          return {
            result,
            audit: {
              taskId: call.taskId,
              tenantId: options.principal.tenantId,
              actorId: options.principal.actorId,
              agentId: call.agentId,
              toolId: call.toolId,
              riskLevel: tool.riskLevel,
              attempt,
              status: 'succeeded' as const
            }
          };
        } catch (error) {
          lastError = error;
          const errorCode = error instanceof Error && /^[A-Z][A-Z0-9_]{0,79}$/.test(error.message)
            ? error.message
            : 'MODAGPT_TOOL_EXECUTION_FAILED';
          if (attempt === tool.retryPolicy.maxAttempts || options.signal?.aborted) {
            await options.recordAudit({
              taskId: call.taskId,
              tenantId: options.principal.tenantId,
              actorId: options.principal.actorId,
              agentId: call.agentId,
              toolId: call.toolId,
              riskLevel: tool.riskLevel,
              attempt,
              status: 'failed',
              errorCode
            });
          }
          if (attempt === tool.retryPolicy.maxAttempts || options.signal?.aborted) break;
        } finally {
          if (timeout) clearTimeout(timeout);
          options.signal?.removeEventListener('abort', abortFromParent);
        }
      }
      throw lastError instanceof Error ? lastError : new Error('MODAGPT_TOOL_EXECUTION_FAILED');
    }
  };
}

export async function runModaGptAgentHandoff<TOutput>(input: {
  context: ModaGptAgentContext;
  agentId: ModaGptAgentRole;
  outputKey: string;
  decision: string;
  execute: (context: ModaGptAgentContext) => Promise<{
    output: TOutput;
    toolResults?: Array<{ toolId: string; result: unknown }>;
    artifacts?: string[];
  }>;
}): Promise<{ context: ModaGptAgentContext; output: TOutput }> {
  if (!/^[a-z][A-Za-z0-9_]{1,63}$/.test(input.outputKey)
    || !input.decision.trim()
    || input.decision.length > 500) {
    throw new Error('MODAGPT_AGENT_HANDOFF_INVALID');
  }
  const context = summarizeModaGptAgentContext(input.context);
  const identity = {
    task_id: context.task_id,
    trace_id: context.trace_id,
    tenant_id: context.tenant_id
  };
  const result = await input.execute(context);
  if (
    context.task_id !== identity.task_id
    || context.trace_id !== identity.trace_id
    || context.tenant_id !== identity.tenant_id
  ) throw new Error('MODAGPT_AGENT_HANDOFF_IDENTITY_CHANGED');
  if (context.decisions.length >= MAX_CONTEXT_ENTRIES
    || context.tool_results.length + (result.toolResults?.length || 0) > MAX_CONTEXT_ENTRIES
    || context.artifacts.length + (result.artifacts?.length || 0) > MAX_CONTEXT_ENTRIES) {
    throw new Error('MODAGPT_AGENT_HANDOFF_CONTEXT_LIMIT');
  }
  context.outputs[input.outputKey] = result.output;
  context.decisions.push({ agent_id: input.agentId, decision: input.decision.trim() });
  context.tool_results.push(...(result.toolResults || []).map(item => ({
    tool_id: boundedText(item.toolId, 80),
    result: item.result
  })));
  context.artifacts.push(...(result.artifacts || []).map(item => boundedText(item, 500)));
  context.summary = JSON.stringify({
    goal: context.goal,
    agents: context.decisions.map(item => item.agent_id),
    tools: context.tool_results.map(item => item.tool_id),
    outputKeys: Object.keys(context.outputs),
    memory_refs: context.memory_refs.slice(-10),
    knowledge_refs: context.knowledge_refs.slice(-10)
  }).slice(0, 6_000);
  return { context: summarizeModaGptAgentContext(context), output: result.output };
}

export class ModaGptAgentRuntime {
  private readonly definitions = new Map<ModaGptAgentRole, ModaGptAgentDefinition>();

  constructor(definitions: readonly ModaGptAgentDefinition[]) {
    for (const definition of definitions) this.register(definition);
  }

  register(definition: ModaGptAgentDefinition): void {
    if (
      !modaGptCoreAgentIds.includes(definition.agentId)
      || !/^\d+\.\d+\.\d+$/.test(definition.version)
      || !definition.skills.length
      || definition.skills.some(skill => !/^[a-z][a-z0-9_]{1,79}$/.test(skill))
      || definition.allowedTools.some(tool => !/^[a-z][a-z0-9_]{1,79}$/.test(tool))
      || definition.requiredPermissions.some(permission => !/^[a-z][a-z0-9._-]{1,119}$/.test(permission))
      || this.definitions.has(definition.agentId)
    ) throw new Error('MODAGPT_AGENT_DEFINITION_INVALID');
    this.definitions.set(definition.agentId, definition);
  }

  has(agentId: ModaGptAgentRole): boolean {
    return this.definitions.has(agentId);
  }

  async execute(input: {
    task: ModaGptAgentTask;
    context: ModaGptAgentContext;
  }): Promise<{ result: ModaGptAgentResult; context: ModaGptAgentContext }> {
    const { task, context } = input;
    const definition = this.definitions.get(task.agentId);
    if (!definition) throw new Error('MODAGPT_AGENT_NOT_REGISTERED');
    if (
      task.taskId !== context.task_id
      || task.traceId !== context.trace_id
      || task.tenantId !== context.tenant_id
      || task.goal !== context.goal
    ) throw new Error('MODAGPT_AGENT_CONTEXT_MISMATCH');
    if (definition.requiredPermissions.some(permission => !task.permissions.includes(permission))) {
      throw new Error('MODAGPT_AGENT_PERMISSION_REQUIRED');
    }

    const handoff = await runModaGptAgentHandoff({
      context,
      agentId: task.agentId,
      outputKey: `agent_${task.agentId.replaceAll('-', '_')}`,
      decision: `${definition.version}: ${task.goal}`,
      execute: async boundedContext => {
        const execution = await definition.execute(task, boundedContext);
        if (!['completed', 'needs_input', 'approval_required', 'failed'].includes(execution.status)
          || !['continue', 'finish', 'needs_input', 'approval_required'].includes(execution.decision.type)
          || !execution.decision.reason.trim()
          || execution.decision.reason.length > 500
          || (execution.status === 'approval_required' && execution.decision.type !== 'approval_required')) {
          throw new Error('MODAGPT_AGENT_RESULT_INVALID');
        }
        if ((execution.toolResults || []).some(result => !definition.allowedTools.includes(result.toolId))) {
          throw new Error('MODAGPT_AGENT_TOOL_NOT_ALLOWED');
        }
        return {
          output: execution.output,
          toolResults: execution.toolResults,
          artifacts: execution.artifacts
        };
      }
    });
    const execution = await definition.execute(task, summarizeModaGptAgentContext(context));
    const result: ModaGptAgentResult = {
      taskId: task.taskId,
      parentTaskId: task.parentTaskId,
      traceId: task.traceId,
      tenantId: task.tenantId,
      actorId: task.actorId,
      agentId: task.agentId,
      agentVersion: definition.version,
      status: execution.status,
      decision: execution.decision,
      output: handoff.output,
      toolResults: execution.toolResults || [],
      artifacts: execution.artifacts || [],
      memoryRefs: handoff.context.memory_refs,
      knowledgeRefs: handoff.context.knowledge_refs
    };
    return { result, context: handoff.context };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function createModaGptInventoryReadTools(handlers: {
  getInventory: (tenantId: string, sku: string, productId: string) => Promise<unknown>;
  getSales: (tenantId: string, sku: string) => Promise<unknown>;
}) {
  const inputSchema = {
    type: 'object',
    required: ['sku', 'productId'],
    properties: { sku: { type: 'string' }, productId: { type: 'string' } },
    additionalProperties: false
  } as const;
  const skuSchema = {
    type: 'object',
    required: ['sku'],
    properties: { sku: { type: 'string' } },
    additionalProperties: false
  } as const;
  const inventoryTool: ModaGptToolDefinition = {
    name: 'get_inventory',
    description: 'Read current inventory for one tenant-owned SKU and product.',
    inputSchema,
    outputSchema: { type: 'object', required: ['inventory'] },
    permission: 'inventory.read',
    riskLevel: 'LOW',
    requiresApproval: false,
    timeoutMs: 15_000,
    retryPolicy: { maxAttempts: 1, idempotent: true },
    auditPolicy: 'required',
    validateInput: value => isRecord(value)
      && Object.keys(value).length === 2
      && typeof value.sku === 'string' && value.sku.length > 0
      && typeof value.productId === 'string' && value.productId.length > 0,
    validateOutput: value => isRecord(value)
      && Array.isArray(value.inventory)
      && value.inventory.every(record => isRecord(record)
        && Number.isFinite(record.availableQuantity)
        && typeof record.sku === 'string'
        && typeof record.productId === 'string')
  };
  const salesTool: ModaGptToolDefinition = {
    name: 'get_sales',
    description: 'Read tenant-scoped aggregate unit sales for one SKU.',
    inputSchema: skuSchema,
    outputSchema: { type: 'object', required: ['soldUnits'] },
    permission: 'sales.aggregate.read',
    riskLevel: 'LOW',
    requiresApproval: false,
    timeoutMs: 15_000,
    retryPolicy: { maxAttempts: 1, idempotent: true },
    auditPolicy: 'required',
    validateInput: value => isRecord(value)
      && Object.keys(value).length === 1
      && typeof value.sku === 'string' && value.sku.length > 0,
    validateOutput: value => isRecord(value)
      && Number.isInteger(value.soldUnits)
      && Number(value.soldUnits) >= 0
  };
  return {
    definitions: [inventoryTool, salesTool],
    handlers: {
      get_inventory: (tenantId: string, value: unknown) => {
        const input = value as { sku: string; productId: string };
        return handlers.getInventory(tenantId, input.sku, input.productId);
      },
      get_sales: (tenantId: string, value: unknown) => {
        const input = value as { sku: string };
        return handlers.getSales(tenantId, input.sku);
      }
    }
  };
}

export async function runModaGptInventoryAgentHandoff(input: {
  context: ModaGptAgentContext;
  threshold: number;
  runtime: ReturnType<typeof createModaGptToolRuntime>;
}): Promise<{
  inventory: unknown;
  soldUnits: number | null;
  handoffs: ModaGptAgentRole[];
  toolResults: Array<{ toolId: string; result: unknown }>;
}> {
  const originalContext = input.context;
  const { sku, productId } = input.context.inputs;
  if (
    typeof sku !== 'string' || !sku
    || typeof productId !== 'string' || !productId
    || !Number.isFinite(input.threshold)
    || input.threshold < 0
  ) throw new Error('MODAGPT_WORKFLOW_INPUT_INVALID');

  const inventoryHandoff = await runModaGptAgentHandoff({
    context: input.context,
    agentId: 'supply-chain-finance-manager',
    outputKey: 'inventory',
    decision: 'Revalidated current tenant inventory before deciding whether sales analysis was needed.',
    execute: async context => {
      const call = await input.runtime.execute({
        taskId: context.task_id,
        tenantId: context.tenant_id,
        agentId: 'supply-chain-finance-manager',
        toolId: 'get_inventory',
        input: { sku, productId }
      });
      return {
        output: call.result,
        toolResults: [{ toolId: 'get_inventory', result: call.result }]
      };
    }
  });
  input.context = inventoryHandoff.context;
  const records = (inventoryHandoff.output as { inventory: Array<{ availableQuantity?: unknown }> }).inventory;
  Object.assign(originalContext, input.context);
  input.context = originalContext;
  const firstRecord = records[0];
  const availableQuantity = firstRecord && Number.isFinite(firstRecord.availableQuantity)
    ? Number(firstRecord.availableQuantity)
    : null;
  if (availableQuantity === null || availableQuantity > input.threshold) {
    return {
      inventory: inventoryHandoff.output,
      soldUnits: null,
      handoffs: ['supply-chain-finance-manager'],
      toolResults: input.context.tool_results.map(({ tool_id, result }) => ({ toolId: tool_id, result }))
    };
  }

  const salesHandoff = await runModaGptAgentHandoff({
    context: input.context,
    agentId: 'sales-customer-manager',
    outputKey: 'soldUnits',
    decision: 'Returned tenant-scoped aggregate SKU sales only; no customer-level data was requested.',
    execute: async context => {
      const call = await input.runtime.execute({
        taskId: context.task_id,
        tenantId: context.tenant_id,
        agentId: 'sales-customer-manager',
        toolId: 'get_sales',
        input: { sku }
      });
      return {
        output: call.result,
        toolResults: [{ toolId: 'get_sales', result: call.result }]
      };
    }
  });
  input.context = salesHandoff.context;
  const soldUnits = (salesHandoff.output as { soldUnits: number }).soldUnits;
  input.context.summary = JSON.stringify({
    goal: input.context.goal,
    inputs: input.context.inputs,
    outputs: input.context.outputs,
    agents: input.context.decisions.map(decision => decision.agent_id),
    tools: input.context.tool_results.map(result => result.tool_id)
  }).slice(0, 6_000);
  Object.assign(originalContext, input.context);
  return {
    inventory: inventoryHandoff.output,
    soldUnits,
    handoffs: ['supply-chain-finance-manager', 'sales-customer-manager'],
    toolResults: input.context.tool_results.map(({ tool_id, result }) => ({ toolId: tool_id, result }))
  };
}

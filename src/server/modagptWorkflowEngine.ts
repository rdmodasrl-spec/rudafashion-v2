import {
  createModaGptExecutionPlan,
  executeModaGptPlanWithVerification,
  replanModaGptPlan,
  type ModaGptExecutionPlan,
  type ModaGptOrchestrationResult,
  type ModaGptVerification
} from './modagptOrchestration';

export type ModaGptWorkflowDefinition<TInput, TResult, TContext> = {
  id: string;
  version: string;
  steps: readonly string[];
  constraints: readonly string[];
  maxReplans: number;
  timeoutMs: number;
  validateInput: (input: unknown) => input is TInput;
  goal: (input: TInput) => string;
  execute: (
    context: TContext,
    input: TInput,
    plan: ModaGptExecutionPlan,
    signal: AbortSignal
  ) => Promise<TResult>;
  verify: (
    result: TResult,
    input: TInput,
    plan: ModaGptExecutionPlan
  ) => ModaGptVerification;
  replan?: (
    plan: ModaGptExecutionPlan,
    verification: ModaGptVerification,
    replanNumber: number
  ) => ModaGptExecutionPlan;
};

export type ModaGptWorkflowTask = {
  taskId: string;
  tenantId: string;
  workflow: string;
};

export class ModaGptWorkflowEngine<TContext> {
  private readonly definitions = new Map<string, ModaGptWorkflowDefinition<never, never, TContext>>();

  register<TInput, TResult>(definition: ModaGptWorkflowDefinition<TInput, TResult, TContext>): void {
    if (
      !/^[a-z][a-z0-9_]{1,79}$/.test(definition.id)
      || !/^\d+\.\d+\.\d+$/.test(definition.version)
      || this.definitions.has(definition.id)
      || !Number.isInteger(definition.timeoutMs)
      || definition.timeoutMs < 100
      || definition.timeoutMs > 120_000
      || !Number.isInteger(definition.maxReplans)
      || definition.maxReplans < 0
      || definition.maxReplans > 2
      || !definition.steps.length
      || definition.steps.length > 8
    ) throw new Error('MODAGPT_WORKFLOW_DEFINITION_INVALID');
    this.definitions.set(
      definition.id,
      definition as ModaGptWorkflowDefinition<never, never, TContext>
    );
  }

  has(workflow: string): boolean {
    return this.definitions.has(workflow);
  }

  async execute<TInput, TResult>(input: {
    task: ModaGptWorkflowTask;
    payload: unknown;
    context: TContext;
    signal?: AbortSignal;
  }): Promise<ModaGptOrchestrationResult<TResult>> {
    const definition = this.definitions.get(input.task.workflow) as
      | ModaGptWorkflowDefinition<TInput, TResult, TContext>
      | undefined;
    if (!definition) throw new Error('MODAGPT_WORKFLOW_NOT_REGISTERED');
    if (input.task.tenantId.trim() === '' || !definition.validateInput(input.payload)) {
      throw new Error('MODAGPT_WORKFLOW_INPUT_INVALID');
    }
    const workflowInput = input.payload;
    const plan = createModaGptExecutionPlan({
      taskId: input.task.taskId,
      tenantId: input.task.tenantId,
      workflow: definition.id,
      goal: definition.goal(workflowInput),
      steps: definition.steps,
      constraints: definition.constraints,
      maxReplans: definition.maxReplans
    });
    return executeModaGptPlanWithVerification({
      plan,
      timeoutMs: definition.timeoutMs,
      execute: (executionPlan, signal) =>
        definition.execute(input.context, workflowInput, executionPlan, signal),
      verify: (result, executionPlan) => definition.verify(result, workflowInput, executionPlan),
      replan: definition.replan || replanModaGptPlan,
      signal: input.signal
    }) as Promise<ModaGptOrchestrationResult<TResult>>;
  }
}

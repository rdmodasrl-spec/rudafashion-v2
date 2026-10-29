export type AiEmployeeInferenceMetric = {
  attempts: number;
  failures: number;
  failureRate: number;
  averageDurationMs: number;
  lastDurationMs: number;
  lastSucceeded: boolean;
};

export type AiEmployeeInferenceOperation =
  | 'reasoning:ollama'
  | 'reasoning:deepseek'
  | 'reasoning:openai'
  | 'advanced-reasoning:openai'
  | 'vision:ollama'
  | 'vision:gemini'
  | 'creative:fal'
  | 'creative:fal_tryon'
  | 'probe:reasoning:ollama'
  | 'probe:vision:ollama';

const metrics = new Map<string, {
  attempts: number;
  failures: number;
  totalDurationMs: number;
  lastDurationMs: number;
  lastSucceeded: boolean;
}>();

export function recordAiEmployeeInference(
  operation: AiEmployeeInferenceOperation,
  durationMs: number,
  succeeded: boolean
): void {
  const current = metrics.get(operation) || {
    attempts: 0,
    failures: 0,
    totalDurationMs: 0,
    lastDurationMs: 0,
    lastSucceeded: false
  };
  current.attempts += 1;
  if (!succeeded) current.failures += 1;
  current.totalDurationMs += Math.max(0, durationMs);
  current.lastDurationMs = Math.max(0, Math.round(durationMs));
  current.lastSucceeded = succeeded;
  metrics.set(operation, current);
}

export async function measureAiEmployeeInference<T>(
  operation: AiEmployeeInferenceOperation,
  action: () => Promise<T>
): Promise<T> {
  const startedAt = performance.now();
  try {
    const result = await action();
    recordAiEmployeeInference(operation, performance.now() - startedAt, true);
    return result;
  } catch (error) {
    recordAiEmployeeInference(operation, performance.now() - startedAt, false);
    throw error;
  }
}

export function getAiEmployeeInferenceMetrics(): Record<string, AiEmployeeInferenceMetric> {
  return Object.fromEntries([...metrics.entries()].map(([operation, metric]) => [
    operation,
    {
      attempts: metric.attempts,
      failures: metric.failures,
      failureRate: metric.attempts ? metric.failures / metric.attempts : 0,
      averageDurationMs: metric.attempts
        ? Math.round(metric.totalDurationMs / metric.attempts)
        : 0,
      lastDurationMs: metric.lastDurationMs,
      lastSucceeded: metric.lastSucceeded
    }
  ]));
}

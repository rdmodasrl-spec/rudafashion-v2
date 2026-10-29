export type AiProviderMode = 'ollama' | 'deepseek' | 'openai' | 'gemini' | 'automatic1111' | 'fal';

export type AiProviderEntry = {
  provider: AiProviderMode;
  model: string;
  fallbackToLocal: boolean;
};

export type AiProviderSettings = {
  deepseekApiKeyConfigured: boolean;
  falApiKeyConfigured: boolean;
  openaiApiKeyConfigured: boolean;
  geminiApiKeyConfigured: boolean;
  reasoning: AiProviderEntry;
  advancedReasoning: AiProviderEntry;
  vision: AiProviderEntry;
  image: AiProviderEntry;
};

export type AiProviderCircuitSnapshot = {
  state: 'closed' | 'open' | 'half_open';
  consecutiveFailures: number;
  retryAfterMs: number;
};

export type AiProviderInferenceMetric = {
  attempts: number;
  failures: number;
  failureRate: number;
  averageDurationMs: number;
  lastDurationMs: number;
  lastSucceeded: boolean;
};

const inferenceMetricLabels: Record<string, string> = {
  'reasoning:ollama': '本地文字推理',
  'reasoning:deepseek': 'DeepSeek 文字推理',
  'reasoning:openai': 'OpenAI 主推理',
  'advanced-reasoning:openai': 'OpenAI Agent 规划',
  'vision:ollama': '本地视觉理解',
  'vision:gemini': 'Gemini 视觉理解',
  'creative:fal': 'Fal 图片生成',
  'creative:fal_tryon': 'Fal 虚拟试穿',
  'probe:reasoning:ollama': '本地文字模型自检',
  'probe:vision:ollama': '本地视觉模型自检'
};

const circuitLabels: Record<string, string> = {
  reasoning_deepseek: 'DeepSeek 日常推理',
  reasoning_openai: 'OpenAI 主推理',
  advanced_openai: 'OpenAI Agent 规划',
  vision_gemini: 'Gemini 商品视觉',
  creative_fal: 'Fal 图片生成',
  creative_fal_tryon: 'Fal 虚拟试穿'
};

const providerOptions: Record<keyof Pick<AiProviderSettings, 'reasoning' | 'advancedReasoning' | 'vision' | 'image'>, AiProviderMode[]> = {
  reasoning: ['ollama', 'deepseek'],
  advancedReasoning: ['openai'],
  vision: ['ollama', 'gemini'],
  image: ['automatic1111', 'fal']
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function parseAiProviderCircuitSnapshots(value: unknown): Record<string, AiProviderCircuitSnapshot> | null {
  if (!isRecord(value)) return null;
  const snapshots: Record<string, AiProviderCircuitSnapshot> = {};
  for (const [key, snapshot] of Object.entries(value)) {
    if (!Object.hasOwn(circuitLabels, key)) continue;
    if (
      !isRecord(snapshot)
      || !['closed', 'open', 'half_open'].includes(String(snapshot.state))
      || !Number.isInteger(snapshot.consecutiveFailures)
      || (snapshot.consecutiveFailures as number) < 0
      || typeof snapshot.retryAfterMs !== 'number'
      || !Number.isFinite(snapshot.retryAfterMs)
      || snapshot.retryAfterMs < 0
    ) return null;
    snapshots[key] = {
      state: snapshot.state as AiProviderCircuitSnapshot['state'],
      consecutiveFailures: snapshot.consecutiveFailures as number,
      retryAfterMs: snapshot.retryAfterMs
    };
  }
  return snapshots;
}

export function getAiProviderCircuitLabel(key: string): string {
  return circuitLabels[key] || '未知模型线路';
}

export function parseAiProviderInferenceMetrics(value: unknown): Record<string, AiProviderInferenceMetric> | null {
  if (!isRecord(value)) return null;
  const metrics: Record<string, AiProviderInferenceMetric> = {};
  for (const [key, metric] of Object.entries(value)) {
    if (!Object.hasOwn(inferenceMetricLabels, key)) continue;
    if (
      !isRecord(metric)
      || !Number.isInteger(metric.attempts)
      || (metric.attempts as number) < 0
      || !Number.isInteger(metric.failures)
      || (metric.failures as number) < 0
      || (metric.failures as number) > (metric.attempts as number)
      || typeof metric.failureRate !== 'number'
      || !Number.isFinite(metric.failureRate)
      || metric.failureRate < 0
      || metric.failureRate > 1
      || typeof metric.averageDurationMs !== 'number'
      || !Number.isFinite(metric.averageDurationMs)
      || metric.averageDurationMs < 0
      || typeof metric.lastDurationMs !== 'number'
      || !Number.isFinite(metric.lastDurationMs)
      || metric.lastDurationMs < 0
      || typeof metric.lastSucceeded !== 'boolean'
    ) return null;
    metrics[key] = {
      attempts: metric.attempts as number,
      failures: metric.failures as number,
      failureRate: metric.failureRate,
      averageDurationMs: metric.averageDurationMs,
      lastDurationMs: metric.lastDurationMs,
      lastSucceeded: metric.lastSucceeded
    };
  }
  return metrics;
}

export function getAiProviderInferenceMetricLabel(key: string): string {
  return inferenceMetricLabels[key] || '未知推理任务';
}

export function parseAiProviderSettings(value: unknown): AiProviderSettings | null {
  if (!isRecord(value)) return null;
  const configuredFlags = [
    'deepseekApiKeyConfigured',
    'falApiKeyConfigured',
    'openaiApiKeyConfigured',
    'geminiApiKeyConfigured'
  ] as const;
  if (configuredFlags.some(key => typeof value[key] !== 'boolean')) return null;

  const entries = {} as Pick<AiProviderSettings, 'reasoning' | 'advancedReasoning' | 'vision' | 'image'>;
  for (const role of Object.keys(providerOptions) as Array<keyof typeof providerOptions>) {
    const entry = value[role];
    if (
      !isRecord(entry)
      || typeof entry.provider !== 'string'
      || !providerOptions[role].includes(entry.provider as AiProviderMode)
      || typeof entry.model !== 'string'
      || !entry.model.trim()
      || entry.model.length > 120
      || typeof entry.fallbackToLocal !== 'boolean'
    ) return null;
    entries[role] = {
      provider: entry.provider as AiProviderMode,
      model: entry.model,
      fallbackToLocal: entry.fallbackToLocal
    };
  }

  return {
    deepseekApiKeyConfigured: value.deepseekApiKeyConfigured as boolean,
    falApiKeyConfigured: value.falApiKeyConfigured as boolean,
    openaiApiKeyConfigured: value.openaiApiKeyConfigured as boolean,
    geminiApiKeyConfigured: value.geminiApiKeyConfigured as boolean,
    ...entries
  };
}

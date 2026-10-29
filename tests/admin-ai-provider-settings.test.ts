import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getAiProviderCircuitLabel,
  getAiProviderInferenceMetricLabel,
  parseAiProviderCircuitSnapshots,
  parseAiProviderInferenceMetrics,
  parseAiProviderSettings
} from '../src/apps/platform-admin-common/components/admin/aiProviderSettings';

const validSettings = {
  deepseekApiKeyConfigured: true,
  falApiKeyConfigured: false,
  openaiApiKeyConfigured: false,
  geminiApiKeyConfigured: false,
  reasoning: { provider: 'deepseek', model: 'deepseek-flash', fallbackToLocal: true },
  advancedReasoning: { provider: 'openai', model: 'gpt-4.1-mini', fallbackToLocal: true },
  vision: { provider: 'ollama', model: 'llava:latest', fallbackToLocal: true },
  image: { provider: 'automatic1111', model: 'local-stable-diffusion', fallbackToLocal: false }
};

test('parses complete public AI provider settings without adding credentials', () => {
  const settings = parseAiProviderSettings(validSettings);

  assert.deepEqual(settings, validSettings);
  assert.equal(JSON.stringify(settings).includes('apiKey'), false);
});

test('rejects incomplete and invalid provider settings instead of exposing a render-time crash', () => {
  const { advancedReasoning: _advancedReasoning, ...legacySettings } = validSettings;

  assert.equal(parseAiProviderSettings(legacySettings), null);
  assert.equal(parseAiProviderSettings({ ...validSettings, vision: undefined }), null);
  assert.equal(parseAiProviderSettings({
    ...validSettings,
    reasoning: { ...validSettings.reasoning, provider: 'gemini' }
  }), null);
  assert.equal(parseAiProviderSettings({ ...validSettings, image: { ...validSettings.image, model: '' } }), null);
  assert.equal(parseAiProviderSettings(null), null);
});

test('parses provider circuit states and ignores unknown circuit keys', () => {
  assert.deepEqual(parseAiProviderCircuitSnapshots({
    reasoning_deepseek: { state: 'open', consecutiveFailures: 3, retryAfterMs: 12_500 },
    vision_gemini: { state: 'half_open', consecutiveFailures: 3, retryAfterMs: 0 },
    unknown_provider: { state: 'closed', consecutiveFailures: 0, retryAfterMs: 0 }
  }), {
    reasoning_deepseek: { state: 'open', consecutiveFailures: 3, retryAfterMs: 12_500 },
    vision_gemini: { state: 'half_open', consecutiveFailures: 3, retryAfterMs: 0 }
  });
  assert.equal(getAiProviderCircuitLabel('reasoning_deepseek'), 'DeepSeek 日常推理');
  assert.equal(getAiProviderCircuitLabel('unknown_provider'), '未知模型线路');
  assert.deepEqual(parseAiProviderCircuitSnapshots({}), {});
});

test('rejects malformed provider circuit snapshots', () => {
  assert.equal(parseAiProviderCircuitSnapshots(null), null);
  assert.equal(parseAiProviderCircuitSnapshots({
    reasoning_deepseek: { state: 'degraded', consecutiveFailures: 1, retryAfterMs: 0 }
  }), null);
  assert.equal(parseAiProviderCircuitSnapshots({
    reasoning_deepseek: { state: 'closed', consecutiveFailures: -1, retryAfterMs: 0 }
  }), null);
  assert.equal(parseAiProviderCircuitSnapshots({
    reasoning_deepseek: { state: 'closed', consecutiveFailures: 0, retryAfterMs: Number.NaN }
  }), null);
});

test('parses inference aggregates and ignores unknown metric names', () => {
  assert.deepEqual(parseAiProviderInferenceMetrics({
    'reasoning:deepseek': {
      attempts: 4,
      failures: 1,
      failureRate: 0.25,
      averageDurationMs: 780,
      lastDurationMs: 900,
      lastSucceeded: true
    },
    'creative:fal': {
      attempts: 2,
      failures: 1,
      failureRate: 0.5,
      averageDurationMs: 1200,
      lastDurationMs: 1500,
      lastSucceeded: false
    },
    'vision:gemini': {
      attempts: 0,
      failures: 0,
      failureRate: 0,
      averageDurationMs: 0,
      lastDurationMs: 0,
      lastSucceeded: false
    },
    unknown_metric: { unsafe: true }
  }), {
    'reasoning:deepseek': {
      attempts: 4,
      failures: 1,
      failureRate: 0.25,
      averageDurationMs: 780,
      lastDurationMs: 900,
      lastSucceeded: true
    },
    'creative:fal': {
      attempts: 2,
      failures: 1,
      failureRate: 0.5,
      averageDurationMs: 1200,
      lastDurationMs: 1500,
      lastSucceeded: false
    },
    'vision:gemini': {
      attempts: 0,
      failures: 0,
      failureRate: 0,
      averageDurationMs: 0,
      lastDurationMs: 0,
      lastSucceeded: false
    }
  });
  assert.equal(getAiProviderInferenceMetricLabel('reasoning:deepseek'), 'DeepSeek 文字推理');
  assert.equal(getAiProviderInferenceMetricLabel('creative:fal_tryon'), 'Fal 虚拟试穿');
  assert.equal(getAiProviderInferenceMetricLabel('unknown_metric'), '未知推理任务');
  assert.deepEqual(parseAiProviderInferenceMetrics({}), {});
});

test('rejects malformed inference aggregates rather than displaying misleading health data', () => {
  assert.equal(parseAiProviderInferenceMetrics(null), null);
  assert.equal(parseAiProviderInferenceMetrics({
    'reasoning:deepseek': {
      attempts: 1,
      failures: 2,
      failureRate: 2,
      averageDurationMs: 10,
      lastDurationMs: 10,
      lastSucceeded: false
    }
  }), null);
  assert.equal(parseAiProviderInferenceMetrics({
    'reasoning:deepseek': {
      attempts: 1,
      failures: 0,
      failureRate: 0,
      averageDurationMs: -1,
      lastDurationMs: 10,
      lastSucceeded: true
    }
  }), null);
});

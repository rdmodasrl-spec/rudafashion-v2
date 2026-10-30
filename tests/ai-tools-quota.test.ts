import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AI_TOOL_QUOTA_DEFAULTS,
  AI_TOOL_USAGE_FEATURE,
  buildAiToolUsageIdempotencyKey,
  buildAiToolUsageRecord,
  evaluateAiToolQuota,
  getAiToolUsageWindows,
  parseAiToolQuotaLimits
} from '../src/server/aiToolQuota';
import {
  resolveAiToolCenters,
  resolveAiToolEngines
} from '../src/server/aiToolCapabilities';

test('AI 工具额度：默认值随套餐递增，免费额度不为 0', () => {
  const plans = Object.keys(AI_TOOL_QUOTA_DEFAULTS) as Array<keyof typeof AI_TOOL_QUOTA_DEFAULTS>;
  for (const plan of plans) {
    assert.ok(AI_TOOL_QUOTA_DEFAULTS[plan].dailyCalls > 0, `${plan} 日额度必须大于 0`);
    assert.ok(AI_TOOL_QUOTA_DEFAULTS[plan].monthlyCalls >= AI_TOOL_QUOTA_DEFAULTS[plan].dailyCalls);
  }
  assert.ok(AI_TOOL_QUOTA_DEFAULTS.PRO.monthlyCalls > AI_TOOL_QUOTA_DEFAULTS.FREE.monthlyCalls);
});

test('AI 工具额度：运营配置可覆盖默认值，坏配置整体回退', () => {
  assert.deepEqual(
    parseAiToolQuotaLimits(JSON.stringify({ dailyCalls: 5, monthlyCalls: 50 }), 'FREE'),
    { dailyCalls: 5, monthlyCalls: 50 }
  );
  assert.deepEqual(parseAiToolQuotaLimits('not-json', 'FREE'), AI_TOOL_QUOTA_DEFAULTS.FREE);
  assert.deepEqual(
    parseAiToolQuotaLimits(JSON.stringify({ dailyCalls: 0, monthlyCalls: -3 }), 'FREE'),
    AI_TOOL_QUOTA_DEFAULTS.FREE
  );
  assert.deepEqual(parseAiToolQuotaLimits(null, 'FREE'), AI_TOOL_QUOTA_DEFAULTS.FREE);
});

test('AI 工具额度：日额度与月额度分别拦截，并返回真实原因', () => {
  const limits = { dailyCalls: 3, monthlyCalls: 10 };
  assert.deepEqual(
    evaluateAiToolQuota({ planId: 'FREE', limits, used: { daily: 1, monthly: 1 } }),
    { allowed: true, reason: null, remaining: { daily: 2, monthly: 9 } }
  );
  const dailyBlocked = evaluateAiToolQuota({ planId: 'FREE', limits, used: { daily: 3, monthly: 3 } });
  assert.equal(dailyBlocked.allowed, false);
  assert.equal(dailyBlocked.reason, 'quota_exceeded_daily');
  assert.equal(dailyBlocked.remaining.daily, 0);

  const monthlyBlocked = evaluateAiToolQuota({ planId: 'FREE', limits, used: { daily: 0, monthly: 10 } });
  assert.equal(monthlyBlocked.allowed, false);
  assert.equal(monthlyBlocked.reason, 'quota_exceeded_monthly');
});

test('AI 工具额度：周期窗口按 UTC 自然日与自然月计算', () => {
  const { dayStart, monthStart } = getAiToolUsageWindows(new Date('2026-10-30T18:45:12.000Z'));
  assert.equal(dayStart.toISOString(), '2026-10-30T00:00:00.000Z');
  assert.equal(monthStart.toISOString(), '2026-10-01T00:00:00.000Z');
});

test('AI 工具用量：幂等键按任务维度生成，不会重复计数', () => {
  const key = buildAiToolUsageIdempotencyKey({ merchantId: 'm1', taskId: 'ai-tools:abc' });
  assert.equal(key, `${AI_TOOL_USAGE_FEATURE}:m1:ai-tools:abc`);
  assert.ok(key.length <= 180);
  const record = buildAiToolUsageRecord({
    merchantId: 'm1',
    planId: 'FREE',
    toolId: 'ai_tools_write_copy',
    taskId: 'ai-tools:abc',
    credits: -5,
    latencyMs: 1200,
    status: 'succeeded'
  });
  assert.equal(record.feature, 'ai.tools');
  assert.equal(record.model, 'ai_tools_write_copy');
  assert.equal(record.credits, 0, '未接通计费时不得写入负数或虚构额度');
  assert.equal(record.idempotencyKey, key);
  assert.equal(record.status, 'succeeded');
});

test('AI 工具能力真值：未接通的中心一律 not_connected 且没有可调用工具', () => {
  const centers = resolveAiToolCenters(
    { textReady: true, imageReady: false },
    ['ai_tools_write_copy', 'ai_tools_translate']
  );
  const byId = new Map(centers.map(center => [center.id, center]));
  assert.equal(byId.get('copywriting')?.status, 'ready');
  assert.deepEqual(byId.get('copywriting')?.toolIds, ['ai_tools_write_copy', 'ai_tools_translate']);
  for (const id of ['image', 'video', 'voice', 'publish', 'analytics'] as const) {
    assert.equal(byId.get(id)?.status, 'not_connected', `${id} 不得冒充已接通`);
    assert.deepEqual(byId.get(id)?.toolIds, []);
    assert.ok(byId.get(id)?.reason);
  }
});

test('AI 工具能力真值：未安装应用时文本中心也不可用', () => {
  const centers = resolveAiToolCenters({ textReady: true, imageReady: true }, []);
  const copywriting = centers.find(center => center.id === 'copywriting');
  assert.equal(copywriting?.status, 'not_connected');
  assert.deepEqual(copywriting?.toolIds, []);
});

test('AI 工具引擎判定：只有真实凭据才算就绪', () => {
  assert.deepEqual(
    resolveAiToolEngines({
      textProvider: { provider: 'ollama', model: 'qwen2.5:7b', apiKey: '', fallbackToLocal: true },
      imageProvider: { provider: 'automatic1111', model: 'local-stable-diffusion', apiKey: '', fallbackToLocal: false }
    }),
    { textReady: true, imageReady: false, videoReady: false, voiceReady: false, publishReady: false, analyticsReady: false }
  );
  assert.equal(
    resolveAiToolEngines({
      textProvider: { provider: 'openai', model: 'gpt-4.1-mini', apiKey: '', fallbackToLocal: false },
      imageProvider: { provider: 'fal', model: 'fal-ai/flux/schnell', apiKey: 'key', fallbackToLocal: false }
    }).textReady,
    false,
    '远端文本 provider 没有 Key 时不得判定为就绪'
  );
  assert.equal(
    resolveAiToolEngines({
      textProvider: { provider: 'ollama', model: 'qwen2.5:7b', apiKey: '', fallbackToLocal: true },
      imageProvider: { provider: 'fal', model: 'fal-ai/flux/schnell', apiKey: 'key', fallbackToLocal: false }
    }).imageReady,
    true
  );
});

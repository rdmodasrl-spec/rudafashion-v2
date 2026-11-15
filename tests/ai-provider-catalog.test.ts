import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AI_PROVIDER_CAPABILITIES,
  applyAiProviderCatalogOverride,
  createDefaultAiProviderCatalog,
  findAiProviderModel,
  parseAiModelPricing,
  resolveAiProviderModel,
  summarizeAiProviderCatalog
} from '../src/server/aiProviderCatalog';

const catalog = createDefaultAiProviderCatalog();

test('供应商目录：模型 ID 使用官方当前名称，且目录内不出现任何密钥值', () => {
  const ids = catalog.models.map(model => model.modelId);
  assert.ok(ids.includes('deepseek-flash'));
  assert.ok(ids.includes('deepseek-v4-pro'));
  // 已废弃/不存在的模型名不得出现在目录里。
  assert.ok(!ids.some(id => id.includes('deepseek-chat') || id.includes('deepseek-reasoner')));
  assert.ok(!ids.some(id => id.includes('gpt-4o-mini-transcribe')));
  const serialized = JSON.stringify(catalog);
  assert.ok(!/sk-[A-Za-z0-9]/.test(serialized));
});

test('供应商目录：每个模型能力标签合法、超时与重试参数在合理范围', () => {
  for (const model of catalog.models) {
    assert.ok(model.capabilities.length > 0, `${model.modelId} 必须声明能力`);
    for (const capability of model.capabilities) {
      assert.ok(AI_PROVIDER_CAPABILITIES.includes(capability), `${model.modelId} 能力非法: ${capability}`);
    }
    assert.ok(model.timeoutMs >= 1_000 && model.timeoutMs <= 600_000);
    assert.ok(model.retry.maxAttempts >= 1 && model.retry.maxAttempts <= 5);
  }
});

test('供应商目录：DeepSeek Flash 支持图片理解与工具调用，Pro 不支持图片输入', () => {
  const flash = findAiProviderModel(catalog, 'deepseek-flash');
  const pro = findAiProviderModel(catalog, 'deepseek-v4-pro');
  assert.ok(flash && pro);
  assert.ok(flash.capabilities.includes('vision'));
  assert.ok(flash.capabilities.includes('tool_call'));
  assert.ok(flash.capabilities.includes('json'));
  assert.ok(!pro.capabilities.includes('vision'));
  assert.ok(pro.capabilities.includes('reasoning'));
});

test('自动路由：按能力与档位选择，未配置凭据的模型不会被选中', () => {
  const economy = resolveAiProviderModel({
    catalog,
    capability: 'text',
    availableCredentials: ['DEEPSEEK_API_KEY']
  });
  assert.equal(economy.ok, true);
  assert.equal(economy.ok && economy.model.modelId, 'deepseek-flash');

  const pro = resolveAiProviderModel({
    catalog,
    capability: 'reasoning',
    tier: 'pro',
    availableCredentials: ['DEEPSEEK_API_KEY']
  });
  assert.equal(pro.ok && pro.model.modelId, 'deepseek-v4-pro');

  const noKey = resolveAiProviderModel({ catalog, capability: 'video_generate', availableCredentials: [] });
  assert.deepEqual(noKey, { ok: false, reason: 'no_credential_configured' });

  const noCapability = resolveAiProviderModel({ catalog, capability: 'tts', availableCredentials: [] });
  assert.deepEqual(noCapability, { ok: false, reason: 'no_credential_configured' });
});

test('自动路由：数据合规分级生效，免费层不得用于商家私密素材', () => {
  const privateOnly = resolveAiProviderModel({
    catalog,
    capability: 'asr',
    availableCredentials: [],
    allowedDataPolicies: ['self_hosted']
  });
  assert.equal(privateOnly.ok, true);
  assert.equal(privateOnly.ok && privateOnly.model.modelId, 'faster-whisper-local');

  const commercialOnly = resolveAiProviderModel({
    catalog,
    capability: 'asr',
    allowedDataPolicies: ['commercial_paid'],
    availableCredentials: ['OPENAI_API_KEY']
  });
  assert.equal(commercialOnly.ok, true);
  assert.equal(commercialOnly.ok && commercialOnly.model.modelId, 'gpt-transcribe');
});

test('价格覆盖：合法覆盖生效，非法价格整体拒绝并保留原值', () => {
  const applied = applyAiProviderCatalogOverride(catalog, {
    version: 'test-1',
    models: [
      { modelId: 'deepseek-flash', pricing: { kind: 'token', offPeak: { cacheHitInput: 0.01, cacheMissInput: 0.2, output: 0.8 }, peak: { cacheHitInput: 0.02, cacheMissInput: 0.4, output: 1.6 } } },
      { modelId: 'runway-unknown', pricing: { kind: 'video', perSecondUsd: { '720p': 1 } } }
    ]
  });
  assert.equal(applied.ok, true);
  if (!applied.ok) return;
  assert.equal(applied.applied, 1);
  assert.ok(applied.issues.includes('models[1]:MODEL_UNKNOWN'));
  const updated = findAiProviderModel(applied.catalog, 'deepseek-flash');
  assert.ok(updated && updated.pricing.kind === 'token' && updated.pricing.peak?.output === 1.6);

  const rejected = applyAiProviderCatalogOverride(catalog, {
    models: [{ modelId: 'deepseek-flash', pricing: { kind: 'token', offPeak: { cacheHitInput: -1, cacheMissInput: 1, output: 1 } } }]
  });
  assert.equal(rejected.ok, true);
  if (!rejected.ok) return;
  assert.equal(rejected.applied, 0);
  assert.ok(rejected.issues.includes('models[0]:PRICING_INVALID'));
  const untouched = findAiProviderModel(rejected.catalog, 'deepseek-flash');
  assert.ok(untouched && untouched.pricing.kind === 'token' && untouched.pricing.offPeak.output === 0.6);

  assert.equal(applyAiProviderCatalogOverride(catalog, '{bad json').ok, false);
  assert.equal(applyAiProviderCatalogOverride(catalog, { models: 'nope' }).ok, false);
  assert.equal(applyAiProviderCatalogOverride(catalog, '').ok, true);
});

test('价格解析：未知类型与缺字段返回 null，不产生半套价格', () => {
  assert.equal(parseAiModelPricing({ kind: 'magic' }), null);
  assert.equal(parseAiModelPricing({ kind: 'image', perImageUsd: {} }), null);
  assert.equal(parseAiModelPricing({ kind: 'video', perSecondUsd: { '720p': -0.1 } }), null);
  assert.deepEqual(parseAiModelPricing({ kind: 'tts', perMillionCharsUsd: 4 }), { kind: 'tts', perMillionCharsUsd: 4 });
});

test('后台摘要：只暴露模型与价格类型，不包含凭据值', () => {
  const summary = summarizeAiProviderCatalog(catalog);
  assert.equal(summary.models.length, catalog.models.length);
  const deepseek = summary.models.find(model => model.modelId === 'deepseek-flash');
  assert.ok(deepseek);
  assert.deepEqual(deepseek && deepseek.credentials, ['DEEPSEEK_API_KEY']);
  assert.ok(!JSON.stringify(summary).includes('Bearer'));
});

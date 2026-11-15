import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_AI_PRICING_WINDOWS,
  buildAiUsageCostFields,
  estimateAiProviderCost,
  resolveAiPricingPeriod
} from '../src/server/aiProviderPricing';
import { createDefaultAiProviderCatalog, findAiProviderModel, type AiProviderModel } from '../src/server/aiProviderCatalog';

const catalog = createDefaultAiProviderCatalog();

function model(modelId: string): AiProviderModel {
  const found = findAiProviderModel(catalog, modelId);
  assert.ok(found, `缺少模型 ${modelId}`);
  return found;
}

/** 非高峰时刻：UTC 18:00（北京时间 02:00）。 */
const OFF_PEAK = new Date('2026-10-30T18:00:00.000Z');
/** 高峰时刻：UTC 10:00。 */
const PEAK = new Date('2026-10-30T10:00:00.000Z');

test('峰谷时段：DeepSeek 优惠窗口跨零点识别正确（UTC 16:30–00:30）', () => {
  assert.equal(resolveAiPricingPeriod(new Date('2026-10-30T16:29:00.000Z')), 'peak');
  assert.equal(resolveAiPricingPeriod(new Date('2026-10-30T16:30:00.000Z')), 'off_peak');
  assert.equal(resolveAiPricingPeriod(new Date('2026-10-30T23:59:00.000Z')), 'off_peak');
  assert.equal(resolveAiPricingPeriod(new Date('2026-10-30T00:29:00.000Z')), 'off_peak');
  assert.equal(resolveAiPricingPeriod(new Date('2026-10-30T00:30:00.000Z')), 'peak');
  assert.equal(resolveAiPricingPeriod(new Date('2026-10-30T10:00:00.000Z')), 'peak');
});

test('峰谷时段：窗口可运营覆盖，空窗口视为全高峰', () => {
  assert.equal(resolveAiPricingPeriod(OFF_PEAK, []), 'peak');
  assert.equal(
    resolveAiPricingPeriod(new Date('2026-10-30T03:00:00.000Z'), [
      { id: 'custom', offPeakStartMinuteUtc: 60, offPeakEndMinuteUtc: 240 }
    ]),
    'off_peak'
  );
});

test('DeepSeek Flash：非高峰按缓存命中/未命中/输出三档分别计价', () => {
  const estimate = estimateAiProviderCost({
    model: model('deepseek-flash'),
    usage: { kind: 'token', inputCacheHitTokens: 1_000_000, inputCacheMissTokens: 1_000_000, outputTokens: 1_000_000 },
    now: OFF_PEAK
  });
  assert.equal(estimate.ok, true);
  if (!estimate.ok) return;
  assert.equal(estimate.period, 'off_peak');
  // 0.003 + 0.15 + 0.60 = 0.753 USD
  assert.equal(estimate.usdMicro, 753_000);
  assert.equal(estimate.cents, 76);
  assert.equal(estimate.breakdown.length, 3);
});

test('DeepSeek V4 Pro：非高峰输出价 $1.98/百万 Token 正确核算', () => {
  const estimate = estimateAiProviderCost({
    model: model('deepseek-v4-pro'),
    usage: { kind: 'token', inputCacheHitTokens: 0, inputCacheMissTokens: 500_000, outputTokens: 200_000 },
    now: OFF_PEAK
  });
  assert.equal(estimate.ok, true);
  if (!estimate.ok) return;
  // 0.5 × 0.66 + 0.2 × 1.98 = 0.33 + 0.396 = 0.726
  assert.equal(estimate.usdMicro, 726_000);
});

test('高峰价未配置时拒绝估算，不允许按非高峰价低估成本', () => {
  const estimate = estimateAiProviderCost({
    model: model('deepseek-flash'),
    usage: { kind: 'token', inputCacheHitTokens: 0, inputCacheMissTokens: 1000, outputTokens: 1000 },
    now: PEAK
  });
  assert.deepEqual(estimate, { ok: false, reason: 'PEAK_RATE_NOT_CONFIGURED' });
  assert.deepEqual(buildAiUsageCostFields(estimate), { actualCostMinor: null, priced: false });
});

test('高峰价配置后按峰价核算', () => {
  const flash = model('deepseek-flash');
  const withPeak: AiProviderModel = {
    ...flash,
    pricing: {
      kind: 'token',
      offPeak: { cacheHitInput: 0.003, cacheMissInput: 0.15, output: 0.6 },
      peak: { cacheHitInput: 0.006, cacheMissInput: 0.3, output: 1.2 }
    }
  };
  const estimate = estimateAiProviderCost({
    model: withPeak,
    usage: { kind: 'token', inputCacheHitTokens: 0, inputCacheMissTokens: 1_000_000, outputTokens: 1_000_000 },
    now: PEAK
  });
  assert.equal(estimate.ok, true);
  if (!estimate.ok) return;
  assert.equal(estimate.period, 'peak');
  assert.equal(estimate.usdMicro, 1_500_000);
});

test('图片：按张数与分辨率计价，未定价分辨率明确报错', () => {
  const lite = model('gemini-3.1-flash-lite-image');
  const three = estimateAiProviderCost({ model: lite, usage: { kind: 'image', count: 3, resolutionKey: '1k' } });
  assert.equal(three.ok, true);
  if (!three.ok) return;
  assert.equal(three.usdMicro, 100_800); // 0.0336 × 3
  assert.equal(three.cents, 11);

  const unknown = estimateAiProviderCost({ model: lite, usage: { kind: 'image', count: 1, resolutionKey: '8k' } });
  assert.deepEqual(unknown, { ok: false, reason: 'RESOLUTION_NOT_PRICED' });
  const zero = estimateAiProviderCost({ model: lite, usage: { kind: 'image', count: 0, resolutionKey: '1k' } });
  assert.deepEqual(zero, { ok: false, reason: 'USAGE_INVALID' });
});

test('视频：按秒数与分辨率计价，720p 经济型 $0.03/秒', () => {
  const grok = model('grok_imagine_1_5_lite');
  const fifteen = estimateAiProviderCost({ model: grok, usage: { kind: 'video', seconds: 15, resolutionKey: '720p' } });
  assert.equal(fifteen.ok, true);
  if (!fifteen.ok) return;
  assert.equal(fifteen.usdMicro, 450_000);
  assert.equal(fifteen.cents, 45);

  const wan = model('wan3');
  const wanEstimate = estimateAiProviderCost({ model: wan, usage: { kind: 'video', seconds: 10, resolutionKey: '480p' } });
  assert.equal(wanEstimate.ok && wanEstimate.usdMicro, 500_000);
});

test('语音与搜索：字符数、分钟数、请求数分别核算', () => {
  const wavenet = estimateAiProviderCost({
    model: model('google-tts-wavenet'),
    usage: { kind: 'tts', characters: 250_000 }
  });
  assert.equal(wavenet.ok && wavenet.usdMicro, 1_000_000); // 0.25M × $4

  const asr = estimateAiProviderCost({ model: model('gpt-transcribe'), usage: { kind: 'asr', minutes: 10 } });
  assert.equal(asr.ok && asr.usdMicro, 45_000); // 10 × 0.0045

  const search = estimateAiProviderCost({ model: model('deepseek-search'), usage: { kind: 'search', requests: 1000 } });
  assert.equal(search.ok && search.usdMicro, 750_000);
});

test('自建算力：compute 类型不产生供应商 API 成本，但显式标记', () => {
  const estimate = estimateAiProviderCost({
    model: model('faster-whisper-local'),
    usage: { kind: 'compute', cpuSeconds: 120 }
  });
  assert.equal(estimate.ok, true);
  if (!estimate.ok) return;
  assert.equal(estimate.computeOnly, true);
  assert.equal(estimate.usdMicro, 0);
  assert.deepEqual(buildAiUsageCostFields(estimate), { actualCostMinor: 0, priced: true });
});

test('计价类型不匹配时明确报错，不硬套其他单价', () => {
  const mismatch = estimateAiProviderCost({
    model: model('deepseek-flash'),
    usage: { kind: 'image', count: 1, resolutionKey: '1k' }
  });
  assert.deepEqual(mismatch, { ok: false, reason: 'PRICING_KIND_MISMATCH' });
});

test('极小金额向上取整到分，真实成本不会被记成 0', () => {
  const tiny = estimateAiProviderCost({
    model: model('deepseek-flash'),
    usage: { kind: 'token', inputCacheHitTokens: 0, inputCacheMissTokens: 100, outputTokens: 100 },
    now: OFF_PEAK
  });
  assert.equal(tiny.ok, true);
  if (!tiny.ok) return;
  assert.ok(tiny.usdMicro > 0);
  assert.equal(tiny.cents, 1);
  assert.deepEqual(buildAiUsageCostFields(tiny), { actualCostMinor: 1, priced: true });
});

test('默认优惠窗口参数合法', () => {
  assert.equal(DEFAULT_AI_PRICING_WINDOWS.length, 1);
  for (const window of DEFAULT_AI_PRICING_WINDOWS) {
    assert.ok(window.offPeakStartMinuteUtc >= 0 && window.offPeakStartMinuteUtc < 1440);
    assert.ok(window.offPeakEndMinuteUtc >= 0 && window.offPeakEndMinuteUtc <= 1440);
  }
});

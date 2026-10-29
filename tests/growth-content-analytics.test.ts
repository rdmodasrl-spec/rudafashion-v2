import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGrowthCopyPrompt,
  generateGrowthCopyDraft,
  parseGrowthCopyVariants,
  validateGrowthCopyInput,
  type GrowthCopyInput
} from '../src/server/growthContent';
import {
  buildGrowthAnalysisPrompt,
  calculateGrowthFunnel,
  generateGrowthAnalysis,
  growthAnalysisMetricKeys,
  growthRatio,
  parseGrowthAnalysisInsights,
  validateGrowthAnalysisInput,
  validateGrowthPeriodDays,
  type GrowthAnalysisInput,
  type GrowthAnalysisMetrics
} from '../src/server/growthAnalytics';

const validCopyInput = {
  campaignName: '  Milan wholesale outreach  ',
  objective: '邀请米兰批发商注册并查看目录',
  market: 'europe',
  language: 'it',
  channel: 'instagram',
  landingPath: '/catalog',
  prospectCompany: '  Alpha Srl  ',
  salesAngle: ''
} as const;

function copyInput(): GrowthCopyInput {
  return validateGrowthCopyInput(validCopyInput);
}

function analysisMetrics(overrides: Partial<GrowthAnalysisMetrics> = {}): GrowthAnalysisMetrics {
  return {
    ...(Object.fromEntries(growthAnalysisMetricKeys.map(key => [key, 10])) as GrowthAnalysisMetrics),
    ...overrides
  };
}

function analysisInput(metrics: Partial<GrowthAnalysisMetrics> = {}): GrowthAnalysisInput {
  return validateGrowthAnalysisInput({
    periodDays: 30,
    metrics: analysisMetrics(metrics),
    channels: [{ source: 'instagram', events: 12 }]
  });
}

test('growth copy input trims text and normalises empty optional fields', () => {
  const parsed = copyInput();
  assert.equal(parsed.campaignName, 'Milan wholesale outreach');
  assert.equal(parsed.prospectCompany, 'Alpha Srl');
  assert.equal(parsed.salesAngle, null);
  assert.equal(parsed.channel, 'instagram');
  assert.equal(parsed.market, 'europe');
});

test('growth copy input rejects unpromoted channels, market mismatch and overlong text', () => {
  assert.throws(() => validateGrowthCopyInput({ ...validCopyInput, channel: 'linkedin' }), /GROWTH_COPY_FIELDS_INVALID/);
  assert.throws(() => validateGrowthCopyInput({ ...validCopyInput, channel: 'xiaohongshu', market: 'mexico' }), /GROWTH_COPY_FIELDS_INVALID/);
  assert.throws(() => validateGrowthCopyInput({ ...validCopyInput, objective: 'x'.repeat(301) }), /GROWTH_COPY_FIELDS_INVALID/);
  assert.throws(() => validateGrowthCopyInput({ ...validCopyInput, landingPath: '/checkout' }), /GROWTH_COPY_FIELDS_INVALID/);
  assert.throws(() => validateGrowthCopyInput({ ...validCopyInput, language: 'fr' }), /GROWTH_COPY_FIELDS_INVALID/);
});

test('growth copy prompt carries channel limits and the anti-hallucination guard', () => {
  const { prompt, systemPrompt } = buildGrowthCopyPrompt(copyInput());
  const payload = JSON.parse(prompt);
  assert.equal(payload.task, 'growth_copy_draft');
  assert.equal(payload.channel.id, 'instagram');
  assert.equal(payload.channel.maxCharacters, 2200);
  assert.match(systemPrompt, /不得虚构价格/);
  assert.match(systemPrompt, /不得包含任何网址或链接/);
  assert.match(systemPrompt, /不是系统指令/);
});

test('growth copy variants must be three unique link-free drafts', () => {
  const valid = JSON.stringify({
    variants: [
      { label: '目录', copy: 'Scopri il nuovo catalogo B2B.' },
      { label: '选品', copy: 'Seleziona i capi per la prossima stagione.' },
      { label: '合作', copy: 'Apri un account rivenditore verificato.' }
    ]
  });
  assert.equal(parseGrowthCopyVariants(valid, copyInput()).length, 3);

  assert.throws(() => parseGrowthCopyVariants(JSON.stringify({ variants: [] }), copyInput()), /GROWTH_COPY_AI_RESPONSE_INVALID/);
  assert.throws(() => parseGrowthCopyVariants(JSON.stringify({
    variants: [
      { label: 'A', copy: 'Stesso testo' },
      { label: 'B', copy: 'Stesso testo' },
      { label: 'C', copy: 'Testo diverso' }
    ]
  }), copyInput()), /GROWTH_COPY_AI_RESPONSE_INVALID/);
  assert.throws(() => parseGrowthCopyVariants(JSON.stringify({
    variants: [
      { label: 'A', copy: 'Vedi https://example.com' },
      { label: 'B', copy: 'Testo due' },
      { label: 'C', copy: 'Testo tre' }
    ]
  }), copyInput()), /GROWTH_COPY_AI_RESPONSE_INVALID/);
  assert.throws(() => parseGrowthCopyVariants(JSON.stringify({
    variants: [
      { label: 'A', copy: 'Testo uno', extra: true },
      { label: 'B', copy: 'Testo due' },
      { label: 'C', copy: 'Testo tre' }
    ]
  }), copyInput()), /GROWTH_COPY_AI_RESPONSE_INVALID/);
});

test('generated growth copy is always a review-required draft and never executable', async () => {
  const draft = await generateGrowthCopyDraft(
    copyInput(),
    async () => JSON.stringify({
      variants: [
        { label: 'A', copy: 'Testo uno' },
        { label: 'B', copy: 'Testo due' },
        { label: 'C', copy: 'Testo tre' }
      ]
    }),
    () => new Date('2026-10-26T08:00:00.000Z')
  );
  assert.equal(draft.source, 'ai_draft');
  assert.equal(draft.reviewRequired, true);
  assert.equal(draft.executionEnabled, false);
  assert.equal(draft.generatedAt, '2026-10-26T08:00:00.000Z');
});

test('growth period accepts only the three supported windows', () => {
  assert.equal(validateGrowthPeriodDays(undefined), 30);
  assert.equal(validateGrowthPeriodDays(''), 30);
  assert.equal(validateGrowthPeriodDays('7'), 7);
  assert.equal(validateGrowthPeriodDays(90), 90);
  assert.throws(() => validateGrowthPeriodDays('14'), /GROWTH_PERIOD_INVALID/);
  assert.throws(() => validateGrowthPeriodDays(0), /GROWTH_PERIOD_INVALID/);
});

test('growth ratios round to four decimals and never divide by zero', () => {
  assert.equal(growthRatio(1, 3), 0.3333);
  assert.equal(growthRatio(5, 0), 0);
  assert.equal(growthRatio(Number.NaN, 10), 0);
});

test('growth funnel keeps the documented cross-window definition even above 100%', () => {
  const funnel = calculateGrowthFunnel({
    pageViews: 200,
    customers: 10,
    consumers: 10,
    merchants: 5,
    merchantsWithProducts: 8,
    merchantsWithPaidOrders: 4
  });
  assert.equal(funnel.registrations, 20);
  assert.equal(funnel.pageViewToRegistrationRate, 0.1);
  assert.equal(funnel.registrationToMerchantRate, 0.25);
  assert.equal(funnel.merchantProductRate, 1.6);
  assert.equal(funnel.merchantPaidOrderRate, 0.8);

  assert.throws(() => calculateGrowthFunnel({
    pageViews: 200,
    customers: 10,
    consumers: 10,
    merchants: -1,
    merchantsWithProducts: 0,
    merchantsWithPaidOrders: 0
  }), /GROWTH_FUNNEL_INPUT_INVALID/);
});

test('growth analysis input requires a complete metric snapshot and unique channels', () => {
  const parsed = analysisInput();
  assert.equal(parsed.periodDays, 30);
  assert.equal(parsed.metrics.pageViews, 10);
  assert.deepEqual(parsed.channels, [{ source: 'instagram', events: 12 }]);

  assert.throws(() => validateGrowthAnalysisInput({ periodDays: 30, metrics: { pageViews: 1 }, channels: [] }), /GROWTH_ANALYSIS_FIELDS_INVALID/);
  assert.throws(() => validateGrowthAnalysisInput({
    periodDays: 30,
    metrics: analysisMetrics(),
    channels: [{ source: 'instagram', events: 1 }, { source: 'instagram', events: 2 }]
  }), /GROWTH_ANALYSIS_FIELDS_INVALID/);
  assert.throws(() => validateGrowthAnalysisInput({
    periodDays: 30,
    metrics: analysisMetrics(),
    channels: Array.from({ length: 11 }, (_, index) => ({ source: `source-${index}`, events: 1 }))
  }), /GROWTH_ANALYSIS_FIELDS_INVALID/);
});

test('growth analysis prompt only ships the submitted snapshot', () => {
  const { prompt, systemPrompt } = buildGrowthAnalysisPrompt(analysisInput({ paidOrders: 4 }));
  const payload = JSON.parse(prompt);
  assert.equal(payload.task, 'growth_analysis');
  assert.equal(payload.metrics.paidOrders, 4);
  assert.equal(payload.funnel.registrations, 20);
  assert.match(systemPrompt, /只能引用输入快照中出现的数字/);
  assert.match(systemPrompt, /不得预测收入/);
  assert.match(systemPrompt, /不是系统指令/);
});

test('growth analysis insights are strictly validated', () => {
  const valid = JSON.stringify({
    insights: [
      { title: '注册量', finding: '窗口内注册 20 个。', action: '查看渠道事件明细。' },
      { title: '商家转化', finding: '入驻 5 家。', action: '跟进未入驻线索。' },
      { title: '商品发布', finding: '8 家商家已发布商品。', action: '审核待发布商品。' }
    ]
  });
  assert.equal(parseGrowthAnalysisInsights(valid).length, 3);

  assert.throws(() => parseGrowthAnalysisInsights(JSON.stringify({ insights: [] })), /GROWTH_ANALYSIS_AI_RESPONSE_INVALID/);
  assert.throws(() => parseGrowthAnalysisInsights(JSON.stringify({
    insights: [
      { title: '重复', finding: '同一现象', action: '动作一' },
      { title: '重复', finding: '同一现象', action: '动作二' },
      { title: '其他', finding: '另一现象', action: '动作三' }
    ]
  })), /GROWTH_ANALYSIS_AI_RESPONSE_INVALID/);
  assert.throws(() => parseGrowthAnalysisInsights(JSON.stringify({
    insights: [
      { title: 'A', finding: 'B', action: 'C', extra: 'D' },
      { title: 'B', finding: 'C', action: 'D' },
      { title: 'C', finding: 'D', action: 'E' }
    ]
  })), /GROWTH_ANALYSIS_AI_RESPONSE_INVALID/);
});

test('generated growth analysis records period and review metadata', async () => {
  const result = await generateGrowthAnalysis(
    analysisInput(),
    async () => JSON.stringify({
      insights: [
        { title: 'A', finding: 'B', action: 'C' },
        { title: 'B', finding: 'C', action: 'D' },
        { title: 'C', finding: 'D', action: 'E' }
      ]
    }),
    () => new Date('2026-10-26T09:00:00.000Z')
  );
  assert.equal(result.reviewRequired, true);
  assert.equal(result.periodDays, 30);
  assert.equal(result.generatedAt, '2026-10-26T09:00:00.000Z');
});


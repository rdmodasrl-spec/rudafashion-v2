import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGrowthMissionPlan,
  buildGrowthMissionReviewIdempotencyKey,
  buildGrowthMissionReviewTaskResult,
  generateGrowthMissionStrategy,
  getNextGrowthMissionReviewRound,
  growthMissionReviewStatusesToCancel,
  growthMissionMatchesInput,
  parseGrowthMissionRecommendations,
  readGrowthMissionReviewDecisionMetadata,
  transitionGrowthMissionStatus,
  validateGrowthMissionInput,
  type GrowthMissionInput
} from '../src/server/growthMission';

const validMission = {
  name: 'Europe buyer growth',
  objective: 'Acquire qualified fashion buyers',
  audience: 'Chinese-speaking fashion buyers in Italy and France',
  markets: ['europe'],
  channels: ['facebook', 'instagram', 'google_ads'],
  budgetAmount: 1500,
  budgetCurrency: 'EUR',
  conversionGoal: 'approved buyer registration',
  landingPath: '/register/buyer',
  startAt: '2026-10-05T00:00:00.000Z',
  endAt: '2026-10-31T23:59:59.999Z'
};

test('validates and normalizes a bounded Growth Mission plan input', () => {
  const result = validateGrowthMissionInput({ ...validMission, name: '  Europe buyer growth  ', budgetCurrency: 'eur' });
  assert.equal(result.name, 'Europe buyer growth');
  assert.equal(result.budgetCurrency, 'EUR');
  assert.equal(result.budgetAmount, 1500);
  assert.deepEqual(result.markets, ['europe']);
});

test('rejects unsafe inputs, non-P0 channels, future channels and market mismatches', () => {
  assert.throws(() => validateGrowthMissionInput({ ...validMission, landingPath: '//evil.example' }), {
    message: 'GROWTH_MISSION_INPUT_INVALID'
  });
  assert.throws(() => validateGrowthMissionInput({ ...validMission, channels: ['telegram'] }), {
    message: 'GROWTH_MISSION_INPUT_INVALID'
  });
  assert.throws(() => validateGrowthMissionInput({ ...validMission, markets: ['china'], channels: ['google_ads'] }), {
    message: 'GROWTH_MISSION_CHANNEL_MARKET_MISMATCH'
  });
  assert.throws(() => validateGrowthMissionInput({ ...validMission, endAt: validMission.startAt }), {
    message: 'GROWTH_MISSION_INPUT_INVALID'
  });
  assert.throws(() => validateGrowthMissionInput({ ...validMission, budgetAmount: -1 }), {
    message: 'GROWTH_MISSION_INPUT_INVALID'
  });
});

test('builds review-only market steps and marks channels without connectors as blocked', () => {
  const input = validateGrowthMissionInput({
    ...validMission,
    markets: ['europe', 'mexico'],
    channels: ['instagram', 'google_ads']
  });
  const plan = buildGrowthMissionPlan(input);
  assert.equal(plan.length, 6);
  assert.equal(plan.find(step => step.id === 'europe:instagram')?.status, 'needs_human_review');
  assert.equal(plan.find(step => step.id === 'europe:google_ads')?.status, 'needs_connector');
  assert.equal(plan.every(step => step.execution === 'not_started'), true);
  assert.equal(plan.some(step => step.id === 'mexico:measurement'), true);
});

test('idempotency matches an identical normalized mission and rejects changed content', () => {
  const input = validateGrowthMissionInput(validMission);
  const stored: GrowthMissionInput = { ...input };
  assert.equal(growthMissionMatchesInput(stored, input), true);
  assert.equal(growthMissionMatchesInput({ ...stored, budgetAmount: 1501 }, input), false);
});

test('allows only safe Growth Mission lifecycle transitions', () => {
  assert.equal(transitionGrowthMissionStatus('plan_approved', 'pause'), 'paused');
  assert.equal(transitionGrowthMissionStatus('paused', 'resume'), 'plan_approved');
  assert.equal(transitionGrowthMissionStatus('plan_ready', 'cancel'), 'cancelled');
  assert.equal(transitionGrowthMissionStatus('paused', 'cancel'), 'cancelled');
  assert.throws(() => transitionGrowthMissionStatus('plan_ready', 'pause'), {
    message: 'GROWTH_MISSION_TRANSITION_INVALID'
  });
  assert.throws(() => transitionGrowthMissionStatus('cancelled', 'resume'), {
    message: 'GROWTH_MISSION_TRANSITION_INVALID'
  });
  assert.throws(() => transitionGrowthMissionStatus('cancelled', 'cancel'), {
    message: 'GROWTH_MISSION_TRANSITION_INVALID'
  });
});

test('validates AI recommendations against the mission market and channel allowlist', () => {
  const input = validateGrowthMissionInput(validMission);
  const valid = JSON.stringify({
    recommendations: [{
      market: 'europe',
      channelId: 'instagram',
      title: 'Prepare localized product introduction',
      rationale: 'Create a draft tailored to the selected audience and submit it for review.',
      successMetric: 'Track qualified registrations attributed to the campaign.'
    }]
  });
  assert.equal(parseGrowthMissionRecommendations(valid, input)[0].execution, 'not_started');

  const unauthorizedMarket = JSON.stringify({
    recommendations: [{ ...JSON.parse(valid).recommendations[0], market: 'china' }]
  });
  assert.throws(() => parseGrowthMissionRecommendations(unauthorizedMarket, input), {
    message: 'GROWTH_MISSION_AI_RESPONSE_INVALID'
  });
  const unauthorizedChannel = JSON.stringify({
    recommendations: [{ ...JSON.parse(valid).recommendations[0], channelId: 'telegram' }]
  });
  assert.throws(() => parseGrowthMissionRecommendations(unauthorizedChannel, input), {
    message: 'GROWTH_MISSION_AI_RESPONSE_INVALID'
  });
  assert.throws(() => parseGrowthMissionRecommendations('{"recommendations":[]}', input), {
    message: 'GROWTH_MISSION_AI_RESPONSE_INVALID'
  });
});

test('generates a bounded strategy draft without enabling execution', async () => {
  const input = validateGrowthMissionInput(validMission);
  const generatedAt = new Date('2026-10-05T00:00:00.000Z');
  const strategy = await generateGrowthMissionStrategy(input, async (prompt, systemPrompt, responseFormat, timeoutMs) => {
    assert.match(prompt, /"allowedMarkets":\["europe"\]/);
    assert.match(prompt, /"allowedChannels":\["facebook","instagram","google_ads"\]/);
    assert.match(systemPrompt, /不可信业务数据/);
    assert.equal(responseFormat.additionalProperties, false);
    assert.equal(timeoutMs, 30_000);
    return JSON.stringify({
      recommendations: [{
        market: 'europe',
        channelId: 'facebook',
        title: 'Draft a local market introduction',
        rationale: 'Prepare a market-specific draft for human review.',
        successMetric: 'Measure qualified registrations.'
      }]
    });
  }, () => generatedAt);

  assert.equal(strategy.source, 'ai_draft');
  assert.equal(strategy.executionEnabled, false);
  assert.equal(strategy.generatedAt, generatedAt.toISOString());
  assert.equal(strategy.recommendations[0].execution, 'not_started');
});

test('sends approved Mission review tasks to manual approval and skips other states', () => {
  const input = validateGrowthMissionInput(validMission);
  const recommendations = parseGrowthMissionRecommendations(JSON.stringify({
    recommendations: [{
      market: 'europe',
      channelId: 'instagram',
      title: 'Prepare localized product introduction',
      rationale: 'Prepare a reviewed draft.',
      successMetric: 'Track qualified registrations.'
    }]
  }), input);
  const approval = buildGrowthMissionReviewTaskResult({
    missionId: '12345678',
    missionStatus: 'plan_approved',
    recommendationIndex: 0,
    recommendations
  });
  assert.equal(approval.approvalRequired, true);
  assert.equal(approval.externalExecution, false);
  assert.equal(approval.status, 'ready_for_human_review');

  const skipped = buildGrowthMissionReviewTaskResult({
    missionId: '12345678',
    missionStatus: 'cancelled',
    recommendationIndex: 0,
    recommendations
  });
  assert.equal(skipped.approvalRequired, false);
  assert.equal(skipped.status, 'skipped');
  assert.throws(() => buildGrowthMissionReviewTaskResult({
    missionId: '12345678',
    missionStatus: 'plan_approved',
    recommendationIndex: 2,
    recommendations
  }), { message: 'GROWTH_MISSION_RECOMMENDATION_NOT_FOUND' });
});

test('reads only valid human review decision metadata for the audit view', () => {
  assert.deepEqual(readGrowthMissionReviewDecisionMetadata({
    humanDecision: 'accepted_for_internal_planning',
    decidedBy: '  growth-admin  ',
    decidedAt: '2026-10-05T02:30:00.000Z'
  }), {
    humanDecision: 'accepted_for_internal_planning',
    decidedBy: 'growth-admin',
    decidedAt: '2026-10-05T02:30:00.000Z'
  });
  assert.deepEqual(readGrowthMissionReviewDecisionMetadata({
    humanDecision: 'publish_now',
    decidedBy: 'x'.repeat(161),
    decidedAt: 'not-a-date'
  }), {
    humanDecision: null,
    decidedBy: null,
    decidedAt: null
  });
  assert.deepEqual(readGrowthMissionReviewDecisionMetadata(null), {
    humanDecision: null,
    decidedBy: null,
    decidedAt: null
  });
});

test('review task retries advance only after a returned or terminal failure and retain replay idempotency', () => {
  assert.equal(getNextGrowthMissionReviewRound(null), 0);
  assert.equal(getNextGrowthMissionReviewRound({
    status: 'waiting_approval',
    context: JSON.stringify({ missionId: '12345678', recommendationIndex: 0, reviewRound: 2 }),
    result: JSON.stringify({ approvalRequired: true, externalExecution: false })
  }), 2);
  assert.equal(getNextGrowthMissionReviewRound({
    status: 'cancelled',
    context: { missionId: '12345678', recommendationIndex: 0, reviewRound: 2 },
    result: { humanDecision: 'returned_for_revision' }
  }), 3);
  assert.equal(getNextGrowthMissionReviewRound({
    status: 'cancelled',
    context: { missionId: '12345678', recommendationIndex: 0, reviewRound: 2 },
    result: { humanDecision: 'accepted_for_internal_planning' }
  }), 2);
  assert.equal(getNextGrowthMissionReviewRound({
    status: 'dead_letter',
    context: { missionId: '12345678', recommendationIndex: 0, reviewRound: 2 },
    result: null
  }), 3);
  assert.equal(
    buildGrowthMissionReviewIdempotencyKey('12345678', 0, 0),
    'growth-mission-review:12345678:v1:0'
  );
  assert.equal(
    buildGrowthMissionReviewIdempotencyKey('12345678', 0, 3),
    'growth-mission-review:12345678:v1:0:r3'
  );
  assert.throws(() => getNextGrowthMissionReviewRound({
    status: 'cancelled',
    context: { reviewRound: -1 },
    result: null
  }), { message: 'GROWTH_MISSION_REVIEW_TASK_CONTEXT_INVALID' });
});

test('Mission cancellation covers active worker leases as well as queued and awaiting-approval tasks', () => {
  assert.deepEqual(growthMissionReviewStatusesToCancel, [
    'queued',
    'planning',
    'running',
    'waiting_approval',
    'verifying',
    'retrying'
  ]);
});

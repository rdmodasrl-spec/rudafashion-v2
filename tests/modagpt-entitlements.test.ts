import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getModaGptEntitlements,
  buildModaGptStudioImagePrompt,
  parseModaGptImageRequest,
  parseModaGptPlanState,
  resolveModaGptStudioImagePolicy,
  releaseModaGptUsage,
  reserveModaGptUsage,
  serializeModaGptSettings
} from '../src/server/modagptEntitlements';

test('free and pro plans expose distinct monthly chat and image quotas', () => {
  const now = new Date('2026-09-29T20:00:00.000Z');
  const free = getModaGptEntitlements(parseModaGptPlanState('{}'), now);
  const pro = getModaGptEntitlements(parseModaGptPlanState(JSON.stringify({
    modagpt: { plan: 'pro', expiresAt: null, usageByPeriod: {} }
  })), now);

  assert.deepEqual(free.quotas, { chat: 500, imageGeneration: 0, tryOn: 0 });
  assert.deepEqual(pro.quotas, { chat: 5000, imageGeneration: 30, tryOn: 10 });
  assert.equal(free.period, '2026-09');
  const nextMonth = getModaGptEntitlements(parseModaGptPlanState(JSON.stringify({
    modagpt: {
      plan: 'pro',
      expiresAt: null,
      usageByPeriod: { '2026-09': { imageGeneration: 30 } }
    }
  })), new Date('2026-10-01T00:00:00.000Z'));
  assert.equal(nextMonth.usage.imageGeneration, 0);
});

test('monthly feature usage reserves, enforces quota and releases failed work', () => {
  const now = new Date('2026-09-29T20:00:00.000Z');
  const state = parseModaGptPlanState(JSON.stringify({
    modagpt: {
      plan: 'pro',
      expiresAt: null,
      usageByPeriod: { '2026-09': { imageGeneration: 29 } }
    }
  }));
  const reservation = reserveModaGptUsage(state, 'imageGeneration', now);

  assert.equal(reservation.entitlements.usage.imageGeneration, 30);
  assert.equal(reservation.entitlements.remaining.imageGeneration, 0);
  assert.throws(() => reserveModaGptUsage(reservation.nextState, 'imageGeneration', now), /MODAGPT_QUOTA_EXCEEDED/);
  assert.equal(
    getModaGptEntitlements(releaseModaGptUsage(reservation.nextState, 'imageGeneration', '2026-09'), now).remaining.imageGeneration,
    1
  );
});

test('expired pro access resolves to free and premium capabilities stay locked', () => {
  const state = parseModaGptPlanState(JSON.stringify({
    modagpt: { plan: 'pro', expiresAt: '2026-09-01T00:00:00.000Z', usageByPeriod: {} }
  }));
  const entitlements = getModaGptEntitlements(state, new Date('2026-09-29T20:00:00.000Z'));

  assert.equal(entitlements.plan, 'free');
  assert.equal(entitlements.quotas.imageGeneration, 0);
  assert.throws(() => reserveModaGptUsage(state, 'tryOn', new Date('2026-09-29T20:00:00.000Z')), /MODAGPT_UPGRADE_REQUIRED/);
});

test('plan settings updates preserve unrelated merchant settings', () => {
  const serialized = serializeModaGptSettings(
    JSON.stringify({ locale: 'it', notifications: { email: true } }),
    { plan: 'pro', expiresAt: null, usageByPeriod: {} }
  );

  assert.deepEqual(JSON.parse(serialized), {
    locale: 'it',
    notifications: { email: true },
    modagpt: { plan: 'pro', expiresAt: null, usageByPeriod: {} }
  });

  test('invalid or unbounded persisted usage is rejected', () => {
    assert.throws(() => parseModaGptPlanState(JSON.stringify({
      modagpt: { plan: 'pro', usageByPeriod: { '2026-13': { chat: 1 } } }
    })), /MODAGPT_USAGE_INVALID/);
    assert.throws(() => parseModaGptPlanState(JSON.stringify({
      modagpt: { plan: 'pro', usageByPeriod: { '2026-09': { chat: -1 } } }
    })), /MODAGPT_USAGE_INVALID/);
  });
});

test('image request parser requires explicit try-on consent and bounded inputs', () => {
  const imageRequest = parseModaGptImageRequest({ task: 'imageGeneration', prompt: 'Black wool jacket' });
  assert.deepEqual(imageRequest, { task: 'imageGeneration', prompt: 'Black wool jacket' });

  assert.equal(parseModaGptImageRequest({
    task: 'tryOn',
    prompt: 'Try the jacket',
    category: 'tops',
    personImage: 'data:image/jpeg;base64,AA==',
    garmentImage: 'data:image/jpeg;base64,AA==',
    privacyConsent: false
  }), null);
  assert.deepEqual(parseModaGptImageRequest({
    task: 'tryOn',
    prompt: 'Try the jacket',
    category: 'tops',
    personImage: 'data:image/jpeg;base64,AA==',
    garmentImage: 'data:image/jpeg;base64,AA==',
    privacyConsent: true
  }), {
    task: 'tryOn',
    prompt: 'Try the jacket',
    category: 'tops',
    personImage: 'data:image/jpeg;base64,AA==',
    garmentImage: 'data:image/jpeg;base64,AA==',
    privacyConsent: true
  });
  assert.deepEqual(parseModaGptImageRequest({
    task: 'tryOn',
    prompt: 'Try the jacket',
    category: 'tops',
    personImage: 'data:image/jpeg;base64,AA==',
    garmentStorageKey: 'merchants/merchant-1/storefront/images/123e4567-e89b-12d3-a456-426614174000.jpeg',
    privacyConsent: true
  }), {
    task: 'tryOn',
    prompt: 'Try the jacket',
    category: 'tops',
    personImage: 'data:image/jpeg;base64,AA==',
    garmentStorageKey: 'merchants/merchant-1/storefront/images/123e4567-e89b-12d3-a456-426614174000.jpeg',
    privacyConsent: true
  });
  assert.equal(parseModaGptImageRequest({
    task: 'tryOn',
    prompt: 'Try the jacket',
    category: 'tops',
    personImage: 'data:image/jpeg;base64,AA==',
    garmentStorageKey: 'merchants/merchant-1/storefront/images/../../secret.jpeg',
    privacyConsent: true
  }), null);
  assert.equal(parseModaGptImageRequest({
    task: 'tryOn',
    prompt: 'Try the jacket',
    category: 'auto',
    personImage: 'data:image/jpeg;base64,AA==',
    garmentImage: 'data:image/jpeg;base64,AA==',
    privacyConsent: true
  }), null);
  assert.equal(parseModaGptImageRequest({ task: 'unknown', prompt: 'test' }), null);
});

test('all eight industry templates resolve isolated Studio image policies', () => {
  const industryTemplates = [
    ['apparel_production_wholesale', 'apparel_production_wholesale', 'apparel_studio'],
    ['apparel_wholesale', 'apparel_wholesale', 'apparel_studio'],
    ['trading_wholesale', 'trade_wholesale', 'trade_studio'],
    ['department_wholesale', 'department_wholesale', 'department_wholesale_studio'],
    ['bags_wholesale', 'leather_bag_wholesale', 'leather_studio'],
    ['department_chain_retail', 'department_store_chain', 'retail_chain_studio'],
    ['general_retail', 'general_retail', 'retail_studio'],
    ['restaurant_ordering', 'restaurant', 'restaurant_studio']
  ] as const;

  for (const [templateId, industryCode, studioCode] of industryTemplates) {
    const policy = resolveModaGptStudioImagePolicy(templateId, 'imageGeneration');
    assert.ok(policy, `${templateId} should have an image policy`);
    assert.equal(policy.industryCode, industryCode);
    assert.equal(policy.studioCode, studioCode);
    assert.match(policy.imageGuidance, /\S/);
  }
});

test('virtual try-on image policy is restricted to Apparel Studio', () => {
  assert.ok(resolveModaGptStudioImagePolicy('apparel_production_wholesale', 'tryOn'));
  assert.ok(resolveModaGptStudioImagePolicy('apparel_wholesale', 'tryOn'));
  for (const templateId of [
    'trading_wholesale',
    'department_wholesale',
    'bags_wholesale',
    'department_chain_retail',
    'general_retail',
    'restaurant_ordering'
  ]) {
    assert.equal(resolveModaGptStudioImagePolicy(templateId, 'tryOn'), null, templateId);
  }
  assert.equal(resolveModaGptStudioImagePolicy('unknown-template', 'imageGeneration'), null);
});

test('restaurant concept-image prompts explicitly identify their AI-generated scope', () => {
  const policy = resolveModaGptStudioImagePolicy('restaurant_ordering', 'imageGeneration');
  assert.ok(policy);
  const prompt = buildModaGptStudioImagePrompt(policy, 'A seasonal noodle dish');
  assert.match(prompt, /AI 创作/);
  assert.match(prompt, /不得声称是门店实际出餐/);
  assert.match(prompt, /A seasonal noodle dish/);
});

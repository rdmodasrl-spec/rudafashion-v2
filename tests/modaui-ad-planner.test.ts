import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultAiProviderCatalog } from '../src/server/aiProviderCatalog';
import {
  AI_AD_ROUTES,
  AI_AD_ROUTE_TEMPLATES,
  applyAiAdTimelineEdit,
  assembleAiAdConcepts,
  estimateAiAdTimelineCost,
  hashAiAdContent,
  parseAiAdConceptCopyResponse,
  resolveAiAdProviderStatus,
  validateAiAdConceptPayload,
  type AiAdConceptCopy,
  type AiAdProviderStatus
} from '../src/server/modauiAdPlanner';
import {
  buildAiAdFactWhitelist,
  buildAiAdProductBrief,
  findUngroundedAiAdFacts,
  parseMinorAmount,
  resolveAiAdPricePolicy
} from '../src/server/modauiAdBrief';
import {
  createAiAdProject,
  findAiAdProject,
  listAiAdProjectVersions,
  listAiAdProjects,
  loadAiAdProductSource,
  saveAiAdProjectVersion
} from '../src/server/modauiAdStore';
import {
  AI_AD_SHOT_EDIT_PRESETS,
  matchAiAdShotEditPreset,
  planAiAdShotEdit
} from '../src/server/modauiAdShotEdit';

/**
 * P1 广告策划器：只验证真实逻辑（简报/事实白名单/三方案/预算/版本/租户查询）。
 * 模型返回由测试显式构造，装配与守门逻辑是真实代码，不产生任何假费用或假状态。
 */

const product = {
  id: 'prod-1',
  name: 'Linen Blazer',
  brand: 'RUDA',
  category: 'Blazers',
  description: 'Soft linen blazer',
  fabric: 'Linen',
  composition: '100% linen',
  origin: 'Italy',
  images: JSON.stringify(['https://cdn.example/a.jpg']),
  media: JSON.stringify([
    { type: 'image', url: 'https://cdn.example/a.jpg' },
    { type: 'image', url: 'https://cdn.example/b.jpg' },
    { type: 'video', url: 'https://cdn.example/c.mp4' }
  ]),
  wholesalePrice: '19.90',
  rrpPrice: '39.90',
  variants: [
    { sku: 'LB-01-M', color: 'Beige', size: 'M', isActive: true },
    { sku: 'LB-01-L', color: 'Beige', size: 'L', isActive: true },
    { sku: 'LB-99-S', color: 'Black', size: 'S', isActive: false }
  ]
};

const brief = buildAiAdProductBrief({
  product,
  sellingPoints: ['Made in Italy'],
  now: new Date('2026-10-30T10:00:00Z')
});

function makeCopies(overrides?: Partial<Record<string, string>>): AiAdConceptCopy[] {
  return AI_AD_ROUTES.map(route => ({
    route,
    title: `${route} title`,
    audience: 'Boutique owners',
    hook: overrides?.[route] ?? 'Elevate every look',
    cta: 'Discover the collection',
    hashtags: ['moda', 'fashion'],
    scenes: AI_AD_ROUTE_TEMPLATES[route].shots.map((_shot, index) => ({
      voiceover: index === 0 ? 'Open on the tailored silhouette' : 'Tailored line for the campaign',
      onScreenText: index === 0 ? 'New season' : null,
      visual: `Visual direction ${index === 0 ? 'hero' : 'detail'}`
    }))
  })) as AiAdConceptCopy[];
}

const providerStatus: AiAdProviderStatus = {
  text: 'ready',
  video: 'adapter_not_built',
  voice: 'adapter_not_built',
  digitalHuman: 'provider_not_configured'
};

const options = {
  goal: 'conversion' as const,
  language: 'it' as const,
  aspectRatio: '9:16' as const,
  priceDisclosure: 'allowed' as const,
  resolutionKey: '720p'
};

test('brief keeps only real product facts and reports missing fields', () => {
  assert.equal(brief.productId, 'prod-1');
  assert.equal(brief.price.minor, 1990);
  assert.equal(brief.price.rrpMinor, 3990);
  assert.deepEqual(brief.colors, ['Beige']);
  assert.deepEqual(brief.sizes, ['M', 'L']);
  assert.deepEqual(brief.imageUrls, ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg']);
  assert.deepEqual(brief.sellingPoints, ['Made in Italy']);
  assert.deepEqual(brief.missing, []);

  const empty = buildAiAdProductBrief({ product: { id: 'p2', name: 'Unknown' } });
  assert.equal(empty.price.minor, null);
  assert.deepEqual(empty.missing.sort(), ['colors', 'description', 'images', 'material', 'price', 'sellingPoints', 'skus']);
  assert.equal(parseMinorAmount('0'), null);
  assert.equal(parseMinorAmount(null), null);
});

test('fact whitelist contains price and material numbers only', () => {
  const whitelist = buildAiAdFactWhitelist(brief);
  for (const token of ['19.90', '19,9', '1990', '39.90', '100']) {
    assert.ok(whitelist.numbers.includes(token), `missing token ${token}`);
  }
  assert.deepEqual(findUngroundedAiAdFacts('Only 19.90 EUR, 100% linen from Italy', whitelist), []);
  assert.deepEqual(findUngroundedAiAdFacts('Save 30% today', whitelist), ['30']);
});

test('missing price blocks quoting ads but allows non-price ads', () => {
  const noPrice = buildAiAdProductBrief({ product: { id: 'p3', name: 'No price', wholesalePrice: null } });
  assert.deepEqual(resolveAiAdPricePolicy({ brief: noPrice, disclosure: 'allowed' }), { ok: false, reason: 'PRICE_NOT_CONFIGURED' });
  assert.deepEqual(resolveAiAdPricePolicy({ brief: noPrice, disclosure: 'none' }), { ok: true });
  const whitelist = buildAiAdFactWhitelist(noPrice);
  assert.deepEqual(findUngroundedAiAdFacts('Premium tailoring, no numbers', whitelist), []);
  assert.deepEqual(findUngroundedAiAdFacts('Only 49 today', whitelist), ['49']);
});

test('route templates are fixed, distinct and their durations add up', () => {
  for (const route of AI_AD_ROUTES) {
    const template = AI_AD_ROUTE_TEMPLATES[route];
    const total = template.shots.reduce((sum, shot) => sum + shot.durationMs, 0);
    assert.equal(total, template.durationMs);
    assert.ok(template.shots.every(shot => shot.durationMs > 0));
  }
  const quickSources = AI_AD_ROUTE_TEMPLATES.quick.shots.map(shot => shot.source);
  assert.ok(!quickSources.includes('ai_video'), 'quick ad must stay on local engines');
});


test('provider status reports missing adapters instead of pretending availability', () => {
  const catalog = createDefaultAiProviderCatalog();
  const withoutKeys = resolveAiAdProviderStatus({ catalog, textReady: true, availableCredentials: [] });
  assert.equal(withoutKeys.video, 'provider_access_required');
  assert.equal(withoutKeys.voice, 'provider_access_required');
  assert.equal(withoutKeys.digitalHuman, 'provider_not_configured');

  const withKeys = resolveAiAdProviderStatus({
    catalog,
    textReady: true,
    availableCredentials: ['RUNWAY_API_KEY', 'GOOGLE_TTS_API_KEY']
  });
  assert.equal(withKeys.video, 'adapter_not_built');
  assert.equal(withKeys.voice, 'adapter_not_built');
  assert.equal(resolveAiAdProviderStatus({ catalog, textReady: false }).text, 'provider_not_configured');
});

test('cost uses catalog prices per paid video second and never invents zero', () => {
  const catalog = createDefaultAiProviderCatalog();
  const assembled = assembleAiAdConcepts({
    brief,
    whitelist: buildAiAdFactWhitelist(brief),
    copies: makeCopies(),
    options,
    providerStatus,
    catalog,
    tier: 'balanced',
    now: new Date('2026-10-30T10:00:00Z')
  });
  assert.ok('concepts' in assembled);
  if (!('concepts' in assembled)) return;
  const productAd = assembled.concepts.find(concept => concept.route === 'product')!;
  const videoLine = productAd.costEstimate.lines.find(line => line.kind === 'video')!;
  // Product Ad 有 3 个 ai_video 镜头 × 4s = 12s；balanced 档 720p = 0.1 USD/s。
  assert.equal(videoLine.seconds, 12);
  assert.equal(videoLine.amountUsd, 1.2);
  assert.equal(productAd.storyboard.length, AI_AD_ROUTE_TEMPLATES.product.shots.length);
  assert.equal(productAd.durationMs, AI_AD_ROUTE_TEMPLATES.product.durationMs);
  assert.equal(productAd.costEstimate.status, 'priced');

  const unpricedCatalog = createDefaultAiProviderCatalog();
  for (const model of unpricedCatalog.models) {
    if (model.pricing.kind === 'video') model.pricing = { kind: 'video', perSecondUsd: {} };
  }
  const unpriced = estimateAiAdTimelineCost({ shots: productAd.storyboard, catalog: unpricedCatalog, providerStatus });
  assert.equal(unpriced.status, 'price_not_configured');
  assert.equal(unpriced.amountMinor, null);

  const localOnly = estimateAiAdTimelineCost({
    shots: [{ durationMs: 3000, source: 'local_motion', voiceover: '', subtitle: null }],
    catalog,
    providerStatus
  });
  assert.equal(localOnly.status, 'priced');
  assert.equal(localOnly.amountMinor, 0);
});

test('model response is validated strictly and three distinct routes are required', () => {
  const payload = { concepts: makeCopies() };
  const parsed = parseAiAdConceptCopyResponse(JSON.stringify(payload));
  assert.equal(parsed.length, 3);
  assert.deepEqual(parsed.map(copy => copy.route), [...AI_AD_ROUTES]);

  assert.throws(() => parseAiAdConceptCopyResponse('not json'), /AI_TOOLS_PROVIDER_RESPONSE_INVALID/);
  const shortScenes = {
    concepts: payload.concepts.map(copy => copy.route === 'quick' ? { ...copy, scenes: copy.scenes.slice(0, 2) } : copy)
  };
  assert.throws(() => parseAiAdConceptCopyResponse(JSON.stringify(shortScenes)), /AI_TOOLS_PROVIDER_RESPONSE_INVALID/);
  const duplicated = { concepts: payload.concepts.map(copy => ({ ...copy, route: 'product' })) };
  assert.throws(() => parseAiAdConceptCopyResponse(JSON.stringify(duplicated)), /AI_TOOLS_PROVIDER_RESPONSE_INVALID/);
});

test('assembler rejects invented numbers and honours price disclosure', () => {
  const catalog = createDefaultAiProviderCatalog();
  const whitelist = buildAiAdFactWhitelist(brief);
  const invented = assembleAiAdConcepts({
    brief,
    whitelist,
    copies: makeCopies({ ugc: 'Get 50% off today' }),
    options,
    providerStatus,
    catalog
  });
  assert.equal(invented.ok, false);
  if (invented.ok) return;
  assert.deepEqual(invented, { ok: false, reason: 'AI_AD_FACT_UNGROUNDED', details: [{ conceptKey: 'ugc', tokens: ['50'] }] });

  const noPriceCopy = assembleAiAdConcepts({
    brief,
    whitelist,
    copies: makeCopies({ quick: 'Only 19.90 today' }),
    options: { ...options, priceDisclosure: 'none' },
    providerStatus,
    catalog
  });
  assert.equal(noPriceCopy.ok, false);
  if (noPriceCopy.ok) return;
  assert.deepEqual(noPriceCopy.details, [{ conceptKey: 'quick', tokens: ['price'] }]);
});


test('timeline edit updates one shot, reorders and keeps script in sync', () => {
  const catalog = createDefaultAiProviderCatalog();
  const assembled = assembleAiAdConcepts({
    brief,
    whitelist: buildAiAdFactWhitelist(brief),
    copies: makeCopies(),
    options,
    providerStatus,
    catalog
  });
  assert.ok('concepts' in assembled);
  if (!('concepts' in assembled)) return;
  const concept = assembled.concepts[0];
  const base = { script: concept.script, storyboard: concept.storyboard };

  const edited = applyAiAdTimelineEdit({
    base,
    updateShot: { shotId: concept.storyboard[1].shotId, patch: { voiceover: 'Updated line', durationMs: 6000 } }
  });
  assert.equal(edited.storyboard[1].voiceover, 'Updated line');
  assert.equal(edited.storyboard[1].durationMs, 6000);
  assert.equal(edited.script[1].voiceover, 'Updated line');

  const reordered = applyAiAdTimelineEdit({
    base: edited,
    reorder: [...edited.storyboard].reverse().map(shot => shot.shotId)
  });
  assert.equal(reordered.storyboard[0].shotId, edited.storyboard[edited.storyboard.length - 1].shotId);
  assert.deepEqual(reordered.storyboard.map(shot => shot.order), [0, 1, 2, 3, 4]);
  assert.equal(reordered.script[0].voiceover, edited.storyboard[edited.storyboard.length - 1].voiceover);

  const scripted = applyAiAdTimelineEdit({
    base,
    script: base.script.map((scene, index) => ({ ...scene, voiceover: `Scene ${index + 1}` }))
  });
  assert.equal(scripted.storyboard[2].voiceover, 'Scene 3');

  assert.throws(() => applyAiAdTimelineEdit({ base, updateShot: { shotId: 'missing', patch: {} } }), /AI_AD_SHOT_NOT_FOUND/);
  assert.throws(() => applyAiAdTimelineEdit({ base, updateShot: { shotId: concept.storyboard[0].shotId, patch: { durationMs: 10 } } }), /AI_AD_SCRIPT_INVALID/);
  assert.throws(() => applyAiAdTimelineEdit({ base, script: [] }), /AI_AD_SCRIPT_INVALID/);
});

test('content hash is stable and changes only with real edits', () => {
  const storyboard = [
    {
      shotId: 's1',
      order: 0,
      durationMs: 3000,
      framing: 'medium' as const,
      camera: 'static' as const,
      source: 'local_motion' as const,
      visual: 'Hero',
      voiceover: 'Line',
      subtitle: null
    }
  ];
  const script = [{ scene: 1, voiceover: 'Line', onScreenText: null }];
  const first = hashAiAdContent({ conceptKey: 'quick', script, storyboard });
  const second = hashAiAdContent({ conceptKey: 'quick', script, storyboard });
  const changed = hashAiAdContent({ conceptKey: 'quick', script, storyboard: [{ ...storyboard[0], durationMs: 4000 }] });
  assert.equal(first, second);
  assert.notEqual(first, changed);
});

test('concept payload validation rejects tampered structures', () => {
  const catalog = createDefaultAiProviderCatalog();
  const assembled = assembleAiAdConcepts({
    brief,
    whitelist: buildAiAdFactWhitelist(brief),
    copies: makeCopies(),
    options,
    providerStatus,
    catalog
  });
  assert.ok('concepts' in assembled);
  if (!('concepts' in assembled)) return;
  const concept = assembled.concepts[0];
  const accepted = validateAiAdConceptPayload(concept);
  assert.equal(accepted.conceptKey, 'product');
  assert.equal(accepted.durationMs, concept.durationMs);

  assert.throws(() => validateAiAdConceptPayload({ ...concept, route: 'unknown' }), /AI_AD_CONCEPT_INVALID/);
  assert.throws(() => validateAiAdConceptPayload({ ...concept, storyboard: [] }), /AI_AD_SCRIPT_INVALID/);
  assert.throws(() => validateAiAdConceptPayload({ ...concept, providerStatus: null }), /AI_AD_CONCEPT_INVALID/);
});

function createStubPrisma(overrides?: {
  projectFindFirst?: (args: any) => unknown;
  versionFindFirst?: (args: any) => unknown;
}) {
  const calls: Array<{ model: string; args: any }> = [];
  const record = (model: string) => (args: any) => {
    calls.push({ model, args });
  };
  const prisma = {
    product: {
      findFirst: async (args: any) => {
        record('product.findFirst')(args);
        return null;
      }
    },
    aiAdProject: {
      findFirst: async (args: any) => {
        record('aiAdProject.findFirst')(args);
        return overrides?.projectFindFirst ? overrides.projectFindFirst(args) : null;
      },
      findMany: async (args: any) => {
        record('aiAdProject.findMany')(args);
        return [];
      },
      create: async (args: any) => {
        record('aiAdProject.create')(args);
        return { id: 'proj-1', ...args.data };
      },
      update: async (args: any) => {
        record('aiAdProject.update')(args);
        return { id: 'proj-1', currentVersionNo: 2 };
      }
    },
    aiAdConcept: {
      findMany: async () => [],
      update: async () => ({})
    },
    aiAdProjectVersion: {
      findFirst: async (args: any) => {
        record('aiAdProjectVersion.findFirst')(args);
        return overrides?.versionFindFirst ? overrides.versionFindFirst(args) : null;
      },
      findMany: async (args: any) => {
        record('aiAdProjectVersion.findMany')(args);
        return [];
      },
      create: async (args: any) => {
        record('aiAdProjectVersion.create')(args);
        return { id: 'ver-1', ...args.data };
      }
    }
  };
  return { prisma, calls };
}

test('store scopes every query by merchant and never selects internal cost columns', async () => {
  const stub = createStubPrisma();
  await loadAiAdProductSource({ prisma: stub.prisma, merchantId: 'm1', productId: 'prod-1' });
  await findAiAdProject({ prisma: stub.prisma, merchantId: 'm1', projectId: 'proj-1' });
  await listAiAdProjects({ prisma: stub.prisma, merchantId: 'm1' });

  const productCall = stub.calls.find(call => call.model === 'product.findFirst')!;
  assert.deepEqual(productCall.args.where, { id: 'prod-1', merchantId: 'm1' });
  assert.equal('costPrice' in productCall.args.select, false);

  for (const call of stub.calls.filter(item => item.model.startsWith('aiAdProject.'))) {
    assert.equal(call.args.where.merchantId, 'm1');
  }
});

test('project creation is idempotent and stores three concepts plus version one', async () => {
  const stub = createStubPrisma();
  const assembled = assembleAiAdConcepts({
    brief,
    whitelist: buildAiAdFactWhitelist(brief),
    copies: makeCopies(),
    options,
    providerStatus,
    catalog: createDefaultAiProviderCatalog()
  });
  assert.ok('concepts' in assembled);
  if (!('concepts' in assembled)) return;

  const created = await createAiAdProject({
    prisma: stub.prisma,
    merchantId: 'm1',
    actorId: 'actor-1',
    productId: 'prod-1',
    brief,
    briefHash: 'hash-brief',
    title: 'Linen Blazer · Product Ad',
    concepts: assembled.concepts,
    selectedConceptKey: 'ugc',
    clientRequestId: 'req-1',
    costEstimate: assembled.concepts[1].costEstimate
  });
  assert.equal(created.created, true);
  const createCall = stub.calls.find(call => call.model === 'aiAdProject.create')!;
  assert.equal(createCall.args.data.merchantId, 'm1');
  assert.equal(createCall.args.data.concepts.create.length, 3);
  assert.equal(createCall.args.data.versions.create[0].versionNo, 1);
  assert.equal(createCall.args.data.versions.create[0].conceptKey, 'ugc');
  // contentHash 列是 VARCHAR(64)，长度超限会在生产写入时直接失败。
  assert.equal(String(createCall.args.data.versions.create[0].contentHash).length, 64);

  const existing = await createAiAdProject({
    prisma: createStubPrisma({ projectFindFirst: () => ({ id: 'proj-existing', merchantId: 'm1' }) }).prisma,
    merchantId: 'm1',
    actorId: 'actor-1',
    productId: 'prod-1',
    brief,
    briefHash: 'hash-brief',
    title: 'dup',
    concepts: assembled.concepts,
    selectedConceptKey: 'ugc',
    clientRequestId: 'req-1',
    costEstimate: null
  });
  assert.equal(existing.created, false);
  assert.equal(existing.project.id, 'proj-existing');
});

test('saving the same content twice returns the existing version', async () => {
  const assembled = assembleAiAdConcepts({
    brief,
    whitelist: buildAiAdFactWhitelist(brief),
    copies: makeCopies(),
    options,
    providerStatus,
    catalog: createDefaultAiProviderCatalog()
  });
  assert.ok('concepts' in assembled);
  if (!('concepts' in assembled)) return;
  const selected = assembled.concepts[2];
  const projectRow = {
    id: 'proj-1',
    merchantId: 'm1',
    selectedConceptId: 'concept-quick',
    currentVersionNo: 1,
    concepts: [{ id: 'concept-quick', conceptKey: 'quick', script: selected.script, storyboard: selected.storyboard }]
  };
  const stub = createStubPrisma({
    projectFindFirst: () => projectRow,
    versionFindFirst: () => ({
      id: 'ver-1',
      versionNo: 1,
      conceptKey: 'quick',
      contentHash: 'abc',
      note: null,
      createdAt: new Date()
    })
  });
  const saved = await saveAiAdProjectVersion({
    prisma: stub.prisma,
    merchantId: 'm1',
    projectId: 'proj-1',
    conceptKey: 'quick',
    script: selected.script,
    storyboard: selected.storyboard,
    contentHash: 'abc',
    costEstimate: selected.costEstimate,
    actorId: 'actor-1'
  });
  assert.equal(saved.created, false);
  assert.equal(stub.calls.some(call => call.model === 'aiAdProjectVersion.create'), false);
});

test('project creation stores merchant supplement images and keeps them out of the brief', async () => {
  const stub = createStubPrisma();
  const assembled = assembleAiAdConcepts({
    brief,
    whitelist: buildAiAdFactWhitelist(brief),
    copies: makeCopies(),
    options,
    providerStatus,
    catalog: createDefaultAiProviderCatalog()
  });
  assert.ok('concepts' in assembled);
  if (!('concepts' in assembled)) return;

  await createAiAdProject({
    prisma: stub.prisma,
    merchantId: 'm1',
    actorId: 'actor-1',
    productId: 'prod-1',
    brief,
    briefHash: 'hash-brief',
    title: 'Linen Blazer · Quick Ad',
    concepts: assembled.concepts,
    selectedConceptKey: 'quick',
    clientRequestId: 'req-supp',
    costEstimate: null,
    supplementImages: ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg']
  });

  const createCall = stub.calls.find(call => call.model === 'aiAdProject.create')!;
  assert.deepEqual(createCall.args.data.supplementImages, [
    'https://cdn.example.com/a.jpg',
    'https://cdn.example.com/b.jpg'
  ]);
  // 补充图片只存在于项目行，商品简报仍然只来自商品资料，避免把上传图当成商品事实。
  assert.equal(JSON.stringify(createCall.args.data.brief).includes('cdn.example.com'), false);
});

test('supplement images default to an empty array so the column never holds null', async () => {
  const stub = createStubPrisma();
  const assembled = assembleAiAdConcepts({
    brief,
    whitelist: buildAiAdFactWhitelist(brief),
    copies: makeCopies(),
    options,
    providerStatus,
    catalog: createDefaultAiProviderCatalog()
  });
  assert.ok('concepts' in assembled);
  if (!('concepts' in assembled)) return;

  await createAiAdProject({
    prisma: stub.prisma,
    merchantId: 'm1',
    actorId: 'actor-1',
    productId: 'prod-1',
    brief,
    briefHash: 'hash-brief',
    title: 'no supplements',
    concepts: assembled.concepts,
    selectedConceptKey: 'product',
    clientRequestId: 'req-none',
    costEstimate: null
  });
  const createCall = stub.calls.find(call => call.model === 'aiAdProject.create')!;
  assert.deepEqual(createCall.args.data.supplementImages, []);
});

test('version list carries script and storyboard so the client can restore without guessing', async () => {
  const stub = createStubPrisma({
    projectFindFirst: () => ({ id: 'proj-1', merchantId: 'm1', currentVersionNo: 2 })
  });
  const versions = await listAiAdProjectVersions({
    prisma: stub.prisma,
    merchantId: 'm1',
    projectId: 'proj-1'
  });
  assert.deepEqual(versions, []);
  const findManyCall = stub.calls.find(call => call.model === 'aiAdProjectVersion.findMany')!;
  assert.equal(findManyCall.args.where.projectId, 'proj-1');
  assert.equal(findManyCall.args.select.storyboard, true);
  assert.equal(findManyCall.args.select.script, true);
});

/**
 * P2 镜头修改：只做本地确定性参数调整或记录待生成要求，任何情况下都不调用付费供应商。
 */
const editableShot = {
  shotId: 'shot-1',
  order: 0,
  durationMs: 4000,
  framing: 'wide' as const,
  camera: 'static' as const,
  source: 'product_image' as const,
  visual: '模特正面展示上衣的版型与领口',
  voiceover: '第一句配音',
  subtitle: null
};

test('local shot presets change parameters without pretending to generate frames', () => {
  for (const preset of ['premium', 'product_clarity', 'faster'] as const) {
    const plan = planAiAdShotEdit({ shot: editableShot, route: 'quick', shotIndex: 0, preset });
    assert.equal(plan.tier, 'local');
    assert.equal(plan.callsPaidProvider, false);
    assert.equal(plan.requiresGeneration, false);
    assert.equal(plan.patch.directionNote, undefined);
    // 本地预设必须如实说明没有生成新画面。
    assert.match(plan.note, /没有生成新画面/);
  }

  const premium = planAiAdShotEdit({ shot: editableShot, route: 'quick', shotIndex: 0, preset: 'premium' });
  assert.equal(premium.patch.framing, 'close');
  assert.equal(premium.patch.transition, 'fade');
  // 原画面描述保留，只在末尾追加要求，不能覆盖模型给出的商品事实。
  assert.ok((premium.patch.visual ?? '').startsWith('模特正面展示上衣'));

  const faster = planAiAdShotEdit({ shot: editableShot, route: 'quick', shotIndex: 0, preset: 'faster' });
  assert.ok(typeof faster.patch.durationMs === 'number' && faster.patch.durationMs < 4000);
  assert.ok(typeof faster.patch.speed === 'number' && faster.patch.speed > 1);
});

test('generation-only presets are honest: marked as requiring generation and never billed', () => {
  for (const preset of ['background', 'natural_person', 'redesign'] as const) {
    const plan = planAiAdShotEdit({ shot: editableShot, route: 'quick', shotIndex: 0, preset });
    assert.equal(plan.tier, 'generation');
    assert.equal(plan.requiresGeneration, true);
    assert.equal(plan.callsPaidProvider, false);
    assert.match(plan.note, /没有生成新画面/);
    assert.ok(plan.patch.visual || plan.patch.directionNote || plan.patch.framing);
  }

  const redesign = planAiAdShotEdit({ shot: editableShot, route: 'quick', shotIndex: 0, preset: 'redesign' });
  // 重新设计必须留下可追溯的要求说明，而不是假装画面已更换。
  assert.ok(redesign.patch.directionNote && redesign.patch.directionNote.length > 0);
});

test('free text maps to a known preset or falls back to a recorded instruction', () => {
  assert.equal(matchAiAdShotEditPreset('把背景换成纯色'), 'background');
  assert.equal(matchAiAdShotEditPreset('商品更清楚一些'), 'product_clarity');
  assert.equal(matchAiAdShotEditPreset('整体更高级'), 'premium');
  assert.equal(matchAiAdShotEditPreset('镜头再慢一点'), null);

  const byText = planAiAdShotEdit({ shot: editableShot, route: 'quick', shotIndex: 0, instruction: '把背景换成纯色' });
  assert.equal(byText.preset, 'background');
  assert.equal(byText.patch.directionNote, '把背景换成纯色');

  const custom = planAiAdShotEdit({ shot: editableShot, route: 'quick', shotIndex: 0, instruction: '镜头再慢一点，光线柔和' });
  assert.equal(custom.preset, 'custom');
  assert.deepEqual(Object.keys(custom.patch), ['directionNote']);
  assert.equal(custom.requiresGeneration, false);
  assert.equal(custom.callsPaidProvider, false);
});

test('shot edit rejects empty, oversized and unknown input', () => {
  assert.throws(() => planAiAdShotEdit({ shot: editableShot, route: 'quick', shotIndex: 0 }), /AI_AD_SHOT_EDIT_INVALID/);
  assert.throws(() => planAiAdShotEdit({ shot: editableShot, route: 'quick', shotIndex: 0, instruction: '   ' }), /AI_AD_SHOT_EDIT_INVALID/);
  assert.throws(
    () => planAiAdShotEdit({ shot: editableShot, route: 'quick', shotIndex: 0, preset: 'make_it_pop' }),
    /AI_AD_SHOT_EDIT_INVALID/
  );
  assert.throws(
    () => planAiAdShotEdit({ shot: editableShot, route: 'quick', shotIndex: 0, instruction: '要'.repeat(201) }),
    /AI_AD_SHOT_EDIT_INVALID/
  );
  assert.equal(AI_AD_SHOT_EDIT_PRESETS.length, 6);
});

test('edited shot stays a valid storyboard so older projects still validate', () => {
  const plan = planAiAdShotEdit({ shot: editableShot, route: 'quick', shotIndex: 0, preset: 'premium' });
  const edited = applyAiAdTimelineEdit({
    base: { script: [], storyboard: [editableShot] },
    updateShot: { shotId: editableShot.shotId, patch: plan.patch }
  });
  const [shot] = edited.storyboard;
  assert.equal(shot.framing, 'close');
  assert.equal(shot.transition, 'fade');
  assert.equal(shot.durationMs, 4000);
  // 脚本由分镜重新推导，不会与分镜脱节。
  assert.equal(edited.script.length, edited.storyboard.length);
});

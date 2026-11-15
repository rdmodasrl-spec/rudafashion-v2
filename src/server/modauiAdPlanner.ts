import { createHash } from 'node:crypto';
import { resolveAiProviderModel, type AiProviderCatalog, type AiProviderTier } from './aiProviderCatalog';
import { estimateAiProviderCost } from './aiProviderPricing';
import {
  type AiAdAspectRatio,
  type AiAdBrief,
  type AiAdFactWhitelist,
  type AiAdLanguage,
  describeAiAdBriefForPrompt,
  findUngroundedAiAdFacts
} from './modauiAdBrief';

/**
 * MODAUI 广告策划器 — 创意规划与费用守门（纯逻辑：无 Prisma、无网络）。
 *
 * 规则（见 docs/engineering/modules/modaui-ai-advertising.md §22）：
 * - 分镜结构（时长/景别/运镜/素材来源）由代码确定性生成；模型只填文案与画面描述，
 *   因此同一商品不会因为模型波动得到不同的镜头数。
 * - 文案必须通过事实白名单校验，含编造数字或货币符号即整份方案作废。
 * - 费用只来自 `estimateAiProviderCost` + `aiProviderCatalog` 单价；拿不到价格就是
 *   `price_not_configured`，绝不把未知成本写成 0。
 * - 供应商状态如实反映「有没有 Adapter、有没有凭据」，不把未接通写成可用。
 */

export const AI_AD_ROUTES = ['product', 'ugc', 'quick'] as const;
export type AiAdRoute = (typeof AI_AD_ROUTES)[number];

export const AI_AD_GOALS = ['conversion', 'awareness', 'launch'] as const;
export type AiAdGoal = (typeof AI_AD_GOALS)[number];

export type AiAdServiceStatus =
  | 'ready'
  | 'provider_access_required'
  | 'adapter_not_built'
  | 'price_not_configured'
  | 'provider_not_configured';

export type AiAdProviderStatus = {
  text: AiAdServiceStatus;
  video: AiAdServiceStatus;
  voice: AiAdServiceStatus;
  digitalHuman: AiAdServiceStatus;
};

export type AiAdShotSource = 'ai_video' | 'product_image' | 'local_motion';
export type AiAdFraming = 'wide' | 'medium' | 'close' | 'macro';
export type AiAdCameraMove = 'static' | 'push_in' | 'pan' | 'orbit';
/** 剪辑参数：全部为可选字段，旧数据缺省按 cut / 1 / none / center 解释。 */
export type AiAdShotTransition = 'cut' | 'fade' | 'slide';
export type AiAdShotCrop = 'none' | 'tight' | 'wide';
export type AiAdShotPosition = 'center' | 'top' | 'bottom';

export type AiAdStoryboardShot = {
  shotId: string;
  order: number;
  durationMs: number;
  framing: AiAdFraming;
  camera: AiAdCameraMove;
  source: AiAdShotSource;
  visual: string;
  voiceover: string;
  subtitle: string | null;
  transition?: AiAdShotTransition;
  /** 0.5–2.0，越大越快；缺省即原速。 */
  speed?: number;
  crop?: AiAdShotCrop;
  position?: AiAdShotPosition;
  /** 商家用自然语言提出的结构化修改要求（≤200 字），不代表画面已重新生成。 */
  directionNote?: string | null;
};

export type AiAdScriptScene = {
  scene: number;
  voiceover: string;
  onScreenText: string | null;
};

export type AiAdCostLine = {
  kind: 'video' | 'tts' | 'local_compute';
  label: string;
  modelId: string | null;
  seconds?: number;
  characters?: number;
  amountUsd: number | null;
  status: AiAdServiceStatus;
  note?: string;
};

export type AiAdCostEstimate = {
  /** 费用是否完整可算：只有全部必需项都有真实单价才是 `priced`。 */
  status: 'priced' | 'price_not_configured' | 'provider_not_configured';
  currency: 'USD';
  amountMinor: number | null;
  amountUsd: number | null;
  resolutionKey: string;
  lines: AiAdCostLine[];
  computedAt: string;
};

export type AiAdConcept = {
  conceptKey: string;
  route: AiAdRoute;
  goal: AiAdGoal;
  title: string;
  audience: string;
  hook: string;
  cta: string;
  language: AiAdLanguage;
  aspectRatio: AiAdAspectRatio;
  hashtags: string[];
  durationMs: number;
  script: AiAdScriptScene[];
  storyboard: AiAdStoryboardShot[];
  providerStatus: AiAdProviderStatus;
  costEstimate: AiAdCostEstimate;
  /** 文案来源，只可能是真实模型输出；结构（分镜）来自代码模板。 */
  copySource: 'provider';
};

type ShotTemplate = {
  framing: AiAdFraming;
  camera: AiAdCameraMove;
  source: AiAdShotSource;
  durationMs: number;
  /** 画面意图，交给模型细化；不含任何商品事实。 */
  intent: string;
};

type RouteTemplate = {
  durationMs: number;
  shots: ShotTemplate[];
  defaultGoal: AiAdGoal;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readBoundedString(value: unknown, min: number, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (text.length < min || text.length > max) return null;
  return text;
}

/**
 * 三条路线的镜头结构。时长合计必须等于 `durationMs`（测试断言）。
 * `source` 决定成本：`ai_video` 才计入付费视频秒数，`product_image`/`local_motion` 走本地引擎。
 */
export const AI_AD_ROUTE_TEMPLATES: Record<AiAdRoute, RouteTemplate> = {
  product: {
    durationMs: 20_000,
    defaultGoal: 'awareness',
    shots: [
      { framing: 'medium', camera: 'push_in', source: 'ai_video', durationMs: 4_000, intent: 'hero entrance of the product' },
      { framing: 'close', camera: 'orbit', source: 'ai_video', durationMs: 4_000, intent: 'product material and construction detail' },
      { framing: 'wide', camera: 'static', source: 'product_image', durationMs: 4_000, intent: 'clean catalog packshot' },
      { framing: 'macro', camera: 'pan', source: 'ai_video', durationMs: 4_000, intent: 'texture close-up' },
      { framing: 'medium', camera: 'static', source: 'local_motion', durationMs: 4_000, intent: 'closing packshot with call to action' }
    ]
  },
  ugc: {
    durationMs: 30_000,
    defaultGoal: 'conversion',
    shots: [
      { framing: 'medium', camera: 'static', source: 'ai_video', durationMs: 5_000, intent: 'creator speaking to camera opening' },
      { framing: 'wide', camera: 'pan', source: 'ai_video', durationMs: 6_000, intent: 'creator showing the product in hand' },
      { framing: 'close', camera: 'static', source: 'ai_video', durationMs: 7_000, intent: 'product usage detail' },
      { framing: 'medium', camera: 'static', source: 'ai_video', durationMs: 6_000, intent: 'creator giving a reason to buy' },
      { framing: 'close', camera: 'push_in', source: 'local_motion', durationMs: 6_000, intent: 'closing packshot with call to action' }
    ]
  },
  quick: {
    durationMs: 15_000,
    defaultGoal: 'conversion',
    shots: [
      { framing: 'medium', camera: 'push_in', source: 'local_motion', durationMs: 3_000, intent: 'still image with motion and headline' },
      { framing: 'wide', camera: 'static', source: 'product_image', durationMs: 4_000, intent: 'clean catalog packshot' },
      { framing: 'close', camera: 'pan', source: 'local_motion', durationMs: 4_000, intent: 'colour variant transition' },
      { framing: 'medium', camera: 'static', source: 'local_motion', durationMs: 4_000, intent: 'closing card with call to action' }
    ]
  }
};

export const AI_AD_ROUTE_LABELS: Record<AiAdRoute, string> = {
  product: 'Product Ad',
  ugc: 'UGC Ad',
  quick: 'Quick Ad'
};

export function isAiAdRoute(value: unknown): value is AiAdRoute {
  return typeof value === 'string' && (AI_AD_ROUTES as readonly string[]).includes(value);
}

export function isAiAdGoal(value: unknown): value is AiAdGoal {
  return typeof value === 'string' && (AI_AD_GOALS as readonly string[]).includes(value);
}

function resolveServiceStatus(input: {
  catalog: AiProviderCatalog;
  capability: 'video_generate' | 'tts';
  tier?: AiProviderTier;
  availableCredentials?: readonly string[];
  adapterBuilt: boolean;
}): AiAdServiceStatus {
  const resolution = resolveAiProviderModel({
    catalog: input.catalog,
    capability: input.capability,
    tier: input.tier,
    availableCredentials: input.availableCredentials
  });
  if (resolution.ok) return input.adapterBuilt ? 'ready' : 'adapter_not_built';
  return 'reason' in resolution && resolution.reason === 'no_capability_match'
    ? 'provider_not_configured'
    : 'provider_access_required';
}

/** 计算各服务的真实状态；`adapterBuilt` 必须由调用方按实际代码事实传入（默认未实现）。 */
export function resolveAiAdProviderStatus(input: {
  catalog: AiProviderCatalog;
  textReady: boolean;
  tier?: AiProviderTier;
  availableCredentials?: readonly string[];
  videoAdapterBuilt?: boolean;
  voiceAdapterBuilt?: boolean;
  digitalHumanAdapterBuilt?: boolean;
}): AiAdProviderStatus {
  return {
    text: input.textReady ? 'ready' : 'provider_not_configured',
    video: resolveServiceStatus({
      catalog: input.catalog,
      capability: 'video_generate',
      tier: input.tier,
      availableCredentials: input.availableCredentials,
      adapterBuilt: input.videoAdapterBuilt ?? false
    }),
    voice: resolveServiceStatus({
      catalog: input.catalog,
      capability: 'tts',
      tier: input.tier,
      availableCredentials: input.availableCredentials,
      adapterBuilt: input.voiceAdapterBuilt ?? false
    }),
    // 数字人没有目录条目也没有 Adapter：恒为未接通，直到真的接入并登记能力。
    digitalHuman: input.digitalHumanAdapterBuilt ? 'ready' : 'provider_not_configured'
  };
}

function countVoiceCharacters(shots: ReadonlyArray<Pick<AiAdStoryboardShot, 'voiceover' | 'subtitle'>>): number {
  return shots.reduce((total, shot) => {
    const voiceover = shot.voiceover?.trim().length ?? 0;
    const subtitle = shot.subtitle?.trim().length ?? 0;
    return total + Math.max(voiceover, subtitle);
  }, 0);
}

/**
 * 按分镜计算供应商成本。
 *
 * 只统计 `ai_video` 镜头的付费秒数与配音字符数；本地引擎（Sharp/FFmpeg）单独列
 * `local_compute` 且费用为 0（真实计费来源是自有算力，不由供应商 API 收费）。
 */
export function estimateAiAdTimelineCost(input: {
  shots: ReadonlyArray<Pick<AiAdStoryboardShot, 'durationMs' | 'source' | 'voiceover' | 'subtitle'>>;
  catalog: AiProviderCatalog;
  providerStatus: AiAdProviderStatus;
  resolutionKey?: string;
  tier?: AiProviderTier;
  now?: Date;
}): AiAdCostEstimate {
  const now = input.now ?? new Date();
  const resolutionKey = input.resolutionKey ?? '720p';
  const lines: AiAdCostLine[] = [];

  const videoMs = input.shots
    .filter(shot => shot.source === 'ai_video')
    .reduce((total, shot) => total + shot.durationMs, 0);
  if (videoMs > 0) {
    const seconds = Math.round(videoMs / 10) / 100;
    const resolution = resolveAiProviderModel({ catalog: input.catalog, capability: 'video_generate', tier: input.tier });
    if ('model' in resolution) {
      const estimate = estimateAiProviderCost({
        model: resolution.model,
        usage: { kind: 'video', seconds, resolutionKey },
        now
      });
      const priced = 'usd' in estimate;
      lines.push({
        kind: 'video',
        label: `AI 视频 ${seconds}s`,
        modelId: resolution.model.modelId,
        seconds,
        amountUsd: priced ? estimate.usd : null,
        status: priced ? input.providerStatus.video : 'price_not_configured',
        note: priced ? undefined : `PRICING_UNAVAILABLE:${estimate.reason}`
      });
    } else {
      lines.push({
        kind: 'video',
        label: `AI 视频 ${seconds}s`,
        modelId: null,
        seconds,
        amountUsd: null,
        status: resolution.reason === 'no_capability_match' ? 'provider_not_configured' : 'provider_access_required',
        note: '目录中没有可用的视频模型，无法计算费用'
      });
    }
  }

  const characters = countVoiceCharacters(input.shots);
  if (characters > 0) {
    const resolution = resolveAiProviderModel({ catalog: input.catalog, capability: 'tts', tier: input.tier });
    if ('model' in resolution) {
      const estimate = estimateAiProviderCost({ model: resolution.model, usage: { kind: 'tts', characters }, now });
      const priced = 'usd' in estimate;
      lines.push({
        kind: 'tts',
        label: `配音 ${characters} 字符`,
        modelId: resolution.model.modelId,
        characters,
        amountUsd: priced ? estimate.usd : null,
        status: priced ? input.providerStatus.voice : 'price_not_configured',
        note: priced ? undefined : `PRICING_UNAVAILABLE:${estimate.reason}`
      });
    } else {
      lines.push({
        kind: 'tts',
        label: `配音 ${characters} 字符`,
        modelId: null,
        characters,
        amountUsd: null,
        status: resolution.reason === 'no_capability_match' ? 'provider_not_configured' : 'provider_access_required',
        note: '目录中没有可用的语音模型，无法计算费用'
      });
    }
  }

  lines.push({
    kind: 'local_compute',
    label: '本地图片/视频合成',
    modelId: null,
    amountUsd: 0,
    status: 'ready',
    note: 'Sharp + FFmpeg 自建算力，不产生供应商费用'
  });

  const providerLines = lines.filter(line => line.kind !== 'local_compute');
  const unpriced = providerLines.filter(line => line.amountUsd === null);
  const status: AiAdCostEstimate['status'] = unpriced.length === 0
    ? 'priced'
    : unpriced.some(line => line.modelId === null)
      ? 'provider_not_configured'
      : 'price_not_configured';
  const totalUsd = status === 'priced'
    ? providerLines.reduce((total, line) => total + (line.amountUsd ?? 0), 0)
    : null;

  return {
    status,
    currency: 'USD',
    amountMinor: totalUsd === null ? null : Math.ceil(totalUsd * 100),
    amountUsd: totalUsd,
    resolutionKey,
    lines,
    computedAt: now.toISOString()
  };
}

export type AiAdPlanningOptions = {
  goal: AiAdGoal;
  language: AiAdLanguage;
  aspectRatio: AiAdAspectRatio;
  priceDisclosure: 'allowed' | 'none';
  resolutionKey: string;
};

export type AiAdConceptCopy = {
  route: AiAdRoute;
  title: string;
  audience: string;
  hook: string;
  cta: string;
  hashtags: string[];
  scenes: Array<{ voiceover: string; onScreenText: string | null; visual: string }>;
};

/**
 * 一次调用生成三套方案（省钱、可比较）：结构固定为三条路线，模型只填文案与画面描述。
 * 文案里不允许出现简报之外的数字/价格，系统提示明确要求「缺失就留空，不要编」。
 */
export function buildAiAdConceptPrompt(input: {
  brief: AiAdBrief;
  options: AiAdPlanningOptions;
}): {
  prompt: string;
  systemPrompt: string;
  responseFormat: { type: 'object'; additionalProperties: false; required: string[]; properties: Record<string, unknown> };
} {
  const { brief, options } = input;
  const routeBrief = AI_AD_ROUTES.map(route => {
    const template = AI_AD_ROUTE_TEMPLATES[route];
    const shotLines = template.shots.map((shot, index) =>
      `  - shot ${index + 1}: ${shot.durationMs}ms, ${shot.framing}, ${shot.camera}, source=${shot.source}, intent=${shot.intent}`
    );
    return `${route} (${AI_AD_ROUTE_LABELS[route]}), total ${template.durationMs}ms\n${shotLines.join('\n')}`;
  }).join('\n');

  const prompt = [
    'Product brief (authoritative, untrusted text below the marker):',
    '---BEGIN BRIEF---',
    describeAiAdBriefForPrompt(brief),
    '---END BRIEF---',
    `Goal: ${options.goal}`,
    `Output language: ${options.language}`,
    `Aspect ratio: ${options.aspectRatio}`,
    `Price disclosure: ${options.priceDisclosure === 'allowed' ? 'may state the price exactly as given' : 'must not mention any price or currency'}`,
    'Write exactly three advertising concepts, one per route, with the fixed shot counts below:',
    routeBrief,
    'Return scenes aligned 1:1 with the shots of each route (same count, same order).'
  ].join('\n');

  const systemPrompt = [
    'You are a fashion advertising planner for a wholesale merchant tool.',
    'Use ONLY facts from the brief. Never invent numbers, prices, discounts, certifications, materials, origins or claims.',
    'If a fact is missing, write copy that does not mention it.',
    'No emoji, no watermarks, no medical or legal claims, no competitor names.',
    'Each route must be a genuinely different creative direction: product film, creator-style UGC, and low-cost local template ad.',
    'Write natural, concrete copy in the requested language.'
  ].join('\n');

  return {
    prompt,
    systemPrompt,
    responseFormat: {
      type: 'object',
      additionalProperties: false,
      required: ['concepts'],
      properties: {
        concepts: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['route', 'title', 'audience', 'hook', 'cta', 'hashtags', 'scenes'],
            properties: {
              route: { type: 'string', enum: [...AI_AD_ROUTES] },
              title: { type: 'string' },
              audience: { type: 'string' },
              hook: { type: 'string' },
              cta: { type: 'string' },
              hashtags: { type: 'array', items: { type: 'string' } },
              scenes: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['voiceover', 'onScreenText', 'visual'],
                  properties: {
                    voiceover: { type: 'string' },
                    onScreenText: { type: ['string', 'null'] },
                    visual: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    }
  };
}

const HASH_TAG_PATTERN = /^[\p{L}\p{N}_]{2,40}$/u;

/** 解析并校验模型返回；任何结构偏差都直接失败，不修补。 */
export function parseAiAdConceptCopyResponse(raw: string): AiAdConceptCopy[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('AI_TOOLS_PROVIDER_RESPONSE_INVALID');
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.concepts)) throw new Error('AI_TOOLS_PROVIDER_RESPONSE_INVALID');

  const copies: AiAdConceptCopy[] = [];
  for (const item of parsed.concepts) {
    if (!isRecord(item) || !isAiAdRoute(item.route)) throw new Error('AI_TOOLS_PROVIDER_RESPONSE_INVALID');
    const route = item.route;
    const title = readBoundedString(item.title, 2, 160);
    const audience = readBoundedString(item.audience, 2, 300);
    const hook = readBoundedString(item.hook, 2, 240);
    const cta = readBoundedString(item.cta, 2, 160);
    if (!title || !audience || !hook || !cta) throw new Error('AI_TOOLS_PROVIDER_RESPONSE_INVALID');

    const hashtags = Array.isArray(item.hashtags)
      ? item.hashtags
        .filter((tag): tag is string => typeof tag === 'string')
        .map(tag => tag.replace(/^#/, '').trim())
        .filter(tag => HASH_TAG_PATTERN.test(tag))
        .slice(0, 10)
      : [];
    if (!Array.isArray(item.scenes) || item.scenes.length !== AI_AD_ROUTE_TEMPLATES[route].shots.length) {
      throw new Error('AI_TOOLS_PROVIDER_RESPONSE_INVALID');
    }
    const scenes: AiAdConceptCopy['scenes'] = [];
    for (const scene of item.scenes) {
      if (!isRecord(scene)) throw new Error('AI_TOOLS_PROVIDER_RESPONSE_INVALID');
      const voiceover = readBoundedString(scene.voiceover, 1, 400);
      const visual = readBoundedString(scene.visual, 1, 300);
      if (!voiceover || !visual) throw new Error('AI_TOOLS_PROVIDER_RESPONSE_INVALID');
      const rawOnScreen = scene.onScreenText;
      const onScreenText = rawOnScreen === null || rawOnScreen === undefined
        ? null
        : readBoundedString(rawOnScreen, 1, 120);
      if (rawOnScreen !== null && rawOnScreen !== undefined && !onScreenText) {
        throw new Error('AI_TOOLS_PROVIDER_RESPONSE_INVALID');
      }
      scenes.push({ voiceover, onScreenText, visual });
    }
    copies.push({ route, title, audience, hook, cta, hashtags, scenes });
  }

  const routes = new Set(copies.map(copy => copy.route));
  if (copies.length !== AI_AD_ROUTES.length || routes.size !== AI_AD_ROUTES.length) {
    throw new Error('AI_TOOLS_PROVIDER_RESPONSE_INVALID');
  }
  return copies;
}


export type AiAdConceptBuildFailure =
  | { ok: false; reason: 'AI_AD_FACT_UNGROUNDED'; details: Array<{ conceptKey: string; tokens: string[] }> }
  | { ok: false; reason: 'AI_AD_CONCEPTS_INCOMPLETE'; details: string[] };

/**
 * 把模型文案装配成完整方案：分镜结构、时长、字幕、预算、供应商状态全部由代码确定，
 * 模型只贡献 hook/audience/cta/画面描述/配音。事实校验失败时整份方案不落地。
 */
export function assembleAiAdConcepts(input: {
  brief: AiAdBrief;
  whitelist: AiAdFactWhitelist;
  copies: AiAdConceptCopy[];
  options: AiAdPlanningOptions;
  providerStatus: AiAdProviderStatus;
  catalog: AiProviderCatalog;
  tier?: AiProviderTier;
  now?: Date;
}): { ok: true; concepts: AiAdConcept[] } | AiAdConceptBuildFailure {
  const now = input.now ?? new Date();
  const byRoute = new Map(input.copies.map(copy => [copy.route, copy]));
  const missingRoutes = AI_AD_ROUTES.filter(route => !byRoute.has(route));
  if (missingRoutes.length) return { ok: false, reason: 'AI_AD_CONCEPTS_INCOMPLETE', details: missingRoutes };

  const priceKnown = input.brief.price.minor !== null;
  const priceDecimal = priceKnown ? (input.brief.price.minor! / 100).toFixed(2) : null;
  const violations: Array<{ conceptKey: string; tokens: string[] }> = [];
  const concepts: AiAdConcept[] = [];

  for (const route of AI_AD_ROUTES) {
    const copy = byRoute.get(route)!;
    const template = AI_AD_ROUTE_TEMPLATES[route];
    const storyboard: AiAdStoryboardShot[] = template.shots.map((shot, index) => ({
      shotId: `${route}-s${index + 1}`,
      order: index,
      durationMs: shot.durationMs,
      framing: shot.framing,
      camera: shot.camera,
      source: shot.source,
      visual: copy.scenes[index].visual,
      voiceover: copy.scenes[index].voiceover,
      subtitle: copy.scenes[index].onScreenText
    }));

    const copyText = [
      copy.title,
      copy.audience,
      copy.hook,
      copy.cta,
      copy.hashtags.join(' '),
      ...copy.scenes.flatMap(scene => [scene.voiceover, scene.onScreenText ?? '', scene.visual])
    ].join('\n');
    const tokens = findUngroundedAiAdFacts(copyText, input.whitelist, { priceKnown });
    // 广告不报价时，即使价格已知也不能出现金额，否则等于擅自对外报价。
    if (input.options.priceDisclosure === 'none' && priceDecimal && copyText.includes(priceDecimal)) {
      if (!tokens.includes('price')) tokens.push('price');
    }
    if (tokens.length) violations.push({ conceptKey: route, tokens });

    const costEstimate = estimateAiAdTimelineCost({
      shots: storyboard,
      catalog: input.catalog,
      providerStatus: input.providerStatus,
      resolutionKey: input.options.resolutionKey,
      tier: input.tier,
      now
    });

    concepts.push({
      conceptKey: route,
      route,
      goal: input.options.goal,
      title: copy.title,
      audience: copy.audience,
      hook: copy.hook,
      cta: copy.cta,
      language: input.options.language,
      aspectRatio: input.options.aspectRatio,
      hashtags: copy.hashtags,
      durationMs: template.durationMs,
      script: copy.scenes.map((scene, index) => ({
        scene: index + 1,
        voiceover: scene.voiceover,
        onScreenText: scene.onScreenText
      })),
      storyboard,
      providerStatus: input.providerStatus,
      costEstimate,
      copySource: 'provider'
    });
  }

  if (violations.length) return { ok: false, reason: 'AI_AD_FACT_UNGROUNDED', details: violations };
  return { ok: true, concepts };
}


const FRAMINGS: readonly AiAdFraming[] = ['wide', 'medium', 'close', 'macro'];
const CAMERA_MOVES: readonly AiAdCameraMove[] = ['static', 'push_in', 'pan', 'orbit'];
const SHOT_SOURCES: readonly AiAdShotSource[] = ['ai_video', 'product_image', 'local_motion'];
const SHOT_TRANSITIONS: readonly AiAdShotTransition[] = ['cut', 'fade', 'slide'];
const SHOT_CROPS: readonly AiAdShotCrop[] = ['none', 'tight', 'wide'];
const SHOT_POSITIONS: readonly AiAdShotPosition[] = ['center', 'top', 'bottom'];

/** 可选剪辑参数：缺省时不写入对象，保证旧分镜重新校验后哈希不变。 */
function readOptionalShotStyle(item: Record<string, unknown>): Pick<
  AiAdStoryboardShot,
  'transition' | 'speed' | 'crop' | 'position' | 'directionNote'
> {
  const style: Pick<AiAdStoryboardShot, 'transition' | 'speed' | 'crop' | 'position' | 'directionNote'> = {};
  const transition = item.transition;
  if (transition !== undefined && transition !== null) {
    if (!SHOT_TRANSITIONS.includes(transition as AiAdShotTransition)) throw new Error('AI_AD_SCRIPT_INVALID');
    style.transition = transition as AiAdShotTransition;
  }
  const speed = item.speed;
  if (speed !== undefined && speed !== null) {
    if (typeof speed !== 'number' || !Number.isFinite(speed) || speed < 0.5 || speed > 2) {
      throw new Error('AI_AD_SCRIPT_INVALID');
    }
    style.speed = Math.round(speed * 10) / 10;
  }
  const crop = item.crop;
  if (crop !== undefined && crop !== null) {
    if (!SHOT_CROPS.includes(crop as AiAdShotCrop)) throw new Error('AI_AD_SCRIPT_INVALID');
    style.crop = crop as AiAdShotCrop;
  }
  const position = item.position;
  if (position !== undefined && position !== null) {
    if (!SHOT_POSITIONS.includes(position as AiAdShotPosition)) throw new Error('AI_AD_SCRIPT_INVALID');
    style.position = position as AiAdShotPosition;
  }
  const directionNote = item.directionNote;
  if (directionNote !== undefined && directionNote !== null) {
    const note = readBoundedString(directionNote, 1, 200);
    if (!note) throw new Error('AI_AD_SCRIPT_INVALID');
    style.directionNote = note;
  }
  return style;
}

export function assertAiAdShotList(value: unknown): AiAdStoryboardShot[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 24) throw new Error('AI_AD_SCRIPT_INVALID');
  const seen = new Set<string>();
  const shots: AiAdStoryboardShot[] = [];
  for (const item of value) {
    if (!isRecord(item)) throw new Error('AI_AD_SCRIPT_INVALID');
    const shotId = readBoundedString(item.shotId, 1, 64);
    const durationMs = item.durationMs;
    const framing = item.framing;
    const camera = item.camera;
    const source = item.source;
    const visual = readBoundedString(item.visual, 1, 300);
    const voiceover = typeof item.voiceover === 'string' ? item.voiceover.trim().slice(0, 400) : '';
    const subtitle = item.subtitle === null || item.subtitle === undefined
      ? null
      : readBoundedString(item.subtitle, 1, 120);
    if (!shotId || seen.has(shotId)) throw new Error('AI_AD_SHOT_NOT_FOUND');
    if (typeof durationMs !== 'number' || !Number.isInteger(durationMs) || durationMs < 500 || durationMs > 30_000) {
      throw new Error('AI_AD_SCRIPT_INVALID');
    }
    if (!FRAMINGS.includes(framing as AiAdFraming)) throw new Error('AI_AD_SCRIPT_INVALID');
    if (!CAMERA_MOVES.includes(camera as AiAdCameraMove)) throw new Error('AI_AD_SCRIPT_INVALID');
    if (!SHOT_SOURCES.includes(source as AiAdShotSource)) throw new Error('AI_AD_SCRIPT_INVALID');
    if (!visual) throw new Error('AI_AD_SCRIPT_INVALID');
    seen.add(shotId);
    shots.push({
      shotId,
      order: shots.length,
      durationMs,
      framing: framing as AiAdFraming,
      camera: camera as AiAdCameraMove,
      source: source as AiAdShotSource,
      visual,
      voiceover,
      subtitle,
      ...readOptionalShotStyle(item)
    });
  }
  return shots;
}

function scriptFromStoryboard(storyboard: ReadonlyArray<AiAdStoryboardShot>): AiAdScriptScene[] {
  return storyboard.map((shot, index) => ({
    scene: index + 1,
    voiceover: shot.voiceover,
    onScreenText: shot.subtitle
  }));
}

function applyScriptToStoryboard(
  storyboard: ReadonlyArray<AiAdStoryboardShot>,
  value: unknown
): AiAdStoryboardShot[] {
  if (!Array.isArray(value) || value.length !== storyboard.length) throw new Error('AI_AD_SCRIPT_INVALID');
  return storyboard.map((shot, index) => {
    const scene = value[index];
    if (!isRecord(scene)) throw new Error('AI_AD_SCRIPT_INVALID');
    const voiceover = typeof scene.voiceover === 'string' ? scene.voiceover.trim().slice(0, 400) : null;
    if (voiceover === null) throw new Error('AI_AD_SCRIPT_INVALID');
    const onScreenText = scene.onScreenText === null || scene.onScreenText === undefined
      ? null
      : readBoundedString(scene.onScreenText, 1, 120);
    return { ...shot, voiceover, subtitle: onScreenText };
  });
}

/**
 * 编辑分镜/脚本/顺序：所有编辑都落到同一份分镜数组上，再用分镜派生脚本，
 * 避免脚本与镜头两份数据口径不一致（配音只存一处）。
 */
export function applyAiAdTimelineEdit(input: {
  base: { script: AiAdScriptScene[]; storyboard: AiAdStoryboardShot[] };
  script?: unknown;
  storyboard?: unknown;
  reorder?: unknown;
  updateShot?: unknown;
}): { script: AiAdScriptScene[]; storyboard: AiAdStoryboardShot[] } {
  let storyboard = input.storyboard === undefined
    ? input.base.storyboard.map(shot => ({ ...shot }))
    : assertAiAdShotList(input.storyboard);

  if (input.reorder !== undefined) {
    if (!Array.isArray(input.reorder)) throw new Error('AI_AD_SCRIPT_INVALID');
    const requested = input.reorder.map(item => (typeof item === 'string' ? item : ''));
    const existing = new Set(storyboard.map(shot => shot.shotId));
    if (requested.length !== storyboard.length) throw new Error('AI_AD_SCRIPT_INVALID');
    if (new Set(requested).size !== requested.length) throw new Error('AI_AD_SCRIPT_INVALID');
    for (const shotId of requested) if (!existing.has(shotId)) throw new Error('AI_AD_SHOT_NOT_FOUND');
    const byId = new Map(storyboard.map(shot => [shot.shotId, shot]));
    storyboard = requested.map((shotId, index) => ({ ...byId.get(shotId)!, order: index }));
  }

  if (input.updateShot !== undefined) {
    if (!isRecord(input.updateShot)) throw new Error('AI_AD_SCRIPT_INVALID');
    const shotId = readBoundedString(input.updateShot.shotId, 1, 64);
    if (!shotId) throw new Error('AI_AD_SHOT_NOT_FOUND');
    const index = storyboard.findIndex(shot => shot.shotId === shotId);
    if (index < 0) throw new Error('AI_AD_SHOT_NOT_FOUND');
    const rawPatch = isRecord(input.updateShot.patch) ? input.updateShot.patch : {};
    const patch: Record<string, unknown> = {};
    for (const key of [
      'durationMs',
      'visual',
      'voiceover',
      'subtitle',
      'framing',
      'camera',
      'transition',
      'speed',
      'crop',
      'position',
      'directionNote'
    ]) {
      if (rawPatch[key] !== undefined) patch[key] = rawPatch[key];
    }
    storyboard = assertAiAdShotList([
      ...storyboard.slice(0, index).map(shot => ({ ...shot })),
      { ...storyboard[index], ...patch },
      ...storyboard.slice(index + 1).map(shot => ({ ...shot }))
    ]);
  }

  if (input.script !== undefined) storyboard = applyScriptToStoryboard(storyboard, input.script);

  const totalMs = storyboard.reduce((total, shot) => total + shot.durationMs, 0);
  if (totalMs <= 0) throw new Error('AI_AD_SCRIPT_INVALID');
  return { storyboard, script: scriptFromStoryboard(storyboard) };
}


export type AiAdConceptInputShape = {
  conceptKey: string;
  route: AiAdRoute;
  goal: AiAdGoal;
  title: string;
  audience: string;
  hook: string;
  cta: string;
  language: AiAdLanguage;
  aspectRatio: AiAdAspectRatio;
  hashtags: string[];
  durationMs: number;
  script: AiAdScriptScene[];
  storyboard: AiAdStoryboardShot[];
  providerStatus: AiAdProviderStatus;
  costEstimate: AiAdCostEstimate;
};

const LANGUAGES: readonly string[] = ['it', 'en', 'zh'];
const ASPECT_RATIOS: readonly string[] = ['9:16', '1:1', '16:9'];

/**
 * 校验客户端回传的方案（商家可能改过标题后才建工程）。
 * 只接受服务器能自证的结构：分镜走同一套时长/景别校验，时长由分镜重新求和。
 */
export function validateAiAdConceptPayload(value: unknown): AiAdConceptInputShape {
  if (!isRecord(value)) throw new Error('AI_AD_CONCEPT_INVALID');
  const conceptKey = readBoundedString(value.conceptKey, 1, 32);
  const route = value.route;
  const goal = value.goal;
  const title = readBoundedString(value.title, 2, 160);
  const audience = readBoundedString(value.audience, 2, 300);
  const hook = readBoundedString(value.hook, 2, 240);
  const cta = readBoundedString(value.cta, 2, 160);
  const language = typeof value.language === 'string' && LANGUAGES.includes(value.language) ? value.language : null;
  const aspectRatio = typeof value.aspectRatio === 'string' && ASPECT_RATIOS.includes(value.aspectRatio)
    ? value.aspectRatio
    : null;
  if (!conceptKey || !isAiAdRoute(route) || !isAiAdGoal(goal)) throw new Error('AI_AD_CONCEPT_INVALID');
  if (!title || !audience || !hook || !cta || !language || !aspectRatio) throw new Error('AI_AD_CONCEPT_INVALID');
  if (!isRecord(value.costEstimate) || !isRecord(value.providerStatus)) throw new Error('AI_AD_CONCEPT_INVALID');
  const storyboard = assertAiAdShotList(value.storyboard);
  const hashtags = Array.isArray(value.hashtags)
    ? value.hashtags.filter((tag): tag is string => typeof tag === 'string').slice(0, 10)
    : [];
  return {
    conceptKey,
    route,
    goal,
    title,
    audience,
    hook,
    cta,
    language: language as AiAdLanguage,
    aspectRatio: aspectRatio as AiAdAspectRatio,
    hashtags,
    durationMs: storyboard.reduce((total, shot) => total + shot.durationMs, 0),
    script: scriptFromStoryboard(storyboard),
    storyboard,
    providerStatus: value.providerStatus as unknown as AiAdProviderStatus,
    costEstimate: value.costEstimate as unknown as AiAdCostEstimate
  };
}

/** 版本幂等键：同一方案内容重复保存不再产生新版本。 */
export function hashAiAdContent(input: {
  conceptKey: string;
  script: unknown;
  storyboard: unknown;
}): string {
  return createHash('sha256').update(JSON.stringify({
    conceptKey: input.conceptKey,
    script: input.script,
    storyboard: input.storyboard
  })).digest('hex');
}

/** 简报快照哈希，用于识别「商品资料已变更但工程仍是旧简报」。 */
export function hashAiAdBrief(brief: AiAdBrief): string {
  return createHash('sha256').update(JSON.stringify(brief)).digest('hex');
}

export function isAiAdLanguage(value: unknown): value is AiAdLanguage {
  return typeof value === 'string' && LANGUAGES.includes(value);
}

export function isAiAdAspectRatio(value: unknown): value is AiAdAspectRatio {
  return typeof value === 'string' && ASPECT_RATIOS.includes(value);
}

/** 只允许目录里真实存在的视频分辨率键，避免把任意字符串当成价格档位。 */
export const AI_AD_RESOLUTION_KEYS = ['480p', '720p', '1080p'] as const;
export type AiAdResolutionKey = (typeof AI_AD_RESOLUTION_KEYS)[number];

export function isAiAdResolutionKey(value: unknown): value is AiAdResolutionKey {
  return typeof value === 'string' && (AI_AD_RESOLUTION_KEYS as readonly string[]).includes(value);
}

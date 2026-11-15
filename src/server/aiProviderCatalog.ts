/**
 * MODAUI AI Provider Gateway — 供应商与模型目录（纯逻辑，无 Prisma / 无网络）。
 *
 * 规则（见 docs/engineering/architecture/MODaUI-AI-TOOLS-PLATFORM.md §5）：
 * - 业务代码**不得**写死模型 ID；只能按「能力 + 档位」向本目录解析。
 * - 价格是运营参数，不是代码常量：默认值只是初始种子，可用 `AI_PROVIDER_CATALOG_JSON`
 *   覆盖（见 `applyAiProviderCatalogOverride`），改价不需要改代码发版。
 * - 缺少价格的模型一律不可核算成本，成本核算返回失败，**不允许**按 0 成本记账。
 * - API Key 不进入本目录，也不进入任何返回值；本文件只描述「用什么、多少钱、能用在哪」。
 */

export const AI_PROVIDER_IDS = [
  'deepseek',
  'gemini',
  'runway',
  'runpod',
  'openai',
  'google_tts',
  'brave',
  'local'
] as const;

export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

/** 模型能力标签：路由只按能力匹配，不按模型名字符串匹配。 */
export const AI_PROVIDER_CAPABILITIES = [
  'text',
  'reasoning',
  'vision',
  'tool_call',
  'json',
  'long_context',
  'image_generate',
  'image_edit',
  'video_generate',
  'tts',
  'asr',
  'search'
] as const;

export type AiProviderCapability = (typeof AI_PROVIDER_CAPABILITIES)[number];

/** 成本档位：经济 / 均衡 / 专业（§8 自动路由使用）。 */
export const AI_PROVIDER_TIERS = ['economy', 'balanced', 'pro'] as const;
export type AiProviderTier = (typeof AI_PROVIDER_TIERS)[number];

/**
 * 数据合规分级，决定商家私密素材能否发给该供应商（§10）：
 * - self_hosted：自建，数据不出服务器。
 * - commercial_paid：付费商业条款，仍需附 DPA 审查结果。
 * - free_tier：免费层，条款通常允许用于改进服务，**不得**用于商家保密资料。
 */
export const AI_DATA_POLICIES = ['self_hosted', 'commercial_paid', 'free_tier'] as const;
export type AiDataPolicy = (typeof AI_DATA_POLICIES)[number];

export type AiModelStatus = 'active' | 'degraded' | 'disabled';

/** 文本类计价：美元 / 百万 Token，分缓存命中、未命中、输出三档。 */
export type AiTokenRates = {
  cacheHitInput: number;
  cacheMissInput: number;
  output: number;
};

export type AiModelPricing =
  | { kind: 'token'; offPeak: AiTokenRates; peak?: AiTokenRates }
  | { kind: 'image'; perImageUsd: Record<string, number> }
  | { kind: 'video'; perSecondUsd: Record<string, number> }
  | { kind: 'tts'; perMillionCharsUsd: number }
  | { kind: 'asr'; perMinuteUsd: number }
  | { kind: 'search'; perThousandRequestsUsd: number }
  | { kind: 'compute'; note: string };

export type AiProviderModel = {
  providerId: AiProviderId;
  modelId: string;
  modelVersion: string;
  label: string;
  capabilities: AiProviderCapability[];
  tier: AiProviderTier;
  pricing: AiModelPricing;
  timeoutMs: number;
  retry: { maxAttempts: number; backoffMs: number };
  dataPolicy: AiDataPolicy;
  supportedRegions: string[];
  status: AiModelStatus;
  /** 需要哪些凭据才能启用（仅名称，不含任何密钥值）。 */
  credentials: string[];
};

export type AiProviderCatalog = {
  /** 目录版本，用于审计「这次调用用的是哪份价目表」。 */
  version: string;
  updatedAt: string;
  models: AiProviderModel[];
};


function textModel(
  providerId: AiProviderId,
  modelId: string,
  label: string,
  capabilities: AiProviderCapability[],
  tier: AiProviderTier,
  offPeak: AiTokenRates,
  credentials: string[]
): AiProviderModel {
  return {
    providerId,
    modelId,
    modelVersion: modelId,
    label,
    capabilities,
    tier,
    // 高峰价尚未确认：留空，成本核算会明确拒绝而不是猜一个数字。
    pricing: { kind: 'token', offPeak },
    timeoutMs: 30_000,
    retry: { maxAttempts: 2, backoffMs: 800 },
    dataPolicy: 'commercial_paid',
    supportedRegions: ['eu', 'global'],
    status: 'active',
    credentials
  };
}

/**
 * 初始目录种子。
 *
 * 价格来自供应商 2026-10-30 公开报价（DeepSeek 为非高峰价），**仅作初始值**：
 * 实际结算以账户账单、使用时段和模型规格为准，运营通过 `AI_PROVIDER_CATALOG_JSON` 覆盖。
 */
export function createDefaultAiProviderCatalog(): AiProviderCatalog {
  return {
    version: '2026-10-30.1',
    updatedAt: '2026-10-30T00:00:00.000Z',
    models: [
      textModel(
        'deepseek',
        'deepseek-flash',
        'DeepSeek Flash',
        ['text', 'vision', 'tool_call', 'json', 'long_context'],
        'economy',
        { cacheHitInput: 0.003, cacheMissInput: 0.15, output: 0.6 },
        ['DEEPSEEK_API_KEY']
      ),
      textModel(
        'deepseek',
        'deepseek-v4-pro',
        'DeepSeek V4 Pro',
        ['text', 'reasoning', 'tool_call', 'json', 'long_context'],
        'pro',
        { cacheHitInput: 0.022, cacheMissInput: 0.66, output: 1.98 },
        ['DEEPSEEK_API_KEY']
      ),
      textModel(
        'gemini',
        'gemini-3.1-flash-lite',
        'Gemini 3.1 Flash Lite',
        ['text', 'vision', 'json', 'long_context'],
        'economy',
        { cacheHitInput: 0, cacheMissInput: 0.1, output: 0.4 },
        ['GEMINI_API_KEY']
      ),
      {
        providerId: 'gemini',
        modelId: 'gemini-3.1-flash-lite-image',
        modelVersion: 'gemini-3.1-flash-lite-image',
        label: 'Gemini 3.1 Flash Lite Image',
        capabilities: ['image_generate', 'image_edit', 'vision'],
        tier: 'economy',
        pricing: { kind: 'image', perImageUsd: { '1k': 0.0336, '2k': 0.0672 } },
        timeoutMs: 90_000,
        retry: { maxAttempts: 2, backoffMs: 1_500 },
        dataPolicy: 'commercial_paid',
        supportedRegions: ['eu', 'global'],
        status: 'active',
        credentials: ['GEMINI_API_KEY']
      },
      {
        providerId: 'gemini',
        modelId: 'gemini-3.1-flash-image',
        modelVersion: 'gemini-3.1-flash-image',
        label: 'Gemini 3.1 Flash Image',
        capabilities: ['image_generate', 'image_edit', 'vision'],
        tier: 'balanced',
        pricing: { kind: 'image', perImageUsd: { '1k': 0.067, '2k': 0.134 } },
        timeoutMs: 120_000,
        retry: { maxAttempts: 2, backoffMs: 1_500 },
        dataPolicy: 'commercial_paid',
        supportedRegions: ['eu', 'global'],
        status: 'active',
        credentials: ['GEMINI_API_KEY']
      },
      {
        providerId: 'runway',
        modelId: 'grok_imagine_1_5_lite',
        modelVersion: 'grok_imagine_1_5_lite',
        label: 'Grok Imagine 1.5 Lite (Runway)',
        capabilities: ['video_generate'],
        tier: 'economy',
        pricing: { kind: 'video', perSecondUsd: { '480p': 0.02, '720p': 0.03, '1080p': 0.14 } },
        timeoutMs: 300_000,
        retry: { maxAttempts: 1, backoffMs: 0 },
        dataPolicy: 'commercial_paid',
        supportedRegions: ['eu', 'global'],
        status: 'active',
        credentials: ['RUNWAY_API_KEY']
      },
      {
        providerId: 'runway',
        modelId: 'wan3',
        modelVersion: 'wan3',
        label: 'WAN 3.0 (Runway)',
        capabilities: ['video_generate'],
        tier: 'balanced',
        pricing: { kind: 'video', perSecondUsd: { '480p': 0.05, '720p': 0.1, '1080p': 0.2 } },
        timeoutMs: 300_000,
        retry: { maxAttempts: 1, backoffMs: 0 },
        dataPolicy: 'commercial_paid',
        supportedRegions: ['eu', 'global'],
        status: 'active',
        credentials: ['RUNWAY_API_KEY']
      },
      {
        providerId: 'google_tts',
        modelId: 'google-tts-wavenet',
        modelVersion: 'google-tts-wavenet',
        label: 'Google Cloud TTS WaveNet',
        capabilities: ['tts'],
        tier: 'economy',
        pricing: { kind: 'tts', perMillionCharsUsd: 4 },
        timeoutMs: 60_000,
        retry: { maxAttempts: 2, backoffMs: 800 },
        dataPolicy: 'commercial_paid',
        supportedRegions: ['eu', 'global'],
        status: 'active',
        credentials: ['GOOGLE_TTS_API_KEY']
      },
      {
        providerId: 'google_tts',
        modelId: 'google-tts-neural2',
        modelVersion: 'google-tts-neural2',
        label: 'Google Cloud TTS Neural2',
        capabilities: ['tts'],
        tier: 'balanced',
        pricing: { kind: 'tts', perMillionCharsUsd: 16 },
        timeoutMs: 60_000,
        retry: { maxAttempts: 2, backoffMs: 800 },
        dataPolicy: 'commercial_paid',
        supportedRegions: ['eu', 'global'],
        status: 'active',
        credentials: ['GOOGLE_TTS_API_KEY']
      },
      {
        providerId: 'google_tts',
        modelId: 'google-tts-chirp3-hd',
        modelVersion: 'google-tts-chirp3-hd',
        label: 'Google Cloud TTS Chirp 3 HD',
        capabilities: ['tts'],
        tier: 'pro',
        pricing: { kind: 'tts', perMillionCharsUsd: 30 },
        timeoutMs: 60_000,
        retry: { maxAttempts: 2, backoffMs: 800 },
        dataPolicy: 'commercial_paid',
        supportedRegions: ['eu', 'global'],
        status: 'active',
        credentials: ['GOOGLE_TTS_API_KEY']
      },
      {
        providerId: 'openai',
        modelId: 'gpt-transcribe',
        modelVersion: 'gpt-transcribe',
        label: 'GPT-Transcribe',
        capabilities: ['asr'],
        tier: 'economy',
        pricing: { kind: 'asr', perMinuteUsd: 0.0045 },
        timeoutMs: 120_000,
        retry: { maxAttempts: 2, backoffMs: 1_000 },
        dataPolicy: 'commercial_paid',
        supportedRegions: ['eu', 'global'],
        status: 'active',
        credentials: ['OPENAI_API_KEY']
      },
      {
        providerId: 'runpod',
        modelId: 'z-image-turbo',
        modelVersion: 'z-image-turbo',
        label: 'Z-Image Turbo (Runpod Public)',
        capabilities: ['image_generate'],
        tier: 'economy',
        // Runpod 公共端点按「张」计费，不随分辨率浮动：两档都给同一价，避免把 2k 当无价。
        pricing: { kind: 'image', perImageUsd: { '1k': 0.005, '2k': 0.005 } },
        timeoutMs: 90_000,
        retry: { maxAttempts: 1, backoffMs: 0 },
        dataPolicy: 'commercial_paid',
        supportedRegions: ['global'],
        status: 'active',
        credentials: ['RUNPOD_API_KEY']
      },
      {
        providerId: 'runpod',
        modelId: 'qwen-image',
        modelVersion: 'qwen-image',
        label: 'Qwen Image (Runpod Public)',
        capabilities: ['image_generate', 'image_edit'],
        tier: 'balanced',
        pricing: { kind: 'image', perImageUsd: { '1k': 0.02, '2k': 0.02 } },
        timeoutMs: 120_000,
        retry: { maxAttempts: 1, backoffMs: 0 },
        dataPolicy: 'commercial_paid',
        supportedRegions: ['global'],
        status: 'active',
        credentials: ['RUNPOD_API_KEY']
      },
      {
        providerId: 'runpod',
        modelId: 'wan-2-6-i2v',
        modelVersion: 'wan-2-6-i2v',
        label: 'WAN 2.6 I2V (Runpod Public)',
        capabilities: ['video_generate'],
        tier: 'pro',
        // 公开报价只给了 720p/1080p：480p 不登记，估不到价就拒绝，不猜。
        pricing: { kind: 'video', perSecondUsd: { '720p': 0.1, '1080p': 0.15 } },
        timeoutMs: 300_000,
        retry: { maxAttempts: 1, backoffMs: 0 },
        dataPolicy: 'commercial_paid',
        supportedRegions: ['global'],
        status: 'active',
        credentials: ['RUNPOD_API_KEY']
      },
      {
        providerId: 'runpod',
        modelId: 'wan-2-2-i2v',
        modelVersion: 'wan-2-2-i2v',
        label: 'WAN 2.2 I2V 720p (Runpod Public)',
        capabilities: ['video_generate'],
        tier: 'economy',
        pricing: { kind: 'video', perSecondUsd: { '720p': 0.06 } },
        timeoutMs: 300_000,
        retry: { maxAttempts: 1, backoffMs: 0 },
        dataPolicy: 'commercial_paid',
        supportedRegions: ['global'],
        status: 'active',
        credentials: ['RUNPOD_API_KEY']
      },
      {
        providerId: 'runpod',
        modelId: 'wan-2-1-i2v',
        modelVersion: 'wan-2-1-i2v',
        label: 'WAN 2.1 I2V 720p (Runpod Public)',
        capabilities: ['video_generate'],
        tier: 'economy',
        pricing: { kind: 'video', perSecondUsd: { '720p': 0.06 } },
        timeoutMs: 300_000,
        retry: { maxAttempts: 1, backoffMs: 0 },
        dataPolicy: 'commercial_paid',
        supportedRegions: ['global'],
        status: 'active',
        credentials: ['RUNPOD_API_KEY']
      },
      {
        providerId: 'runpod',
        modelId: 'minimax-speech',
        modelVersion: 'minimax-speech',
        label: 'Minimax Speech 02 HD (Runpod Public)',
        capabilities: ['tts'],
        tier: 'economy',
        // $0.05 / 1000 字符 = $50 / 百万字符
        pricing: { kind: 'tts', perMillionCharsUsd: 50 },
        timeoutMs: 90_000,
        retry: { maxAttempts: 1, backoffMs: 0 },
        dataPolicy: 'commercial_paid',
        supportedRegions: ['global'],
        status: 'active',
        credentials: ['RUNPOD_API_KEY']
      },
      {
        providerId: 'local',
        modelId: 'faster-whisper-local',
        modelVersion: 'faster-whisper',
        label: '本地 Whisper 识别',
        capabilities: ['asr'],
        tier: 'economy',
        pricing: { kind: 'compute', note: '自建：按 CPU/GPU 时长折算，不计 API 费用' },
        timeoutMs: 600_000,
        retry: { maxAttempts: 1, backoffMs: 0 },
        dataPolicy: 'self_hosted',
        supportedRegions: ['local'],
        status: 'active',
        credentials: []
      },
      {
        providerId: 'deepseek',
        modelId: 'deepseek-search',
        modelVersion: 'deepseek-search',
        label: 'DeepSeek Search & Fetch',
        capabilities: ['search'],
        tier: 'economy',
        pricing: { kind: 'search', perThousandRequestsUsd: 0.75 },
        timeoutMs: 20_000,
        retry: { maxAttempts: 2, backoffMs: 500 },
        dataPolicy: 'commercial_paid',
        supportedRegions: ['global'],
        status: 'active',
        credentials: ['DEEPSEEK_API_KEY']
      },
      {
        providerId: 'brave',
        modelId: 'brave-search',
        modelVersion: 'brave-search',
        label: 'Brave Search',
        capabilities: ['search'],
        tier: 'balanced',
        pricing: { kind: 'search', perThousandRequestsUsd: 5 },
        timeoutMs: 20_000,
        retry: { maxAttempts: 2, backoffMs: 500 },
        dataPolicy: 'commercial_paid',
        supportedRegions: ['global'],
        status: 'active',
        credentials: ['BRAVE_SEARCH_API_KEY']
      }
    ]
  };
}

/** 覆盖入口：运营只改价目表即可，不需要改代码。 */
export const AI_PROVIDER_CATALOG_ENV_KEY = 'AI_PROVIDER_CATALOG_JSON';

export function findAiProviderModel(catalog: AiProviderCatalog, modelId: string): AiProviderModel | null {
  return catalog.models.find(model => model.modelId === modelId) ?? null;
}

export type AiProviderResolutionFailure =
  | 'no_capability_match'
  | 'no_credential_configured'
  | 'no_data_policy_match';

export type AiProviderResolution =
  | { ok: true; model: AiProviderModel }
  | { ok: false; reason: AiProviderResolutionFailure };

const tierRank: Record<AiProviderTier, number> = { economy: 0, balanced: 1, pro: 2 };

/**
 * 按能力解析可用模型（§8 自动路由的确定性部分）。
 *
 * 只做「谁能用」的筛选，不做网络探测；未配置凭据、数据政策不允许或已停用的模型不会被选中。
 * 同档位时保持目录顺序，保证同一输入在同一份目录下总是选中同一个模型（可审计）。
 */
export function resolveAiProviderModel(input: {
  catalog: AiProviderCatalog;
  capability: AiProviderCapability;
  tier?: AiProviderTier;
  /** 允许的数据合规分级；商家私密素材默认只允许 self_hosted / commercial_paid。 */
  allowedDataPolicies?: readonly AiDataPolicy[];
  /** 当前环境真实存在的凭据名（只比对名称，不读取值）。 */
  availableCredentials?: readonly string[];
  /** 是否允许 degraded 状态的模型兜底；默认不允许。 */
  includeDegraded?: boolean;
}): AiProviderResolution {
  const allowedPolicies = input.allowedDataPolicies ?? AI_DATA_POLICIES;
  const candidates = input.catalog.models.filter(model =>
    model.status === 'active' || (input.includeDegraded && model.status === 'degraded')
  );
  const withCapability = candidates.filter(model => model.capabilities.includes(input.capability));
  if (withCapability.length === 0) return { ok: false, reason: 'no_capability_match' };

  const withPolicy = withCapability.filter(model => allowedPolicies.includes(model.dataPolicy));
  if (withPolicy.length === 0) return { ok: false, reason: 'no_data_policy_match' };

  const credentials = input.availableCredentials;
  const withCredentials = credentials
    ? withPolicy.filter(model => model.credentials.every(key => credentials.includes(key)))
    : withPolicy;
  if (withCredentials.length === 0) return { ok: false, reason: 'no_credential_configured' };

  const targetRank = input.tier ? tierRank[input.tier] : 0;
  const indexOf = (model: AiProviderModel) => withCredentials.indexOf(model);
  const sorted = [...withCredentials].sort((a, b) => {
    const distance = Math.abs(tierRank[a.tier] - targetRank) - Math.abs(tierRank[b.tier] - targetRank);
    return distance !== 0 ? distance : indexOf(a) - indexOf(b);
  });
  return { ok: true, model: sorted[0] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function readTokenRates(value: unknown): AiTokenRates | null {
  if (!isRecord(value)) return null;
  const { cacheHitInput, cacheMissInput, output } = value;
  if (!isNonNegativeNumber(cacheHitInput) || !isNonNegativeNumber(cacheMissInput) || !isNonNegativeNumber(output)) {
    return null;
  }
  return { cacheHitInput, cacheMissInput, output };
}

function readNumberMap(value: unknown): Record<string, number> | null {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value);
  if (entries.length === 0) return null;
  const result: Record<string, number> = {};
  for (const [key, price] of entries) {
    if (!isNonNegativeNumber(price)) return null;
    result[key] = price;
  }
  return result;
}

/** 严格解析价格块；任何一处非法都返回 null，由调用方保留上一版价格。 */
export function parseAiModelPricing(value: unknown): AiModelPricing | null {
  if (!isRecord(value)) return null;
  switch (value.kind) {
    case 'token': {
      const offPeak = readTokenRates(value.offPeak);
      if (!offPeak) return null;
      if (value.peak === undefined) return { kind: 'token', offPeak };
      const peak = readTokenRates(value.peak);
      return peak ? { kind: 'token', offPeak, peak } : null;
    }
    case 'image': {
      const perImageUsd = readNumberMap(value.perImageUsd);
      return perImageUsd ? { kind: 'image', perImageUsd } : null;
    }
    case 'video': {
      const perSecondUsd = readNumberMap(value.perSecondUsd);
      return perSecondUsd ? { kind: 'video', perSecondUsd } : null;
    }
    case 'tts':
      return isNonNegativeNumber(value.perMillionCharsUsd)
        ? { kind: 'tts', perMillionCharsUsd: value.perMillionCharsUsd }
        : null;
    case 'asr':
      return isNonNegativeNumber(value.perMinuteUsd) ? { kind: 'asr', perMinuteUsd: value.perMinuteUsd } : null;
    case 'search':
      return isNonNegativeNumber(value.perThousandRequestsUsd)
        ? { kind: 'search', perThousandRequestsUsd: value.perThousandRequestsUsd }
        : null;
    case 'compute':
      return typeof value.note === 'string' && value.note.trim() ? { kind: 'compute', note: value.note } : null;
    default:
      return null;
  }
}

/**
 * 覆盖目录：只允许修改已存在模型的 `pricing` / `status` / `timeoutMs` / `retry`。
 * 解析失败整体回退到基础目录，绝不半套生效；未知 modelId 记入 issues 但不写库。
 */
export function applyAiProviderCatalogOverride(
  base: AiProviderCatalog,
  raw: unknown
): { ok: true; catalog: AiProviderCatalog; applied: number; issues: string[] } | { ok: false; issues: string[] } {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    if (!raw.trim()) return { ok: true, catalog: base, applied: 0, issues: [] };
    try {
      value = JSON.parse(raw);
    } catch {
      return { ok: false, issues: ['CATALOG_OVERRIDE_INVALID_JSON'] };
    }
  }
  if (!isRecord(value)) return { ok: false, issues: ['CATALOG_OVERRIDE_NOT_OBJECT'] };
  const rawModels = value.models;
  if (!Array.isArray(rawModels)) return { ok: false, issues: ['CATALOG_OVERRIDE_MODELS_INVALID'] };

  const issues: string[] = [];
  const next: AiProviderModel[] = base.models.map(model => ({ ...model }));
  let applied = 0;
  for (const [index, patch] of rawModels.entries()) {
    if (!isRecord(patch) || typeof patch.modelId !== 'string') {
      issues.push(`models[${index}]:MODEL_ID_INVALID`);
      continue;
    }
    const target = next.find(model => model.modelId === patch.modelId);
    if (!target) {
      issues.push(`models[${index}]:MODEL_UNKNOWN`);
      continue;
    }
    let changed = false;
    let invalid = false;
    if (patch.pricing !== undefined) {
      const pricing = parseAiModelPricing(patch.pricing);
      if (pricing) {
        target.pricing = pricing;
        changed = true;
      } else {
        issues.push(`models[${index}]:PRICING_INVALID`);
        invalid = true;
      }
    }
    if (!invalid && patch.status !== undefined) {
      if (['active', 'degraded', 'disabled'].includes(String(patch.status))) {
        target.status = patch.status as AiModelStatus;
        changed = true;
      } else {
        issues.push(`models[${index}]:STATUS_INVALID`);
        invalid = true;
      }
    }
    if (!invalid && patch.timeoutMs !== undefined) {
      if (Number.isSafeInteger(patch.timeoutMs) && (patch.timeoutMs as number) >= 1_000) {
        target.timeoutMs = patch.timeoutMs as number;
        changed = true;
      } else {
        issues.push(`models[${index}]:TIMEOUT_INVALID`);
        invalid = true;
      }
    }
    if (!invalid && patch.retry !== undefined) {
      const retry = patch.retry;
      const valid = isRecord(retry)
        && Number.isSafeInteger(retry.maxAttempts)
        && (retry.maxAttempts as number) >= 1
        && (retry.maxAttempts as number) <= 5
        && Number.isSafeInteger(retry.backoffMs)
        && (retry.backoffMs as number) >= 0;
      if (valid) {
        target.retry = { maxAttempts: retry.maxAttempts as number, backoffMs: retry.backoffMs as number };
        changed = true;
      } else {
        issues.push(`models[${index}]:RETRY_INVALID`);
      }
    }
    if (changed) applied += 1;
  }
  const version = typeof value.version === 'string' && value.version.trim()
    ? value.version.trim().slice(0, 40)
    : `${base.version}+override`;
  return {
    ok: true,
    catalog: { version, updatedAt: new Date().toISOString(), models: next },
    applied,
    issues
  };
}

/** 后台展示用摘要：不含任何密钥，只暴露「用什么模型、什么价、是否可用」。 */
export function summarizeAiProviderCatalog(catalog: AiProviderCatalog) {
  return {
    version: catalog.version,
    updatedAt: catalog.updatedAt,
    models: catalog.models.map(model => ({
      modelId: model.modelId,
      providerId: model.providerId,
      label: model.label,
      capabilities: model.capabilities,
      tier: model.tier,
      status: model.status,
      dataPolicy: model.dataPolicy,
      priceKind: model.pricing.kind,
      credentials: model.credentials
    }))
  };
}

import { maximumModaGptImagePromptLength } from '../shared/modagptImageContract';

export type ModaGptPlan = 'free' | 'pro';
export type ModaGptFeature = 'chat' | 'imageGeneration' | 'tryOn';

export type ModaGptUsage = Record<ModaGptFeature, number>;

export type ModaGptPlanState = {
  plan: ModaGptPlan;
  expiresAt: string | null;
  usageByPeriod: Record<string, Partial<ModaGptUsage>>;
};

export type ModaGptEntitlements = {
  plan: ModaGptPlan;
  expiresAt: string | null;
  period: string;
  quotas: ModaGptUsage;
  usage: ModaGptUsage;
  remaining: ModaGptUsage;
};

export const MODAGPT_PLAN_QUOTAS: Record<ModaGptPlan, ModaGptUsage> = {
  free: { chat: 500, imageGeneration: 0, tryOn: 0 },
  pro: { chat: 5000, imageGeneration: 30, tryOn: 10 }
};

const features: ModaGptFeature[] = ['chat', 'imageGeneration', 'tryOn'];

export function getModaGptPeriod(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function parseModaGptPlanState(settingsJson: string): ModaGptPlanState {
  let settings: unknown;
  try {
    settings = JSON.parse(settingsJson);
  } catch {
    throw new Error('MODAGPT_MERCHANT_SETTINGS_INVALID');
  }
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    throw new Error('MODAGPT_MERCHANT_SETTINGS_INVALID');
  }
  const modagpt = (settings as Record<string, unknown>).modagpt;
  if (modagpt === undefined) return { plan: 'free', expiresAt: null, usageByPeriod: {} };
  if (!modagpt || typeof modagpt !== 'object' || Array.isArray(modagpt)) {
    throw new Error('MODAGPT_PLAN_SETTINGS_INVALID');
  }
  const saved = modagpt as Record<string, unknown>;
  const plan = saved.plan;
  const expiresAt = saved.expiresAt;
  const usageByPeriod = saved.usageByPeriod;
  if (
    (plan !== 'free' && plan !== 'pro')
    || (expiresAt !== null && expiresAt !== undefined
      && (typeof expiresAt !== 'string' || !Number.isFinite(Date.parse(expiresAt))))
    || (usageByPeriod !== undefined && (!usageByPeriod || typeof usageByPeriod !== 'object' || Array.isArray(usageByPeriod)))
  ) throw new Error('MODAGPT_PLAN_SETTINGS_INVALID');
  const validatedUsage: Record<string, Partial<ModaGptUsage>> = {};
  for (const [period, usage] of Object.entries(usageByPeriod || {})) {
    if (
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)
      || !usage || typeof usage !== 'object' || Array.isArray(usage)
      || Object.entries(usage).some(([feature, count]) =>
        !features.includes(feature as ModaGptFeature)
        || typeof count !== 'number'
        || !Number.isInteger(count)
        || count < 0
      )
    ) throw new Error('MODAGPT_USAGE_INVALID');
    validatedUsage[period] = usage as Partial<ModaGptUsage>;
  }
  return {
    plan,
    expiresAt: typeof expiresAt === 'string' ? expiresAt : null,
    usageByPeriod: validatedUsage
  };
}

export function resolveModaGptPlan(state: ModaGptPlanState, now = new Date()): ModaGptPlan {
  if (state.plan === 'pro' && state.expiresAt && Date.parse(state.expiresAt) <= now.getTime()) return 'free';
  return state.plan;
}

export function getModaGptEntitlements(
  state: ModaGptPlanState,
  now = new Date()
): ModaGptEntitlements {
  const period = getModaGptPeriod(now);
  const plan = resolveModaGptPlan(state, now);
  const quotas = { ...MODAGPT_PLAN_QUOTAS[plan] };
  const savedUsage = state.usageByPeriod[period] || {};
  const usage = Object.fromEntries(features.map(feature => {
    const value = savedUsage[feature];
    if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
      throw new Error('MODAGPT_USAGE_INVALID');
    }
    return [feature, value || 0];
  })) as ModaGptUsage;
  const remaining = Object.fromEntries(features.map(feature => [
    feature,
    Math.max(0, quotas[feature] - usage[feature])
  ])) as ModaGptUsage;
  return { plan, expiresAt: state.expiresAt, period, quotas, usage, remaining };
}

export function reserveModaGptUsage(
  state: ModaGptPlanState,
  feature: ModaGptFeature,
  now = new Date()
): { nextState: ModaGptPlanState; entitlements: ModaGptEntitlements } {
  const entitlements = getModaGptEntitlements(state, now);
  if (entitlements.remaining[feature] < 1) {
    throw new Error(entitlements.quotas[feature] === 0 ? 'MODAGPT_UPGRADE_REQUIRED' : 'MODAGPT_QUOTA_EXCEEDED');
  }
  return {
    nextState: {
      ...state,
      usageByPeriod: {
        ...state.usageByPeriod,
        [entitlements.period]: {
          ...(state.usageByPeriod[entitlements.period] || {}),
          [feature]: entitlements.usage[feature] + 1
        }
      }
    },
    entitlements: getModaGptEntitlements({
      ...state,
      usageByPeriod: {
        ...state.usageByPeriod,
        [entitlements.period]: {
          ...(state.usageByPeriod[entitlements.period] || {}),
          [feature]: entitlements.usage[feature] + 1
        }
      }
    }, now)
  };
}

export function releaseModaGptUsage(
  state: ModaGptPlanState,
  feature: ModaGptFeature,
  period: string
): ModaGptPlanState {
  const periodUsage = state.usageByPeriod[period];
  if (!periodUsage || !periodUsage[feature]) return state;
  return {
    ...state,
    usageByPeriod: {
      ...state.usageByPeriod,
      [period]: { ...periodUsage, [feature]: periodUsage[feature]! - 1 }
    }
  };
}

export function serializeModaGptSettings(settingsJson: string, modagpt: ModaGptPlanState): string {
  let settings: unknown;
  try {
    settings = JSON.parse(settingsJson);
  } catch {
    throw new Error('MODAGPT_MERCHANT_SETTINGS_INVALID');
  }
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    throw new Error('MODAGPT_MERCHANT_SETTINGS_INVALID');
  }
  return JSON.stringify({ ...(settings as Record<string, unknown>), modagpt });
}

export function parseModaGptImageRequest(input: unknown):
  | { task: 'imageGeneration'; prompt: string }
  | {
    task: 'tryOn';
    prompt: string;
    category: 'tops' | 'bottoms' | 'one-pieces';
    personImage: string;
    garmentImage?: string;
    garmentStorageKey?: string;
    privacyConsent: true;
  }
  | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const body = input as Record<string, unknown>;
  const task = body.task;
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (
    !prompt
    || prompt.length > maximumModaGptImagePromptLength
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(prompt)
  ) return null;
  if (task === 'imageGeneration') {
    if (Object.keys(body).some(key => !['task', 'prompt'].includes(key))) return null;
    return { task, prompt };
  }
  if (
    task !== 'tryOn'
    || Object.keys(body).some(key => !['task', 'prompt', 'category', 'personImage', 'garmentImage', 'garmentStorageKey', 'privacyConsent'].includes(key))
    || (body.category !== 'tops' && body.category !== 'bottoms' && body.category !== 'one-pieces')
    || typeof body.personImage !== 'string'
    || ((typeof body.garmentImage === 'string') === (typeof body.garmentStorageKey === 'string'))
    || body.personImage.length > 4_300_000
    || (typeof body.garmentImage === 'string' && body.garmentImage.length > 4_300_000)
    || (typeof body.garmentStorageKey === 'string' &&
      !/^merchants\/[^/]+\/storefront\/images\/[a-z0-9-]+\.(?:jpeg|png|webp)$/i.test(body.garmentStorageKey))
    || body.privacyConsent !== true
  ) return null;
  return {
    task,
    prompt,
    category: body.category,
    personImage: body.personImage,
    ...(typeof body.garmentImage === 'string' ? { garmentImage: body.garmentImage } : { garmentStorageKey: body.garmentStorageKey as string }),
    privacyConsent: true
  };
}

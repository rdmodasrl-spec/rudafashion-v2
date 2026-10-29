import crypto from 'node:crypto';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * 平台功能开关（Feature Flag Center）权威存储。
 *
 * 设计要点（见 docs/engineering/modules/platform-feature-flags.md）：
 * - 唯一权威来源是服务端文件（默认 logs/feature-flags.json），沿用平台既有
 *   integration-config.json / footer-config.json 的原子写约定，避免为单个开关
 *   引入生产数据库迁移。
 * - 进程内缓存写后立即生效；读取前按文件 mtime（节流）检测外部变化。
 * - 读取失败或文件损坏时保持默认值（关闭），即 fail-closed。
 */

export const MERCHANT_MINIPROGRAM_MODAUI_ENABLED_KEY = 'merchant_miniprogram_modaui_enabled' as const;
export const MINIPROGRAM_MODAUI_ENABLED_KEY = 'miniprogram_modaui_enabled' as const;
/** 全局总闸：时尚版块（Web / 手机网页 / 用户小程序）。关闭只停用，不删除任何数据。 */
export const FASHION_ENABLED_KEY = 'fashion_enabled' as const;
/** 全局总闸：ModaUI（全部终端的新建生成任务与入口）。关闭只停用，不删除历史。 */
export const MODAUI_ENABLED_KEY = 'modaui_enabled' as const;

export type FeatureFlagKey =
  | typeof MERCHANT_MINIPROGRAM_MODAUI_ENABLED_KEY
  | typeof MINIPROGRAM_MODAUI_ENABLED_KEY
  | typeof FASHION_ENABLED_KEY
  | typeof MODAUI_ENABLED_KEY;

export type FeatureFlagDefinition = {
  key: FeatureFlagKey;
  name: string;
  terminal: string;
  description: string;
  permission: string;
  defaultEnabled: boolean;
};

export const FEATURE_FLAG_DEFINITIONS: readonly FeatureFlagDefinition[] = [
  {
    key: MERCHANT_MINIPROGRAM_MODAUI_ENABLED_KEY,
    name: 'ModaUI 智能创作',
    terminal: '商家小程序',
    description: 'AI 设计、虚拟试穿、换色等功能',
    permission: 'settings.features',
    defaultEnabled: false
  },
  {
    key: MINIPROGRAM_MODAUI_ENABLED_KEY,
    name: 'ModaUI 创作对话',
    terminal: '用户端小程序',
    description: '时尚设计对话与创意推理版块',
    permission: 'settings.features',
    defaultEnabled: false
  },
  {
    key: FASHION_ENABLED_KEY,
    name: '时尚版块',
    terminal: 'Web / 手机网页 / 用户小程序',
    description: '关闭后隐藏时尚入口并停用帖文、互动与发布；作品、评论、关注与统计数据全部保留',
    permission: 'settings.features',
    defaultEnabled: true
  },
  {
    key: MODAUI_ENABLED_KEY,
    name: 'ModaUI AI 版块',
    terminal: '全部终端',
    description: '关闭后隐藏 ModaUI 入口并拒绝新建生成任务；聊天记录、作品与任务历史保留',
    permission: 'settings.features',
    defaultEnabled: true
  }
];

export type FeatureFlagRecord = {
  enabled: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type FeatureFlagSnapshot = FeatureFlagDefinition & FeatureFlagRecord;

export type FeatureFlagSetInput = {
  key: string;
  enabled: boolean;
  actor: string;
  expectedUpdatedAt?: string | null;
};

export type FeatureFlagSetResult = {
  previous: FeatureFlagRecord;
  next: FeatureFlagRecord;
  snapshot: FeatureFlagSnapshot;
};

export type FeatureFlagStore = {
  readonly filePath: string;
  refresh(): Promise<void>;
  list(): FeatureFlagSnapshot[];
  get(key: FeatureFlagKey): FeatureFlagRecord;
  isEnabled(key: FeatureFlagKey): boolean;
  set(input: FeatureFlagSetInput): Promise<FeatureFlagSetResult>;
  getLoadError(): string | null;
};

export class FeatureFlagError extends Error {
  constructor(readonly code: 'FEATURE_FLAG_UNKNOWN' | 'FEATURE_FLAG_VERSION_CONFLICT' | 'FEATURE_FLAG_STORAGE_UNAVAILABLE') {
    super(code);
    this.name = 'FeatureFlagError';
  }
}

const DEFAULT_RELOAD_INTERVAL_MS = 1000;
const STORE_FILE_VERSION = 1;

export function isFeatureFlagKey(value: string): value is FeatureFlagKey {
  return FEATURE_FLAG_DEFINITIONS.some(definition => definition.key === value);
}

function defaultRecord(definition: FeatureFlagDefinition): FeatureFlagRecord {
  return { enabled: definition.defaultEnabled, updatedAt: null, updatedBy: null };
}

function normalizeRecord(value: unknown, definition: FeatureFlagDefinition): FeatureFlagRecord {
  if (!value || typeof value !== 'object') return defaultRecord(definition);
  const candidate = value as { enabled?: unknown; updatedAt?: unknown; updatedBy?: unknown };
  return {
    enabled: typeof candidate.enabled === 'boolean' ? candidate.enabled : definition.defaultEnabled,
    updatedAt: typeof candidate.updatedAt === 'string' && candidate.updatedAt.length <= 64
      ? candidate.updatedAt
      : null,
    updatedBy: typeof candidate.updatedBy === 'string' && candidate.updatedBy ? candidate.updatedBy.slice(0, 120) : null
  };
}

export function createFeatureFlagStore(options: {
  filePath: string;
  definitions?: readonly FeatureFlagDefinition[];
  reloadIntervalMs?: number;
}): FeatureFlagStore {
  const definitions = options.definitions ?? FEATURE_FLAG_DEFINITIONS;
  const reloadIntervalMs = Math.max(0, options.reloadIntervalMs ?? DEFAULT_RELOAD_INTERVAL_MS);
  const state = new Map<FeatureFlagKey, FeatureFlagRecord>();
  for (const definition of definitions) state.set(definition.key, defaultRecord(definition));
  let loaded = false;
  let loadError: string | null = null;
  let lastMtimeMs: number | null = null;
  let lastCheckedAt = 0;

  const definitionFor = (key: FeatureFlagKey) => {
    const definition = definitions.find(item => item.key === key);
    if (!definition) throw new FeatureFlagError('FEATURE_FLAG_UNKNOWN');
    return definition;
  };

  const readFromDisk = async () => {
    let raw: string;
    try {
      raw = await readFile(options.filePath, 'utf8');
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
      loaded = true;
      if (code === 'ENOENT') {
        loadError = null;
        lastMtimeMs = null;
        return;
      }
      loadError = 'FEATURE_FLAG_STORAGE_UNAVAILABLE';
      return;
    }
    try {
      const parsed = JSON.parse(raw) as { flags?: Record<string, unknown> };
      const storedFlags = parsed && typeof parsed === 'object' && parsed.flags && typeof parsed.flags === 'object'
        ? parsed.flags
        : {};
      for (const definition of definitions) {
        state.set(definition.key, normalizeRecord(storedFlags[definition.key], definition));
      }
      loadError = null;
    } catch {
      // 文件损坏时不覆盖业务默认值：保持关闭并暴露错误。
      loadError = 'FEATURE_FLAG_FILE_CORRUPT';
    }
    try {
      const info = await stat(options.filePath);
      lastMtimeMs = info.mtimeMs;
    } catch {
      lastMtimeMs = null;
    }
  };

  const ensureFresh = async () => {
    if (!loaded) {
      await readFromDisk();
      lastCheckedAt = Date.now();
      return;
    }
    if (Date.now() - lastCheckedAt < reloadIntervalMs) return;
    lastCheckedAt = Date.now();
    let info: Awaited<ReturnType<typeof stat>>;
    try {
      info = await stat(options.filePath);
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
      if (code === 'ENOENT') {
        // 配置文件被移除时回到默认值，避免继续使用旧值（fail-closed）。
        loadError = null;
        lastMtimeMs = null;
        for (const definition of definitions) state.set(definition.key, defaultRecord(definition));
        return;
      }
      loadError = 'FEATURE_FLAG_STORAGE_UNAVAILABLE';
      return;
    }
    if (lastMtimeMs !== null && info.mtimeMs === lastMtimeMs) return;
    await readFromDisk();
  };

  const persist = async () => {
    const flags: Record<string, FeatureFlagRecord> = {};
    for (const definition of definitions) {
      flags[definition.key] = state.get(definition.key) ?? defaultRecord(definition);
    }
    await mkdir(path.dirname(options.filePath), { recursive: true });
    const temporaryPath = `${options.filePath}.${crypto.randomUUID()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify({ version: STORE_FILE_VERSION, flags }, null, 2)}\n`, 'utf8');
    await rename(temporaryPath, options.filePath);
    try {
      const info = await stat(options.filePath);
      lastMtimeMs = info.mtimeMs;
    } catch {
      lastMtimeMs = null;
    }
  };

  const store: FeatureFlagStore = {
    filePath: options.filePath,
    async refresh() {
      try {
        await ensureFresh();
      } catch {
        loadError = 'FEATURE_FLAG_STORAGE_UNAVAILABLE';
      }
    },
    list() {
      return definitions.map(definition => ({
        ...definition,
        ...(state.get(definition.key) ?? defaultRecord(definition))
      }));
    },
    get(key) {
      definitionFor(key);
      return state.get(key) ?? defaultRecord(definitionFor(key));
    },
    isEnabled(key) {
      return store.get(key).enabled;
    },
    async set(input) {
      if (!isFeatureFlagKey(input.key)) throw new FeatureFlagError('FEATURE_FLAG_UNKNOWN');
      const definition = definitionFor(input.key);
      await ensureFresh();
      const previous = state.get(definition.key) ?? defaultRecord(definition);
      if (input.expectedUpdatedAt !== undefined && input.expectedUpdatedAt !== previous.updatedAt) {
        throw new FeatureFlagError('FEATURE_FLAG_VERSION_CONFLICT');
      }
      const next: FeatureFlagRecord = {
        enabled: input.enabled,
        updatedAt: new Date().toISOString(),
        updatedBy: input.actor.slice(0, 120) || 'platform-admin'
      };
      state.set(definition.key, next);
      try {
        await persist();
      } catch {
        state.set(definition.key, previous);
        throw new FeatureFlagError('FEATURE_FLAG_STORAGE_UNAVAILABLE');
      }
      return { previous, next, snapshot: { ...definition, ...next } };
    },
    getLoadError() {
      return loadError;
    }
  };
  return store;
}

/** 小程序请求标识：仅用于区分终端，不作为任何身份或权限依据。 */
export const MERCHANT_MINIPROGRAM_CLIENT_HEADER = 'x-ruda-client';
export const MERCHANT_MINIPROGRAM_CLIENT_VALUE = 'merchant-miniprogram';

export function isMerchantMiniprogramRequest(req: { get(name: string): string | undefined }): boolean {
  try {
    const value = req.get(MERCHANT_MINIPROGRAM_CLIENT_HEADER);
    return typeof value === 'string' && value.trim().toLowerCase() === MERCHANT_MINIPROGRAM_CLIENT_VALUE;
  } catch {
    return false;
  }
}

/** 商家端读取用的最小载荷：不暴露操作人。 */
export function buildMerchantFeatureFlagPayload(store: FeatureFlagStore): { version: string | null; flags: Record<string, boolean> } {
  const flags: Record<string, boolean> = {};
  let version: string | null = null;
  for (const snapshot of store.list()) {
    // 商家端读取商家范围内的开关 + 全局总闸；平台级小程序评审开关
    // （如 miniprogram_modaui_enabled）不得通过商家端点外泄，
    // 也不与商家开关合并语义。
    const isMerchantScoped = snapshot.key.startsWith('merchant_');
    const isGlobalModuleSwitch = snapshot.key === FASHION_ENABLED_KEY || snapshot.key === MODAUI_ENABLED_KEY;
    if (!isMerchantScoped && !isGlobalModuleSwitch) continue;
    flags[snapshot.key] = snapshot.enabled;
    if (snapshot.updatedAt && (!version || snapshot.updatedAt > version)) version = snapshot.updatedAt;
  }
  return { version, flags };
}

/**
 * 公开只读载荷：只暴露两个全局总闸的布尔值。
 * 前端只把它当渲染副本，任何授权判断仍在服务端重新读取权威值。
 */
export function buildPublicFeatureFlagPayload(store: FeatureFlagStore): { version: string | null; flags: Record<string, boolean> } {
  const flags: Record<string, boolean> = {};
  let version: string | null = null;
  for (const key of [FASHION_ENABLED_KEY, MODAUI_ENABLED_KEY] as const) {
    const record = store.get(key);
    // 读取异常/文件损坏时按关闭处理（fail-closed），不返回 true。
    flags[key] = record.enabled === true && store.getLoadError() === null;
    if (record.updatedAt && (!version || record.updatedAt > version)) version = record.updatedAt;
  }
  return { version, flags };
}

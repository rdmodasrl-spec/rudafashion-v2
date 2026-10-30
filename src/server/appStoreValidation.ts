import { isAiToolsManifestEnabled, parseAiToolManifest } from './aiToolManifest';

export type AppStoreInstallationError =
  | 'APP_STORE_APP_NOT_AVAILABLE'
  | 'APP_STORE_PURCHASE_REQUIRED'
  | 'APP_STORE_RUNTIME_UNAVAILABLE'
  | 'APP_STORE_RUNTIME_VERSION_UNSUPPORTED'
  | 'APP_STORE_MANIFEST_INVALID';

/**
 * 历史原生运行时白名单。
 * 新应用应通过 `App.manifest`（Tool Manifest v1）声明能力；本表只保留已上线的两个原生应用，
 * 不得再往里追加写死的 appId。
 */
export const appStoreNativeRuntimes = {
  'ruda-business-email': '1.0.0',
  'ruda-production-chain': '1.0.0'
} as const;

export interface AppStoreInstallableRecord {
  appId?: unknown;
  status: unknown;
  pricingType: unknown;
  version?: unknown;
  manifest?: unknown;
  pricePlan?: unknown;
}

export type AppStoreRuntimeDescriptor =
  | { kind: 'native'; appId: string; version: string }
  | { kind: 'manifest'; appId: string; manifestVersion: string; publishedToolCount: number };

export interface AppStoreInstallationCheckOptions {
  requireRuntime?: boolean;
  /** 付费应用是否已具备权益（已购买/在订阅期内/试用可用）。 */
  entitled?: boolean;
  manifestEnabled?: boolean;
}


export function parseAppStoreStringArray(value: unknown): string[] | null {
  if (typeof value !== 'string') return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every(item => typeof item === 'string')
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export function isAppStoreNativeRuntimeAvailable(appId: unknown): boolean {
  return typeof appId === 'string' && Object.hasOwn(appStoreNativeRuntimes, appId);
}

export function isAppStoreNativeRuntimeCompatible(appId: unknown, version: unknown): boolean {
  return typeof appId === 'string'
    && typeof version === 'string'
    && Object.entries(appStoreNativeRuntimes).some(([registeredAppId, registeredVersion]) =>
      registeredAppId === appId && registeredVersion === version
    );
}

/** 免费应用始终可安装；付费应用仅在声明了正数试用天数时允许安装（到期后由工具授权门禁拦截）。 */
export function pricingTypeAllowsTrial(pricingType: unknown, trialDays: number): boolean {
  if (pricingType === 'free') return true;
  return Number.isFinite(trialDays) && trialDays > 0;
}

export function isAppStoreRuntimeAvailable(
  app: AppStoreInstallableRecord | null,
  options: { manifestEnabled?: boolean } = {}
): boolean {
  return describeAppStoreRuntime(app, options) !== null;
}

/** 运行时描述：Manifest 应用优先，未声明 Manifest 的旧应用回退到原生白名单。 */
export function describeAppStoreRuntime(
  app: AppStoreInstallableRecord | null,
  options: { manifestEnabled?: boolean } = {}
): AppStoreRuntimeDescriptor | null {
  if (!app || typeof app.appId !== 'string') return null;
  const manifestEnabled = options.manifestEnabled ?? isAiToolsManifestEnabled();
  if (manifestEnabled && app.manifest !== null && app.manifest !== undefined) {
    const parsed = parseAiToolManifest(app.manifest, { expectedAppId: app.appId });
    if (!parsed.ok) return null;
    const publishedToolCount = parsed.manifest.tools
      .filter(tool => tool.status === 'published' && tool.enabled).length;
    if (publishedToolCount === 0) return null;
    return {
      kind: 'manifest',
      appId: app.appId,
      manifestVersion: parsed.manifest.manifestVersion,
      publishedToolCount
    };
  }
  if (isAppStoreNativeRuntimeCompatible(app.appId, app.version)) {
    return { kind: 'native', appId: app.appId, version: app.version as string };
  }
  return null;
}

export function getAppStoreInstallationError(
  app: AppStoreInstallableRecord | null,
  options: boolean | AppStoreInstallationCheckOptions = false
): AppStoreInstallationError | null {
  const check: AppStoreInstallationCheckOptions = typeof options === 'boolean'
    ? { requireRuntime: options }
    : options;
  if (!app || app.status !== 'published') return 'APP_STORE_APP_NOT_AVAILABLE';
  if (app.pricingType !== 'free' && check.entitled !== true) return 'APP_STORE_PURCHASE_REQUIRED';
  if (check.requireRuntime !== true) return null;
  const manifestEnabled = check.manifestEnabled ?? isAiToolsManifestEnabled();
  if (manifestEnabled && app.manifest !== null && app.manifest !== undefined) {
    const parsed = parseAiToolManifest(app.manifest, {
      ...(typeof app.appId === 'string' ? { expectedAppId: app.appId } : {})
    });
    if (!parsed.ok) return 'APP_STORE_MANIFEST_INVALID';
    const hasCallableTool = parsed.manifest.tools.some(tool => tool.status === 'published' && tool.enabled);
    return hasCallableTool ? null : 'APP_STORE_MANIFEST_INVALID';
  }
  if (!isAppStoreNativeRuntimeAvailable(app.appId)) return 'APP_STORE_RUNTIME_UNAVAILABLE';
  if (!isAppStoreNativeRuntimeCompatible(app.appId, app.version)) return 'APP_STORE_RUNTIME_VERSION_UNSUPPORTED';
  return null;
}

export type AppStoreInstallationAction = 'enable' | 'disable';
export type AppStoreInstallationStatus = 'installed' | 'active' | 'disabled';

export function transitionAppStoreInstallation(
  status: string,
  action: AppStoreInstallationAction
): AppStoreInstallationStatus | null {
  if (action === 'enable') {
    return status === 'installed' || status === 'disabled' || status === 'active' ? 'active' : null;
  }
  return status === 'installed' || status === 'active' || status === 'disabled' ? 'disabled' : null;
}
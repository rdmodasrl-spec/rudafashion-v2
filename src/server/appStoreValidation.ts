export type AppStoreInstallationError =
  | 'APP_STORE_APP_NOT_AVAILABLE'
  | 'APP_STORE_PURCHASE_REQUIRED'
  | 'APP_STORE_RUNTIME_UNAVAILABLE'
  | 'APP_STORE_RUNTIME_VERSION_UNSUPPORTED';

export const appStoreNativeRuntimes = {
  'ruda-business-email': '1.0.0',
  'ruda-production-chain': '1.0.0'
} as const;

export interface AppStoreInstallableRecord {
  appId?: unknown;
  status: unknown;
  pricingType: unknown;
  version?: unknown;
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

export function getAppStoreInstallationError(
  app: AppStoreInstallableRecord | null,
  requireRuntime = false
): AppStoreInstallationError | null {
  if (!app || app.status !== 'published') return 'APP_STORE_APP_NOT_AVAILABLE';
  if (app.pricingType !== 'free') return 'APP_STORE_PURCHASE_REQUIRED';
  if (requireRuntime && !isAppStoreNativeRuntimeAvailable(app.appId)) {
    return 'APP_STORE_RUNTIME_UNAVAILABLE';
  }
  if (requireRuntime && !isAppStoreNativeRuntimeCompatible(app.appId, app.version)) {
    return 'APP_STORE_RUNTIME_VERSION_UNSUPPORTED';
  }
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
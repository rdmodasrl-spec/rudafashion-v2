import {
  getMerchantMobileTabForHost,
  getPortalZoneForHost,
  PORTAL_DOMAINS
} from '../shared/portalDomains';

export const RUDA_APP_TARGETS = [
  'frontend-web',
  'frontend-mobile',
  'merchant-admin-web',
  'merchant-admin-mobile',
  'platform-admin-web',
  'platform-admin-mobile'
] as const;

export type RudaAppTarget = (typeof RUDA_APP_TARGETS)[number];

const frontendHosts = new Set<string>([PORTAL_DOMAINS.public, PORTAL_DOMAINS.www]);

export function isRudaAppTarget(value: string | null): value is RudaAppTarget {
  return value !== null && RUDA_APP_TARGETS.some(target => target === value);
}

export function getRudaAppManifestPath(target: RudaAppTarget, host: string, pathname: string) {
  const isEmployeeEntry = target === 'merchant-admin-mobile'
    && (host.toLowerCase() === PORTAL_DOMAINS.employee || pathname.toLowerCase().startsWith('/employee'));
  if (!isEmployeeEntry) return `/apps/${target}/manifest.webmanifest`;
  return host.toLowerCase() === PORTAL_DOMAINS.employee
    ? '/manifest.json'
    : '/apps/merchant-admin-mobile/employee-manifest.webmanifest';
}

export function resolveRudaAppTarget(input: {
  host: string;
  pathname: string;
  isMobileViewport: boolean;
  requestedTarget?: string | null;
}): RudaAppTarget {
  const requestedTarget = input.requestedTarget ?? null;
  if (isRudaAppTarget(requestedTarget)) return requestedTarget;

  const host = input.host.toLowerCase();
  const pathname = input.pathname.toLowerCase();
  const portalZone = getPortalZoneForHost(host);

  if (portalZone === 'admin' || pathname.startsWith('/admin') || pathname.startsWith('/super-admin')) {
    return input.isMobileViewport ? 'platform-admin-mobile' : 'platform-admin-web';
  }

  if (portalZone === 'employee' || pathname.startsWith('/employee')) {
    return 'merchant-admin-mobile';
  }

  if (portalZone === 'merchant' || pathname === '/merchant' || pathname.startsWith('/merchant/')) {
    const mobileOnlyHost = getMerchantMobileTabForHost(host) !== null;
    return input.isMobileViewport || mobileOnlyHost
      ? 'merchant-admin-mobile'
      : 'merchant-admin-web';
  }

  return frontendHosts.has(host) && input.isMobileViewport
    ? 'frontend-mobile'
    : 'frontend-web';
}

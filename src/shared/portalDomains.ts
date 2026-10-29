export const PORTAL_DOMAINS = {
  public: 'modaui.com',
  www: 'www.modaui.com',
  merchant: 'ruda.fashion',
  store: 'shop.ruda.fashion',
  products: 'product.ruda.fashion',
  inventory: 'stock.ruda.fashion',
  ai: 'ai.ruda.fashion',
  orders: 'order.ruda.fashion',
  video: 'video.ruda.fashion',
  admin: 'admin.ruda.fashion',
  employee: 'a.ruda.fashion'
} as const;

export type PortalZone = 'merchant' | 'admin' | 'employee';
export type MerchantMobileWorkspaceTab =
  | 'store'
  | 'products'
  | 'inventory'
  | 'ai_home'
  | 'orders';

export const PORTAL_HOST_ZONES: Readonly<Record<string, PortalZone>> = {
  [PORTAL_DOMAINS.merchant]: 'merchant',
  [PORTAL_DOMAINS.store]: 'merchant',
  [PORTAL_DOMAINS.products]: 'merchant',
  [PORTAL_DOMAINS.inventory]: 'merchant',
  [PORTAL_DOMAINS.ai]: 'merchant',
  [PORTAL_DOMAINS.orders]: 'merchant',
  [PORTAL_DOMAINS.video]: 'merchant',
  [PORTAL_DOMAINS.admin]: 'admin',
  [PORTAL_DOMAINS.employee]: 'employee'
};

export const LEGACY_PORTAL_REDIRECTS: Readonly<Record<string, string>> = {
  'b2b.ruda.fashion': PORTAL_DOMAINS.merchant,
  'www.ruda.fashion': PORTAL_DOMAINS.public,
  'www.modaui.com': PORTAL_DOMAINS.public,
  'modagpt.ruda.fashion': PORTAL_DOMAINS.ai,
  'bos.ruda.fashion': PORTAL_DOMAINS.merchant,
  'merchant.ruda.fashion': PORTAL_DOMAINS.merchant,
  'vip.ruda.fashion': PORTAL_DOMAINS.merchant,
  'xs.ruda.fashion': PORTAL_DOMAINS.employee,
  'a.ruda.fashion': PORTAL_DOMAINS.employee,
  'app.ruda.fashion': PORTAL_DOMAINS.public,
  'buyer.ruda.fashion': PORTAL_DOMAINS.public,
};

export const MERCHANT_MOBILE_HOST_TABS: Readonly<Record<string, MerchantMobileWorkspaceTab>> = {
  [PORTAL_DOMAINS.store]: 'store',
  [PORTAL_DOMAINS.products]: 'products',
  [PORTAL_DOMAINS.inventory]: 'inventory',
  [PORTAL_DOMAINS.ai]: 'ai_home',
  [PORTAL_DOMAINS.orders]: 'orders'
};

export const RESERVED_RUDA_HOSTS = new Set([
  ...Object.values(PORTAL_DOMAINS),
  ...Object.keys(LEGACY_PORTAL_REDIRECTS)
]);

export const CANONICAL_PORTAL_ORIGINS = Object.values(PORTAL_DOMAINS)
  .map(host => `https://${host}`);

export function getPortalZoneForHost(host: string): PortalZone | null {
  const normalizedHost = host.toLowerCase();
  return Object.hasOwn(PORTAL_HOST_ZONES, normalizedHost)
    ? PORTAL_HOST_ZONES[normalizedHost]
    : null;
}

export function getMerchantMobileTabForHost(host: string): MerchantMobileWorkspaceTab | null {
  const normalizedHost = host.toLowerCase();
  return Object.hasOwn(MERCHANT_MOBILE_HOST_TABS, normalizedHost)
    ? MERCHANT_MOBILE_HOST_TABS[normalizedHost]
    : null;
}

export function getLegacyPortalRedirectHost(host: string): string | null {
  const normalizedHost = host.toLowerCase();
  return Object.hasOwn(LEGACY_PORTAL_REDIRECTS, normalizedHost)
    ? LEGACY_PORTAL_REDIRECTS[normalizedHost]
    : null;
}

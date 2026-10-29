import type { MerchantIndustryModuleKey } from '../../../constants/merchantIndustryCapabilities';

export type MerchantPortalIndustryTab =
  | 'dashboard' | 'products' | 'inventory' | 'orders' | 'customers' | 'procurement' | 'pos' | 'settings';
export type MerchantMobileIndustryTab =
  | 'dashboard' | 'products' | 'inventory' | 'orders' | 'customers' | 'procurement' | 'pos' | 'profile';

export const merchantPortalTabByIndustrySection = {
  dashboard: 'dashboard',
  products: 'products',
  inventory: 'inventory',
  orders: 'orders',
  customers: 'customers',
  suppliers: 'procurement',
  procurement: 'procurement',
  pos: 'pos',
  pos_sales: 'pos',
  pos_shifts: 'pos',
  stores: 'inventory',
  transfers: 'inventory',
  team: 'settings',
  messages: 'dashboard',
  settings: 'settings'
} as const satisfies Readonly<Record<MerchantIndustryModuleKey, MerchantPortalIndustryTab>>;

export const merchantMobileTabByIndustrySection = {
  dashboard: 'dashboard',
  products: 'products',
  inventory: 'inventory',
  orders: 'orders',
  customers: 'customers',
  suppliers: 'customers',
  procurement: 'procurement',
  pos: 'pos',
  pos_sales: 'pos',
  pos_shifts: 'pos',
  stores: 'inventory',
  transfers: 'inventory',
  team: 'profile',
  messages: 'dashboard',
  settings: 'profile'
} as const satisfies Readonly<Record<MerchantIndustryModuleKey, MerchantMobileIndustryTab>>;

export const merchantPortalIndustrySectionByTab: Readonly<Record<string, MerchantIndustryModuleKey>> = {
  dashboard: 'dashboard',
  products: 'products',
  sku_matrix: 'products',
  inventory: 'inventory',
  materials: 'inventory',
  procurement: 'procurement',
  orders: 'orders',
  customers: 'customers',
  vault_requests: 'customers',
  pos: 'pos',
  settings: 'settings'
};

export const merchantMobileIndustrySectionByTab: Readonly<Record<string, MerchantIndustryModuleKey>> = {
  dashboard: 'dashboard',
  products: 'products',
  inventory: 'inventory',
  orders: 'orders',
  customers: 'customers',
  procurement: 'procurement',
  pos: 'pos',
  profile: 'settings'
};

export const shouldRenderIndustryWorkspaceForTab = (
  tab: string,
  activeSection: MerchantIndustryModuleKey,
  sectionByTab: Readonly<Record<string, MerchantIndustryModuleKey>>
) => Boolean(sectionByTab[tab]) && (tab !== 'dashboard' || activeSection !== 'dashboard');

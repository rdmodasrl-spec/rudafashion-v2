export const merchantMobileDefaultTabs = [
  'dashboard',
  'products',
  'orders',
  'inventory',
  'customers',
  'store',
  'profile',
  'finance',
  'growth',
  'production',
  'procurement',
  'content'
] as const;

export type MerchantMobileDefaultTab = (typeof merchantMobileDefaultTabs)[number];

export function isModaGptEntryRequest(search: string): boolean {
  return new URLSearchParams(search).get('workspace') === 'modagpt';
}

export function isMerchantMobileDefaultTab(value: unknown): value is MerchantMobileDefaultTab {
  return typeof value === 'string' && merchantMobileDefaultTabs.some(tab => tab === value);
}

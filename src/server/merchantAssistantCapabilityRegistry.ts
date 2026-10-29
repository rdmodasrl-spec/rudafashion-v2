export const merchantAssistantCapabilityRegistryVersion = '1.0.0';

export const merchantAssistantDataAccessPermissions = {
  orders: ['sales.order.create', 'warehouse.pick', 'warehouse.review', 'warehouse.pack', 'warehouse.ship'],
  inventory: ['warehouse.pick', 'warehouse.review'],
  materials: ['production.report', 'production', 'store_manager'],
  production: ['production.report'],
  products: ['sales.order.create', 'production.report'],
  customers: ['sales.order.create'],
  finance: ['finance.read'],
  profile: ['merchant.profile.read']
} as const;

export type MerchantAssistantDataAccess = {
  [Capability in keyof typeof merchantAssistantDataAccessPermissions]: boolean;
};

export function resolveMerchantAssistantDataAccess(
  hasPermission: (permission: string) => boolean,
  isMerchantOwner: boolean
): MerchantAssistantDataAccess {
  return {
    orders: isMerchantOwner || merchantAssistantDataAccessPermissions.orders.some(hasPermission),
    inventory: isMerchantOwner || merchantAssistantDataAccessPermissions.inventory.some(hasPermission),
    materials: isMerchantOwner || merchantAssistantDataAccessPermissions.materials.some(hasPermission),
    production: isMerchantOwner || merchantAssistantDataAccessPermissions.production.some(hasPermission),
    products: isMerchantOwner || merchantAssistantDataAccessPermissions.products.some(hasPermission),
    customers: isMerchantOwner || merchantAssistantDataAccessPermissions.customers.some(hasPermission),
    finance: isMerchantOwner || merchantAssistantDataAccessPermissions.finance.some(hasPermission),
    profile: isMerchantOwner || merchantAssistantDataAccessPermissions.profile.some(hasPermission)
  };
}

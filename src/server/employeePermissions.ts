export const defaultEmployeePermissions: Record<string, string[]> = {
  sales: ['sales.order.create', 'product.catalog.read', 'pricing.request'],
  warehouse: ['warehouse.pick', 'warehouse.review', 'warehouse.pack', 'warehouse.ship'],
  production: ['production.report', 'production.view', 'production.manage'],
  pos_cashier: ['sales.order.create'],
  knowledge_manager: ['brain.read', 'brain.write', 'brain.knowledge.review'],
  store_manager: [
    'sales.order.create', 'sales.quote.manage', 'business.analytics.read', 'product.catalog.read', 'product.import.draft', 'product.publish', 'product.publish.approve', 'product.cost.view', 'pricing.request', 'pricing.approve',
    'warehouse.pick', 'warehouse.review', 'warehouse.pack', 'warehouse.ship',
    'production.report', 'production.view', 'production.manage', 'production.cost.view',
    'purchase.manage', 'return.manage', 'employees.manage'
  ]
};

function normalizeConfiguredPermissions(configuredPermissions: unknown): string[] {
  if (configuredPermissions == null) return [];
  const values = Array.isArray(configuredPermissions)
    ? configuredPermissions
    : typeof configuredPermissions === 'string'
      ? [configuredPermissions]
      : [];
  return values
    .filter((value): value is string => typeof value === 'string')
    .map(value => value.trim())
    .filter(Boolean);
}

export function hasEmployeePermission(role: string, configuredPermissions: unknown, permission: string): boolean {
  if (configuredPermissions === undefined || configuredPermissions === null) {
    return Boolean(defaultEmployeePermissions[role]?.includes(permission));
  }
  const permissions = normalizeConfiguredPermissions(configuredPermissions);
  return permissions.includes('*') || permissions.includes(permission);
}

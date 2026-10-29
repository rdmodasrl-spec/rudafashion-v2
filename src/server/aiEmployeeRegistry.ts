export const aiEmployeeStatuses = ['planned', 'development', 'pilot', 'available', 'paused'] as const;

export type AiEmployeeStatus = (typeof aiEmployeeStatuses)[number];
export const productCatalogReadPermission = 'product.catalog.read';
export const productImportDraftPermission = 'product.import.draft';
export const productCreativeGeneratePermission = 'product.creative.generate';
export const inventoryStockReadPermission = 'inventory.stock.read';
export const salesSummaryReadPermission = 'sales.summary.read';
export const executableAiEmployeeSlugs = ['product-manager', 'inventory-manager', 'sales-manager'] as const;

export type AiEmployeeUpdate = {
  description?: string;
  status?: AiEmployeeStatus;
  version?: string;
};

export type AiEmployeeContentDraftReview =
  | { action: 'apply'; title: string; description: string }
  | { action: 'reject' };

export function canMerchantHireAiEmployee(status: string, employeeSlug: string): boolean {
  return status === 'available'
    && executableAiEmployeeSlugs.some(slug => slug === employeeSlug);
}

export function parseAiEmployeePermissions(input: unknown): string[] | null {
  if (
    !Array.isArray(input)
    || input.some(permission =>
      permission !== productCatalogReadPermission
      && permission !== productImportDraftPermission
      && permission !== productCreativeGeneratePermission
      && permission !== inventoryStockReadPermission
      && permission !== salesSummaryReadPermission
    )
  ) return null;
  return [...new Set(input)];
}

export function canUseAiEmployeeProductCatalog(input: {
  employeeSlug: string;
  employeeStatus: string;
  installationStatus: string;
  grantedPermissions: unknown;
}): boolean {
  const permissions = parseAiEmployeePermissions(input.grantedPermissions);
  return input.employeeSlug === 'product-manager'
    && input.employeeStatus === 'available'
    && input.installationStatus === 'active'
    && permissions?.includes(productCatalogReadPermission) === true;
}

export function canUseAiEmployeeProductImport(input: {
  employeeSlug: string;
  employeeStatus: string;
  installationStatus: string;
  grantedPermissions: unknown;
}): boolean {
  const permissions = parseAiEmployeePermissions(input.grantedPermissions);
  return input.employeeSlug === 'product-manager'
    && input.employeeStatus === 'available'
    && input.installationStatus === 'active'
    && permissions?.includes(productImportDraftPermission) === true;
}

export function canUseAiEmployeeCreativeGeneration(input: {
  employeeSlug: string;
  employeeStatus: string;
  installationStatus: string;
  grantedPermissions: unknown;
}): boolean {
  const permissions = parseAiEmployeePermissions(input.grantedPermissions);
  return input.employeeSlug === 'product-manager'
    && input.employeeStatus === 'available'
    && input.installationStatus === 'active'
    && permissions?.includes(productCreativeGeneratePermission) === true;
}

export function canUseAiEmployeeInventory(input: {
  employeeSlug: string;
  employeeStatus: string;
  installationStatus: string;
  grantedPermissions: unknown;
}): boolean {
  const permissions = parseAiEmployeePermissions(input.grantedPermissions);
  return input.employeeSlug === 'inventory-manager'
    && input.employeeStatus === 'available'
    && input.installationStatus === 'active'
    && permissions?.includes(inventoryStockReadPermission) === true;
}

export function canUseAiEmployeeSalesSummary(input: {
  employeeSlug: string;
  employeeStatus: string;
  installationStatus: string;
  grantedPermissions: unknown;
}): boolean {
  const permissions = parseAiEmployeePermissions(input.grantedPermissions);
  return (input.employeeSlug === 'sales-manager' || input.employeeSlug === 'inventory-manager')
    && input.employeeStatus === 'available'
    && input.installationStatus === 'active'
    && permissions?.includes(salesSummaryReadPermission) === true;
}

export function areAiEmployeePermissionsSupportedForSlug(
  employeeSlug: string,
  permissions: readonly string[]
): boolean {
  const allowed = employeeSlug === 'product-manager'
    ? [productCatalogReadPermission, productImportDraftPermission, productCreativeGeneratePermission]
    : employeeSlug === 'inventory-manager'
      ? [inventoryStockReadPermission, salesSummaryReadPermission]
      : employeeSlug === 'sales-manager'
        ? [salesSummaryReadPermission]
        : [];
  return permissions.every(permission => allowed.includes(permission));
}

export function parseProductCatalogSearchQuery(input: unknown): string | null {
  if (input === undefined) return '';
  if (typeof input !== 'string' || input.length > 100) return null;
  return input.trim();
}

export function parseAiEmployeeContentDraftReview(input: unknown): AiEmployeeContentDraftReview | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const body = input as Record<string, unknown>;
  if (body.action === 'reject') {
    return Object.keys(body).length === 1 ? { action: 'reject' } : null;
  }
  if (
    body.action !== 'apply'
    || Object.keys(body).length !== 3
    || !Object.hasOwn(body, 'title')
    || !Object.hasOwn(body, 'description')
    || typeof body.title !== 'string'
    || typeof body.description !== 'string'
  ) return null;
  const title = body.title.trim();
  const description = body.description.trim();
  if (
    !title
    || title.length > 120
    || !description
    || description.length > 2000
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(`${title}${description}`)
  ) return null;
  return { action: 'apply', title, description };
}

export function getProductContentUpdateFields(
  language: 'zh' | 'it' | 'en',
  title: string,
  description: string
): Record<string, string> {
  if (language === 'zh') return { name_zh: title, description_zh: description };
  if (language === 'it') return { name_it: title, description_it: description };
  return { name: title, description };
}

export function parseAiEmployeeUpdate(input: unknown): AiEmployeeUpdate | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;

  const body = input as Record<string, unknown>;
  const allowedKeys = new Set(['description', 'status', 'version']);
  if (Object.keys(body).length === 0 || Object.keys(body).some(key => !allowedKeys.has(key))) return null;

  const update: AiEmployeeUpdate = {};

  if (body.description !== undefined) {
    if (typeof body.description !== 'string' || body.description.trim().length === 0 || body.description.length > 2000) return null;
    update.description = body.description.trim();
  }

  if (body.status !== undefined) {
    if (typeof body.status !== 'string' || !aiEmployeeStatuses.includes(body.status as AiEmployeeStatus)) return null;
    update.status = body.status as AiEmployeeStatus;
  }

  if (body.version !== undefined) {
    if (
      typeof body.version !== 'string'
      || body.version.length > 32
      || !/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(body.version)
    ) return null;
    update.version = body.version;
  }

  return update;
}

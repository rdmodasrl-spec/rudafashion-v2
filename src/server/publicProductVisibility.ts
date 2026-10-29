import type { Prisma } from '@prisma/client';

export const PUBLIC_PRODUCT_VISIBILITY_FILTER = {
  visibility: 'public',
  isExclusiveProtected: false
} satisfies Prisma.ProductWhereInput;

export const PUBLIC_STOREFRONT_MERCHANT_FILTER = {
  OR: [{ storefrontEnabled: true }, { isVerified: true, storefrontEnabled: null }]
} satisfies Prisma.MerchantWhereInput;

export function isActiveVaultAuthorization(
  status: string,
  expiresAt: string | null | undefined,
  now = new Date()
): boolean {
  if (status !== 'approved') return false;
  if (!expiresAt) return true;
  const expiryTime = Date.parse(expiresAt);
  return Number.isFinite(expiryTime) && expiryTime > now.getTime();
}

export function isPublicProduct(product: {
  visibility: string;
  isExclusiveProtected: boolean;
}): boolean {
  return product.visibility === 'public' && !product.isExclusiveProtected;
}

export function isPublicStorefront(merchant: {
  storefrontEnabled: boolean | null;
  isVerified: boolean;
}): boolean {
  return merchant.storefrontEnabled === true
    || (merchant.storefrontEnabled === null && merchant.isVerified);
}

export function getBuyerVaultAccessStatus(
  customerStatus: string | null | undefined,
  request: { status: string; expiresAt?: string | null } | null | undefined,
  now = new Date()
): 'none' | 'pending' | 'approved' | 'rejected' {
  if (customerStatus !== 'approved' || !request) return 'none';
  if (request.status === 'pending' || request.status === 'rejected') return request.status;
  if (request.status === 'approved' && isActiveVaultAuthorization(request.status, request.expiresAt, now)) {
    return 'approved';
  }
  return 'none';
}

/**
 * 公开商品字段白名单（唯一来源）。
 *
 * 规则：公共前台、手机网页、商家独立店铺、折扣商城只能读取这里列出的字段。
 * 新增公开字段必须先在此登记，并由 `tests/unit/public-product-whitelist.test.ts` 验证；
 * 禁止改成“排除若干敏感字段”的黑名单写法，避免新增内部列后自动泄露。
 */
export const PUBLIC_PRODUCT_FIELD_ALLOWLIST = [
  'id', 'styleNo', 'name', 'name_it', 'name_zh',
  'category', 'storeCategorySlug', 'subCategory', 'brand', 'season',
  'images', 'media',
  'wholesalePrice', 'wholesalePrice100', 'bulkPriceMinimumQuantity', 'rrpPrice',
  'moq', 'packSize', 'requiresFullCarton',
  'status', 'inventoryStatus', 'lifecycleStatus',
  'origin', 'origin_it', 'origin_zh',
  'fabric', 'fabric_it', 'fabric_zh',
  'manufacturingProcess', 'fit', 'composition', 'weight', 'packaging', 'washCare',
  'description', 'description_it', 'description_zh',
  'skus',
  'merchantId', 'merchantName',
  'industryAttributes',
  'featuredOnHome', 'featuredOnSale',
  'mallStatus', 'mallListedAt', 'mallUnlistedAt', 'mallSortOrder', 'mallSaleStartsAt', 'mallSaleEndsAt',
  'createdAt', 'updatedAt'
] as const;

export type PublicProductField = typeof PUBLIC_PRODUCT_FIELD_ALLOWLIST[number];

/** 按白名单挑选公开字段；未登记字段（成本、内部版本号、审核人等）一律不返回。 */
export function pickPublicProductFields<T extends object>(product: T): Partial<T> {
  const source = product as Record<string, unknown>;
  const picked: Record<string, unknown> = {};
  for (const field of PUBLIC_PRODUCT_FIELD_ALLOWLIST) {
    if (Object.hasOwn(source, field)) picked[field] = source[field];
  }
  return picked as Partial<T>;
}

export function sanitizePublicProduct<
  T extends {
    costPrice?: unknown;
    media?: Array<{ storageKey?: string }>;
    skus?: Array<{ cost?: unknown }>;
  }
>(product: T) {
  const { costPrice: _costPrice, ...publicProduct } = product;
  return {
    ...publicProduct,
    ...(publicProduct.media
      ? { media: publicProduct.media.map(({ storageKey: _storageKey, ...media }) => media) }
      : {}),
    ...(publicProduct.skus
      ? { skus: publicProduct.skus.map(({ cost: _cost, ...sku }) => sku) }
      : {})
  };
}

export function buildAuthorizedProductVisibility(
  customerStatus: string | null | undefined,
  authorizedVaultMerchantIds: string[]
): Prisma.ProductWhereInput[] {
  const visibility: Prisma.ProductWhereInput[] = [
    { visibility: 'public', isExclusiveProtected: false }
  ];
  if (customerStatus !== 'approved') return visibility;

  visibility.push({ visibility: 'wholesale', isExclusiveProtected: false });
  const merchantIds = [...new Set(authorizedVaultMerchantIds.filter(Boolean))];
  if (merchantIds.length) {
    visibility.push({
      merchantId: { in: merchantIds },
      OR: [{ visibility: 'private' }, { isExclusiveProtected: true }]
    });
  }
  return visibility;
}

import { getProductWholesalePriceForQuantity } from '../shared/productPricing';

/**
 * Discount mall domain rules (single source of truth).
 *
 * The mall display state lives on `Product.mall*` and is intentionally separate
 * from `Product.lifecycleStatus` (product review) and `Product.status`
 * (merchant store zone). Platform unlisting must never unpublish a merchant's
 * own store product, and no module may re-implement these rules elsewhere.
 */

export const MALL_STATUSES = [
  'not_listed',
  'pending',
  'listed',
  'unlisted',
  'rejected',
  'ended',
  'blocked'
] as const;

export type MallStatus = typeof MALL_STATUSES[number];

export const MALL_STATUS_LABELS: Record<MallStatus, string> = {
  not_listed: '未加入商城',
  pending: '待审核',
  listed: '已上架',
  unlisted: '已下架',
  rejected: '已驳回',
  ended: '已结束',
  blocked: '无法上架'
};

export function isMallStatus(value: unknown): value is MallStatus {
  return typeof value === 'string' && (MALL_STATUSES as readonly string[]).includes(value);
}

export type MallAction = 'join' | 'approve' | 'reject' | 'list' | 'unlist' | 'remove' | 'expire';

export const MALL_ACTIONS: MallAction[] = ['join', 'approve', 'reject', 'list', 'unlist', 'remove', 'expire'];

export type SellerType = 'merchant' | 'platform';

export const SELLER_TYPE_LABELS: Record<SellerType, string> = {
  merchant: '商家特价',
  platform: '平台自营'
};

/** Platform self-operated products are the ones without a merchant owner. */
export function resolveSellerType(product: { merchantId?: string | null }): SellerType {
  return product.merchantId ? 'merchant' : 'platform';
}

export type MallBlockReasonCode =
  | 'NOT_PUBLISHED'
  | 'MERCHANT_NOT_CLEARANCE'
  | 'MERCHANT_PRODUCT_PRIVATE'
  | 'MERCHANT_STOREFRONT_INACTIVE'
  | 'MISSING_COVER_IMAGE'
  | 'PRICE_INVALID'
  | 'NO_SELLABLE_SKU'
  | 'PLATFORM_FULFILLMENT_NOT_READY'
  | 'SALE_WINDOW_NOT_STARTED'
  | 'SALE_WINDOW_ENDED';

export interface MallBlockReason {
  code: MallBlockReasonCode;
  message: string;
}

export const MALL_BLOCK_REASON_MESSAGES: Record<MallBlockReasonCode, string> = {
  NOT_PUBLISHED: '商品未通过平台发布审核，不能进入折扣商城',
  MERCHANT_NOT_CLEARANCE: '商家未把该商品设为折扣市场特价',
  MERCHANT_PRODUCT_PRIVATE: '私密或授权专属商品不能进入公开折扣商城',
  MERCHANT_STOREFRONT_INACTIVE: '商家店铺当前未公开营业',
  MISSING_COVER_IMAGE: '缺少商品主图',
  PRICE_INVALID: '批发价必须大于 0',
  NO_SELLABLE_SKU: '缺少可售 SKU',
  PLATFORM_FULFILLMENT_NOT_READY: '平台自营商品的买家下单与履约链路尚未接通，暂不能公开上架',
  SALE_WINDOW_NOT_STARTED: '商城特价活动尚未开始',
  SALE_WINDOW_ENDED: '商城特价活动已结束'
};

export interface MallReadinessProduct {
  merchantId?: string | null;
  lifecycleStatus: string;
  status: string;
  visibility?: string | null;
  isExclusiveProtected?: boolean | null;
  images: string[];
  wholesalePrice: number;
  skus: Array<{ isActive?: boolean }>;
  mallSaleStartsAt?: Date | string | null;
  mallSaleEndsAt?: Date | string | null;
}

export interface MallReadinessMerchant {
  isVerified: boolean;
  storefrontEnabled: boolean | null;
}

export interface MallReadinessInput {
  product: MallReadinessProduct;
  merchant?: MallReadinessMerchant | null;
  now?: Date;
  /** Platform self-operated checkout is not wired yet; keep the gate explicit. */
  platformFulfillmentReady?: boolean;
}

function toMillis(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isMallSaleWindowActive(
  product: Pick<MallReadinessProduct, 'mallSaleStartsAt' | 'mallSaleEndsAt'>,
  now: Date = new Date()
): boolean {
  const startsAt = toMillis(product.mallSaleStartsAt);
  const endsAt = toMillis(product.mallSaleEndsAt);
  const current = now.getTime();
  if (startsAt !== null && current < startsAt) return false;
  if (endsAt !== null && current >= endsAt) return false;
  return true;
}

export function evaluateMallReadiness(input: MallReadinessInput): { ready: boolean; reasons: MallBlockReason[] } {
  const { product, merchant = null, now = new Date(), platformFulfillmentReady = false } = input;
  const codes: MallBlockReasonCode[] = [];
  const add = (code: MallBlockReasonCode) => {
    if (!codes.includes(code)) codes.push(code);
  };

  if (product.lifecycleStatus !== 'published') add('NOT_PUBLISHED');

  const sellerType = resolveSellerType(product);
  if (sellerType === 'merchant') {
    if (product.status !== 'clearance') add('MERCHANT_NOT_CLEARANCE');
    if (product.visibility === 'private' || product.isExclusiveProtected === true) add('MERCHANT_PRODUCT_PRIVATE');
    const storefrontOpen = merchant
      ? merchant.storefrontEnabled === true || (merchant.storefrontEnabled === null && merchant.isVerified)
      : true;
    if (!storefrontOpen) add('MERCHANT_STOREFRONT_INACTIVE');
  } else if (!platformFulfillmentReady) {
    add('PLATFORM_FULFILLMENT_NOT_READY');
  }

  if (!Array.isArray(product.images) || product.images.filter(Boolean).length === 0) add('MISSING_COVER_IMAGE');
  if (!Number.isFinite(product.wholesalePrice) || product.wholesalePrice <= 0) add('PRICE_INVALID');
  if (!Array.isArray(product.skus) || product.skus.filter(sku => sku?.isActive !== false).length === 0) {
    add('NO_SELLABLE_SKU');
  }

  const startsAt = toMillis(product.mallSaleStartsAt);
  const endsAt = toMillis(product.mallSaleEndsAt);
  const current = now.getTime();
  if (startsAt !== null && current < startsAt) add('SALE_WINDOW_NOT_STARTED');
  if (endsAt !== null && current >= endsAt) add('SALE_WINDOW_ENDED');

  return {
    ready: codes.length === 0,
    reasons: codes.map(code => ({ code, message: MALL_BLOCK_REASON_MESSAGES[code] }))
  };
}

export function formatMallReasonText(reasons: MallBlockReason[]): string {
  return reasons.map(reason => `${reason.code}: ${reason.message}`).join('; ').slice(0, 500);
}

const MALL_TRANSITIONS: Record<MallAction, { from: MallStatus[]; to: MallStatus }> = {
  join: { from: ['not_listed', 'rejected', 'unlisted', 'ended', 'blocked'], to: 'pending' },
  approve: { from: ['pending'], to: 'listed' },
  reject: { from: ['pending'], to: 'rejected' },
  list: { from: ['pending', 'unlisted', 'blocked', 'rejected'], to: 'listed' },
  unlist: { from: ['listed'], to: 'unlisted' },
  remove: { from: ['pending', 'listed', 'unlisted', 'blocked', 'rejected', 'ended'], to: 'not_listed' },
  expire: { from: ['listed'], to: 'ended' }
};

export function resolveMallTransition(current: unknown, action: MallAction): MallStatus | null {
  const transition = MALL_TRANSITIONS[action];
  if (!transition || !isMallStatus(current)) return null;
  return transition.from.includes(current) ? transition.to : null;
}

/**
 * Effective status for reads: an expired window ends the listing without
 * mutating the row, so the admin still sees the stored status until it acts.
 */
export function resolveEffectiveMallStatus(
  product: { mallStatus?: string | null; mallSaleStartsAt?: Date | string | null; mallSaleEndsAt?: Date | string | null },
  now: Date = new Date()
): MallStatus {
  const status = isMallStatus(product.mallStatus) ? product.mallStatus : 'not_listed';
  if (status !== 'listed') return status;
  const endsAt = toMillis(product.mallSaleEndsAt);
  if (endsAt !== null && now.getTime() >= endsAt) return 'ended';
  return status;
}

export function isPubliclyVisibleInMall(input: MallReadinessInput & { mallStatus?: string | null }): boolean {
  const effective = resolveEffectiveMallStatus(
    { mallStatus: input.mallStatus, mallSaleStartsAt: input.product.mallSaleStartsAt, mallSaleEndsAt: input.product.mallSaleEndsAt },
    input.now
  );
  if (effective !== 'listed') return false;
  return evaluateMallReadiness(input).ready;
}

export interface MallPricingInput {
  wholesalePrice: number;
  wholesalePrice100?: number | null;
  rrpPrice?: number | null;
  moq?: number | null;
  bulkPriceMinimumQuantity?: number | null;
}

export interface MallPricing {
  listPrice: number;
  mallPrice: number;
  bulkPrice: number | null;
  rrpPrice: number | null;
  /** Savings against the base wholesale price; null when there is no real discount. */
  savingsPercent: number | null;
}

export function computeMallPricing(input: MallPricingInput): MallPricing {
  const listPrice = Number(input.wholesalePrice);
  const quantity = Number.isInteger(input.moq) && Number(input.moq) > 0 ? Number(input.moq) : 1;
  const mallPrice = getProductWholesalePriceForQuantity(
    listPrice,
    input.wholesalePrice100 ?? null,
    quantity,
    input.bulkPriceMinimumQuantity ?? 100
  );
  const bulkPrice = input.wholesalePrice100 == null ? null : Number(input.wholesalePrice100);
  const rrpPrice = input.rrpPrice == null || Number(input.rrpPrice) <= 0 ? null : Number(input.rrpPrice);
  const savingsPercent = Number.isFinite(mallPrice) && listPrice > 0 && mallPrice < listPrice
    ? Math.round(((listPrice - mallPrice) / listPrice) * 100)
    : null;
  return { listPrice, mallPrice, bulkPrice, rrpPrice, savingsPercent };
}

export const MALL_AUDIT_ACTIONS = {
  joined: 'DISCOUNT_MALL_JOINED',
  approved: 'DISCOUNT_MALL_APPROVED',
  rejected: 'DISCOUNT_MALL_REJECTED',
  listed: 'DISCOUNT_MALL_LISTED',
  unlisted: 'DISCOUNT_MALL_UNLISTED',
  removed: 'DISCOUNT_MALL_REMOVED',
  displayUpdated: 'DISCOUNT_MALL_DISPLAY_UPDATED',
  platformProductCreated: 'PLATFORM_PRODUCT_CREATED',
  platformProductUpdated: 'PLATFORM_PRODUCT_UPDATED',
  platformProductDeleted: 'PLATFORM_PRODUCT_DELETED'
} as const;

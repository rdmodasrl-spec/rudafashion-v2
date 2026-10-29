import type {
  MerchantProductSalesRecord,
  MerchantProductSalesSummary
} from '../shared/merchantProductSales';

/** 草稿与已取消订单不构成成交。 */
export const MERCHANT_SALES_EXCLUDED_ORDER_STATUSES = ['draft', 'cancelled'] as const;

/** 整单退款后不再计入成交。 */
export const MERCHANT_SALES_EXCLUDED_PAYMENT_STATUSES = ['refunded'] as const;

/** `refundStatus=completed` 表示整单已退完；部分退款保留 `partially_refunded`。 */
export const MERCHANT_SALES_EXCLUDED_REFUND_STATUSES = ['completed'] as const;

/** 只有退货已收货或已退款才扣减售出件数；仅申请/已批准仍按已售出计。 */
export const MERCHANT_SALES_COUNTED_RETURN_STATUSES = ['received', 'refunded'] as const;

const excludedOrderStatuses = new Set<string>(MERCHANT_SALES_EXCLUDED_ORDER_STATUSES);
const excludedPaymentStatuses = new Set<string>(MERCHANT_SALES_EXCLUDED_PAYMENT_STATUSES);
const excludedRefundStatuses = new Set<string>(MERCHANT_SALES_EXCLUDED_REFUND_STATUSES);
const countedReturnStatuses = new Set<string>(MERCHANT_SALES_COUNTED_RETURN_STATUSES);

export interface MerchantSaleOrderLine {
  orderId: string;
  productId: string;
  sku: string;
  quantity: number;
  orderStatus: string;
  paymentStatus: string;
  refundStatus?: string | null;
  orderedAt?: string | null;
}

export interface MerchantSaleReturnRecord {
  orderId: string;
  items: ReadonlyArray<{ productId?: string | null; sku?: string | null; quantity?: number | null }>;
}

export interface MerchantSaleOrderState {
  status: string;
  paymentStatus: string;
  refundStatus?: string | null;
}

/** 订单是否计入成交：排除草稿/取消、整单退款。 */
export const countsAsMerchantSale = (order: MerchantSaleOrderState): boolean => {
  if (excludedOrderStatuses.has(order.status)) return false;
  if (excludedPaymentStatuses.has(order.paymentStatus)) return false;
  if (order.refundStatus && excludedRefundStatuses.has(order.refundStatus)) return false;
  return true;
};

/** 退货单状态是否已实际回到库存/退款，需要从售出件数中扣减。 */
export const isMerchantSaleReturn = (status: string): boolean => countedReturnStatuses.has(status);

const lineKey = (orderId: string, productId: string, sku: string): string =>
  `${orderId}\u0000${productId}\u0000${sku}`;

const laterIso = (left: string | null, right: string | null): string | null => {
  if (!right) return left;
  if (!left) return right;
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (!Number.isFinite(rightTime)) return left;
  if (!Number.isFinite(leftTime)) return right;
  return rightTime > leftTime ? right : left;
};

/**
 * 按商品汇总净售出件数。
 *
 * 只使用订单成交明细（OrderItem）与退货明细（ReturnRequest）：
 * - 排除草稿、已取消订单与整单退款；
 * - 已收货/已退款退货按「订单 + 商品 + SKU」扣减并封顶，不出现负数；
 * - 结果与库存无关，`soldUnits > 0` 才是「已售出」。
 */
export function summarizeMerchantProductSales(
  lines: readonly MerchantSaleOrderLine[],
  returns: readonly MerchantSaleReturnRecord[] = []
): MerchantProductSalesSummary {
  const remainingByLine = new Map<string, number>();
  const productByLine = new Map<string, string>();
  const orderIdsByProduct = new Map<string, Set<string>>();
  const lastSoldAtByProduct = new Map<string, string>();

  for (const line of lines) {
    if (!countsAsMerchantSale({
      status: line.orderStatus,
      paymentStatus: line.paymentStatus,
      refundStatus: line.refundStatus
    })) continue;
    const productId = String(line.productId || '');
    const quantity = Number(line.quantity);
    if (!productId || !Number.isInteger(quantity) || quantity <= 0) continue;

    const key = lineKey(line.orderId, productId, String(line.sku || ''));
    remainingByLine.set(key, (remainingByLine.get(key) || 0) + quantity);
    productByLine.set(key, productId);

    const orderIds = orderIdsByProduct.get(productId) || new Set<string>();
    orderIds.add(line.orderId);
    orderIdsByProduct.set(productId, orderIds);

    const nextLastSoldAt = laterIso(lastSoldAtByProduct.get(productId) || null, line.orderedAt || null);
    if (nextLastSoldAt) lastSoldAtByProduct.set(productId, nextLastSoldAt);
  }

  for (const record of returns) {
    for (const item of record.items || []) {
      const productId = String(item?.productId || '');
      const sku = String(item?.sku || '');
      if (!productId) continue;
      const key = lineKey(record.orderId, productId, sku);
      const remaining = remainingByLine.get(key);
      if (remaining === undefined || remaining <= 0) continue;
      const returned = Number(item?.quantity);
      if (!Number.isInteger(returned) || returned <= 0) continue;
      remainingByLine.set(key, Math.max(0, remaining - returned));
    }
  }

  const soldUnitsByProduct = new Map<string, number>();
  for (const [key, remaining] of remainingByLine) {
    const productId = productByLine.get(key);
    if (!productId || remaining <= 0) continue;
    soldUnitsByProduct.set(productId, (soldUnitsByProduct.get(productId) || 0) + remaining);
  }

  const products: MerchantProductSalesRecord[] = [...soldUnitsByProduct.entries()]
    .filter(([, soldUnits]) => soldUnits > 0)
    .map(([productId, soldUnits]) => ({
      productId,
      soldUnits,
      orderCount: orderIdsByProduct.get(productId)?.size || 0,
      lastSoldAt: lastSoldAtByProduct.get(productId) || null
    }))
    .sort((left, right) => right.soldUnits - left.soldUnits || left.productId.localeCompare(right.productId));

  return {
    products,
    totalSoldUnits: products.reduce((sum, product) => sum + product.soldUnits, 0)
  };
}

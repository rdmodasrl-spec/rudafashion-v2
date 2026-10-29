/**
 * 商家商品「已售出」共享契约。
 *
 * 数据来自服务端对真实订单成交明细（OrderItem）与退货明细（ReturnRequest）的汇总，
 * 只表示净售出件数，与当前库存无关：有库存也可以已售出，库存为 0 但从未成交不会算作已售出。
 */
export interface MerchantProductSalesRecord {
  productId: string;
  /** 净售出件数：有效成交件数减已收货/已退款退货件数。 */
  soldUnits: number;
  /** 包含该商品的有效订单数。 */
  orderCount: number;
  /** 该商品最近一笔有效成交订单时间（ISO 字符串）。 */
  lastSoldAt: string | null;
}

export interface MerchantProductSalesSummary {
  products: MerchantProductSalesRecord[];
  totalSoldUnits: number;
}

export interface MerchantProductSalesIndex {
  soldProductIds: ReadonlySet<string>;
  soldUnitsByProduct: ReadonlyMap<string, number>;
}

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;

/** 把已售出汇总转成商品列表筛选需要的索引；非正数或缺失的记录不参与「已售出」。 */
export const buildMerchantProductSalesIndex = (
  summary: MerchantProductSalesSummary | null | undefined
): MerchantProductSalesIndex => {
  const soldProductIds = new Set<string>();
  const soldUnitsByProduct = new Map<string, number>();
  for (const record of summary?.products || []) {
    if (!record?.productId || !isPositiveInteger(record.soldUnits)) continue;
    soldProductIds.add(record.productId);
    soldUnitsByProduct.set(record.productId, record.soldUnits);
  }
  return { soldProductIds, soldUnitsByProduct };
};

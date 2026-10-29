export interface CentralInventorySku {
  stockCentral?: number;
  reserved?: number;
}

export const getAvailableSkuStock = (sku: CentralInventorySku | undefined): number => {
  if (!sku) return 0;
  return Math.max(0, (sku.stockCentral || 0) - (sku.reserved || 0));
};

/**
 * 商家商品低库存预警值：按商品全部 SKU 的在手库存合计判断。
 * 与商家 Web 商品列表的“库存低于 20”口径保持一致，避免各端出现不同低库存结论。
 */
export const PRODUCT_LOW_STOCK_THRESHOLD = 20;

export const getProductOnHandStock = (skus: readonly CentralInventorySku[] | undefined): number =>
  (skus || []).reduce((sum, sku) => sum + Math.max(0, Number(sku?.stockCentral || 0)), 0);

export const isLowStockProduct = (skus: readonly CentralInventorySku[] | undefined): boolean =>
  getProductOnHandStock(skus) < PRODUCT_LOW_STOCK_THRESHOLD;

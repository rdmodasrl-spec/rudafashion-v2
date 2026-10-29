import type { Product } from '../types/b2b';
import { getProductZone, type ProductZone } from '../utils/productZone';
import { isLowStockProduct } from './productInventory';

/** 商家商品列表第一层快捷筛选：与商品业务分区正交。 */
export type MerchantProductQuickFilter = 'all' | 'low_stock' | 'new_arrival' | 'sold';

/** 商家商品列表第二层业务分区：一件商品只归属一个分区。 */
export type MerchantProductZoneFilter = 'all' | ProductZone;

/** 新款判定窗口：以商品创建时间为准，最近 30 天创建的款式计为“新款”。 */
export const MERCHANT_NEW_ARRIVAL_WINDOW_DAYS = 30;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export interface MerchantProductBrowseOptions {
  /** 计算新款窗口的基准时间，默认当前时间。 */
  now?: number;
  /** 有真实成交记录的商品 ID（来自已售出汇总）；未读取时为空。 */
  soldProductIds?: ReadonlySet<string>;
}

export interface MerchantProductListQuery extends MerchantProductBrowseOptions {
  query?: string;
  quickFilter?: MerchantProductQuickFilter;
  zoneFilter?: MerchantProductZoneFilter;
  category?: string;
}

export const isNewArrivalProduct = (
  product: Pick<Product, 'createdAt'>,
  now: number = Date.now()
): boolean => {
  const createdAt = Date.parse(product.createdAt || '');
  if (!Number.isFinite(createdAt)) return false;
  return now - createdAt <= MERCHANT_NEW_ARRIVAL_WINDOW_DAYS * DAY_IN_MS;
};

/** 「已售出」只看真实成交记录，与库存多少无关。 */
export const isSoldProduct = (
  productId: string,
  soldProductIds?: ReadonlySet<string>
): boolean => Boolean(productId) && Boolean(soldProductIds?.has(productId));

/** 款号、商品名称（含中/意名）、品牌、品类、SKU、条码、颜色、尺码匹配。 */
export const matchesMerchantProductSearch = (product: Product, query: string): boolean => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  const haystack: Array<string | undefined> = [
    product.styleNo,
    product.name,
    product.name_zh,
    product.name_it,
    product.brand,
    product.category,
    product.subCategory
  ];
  for (const sku of product.skus || []) {
    haystack.push(sku.sku, sku.barcode, sku.color, sku.size);
  }
  return haystack.some(value => value?.toLowerCase().includes(normalized));
};

export const matchesMerchantProductQuickFilter = (
  product: Product,
  filter: MerchantProductQuickFilter,
  { now = Date.now(), soldProductIds }: MerchantProductBrowseOptions = {}
): boolean => {
  if (filter === 'low_stock') return isLowStockProduct(product.skus);
  if (filter === 'new_arrival') return isNewArrivalProduct(product, now);
  if (filter === 'sold') return isSoldProduct(product.id, soldProductIds);
  return true;
};

/** 计数始终基于未过滤的商家商品集合，切换任一层都不会重复累加。 */
export const countMerchantProductQuickFilters = (
  products: readonly Product[],
  options: MerchantProductBrowseOptions = {}
): Record<MerchantProductQuickFilter, number> => ({
  all: products.length,
  low_stock: products.filter(product => matchesMerchantProductQuickFilter(product, 'low_stock', options)).length,
  new_arrival: products.filter(product => matchesMerchantProductQuickFilter(product, 'new_arrival', options)).length,
  sold: products.filter(product => matchesMerchantProductQuickFilter(product, 'sold', options)).length
});

export const countMerchantProductZones = (products: readonly Product[]): Record<ProductZone, number> => {
  const counts: Record<ProductZone, number> = { new: 0, clearance: 0, private: 0 };
  products.forEach(product => { counts[getProductZone(product)] += 1; });
  return counts;
};

export const filterMerchantProducts = <T extends Product>(
  products: readonly T[],
  {
    query = '',
    quickFilter = 'all',
    zoneFilter = 'all',
    category = 'all',
    now = Date.now(),
    soldProductIds
  }: MerchantProductListQuery = {}
): T[] => products.filter(product =>
  matchesMerchantProductSearch(product, query)
  && matchesMerchantProductQuickFilter(product, quickFilter, { now, soldProductIds })
  && (zoneFilter === 'all' || getProductZone(product) === zoneFilter)
  && (category === 'all' || product.category === category)
);

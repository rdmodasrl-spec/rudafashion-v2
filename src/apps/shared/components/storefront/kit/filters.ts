/**
 * 店铺模板构件：筛选状态与商品选择的共用逻辑。
 *
 * 只做「在已授权的商品集合里做前端筛选」，不涉及任何可见性判断 ——
 * 授权过滤在 useStorefrontData 完成，模板拿到的就是最终集合。
 */
import { useEffect, useMemo, useState } from 'react';
import type { StorefrontProduct } from '../useStorefrontData';

export type FilterState = { category: string; material: string; color: string; size: string; inStock: boolean };

export const EMPTY_FILTERS: FilterState = { category: 'all', material: '', color: '', size: '', inStock: false };

export type StorefrontTemplateProps = {
  data: import('../useStorefrontData').StorefrontData;
  onExit?: () => void;
  initialProductId?: string | null;
  onProductChange?: (productId: string | null) => void;
};

export function useStorefrontFilters(products: StorefrontProduct[]) {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'featured' | 'priceAsc' | 'priceDesc' | 'stock' | 'newest'>('featured');

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const rows = products.filter(product => {
      if (filters.category !== 'all' && product.category !== filters.category) return false;
      if (filters.material && product.material !== filters.material) return false;
      if (filters.color && !product.colors.includes(filters.color)) return false;
      if (filters.size && !product.sizes.includes(filters.size)) return false;
      if (filters.inStock && product.availableStock <= 0) return false;
      if (!normalized) return true;
      return [product.name, product.styleNo, product.material, product.composition, product.subCategory, product.category]
        .some(value => (value || '').toLowerCase().includes(normalized));
    });
    const sorted = [...rows];
    if (sort === 'priceAsc') sorted.sort((a, b) => a.unitPrice - b.unitPrice);
    if (sort === 'priceDesc') sorted.sort((a, b) => b.unitPrice - a.unitPrice);
    if (sort === 'stock') sorted.sort((a, b) => b.availableStock - a.availableStock);
    return sorted;
  }, [products, filters, query, sort]);

  const activeCount = [
    filters.category !== 'all',
    Boolean(filters.material),
    Boolean(filters.color),
    Boolean(filters.size),
    filters.inStock
  ].filter(Boolean).length;

  const update = (next: Partial<FilterState>) => setFilters(prev => ({ ...prev, ...next }));
  const reset = () => { setFilters(EMPTY_FILTERS); setQuery(''); };

  return { filters, update, reset, query, setQuery, sort, setSort, filtered, activeCount };
}

/** 商品详情与 URL 深链（?product=）保持同步，支持前进/后退与刷新。 */
export function useActiveProduct(products: StorefrontProduct[], initialProductId: string | null, onProductChange?: (id: string | null) => void) {
  const [activeId, setActiveId] = useState<string | null>(initialProductId);

  useEffect(() => {
    if (initialProductId !== activeId) setActiveId(initialProductId);
    // 浏览器前进/后退可能打开或关闭商品详情。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProductId]);

  const open = (product: StorefrontProduct) => {
    setActiveId(product.id);
    onProductChange?.(product.id);
  };
  const close = () => {
    setActiveId(null);
    onProductChange?.(null);
  };

  const activeProduct = useMemo(() => products.find(product => product.id === activeId) || null, [products, activeId]);
  return { activeProduct, open, close };
}

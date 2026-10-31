/**
 * 店铺模板的数据装配层（唯一出口）。
 *
 * 授权过滤在这里完成，模板只能拿到已过滤结果 —— 模板不得自行放宽可见性。
 * 规则与 MerchantStoreView 保持一致：published + 未锁定 + 授权等级 + vault 保护。
 */
import { useEffect, useMemo, useState } from 'react';
import { useB2B } from '../../../../context/B2BContext';
import { apiGet } from '../../../../api/client';
import type { Merchant, Product } from '../../../../types/b2b';

export type StorefrontVisibilityContext = {
  canViewWholesale: boolean;
  isVaultApproved: boolean;
  embeddedInMerchantApp?: boolean;
};

export function isProductVisibleInStorefront(
  product: Product,
  { canViewWholesale, isVaultApproved, embeddedInMerchantApp = false }: StorefrontVisibilityContext,
  merchantId: string
): boolean {
  if (product.merchantId !== merchantId) return false;
  if ((product.lifecycleStatus || 'published') !== 'published') return false;
  if (embeddedInMerchantApp) return true;
  return (
    !product.isLockedForBuyer
    && (canViewWholesale || product.visibility !== 'wholesale')
    && ((product.visibility !== 'private' && !product.isExclusiveProtected) || isVaultApproved)
  );
}

export type StorefrontProduct = {
  id: string;
  name: string;
  styleNo: string;
  category: string;
  subCategory: string;
  material: string;
  origin: string;
  images: string[];
  colors: string[];
  sizes: string[];
  /** 已按买家折扣计算 */
  unitPrice: number;
  /** 100 件以上阶梯价；系统未设置时为 null */
  tierPrice: number | null;
  moq: number;
  packSize: number;
  availableStock: number;
  status: Product['status'];
  isClearance: boolean;
  skus: Product['skus'];
};

function uniqueValues(values: Array<string | undefined | null>): string[] {
  return values.filter((value, index, list): value is string => Boolean(value) && list.indexOf(value) === index);
}

export function mapProductForStorefront(product: Product, unitPrice: number, tierPrice: number | null): StorefrontProduct {
  const skus = product.skus || [];
  const availableStock = skus.reduce((sum, sku) => sum + Number(sku.stockCentral || 0), 0);
  return {
    id: product.id,
    name: product.name_zh || product.name,
    styleNo: product.styleNo,
    category: product.category || '',
    subCategory: product.subCategory || '',
    material: product.fabric || '',
    origin: product.origin_zh || product.origin || '',
    images: (product.images || []).filter(Boolean),
    colors: uniqueValues(product.colors?.length ? product.colors : skus.map(sku => sku.color)),
    sizes: uniqueValues(product.sizes?.length ? product.sizes : skus.map(sku => sku.size)),
    unitPrice,
    tierPrice,
    moq: Number(product.moq) || 1,
    packSize: Number(product.packSize) || 1,
    availableStock,
    status: product.status,
    isClearance: product.status === 'clearance',
    skus
  };
}

export function useStorefrontData(merchantId?: string | null) {
  const context = useB2B() as any;
  const contextMerchants: Merchant[] = Array.isArray(context.merchants) ? context.merchants : [];
  const contextProducts: Product[] = Array.isArray(context.products) ? context.products : [];

  /**
   * 预览环境的只读兜底：开发模式下 B2BContext 不拉取公共目录（沿用本地持久化），
   * 因此预览直接读同一套公共 API，保证模板验证的是真实数据而不是种子数据。
   * 生产环境 context 已有数据时不会触发任何请求。
   */
  const needsFallback = contextMerchants.length === 0 || contextProducts.length === 0;
  const [fallback, setFallback] = useState<{ merchants: Merchant[]; products: Product[] }>({ merchants: [], products: [] });
  useEffect(() => {
    if (!needsFallback) return undefined;
    let active = true;
    Promise.all([
      apiGet<{ merchants: Merchant[] }>('/api/merchants', 30000),
      apiGet<{ products: Product[] }>('/api/products', 30000)
    ]).then(([merchantResult, productResult]) => {
      if (!active) return;
      setFallback({
        merchants: Array.isArray(merchantResult?.merchants) ? merchantResult.merchants : [],
        products: Array.isArray(productResult?.products) ? productResult.products : []
      });
    }).catch(() => undefined);
    return () => { active = false; };
  }, [needsFallback]);

  const merchants = contextMerchants.length ? contextMerchants : fallback.merchants;
  const merchant: Merchant | null = useMemo(() => {
    if (merchantId) return merchants.find(item => item.id === merchantId) || null;
    return merchants[0] || null;
  }, [merchantId, merchants]);

  const canViewWholesale = Boolean(context.canViewWholesaleProducts);
  const isVaultApproved = Boolean(
    context.authRole === 'merchant'
    || (merchant && typeof context.hasVaultAccess === 'function' && context.hasVaultAccess(merchant.id))
  );
  const rawProducts: Product[] = contextProducts.length ? contextProducts : fallback.products;
  const calculateCustomerPrice: (price: number) => number = context.calculateCustomerPrice;

  const { products, hiddenWholesaleCount } = useMemo(() => {
    if (!merchant) return { products: [] as StorefrontProduct[], hiddenWholesaleCount: 0 };
    const visible = rawProducts.filter(product =>
      isProductVisibleInStorefront(product, { canViewWholesale, isVaultApproved }, merchant.id)
    );
    const hidden = rawProducts.filter(product =>
      product.merchantId === merchant.id
        && (product.lifecycleStatus || 'published') === 'published'
        && product.visibility === 'wholesale'
        && !canViewWholesale
    ).length;
    const mapped = visible.map(product => {
      const tierPrice = product.wholesalePrice100 ? calculateCustomerPrice(product.wholesalePrice100) : null;
      return mapProductForStorefront(product, calculateCustomerPrice(product.wholesalePrice), tierPrice);
    });
    return { products: mapped, hiddenWholesaleCount: hidden };
  }, [merchant, rawProducts, canViewWholesale, isVaultApproved, calculateCustomerPrice]);

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach(product => {
      if (!product.category) return;
      map.set(product.category, (map.get(product.category) || 0) + 1);
    });
    return Array.from(map, ([value, count]) => ({ value, label: value, count })).sort((a, b) => b.count - a.count);
  }, [products]);

  const materials = useMemo(() => uniqueValues(products.map(product => product.material)), [products]);
  const colors = useMemo(() => {
    const set = new Set<string>();
    products.forEach(product => product.colors.forEach(color => set.add(color)));
    return Array.from(set);
  }, [products]);

  const contact = {
    phone: merchant?.contactPhone || merchant?.phone || '',
    email: merchant?.contactEmail || '',
    address: merchant?.showroomAddress || merchant?.city || '',
    city: merchant?.city || ''
  };

  return {
    merchant,
    contact,
    products,
    categories,
    materials,
    colors,
    isWholesaleAuthorized: canViewWholesale,
    isVaultApproved,
    hiddenWholesaleCount,
    addToCart: context.addToCart as (item: any) => void,
    addMultipleToCart: context.addMultipleToCart as (items: any[]) => void,
    cartCount: Array.isArray(context.cart) ? context.cart.length : 0,
    setCurrentView: context.setCurrentView as (view: string) => void
  };
}

export type StorefrontData = ReturnType<typeof useStorefrontData>;

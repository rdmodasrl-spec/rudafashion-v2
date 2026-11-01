/**
 * 店铺模板的数据装配层（唯一出口）。
 *
 * 授权过滤在这里完成，模板只能拿到已过滤结果 —— 模板不得自行放宽可见性。
 * 规则与 MerchantStoreView 保持一致：published + 未锁定 + 授权等级 + vault 保护。
 */
import { useEffect, useMemo, useState } from 'react';
import { useB2B } from '../../../../context/B2BContext';
import { apiGet } from '../../../../api/client';
import { normalizeMediaUrl } from '../premium3d/capability';
import { isValidModelReviewCredential } from '../../../../shared/modelReviewCredential';
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
  /** 商品自有描述（真实数据），供编辑型模板做工艺/材质叙事 */
  description: string;
  composition: string;
  /** 商家上传的真实 3D 模型；没有就是 null，模板不得伪造 */
  model: { url: string; scaleMeters?: number; initialAngleDeg?: number; poster?: string } | null;
  /** 真实多角度照片（media role=detail），用于 360° 图片环视，与 3D 模型区分 */
  angleFrames: string[];
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

/**
 * 品牌叙事文案：只接受商家自己写的介绍。
 * 演示账号/后台种子数据的说明文字（含「演示 / 测试 / 后台 / DEMO」）不是品牌故事，
 * 渲染到官网品牌区会暴露内部信息，因此这里统一拦截而不是交给各模板各写一份判断。
 */
const NON_BRAND_COPY = /(演示|测试用途|测试数据|后台|DEMO|dummy|placeholder)/i;

export function resolveBrandStory(raw?: string | null): string {
  const text = (raw || '').trim();
  if (!text) return '';
  if (NON_BRAND_COPY.test(text)) return '';
  return text.length > 400 ? `${text.slice(0, 400)}…` : text;
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
    material: product.fabric_zh || product.fabric || '',
    origin: product.origin_zh || product.origin || '',
    description: resolveBrandStory(product.description_zh || product.description),
    composition: product.composition || '',
    model: resolveProductModel(product),
    angleFrames: resolveAngleFrames(product),
    images: (product.images || []).filter(Boolean).map(normalizeMediaUrl),
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

/**
 * 真实 3D 模型：只认 media 里 type === 'model'、显式 reviewStatus === 'approved'
 * 且带**合法管理员审核凭证**的条目。
 *
 * 判定统一走 src/shared/modelReviewCredential.ts，与服务端 stripUnapprovedModels 同源：
 * 缺状态、缺凭证、凭证缺真实管理员 ID 或 decision 不是 approved，一律视为未审核。
 * 前端这层是纵深防御，真正的门禁在服务端数据装配层。
 * 没有合格模型就返回 null —— 模板回落真实商品图，不生成假模型。
 */
export function resolveProductModel(product: Product): StorefrontProduct['model'] {
  const usable = (product.media || []).filter(item =>
    item.type === 'model'
    && Boolean(item.url)
    && item.reviewStatus === 'approved'
    && isValidModelReviewCredential(item.modelReview)
  );
  const picked = usable[0];
  if (!picked) return null;
  return {
    url: normalizeMediaUrl(picked.url),
    scaleMeters: picked.modelScaleMeters,
    initialAngleDeg: picked.modelInitialAngleDeg,
    poster: picked.poster ? normalizeMediaUrl(picked.poster) : undefined
  };
}

/** 360° 图片环视帧：真实多角度照片，按上传顺序。不足 3 张不具备环视价值。 */
export function resolveAngleFrames(product: Product): string[] {
  const detail = (product.media || [])
    .filter(item => item.type === 'image' && (item.role === 'detail' || item.role === 'main') && item.url)
    .map(item => normalizeMediaUrl(item.url));
  const merged = (product.images || []).filter(Boolean);
  const unique = Array.from(new Set([...merged, ...detail]));
  return unique.length >= 3 ? unique : [];
}

export function useStorefrontData(
  merchantId?: string | null,
  options: { embeddedInMerchantApp?: boolean } = {}
) {
  const context = useB2B() as any;
  const embeddedInMerchantApp = options.embeddedInMerchantApp === true;
  const contextMerchants: Merchant[] = Array.isArray(context.merchants) ? context.merchants : [];
  const contextProducts: Product[] = Array.isArray(context.products) ? context.products : [];

  /**
   * 预览环境的只读兜底：开发模式下 B2BContext 不拉取公共目录（沿用本地持久化），
   * 因此预览直接读同一套公共 API，保证模板验证的是真实数据而不是种子数据。
   * 生产环境 context 已有数据时不会触发任何请求。
   */
  const needsFallback = contextMerchants.length === 0 || contextProducts.length === 0;
  const [fallback, setFallback] = useState<{
    merchants: Merchant[];
    products: Product[];
    status: 'loading' | 'ready' | 'error';
  }>({ merchants: [], products: [], status: 'loading' });
  useEffect(() => {
    if (!needsFallback) return undefined;
    let active = true;
    setFallback(previous => ({ ...previous, status: 'loading' }));
    Promise.all([
      apiGet<{ merchants: Merchant[] }>('/api/merchants', 30000),
      apiGet<{ products: Product[] }>('/api/products', 30000)
    ]).then(([merchantResult, productResult]) => {
      if (!active) return;
      setFallback({
        merchants: Array.isArray(merchantResult?.merchants) ? merchantResult.merchants : [],
        products: Array.isArray(productResult?.products) ? productResult.products : [],
        status: 'ready'
      });
    }).catch(() => {
      if (!active) return;
      setFallback(previous => ({ ...previous, status: 'error' }));
    });
    return () => { active = false; };
  }, [needsFallback]);

  const merchants = contextMerchants.length ? contextMerchants : fallback.merchants;
  const merchant: Merchant | null = useMemo(() => {
    if (merchantId) return merchants.find(item => item.id === merchantId) || null;
    return merchants[0] || null;
  }, [merchantId, merchants]);

  // 授权来源必须与 MerchantStoreView / 公共 API 一致：context 只暴露 isRegisteredWholesale
  // （已认证且审核通过的采购账号），不存在 canViewWholesaleProducts 字段。
  const canViewWholesale = embeddedInMerchantApp || Boolean(context.isRegisteredWholesale);
  const isVaultApproved = Boolean(
    embeddedInMerchantApp
    || context.authRole === 'merchant'
    || (merchant && typeof context.hasVaultAccess === 'function' && context.hasVaultAccess(merchant.id))
  );
  const rawProducts: Product[] = contextProducts.length ? contextProducts : fallback.products;
  const calculateCustomerPrice: (price: number) => number = context.calculateCustomerPrice;

  const { products, hiddenWholesaleCount } = useMemo(() => {
    if (!merchant) return { products: [] as StorefrontProduct[], hiddenWholesaleCount: 0 };
    const visible = rawProducts.filter(product =>
      isProductVisibleInStorefront(product, { canViewWholesale, isVaultApproved, embeddedInMerchantApp }, merchant.id)
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
  }, [merchant, rawProducts, canViewWholesale, isVaultApproved, embeddedInMerchantApp, calculateCustomerPrice]);

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

  const brandStory = resolveBrandStory(
    (merchant as unknown as { description_zh?: string })?.description_zh || merchant?.description
  );

  return {
    merchant,
    contact,
    brandStory,
    isLoading: needsFallback && fallback.status === 'loading',
    loadError: needsFallback && fallback.status === 'error'
      ? '店铺数据暂时无法加载，请检查网络后重试。'
      : null,
    products,
    categories,
    materials,
    colors,
    isWholesaleAuthorized: canViewWholesale,
    isVaultApproved,
    hiddenWholesaleCount,
    addToCart: context.addToCart as (item: any) => void,
    createBuyerRfq: context.createBuyerRfq as (payload: any) => Promise<{ ok: boolean; id?: string; rfqNo?: string; error?: string }>,
    authRole: context.authRole as string | undefined,
    addMultipleToCart: context.addMultipleToCart as (items: any[]) => void,
    cartCount: Array.isArray(context.cart) ? context.cart.length : 0,
    setCurrentView: context.setCurrentView as (view: string) => void
  };
}

export type StorefrontData = ReturnType<typeof useStorefrontData>;

import type { Product, ProductMedia, SKUItem } from '../types/b2b';
import { PRODUCT_CATEGORIES } from '../constants/productCategories';

export interface MerchantProductVariantDraft {
  sku: string;
  color: string;
  colorCode: string;
  size: string;
  barcode: string;
  initialStock: number;
  isActive: boolean;
  wholesalePrice?: number;
  allowBackorder?: boolean;
}

export interface MerchantProductVariantSettings {
  wholesalePrice?: number;
  allowBackorder?: boolean;
}

export const normalizeMerchantProductVariantSettings = (
  value: unknown
): MerchantProductVariantSettings | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const settings: MerchantProductVariantSettings = {};
  if (raw.wholesalePrice !== undefined) {
    const wholesalePrice = Number(raw.wholesalePrice);
    if (!Number.isFinite(wholesalePrice) || wholesalePrice <= 0) return null;
    settings.wholesalePrice = wholesalePrice;
  }
  if (raw.allowBackorder !== undefined) {
    if (typeof raw.allowBackorder !== 'boolean') return null;
    settings.allowBackorder = raw.allowBackorder;
  }
  return settings;
};

export interface MerchantProductDraft {
  creationRequestKey: string;
  styleNo: string;
  name: string;
  category: string;
  subCategory: string;
  brand: string;
  season: string;
  wholesalePrice: number;
  wholesalePrice100: number | null;
  bulkPriceMinimumQuantity: number;
  costPrice: number;
  moq: number;
  packSize: number;
  requiresFullCarton: boolean;
  origin: string;
  fabric: string;
  composition: string;
  manufacturingProcess: string;
  fit: string;
  description: string;
  visibility: 'public' | 'private';
  status: 'new' | 'clearance';
  lifecycleStatus: 'draft' | 'published';
  variants: MerchantProductVariantDraft[];
  media: ProductMedia[];
}

export const normalizeMerchantProductDefaultMoq = (value: unknown): number => {
  const moq = Number(value);
  return Number.isSafeInteger(moq) && moq >= 1 && moq <= 100000 ? moq : 6;
};

export const createMerchantProductDraft = (defaultMoq: unknown = 6): MerchantProductDraft => ({
  creationRequestKey: crypto.randomUUID(),
  styleNo: `STY-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
  name: '',
  category: '',
  subCategory: '',
  brand: '',
  season: '',
  wholesalePrice: 0,
  wholesalePrice100: null,
  bulkPriceMinimumQuantity: 100,
  costPrice: 0,
  moq: normalizeMerchantProductDefaultMoq(defaultMoq),
  packSize: 6,
  requiresFullCarton: false,
  origin: '',
  fabric: '',
  composition: '',
  manufacturingProcess: '',
  fit: '',
  description: '',
  visibility: 'public',
  status: 'new',
  lifecycleStatus: 'draft',
  variants: [],
  media: []
});

const isWholeNumber = (value: number, minimum = 0): boolean =>
  Number.isInteger(value) && value >= minimum;

const variantKey = (color: string, size: string): string =>
  `${color.trim().toLocaleLowerCase()}::${size.trim().toLocaleLowerCase()}`;

export const generateMerchantProductVariants = (
  styleNo: string,
  colors: string[],
  sizes: string[],
  excluded: Array<{ color: string; size: string }> = []
): MerchantProductVariantDraft[] => {
  const excludedKeys = new Set(excluded.map(({ color, size }) => variantKey(color, size)));
  const uniqueColors = [...new Set(colors.map(value => value.trim()).filter(Boolean))];
  const uniqueSizes = [...new Set(sizes.map(value => value.trim()).filter(Boolean))];
  const slug = (value: string) => value.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return uniqueColors.flatMap(color => uniqueSizes
    .filter(size => !excludedKeys.has(variantKey(color, size)))
    .map(size => ({
      sku: `${styleNo.trim().toUpperCase()}-${slug(color)}-${slug(size)}`,
      color,
      colorCode: '',
      size,
      barcode: '',
      initialStock: 0,
      isActive: true,
      wholesalePrice: undefined,
      allowBackorder: false
    })));
};

export const isValidMerchantProductPricing = (pricing: {
  wholesalePrice: number;
  wholesalePrice100: number | null;
  rrpPrice: number;
  costPrice: number;
}): boolean => Number.isFinite(pricing.wholesalePrice) && pricing.wholesalePrice > 0 &&
  Number.isFinite(pricing.rrpPrice) && pricing.rrpPrice >= 0 &&
  (pricing.wholesalePrice100 === null ||
    (Number.isFinite(pricing.wholesalePrice100) &&
      pricing.wholesalePrice100 > 0 &&
      pricing.wholesalePrice100 <= pricing.wholesalePrice)) &&
  Number.isFinite(pricing.costPrice) && pricing.costPrice >= 0;

export const validateMerchantProductDraft = (
  draft: MerchantProductDraft,
  action: 'draft' | 'publish' = 'publish',
  mode: 'quick' | 'full' = 'full',
  options: { allowOptionalFullDetails?: boolean; requireImageOnPublish?: boolean; validateVariantPrices?: boolean } = {}
): string | null => {
  if (action === 'draft') return draft.media.length > 32 ? '单个商品最多保存 32 个图片或视频媒体' : null;
  if (!draft.styleNo.trim() || !draft.name.trim() ||
    !PRODUCT_CATEGORIES.some(category => category.value === draft.category)) {
    return '请填写款号、商品名称并选择产品分类';
  }
  if (action === 'publish' && options.requireImageOnPublish && !draft.media.some(item => item.type === 'image')) {
    return '发布商品至少需要一张商品图片';
  }
  if (mode === 'full' && !options.allowOptionalFullDetails &&
    (!draft.brand.trim() || !draft.season.trim() || !draft.origin.trim() || !draft.fabric.trim() || !draft.composition.trim())) {
    return '完整创建请填写品牌、季节、产地、面料和材质成分';
  }
  if (!isValidMerchantProductPricing({
    wholesalePrice: draft.wholesalePrice,
    wholesalePrice100: draft.wholesalePrice100,
    rrpPrice: 0,
    costPrice: draft.costPrice
  }) || (draft.wholesalePrice100 !== null && !isWholeNumber(draft.bulkPriceMinimumQuantity, 1))) {
    return '请确保成本价不小于 0，批发价大于 0，量大批发价不高于批发价且门槛为正整数';
  }
  if (!isWholeNumber(draft.moq, 1) || !isWholeNumber(draft.packSize, 1)) {
    return '起订量和箱规必须是大于 0 的整数';
  }
  if (draft.description.length > 3000) return '商品描述最多 3000 个字符';
  if (options.validateVariantPrices && draft.variants.some(variant =>
    !Number.isFinite(variant.wholesalePrice ?? draft.wholesalePrice) ||
    (variant.wholesalePrice ?? draft.wholesalePrice) <= 0)) {
    return '每个 SKU 的批发价必须大于 0';
  }
  if (draft.variants.length === 0 || draft.variants.some(variant =>
    !variant.sku.trim() || !variant.color.trim() || !variant.size.trim() ||
    !isWholeNumber(variant.initialStock, 0))) {
    return '至少添加一个有效 SKU，并填写款号、颜色、尺码和非负整数初始库存';
  }
  const skuKeys = draft.variants.map(variant => variant.sku.trim().toLocaleLowerCase());
  const combinationKeys = draft.variants.map(variant => variantKey(variant.color, variant.size));
  if (new Set(skuKeys).size !== skuKeys.length || new Set(combinationKeys).size !== combinationKeys.length) {
    return 'SKU 编号和颜色尺码组合不能重复';
  }
  if (draft.media.length > 32) {
    return '单个商品最多保存 32 个图片或视频媒体';
  }
  return null;
};

const createSkus = (draft: MerchantProductDraft, persistVariantPricing: boolean): SKUItem[] => draft.variants.map(variant => ({
  sku: variant.sku.trim(),
  color: variant.color.trim(),
  colorCode: variant.colorCode.trim(),
  size: variant.size.trim(),
  stockCentral: variant.initialStock,
  stockMestre: 0,
  stockMilano: 0,
  reserved: 0,
  barcode: variant.barcode.trim() || undefined,
  isActive: variant.isActive,
  ...(persistVariantPricing ? {
    wholesalePrice: variant.wholesalePrice ?? draft.wholesalePrice,
    allowBackorder: variant.allowBackorder ?? false
  } : {})
}));

export const buildMerchantProduct = (
  draft: MerchantProductDraft,
  merchantId: string,
  merchantName: string,
  options: { persistVariantPricing?: boolean } = {}
): Omit<Product, 'id'> => {
  const media = draft.media;
  const visibility = draft.visibility;
  return {
    styleNo: draft.styleNo.trim().toUpperCase(),
    name: draft.name.trim(),
    category: draft.category,
    subCategory: draft.subCategory.trim(),
    brand: draft.brand.trim() || merchantName,
    season: draft.season.trim(),
    images: media.filter(item => item.type === 'image').map(item => item.url),
    media,
    wholesalePrice: draft.wholesalePrice,
    wholesalePrice100: draft.wholesalePrice100,
    bulkPriceMinimumQuantity: draft.bulkPriceMinimumQuantity,
    rrpPrice: 0,
    costPrice: draft.costPrice,
    moq: draft.moq,
    packSize: draft.packSize,
    requiresFullCarton: draft.requiresFullCarton,
    status: draft.status,
    inventoryStatus: 'in_stock',
    origin: draft.origin.trim(),
    fabric: draft.fabric.trim(),
    composition: draft.composition.trim(),
    manufacturingProcess: draft.manufacturingProcess.trim(),
    fit: draft.fit.trim(),
    weight: '',
    packaging: '',
    washCare: '',
    description: draft.description.trim(),
    merchantId,
    merchantName,
    visibility,
    lifecycleStatus: draft.lifecycleStatus,
    isExclusiveProtected: visibility === 'private',
    skus: createSkus(draft, options.persistVariantPricing === true)
  };
};

export const getProductBulkPrice = (
  basePrice: number,
  bulkPrice: number | null | undefined,
  minimumQuantity: number | undefined,
  totalQuantity: number
): number => bulkPrice != null && totalQuantity >= (minimumQuantity ?? 100) ? bulkPrice : basePrice;

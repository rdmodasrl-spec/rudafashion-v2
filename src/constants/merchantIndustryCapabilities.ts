/**
 * 七种商家后台的行业能力清单（单一事实来源，前后端共享）。
 *
 * 规则：
 * - 模板 ID 唯一来自 `merchantIndustryTemplates.ts`，本文件不得新增第二套行业枚举。
 * - 行业差异（商品属性、价格模型、库存模型、模块开关）只写在这里，页面与 manifest 只消费。
 * - 服务端按这份清单做模块守卫与商品字段校验，前端不得自行放宽。
 */

import type { MerchantIndustryTemplateId } from './merchantIndustryTemplates';

export type MerchantIndustryModuleKey =
  | 'dashboard'
  | 'products'
  | 'inventory'
  | 'orders'
  | 'customers'
  | 'suppliers'
  | 'procurement'
  | 'pos'
  | 'pos_sales'
  | 'pos_shifts'
  | 'stores'
  | 'transfers'
  | 'team'
  | 'messages'
  | 'settings';

export type MerchantProductModel = 'apparel' | 'bags' | 'generic' | 'retail';

export type MerchantProductFieldType = 'text' | 'number' | 'select' | 'textarea' | 'media' | 'variants';

export type MerchantProductFieldOption = { value: string; label: string };

export type MerchantProductField = {
  key: string;
  label: string;
  type: MerchantProductFieldType;
  required?: boolean;
  /** 直接写入的 Product 列；缺省表示写入 `industryAttributes`。 */
  column?: 'styleNo' | 'name' | 'category' | 'subCategory' | 'brand' | 'season' | 'description' | 'fabric'
    | 'composition' | 'weight' | 'packaging' | 'origin' | 'manufacturingProcess' | 'fit' | 'barcode';
  placeholder?: string;
  help?: string;
  options?: readonly MerchantProductFieldOption[];
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
};

export type MerchantIndustryCapability = {
  templateId: MerchantIndustryTemplateId;
  /** 该行业允许的后台模块；页面导航与服务端守卫都以此为准。 */
  modules: readonly MerchantIndustryModuleKey[];
  productModel: MerchantProductModel;
  variant: {
    colorLabel: string | null;
    sizeLabel: string | null;
    requiresColor: boolean;
    requiresSize: boolean;
    requiresSku: boolean;
    barcode: boolean;
  };
  pricing: {
    primary: 'wholesale' | 'retail';
    wholesale: boolean;
    retail: boolean;
    cost: boolean;
    tiered: boolean;
    moq: boolean;
  };
  inventory: {
    mode: 'sku' | 'generic' | 'store';
    materials: boolean;
  };
  features: {
    procurement: boolean;
    suppliers: boolean;
    customers: boolean;
    pos: boolean;
    stores: boolean;
    transfers: boolean;
  };
  productFields: readonly MerchantProductField[];
};

const APPAREL_CATEGORIES: readonly MerchantProductFieldOption[] = [
  { value: 'tops', label: '上衣' },
  { value: 'shirts', label: '衬衫' },
  { value: 'tshirts', label: 'T恤' },
  { value: 'knitwear', label: '针织衫' },
  { value: 'dresses', label: '连衣裙' },
  { value: 'skirts', label: '裙子' },
  { value: 'pants', label: '裤子' },
  { value: 'jeans', label: '牛仔裤' },
  { value: 'outerwear', label: '外套' }
];

const BAGS_CATEGORIES: readonly MerchantProductFieldOption[] = [
  { value: 'bags', label: '箱包' },
  { value: 'shoes', label: '鞋履' },
  { value: 'accessories', label: '配饰' }
];

const GENERIC_CATEGORIES: readonly MerchantProductFieldOption[] = [
  { value: 'home_living', label: '家居日用' },
  { value: 'kitchen', label: '厨房用品' },
  { value: 'stationery', label: '文具办公' },
  { value: 'electronics', label: '小家电' },
  { value: 'beauty', label: '美妆个护' },
  { value: 'toys', label: '玩具' },
  { value: 'bags', label: '箱包' },
  { value: 'accessories', label: '配饰' }
];

const baseMediaField: MerchantProductField = { key: 'media', label: '商品图片', type: 'media', required: true, help: '支持 JPG、PNG、WebP，单张不超过 5MB' };
const descriptionField: MerchantProductField = { key: 'description', label: '商品描述', type: 'textarea', column: 'description', maxLength: 3000 };

const styleNoField: MerchantProductField = { key: 'styleNo', label: '款号', type: 'text', required: true, column: 'styleNo', maxLength: 100, placeholder: '如 DRS-2026-0088' };
const codeField: MerchantProductField = { key: 'styleNo', label: '商品编码', type: 'text', required: true, column: 'styleNo', maxLength: 100, placeholder: '如 SKU-10086' };
const nameField: MerchantProductField = { key: 'name', label: '商品名称', type: 'text', required: true, column: 'name', maxLength: 200 };
const brandField: MerchantProductField = { key: 'brand', label: '品牌', type: 'text', column: 'brand', maxLength: 120 };

const apparelVariant = {
  colorLabel: '颜色',
  sizeLabel: '尺码',
  requiresColor: true,
  requiresSize: true,
  requiresSku: true,
  barcode: true
} as const;

const bagsVariant = {
  colorLabel: '颜色',
  sizeLabel: '尺寸',
  requiresColor: true,
  requiresSize: true,
  requiresSku: true,
  barcode: true
} as const;

const genericVariant = {
  colorLabel: null,
  sizeLabel: null,
  requiresColor: false,
  requiresSize: false,
  requiresSku: true,
  barcode: true
} as const;

const apparelWholesaleFields: readonly MerchantProductField[] = [
  styleNoField,
  nameField,
  { key: 'category', label: '服装品类', type: 'select', required: true, column: 'category', options: APPAREL_CATEGORIES },
  { key: 'season', label: '季节', type: 'text', column: 'season', maxLength: 80, placeholder: '如 2026 春夏' },
  brandField,
  { key: 'fabric', label: '面料', type: 'text', column: 'fabric', maxLength: 200 },
  { key: 'composition', label: '成分', type: 'text', column: 'composition', maxLength: 300 },
  { key: 'variants', label: '颜色尺码 SKU', type: 'variants', required: true },
  baseMediaField,
  descriptionField
];

const bagsFields: readonly MerchantProductField[] = [
  styleNoField,
  nameField,
  brandField,
  { key: 'category', label: '箱包品类', type: 'select', required: true, column: 'category', options: BAGS_CATEGORIES },
  { key: 'material', label: '材质', type: 'text', required: true, maxLength: 120, placeholder: '如头层牛皮 / 尼龙' },
  { key: 'dimensions', label: '尺寸说明', type: 'text', maxLength: 120, placeholder: '如 35 x 28 x 12 cm' },
  { key: 'variants', label: '颜色尺寸 SKU', type: 'variants', required: true },
  baseMediaField,
  descriptionField
];

const tradingFields: readonly MerchantProductField[] = [
  codeField,
  nameField,
  brandField,
  { key: 'category', label: '商品品类', type: 'select', required: true, column: 'category', options: GENERIC_CATEGORIES },
  { key: 'spec', label: '规格', type: 'text', maxLength: 120, placeholder: '如 500ml / 3 件装' },
  { key: 'unit', label: '计量单位', type: 'text', maxLength: 20, placeholder: '件 / 箱 / kg' },
  { key: 'supplier', label: '供货供应商', type: 'text', maxLength: 120 },
  { key: 'variants', label: '供应商 SKU', type: 'variants' },
  baseMediaField,
  descriptionField
];

const departmentFields: readonly MerchantProductField[] = [
  codeField,
  { key: 'barcode', label: '条码', type: 'text', maxLength: 100 },
  nameField,
  { key: 'category', label: '百货品类', type: 'select', required: true, column: 'category', options: GENERIC_CATEGORIES },
  brandField,
  { key: 'spec', label: '规格', type: 'text', maxLength: 120 },
  { key: 'unit', label: '计量单位', type: 'text', maxLength: 20, placeholder: '件 / 箱 / kg' },
  { key: 'packaging', label: '包装规格', type: 'text', column: 'packaging', maxLength: 200 },
  { key: 'variants', label: 'SKU', type: 'variants' },
  baseMediaField,
  descriptionField
];

const retailFields: readonly MerchantProductField[] = [
  { key: 'styleNo', label: '商品编码', type: 'text', required: true, column: 'styleNo', maxLength: 100 },
  { key: 'barcode', label: '条码', type: 'text', required: true, maxLength: 100 },
  nameField,
  { key: 'category', label: '零售品类', type: 'select', required: true, column: 'category', options: GENERIC_CATEGORIES },
  { key: 'spec', label: '规格', type: 'text', maxLength: 120 },
  { key: 'unit', label: '计量单位', type: 'text', maxLength: 20 },
  { key: 'variants', label: 'SKU', type: 'variants' },
  baseMediaField,
  descriptionField
];


export const merchantIndustryCapabilities: Readonly<Record<MerchantIndustryTemplateId, MerchantIndustryCapability>> = {
  apparel_production_wholesale: {
    templateId: 'apparel_production_wholesale',
    modules: ['dashboard', 'products', 'inventory', 'orders', 'customers', 'suppliers', 'procurement', 'settings', 'team', 'messages'],
    productModel: 'apparel',
    variant: apparelVariant,
    pricing: { primary: 'wholesale', wholesale: true, retail: true, cost: true, tiered: true, moq: true },
    inventory: { mode: 'sku', materials: true },
    features: { procurement: true, suppliers: true, customers: true, pos: false, stores: false, transfers: false },
    productFields: apparelWholesaleFields
  },
  apparel_wholesale: {
    templateId: 'apparel_wholesale',
    modules: ['dashboard', 'products', 'inventory', 'orders', 'customers', 'suppliers', 'procurement', 'settings', 'team', 'messages'],
    productModel: 'apparel',
    variant: apparelVariant,
    pricing: { primary: 'wholesale', wholesale: true, retail: true, cost: false, tiered: true, moq: true },
    inventory: { mode: 'sku', materials: false },
    features: { procurement: true, suppliers: true, customers: true, pos: false, stores: false, transfers: false },
    productFields: apparelWholesaleFields
  },
  trading_wholesale: {
    templateId: 'trading_wholesale',
    modules: ['dashboard', 'products', 'procurement', 'suppliers', 'inventory', 'orders', 'customers', 'settings', 'team', 'messages'],
    productModel: 'generic',
    variant: genericVariant,
    pricing: { primary: 'wholesale', wholesale: true, retail: false, cost: true, tiered: false, moq: false },
    inventory: { mode: 'generic', materials: false },
    features: { procurement: true, suppliers: true, customers: true, pos: false, stores: false, transfers: false },
    productFields: tradingFields
  },
  department_wholesale: {
    templateId: 'department_wholesale',
    modules: ['dashboard', 'products', 'inventory', 'procurement', 'suppliers', 'orders', 'customers', 'settings', 'team', 'messages'],
    productModel: 'generic',
    variant: genericVariant,
    pricing: { primary: 'wholesale', wholesale: true, retail: false, cost: true, tiered: true, moq: true },
    inventory: { mode: 'generic', materials: false },
    features: { procurement: true, suppliers: true, customers: true, pos: false, stores: false, transfers: false },
    productFields: departmentFields
  },
  bags_wholesale: {
    templateId: 'bags_wholesale',
    modules: ['dashboard', 'products', 'inventory', 'orders', 'customers', 'suppliers', 'procurement', 'settings', 'team', 'messages'],
    productModel: 'bags',
    variant: bagsVariant,
    pricing: { primary: 'wholesale', wholesale: true, retail: true, cost: false, tiered: false, moq: true },
    inventory: { mode: 'sku', materials: false },
    features: { procurement: true, suppliers: true, customers: true, pos: false, stores: false, transfers: false },
    productFields: bagsFields
  },
  department_chain_retail: {
    templateId: 'department_chain_retail',
    modules: ['dashboard', 'stores', 'products', 'inventory', 'transfers', 'pos', 'pos_sales', 'pos_shifts', 'orders', 'customers', 'settings', 'team', 'messages'],
    productModel: 'retail',
    variant: genericVariant,
    pricing: { primary: 'retail', wholesale: false, retail: true, cost: true, tiered: false, moq: false },
    inventory: { mode: 'store', materials: false },
    features: { procurement: false, suppliers: false, customers: true, pos: true, stores: true, transfers: true },
    productFields: retailFields
  },
  general_retail: {
    templateId: 'general_retail',
    modules: ['dashboard', 'pos', 'pos_sales', 'pos_shifts', 'products', 'inventory', 'orders', 'customers', 'suppliers', 'procurement', 'settings', 'team', 'messages'],
    productModel: 'retail',
    variant: genericVariant,
    pricing: { primary: 'retail', wholesale: false, retail: true, cost: true, tiered: false, moq: false },
    inventory: { mode: 'generic', materials: false },
    features: { procurement: true, suppliers: true, customers: true, pos: true, stores: false, transfers: false },
    productFields: retailFields
  }
};

export function getMerchantIndustryCapability(value: unknown): MerchantIndustryCapability | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  return (merchantIndustryCapabilities as Record<string, MerchantIndustryCapability>)[normalized] || null;
}

export function isMerchantIndustryModuleEnabled(value: unknown, moduleKey: MerchantIndustryModuleKey): boolean {
  const capability = getMerchantIndustryCapability(value);
  return !!capability && capability.modules.includes(moduleKey);
}

/** 商品表单里行业专属属性键（写入 `Product.industryAttributes`）。 */
export function getMerchantIndustryAttributeKeys(value: unknown): string[] {
  const capability = getMerchantIndustryCapability(value);
  if (!capability) return [];
  return capability.productFields
    .filter(field => !field.column && field.type !== 'media' && field.type !== 'variants')
    .map(field => field.key);
}

/** 发布商品时是否必须提供颜色/尺码（服装与箱包保持严格 SKU 语义）。 */
export function requiresCompleteVariantAttributes(value: unknown): boolean {
  const capability = getMerchantIndustryCapability(value);
  if (!capability) return true;
  return capability.variant.requiresColor && capability.variant.requiresSize;
}


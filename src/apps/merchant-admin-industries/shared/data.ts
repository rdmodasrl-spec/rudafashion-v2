/**
 * 行业后台真实数据访问层。
 *
 * 只封装既有 `/api/merchant/*` 契约；不在此处做行业分支。
 * 任何写操作都必须由服务端返回结果驱动 UI，不允许乐观更新冒充成功。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut, ApiError } from '../../../api/client';
import { useB2B } from '../../../context/B2BContext';
import type { Order, Product, ProductMedia, WholesaleCustomer } from '../../../types/b2b';
import type { MerchantIndustryCapability, MerchantProductField } from '../../../constants/merchantIndustryCapabilities';

/**
 * `Product.industryAttributes` 是行业专属字段的唯一来源（JSON 字符串或对象）。
 * 页面必须通过本函数读取，禁止各自解析 JSON 或改读其它列。
 */
export function parseIndustryProductAttributes(product: { industryAttributes?: unknown }): Record<string, string> {
  const raw = product?.industryAttributes;
  if (!raw) return {};
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [key, String(value ?? '')])
    );
  } catch {
    return {};
  }
}

export type IndustryInventoryBalance = {
  id: string;
  variantId: string;
  sku: string;
  color: string | null;
  size: string | null;
  product: { id: string; styleNo: string; name: string };
  location: { id: string; code: string; name: string; type?: string };
  onHandQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  inTransitQuantity: number;
  version: number;
  updatedAt: string;
};

export type IndustrySupplier = {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  country: string | null;
  leadTimeDays: number;
  status: string;
  notes: string | null;
};

export type IndustryPurchaseOrder = {
  id: string;
  purchaseOrderNo: string;
  status: string;
  currency: string;
  expectedAt: string | null;
  orderedAt: string | null;
  supplier?: { id: string; name: string } | null;
  items?: Array<{ id: string; sku: string; orderedQuantity: number; receivedQuantity: number; unitCost: number }>;
};

export type IndustryPosSale = {
  id: string;
  saleNo: string;
  source?: 'order' | 'legacy';
  totalAmount: number;
  discountAmount?: number;
  refundedAmount?: number;
  paymentStatus?: string;
  paymentMethod: string;
  storeId: string | null;
  storeName: string | null;
  shiftId?: string | null;
  returnable?: boolean;
  createdAt: string;
  items: Array<{
    id: string;
    productId: string;
    sku: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    returnedQuantity?: number;
    returnableQuantity?: number;
  }>;
};

export type IndustryPosShift = {
  id: string;
  status: string;
  storeId?: string | null;
  storeName?: string | null;
  employeeName?: string | null;
  openingCash: number;
  expectedCash: number;
  cashSales: number;
  cardSales?: number;
  cashRefunds: number;
  cashIn: number;
  cashOut: number;
  salesCount?: number;
  openingNote?: string | null;
  closingCash?: number | null;
  cashDifference?: number | null;
  openedAt: string;
  closedAt?: string | null;
  employee?: { name: string } | null;
  movements?: Array<{ id: string; direction: string; amount: number; reason: string; createdAt: string }>;
};

export type IndustryPosShiftRow = {
  id: string;
  status: string;
  storeId: string | null;
  storeName: string | null;
  storeCode: string | null;
  employeeId: string | null;
  employeeName: string | null;
  openingCash: number;
  cashSales: number;
  cardSales: number;
  cashRefunds: number;
  cashIn: number;
  cashOut: number;
  salesCount: number;
  expectedCash: number;
  closingCash: number | null;
  cashDifference: number | null;
  openedAt: string;
  closedAt: string | null;
  openingNote: string | null;
  closingNote: string | null;
};

export type IndustryPosShiftDetail = {
  shift: IndustryPosShiftRow;
  sales: Array<{
    id: string;
    saleNo: string;
    totalAmount: number;
    refundedAmount: number;
    paymentMethod: string;
    paymentStatus: string;
    createdAt: string;
    items: Array<{ productName: string; sku: string; quantity: number; unitPrice: number }>;
  }>;
  refunds: Array<{ id: string; orderId: string; amount: number; status: string; reason: string | null; createdAt: string }>;
  movements: Array<{ id: string; direction: string; amount: number; reason: string; employeeName: string | null; createdAt: string }>;
};

export type IndustryTeamMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  storeId: string | null;
  store?: { id: string; name: string; code: string } | null;
};

export type IndustryStoreOption = { id: string; name: string; code: string; status: string };

export type IndustryStore = {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  status: string;
  stockSummary?: { skuCount: number; onHandQuantity: number };
};

export type IndustryStoreStock = {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  styleNo: string;
  quantity: number;
  updatedAt: string;
};

export type IndustryStoreTransfer = {
  id: string;
  transferNo: string;
  fromStoreId: string;
  fromStoreName: string;
  toStoreId: string;
  toStoreName: string;
  status: string;
  note: string | null;
  createdAt: string;
  items: Array<{ id: string; productId: string; sku: string; productName: string; quantity: number }>;
};

export type MerchantSettingsSnapshot = {
  profile: {
    name: string;
    companyLegalName: string;
    vatNumber: string;
    country: string;
    city: string;
    showroomAddress: string;
    contactPerson: string;
    contactPhone: string;
    contactEmail: string;
  } | null;
  storefront: {
    logo: string;
    storeSlug: string;
    storefrontEnabled: boolean | null;
    publiclyVisible: boolean;
    tagline: string;
    description: string;
  } | null;
  industry: { code: string; template: string | null } | null;
  websiteUrl: string;
  productEditingEnabled: boolean;
  canManageProductEditing: boolean;
  mobileLanguage: string;
  moq: string;
  defaultPaymentTerm: string;
  shippingNote: string;
  updatedAt: string;
};

export function describeApiError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const errors: Record<string, string> = {
      INDUSTRY_MODULE_UNAVAILABLE: '当前经营类型未开通该功能',
      STORE_CODE_DUPLICATE: '门店编码已存在',
      STORE_STOCK_INSUFFICIENT: '门店库存不足',
      TRANSFER_STATUS_CONFLICT: '调拨状态已变化，请刷新后重试',
      POS_SALE_INPUT_INVALID: '销售单输入不合法',
      INDUSTRY_PRODUCT_FIELDS_INVALID: '行业商品必填字段不完整',
      PRODUCT_EDITING_LOCKED: '商品编辑权限未开启，请到设置中开启后重试',
      PRODUCT_SKU_DUPLICATE: 'SKU 编码重复',
      PRODUCT_FIELDS_INVALID: '商品字段不合法，请检查必填项与价格',
      PRODUCT_COVER_IMAGE_REQUIRED: '上架商品必须上传主图',
      STYLE_NO_ALREADY_EXISTS: '款号或商品编码已存在',
      PRODUCT_VERSION_CONFLICT: '商品已在其他端更新，请刷新后重试',
      INVENTORY_VERSION_CONFLICT: '库存已被其他端更新，请刷新后重试',
      INVENTORY_BELOW_RESERVED: '调整后库存低于已预留数量',
      INVENTORY_ADJUSTMENT_INVALID: '库存调整参数不合法',
      SUPPLIER_NAME_ALREADY_EXISTS: '供应商名称已存在',
      SUPPLIER_NAME_REQUIRED: '供应商名称必填',
      STORE_ACCESS_DENIED: '没有该门店的操作权限',
      STORE_INACTIVE: '门店已停用',
      STORE_NOT_FOUND: '门店不存在或不属于当前商家',
      POS_STORE_REQUIRED: '请先选择收银门店',
      POS_STORE_NOT_SUPPORTED: '当前经营类型不支持门店收银',
      POS_DISCOUNT_INVALID: '折扣金额不合法',
      POS_DISCOUNT_NOT_PERMITTED: '当前账号没有折扣权限',
      POS_SHIFT_REQUIRED: '请先开班再收银',
      POS_SHIFT_NOT_OPEN: '当前没有进行中的班次，请重新开班',
      POS_REGISTER_ALREADY_OPEN: '收银台已有进行中的班次',
      POS_ORDER_NOT_REFUNDABLE: '该销售单当前不可退货',
      POS_RETURN_WINDOW_EXPIRED: '已超过可退货时限',
      POS_RETURN_QUANTITY_EXCEEDS_SALE: '退货数量超过可退数量',
      POS_CASH_MOVEMENT_INVALID: '现金收支参数不合法',
      EMPLOYEE_EMAIL_EXISTS: '该邮箱已是本商家员工',
      EMPLOYEE_ROLE_INVALID: '岗位模板不合法',
      EMPLOYEE_PERMISSIONS_INVALID: '员工权限不合法',
      EMPLOYEE_NAME_REQUIRED: '员工姓名必填',
      EMPLOYEE_NOT_FOUND: '员工不存在或不属于当前商家'
    };
    return errors[error.code || ''] || error.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

export function useIndustryMerchant() {
  const context = useB2B() as any;
  const merchantId: string | null = context.authMerchantId || context.activeMerchantId || context.selectedMerchantId || null;
  const merchant = useMemo(() => {
    const list = Array.isArray(context.merchants) ? context.merchants : [];
    return list.find((item: any) => item.id === merchantId) || list[0] || null;
  }, [context.merchants, merchantId]);
  const templateId: string = merchant?.workspace?.templateId || merchant?.industryTemplate || '';
  const products: Product[] = useMemo(() => {
    const list: Product[] = Array.isArray(context.products) ? context.products : [];
    return merchant ? list.filter(product => product.merchantId === merchant.id) : list;
  }, [context.products, merchant]);
  const orders: Order[] = useMemo(() => {
    const list: Order[] = Array.isArray(context.orders) ? context.orders : [];
    return merchant ? list.filter(order => order.merchantId === merchant.id) : list;
  }, [context.orders, merchant]);
  const customers: WholesaleCustomer[] = Array.isArray(context.allCustomers) ? context.allCustomers : [];
  return {
    merchantId,
    merchant,
    templateId,
    products,
    orders,
    customers,
    addNotification: context.addNotification as (type: 'success' | 'info' | 'warning', title: string, message: string) => void,
    refresh: () => context.syncMerchantData?.(merchantId ?? undefined, false) as Promise<boolean> | undefined
  };
}

export function useRemoteList<T>(path: string | null, key: string): {
  items: T[];
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
} {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const alive = useRef(true);

  useEffect(() => () => { alive.current = false; }, []);

  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    setError('');
    try {
      const response = await apiGet<Record<string, unknown>>(path);
      const list = response?.[key];
      if (alive.current) setItems(Array.isArray(list) ? list as T[] : []);
    } catch (caught) {
      if (alive.current) setError(describeApiError(caught, '数据读取失败'));
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [path, key]);

  useEffect(() => {
    if (!path) {
      setItems([]);
      return;
    }
    void reload();
  }, [path, reload]);

  return { items, loading, error, reload };
}

export async function uploadIndustryMedia(file: File): Promise<ProductMedia & { storageKey?: string; contentType?: string; sizeBytes?: number }> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('仅支持 JPG、PNG、WebP 图片');
  if (file.size > 5 * 1024 * 1024) throw new Error('图片不能超过 5MB');
  const presignResponse = await fetch('/api/merchant/media/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ contentType: file.type, fileSize: file.size })
  });
  const presign = await presignResponse.json() as { success?: boolean; uploadUrl?: string; publicUrl?: string; key?: string; error?: string };
  if (!presignResponse.ok || !presign.success || !presign.uploadUrl || !presign.publicUrl) {
    throw new Error(presign.error || '媒体上传授权失败');
  }
  const upload = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type, 'Cache-Control': 'public,max-age=31536000,immutable' },
    body: file
  });
  if (!upload.ok) throw new Error('媒体上传失败，请检查对象存储 CORS 配置');
  return {
    id: `media-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    type: 'image',
    url: presign.publicUrl,
    storageKey: presign.key,
    contentType: file.type,
    sizeBytes: file.size,
    role: 'main'
  };
}


export type IndustryVariantInput = {
  sku: string;
  color: string;
  size: string;
  barcode: string;
  initialStock: number;
};

export type IndustryProductInput = {
  styleNo: string;
  name: string;
  category: string;
  subCategory?: string;
  brand?: string;
  season?: string;
  description?: string;
  fabric?: string;
  composition?: string;
  weight?: string;
  packaging?: string;
  origin?: string;
  wholesalePrice: number;
  retailPrice: number;
  costPrice: number;
  tierPrice: number | null;
  bulkPriceMinimumQuantity: number;
  moq: number;
  packSize: number;
  status: 'new' | 'clearance' | 'hot' | 'restocked';
  attributes: Record<string, string>;
  variants: IndustryVariantInput[];
  openingStock: number;
  barcode: string;
};

export function buildIndustryProductPayload(
  capability: MerchantIndustryCapability,
  input: IndustryProductInput,
  media: ProductMedia[],
  lifecycleStatus: 'draft' | 'published'
): Record<string, unknown> {
  const attributeKeys = new Set(
    capability.productFields
      .filter((field: MerchantProductField) => !field.column && field.type !== 'media' && field.type !== 'variants')
      .map((field: MerchantProductField) => field.key)
  );
  const attributes: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.attributes)) {
    if (!attributeKeys.has(key)) continue;
    const trimmed = String(value ?? '').trim();
    if (trimmed) attributes[key] = trimmed.slice(0, 300);
  }
  const usesRetailPrice = capability.pricing.primary === 'retail';
  const primaryPrice = usesRetailPrice ? input.retailPrice : input.wholesalePrice;
  const barcodeValue = (input.barcode || attributes.barcode || '').trim();
  const variants = input.variants.length
    ? input.variants
    : [{
        sku: input.styleNo.trim(),
        color: '',
        size: '',
        barcode: barcodeValue,
        initialStock: Math.max(0, Math.trunc(input.openingStock))
      }];
  const payload: Record<string, unknown> = {
    creationRequestKey: crypto.randomUUID(),
    styleNo: input.styleNo.trim(),
    name: input.name.trim(),
    category: input.category,
    subCategory: (input.subCategory || '').trim(),
    brand: (input.brand || '').trim(),
    season: (input.season || '').trim(),
    description: (input.description || '').trim(),
    fabric: (input.fabric || '').trim(),
    composition: (input.composition || '').trim(),
    weight: (input.weight || '').trim(),
    packaging: (input.packaging || '').trim(),
    origin: (input.origin || '').trim(),
    wholesalePrice: Number(primaryPrice) || 0,
    wholesalePrice100: capability.pricing.tiered && input.tierPrice ? Number(input.tierPrice) : null,
    bulkPriceMinimumQuantity: Math.max(1, Math.trunc(input.bulkPriceMinimumQuantity || 100)),
    rrpPrice: usesRetailPrice ? Number(input.retailPrice) || 0 : 0,
    costPrice: capability.pricing.cost ? Number(input.costPrice) || 0 : 0,
    moq: capability.pricing.moq ? Math.max(1, Math.trunc(input.moq || 1)) : 1,
    packSize: Math.max(1, Math.trunc(input.packSize || 1)),
    requiresFullCarton: false,
    status: input.status,
    visibility: 'wholesale',
    lifecycleStatus,
    media,
    industryAttributes: attributes,
    skus: variants.map(variant => ({
      sku: variant.sku.trim(),
      color: variant.color.trim(),
      size: variant.size.trim(),
      barcode: variant.barcode.trim(),
      stockCentral: Math.max(0, Math.trunc(variant.initialStock)),
      isActive: true
    }))
  };
  return payload;
}

export async function createIndustryProduct(payload: Record<string, unknown>): Promise<Product> {
  const response = await apiPost<{ success: boolean; product: Product }>('/api/merchant/products', payload, 30_000);
  return response.product;
}

export async function updateIndustryProductLifecycle(product: Product, lifecycleStatus: 'draft' | 'published'): Promise<Product> {
  const response = await apiPut<{ success: boolean; product: Product }>(`/api/merchant/products/${encodeURIComponent(product.id)}`, {
    lifecycleStatus,
    expectedUpdatedAt: product.updatedAt
  });
  return response.product;
}

export async function archiveIndustryProduct(product: Product): Promise<void> {
  await apiDelete(`/api/merchant/products/${encodeURIComponent(product.id)}`);
}

export async function adjustIndustryInventory(balance: IndustryInventoryBalance, quantity: number, note: string): Promise<IndustryInventoryBalance> {
  const response = await apiPost<{ success: boolean; balance: IndustryInventoryBalance }>('/api/merchant/inventory/adjustments', {
    balanceId: balance.id,
    variantId: balance.variantId,
    locationId: balance.location.id,
    quantity,
    version: balance.version,
    note
  });
  return response.balance;
}

export async function createIndustrySupplier(input: { name: string; contactName?: string; phone?: string; email?: string; country?: string; leadTimeDays?: number; notes?: string }): Promise<IndustrySupplier> {
  const response = await apiPost<{ success: boolean; supplier: IndustrySupplier }>('/api/merchant/suppliers', input);
  return response.supplier;
}

export async function advanceIndustryOrder(order: Order, status: string, extra: { carrier?: string; trackingNumber?: string; notes?: string } = {}): Promise<void> {
  await apiPut(`/api/merchant/orders/${encodeURIComponent(order.id)}/fulfill`, { status, ...extra });
}


export async function fetchMerchantSettings(): Promise<MerchantSettingsSnapshot> {
  const response = await apiGet<{
    success: boolean;
    settings: {
      productEditingEnabled?: boolean;
      mobileLanguage?: string;
      moq?: number;
      defaultPaymentTerm?: string;
      shippingNote?: string;
      websiteUrl?: string;
    };
    updatedAt?: string | null;
    canManageProductEditing?: boolean;
    merchant: MerchantSettingsSnapshot['profile'];
    storefront?: MerchantSettingsSnapshot['storefront'];
    industry?: MerchantSettingsSnapshot['industry'];
  }>('/api/merchant/settings');
  return {
    profile: response.merchant || null,
    storefront: response.storefront || null,
    industry: response.industry || null,
    websiteUrl: response.settings?.websiteUrl || '',
    productEditingEnabled: response.settings?.productEditingEnabled === true,
    canManageProductEditing: response.canManageProductEditing !== false,
    mobileLanguage: response.settings?.mobileLanguage || 'auto',
    moq: String(response.settings?.moq ?? 6),
    defaultPaymentTerm: response.settings?.defaultPaymentTerm || 'prepaid',
    shippingNote: response.settings?.shippingNote || '',
    updatedAt: response.updatedAt || ''
  };
}

export async function setMerchantProductEditing(enabled: boolean): Promise<void> {
  await apiPut('/api/merchant/settings/product-editing', { enabled });
}

/**
 * 店铺展示与状态：复用唯一门店展示接口 `PUT /api/merchant/storefront`，
 * 只提交本次修改的字段，避免覆盖未在本页编辑的展示内容。
 */
export async function updateMerchantStorefront(input: {
  logo?: string;
  storefrontEnabled?: boolean;
  tagline?: string;
  description?: string;
}): Promise<void> {
  await apiPut('/api/merchant/storefront', input);
}

export async function listIndustryStores(): Promise<IndustryStore[]> {
  const response = await apiGet<{ success: boolean; stores: IndustryStore[] }>('/api/merchant/stores');
  return response.stores;
}

export async function createIndustryStore(input: {
  name: string;
  code: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  status: string;
}): Promise<IndustryStore> {
  const response = await apiPost<{ success: boolean; store: IndustryStore }>('/api/merchant/stores', input);
  return response.store;
}

export async function updateIndustryStore(id: string, input: Partial<Pick<IndustryStore, 'name' | 'address' | 'city' | 'country' | 'phone' | 'status'>>): Promise<IndustryStore> {
  const response = await apiPatch<{ success: boolean; store: IndustryStore }>(`/api/merchant/stores/${encodeURIComponent(id)}`, input);
  return response.store;
}

export async function listStoreStock(storeId: string): Promise<IndustryStoreStock[]> {
  const response = await apiGet<{ success: boolean; stock: IndustryStoreStock[] }>(`/api/merchant/stores/${encodeURIComponent(storeId)}/stock`);
  return response.stock;
}

export async function adjustStoreStock(storeId: string, input: { productId: string; sku: string; quantity: number; note: string }): Promise<IndustryStoreStock> {
  const response = await apiPost<{ success: boolean; stock: IndustryStoreStock }>(
    `/api/merchant/stores/${encodeURIComponent(storeId)}/stock/adjustments`,
    { ...input, idempotencyKey: crypto.randomUUID() }
  );
  return response.stock;
}

export async function listStoreTransfers(): Promise<IndustryStoreTransfer[]> {
  const response = await apiGet<{ success: boolean; transfers: IndustryStoreTransfer[] }>('/api/merchant/store-transfers');
  return response.transfers;
}

export async function createStoreTransfer(input: {
  fromStoreId: string;
  toStoreId: string;
  items: Array<{ productId: string; sku: string; quantity: number }>;
  note: string;
}): Promise<IndustryStoreTransfer> {
  const response = await apiPost<{ success: boolean; transfer: IndustryStoreTransfer }>(
    '/api/merchant/store-transfers',
    { ...input, idempotencyKey: crypto.randomUUID() }
  );
  return response.transfer;
}

export async function advanceStoreTransfer(id: string, status: 'dispatched' | 'received' | 'cancelled'): Promise<IndustryStoreTransfer> {
  const response = await apiPatch<{ success: boolean; transfer: IndustryStoreTransfer }>(
    `/api/merchant/store-transfers/${encodeURIComponent(id)}`,
    { status }
  );
  return response.transfer;
}

export async function listPosSales(): Promise<IndustryPosSale[]> {
  const response = await apiGet<{ success: boolean; sales: IndustryPosSale[] }>('/api/merchant/pos/sales');
  return response.sales;
}

export async function createPosSale(input: {
  items: Array<{ productId: string; sku: string; quantity: number }>;
  paymentMethod: 'cash' | 'card' | 'other';
  storeId?: string;
  posShiftId?: string;
  discountAmount?: number;
}): Promise<IndustryPosSale> {
  const response = await apiPost<{ success: boolean; sale: IndustryPosSale }>('/api/merchant/pos/sales', {
    ...input,
    paymentConfirmed: true,
    idempotencyKey: crypto.randomUUID()
  });
  return response.sale;
}

export async function fetchCurrentPosShift(storeId?: string): Promise<IndustryPosShift | null> {
  const query = storeId ? `?storeId=${encodeURIComponent(storeId)}` : '';
  const response = await apiGet<{ success: boolean; shift: IndustryPosShift | null }>(`/api/merchant/pos/shifts/current${query}`);
  return response.shift;
}

export async function openPosShift(input: { openingCash: number; note?: string; storeId?: string }): Promise<IndustryPosShift> {
  const response = await apiPost<{ success: boolean; shift: IndustryPosShift }>('/api/merchant/pos/shifts', input);
  return response.shift;
}

export async function closePosShift(id: string, input: { closingCash: number; note?: string }): Promise<IndustryPosShift> {
  const response = await apiPost<{ success: boolean; shift: IndustryPosShift }>(
    `/api/merchant/pos/shifts/${encodeURIComponent(id)}/close`,
    input
  );
  return response.shift;
}

export async function addPosCashMovement(
  shiftId: string,
  input: { direction: 'in' | 'out'; amount: number; reason: string }
): Promise<void> {
  await apiPost(`/api/merchant/pos/shifts/${encodeURIComponent(shiftId)}/cash-movements`, {
    ...input,
    idempotencyKey: crypto.randomUUID()
  });
}

export async function createPosReturn(input: {
  orderId: string;
  items: Array<{ productId: string; sku: string; quantity: number }>;
  reason: string;
}): Promise<{ refundAmount: number }> {
  const response = await apiPost<{ success: boolean; refundAmount: number }>('/api/merchant/pos/returns', {
    ...input,
    refundConfirmed: true,
    idempotencyKey: crypto.randomUUID()
  });
  return { refundAmount: Number(response.refundAmount || 0) };
}

export async function listPosShifts(params: {
  storeId?: string;
  employeeId?: string;
  from?: string;
  to?: string;
  status?: 'open' | 'closed';
  limit?: number;
  offset?: number;
}): Promise<{ shifts: IndustryPosShiftRow[]; total: number }> {
  const search = new URLSearchParams();
  if (params.storeId) search.set('storeId', params.storeId);
  if (params.employeeId) search.set('employeeId', params.employeeId);
  if (params.from) search.set('from', params.from);
  if (params.to) search.set('to', params.to);
  if (params.status) search.set('status', params.status);
  search.set('limit', String(params.limit ?? 20));
  search.set('offset', String(params.offset ?? 0));
  const response = await apiGet<{ success: boolean; shifts: IndustryPosShiftRow[]; total: number }>(
    `/api/merchant/pos/shifts?${search.toString()}`
  );
  return { shifts: response.shifts || [], total: Number(response.total || 0) };
}

export async function fetchPosShiftDetail(id: string): Promise<IndustryPosShiftDetail> {
  return apiGet<IndustryPosShiftDetail>(`/api/merchant/pos/shifts/${encodeURIComponent(id)}`);
}

/**
 * 班次历史的员工筛选选项。收银员通常没有员工管理权限，
 * 此时接口返回 403，这里降级为空列表，不影响班次查询本身。
 */
export async function listPosShiftEmployees(): Promise<Array<{ id: string; name: string }>> {
  try {
    const response = await apiGet<{ success: boolean; employees: Array<{ id: string; name: string; active?: boolean }> }>(
      '/api/merchant/employees'
    );
    return (response.employees || [])
      .filter(employee => employee.active !== false)
      .map(employee => ({ id: employee.id, name: employee.name }));
  } catch {
    return [];
  }
}


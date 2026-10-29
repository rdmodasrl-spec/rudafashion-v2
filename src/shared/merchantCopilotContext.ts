import type { MerchantProductDraft } from './merchantProductCreation';

export type MerchantCopilotFieldState = {
  status: 'empty' | 'filled';
  value?: string | number | boolean;
};

export type MerchantCopilotPageContext = {
  route: string;
  section: string;
  task: string;
  selectedObjectId: string | null;
  filters: Record<string, string>;
  form?: {
    id: 'merchant-product-create';
    mode: 'quick' | 'full';
    status: 'in_progress';
    fields: Record<string, MerchantCopilotFieldState>;
    variants: {
      count: number;
      colors: string[];
      sizes: string[];
      stockEnteredCount: number;
    };
    media: {
      imageCount: number;
      videoCount: number;
    };
  };
};

const allowedRoutes = new Set([
  'dashboard', 'products', 'sku_matrix', 'inventory', 'materials', 'production',
  'orders', 'vault_requests', 'customers', 'growth', 'finance', 'profile',
  'settings', 'content', 'gallery', 'support', 'pos', 'ai_employees'
]);
const allowedTasks = new Set([
  'overview', 'create_product', 'manage_products', 'manage_categories',
  'manage_orders', 'prepare_quote', 'manage_inventory', 'manage_customers',
  'manage_content', 'manage_store', 'manage_settings'
]);
const allowedFilterKeys = new Set([
  'productLifecycle', 'productZone', 'productCategory',
  'orderStatus', 'orderPayment', 'orderDate', 'customerSegment',
  'customerStatus', 'inventoryView'
]);
const allowedProductFields = new Set([
  'styleNo', 'name', 'category', 'subCategory', 'brand', 'season',
  'wholesalePrice', 'wholesalePrice100', 'bulkPriceMinimumQuantity',
  'moq', 'packSize', 'requiresFullCarton', 'origin', 'fabric',
  'composition', 'manufacturingProcess', 'fit', 'description',
  'visibility', 'status', 'lifecycleStatus'
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function fieldState(value: string | number | boolean | null): MerchantCopilotFieldState {
  if (value === null || value === '' || value === 0) return { status: 'empty' };
  return { status: 'filled', value };
}

export function createMerchantProductFormPageContext(
  draft: MerchantProductDraft,
  mode: 'quick' | 'full'
): MerchantCopilotPageContext {
  const fields: Record<string, MerchantCopilotFieldState> = {
    styleNo: fieldState(draft.styleNo),
    name: fieldState(draft.name),
    category: fieldState(draft.category),
    subCategory: fieldState(draft.subCategory),
    brand: fieldState(draft.brand),
    season: fieldState(draft.season),
    wholesalePrice: fieldState(draft.wholesalePrice),
    wholesalePrice100: fieldState(draft.wholesalePrice100),
    bulkPriceMinimumQuantity: fieldState(draft.bulkPriceMinimumQuantity),
    moq: fieldState(draft.moq),
    packSize: fieldState(draft.packSize),
    requiresFullCarton: fieldState(draft.requiresFullCarton),
    origin: fieldState(draft.origin),
    fabric: fieldState(draft.fabric),
    composition: fieldState(draft.composition),
    manufacturingProcess: fieldState(draft.manufacturingProcess),
    fit: fieldState(draft.fit),
    description: fieldState(draft.description),
    visibility: fieldState(draft.visibility),
    status: fieldState(draft.status),
    lifecycleStatus: fieldState(draft.lifecycleStatus)
  };
  return {
    route: 'products',
    section: 'create',
    task: 'create_product',
    selectedObjectId: null,
    filters: {},
    form: {
      id: 'merchant-product-create',
      mode,
      status: 'in_progress',
      fields,
      variants: {
        count: draft.variants.length,
        colors: [...new Set(draft.variants.map(variant => variant.color.trim()).filter(Boolean))].slice(0, 24),
        sizes: [...new Set(draft.variants.map(variant => variant.size.trim()).filter(Boolean))].slice(0, 24),
        stockEnteredCount: draft.variants.filter(variant => variant.initialStock > 0).length
      },
      media: {
        imageCount: draft.media.filter(item => item.type === 'image').length,
        videoCount: draft.media.filter(item => item.type === 'video').length
      }
    }
  };
}

export function sanitizeMerchantCopilotPageContext(value: unknown): MerchantCopilotPageContext | null {
  if (!isRecord(value)) return null;
  const route = value.route;
  const section = value.section;
  const task = value.task;
  const selectedObjectId = value.selectedObjectId;
  const filtersInput = value.filters;
  if (Object.keys(value).some(key => !['route', 'section', 'task', 'selectedObjectId', 'filters', 'form'].includes(key))) return null;
  if (typeof route !== 'string' || !allowedRoutes.has(route)) return null;
  if (typeof section !== 'string' || section.length > 80) return null;
  if (typeof task !== 'string' || !allowedTasks.has(task)) return null;
  let sanitizedSelectedObjectId: string | null;
  if (selectedObjectId === null) sanitizedSelectedObjectId = null;
  else if (typeof selectedObjectId === 'string' && selectedObjectId.length <= 160) {
    sanitizedSelectedObjectId = selectedObjectId;
  } else return null;
  if (!isRecord(filtersInput) || Object.keys(filtersInput).length > 9) return null;
  if (value.form !== undefined && !isRecord(value.form)) return null;

  const filters: Record<string, string> = {};
  for (const [key, filterValue] of Object.entries(filtersInput)) {
    if (!allowedFilterKeys.has(key) || typeof filterValue !== 'string' || filterValue.length > 80) return null;
    filters[key] = filterValue;
  }

  let form: MerchantCopilotPageContext['form'];
  if (value.form !== undefined) {
    const rawForm = value.form as Record<string, unknown>;
    if (Object.keys(rawForm).some(key => !['id', 'mode', 'status', 'fields', 'variants', 'media'].includes(key))
      || rawForm.id !== 'merchant-product-create'
      || (rawForm.mode !== 'quick' && rawForm.mode !== 'full')
      || rawForm.status !== 'in_progress'
      || !isRecord(rawForm.fields)
      || Object.keys(rawForm.fields).length > allowedProductFields.size
      || Object.keys(rawForm.fields).some(key => !allowedProductFields.has(key))
      || !isRecord(rawForm.variants)
      || !isRecord(rawForm.media)) return null;

    const fields: Record<string, MerchantCopilotFieldState> = {};
    for (const [key, rawState] of Object.entries(rawForm.fields)) {
      if (!isRecord(rawState)
        || Object.keys(rawState).some(stateKey => !['status', 'value'].includes(stateKey))
        || (rawState.status !== 'empty' && rawState.status !== 'filled')) return null;
      const rawValue = rawState.value;
      if (rawState.status === 'empty') {
        if (rawValue !== undefined) return null;
        fields[key] = { status: 'empty' };
      } else {
        if (!(typeof rawValue === 'string' || typeof rawValue === 'number' || typeof rawValue === 'boolean')
          || (typeof rawValue === 'string' && rawValue.length > 3_000)
          || (typeof rawValue === 'number' && !Number.isFinite(rawValue))) return null;
        fields[key] = { status: 'filled', value: rawValue };
      }
    }

    const rawVariants = rawForm.variants;
    const rawMedia = rawForm.media;
    const validCount = (count: unknown, max: number) => Number.isSafeInteger(count) && Number(count) >= 0 && Number(count) <= max;
    const validLabels = (labels: unknown): labels is string[] =>
      Array.isArray(labels) && labels.length <= 24 && labels.every(label => typeof label === 'string' && label.length <= 80);
    if (!validCount(rawVariants.count, 500)
      || !validLabels(rawVariants.colors)
      || !validLabels(rawVariants.sizes)
      || !validCount(rawVariants.stockEnteredCount, 500)
      || !validCount(rawMedia.imageCount, 32)
      || !validCount(rawMedia.videoCount, 32)) return null;
    form = {
      id: 'merchant-product-create',
      mode: rawForm.mode,
      status: 'in_progress',
      fields,
      variants: {
        count: Number(rawVariants.count),
        colors: rawVariants.colors,
        sizes: rawVariants.sizes,
        stockEnteredCount: Number(rawVariants.stockEnteredCount)
      },
      media: { imageCount: Number(rawMedia.imageCount), videoCount: Number(rawMedia.videoCount) }
    };
  }

  const result: MerchantCopilotPageContext = {
    route,
    section,
    task,
    selectedObjectId: sanitizedSelectedObjectId,
    filters,
    ...(form ? { form } : {})
  };
  return new TextEncoder().encode(JSON.stringify(result)).length <= 8_192 ? result : null;
}

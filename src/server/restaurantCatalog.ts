import { createHash } from 'node:crypto';

type JsonRecord = Record<string, unknown>;

export function isRestaurantMerchant(value: {
  industryTemplate?: unknown;
  industry?: unknown;
} | null | undefined): boolean {
  return value?.industryTemplate === 'restaurant_ordering'
    && value.industry === 'RESTAURANT';
}

export type RestaurantDishCreateInput = {
  name: string;
  nameZh?: string | null;
  nameIt?: string | null;
  category?: string;
  description?: string;
  allergens?: string[];
  productId?: string | null;
};

export type RestaurantDishUpdateInput = Partial<RestaurantDishCreateInput> & {
  expectedVersion: number;
};

export type RestaurantMenuCreateInput = {
  name: string;
  description?: string;
  currency: string;
  storeId?: string | null;
};

export type RestaurantMenuUpdateInput = Partial<Omit<RestaurantMenuCreateInput, 'storeId'>> & {
  expectedVersion: number;
};

export type RestaurantMenuTransitionInput = {
  expectedVersion: number;
};

export type RestaurantTableCreateInput = {
  storeId: string;
  code: string;
  name: string;
  capacity: number;
  area: string;
};

export type RestaurantTableUpdateInput = {
  expectedVersion: number;
  name?: string;
  capacity?: number;
  area?: string;
  status?: 'active' | 'inactive';
};

export type RestaurantMenuItemCreateInput = {
  dishId: string;
  price: string;
  sortOrder?: number;
};

export type RestaurantMenuItemUpdateInput = {
  expectedVersion: number;
  price?: string;
  sortOrder?: number;
  status?: 'available' | 'sold_out' | 'hidden';
};

export type RestaurantIngredientCreateInput = {
  code: string;
  name: string;
  category: 'produce' | 'meat' | 'seafood' | 'dairy' | 'grain' | 'seasoning' | 'beverage' | 'packaging' | 'other';
  unit: 'g' | 'kg' | 'ml' | 'l' | 'piece';
  allergens: string[];
  reorderPoint: string;
  leadTimeDays: number;
  supplierId?: string | null;
  notes?: string | null;
};

export type RestaurantIngredientUpdateInput = Partial<RestaurantIngredientCreateInput> & {
  expectedVersion: number;
  status?: 'active' | 'suspended';
};

export type RestaurantRecipeCreateInput = {
  yieldQuantity: string;
  yieldUnit: 'portion' | 'piece' | 'batch';
  notes: string;
  items: Array<{
    ingredientId: string;
    quantity: string;
    wasteRate: string;
  }>;
};

export type RestaurantRecipeActivateInput = {
  expectedVersion: number;
};

export type RestaurantStockAdjustmentInput = {
  locationCode: 'central';
  delta: string;
  reason: 'count_correction' | 'waste';
  expectedVersion: number;
  note?: string | null;
};

const restaurantIngredientCategories = [
  'produce', 'meat', 'seafood', 'dairy', 'grain', 'seasoning', 'beverage', 'packaging', 'other'
] as const;
const restaurantIngredientUnits = ['g', 'kg', 'ml', 'l', 'piece'] as const;
const restaurantAllergenCodes = [
  'gluten', 'crustaceans', 'eggs', 'fish', 'peanuts', 'soybeans', 'milk', 'nuts',
  'celery', 'mustard', 'sesame', 'sulphites', 'lupin', 'molluscs', 'other'
] as const;
const restaurantYieldUnits = ['portion', 'piece', 'batch'] as const;

function recordFrom(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function hasOnlyKeys(record: JsonRecord, allowed: readonly string[]): boolean {
  return Object.keys(record).every(key => allowed.includes(key));
}

function text(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length <= maxLength ? normalized : null;
}

function optionalText(record: JsonRecord, key: string, maxLength: number): string | null | undefined {
  if (!Object.hasOwn(record, key)) return undefined;
  if (record[key] === null && (key === 'nameZh' || key === 'nameIt' || key === 'productId' || key === 'storeId')) {
    return null;
  }
  const value = text(record[key], maxLength);
  return value && value.length > 0 ? value : null;
}

function decimalText(value: unknown, scale: number, allowZero: boolean): string | null {
  const raw = typeof value === 'string'
    ? value
    : typeof value === 'number' && Number.isFinite(value)
      ? String(value)
      : null;
  if (!raw) return null;
  const pattern = new RegExp(`^(?:0|[1-9]\\d{0,9})(?:\\.\\d{1,${scale}})?$`);
  if (!pattern.test(raw)) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || (allowZero ? parsed < 0 : parsed <= 0)) return null;
  return raw;
}

function normalizedCode(value: unknown): string | null {
  const code = text(value, 80)?.toUpperCase();
  return code && /^[A-Z0-9][A-Z0-9._-]*$/.test(code) ? code : null;
}

function normalizeAllergenCodes(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > restaurantAllergenCodes.length) return null;
  const allergens: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !restaurantAllergenCodes.includes(item as typeof restaurantAllergenCodes[number])
      || allergens.includes(item)) return null;
    allergens.push(item);
  }
  return allergens;
}

function idempotencyKeyFrom(value: unknown): string | null {
  return typeof value === 'string'
    && value.length >= 8
    && value.length <= 160
    && /^[A-Za-z0-9._:-]+$/.test(value)
    ? value
    : null;
}

export function normalizeRestaurantIdempotencyKey(value: unknown): string | null {
  return idempotencyKeyFrom(value);
}

export function restaurantRequestHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function normalizeRestaurantDishCreate(value: unknown): RestaurantDishCreateInput | null {
  const record = recordFrom(value);
  if (!record || !hasOnlyKeys(record, ['name', 'nameZh', 'nameIt', 'category', 'description', 'allergens', 'productId'])) return null;
  const name = text(record.name, 160);
  if (!name) return null;

  const nameZh = optionalText(record, 'nameZh', 160);
  const nameIt = optionalText(record, 'nameIt', 160);
  const category = optionalText(record, 'category', 96);
  const description = optionalText(record, 'description', 2000);
  const productId = optionalText(record, 'productId', 64);
  if (nameZh === null && record.nameZh !== null
    || nameIt === null && record.nameIt !== null
    || category === null && record.category !== undefined
    || description === null && record.description !== undefined
    || productId === null && record.productId !== undefined && record.productId !== null) return null;

  let allergens: string[] | undefined;
  if (Object.hasOwn(record, 'allergens')) {
    if (!Array.isArray(record.allergens) || record.allergens.length > 30) return null;
    const values: string[] = [];
    for (const item of record.allergens) {
      const normalized = text(item, 64);
      if (!normalized || values.includes(normalized)) return null;
      values.push(normalized);
    }
    allergens = values;
  }

  return {
    name,
    ...(nameZh !== undefined ? { nameZh } : {}),
    ...(nameIt !== undefined ? { nameIt } : {}),
    ...(category !== undefined ? { category } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(allergens !== undefined ? { allergens } : {}),
    ...(productId !== undefined ? { productId } : {})
  };
}

export function normalizeRestaurantDishUpdate(value: unknown): RestaurantDishUpdateInput | null {
  const record = recordFrom(value);
  if (!record || !hasOnlyKeys(record, [
    'expectedVersion', 'name', 'nameZh', 'nameIt', 'category', 'description', 'allergens', 'productId'
  ])) return null;
  const expectedVersion = record.expectedVersion;
  if (!Number.isInteger(expectedVersion) || Number(expectedVersion) < 1) return null;
  const patch: Partial<RestaurantDishCreateInput> = {};
  if (Object.hasOwn(record, 'name')) {
    const name = text(record.name, 160);
    if (!name) return null;
    patch.name = name;
  }
  for (const key of ['nameZh', 'nameIt'] as const) {
    if (!Object.hasOwn(record, key)) continue;
    if (record[key] === null) {
      patch[key] = null;
      continue;
    }
    const value = text(record[key], 160);
    if (!value) return null;
    patch[key] = value;
  }
  for (const key of ['category', 'description'] as const) {
    if (!Object.hasOwn(record, key)) continue;
    const value = text(record[key], key === 'category' ? 96 : 2000);
    if (value === null) return null;
    patch[key] = value;
  }
  if (Object.hasOwn(record, 'productId')) {
    if (record.productId === null) patch.productId = null;
    else {
      const productId = text(record.productId, 64);
      if (!productId) return null;
      patch.productId = productId;
    }
  }
  if (Object.hasOwn(record, 'allergens')) {
    if (!Array.isArray(record.allergens) || record.allergens.length > 30) return null;
    const allergens: string[] = [];
    for (const item of record.allergens) {
      const normalized = text(item, 64);
      if (!normalized || allergens.includes(normalized)) return null;
      allergens.push(normalized);
    }
    patch.allergens = allergens;
  }
  return Object.keys(patch).length > 0 ? { ...patch, expectedVersion: Number(expectedVersion) } : null;
}

export function normalizeRestaurantMenuCreate(value: unknown): RestaurantMenuCreateInput | null {
  const record = recordFrom(value);
  if (!record || !hasOnlyKeys(record, ['name', 'description', 'currency', 'storeId'])) return null;
  const name = text(record.name, 160);
  const description = record.description === undefined ? '' : text(record.description, 2000);
  const currency = record.currency === undefined ? 'EUR' : text(record.currency, 3)?.toUpperCase();
  const storeId = optionalText(record, 'storeId', 64);
  if (!name || description === null || !currency || !/^[A-Z]{3}$/.test(currency)) return null;
  if (storeId === null && record.storeId !== undefined && record.storeId !== null) return null;
  return { name, description, currency, ...(storeId !== undefined ? { storeId } : {}) };
}

export function normalizeRestaurantMenuUpdate(value: unknown): RestaurantMenuUpdateInput | null {
  const record = recordFrom(value);
  if (!record || !hasOnlyKeys(record, ['expectedVersion', 'name', 'description', 'currency'])) return null;
  const expectedVersion = record.expectedVersion;
  if (!Number.isInteger(expectedVersion) || Number(expectedVersion) < 1) return null;
  const patch: Partial<RestaurantMenuUpdateInput> = { expectedVersion: Number(expectedVersion) };
  if (Object.hasOwn(record, 'name')) {
    const name = text(record.name, 160);
    if (!name) return null;
    patch.name = name;
  }
  if (Object.hasOwn(record, 'description')) {
    const description = text(record.description, 2000);
    if (description === null) return null;
    patch.description = description;
  }
  if (Object.hasOwn(record, 'currency')) {
    const currency = text(record.currency, 3)?.toUpperCase();
    if (!currency || !/^[A-Z]{3}$/.test(currency)) return null;
    patch.currency = currency;
  }
  return Object.keys(patch).length > 1 ? patch as RestaurantMenuUpdateInput : null;
}

export function normalizeRestaurantMenuTransition(value: unknown): RestaurantMenuTransitionInput | null {
  const record = recordFrom(value);
  if (!record || !hasOnlyKeys(record, ['expectedVersion'])
    || !Number.isInteger(record.expectedVersion) || Number(record.expectedVersion) < 1) return null;
  return { expectedVersion: Number(record.expectedVersion) };
}

export function normalizeRestaurantTableCreate(value: unknown): RestaurantTableCreateInput | null {
  const record = recordFrom(value);
  if (!record || !hasOnlyKeys(record, ['storeId', 'code', 'name', 'capacity', 'area'])) return null;
  const storeId = text(record.storeId, 160);
  const rawCode = text(record.code, 32);
  const name = text(record.name, 80);
  const area = record.area === undefined ? '' : text(record.area, 80);
  const code = rawCode?.toUpperCase() ?? null;
  if (!storeId || !code || !/^[A-Z0-9][A-Z0-9_-]*$/.test(code)
    || !name || !Number.isInteger(record.capacity) || Number(record.capacity) < 1 || Number(record.capacity) > 40
    || area === null) return null;
  return { storeId, code, name, capacity: Number(record.capacity), area: area ?? '' };
}

export function normalizeRestaurantTableUpdate(value: unknown): RestaurantTableUpdateInput | null {
  const record = recordFrom(value);
  if (!record || !hasOnlyKeys(record, ['expectedVersion', 'name', 'capacity', 'area', 'status'])
    || !Number.isInteger(record.expectedVersion) || Number(record.expectedVersion) < 1) return null;
  const result: RestaurantTableUpdateInput = { expectedVersion: Number(record.expectedVersion) };
  if (Object.hasOwn(record, 'name')) {
    const name = text(record.name, 80);
    if (!name) return null;
    result.name = name;
  }
  if (Object.hasOwn(record, 'capacity')) {
    if (!Number.isInteger(record.capacity) || Number(record.capacity) < 1 || Number(record.capacity) > 40) return null;
    result.capacity = Number(record.capacity);
  }
  if (Object.hasOwn(record, 'area')) {
    const area = text(record.area, 80);
    if (area === null) return null;
    result.area = area;
  }
  if (Object.hasOwn(record, 'status')) {
    if (record.status !== 'active' && record.status !== 'inactive') return null;
    result.status = record.status;
  }
  return Object.keys(result).length > 1 ? result : null;
}

export function normalizeRestaurantPrice(value: unknown): string | null {
  const raw = typeof value === 'number' && Number.isFinite(value) ? String(value) : value;
  if (typeof raw !== 'string' || !/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(raw)) return null;
  return raw.includes('.') ? raw : `${raw}.00`;
}

export function normalizeRestaurantMenuItemCreate(value: unknown): RestaurantMenuItemCreateInput | null {
  const record = recordFrom(value);
  if (!record || !hasOnlyKeys(record, ['dishId', 'price', 'sortOrder'])) return null;
  const dishId = text(record.dishId, 64);
  const price = normalizeRestaurantPrice(record.price);
  const sortOrder = record.sortOrder === undefined ? 0 : record.sortOrder;
  if (!dishId || !price || !Number.isInteger(sortOrder) || Number(sortOrder) < 0 || Number(sortOrder) > 100000) return null;
  return { dishId, price, sortOrder: Number(sortOrder) };
}

export function normalizeRestaurantMenuItemUpdate(value: unknown): RestaurantMenuItemUpdateInput | null {
  const record = recordFrom(value);
  if (!record || !hasOnlyKeys(record, ['expectedVersion', 'price', 'sortOrder', 'status'])) return null;
  const expectedVersion = record.expectedVersion;
  if (!Number.isInteger(expectedVersion) || Number(expectedVersion) < 1) return null;
  const patch: RestaurantMenuItemUpdateInput = { expectedVersion: Number(expectedVersion) };
  if (Object.hasOwn(record, 'price')) {
    const price = normalizeRestaurantPrice(record.price);
    if (!price) return null;
    patch.price = price;
  }
  if (Object.hasOwn(record, 'sortOrder')) {
    const sortOrder = record.sortOrder;
    if (!Number.isInteger(sortOrder) || Number(sortOrder) < 0 || Number(sortOrder) > 100000) return null;
    patch.sortOrder = Number(sortOrder);
  }
  if (Object.hasOwn(record, 'status')) {
    if (record.status !== 'available' && record.status !== 'sold_out' && record.status !== 'hidden') return null;
    patch.status = record.status;
  }
  return Object.keys(patch).length > 1 ? patch : null;
}

export function normalizeRestaurantIngredientCreate(value: unknown): RestaurantIngredientCreateInput | null {
  const record = recordFrom(value);
  if (!record || !hasOnlyKeys(record, [
    'code', 'name', 'category', 'unit', 'allergens', 'reorderPoint', 'leadTimeDays', 'supplierId', 'notes'
  ])) return null;
  const code = normalizedCode(record.code);
  const name = text(record.name, 200);
  const category = record.category;
  const unit = record.unit;
  const allergens = record.allergens === undefined ? [] : normalizeAllergenCodes(record.allergens);
  const reorderPoint = decimalText(record.reorderPoint ?? '0', 3, true);
  const leadTimeDays = record.leadTimeDays ?? 0;
  const supplierId = optionalText(record, 'supplierId', 64);
  const notes = optionalText(record, 'notes', 2000);
  if (!code || !name
    || !restaurantIngredientCategories.includes(category as typeof restaurantIngredientCategories[number])
    || !restaurantIngredientUnits.includes(unit as typeof restaurantIngredientUnits[number])
    || !allergens || !reorderPoint
    || !Number.isInteger(leadTimeDays) || Number(leadTimeDays) < 0 || Number(leadTimeDays) > 3650
    || supplierId === null && record.supplierId !== undefined && record.supplierId !== null
    || notes === null && record.notes !== undefined && record.notes !== null) return null;
  return {
    code,
    name,
    category: category as RestaurantIngredientCreateInput['category'],
    unit: unit as RestaurantIngredientCreateInput['unit'],
    allergens,
    reorderPoint,
    leadTimeDays: Number(leadTimeDays),
    ...(supplierId !== undefined ? { supplierId } : {}),
    ...(notes !== undefined ? { notes } : {})
  };
}

export function normalizeRestaurantIngredientUpdate(value: unknown): RestaurantIngredientUpdateInput | null {
  const record = recordFrom(value);
  if (!record || !hasOnlyKeys(record, [
    'expectedVersion', 'code', 'name', 'category', 'unit', 'allergens',
    'reorderPoint', 'leadTimeDays', 'supplierId', 'notes', 'status'
  ])) return null;
  const expectedVersion = record.expectedVersion;
  if (!Number.isInteger(expectedVersion) || Number(expectedVersion) < 1) return null;
  const patch: Partial<RestaurantIngredientUpdateInput> = { expectedVersion: Number(expectedVersion) };
  if (Object.hasOwn(record, 'code')) {
    const code = normalizedCode(record.code);
    if (!code) return null;
    patch.code = code;
  }
  if (Object.hasOwn(record, 'name')) {
    const name = text(record.name, 200);
    if (!name) return null;
    patch.name = name;
  }
  if (Object.hasOwn(record, 'category')) {
    if (!restaurantIngredientCategories.includes(record.category as typeof restaurantIngredientCategories[number])) return null;
    patch.category = record.category as RestaurantIngredientCreateInput['category'];
  }
  if (Object.hasOwn(record, 'unit')) {
    if (!restaurantIngredientUnits.includes(record.unit as typeof restaurantIngredientUnits[number])) return null;
    patch.unit = record.unit as RestaurantIngredientCreateInput['unit'];
  }
  if (Object.hasOwn(record, 'allergens')) {
    const allergens = normalizeAllergenCodes(record.allergens);
    if (!allergens) return null;
    patch.allergens = allergens;
  }
  if (Object.hasOwn(record, 'reorderPoint')) {
    const reorderPoint = decimalText(record.reorderPoint, 3, true);
    if (!reorderPoint) return null;
    patch.reorderPoint = reorderPoint;
  }
  if (Object.hasOwn(record, 'leadTimeDays')) {
    if (!Number.isInteger(record.leadTimeDays) || Number(record.leadTimeDays) < 0 || Number(record.leadTimeDays) > 3650) return null;
    patch.leadTimeDays = Number(record.leadTimeDays);
  }
  if (Object.hasOwn(record, 'supplierId')) {
    if (record.supplierId === null) patch.supplierId = null;
    else {
      const supplierId = text(record.supplierId, 64);
      if (!supplierId) return null;
      patch.supplierId = supplierId;
    }
  }
  if (Object.hasOwn(record, 'notes')) {
    if (record.notes === null) patch.notes = null;
    else {
      const notes = text(record.notes, 2000);
      if (notes === null) return null;
      patch.notes = notes;
    }
  }
  if (Object.hasOwn(record, 'status')) {
    if (record.status !== 'active' && record.status !== 'suspended') return null;
    patch.status = record.status;
  }
  return Object.keys(patch).length > 1 ? patch as RestaurantIngredientUpdateInput : null;
}

export function normalizeRestaurantRecipeCreate(value: unknown): RestaurantRecipeCreateInput | null {
  const record = recordFrom(value);
  if (!record || !hasOnlyKeys(record, ['yieldQuantity', 'yieldUnit', 'notes', 'items'])
    || !Array.isArray(record.items) || record.items.length < 1 || record.items.length > 100) return null;
  const yieldQuantity = decimalText(record.yieldQuantity, 3, false);
  const yieldUnit = record.yieldUnit;
  const notes = record.notes === undefined ? '' : text(record.notes, 2000);
  if (!yieldQuantity || !restaurantYieldUnits.includes(yieldUnit as typeof restaurantYieldUnits[number]) || notes === null) return null;
  const items: RestaurantRecipeCreateInput['items'] = [];
  for (const rawItem of record.items) {
    const item = recordFrom(rawItem);
    if (!item || !hasOnlyKeys(item, ['ingredientId', 'quantity', 'wasteRate'])) return null;
    const ingredientId = text(item.ingredientId, 64);
    const quantity = decimalText(item.quantity, 4, false);
    const wasteRate = decimalText(item.wasteRate ?? '0', 4, true);
    if (!ingredientId || !quantity || !wasteRate || items.some(existing => existing.ingredientId === ingredientId)) return null;
    if (Number(wasteRate) >= 1) return null;
    items.push({ ingredientId, quantity, wasteRate });
  }
  return {
    yieldQuantity,
    yieldUnit: yieldUnit as RestaurantRecipeCreateInput['yieldUnit'],
    notes,
    items
  };
}

export function normalizeRestaurantRecipeActivate(value: unknown): RestaurantRecipeActivateInput | null {
  const record = recordFrom(value);
  if (!record || !hasOnlyKeys(record, ['expectedVersion'])
    || !Number.isInteger(record.expectedVersion) || Number(record.expectedVersion) < 1) return null;
  return { expectedVersion: Number(record.expectedVersion) };
}

export function normalizeRestaurantStockAdjustment(value: unknown): RestaurantStockAdjustmentInput | null {
  const record = recordFrom(value);
  if (!record || !hasOnlyKeys(record, ['locationCode', 'delta', 'reason', 'expectedVersion', 'note'])) return null;
  if (record.locationCode !== 'central'
    || (record.reason !== 'count_correction' && record.reason !== 'waste')
    || !Number.isInteger(record.expectedVersion)
    || Number(record.expectedVersion) < 0) return null;
  const rawDelta = typeof record.delta === 'number' && Number.isFinite(record.delta)
    ? String(record.delta)
    : record.delta;
  if (typeof rawDelta !== 'string' || !/^-?(?:0|[1-9]\d{0,6})(?:\.\d{1,3})?$/.test(rawDelta)) return null;
  const deltaNumber = Number(rawDelta);
  if (!Number.isFinite(deltaNumber) || deltaNumber === 0 || Math.abs(deltaNumber) > 1_000_000) return null;
  if (record.reason === 'waste' && deltaNumber >= 0) return null;
  const note = optionalText(record, 'note', 500);
  if (note === null && record.note !== undefined && record.note !== null) return null;
  return {
    locationCode: 'central',
    delta: rawDelta,
    reason: record.reason,
    expectedVersion: Number(record.expectedVersion),
    ...(note !== undefined ? { note } : {})
  };
}

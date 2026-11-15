type JsonRecord = Record<string, unknown>;

export type RestaurantPurchaseOrderCreateInput = {
  supplierId: string;
  currency: string;
  notes: string;
  items: Array<{
    ingredientId: string;
    orderedQuantity: string;
    quotedUnitCost: string;
  }>;
};

export type RestaurantPurchaseTransitionInput = {
  expectedVersion: number;
};

export type RestaurantPurchaseReceiptInput = RestaurantPurchaseTransitionInput & {
  note: string;
  items: Array<{
    itemId: string;
    quantity: string;
    unitCost: string;
  }>;
};

function recordFrom(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function hasOnlyKeys(record: JsonRecord, allowed: readonly string[]): boolean {
  return Object.keys(record).every(key => allowed.includes(key));
}

function text(value: unknown, maximum: number): string | null {
  if (typeof value !== 'string') return null;
  const result = value.trim();
  return result.length > 0 && result.length <= maximum ? result : null;
}

function decimal(value: unknown, scale: number, allowZero: boolean): string | null {
  if (typeof value !== 'string') return null;
  const pattern = new RegExp(`^(?:0|[1-9]\\d{0,6})(?:\\.\\d{1,${scale}})?$`);
  if (!pattern.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  const canonical = `${whole}.${fraction.padEnd(scale, '0')}`;
  return !allowZero && /^0(?:\.0+)?$/.test(canonical) ? null : canonical;
}

function expectedVersion(value: unknown): number | null {
  return Number.isInteger(value) && Number(value) >= 1 ? Number(value) : null;
}

function normalizeLines<T>(
  value: unknown,
  normalizeLine: (record: JsonRecord) => T | null,
  identity: (line: T) => string
): T[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) return null;
  const lines: T[] = [];
  for (const valueItem of value) {
    const record = recordFrom(valueItem);
    if (!record) return null;
    const line = normalizeLine(record);
    if (!line || lines.some(existing => identity(existing) === identity(line))) return null;
    lines.push(line);
  }
  return lines;
}

export function normalizeRestaurantPurchaseOrderCreate(value: unknown): RestaurantPurchaseOrderCreateInput | null {
  const record = recordFrom(value);
  if (!record || !hasOnlyKeys(record, ['supplierId', 'currency', 'notes', 'items'])) return null;
  const supplierId = text(record.supplierId, 64);
  const currency = typeof record.currency === 'string' ? record.currency.trim().toUpperCase() : '';
  if (!supplierId || !/^[A-Z]{3}$/.test(currency)) return null;
  if (record.notes !== undefined && typeof record.notes !== 'string') return null;
  const notes = typeof record.notes === 'string' ? record.notes.trim() : '';
  if (notes.length > 2000) return null;
  const items = normalizeLines(record.items, item => {
    if (!hasOnlyKeys(item, ['ingredientId', 'orderedQuantity', 'quotedUnitCost'])) return null;
    const ingredientId = text(item.ingredientId, 64);
    const orderedQuantity = decimal(item.orderedQuantity, 3, false);
    const quotedUnitCost = decimal(item.quotedUnitCost, 4, true);
    if (!ingredientId || !orderedQuantity || !quotedUnitCost) return null;
    return { ingredientId, orderedQuantity, quotedUnitCost };
  }, line => line.ingredientId);
  return items ? { supplierId, currency, notes, items } : null;
}

export function normalizeRestaurantPurchaseTransition(value: unknown): RestaurantPurchaseTransitionInput | null {
  const record = recordFrom(value);
  if (!record || !hasOnlyKeys(record, ['expectedVersion'])) return null;
  const version = expectedVersion(record.expectedVersion);
  return version === null ? null : { expectedVersion: version };
}

export function normalizeRestaurantPurchaseReceipt(value: unknown): RestaurantPurchaseReceiptInput | null {
  const record = recordFrom(value);
  if (!record || !hasOnlyKeys(record, ['expectedVersion', 'note', 'items'])) return null;
  const version = expectedVersion(record.expectedVersion);
  if (version === null || (record.note !== undefined && typeof record.note !== 'string')) return null;
  const note = typeof record.note === 'string' ? record.note.trim() : '';
  if (note.length > 2000) return null;
  const items = normalizeLines(record.items, item => {
    if (!hasOnlyKeys(item, ['itemId', 'quantity', 'unitCost'])) return null;
    const itemId = text(item.itemId, 64);
    const quantity = decimal(item.quantity, 3, false);
    const unitCost = decimal(item.unitCost, 4, true);
    if (!itemId || !quantity || !unitCost) return null;
    return { itemId, quantity, unitCost };
  }, line => line.itemId);
  return items ? { expectedVersion: version, note, items } : null;
}

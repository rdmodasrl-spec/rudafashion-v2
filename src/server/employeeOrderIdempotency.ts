export type EmployeeOrderReplayRecord = {
  merchantId: string | null;
  customerId: string | null;
  paymentMethod: string;
  posShiftId: string | null;
  orderNo: string;
  items: readonly { productId: string; sku: string; quantity: number }[];
};

export type EmployeeOrderReplayRequest = {
  merchantId: string;
  customerId: string | null;
  paymentMethod: string;
  posShiftId: string | null;
  isPosSale: boolean;
  items: readonly unknown[];
};

function normalizeItems(items: readonly unknown[]): Array<{ productId: string; sku: string; quantity: number }> | null {
  const normalized: Array<{ productId: string; sku: string; quantity: number }> = [];
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const value = item as Record<string, unknown>;
    const productId = typeof value.productId === 'string' ? value.productId : '';
    const sku = typeof value.sku === 'string' ? value.sku : '';
    const quantity = Number(value.quantity);
    if (!productId || !sku || !Number.isInteger(quantity) || quantity < 1) return null;
    normalized.push({ productId, sku, quantity });
  }
  return normalized.sort((left, right) =>
    left.productId.localeCompare(right.productId)
    || left.sku.localeCompare(right.sku)
    || left.quantity - right.quantity
  );
}

export function isEmployeeOrderReplayMatch(
  existing: EmployeeOrderReplayRecord,
  request: EmployeeOrderReplayRequest
): boolean {
  const existingItems = normalizeItems(existing.items);
  const requestItems = normalizeItems(request.items);
  return existing.merchantId === request.merchantId
    && existing.customerId === request.customerId
    && existing.paymentMethod === request.paymentMethod
    && existing.posShiftId === request.posShiftId
    && existing.orderNo.startsWith('POS-') === request.isPosSale
    && existingItems !== null
    && requestItems !== null
    && JSON.stringify(existingItems) === JSON.stringify(requestItems);
}

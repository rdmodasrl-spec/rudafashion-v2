export type MerchantPurchaseOrderStatus = 'draft' | 'ordered' | 'partially_received' | 'received' | 'cancelled';

export function canTransitionPurchaseOrderStatus(
  current: MerchantPurchaseOrderStatus,
  next: MerchantPurchaseOrderStatus
): boolean {
  if (current === 'draft') return next === 'ordered' || next === 'cancelled';
  if (current === 'ordered') return next === 'partially_received' || next === 'received' || next === 'cancelled';
  if (current === 'partially_received') return next === 'received' || next === 'cancelled';
  return false;
}

export function getPurchaseOrderInTransitDelta(
  current: MerchantPurchaseOrderStatus,
  next: MerchantPurchaseOrderStatus,
  orderedQuantity: number,
  receivedQuantity: number
): number {
  const remainingQuantity = orderedQuantity - receivedQuantity;
  if (!Number.isInteger(remainingQuantity) || remainingQuantity < 0) {
    throw new Error('PURCHASE_ORDER_QUANTITY_INVALID');
  }
  if (current === 'draft' && next === 'ordered') return remainingQuantity;
  if ((current === 'ordered' || current === 'partially_received') && next === 'cancelled') return -remainingQuantity;
  return 0;
}

export function getPurchaseOrderStatusAfterReceipt(
  items: Array<{ id: string; orderedQuantity: number; receivedQuantity: number }>,
  receiptQuantities: Map<string, number>
): 'partially_received' | 'received' {
  if (!items.length || receiptQuantities.size === 0) throw new Error('PURCHASE_RECEIPT_ITEMS_INVALID');
  const itemIds = new Set(items.map(item => item.id));
  if ([...receiptQuantities.keys()].some(id => !itemIds.has(id))) throw new Error('PURCHASE_RECEIPT_ITEM_UNKNOWN');
  let allReceived = true;
  for (const item of items) {
    const quantity = receiptQuantities.get(item.id) || 0;
    if (!Number.isInteger(quantity) || quantity < 0 || item.receivedQuantity + quantity > item.orderedQuantity) {
      throw new Error('PURCHASE_RECEIPT_QUANTITY_INVALID');
    }
    if (item.receivedQuantity + quantity !== item.orderedQuantity) allReceived = false;
  }
  return allReceived ? 'received' : 'partially_received';
}

export interface TenantOrderItem {
  id: string;
  merchantId: string | null;
}

export interface TenantOrder {
  merchantId: string | null;
  status?: string;
  items: TenantOrderItem[];
}

export interface TenantShipmentItem {
  orderItemId: string;
}

export function merchantOwnsOrderItem(order: TenantOrder, merchantId: string, item: TenantOrderItem): boolean {
  return order.status !== 'draft' && (item.merchantId === merchantId || (order.merchantId === merchantId && !item.merchantId));
}

export function merchantOwnsOrder(order: TenantOrder, merchantId: string): boolean {
  return order.status !== 'draft' && (order.merchantId === merchantId || order.items.some(item => merchantOwnsOrderItem(order, merchantId, item)));
}

export function merchantOwnsEntireOrder(order: TenantOrder, merchantId: string): boolean {
  if (order.status === 'draft') return false;
  const parentBelongsToMerchant = !order.merchantId || order.merchantId === merchantId;
  return parentBelongsToMerchant
    && order.items.every(item => item.merchantId === merchantId
      || (order.merchantId === merchantId && !item.merchantId));
}

export function merchantOrderItemIds(order: TenantOrder, merchantId: string): Set<string> {
  return new Set(order.items.filter(item => merchantOwnsOrderItem(order, merchantId, item)).map(item => item.id));
}

export function merchantOwnsShipment(
  order: TenantOrder,
  merchantId: string,
  shipmentItems: readonly TenantShipmentItem[]
): boolean {
  if (shipmentItems.length === 0) return merchantOwnsEntireOrder(order, merchantId);
  const ownedItemIds = merchantOrderItemIds(order, merchantId);
  return shipmentItems.every(item => ownedItemIds.has(item.orderItemId));
}

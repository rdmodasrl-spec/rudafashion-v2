export type ShipmentStatus = 'pending' | 'packed' | 'shipped' | 'delivered' | 'exception' | 'cancelled';

export function canTransitionShipmentStatus(current: string, next: string): boolean {
  if (current === next) return true;
  if (current === 'pending') return ['packed', 'shipped', 'exception', 'cancelled'].includes(next);
  if (current === 'packed') return ['shipped', 'exception', 'cancelled'].includes(next);
  if (current === 'shipped') return ['delivered', 'exception'].includes(next);
  if (current === 'exception') return ['shipped', 'delivered'].includes(next);
  return false;
}

export function getOrderFulfillmentStatus(
  currentStatus: string,
  items: Array<{ id: string; quantity: number }>,
  shipments: Array<{ status: string; items: Array<{ orderItemId: string; quantity: number }> }>
): 'confirmed' | 'picking' | 'shipped' | 'delivered' {
  if (!items.length) return currentStatus === 'delivered' ? 'delivered' : currentStatus === 'shipped' ? 'shipped' : 'confirmed';
  const shippedByItem = new Map<string, number>();
  const deliveredByItem = new Map<string, number>();
  let hasActiveShipment = false;
  let hasShippedPackage = false;
  for (const shipment of shipments) {
    if (shipment.status === 'cancelled') continue;
    if (shipment.status === 'pending' || shipment.status === 'packed' || shipment.status === 'exception') hasActiveShipment = true;
    if (shipment.status === 'shipped' || shipment.status === 'delivered' || shipment.status === 'exception') {
      hasShippedPackage = true;
    }
    if (shipment.status !== 'packed' && shipment.status !== 'shipped' && shipment.status !== 'delivered' && shipment.status !== 'exception') continue;
    for (const item of shipment.items) {
      shippedByItem.set(item.orderItemId, (shippedByItem.get(item.orderItemId) || 0) + item.quantity);
      if (shipment.status === 'delivered') {
        deliveredByItem.set(item.orderItemId, (deliveredByItem.get(item.orderItemId) || 0) + item.quantity);
      }
    }
  }
  const allDelivered = items.every(item => (deliveredByItem.get(item.id) || 0) >= item.quantity);
  if (allDelivered) return 'delivered';
  if (hasShippedPackage) return 'shipped';
  if (hasActiveShipment || shippedByItem.size > 0) return 'picking';
  return 'confirmed';
}

export function getShipmentQuantities(
  shipments: Array<{ status: string; items: Array<{ orderItemId: string; quantity: number }> }>
): Map<string, number> {
  const quantities = new Map<string, number>();
  for (const shipment of shipments) {
    if (!['packed', 'shipped', 'delivered', 'exception'].includes(shipment.status)) continue;
    for (const item of shipment.items) {
      quantities.set(item.orderItemId, (quantities.get(item.orderItemId) || 0) + item.quantity);
    }
  }
  return quantities;
}

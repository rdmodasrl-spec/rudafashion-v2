import type { ProductReservationRequestItem } from '../types/b2b';

export const getSelectedProductReservationItems = (
  quantitiesBySku: Record<string, number>
): ProductReservationRequestItem[] => Object.entries(quantitiesBySku)
  .filter(([, quantity]) => Number.isInteger(quantity) && quantity > 0)
  .map(([sku, quantity]) => ({ sku, quantity }));

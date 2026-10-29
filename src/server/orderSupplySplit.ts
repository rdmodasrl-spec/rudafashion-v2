export interface OrderSupplySplit {
  inStockQuantity: number;
  preorderQuantity: number;
}

export function calculateOrderSupplySplit(
  quantity: number,
  availableStock: number,
  allowBackorder: boolean
): OrderSupplySplit | null {
  if (!Number.isInteger(quantity) || quantity < 1
    || !Number.isInteger(availableStock) || availableStock < 0) return null;

  const inStockQuantity = Math.min(quantity, availableStock);
  const preorderQuantity = quantity - inStockQuantity;
  if (preorderQuantity > 0 && !allowBackorder) return null;
  return { inStockQuantity, preorderQuantity };
}

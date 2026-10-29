export const BULK_WHOLESALE_MINIMUM_QUANTITY = 100;

export const getProductWholesalePriceForQuantity = (
  wholesalePrice: number,
  wholesalePrice100: number | null | undefined,
  quantity: number,
  minimumQuantity = BULK_WHOLESALE_MINIMUM_QUANTITY
): number => {
  if (
    Number.isInteger(minimumQuantity) &&
    minimumQuantity > 0 &&
    quantity >= minimumQuantity &&
    wholesalePrice100 !== null &&
    wholesalePrice100 !== undefined &&
    Number.isFinite(wholesalePrice100) &&
    wholesalePrice100 > 0
  ) {
    return wholesalePrice100;
  }
  return wholesalePrice;
};

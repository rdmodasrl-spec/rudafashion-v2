export type EmployeeOrderSupplySplitInput = {
  quantity: unknown;
  inStockQuantity?: unknown;
  preorderQuantity?: unknown;
};

export type EmployeeOrderSupplySplit = {
  quantity: number;
  inStockQuantity: number;
  preorderQuantity: number;
};

export function normalizeEmployeeOrderSupplySplit(
  input: EmployeeOrderSupplySplitInput,
  isPosSale: boolean
): EmployeeOrderSupplySplit | null {
  const quantity = Number(input.quantity);
  if (!Number.isInteger(quantity) || quantity < 1) return null;

  const hasSplit = input.inStockQuantity !== undefined || input.preorderQuantity !== undefined;
  if (hasSplit && (!Number.isInteger(input.inStockQuantity) || !Number.isInteger(input.preorderQuantity))) return null;

  const inStockQuantity = hasSplit ? Number(input.inStockQuantity) : quantity;
  const preorderQuantity = hasSplit ? Number(input.preorderQuantity) : 0;
  if (inStockQuantity < 0 || preorderQuantity < 0
    || inStockQuantity + preorderQuantity !== quantity
    || (isPosSale && preorderQuantity > 0)) return null;

  return { quantity, inStockQuantity, preorderQuantity };
}

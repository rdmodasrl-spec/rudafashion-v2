export const SINGLE_WAREHOUSE_CODE = 'central' as const;

export type WarehouseCode = typeof SINGLE_WAREHOUSE_CODE;

export function isSingleWarehouseCode(value: string): value is WarehouseCode {
  return value === SINGLE_WAREHOUSE_CODE;
}

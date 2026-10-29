import type { CartItem } from '../types/b2b';

export function isSameCartLine(left: Pick<CartItem, 'productId' | 'sku'>, right: Pick<CartItem, 'productId' | 'sku'>): boolean {
  return left.productId === right.productId && left.sku === right.sku;
}

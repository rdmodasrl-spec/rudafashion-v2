export const DEFAULT_MERCHANT_LOGO = '/default-merchant-logo.svg';
export const DEFAULT_MERCHANT_BANNER = '/demo-products/category-knitwear.jpg';

export function merchantMediaUrl(value: string | null | undefined, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

import { localizedPath, type SeoLanguage } from './seo';

const reservedStoreSubdomains = new Set([
  'admin', 'app', 'api', 'bos', 'buyer', 'merchant', 'ruda', 'vip', 'www', 'xs'
]);

export function makeUniqueMerchantStoreSlug(
  value: string,
  occupiedSlugs: Iterable<string | null | undefined>,
  fallback: string
): string {
  const base = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || fallback;
  const occupied = new Set(
    Array.from(occupiedSlugs, slug => slug?.toLowerCase()).filter((slug): slug is string => Boolean(slug))
  );
  let slug = base;
  let suffix = 2;
  while (occupied.has(slug) || reservedStoreSubdomains.has(slug)) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

export function merchantStorefrontOrigin(storeSlug: string): string {
  return `https://${storeSlug}.ruda.fashion`;
}

export function merchantStorefrontUrl(
  storeSlug: string,
  language: SeoLanguage = 'it',
  search = ''
): string {
  const query = search && !search.startsWith('?') ? `?${search}` : search;
  return `${merchantStorefrontOrigin(storeSlug)}${localizedPath('/', language)}${query}`;
}

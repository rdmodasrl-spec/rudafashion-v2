export const MERCHANT_STOREFRONT_TEMPLATES = [
  {
    id: 'fashion_monochrome',
    name: '时尚版 · 黑白',
    description: '黑白留白',
    colors: ['#ffffff', '#111111', '#e5e5e5']
  },
  {
    id: 'luxury_black_gold',
    name: '豪华版 · 黑金',
    description: '黑金精品感',
    colors: ['#11100e', '#c9a96e', '#29251f']
  },
  {
    id: 'ecommerce_standard',
    name: '标准版 · 电商',
    description: '清晰商品目录',
    colors: ['#f3f5f7', '#2563eb', '#ffffff']
  }
] as const;

export type MerchantStorefrontTemplate = typeof MERCHANT_STOREFRONT_TEMPLATES[number]['id'];

function parseSettings(settings: unknown): Record<string, unknown> {
  let parsed: unknown = settings;
  if (typeof settings === 'string') {
    try {
      parsed = JSON.parse(settings);
    } catch {
      return {};
    }
  }
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {};
}

export function isMerchantStorefrontTemplate(value: unknown): value is MerchantStorefrontTemplate {
  return MERCHANT_STOREFRONT_TEMPLATES.some(template => template.id === value);
}

export function getMerchantStorefrontTemplate(settings: unknown): MerchantStorefrontTemplate {
  const template = parseSettings(settings).storefrontTemplate;
  return isMerchantStorefrontTemplate(template) ? template : 'fashion_monochrome';
}

export function withMerchantStorefrontTemplate(
  settings: unknown,
  template: MerchantStorefrontTemplate
): Record<string, unknown> {
  return { ...parseSettings(settings), storefrontTemplate: template };
}

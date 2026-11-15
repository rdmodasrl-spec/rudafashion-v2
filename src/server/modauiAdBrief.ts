/**
 * MODAUI 广告策划器 — 商品简报与事实白名单（纯逻辑：无 Prisma、无网络）。
 *
 * 约束（见 docs/engineering/modules/modaui-ai-advertising.md §22）：
 * - 简报只允许来自真实商品行与商家确认的卖点；缺失信息进入 `missing`，不得由 AI 补写。
 * - 价格只读。商品没有可用价格时，简报如实标记 `price.minor = null`，
 *   由策划器按 `priceDisclosure` 决定拒绝生成或禁止出现金额，不允许猜价。
 * - 事实白名单用于事后校验文案中的数字，未在白名单中的数字一律视为编造。
 */

/** 平台结算币种；Product 表价格不带币种列，这里固定为平台币种，换币种必须先加列。 */
export const AI_AD_CURRENCY = 'EUR';

export const AI_AD_LANGUAGES = ['it', 'en', 'zh'] as const;
export type AiAdLanguage = (typeof AI_AD_LANGUAGES)[number];

export const AI_AD_ASPECT_RATIOS = ['9:16', '1:1', '16:9'] as const;
export type AiAdAspectRatio = (typeof AI_AD_ASPECT_RATIOS)[number];

/** 商品行最小字段集（Prisma Product + variants 的结构子集）。 */
export type AiAdProductRow = {
  id: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  subCategory?: string | null;
  description?: string | null;
  fabric?: string | null;
  composition?: string | null;
  origin?: string | null;
  season?: string | null;
  images?: string | null;
  media?: string | null;
  wholesalePrice?: unknown;
  rrpPrice?: unknown;
  variants?: Array<{ sku?: string | null; color?: string | null; size?: string | null; isActive?: boolean | null }> | null;
};

export type AiAdBriefSku = { sku: string; color: string | null; size: string | null };

export type AiAdBrief = {
  productId: string;
  name: string;
  brand: string | null;
  category: string | null;
  description: string | null;
  fabric: string | null;
  composition: string | null;
  origin: string | null;
  material: string | null;
  price: {
    minor: number | null;
    currency: string;
    rrpMinor: number | null;
  };
  colors: string[];
  sizes: string[];
  skus: AiAdBriefSku[];
  imageUrls: string[];
  sellingPoints: string[];
  /** 缺失但广告需要的字段，前端必须显示为「未提供」，不得用默认值填充。 */
  missing: string[];
  capturedAt: string;
};

export type AiAdFactWhitelist = {
  /** 允许出现在文案中的数字（已归一化），例如价格、成分百分比、尺码。 */
  numbers: string[];
  colors: string[];
  sizes: string[];
  /** 可用于文案校验的文本片段（名称/品牌/面料/产地等）。 */
  phrases: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text.length ? text : null;
}

/**
 * Prisma Decimal 会以对象形式返回；统一转成整数分。
 * 空值、非数字、非正数一律返回 null（不允许把 0 当作「免费」）。
 */
export function parseMinorAmount(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const raw = isRecord(value) && typeof value.toString === 'function' ? value.toString() : value;
  const numeric = typeof raw === 'number' ? raw : Number(String(raw));
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.round(numeric * 100);
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
  return [];
}

function parseUrlList(value: unknown): string[] {
  if (Array.isArray(value)) {
    const urls: string[] = [];
    for (const item of value) {
      if (typeof item === 'string' && item.trim()) urls.push(item.trim());
      else if (isRecord(item) && typeof item.url === 'string' && item.url.trim()) urls.push(item.url.trim());
    }
    return urls;
  }
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    return parseUrlList(JSON.parse(value));
  } catch {
    return [];
  }
}

function parseImageUrls(product: AiAdProductRow): string[] {
  const urls: string[] = [];
  for (const item of parseUrlList(product.media)) {
    // media 里既有图片也有视频；视频扩展名直接跳过，不当作商品图。
    if (/\.(mp4|mov|webm|m3u8)(\?|$)/i.test(item)) continue;
    urls.push(item);
  }
  for (const item of parseUrlList(product.images)) {
    if (/^https?:\/\//i.test(item) || item.startsWith('/')) urls.push(item);
  }
  const unique: string[] = [];
  for (const url of urls) if (!unique.includes(url)) unique.push(url);
  return unique;
}


/** 简报构建：只搬运真实数据，缺什么就记在 `missing`。 */
export function buildAiAdProductBrief(input: {
  product: AiAdProductRow;
  sellingPoints?: readonly string[];
  now?: Date;
}): AiAdBrief {
  const product = input.product;
  const variants = (product.variants ?? []).filter(variant => variant?.isActive !== false);
  const skus: AiAdBriefSku[] = [];
  for (const variant of variants) {
    const sku = cleanText(variant.sku);
    if (!sku) continue;
    skus.push({ sku, color: cleanText(variant.color), size: cleanText(variant.size) });
  }
  const colors = [...new Set(skus.map(item => item.color).filter((color): color is string => Boolean(color)))];
  const sizes = [...new Set(skus.map(item => item.size).filter((size): size is string => Boolean(size)))];

  const imageUrls = parseImageUrls(product);
  const fabric = cleanText(product.fabric);
  const composition = cleanText(product.composition);
  const material = composition ?? fabric;

  const sellingPoints = [...new Set(
    (input.sellingPoints ?? []).map(point => point.trim()).filter(Boolean)
  )].slice(0, 12);

  const missing: string[] = [];
  if (parseMinorAmount(product.wholesalePrice) === null) missing.push('price');
  if (imageUrls.length === 0) missing.push('images');
  if (skus.length === 0) missing.push('skus');
  if (colors.length === 0) missing.push('colors');
  if (!material) missing.push('material');
  if (!cleanText(product.description)) missing.push('description');
  if (sellingPoints.length === 0) missing.push('sellingPoints');

  return {
    productId: product.id,
    name: cleanText(product.name) ?? '',
    brand: cleanText(product.brand),
    category: cleanText(product.category),
    description: cleanText(product.description),
    fabric,
    composition,
    origin: cleanText(product.origin),
    material,
    price: {
      minor: parseMinorAmount(product.wholesalePrice),
      currency: AI_AD_CURRENCY,
      rrpMinor: parseMinorAmount(product.rrpPrice)
    },
    colors,
    sizes,
    skus,
    imageUrls,
    sellingPoints,
    missing,
    capturedAt: (input.now ?? new Date()).toISOString()
  };
}

/** 价格以「分」参与文案比对，同时登记常见书写形式，避免 "12.50" 与 "12,5" 被判成编造。 */
function sampleNumberForms(minor: number): string[] {
  const decimal = (minor / 100).toFixed(2);
  const trimmed = decimal.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  return [...new Set([
    decimal,
    trimmed,
    decimal.replace('.', ','),
    trimmed.replace('.', ','),
    String(minor)
  ])];
}

function collectNumbersFromText(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(/\d+(?:[.,]\d+)?/g)) {
    const raw = match[0];
    found.add(raw);
    found.add(raw.replace(',', '.'));
    if (/\.\d*0$/.test(raw)) found.add(raw.replace(/0+$/, '').replace(/\.$/, ''));
  }
  return [...found];
}

/** 生成事实白名单；只收录真实存在的值。 */
export function buildAiAdFactWhitelist(brief: AiAdBrief): AiAdFactWhitelist {
  const numbers = new Set<string>();
  if (brief.price.minor !== null) for (const form of sampleNumberForms(brief.price.minor)) numbers.add(form);
  if (brief.price.rrpMinor !== null) for (const form of sampleNumberForms(brief.price.rrpMinor)) numbers.add(form);

  const phrases: string[] = [];
  const factSources = [
    brief.name,
    brief.brand,
    brief.category,
    brief.fabric,
    brief.composition,
    brief.origin,
    ...brief.sellingPoints
  ];
  for (const value of factSources) {
    if (!value) continue;
    phrases.push(value);
    for (const number of collectNumbersFromText(value)) numbers.add(number);
  }
  for (const size of brief.sizes) for (const number of collectNumbersFromText(size)) numbers.add(number);
  for (const sku of brief.skus) for (const number of collectNumbersFromText(sku.sku)) numbers.add(number);

  return { numbers: [...numbers], colors: [...brief.colors], sizes: [...brief.sizes], phrases };
}


export const AI_AD_PRICE_DISCLOSURES = ['allowed', 'none'] as const;
export type AiAdPriceDisclosure = (typeof AI_AD_PRICE_DISCLOSURES)[number];

export function isAiAdPriceDisclosure(value: unknown): value is AiAdPriceDisclosure {
  return typeof value === 'string' && (AI_AD_PRICE_DISCLOSURES as readonly string[]).includes(value);
}

/**
 * 价格披露守门：
 * - 商品没有价格时，`allowed`（要在广告里报价）必须直接失败，不能生成没有依据的报价广告。
 * - `none`（广告不报价）允许继续，但文案里出现金额同样会被事实校验拦下。
 */
export function resolveAiAdPricePolicy(input: {
  brief: AiAdBrief;
  disclosure: AiAdPriceDisclosure;
}): { ok: true } | { ok: false; reason: 'PRICE_NOT_CONFIGURED' } {
  if (input.brief.price.minor === null && input.disclosure === 'allowed') {
    return { ok: false, reason: 'PRICE_NOT_CONFIGURED' };
  }
  return { ok: true };
}

const CURRENCY_PATTERN = /(?:€|\$|£|\bEUR\b|\bUSD\b|\bRMB\b|\bCNY\b|元)/i;

/**
 * 事实校验：文案里出现白名单之外的数字，或出现货币符号但价格未知，都判定为编造。
 * 返回具体违规 token，便于前端提示商家「哪一句没有依据」。
 */
export function findUngroundedAiAdFacts(
  text: string,
  whitelist: AiAdFactWhitelist,
  options?: { priceKnown?: boolean }
): string[] {
  const violations: string[] = [];
  const priceKnown = options?.priceKnown ?? whitelist.numbers.length > 0;
  if (!priceKnown && CURRENCY_PATTERN.test(text)) violations.push('price');

  const allowed = new Set(whitelist.numbers.map(number => number.replace(',', '.')));
  for (const match of text.matchAll(/\d+(?:[.,]\d+)?/g)) {
    const raw = match[0];
    const normalized = raw.replace(',', '.');
    const trimmed = normalized.replace(/\.?0+$/, '');
    if (allowed.has(normalized) || allowed.has(trimmed) || allowed.has(raw)) continue;
    if (!violations.includes(raw)) violations.push(raw);
  }
  return violations;
}

/** 把简报整理成给模型的事实清单；只传真实字段，缺失项明确写「未提供」。 */
export function describeAiAdBriefForPrompt(brief: AiAdBrief): string {
  return [
    `Product name: ${brief.name || '未提供'}`,
    `Brand: ${brief.brand ?? '未提供'}`,
    `Category: ${brief.category ?? '未提供'}`,
    `Material: ${brief.material ?? '未提供'}`,
    `Origin: ${brief.origin ?? '未提供'}`,
    `Description: ${brief.description ?? '未提供'}`,
    `Colors: ${brief.colors.length ? brief.colors.join(', ') : '未提供'}`,
    `Sizes: ${brief.sizes.length ? brief.sizes.join(', ') : '未提供'}`,
    `Price: ${brief.price.minor === null
      ? '未提供（禁止在文案中出现任何金额或货币符号）'
      : `${(brief.price.minor / 100).toFixed(2)} ${brief.price.currency}`}`,
    `Selling points: ${brief.sellingPoints.length ? brief.sellingPoints.join(' | ') : '未提供'}`,
    `Missing fields (never invent): ${brief.missing.length ? brief.missing.join(', ') : 'none'}`
  ].join('\n');
}

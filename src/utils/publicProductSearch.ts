export type PublicProductSearchRecord = {
  id: string;
  status: string;
  styleNo: string;
  name: string;
  name_zh?: string | null;
  name_it?: string | null;
  category: string;
  subCategory: string;
  brand: string;
  images?: string | null;
  description?: string | null;
  description_zh?: string | null;
  description_it?: string | null;
  fabric?: string | null;
  fabric_zh?: string | null;
  fabric_it?: string | null;
  wholesalePrice: number;
  moq: number;
  merchantName?: string | null;
  merchant?: {
    id: string;
    name: string;
    storeSlug: string;
    city: string;
    country: string;
    city_zh?: string | null;
    city_it?: string | null;
    country_zh?: string | null;
    country_it?: string | null;
  } | null;
};

const productSearchIntent = /找|搜索|查找|看看|有没有|谁家|哪家|哪些|便宜|低价|最低价|特价|折扣|清仓|低于|以内|以下|below|under|at most|up to|find|search|cheap|cheapest|best price|clearance|discount|sale|quali|cerca|prezzo/i;
const productTypes: Array<{ pattern: RegExp; terms: string[]; all?: boolean }> = [
  { pattern: /女装|女士服装|women'?s(?:wear)?|ladies'?wear|abbigliamento donna/i, terms: ['女装', 'women', 'woman', 'ladies', 'donna'] },
  { pattern: /男装|男士服装|men'?s(?:wear)?|abbigliamento uomo/i, terms: ['男装', 'men', 'uomo'] },
  { pattern: /服装|衣服|服饰|成衣|clothing|clothes|apparel|fashion|abbigliamento/i, terms: [], all: true },
  { pattern: /裤子|长裤|短裤|西裤|牛仔裤|pants?|trousers?|jeans|pantaloni|shorts/i, terms: ['裤', 'pants', 'trouser', 'jean', 'pantalon'] },
  { pattern: /裙子|半身裙|连衣裙|裙装|skirt|dress|gonna|abito/i, terms: ['裙', 'dress', 'skirt', 'gonna', 'abito'] },
  { pattern: /上衣|衬衫|针织|毛衣|上装|top|shirt|blouse|knit|sweater|maglia/i, terms: ['上衣', '衬衫', '针织', '毛衣', 'top', 'shirt', 'blouse', 'knit', 'sweater', 'maglia'] },
  { pattern: /外套|大衣|夹克|风衣|coat|jacket|outerwear|cappotto|giacca/i, terms: ['外套', '大衣', '夹克', '风衣', 'coat', 'jacket', 'outerwear', 'cappotto', 'giacca'] },
  { pattern: /鞋|靴|运动鞋|shoes?|boots?|sneakers?|scarpe/i, terms: ['鞋', '靴', 'shoe', 'boot', 'sneaker', 'scarpe'] },
  { pattern: /包|手袋|背包|bags?|handbags?|backpacks?|borse/i, terms: ['包', '手袋', '背包', 'bag', 'purse', 'borsa'] }
];
const countryAliases = [
  ['italy', 'italia', '意大利'],
  ['greece', 'grecia', '希腊', '希臘'],
  ['france', 'francia', '法国'],
  ['germany', 'deutschland', 'germania', '德国'],
  ['spain', 'espana', '西班牙'],
  ['portugal', 'portogallo', '葡萄牙'],
  ['poland', 'polonia', '波兰']
];
const cityAliases = [
  ['milan', 'milano', '米兰'],
  ['rome', 'roma', '罗马'],
  ['prato', '普拉托'],
  ['florence', 'firenze', '佛罗伦萨'],
  ['athens', 'athina', '雅典'],
  ['thessaloniki', 'salonicco', '塞萨洛尼基']
];

function normalize(value: string): string {
  return value.normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function searchPublicProducts(
  products: PublicProductSearchRecord[],
  input: string
): {
  isSearchRequest: boolean;
  wantsLowestPrice: boolean;
  clearanceOnly: boolean;
  priceCeiling: number | null;
  matches: PublicProductSearchRecord[];
} {
  const normalizedInput = normalize(input);
  const requestedType = productTypes.find(type => type.pattern.test(input));
  const priceMatch = input.match(/(?:€\s*(\d+(?:[.,]\d{1,2})?)|(\d+(?:[.,]\d{1,2})?)\s*(?:€|eur(?:os?)?|欧元|欧))/i);
  const priceCeiling = priceMatch ? Number((priceMatch[1] || priceMatch[2]).replace(',', '.')) : null;
  const requestedCountry = countryAliases.find(aliases => aliases.some(alias => normalizedInput.includes(normalize(alias))));
  const requestedCity = cityAliases.find(aliases => aliases.some(alias => normalizedInput.includes(normalize(alias))));
  const hasProductIntent = productSearchIntent.test(input) && (Boolean(requestedType) || priceCeiling !== null);
  if (!hasProductIntent) {
    return { isSearchRequest: false, wantsLowestPrice: false, clearanceOnly: false, priceCeiling: null, matches: [] };
  }

  const wantsCheap = /便宜|低价|最低价|实惠|cheap|cheapest|best price|prezzo basso|economico/i.test(normalizedInput);
  const clearanceOnly = wantsCheap || /特价|折扣|清仓|clearance|discount|sale/i.test(normalizedInput);
  const inclusivePrice = /以内|以下|不超过|至多|at most|up to|max(?:imum)?/i.test(normalizedInput);

  const matches = products.filter(product => {
    if (clearanceOnly && product.status !== 'clearance') return false;
    if (priceCeiling !== null && (inclusivePrice
      ? product.wholesalePrice > priceCeiling
      : product.wholesalePrice >= priceCeiling)) return false;
    const merchant = product.merchant;
    if (requestedCountry && (!merchant || !requestedCountry.some(alias =>
      [merchant.country, merchant.country_zh, merchant.country_it]
        .filter((value): value is string => Boolean(value))
        .some(value => normalize(value).includes(normalize(alias)))
    ))) return false;
    if (requestedCity && (!merchant || !requestedCity.some(alias =>
      [merchant.city, merchant.city_zh, merchant.city_it]
        .filter((value): value is string => Boolean(value))
        .some(value => normalize(value).includes(normalize(alias)))
    ))) return false;
    const productText = normalize([
      product.category,
      product.subCategory,
      product.name,
      product.name_zh,
      product.name_it,
      product.brand,
      product.description,
      product.description_zh,
      product.description_it,
      product.fabric,
      product.fabric_zh,
      product.fabric_it
    ].filter((value): value is string => Boolean(value)).join(' '));
    return requestedType?.all || !requestedType || requestedType.terms.some(term => productText.includes(normalize(term)));
  });
  matches.sort((left, right) =>
    (wantsCheap ? left.wholesalePrice - right.wholesalePrice : 0) ||
    left.wholesalePrice - right.wholesalePrice ||
    left.name.localeCompare(right.name)
  );
  return { isSearchRequest: true, wantsLowestPrice: wantsCheap, clearanceOnly, priceCeiling, matches };
}

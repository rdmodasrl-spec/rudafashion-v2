const merchantSearchIntent = /我想找|我要找|想找|要找|帮我找|请帮我找|找一下|找|寻找|查找|查一下|查询|搜索|搜一下|帮我搜索|有(?:哪|那)些|有哪些|有哪几家|有哪家|有什么|附近|find|search|look for|looking for|show me|what.{0,20}(?:shops|stores|companies|brands|suppliers)|which.{0,20}(?:shops|stores|companies|brands|suppliers)|(?:clothing|apparel|fashion).{0,20}(?:shops|stores|companies)|cerca|cercami|trova|trovare|cerco|vorrei trovare|quali.{0,20}negozi/i;
const merchantEntityTerm = /公司|商家|品牌|供应商|店铺|商店|门店|店|展厅|厂家|工厂|生产商|制造商|批发商|零售商|零售店|买手店|company|business|supplier|merchant|brand|shop|store|showroom|manufacturer|producer|factory|wholesaler|retailer|clothing|fashion|apparel|abbigliamento|azienda|fornitore|grossista|produttore|negozi?o?/i;
const removableQueryWords = /我想找|我要找|想找|要找|帮我找|请帮我找|找一下|找|寻找|查找|查一下|查询|搜索|搜一下|帮我搜索|有(?:哪|那)些|有哪些|有哪几家|有哪家|有什么|附近|卖|服装|女装|男装|时装|成衣|公司|商家|品牌|供应商|店铺|商店|门店|店|展厅|厂家|工厂|生产商|制造商|批发商|批发|零售商|零售店|买手店|精品店|链接|页面|跳转|打开|进入|给我|的|在|一家|一个|company|business|supplier|merchant|brand|shop|shops|store|stores|showroom|showrooms|companies|link|find|search|look for|looking for|show me|what|which|manufacturer|manufacturers|producer|producers|factory|factories|wholesaler|wholesalers|retailer|retailers|cerca|cercami|trova|trovare|cerco|vorrei|quali|azienda|fornitore|grossista|produttore|negozio|negozi|di|link|fashion|apparel|clothing|abbigliamento/gi;
const apparelSearchTerm = /服装|女装|男装|时装|成衣|fashion|apparel|clothing|abbigliamento/i;
const leatherSearchTerm = /皮具|皮包|箱包|手袋|皮革|鞋类|鞋履|leather|handbags?|bags?|footwear|pelletteria|scarpe/i;
const producerSearchTerm = /生产厂家|生产商|制造商|厂家|工厂|producer|manufacturer|factory|produttore|fabbrica/i;
const wholesalerSearchTerm = /批发商|批发|wholesaler|grossista/i;
const retailerSearchTerm = /零售商|零售店|买手店|精品店|retailer|retail|boutique|rivenditore/i;
const productSearchTerm = /现货|款式|商品|库存|找货|sku|product|products/i;
const countryAliases: Record<string, string[]> = {
  albania: ['albania', 'albanie', 'shqiperia', '阿尔巴尼亚'],
  austria: ['austria', 'osterreich', '奥地利'],
  belgium: ['belgium', 'belgique', 'belgie', 'belgica', '比利时'],
  bulgaria: ['bulgaria', 'българия', '保加利亚'],
  croatia: ['croatia', 'hrvatska', 'croacia', '克罗地亚'],
  cyprus: ['cyprus', 'kypros', 'cipro', '塞浦路斯'],
  czechia: ['czechia', 'czech republic', 'cesko', '捷克'],
  denmark: ['denmark', 'danmark', 'danimarca', '丹麦'],
  estonia: ['estonia', 'eesti', '爱沙尼亚'],
  finland: ['finland', 'suomi', 'finlandia', '芬兰'],
  france: ['france', 'francia', '法国'],
  germany: ['germany', 'deutschland', 'germania', '德国'],
  greece: ['greece', 'grecia', 'hellas', 'ellada', 'ελλαδα', '希腊', '希臘'],
  hungary: ['hungary', 'magyarorszag', 'ungheria', '匈牙利'],
  ireland: ['ireland', 'eire', 'irlanda', '爱尔兰'],
  italy: ['italy', 'italia', '意大利'],
  latvia: ['latvia', 'latvija', 'letonia', '拉脱维亚'],
  lithuania: ['lithuania', 'lietuva', 'lituania', '立陶宛'],
  luxembourg: ['luxembourg', '卢森堡'],
  malta: ['malta', '马耳他'],
  moldova: ['moldova', 'moldavia', '摩尔多瓦'],
  montenegro: ['montenegro', 'crna gora', '黑山'],
  netherlands: ['netherlands', 'holland', 'nederland', 'paesi bassi', '荷兰'],
  northMacedonia: ['north macedonia', 'macedonia del nord', '北马其顿'],
  norway: ['norway', 'norge', 'norvegia', '挪威'],
  poland: ['poland', 'polska', 'polonia', '波兰'],
  portugal: ['portugal', 'portogallo', '葡萄牙'],
  romania: ['romania', '罗马尼亚'],
  serbia: ['serbia', 'srbija', '塞尔维亚'],
  slovakia: ['slovakia', 'slovensko', '斯洛伐克'],
  slovenia: ['slovenia', 'slovenija', '斯洛文尼亚'],
  spain: ['spain', 'espana', '西班牙'],
  sweden: ['sweden', 'sverige', 'svezia', '瑞典'],
  switzerland: ['switzerland', 'schweiz', 'svizzera', '瑞士'],
  turkey: ['turkey', 'turkiye', 'turchia', '土耳其'],
  uk: ['united kingdom', 'great britain', 'england', 'regno unito', '英国']
};

export type MerchantSearchRecord = {
  id: string;
  name: string;
  isVerified: boolean;
  storefrontEnabled?: boolean | null;
  companyLegalName?: string;
  name_zh?: string;
  name_it?: string;
  code?: string;
  businessType?: string;
  storeSlug?: string;
  slug?: string;
  city?: string;
  city_zh?: string;
  city_it?: string;
  country?: string;
  country_zh?: string;
  country_it?: string;
  merchantZone?: string | null;
  specialties?: string[];
  description?: string;
  description_zh?: string;
  description_it?: string;
  logo?: string;
  tagline?: string;
  tagline_zh?: string;
  tagline_it?: string;
  publicProductsCount?: number;
};

export type PublicMerchantSearchResult = {
  id: string;
  name: string;
  storeSlug?: string | null;
  city?: string;
  city_zh?: string;
  city_it?: string;
  country?: string;
  country_zh?: string;
  country_it?: string;
  businessType?: string;
  logo?: string;
  tagline?: string;
  tagline_zh?: string;
  tagline_it?: string;
  publicProductsCount?: number;
};

function normalize(value: string): string {
  return value.normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function findCountryAlias(input: string): string[] | null {
  const normalizedInput = normalize(input);
  for (const aliases of Object.values(countryAliases)) {
    if (aliases.some(alias => normalizedInput.includes(normalize(alias)))) return aliases;
  }
  return null;
}

function matchesCountry(merchant: MerchantSearchRecord, aliases: string[]): boolean {
  const merchantCountries = [merchant.country, merchant.country_zh, merchant.country_it]
    .filter((value): value is string => Boolean(value))
    .map(normalize);
  return merchantCountries.some(country => aliases.some(alias => {
    const normalizedAlias = normalize(alias);
    return country === normalizedAlias || country.includes(normalizedAlias) || normalizedAlias.includes(country);
  }));
}

function findRequestedCity(input: string, merchants: MerchantSearchRecord[]): string | null {
  const normalizedInput = normalize(input);
  const cityCandidates = [...new Set(merchants.flatMap(merchant =>
    [merchant.city, merchant.city_zh, merchant.city_it]
      .filter((value): value is string => Boolean(value))
      .map(normalize)
      .filter(value => value.length >= 3 || (value.length >= 2 && /\p{Script=Han}/u.test(value)))
  ))].sort((left, right) => right.length - left.length);
  return cityCandidates.find(city => normalizedInput.includes(city)) || null;
}

function matchesCity(merchant: MerchantSearchRecord, requestedCity: string): boolean {
  return [merchant.city, merchant.city_zh, merchant.city_it]
    .filter((value): value is string => Boolean(value))
    .some(value => normalize(value) === requestedCity);
}

function findIndustryTerms(
  input: string,
  merchants: MerchantSearchRecord[],
  requestedCountry: string[] | null,
  requestedCity: string | null
): string[] {
  let residual = normalize(input.replace(removableQueryWords, ' '));
  for (const alias of requestedCountry || []) residual = residual.replace(normalize(alias), ' ');
  if (requestedCity) residual = residual.replace(requestedCity, ' ');
  const candidates = residual.split(/\s+/).filter(term => term.length >= 2);
  const merchantProfileText = merchants.map(merchant => normalize([
    ...(merchant.specialties || []),
    merchant.description,
    merchant.description_zh,
    merchant.description_it,
    merchant.tagline,
    merchant.tagline_zh,
    merchant.tagline_it
  ].filter((value): value is string => Boolean(value)).join(' ')));
  return candidates.filter(term => merchantProfileText.some(profile => profile.includes(term)));
}

function matchesIndustry(merchant: MerchantSearchRecord, input: string, industryTerms: string[]): boolean {
  const zone = merchant.merchantZone;
  const specialtyText = normalize((merchant.specialties || []).join(' '));
  const profileText = normalize([
    ...(merchant.specialties || []),
    merchant.description,
    merchant.description_zh,
    merchant.description_it,
    merchant.tagline,
    merchant.tagline_zh,
    merchant.tagline_it
  ].filter((value): value is string => Boolean(value)).join(' '));
  const businessType = normalize(merchant.businessType || '').replace(/[\s_-]+/g, '');
  if (industryTerms.some(term => !profileText.includes(term))) return false;
  if (leatherSearchTerm.test(input) && zone !== 'leather' && !/leather|pelletteria|scarpe/.test(specialtyText)) return false;
  if (apparelSearchTerm.test(input) && zone === 'leather' && !/abbigliamento|clothing|apparel|fashion/.test(specialtyText)) return false;
  if (retailerSearchTerm.test(input)) {
    const isRetailer = businessType
      ? /retailer|retail|boutique|rivenditor/.test(businessType)
      : zone === 'boutique_department';
    if (!isRetailer) return false;
  }
  if (producerSearchTerm.test(input)) {
    const isProducer = businessType
      ? /brandsupplier|manufacturer|atelier|producer|produttor|manifattur/.test(businessType)
      : zone === 'iolo';
    if (!isProducer) return false;
  }
  if (wholesalerSearchTerm.test(input)) {
    const isWholesaler = businessType
      ? /wholesaler|distributor|grossist|distribut/.test(businessType)
      : zone === 'tavoro';
    if (!isWholesaler) return false;
  }
  return true;
}

function getNameScore(merchant: MerchantSearchRecord, query: string): number {
  const queryText = normalize(query);
  if (!queryText) return 0;
  const queryTokens = queryText.split(/\s+/).filter(token => token.length > 1);
  const nameFields = [
    merchant.name,
    merchant.companyLegalName,
    merchant.name_zh,
    merchant.name_it,
    merchant.code,
    merchant.storeSlug,
    merchant.slug
  ].filter((value): value is string => Boolean(value));
  let bestScore = 0;

  for (const field of nameFields) {
    const fieldText = normalize(field);
    if (!fieldText) continue;
    if (fieldText === queryText) bestScore = Math.max(bestScore, 120);
    else if (queryText.length >= 3 && (fieldText.includes(queryText) || queryText.includes(fieldText))) bestScore = Math.max(bestScore, 100);

    const fieldTokens = fieldText.split(/\s+/);
    const matchedTokens = queryTokens.filter(queryToken =>
      fieldTokens.some(fieldToken =>
        fieldToken === queryToken ||
        (queryToken.length >= 3 && fieldToken.includes(queryToken)) ||
        (fieldToken.length >= 3 && queryToken.includes(fieldToken))
      )
    ).length;
    if (queryTokens.length && matchedTokens) {
      const coverage = matchedTokens / queryTokens.length;
      if (coverage >= 0.6) bestScore = Math.max(bestScore, 60 + Math.round(coverage * 35));
    }
  }

  return bestScore;
}

export function searchPublicMerchants(
  merchants: MerchantSearchRecord[],
  input: string
): { isSearchRequest: boolean; matches: MerchantSearchRecord[] } {
  const hasExplicitIntent = merchantSearchIntent.test(input);
  const requestedCountry = findCountryAlias(input);
  const requestedCity = findRequestedCity(input, merchants);
  const wantsApparel = apparelSearchTerm.test(input);
  const hasIndustryFilter = leatherSearchTerm.test(input) || wantsApparel ||
    retailerSearchTerm.test(input) || producerSearchTerm.test(input) || wholesalerSearchTerm.test(input);
  const hasSearchIntent = !productSearchTerm.test(input) && (
    (hasExplicitIntent && (merchantEntityTerm.test(input) || Boolean(requestedCountry) || Boolean(requestedCity) || hasIndustryFilter)) ||
    (!hasExplicitIntent && (hasIndustryFilter || (!merchantEntityTerm.test(input) && Boolean(requestedCountry || requestedCity))))
  );
  const query = input.replace(removableQueryWords, ' ').trim();
  const normalizedQuery = normalize(query);
  const industryTerms = hasSearchIntent
    ? findIndustryTerms(input, merchants, requestedCountry, requestedCity)
    : [];
  if (!normalizedQuery && !requestedCountry && !requestedCity && !hasIndustryFilter) {
    return { isSearchRequest: hasSearchIntent, matches: [] };
  }

  let ranked = merchants
    .filter(merchant => merchant.storefrontEnabled === true
      || (merchant.storefrontEnabled == null && merchant.isVerified))
    .filter(merchant => !requestedCountry || matchesCountry(merchant, requestedCountry))
    .filter(merchant => !requestedCity || matchesCity(merchant, requestedCity))
    .filter(merchant => matchesIndustry(merchant, input, industryTerms))
    .map(merchant => {
      const nameScore = getNameScore(merchant, query);
      const locationFields = [merchant.city, merchant.city_zh, merchant.city_it, merchant.country, merchant.country_zh, merchant.country_it]
        .filter((value): value is string => Boolean(value));
      const locationMatch = hasSearchIntent && locationFields.some(value => {
        const normalizedLocation = normalize(value);
        return normalizedLocation === normalizedQuery ||
          (normalizedQuery.length >= 2 && (normalizedLocation.includes(normalizedQuery) || normalizedQuery.includes(normalizedLocation)));
      }) || Boolean(requestedCountry && matchesCountry(merchant, requestedCountry)) ||
        Boolean(requestedCity && matchesCity(merchant, requestedCity));
      const industryScore = hasSearchIntent && (hasIndustryFilter || industryTerms.length > 0) ? 75 : 0;
      return { merchant, score: Math.max(nameScore, locationMatch ? 80 : 0, industryScore) };
    })
    .filter(result => result.score >= 60)
    .sort((left, right) => right.score - left.score || left.merchant.name.localeCompare(right.merchant.name));

  if (hasIndustryFilter || hasSearchIntent) {
    const nonDemoMatches = ranked.filter(result => !/^demo(?:\s|·|-|_)/i.test(result.merchant.name));
    if (nonDemoMatches.length) ranked = nonDemoMatches;
  }
  const hasDirectCompanyMatch = ranked.some(result => result.score >= 85);
  if (!hasSearchIntent && !hasDirectCompanyMatch) return { isSearchRequest: false, matches: [] };
  return { isSearchRequest: true, matches: ranked.map(result => result.merchant) };
}

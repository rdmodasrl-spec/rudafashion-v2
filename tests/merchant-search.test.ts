import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_MERCHANTS } from '../src/data/mockData';
import { searchPublicMerchants } from '../src/utils/merchantSearch';

test('finds verified merchants by public brand name or registered company name', () => {
  const byBrand = searchPublicMerchants(INITIAL_MERCHANTS, '我想找 BELLISSIMA PRATO 公司');
  const byLegalName = searchPublicMerchants(INITIAL_MERCHANTS, 'Bellissima Prato Pronto Moda S.r.l.');

  assert.equal(byBrand.isSearchRequest, true);
  assert.equal(byBrand.matches[0]?.id, 'mch-prato');
  assert.equal(byLegalName.isSearchRequest, true);
  assert.equal(byLegalName.matches[0]?.id, 'mch-prato');
});

test('supports location-based merchant discovery while excluding unverified merchants', () => {
  const merchants = INITIAL_MERCHANTS.map(merchant =>
    merchant.id === 'mch-prato' ? { ...merchant, isVerified: false } : merchant
  );
  const result = searchPublicMerchants(merchants, '找普拉托的公司');
  const cityOnly = searchPublicMerchants(INITIAL_MERCHANTS, 'Prato');

  assert.equal(result.isSearchRequest, true);
  assert.equal(result.matches.some(merchant => merchant.id === 'mch-prato'), false);
  assert.equal(cityOnly.isSearchRequest, true);
  assert.ok(cityOnly.matches.length > 0);
  assert.ok(cityOnly.matches.every(merchant => merchant.city === 'Prato'));
});

test('lists named verified stores for a city question such as which shops are in Prato', () => {
  const merchants = [
    ...INITIAL_MERCHANTS,
    { ...INITIAL_MERCHANTS[0], id: 'demo-prato-test', name: 'DEMO · Prato Store' }
  ];
  const result = searchPublicMerchants(merchants, 'Prato有哪些店');

  assert.equal(result.isSearchRequest, true);
  assert.ok(result.matches.length > 0);
  assert.ok(result.matches.every(merchant => merchant.city === 'Prato' || merchant.city_zh === '普拉托'));
  assert.equal(result.matches.some(merchant => merchant.name.startsWith('DEMO')), false);
});

test('filters all verified clothing stores by a multilingual country name', () => {
  const greekMerchants = Array.from({ length: 7 }, (_, index) => ({
    ...INITIAL_MERCHANTS[0],
    id: `greek-store-${index}`,
    name: `Greek Fashion House ${index}`,
    city: `Athens ${index}`,
    country: 'Greece',
    country_zh: '希腊',
    country_it: 'Grecia',
    merchantZone: 'iolo' as const
  }));
  const merchants = [...INITIAL_MERCHANTS, ...greekMerchants];
  const result = searchPublicMerchants(merchants, '希腊有那些卖服装店');
  const italianQuery = searchPublicMerchants(merchants, 'Grecia quali negozi di abbigliamento');

  assert.equal(result.isSearchRequest, true);
  assert.equal(result.matches.length, greekMerchants.length);
  assert.ok(result.matches.every(merchant => merchant.country === 'Greece'));
  assert.equal(italianQuery.matches.length, greekMerchants.length);
});

test('combines country, city, and apparel category like a merchant directory', () => {
  const merchants = [
    {
      ...INITIAL_MERCHANTS[0],
      id: 'athens-apparel',
      name: 'Athens Apparel',
      city: 'Athens',
      city_zh: '雅典',
      country: 'Greece',
      country_zh: '希腊',
      country_it: 'Grecia',
      merchantZone: 'iolo' as const
    },
    {
      ...INITIAL_MERCHANTS[3],
      id: 'athens-leather',
      name: 'Athens Leather',
      city: 'Athens',
      city_zh: '雅典',
      country: 'Greece',
      country_zh: '希腊',
      country_it: 'Grecia',
      merchantZone: 'leather' as const
    },
    {
      ...INITIAL_MERCHANTS[0],
      id: 'thessaloniki-apparel',
      name: 'Thessaloniki Apparel',
      city: 'Thessaloniki',
      country: 'Greece',
      country_zh: '希腊',
      country_it: 'Grecia',
      merchantZone: 'iolo' as const
    },
    ...INITIAL_MERCHANTS
  ];
  const result = searchPublicMerchants(merchants, '希腊雅典有哪些女装商家');

  assert.equal(result.isSearchRequest, true);
  assert.deepEqual(result.matches.map(merchant => merchant.id), ['athens-apparel']);
});

test('finds retailers, manufacturers, and wholesalers by their registered business type', () => {
  const merchants = [
    {
      id: 'athens-manufacturer',
      name: 'Athens Manufacturer',
      isVerified: true,
      city: 'Athens',
      country: 'Greece',
      merchantZone: 'iolo',
      businessType: 'manufacturer'
    },
    {
      id: 'athens-wholesaler',
      name: 'Athens Wholesaler',
      isVerified: true,
      city: 'Athens',
      country: 'Greece',
      merchantZone: 'tavoro',
      businessType: 'wholesaler'
    },
    {
      id: 'athens-retailer',
      name: 'Athens Retailer',
      isVerified: true,
      city: 'Athens',
      country: 'Greece',
      businessType: 'retailer',
      merchantZone: 'boutique_department'
    }
  ];

  assert.deepEqual(
    searchPublicMerchants(merchants, '希腊雅典找生产厂家').matches.map(merchant => merchant.id),
    ['athens-manufacturer']
  );
  assert.deepEqual(
    searchPublicMerchants(merchants, '希腊雅典找批发商').matches.map(merchant => merchant.id),
    ['athens-wholesaler']
  );
  assert.deepEqual(
    searchPublicMerchants(merchants, '希腊雅典找零售店').matches.map(merchant => merchant.id),
    ['athens-retailer']
  );
});

test('filters a directory by industry terms recorded in merchant profiles', () => {
  const merchants = [
    {
      id: 'cashmere-merchant',
      name: 'Cashmere House',
      isVerified: true,
      description_zh: '专营羊绒服装与大衣'
    },
    {
      id: 'silk-merchant',
      name: 'Silk House',
      isVerified: true,
      description_zh: '专营真丝衬衫和连衣裙'
    }
  ];

  assert.deepEqual(
    searchPublicMerchants(merchants, '找羊绒商家').matches.map(merchant => merchant.id),
    ['cashmere-merchant']
  );
});

test('recommends verified apparel companies for a broad clothing-company request', () => {
  const merchants = [
    ...Array.from({ length: 6 }, (_, index) => ({
      ...INITIAL_MERCHANTS[0],
      id: `demo-apparel-test-${index}`,
      name: `DEMO · Apparel Test ${index + 1}`
    })),
    ...INITIAL_MERCHANTS
  ];
  const result = searchPublicMerchants(merchants, '我要找服装公司');

  assert.equal(result.isSearchRequest, true);
  assert.ok(result.matches.length > 0);
  assert.equal(result.matches.some(merchant => merchant.merchantZone === 'leather'), false);
  assert.equal(result.matches.some(merchant => merchant.name.startsWith('DEMO')), false);
  assert.ok(['iolo', 'tavoro'].includes(result.matches[0]?.merchantZone || ''));
});

test('does not divert ordinary product searches into merchant discovery', () => {
  const result = searchPublicMerchants(INITIAL_MERCHANTS, '帮我找女装现货');

  assert.equal(result.isSearchRequest, false);
  assert.deepEqual(result.matches, []);
});

test('finds a direct company name even without a search command', () => {
  const result = searchPublicMerchants(INITIAL_MERCHANTS, 'BELLISSIMA PRATO');

  assert.equal(result.isSearchRequest, true);
  assert.equal(result.matches[0]?.id, 'mch-prato');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { searchPublicProducts, type PublicProductSearchRecord } from '../src/utils/publicProductSearch';

const products: PublicProductSearchRecord[] = [
  {
    id: 'pants-19',
    status: 'clearance',
    styleNo: 'P-19',
    name: 'Linen Trousers',
    name_zh: '亚麻长裤',
    category: 'women',
    subCategory: '裤子',
    brand: 'Prato Moda',
    wholesalePrice: 19,
    moq: 6,
    merchant: { id: 'merchant-1', name: 'Prato Moda', storeSlug: 'prato-moda', city: 'Prato', country: 'Italy' }
  },
  {
    id: 'pants-12',
    status: 'clearance',
    styleNo: 'P-12',
    name: 'Cotton Pants',
    name_zh: '棉质女裤',
    category: 'women',
    subCategory: '长裤',
    brand: 'Milano Style',
    wholesalePrice: 12,
    moq: 12,
    merchant: { id: 'merchant-2', name: 'Milano Style', storeSlug: 'milano-style', city: 'Milano', country: 'Italy' }
  },
  {
    id: 'dress-8',
    status: 'clearance',
    styleNo: 'D-08',
    name: 'Summer Dress',
    name_zh: '夏季连衣裙',
    category: 'women',
    subCategory: '连衣裙',
    brand: 'Roma Fashion',
    wholesalePrice: 8,
    moq: 6,
    merchant: { id: 'merchant-3', name: 'Roma Fashion', storeSlug: 'roma-fashion', city: 'Rome', country: 'Italy' }
  }
];

test('finds pants from seller questions and sorts cheap options by wholesale price', () => {
  const result = searchPublicProducts(products, '谁家有裤子便宜');

  assert.equal(result.isSearchRequest, true);
  assert.equal(result.wantsLowestPrice, true);
  assert.deepEqual(result.matches.map(product => product.id), ['pants-12', 'pants-19']);
  assert.equal(result.matches[0].merchant?.name, 'Milano Style');
  assert.equal(result.matches[0].wholesalePrice, 12);
});

test('only considers discounted clearance items, not cheaper regular products', () => {
  const result = searchPublicProducts([
    ...products,
    { ...products[1], id: 'regular-pants-5', status: 'new', wholesalePrice: 5 }
  ], '帮我找最低价裤子');

  assert.equal(result.matches[0]?.id, 'pants-12');
  assert.equal(result.matches.some(product => product.id === 'regular-pants-5'), false);
});

test('searches all public products for a normal category request, but scopes explicit sale requests', () => {
  const candidates = [
    ...products,
    { ...products[1], id: 'regular-pants-10', status: 'new', wholesalePrice: 10 }
  ];
  const normalSearch = searchPublicProducts(candidates, '找裤子');
  const saleSearch = searchPublicProducts(candidates, '找特价裤子');

  assert.equal(normalSearch.clearanceOnly, false);
  assert.ok(normalSearch.matches.some(product => product.id === 'regular-pants-10'));
  assert.equal(saleSearch.clearanceOnly, true);
  assert.ok(saleSearch.matches.every(product => product.status === 'clearance'));
});

test('supports natural whole-category requests for womenswear and the public clothing catalog', () => {
  const womenswear = searchPublicProducts(products, '找女装');
  const clothing = searchPublicProducts(products, '找服装');

  assert.equal(womenswear.isSearchRequest, true);
  assert.ok(womenswear.matches.every(product => product.category === 'women'));
  assert.equal(clothing.isSearchRequest, true);
  assert.equal(clothing.matches.length, products.length);
});

test('filters public products by a requested euro price ceiling', () => {
  const result = searchPublicProducts(products, '找低于€19的裤子');

  assert.equal(result.priceCeiling, 19);
  assert.equal(result.clearanceOnly, false);
  assert.deepEqual(result.matches.map(product => product.id), ['pants-12']);
});

test('combines city or country, category, and budget filters for product discovery', () => {
  const cityAndBudget = searchPublicProducts(products, '找米兰低于€19的裤子');
  const countryAndType = searchPublicProducts(products, '找意大利的连衣裙');

  assert.deepEqual(cityAndBudget.matches.map(product => product.id), ['pants-12']);
  assert.deepEqual(countryAndType.matches.map(product => product.id), ['dress-8']);
});

test('does not turn ordinary merchant or product questions into category searches', () => {
  assert.equal(searchPublicProducts(products, '找米兰的商家').isSearchRequest, false);
  assert.equal(searchPublicProducts(products, '你好').isSearchRequest, false);
});

test('reports an empty result for product categories with no published matches', () => {
  const result = searchPublicProducts(products, '有没有皮鞋');

  assert.equal(result.isSearchRequest, true);
  assert.equal(result.wantsLowestPrice, false);
  assert.deepEqual(result.matches, []);
});

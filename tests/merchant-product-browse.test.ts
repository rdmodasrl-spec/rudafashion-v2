import assert from 'node:assert/strict';
import test from 'node:test';
import type { Product } from '../src/types/b2b';
import {
  MERCHANT_NEW_ARRIVAL_WINDOW_DAYS,
  countMerchantProductQuickFilters,
  countMerchantProductZones,
  filterMerchantProducts,
  isNewArrivalProduct,
  isSoldProduct,
  matchesMerchantProductSearch
} from '../src/shared/merchantProductBrowse';
import { PRODUCT_LOW_STOCK_THRESHOLD } from '../src/shared/productInventory';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-10-26T08:00:00.000Z');

type ProductSeed = {
  id: string;
  styleNo: string;
  name?: string;
  category?: string;
  stock?: number;
  reserved?: number;
  barcode?: string;
  createdAt?: string;
  visibility?: Product['visibility'];
  status?: Product['status'];
  isExclusiveProtected?: boolean;
};

const buildProduct = (seed: ProductSeed): Product => ({
  id: seed.id,
  createdAt: seed.createdAt ?? new Date(NOW - 200 * DAY).toISOString(),
  styleNo: seed.styleNo,
  name: seed.name ?? `Product ${seed.id}`,
  category: seed.category ?? 'dress',
  subCategory: 'dress',
  brand: 'RUDA',
  season: '2026',
  images: [],
  wholesalePrice: 20,
  rrpPrice: 40,
  moq: 6,
  packSize: 6,
  status: seed.status ?? 'new',
  inventoryStatus: 'in_stock',
  origin: 'Italy',
  fabric: 'silk',
  composition: '100% silk',
  weight: '0.3',
  packaging: 'box',
  washCare: 'dry clean',
  description: 'desc',
  visibility: seed.visibility ?? 'public',
  isExclusiveProtected: seed.isExclusiveProtected ?? false,
  skus: [{
    sku: `${seed.styleNo}-01`,
    color: 'black',
    colorCode: 'BK',
    size: 'M',
    stockCentral: seed.stock ?? 100,
    stockMestre: 0,
    stockMilano: 0,
    reserved: seed.reserved ?? 0,
    barcode: seed.barcode
  }]
}) as Product;

const inStockNew = buildProduct({ id: 'p1', styleNo: 'DRS-2026-0001', name: '丝质连衣裙' });
const lowStock = buildProduct({
  id: 'p2',
  styleNo: 'DRS-2026-0002',
  name: '棉质衬衫',
  stock: PRODUCT_LOW_STOCK_THRESHOLD - 1,
  barcode: '8051234567890'
});
const clearance = buildProduct({
  id: 'p3',
  styleNo: 'CLR-2026-0003',
  name: 'Clearance coat',
  status: 'clearance',
  stock: 50,
  createdAt: new Date(NOW - 2 * DAY).toISOString()
});
const authorized = buildProduct({
  id: 'p4',
  styleNo: 'AUT-2026-0004',
  name: '授权礼服',
  visibility: 'private',
  isExclusiveProtected: true,
  stock: 5,
  createdAt: new Date(NOW - 40 * DAY).toISOString()
});
const catalog = [inStockNew, lowStock, clearance, authorized];

test('product search matches style number, name, SKU and barcode', () => {
  assert.equal(matchesMerchantProductSearch(inStockNew, 'drs-2026-0001'), true);
  assert.equal(matchesMerchantProductSearch(inStockNew, '丝质'), true);
  assert.equal(matchesMerchantProductSearch(inStockNew, 'drs-2026-0001-01'), true);
  assert.equal(matchesMerchantProductSearch(lowStock, '8051234567890'), true);
  assert.equal(matchesMerchantProductSearch(lowStock, '  '), true);
  assert.equal(matchesMerchantProductSearch(inStockNew, 'not-exist'), false);
});

test('low stock quick filter uses real SKU stock against the shared threshold', () => {
  const counts = countMerchantProductQuickFilters(catalog, { now: NOW });
  assert.equal(counts.all, 4);
  assert.equal(counts.low_stock, catalog.filter(product =>
    product.skus.reduce((sum, sku) => sum + sku.stockCentral, 0) < PRODUCT_LOW_STOCK_THRESHOLD
  ).length);
  assert.equal(counts.low_stock, 2);
  const atThreshold = buildProduct({ id: 'p5', styleNo: 'DRS-2026-0005', stock: PRODUCT_LOW_STOCK_THRESHOLD });
  assert.equal(countMerchantProductQuickFilters([atThreshold], { now: NOW }).low_stock, 0);
});

test('new arrival quick filter follows the product creation window', () => {
  assert.equal(MERCHANT_NEW_ARRIVAL_WINDOW_DAYS, 30);
  assert.equal(isNewArrivalProduct(clearance, NOW), true);
  assert.equal(isNewArrivalProduct(authorized, NOW), false);
  assert.equal(isNewArrivalProduct({ createdAt: undefined }, NOW), false);
  assert.equal(countMerchantProductQuickFilters(catalog, { now: NOW }).new_arrival, 1);
});

test('sold quick filter follows real sale records instead of current stock', () => {
  const soldOutButSold = buildProduct({ id: 'p6', styleNo: 'DRS-2026-0006', stock: 0 });
  const soldOutNeverSold = buildProduct({ id: 'p7', styleNo: 'DRS-2026-0007', stock: 0 });

  assert.equal(isSoldProduct(soldOutButSold.id, new Set([soldOutButSold.id])), true, 'no stock but real sales still counts as sold');
  assert.equal(isSoldProduct(soldOutNeverSold.id, new Set([soldOutButSold.id])), false, 'no stock and never sold is not sold');
  assert.equal(isSoldProduct(inStockNew.id, new Set()), false);

  const visible = filterMerchantProducts([soldOutButSold, soldOutNeverSold], {
    quickFilter: 'sold',
    soldProductIds: new Set([soldOutButSold.id])
  });
  assert.deepEqual(visible.map(product => product.id), ['p6']);

  // 仍有库存的商品也可以出现在已售出列表。
  const counts = countMerchantProductQuickFilters([...catalog, soldOutButSold], {
    now: NOW,
    soldProductIds: new Set([inStockNew.id, soldOutButSold.id])
  });
  assert.equal(counts.sold, 2);
  assert.equal(counts.all, 5);
});

test('business zones partition the catalog without duplicates or double counting', () => {
  const zoneCounts = countMerchantProductZones(catalog);
  assert.deepEqual(zoneCounts, { new: 2, clearance: 1, private: 1 });
  const total = zoneCounts.new + zoneCounts.clearance + zoneCounts.private;
  assert.equal(total, countMerchantProductQuickFilters(catalog, { now: NOW }).all, 'zones partition every product exactly once');
  const allIds = ['new', 'clearance', 'private'].flatMap(zone =>
    filterMerchantProducts(catalog, { zoneFilter: zone as 'new' | 'clearance' | 'private', now: NOW }).map(product => product.id)
  );
  assert.equal(new Set(allIds).size, allIds.length, 'no product appears in two zones');
});

test('quick filters narrow the active zone instead of replacing it', () => {
  const lowStockInStock = filterMerchantProducts(catalog, { quickFilter: 'low_stock', zoneFilter: 'new', now: NOW });
  assert.deepEqual(lowStockInStock.map(product => product.id), ['p2']);
  const lowStockAnyZone = filterMerchantProducts(catalog, { quickFilter: 'low_stock', now: NOW });
  assert.deepEqual(lowStockAnyZone.map(product => product.id).sort(), ['p2', 'p4']);
  const newArrivalClearance = filterMerchantProducts(catalog, { quickFilter: 'new_arrival', zoneFilter: 'clearance', now: NOW });
  assert.deepEqual(newArrivalClearance.map(product => product.id), ['p3']);
  const newArrivalInStock = filterMerchantProducts(catalog, { quickFilter: 'new_arrival', zoneFilter: 'new', now: NOW });
  assert.deepEqual(newArrivalInStock, []);
  const soldInClearance = filterMerchantProducts(catalog, {
    quickFilter: 'sold',
    zoneFilter: 'clearance',
    soldProductIds: new Set([inStockNew.id, clearance.id])
  });
  assert.deepEqual(soldInClearance.map(product => product.id), ['p3']);
});

test('search and category narrow the list while counts stay on the full catalog', () => {
  const searched = filterMerchantProducts(catalog, { query: '授权', zoneFilter: 'private', now: NOW });
  assert.deepEqual(searched.map(product => product.id), ['p4']);
  const otherCategory = filterMerchantProducts(catalog, { category: 'coat', now: NOW });
  assert.deepEqual(otherCategory, []);
  assert.deepEqual(countMerchantProductZones(catalog), { new: 2, clearance: 1, private: 1 });
});


import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isRestaurantMerchant,
  normalizeRestaurantDishCreate,
  normalizeRestaurantDishUpdate,
  normalizeRestaurantIngredientCreate,
  normalizeRestaurantIngredientUpdate,
  normalizeRestaurantIdempotencyKey,
  normalizeRestaurantMenuCreate,
  normalizeRestaurantMenuItemCreate,
  normalizeRestaurantMenuItemUpdate,
  normalizeRestaurantMenuUpdate,
  normalizeRestaurantMenuTransition,
  normalizeRestaurantPrice,
  normalizeRestaurantRecipeActivate,
  normalizeRestaurantRecipeCreate,
  normalizeRestaurantStockAdjustment,
  normalizeRestaurantTableCreate,
  normalizeRestaurantTableUpdate,
  restaurantRequestHash
} from '../src/server/restaurantCatalog';

test('restaurant catalog access requires the fixed template and industry identity', () => {
  assert.equal(isRestaurantMerchant({
    industryTemplate: 'restaurant_ordering',
    industry: 'RESTAURANT'
  }), true);
  assert.equal(isRestaurantMerchant({
    industryTemplate: 'restaurant_ordering',
    industry: 'FASHION_COMPANY'
  }), false);
  assert.equal(isRestaurantMerchant({
    industryTemplate: 'general_retail',
    industry: 'RESTAURANT'
  }), false);
  assert.equal(isRestaurantMerchant(null), false);
});

test('restaurant dish drafts accept only catalog fields and normalize text', () => {
  assert.deepEqual(normalizeRestaurantDishCreate({
    name: '  Tomato Soup ',
    nameZh: ' 番茄汤 ',
    category: ' Soup ',
    allergens: ['Celery', 'Milk'],
    productId: 'product-1'
  }), {
    name: 'Tomato Soup',
    nameZh: '番茄汤',
    category: 'Soup',
    allergens: ['Celery', 'Milk'],
    productId: 'product-1'
  });
  assert.equal(normalizeRestaurantDishCreate({ name: 'Soup', status: 'active' }), null);
  assert.equal(normalizeRestaurantDishCreate({ name: 'Soup', merchantId: 'another-tenant' }), null);
  assert.equal(normalizeRestaurantDishCreate({ name: ' ' }), null);
  assert.equal(normalizeRestaurantDishCreate({ name: 'Soup', allergens: ['Milk', 'Milk'] }), null);
  assert.equal(normalizeRestaurantDishCreate({ name: 'Soup', allergens: [''] }), null);
  assert.equal(normalizeRestaurantDishCreate({ name: 'Soup', allergens: Array.from({ length: 31 }, () => 'x') }), null);
});

test('restaurant dish updates require a version and at least one valid mutable field', () => {
  assert.deepEqual(normalizeRestaurantDishUpdate({ expectedVersion: 3, description: 'Updated recipe notes' }), {
    description: 'Updated recipe notes',
    expectedVersion: 3
  });
  assert.deepEqual(normalizeRestaurantDishUpdate({ expectedVersion: 1, nameZh: null }), {
    nameZh: null,
    expectedVersion: 1
  });
  assert.equal(normalizeRestaurantDishUpdate({ name: 'Soup' }), null);
  assert.equal(normalizeRestaurantDishUpdate({ expectedVersion: 0, name: 'Soup' }), null);
  assert.equal(normalizeRestaurantDishUpdate({ expectedVersion: 1 }), null);
  assert.equal(normalizeRestaurantDishUpdate({ expectedVersion: 1, status: 'active' }), null);
});

test('restaurant menu drafts validate currency, store id, and optimistic version input', () => {
  assert.deepEqual(normalizeRestaurantMenuCreate({ name: 'Lunch', storeId: 'store-1' }), {
    name: 'Lunch',
    description: '',
    currency: 'EUR',
    storeId: 'store-1'
  });
  assert.deepEqual(normalizeRestaurantMenuCreate({ name: 'Dinner', currency: 'usd', description: 'Evening menu' }), {
    name: 'Dinner',
    description: 'Evening menu',
    currency: 'USD'
  });
  assert.equal(normalizeRestaurantMenuCreate({ name: 'Dinner', currency: 'US' }), null);
  assert.equal(normalizeRestaurantMenuCreate({ name: 'Dinner', status: 'published' }), null);
  assert.deepEqual(normalizeRestaurantMenuUpdate({ expectedVersion: 2, name: 'Updated lunch' }), {
    expectedVersion: 2,
    name: 'Updated lunch'
  });
  assert.equal(normalizeRestaurantMenuUpdate({ expectedVersion: 2 }), null);
  assert.equal(normalizeRestaurantMenuUpdate({ expectedVersion: 1, storeId: 'other-store' }), null);
  assert.deepEqual(normalizeRestaurantMenuTransition({ expectedVersion: 3 }), { expectedVersion: 3 });
  assert.equal(normalizeRestaurantMenuTransition({ expectedVersion: 0 }), null);
  assert.equal(normalizeRestaurantMenuTransition({ expectedVersion: 1, status: 'published' }), null);
});

test('restaurant table input validates tenant-owned store data, seat count, status and version', () => {
  assert.deepEqual(normalizeRestaurantTableCreate({
    storeId: 'store-1',
    code: ' t-01 ',
    name: ' Table 1 ',
    capacity: 4,
    area: ' Patio '
  }), {
    storeId: 'store-1',
    code: 'T-01',
    name: 'Table 1',
    capacity: 4,
    area: 'Patio'
  });
  assert.equal(normalizeRestaurantTableCreate({ storeId: 'store-1', code: 'T 1', name: 'Table', capacity: 4 }), null);
  assert.equal(normalizeRestaurantTableCreate({ storeId: 'store-1', code: 'T1', name: 'Table', capacity: 0 }), null);
  assert.equal(normalizeRestaurantTableCreate({ storeId: 'store-1', code: 'T1', name: 'Table', capacity: 41 }), null);
  assert.equal(normalizeRestaurantTableCreate({ storeId: 'store-1', code: 'T1', name: 'Table', capacity: 4, status: 'inactive' }), null);
  assert.deepEqual(normalizeRestaurantTableUpdate({ expectedVersion: 2, status: 'inactive' }), {
    expectedVersion: 2,
    status: 'inactive'
  });
  assert.equal(normalizeRestaurantTableUpdate({ expectedVersion: 0, name: 'Table' }), null);
  assert.equal(normalizeRestaurantTableUpdate({ expectedVersion: 1 }), null);
  assert.equal(normalizeRestaurantTableUpdate({ expectedVersion: 1, storeId: 'another-store' }), null);
});

test('restaurant prices preserve decimal input and reject invalid precision or magnitude', () => {
  assert.equal(normalizeRestaurantPrice('12'), '12.00');
  assert.equal(normalizeRestaurantPrice('12.3'), '12.3');
  assert.equal(normalizeRestaurantPrice(12.34), '12.34');
  assert.equal(normalizeRestaurantPrice('-1'), null);
  assert.equal(normalizeRestaurantPrice('01.00'), null);
  assert.equal(normalizeRestaurantPrice('1.234'), null);
  assert.equal(normalizeRestaurantPrice('100000000'), null);
});

test('restaurant menu item writes validate dish, price, state, and expected version', () => {
  assert.deepEqual(normalizeRestaurantMenuItemCreate({ dishId: 'dish-1', price: '8.5', sortOrder: 2 }), {
    dishId: 'dish-1',
    price: '8.5',
    sortOrder: 2
  });
  assert.equal(normalizeRestaurantMenuItemCreate({ dishId: 'dish-1', price: '8.999' }), null);
  assert.deepEqual(normalizeRestaurantMenuItemUpdate({
    expectedVersion: 4,
    status: 'sold_out',
    price: '9.00'
  }), { expectedVersion: 4, status: 'sold_out', price: '9.00' });
  assert.equal(normalizeRestaurantMenuItemUpdate({ expectedVersion: 1, status: 'published' }), null);
  assert.equal(normalizeRestaurantMenuItemUpdate({ expectedVersion: 1 }), null);
});

test('restaurant ingredients accept food units and scoped allergen codes only', () => {
  assert.deepEqual(normalizeRestaurantIngredientCreate({
    code: 'tomato-01',
    name: 'Tomato',
    category: 'produce',
    unit: 'kg',
    allergens: [],
    reorderPoint: '2.500',
    leadTimeDays: 3
  }), {
    code: 'TOMATO-01',
    name: 'Tomato',
    category: 'produce',
    unit: 'kg',
    allergens: [],
    reorderPoint: '2.500',
    leadTimeDays: 3
  });
  assert.equal(normalizeRestaurantIngredientCreate({
    code: 'flour', name: 'Flour', category: 'grain', unit: 'meter'
  }), null);
  assert.equal(normalizeRestaurantIngredientCreate({
    code: 'flour', name: 'Flour', category: 'fabric', unit: 'kg'
  }), null);
  assert.equal(normalizeRestaurantIngredientCreate({
    code: 'milk', name: 'Milk', category: 'dairy', unit: 'l', allergens: ['not_a_code']
  }), null);
  assert.equal(normalizeRestaurantIngredientCreate({
    code: 'salt', name: 'Salt', category: 'seasoning', unit: 'g', reorderPoint: '-1'
  }), null);
  assert.deepEqual(normalizeRestaurantIngredientUpdate({
    expectedVersion: 2,
    status: 'suspended',
    allergens: ['milk']
  }), { expectedVersion: 2, status: 'suspended', allergens: ['milk'] });
  assert.equal(normalizeRestaurantIngredientUpdate({ expectedVersion: 1, unit: 'meter' }), null);
  assert.equal(normalizeRestaurantIngredientUpdate({ expectedVersion: 1 }), null);
});

test('restaurant recipe versions require positive quantities, food yield units, and unique ingredients', () => {
  assert.deepEqual(normalizeRestaurantRecipeCreate({
    yieldQuantity: '4',
    yieldUnit: 'portion',
    items: [{ ingredientId: 'ingredient-1', quantity: '0.1250', wasteRate: '0.05' }]
  }), {
    yieldQuantity: '4',
    yieldUnit: 'portion',
    notes: '',
    items: [{ ingredientId: 'ingredient-1', quantity: '0.1250', wasteRate: '0.05' }]
  });
  assert.equal(normalizeRestaurantRecipeCreate({
    yieldQuantity: '0', yieldUnit: 'portion',
    items: [{ ingredientId: 'ingredient-1', quantity: '1', wasteRate: '0' }]
  }), null);
  assert.equal(normalizeRestaurantRecipeCreate({
    yieldQuantity: '1', yieldUnit: 'meter',
    items: [{ ingredientId: 'ingredient-1', quantity: '1', wasteRate: '0' }]
  }), null);
  assert.equal(normalizeRestaurantRecipeCreate({
    yieldQuantity: '1', yieldUnit: 'piece',
    items: [
      { ingredientId: 'ingredient-1', quantity: '1', wasteRate: '0' },
      { ingredientId: 'ingredient-1', quantity: '2', wasteRate: '0' }
    ]
  }), null);
  assert.equal(normalizeRestaurantRecipeCreate({
    yieldQuantity: '1', yieldUnit: 'piece',
    items: [{ ingredientId: 'ingredient-1', quantity: '1.00001', wasteRate: '0' }]
  }), null);
  assert.deepEqual(normalizeRestaurantRecipeActivate({ expectedVersion: 3 }), { expectedVersion: 3 });
  assert.equal(normalizeRestaurantRecipeActivate({ expectedVersion: 0 }), null);
});

test('restaurant stock adjustments require a version, central location, and valid reason direction', () => {
  assert.deepEqual(normalizeRestaurantStockAdjustment({
    locationCode: 'central',
    delta: '-1.250',
    reason: 'waste',
    expectedVersion: 2,
    note: 'Expired produce'
  }), {
    locationCode: 'central',
    delta: '-1.250',
    reason: 'waste',
    expectedVersion: 2,
    note: 'Expired produce'
  });
  assert.equal(normalizeRestaurantStockAdjustment({
    locationCode: 'other-store',
    delta: '1',
    reason: 'count_correction',
    expectedVersion: 0
  }), null);
  assert.equal(normalizeRestaurantStockAdjustment({
    locationCode: 'central',
    delta: '1',
    reason: 'waste',
    expectedVersion: 0
  }), null);
  assert.equal(normalizeRestaurantStockAdjustment({
    locationCode: 'central',
    delta: '1.0001',
    reason: 'count_correction',
    expectedVersion: 0
  }), null);
  assert.equal(normalizeRestaurantStockAdjustment({
    locationCode: 'central',
    delta: '0',
    reason: 'count_correction',
    expectedVersion: 0
  }), null);
  assert.equal(normalizeRestaurantStockAdjustment({
    locationCode: 'central',
    delta: '1',
    reason: 'count_correction',
    expectedVersion: -1
  }), null);
});

test('restaurant idempotency keys and normalized request hashes are deterministic', () => {
  assert.equal(normalizeRestaurantIdempotencyKey('request-123'), 'request-123');
  assert.equal(normalizeRestaurantIdempotencyKey('short'), null);
  assert.equal(normalizeRestaurantIdempotencyKey('request with spaces'), null);
  assert.equal(
    restaurantRequestHash({ name: 'Lunch', currency: 'EUR' }),
    restaurantRequestHash({ name: 'Lunch', currency: 'EUR' })
  );
  assert.notEqual(
    restaurantRequestHash({ name: 'Lunch', currency: 'EUR' }),
    restaurantRequestHash({ name: 'Dinner', currency: 'EUR' })
  );
});

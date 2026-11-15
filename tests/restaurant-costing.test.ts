import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateRestaurantRecipeCost } from '../src/server/restaurantCosting';

const ingredient = {
  ingredientId: 'ingredient-1',
  ingredientCode: 'TOMATO',
  ingredientName: 'Tomato',
  unit: 'kg',
  quantity: '0.3000',
  wasteRate: '0.0200'
};

test('restaurant recipe costing uses actual weighted receipt prices, waste and yield', () => {
  const cost = calculateRestaurantRecipeCost({
    yieldQuantity: '4',
    items: [{
      ...ingredient,
      receipts: [
        { quantity: '1', unitCost: '3.1000', currency: 'EUR', receivedAt: '2026-01-01T10:00:00.000Z' },
        { quantity: '2', unitCost: '3.5000', currency: 'EUR', receivedAt: '2026-01-02T10:00:00.000Z' }
      ]
    }]
  });

  assert.equal(cost.status, 'ready');
  assert.equal(cost.method, 'weighted_average_actual_receipts');
  assert.equal(cost.currency, 'EUR');
  assert.equal(cost.totalBatchCost, '1.0302');
  assert.equal(cost.costPerYield, '0.2576');
  assert.equal(cost.sourceItemCount, 2);
  assert.equal(cost.latestSourceAt, '2026-01-02T10:00:00.000Z');
  assert.deepEqual(cost.ingredients[0], {
    ingredientId: 'ingredient-1',
    ingredientCode: 'TOMATO',
    ingredientName: 'Tomato',
    unit: 'kg',
    requiredQuantity: '0.3060',
    averageUnitCost: '3.366667',
    currency: 'EUR',
    receiptCount: 2,
    lineCost: '1.0302'
  });
});

test('restaurant recipe costing does not return a total when actual receipt cost is missing', () => {
  const cost = calculateRestaurantRecipeCost({
    yieldQuantity: '4',
    items: [{ ...ingredient, receipts: [] }]
  });

  assert.equal(cost.status, 'insufficient_data');
  assert.equal(cost.currency, null);
  assert.equal(cost.totalBatchCost, null);
  assert.equal(cost.costPerYield, null);
  assert.equal(cost.sourceItemCount, 0);
  assert.equal(cost.ingredients[0].lineCost, null);
});

test('restaurant recipe costing rejects mixed currencies without FX conversion', () => {
  const cost = calculateRestaurantRecipeCost({
    yieldQuantity: '4',
    items: [{
      ...ingredient,
      receipts: [
        { quantity: '1', unitCost: '3.1', currency: 'EUR', receivedAt: '2026-01-01T10:00:00.000Z' },
        { quantity: '2', unitCost: '3.5', currency: 'USD', receivedAt: '2026-01-02T10:00:00.000Z' }
      ]
    }]
  });

  assert.equal(cost.status, 'currency_mismatch');
  assert.equal(cost.currency, null);
  assert.equal(cost.totalBatchCost, null);
  assert.equal(cost.costPerYield, null);
  assert.equal(cost.ingredients[0].averageUnitCost, null);
  assert.equal(cost.sourceItemCount, 2);
});

test('restaurant recipe costing preserves exact database-aggregated receipt values', () => {
  const cost = calculateRestaurantRecipeCost({
    yieldQuantity: '2',
    items: [{
      ...ingredient,
      receipts: [{
        quantity: '3',
        unitCost: '0',
        totalValue: '10.1',
        receiptCount: 2,
        currency: 'EUR',
        receivedAt: '2026-01-02T10:00:00.000Z'
      }]
    }]
  });

  assert.equal(cost.status, 'ready');
  assert.equal(cost.ingredients[0].averageUnitCost, '3.366667');
  assert.equal(cost.sourceItemCount, 2);
});

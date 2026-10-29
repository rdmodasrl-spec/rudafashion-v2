import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeModaGptLowInventory,
  verifyModaGptLowInventoryAnalysis
} from '../src/server/modagptWorkflows';

const stock = {
  productId: 'product-1',
  styleNo: 'STY-1',
  productName: 'Dress',
  sku: 'SKU-1',
  color: null,
  size: null,
  onHandQuantity: 8,
  reservedQuantity: 5,
  availableQuantity: 3,
  inTransitQuantity: 0,
  location: 'Central',
  updatedAt: '2026-10-01T00:00:00.000Z'
};

test('low-inventory workflow returns a current, read-only replenishment analysis from tenant-scoped facts', () => {
  const result = analyzeModaGptLowInventory({
    merchantId: 'merchant-1',
    sourceEventId: 'event-1',
    productId: 'product-1',
    sku: 'SKU-1',
    threshold: 15
  }, [stock], new Map([['SKU-1', 12]]));

  assert.deepEqual(result, {
    status: 'analyzed',
    sourceEventId: 'event-1',
    merchantId: 'merchant-1',
    productId: 'product-1',
    sku: 'SKU-1',
    availableQuantity: 3,
    threshold: 15,
    salesWindowDays: 30,
    recommendation: {
      soldLast30Days: 12,
      estimatedDaysOfCover: 7,
      suggestedReorderQuantity: 9
    },
    writePerformed: false
  });
});

test('low-inventory workflow discards stale event alerts and handles vanished products', () => {
  const input = {
    merchantId: 'merchant-1',
    sourceEventId: 'event-1',
    productId: 'product-1',
    sku: 'SKU-1',
    threshold: 15
  };
  assert.equal(analyzeModaGptLowInventory(input, [{ ...stock, availableQuantity: 20 }], new Map()).status, 'stale_event');
  assert.equal(analyzeModaGptLowInventory(input, [], new Map()).status, 'source_no_longer_available');
});

test('low-inventory workflow validates trusted merchant and bounded threshold inputs', () => {
  assert.throws(
    () => analyzeModaGptLowInventory({
      merchantId: 'merchant-1',
      sourceEventId: 'event-1',
      productId: 'product-1',
      sku: 'SKU-1',
      threshold: -1
    }, [stock], new Map()),
    /MODAGPT_INVENTORY_WORKFLOW_INPUT_INVALID/
  );
});

test('workflow verifier checks the produced analysis against current scoped RUDA facts', () => {
  const workflow = {
    merchantId: 'merchant-1',
    sourceEventId: 'event-1',
    productId: 'product-1',
    sku: 'SKU-1',
    threshold: 15
  };
  const soldUnits = new Map([['SKU-1', 12]]);
  const verified = analyzeModaGptLowInventory(workflow, [stock], soldUnits);
  assert.equal(verifyModaGptLowInventoryAnalysis({
    workflow,
    inventory: [stock],
    soldUnitsBySku: soldUnits,
    actual: verified
  }).passed, true);

  assert.deepEqual(verifyModaGptLowInventoryAnalysis({
    workflow,
    inventory: [stock],
    soldUnitsBySku: new Map([['SKU-1', 11]]),
    actual: verified
  }), {
    passed: false,
    checks: ['source_status'],
    reason: 'SOURCE_DATA_MISMATCH'
  });
});

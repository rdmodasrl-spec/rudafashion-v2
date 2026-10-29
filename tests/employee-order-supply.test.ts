import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { normalizeEmployeeOrderSupplySplit } from '../src/server/employeeOrderSupply';

test('employee wholesale orders accept a complete stock and preorder split', () => {
  assert.deepEqual(normalizeEmployeeOrderSupplySplit({
    quantity: 12,
    inStockQuantity: 5,
    preorderQuantity: 7
  }, false), {
    quantity: 12,
    inStockQuantity: 5,
    preorderQuantity: 7
  });
});

test('legacy orders default to all in-stock and POS cannot include preorder quantities', () => {
  assert.deepEqual(normalizeEmployeeOrderSupplySplit({ quantity: 4 }, false), {
    quantity: 4,
    inStockQuantity: 4,
    preorderQuantity: 0
  });
  assert.equal(normalizeEmployeeOrderSupplySplit({
    quantity: 4,
    inStockQuantity: 2,
    preorderQuantity: 2
  }, true), null);
});

test('employee order supply split rejects missing, negative, or inconsistent quantities', () => {
  assert.equal(normalizeEmployeeOrderSupplySplit({ quantity: 5, inStockQuantity: 3 }, false), null);
  assert.equal(normalizeEmployeeOrderSupplySplit({ quantity: 5, inStockQuantity: -1, preorderQuantity: 6 }, false), null);
  assert.equal(normalizeEmployeeOrderSupplySplit({ quantity: 5, inStockQuantity: 3, preorderQuantity: 3 }, false), null);
  assert.equal(normalizeEmployeeOrderSupplySplit({ quantity: 0 }, false), null);
});

test('order item supply fields are additive and represented in the Prisma schema', () => {
  const schema = readFileSync('prisma/schema.prisma', 'utf8');
  const migration = readFileSync('prisma/migrations/20261020120000_add_order_item_supply_split/migration.sql', 'utf8');
  assert.match(schema, /model OrderItem \{[\s\S]*?inStockQuantity\s+Int\?[\s\S]*?preorderQuantity\s+Int\?/);
  assert.match(migration, /ADD COLUMN "inStockQuantity" INTEGER/);
  assert.match(migration, /ADD COLUMN "preorderQuantity" INTEGER/);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultEmployeePermissions, hasEmployeePermission } from '../src/server/employeePermissions';

test('defaults permissions only when no custom permission list is configured', () => {
  assert.equal(hasEmployeePermission('sales', undefined, 'sales.order.create'), true);
  assert.equal(hasEmployeePermission('sales', null, 'pricing.request'), true);
  assert.equal(hasEmployeePermission('sales', [], 'sales.order.create'), false);
});

test('custom permission sets use canonical action keys and can revoke defaults', () => {
  assert.equal(hasEmployeePermission('sales', ['pricing.request'], 'pricing.request'), true);
  assert.equal(hasEmployeePermission('sales', ['pricing.request'], 'sales.order.create'), false);
  assert.equal(hasEmployeePermission('sales', ['sales.orders'], 'sales.order.create'), false);
  assert.equal(hasEmployeePermission('sales', ['*'], 'sales.order.create'), true);
});

test('role defaults match service-checked operations', () => {
  assert.deepEqual(defaultEmployeePermissions.warehouse, [
    'warehouse.pick', 'warehouse.review', 'warehouse.pack', 'warehouse.ship'
  ]);
  assert.equal(defaultEmployeePermissions.store_manager.includes('return.manage'), true);
  assert.equal(hasEmployeePermission('sales', undefined, 'return.manage'), false);
  assert.equal(hasEmployeePermission('sales', ['return.manage'], 'return.manage'), true);
});

test('POS cashier defaults to sales access without employee administration', () => {
  assert.deepEqual(defaultEmployeePermissions.pos_cashier, ['sales.order.create']);
  assert.equal(hasEmployeePermission('pos_cashier', undefined, 'sales.order.create'), true);
  assert.equal(hasEmployeePermission('pos_cashier', undefined, 'employees.manage'), false);
});

test('knowledge manager receives only the permissions required for curated Brain documents', () => {
  assert.deepEqual(defaultEmployeePermissions.knowledge_manager, [
    'brain.read', 'brain.write', 'brain.knowledge.review'
  ]);
  assert.equal(hasEmployeePermission('knowledge_manager', undefined, 'brain.knowledge.review'), true);
  assert.equal(hasEmployeePermission('store_manager', undefined, 'brain.knowledge.review'), false);
  assert.equal(hasEmployeePermission('knowledge_manager', [], 'brain.knowledge.review'), false);
});

test('product publishing is restricted to explicitly authorized employees', () => {
  assert.equal(defaultEmployeePermissions.store_manager.includes('product.publish'), true);
  assert.equal(hasEmployeePermission('sales', undefined, 'product.publish'), false);
  assert.equal(hasEmployeePermission('sales', ['product.publish'], 'product.publish'), true);
  assert.equal(hasEmployeePermission('store_manager', [], 'product.publish'), false);
});

test('product cost visibility is limited to authorized store managers and explicitly delegated employees', () => {
  assert.equal(defaultEmployeePermissions.store_manager.includes('product.cost.view'), true);
  assert.equal(hasEmployeePermission('sales', undefined, 'product.cost.view'), false);
  assert.equal(hasEmployeePermission('sales', ['product.cost.view'], 'product.cost.view'), true);
  assert.equal(hasEmployeePermission('store_manager', [], 'product.cost.view'), false);
});

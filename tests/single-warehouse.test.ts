import test from 'node:test';
import assert from 'node:assert/strict';
import { isSingleWarehouseCode, SINGLE_WAREHOUSE_CODE } from '../src/server/warehouse';

test('single warehouse policy accepts only the central warehouse', () => {
  assert.equal(SINGLE_WAREHOUSE_CODE, 'central');
  assert.equal(isSingleWarehouseCode('central'), true);
  assert.equal(isSingleWarehouseCode('mestre'), false);
  assert.equal(isSingleWarehouseCode('milano'), false);
});

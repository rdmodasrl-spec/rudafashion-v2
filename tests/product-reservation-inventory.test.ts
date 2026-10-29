import assert from 'node:assert/strict';
import test from 'node:test';
import { getCentralAvailableQuantity } from '../src/server/productReservationInventory';

test('reservation availability deducts stock already reserved at the central warehouse', () => {
  assert.equal(getCentralAvailableQuantity([
    { location: { code: 'central' }, onHandQuantity: 12, reservedQuantity: 5 },
    { location: { code: 'mestre' }, onHandQuantity: 40, reservedQuantity: 0 }
  ]), 7);
});

test('reservation availability never reports negative stock', () => {
  assert.equal(getCentralAvailableQuantity([
    { location: { code: 'central' }, onHandQuantity: 3, reservedQuantity: 5 }
  ]), 0);
});

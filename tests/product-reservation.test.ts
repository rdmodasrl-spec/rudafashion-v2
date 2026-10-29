import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getAvailableSkuStock } from '../src/shared/productInventory';
import { getSelectedProductReservationItems } from '../src/shared/productReservation';

test('available inventory subtracts reserved units and never falls below zero', () => {
  assert.equal(getAvailableSkuStock({ stockCentral: 12, reserved: 5 }), 7);
  assert.equal(getAvailableSkuStock({ stockCentral: 3, reserved: 8 }), 0);
  assert.equal(getAvailableSkuStock(undefined), 0);
});

test('reservation payload preserves selected SKU quantities and omits zero or invalid quantities', () => {
  assert.deepEqual(
    getSelectedProductReservationItems({
      'STYLE-BLK-S': 3,
      'STYLE-BLK-M': 0,
      'STYLE-RED-S': 2.5,
      'STYLE-RED-M': 4
    }),
    [
      { sku: 'STYLE-BLK-S', quantity: 3 },
      { sku: 'STYLE-RED-M', quantity: 4 }
    ]
  );
});

test('B2B context submits reservation intents through the buyer endpoint', () => {
  const context = readFileSync(new URL('../src/context/B2BContext.tsx', import.meta.url), 'utf8');
  assert.match(context, /if \(authRole !== 'buyer'\) throw new Error\('APPROVED_BUYER_REQUIRED'\)/);
  assert.match(context, /apiPost<[\s\S]*?>\('\/api\/product-reservation-requests', \{ productId, items \}\)/);
});

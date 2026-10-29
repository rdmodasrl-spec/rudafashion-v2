import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canTransitionProductionOrder,
  computeDeliveryShortage,
  computeProductionTotals,
  computeStatementTotals,
  createProductionInviteToken,
  hashProductionInviteToken,
  isProductionIdempotencyKey,
  normalizeInspectionLine,
  normalizePeriodMonth,
  normalizeProductionItems,
  periodMonthRange,
  productionSequenceNo,
  roundMoney
} from '../src/server/productionChain';
import { appStoreNativeRuntimes, isAppStoreNativeRuntimeCompatible } from '../src/server/appStoreValidation';
import { hasEmployeePermission } from '../src/server/employeePermissions';

test('production order transitions follow the documented state machine', () => {
  assert.equal(canTransitionProductionOrder('draft', 'pending_factory'), true);
  assert.equal(canTransitionProductionOrder('pending_factory', 'accepted'), true);
  assert.equal(canTransitionProductionOrder('accepted', 'in_production'), true);
  assert.equal(canTransitionProductionOrder('in_production', 'completed'), true);
  assert.equal(canTransitionProductionOrder('accepted', 'completed'), true);
  assert.equal(canTransitionProductionOrder('draft', 'completed'), false);
  assert.equal(canTransitionProductionOrder('completed', 'cancelled'), false);
  assert.equal(canTransitionProductionOrder('cancelled', 'draft'), false);
  assert.equal(canTransitionProductionOrder('unknown', 'draft'), false);
});

test('production items reject empty, duplicate or invalid quantities', () => {
  assert.equal(normalizeProductionItems([]), null);
  assert.equal(normalizeProductionItems([{ variantId: 'v1', quantity: 0 }]), null);
  assert.equal(normalizeProductionItems([{ variantId: 'v1', quantity: 1.5 }]), null);
  assert.equal(normalizeProductionItems([
    { variantId: 'v1', quantity: 1 },
    { variantId: 'v1', quantity: 2 }
  ]), null);
  assert.deepEqual(
    normalizeProductionItems([{ variantId: 'v1', quantity: 10, unitPrice: 3.5 }]),
    [{ variantId: 'v1', quantity: 10, unitPrice: 3.5 }]
  );
});

test('production totals are computed server-side with per-item prices', () => {
  const totals = computeProductionTotals([
    { variantId: 'v1', quantity: 10, unitPrice: 2.5 },
    { variantId: 'v2', quantity: 4 }
  ], 3);
  assert.equal(totals.plannedQuantity, 14);
  assert.equal(totals.plannedAmount, 37);
  assert.equal(roundMoney(0.1 + 0.2), 0.3);
});

test('inspection lines require accepted plus rejected to equal received', () => {
  const valid = normalizeInspectionLine({
    declaredQuantity: 100,
    receivedQuantity: 98,
    acceptedQuantity: 90,
    rejectedQuantity: 8,
    reworkQuantity: 8
  });
  assert.deepEqual(valid, {
    declaredQuantity: 100,
    receivedQuantity: 98,
    acceptedQuantity: 90,
    rejectedQuantity: 8,
    reworkQuantity: 8
  });
  assert.equal(computeDeliveryShortage(100, 98), 2);
  assert.equal(normalizeInspectionLine({
    declaredQuantity: 100,
    receivedQuantity: 101,
    acceptedQuantity: 101,
    rejectedQuantity: 0,
    reworkQuantity: 0
  }), null);
  assert.equal(normalizeInspectionLine({
    declaredQuantity: 100,
    receivedQuantity: 100,
    acceptedQuantity: 90,
    rejectedQuantity: 5,
    reworkQuantity: 0
  }), null);
  assert.equal(normalizeInspectionLine({
    declaredQuantity: 100,
    receivedQuantity: 100,
    acceptedQuantity: 90,
    rejectedQuantity: 10,
    reworkQuantity: 11
  }), null);
});

test('statement totals keep opening balance, adjustments and payments consistent', () => {
  const totals = computeStatementTotals({
    openingBalance: 500,
    laborAmount: 1205,
    adjustmentAmount: -20,
    paidAmount: 300
  });
  assert.equal(totals.totalAmount, 1185);
  assert.equal(totals.closingBalance, 1385);
});

test('settlement periods are validated and bounded in UTC', () => {
  assert.equal(normalizePeriodMonth('2026-10'), '2026-10');
  assert.equal(normalizePeriodMonth('2026-13'), null);
  assert.equal(normalizePeriodMonth('2026-1'), null);
  assert.equal(normalizePeriodMonth(undefined), null);
  const range = periodMonthRange('2026-02');
  assert.equal(range.start.toISOString(), '2026-02-01T00:00:00.000Z');
  assert.equal(range.end.toISOString(), '2026-03-01T00:00:00.000Z');
});

test('production invite tokens are unpredictable and stored as hashes', () => {
  const first = createProductionInviteToken();
  const second = createProductionInviteToken();
  assert.notEqual(first, second);
  assert.ok(first.length >= 40);
  assert.notEqual(hashProductionInviteToken(first), first);
  assert.equal(hashProductionInviteToken(first).length, 64);
  assert.equal(isProductionIdempotencyKey('short'), false);
  assert.equal(isProductionIdempotencyKey('delivery-2026-10-25-a'), true);
  assert.match(productionSequenceNo('PO', new Date('2026-10-25T10:00:00Z')), /^PO-20261025-[0-9A-F]{6}$/);
});

test('production app is a registered free native runtime and grants scoped permissions', () => {
  assert.equal(appStoreNativeRuntimes['ruda-production-chain'], '1.0.0');
  assert.equal(isAppStoreNativeRuntimeCompatible('ruda-production-chain', '1.0.0'), true);
  assert.equal(isAppStoreNativeRuntimeCompatible('ruda-production-chain', '0.9.0'), false);
  assert.equal(hasEmployeePermission('store_manager', undefined, 'production.view'), true);
  assert.equal(hasEmployeePermission('store_manager', undefined, 'production.manage'), true);
  assert.equal(hasEmployeePermission('store_manager', undefined, 'production.cost.view'), true);
  assert.equal(hasEmployeePermission('warehouse', undefined, 'production.manage'), false);
  assert.equal(hasEmployeePermission('store_manager', ['production.view'], 'production.manage'), false);
});

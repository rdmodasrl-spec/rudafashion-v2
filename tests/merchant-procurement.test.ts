import assert from 'node:assert/strict';
import test from 'node:test';
import { canTransitionPurchaseOrderStatus, getPurchaseOrderInTransitDelta, getPurchaseOrderStatusAfterReceipt } from '../src/server/merchantProcurement';
import { defaultEmployeePermissions, hasEmployeePermission } from '../src/server/employeePermissions';

test('purchase orders only allow forward transitions and safe cancellation', () => {
  assert.equal(canTransitionPurchaseOrderStatus('draft', 'ordered'), true);
  assert.equal(canTransitionPurchaseOrderStatus('draft', 'cancelled'), true);
  assert.equal(canTransitionPurchaseOrderStatus('ordered', 'partially_received'), true);
  assert.equal(canTransitionPurchaseOrderStatus('partially_received', 'received'), true);
  assert.equal(canTransitionPurchaseOrderStatus('partially_received', 'cancelled'), true);
  assert.equal(canTransitionPurchaseOrderStatus('received', 'ordered'), false);
  assert.equal(canTransitionPurchaseOrderStatus('cancelled', 'ordered'), false);
});

test('purchase order placement and cancellation keep remaining in-transit stock balanced', () => {
  assert.equal(getPurchaseOrderInTransitDelta('draft', 'ordered', 20, 0), 20);
  assert.equal(getPurchaseOrderInTransitDelta('ordered', 'cancelled', 20, 0), -20);
  assert.equal(getPurchaseOrderInTransitDelta('partially_received', 'cancelled', 20, 7), -13);
  assert.equal(getPurchaseOrderInTransitDelta('partially_received', 'received', 20, 20), 0);
  assert.throws(() => getPurchaseOrderInTransitDelta('draft', 'ordered', 10, 11), /PURCHASE_ORDER_QUANTITY_INVALID/);
});

test('partial receipts preserve the remaining quantity until every purchase line is received', () => {
  const lines = [
    { id: 'item-a', orderedQuantity: 12, receivedQuantity: 0 },
    { id: 'item-b', orderedQuantity: 6, receivedQuantity: 0 }
  ];
  assert.equal(getPurchaseOrderStatusAfterReceipt(lines, new Map([['item-a', 5]])), 'partially_received');
  assert.equal(
    getPurchaseOrderStatusAfterReceipt(
      [{ id: 'item-a', orderedQuantity: 12, receivedQuantity: 5 }, { id: 'item-b', orderedQuantity: 6, receivedQuantity: 0 }],
      new Map([['item-a', 7], ['item-b', 6]])
    ),
    'received'
  );
});

test('receipt validation rejects over-receipt, unknown lines, and empty receipts', () => {
  assert.throws(
    () => getPurchaseOrderStatusAfterReceipt([{ id: 'item-a', orderedQuantity: 5, receivedQuantity: 3 }], new Map([['item-a', 3]])),
    /PURCHASE_RECEIPT_QUANTITY_INVALID/
  );
  assert.throws(
    () => getPurchaseOrderStatusAfterReceipt([{ id: 'item-a', orderedQuantity: 5, receivedQuantity: 0 }], new Map([['item-x', 1]])),
    /PURCHASE_RECEIPT_ITEM_UNKNOWN/
  );
  assert.throws(() => getPurchaseOrderStatusAfterReceipt([], new Map()), /PURCHASE_RECEIPT_ITEMS_INVALID/);
});

test('purchase management is granted to store managers and can be explicitly delegated', () => {
  assert.equal(defaultEmployeePermissions.store_manager.includes('purchase.manage'), true);
  assert.equal(hasEmployeePermission('sales', undefined, 'purchase.manage'), false);
  assert.equal(hasEmployeePermission('sales', ['purchase.manage'], 'purchase.manage'), true);
});

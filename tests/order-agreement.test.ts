import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createOrderAgreementTerms,
  getOrderPaymentAmountDue,
  getOutstandingOrderAmount,
  isOrderFulfillmentPaymentSatisfied
} from '../src/server/orderAgreement';
import { getOrderChainTask } from '../src/shared/orderChain';

const defaults = {
  paymentMethod: 'bank_transfer',
  totalAmount: 100,
  shippingFee: 0,
  items: [{ orderItemId: 'item-1', quantity: 2, unitPrice: 50 }]
};

test('creates validated full and partial prepayment snapshots', () => {
  const full = createOrderAgreementTerms({}, defaults);
  assert.equal(full.paymentPlan, 'full_prepayment');
  assert.equal(full.prepaymentAmount, 100);

  const partial = createOrderAgreementTerms({ paymentPlan: 'partial_prepayment', prepaymentPercent: 30 }, defaults);
  assert.equal(partial.prepaymentAmount, 30);
  assert.throws(
    () => createOrderAgreementTerms({ paymentPlan: 'partial_prepayment', prepaymentPercent: 100 }, defaults),
    /INVALID_PREPAYMENT_PERCENT/
  );
  assert.throws(
    () => createOrderAgreementTerms({ paymentPlan: 'partial_prepayment', prepaymentAmount: 30, prepaymentPercent: 30 }, defaults),
    /PARTIAL_PREPAYMENT_VALUE_REQUIRED/
  );
});

test('preserves shipping recipient and additional fees in the proposed agreement snapshot', () => {
  const terms = createOrderAgreementTerms({
    shippingAddress: {
      street: 'Via Roma 10',
      city: 'Milano',
      country: 'Italy',
      zip: '20100',
      recipient: 'Ada Rossi',
      phone: '+39 333 1234567'
    },
    additionalFees: 12.5,
    additionalFeesDescription: 'Handling'
  }, {
    ...defaults,
    totalAmount: 112.5,
    additionalFees: 12.5,
    additionalFeesDescription: 'Handling',
    shippingAddress: {
      street: 'Via Roma 10',
      city: 'Milano',
      country: 'Italy',
      zip: '20100',
      recipient: 'Ada Rossi',
      phone: '+39 333 1234567'
    }
  });
  assert.equal(terms.totalAmount, 112.5);
  assert.equal(terms.additionalFees, 12.5);
  assert.equal(terms.additionalFeesDescription, 'Handling');
  assert.deepEqual(terms.shippingAddress, {
    street: 'Via Roma 10',
    city: 'Milano',
    country: 'Italy',
    zip: '20100',
    recipient: 'Ada Rossi',
    phone: '+39 333 1234567'
  });
});

test('rejects payment instruments that the order payment flow cannot settle', () => {
  assert.throws(
    () => createOrderAgreementTerms({ paymentMethod: 'paypal' }, defaults),
    /INVALID_ORDER_PAYMENT_METHOD/
  );
  assert.throws(
    () => createOrderAgreementTerms({ paymentMethod: 'cash' }, defaults),
    /INVALID_ORDER_PAYMENT_METHOD/
  );
});

test('validates custom and dated balance conditions', () => {
  assert.throws(
    () => createOrderAgreementTerms({ paymentPlan: 'custom' }, defaults),
    /CUSTOM_PAYMENT_CONDITION_REQUIRED/
  );
  assert.throws(
    () => createOrderAgreementTerms({ remainingBalanceTrigger: 'date' }, defaults),
    /REMAINING_BALANCE_DATE_REQUIRED/
  );
  const terms = createOrderAgreementTerms({
    paymentPlan: 'custom',
    customPaymentCondition: '签收后七日内',
    remainingBalanceTrigger: 'custom'
  }, defaults);
  assert.equal(terms.customPaymentCondition, '签收后七日内');

  const triggeredBalance = createOrderAgreementTerms({
    paymentPlan: 'custom',
    prepaymentAmount: 30,
    remainingBalanceTrigger: 'custom',
    customPaymentCondition: '商家核实收货后七日'
  }, defaults);
  assert.equal(getOrderPaymentAmountDue(triggeredBalance, 30, 'delivered', new Date(), false), 0);
  assert.equal(getOrderPaymentAmountDue(triggeredBalance, 30, 'delivered', new Date(), true), 70);
});

test('calculates outstanding amount and fulfillment payment threshold', () => {
  const partial = createOrderAgreementTerms({ paymentPlan: 'partial_prepayment', prepaymentAmount: 30 }, defaults);
  assert.equal(getOutstandingOrderAmount(100, 30), 70);
  assert.equal(getOrderPaymentAmountDue(partial, 0, 'confirmed'), 30);
  assert.equal(getOrderPaymentAmountDue(partial, 30, 'confirmed'), 70);
  assert.equal(isOrderFulfillmentPaymentSatisfied(partial, 100, 29.99), false);
  assert.equal(isOrderFulfillmentPaymentSatisfied(partial, 100, 30), true);
  assert.equal(isOrderFulfillmentPaymentSatisfied(partial, 100, 30, 'shipment'), false);
  assert.equal(isOrderFulfillmentPaymentSatisfied(partial, 100, 100, 'shipment'), true);
  const deliveryBalance = createOrderAgreementTerms({
    paymentPlan: 'partial_prepayment',
    prepaymentAmount: 30,
    remainingBalanceTrigger: 'on_delivery'
  }, defaults);
  assert.equal(isOrderFulfillmentPaymentSatisfied(deliveryBalance, 100, 30, 'shipment'), true);
  assert.equal(isOrderFulfillmentPaymentSatisfied({ paymentPlan: 'ship_before_payment', prepaymentAmount: 0 }, 100, 0), true);

  const shipFirst = createOrderAgreementTerms({ paymentPlan: 'ship_before_payment' }, defaults);
  assert.equal(getOrderPaymentAmountDue(shipFirst, 0, 'confirmed'), 0);
  assert.equal(getOrderPaymentAmountDue(shipFirst, 0, 'delivered'), 100);
});

test('returns one role-specific task for an unconfirmed agreement', () => {
  const state = {
    status: 'placed',
    paymentStatus: 'unpaid',
    paymentMethod: 'bank_transfer',
    totalAmount: 100
  };
  assert.deepEqual(getOrderChainTask(state, 'buyer', 'pending_buyer'), {
    phase: 1,
    label: '约定确认中',
    task: '确认商家提出的交易约定',
    action: 'confirm_agreement'
  });
  assert.deepEqual(getOrderChainTask(state, 'merchant', 'pending_buyer'), {
    phase: 1,
    label: '约定确认中',
    task: '等待客户确认交易约定',
    action: null
  });
});

test('uses the agreement payment trigger for the single buyer task', () => {
  const order = {
    status: 'delivered',
    paymentStatus: 'unpaid',
    paymentMethod: 'bank_transfer',
    paymentPlan: 'partial_prepayment' as const,
    totalAmount: 100,
    paidAmount: 30,
    paymentAmountDue: 0
  };
  assert.deepEqual(getOrderChainTask(order, 'buyer', 'active'), {
    phase: 4,
    label: '已送达',
    task: '等待约定结款条件',
    action: null
  });
  assert.deepEqual(getOrderChainTask({ ...order, paymentAmountDue: 70 }, 'buyer', 'active'), {
    phase: 4,
    label: '已送达',
    task: '结清应付款',
    action: 'pay_balance'
  });
});

test('does not offer another payment while a payment is being verified', () => {
  assert.equal(getOrderChainTask({
    status: 'confirmed',
    paymentStatus: 'pending',
    paymentMethod: 'bank_transfer',
    totalAmount: 100,
    paidAmount: 0,
    paymentAmountDue: 100
  }, 'buyer', 'active').action, null);
});

  test('shows the merchant when fulfillment is blocked by an unmet payment threshold', () => {
    assert.equal(getOrderChainTask({
      status: 'confirmed',
      paymentStatus: 'unpaid',
      paymentMethod: 'bank_transfer',
      totalAmount: 100,
      paymentAmountDue: 30,
      canBeginPreparation: false
    }, 'merchant', 'active').task, '等待约定预付款到账');
    assert.equal(getOrderChainTask({
      status: 'picking',
      paymentStatus: 'partially_paid',
      paymentMethod: 'bank_transfer',
      totalAmount: 100,
      paidAmount: 30,
      paymentAmountDue: 70,
      canShipOrder: false
    }, 'merchant', 'active').task, '等待发货付款条件满足');
  });

  test('exposes custom balance trigger as a single merchant task until verified', () => {
    assert.deepEqual(getOrderChainTask({
      status: 'delivered',
      paymentStatus: 'partially_paid',
      paymentMethod: 'bank_transfer',
      paymentPlan: 'custom',
      remainingBalanceTrigger: 'custom',
      totalAmount: 100,
      paidAmount: 30,
      paymentAmountDue: 0
    }, 'merchant', 'active'), {
      phase: 4,
      label: '已送达',
      task: '核实并触发约定余款条件',
      action: 'trigger_balance'
    });
  });

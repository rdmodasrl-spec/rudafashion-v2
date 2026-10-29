import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMerchantAssistedOrderDraft } from '../src/shared/merchantAssistedOrderDraft';
import { getOrderChainTask } from '../src/shared/orderChain';

const emptyDraft = {
  customerId: null,
  items: [],
  shippingAddress: {
    street: '',
    city: '',
    country: '',
    zip: '',
    recipient: '',
    phone: ''
  },
  shippingFee: 0,
  additionalFees: 0,
  additionalFeesDescription: '',
  terms: {
    paymentPlan: 'full_prepayment',
    paymentMethod: 'bank_transfer',
    remainingBalanceTrigger: 'before_shipment',
    remainingBalanceDueAt: null,
    customPaymentCondition: null,
    supplyMode: 'partial_shipments',
    expectedDeliveryAt: null
  }
};

test('accepts an incomplete draft without creating an order commitment', () => {
  assert.deepEqual(parseMerchantAssistedOrderDraft(emptyDraft), emptyDraft);
});

test('normalizes valid draft amounts and delivery dates', () => {
  const parsed = parseMerchantAssistedOrderDraft({
    ...emptyDraft,
    items: [{ productId: 'product-1', sku: 'sku-1', quantity: 3 }],
    shippingFee: '10.126',
    terms: {
      ...emptyDraft.terms,
      expectedDeliveryAt: '2026-10-25T00:00:00.000Z',
      prepaymentPercent: 25
    }
  });

  assert.equal(parsed?.shippingFee, 10.13);
  assert.equal(parsed?.items[0]?.quantity, 3);
  assert.equal(parsed?.terms.expectedDeliveryAt, '2026-10-25T00:00:00.000Z');
  assert.equal(parsed?.terms.prepaymentPercent, 25);
});

test('rejects duplicate SKU lines and invalid values', () => {
  assert.equal(parseMerchantAssistedOrderDraft({
    ...emptyDraft,
    items: [
      { productId: 'product-1', sku: 'sku-1', quantity: 1 },
      { productId: 'product-1', sku: 'sku-1', quantity: 2 }
    ]
  }), null);
  assert.equal(parseMerchantAssistedOrderDraft({ ...emptyDraft, shippingFee: -1 }), null);
  assert.equal(parseMerchantAssistedOrderDraft({
    ...emptyDraft,
    terms: { ...emptyDraft.terms, expectedDeliveryAt: 'not-a-date' }
  }), null);
});

test('a saved draft has no buyer action and remains editable for its merchant', () => {
  const state = {
    status: 'draft',
    paymentStatus: 'unpaid',
    paymentMethod: 'bank_transfer',
    totalAmount: 0
  };

  assert.equal(getOrderChainTask(state, 'merchant').action, 'edit_draft');
  assert.equal(getOrderChainTask(state, 'buyer').action, null);
});

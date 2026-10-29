import assert from 'node:assert/strict';
import test from 'node:test';
import { allocateRefundAcrossPayments, calculatePayoutAllocation, canTransitionReturnStatus, canMerchantAcknowledgePayout, getRefundProgress, isOrderEligibleForPayout, validatePayoutStatusTransition } from '../src/server/merchantRefunds';

test('refund requests allocate only against remaining paid transaction amounts', () => {
  assert.deepEqual(
    allocateRefundAcrossPayments(40, [
      { paymentTransactionId: 'payment-a', refundableAmount: 25 },
      { paymentTransactionId: 'payment-b', refundableAmount: 20 }
    ]),
    [
      { paymentTransactionId: 'payment-a', amount: 25 },
      { paymentTransactionId: 'payment-b', amount: 15 }
    ]
  );
  assert.throws(
    () => allocateRefundAcrossPayments(46, [
      { paymentTransactionId: 'payment-a', refundableAmount: 25 },
      { paymentTransactionId: 'payment-b', refundableAmount: 20 }
    ]),
    /RETURN_REFUND_EXCEEDS_PAID_AMOUNT/
  );
  assert.throws(() => allocateRefundAcrossPayments(0, []), /REFUND_AMOUNT_INVALID/);
});

test('refund progress distinguishes pending, failed, partial and full refunds', () => {
  assert.deepEqual(getRefundProgress(100, 0, 1, 0), { paymentStatus: 'paid', refundStatus: 'processing' });
  assert.deepEqual(getRefundProgress(100, 25, 0, 0), { paymentStatus: 'partially_refunded', refundStatus: 'partially_refunded' });
  assert.deepEqual(getRefundProgress(100, 25, 1, 0), { paymentStatus: 'partially_refunded', refundStatus: 'processing' });
  assert.deepEqual(getRefundProgress(100, 100, 0, 0), { paymentStatus: 'refunded', refundStatus: 'completed' });
});

test('settlement only includes final refund states and reduces the order allocation', () => {
  assert.equal(isOrderEligibleForPayout('paid', 'none'), true);
  assert.equal(isOrderEligibleForPayout('partially_refunded', 'partially_refunded'), true);
  assert.equal(isOrderEligibleForPayout('pending_refund', 'approved'), false);
  assert.equal(isOrderEligibleForPayout('paid', 'failed'), false);
  assert.deepEqual(calculatePayoutAllocation(100, 25, 0.08), {
    platformFeeAmount: 8,
    processingFeeAmount: 2,
    netAmount: 65
  });
});

test('payout fees use integer cents and round half-up at the currency boundary', () => {
  assert.deepEqual(calculatePayoutAllocation(0.05, 0, 0.1), {
    platformFeeAmount: 0.01,
    processingFeeAmount: 0,
    netAmount: 0.04
  });
  assert.deepEqual(calculatePayoutAllocation(100.01, 25.01, 0.08), {
    platformFeeAmount: 8,
    processingFeeAmount: 2,
    netAmount: 65
  });
});

test('payout allocation rejects non-finite, negative, excessive amounts and invalid rates', () => {
  assert.throws(() => calculatePayoutAllocation(Number.NaN, 0, 0.08), /PAYOUT_FINANCIAL_INPUT_INVALID/);
  assert.throws(() => calculatePayoutAllocation(100, -1, 0.08), /PAYOUT_FINANCIAL_INPUT_INVALID/);
  assert.throws(() => calculatePayoutAllocation(1_000_000_000_000, 0, 0.08), /PAYOUT_FINANCIAL_INPUT_INVALID/);
  assert.throws(() => calculatePayoutAllocation(100, 0, 1.01), /PAYOUT_FINANCIAL_INPUT_INVALID/);
});

test('returns require approval and physical receipt before entering refund processing', () => {
  assert.equal(canTransitionReturnStatus('requested', 'approved'), true);
  assert.equal(canTransitionReturnStatus('requested', 'rejected'), true);
  assert.equal(canTransitionReturnStatus('approved', 'received'), true);
  assert.equal(canTransitionReturnStatus('requested', 'received'), false);
  assert.equal(canTransitionReturnStatus('received', 'refunded'), true);
  assert.equal(canTransitionReturnStatus('refunded', 'received'), false);
});

test('settlement transitions only allow auditable reaches to paid and reject missing evidence', () => {
  assert.deepEqual(validatePayoutStatusTransition('pending', 'processing', true), { ok: true, code: null });
  assert.deepEqual(validatePayoutStatusTransition('processing', 'paid', true, 'REF-100', 'https://example.com/receipt'), { ok: true, code: null });
  assert.deepEqual(validatePayoutStatusTransition('processing', 'paid', true, '', 'proof'), { ok: false, code: 'PAYOUT_SETTLEMENT_EVIDENCE_REQUIRED' });
  assert.deepEqual(validatePayoutStatusTransition('pending', 'paid', true, '', 'proof'), { ok: false, code: 'PAYOUT_STATUS_TRANSITION_INVALID' });
  assert.deepEqual(validatePayoutStatusTransition('paid', 'failed', true, 'REF-100', 'https://example.com/receipt'), { ok: false, code: 'PAYOUT_STATUS_TRANSITION_INVALID' });
  assert.deepEqual(validatePayoutStatusTransition('pending', 'processing', false), { ok: false, code: 'PAYOUT_MERCHANT_ACKNOWLEDGEMENT_REQUIRED' });
});

test('merchant acknowledgement is rejected for already settled payouts and only accepted while a payout is still active', () => {
  assert.equal(canMerchantAcknowledgePayout('pending', null), true);
  assert.equal(canMerchantAcknowledgePayout('processing', null), true);
  assert.equal(canMerchantAcknowledgePayout('failed', null), true);
  assert.equal(canMerchantAcknowledgePayout('paid', null), false);
  assert.equal(canMerchantAcknowledgePayout('paid', '2026-10-01T00:00:00.000Z'), false);
});

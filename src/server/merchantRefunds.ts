export type RefundPaymentBalance = {
  paymentTransactionId: string;
  refundableAmount: number;
};

export type RefundProgress = {
  paymentStatus: 'paid' | 'partially_refunded' | 'refunded';
  refundStatus: 'none' | 'processing' | 'failed' | 'partially_refunded' | 'completed';
};

export function canTransitionReturnStatus(current: string, next: string): boolean {
  if (current === 'requested') return next === 'approved' || next === 'rejected';
  if (current === 'approved') return next === 'received';
  if (current === 'received') return next === 'refunded';
  return false;
}

export function isOrderEligibleForPayout(paymentStatus: string, refundStatus: string): boolean {
  return ['paid', 'partially_refunded', 'refunded'].includes(paymentStatus)
    && ['none', 'partially_refunded', 'completed'].includes(refundStatus);
}

export function calculatePayoutAllocation(
  grossAmount: number,
  refundAmount: number,
  platformFeeRate: number,
  processingFeeRate = 0.02
): { platformFeeAmount: number; processingFeeAmount: number; netAmount: number } {
  const toCents = (amount: number) => {
    if (!Number.isFinite(amount) || amount < 0 || amount >= 1_000_000_000_000) {
      throw new Error('PAYOUT_FINANCIAL_INPUT_INVALID');
    }
    const [whole, fraction = '00'] = amount.toFixed(2).split('.');
    return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0').slice(0, 2));
  };
  const toBasisPoints = (rate: number) => {
    if (!Number.isFinite(rate) || rate < 0 || rate > 1) throw new Error('PAYOUT_FINANCIAL_INPUT_INVALID');
    return BigInt(Math.round(rate * 10_000));
  };
  const roundedFeeCents = (grossCents: bigint, rateBasisPoints: bigint) =>
    (grossCents * rateBasisPoints + 5_000n) / 10_000n;
  const grossCents = toCents(grossAmount);
  const refundCents = toCents(refundAmount);
  const platformFeeCents = roundedFeeCents(grossCents, toBasisPoints(platformFeeRate));
  const processingFeeCents = roundedFeeCents(grossCents, toBasisPoints(processingFeeRate));
  const netCents = [grossCents - refundCents - platformFeeCents - processingFeeCents, 0n].reduce((minimum, value) => value > minimum ? value : minimum);
  return {
    platformFeeAmount: Number(platformFeeCents) / 100,
    processingFeeAmount: Number(processingFeeCents) / 100,
    netAmount: Number(netCents) / 100
  };
}

export function allocateRefundAcrossPayments(
  requestedAmount: number,
  paymentBalances: RefundPaymentBalance[]
): Array<{ paymentTransactionId: string; amount: number }> {
  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) throw new Error('REFUND_AMOUNT_INVALID');
  let remainingCents = Math.round(requestedAmount * 100);
  const allocations: Array<{ paymentTransactionId: string; amount: number }> = [];
  for (const payment of paymentBalances) {
    const availableCents = Math.max(0, Math.floor(payment.refundableAmount * 100 + 1e-8));
    const amountCents = Math.min(remainingCents, availableCents);
    if (!amountCents) continue;
    allocations.push({ paymentTransactionId: payment.paymentTransactionId, amount: amountCents / 100 });
    remainingCents -= amountCents;
    if (remainingCents === 0) break;
  }
  if (remainingCents > 0) throw new Error('RETURN_REFUND_EXCEEDS_PAID_AMOUNT');
  return allocations;
}

export function getRefundProgress(
  paidAmount: number,
  successfulRefundAmount: number,
  pendingRefundCount: number,
  failedRefundCount: number
): RefundProgress {
  const fullyRefunded = paidAmount > 0 && successfulRefundAmount >= paidAmount;
  return {
    paymentStatus: fullyRefunded ? 'refunded' : successfulRefundAmount > 0 ? 'partially_refunded' : 'paid',
    refundStatus: pendingRefundCount > 0
      ? 'processing'
      : failedRefundCount > 0
        ? 'failed'
        : fullyRefunded
          ? 'completed'
          : successfulRefundAmount > 0
            ? 'partially_refunded'
            : 'none'
  };
}

export function validatePayoutStatusTransition(
  currentStatus: string,
  nextStatus: string,
  merchantAcknowledged: boolean,
  reference?: string,
  proof?: string
): { ok: boolean; code: string | null } {
  const allowedTransitions: Record<string, string[]> = {
    pending: ['processing', 'failed'],
    processing: ['paid', 'failed'],
    failed: ['processing'],
    paid: []
  };

  if (!allowedTransitions[currentStatus]?.includes(nextStatus)) {
    return { ok: false, code: 'PAYOUT_STATUS_TRANSITION_INVALID' };
  }

  if (nextStatus === 'processing' && !merchantAcknowledged) {
    return { ok: false, code: 'PAYOUT_MERCHANT_ACKNOWLEDGEMENT_REQUIRED' };
  }

  if (nextStatus === 'paid') {
    const referenceValue = typeof reference === 'string' ? reference.trim() : '';
    const proofValue = typeof proof === 'string' ? proof.trim() : '';
    const hasValidReference = referenceValue.length >= 2 && referenceValue.length <= 200 && !/[\u0000-\u001f\u007f]/.test(referenceValue);
    const hasValidProof = proofValue.length >= 5 && proofValue.length <= 2000;
    if (!hasValidReference || !hasValidProof) {
      return { ok: false, code: 'PAYOUT_SETTLEMENT_EVIDENCE_REQUIRED' };
    }
  }

  return { ok: true, code: null };
}

export function canMerchantAcknowledgePayout(currentStatus: string, acknowledgedAt: string | null | undefined): boolean {
  if (currentStatus === 'paid') return false;
  if (currentStatus === 'pending' || currentStatus === 'processing' || currentStatus === 'failed') {
    return !acknowledgedAt;
  }
  return false;
}

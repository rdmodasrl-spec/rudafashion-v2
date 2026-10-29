import type { OrderPaymentPlan } from '../shared/orderChain';

export type RemainingBalanceTrigger =
  | 'before_shipment'
  | 'on_delivery'
  | 'after_delivery'
  | 'date'
  | 'custom';

export interface OrderAgreementTerms {
  paymentPlan: OrderPaymentPlan;
  paymentMethod: string;
  prepaymentAmount: number;
  remainingBalanceTrigger: RemainingBalanceTrigger;
  remainingBalanceDueAt: string | null;
  customPaymentCondition: string | null;
  supplyMode: 'in_stock_first' | 'all_ready' | 'partial_shipments';
  expectedDeliveryAt: string | null;
  deliveryType: 'shipping' | 'showroom_pickup' | 'express_delivery';
  pickupLocation: string | null;
  shippingAddress: { street: string; city: string; country: string; zip: string; recipient?: string; phone?: string };
  items: Array<{ orderItemId: string; quantity: number; unitPrice: number }>;
  shippingFee: number;
  additionalFees: number;
  additionalFeesDescription: string | null;
  discountAmount: number;
  totalAmount: number;
  currency: 'EUR';
}

export interface OrderAgreementTermsInput {
  paymentPlan?: unknown;
  paymentMethod?: unknown;
  prepaymentAmount?: unknown;
  prepaymentPercent?: unknown;
  remainingBalanceTrigger?: unknown;
  remainingBalanceDueAt?: unknown;
  customPaymentCondition?: unknown;
  supplyMode?: unknown;
  expectedDeliveryAt?: unknown;
  deliveryType?: unknown;
  pickupLocation?: unknown;
  shippingAddress?: unknown;
  items?: unknown;
  shippingFee?: unknown;
  additionalFees?: unknown;
  additionalFeesDescription?: unknown;
  discountAmount?: unknown;
  totalAmount?: unknown;
}

const ALLOWED_PAYMENT_METHODS = [
  'bank_transfer',
  'bank_transfer_prepay',
  'credit_card',
  'stripe'
] as const;

const PAYMENT_PLANS: readonly OrderPaymentPlan[] = [
  'full_prepayment',
  'ship_before_payment',
  'partial_prepayment',
  'cash_on_delivery',
  'custom'
];

const REMAINING_BALANCE_TRIGGERS: readonly RemainingBalanceTrigger[] = [
  'before_shipment',
  'on_delivery',
  'after_delivery',
  'date',
  'custom'
];

function readAmount(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 100_000_000) {
    throw new Error('INVALID_ORDER_TERMS_AMOUNT');
  }
  return Number(amount.toFixed(2));
}

function readOptionalDate(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new Error('INVALID_ORDER_TERMS_DATE');
  }
  return new Date(value).toISOString();
}

function readPaymentPlan(value: unknown, paymentMethod: string): OrderPaymentPlan {
  if (value === undefined || value === null || value === '') {
    return paymentMethod === 'net_30' || paymentMethod === 'net_30_days'
      ? 'ship_before_payment'
      : 'full_prepayment';
  }
  if (typeof value !== 'string' || !PAYMENT_PLANS.includes(value as OrderPaymentPlan)) {
    throw new Error('INVALID_ORDER_PAYMENT_PLAN');
  }
  return value as OrderPaymentPlan;
}

function readRemainingBalanceTrigger(value: unknown): RemainingBalanceTrigger {
  if (value === undefined || value === null || value === '') return 'before_shipment';
  if (typeof value !== 'string' || !REMAINING_BALANCE_TRIGGERS.includes(value as RemainingBalanceTrigger)) {
    throw new Error('INVALID_REMAINING_BALANCE_TRIGGER');
  }
  return value as RemainingBalanceTrigger;
}

export function createOrderAgreementTerms(
  input: OrderAgreementTermsInput,
  defaults: {
    paymentMethod: string;
    totalAmount: number;
    shippingFee: number;
    additionalFees?: number;
    additionalFeesDescription?: string | null;
    discountAmount?: number;
    deliveryType?: string;
    pickupLocation?: string | null;
    shippingAddress?: { street?: string; city?: string; country?: string; zip?: string; recipient?: string; phone?: string };
    items?: Array<{ orderItemId: string; quantity: number; unitPrice: number }>;
  }
): OrderAgreementTerms {
  const totalAmount = readAmount(input.totalAmount, defaults.totalAmount);
  if (totalAmount <= 0) throw new Error('INVALID_ORDER_TERMS_AMOUNT');
  const shippingFee = readAmount(input.shippingFee, defaults.shippingFee);
  const additionalFees = readAmount(input.additionalFees, defaults.additionalFees || 0);
  const additionalFeesDescription = typeof input.additionalFeesDescription === 'string'
    ? input.additionalFeesDescription.trim().slice(0, 240) || null
    : defaults.additionalFeesDescription || null;
  const discountAmount = readAmount(input.discountAmount, defaults.discountAmount || 0);
  const paymentMethod = typeof input.paymentMethod === 'string' && input.paymentMethod.trim()
    ? input.paymentMethod.trim().slice(0, 40)
    : defaults.paymentMethod;
  if (!ALLOWED_PAYMENT_METHODS.includes(paymentMethod as typeof ALLOWED_PAYMENT_METHODS[number])) {
    throw new Error('INVALID_ORDER_PAYMENT_METHOD');
  }
  const paymentPlan = readPaymentPlan(input.paymentPlan, paymentMethod);
  const trigger = input.remainingBalanceTrigger === undefined || input.remainingBalanceTrigger === null || input.remainingBalanceTrigger === ''
    ? paymentPlan === 'ship_before_payment' || paymentPlan === 'cash_on_delivery'
      ? 'on_delivery'
      : paymentPlan === 'custom'
        ? 'custom'
        : 'before_shipment'
    : readRemainingBalanceTrigger(input.remainingBalanceTrigger);
  const rawPrepaymentAmount = input.prepaymentAmount === undefined || input.prepaymentAmount === null || input.prepaymentAmount === ''
    ? null
    : readAmount(input.prepaymentAmount, 0);
  const percentage = input.prepaymentPercent === undefined || input.prepaymentPercent === null || input.prepaymentPercent === ''
    ? null
    : Number(input.prepaymentPercent);

  let prepaymentAmount = 0;
  if (paymentPlan === 'full_prepayment') {
    prepaymentAmount = totalAmount;
  } else if (paymentPlan === 'partial_prepayment') {
    if ((rawPrepaymentAmount === null) === (percentage === null)) {
      throw new Error('PARTIAL_PREPAYMENT_VALUE_REQUIRED');
    }
    if (percentage !== null) {
      if (!Number.isFinite(percentage) || percentage <= 0 || percentage >= 100) {
        throw new Error('INVALID_PREPAYMENT_PERCENT');
      }
      prepaymentAmount = Number((totalAmount * percentage / 100).toFixed(2));
    } else {
      prepaymentAmount = rawPrepaymentAmount!;
    }
    if (prepaymentAmount <= 0 || prepaymentAmount >= totalAmount) {
      throw new Error('INVALID_PREPAYMENT_AMOUNT');
    }
  } else if (paymentPlan === 'custom' && rawPrepaymentAmount !== null) {
    if (rawPrepaymentAmount > totalAmount) throw new Error('INVALID_PREPAYMENT_AMOUNT');
    prepaymentAmount = rawPrepaymentAmount;
  }

  const customPaymentCondition = typeof input.customPaymentCondition === 'string'
    ? input.customPaymentCondition.trim().slice(0, 500) || null
    : null;
  if (paymentPlan === 'custom' && !customPaymentCondition) {
    throw new Error('CUSTOM_PAYMENT_CONDITION_REQUIRED');
  }
  const remainingBalanceDueAt = readOptionalDate(input.remainingBalanceDueAt);
  if (trigger === 'date' && !remainingBalanceDueAt) {
    throw new Error('REMAINING_BALANCE_DATE_REQUIRED');
  }
  if (trigger === 'custom' && !customPaymentCondition) {
    throw new Error('CUSTOM_PAYMENT_CONDITION_REQUIRED');
  }
  const supplyMode = input.supplyMode === undefined || input.supplyMode === null
    ? 'partial_shipments'
    : input.supplyMode;
  if (supplyMode !== 'in_stock_first' && supplyMode !== 'all_ready' && supplyMode !== 'partial_shipments') {
    throw new Error('INVALID_ORDER_SUPPLY_MODE');
  }
  const deliveryType = input.deliveryType === undefined || input.deliveryType === null
    ? defaults.deliveryType || 'shipping'
    : input.deliveryType;
  if (deliveryType !== 'shipping' && deliveryType !== 'showroom_pickup' && deliveryType !== 'express_delivery') {
    throw new Error('INVALID_ORDER_DELIVERY_TYPE');
  }
  const pickupLocation = typeof input.pickupLocation === 'string'
    ? input.pickupLocation.trim().slice(0, 160) || null
    : defaults.pickupLocation || null;
  const rawAddress = input.shippingAddress && typeof input.shippingAddress === 'object' && !Array.isArray(input.shippingAddress)
    ? input.shippingAddress as Record<string, unknown>
    : {};
  const fallbackAddress = defaults.shippingAddress || {};
  const shippingAddress = {
    street: typeof rawAddress.street === 'string' ? rawAddress.street.trim().slice(0, 240) : fallbackAddress.street || '',
    city: typeof rawAddress.city === 'string' ? rawAddress.city.trim().slice(0, 100) : fallbackAddress.city || '',
    country: typeof rawAddress.country === 'string' ? rawAddress.country.trim().slice(0, 100) : fallbackAddress.country || '',
    zip: typeof rawAddress.zip === 'string' ? rawAddress.zip.trim().slice(0, 30) : fallbackAddress.zip || '',
    recipient: typeof rawAddress.recipient === 'string' ? rawAddress.recipient.trim().slice(0, 120) : fallbackAddress.recipient || '',
    phone: typeof rawAddress.phone === 'string' ? rawAddress.phone.trim().slice(0, 60) : fallbackAddress.phone || ''
  };
  const sourceItems = input.items === undefined ? defaults.items || [] : input.items;
  if (!Array.isArray(sourceItems) || sourceItems.length === 0 || sourceItems.length > 500) {
    throw new Error('INVALID_ORDER_TERMS_ITEMS');
  }
  const seenItemIds = new Set<string>();
  const items = sourceItems.map(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_ORDER_TERMS_ITEMS');
    const item = value as Record<string, unknown>;
    const orderItemId = typeof item.orderItemId === 'string' ? item.orderItemId.trim() : '';
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    if (!orderItemId || seenItemIds.has(orderItemId)
      || !Number.isInteger(quantity) || quantity < 1 || quantity > 100_000
      || !Number.isFinite(unitPrice) || unitPrice <= 0 || unitPrice > 1_000_000) {
      throw new Error('INVALID_ORDER_TERMS_ITEMS');
    }
    seenItemIds.add(orderItemId);
    return { orderItemId, quantity, unitPrice: Number(unitPrice.toFixed(2)) };
  });

  return {
    paymentPlan,
    paymentMethod,
    prepaymentAmount,
    remainingBalanceTrigger: trigger,
    remainingBalanceDueAt,
    customPaymentCondition,
    supplyMode,
    expectedDeliveryAt: readOptionalDate(input.expectedDeliveryAt),
    deliveryType,
    pickupLocation,
    shippingAddress,
    items,
    shippingFee,
    additionalFees,
    additionalFeesDescription,
    discountAmount,
    totalAmount,
    currency: 'EUR'
  };
}

export function getOutstandingOrderAmount(totalAmount: number, paidAmount = 0): number {
  if (!Number.isFinite(totalAmount) || !Number.isFinite(paidAmount) || totalAmount < 0 || paidAmount < 0) {
    throw new Error('INVALID_ORDER_PAYMENT_TOTAL');
  }
  return Number(Math.max(0, totalAmount - paidAmount).toFixed(2));
}

export function isOrderFulfillmentPaymentSatisfied(
  terms: Pick<OrderAgreementTerms, 'paymentPlan' | 'prepaymentAmount'>
    & Partial<Pick<OrderAgreementTerms, 'remainingBalanceTrigger'>>,
  totalAmount: number,
  paidAmount = 0,
  stage: 'preparation' | 'shipment' = 'preparation'
): boolean {
  const remainingBalanceTrigger = terms.remainingBalanceTrigger || 'before_shipment';
  if (terms.paymentPlan === 'ship_before_payment' || terms.paymentPlan === 'cash_on_delivery') return true;
  if (terms.paymentPlan === 'partial_prepayment') {
    return paidAmount >= terms.prepaymentAmount
      && (stage !== 'shipment' || remainingBalanceTrigger !== 'before_shipment' || paidAmount >= totalAmount);
  }
  if (terms.paymentPlan === 'custom') {
    return paidAmount >= terms.prepaymentAmount
      && (stage !== 'shipment' || remainingBalanceTrigger !== 'before_shipment' || paidAmount >= totalAmount);
  }
  return paidAmount >= totalAmount;
}

export function getOrderPaymentAmountDue(
  terms: OrderAgreementTerms,
  paidAmount: number,
  orderStatus: string,
  now = new Date(),
  customConditionTriggered = false
): number {
  if (!Number.isFinite(paidAmount) || paidAmount < 0) throw new Error('INVALID_ORDER_PAYMENT_TOTAL');
  if (paidAmount < terms.prepaymentAmount) {
    return Number(Math.min(terms.prepaymentAmount - paidAmount, terms.totalAmount - paidAmount).toFixed(2));
  }
  const remaining = getOutstandingOrderAmount(terms.totalAmount, paidAmount);
  if (remaining <= 0) return 0;
  const triggerReached = terms.remainingBalanceTrigger === 'before_shipment'
    ? ['confirmed', 'picking', 'shipped', 'delivered'].includes(orderStatus)
    : terms.remainingBalanceTrigger === 'on_delivery' || terms.remainingBalanceTrigger === 'after_delivery'
      ? orderStatus === 'delivered'
      : terms.remainingBalanceTrigger === 'date'
        ? Boolean(terms.remainingBalanceDueAt && Date.parse(terms.remainingBalanceDueAt) <= now.getTime())
        : customConditionTriggered;
  return triggerReached ? remaining : 0;
}

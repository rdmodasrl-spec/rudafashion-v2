import type { MerchantAssistedOrderDraft } from '../types/b2b';

const paymentPlans = new Set(['full_prepayment', 'ship_before_payment', 'partial_prepayment', 'cash_on_delivery', 'custom']);
const balanceTriggers = new Set(['before_shipment', 'on_delivery', 'after_delivery', 'date', 'custom']);
const supplyModes = new Set(['in_stock_first', 'all_ready', 'partial_shipments']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string' || value.length > maxLength) return null;
  return value.trim();
}

function readOptionalDate(value: unknown): string | null | undefined {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return undefined;
  return new Date(value).toISOString();
}

function readAmount(value: unknown): number | null {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 && amount <= 1_000_000
    ? Number(amount.toFixed(2))
    : null;
}

export function parseMerchantAssistedOrderDraft(value: unknown): MerchantAssistedOrderDraft | null {
  if (!isRecord(value) || !isRecord(value.shippingAddress) || !isRecord(value.terms) || !Array.isArray(value.items)) {
    return null;
  }
  if (value.items.length > 100) return null;

  const customerId = value.customerId === null || value.customerId === ''
    ? null
    : readString(value.customerId, 120);
  if (customerId === null && value.customerId !== null && value.customerId !== '') return null;

  const items: MerchantAssistedOrderDraft['items'] = [];
  const itemKeys = new Set<string>();
  for (const rawItem of value.items) {
    if (!isRecord(rawItem)) return null;
    const productId = readString(rawItem.productId, 120);
    const sku = readString(rawItem.sku, 120);
    const quantity = Number(rawItem.quantity);
    if (!productId || !sku || !Number.isInteger(quantity) || quantity < 1 || quantity > 100_000) return null;
    const key = `${productId}:${sku}`;
    if (itemKeys.has(key)) return null;
    itemKeys.add(key);
    items.push({ productId, sku, quantity });
  }

  const address = value.shippingAddress;
  const street = readString(address.street, 240);
  const city = readString(address.city, 100);
  const country = readString(address.country, 100);
  const zip = readString(address.zip, 30);
  const recipient = readString(address.recipient, 120);
  const phone = readString(address.phone, 60);
  const shippingFee = readAmount(value.shippingFee);
  const additionalFees = readAmount(value.additionalFees);
  const additionalFeesDescription = readString(value.additionalFeesDescription, 240);
  const paymentPlan = value.terms.paymentPlan;
  const paymentMethod = readString(value.terms.paymentMethod, 80);
  const prepaymentAmount = value.terms.prepaymentAmount === undefined
    ? undefined
    : readAmount(value.terms.prepaymentAmount);
  const prepaymentPercent = value.terms.prepaymentPercent === undefined
    ? undefined
    : Number(value.terms.prepaymentPercent);
  const remainingBalanceTrigger = value.terms.remainingBalanceTrigger;
  const remainingBalanceDueAt = readOptionalDate(value.terms.remainingBalanceDueAt);
  const customPaymentCondition = value.terms.customPaymentCondition === null
    ? null
    : readString(value.terms.customPaymentCondition, 500);
  const supplyMode = value.terms.supplyMode;
  const expectedDeliveryAt = readOptionalDate(value.terms.expectedDeliveryAt);

  if (street === null || city === null || country === null || zip === null || recipient === null || phone === null
    || shippingFee === null || additionalFees === null || additionalFeesDescription === null
    || (additionalFees > 0 && !additionalFeesDescription)
    || typeof paymentPlan !== 'string' || !paymentPlans.has(paymentPlan)
    || !paymentMethod
    || (prepaymentAmount === null)
    || (prepaymentPercent !== undefined && (!Number.isFinite(prepaymentPercent) || prepaymentPercent < 0 || prepaymentPercent > 100))
    || typeof remainingBalanceTrigger !== 'string' || !balanceTriggers.has(remainingBalanceTrigger)
    || remainingBalanceDueAt === undefined
    || customPaymentCondition === null && value.terms.customPaymentCondition !== null
    || typeof supplyMode !== 'string' || !supplyModes.has(supplyMode)
    || expectedDeliveryAt === undefined) {
    return null;
  }

  return {
    customerId,
    items,
    shippingAddress: { street, city, country, zip, recipient, phone },
    shippingFee,
    additionalFees,
    additionalFeesDescription,
    terms: {
      paymentPlan: paymentPlan as MerchantAssistedOrderDraft['terms']['paymentPlan'],
      paymentMethod,
      ...(prepaymentAmount === undefined ? {} : { prepaymentAmount }),
      ...(prepaymentPercent === undefined ? {} : { prepaymentPercent }),
      remainingBalanceTrigger: remainingBalanceTrigger as MerchantAssistedOrderDraft['terms']['remainingBalanceTrigger'],
      remainingBalanceDueAt,
      customPaymentCondition,
      supplyMode: supplyMode as MerchantAssistedOrderDraft['terms']['supplyMode'],
      expectedDeliveryAt
    }
  };
}

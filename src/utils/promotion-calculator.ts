export type PromotionCalculationRule = {
  type: 'percent_discount' | 'fixed_amount' | 'buy_x_get_y' | 'free_shipping' | 'tiered_discount' | 'bundle_deal';
  scope: 'sitewide' | 'merchant' | 'category' | 'product' | 'consumer_tier';
  appliesOn: 'retail' | 'wholesale' | 'both';
  minSubtotal?: number | null;
  minQty?: number | null;
  percentOff?: number | null;
  fixedAmountOff?: number | null;
  buyQty?: number | null;
  getQty?: number | null;
  getPercentOff?: number | null;
  tiers?: Array<{ thresholdQty?: number; thresholdAmount?: number; percentOff: number }>;
  merchantIds?: string[];
  categoryIds?: string[];
  productIds?: string[];
  excludeSaleItems?: boolean;
};

export type PromotionCalculationItem = {
  productId: string;
  merchantId: string;
  categoryId: string;
  quantity: number;
  unitPrice: number;
  isSaleItem?: boolean;
};

export type PromotionCalculation = {
  discountAmount: number;
  shippingDiscount: number;
  itemDiscounts: number[];
  eligibleSubtotal: number;
  eligibleQuantity: number;
};

const toCents = (amount: number) => Math.max(0, Math.round(amount * 100));
const fromCents = (amount: number) => Number((amount / 100).toFixed(2));

const allocateCents = (totalCents: number, weights: number[]) => {
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  if (!totalCents || !weightTotal) return weights.map(() => 0);
  let remaining = totalCents;
  return weights.map((weight, index) => {
    const allocation = index === weights.length - 1
      ? remaining
      : Math.min(remaining, Math.floor(totalCents * weight / weightTotal));
    remaining -= allocation;
    return allocation;
  });
};

export const calculatePromotion = (
  rule: PromotionCalculationRule,
  items: PromotionCalculationItem[],
  shippingFee = 0
): PromotionCalculation => {
  const itemDiscountCents = items.map(() => 0);
  const eligibleIndexes = items.flatMap((item, index) => {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0) return [];
    if (rule.excludeSaleItems && item.isSaleItem) return [];
    const eligible = rule.scope === 'sitewide'
      || (rule.scope === 'merchant' && rule.merchantIds?.includes(item.merchantId))
      || (rule.scope === 'category' && rule.categoryIds?.includes(item.categoryId))
      || (rule.scope === 'product' && rule.productIds?.includes(item.productId));
    return eligible ? [index] : [];
  });
  const eligibleSubtotalCents = eligibleIndexes.reduce((sum, index) => (
    sum + toCents(items[index].unitPrice) * items[index].quantity
  ), 0);
  const eligibleQuantity = eligibleIndexes.reduce((sum, index) => sum + items[index].quantity, 0);
  const minSubtotalCents = rule.minSubtotal == null ? 0 : toCents(rule.minSubtotal);
  const minQty = rule.minQty ?? 0;
  let discountCents = 0;
  let shippingDiscountCents = 0;

  if (eligibleSubtotalCents < minSubtotalCents || eligibleQuantity < minQty || eligibleIndexes.length === 0) {
    return {
      discountAmount: 0,
      shippingDiscount: 0,
      itemDiscounts: itemDiscountCents,
      eligibleSubtotal: fromCents(eligibleSubtotalCents),
      eligibleQuantity
    };
  }

  if (rule.type === 'free_shipping') {
    shippingDiscountCents = Math.min(toCents(shippingFee), toCents(shippingFee));
  } else if (rule.type === 'percent_discount') {
    const percent = Math.max(0, Math.min(100, rule.percentOff ?? 0));
    discountCents = Math.round(eligibleSubtotalCents * percent / 100);
  } else if (rule.type === 'fixed_amount') {
    discountCents = Math.min(eligibleSubtotalCents, toCents(rule.fixedAmountOff ?? 0));
  } else if (rule.type === 'buy_x_get_y') {
    const buyQty = rule.buyQty ?? 0;
    const getQty = rule.getQty ?? 0;
    if (buyQty > 0 && getQty > 0) {
      const freeUnits = Math.floor(eligibleQuantity / (buyQty + getQty)) * getQty;
      let unitsToDiscount = freeUnits;
      const discountPercent = Math.max(0, Math.min(100, rule.getPercentOff ?? 100));
      const cheapestUnits = eligibleIndexes
        .flatMap(index => Array.from({ length: items[index].quantity }, () => ({ index, unitPriceCents: toCents(items[index].unitPrice) })))
        .sort((a, b) => a.unitPriceCents - b.unitPriceCents || a.index - b.index);
      for (const unit of cheapestUnits) {
        if (unitsToDiscount <= 0) break;
        const perUnit = Math.round(unit.unitPriceCents * discountPercent / 100);
        itemDiscountCents[unit.index] += perUnit;
        discountCents += perUnit;
        unitsToDiscount -= 1;
      }
    }
  } else if (rule.type === 'tiered_discount') {
    const matchedTier = (rule.tiers || [])
      .filter(tier => (
        (tier.thresholdQty == null || eligibleQuantity >= tier.thresholdQty)
        && (tier.thresholdAmount == null || eligibleSubtotalCents >= toCents(tier.thresholdAmount))
      ))
      .sort((a, b) => (b.thresholdAmount ?? 0) - (a.thresholdAmount ?? 0) || (b.thresholdQty ?? 0) - (a.thresholdQty ?? 0))[0];
    const percent = matchedTier?.percentOff ?? 0;
    if (percent > 0) discountCents = Math.round(eligibleSubtotalCents * Math.min(100, percent) / 100);
    else discountCents = Math.min(eligibleSubtotalCents, toCents(rule.fixedAmountOff ?? 0));
  } else if (rule.type === 'bundle_deal') {
    const percent = Math.max(0, Math.min(100, rule.percentOff ?? 0));
    discountCents = percent > 0
      ? Math.round(eligibleSubtotalCents * percent / 100)
      : Math.min(eligibleSubtotalCents, toCents(rule.fixedAmountOff ?? 0));
  }

  discountCents = Math.min(eligibleSubtotalCents, Math.max(0, discountCents));
  if (discountCents > 0 && !itemDiscountCents.some(Boolean)) {
    const allocations = allocateCents(
      discountCents,
      eligibleIndexes.map(index => toCents(items[index].unitPrice) * items[index].quantity)
    );
    eligibleIndexes.forEach((itemIndex, index) => { itemDiscountCents[itemIndex] = allocations[index]; });
  } else if (discountCents > 0 && itemDiscountCents.some(Boolean)) {
    const allocated = itemDiscountCents.reduce((sum, value) => sum + value, 0);
    if (allocated > discountCents) {
      const excess = allocated - discountCents;
      for (const index of eligibleIndexes) {
        const reduction = Math.min(itemDiscountCents[index], excess);
        itemDiscountCents[index] -= reduction;
        if (itemDiscountCents.reduce((sum, value) => sum + value, 0) === discountCents) break;
      }
    }
  }

  return {
    discountAmount: fromCents(discountCents),
    shippingDiscount: fromCents(shippingDiscountCents),
    itemDiscounts: itemDiscountCents.map(fromCents),
    eligibleSubtotal: fromCents(eligibleSubtotalCents),
    eligibleQuantity
  };
};

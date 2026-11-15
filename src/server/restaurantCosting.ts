import { Prisma } from '@prisma/client';

export type RestaurantRecipeCostInput = {
  yieldQuantity: string;
  items: Array<{
    ingredientId: string;
    ingredientCode: string;
    ingredientName: string;
    unit: string;
    quantity: string;
    wasteRate: string;
    receipts: Array<{
      quantity: string;
      unitCost: string;
      totalValue?: string;
      receiptCount?: number;
      currency: string;
      receivedAt: Date | string;
    }>;
  }>;
};

export function calculateRestaurantRecipeCost(input: RestaurantRecipeCostInput) {
  const currencies = new Set<string>();
  const latestSourceDates: Date[] = [];
  let totalCost = new Prisma.Decimal(0);
  let hasMissingCost = false;
  let hasCurrencyMismatch = false;
  const ingredients = input.items.map(item => {
    const receiptCurrencies = new Set(item.receipts.map(receipt => receipt.currency));
    if (receiptCurrencies.size > 1) hasCurrencyMismatch = true;
    const currency = receiptCurrencies.size === 1 ? item.receipts[0].currency : null;
    if (!item.receipts.length) hasMissingCost = true;
    if (currency) currencies.add(currency);

    let receivedQuantity = new Prisma.Decimal(0);
    let receivedValue = new Prisma.Decimal(0);
    let receiptCount = 0;
    for (const receipt of item.receipts) {
      const quantity = new Prisma.Decimal(receipt.quantity);
      receivedQuantity = receivedQuantity.plus(quantity);
      receivedValue = receivedValue.plus(
        receipt.totalValue === undefined
          ? quantity.mul(receipt.unitCost)
          : new Prisma.Decimal(receipt.totalValue)
      );
      receiptCount += receipt.receiptCount ?? 1;
      const receivedAt = receipt.receivedAt instanceof Date ? receipt.receivedAt : new Date(receipt.receivedAt);
      if (Number.isFinite(receivedAt.getTime())) latestSourceDates.push(receivedAt);
    }

    const averageUnitCost = receivedQuantity.isPositive() && currency
      ? receivedValue.div(receivedQuantity)
      : null;
    if (!averageUnitCost) hasMissingCost = true;
    const requiredQuantity = new Prisma.Decimal(item.quantity)
      .mul(new Prisma.Decimal(1).plus(item.wasteRate));
    const lineCost = averageUnitCost?.mul(requiredQuantity).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP) ?? null;
    if (lineCost) totalCost = totalCost.plus(lineCost);

    return {
      ingredientId: item.ingredientId,
      ingredientCode: item.ingredientCode,
      ingredientName: item.ingredientName,
      unit: item.unit,
      requiredQuantity: requiredQuantity.toFixed(4),
      averageUnitCost: averageUnitCost?.toFixed(6, Prisma.Decimal.ROUND_HALF_UP) ?? null,
      currency,
      receiptCount,
      lineCost: lineCost?.toFixed(4) ?? null
    };
  });

  if (currencies.size > 1) hasCurrencyMismatch = true;
  const status = hasCurrencyMismatch ? 'currency_mismatch' : hasMissingCost ? 'insufficient_data' : 'ready';
  const latestSourceAt = latestSourceDates.length
    ? new Date(Math.max(...latestSourceDates.map(date => date.getTime()))).toISOString()
    : null;
  const currency = currencies.size === 1 ? [...currencies][0] : null;
  const batchCost = status === 'ready' ? totalCost.toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP) : null;
  const costPerYield = batchCost
    ? batchCost.div(input.yieldQuantity).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP)
    : null;

  return {
    status,
    method: 'weighted_average_actual_receipts' as const,
    currency,
    totalBatchCost: batchCost?.toFixed(4) ?? null,
    costPerYield: costPerYield?.toFixed(4) ?? null,
    sourceItemCount: ingredients.reduce((count, item) => count + item.receiptCount, 0),
    latestSourceAt,
    ingredients
  };
}

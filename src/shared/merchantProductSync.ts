type MerchantOwnedProduct = {
  id: string;
  merchantId?: string;
};

export function mergePublicProductsPreservingMerchant<T extends MerchantOwnedProduct>(
  publicProducts: T[],
  existingProducts: T[],
  merchantId: string | null
): T[] {
  if (!merchantId) return publicProducts;

  const ownProducts = existingProducts.filter(product => product.merchantId === merchantId);
  const ownProductIds = new Set(ownProducts.map(product => product.id));
  return [...publicProducts.filter(product => !ownProductIds.has(product.id)), ...ownProducts];
}

export function replaceMerchantProducts<T extends MerchantOwnedProduct>(
  currentProducts: T[],
  merchantId: string,
  merchantProducts: T[]
): T[] {
  return [
    ...currentProducts.filter(product => product.merchantId !== merchantId),
    ...merchantProducts.filter(product => product.merchantId === merchantId)
  ];
}

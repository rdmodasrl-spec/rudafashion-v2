type MerchantReference = {
  id: string;
};

export function mergePublicMerchantsPreservingAuthenticated<T extends MerchantReference>(
  publicMerchants: T[],
  existingMerchants: T[],
  authenticatedMerchantId: string | null
): T[] {
  if (!authenticatedMerchantId) return publicMerchants;

  const authenticatedMerchant = existingMerchants.find(merchant => merchant.id === authenticatedMerchantId);
  if (!authenticatedMerchant) return publicMerchants;

  return [
    authenticatedMerchant,
    ...publicMerchants.filter(merchant => merchant.id !== authenticatedMerchantId)
  ];
}

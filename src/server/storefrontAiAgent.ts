export function canUseStorefrontAiAgent(
  isVerified: boolean,
  storefrontAiEnabled: boolean,
  platformAiEnabled: boolean
): boolean {
  return isVerified && storefrontAiEnabled && platformAiEnabled;
}

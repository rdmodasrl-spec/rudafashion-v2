export const merchantWorkspaceDraftKinds = ['content', 'growth'] as const;
export type MerchantWorkspaceDraftKind = (typeof merchantWorkspaceDraftKinds)[number];

export function isMerchantWorkspaceDraftKind(value: unknown): value is MerchantWorkspaceDraftKind {
  return typeof value === 'string' && merchantWorkspaceDraftKinds.some(kind => kind === value);
}

export function serializeMerchantWorkspaceDraft(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('MERCHANT_WORKSPACE_DRAFT_INVALID');
  }
  const serialized = JSON.stringify(value);
  if (new TextEncoder().encode(serialized).length > 1_000_000) {
    throw new Error('MERCHANT_WORKSPACE_DRAFT_TOO_LARGE');
  }
  return serialized;
}

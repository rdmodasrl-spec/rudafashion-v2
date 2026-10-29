import type { MerchantWorkspaceDraftKind } from './merchantWorkspaceDrafts';

export type RemoteMerchantWorkspaceDraft = {
  document: Record<string, unknown>;
  revision: number;
  updatedAt: string;
};

export async function fetchMerchantWorkspaceDrafts(): Promise<Partial<Record<MerchantWorkspaceDraftKind, RemoteMerchantWorkspaceDraft>>> {
  const response = await fetch('/api/merchant/workspace-drafts');
  const payload = await response.json().catch(() => null) as {
    success?: boolean;
    drafts?: Partial<Record<MerchantWorkspaceDraftKind, RemoteMerchantWorkspaceDraft>>;
    error?: string;
  } | null;
  if (!response.ok || !payload?.success || !payload.drafts) {
    throw new Error(payload?.error || `MERCHANT_WORKSPACE_DRAFTS_LOAD_FAILED_${response.status}`);
  }
  return payload.drafts;
}

export async function saveMerchantWorkspaceDraft(
  workspace: MerchantWorkspaceDraftKind,
  document: Record<string, unknown>,
  expectedRevision: number
): Promise<{ revision: number; updatedAt: string }> {
  const response = await fetch(`/api/merchant/workspace-drafts/${workspace}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document, expectedRevision })
  });
  const payload = await response.json().catch(() => null) as {
    success?: boolean;
    revision?: number;
    updatedAt?: string;
    error?: string;
  } | null;
  if (!response.ok || !payload?.success || !Number.isSafeInteger(payload.revision) || !payload.updatedAt) {
    const error = new Error(payload?.error || `MERCHANT_WORKSPACE_DRAFT_SAVE_FAILED_${response.status}`);
    Object.assign(error, { status: response.status });
    throw error;
  }
  return { revision: payload.revision!, updatedAt: payload.updatedAt };
}

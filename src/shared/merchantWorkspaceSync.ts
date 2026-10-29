type MerchantWithWorkspace = {
  id: string;
  workspace?: unknown;
  industryTemplate?: string | null;
  industryTemplateSource?: string | null;
  registrationProfile?: unknown;
};

function hasWorkspaceState(merchant: MerchantWithWorkspace): boolean {
  return Boolean(merchant.workspace || merchant.industryTemplate);
}

function mergeSessionFields<T extends MerchantWithWorkspace>(target: T, source: MerchantWithWorkspace): T {
  return {
    ...target,
    ...(source.workspace ? { workspace: source.workspace } : {}),
    ...(source.industryTemplate ? { industryTemplate: source.industryTemplate } : {}),
    ...(source.industryTemplateSource ? { industryTemplateSource: source.industryTemplateSource } : {}),
    ...(source.registrationProfile ? { registrationProfile: source.registrationProfile } : {})
  };
}

/**
 * 公开商家列表（`/api/merchants`）不返回工作区快照，登录会话的 `workspace` 只来自
 * `/api/auth/me/merchant`。公开目录刷新不得覆盖已经取得的工作区快照，否则行业后台会
 * 回退到服装门户；会话商家不在公开列表时也必须保留。
 *
 * 这里不依赖“当前会话商家 ID”参数：目录请求与会话请求存在竞态，按商家 ID 保留
 * 已存在的 workspace 才能保证任何返回顺序下都不丢工作区。
 */
export function mergePublicMerchantsPreservingWorkspace<T extends MerchantWithWorkspace>(
  publicMerchants: T[],
  existingMerchants: T[]
): T[] {
  const knownById = new Map(
    existingMerchants.filter(hasWorkspaceState).map(merchant => [merchant.id, merchant])
  );
  const publicIds = new Set(publicMerchants.map(merchant => merchant.id));
  const merged = publicMerchants.map(merchant => {
    const known = knownById.get(merchant.id);
    if (!known) return merchant;
    return mergeSessionFields(merchant, known);
  });
  const sessionOnly = existingMerchants.filter(merchant => (
    hasWorkspaceState(merchant) && !publicIds.has(merchant.id)
  ));
  return sessionOnly.length ? [...merged, ...sessionOnly] : merged;
}

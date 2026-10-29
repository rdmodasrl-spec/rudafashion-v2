export class MiniProgramIdentityBindingError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number
  ) {
    super(code);
    this.name = 'MiniProgramIdentityBindingError';
  }
}

export interface MiniProgramBuyerAccount {
  id: string;
  role: string;
  customerId: string | null;
}

interface IdentityRecord {
  authAccountId: string;
  openId: string;
}

export interface MiniProgramIdentityRepository {
  findByIdentity(appId: string, openId: string): Promise<IdentityRecord | null>;
  findByAccount(appId: string, authAccountId: string): Promise<IdentityRecord | null>;
  create(identity: { appId: string; openId: string; authAccountId: string }): Promise<void>;
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null
    && 'code' in error && error.code === 'P2002';
}

export async function bindMiniProgramIdentity(
  identity: { appId: string; openId: string },
  account: MiniProgramBuyerAccount,
  repository: MiniProgramIdentityRepository
): Promise<{ alreadyBound: boolean }> {
  if (account.role !== 'buyer' || !account.customerId) {
    throw new MiniProgramIdentityBindingError('BUYER_ACCOUNT_REQUIRED', 403);
  }

  const currentAccountIdentity = await repository.findByAccount(identity.appId, account.id);
  if (currentAccountIdentity) {
    if (currentAccountIdentity.openId === identity.openId) return { alreadyBound: true };
    throw new MiniProgramIdentityBindingError('BUYER_ACCOUNT_ALREADY_HAS_WECHAT_IDENTITY', 409);
  }

  const currentWechatOwner = await repository.findByIdentity(identity.appId, identity.openId);
  if (currentWechatOwner) {
    if (currentWechatOwner.authAccountId === account.id) return { alreadyBound: true };
    throw new MiniProgramIdentityBindingError('WECHAT_IDENTITY_ALREADY_BOUND', 409);
  }

  try {
    await repository.create({
      ...identity,
      authAccountId: account.id
    });
    return { alreadyBound: false };
  } catch (error) {
    if (!isUniqueConstraintViolation(error)) throw error;

    const [wechatOwner, accountIdentity] = await Promise.all([
      repository.findByIdentity(identity.appId, identity.openId),
      repository.findByAccount(identity.appId, account.id)
    ]);
    if (wechatOwner?.authAccountId === account.id || accountIdentity?.openId === identity.openId) {
      return { alreadyBound: true };
    }
    if (wechatOwner) {
      throw new MiniProgramIdentityBindingError('WECHAT_IDENTITY_ALREADY_BOUND', 409);
    }
    if (accountIdentity) {
      throw new MiniProgramIdentityBindingError('BUYER_ACCOUNT_ALREADY_HAS_WECHAT_IDENTITY', 409);
    }
    throw new MiniProgramIdentityBindingError('WECHAT_BINDING_CONFLICT', 409);
  }
}

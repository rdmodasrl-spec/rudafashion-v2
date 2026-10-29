export type IdentityLinkAccount = {
  identityId: string | null;
  passwordHash: string;
  emailVerifiedAt: Date | null;
  phone: string | null;
  phoneVerifiedAt: Date | null;
};

export type IdentityLinkRecord = {
  id: string;
  passwordHash: string;
  phone: string | null;
  phoneVerifiedAt: Date | null;
};

export type IdentityLinkDecision =
  | { eligible: true; passwordHash: string; phone: string | null; phoneVerifiedAt: Date | null }
  | { eligible: false };

export async function evaluateVerifiedAccountLink(
  accounts: readonly IdentityLinkAccount[],
  identity: IdentityLinkRecord | null,
  password: string,
  comparePassword: (password: string, passwordHash: string) => Promise<boolean>
): Promise<IdentityLinkDecision> {
  if (accounts.length === 0 || accounts.some(account => !account.emailVerifiedAt)) {
    return { eligible: false };
  }
  if (accounts.some(account => account.phoneVerifiedAt && !account.phone)) {
    return { eligible: false };
  }

  const verifiedPhones = [...new Set(
    accounts
      .filter(account => account.phoneVerifiedAt)
      .map(account => account.phone?.trim())
      .filter((phone): phone is string => Boolean(phone))
  )];
  if (
    verifiedPhones.length > 1
    || (identity?.phone && !identity.phoneVerifiedAt)
    || (identity?.phoneVerifiedAt && !identity.phone)
  ) {
    return { eligible: false };
  }
  const identityPhone = identity?.phone?.trim() || null;
  const accountPhone = verifiedPhones[0] || null;
  if (identityPhone && accountPhone && identityPhone !== accountPhone) {
    return { eligible: false };
  }

  const identityIds = [...new Set(accounts.map(account => account.identityId).filter((id): id is string => Boolean(id)))];
  if (identityIds.length > 1 || (identityIds.length === 1 && identityIds[0] !== identity?.id)) {
    return { eligible: false };
  }

  if (identity && !(await comparePassword(password, identity.passwordHash))) {
    return { eligible: false };
  }
  for (const account of accounts) {
    if (!account.identityId && !(await comparePassword(password, account.passwordHash))) {
      return { eligible: false };
    }
  }

  return {
    eligible: true,
    passwordHash: identity?.passwordHash || accounts[0].passwordHash,
    phone: identityPhone || accountPhone,
    phoneVerifiedAt: identityPhone || accountPhone
      ? identity?.phoneVerifiedAt || accounts.find(account => account.phoneVerifiedAt)?.phoneVerifiedAt || null
      : null
  };
}

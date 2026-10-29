import crypto from 'node:crypto';

export const PUBLIC_DEMO_MERCHANT_MARKER = 'RUDA_PUBLIC_DEMO_SEED_V1';
export const MINI_PROGRAM_DEMO_ACCOUNTS = {
  merchant: { email: 'merchant.demo@ruda.test', label: '商家' },
  employee: { email: 'employee.demo@ruda.test', label: '员工' },
  partner: { email: 'agent.demo@ruda.test', label: '代理' }
} as const;

export function getMiniProgramDemoCredentials(
  enabled: boolean,
  password: string,
  merchant: DemoMerchantIdentity | null | undefined
) {
  if (!enabled || password.length < 10 || !merchant || !isIsolatedMiniProgramDemoMerchant(merchant)) {
    return { enabled: false as const };
  }

  return {
    enabled: true as const,
    password,
    partnerUrl: 'https://modaui.com/partner',
    accounts: [
      { type: 'merchant' as const, ...MINI_PROGRAM_DEMO_ACCOUNTS.merchant },
      { type: 'employee' as const, ...MINI_PROGRAM_DEMO_ACCOUNTS.employee },
      { type: 'partner' as const, ...MINI_PROGRAM_DEMO_ACCOUNTS.partner }
    ]
  };
}

export function getMiniProgramDemoAccountIds(merchantId: string) {
  const merchantKey = crypto.createHash('sha256').update(merchantId).digest('hex').slice(0, 8).toUpperCase();
  return {
    merchantAccountId: `ruda-mini-demo-owner-${merchantKey}`,
    partnerId: `ruda-mini-demo-partner-${merchantKey}`,
    partnerAccountId: `ruda-mini-demo-partner-account-${merchantKey}`,
    partnerCode: `AGDEMO${merchantKey}`
  };
}

type DemoMerchantIdentity = {
  id: string;
  code: string;
  storeSlug: string;
  industrySource: string;
  settings: string;
  storefrontSeoTitle: string;
};

export function isIsolatedMiniProgramDemoMerchant(merchant: DemoMerchantIdentity): boolean {
  const match = /^ruda-demo-merchant-(\d+)$/.exec(merchant.id);
  if (!match
    || merchant.code !== `RUDA-DEMO-${match[1]}`
    || merchant.storeSlug !== `ruda-demo-${match[1]}`
    || merchant.industrySource !== 'ADMIN'
    || !merchant.storefrontSeoTitle.startsWith('RUDA DEMO')) {
    return false;
  }

  try {
    const settings = JSON.parse(merchant.settings) as { rudaDemoSeed?: unknown };
    return settings.rudaDemoSeed === PUBLIC_DEMO_MERCHANT_MARKER;
  } catch {
    return false;
  }
}

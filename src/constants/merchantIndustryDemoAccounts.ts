import type { MerchantIndustryTemplateId } from './merchantIndustryTemplates';

export const merchantIndustryDemoAccounts = [
  { code: '001', templateId: 'apparel_production_wholesale', merchantId: 'demo-industry-apparel-production' },
  { code: '002', templateId: 'apparel_wholesale', merchantId: 'demo-industry-apparel-wholesale' },
  { code: '003', templateId: 'trading_wholesale', merchantId: 'demo-industry-trading-wholesale' },
  { code: '004', templateId: 'department_wholesale', merchantId: 'demo-industry-department-wholesale' },
  { code: '005', templateId: 'bags_wholesale', merchantId: 'demo-industry-bags-wholesale' },
  { code: '006', templateId: 'department_chain_retail', merchantId: 'demo-industry-department-chain-retail' },
  { code: '007', templateId: 'general_retail', merchantId: 'demo-industry-general-retail' }
] as const satisfies readonly {
  code: string;
  templateId: MerchantIndustryTemplateId;
  merchantId: string;
}[];

export function getMerchantIndustryDemoAccountByCode(code: unknown) {
  if (typeof code !== 'string') return null;
  return merchantIndustryDemoAccounts.find(account => account.code === code) || null;
}

export function getMerchantIndustryDemoAccountByTemplate(templateId: string) {
  return merchantIndustryDemoAccounts.find(account => account.templateId === templateId) || null;
}

export function getMerchantIndustryDemoEmail(templateId: string): string | null {
  const account = getMerchantIndustryDemoAccountByTemplate(templateId);
  return account ? `${account.code}@ruda.fashion` : null;
}

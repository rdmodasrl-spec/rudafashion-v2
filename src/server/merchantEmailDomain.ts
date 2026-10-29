import { domainToASCII } from 'node:url';

export function normalizeMerchantEmailDomain(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const input = value.trim().replace(/\.$/, '').toLowerCase();
  if (!input || input.length > 253 || input.includes('://') || input.includes('/') || input.includes('@')) return null;
  const domain = domainToASCII(input).toLowerCase();
  if (!domain || domain.length > 253 || !domain.includes('.')) return null;
  const labels = domain.split('.');
  if (labels.some(label => !label || label.length > 63
    || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))) return null;
  return domain;
}

export function merchantEmailDomainVerificationHost(domainName: string): string {
  return `_ruda-verification.${domainName}`;
}

export function hasMerchantEmailDomainVerificationRecord(records: string[][], expectedToken: string): boolean {
  return records.some(record => record.join('').trim() === expectedToken);
}

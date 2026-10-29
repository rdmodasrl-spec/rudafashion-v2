import type { MerchantWorkspaceSnapshot } from '../constants/merchantIndustryTemplates';

export const merchantOnboardingStatuses = [
  'draft',
  'pending_review',
  'additional_info_needed',
  'approved',
  'rejected',
  'suspended',
  'closed'
] as const;

export type MerchantOnboardingStatus = typeof merchantOnboardingStatuses[number];

export type MerchantOnboardingReviewDecision =
  | 'pending_review'
  | 'additional_info_needed'
  | 'approved'
  | 'rejected'
  | 'suspended'
  | 'closed';

const statusAliases: Record<string, MerchantOnboardingStatus> = {
  submitted: 'pending_review',
  reviewing: 'pending_review'
};

export const merchantOnboardingTransitions: Record<MerchantOnboardingStatus, readonly MerchantOnboardingStatus[]> = {
  draft: ['pending_review', 'closed'],
  pending_review: ['additional_info_needed', 'approved', 'rejected', 'closed'],
  additional_info_needed: ['pending_review', 'rejected', 'closed'],
  approved: ['suspended', 'closed'],
  rejected: ['pending_review', 'closed'],
  suspended: ['approved', 'closed'],
  closed: []
};

export function normalizeMerchantOnboardingStatus(value: unknown): MerchantOnboardingStatus | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (statusAliases[normalized]) return statusAliases[normalized];
  return (merchantOnboardingStatuses as readonly string[]).includes(normalized)
    ? normalized as MerchantOnboardingStatus
    : null;
}

export function canTransitionMerchantOnboardingStatus(current: unknown, next: unknown): boolean {
  const from = normalizeMerchantOnboardingStatus(current);
  const to = normalizeMerchantOnboardingStatus(next);
  if (!from || !to) return false;
  return from === to || merchantOnboardingTransitions[from].includes(to);
}

export function resolveMerchantOnboardingReviewStatus(decision: unknown): MerchantOnboardingReviewDecision | null {
  const status = normalizeMerchantOnboardingStatus(decision);
  if (!status || status === 'draft') return null;
  return status;
}

function parseJsonRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

export type SerializedMerchantOnboardingApplication = {
  id: string;
  applicationNo: string;
  accountIdentityId: string | null;
  companyId: string | null;
  companyLegalName: string;
  tradingName: string | null;
  vatNumber: string;
  taxCode: string | null;
  country: string;
  city: string;
  address: string;
  zip: string | null;
  contactPerson: string;
  contactPosition: string | null;
  phone: string;
  email: string;
  whatsapp: string | null;
  wechat: string | null;
  websiteOrSocial: string | null;
  businessType: string;
  merchantZone: string;
  specialties: string[];
  categories: string[];
  yearsInBusiness: number | null;
  annualRevenueRange: string | null;
  showroomAddress: string | null;
  bankName: string | null;
  ibanLast4: string | null;
  description: string | null;
  documents: Record<string, unknown> | null;
  industryTemplate: string | null;
  industryTemplateSource: string;
  registrationProfile: Record<string, unknown> | null;
  submittedByAuthAccountId: string | null;
  status: MerchantOnboardingStatus;
  adminReviewNotes: string | null;
  reviewedByAdminId: string | null;
  reviewedAt: string | null;
  approvedMerchantId: string | null;
  createdAt: string;
  updatedAt: string;
  workspace?: MerchantWorkspaceSnapshot | null;
};

export function serializeMerchantOnboardingApplication(
  row: Record<string, any>,
  workspace?: MerchantWorkspaceSnapshot | null
): SerializedMerchantOnboardingApplication {
  return {
    id: String(row.id),
    applicationNo: String(row.applicationNo),
    accountIdentityId: row.accountIdentityId ?? null,
    companyId: row.companyId ?? null,
    companyLegalName: String(row.companyLegalName || ''),
    tradingName: row.tradingName ?? null,
    vatNumber: String(row.vatNumber || ''),
    taxCode: row.taxCode ?? null,
    country: String(row.country || ''),
    city: String(row.city || ''),
    address: String(row.address || ''),
    zip: row.zip ?? null,
    contactPerson: String(row.contactPerson || ''),
    contactPosition: row.contactPosition ?? null,
    phone: String(row.phone || ''),
    email: String(row.email || ''),
    whatsapp: row.whatsapp ?? null,
    wechat: row.wechat ?? null,
    websiteOrSocial: row.websiteOrSocial ?? null,
    businessType: String(row.businessType || ''),
    merchantZone: String(row.merchantZone || ''),
    specialties: Array.isArray(row.specialties) ? row.specialties : [],
    categories: Array.isArray(row.categories) ? row.categories : [],
    yearsInBusiness: row.yearsInBusiness ?? null,
    annualRevenueRange: row.annualRevenueRange ?? null,
    showroomAddress: row.showroomAddress ?? null,
    bankName: row.bankName ?? null,
    ibanLast4: row.ibanLast4 ?? null,
    description: row.description ?? null,
    documents: parseJsonRecord(row.documentsJson),
    industryTemplate: row.industryTemplate ?? null,
    industryTemplateSource: String(row.industryTemplateSource || 'SELF_SELECTED'),
    registrationProfile: parseJsonRecord(row.registrationProfile),
    submittedByAuthAccountId: row.submittedByAuthAccountId ?? null,
    status: normalizeMerchantOnboardingStatus(row.status) || 'pending_review',
    adminReviewNotes: row.adminReviewNotes ?? null,
    reviewedByAdminId: row.reviewedByAdminId ?? null,
    reviewedAt: row.reviewedAt instanceof Date ? row.reviewedAt.toISOString() : row.reviewedAt ?? null,
    approvedMerchantId: row.approvedMerchantId ?? null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt || ''),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt || ''),
    ...(workspace !== undefined ? { workspace } : {})
  };
}

import type { GrowthMarket } from '../../../../shared/growthChannels';

export type GrowthFunnel = {
  registrations: number;
  pageViewToRegistrationRate: number;
  registrationToMerchantRate: number;
  merchantProductRate: number;
  merchantPaidOrderRate: number;
};

export type GrowthOverview = {
  periodDays: number;
  periodStart: string;
  periodEnd: string;
  asOf: string;
  metrics: {
    pageViews: number;
    aiOpens: number;
    aiQuestions: number;
    merchantApplicationViews: number;
    buyerRegistrationViews: number;
    inquiries: number;
    customers: number;
    consumers: number;
    merchants: number;
    orders: number;
    paidOrders: number;
    repeatPaidOrders: number;
    retainedConsumers: number;
    referralClicks: number;
    referralRegistrations: number;
    unknownRegistrations: number;
    referralFirstPaid: number;
    merchantsWithProducts: number;
    merchantsWithPaidOrders: number;
    merchantsWithFirstPaidOrder: number;
  };
  metricDefinitions: Record<keyof GrowthOverview['metrics'], {
    source: string;
    unit: 'events' | 'records' | 'merchants';
    definition: string;
  }>;
  funnel: GrowthFunnel;
  daily: Array<{
    day: string;
    pageViews: number;
    aiQuestions: number;
    inquiries: number;
    referralClicks: number;
    referralRegistrations: number;
    unknownRegistrations: number;
    referralFirstPaid: number;
  }>;
  campaigns: Array<{ source: string; medium: string; campaign: string; events: number }>;
  channelEvents: Array<{ source: string; event: string; events: number }>;
  recentCustomers: Array<{ id: string; companyName: string; contactPerson: string; status: string; createdAt: string }>;
  recentMerchants: Array<{ id: string; name: string; city: string | null; country: string | null; createdAt: string }>;
  referralAttribution: {
    status: 'available' | 'migration_required';
    clicks: number;
    registrations: number;
    unknownRegistrations: number;
    firstPaid: number;
  };
  notifications: Record<'email' | 'sms' | 'whatsapp', { enabled: boolean; configured: boolean }>;
};

export const growthProspectStatuses = ['new', 'contacted', 'negotiating', 'registered', 'onboarded', 'paused'] as const;
export type GrowthProspectStatus = (typeof growthProspectStatuses)[number];

export const growthProspectStatusLabels: Record<GrowthProspectStatus, string> = {
  new: '待联系',
  contacted: '已联系',
  negotiating: '洽谈中',
  registered: '已注册',
  onboarded: '已入驻',
  paused: '暂不跟进'
};

export const growthProspectBusinessTypes = ['wholesaler', 'brand', 'trading', 'other'] as const;
export type GrowthProspectBusinessType = (typeof growthProspectBusinessTypes)[number];

export const growthProspectBusinessTypeLabels: Record<GrowthProspectBusinessType, string> = {
  wholesaler: '服装批发商',
  brand: '品牌商',
  trading: '贸易公司',
  other: '其他'
};

export type GrowthProspect = {
  id: string;
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  country: string | null;
  city: string | null;
  businessType: GrowthProspectBusinessType;
  source: 'manual' | 'import' | 'ai_research';
  sourceUrl: string | null;
  sourceNote: string | null;
  status: GrowthProspectStatus;
  customerId: string | null;
  merchantId: string | null;
  nextFollowUpAt: string | null;
  lastContactAt: string | null;
  followUpCount: number;
  createdAt: string;
  updatedAt: string;
};

export type GrowthProspectListResponse = {
  generatedAt: string;
  counts: {
    all: number;
    byStatus: Partial<Record<GrowthProspectStatus, number>>;
    dueToday: number;
    overdue: number;
  };
  prospects: GrowthProspect[];
};

export type GrowthFollowUp = {
  id: string;
  category: string;
  note: string;
  dueAt: string;
  status: string;
  createdBy: string;
  completedAt: string | null;
  closedBy: string | null;
  resolutionNote: string | null;
  createdAt: string;
};

export type GrowthProspectDetailResponse = {
  prospect: GrowthProspect & { dedupeKey: string };
  followUps: GrowthFollowUp[];
};

export const growthCopyChannels = [
  'instagram', 'facebook', 'tiktok', 'google_ads', 'whatsapp', 'email', 'xiaohongshu', 'douyin'
] as const;
export type GrowthCopyChannel = (typeof growthCopyChannels)[number];

export const growthCopyChannelLabels: Record<GrowthCopyChannel, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  google_ads: 'Google Ads',
  whatsapp: 'WhatsApp',
  email: '邮件',
  xiaohongshu: '小红书',
  douyin: '抖音'
};

export type GrowthCopyLanguage = 'it' | 'en' | 'zh';
export type GrowthCopyDraft = {
  version: 1;
  source: 'ai_draft';
  reviewRequired: true;
  executionEnabled: false;
  generatedAt: string;
  variants: Array<{ label: string; copy: string }>;
};

export type MarketingChannel = 'instagram' | 'facebook' | 'tiktok' | 'google_ads' | 'whatsapp';
export type MarketingCampaign = {
  id: string;
  name: string;
  objective: string;
  channels: MarketingChannel[];
  landingPath: string;
  copies: Partial<Record<MarketingChannel, string>>;
  status: 'draft' | 'approved';
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
};

export type GrowthAnalysis = {
  version: 1;
  source: 'ai_draft';
  reviewRequired: true;
  generatedAt: string;
  periodDays: 7 | 30 | 90;
  insights: Array<{ title: string; finding: string; action: string }>;
};

export type GrowthMarkets = GrowthMarket;

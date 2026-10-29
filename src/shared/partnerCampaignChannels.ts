export const partnerCampaignChannelOptions = [
  { value: 'wechat_official', label: '微信公众号' },
  { value: 'wechat_work', label: '企业微信' },
  { value: 'wechat_channels', label: '微信视频号' },
  { value: 'douyin', label: '抖音' },
  { value: 'xiaohongshu', label: '小红书' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'google_analytics', label: 'Google Analytics' },
  { value: 'google_search_console', label: 'Search Console / SEO' },
  { value: 'meta_ads', label: 'Meta Ads' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'email', label: 'Email' },
  { value: 'seo', label: 'SEO' },
  { value: 'offline', label: '线下推广' },
  { value: 'website', label: '官网' },
  { value: 'other', label: '其他' }
] as const;

export type PartnerCampaignChannel = (typeof partnerCampaignChannelOptions)[number]['value'];

export function isPartnerCampaignChannel(value: unknown): value is PartnerCampaignChannel {
  return typeof value === 'string' && partnerCampaignChannelOptions.some(option => option.value === value);
}

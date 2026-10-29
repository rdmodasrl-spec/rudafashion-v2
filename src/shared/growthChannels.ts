export type GrowthMarket = 'china' | 'europe' | 'mexico';
export type GrowthChannelStatus = 'connected' | 'configured' | 'not_connected' | 'not_implemented' | 'future';

export type GrowthChannel = {
  id: string;
  name: string;
  markets: GrowthMarket[];
  capability: 'publishing' | 'advertising' | 'messaging' | 'search' | 'community' | 'partner';
  phase: 'p0' | 'future';
  connector: 'meta_facebook' | 'meta_instagram' | null;
};

export type GrowthChannelConnection = GrowthChannel & {
  status: GrowthChannelStatus;
  connectedAssets: number;
};

export const growthChannels: GrowthChannel[] = [
  { id: 'google', name: 'Google Search', markets: ['europe', 'mexico'], capability: 'search', phase: 'p0', connector: null },
  { id: 'google_ads', name: 'Google Ads', markets: ['europe', 'mexico'], capability: 'advertising', phase: 'p0', connector: null },
  { id: 'facebook', name: 'Facebook', markets: ['europe', 'mexico'], capability: 'publishing', phase: 'p0', connector: 'meta_facebook' },
  { id: 'instagram', name: 'Instagram', markets: ['europe', 'mexico'], capability: 'publishing', phase: 'p0', connector: 'meta_instagram' },
  { id: 'tiktok', name: 'TikTok', markets: ['europe', 'mexico'], capability: 'publishing', phase: 'p0', connector: null },
  { id: 'youtube', name: 'YouTube', markets: ['europe', 'mexico'], capability: 'publishing', phase: 'p0', connector: null },
  { id: 'whatsapp', name: 'WhatsApp Business', markets: ['europe', 'mexico'], capability: 'messaging', phase: 'p0', connector: null },
  { id: 'email', name: 'Email marketing', markets: ['europe', 'mexico'], capability: 'messaging', phase: 'p0', connector: null },
  { id: 'seo', name: 'SEO', markets: ['europe', 'mexico'], capability: 'search', phase: 'p0', connector: null },
  { id: 'wechat_official', name: '微信公众号', markets: ['china', 'europe'], capability: 'publishing', phase: 'p0', connector: null },
  { id: 'wechat_channels', name: '微信视频号', markets: ['china', 'europe'], capability: 'publishing', phase: 'p0', connector: null },
  { id: 'wechat_work', name: '企业微信', markets: ['china', 'europe'], capability: 'messaging', phase: 'p0', connector: null },
  { id: 'wechat_private', name: '微信私域', markets: ['china', 'europe'], capability: 'community', phase: 'p0', connector: null },
  { id: 'xiaohongshu', name: '小红书', markets: ['china', 'europe'], capability: 'publishing', phase: 'p0', connector: null },
  { id: 'douyin', name: '抖音', markets: ['china', 'europe'], capability: 'publishing', phase: 'p0', connector: null },
  { id: 'chinese_communities', name: '华人社群', markets: ['china', 'europe'], capability: 'community', phase: 'p0', connector: null },
  { id: 'chinese_kol', name: '华人 KOL/KOC', markets: ['china', 'europe'], capability: 'partner', phase: 'p0', connector: null },
  { id: 'chinese_affiliate', name: '华人联盟/推广', markets: ['china', 'europe'], capability: 'partner', phase: 'p0', connector: null },
  { id: 'mexico_kol', name: 'KOL/KOC 与 Affiliate', markets: ['mexico'], capability: 'partner', phase: 'p0', connector: null },
  { id: 'linkedin', name: 'LinkedIn', markets: ['europe'], capability: 'publishing', phase: 'future', connector: null },
  { id: 'telegram', name: 'Telegram', markets: ['europe', 'mexico'], capability: 'messaging', phase: 'future', connector: null },
  { id: 'x', name: 'X', markets: ['europe', 'mexico'], capability: 'publishing', phase: 'future', connector: null },
  { id: 'bilibili', name: 'B 站', markets: ['china'], capability: 'publishing', phase: 'future', connector: null },
  { id: 'weibo', name: '微博', markets: ['china'], capability: 'publishing', phase: 'future', connector: null },
  { id: 'baidu', name: '百度', markets: ['china'], capability: 'search', phase: 'future', connector: null }
];

export function getGrowthChannelConnections(input: {
  metaConfigured: boolean;
  facebookPageCount: number;
  instagramAccountCount: number;
}): GrowthChannelConnection[] {
  return growthChannels.map(channel => {
    if (channel.phase === 'future') return { ...channel, status: 'future', connectedAssets: 0 };
    if (channel.connector === 'meta_facebook' || channel.connector === 'meta_instagram') {
      const connectedAssets = channel.connector === 'meta_facebook'
        ? input.facebookPageCount
        : input.instagramAccountCount;
      return {
        ...channel,
        status: connectedAssets > 0 ? 'connected' : input.metaConfigured ? 'configured' : 'not_implemented',
        connectedAssets
      };
    }
    return { ...channel, status: 'not_implemented', connectedAssets: 0 };
  });
}

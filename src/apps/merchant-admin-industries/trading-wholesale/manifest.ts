import { merchantIndustryCapabilities } from '../../../constants/merchantIndustryCapabilities';
import type { IndustryManifest } from '../shared/manifest';

export const tradingWholesaleManifest: IndustryManifest = {
  templateId: 'trading_wholesale',
  workspaceName: '贸易批发商后台',
  capability: merchantIndustryCapabilities.trading_wholesale,
  nav: [
    { key: 'dashboard', label: '经营首页' },
    { key: 'products', label: '贸易商品' },
    { key: 'procurement', label: '采购单' },
    { key: 'suppliers', label: '供应商' },
    { key: 'inventory', label: '库存' },
    { key: 'orders', label: '批发销售' },
    { key: 'customers', label: '客户' },
    { key: 'team', label: '团队权限' },
    { key: 'messages', label: '消息中心' },
    { key: 'settings', label: '设置' }
  ]
};

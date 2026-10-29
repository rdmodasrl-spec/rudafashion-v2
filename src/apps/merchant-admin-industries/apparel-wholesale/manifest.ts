import { merchantIndustryCapabilities } from '../../../constants/merchantIndustryCapabilities';
import type { IndustryManifest } from '../shared/manifest';

export const apparelWholesaleManifest: IndustryManifest = {
  templateId: 'apparel_wholesale',
  workspaceName: '服装批发商后台',
  capability: merchantIndustryCapabilities.apparel_wholesale,
  nav: [
    { key: 'dashboard', label: '经营首页' },
    { key: 'products', label: '服装款式' },
    { key: 'inventory', label: '现货库存' },
    { key: 'orders', label: '批发订单' },
    { key: 'customers', label: '客户' },
    { key: 'suppliers', label: '供应商' },
    { key: 'procurement', label: '采购' },
    { key: 'team', label: '团队权限' },
    { key: 'messages', label: '消息中心' },
    { key: 'settings', label: '设置' }
  ]
};

import { merchantIndustryCapabilities } from '../../../constants/merchantIndustryCapabilities';
import type { IndustryManifest } from '../shared/manifest';

export const generalRetailManifest: IndustryManifest = {
  templateId: 'general_retail',
  workspaceName: '综合零售商后台',
  capability: merchantIndustryCapabilities.general_retail,
  nav: [
    { key: 'dashboard', label: '经营首页' },
    { key: 'pos', label: '收银台' },
    { key: 'pos_sales', label: '销售记录' },
    { key: 'pos_shifts', label: '班次历史' },
    { key: 'products', label: '零售商品' },
    { key: 'inventory', label: '零售库存' },
    { key: 'orders', label: '订单' },
    { key: 'customers', label: '客户' },
    { key: 'suppliers', label: '供应商' },
    { key: 'procurement', label: '采购' },
    { key: 'team', label: '团队权限' },
    { key: 'messages', label: '消息中心' },
    { key: 'settings', label: '设置' }
  ]
};

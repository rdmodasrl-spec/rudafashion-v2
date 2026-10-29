import { merchantIndustryCapabilities } from '../../../constants/merchantIndustryCapabilities';
import type { IndustryManifest } from '../shared/manifest';

export const departmentChainRetailManifest: IndustryManifest = {
  templateId: 'department_chain_retail',
  workspaceName: '百货连锁店后台',
  capability: merchantIndustryCapabilities.department_chain_retail,
  nav: [
    { key: 'dashboard', label: '经营首页' },
    { key: 'stores', label: '门店管理' },
    { key: 'products', label: '门店商品' },
    { key: 'inventory', label: '总部库存' },
    { key: 'transfers', label: '库存调拨' },
    { key: 'pos', label: '门店收银' },
    { key: 'pos_sales', label: '销售记录' },
    { key: 'pos_shifts', label: '班次历史' },
    { key: 'orders', label: '门店订单' },
    { key: 'customers', label: '客户' },
    { key: 'team', label: '团队权限' },
    { key: 'messages', label: '消息中心' },
    { key: 'settings', label: '设置' }
  ]
};

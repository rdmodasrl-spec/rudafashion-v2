import { merchantIndustryCapabilities } from '../../../constants/merchantIndustryCapabilities';
import type { IndustryManifest } from '../shared/manifest';

export const departmentWholesaleManifest: IndustryManifest = {
  templateId: 'department_wholesale',
  workspaceName: '百货批发商后台',
  capability: merchantIndustryCapabilities.department_wholesale,
  nav: [
    { key: 'dashboard', label: '经营首页' },
    { key: 'products', label: '百货商品' },
    { key: 'inventory', label: '仓储库存' },
    { key: 'procurement', label: '采购单' },
    { key: 'suppliers', label: '供应商' },
    { key: 'orders', label: '批发订单' },
    { key: 'customers', label: '客户' },
    { key: 'team', label: '团队权限' },
    { key: 'messages', label: '消息中心' },
    { key: 'settings', label: '设置' }
  ]
};

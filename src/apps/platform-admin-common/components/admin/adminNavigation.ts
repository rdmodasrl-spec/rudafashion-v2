export type AdminTab =
  | 'overview' | 'merchants' | 'account_identities' | 'vault_requests' | 'products' | 'customers'
  | 'orders' | 'inventory' | 'showrooms' | 'appointments' | 'pos' | 'finance' | 'notifications' | 'settings'
  | 'audit_logs' | 'ai_support' | 'ai_center' | 'ai_provider_settings' | 'modagpt_operator' | 'modagpt_billing'
  | 'growth' | 'marketing_attribution' | 'partners' | 'support_requests' | 'merchant_support' | 'merchant_support_settings'
  | 'fashion_content' | 'gallery' | 'fashion_community' | 'website_collector' | 'promotions' | 'bi_dashboard' | 'risk_monitor'
  | 'growth_workbench' | 'growth_acquisition' | 'growth_content' | 'growth_analytics'
  | 'database_center' | 'app_store_mgmt' | 'email_mgmt' | 'feature_flags';

export type AdminArea = 'business' | 'growth' | 'service' | 'platform';

export type AdminNavItem = {
  key: AdminTab;
  label: string;
};

export type AdminNavGroup = {
  area: AdminArea;
  label: string;
  items: AdminNavItem[];
};

export const ADMIN_AREAS: Array<{ key: AdminArea; label: string }> = [
  { key: 'business', label: '业务管理' },
  { key: 'growth', label: '增长运营' },
  { key: 'service', label: '客服中心' },
  { key: 'platform', label: '平台管理' }
];

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    area: 'business',
    label: '业务管理',
    items: [
      { key: 'overview', label: '经营概览' },
      { key: 'merchants', label: '商家管理' },
      { key: 'account_identities', label: '账号审核' },
      { key: 'customers', label: '客户管理' },
      { key: 'products', label: '商品管理' },
      { key: 'vault_requests', label: '专属授权' },
      { key: 'orders', label: '订单管理' },
      { key: 'inventory', label: '库存管理' },
      { key: 'showrooms', label: '展厅管理' },
      { key: 'appointments', label: '预约管理' },
      { key: 'pos', label: '收银管理' },
      { key: 'finance', label: '结算管理' }
    ]
  },
  {
    area: 'growth',
    label: '增长运营',
    items: [
      { key: 'growth_workbench', label: '增长总览' },
      { key: 'growth_acquisition', label: '招商获客' },
      { key: 'growth_content', label: '内容推广' },
      { key: 'growth_analytics', label: '增长数据' },
      { key: 'fashion_content', label: '时尚设计' }
    ]
  },
  {
    area: 'service',
    label: '客服中心',
    items: [
      { key: 'merchant_support', label: '客服会话' },
      { key: 'support_requests', label: '服务工单' },
      { key: 'ai_support', label: '买家客服' },
      { key: 'merchant_support_settings', label: '客服设置' }
    ]
  },
  {
    area: 'platform',
    label: '平台管理',
    items: [
      { key: 'settings', label: '平台设置' },
      { key: 'feature_flags', label: '功能开关' },
      { key: 'ai_center', label: '智能代理' },
      { key: 'modagpt_operator', label: '运营助手' },
      { key: 'ai_provider_settings', label: '模型管理' },
      { key: 'modagpt_billing', label: '计费管理' },
      { key: 'risk_monitor', label: '风险监测' },
      { key: 'app_store_mgmt', label: '生态应用' },
      { key: 'notifications', label: '消息通知' },
      { key: 'database_center', label: '数据备份' },
      { key: 'audit_logs', label: '操作记录' }
    ]
  }
];

export const ADMIN_AREA_ITEMS: Record<AdminArea, AdminNavItem[]> = {
  business: ADMIN_NAV_GROUPS.find(group => group.area === 'business')?.items ?? [],
  growth: ADMIN_NAV_GROUPS.find(group => group.area === 'growth')?.items ?? [],
  service: ADMIN_NAV_GROUPS.find(group => group.area === 'service')?.items ?? [],
  platform: ADMIN_NAV_GROUPS.find(group => group.area === 'platform')?.items ?? []
};

export function normalizeAdminTab(tab: AdminTab): AdminTab {
  if (tab === 'gallery' || tab === 'fashion_community' || tab === 'website_collector') return 'fashion_content';
  if (tab === 'growth') return 'growth_workbench';
  if (tab === 'partners') return 'growth_acquisition';
  if (tab === 'promotions') return 'growth_content';
  if (tab === 'marketing_attribution' || tab === 'bi_dashboard') return 'growth_analytics';
  return tab;
}

export function getAdminNavGroupForTab(tab: AdminTab): AdminNavGroup | undefined {
  const resolvedTab = normalizeAdminTab(tab);
  return ADMIN_NAV_GROUPS.find(group => group.items.some(item => item.key === resolvedTab));
}

export function getAdminAreaForTab(tab: AdminTab): AdminArea {
  const resolvedTab = normalizeAdminTab(tab);
  return getAdminNavGroupForTab(resolvedTab)?.area ?? 'platform';
}

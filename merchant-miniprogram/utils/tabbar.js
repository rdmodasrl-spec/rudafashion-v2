const { canAccessTab, isEmployeeWorkMode } = require('./permissions');

const tabs = [
  { id: 'dashboard', pagePath: '/pages/dashboard/index', text: '首页', iconPath: '/assets/icons/dashboard.png', mutedIconPath: '/assets/icons/dashboard_muted.png' },
  { id: 'products', pagePath: '/pages/products/index', text: '商品', iconPath: '/assets/icons/products.png', mutedIconPath: '/assets/icons/products_muted.png' },
  { id: 'orders', pagePath: '/pages/orders/index', text: '订单', iconPath: '/assets/icons/orders.png', mutedIconPath: '/assets/icons/orders_muted.png' },
  { id: 'more', pagePath: '/pages/more/index', text: '更多', iconPath: '/assets/icons/more.png', mutedIconPath: '/assets/icons/more_muted.png' }
];

function syncTabBar(page, auth, selected) {
  if (!page || typeof page.getTabBar !== 'function') return;
  const tabBar = page.getTabBar();
  if (!tabBar || typeof tabBar.setAccess !== 'function') return;
  const list = isEmployeeWorkMode(auth)
    ? tabs.filter(tab => tab.id === 'dashboard' || tab.id === 'more' || canAccessTab(auth, tab.id))
    : tabs;
  tabBar.setAccess(list, selected);
}

module.exports = { syncTabBar };

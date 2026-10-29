const tabs = [
  { id: 'dashboard', pagePath: '/pages/dashboard/index', text: '首页', iconPath: '/assets/icons/dashboard.png', mutedIconPath: '/assets/icons/dashboard_muted.png' },
  { id: 'products', pagePath: '/pages/products/index', text: '商品', iconPath: '/assets/icons/products.png', mutedIconPath: '/assets/icons/products_muted.png' },
  { id: 'orders', pagePath: '/pages/orders/index', text: '订单', iconPath: '/assets/icons/orders.png', mutedIconPath: '/assets/icons/orders_muted.png' },
  { id: 'more', pagePath: '/pages/more/index', text: '更多', iconPath: '/assets/icons/more.png', mutedIconPath: '/assets/icons/more_muted.png' }
];

Component({
  data: {
    list: [tabs[0], tabs[tabs.length - 1]],
    selected: 'dashboard',
    hidden: false
  },

  methods: {
    setHidden(hidden) {
      this.setData({ hidden: Boolean(hidden) });
    },

    setAccess(list, selected) {
      const availableTabs = Array.isArray(list) && list.length ? list : [tabs[0], tabs[tabs.length - 1]];
      this.setData({
        list: availableTabs,
        selected: availableTabs.some(tab => tab.id === selected) ? selected : 'dashboard'
      });
    },

    switchTab(event) {
      const path = event.currentTarget.dataset.path;
      if (path) wx.switchTab({ url: path });
    }
  }
});

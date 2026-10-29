const { request } = require('../../utils/api');
const { requireMerchantSession } = require('../../utils/page-auth');
const {
  loadIndustryContext,
  getIndustryConfig,
  availableActions,
  metricCards,
  productFieldSummary,
  hasModule
} = require('../../utils/industry');

const orderStatusLabels = {
  draft: '草稿',
  placed: '已下单',
  pending: '待确认',
  confirmed: '已确认',
  picking: '拣货中',
  shipped: '已发货',
  delivered: '已完成',
  cancelled: '已取消',
  returned: '已退货'
};

function formatMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  return `€ ${amount.toFixed(2)}`;
}

Page({
  data: {
    statusBarHeight: 0,
    loading: false,
    error: '',
    context: null,
    config: null,
    title: '行业工作台',
    summary: '',
    merchantName: '',
    industryLabel: '',
    storeScopeLabel: '',
    requiresSetup: false,
    metrics: [],
    actions: [],
    recentOrders: [],
    ordersError: '',
    fieldSummary: [],
    inventoryNote: '',
    orderNote: '',
    canViewOrders: false
  },

  onLoad() {
    const systemInfo = typeof wx.getWindowInfo === 'function' ? wx.getWindowInfo() : wx.getSystemInfoSync();
    this.setData({ statusBarHeight: systemInfo.statusBarHeight || 0 });
    return this.loadWorkbench({ force: true });
  },

  onShow() {
    if (!this._loadedOnce) return;
    this.loadWorkbench();
  },

  onPullDownRefresh() {
    this.loadWorkbench({ force: true }).finally(() => wx.stopPullDownRefresh());
  },

  async loadWorkbench(options = {}) {
    if (this.data.loading) return;
    this.setData({ loading: true, error: '', ordersError: '' });
    try {
      const auth = await requireMerchantSession(this);
      if (!auth) return;
      const context = await loadIndustryContext({ force: options.force === true });
      const config = getIndustryConfig(context);
      if (!config) {
        this.setData({
          loading: false,
          requiresSetup: true,
          error: context && context.requiresIndustrySetup
            ? '当前商家尚未分配行业模板，请联系平台运营完成行业开通。'
            : '行业工作台配置缺失，已停止渲染以避免展示错误业务。'
        });
        return;
      }
      const merchant = (auth.response && auth.response.merchant) || (auth.session && auth.session.merchant) || {};
      const canViewOrders = hasModule(context, 'orders');
      const [dashboardResult, ordersResult] = await Promise.all([
        request('/api/merchant/dashboard').catch(error => ({ __error: error })),
        canViewOrders
          ? request('/api/merchant/orders').catch(error => ({ __error: error }))
          : Promise.resolve({ orders: [] })
      ]);
      const dashboard = dashboardResult && !dashboardResult.__error ? dashboardResult : null;
      const metricsSource = dashboard && dashboard.metrics ? dashboard.metrics : {};
      const orders = ordersResult && !ordersResult.__error && Array.isArray(ordersResult.orders)
        ? ordersResult.orders
        : [];
      const pendingOrders = orders
        .filter(order => ['placed', 'pending', 'confirmed', 'picking'].includes(order.status))
        .slice(0, 5)
        .map(order => ({
          id: order.id,
          orderNo: order.orderNo || order.id.slice(0, 8),
          statusLabel: orderStatusLabels[order.status] || order.status,
          totalLabel: formatMoney(order.totalAmount),
          customerLabel: order.customerCompanyName || order.companyName || '客户待补充',
          createdAt: String(order.createdAt || '').slice(0, 10)
        }));
      this._loadedOnce = true;
      this.setData({
        loading: false,
        context,
        config,
        title: config.title,
        summary: config.summary,
        industryLabel: context.templateLabel || config.title,
        merchantName: merchant.name || merchant.companyName || '商家',
        storeScopeLabel: context.storeBound && context.storeId ? '当前门店权限' : '',
        requiresSetup: false,
        canViewOrders,
        metrics: metricCards(config, Object.assign({}, metricsSource, {
          todaySales: dashboard
            ? Number(metricsSource.todaySales || 0)
            : metricsSource.todaySales
        })),
        actions: availableActions(config, context),
        recentOrders: pendingOrders,
        ordersError: ordersResult && ordersResult.__error
          ? '订单数据加载失败，请稍后重试。'
          : '',
        fieldSummary: productFieldSummary(context, config),
        inventoryNote: config.inventoryNote || '',
        orderNote: config.orderNote || ''
      });
      if (dashboardResult && dashboardResult.__error) {
        this.setData({ error: '经营数据加载失败，请下拉重试。' });
      }
    } catch (error) {
      this.setData({ loading: false, error: error.message || '行业工作台加载失败。' });
    }
  },

  retry() {
    this.loadWorkbench({ force: true });
  },

  openAction(event) {
    const { type, url, module } = event.currentTarget.dataset;
    if (type === 'tab' && url) {
      wx.switchTab({ url });
      return;
    }
    if (type === 'page' && url) {
      wx.navigateTo({ url });
      return;
    }
    if (type === 'workspace' && module) {
      // 收银模块有独立原生页面（门店、班次、扫码、结算），不再跳通用工作台。
      if (module === 'pos') {
        wx.navigateTo({ url: '/pages/pos/index' });
        return;
      }
      wx.navigateTo({ url: `/pages/workspace/index?id=${encodeURIComponent(module)}` });
      return;
    }
    wx.showToast({ title: '该入口暂未开放', icon: 'none' });
  },

  openOrders() {
    if (!this.data.canViewOrders) return;
    wx.switchTab({ url: '/pages/orders/index' });
  },

  openDashboard() {
    wx.switchTab({ url: '/pages/dashboard/index' });
  },

  openMore() {
    wx.switchTab({ url: '/pages/more/index' });
  }
});

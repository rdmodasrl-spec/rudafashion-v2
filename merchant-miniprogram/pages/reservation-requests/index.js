const { request } = require('../../utils/api');
const { requireMerchantSession } = require('../../utils/page-auth');
const { canAccessPermissions } = require('../../utils/permissions');

Page({
  data: {
    requests: [],
    loading: false,
    error: '',
    updatingId: ''
  },

  onShow() {
    this.loadRequests();
  },

  onPullDownRefresh() {
    this.loadRequests().finally(() => wx.stopPullDownRefresh());
  },

  async loadRequests() {
    if (this.data.loading) return;
    this.setData({ loading: true, error: '' });
    try {
      const auth = await requireMerchantSession(this);
      if (!auth) return;
      if (!canAccessPermissions(auth, ['sales.order.create'])) {
        this.setData({ error: '当前账号没有处理商品预订意向的权限。', requests: [] });
        return;
      }
      const response = await request('/api/merchant/product-reservation-requests');
      this.setData({
        requests: (response.requests || []).map(item => Object.assign({}, item, {
          statusLabel: item.status === 'pending' ? '待确认' : item.status === 'confirmed' ? '已确认' : '已拒绝',
          displayAmount: `€${Number(item.totalAmount || 0).toFixed(2)}`,
          lines: Array.isArray(item.items) ? item.items : []
        }))
      });
    } catch (error) {
      this.setData({ error: error.message || '预订意向加载失败。' });
    } finally {
      this.setData({ loading: false });
    }
  },

  decideRequest(event) {
    const { id, status } = event.currentTarget.dataset;
    const item = this.data.requests.find(requestItem => requestItem.id === id);
    if (!item || item.status !== 'pending' || !['confirmed', 'rejected'].includes(status)) return;
    const isConfirming = status === 'confirmed';
    wx.showModal({
      title: isConfirming ? '确认预订意向' : '拒绝预订意向',
      content: isConfirming
        ? '确认后会通知买家继续通过正常下单流程购买。此操作不会锁定或扣减库存。'
        : '确定拒绝这条商品预订意向吗？',
      confirmText: isConfirming ? '确认意向' : '确认拒绝',
      success: async result => {
        if (!result.confirm) return;
        this.setData({ updatingId: id, error: '' });
        try {
          await request(`/api/merchant/product-reservation-requests/${encodeURIComponent(id)}/decision`, {
            method: 'POST',
            data: { status }
          });
          wx.showToast({ title: isConfirming ? '意向已确认' : '已拒绝意向', icon: 'success' });
          await this.loadRequests();
        } catch (error) {
          const messages = {
            PRODUCT_RESERVATION_REQUEST_ALREADY_DECIDED: '此意向已由其他商家成员处理，请刷新列表。',
            PRODUCT_RESERVATION_REQUEST_NOT_FOUND: '预订意向不存在或不属于当前店铺。'
          };
          this.setData({ error: messages[error && error.code] || error.message || '更新预订意向失败，请重试。' });
        } finally {
          this.setData({ updatingId: '' });
        }
      }
    });
  }
});

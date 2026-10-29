const { getBuyerNotifications, markBuyerNotificationRead } = require('../../utils/api');
const { getAuthSession } = require('../../utils/auth');

const eventLabels = {
  'order.created': '订单已提交',
  'order.agreement.proposed': '商家提出交易约定',
  'order.agreement.confirmed': '交易约定已确认',
  'order.payment.confirmed': '付款已确认',
  'order.payment.balance_due': '余款待支付',
  'order.message.needs_merchant': '订单新消息',
  'order.fulfillment.updated': '履约进度更新',
  'order.bank_transfer.submitted': '转账已登记',
  'return.requested': '售后申请已提交',
  'product.reservation.requested': '预留意向已提交',
  'buyer.registration.pending': '买家注册审核中',
  'company.registration.pending': '企业注册审核中'
};

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatTime(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return '';
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate())
    + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
}

function summarize(payload) {
  if (!payload || typeof payload !== 'object') return '';
  const parts = [];
  if (payload.orderNo) parts.push('订单 ' + payload.orderNo);
  if (payload.version) parts.push('约定 v' + payload.version);
  if (payload.reason) parts.push(String(payload.reason));
  if (payload.message) parts.push(String(payload.message));
  return parts.join(' · ').slice(0, 120);
}

function presentNotification(item) {
  const payload = item && item.payload && typeof item.payload === 'object' ? item.payload : {};
  const eventType = item && item.eventType ? item.eventType : '';
  return {
    id: item.id,
    label: eventLabels[eventType] || '账户通知',
    detail: summarize(payload),
    time: formatTime(item.createdAt),
    unread: !item.readAt
  };
}

Page({
  data: {
    loading: true,
    error: '',
    unread: 0,
    notifications: []
  },

  onShow() {
    const session = getAuthSession();
    if (!session || session.role !== 'buyer') {
      wx.redirectTo({ url: '/pages/login/index?role=buyer' });
      return;
    }
    this.load();
  },

  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh());
  },

  load() {
    this.setData({ loading: true, error: '' });
    return getBuyerNotifications(50)
      .then(response => {
        const rows = response && Array.isArray(response.notifications) ? response.notifications : [];
        this.setData({
          loading: false,
          unread: typeof response.unread === 'number' ? response.unread : 0,
          notifications: rows.map(presentNotification)
        });
      })
      .catch(error => {
        this.setData({
          loading: false,
          error: error && error.status === 401
            ? '登录状态已失效，请重新登录'
            : (error && error.message ? error.message : '消息暂时无法加载')
        });
      });
  },

  async openNotification(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    const index = this.data.notifications.findIndex(item => item.id === id);
    if (index < 0) return;
    const item = this.data.notifications[index];
    if (!item.unread) return;
    try {
      await markBuyerNotificationRead(id);
      this.setData({
        ['notifications[' + index + '].unread']: false,
        unread: Math.max(0, this.data.unread - 1)
      });
    } catch (error) {
      wx.showToast({ title: error && error.message ? error.message : '标记已读失败', icon: 'none' });
    }
  }
});

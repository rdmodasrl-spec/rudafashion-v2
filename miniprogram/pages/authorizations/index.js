const { getBuyerAuthorizations } = require('../../utils/api');
const { getAuthSession } = require('../../utils/auth');

const statusLabels = {
  approved: '已授权',
  pending: '待商家审核',
  rejected: '未通过',
  expired: '已过期'
};

function formatDate(value) {
  const text = String(value || '');
  if (!text) return '';
  return text.length > 10 ? text.slice(0, 10) : text;
}

Page({
  data: {
    loading: true,
    error: '',
    authorizations: []
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
    return getBuyerAuthorizations()
      .then(response => {
        const rows = response && Array.isArray(response.authorizations) ? response.authorizations : [];
        this.setData({
          loading: false,
          authorizations: rows.map(item => ({
            id: item.id,
            merchantName: item.merchantName || 'RUDA 商家',
            storeSlug: item.storeSlug || '',
            status: item.status,
            statusLabel: statusLabels[item.status] || '状态未知',
            appliedDate: formatDate(item.appliedAt),
            expiresDate: formatDate(item.expiresAt),
            canOpen: item.status === 'approved' && Boolean(item.storeSlug)
          }))
        });
      })
      .catch(error => {
        this.setData({
          loading: false,
          error: error && error.status === 401
            ? '登录状态已失效，请重新登录'
            : (error && error.message ? error.message : '授权信息暂时无法加载')
        });
      });
  },

  openStore(event) {
    const storeSlug = event.currentTarget.dataset.slug;
    if (storeSlug) wx.navigateTo({ url: '/pages/store/index?storeSlug=' + encodeURIComponent(storeSlug) });
  },

  openMerchants() {
    wx.switchTab({ url: '/pages/merchants/index' });
  }
});

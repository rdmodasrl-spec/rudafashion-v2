const { getAssetUrl, request } = require('../../utils/api');
const { verifySession } = require('../../utils/auth');
const { PUBLIC_SITE_URL } = require('../../utils/constants');

Page({
  data: {
    loading: true,
    error: '',
    merchant: null,
    logoUrl: '',
    initial: 'R',
    displayName: 'RUDA 商家',
    publicUrl: '',
    whatsappLink: '',
    wechatContact: '',
    shareable: false,
    storeSlug: ''
  },

  onLoad(options) {
    this.loadCard(options && options.storeSlug);
  },

  async loadCard(storeSlug) {
    this.setData({ loading: true, error: '' });
    try {
      let merchant;
      let sessionMerchant = {};
      let shareable = false;
      if (typeof storeSlug === 'string' && storeSlug.trim()) {
        const result = await request(`/api/merchants/store/${encodeURIComponent(storeSlug.trim())}`, { auth: false });
        merchant = result.merchant;
        shareable = true;
      } else {
        const auth = await verifySession();
        if (!auth) {
          this.setData({ loading: false });
          if (!this._loginOpened) {
            this._loginOpened = true;
            wx.navigateTo({ url: '/pages/login/index' });
          }
          return;
        }
        merchant = auth.response.merchant || auth.session.merchant || {};
        sessionMerchant = auth.session.merchant || {};
      }
      const displayName = merchant.name
        || merchant.companyLegalName
        || sessionMerchant.name
        || sessionMerchant.companyLegalName
        || 'RUDA 商家';
      const storeSlugValue = merchant.storeSlug || storeSlug || '';
      const isPublic = shareable || (Boolean(storeSlugValue)
        && (merchant.storefrontEnabled === true || (merchant.storefrontEnabled == null && merchant.isVerified)));
      const publicUrl = storeSlugValue ? `${PUBLIC_SITE_URL}/shop/${encodeURIComponent(storeSlugValue)}` : '';
      const phoneDigits = String(merchant.whatsapp || merchant.contactPhone || '').replace(/[^\d]/g, '');
      this.setData({
        loading: false,
        merchant,
        logoUrl: typeof merchant.logo === 'string' ? getAssetUrl(merchant.logo) : '',
        displayName,
        initial: String(displayName).trim().slice(0, 1) || 'R',
        publicUrl,
        whatsappLink: phoneDigits ? `https://wa.me/${phoneDigits}` : '',
        wechatContact: merchant.wechat || '',
        shareable: isPublic,
        storeSlug: storeSlugValue
      });
    } catch (error) {
      this.setData({ loading: false, error: error.message || '企业名片加载失败，请重试。' });
    }
  },

  retry() {
    this.loadCard(this.data.storeSlug);
  },

  onLogoError() {
    this.setData({ logoUrl: '' });
  },

  closeCard() {
    wx.navigateBack({ delta: 1, animationType: 'fade-out' });
  },

  stopTap() {},

  copyText(event) {
    const value = event.currentTarget.dataset.value;
    if (!value) return;
    wx.setClipboardData({
      data: value,
      success: () => wx.showToast({ title: '已复制，可粘贴发送', icon: 'none' })
    });
  },

  contactAction(event) {
    const { value, action } = event.currentTarget.dataset;
    if (!value) return;
    if (action === 'phone') {
      wx.makePhoneCall({ phoneNumber: value });
      return;
    }
    this.copyText(event);
  },

  saveContact() {
    const merchant = this.data.merchant || {};
    const options = {
      firstName: merchant.contactPerson || this.data.displayName,
      organization: this.data.displayName,
      mobilePhoneNumber: merchant.contactPhone || '',
      email: merchant.contactEmail || '',
      workAddress: [merchant.showroomAddress, merchant.city, merchant.country].filter(Boolean).join(' '),
      url: this.data.publicUrl || PUBLIC_SITE_URL
    };
    if (!options.mobilePhoneNumber && !options.email) {
      wx.showToast({ title: '暂无可保存的电话或邮箱', icon: 'none' });
      return;
    }
    wx.addPhoneContact({
      firstName: options.firstName,
      organization: options.organization,
      mobilePhoneNumber: options.mobilePhoneNumber,
      email: options.email,
      workAddress: options.workAddress,
      url: options.url,
      fail: error => {
        if (error && error.errMsg && !error.errMsg.includes('cancel')) {
          wx.showToast({ title: '保存联系人失败', icon: 'none' });
        }
      }
    });
  },

  onShareAppMessage() {
    return {
      title: `${this.data.displayName} · 企业名片`,
      path: this.data.storeSlug
        ? `/pages/business-card/index?storeSlug=${encodeURIComponent(this.data.storeSlug)}`
        : '/pages/business-card/index',
      imageUrl: this.data.logoUrl || undefined
    };
  }
});

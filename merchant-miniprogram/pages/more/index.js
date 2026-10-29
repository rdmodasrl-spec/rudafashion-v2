const { clearSession, verifySession } = require('../../utils/auth');
const { getAssetUrl, request } = require('../../utils/api');
const { PUBLIC_SITE_URL } = require('../../utils/constants');
const { canAccessWorkspace, roleLabel, visibleGroups } = require('../../utils/permissions');
const { syncTabBar } = require('../../utils/tabbar');
const { refreshFeatureFlags } = require('../../utils/feature-flags');
const qrcode = require('../../utils/qrcode-generator');

const maxMerchantLogoSize = 5 * 1024 * 1024;

function contentTypeForLogoPath(filePath) {
  const extension = String(filePath).split('?')[0].split('.').pop().toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return 'image/jpeg';
}

function uploadFile(uploadUrl, filePath, contentType) {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath,
      success(file) {
        wx.request({
          url: uploadUrl,
          method: 'PUT',
          data: file.data,
          header: { 'Content-Type': contentType },
          timeout: 30000,
          success(response) {
            if (response.statusCode >= 200 && response.statusCode < 300) resolve();
            else reject(new Error(`头像上传失败（${response.statusCode}）。`));
          },
          fail() { reject(new Error('头像上传失败，请检查网络和微信上传域名配置。')); }
        });
      },
      fail() { reject(new Error('无法读取所选图片，请重新选择。')); }
    });
  });
}

const moduleIcons = {
  counterparties: 'counterparties',
  procurement: 'procurement',
  finance: 'finance',
  vault: 'vault',
  materials: 'materials',
  growth: 'growth',
  production: 'production',
  store: 'store',
  domains: 'domains',
  site_content: 'site_content',
  ai_home: 'ai_home',
  tryon: 'tryon',
  ai_employees: 'ai_employees',
  team: 'team',
  notifications: 'notifications',
  settings: 'settings',
  support: 'support'
};

const groups = [
  {
    id: 'business',
    title: '客户交易',
    items: [
      { id: 'counterparties', title: '往来单位', description: '客户及供应商往来', icon: '往' },
      { id: 'procurement', title: '采购管理', description: '采购订单到货记录', icon: '采' },
      { id: 'finance', title: '财务结算', description: '平台结算收款账户', icon: '财' },
      { id: 'vault', title: '授权申请', description: '客户私密商品授权', icon: '权' }
    ]
  },
  {
    id: 'materials',
    title: '商品仓储',
    items: [
      { id: 'materials', title: '材料库存', description: '面料辅料配饰库存', icon: '料' },
      { id: 'growth', title: '库存预警', description: '库存预警经营分析', icon: '预' },
      { id: 'production', title: '生产工单', description: '工单生产进度查看', icon: '产' }
    ]
  },
  {
    id: 'store',
    title: '店铺渠道',
    items: [
      { id: 'store', title: '店铺管理', description: '店铺资料经营信息', icon: '店' },
      { id: 'domains', title: '店铺域名', description: '店铺访问链接查看', icon: '域' },
      { id: 'site_content', title: '页面设置', description: '店铺展示分类管理', icon: '页' }
    ]
  },
  {
    id: 'tools',
    title: '智能工具',
    items: [
      { id: 'ai_home', title: '智能助手', description: '商家智能服务入口', icon: 'AI' },
      { id: 'tryon', title: '虚拟试衣', description: '商品模特试穿效果', icon: '设' },
      { id: 'ai_employees', title: '智能员工', description: '智能员工开通状态', icon: '智' }
    ]
  },
  {
    id: 'company',
    title: '员工系统',
    items: [
      { id: 'team', title: '员工管理', description: '员工账号权限管理', icon: '员' },
      { id: 'notifications', title: '通知中心', description: '业务消息待办处理', icon: '讯' },
      { id: 'settings', title: '系统设置', description: '经营资料偏好设置', icon: '设' },
      { id: 'support', title: '帮助反馈', description: '商家问题反馈支持', icon: '问' }
    ]
  }
];

Page({
  data: {
    groups: [],
    merchant: null,
    merchantDisplayName: '',
    merchantLogo: '',
    merchantInitial: 'R',
    uploadingLogo: false,
    merchantWebsiteUrl: '',
    showMerchantQr: false,
    qrLoading: false,
    merchantQrImagePath: '',
    account: null,
    roleLabel: '',
    canManageSettings: false,
    unreadNotificationCount: 0,
    notificationError: '',
    loading: true,
    error: ''
  },

  onShow() {
    this.loadProfile();
  },

  async loadProfile() {
    this.setData({
      error: '',
      loading: true,
      unreadNotificationCount: 0,
      notificationError: ''
    });
    try {
      const auth = await verifySession();
      if (!auth) {
        this.setData({ loading: false });
        if (!this._loginOpened) {
          this._loginOpened = true;
          wx.navigateTo({ url: '/pages/login/index' });
        }
        return;
      }
      syncTabBar(this, auth, 'more');
      // 平台功能开关决定 ModaUI 是否出现在小程序工作区；读取失败按关闭处理。
      await refreshFeatureFlags();
      const merchant = auth.response.merchant || auth.session.merchant || {};
      const sessionMerchant = auth.session.merchant || {};
      const account = auth.session.profile || {};
      const storeSlug = typeof merchant.storeSlug === 'string' ? merchant.storeSlug.trim() : '';
      const storeLookupCode = typeof merchant.storeLookupCode === 'string' ? merchant.storeLookupCode.trim() : '';
      const isPublicStore = merchant.storefrontEnabled === true
        || (merchant.storefrontEnabled == null && merchant.isVerified === true);
      const merchantWebsiteUrl = isPublicStore && storeLookupCode
        ? `${PUBLIC_SITE_URL}/showrooms?storeCode=${encodeURIComponent(storeLookupCode)}`
        : isPublicStore && storeSlug
          ? `${PUBLIC_SITE_URL}/shop/${encodeURIComponent(storeSlug)}`
          : '';
      this.setData({
        groups: visibleGroups(groups, auth).map(group => Object.assign({}, group, {
          items: group.items.map(module => Object.assign({}, module, {
            iconSrc: `/assets/icons/${moduleIcons[module.id] || 'module'}.png`
          }))
        })),
        merchant,
        storeLookupCode,
        merchantDisplayName: merchant.name
          || merchant.companyLegalName
          || sessionMerchant.name
          || sessionMerchant.companyLegalName
          || account.companyName
          || 'RUDA 商家',
        merchantLogo: typeof merchant.logo === 'string' ? getAssetUrl(merchant.logo) : '',
        merchantWebsiteUrl,
        merchantInitial: String(
          merchant.name || merchant.companyLegalName || sessionMerchant.name || account.companyName || 'R'
        ).trim().slice(0, 1) || 'R',
        account,
        roleLabel: roleLabel(auth),
        canManageSettings: canAccessWorkspace(auth, 'settings'),
        loading: false
      });
      if (canAccessWorkspace(auth, 'notifications')) {
        try {
          const result = await request('/api/merchant/notifications');
          this.setData({
            unreadNotificationCount: Number(result.unread || 0),
            notificationError: ''
          });
        } catch (error) {
          this.setData({
            notificationError: error.message || '未读通知暂时无法加载。'
          });
        }
      }
    } catch (error) {
      this.setData({ loading: false, error: error.message || '账号信息加载失败。' });
    }
  },

  openModule(event) {
    const id = event.currentTarget.dataset.id;
    if (!canAccessWorkspace({ session: { role: 'merchant' } }, id)) {
      wx.showToast({ title: '该功能将在小程序审核通过后开放。', icon: 'none' });
      return;
    }
    if (id === 'ai_home') {
      wx.switchTab({ url: '/pages/assistant/index' });
      return;
    }
    if (id === 'tryon') {
      wx.navigateTo({ url: '/pages/tryon/index' });
      return;
    }
    if (id === 'counterparties') {
      wx.navigateTo({ url: '/pages/counterparties/index' });
      return;
    }
    if (id) wx.navigateTo({ url: `/pages/workspace/index?id=${encodeURIComponent(id)}` });
  },

  openSettings() {
    if (!this.data.canManageSettings) return;
    wx.navigateTo({ url: '/pages/workspace/index?id=settings' });
  },

  openBusinessCard() {
    wx.navigateTo({ url: '/pages/business-card/index' });
  },

  openPrivacyGuide() {
    wx.navigateTo({ url: '/pages/privacy/index' });
  },

  chooseMerchantLogo() {
    if (!this.data.canManageSettings || this.data.uploadingLogo) return;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: async result => {
        const file = result.tempFiles && result.tempFiles[0];
        if (!file || !file.tempFilePath) {
          wx.showToast({ title: '无法读取所选图片，请重新选择。', icon: 'none' });
          return;
        }
        if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > maxMerchantLogoSize) {
          wx.showToast({ title: '头像图片不能超过 5 MB，请重新选择。', icon: 'none' });
          return;
        }
        this.setData({ uploadingLogo: true, error: '' });
        try {
          await this.uploadMerchantLogo(file);
          await this.loadProfile();
          wx.showToast({ title: '店铺头像已更新', icon: 'success' });
        } catch (error) {
          wx.showToast({ title: error.message || '头像上传失败，请重试。', icon: 'none' });
        } finally {
          this.setData({ uploadingLogo: false });
        }
      },
      fail: result => {
        if (!result || !String(result.errMsg).includes('cancel')) {
          wx.showToast({ title: '无法选择图片，请检查相册/相机权限。', icon: 'none' });
        }
      }
    });
  },

  async uploadMerchantLogo(file) {
    const contentType = contentTypeForLogoPath(file.tempFilePath);
    const presigned = await request('/api/merchant/media/presign', {
      method: 'POST',
      data: { contentType, fileSize: file.size }
    });
    if (!presigned.uploadUrl || !presigned.publicUrl || !presigned.key
      || !presigned.contentType || presigned.sizeBytes !== file.size) {
      throw new Error('图片上传服务返回了无效信息，请稍后重试。');
    }
    if (!/^https:\/\//i.test(presigned.uploadUrl) || !/^https:\/\//i.test(presigned.publicUrl)) {
      throw new Error('图片上传与访问地址必须使用 HTTPS。');
    }
    await uploadFile(presigned.uploadUrl, file.tempFilePath, contentType);
    await request('/api/merchant/storefront', {
      method: 'PUT',
      data: {
        logo: presigned.publicUrl,
        storefrontMediaItems: [{
          field: 'logo',
          url: presigned.publicUrl,
          storageKey: presigned.key,
          contentType: presigned.contentType,
          sizeBytes: presigned.sizeBytes
        }]
      }
    });
  },

  onMerchantLogoError() {
    this.setData({ merchantLogo: '' });
  },

  openMerchantQrCode() {
    if (!this.data.merchantWebsiteUrl) {
      wx.showToast({ title: '店铺链接尚未开通', icon: 'none' });
      return;
    }
    this.setData({ showMerchantQr: true, qrLoading: true, merchantQrImagePath: '' });
    wx.nextTick(() => this.drawMerchantQrCode());
  },

  drawMerchantQrCode() {
    const query = wx.createSelectorQuery();
    query.select('#merchant-qr-canvas').fields({ node: true, size: true }).exec(result => {
      const canvasInfo = result && result[0];
      if (!canvasInfo || !canvasInfo.node) {
        this.setData({ qrLoading: false });
        wx.showToast({ title: '二维码暂时无法生成，请重试。', icon: 'none' });
        return;
      }
      try {
        const qr = qrcode(0, 'M');
        qr.addData(this.data.merchantWebsiteUrl, 'Byte');
        qr.make();
        const canvas = canvasInfo.node;
        const context = canvas.getContext('2d');
        const pixelRatio = wx.getSystemInfoSync().pixelRatio || 2;
        const logicalSize = Math.max(canvasInfo.width, canvasInfo.height);
        const pixelSize = Math.round(logicalSize * pixelRatio);
        const moduleCount = qr.getModuleCount();
        const quietZone = 4;
        const totalModules = moduleCount + quietZone * 2;
        canvas.width = pixelSize;
        canvas.height = pixelSize;
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, pixelSize, pixelSize);
        context.fillStyle = '#171717';
        for (let row = 0; row < moduleCount; row += 1) {
          for (let column = 0; column < moduleCount; column += 1) {
            if (!qr.isDark(row, column)) continue;
            const left = Math.floor((column + quietZone) * pixelSize / totalModules);
            const top = Math.floor((row + quietZone) * pixelSize / totalModules);
            const right = Math.ceil((column + quietZone + 1) * pixelSize / totalModules);
            const bottom = Math.ceil((row + quietZone + 1) * pixelSize / totalModules);
            context.fillRect(left, top, right - left, bottom - top);
          }
        }
        wx.canvasToTempFilePath({
          canvas,
          x: 0,
          y: 0,
          width: pixelSize,
          height: pixelSize,
          destWidth: pixelSize,
          destHeight: pixelSize,
          fileType: 'png',
          success: file => this.setData({
            merchantQrImagePath: file.tempFilePath,
            qrLoading: false
          }),
          fail: () => {
            this.setData({ qrLoading: false });
            wx.showToast({ title: '二维码图片生成失败，请重试。', icon: 'none' });
          }
        }, this);
      } catch (error) {
        this.setData({ qrLoading: false });
        wx.showToast({ title: error.message || '二维码暂时无法生成，请重试。', icon: 'none' });
      }
    });
  },

  shareMerchantQrCode() {
    const imagePath = this.data.merchantQrImagePath;
    if (!imagePath || this.data.qrLoading) {
      wx.showToast({ title: '二维码正在生成，请稍候。', icon: 'none' });
      return;
    }
    if (typeof wx.showShareImageMenu === 'function') {
      wx.showShareImageMenu({
        path: imagePath,
        fail: error => {
          if (!error || !String(error.errMsg).includes('cancel')) this.saveMerchantQrToAlbum(imagePath);
        }
      });
      return;
    }
    this.saveMerchantQrToAlbum(imagePath);
  },

  saveMerchantQrToAlbum(imagePath) {
    wx.saveImageToPhotosAlbum({
      filePath: imagePath,
      success: () => wx.showToast({ title: '二维码已保存，可从相册发送给朋友', icon: 'none' }),
      fail: () => wx.showToast({ title: '二维码保存失败，请检查相册权限。', icon: 'none' })
    });
  },

  copyMerchantWebsite() {
    if (!this.data.merchantWebsiteUrl) return;
    wx.setClipboardData({
      data: this.data.merchantWebsiteUrl,
      success: () => wx.showToast({ title: '店铺链接已复制', icon: 'none' })
    });
  },

  closeMerchantQrCode() {
    this.setData({ showMerchantQr: false });
  },

  stopQrModalTap() {},

  logout() {
    wx.showModal({
      title: '退出商家账号',
      content: '确认退出当前设备上的商家工作台？',
      success: result => {
        if (!result.confirm) return;
        clearSession();
        wx.navigateTo({ url: '/pages/login/index' });
      }
    });
  },

  retry() {
    this.loadProfile();
  }
});

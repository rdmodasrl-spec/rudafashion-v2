const { request, getAssetUrl } = require('../../utils/api');
const { requireMerchantSession } = require('../../utils/page-auth');
const { loadMerchantInventoryBalances } = require('../../utils/inventory');
const { canAccessPermissions, canAccessTab, canAccessWorkspace } = require('../../utils/permissions');
const { loadIndustryContext, parseIndustryAttributes } = require('../../utils/industry');

const RECENT_PRODUCTS_STORAGE_KEY = 'merchantRecentlyViewedProductIds';

function inventoryKey(productId, sku) {
  return `${productId}\u0000${sku}`;
}

function rememberRecentlyViewedProduct(productId) {
  if (typeof productId !== 'string' || !productId) return;
  try {
    const storedIds = wx.getStorageSync(RECENT_PRODUCTS_STORAGE_KEY);
    const previousIds = Array.isArray(storedIds) ? storedIds : [];
    const recentIds = [productId]
      .concat(previousIds.filter(id => typeof id === 'string' && id !== productId))
      .slice(0, 3);
    wx.setStorageSync(RECENT_PRODUCTS_STORAGE_KEY, recentIds);
  } catch (error) {
    console.warn('Unable to save recently viewed merchant product', error);
  }
}

Page({
  data: {
    loading: true,
    error: '',
    inventoryError: '',
    inventoryLoading: false,
    canViewStock: false,
    canManageProducts: false,
    canShareProduct: false,
    merchantStoreSlug: '',
    inventoryReady: false,
    product: null,
    coverImage: '',
    mediaItems: [],
    selectedMedia: null,
    skus: [],
    displaySkus: [],
    selectedSkuIndex: 0,
    showAllSkus: false,
    totalAvailableQuantity: 0,
    colorSummary: '',
    sizeSummary: '',
    statusLabel: '',
    inventoryStatusLabel: '',
    industryAttributes: []
  },

  onLoad(options) {
    this.productId = options.id || '';
    this.requestedSku = options.sku || '';
    this._skipNextShow = true;
    this.loadProduct();
  },

  onShow() {
    this.startDataRefresh();
    if (this._skipNextShow) {
      this._skipNextShow = false;
      return;
    }
    if (this.productId) this.loadProduct({ silent: true });
  },

  onHide() {
    this.stopDataRefresh();
  },

  onUnload() {
    this.stopDataRefresh();
  },

  startDataRefresh() {
    clearInterval(this._dataRefreshTimer);
    this._dataRefreshTimer = setInterval(() => {
      if (this.productId) this.loadProduct({ silent: true });
    }, 30000);
  },

  stopDataRefresh() {
    clearInterval(this._dataRefreshTimer);
    this._dataRefreshTimer = null;
  },

  onPullDownRefresh() {
    this.loadProduct().finally(() => wx.stopPullDownRefresh());
  },

  async loadProduct(options) {
    const silent = Boolean(options && options.silent);
    if (silent) this.setData({ error: '' });
    else this.setData({ loading: true, error: '', inventoryError: '', inventoryReady: false, inventoryLoading: false });
    try {
      const auth = await requireMerchantSession(this);
      if (!auth) return;
      if (!this.productId || !canAccessTab(auth, 'products')) {
        this.setData({ error: this.productId ? '当前账号没有商品目录权限。' : '缺少商品编号。' });
        return;
      }
      const canViewStock = canAccessWorkspace(auth, 'inventory');
      const canManageProducts = canAccessPermissions(auth, ['product.publish']);
      const merchant = auth.response && auth.response.merchant || auth.session && auth.session.merchant || {};
      const viewData = { canViewStock };
      if (!silent) viewData.inventoryLoading = canViewStock;
      this.setData(viewData);
      const inventoryRequest = canViewStock
        ? loadMerchantInventoryBalances([this.productId]).then(balances => ({ balances })).catch(error => ({ error }))
        : Promise.resolve({ balances: [] });
      const detailResults = await Promise.all([
        request(`/api/merchant/products/${encodeURIComponent(this.productId)}`),
        inventoryRequest,
        loadIndustryContext().catch(() => null)
      ]);
      const productResponse = detailResults[0];
      const inventoryResult = detailResults[1];
      const industryContext = detailResults[2];
      const product = productResponse.product;
      if (!product) {
        this.setData({ error: '没有找到此商品，或当前账号无权查看。' });
        return;
      }
      rememberRecentlyViewedProduct(product.id);

      const inventoryError = inventoryResult.error
        ? inventoryResult.error.message || '库存加载失败，请稍后重试。'
        : '';
      const inventoryReady = canViewStock && !inventoryError;
      const inventoryBySku = new Map();
      (inventoryResult.balances || []).forEach(balance => {
        if (!balance.product || balance.product.id !== product.id) return;
        const key = inventoryKey(product.id, balance.sku);
        inventoryBySku.set(key, (inventoryBySku.get(key) || 0) + Number(balance.availableQuantity || 0));
      });
      const skus = (product.skus || []).map(sku => {
        const availableQuantity = inventoryReady
          ? inventoryBySku.get(inventoryKey(product.id, sku.sku)) || 0
          : null;
        const lowStock = inventoryReady
          && availableQuantity > 0
          && availableQuantity <= Number(product.moq || 0);
        return Object.assign({}, sku, {
          availableQuantity,
          lowStock,
          stockStatus: !inventoryReady
            ? (inventoryError ? '库存不可用' : '库存无权限')
            : availableQuantity === 0 ? '无库存' : lowStock ? '低库存' : '有库存',
          wholesalePrice: Number(sku.wholesalePrice || product.wholesalePrice || 0)
        });
      });
      const requestedIndex = skus.findIndex(sku => sku.sku === this.requestedSku);
      const mediaItems = Array.isArray(product.media) && product.media.length
        ? product.media.map((item, index) => Object.assign({ id: `media-${index}` }, item, { url: getAssetUrl(item.url) }))
        : (product.images || []).map((url, index) => ({ id: `image-${index}`, type: 'image', url: getAssetUrl(typeof url === 'string' ? url : url && url.url) }));
      const firstMedia = mediaItems.find(item => item.type === 'image') || mediaItems[0] || null;
      const coverImage = firstMedia && firstMedia.type === 'image' ? firstMedia.url : '';
      const colorSummary = Array.from(new Set(skus.map(sku => sku.color).filter(Boolean))).join('、');
      const sizeSummary = Array.from(new Set(skus.map(sku => sku.size).filter(Boolean))).join('、');
      const totalAvailableQuantity = inventoryReady
        ? skus.reduce((total, sku) => total + Number(sku.availableQuantity || 0), 0)
        : 0;
      const inventoryStatusLabel = !inventoryReady
        ? ''
        : totalAvailableQuantity === 0
          ? '无库存'
          : totalAvailableQuantity <= Number(product.moq || 0)
            ? '低库存'
            : '有库存';
      const statusLabels = {
        published: '出售中',
        draft: '已下架',
        pending_review: '审核中',
        rejected: '未通过',
        archived: '已归档'
      };
      const industryLabelByKey = {};
      ((industryContext && industryContext.productFields) || []).forEach(field => {
        if (field && field.key) industryLabelByKey[field.key] = field.label || field.key;
      });
      const industryAttributeValues = parseIndustryAttributes(product.industryAttributes);
      const industryAttributes = Object.keys(industryAttributeValues)
        .map(key => ({ key, label: industryLabelByKey[key] || key, value: String(industryAttributeValues[key] || '').trim() }))
        .filter(item => item.value);
      this.setData({
        product,
        industryAttributes,
        colorCount: new Set(skus.map(sku => sku.color).filter(Boolean)).size,
        sizeCount: new Set(skus.map(sku => sku.size).filter(Boolean)).size,
        skus,
        displaySkus: skus.length > 6 ? skus.slice(0, 6) : skus,
        mediaItems,
        selectedMedia: firstMedia,
        coverImage,
        totalAvailableQuantity,
        colorSummary,
        sizeSummary,
        statusLabel: statusLabels[product.lifecycleStatus || 'published'] || '未知状态',
        inventoryStatusLabel,
        showAllSkus: false,
        selectedSkuIndex: requestedIndex >= 0 ? requestedIndex : 0,
        canViewStock,
        canManageProducts,
        merchantStoreSlug: merchant.storeSlug || merchant.slug || '',
        canShareProduct: product.lifecycleStatus === 'published' && Boolean(merchant.storeSlug || merchant.slug),
        inventoryReady,
        inventoryError
      });
    } catch (error) {
      if (!silent) this.setData({ error: error.message || '商品详情加载失败，请重试。' });
    } finally {
      if (!silent) this.setData({ loading: false, inventoryLoading: false });
    }
  },

  selectSku(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isInteger(index) || index < 0 || index >= this.data.skus.length) return;
    this.setData({ selectedSkuIndex: index });
  },

  selectMedia(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isInteger(index) || index < 0 || index >= this.data.mediaItems.length) return;
    const selectedMedia = this.data.mediaItems[index];
    this.setData({
      selectedMedia,
      coverImage: selectedMedia.type === 'image' ? selectedMedia.url : ''
    });
  },

  closeDetail() {
    wx.navigateBack();
  },

  toggleSkus() {
    const showAllSkus = !this.data.showAllSkus;
    this.setData({
      showAllSkus,
      displaySkus: showAllSkus ? this.data.skus : this.data.skus.slice(0, 6)
    });
  },

  editProduct() {
    if (!this.data.canManageProducts || !this.productId) return;
    wx.navigateTo({ url: `/pages/product-form/index?id=${encodeURIComponent(this.productId)}` });
  },

  shareProduct() {
    if (!this.data.canShareProduct || !this.data.merchantStoreSlug || !this.data.product) {
      wx.showToast({ title: '商品未上架或店铺链接暂不可用', icon: 'none' });
      return;
    }
    const url = `https://${this.data.merchantStoreSlug}.ruda.fashion/product/${encodeURIComponent(this.data.product.id)}`;
    wx.setClipboardData({
      data: url,
      success: () => wx.showToast({ title: '商品链接已复制', icon: 'success' }),
      fail: () => wx.showToast({ title: '复制链接失败，请重试', icon: 'none' })
    });
  }
});

const { request, getAssetUrl } = require('../../utils/api');
const { setWorkMode, verifySession } = require('../../utils/auth');
const { canAccessPermissions, canAccessTab, canAccessWorkspace, isEmployeeWorkMode } = require('../../utils/permissions');
const { loadMerchantInventoryBalances } = require('../../utils/inventory');
const { loadIndustryContext, getIndustryConfig } = require('../../utils/industry');
const { syncTabBar } = require('../../utils/tabbar');

const RECENT_PRODUCTS_STORAGE_KEY = 'merchantRecentlyViewedProductIds';
const SUPPORTED_CURRENCIES = ['EUR', 'USD', 'CNY', 'GBP', 'JPY', 'CHF'];
const SEARCH_DEBOUNCE_MS = 200;

function money(value, currency) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  const currencyCode = SUPPORTED_CURRENCIES.includes(currency) ? currency : 'EUR';
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 2
  }).format(amount);
}

function orderTimestamp(order) {
  return new Date(order.createdAt || `${order.date || ''}T00:00:00`).getTime();
}

function readRecentlyViewedProductIds() {
  try {
    const storedIds = wx.getStorageSync(RECENT_PRODUCTS_STORAGE_KEY);
    return Array.isArray(storedIds)
      ? Array.from(new Set(storedIds.filter(id => typeof id === 'string' && id))).slice(0, 3)
      : [];
  } catch (error) {
    console.warn('Unable to read recently viewed merchant products', error);
    return [];
  }
}

function saveRecentlyViewedProductIds(productIds) {
  try {
    wx.setStorageSync(RECENT_PRODUCTS_STORAGE_KEY, productIds.slice(0, 3));
  } catch (error) {
    console.warn('Unable to save recently viewed merchant products', error);
  }
}

function summarizeSizes(skus) {
  const sizes = Array.from(new Set(skus.map(sku => String(sku.size || '').trim()).filter(Boolean)));
  if (!sizes.length) return '尺码信息待补充';
  const commonOrder = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL'];
  sizes.sort((left, right) => {
    const leftRank = commonOrder.indexOf(left.toUpperCase());
    const rightRank = commonOrder.indexOf(right.toUpperCase());
    if (leftRank >= 0 && rightRank >= 0) return leftRank - rightRank;
    if (leftRank >= 0) return -1;
    if (rightRank >= 0) return 1;
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
    return left.localeCompare(right);
  });
  return sizes.length === 1 ? sizes[0] : `${sizes[0]}–${sizes[sizes.length - 1]}`;
}

function productImage(product) {
  const mediaImage = (product.media || []).find(item => item.type === 'image' && item.url);
  const firstImage = mediaImage && mediaImage.url || (product.images || [])[0];
  const imageUrl = typeof firstImage === 'string' ? firstImage : firstImage && firstImage.url;
  return imageUrl ? getAssetUrl(imageUrl) : '';
}

Page({
  data: {
    loading: false,
    error: '',
    notificationsError: '',
    merchantName: '商家',
    merchantLogo: '',
    merchantInitial: 'R',
    merchantCurrency: 'EUR',
    employeeMode: false,
    canSwitchMode: false,
    canViewProducts: false,
    canViewStock: false,
    canViewMaterials: false,
    canManageProducts: false,
    canViewOrders: false,
    canViewMessages: false,
    canViewAnalytics: false,
    productQuery: '',
    searchResults: [],
    searchOpen: false,
    searchLoading: false,
    searchError: '',
    selectedSearchIndex: 0,
    recentProducts: [],
    recentLoading: false,
    recentProductsError: '',
    materialsLoading: false,
    materialsError: '',
    materialAlertCount: 0,
    materialAlertSummary: '',
    ordersError: '',
    metricsError: '',
    hasPendingTasks: false,
    metrics: [],
    pendingOrderCount: 0,
    unreadMessageCount: 0,
    industryWorkbenchLabel: '行业工作台',
    industryWorkbenchSummary: ''
  },

  onShow() {
    this.loadDashboard();
    this.loadIndustryEntry();
    clearInterval(this._notificationTimer);
    this._notificationTimer = setInterval(() => this.loadDashboard(), 30000);
  },

  onPullDownRefresh() {
    this.loadDashboard().finally(() => wx.stopPullDownRefresh());
  },

  onHide() {
    clearInterval(this._notificationTimer);
    clearTimeout(this._searchTimer);
    this._searchRequestId = (this._searchRequestId || 0) + 1;
  },

  onUnload() {
    clearInterval(this._notificationTimer);
    clearTimeout(this._searchTimer);
    this._searchRequestId = (this._searchRequestId || 0) + 1;
  },

  async loadIndustryEntry() {
    try {
      const context = await loadIndustryContext();
      const config = getIndustryConfig(context);
      this.setData({
        industryWorkbenchLabel: config ? `${config.title}工作台` : '行业工作台',
        industryWorkbenchSummary: config ? config.summary : '查看本行业经营数据与常用操作'
      });
    } catch (error) {
      // 行业入口不可用时保持默认文案，不影响首页其他数据加载。
      this.setData({
        industryWorkbenchLabel: '行业工作台',
        industryWorkbenchSummary: '查看本行业经营数据与常用操作'
      });
    }
  },

  openIndustryWorkbench() {
    wx.navigateTo({ url: '/pages/industry/index' });
  },

  async loadDashboard() {
    if (this.data.loading) return;
    this._searchableProducts = null;
    this.setData({
      loading: true,
      error: '',
      notificationsError: '',
      ordersError: '',
      metricsError: '',
      materialsError: '',
      recentProductsError: ''
    });
    try {
      const auth = await verifySession();
      if (!auth) {
        this.setData({ loading: false });
        this._loginOpened = true;
        wx.navigateTo({ url: '/pages/login/index' });
        return;
      }
      const merchant = auth.response.merchant || auth.session.merchant || {};
      const employeeMode = isEmployeeWorkMode(auth);
      const canViewProducts = canAccessTab(auth, 'products');
      const canViewStock = canAccessWorkspace(auth, 'inventory');
      const canViewMaterials = canAccessWorkspace(auth, 'materials');
      const canManageProducts = canAccessPermissions(auth, ['product.publish']);
      const canViewOrders = canAccessTab(auth, 'orders');
      const canViewMessages = canAccessWorkspace(auth, 'notifications');
      const canViewAnalytics = (!employeeMode || canAccessPermissions(auth, ['business.analytics.read'])) && canViewOrders;
      const merchantCurrency = SUPPORTED_CURRENCIES.includes(merchant.currency) ? merchant.currency : 'EUR';
      const recentIds = canViewProducts ? readRecentlyViewedProductIds() : [];
      syncTabBar(this, auth, 'dashboard');
      this.setData({
        merchantName: merchant.name || merchant.companyLegalName || '商家',
        merchantLogo: typeof merchant.logo === 'string' ? getAssetUrl(merchant.logo) : '',
        merchantInitial: String(merchant.name || merchant.companyLegalName || 'R').trim().slice(0, 1) || 'R',
        merchantCurrency,
        employeeMode,
        canSwitchMode: auth.session.role === 'merchant',
        canViewProducts,
        canViewStock,
        canViewMaterials,
        canManageProducts,
        canViewOrders,
        canViewMessages,
        canViewAnalytics,
        unreadMessageCount: canViewMessages ? this.data.unreadMessageCount : 0,
        recentLoading: recentIds.length > 0,
        materialsLoading: canViewMaterials,
        recentProducts: canViewProducts && recentIds.length ? this.data.recentProducts : [],
        materialAlertCount: canViewMaterials ? this.data.materialAlertCount : 0
      });

      const notificationRequest = canViewMessages
        ? request('/api/merchant/notifications')
          .then(response => ({ response }))
          .catch(error => ({ error }))
        : Promise.resolve({ response: { notifications: [] } });
      const orderRequest = canViewOrders
        ? request('/api/merchant/orders')
          .then(response => ({ response }))
          .catch(error => ({ error }))
        : Promise.resolve({ response: { orders: [] } });
      const materialsRequest = canViewMaterials
        ? request('/api/merchant/materials')
          .then(response => ({ response }))
          .catch(error => ({ error }))
        : Promise.resolve({ response: { materials: [] } });
      const recentProductsRequest = canViewProducts && recentIds.length
        ? this.loadRecentProducts(recentIds, canViewStock, merchantCurrency)
          .then(result => ({ result }))
          .catch(error => ({ error }))
        : Promise.resolve({ result: { products: [], error: '' } });
      const dashboardResults = await Promise.all([
        orderRequest,
        notificationRequest,
        materialsRequest,
        recentProductsRequest
      ]);
      const orderResult = dashboardResults[0];
      const notificationResult = dashboardResults[1];
      const materialsResult = dashboardResults[2];
      const recentProductsResult = dashboardResults[3];
      const orderResponse = orderResult.response || { orders: [] };
      const notificationsResponse = notificationResult.response || { notifications: [] };
      const notifications = Array.isArray(notificationsResponse.notifications) ? notificationsResponse.notifications : [];
      const notificationIds = new Set(notifications.map(notification => notification.id));
      const previousNotificationIds = this._notificationIds;
      if (previousNotificationIds) {
        const newestHighPriority = notifications.find(notification =>
          notification.priority === 'high'
          && !notification.readAt
          && !previousNotificationIds.has(notification.id));
        if (newestHighPriority) {
          const payload = newestHighPriority.payload || {};
          wx.showToast({
            title: String(payload.title || payload.message || '有新的重要业务通知').slice(0, 18),
            icon: 'none',
            duration: 3500
          });
        }
      }
      this._notificationIds = notificationIds;

      const orders = (Array.isArray(orderResponse.orders) ? orderResponse.orders : []).slice().sort((left, right) =>
        orderTimestamp(right) - orderTimestamp(left));
      const reportableOrders = orders.filter(order => !['cancelled', 'returned'].includes(order.status));
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const tomorrowStart = todayStart + 24 * 60 * 60 * 1000;
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const ordersToday = reportableOrders.filter(order => {
        const timestamp = orderTimestamp(order);
        return timestamp >= todayStart && timestamp < tomorrowStart;
      });
      const ordersThisMonth = reportableOrders.filter(order => orderTimestamp(order) >= monthStart);
      const pendingOrderCount = orders.filter(order =>
        ['placed', 'pending', 'confirmed', 'picking'].includes(order.status)).length;
      const unreadMessageCount = notifications.filter(notification => !notification.readAt).length;
      const ordersError = orderResult.error
        ? orderResult.error.message || '待处理订单暂时无法加载。'
        : !Array.isArray(orderResponse.orders)
          ? '待处理订单数据暂时无法读取。'
          : '';
      const materials = materialsResult.response && materialsResult.response.materials;
      const materialAlerts = Array.isArray(materials)
        ? materials.filter(material => {
          const reorderPoint = Number(material.reorderPoint);
          const availableQuantity = Number(material.availableQuantity);
          return Number.isFinite(reorderPoint)
            && reorderPoint > 0
            && Number.isFinite(availableQuantity)
            && availableQuantity <= reorderPoint;
        })
        : [];
      const materialsError = materialsResult.error
        ? materialsResult.error.message || '面料与辅料库存暂时无法加载。'
        : canViewMaterials && !Array.isArray(materials)
          ? '面料与辅料库存数据格式无效。'
          : '';
      const recentResult = recentProductsResult.result || { products: [], error: '' };
      const recentProductsError = recentProductsResult.error
        ? recentProductsResult.error.message || '最近查看商品暂时无法加载。'
        : recentResult.error;
      const materialAlertSummary = materialAlerts.length
        ? `${materialAlerts.slice(0, 2).map(material => material.name).join('、')}${materialAlerts.length > 2 ? ` 等 ${materialAlerts.length} 项` : ''}低于补货点`
        : '';
      const hasPendingTasks = !ordersError && pendingOrderCount > 0
        || !materialsError && materialAlerts.length > 0
        || Boolean(ordersError || materialsError);
      const metricsError = ordersError && canViewAnalytics ? ordersError : '';

      this.setData({
        pendingOrderCount: ordersError ? null : pendingOrderCount,
        unreadMessageCount,
        notificationsError: notificationResult.error
          ? notificationResult.error.message || '消息通知暂时无法加载。'
          : '',
        ordersError,
        materialsLoading: false,
        materialsError,
        materialAlertCount: materialsError ? null : materialAlerts.length,
        materialAlertSummary,
        recentLoading: false,
        recentProducts: recentResult.products,
        recentProductsError,
        hasPendingTasks,
        metricsError,
        metrics: canViewAnalytics && !ordersError
          ? [
            { label: '今日销售额', value: money(ordersToday.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0), merchantCurrency) },
            { label: '今日订单', value: String(ordersToday.length) },
            { label: '本月销售额', value: money(ordersThisMonth.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0), merchantCurrency) }
          ]
          : [],
      });
    } catch (error) {
      this.setData({ error: error.message || '工作台数据加载失败，请重试。' });
    } finally {
      this.setData({ loading: false, recentLoading: false, materialsLoading: false });
    }
  },

  async loadRecentProducts(productIds, canViewStock, currency) {
    const results = await Promise.all(productIds.slice(0, 3).map(async id => {
      try {
        const response = await request(`/api/merchant/products/${encodeURIComponent(id)}`);
        return { id, product: response.product || null };
      } catch (error) {
        return { id, error };
      }
    }));
    const products = results.filter(result => result.product).map(result => result.product);
    const fetchErrors = results.filter(result => result.error);
    const missingIds = results.filter(result => !result.product && !result.error).map(result => result.id);
    if (missingIds.length) {
      saveRecentlyViewedProductIds(productIds.filter(id => !missingIds.includes(id)));
    }

    let balances = [];
    let inventoryError = '';
    if (canViewStock && products.length) {
      try {
        balances = await loadMerchantInventoryBalances(products.map(product => product.id));
      } catch (error) {
        inventoryError = error.message || '实时库存暂时无法加载。';
      }
    }
    const quantityByProduct = new Map();
    balances.forEach(balance => {
      const productId = balance.product && balance.product.id || balance.productId;
      if (!productId) return;
      quantityByProduct.set(productId, (quantityByProduct.get(productId) || 0) + Number(balance.availableQuantity || 0));
    });
    const recentProducts = products.map(product => {
      const skus = Array.isArray(product.skus) ? product.skus : [];
      const colors = Array.from(new Set(skus.map(sku => String(sku.color || '').trim()).filter(Boolean)));
      const price = product.wholesalePrice;
      const productCurrency = SUPPORTED_CURRENCIES.includes(product.currency) ? product.currency : currency;
      return {
        id: product.id,
        defaultSku: skus[0] && skus[0].sku || '',
        name: product.name_zh || product.nameZh || product.name || product.title || '未命名商品',
        styleNo: product.styleNo || product.code || '—',
        imageUrl: productImage(product),
        priceText: price == null || price === '' ? '价格待确认' : money(price, productCurrency),
        stockText: inventoryError
          ? '库存暂不可用'
          : canViewStock
            ? `可售 ${quantityByProduct.get(product.id) || 0} 件`
            : '',
        stockError: Boolean(inventoryError),
        variantSummary: `${colors.length} 色 · ${summarizeSizes(skus)}`
      };
    });
    const error = fetchErrors.length && !recentProducts.length
      ? fetchErrors[0].error.message || '最近查看商品暂时无法加载。'
      : fetchErrors.length
        ? `${fetchErrors.length} 款最近查看商品暂时无法加载。`
        : '';
    return { products: recentProducts, error };
  },

  onHomeSearch(event) {
    const productQuery = String(event.detail.value || '');
    this.setData({
      productQuery,
      searchResults: [],
      searchOpen: Boolean(productQuery.trim()),
      searchLoading: Boolean(productQuery.trim()),
      searchError: '',
      selectedSearchIndex: 0
    });
    clearTimeout(this._searchTimer);
    const requestId = (this._searchRequestId || 0) + 1;
    this._searchRequestId = requestId;
    if (!productQuery.trim()) {
      this.setData({ searchOpen: false, searchLoading: false });
      return;
    }
    this._searchTimer = setTimeout(() => this.fetchHomeSearch(productQuery.trim(), requestId), SEARCH_DEBOUNCE_MS);
  },

  async fetchHomeSearch(query, requestId) {
    try {
      if (!Array.isArray(this._searchableProducts)) {
        const response = await request('/api/merchant/products');
        if (!Array.isArray(response.products)) throw new Error('商品数据格式无效，暂时无法搜索。');
        this._searchableProducts = response.products;
      }
      if (requestId !== this._searchRequestId || query !== this.data.productQuery.trim()) return;
      const searchResults = this._searchableProducts
        .filter(product => {
          const skuText = (Array.isArray(product.skus) ? product.skus : [])
            .map(sku => `${sku.sku || ''} ${sku.barcode || ''} ${sku.color || ''} ${sku.size || ''}`)
            .join(' ');
          const searchText = [
            product.name_zh,
            product.nameZh,
            product.name,
            product.title,
            product.styleNo,
            product.code,
            product.brand,
            product.category,
            skuText
          ].filter(Boolean).join(' ').toLocaleLowerCase();
          return searchText.includes(query.toLocaleLowerCase());
        })
        .slice(0, 30)
        .map(product => ({
          id: product.id,
          type: 'product',
          title: product.name_zh || product.nameZh || product.name || product.title || '未命名商品',
          code: product.styleNo || product.code || '—',
          imageUrl: productImage(product)
        }));
      this.setData({
        searchResults,
        searchOpen: true,
        searchLoading: false,
        selectedSearchIndex: 0
      });
    } catch (error) {
      if (requestId !== this._searchRequestId) return;
      this.setData({
        searchResults: [],
        searchOpen: true,
        searchLoading: false,
        searchError: error.message || '搜索暂时不可用，请重试。'
      });
    }
  },

  closeHomeSearch() {
    clearTimeout(this._searchTimer);
    this._searchRequestId = (this._searchRequestId || 0) + 1;
    this.setData({ searchOpen: false, searchLoading: false });
  },

  onSearchConfirm() {
    const result = this.data.searchResults[this.data.selectedSearchIndex] || this.data.searchResults[0];
    if (result) this.openSearchResult({ currentTarget: { dataset: { index: this.data.searchResults.indexOf(result) } } });
  },

  openSearchResult(event) {
    const index = Number(event.currentTarget.dataset.index);
    const result = this.data.searchResults[index];
    if (!result || result.type !== 'product') return;
    this.closeHomeSearch();
    const productId = result.productId || result.id || (result.product && result.product.id);
    if (productId) {
      const sku = result.sku ? `&sku=${encodeURIComponent(result.sku)}` : '';
      wx.navigateTo({ url: `/pages/product-detail/index?id=${encodeURIComponent(productId)}${sku}` });
      return;
    }
    if (result.url) {
      wx.navigateTo({ url: result.url });
      return;
    }
    wx.showToast({ title: '商品详情暂不可用', icon: 'none' });
  },

  openRecentProduct(event) {
    const productId = event.currentTarget.dataset.id;
    const sku = event.currentTarget.dataset.sku;
    if (!productId) return;
    const skuQuery = sku ? `&sku=${encodeURIComponent(sku)}` : '';
    wx.navigateTo({ url: `/pages/product-detail/index?id=${encodeURIComponent(productId)}${skuQuery}` });
  },

  scanProduct() {
    if (!this.data.canViewProducts) return;
    wx.scanCode({
      onlyFromCamera: true,
      scanType: ['barCode'],
      success: result => {
        const productQuery = result.result || '';
        this.setData({ productQuery });
        this.onHomeSearch({ detail: { value: productQuery } });
        if (!productQuery) wx.showToast({ title: '未读取到条码', icon: 'none' });
      },
      fail: error => {
        if (!String(error.errMsg || '').toLowerCase().includes('cancel')) {
          wx.showToast({ title: '扫码失败，请重试', icon: 'none' });
        }
      }
    });
  },

  openProductShortcut(event) {
    const action = event.currentTarget.dataset.action;
    if (action === 'create') {
      if (!this.data.canManageProducts) return;
      wx.navigateTo({ url: '/pages/product-form/index' });
      return;
    }
    if (action === 'stock') {
      if (!this.data.canViewStock) {
        wx.showToast({ title: '当前账号没有库存权限', icon: 'none' });
        return;
      }
      wx.navigateTo({ url: '/pages/workspace/index?id=inventory' });
      return;
    }
    const sort = ['updated', 'price', 'stock'].includes(action) ? action : 'updated';
    wx.setStorageSync('merchantProductsHomeShortcut', { sort, query: '' });
    wx.switchTab({ url: '/pages/products/index' });
  },

  openMaterialAlerts() {
    if (!this.data.canViewMaterials) {
      wx.showToast({ title: '当前账号没有物料库存权限', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/workspace/index?id=materials' });
  },

  openHomeProduct(event) {
    this.openSearchResult(event);
  },

  openTab(event) {
    const tab = event.currentTarget.dataset.tab;
    const urls = {
      products: '/pages/products/index',
      orders: '/pages/orders/index',
      more: '/pages/more/index'
    };
    if (urls[tab]) wx.switchTab({ url: urls[tab] });
  },

  openMessages() {
    if (!this.data.canViewMessages) {
      wx.showToast({ title: '当前账号没有消息权限', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/workspace/index?id=notifications' });
  },

  openBusinessCard() {
    wx.navigateTo({ url: '/pages/business-card/index' });
  },

  toggleWorkMode() {
    if (this.data.loading) return;
    const nextMode = this.data.employeeMode ? 'management' : 'employee';
    if (!setWorkMode(nextMode)) {
      this.setData({ error: '无法切换工作入口，请重新登录。' });
      return;
    }
    this.setData({ loading: false });
    this.loadDashboard();
  },

});

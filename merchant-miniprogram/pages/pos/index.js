const { request } = require('../../utils/api');
const { requireMerchantSession } = require('../../utils/page-auth');
const { loadIndustryContext, hasModule } = require('../../utils/industry');

/**
 * 手机端原生收银台。
 *
 * 规则（与 Web 端 POS 共用同一服务端契约，不在小程序重算金额）：
 * - 商品、价格、库存、折扣、实收金额一律由 `/api/merchant/pos/sales` 计算并返回；
 *   页面上的“预估金额”只用于收银过程中的即时反馈，落单后必须展示服务端返回值。
 * - 门店模式（`inventory.mode === 'store'`）必须选定门店，班次与销售都绑定该门店。
 * - 每次结算携带幂等键；同一购物车重试复用同一幂等键，避免重复出单。
 */

const PAYMENT_METHODS = [
  { value: 'cash', label: '现金' },
  { value: 'card', label: '刷卡' },
  { value: 'other', label: '其他' }
];

const ERROR_MESSAGES = {
  POS_STORE_REQUIRED: '请先选择收银门店。',
  POS_STORE_NOT_SUPPORTED: '当前行业不支持门店收银。',
  POS_SHIFT_REQUIRED: '请先开班后再收款。',
  POS_SHIFT_NOT_OPEN: '班次已结束，请重新开班。',
  POS_SHIFT_STORE_MISMATCH: '班次与收银门店不一致，请重新开班。',
  POS_PAYMENT_CONFIRMATION_REQUIRED: '请确认已收到顾客付款。',
  POS_DISCOUNT_NOT_PERMITTED: '当前账号无折扣权限。',
  POS_PRICE_UNAVAILABLE: '商品缺少零售价，无法收银。',
  STORE_STOCK_INSUFFICIENT: '门店库存不足，请核对后重试。',
  INSUFFICIENT_STOCK: '库存不足，请核对后重试。',
  PRODUCT_NOT_FOUND: '商品已下架或不属于当前商家。',
  PRODUCT_SKU_NOT_FOUND: '规格已失效，请刷新商品。',
  STORE_ACCESS_DENIED: '无权操作该门店。',
  STORE_NOT_FOUND: '门店不存在或已停用。'
};

function readSkus(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function unitPriceOf(product) {
  const retail = Number(product && product.rrpPrice);
  if (Number.isFinite(retail) && retail > 0) return retail;
  const wholesale = Number(product && product.wholesalePrice);
  if (Number.isFinite(wholesale) && wholesale > 0) return wholesale;
  return 0;
}

function money(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
}

Page({
  data: {
    loading: true,
    error: '',
    notice: '',
    storeMode: false,
    storeBound: false,
    stores: [],
    storeIndex: 0,
    storeId: '',
    storeName: '未选择门店',
    shift: null,
    shiftBusy: false,
    openingCash: '',
    closingCash: '',
    requireOpenShift: false,
    products: [],
    keyword: '',
    filteredProducts: [],
    cart: [],
    cartCount: 0,
    estimatedTotal: '0.00',
    paymentMethods: PAYMENT_METHODS,
    paymentMethod: 'cash',
    paymentConfirmed: false,
    submitting: false,
    sales: [],
    selectedSale: null,
    saleRefunds: [],
    saleDetailLoading: false,
    returnBusy: false,
    cashDirection: 'in',
    cashAmount: '',
    cashReason: '',
    cashBusy: false,
    shiftHistoryOpen: false,
    shiftHistoryLoading: false,
    shiftHistory: [],
    selectedHistory: null,
    lastCloseSummary: null
  },

  onLoad() {
    return this.loadPage();
  },

  onShow() {
    if (!this._loadedOnce) return;
    // 返回本页时刷新班次与销售，避免展示过期金额。
    void this.refreshShift();
    void this.loadRecentSales();
  },

  onPullDownRefresh() {
    this.loadPage().finally(() => wx.stopPullDownRefresh());
  },

  async loadPage() {
    this.setData({ loading: true, error: '', notice: '' });
    try {
      const auth = await requireMerchantSession(this);
      if (!auth) return;
      const context = await loadIndustryContext({ force: true });
      if (!hasModule(context, 'pos')) {
        this.setData({ loading: false, error: '当前行业未开通收银模块。' });
        return;
      }
      const storeMode = Boolean(context.inventory && context.inventory.mode === 'store');
      const storeBound = Boolean(context.storeBound && context.storeId);
      const storeId = storeBound ? context.storeId : '';
      this.setData({ storeMode, storeBound, storeId });

      const [settingsResult, productsResult, storesResult] = await Promise.all([
        request('/api/merchant/pos/settings').catch(() => ({ settings: {} })),
        request('/api/merchant/products').catch(error => ({ __error: error })),
        storeMode ? request('/api/merchant/stores').catch(() => ({ stores: [] })) : Promise.resolve({ stores: [] })
      ]);

      const settings = (settingsResult && settingsResult.settings) || {};
      const rawProducts = productsResult && !productsResult.__error && Array.isArray(productsResult.products)
        ? productsResult.products
        : [];
      const products = rawProducts
        .filter(product => !product.lifecycleStatus || product.lifecycleStatus === 'published')
        .map(product => {
          const skus = readSkus(product.skus)
            .filter(sku => sku && typeof sku.sku === 'string' && sku.isActive !== false)
            .map(sku => ({
              sku: sku.sku,
              label: [sku.color, sku.size].filter(Boolean).join(' / ') || sku.sku,
              barcode: sku.barcode || ''
            }));
          return {
            id: product.id,
            name: product.name || '未命名商品',
            styleNo: product.styleNo || '',
            barcode: product.barcode || '',
            price: unitPriceOf(product),
            image: Array.isArray(product.images) ? product.images[0] || '' : '',
            skus
          };
        })
        .filter(product => product.skus.length > 0);

      const activeStores = storeMode && Array.isArray(storesResult.stores)
        ? storesResult.stores.filter(store => store && store.status !== 'inactive')
        : [];
      const initialStore = storeId
        ? activeStores.find(store => store.id === storeId)
        : activeStores[0];
      const resolvedStoreId = initialStore ? initialStore.id : storeId;

      this._loadedOnce = true;
      this.setData({
        loading: false,
        requireOpenShift: Boolean(settings.requireOpenShift),
        products,
        filteredProducts: products,
        stores: activeStores.map(store => ({ id: store.id, name: store.name || store.code || '门店' })),
        storeIndex: Math.max(0, activeStores.findIndex(store => store.id === resolvedStoreId)),
        storeId: resolvedStoreId,
        storeName: initialStore ? (initialStore.name || initialStore.code || '门店') : (storeMode ? '未选择门店' : '中心仓'),
        error: productsResult && productsResult.__error ? '商品加载失败，请下拉重试。' : ''
      });
      if (storeMode && !resolvedStoreId) {
        this.setData({ error: '未找到可用门店，请先在后台维护门店。' });
        return;
      }
      await Promise.all([this.refreshShift(), this.loadRecentSales()]);
    } catch (error) {
      this.setData({ loading: false, error: error.message || '收银台加载失败。' });
    }
  },

  async refreshShift() {
    const storeId = this.data.storeId;
    const query = this.data.storeMode && storeId ? `?storeId=${encodeURIComponent(storeId)}` : '';
    try {
      const response = await request(`/api/merchant/pos/shifts/current${query}`);
      this.setData({ shift: response && response.shift ? response.shift : null });
    } catch (error) {
      this.setData({ shift: null, notice: '班次状态读取失败，请重新开班后再收款。' });
    }
  },

  async loadRecentSales() {
    try {
      const response = await request('/api/merchant/pos/sales');
      const sales = Array.isArray(response && response.sales) ? response.sales.slice(0, 5) : [];
      this.setData({
        sales: sales.map(sale => ({
          id: sale.id,
          saleNo: sale.saleNo || sale.orderNo || '',
          totalLabel: money(sale.totalAmount),
          refundedLabel: money(sale.refundedAmount),
          paymentStatus: sale.paymentStatus || 'paid',
          paymentMethod: sale.paymentMethod || '',
          returnable: sale.returnable === true,
          shiftId: sale.shiftId || '',
          storeName: sale.storeName || '',
          createdAt: String(sale.createdAt || '').replace('T', ' ').slice(0, 16),
          items: Array.isArray(sale.items) ? sale.items.map(item => ({
            productId: item.productId,
            sku: item.sku,
            productName: item.productName || item.styleNo || '商品',
            quantity: Number(item.quantity) || 0,
            unitPrice: money(item.unitPrice),
            returnableQuantity: Number(item.returnableQuantity) || 0
          })) : []
        }))
      });
    } catch (error) {
      this.setData({ sales: [], notice: error.message || '销售记录读取失败，请下拉重试。' });
    }
  },

  async selectSale(event) {
    const sale = this.data.sales.find(row => row.id === event.currentTarget.dataset.saleId);
    if (!sale) return;
    this.setData({ selectedSale: sale, saleRefunds: [], saleDetailLoading: Boolean(sale.shiftId) });
    if (!sale.shiftId) return;
    try {
      const response = await request(`/api/merchant/pos/shifts/${encodeURIComponent(sale.shiftId)}`);
      const refunds = Array.isArray(response && response.refunds)
        ? response.refunds.filter(refund => refund.orderId === sale.id)
        : [];
      this.setData({ saleRefunds: refunds, saleDetailLoading: false });
    } catch (error) {
      this.setData({ saleDetailLoading: false, notice: error.message || '退款记录读取失败，请重试。' });
    }
  },

  copySaleReceipt() {
    const sale = this.data.selectedSale;
    if (!sale) return;
    const itemLines = (sale.items || []).map(item => `${item.productName} ${item.sku} × ${item.quantity} · € ${item.unitPrice}`);
    const lines = [
      `RUDA 收银小票`,
      `单号：${sale.saleNo}`,
      `时间：${sale.createdAt}`,
      sale.storeName ? `门店：${sale.storeName}` : ''
    ].concat(itemLines, [
      `实收：€ ${sale.totalLabel}`,
      `已退款：€ ${sale.refundedLabel}`
    ]).filter(Boolean);
    wx.setClipboardData({
      data: lines.join('\n'),
      success: () => wx.showToast({ title: '小票已复制', icon: 'success' }),
      fail: () => wx.showToast({ title: '小票复制失败', icon: 'none' })
    });
  },

  async returnSaleItem(event) {
    if (this.data.returnBusy) return;
    const sale = this.data.selectedSale;
    const { productId, sku } = event.currentTarget.dataset;
    const item = sale && (sale.items || []).find(row => row.productId === productId && row.sku === sku);
    const quantity = Number(item && item.returnableQuantity);
    if (!sale || !sale.returnable || !item || quantity < 1) return;
    const confirmed = await new Promise(resolve => wx.showModal({
      title: '确认退货退款',
      content: `将退回 ${item.productName}（${item.sku}）${quantity} 件，并按原销售规则核算退款及库存。`,
      confirmText: '确认退货',
      success: result => resolve(Boolean(result.confirm)),
      fail: () => resolve(false)
    }));
    if (!confirmed) return;

    const key = `${sale.id}:${productId}:${sku}`;
    this._returnIdempotencyKeys = this._returnIdempotencyKeys || {};
    if (!this._returnIdempotencyKeys[key]) {
      this._returnIdempotencyKeys[key] = `mp-pos-return-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }
    this.setData({ returnBusy: true, notice: '' });
    try {
      const response = await request('/api/merchant/pos/returns', {
        method: 'POST',
        data: {
          orderId: sale.id,
          reason: '顾客退货',
          refundConfirmed: true,
          idempotencyKey: this._returnIdempotencyKeys[key],
          items: [{ productId, sku, quantity }]
        }
      });
      delete this._returnIdempotencyKeys[key];
      this.setData({
        returnBusy: false,
        notice: `退货已完成，退款 € ${money(response.refundAmount)}；库存已按原销售门店回补。`
      });
      await this.loadRecentSales();
      const updatedSale = this.data.sales.find(row => row.id === sale.id);
      if (updatedSale) {
        await this.selectSale({ currentTarget: { dataset: { saleId: updatedSale.id } } });
      }
    } catch (error) {
      const message = ERROR_MESSAGES[error && error.code] || error.message || '退货失败，请核对订单后重试。';
      this.setData({ returnBusy: false, notice: message });
      wx.showToast({ title: message, icon: 'none' });
    }
  },

  onCashMovementInput(event) {
    const field = event.currentTarget.dataset.field;
    if (field !== 'cashAmount' && field !== 'cashReason') return;
    const update = {};
    update[field] = event.detail.value;
    this.setData(update);
  },

  setCashDirection(event) {
    const direction = event.currentTarget.dataset.direction;
    if (direction === 'in' || direction === 'out') this.setData({ cashDirection: direction });
  },

  async recordCashMovement() {
    const shift = this.data.shift;
    const amount = Number(this.data.cashAmount);
    const reason = String(this.data.cashReason || '').trim();
    if (!shift || !shift.id || this.data.cashBusy) return;
    if (!Number.isFinite(amount) || amount <= 0 || !reason) {
      wx.showToast({ title: '请填写有效金额和原因', icon: 'none' });
      return;
    }
    this.setData({ cashBusy: true, notice: '' });
    try {
      await request(`/api/merchant/pos/shifts/${encodeURIComponent(shift.id)}/cash-movements`, {
        method: 'POST',
        data: {
          direction: this.data.cashDirection,
          amount,
          reason,
          idempotencyKey: `mp-pos-cash-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
        }
      });
      this.setData({ cashBusy: false, cashAmount: '', cashReason: '', notice: '现金流水已记录。' });
      await this.refreshShift();
    } catch (error) {
      const message = ERROR_MESSAGES[error && error.code] || error.message || '现金流水记录失败。';
      this.setData({ cashBusy: false, notice: message });
      wx.showToast({ title: message, icon: 'none' });
    }
  },

  async toggleShiftHistory() {
    const open = !this.data.shiftHistoryOpen;
    this.setData({ shiftHistoryOpen: open, selectedHistory: null });
    if (!open || this.data.shiftHistory.length) return;
    this.setData({ shiftHistoryLoading: true });
    try {
      const query = this.data.storeMode && this.data.storeId
        ? `?storeId=${encodeURIComponent(this.data.storeId)}&status=closed&limit=20`
        : '?status=closed&limit=20';
      const response = await request(`/api/merchant/pos/shifts${query}`);
      this.setData({
        shiftHistory: Array.isArray(response && response.shifts) ? response.shifts : [],
        shiftHistoryLoading: false
      });
    } catch (error) {
      this.setData({ shiftHistoryLoading: false, notice: error.message || '历史班次读取失败，请重试。' });
    }
  },

  async selectHistoryShift(event) {
    const shiftId = event.currentTarget.dataset.shiftId;
    if (!shiftId) return;
    this.setData({ shiftHistoryLoading: true, selectedHistory: null });
    try {
      const response = await request(`/api/merchant/pos/shifts/${encodeURIComponent(shiftId)}`);
      this.setData({ selectedHistory: response, shiftHistoryLoading: false });
    } catch (error) {
      this.setData({ shiftHistoryLoading: false, notice: error.message || '班次明细读取失败，请重试。' });
    }
  },

  onStoreChange(event) {
    const index = Number(event.detail.value) || 0;
    const store = this.data.stores[index];
    if (!store || store.id === this.data.storeId) return;
    this.setData({ storeIndex: index, storeId: store.id, storeName: store.name, shift: null });
    void this.refreshShift();
    void this.loadRecentSales();
    this.setData({ shiftHistory: [], selectedHistory: null });
  },

  onKeywordInput(event) {
    this.applyKeyword(event.detail.value || '');
  },

  applyKeyword(value) {
    const keyword = String(value || '').trim();
    const lowered = keyword.toLowerCase();
    const filtered = keyword
      ? this.data.products.filter(product => (
        product.name.toLowerCase().includes(lowered)
        || product.styleNo.toLowerCase().includes(lowered)
        || product.barcode.toLowerCase().includes(lowered)
      ))
      : this.data.products;
    this.setData({ keyword, filteredProducts: filtered });
    return filtered;
  },

  scanCode() {
    if (typeof wx.scanCode !== 'function') {
      wx.showToast({ title: '当前环境不支持扫码', icon: 'none' });
      return;
    }
    wx.scanCode({
      scanType: ['barCode', 'qrCode'],
      success: result => {
        const code = String((result && result.result) || '').trim();
        if (!code) return;
        const matched = this.applyKeyword(code);
        if (matched.length === 1 && matched[0].skus.length === 1) {
          this.addToCart({
            currentTarget: { dataset: { product: matched[0].id, sku: matched[0].skus[0].sku } }
          });
          return;
        }
        wx.showToast({ title: matched.length ? '请选择具体规格' : '未找到该条码商品', icon: 'none' });
      },
      fail: () => wx.showToast({ title: '扫码已取消', icon: 'none' })
    });
  },

  addToCart(event) {
    const { product: productId, sku } = event.currentTarget.dataset;
    if (!productId || !sku) return;
    const product = this.data.products.find(item => item.id === productId);
    if (!product) return;
    const line = product.skus.find(item => item.sku === sku);
    if (!line) return;
    const key = `${productId}:${sku}`;
    const existing = this.data.cart.find(item => item.key === key);
    const cart = existing
      ? this.data.cart.map(item => (item.key === key ? Object.assign({}, item, { quantity: item.quantity + 1 }) : item))
      : this.data.cart.concat([{
        key,
        productId,
        sku,
        name: product.name,
        variantLabel: line.label,
        unitPrice: product.price,
        quantity: 1
      }]);
    this.applyCart(cart);
  },

  changeQuantity(event) {
    const { key, delta } = event.currentTarget.dataset;
    const step = Number(delta) || 0;
    const cart = this.data.cart
      .map(item => (item.key === key ? Object.assign({}, item, { quantity: item.quantity + step }) : item))
      .filter(item => item.quantity > 0);
    this.applyCart(cart);
  },

  removeLine(event) {
    const key = event.currentTarget.dataset.key;
    this.applyCart(this.data.cart.filter(item => item.key !== key));
  },

  applyCart(cart) {
    // 购物车一旦变化，旧的幂等键必须作废，否则新购物车会被当成上一单的重放。
    this._saleIdempotencyKey = '';
    const estimated = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    this.setData({
      cart,
      cartCount: cart.reduce((sum, item) => sum + item.quantity, 0),
      estimatedTotal: money(estimated)
    });
  },

  onPaymentChange(event) {
    this.setData({ paymentMethod: String(event.detail.value || 'cash') });
  },

  onPaymentConfirmedChange(event) {
    this.setData({ paymentConfirmed: Boolean(event.detail.value) });
  },

  nextIdempotencyKey() {
    if (!this._saleIdempotencyKey) {
      this._saleIdempotencyKey = `mp-pos-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }
    return this._saleIdempotencyKey;
  },

  async submitSale() {
    if (this.data.submitting) return;
    if (!this.data.cart.length) {
      wx.showToast({ title: '请先选择商品', icon: 'none' });
      return;
    }
    if (this.data.storeMode && !this.data.storeId) {
      wx.showToast({ title: '请先选择门店', icon: 'none' });
      return;
    }
    if (this.data.requireOpenShift && !this.data.shift) {
      wx.showToast({ title: '请先开班', icon: 'none' });
      return;
    }
    if (!this.data.paymentConfirmed) {
      wx.showToast({ title: '请确认已收款', icon: 'none' });
      return;
    }
    this.setData({ submitting: true, notice: '' });
    try {
      const payload = {
        items: this.data.cart.map(item => ({ productId: item.productId, sku: item.sku, quantity: item.quantity })),
        paymentMethod: this.data.paymentMethod,
        paymentConfirmed: true,
        idempotencyKey: this.nextIdempotencyKey()
      };
      if (this.data.storeMode && this.data.storeId) payload.storeId = this.data.storeId;
      if (this.data.shift && this.data.shift.id) payload.posShiftId = this.data.shift.id;
      const response = await request('/api/merchant/pos/sales', { method: 'POST', data: payload });
      const sale = (response && response.sale) || {};
      this._saleIdempotencyKey = '';
      this.setData({
        submitting: false,
        cart: [],
        cartCount: 0,
        estimatedTotal: '0.00',
        paymentConfirmed: false
      });
      wx.showModal({
        title: response && response.idempotentReplay ? '该笔销售已入账' : '收款完成',
        content: `单号 ${sale.saleNo || '—'}\n实收 € ${money(sale.totalAmount)}${sale.storeName ? `\n门店 ${sale.storeName}` : ''}`,
        showCancel: false
      });
      await Promise.all([this.refreshShift(), this.loadRecentSales()]);
    } catch (error) {
      const message = ERROR_MESSAGES[error && error.code] || (error && error.message) || '收款失败，请重试。';
      this.setData({ submitting: false, notice: message });
      wx.showToast({ title: message, icon: 'none' });
    }
  },

  onCashInput(event) {
    const field = event.currentTarget.dataset.field;
    if (field !== 'openingCash' && field !== 'closingCash') return;
    const update = {};
    update[field] = event.detail.value;
    this.setData(update);
  },

  async openShift() {
    if (this.data.shiftBusy) return;
    const openingCash = Number(this.data.openingCash);
    if (!Number.isFinite(openingCash) || openingCash < 0) {
      wx.showToast({ title: '请输入正确的备用金', icon: 'none' });
      return;
    }
    this.setData({ shiftBusy: true, notice: '' });
    try {
      const payload = { openingCash };
      if (this.data.storeMode && this.data.storeId) payload.storeId = this.data.storeId;
      const response = await request('/api/merchant/pos/shifts', { method: 'POST', data: payload });
      this.setData({ shiftBusy: false, shift: (response && response.shift) || null, openingCash: '' });
      wx.showToast({ title: '已开班', icon: 'success' });
    } catch (error) {
      const message = ERROR_MESSAGES[error && error.code] || (error && error.message) || '开班失败。';
      this.setData({ shiftBusy: false, notice: message });
      wx.showToast({ title: message, icon: 'none' });
    }
  },

  async closeShift() {
    if (this.data.shiftBusy) return;
    const shift = this.data.shift;
    if (!shift || !shift.id) return;
    const closingCash = Number(this.data.closingCash);
    if (!Number.isFinite(closingCash) || closingCash < 0) {
      wx.showToast({ title: '请输入正确的交班现金', icon: 'none' });
      return;
    }
    this.setData({ shiftBusy: true, notice: '' });
    try {
      const response = await request(`/api/merchant/pos/shifts/${encodeURIComponent(shift.id)}/close`, {
        method: 'POST',
        data: { closingCash }
      });
      const closed = (response && response.shift) || null;
      this.setData({ shiftBusy: false, shift: null, closingCash: '' });
      const expected = closed && closed.expectedCash !== undefined ? Number(closed.expectedCash) : null;
      const difference = expected === null ? null : Number((closingCash - expected).toFixed(2));
      this.setData({
        lastCloseSummary: closed ? {
          expectedCash: expected,
          closingCash,
          difference,
          salesCount: Number(closed.salesCount) || 0,
          cashSales: Number(closed.cashSales) || 0,
          cashRefunds: Number(closed.cashRefunds) || 0
        } : null,
        shiftHistory: [],
        selectedHistory: null
      });
      wx.showModal({
        title: '交班完成',
        content: expected === null
          ? `交班现金 € ${money(closingCash)}`
          : `应交现金 € ${money(expected)}\n实交 € ${money(closingCash)}\n差额 € ${money(difference)}`,
        showCancel: false
      });
    } catch (error) {
      const message = ERROR_MESSAGES[error && error.code] || (error && error.message) || '交班失败。';
      this.setData({ shiftBusy: false, notice: message });
      wx.showToast({ title: message, icon: 'none' });
    }
  }
});

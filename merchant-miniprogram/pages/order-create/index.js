const { request, getAssetUrl } = require('../../utils/api');
const { requireMerchantSession } = require('../../utils/page-auth');
const { canAccessPermissions, canAccessTab } = require('../../utils/permissions');
const { syncTabBar } = require('../../utils/tabbar');

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getUnitPrice(product, customer, mode) {
  const price = mode === 'pos' && !customer
    ? Number(product.rrpPrice || product.wholesalePrice || 0)
    : Number(product.wholesalePrice || 0) * Number(customer && customer.discountRate || 1);
  return Number(price.toFixed(2));
}

function getAvailable(sku) {
  return Math.max(0, Number(sku.stockCentral || 0) - Number(sku.reserved || 0));
}

function makeIdempotencyKey() {
  return `mini-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

Page({
  data: {
    mode: 'wholesale',
    step: 'cart',
    loading: true,
    error: '',
    saving: false,
    products: [],
    visibleProducts: [],
    productQuery: '',
    customers: [],
    visibleCustomers: [],
    customerQuery: '',
    selectedCustomer: null,
    selectedProduct: null,
    skuDrafts: [],
    lines: [],
    note: '',
    paymentMethod: 'bank_transfer',
    paymentConfirmed: false,
    requireOpenShift: false,
    shift: null,
    openingCash: '',
    shiftBusy: false,
    totalQuantity: 0,
    totalAmount: '0.00',
    inStockQuantityTotal: 0,
    preorderQuantityTotal: 0,
    posPaymentMethods: [
      { id: 'bank_transfer', label: '银行转账（待到账）' },
      { id: 'cash', label: '现金（需确认实际收款）' }
    ]
  },

  onLoad(options) {
    const mode = options.mode === 'pos' ? 'pos' : 'wholesale';
    wx.setNavigationBarTitle({ title: mode === 'pos' ? 'POS开单' : '批发开单' });
    this.setData({ mode });
    this.loadFormData();
  },

  async loadFormData() {
    this.setData({ loading: true, error: '' });
    try {
      const auth = await requireMerchantSession(this);
      if (!auth) return;
      if (!canAccessTab(auth, 'orders') || !canAccessPermissions(auth, ['sales.order.create'])) {
        this.setData({ error: '当前账号没有创建销售订单的权限。' });
        return;
      }
      syncTabBar(this, auth, 'orders');
      const initialResults = await Promise.all([
        request('/api/merchant/products?page=1&pageSize=100'),
        request('/api/merchant/customers')
      ]);
      const productResponse = initialResults[0];
      const customerResponse = initialResults[1];
      let products = (productResponse.products || [])
        .filter(product => product.lifecycleStatus === 'published')
        .map(product => Object.assign({}, product, {
          images: asArray(product.images).map(getAssetUrl),
          wholesalePriceLabel: Number(product.wholesalePrice || 0).toFixed(2),
          skus: asArray(product.skus).filter(sku => sku.isActive !== false)
        }))
        .filter(product => product.skus.length > 0);
      const productTotal = Number(productResponse.total || products.length);
      const productPageSize = Number(productResponse.pageSize || 100);
      for (let page = 2; products.length < productTotal && page <= Math.ceil(productTotal / productPageSize); page += 1) {
        const response = await request(`/api/merchant/products?page=${page}&pageSize=${productPageSize}`);
        products = products.concat((response.products || [])
          .filter(product => product.lifecycleStatus === 'published')
          .map(product => Object.assign({}, product, {
            images: asArray(product.images).map(getAssetUrl),
            wholesalePriceLabel: Number(product.wholesalePrice || 0).toFixed(2),
            skus: asArray(product.skus).filter(sku => sku.isActive !== false)
          }))
          .filter(product => product.skus.length > 0));
      }
      const customers = (customerResponse.customers || []).filter(customer =>
        customer.status === 'approved' && customer.merchantStatus !== 'suspended'
      );
      const update = {
        products,
        visibleProducts: products,
        customers,
        visibleCustomers: customers,
        loading: false
      };
      if (this.data.mode === 'pos') {
        const posResults = await Promise.all([
          request('/api/merchant/pos/settings'),
          request('/api/merchant/pos/shifts/current')
        ]);
        const settingsResponse = posResults[0];
        const shiftResponse = posResults[1];
        update.requireOpenShift = Boolean(settingsResponse.settings && settingsResponse.settings.requireOpenShift);
        update.shift = shiftResponse.shift || null;
      }
      this.setData(update);
    } catch (error) {
      this.setData({ loading: false, error: error.message || '订单资料加载失败，请重试。' });
    }
  },

  retryLoad() {
    this.loadFormData();
  },

  exitCreate() {
    wx.navigateBack();
  },

  openProducts() {
    this.setData({ step: 'products', productQuery: '', visibleProducts: this.data.products });
  },

  openCustomerPicker() {
    this.setData({ step: 'customer', customerQuery: '', visibleCustomers: this.data.customers });
  },

  backToCart() {
    this.setData({ step: 'cart', selectedProduct: null, skuDrafts: [] });
  },

  backFromProducts() {
    this.setData({ step: 'cart' });
  },

  backFromCustomer() {
    this.setData({ step: 'cart' });
  },

  backFromReview() {
    this.setData({ step: 'cart' });
  },

  onProductSearch(event) {
    const query = String(event.detail.value || '').trim().toLocaleLowerCase();
    this.setData({
      productQuery: event.detail.value || '',
      visibleProducts: this.data.products.filter(product =>
        `${product.name || ''} ${product.name_zh || ''} ${product.styleNo || ''} ${(product.skus || []).map(sku => sku.sku).join(' ')}`
          .toLocaleLowerCase().includes(query)
      )
    });
  },

  onCustomerSearch(event) {
    const query = String(event.detail.value || '').trim().toLocaleLowerCase();
    this.setData({
      customerQuery: event.detail.value || '',
      visibleCustomers: this.data.customers.filter(customer =>
        `${customer.companyName || ''} ${customer.contactPerson || ''} ${customer.phone || ''}`
          .toLocaleLowerCase().includes(query)
      )
    });
  },

  selectCustomer(event) {
    const customer = this.data.customers.find(item => item.id === event.currentTarget.dataset.id);
    if (!customer) return;
    this.setData({ selectedCustomer: customer, step: 'cart' });
    this.updateTotals(this.data.lines, customer);
  },

  removeCustomer() {
    if (this.data.mode !== 'pos') return;
    this.setData({ selectedCustomer: null });
    this.updateTotals(this.data.lines, null);
  },

  selectWalkInCustomer() {
    if (this.data.mode !== 'pos') return;
    this.setData({ selectedCustomer: null, step: 'cart' });
    this.updateTotals(this.data.lines, null);
  },

  selectProduct(event) {
    const product = this.data.products.find(item => item.id === event.currentTarget.dataset.id);
    if (!product) return;
    const skuDrafts = product.skus.map(sku => {
      const existing = this.data.lines.find(line => line.productId === product.id && line.sku === sku.sku);
      return Object.assign({}, sku, {
        quantityInput: existing ? String(existing.quantity) : '',
        preorderInput: existing ? String(existing.preorderQuantity) : '0',
        availableQuantity: getAvailable(sku)
      });
    });
    this.setData({ selectedProduct: product, skuDrafts, step: 'sku' });
  },

  onSkuInput(event) {
    const { index, field } = event.currentTarget.dataset;
    if (!['quantityInput', 'preorderInput'].includes(field)) return;
    const skuDrafts = this.data.skuDrafts.slice();
    const updatedSku = Object.assign({}, skuDrafts[index]);
    updatedSku[field] = event.detail.value;
    skuDrafts[index] = updatedSku;
    this.setData({ skuDrafts });
  },

  confirmSkuSelection() {
    const product = this.data.selectedProduct;
    if (!product) return;
    const lines = this.data.lines.filter(line => line.productId !== product.id);
    const unitPrice = getUnitPrice(product, this.data.selectedCustomer, this.data.mode);
    const minimum = Number(product.moq || 1);
    const packSize = Math.max(1, Number(product.packSize || 1));
    const invalid = [];
    this.data.skuDrafts.forEach(sku => {
      const quantity = Number(sku.quantityInput || 0);
      const preorderQuantity = this.data.mode === 'pos' ? 0 : Number(sku.preorderInput || 0);
      if (!quantity) return;
      if (!Number.isInteger(quantity) || quantity < 1 || !Number.isInteger(preorderQuantity)
        || preorderQuantity < 0 || preorderQuantity > quantity) {
        invalid.push(`${sku.sku}：数量无效`);
        return;
      }
      if (this.data.mode === 'wholesale' && quantity < minimum) {
        invalid.push(`${sku.sku}：起订量为 ${minimum} 件`);
        return;
      }
      if (this.data.mode === 'wholesale' && quantity % packSize !== 0) {
        invalid.push(`${sku.sku}：数量须为 ${packSize} 件的倍数`);
        return;
      }
      const inStockQuantity = quantity - preorderQuantity;
      if (inStockQuantity > sku.availableQuantity) {
        invalid.push(`${sku.sku}：现货最多 ${sku.availableQuantity} 件`);
        return;
      }
      if (this.data.mode === 'pos' && quantity > sku.availableQuantity) {
        invalid.push(`${sku.sku}：POS 现货最多 ${sku.availableQuantity} 件`);
        return;
      }
      lines.push({
        lineKey: `${product.id}:${sku.sku}`,
        productId: product.id,
        productName: product.name,
        styleNo: product.styleNo,
        image: asArray(product.images)[0] || '',
        sku: sku.sku,
        color: sku.color || '',
        size: sku.size || '',
        quantity,
        inStockQuantity,
        preorderQuantity,
        unitPrice
      });
    });
    if (invalid.length) {
      wx.showToast({ title: invalid[0], icon: 'none' });
      return;
    }
    this.setData({ step: 'cart', selectedProduct: null, skuDrafts: [] });
    this.updateTotals(lines);
  },

  removeLine(event) {
    const { productId, sku } = event.currentTarget.dataset;
    const lines = this.data.lines.filter(line => !(line.productId === productId && line.sku === sku));
    this.updateTotals(lines);
  },

  onNoteInput(event) {
    this.setData({ note: event.detail.value || '' });
  },

  selectPaymentMethod(event) {
    this.setData({ paymentMethod: event.currentTarget.dataset.id, paymentConfirmed: false });
  },

  onPaymentConfirmed(event) {
    this.setData({ paymentConfirmed: Boolean(event.detail.value.length) });
  },

  onOpeningCashInput(event) {
    this.setData({ openingCash: event.detail.value || '' });
  },

  async openPosShift() {
    if (this.data.shiftBusy) return;
    const openingCash = Number(this.data.openingCash || 0);
    if (!Number.isFinite(openingCash) || openingCash < 0) {
      wx.showToast({ title: '请输入有效的备用金金额', icon: 'none' });
      return;
    }
    this.setData({ shiftBusy: true });
    try {
      const response = await request('/api/merchant/pos/shifts', {
        method: 'POST',
        data: { openingCash, note: '小程序 POS 开班' }
      });
      this.setData({ shift: response.shift, openingCash: '' });
      wx.showToast({ title: 'POS 班次已开启', icon: 'success' });
    } catch (error) {
      wx.showToast({ title: error.message || '无法开启 POS 班次', icon: 'none' });
    } finally {
      this.setData({ shiftBusy: false });
    }
  },

  updateTotals(lines) {
    const customer = this.data.selectedCustomer;
    const pricedLines = lines.map(line => {
      const product = this.data.products.find(item => item.id === line.productId);
      const unitPrice = product ? getUnitPrice(product, customer, this.data.mode) : Number(line.unitPrice || 0);
      return Object.assign({}, line, {
        unitPrice,
        lineAmount: (Number(line.quantity || 0) * unitPrice).toFixed(2)
      });
    });
    const totalQuantity = pricedLines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
    const totalAmount = pricedLines.reduce((sum, line) => sum + Number(line.lineAmount || 0), 0);
    const inStockQuantityTotal = pricedLines.reduce((sum, line) => sum + Number(line.inStockQuantity || 0), 0);
    const preorderQuantityTotal = pricedLines.reduce((sum, line) => sum + Number(line.preorderQuantity || 0), 0);
    this.setData({
      lines: pricedLines,
      totalQuantity,
      totalAmount: totalAmount.toFixed(2),
      inStockQuantityTotal,
      preorderQuantityTotal
    });
  },

  continueToReview() {
    if (!this.data.lines.length) {
      wx.showToast({ title: '请先添加商品', icon: 'none' });
      return;
    }
    if (this.data.mode === 'wholesale' && !this.data.selectedCustomer) {
      wx.showToast({ title: '批发订单请先选择客户', icon: 'none' });
      return;
    }
    if (this.data.mode === 'pos' && this.data.requireOpenShift && !this.data.shift) {
      wx.showToast({ title: '请先开启 POS 班次', icon: 'none' });
      return;
    }
    if (this.data.mode === 'pos' && this.data.paymentMethod === 'cash' && !this.data.paymentConfirmed) {
      wx.showToast({ title: '请确认已实际收到现金', icon: 'none' });
      return;
    }
    this.setData({ step: 'review' });
  },

  async submitOrder() {
    if (this.data.saving || !this.data.lines.length) return;
    this.setData({ saving: true, error: '' });
    try {
      const idempotencyKey = this._idempotencyKey || (this._idempotencyKey = makeIdempotencyKey());
      const response = await request('/api/merchant/employee-orders', {
        method: 'POST',
        data: {
          idempotencyKey,
          source: this.data.mode,
          customerId: this.data.selectedCustomer ? this.data.selectedCustomer.id : undefined,
          paymentMethod: this.data.paymentMethod,
          posShiftId: this.data.mode === 'pos' && this.data.shift ? this.data.shift.id : undefined,
          paymentConfirmed: this.data.mode === 'pos' && this.data.paymentMethod === 'cash'
            ? this.data.paymentConfirmed
            : undefined,
          notes: this.data.note.trim(),
          items: this.data.lines.map(line => ({
            productId: line.productId,
            sku: line.sku,
            color: line.color,
            size: line.size,
            quantity: line.quantity,
            inStockQuantity: line.inStockQuantity,
            preorderQuantity: line.preorderQuantity
          }))
        }
      });
      this._idempotencyKey = '';
      wx.showModal({
        title: '订单已创建',
        content: `${response.order.orderNo} · €${Number(response.order.totalAmount || 0).toFixed(2)}`,
        showCancel: false,
        success: () => wx.navigateBack()
      });
    } catch (error) {
      this.setData({ error: error.message || '订单提交失败，已保留当前商品，请检查后重试。' });
    } finally {
      this.setData({ saving: false });
    }
  }
});

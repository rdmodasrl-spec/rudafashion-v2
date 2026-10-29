const { request } = require('../../utils/api');
const { requireMerchantSession } = require('../../utils/page-auth');
const { canAccessPermissions, canAccessTab } = require('../../utils/permissions');
const { syncTabBar } = require('../../utils/tabbar');

const nextStatuses = {
  pending: 'confirmed',
  placed: 'confirmed',
  confirmed: 'picking',
  picking: 'shipped',
  shipped: 'delivered'
};

Page({
  data: {
    orders: [],
    visibleOrders: [],
    orderSummary: null,
    query: '',
    searchOrderIds: null,
    searchLoading: false,
    searchError: '',
    filter: 'all',
    loading: false,
    error: '',
    canFulfillOrders: false,
    canManageReservations: false,
    canCreateShipments: false,
    canManageReservations: false,
    agreementDraft: null,
    agreementSaving: false,
    agreementPaymentPlans: ['full_prepayment', 'ship_before_payment', 'partial_prepayment', 'cash_on_delivery', 'custom'],
    agreementPaymentPlanLabels: ['全额预付', '先发货后付款', '部分预付', '货到付款', '自定义'],
    agreementPaymentMethods: ['bank_transfer', 'credit_card'],
    agreementPaymentMethodLabels: ['银行转账', '银行卡'],
    agreementBalanceTriggers: ['before_shipment', 'on_delivery', 'after_delivery', 'date', 'custom'],
    agreementBalanceTriggerLabels: ['发货前', '货到时', '送达后', '指定日期', '自定义条件'],
    agreementSupplyModes: ['in_stock_first', 'all_ready', 'partial_shipments'],
    agreementSupplyModeLabels: ['现货优先', '齐货后发', '允许分批发货'],
    agreementPrepaymentModeLabels: ['固定金额 (€)', '百分比 (%)'],
    shipmentOrder: null,
    shipmentDraftItems: [],
    shipmentCarrier: '',
    shipmentTrackingNumber: '',
    shipments: [],
    shipmentLoading: false,
    shipmentSaving: false,
    filters: [
      { id: 'all', label: '全部' },
      { id: 'action', label: '待处理' },
      { id: 'shipping', label: '已发货' },
      { id: 'completed', label: '已完成' },
      { id: 'returns', label: '退货' }
    ]
  },

  onShow() {
    this.startDataRefresh();
    let searchQuery = '';
    try {
      searchQuery = wx.getStorageSync('merchantOrdersSearchQuery');
      if (searchQuery) {
        wx.removeStorageSync('merchantOrdersSearchQuery');
        this.setData({ query: String(searchQuery), searchOrderIds: null, filter: 'all' });
      }
    } catch (error) {
      console.warn('Unable to read global order search query', error);
    }
    this.loadOrders();
  },
  onPullDownRefresh() { this.loadOrders().finally(() => wx.stopPullDownRefresh()); },

  startDataRefresh() {
    clearInterval(this._dataRefreshTimer);
    this._dataRefreshTimer = setInterval(() => {
      this.loadOrders({ silent: true });
    }, 30000);
  },

  stopDataRefresh() {
    clearInterval(this._dataRefreshTimer);
    this._dataRefreshTimer = null;
  },

  onHide() {
    this.stopDataRefresh();
    clearTimeout(this._searchTimer);
    this._searchRequestId = (this._searchRequestId || 0) + 1;
  },

  onUnload() {
    this.stopDataRefresh();
    clearTimeout(this._searchTimer);
    this._searchRequestId = (this._searchRequestId || 0) + 1;
  },

  async loadOrders(options) {
    if (this.data.loading) return;
    const silent = Boolean(options && options.silent);
    if (silent) this.setData({ error: '' });
    else this.setData({ loading: true, error: '' });
    try {
      const auth = await requireMerchantSession(this);
      if (!auth) return;
      syncTabBar(this, auth, 'orders');
      const canFulfillOrders = canAccessPermissions(auth, ['warehouse.pick']);
      const canManageReservations = canAccessPermissions(auth, ['sales.order.create']);
      const canCreateShipments = canAccessPermissions(auth, ['warehouse.ship']);
      if (!canAccessTab(auth, 'orders')) {
        this.setData({
          error: '当前账号没有订单处理权限。',
          canFulfillOrders: false,
          canCreateShipments: false,
          orders: [],
          visibleOrders: []
        });
        return;
      }
      this.setData({ canFulfillOrders, canManageReservations, canCreateShipments });
      const response = await request('/api/merchant/orders');
      const orders = (response.orders || []).map(order => Object.assign({}, order, {
        nextStatus: nextStatuses[order.status] || '',
        cancellable: ['placed', 'pending', 'confirmed', 'picking'].includes(order.status),
        currentAgreement: (order.agreementVersions || []).reduce((latest, agreement) =>
          !latest || agreement.version > latest.version ? agreement : latest, null),
        merchantTask: order.currentTasks && order.currentTasks.merchant,
        totalQty: order.totalQty ?? (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0),
        carrierInput: '',
        trackingInput: '',
        statusLabel: order.refundStatus === 'requested' || order.status === 'return_requested'
          ? '退货'
          : ({
          pending: '待确认',
          placed: '待确认',
          confirmed: '待配货',
          picking: '配货中',
          shipped: '已发货',
          delivered: '已送达',
          cancelled: '已取消'
        })[order.status] || order.status
      }));
      orders.forEach(order => {
        if (!order.currentAgreement) return;
        const terms = order.currentAgreement.terms || {};
        order.agreementStatusLabel = ({
          pending_buyer: '待客户确认',
          pending_merchant: '待商家处理',
          active: '已生效',
          superseded: '已更新'
        })[order.currentAgreement.status] || order.currentAgreement.status;
        order.paymentPlanLabel = ({
          full_prepayment: '全额预付',
          ship_before_payment: '先发货后付款',
          partial_prepayment: '部分预付',
          cash_on_delivery: '货到付款',
          custom: '自定义约定'
        })[terms.paymentPlan] || terms.paymentPlan || '';
        order.canReviewAgreement = order.merchantTask && order.merchantTask.action === 'review_agreement';
        order.canProposeAgreement = this.data.canManageReservations
          && ['active', 'pending_merchant'].includes(order.currentAgreement.status);
      });
      const revenue = orders.reduce((sum, order) => {
        const amount = Number(order.totalAmount || 0);
        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0);
      this.setData({
        orders,
        orderSummary: {
          total: orders.length,
          actionCount: orders.filter(order => ['placed', 'pending', 'confirmed', 'picking'].includes(order.status)).length,
          returnCount: orders.filter(order => order.refundStatus === 'requested').length,
          revenue: revenue.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
        }
      });
      this.applyFilter();
    } catch (error) {
      if (!silent) this.setData({ error: error.message || '订单加载失败。' });
    } finally {
      if (!silent) this.setData({ loading: false });
    }
  },

  selectFilter(event) {
    this.setData({ filter: event.currentTarget.dataset.id });
    this.applyFilter();
  },

  createOrder(event) {
    const mode = event.currentTarget.dataset.mode === 'pos' ? 'pos' : 'wholesale';
    wx.navigateTo({ url: `/pages/order-create/index?mode=${mode}` });
  },

  openReservationRequests() {
    wx.navigateTo({ url: '/pages/reservation-requests/index' });
  },

  applyFilter() {
    const query = this.data.query.trim().toLocaleLowerCase();
    const orders = this.data.orders.filter(order => {
      const matchesStatus = this.data.filter === 'all'
        || (this.data.filter === 'action' && ['placed', 'pending', 'confirmed', 'picking'].includes(order.status))
        || (this.data.filter === 'shipping' && order.status === 'shipped')
        || (this.data.filter === 'completed' && ['delivered', 'returned', 'cancelled'].includes(order.status))
        || (this.data.filter === 'returns' && order.refundStatus === 'requested');
      const matchesQuery = !query || (Array.isArray(this.data.searchOrderIds)
        ? this.data.searchOrderIds.includes(order.id)
        : `${order.orderNo || ''} ${order.companyName || ''} ${order.customerCompanyName || ''}`.toLocaleLowerCase().includes(query));
      return matchesStatus && matchesQuery;
    });
    this.setData({ visibleOrders: orders });
  },

  onSearch(event) {
    const query = String(event.detail.value || '').trim();
    this.setData({
      query,
      searchOrderIds: null,
      searchLoading: false,
      searchError: ''
    });
    this.applyFilter();
  },

  onFulfillmentInput(event) {
    if (!this.data.canFulfillOrders) return;
    const { id, field } = event.currentTarget.dataset;
    if (!['carrierInput', 'trackingInput'].includes(field)) return;
    const orders = this.data.orders.map(order => {
      if (order.id !== id) return order;
      const updated = Object.assign({}, order);
      updated[field] = event.detail.value;
      return updated;
    });
    this.setData({ orders });
    this.applyFilter();
  },

  async advanceOrder(event) {
    if (!this.data.canFulfillOrders) return;
    const order = this.data.orders.find(item => item.id === event.currentTarget.dataset.id);
    if (!order || !order.nextStatus) return;
    if (order.nextStatus === 'shipped' && order.deliveryType === 'shipping'
      && (!order.carrierInput.trim() || !order.trackingInput.trim())) {
      wx.showToast({ title: '请填写承运商和物流单号', icon: 'none' });
      return;
    }
    try {
      await request(`/api/merchant/orders/${encodeURIComponent(order.id)}/fulfill`, {
        method: 'PUT',
        data: Object.assign(
          { status: order.nextStatus },
          order.carrierInput.trim() ? { carrier: order.carrierInput.trim() } : {},
          order.trackingInput.trim() ? { trackingNumber: order.trackingInput.trim() } : {}
        )
      });
      wx.showToast({ title: '订单履约状态已更新', icon: 'success' });
      await this.loadOrders();
    } catch (error) {
      const message = error.code === 'MULTI_MERCHANT_SUBORDER_REQUIRED'
        ? '多商家主订单请操作对应的商家子订单。'
        : error.message || '订单状态更新失败。';
      wx.showToast({ title: message, icon: 'none' });
    }
  },

  async cancelOrder(event) {
    if (!this.data.canFulfillOrders) return;
    const order = this.data.orders.find(item => item.id === event.currentTarget.dataset.id);
    if (!order) return;
    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: '取消订单',
        content: `确认取消订单 ${order.orderNo || order.id.slice(0, 8)}？已占用库存会释放，已收款订单将进入退款流程。`,
        confirmText: '取消订单',
        cancelText: '返回',
        success: result => resolve(Boolean(result.confirm)),
        fail: () => resolve(false)
      });
    });
    if (!confirmed) return;
    try {
      await request(`/api/merchant/orders/${encodeURIComponent(order.id)}/fulfill`, {
        method: 'PUT',
        data: { status: 'cancelled', reason: '商家在小程序取消订单' }
      });
      wx.showToast({ title: '订单已取消', icon: 'success' });
      await this.loadOrders();
    } catch (error) {
      const message = error.code === 'ORDER_REFUND_ALREADY_IN_PROGRESS'
        ? '该订单退款正在处理中，不能重复取消。'
        : error.message || '订单取消失败。';
      wx.showToast({ title: message, icon: 'none' });
    }
  },

  async confirmAgreement(event) {
    if (!this.data.canManageReservations) return;
    const order = this.data.orders.find(item => item.id === event.currentTarget.dataset.id);
    const agreement = order && order.currentAgreement;
    if (!order || !agreement || order.merchantTask?.action !== 'review_agreement') return;
    wx.showModal({
      title: '确认交易约定',
      content: `确认接受订单 ${order.orderNo} 的约定版本 ${agreement.version}？`,
      success: async result => {
        if (!result.confirm) return;
        try {
          await request(`/api/merchant/orders/${encodeURIComponent(order.id)}/agreements/${encodeURIComponent(agreement.id)}/confirm`, {
            method: 'POST',
            data: {}
          });
          wx.showToast({ title: '约定已确认', icon: 'success' });
          await this.loadOrders();
        } catch (error) {
          wx.showToast({ title: error.message || '确认失败，请刷新重试', icon: 'none' });
        }
      }
    });
  },

  async confirmBankTransfer(event) {
    if (!this.data.canManageReservations) return;
    const order = this.data.orders.find(item => item.id === event.currentTarget.dataset.id);
    if (!order || !order.bankTransferReference) return;
    wx.showModal({
      title: '核实银行到账',
      content: `请在银行账户中核对实际到账，再确认订单 ${order.orderNo} 的转账。`,
      success: async result => {
        if (!result.confirm) return;
        try {
          await request(`/api/merchant/orders/${encodeURIComponent(order.id)}/confirm-bank-transfer`, {
            method: 'POST',
            data: { paymentReference: order.bankTransferReference }
          });
          wx.showToast({ title: '已核实到账', icon: 'success' });
          await this.loadOrders();
        } catch (error) {
          wx.showToast({ title: error.message || '到账核实失败，请刷新重试', icon: 'none' });
        }
      }
    });
  },

  openAgreementProposal(event) {
    if (!this.data.canManageReservations) return;
    const order = this.data.orders.find(item => item.id === event.currentTarget.dataset.id);
    const agreement = order && order.currentAgreement;
    if (!order || !agreement || !['active', 'pending_merchant'].includes(agreement.status)) return;
    const terms = agreement.terms || {};
    const paymentPlanIndex = Math.max(0, this.data.agreementPaymentPlans.indexOf(terms.paymentPlan));
    const paymentMethodIndex = Math.max(0, this.data.agreementPaymentMethods.indexOf(terms.paymentMethod));
    const remainingBalanceTriggerIndex = Math.max(0, this.data.agreementBalanceTriggers.indexOf(terms.remainingBalanceTrigger));
    const supplyModeIndex = Math.max(0, this.data.agreementSupplyModes.indexOf(terms.supplyMode));
    this.setData({
      agreementDraft: {
        order,
        agreementId: agreement.id,
        paymentPlan: this.data.agreementPaymentPlans[paymentPlanIndex],
        paymentPlanIndex,
        paymentMethod: this.data.agreementPaymentMethods[paymentMethodIndex],
        paymentMethodIndex,
        remainingBalanceTrigger: this.data.agreementBalanceTriggers[remainingBalanceTriggerIndex],
        remainingBalanceTriggerIndex,
        supplyMode: this.data.agreementSupplyModes[supplyModeIndex],
        supplyModeIndex,
        customPaymentCondition: terms.customPaymentCondition || '',
        remainingBalanceDueAt: (terms.remainingBalanceDueAt || '').slice(0, 10),
        expectedDeliveryAt: (terms.expectedDeliveryAt || '').slice(0, 10),
        shippingFee: String(terms.shippingFee || 0),
        discountAmount: String(terms.discountAmount || 0),
        prepaymentMode: 'amount',
        prepaymentValue: String(terms.prepaymentAmount || 0),
        items: (terms.items || order.items || []).map(item => ({
          orderItemId: item.orderItemId || item.id,
          label: item.sku || item.productName || item.orderItemId || item.id,
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice)
        }))
      }
    });
  },

  onAgreementDraftInput(event) {
    const { field, index } = event.currentTarget.dataset;
    const draft = this.data.agreementDraft;
    if (!draft || !field) return;
    if (field === 'quantity' || field === 'unitPrice') {
      this.setData({
        'agreementDraft.items': draft.items.map((item, itemIndex) => {
          if (itemIndex !== Number(index)) return item;
          const updatedItem = Object.assign({}, item);
          updatedItem[field] = event.detail.value;
          return updatedItem;
        })
      });
      return;
    }
    // Mini program tooling rejects computed object keys, so the dynamic field is assigned explicitly.
    const fieldUpdate = {};
    fieldUpdate[`agreementDraft.${field}`] = event.detail.value;
    this.setData(fieldUpdate);
  },

  onAgreementPickerChange(event) {
    const field = event.currentTarget.dataset.field;
    const index = Number(event.detail.value);
    const pickerFields = {
      paymentPlan: ['agreementPaymentPlans', 'agreementPaymentPlanIndex'],
      paymentMethod: ['agreementPaymentMethods', 'agreementPaymentMethodIndex'],
      remainingBalanceTrigger: ['agreementBalanceTriggers', 'agreementBalanceTriggerIndex'],
      supplyMode: ['agreementSupplyModes', 'agreementSupplyModeIndex']
    };
    const config = pickerFields[field];
    if (!config || !Number.isInteger(index)) return;
    const value = this.data[config[0]][index];
    const pickerUpdate = {};
    pickerUpdate[`agreementDraft.${field}`] = value;
    pickerUpdate[`agreementDraft.${config[1]}`] = index;
    this.setData(pickerUpdate);
  },

  onAgreementPrepaymentModeChange(event) {
    this.setData({ 'agreementDraft.prepaymentMode': Number(event.detail.value) === 1 ? 'percent' : 'amount' });
  },

  async submitAgreementProposal() {
    if (!this.data.canManageReservations || this.data.agreementSaving) return;
    const draft = this.data.agreementDraft;
    if (!draft) return;
    const items = draft.items.map(item => ({
      orderItemId: item.orderItemId,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice)
    }));
    const prepaymentValue = Number(draft.prepaymentValue);
    const shippingFee = Number(draft.shippingFee);
    const discountAmount = Number(draft.discountAmount);
    if (!items.length || items.some(item => !Number.isInteger(item.quantity) || item.quantity < 1
      || !Number.isFinite(item.unitPrice) || item.unitPrice <= 0)
      || !Number.isFinite(prepaymentValue) || prepaymentValue < 0
      || !Number.isFinite(shippingFee) || shippingFee < 0
      || !Number.isFinite(discountAmount) || discountAmount < 0) {
      wx.showToast({ title: '请检查商品数量、价格及付款金额', icon: 'none' });
      return;
    }
    if ((draft.paymentPlan === 'custom' || draft.remainingBalanceTrigger === 'custom')
      && !draft.customPaymentCondition.trim()) {
      wx.showToast({ title: '请填写自定义余款条件', icon: 'none' });
      return;
    }
    if (draft.remainingBalanceTrigger === 'date' && !draft.remainingBalanceDueAt) {
      wx.showToast({ title: '请选择余款日期', icon: 'none' });
      return;
    }
    const terms = {
      paymentPlan: draft.paymentPlan,
      paymentMethod: draft.paymentMethod,
      remainingBalanceTrigger: draft.remainingBalanceTrigger,
      remainingBalanceDueAt: draft.remainingBalanceDueAt || null,
      customPaymentCondition: draft.customPaymentCondition || null,
      supplyMode: draft.supplyMode,
      expectedDeliveryAt: draft.expectedDeliveryAt || null,
      shippingFee,
      discountAmount,
      items
    };
    // Mini program tooling rejects spread helpers, so optional terms are assigned explicitly.
    if (draft.paymentPlan === 'partial_prepayment') {
      if (draft.prepaymentMode === 'percent') terms.prepaymentPercent = prepaymentValue;
      else terms.prepaymentAmount = prepaymentValue;
    } else if (draft.paymentPlan === 'custom' && prepaymentValue > 0) {
      terms.prepaymentAmount = prepaymentValue;
    }
    this.setData({ agreementSaving: true });
    try {
      await request(`/api/merchant/orders/${encodeURIComponent(draft.order.id)}/agreements`, {
        method: 'POST',
        data: { agreementId: draft.agreementId, terms }
      });
      this.setData({ agreementDraft: null });
      wx.showToast({ title: '新方案已发送', icon: 'success' });
      await this.loadOrders();
    } catch (error) {
      wx.showToast({ title: error.message || '提案失败，请刷新重试', icon: 'none' });
    } finally {
      this.setData({ agreementSaving: false });
    }
  },

  closeAgreementProposal() {
    if (!this.data.agreementSaving) this.setData({ agreementDraft: null });
  },

  async beginPartialShipment(event) {
    if (!this.data.canCreateShipments) return;
    const order = this.data.orders.find(item => item.id === event.currentTarget.dataset.id);
    if (!order || !['confirmed', 'picking'].includes(order.status)) return;
    this.setData({
      shipmentOrder: order,
      shipmentDraftItems: [],
      shipmentCarrier: '',
      shipmentTrackingNumber: '',
      shipments: [],
      shipmentLoading: true,
      error: ''
    });
    try {
      const result = await request(`/api/merchant/orders/${encodeURIComponent(order.id)}/shipments`);
      const shipments = result.shipments || [];
      const shippedByItem = new Map();
      for (const shipment of shipments) {
        if (!['shipped', 'delivered', 'exception'].includes(shipment.status)) continue;
        for (const item of shipment.items || []) {
          shippedByItem.set(item.orderItemId, (shippedByItem.get(item.orderItemId) || 0) + Number(item.quantity || 0));
        }
      }
      const shipmentDraftItems = (order.items || []).map(item => {
        const remaining = Math.max(0, Number(item.quantity || 0) - (shippedByItem.get(item.id) || 0));
        return Object.assign({}, item, { remaining, shipmentQuantity: remaining ? String(remaining) : '' });
      });
      this.setData({ shipments, shipmentDraftItems });
    } catch (error) {
      this.setData({ error: error.message || '包裹信息加载失败。', shipmentOrder: null });
    } finally {
      this.setData({ shipmentLoading: false });
    }
  },

  cancelPartialShipment() {
    this.setData({
      shipmentOrder: null,
      shipmentDraftItems: [],
      shipmentCarrier: '',
      shipmentTrackingNumber: '',
      shipments: []
    });
  },

  onShipmentInput(event) {
    if (!this.data.canCreateShipments) return;
    const field = event.currentTarget.dataset.field;
    if (field === 'carrier' || field === 'trackingNumber') {
      const targetField = field === 'carrier' ? 'shipmentCarrier' : 'shipmentTrackingNumber';
      const update = {};
      update[targetField] = event.detail.value;
      this.setData(update);
      return;
    }
    if (field === 'shipmentQuantity') {
      const id = event.currentTarget.dataset.id;
      this.setData({
        shipmentDraftItems: this.data.shipmentDraftItems.map(item => {
          if (item.id !== id) return item;
          return Object.assign({}, item, { shipmentQuantity: event.detail.value });
        })
      });
    }
  },

  async submitPartialShipment() {
    if (!this.data.canCreateShipments) return;
    const order = this.data.shipmentOrder;
    const carrier = this.data.shipmentCarrier.trim();
    const trackingNumber = this.data.shipmentTrackingNumber.trim();
    const items = this.data.shipmentDraftItems
      .filter(item => item.shipmentQuantity !== '')
      .map(item => ({ orderItemId: item.id, quantity: Number(item.shipmentQuantity) }));
    if (!order || !carrier || !trackingNumber || !items.length
      || items.some(item => !Number.isInteger(item.quantity) || item.quantity <= 0
        || item.quantity > (this.data.shipmentDraftItems.find(draft => draft.id === item.orderItemId)?.remaining || 0))) {
      wx.showToast({ title: '请填写承运商、物流单号及有效的本次发货数量', icon: 'none' });
      return;
    }
    this.setData({ shipmentSaving: true });
    try {
      await request(`/api/merchant/orders/${encodeURIComponent(order.id)}/shipments`, {
        method: 'POST',
        data: { carrier, trackingNumber, items }
      });
      wx.showToast({ title: '包裹已创建', icon: 'success' });
      this.cancelPartialShipment();
      await this.loadOrders();
    } catch (error) {
      wx.showToast({ title: error.message || '创建包裹失败，请刷新后重试', icon: 'none' });
    } finally {
      this.setData({ shipmentSaving: false });
    }
  }
});

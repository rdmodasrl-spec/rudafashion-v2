const { request } = require('../../utils/api');
const { requireMerchantSession } = require('../../utils/page-auth');
const { canAccessPermissions } = require('../../utils/permissions');

const emptyForm = () => ({
  id: '',
  counterpartyId: '',
  name: '',
  contactName: '',
  phone: '',
  email: '',
  country: 'Italy',
  city: '',
  address: '',
  vatNumber: '',
  leadTimeDays: '14',
  notes: ''
});

function text(value) {
  return value === undefined || value === null ? '' : String(value);
}

function matchesQuery(item, query) {
  const counterparty = item.counterparty || {};
  const haystack = [
    item.companyName, item.name, item.contactPerson, item.contactName, item.phone, item.email,
    item.city, item.country, counterparty.city, counterparty.companyName
  ].map(text).join(' ').toLocaleLowerCase();
  return !query || haystack.includes(query);
}

Page({
  data: {
    activeTab: 'customers',
    loading: false,
    saving: false,
    error: '',
    customerError: '',
    supplierError: '',
    canManageCustomer: false,
    canManageSupplier: false,
    customers: [],
    suppliers: [],
    customerStats: { total: 0, linked: 0 },
    supplierStats: { total: 0, linked: 0 },
    counterparties: [],
    visibleCustomers: [],
    visibleSuppliers: [],
    customerQuery: '',
    supplierQuery: '',
    selectedDetail: null,
    detailStats: [],
    detailOrders: [],
    detailPurchaseOrders: [],
    detailLoading: false,
    detailError: '',
    editorOpen: false,
    editorMode: 'create',
    formRole: 'customer',
    form: emptyForm(),
    linkCandidates: [],
    linkCandidateIndex: 0
  },

  onLoad() {
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().finally(() => wx.stopPullDownRefresh());
  },

  onShow() {
    if (this._loaded) this.loadData();
  },

  selectTab(event) {
    const activeTab = event.currentTarget.dataset.tab;
    if (!['customers', 'suppliers'].includes(activeTab)) return;
    this.setData({ activeTab, selectedDetail: null, editorOpen: false });
    this.applySearch(activeTab);
  },

  async loadData() {
    if (this._loading) return;
    this._loading = true;
    this.setData({ loading: true, error: '', customerError: '', supplierError: '' });
    try {
      const auth = await requireMerchantSession(this);
      if (!auth) {
        this.setData({ loading: false });
        return;
      }
      const canManageCustomer = canAccessPermissions(auth, ['sales.order.create']);
      const canManageSupplier = canAccessPermissions(auth, ['purchase.manage']);
      this.setData({ canManageCustomer, canManageSupplier });
      if (!canManageCustomer && !canManageSupplier) {
        this.setData({ error: '当前账号没有查看往来单位的权限。' });
        return;
      }
      const results = await Promise.all([
        request('/api/merchant/counterparties').catch(error => ({ error })),
        canManageCustomer
          ? request('/api/merchant/customers').catch(error => ({ error }))
          : Promise.resolve({ customers: [] }),
        canManageSupplier
          ? request('/api/merchant/suppliers').catch(error => ({ error }))
          : Promise.resolve({ suppliers: [] })
      ]);
      const counterpartyResult = results[0];
      const customerResult = results[1];
      const supplierResult = results[2];
      if (counterpartyResult.error) throw counterpartyResult.error;
      const counterparties = counterpartyResult.counterparties || [];
      const customers = customerResult.error ? [] : (customerResult.customers || []).map(item =>
        Object.assign({}, item, { counterparty: item.counterparty || {} })
      );
      const suppliers = supplierResult.error ? [] : (supplierResult.suppliers || []).map(item =>
        Object.assign({}, item, { counterparty: item.counterparty || {} })
      );
      const customerError = customerResult.error
        ? customerResult.error.message || '客户列表加载失败。'
        : !canManageCustomer ? '当前账号没有客户管理权限。' : '';
      const supplierError = supplierResult.error
        ? supplierResult.error.message || '供应商列表加载失败。'
        : !canManageSupplier ? '当前账号没有供应商管理权限。' : '';
      this._loaded = true;
      this.setData({
        counterparties,
        customers,
        suppliers,
        customerStats: {
          total: customers.length,
          linked: customers.filter(item => Boolean(item.counterpartyId)).length
        },
        supplierStats: {
          total: suppliers.length,
          linked: suppliers.filter(item => Boolean(item.counterpartyId)).length
        },
        customerError,
        supplierError,
        loading: false
      });
      this.applySearch('customers');
      this.applySearch('suppliers');
    } catch (error) {
      this.setData({ loading: false, error: error.message || '往来单位加载失败，请重试。' });
    } finally {
      this.setData({ loading: false });
      this._loading = false;
    }
  },

  retry() {
    this.loadData();
  },

  onSearch(event) {
    const role = event.currentTarget.dataset.role;
    const query = text(event.detail.value);
    if (role === 'customers') this.setData({ customerQuery: query });
    else if (role === 'suppliers') this.setData({ supplierQuery: query });
    else return;
    this.applySearch(role);
  },

  clearSearch(event) {
    const role = event.currentTarget.dataset.role;
    if (role === 'customers') this.setData({ customerQuery: '' });
    else if (role === 'suppliers') this.setData({ supplierQuery: '' });
    else return;
    this.applySearch(role);
  },

  noop() {},

  applySearch(role) {
    if (role === 'customers') {
      const query = this.data.customerQuery.trim().toLocaleLowerCase();
      this.setData({ visibleCustomers: this.data.customers.filter(item => matchesQuery(item, query)) });
    } else {
      const query = this.data.supplierQuery.trim().toLocaleLowerCase();
      this.setData({ visibleSuppliers: this.data.suppliers.filter(item => matchesQuery(item, query)) });
    }
  },

  openCreateCustomer() {
    if (!this.data.canManageCustomer) return;
    const candidates = [{ id: '', companyName: '不关联，创建新档案' }]
      .concat(this.data.counterparties.filter(item => !item.customerLink));
    this.openEditor('customer', 'create', null, candidates);
  },

  openCreateSupplier() {
    if (!this.data.canManageSupplier) return;
    const candidates = [{ id: '', companyName: '不关联，创建新档案' }]
      .concat(this.data.counterparties.filter(item => !item.supplier));
    this.openEditor('supplier', 'create', null, candidates);
  },

  editItem(event) {
    const role = event.currentTarget.dataset.role;
    const id = event.currentTarget.dataset.id;
    const items = role === 'customers' ? this.data.customers : this.data.suppliers;
    const item = items.find(row => row.id === id);
    if (!item) return;
    const form = role === 'customers'
      ? Object.assign(emptyForm(), {
          id: item.id,
          counterpartyId: item.counterpartyId || '',
          name: item.companyName || item.name || '',
          contactName: item.contactPerson || '',
          phone: item.phone || '',
          email: item.email || '',
          country: item.country || 'Italy',
          city: item.city || '',
          address: item.address || '',
          vatNumber: item.vatNumber || '',
          notes: item.merchantNotes || ''
        })
      : Object.assign(emptyForm(), {
          id: item.id,
          counterpartyId: item.counterpartyId || '',
          name: item.name || (item.counterparty && item.counterparty.companyName) || '',
          contactName: item.contactName || '',
          phone: item.phone || '',
          email: item.email || '',
          country: item.country || 'Italy',
          city: item.counterparty && item.counterparty.city || '',
          address: item.counterparty && item.counterparty.address || '',
          vatNumber: item.counterparty && item.counterparty.vatNumber || '',
          leadTimeDays: String(item.leadTimeDays || 0),
          notes: item.notes || ''
        });
    this.setData({
      selectedDetail: null,
      editorOpen: true,
      editorMode: 'edit',
      formRole: role === 'customers' ? 'customer' : 'supplier',
      form,
      linkCandidates: [],
      linkCandidateIndex: 0
    });
  },

  openEditor(role, mode, form, candidates) {
    this.setData({
      selectedDetail: null,
      editorOpen: true,
      editorMode: mode,
      formRole: role,
      form: form || emptyForm(),
      linkCandidates: candidates || [],
      linkCandidateIndex: 0,
      error: ''
    });
  },

  onFormInput(event) {
    const field = event.currentTarget.dataset.field;
    const allowed = ['name', 'contactName', 'phone', 'email', 'country', 'city', 'address', 'vatNumber', 'leadTimeDays', 'notes'];
    if (!allowed.includes(field)) return;
    const form = Object.assign({}, this.data.form);
    form[field] = event.detail.value;
    this.setData({ form });
  },

  onLinkCandidateChange(event) {
    const index = Number(event.detail.value);
    if (!Number.isInteger(index) || index < 0 || index >= this.data.linkCandidates.length) return;
    const candidate = this.data.linkCandidates[index];
    if (!candidate.id) {
      this.setData({
        linkCandidateIndex: index,
        form: Object.assign({}, this.data.form, {
          counterpartyId: '',
          name: '',
          contactName: '',
          phone: '',
          email: '',
          country: 'Italy',
          city: '',
          address: '',
          vatNumber: ''
        })
      });
      return;
    }
    const form = Object.assign({}, this.data.form, {
      counterpartyId: candidate.id,
      name: candidate.companyName || '',
      contactName: candidate.contactName || '',
      phone: candidate.phone || '',
      email: candidate.email || '',
      country: candidate.country || 'Italy',
      city: candidate.city || '',
      address: candidate.address || '',
      vatNumber: candidate.vatNumber || ''
    });
    this.setData({ linkCandidateIndex: index, form });
  },

  cancelEditor() {
    this.setData({ editorOpen: false, form: emptyForm(), error: '' });
  },

  async saveCounterparty() {
    if (this.data.saving) return;
    const form = this.data.form;
    if (!form.name.trim()) {
      wx.showToast({ title: '请填写公司名称', icon: 'none' });
      return;
    }
    if (this.data.formRole === 'customer' && !form.phone.trim()) {
      wx.showToast({ title: '客户联系电话为必填项', icon: 'none' });
      return;
    }
    const payload = {
      companyName: form.name.trim(),
      contactPerson: form.contactName.trim(),
      contactName: form.contactName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      country: form.country.trim() || 'Italy',
      city: form.city.trim(),
      address: form.address.trim(),
      vatNumber: form.vatNumber.trim(),
      notes: form.notes.trim()
    };
    this.setData({ saving: true, error: '' });
    try {
      if (this.data.formRole === 'customer') {
        if (this.data.editorMode === 'edit') {
          await request(`/api/merchant/customers/${encodeURIComponent(form.id)}`, {
            method: 'PUT',
            data: Object.assign({}, payload, {
              businessType: 'Boutique',
              customerLevel: 'new_customer',
              merchantNotes: form.notes.trim()
            })
          });
        } else {
          await request('/api/merchant/customers', {
            method: 'POST',
            data: Object.assign({}, payload, {
              counterpartyId: form.counterpartyId || undefined,
              businessType: 'Boutique',
              customerLevel: 'new_customer',
              merchantNotes: form.notes.trim()
            })
          });
        }
      } else if (this.data.editorMode === 'edit') {
        await request(`/api/merchant/suppliers/${encodeURIComponent(form.id)}`, {
          method: 'PATCH',
          data: {
            name: form.name.trim(),
            contactName: form.contactName.trim(),
            phone: form.phone.trim(),
            email: form.email.trim(),
            country: form.country.trim() || 'Italy',
            city: form.city.trim(),
            address: form.address.trim(),
            vatNumber: form.vatNumber.trim(),
            leadTimeDays: Number(form.leadTimeDays || 0),
            notes: form.notes.trim()
          }
        });
      } else {
        await request('/api/merchant/suppliers', {
          method: 'POST',
          data: {
            counterpartyId: form.counterpartyId || undefined,
            name: form.name.trim(),
            contactName: form.contactName.trim(),
            phone: form.phone.trim(),
            email: form.email.trim(),
            country: form.country.trim() || 'Italy',
            city: form.city.trim(),
            address: form.address.trim(),
            vatNumber: form.vatNumber.trim(),
            leadTimeDays: Number(form.leadTimeDays || 0),
            notes: form.notes.trim()
          }
        });
      }
      const wasEdit = this.data.editorMode === 'edit';
      this.setData({ editorOpen: false, form: emptyForm() });
      wx.showToast({ title: wasEdit ? '单位资料已更新' : '单位已添加', icon: 'success' });
      await this.loadData();
    } catch (error) {
      this.setData({ error: error.message || '保存失败，请检查资料后重试。' });
    } finally {
      this.setData({ saving: false });
    }
  },

  async openDetail(event) {
    const role = event.currentTarget.dataset.role;
    const id = event.currentTarget.dataset.id;
    const list = role === 'customers' ? this.data.customers : this.data.suppliers;
    const item = list.find(row => row.id === id);
    if (!item) return;
    this.setData({
      selectedDetail: { role, item },
      detailStats: [],
      detailOrders: [],
      detailPurchaseOrders: [],
      detailLoading: true,
      detailError: '',
      editorOpen: false
    });
    try {
      if (role === 'customers') {
        const result = await request('/api/merchant/orders');
        const orders = (result.orders || []).filter(order => order.customerId === item.id);
        const totalAmount = orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
        const lastOrder = orders.slice().sort((first, second) =>
          Date.parse(second.createdAt || '') - Date.parse(first.createdAt || ''))[0];
        this.setData({
          detailOrders: orders,
          detailStats: [
            { label: '累计订单', value: String(orders.length) },
            { label: '累计金额', value: `€${totalAmount.toFixed(2)}` },
            { label: '最近下单', value: lastOrder && lastOrder.createdAt ? text(lastOrder.createdAt).slice(0, 10) : '—' }
          ]
        });
      } else {
        const result = await request('/api/merchant/purchase-orders');
        const purchaseOrders = (result.purchaseOrders || [])
          .filter(order => order.supplierId === item.id)
          .map(order => Object.assign({}, order, {
            displayAmount: (order.items || []).reduce((sum, line) =>
              sum + Number(line.orderedQuantity || 0) * Number(line.unitCost || 0), 0).toFixed(2)
          }));
        const totalAmount = purchaseOrders.reduce((sum, order) => sum + Number(order.displayAmount || 0), 0);
        const lastOrder = purchaseOrders.slice().sort((first, second) =>
          Date.parse(second.createdAt || '') - Date.parse(first.createdAt || ''))[0];
        this.setData({
          detailPurchaseOrders: purchaseOrders,
          detailStats: [
            { label: '采购订单', value: String(purchaseOrders.length) },
            { label: '采购金额', value: `€${totalAmount.toFixed(2)}` },
            { label: '最近采购', value: lastOrder && lastOrder.createdAt ? text(lastOrder.createdAt).slice(0, 10) : '—' }
          ]
        });
      }
    } catch (error) {
      this.setData({ detailError: error.message || '往来记录加载失败。' });
    } finally {
      this.setData({ detailLoading: false });
    }
  },

  closeDetail() {
    this.setData({ selectedDetail: null, detailStats: [], detailOrders: [], detailPurchaseOrders: [], detailError: '' });
  }
});

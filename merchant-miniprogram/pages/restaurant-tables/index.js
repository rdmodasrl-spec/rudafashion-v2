const { request } = require('../../utils/api');
const { requireMerchantSession } = require('../../utils/page-auth');
const { loadIndustryContext, hasModule, hasPermission } = require('../../utils/industry');

function requestKey() {
  return `restaurant-table-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function errorMessage(error, fallback) {
  const messages = {
    RESTAURANT_TABLE_VERSION_CONFLICT: '桌台资料已被更新，请检查最新信息后重试。',
    RESTAURANT_TABLE_CODE_CONFLICT: '该门店已存在此桌号，请更换桌号。',
    IDEMPOTENCY_KEY_REUSED: '请求状态不确定，请刷新桌台列表后确认结果。',
    STORE_ACCESS_DENIED: '你没有访问所选门店的权限。',
    EMPLOYEE_PERMISSION_REQUIRED: '当前员工没有管理桌台的权限。',
    RESTAURANT_INDUSTRY_REQUIRED: '当前账号没有餐饮工作区权限。',
    RESTAURANT_MODULE_DISABLED: '当前商家未开通桌台目录。',
    INDUSTRY_MODULE_UNAVAILABLE: '当前商家未开通桌台目录。'
  };
  if (error && typeof error.code === 'string' && messages[error.code]) return messages[error.code];
  return error && typeof error.message === 'string' && error.message
    ? error.message
    : fallback;
}

Page({
  data: {
    loading: true,
    busy: false,
    error: '',
    notice: '',
    stores: [],
    storeId: '',
    storeIndex: 0,
    tables: [],
    canManageTables: false,
    showForm: false,
    code: '',
    name: '',
    capacity: '2',
    area: '',
    editingTableId: '',
    editName: '',
    editCapacity: '',
    editArea: '',
    busyTableId: ''
  },

  async onLoad() {
    const auth = await requireMerchantSession(this);
    if (!auth) return;
    try {
      const context = await loadIndustryContext({ force: true });
      if (context.templateId !== 'restaurant_ordering' || !hasModule(context, 'restaurant_tables')) {
        this.setData({ loading: false, error: '当前商家没有餐饮桌台目录权限。' });
        return;
      }
      this._authorized = true;
      this.setData({ canManageTables: hasPermission(context, 'employees.manage') });
      await this.reload();
      this._loadedOnce = true;
    } catch (error) {
      this.setData({ loading: false, error: errorMessage(error, '餐饮桌台权限验证失败，请重试。') });
    }
  },

  onShow() {
    if (this._authorized && this._loadedOnce) void this.reload();
  },

  async reload() {
    if (!this._authorized) return;
    this.setData({ loading: true, error: '', notice: '' });
    try {
      const result = await request('/api/merchant/restaurant/table-stores');
      const stores = Array.isArray(result.stores) ? result.stores : [];
      const storeIndex = Math.max(0, stores.findIndex(store => store.id === this.data.storeId));
      const storeId = stores[storeIndex] ? stores[storeIndex].id : '';
      this.setData({ stores, storeId, storeIndex, tables: [], editingTableId: '' });
      if (storeId) await this.loadTables(storeId);
    } catch (error) {
      this.setData({ stores: [], storeId: '', tables: [], error: errorMessage(error, '门店列表读取失败，请重试。') });
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadTables(storeId) {
    const requestId = (this._tableLoadSequence || 0) + 1;
    this._tableLoadSequence = requestId;
    if (!storeId) {
      this.setData({ tables: [], error: '' });
      return;
    }
    try {
      const result = await request(`/api/merchant/restaurant/tables?storeId=${encodeURIComponent(storeId)}`);
      if (requestId === this._tableLoadSequence && this.data.storeId === storeId) {
        this.setData({ tables: Array.isArray(result.tables) ? result.tables : [] });
      }
    } catch (error) {
      if (requestId === this._tableLoadSequence && this.data.storeId === storeId) {
        this.setData({ tables: [], error: errorMessage(error, '桌台列表读取失败，请重试。') });
      }
    }
  },

  onStoreChange(event) {
    const storeIndex = Number(event.detail.value);
    const store = this.data.stores[storeIndex];
    if (!store) return;
    this.setData({
      storeIndex,
      storeId: store.id,
      tables: [],
      editingTableId: '',
      error: '',
      notice: ''
    });
    void this.loadTables(store.id);
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field;
    const value = event.detail.value;
    if (field === 'code') this.setData({ code: value });
    else if (field === 'name') this.setData({ name: value });
    else if (field === 'capacity') this.setData({ capacity: value });
    else if (field === 'area') this.setData({ area: value });
  },

  toggleForm() {
    this.setData({
      showForm: !this.data.showForm,
      code: '',
      name: '',
      capacity: '2',
      area: '',
      error: '',
      notice: ''
    });
  },

  async createTable() {
    if (!this.data.canManageTables || !this.data.storeId || this.data.busy) return;
    const payload = {
      storeId: this.data.storeId,
      code: this.data.code,
      name: this.data.name,
      capacity: Number(this.data.capacity),
      area: this.data.area
    };
    const fingerprint = JSON.stringify(payload);
    if (!this._createRequest || this._createRequest.fingerprint !== fingerprint) {
      this._createRequest = { fingerprint, key: requestKey() };
    }
    this.setData({ busy: true, error: '', notice: '' });
    try {
      await request('/api/merchant/restaurant/tables', {
        method: 'POST',
        data: payload,
        headers: { 'Idempotency-Key': this._createRequest.key }
      });
      this._createRequest = null;
      this.setData({
        showForm: false,
        code: '',
        name: '',
        capacity: '2',
        area: '',
        notice: '桌台已保存。'
      });
      await this.loadTables(this.data.storeId);
    } catch (error) {
      this.setData({ error: errorMessage(error, '桌台创建失败，请重试。') });
    } finally {
      this.setData({ busy: false });
    }
  },

  beginEdit(event) {
    if (!this.data.canManageTables) return;
    const table = this.data.tables.find(item => item.id === event.currentTarget.dataset.id);
    if (!table) return;
    this.setData({
      editingTableId: table.id,
      editName: table.name,
      editCapacity: String(table.capacity),
      editArea: table.area || '',
      error: ''
    });
  },

  onEditInput(event) {
    const field = event.currentTarget.dataset.field;
    const value = event.detail.value;
    if (field === 'editName') this.setData({ editName: value });
    else if (field === 'editCapacity') this.setData({ editCapacity: value });
    else if (field === 'editArea') this.setData({ editArea: value });
  },

  cancelEdit() {
    this.setData({ editingTableId: '' });
  },

  async saveEdit() {
    if (!this.data.canManageTables || this.data.busyTableId) return;
    const table = this.data.tables.find(item => item.id === this.data.editingTableId);
    if (!table) return;
    this.setData({ busyTableId: table.id, error: '' });
    try {
      await request(`/api/merchant/restaurant/tables/${encodeURIComponent(table.id)}`, {
        method: 'PATCH',
        data: {
          expectedVersion: table.version,
          name: this.data.editName,
          capacity: Number(this.data.editCapacity),
          area: this.data.editArea
        }
      });
      this.setData({ editingTableId: '', notice: '桌台资料已更新。' });
      await this.loadTables(this.data.storeId);
    } catch (error) {
      this.setData({ error: errorMessage(error, '桌台保存失败，请刷新后重试。') });
      if (error && error.code === 'RESTAURANT_TABLE_VERSION_CONFLICT') {
        this.setData({ editingTableId: '' });
        await this.loadTables(this.data.storeId);
      }
    } finally {
      this.setData({ busyTableId: '' });
    }
  },

  async toggleStatus(event) {
    if (!this.data.canManageTables || this.data.busyTableId) return;
    const table = this.data.tables.find(item => item.id === event.currentTarget.dataset.id);
    if (!table) return;
    const nextStatus = table.status === 'active' ? 'inactive' : 'active';
    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: nextStatus === 'active' ? '启用桌台' : '停用桌台',
        content: `确认${nextStatus === 'active' ? '启用' : '停用'}桌台 ${table.code}？`,
        success: result => resolve(result.confirm === true),
        fail: () => resolve(false)
      });
    });
    if (!confirmed) return;
    this.setData({ busyTableId: table.id, error: '', notice: '' });
    try {
      await request(`/api/merchant/restaurant/tables/${encodeURIComponent(table.id)}`, {
        method: 'PATCH',
        data: { expectedVersion: table.version, status: nextStatus }
      });
      this.setData({ notice: `桌台已${nextStatus === 'active' ? '启用' : '停用'}。` });
      await this.loadTables(this.data.storeId);
    } catch (error) {
      this.setData({ error: errorMessage(error, '桌台状态更新失败，请刷新后重试。') });
      if (error && error.code === 'RESTAURANT_TABLE_VERSION_CONFLICT') {
        await this.loadTables(this.data.storeId);
      }
    } finally {
      this.setData({ busyTableId: '' });
    }
  },

  retry() {
    return this.reload();
  }
});

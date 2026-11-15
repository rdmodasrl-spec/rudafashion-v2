const { request } = require('../../utils/api');
const { requireMerchantSession } = require('../../utils/page-auth');
const { loadIndustryContext, hasModule, hasPermission } = require('../../utils/industry');

function requestKey() {
  return `restaurant-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function errorMessage(error, fallback) {
  const messages = {
    RESTAURANT_INGREDIENT_CODE_ALREADY_EXISTS: '原料编码已存在，请更换编码。',
    RESTAURANT_INGREDIENT_INPUT_INVALID: '原料资料不完整或格式无效，请检查编码、单位和阈值。',
    RESTAURANT_RECIPE_INPUT_INVALID: '配方资料不完整或格式无效，请检查产出、原料用量和损耗率。',
    RESTAURANT_INGREDIENT_NOT_FOUND: '原料不存在或不属于当前餐厅，请刷新原料目录。',
    RESTAURANT_MENU_ACTIVE_RECIPE_REQUIRED: '菜单中的每道菜都需要先激活有效配方。',
    RESTAURANT_MENU_EMPTY: '空菜单不能发布，请先添加菜品。',
    RESTAURANT_MENU_VERSION_CONFLICT: '菜单已被其他操作更新，请刷新后确认最新状态。',
    RESTAURANT_RECIPE_VERSION_CONFLICT: '配方已被其他操作更新，请刷新后重试。',
    RESTAURANT_PURCHASE_REFERENCE_NOT_FOUND: '供应商或原料已不可用，请刷新后重新选择。',
    RESTAURANT_PURCHASE_ORDER_VERSION_CONFLICT: '采购单已被其他员工更新，请刷新后核对实际收货状态。',
    RESTAURANT_PURCHASE_ORDER_CONCURRENT_CHANGE: '采购单已被其他员工更新，请刷新后核对实际收货状态。',
    RESTAURANT_PURCHASE_ORDER_STATE_INVALID: '当前采购单状态不支持此操作，请刷新后确认。',
    RESTAURANT_PURCHASE_RECEIPT_INPUT_INVALID: '收货资料无效，请核对实收数量和发票单价。',
    RESTAURANT_PURCHASE_RECEIPT_LINES_INVALID: '收货数量超出未收数量，请核对到货记录。',
    RESTAURANT_STORE_INVENTORY_NOT_CONFIGURED: '当前员工绑定的门店尚未配置独立原料仓；请由总部账号登记收货。',
    EMPLOYEE_PERMISSION_REQUIRED: '当前员工没有执行此操作的权限。'
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
    menus: [],
    dishes: [],
    ingredients: [],
    recipes: [],
    menu: null,
    showMenuForm: false,
    showDishForm: false,
    showIngredientForm: false,
    showRecipeForm: false,
    canManagePurchases: false,
    showProcurement: false,
    procurementLoaded: false,
    procurementLoading: false,
    procurementError: '',
    procurementNotice: '',
    suppliers: [],
    activeSuppliers: [],
    purchaseOrders: [],
    purchaseSupplierId: '',
    purchaseSupplierIndex: -1,
    purchaseCurrency: 'EUR',
    purchaseNotes: '',
    purchaseItems: [{ ingredientId: '', ingredientIndex: -1, orderedQuantity: '', quotedUnitCost: '' }],
    receivingOrderId: '',
    receiptItems: [],
    menuName: '',
    currency: 'EUR',
    dishName: '',
    dishCategory: '',
    dishDescription: '',
    dishId: '',
    dishIndex: -1,
    price: '',
    ingredientCode: '',
    ingredientName: '',
    ingredientCategory: 'produce',
    ingredientUnit: 'kg',
    ingredientReorderPoint: '0',
    ingredientLeadTimeDays: '0',
    ingredientAllergens: '',
    ingredientCategories: [
      { value: 'produce', label: '蔬果' }, { value: 'meat', label: '肉类' },
      { value: 'seafood', label: '水产' }, { value: 'dairy', label: '乳制品' },
      { value: 'grain', label: '谷物' }, { value: 'seasoning', label: '调味料' },
      { value: 'beverage', label: '饮品' }, { value: 'packaging', label: '包装' },
      { value: 'other', label: '其他' }
    ],
    ingredientCategoryIndex: 0,
    ingredientUnits: [
      { value: 'g', label: '克 (g)' }, { value: 'kg', label: '千克 (kg)' },
      { value: 'ml', label: '毫升 (ml)' }, { value: 'l', label: '升 (l)' },
      { value: 'piece', label: '件 (piece)' }
    ],
    ingredientUnitIndex: 1,
    recipeDishId: '',
    recipeDishIndex: -1,
    recipeDishes: [],
    recipeYieldQuantity: '1',
    recipeYieldUnit: 'portion',
    recipeYieldUnits: [
      { value: 'portion', label: '份' }, { value: 'piece', label: '件' }, { value: 'batch', label: '批次' }
    ],
    recipeYieldUnitIndex: 0,
    recipeNotes: '',
    recipeItems: [{ ingredientId: '', ingredientIndex: -1, quantity: '', wasteRate: '0' }],
    costResult: null
  },

  async onLoad() {
    const auth = await requireMerchantSession(this);
    if (!auth) return;
    try {
      const context = await loadIndustryContext({ force: true });
      if (context.templateId !== 'restaurant_ordering' || !hasModule(context, 'restaurant_menu')) {
        this.setData({ loading: false, error: '当前商家没有餐饮菜单工作区权限。' });
        return;
      }
      if (!hasPermission(context, 'product.import.draft')) {
        this.setData({ loading: false, error: '当前员工没有维护餐饮菜单的权限。' });
        return;
      }
      this.setData({ canManagePurchases: hasPermission(context, 'purchase.manage') });
      this._authorized = true;
      await this.reload();
      this._loadedOnce = true;
    } catch (error) {
      this.setData({ loading: false, error: errorMessage(error, '餐饮菜单权限验证失败，请重试。') });
    }
  },

  onShow() {
    if (this._authorized && this._loadedOnce) void this.reload();
  },

  async reload(preferredMenuId) {
    if (!this._authorized) return;
    this.setData({ loading: true, error: '' });
    try {
      const [menuResult, dishResult, ingredientResult] = await Promise.all([
        request('/api/merchant/restaurant/menus?limit=100'),
        request('/api/merchant/restaurant/dishes?limit=100'),
        request('/api/merchant/restaurant/ingredients?limit=100')
      ]);
      const menus = Array.isArray(menuResult.menus) ? menuResult.menus : [];
      const dishes = Array.isArray(dishResult.dishes) ? dishResult.dishes : [];
      const ingredients = Array.isArray(ingredientResult.ingredients)
        ? ingredientResult.ingredients.map(item => Object.assign({}, item, {
          pickerName: `${item.material.name} (${item.material.unit})`,
          allergenLabel: Array.isArray(item.allergens) && item.allergens.length ? item.allergens.join(', ') : '未登记'
        }))
        : [];
      const selectedId = preferredMenuId
        || menus.find(item => item.id === (this.data.menu && this.data.menu.id))?.id
        || (menus[0] && menus[0].id);
      const recipeDishes = dishes.filter(item => item.status !== 'archived');
      const selectedRecipeDish = recipeDishes.some(item => item.id === this.data.recipeDishId)
        ? this.data.recipeDishId
        : (recipeDishes[0] || {}).id || '';
      this.setData({
        menus, dishes, ingredients, recipeDishes, recipeDishId: selectedRecipeDish,
        recipeDishIndex: recipeDishes.findIndex(item => item.id === selectedRecipeDish)
      });
      if (selectedRecipeDish) await this.loadRecipes(selectedRecipeDish);
      else this.setData({ recipes: [], recipeDishIndex: -1, costResult: null });
      if (selectedId) await this.loadMenu(selectedId);
      else this.setData({ menu: null, dishId: '', dishIndex: -1 });
    } catch (error) {
      this.setData({ error: errorMessage(error, '菜单资料读取失败，请重试。') });
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadProcurement() {
    if (!this._authorized || !this.data.canManagePurchases) return;
    this.setData({ procurementLoading: true, procurementError: '' });
    try {
      const [supplierResult, orderResult] = await Promise.all([
        request('/api/merchant/suppliers'),
        request('/api/merchant/restaurant/purchase-orders?page=1&pageSize=50')
      ]);
      const suppliers = Array.isArray(supplierResult.suppliers) ? supplierResult.suppliers : [];
      const activeSuppliers = suppliers.filter(item => item.status === 'active');
      const purchaseSupplierId = this.data.purchaseSupplierId
        || ((activeSuppliers[0] || {}).id || '');
      this.setData({
        suppliers,
        activeSuppliers,
        purchaseOrders: Array.isArray(orderResult.purchaseOrders) ? orderResult.purchaseOrders : [],
        purchaseSupplierId,
        purchaseSupplierIndex: activeSuppliers.findIndex(item => item.id === purchaseSupplierId),
        procurementLoaded: true,
        procurementError: ''
      });
    } catch (error) {
      this.setData({ procurementError: errorMessage(error, '采购资料读取失败，请确认采购权限后重试。') });
    } finally {
      this.setData({ procurementLoading: false });
    }
  },

  toggleProcurement() {
    if (!this.data.canManagePurchases) {
      this.setData({ error: '当前员工没有餐饮采购权限。' });
      return;
    }
    const opening = !this.data.showProcurement;
    this.setData({ showProcurement: opening, procurementError: '', procurementNotice: '' });
    if (opening && !this.data.procurementLoaded && !this.data.procurementLoading) void this.loadProcurement();
  },

  onPurchaseSupplierChange(event) {
    const index = Number(event.detail.value);
    const supplier = this.data.activeSuppliers[index];
    if (supplier) this.setData({ purchaseSupplierId: supplier.id, purchaseSupplierIndex: index });
  },

  onPurchaseCurrencyInput(event) {
    this.setData({ purchaseCurrency: String(event.detail.value || '').toUpperCase() });
  },

  onPurchaseNotesInput(event) {
    this.setData({ purchaseNotes: event.detail.value });
  },

  onPurchaseIngredientChange(event) {
    const rowIndex = Number(event.currentTarget.dataset.index);
    const ingredientIndex = Number(event.detail.value);
    const ingredient = this.data.ingredients[ingredientIndex];
    if (!ingredient) return;
    const purchaseItems = this.data.purchaseItems.map((item, index) => index === rowIndex
      ? Object.assign({}, item, { ingredientId: ingredient.id, ingredientIndex })
      : item);
    this.setData({ purchaseItems });
  },

  onPurchaseItemInput(event) {
    const rowIndex = Number(event.currentTarget.dataset.index);
    const field = event.currentTarget.dataset.field;
    if (!['orderedQuantity', 'quotedUnitCost'].includes(field)) return;
    const value = String(event.detail.value || '').replace(',', '.');
    const purchaseItems = this.data.purchaseItems.map((item, index) => index === rowIndex
      ? Object.assign({}, item, field === 'orderedQuantity' ? { orderedQuantity: value } : { quotedUnitCost: value })
      : item);
    this.setData({ purchaseItems });
  },

  addPurchaseItem() {
    if (this.data.purchaseItems.length >= 100) return;
    this.setData({ purchaseItems: this.data.purchaseItems.concat({ ingredientId: '', ingredientIndex: -1, orderedQuantity: '', quotedUnitCost: '' }) });
  },

  removePurchaseItem(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (this.data.purchaseItems.length <= 1) return;
    this.setData({ purchaseItems: this.data.purchaseItems.filter((_, rowIndex) => rowIndex !== index) });
  },

  async submitPurchaseOrder(event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    if (this.data.busy) return;
    const items = this.data.purchaseItems.map(item => ({
      ingredientId: item.ingredientId,
      orderedQuantity: String(item.orderedQuantity || '').trim(),
      quotedUnitCost: String(item.quotedUnitCost || '').trim()
    }));
    const supplier = this.data.suppliers.find(item => item.id === this.data.purchaseSupplierId && item.status === 'active');
    if (!supplier || !/^[A-Z]{3}$/.test(this.data.purchaseCurrency)
      || items.some(item => !item.ingredientId || !item.orderedQuantity || !item.quotedUnitCost)
      || new Set(items.map(item => item.ingredientId)).size !== items.length) {
      this.setData({ procurementError: '请填写有效供应商、币种、原料数量和报价；同一原料只保留一行。' });
      return;
    }
    const payload = {
      supplierId: supplier.id,
      currency: this.data.purchaseCurrency,
      notes: String(this.data.purchaseNotes || '').trim(),
      items
    };
    const fingerprint = JSON.stringify(payload);
    if (!this._createPurchaseOrderRequest || this._createPurchaseOrderRequest.fingerprint !== fingerprint) {
      this._createPurchaseOrderRequest = { fingerprint, key: requestKey() };
    }
    this.setData({ busy: true, procurementError: '', procurementNotice: '' });
    try {
      await request('/api/merchant/restaurant/purchase-orders', {
        method: 'POST',
        data: payload,
        headers: { 'Idempotency-Key': this._createPurchaseOrderRequest.key }
      });
      this._createPurchaseOrderRequest = null;
      this.setData({
        purchaseNotes: '',
        purchaseItems: [{ ingredientId: '', ingredientIndex: -1, orderedQuantity: '', quotedUnitCost: '' }],
        procurementNotice: '采购草稿已保存；提交后才能登记实际收货。'
      });
      await this.loadProcurement();
    } catch (error) {
      this.setData({ procurementError: errorMessage(error, '采购草稿保存失败；可安全重试。') });
    } finally {
      this.setData({ busy: false });
    }
  },

  async submitPurchase(event) {
    const order = this.data.purchaseOrders.find(item => item.id === event.currentTarget.dataset.id);
    if (!order || this.data.busy) return;
    if (!await this.confirmAction('提交采购单', `确认向 ${order.supplier.name} 提交采购单？`)) return;
    this.setData({ busy: true, procurementError: '', procurementNotice: '' });
    try {
      await request(`/api/merchant/restaurant/purchase-orders/${encodeURIComponent(order.id)}/submit`, {
        method: 'POST',
        data: { expectedVersion: order.version }
      });
      this.setData({ procurementNotice: '采购单已提交。收到货物后，请按实际数量和发票单价登记收货。' });
      await this.loadProcurement();
    } catch (error) {
      this.setData({ procurementError: errorMessage(error, '采购单提交失败，请刷新确认最新状态。') });
    } finally {
      this.setData({ busy: false });
    }
  },

  beginReceipt(event) {
    const order = this.data.purchaseOrders.find(item => item.id === event.currentTarget.dataset.id);
    if (!order) return;
    const receiptItems = order.items
      .filter(item => Number(item.orderedQuantity) > Number(item.receivedQuantity))
      .map(item => ({
        itemId: item.id,
        ingredientNameSnapshot: item.ingredientNameSnapshot,
        unitSnapshot: item.unitSnapshot,
        remainingQuantity: Number(item.orderedQuantity) - Number(item.receivedQuantity),
        quantity: '',
        unitCost: ''
      }));
    this.setData({
      receivingOrderId: order.id,
      receiptItems,
      procurementError: '',
      procurementNotice: ''
    });
  },

  onReceiptItemInput(event) {
    const rowIndex = Number(event.currentTarget.dataset.index);
    const field = event.currentTarget.dataset.field;
    if (!['quantity', 'unitCost'].includes(field)) return;
    const value = String(event.detail.value || '').replace(',', '.');
    const receiptItems = this.data.receiptItems.map((item, index) => index === rowIndex
      ? Object.assign({}, item, field === 'quantity' ? { quantity: value } : { unitCost: value })
      : item);
    this.setData({ receiptItems });
  },

  async submitReceipt() {
    const order = this.data.purchaseOrders.find(item => item.id === this.data.receivingOrderId);
    if (!order || this.data.busy) return;
    const items = this.data.receiptItems
      .filter(item => item.quantity || item.unitCost)
      .map(item => ({ itemId: item.itemId, quantity: item.quantity, unitCost: item.unitCost }));
    if (!items.length || items.some(item => !item.quantity || !item.unitCost
      || !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0
      || !Number.isFinite(Number(item.unitCost)) || Number(item.unitCost) < 0)) {
      this.setData({ procurementError: '请至少登记一项实际收货，并填写核对后的到货数量和发票单价。' });
      return;
    }
    const payload = { expectedVersion: order.version, note: '', items };
    const fingerprint = JSON.stringify(Object.assign({ orderId: order.id }, payload));
    if (!this._createReceiptRequest || this._createReceiptRequest.fingerprint !== fingerprint) {
      this._createReceiptRequest = { fingerprint, key: requestKey() };
    }
    this.setData({ busy: true, procurementError: '', procurementNotice: '' });
    try {
      await request(`/api/merchant/restaurant/purchase-orders/${encodeURIComponent(order.id)}/receipts`, {
        method: 'POST',
        data: payload,
        headers: { 'Idempotency-Key': this._createReceiptRequest.key }
      });
      this._createReceiptRequest = null;
      this.setData({
        receivingOrderId: '',
        receiptItems: [],
        procurementNotice: '实际收货已保存；库存与成本来源已由服务端更新。'
      });
      await Promise.all([this.loadProcurement(), this.reload()]);
    } catch (error) {
      this.setData({ procurementError: errorMessage(error, '收货未确认成功。请刷新采购单后再试，避免重复登记。') });
    } finally {
      this.setData({ busy: false });
    }
  },

  cancelReceipt() {
    this.setData({ receivingOrderId: '', receiptItems: [] });
  },

  async loadMenu(menuId) {
    try {
      const result = await request(`/api/merchant/restaurant/menus/${encodeURIComponent(menuId)}`);
      this.setData({ menu: result.menu, error: '' });
    } catch (error) {
      this.setData({ error: errorMessage(error, '菜单详情读取失败，请重试。') });
    }
  },

  async loadRecipes(dishId) {
    if (!dishId) {
      this.setData({ recipes: [], costResult: null });
      return;
    }
    try {
      const result = await request(`/api/merchant/restaurant/dishes/${encodeURIComponent(dishId)}/recipes?limit=100`);
      this.setData({ recipes: Array.isArray(result.recipes) ? result.recipes : [], costResult: null });
    } catch (error) {
      this.setData({ error: errorMessage(error, '配方历史读取失败，请重试。') });
    }
  },

  retry() {
    return this.reload();
  },

  selectMenu(event) {
    const menuId = event.currentTarget.dataset.id;
    if (menuId) void this.loadMenu(menuId);
  },

  toggleMenuForm() {
    this.setData({
      showMenuForm: !this.data.showMenuForm,
      showDishForm: false,
      error: '',
      notice: ''
    });
  },

  toggleDishForm() {
    this.setData({
      showDishForm: !this.data.showDishForm,
      showMenuForm: false,
      error: '',
      notice: ''
    });
  },

  toggleIngredientForm() {
    this.setData({
      showIngredientForm: !this.data.showIngredientForm,
      showMenuForm: false,
      showDishForm: false,
      showRecipeForm: false,
      error: '',
      notice: ''
    });
  },

  toggleRecipeForm() {
    this.setData({
      showRecipeForm: !this.data.showRecipeForm,
      showIngredientForm: false,
      showMenuForm: false,
      showDishForm: false,
      error: '',
      notice: ''
    });
  },

  onMenuInput(event) {
    this.setData({ menuName: event.detail.value });
  },

  onCurrencyInput(event) {
    this.setData({ currency: String(event.detail.value || '').toUpperCase() });
  },

  onDishInput(event) {
    const field = event.currentTarget.dataset.field;
    const value = event.detail.value;
    if (field === 'dishName') this.setData({ dishName: value });
    else if (field === 'dishCategory') this.setData({ dishCategory: value });
    else if (field === 'dishDescription') this.setData({ dishDescription: value });
  },

  onDishSelect(event) {
    const index = Number(event.detail.value);
    const dish = this.data.dishes[index];
    this.setData({ dishIndex: index, dishId: dish ? dish.id : '' });
  },

  onPriceInput(event) {
    this.setData({ price: String(event.detail.value || '').replace(',', '.') });
  },

  onIngredientInput(event) {
    const field = event.currentTarget.dataset.field;
    const fields = {
      ingredientCode: String(event.detail.value || '').toUpperCase(),
      ingredientName: event.detail.value,
      ingredientReorderPoint: event.detail.value,
      ingredientLeadTimeDays: event.detail.value,
      ingredientAllergens: event.detail.value
    };
    if (field === 'ingredientCode') this.setData({ ingredientCode: fields.ingredientCode });
    else if (field === 'ingredientName') this.setData({ ingredientName: fields.ingredientName });
    else if (field === 'ingredientReorderPoint') this.setData({ ingredientReorderPoint: fields.ingredientReorderPoint });
    else if (field === 'ingredientLeadTimeDays') this.setData({ ingredientLeadTimeDays: fields.ingredientLeadTimeDays });
    else if (field === 'ingredientAllergens') this.setData({ ingredientAllergens: fields.ingredientAllergens });
  },

  onIngredientCategoryChange(event) {
    const index = Number(event.detail.value);
    const category = this.data.ingredientCategories[index];
    if (category) this.setData({ ingredientCategoryIndex: index, ingredientCategory: category.value });
  },

  onIngredientUnitChange(event) {
    const index = Number(event.detail.value);
    const unit = this.data.ingredientUnits[index];
    if (unit) this.setData({ ingredientUnitIndex: index, ingredientUnit: unit.value });
  },

  onRecipeDishChange(event) {
    const index = Number(event.detail.value);
    const dish = this.data.recipeDishes[index];
    if (!dish) return;
    this.setData({ recipeDishId: dish.id, recipeDishIndex: index, recipeItems: [{ ingredientId: '', ingredientIndex: -1, quantity: '', wasteRate: '0' }] });
    void this.loadRecipes(dish.id);
  },

  onRecipeYieldInput(event) {
    this.setData({ recipeYieldQuantity: String(event.detail.value || '').replace(',', '.') });
  },

  onRecipeNotesInput(event) {
    this.setData({ recipeNotes: event.detail.value });
  },

  onRecipeYieldUnitChange(event) {
    const index = Number(event.detail.value);
    const unit = this.data.recipeYieldUnits[index];
    if (unit) this.setData({ recipeYieldUnitIndex: index, recipeYieldUnit: unit.value });
  },

  onRecipeIngredientChange(event) {
    const rowIndex = Number(event.currentTarget.dataset.index);
    const ingredientIndex = Number(event.detail.value);
    const ingredient = this.data.ingredients[ingredientIndex];
    if (!ingredient) return;
    const recipeItems = this.data.recipeItems.map((item, index) => index === rowIndex
      ? Object.assign({}, item, { ingredientId: ingredient.id, ingredientIndex })
      : item);
    this.setData({ recipeItems });
  },

  onRecipeItemInput(event) {
    const rowIndex = Number(event.currentTarget.dataset.index);
    const field = event.currentTarget.dataset.field;
    if (!['quantity', 'wasteRate'].includes(field)) return;
    const value = String(event.detail.value || '').replace(',', '.');
    const recipeItems = this.data.recipeItems.map((item, index) => index === rowIndex
      ? Object.assign({}, item, field === 'quantity' ? { quantity: value } : { wasteRate: value })
      : item);
    this.setData({ recipeItems });
  },

  addRecipeItem() {
    this.setData({ recipeItems: this.data.recipeItems.concat({ ingredientId: '', ingredientIndex: -1, quantity: '', wasteRate: '0' }) });
  },

  removeRecipeItem(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (this.data.recipeItems.length <= 1) return;
    this.setData({ recipeItems: this.data.recipeItems.filter((_, rowIndex) => rowIndex !== index) });
  },

  async confirmAction(title, content) {
    if (typeof wx.showModal !== 'function') return false;
    return new Promise(resolve => {
      wx.showModal({
        title,
        content,
        confirmText: '确认',
        cancelText: '取消',
        success: result => resolve(Boolean(result.confirm)),
        fail: () => {
          this.setData({ error: '确认窗口未能打开，操作未执行，请重试。' });
          resolve(false);
        }
      });
    });
  },

  async submitMenu(event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    if (this.data.busy) return;
    const payload = { name: this.data.menuName.trim(), currency: this.data.currency.trim().toUpperCase() };
    const fingerprint = JSON.stringify(payload);
    if (!payload.name || !/^[A-Z]{3}$/.test(payload.currency)) {
      this.setData({ error: '请填写菜单名称和 3 位币种代码。' });
      return;
    }
    if (!this._createMenuRequest || this._createMenuRequest.fingerprint !== fingerprint) {
      this._createMenuRequest = { fingerprint, key: requestKey() };
    }
    this.setData({ busy: true, error: '', notice: '' });
    try {
      const result = await request('/api/merchant/restaurant/menus', {
        method: 'POST',
        data: payload,
        headers: { 'Idempotency-Key': this._createMenuRequest.key }
      });
      this._createMenuRequest = null;
      this.setData({ showMenuForm: false, menuName: '', notice: '菜单草稿已保存。' });
      await this.reload(result.menu && result.menu.id);
    } catch (error) {
      this.setData({ error: errorMessage(error, '菜单创建失败，请重试。') });
    } finally {
      this.setData({ busy: false });
    }
  },

  async submitDish(event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    if (this.data.busy) return;
    const payload = {
      name: this.data.dishName.trim(),
      nameZh: this.data.dishName.trim(),
      category: this.data.dishCategory.trim(),
      description: this.data.dishDescription.trim()
    };
    const fingerprint = JSON.stringify(payload);
    if (!payload.name) {
      this.setData({ error: '请填写菜品名称。' });
      return;
    }
    if (!this._createDishRequest || this._createDishRequest.fingerprint !== fingerprint) {
      this._createDishRequest = { fingerprint, key: requestKey() };
    }
    this.setData({ busy: true, error: '', notice: '' });
    try {
      await request('/api/merchant/restaurant/dishes', {
        method: 'POST',
        data: payload,
        headers: { 'Idempotency-Key': this._createDishRequest.key }
      });
      this._createDishRequest = null;
      this.setData({
        showDishForm: false,
        dishName: '',
        dishCategory: '',
        dishDescription: '',
        notice: '菜品资料已保存为草稿。'
      });
      await this.reload();
    } catch (error) {
      this.setData({ error: errorMessage(error, '菜品创建失败，请重试。') });
    } finally {
      this.setData({ busy: false });
    }
  },

  async addDish() {
    if (!this.data.menu || !this.data.dishId || this.data.busy) return;
    this.setData({ busy: true, error: '', notice: '' });
    try {
      await request(`/api/merchant/restaurant/menus/${encodeURIComponent(this.data.menu.id)}/items`, {
        method: 'POST',
        data: { dishId: this.data.dishId, price: this.data.price }
      });
      this.setData({ dishId: '', dishIndex: -1, price: '', notice: '菜品已加入菜单草稿。' });
      await this.reload();
    } catch (error) {
      this.setData({ error: errorMessage(error, '菜品加入菜单失败，请重试。') });
    } finally {
      this.setData({ busy: false });
    }
  },

  async submitIngredient(event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    if (this.data.busy) return;
    const allergens = this.data.ingredientAllergens.split(',').map(value => value.trim()).filter(Boolean);
    const allowed = ['gluten', 'crustaceans', 'eggs', 'fish', 'peanuts', 'soybeans', 'milk', 'nuts', 'celery', 'mustard', 'sesame', 'sulphites', 'lupin', 'molluscs', 'other'];
    if (allergens.some(code => !allowed.includes(code)) || new Set(allergens).size !== allergens.length) {
      this.setData({ error: `过敏原请使用唯一代码并以逗号分隔：${allowed.join(', ')}` });
      return;
    }
    const payload = {
      code: this.data.ingredientCode.trim(),
      name: this.data.ingredientName.trim(),
      category: this.data.ingredientCategory,
      unit: this.data.ingredientUnit,
      allergens,
      reorderPoint: this.data.ingredientReorderPoint,
      leadTimeDays: Number(this.data.ingredientLeadTimeDays)
    };
    const fingerprint = JSON.stringify(payload);
    if (!this._createIngredientRequest || this._createIngredientRequest.fingerprint !== fingerprint) {
      this._createIngredientRequest = { fingerprint, key: requestKey() };
    }
    this.setData({ busy: true, error: '', notice: '' });
    try {
      await request('/api/merchant/restaurant/ingredients', {
        method: 'POST',
        data: payload,
        headers: { 'Idempotency-Key': this._createIngredientRequest.key }
      });
      this._createIngredientRequest = null;
      this.setData({
        showIngredientForm: false,
        ingredientCode: '',
        ingredientName: '',
        ingredientAllergens: '',
        ingredientReorderPoint: '0',
        ingredientLeadTimeDays: '0',
        notice: '原料已保存。'
      });
      await this.reload();
    } catch (error) {
      this.setData({ error: errorMessage(error, '原料创建失败，请重试。') });
    } finally {
      this.setData({ busy: false });
    }
  },

  async submitRecipe(event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    if (this.data.busy || !this.data.recipeDishId) return;
    const selectedIngredients = this.data.recipeItems.map(item => item.ingredientId);
    if (selectedIngredients.some(id => !id) || new Set(selectedIngredients).size !== selectedIngredients.length) {
      this.setData({ error: '每项都需选择原料，且同一配方不能重复添加同一原料。' });
      return;
    }
    const payload = {
      yieldQuantity: this.data.recipeYieldQuantity,
      yieldUnit: this.data.recipeYieldUnit,
      notes: this.data.recipeNotes,
      items: this.data.recipeItems.map(item => ({
        ingredientId: item.ingredientId,
        quantity: item.quantity,
        wasteRate: item.wasteRate || '0'
      }))
    };
    const fingerprint = JSON.stringify(payload);
    if (!this._createRecipeRequest || this._createRecipeRequest.fingerprint !== fingerprint) {
      this._createRecipeRequest = { fingerprint, key: requestKey() };
    }
    this.setData({ busy: true, error: '', notice: '' });
    try {
      await request(`/api/merchant/restaurant/dishes/${encodeURIComponent(this.data.recipeDishId)}/recipes`, {
        method: 'POST',
        data: payload,
        headers: { 'Idempotency-Key': this._createRecipeRequest.key }
      });
      this._createRecipeRequest = null;
      this.setData({
        showRecipeForm: false,
        recipeYieldQuantity: '1',
        recipeNotes: '',
        recipeItems: [{ ingredientId: '', ingredientIndex: -1, quantity: '', wasteRate: '0' }],
        notice: '新的配方版本已保存为草稿。'
      });
      await this.loadRecipes(this.data.recipeDishId);
    } catch (error) {
      this.setData({ error: errorMessage(error, '配方版本创建失败，请重试。') });
    } finally {
      this.setData({ busy: false });
    }
  },

  async activateRecipe(event) {
    if (this.data.busy) return;
    const recipe = this.data.recipes.find(item => item.id === event.currentTarget.dataset.id);
    if (!recipe || recipe.status !== 'draft') return;
    const confirmed = await this.confirmAction('激活配方', `确认激活 V${recipe.version}？当前激活版本将归档。`);
    if (!confirmed) return;
    this.setData({ busy: true, error: '', notice: '' });
    try {
      await request(`/api/merchant/restaurant/recipes/${encodeURIComponent(recipe.id)}/activate`, {
        method: 'POST',
        data: { expectedVersion: recipe.version }
      });
      this.setData({ notice: `配方 V${recipe.version} 已激活。` });
      await this.loadRecipes(this.data.recipeDishId);
    } catch (error) {
      this.setData({ error: errorMessage(error, '配方激活失败，请刷新后重试。') });
    } finally {
      this.setData({ busy: false });
    }
  },

  async readCost() {
    if (!this.data.recipeDishId) return;
    try {
      const menuId = this.data.menu && this.data.menu.id;
      const suffix = menuId ? `?menuId=${encodeURIComponent(menuId)}` : '';
      const result = await request(`/api/merchant/restaurant/dishes/${encodeURIComponent(this.data.recipeDishId)}/cost${suffix}`);
      this.setData({ costResult: result, error: '' });
    } catch (error) {
      this.setData({ costResult: null, error: errorMessage(error, '成本读取失败；请检查实际采购收货和员工权限。') });
    }
  },

  async transitionMenu() {
    const menu = this.data.menu;
    if (!menu || this.data.busy || !['draft', 'published'].includes(menu.status)) return;
    const publish = menu.status === 'draft';
    const confirmed = await this.confirmAction(
      publish ? '发布菜单' : '撤回菜单',
      publish ? '确认正式发布此菜单？公开店铺目录将展示已发布内容。' : '确认撤回菜单？公开店铺将不再展示此菜单。'
    );
    if (!confirmed) return;
    this.setData({ busy: true, error: '', notice: '' });
    try {
      await request(`/api/merchant/restaurant/menus/${encodeURIComponent(menu.id)}/${publish ? 'publish' : 'unpublish'}`, {
        method: 'POST',
        data: { expectedVersion: menu.version }
      });
      this.setData({ notice: publish ? '菜单已正式发布。' : '菜单已撤回为草稿。' });
      await this.reload(menu.id);
    } catch (error) {
      this.setData({ error: errorMessage(error, '菜单状态更新失败，请刷新后确认。') });
    } finally {
      this.setData({ busy: false });
    }
  }
});

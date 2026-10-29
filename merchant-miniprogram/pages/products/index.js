const { request, getAssetUrl } = require('../../utils/api');
const { requireMerchantSession } = require('../../utils/page-auth');
const { canAccessPermissions, canAccessTab, canAccessWorkspace } = require('../../utils/permissions');
const { loadMerchantInventoryBalances } = require('../../utils/inventory');
const { syncTabBar } = require('../../utils/tabbar');
const { getProductCategoryLabel } = require('../../utils/product-categories');

function buildExtraFilterOptions(products, categories, canViewStock) {
  const options = [
    { value: 'all', label: '全部分类' },
    { value: 'private', label: '授权商品' }
  ];
  if (canViewStock) options.push({ value: 'low_stock', label: '低库存' });
  Array.from(new Set(products.map(product => product.category).filter(Boolean)))
    .sort()
    .forEach(category => options.push({ value: category, label: getProductCategoryLabel(category) }));
  categories
    .filter(category => category.isActive !== false)
    .forEach(category => options.push({ value: `store:${category.slug}`, label: `店铺 · ${category.name}` }));
  return options;
}

function withProductCounts(categories, products) {
  return categories.map(category => Object.assign({}, category, {
    productCount: products.filter(product => product.storeCategorySlug === category.slug).length
  }));
}

Page({
  data: {
    products: [],
    visibleProducts: [],
    productSummary: null,
    query: '',
    searchResultIds: null,
    searchLoading: false,
    searchError: '',
    sort: 'updated',
    filter: 'all',
    extraFilter: 'all',
    imageFilter: 'all',
    specFilter: 'all',
    createdFilter: 'all',
    minPrice: '',
    maxPrice: '',
    showProductOptions: false,
    extraFilterIndex: 0,
    sortIndex: 0,
    createdFilterIndex: 0,
    imageFilterIndex: 0,
    specFilterIndex: 0,
    extraFilterOptions: [
      { value: 'all', label: '全部分类' },
      { value: 'private', label: '授权商品' },
      { value: 'low_stock', label: '低库存' }
    ],
    sortOptions: [
      { value: 'updated', label: '最近更新' },
      { value: 'price', label: '价格由高到低' },
      { value: 'stock', label: '库存由低到高' }
    ],
    createdFilterOptions: [
      { value: 'all', label: '所有时间' },
      { value: '30', label: '近 30 天' },
      { value: '90', label: '近 90 天' }
    ],
    imageFilterOptions: [
      { value: 'all', label: '全部图片状态' },
      { value: 'with_image', label: '有图片' },
      { value: 'without_image', label: '缺少图片' }
    ],
    specFilterOptions: [
      { value: 'all', label: '全部规格状态' },
      { value: 'complete', label: '规格完整' },
      { value: 'incomplete', label: '规格不完整' }
    ],
    loading: false,
    error: '',
    categoryLoadError: '',
    inventoryError: '',
    selectionMode: false,
    merchantStoreSlug: '',
    openMenuProductId: '',
    skeletonRows: [1, 2, 3],
    canViewStock: false,
    canManageProducts: false,
    selectedProductIds: [],
    categories: [],
    batchCategoryIndex: 0,
    showCategoryManager: false,
    categoryNameDraft: '',
    editingCategoryId: '',
    categoryBusy: false,
    categoryError: '',
    filters: [
      { id: 'all', label: '全部' },
      { id: 'published', label: '出售中' },
      { id: 'draft', label: '已下架' }
    ]
  },

  onShow() {
    this.startDataRefresh();
    let shortcut;
    try {
      shortcut = wx.getStorageSync('merchantProductsHomeShortcut');
      if (shortcut) wx.removeStorageSync('merchantProductsHomeShortcut');
    } catch (error) {
      console.warn('Unable to read home product shortcut', error);
    }
    if (shortcut) {
      this.setData({
        query: shortcut.query || '',
        searchResultIds: null,
        searchError: '',
        sort: ['updated', 'price', 'stock'].includes(shortcut.sort) ? shortcut.sort : 'updated',
        filter: 'all'
      }, async () => {
        await this.loadProducts();
      });
      return;
    }
    this.loadProducts();
  },

  onPullDownRefresh() {
    this.loadProducts().finally(() => wx.stopPullDownRefresh());
  },

  startDataRefresh() {
    clearInterval(this._dataRefreshTimer);
    this._dataRefreshTimer = setInterval(() => {
      this.loadProducts({ silent: true });
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

  async loadProducts(options) {
    if (this.data.loading) return;
    const silent = Boolean(options && options.silent);
    if (silent) this.setData({ error: '' });
    else this.setData({ loading: true, error: '' });
    try {
      const auth = await requireMerchantSession(this);
      if (!auth) return;
      syncTabBar(this, auth, 'products');
      const merchant = auth.response && auth.response.merchant || auth.session && auth.session.merchant || {};
      const canManageProducts = canAccessPermissions(auth, ['product.publish']);
      const canViewStock = canAccessWorkspace(auth, 'inventory');
      if (!canAccessTab(auth, 'products')) {
        this.setData({
          error: '当前账号没有商品目录权限。',
          canManageProducts: false,
          products: [],
          visibleProducts: [],
          selectedProductIds: []
        });
        return;
      }
      this.setData({ canManageProducts });
      const response = await request('/api/merchant/products');
      let categoryResponse = { categories: [] };
      let categoryLoadError = '';
      try {
        categoryResponse = await request('/api/merchant/store-categories');
      } catch (error) {
        categoryLoadError = error.message || '商品分类加载失败。';
      }
      const products = (response.products || []).map(product => {
        const mediaImage = (product.media || []).find(item => item.type === 'image');
        const image = mediaImage || (product.images || [])[0];
        const skus = product.skus || [];
        const colorSummary = Array.from(new Set(skus.map(sku => sku.color).filter(Boolean))).join('、');
        const sizeSummary = Array.from(new Set(skus.map(sku => sku.size).filter(Boolean))).join(' / ');
        return Object.assign({}, product, {
          selected: false,
          coverImage: getAssetUrl(typeof image === 'string' ? image : image && image.url),
          colorSummary,
          sizeSummary,
          categoryLabel: product.subCategory || getProductCategoryLabel(product.category),
          stockQuantity: null,
          lifecycleStatus: product.lifecycleStatus || 'published',
          statusLabel: ({
            published: '出售中',
            draft: '草稿',
            pending_review: '审核中',
            rejected: '已退回',
            archived: '已归档'
          })[product.lifecycleStatus || 'published'] || product.lifecycleStatus || '未知状态'
        });
      });
      let inventoryError = '';
      if (canViewStock && products.length) {
        try {
          const balances = await loadMerchantInventoryBalances();
          const stockByProduct = new Map();
          balances.forEach(balance => {
            const productId = balance.product && balance.product.id;
            if (!productId) return;
            stockByProduct.set(productId, (stockByProduct.get(productId) || 0) + Number(balance.availableQuantity || 0));
          });
          products.forEach(product => {
            product.stockQuantity = stockByProduct.get(product.id) || 0;
          });
        } catch (error) {
          inventoryError = error.message || '实时库存暂时不可用。';
        }
      }
      this.setData({
        products,
        productSummary: {
          total: products.length,
          lowStock: canViewStock && !inventoryError
            ? products.filter(product =>
              product.stockQuantity !== null
              && Number(product.stockQuantity) <= Number(product.moq || 0)).length
            : null,
          incomplete: products.filter(product =>
            !product.description
            || !product.fabric
            || (!(product.images || []).length
              && !(product.media || []).some(item => item.type === 'image'))).length
        },
        canViewStock,
        merchantStoreSlug: merchant.storeSlug || merchant.slug || '',
        categoryLoadError,
        inventoryError,
        selectedProductIds: [],
        categories: withProductCounts((categoryResponse.categories || []).filter(category => category.isActive !== false), products),
        extraFilterOptions: buildExtraFilterOptions(products, categoryResponse.categories || [], canViewStock),
        batchCategoryIndex: 0
      });
      this.applyFilter();
    } catch (error) {
      if (!silent) this.setData({ error: error.message || '商品列表加载失败。' });
    } finally {
      if (!silent) this.setData({ loading: false });
    }
  },

  applyFilter() {
    const query = this.data.query.trim().toLowerCase();
    const products = this.data.products.filter(product => {
      const lifecycleStatus = product.lifecycleStatus || 'published';
      const variants = product.skus || [];
      const matchesStatus = this.data.filter === 'all'
        || (this.data.filter === 'published' && lifecycleStatus === 'published')
        || (this.data.filter === 'draft' && ['draft', 'pending_review', 'rejected', 'archived'].includes(lifecycleStatus));
      const matchesQuery = !query
        || (Array.isArray(this.data.searchResultIds)
          ? this.data.searchResultIds.includes(product.id)
          : `${product.name || ''} ${product.styleNo || ''} ${product.brand || ''} ${product.category || ''} ${variants.map(sku => `${sku.sku || ''} ${sku.barcode || ''} ${sku.color || ''} ${sku.size || ''}`).join(' ')}`.toLowerCase().includes(query));
      const extraFilter = this.data.extraFilter;
      const matchesExtraFilter = extraFilter === 'all'
        || (extraFilter === 'private' && product.visibility === 'private')
        || (extraFilter === 'low_stock' && this.data.canViewStock && !this.data.inventoryError
          && product.stockQuantity !== null && Number(product.stockQuantity) <= Number(product.moq || 0))
        || (extraFilter.indexOf('store:') === 0 && product.storeCategorySlug === extraFilter.slice(6))
        || product.category === extraFilter;
      const hasImage = (product.images || []).length > 0 || (product.media || []).some(item => item.type === 'image');
      const matchesImage = this.data.imageFilter === 'all'
        || (this.data.imageFilter === 'with_image' && hasImage)
        || (this.data.imageFilter === 'without_image' && !hasImage);
      const completeVariants = variants.length > 0
        && variants.every(variant => String(variant.sku || '').trim() && String(variant.color || '').trim() && String(variant.size || '').trim());
      const matchesSpecs = this.data.specFilter === 'all'
        || (this.data.specFilter === 'complete' && completeVariants)
        || (this.data.specFilter === 'incomplete' && !completeVariants);
      const createdAt = Date.parse(product.createdAt || '');
      const ageInDays = Number.isFinite(createdAt) ? (Date.now() - createdAt) / 86400000 : null;
      const matchesCreated = this.data.createdFilter === 'all'
        || (ageInDays !== null && ageInDays <= Number(this.data.createdFilter));
      const minimum = this.data.minPrice.trim() ? Number(this.data.minPrice) : null;
      const maximum = this.data.maxPrice.trim() ? Number(this.data.maxPrice) : null;
      const price = Number(product.wholesalePrice || 0);
      const matchesPrice = (minimum === null || (Number.isFinite(minimum) && price >= minimum))
        && (maximum === null || (Number.isFinite(maximum) && price <= maximum));
      return matchesStatus && matchesQuery && matchesExtraFilter && matchesImage && matchesSpecs && matchesCreated && matchesPrice;
    }).sort((left, right) => {
      if (this.data.sort === 'price') return Number(right.wholesalePrice || 0) - Number(left.wholesalePrice || 0);
      if (this.data.sort === 'stock') return left.stockQuantity - right.stockQuantity;
      return String(right.updatedAt || right.createdAt || right.styleNo || '')
        .localeCompare(String(left.updatedAt || left.createdAt || left.styleNo || ''));
    });
    this.setData({ visibleProducts: products });
  },

  onSearch(event) {
    const query = String(event.detail.value || '').trim();
    this.setData({
      query,
      searchResultIds: null,
      searchLoading: false,
      searchError: ''
    });
    this.applyFilter();
  },

  selectFilter(event) {
    this.clearProductSelection();
    this.setData({ filter: event.currentTarget.dataset.id });
    this.applyFilter();
  },

  clearProductSelection() {
    this.setData({
      products: this.data.products.map(product => Object.assign({}, product, { selected: false })),
      selectedProductIds: []
    });
  },

  onProductSelectionChange(event) {
    if (!this.data.canManageProducts) return;
    const id = event.currentTarget.dataset.id;
    const selectedValue = event.detail.value;
    const selected = Array.isArray(selectedValue)
      ? selectedValue.includes('selected')
      : selectedValue === true || selectedValue === 'selected';
    if (selected && this.data.selectedProductIds.length >= 500) {
      wx.showToast({ title: '一次最多选择 500 件商品', icon: 'none' });
      return;
    }
    const products = this.data.products.map(product =>
      product.id === id ? Object.assign({}, product, { selected }) : product);
    this.setData({
      products,
      selectedProductIds: products.filter(product => product.selected).map(product => product.id)
    });
    this.applyFilter();
  },

  clearSearch() {
    clearTimeout(this._searchTimer);
    this._searchRequestId = (this._searchRequestId || 0) + 1;
    this.setData({ query: '', searchResultIds: null, searchLoading: false, searchError: '' });
    this.applyFilter();
  },

  retrySearch() {
    this.setData({ searchLoading: false, searchError: '' });
    this.applyFilter();
  },

  retryLoad() {
    this.setData({ error: '', searchError: '' });
    this.loadProducts();
  },

  stopTap() {},

  toggleProductOptions() {
    this.setData({ showProductOptions: !this.data.showProductOptions });
  },

  onProductOptionChange(event) {
    const field = event.currentTarget.dataset.field;
    if (!['extraFilter', 'sort', 'createdFilter', 'imageFilter', 'specFilter'].includes(field)) return;
    const index = Number(event.detail.value);
    const options = this.data[`${field}Options`];
    if (!Number.isInteger(index) || !options || !options[index]) return;
    const update = {};
    if (field === 'extraFilter') {
      update.extraFilter = options[index].value;
      update.extraFilterIndex = index;
    } else if (field === 'sort') {
      update.sort = options[index].value;
      update.sortIndex = index;
    } else if (field === 'createdFilter') {
      update.createdFilter = options[index].value;
      update.createdFilterIndex = index;
    } else if (field === 'imageFilter') {
      update.imageFilter = options[index].value;
      update.imageFilterIndex = index;
    } else if (field === 'specFilter') {
      update.specFilter = options[index].value;
      update.specFilterIndex = index;
    }
    this.setData(update);
    this.applyFilter();
  },

  onPriceFilterInput(event) {
    const field = event.currentTarget.dataset.field;
    if (field !== 'minPrice' && field !== 'maxPrice') return;
    const update = {};
    update[field] = event.detail.value;
    this.setData(update);
    this.applyFilter();
  },

  clearProductFilters() {
    clearTimeout(this._searchTimer);
    this._searchRequestId = (this._searchRequestId || 0) + 1;
    this.setData({
      query: '',
      searchResultIds: null,
      searchLoading: false,
      searchError: '',
      filter: 'all',
      extraFilter: 'all',
      imageFilter: 'all',
      specFilter: 'all',
      createdFilter: 'all',
      extraFilterIndex: 0,
      imageFilterIndex: 0,
      specFilterIndex: 0,
      createdFilterIndex: 0,
      minPrice: '',
      maxPrice: ''
    });
    this.applyFilter();
  },

  toggleSelectionMode() {
    if (!this.data.canManageProducts) return;
    if (this.data.selectionMode) this.clearProductSelection();
    this.setData({ selectionMode: !this.data.selectionMode });
  },

  openProduct(event) {
    const id = event.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: `/pages/product-detail/index?id=${encodeURIComponent(id)}` });
  },

  openCategoryManager() {
    if (!this.data.canManageProducts) return;
    this.setData({ showCategoryManager: true, categoryError: '', editingCategoryId: '', categoryNameDraft: '' });
  },

  closeCategoryManager() {
    if (this.data.categoryBusy) return;
    this.setData({ showCategoryManager: false, categoryError: '', editingCategoryId: '', categoryNameDraft: '' });
  },

  cancelCategoryEdit() {
    this.setData({ editingCategoryId: '', categoryNameDraft: '', categoryError: '' });
  },

  onCategoryNameInput(event) {
    this.setData({ categoryNameDraft: event.detail.value });
  },

  editCategory(event) {
    const category = this.data.categories.find(item => item.id === event.currentTarget.dataset.id);
    if (!category || !this.data.canManageProducts) return;
    this.setData({ editingCategoryId: category.id, categoryNameDraft: category.name, categoryError: '' });
  },

  async saveCategory() {
    const name = this.data.categoryNameDraft.trim();
    if (!this.data.canManageProducts || this.data.categoryBusy) return;
    if (!name) {
      this.setData({ categoryError: '请输入分类名称。' });
      return;
    }
    this.setData({ categoryBusy: true, categoryError: '' });
    try {
      const path = this.data.editingCategoryId
        ? `/api/merchant/store-categories/${encodeURIComponent(this.data.editingCategoryId)}`
        : '/api/merchant/store-categories';
      await request(path, {
        method: this.data.editingCategoryId ? 'PUT' : 'POST',
        data: { name }
      });
      this.setData({ categoryNameDraft: '', editingCategoryId: '' });
      await this.loadProducts();
      wx.showToast({ title: '分类已保存', icon: 'success' });
    } catch (error) {
      this.setData({ categoryError: error.message || '分类保存失败，请重试。' });
    } finally {
      this.setData({ categoryBusy: false });
    }
  },

  deleteCategory(event) {
    const category = this.data.categories.find(item => item.id === event.currentTarget.dataset.id);
    if (!category || !this.data.canManageProducts || category.productCount > 0) return;
    wx.showModal({
      title: '删除商品分类',
      content: `确认删除“${category.name}”？`,
      success: async result => {
        if (!result.confirm) return;
        this.setData({ categoryBusy: true, categoryError: '' });
        try {
          await request(`/api/merchant/store-categories/${encodeURIComponent(category.id)}`, { method: 'DELETE' });
          if (this.data.extraFilter === `store:${category.slug}`) {
            this.setData({ extraFilter: 'all', extraFilterIndex: 0 });
          }
          await this.loadProducts();
          wx.showToast({ title: '分类已删除', icon: 'success' });
        } catch (error) {
          this.setData({ categoryError: error.message === 'STORE_CATEGORY_IN_USE'
            ? '此分类仍关联商品，请先调整商品分类。'
            : error.message || '分类删除失败，请重试。' });
        } finally {
          this.setData({ categoryBusy: false });
        }
      }
    });
  },

  selectAllVisible() {
    if (!this.data.canManageProducts) return;
    const visibleIds = new Set(this.data.visibleProducts
      .filter(product => product.lifecycleStatus !== 'archived')
      .slice(0, 500)
      .map(product => product.id));
    const products = this.data.products.map(product => visibleIds.has(product.id)
      ? Object.assign({}, product, { selected: true })
      : product);
    this.setData({
      products,
      selectedProductIds: products.filter(product => product.selected).map(product => product.id)
    });
    this.applyFilter();
  },

  onBatchCategoryChange(event) {
    this.setData({ batchCategoryIndex: Number(event.detail.value) });
  },

  async batchProductAction(event) {
    if (!this.data.canManageProducts) return;
    const { type, value } = event.currentTarget.dataset;
    const productIds = this.data.selectedProductIds;
    if (!productIds.length) {
      wx.showToast({ title: '请先选择商品', icon: 'none' });
      return;
    }
    const payload = type === 'category'
      ? { storeCategorySlug: this.data.categories[this.data.batchCategoryIndex]?.slug }
      : type === 'zone'
        ? { zone: value }
        : { lifecycleStatus: value };
    if (!payload.storeCategorySlug && type === 'category') {
      wx.showToast({ title: '请选择有效分类', icon: 'none' });
      return;
    }
    const labels = {
      published: '批量上架',
      draft: '批量暂停销售',
      new: '批量设为新品',
      clearance: '批量设为清仓',
      private: '批量设为私密商品'
    };
    const actionLabel = type === 'category' ? '批量调整分类' : labels[value];
    const confirmation = await new Promise(resolve => wx.showModal({
      title: actionLabel,
      content: `此操作将更新已选的 ${productIds.length} 件商品，是否继续？`,
      success: resolve
    }));
    if (!confirmation.confirm) return;
    try {
      const result = await request('/api/merchant/products/batch', {
        method: 'PUT',
        data: Object.assign({ productIds }, payload)
      });
      wx.showToast({ title: `已更新 ${result.count || productIds.length} 件商品`, icon: 'success' });
      await this.loadProducts();
    } catch (error) {
      wx.showToast({ title: error.message || '批量更新失败，请刷新后重试', icon: 'none' });
    }
  },

  createProduct() {
    if (!this.data.canManageProducts) return;
    wx.navigateTo({ url: '/pages/product-form/index' });
  },

  editProduct(event) {
    if (!this.data.canManageProducts) return;
    const id = event.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: `/pages/product-form/index?id=${encodeURIComponent(id)}` });
  },

  copyProduct(event) {
    if (!this.data.canManageProducts) return;
    const id = event.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: `/pages/product-form/index?copy=${encodeURIComponent(id)}` });
  },

  async shareProduct(event) {
    const product = this.data.products.find(item => item.id === event.currentTarget.dataset.id);
    if (!product || product.lifecycleStatus !== 'published' || !this.data.merchantStoreSlug) {
      wx.showToast({ title: '商品未上架或店铺链接暂不可用', icon: 'none' });
      return;
    }
    const url = `https://${this.data.merchantStoreSlug}.ruda.fashion/product/${encodeURIComponent(product.id)}`;
    wx.setClipboardData({
      data: url,
      success: () => wx.showToast({ title: '商品链接已复制', icon: 'success' }),
      fail: () => wx.showToast({ title: '复制链接失败，请重试', icon: 'none' })
    });
  },

  openProductActions(event) {
    const id = event.currentTarget.dataset.id;
    const product = this.data.products.find(item => item.id === id);
    if (!product || !this.data.canManageProducts) return;
    this.setData({ openMenuProductId: this.data.openMenuProductId === id ? '' : id });
  },

  handleProductMenuAction(event) {
    const id = event.currentTarget.dataset.id;
    const action = event.currentTarget.dataset.action;
    const product = this.data.products.find(item => item.id === id);
    if (!product || !this.data.canManageProducts) return;
    this.setData({ openMenuProductId: '' });
    if (action === 'edit') this.editProduct({ currentTarget: { dataset: { id } } });
    else if (action === 'copy') this.copyProduct({ currentTarget: { dataset: { id } } });
    else if (action === 'share') this.shareProduct({ currentTarget: { dataset: { id } } });
    else if (action === 'publish') this.changeLifecycle({ currentTarget: { dataset: { id, status: 'published' } } });
    else if (action === 'draft') this.changeLifecycle({ currentTarget: { dataset: { id, status: 'draft' } } });
    else if (action === 'archive') this.archiveProduct({ currentTarget: { dataset: { id } } });
  },

  async changeLifecycle(event) {
    if (!this.data.canManageProducts) return;
    const { id, status } = event.currentTarget.dataset;
    if (!id || !status) return;
    try {
      await request(`/api/merchant/products/${encodeURIComponent(id)}`, {
        method: 'PUT',
        data: { lifecycleStatus: status }
      });
      const message = status === 'published' ? '商品已上架' : status === 'draft' ? '已暂停销售' : '已提交审核';
      wx.showToast({ title: message, icon: 'success' });
      await this.loadProducts();
    } catch (error) {
      wx.showToast({ title: error.message || '商品状态更新失败', icon: 'none' });
    }
  },

  archiveProduct(event) {
    if (!this.data.canManageProducts) return;
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.showModal({
      title: '归档商品',
      content: '归档后商品将不再展示。确认继续？',
      success: async result => {
        if (!result.confirm) return;
        try {
          await request(`/api/merchant/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
          wx.showToast({ title: '商品已归档', icon: 'success' });
          await this.loadProducts();
        } catch (error) {
          wx.showToast({ title: error.message || '商品归档失败', icon: 'none' });
        }
      }
    });
  }
});

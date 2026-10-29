const { request } = require('../../utils/api');
const { requireMerchantSession } = require('../../utils/page-auth');
const { canAccessPermissions } = require('../../utils/permissions');
const { PRODUCT_CATEGORIES: categories, getProductCategoryLabel } = require('../../utils/product-categories');
const { loadIndustryContext, parseIndustryAttributes } = require('../../utils/industry');

const commonColorChoices = ['黑色', '白色', '米色', '灰色', '海军蓝', '蓝色', '棕色'];
const additionalColorChoices = ['卡其色', '红色', '粉色', '绿色', '黄色', '紫色', '橙色', '多色', '其他 / 拼色'];
const colorChoices = commonColorChoices.concat(additionalColorChoices);
const colorSwatches = {
  黑色: '#252525',
  白色: '#fff',
  米色: '#e8ddc9',
  灰色: '#929292',
  海军蓝: '#263b5a',
  蓝色: '#4b78b8',
  棕色: '#79563b',
  卡其色: '#b4a078',
  红色: '#b64c4c',
  粉色: '#e5aeb9',
  绿色: '#63856e',
  黄色: '#e1c76e',
  紫色: '#8871a4',
  橙色: '#d88b54',
  多色: 'linear-gradient(135deg, #d77575 0%, #e0c66a 34%, #77a989 67%, #7189c2 100%)',
  '其他 / 拼色': 'linear-gradient(135deg, #ddd 0%, #ddd 48%, #fff 50%, #fff 100%)'
};
const commonSizeChoices = ['均码', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const additionalSizeChoices = ['XS', 'EU 34', 'EU 36', 'EU 38', 'EU 40', 'EU 42', 'EU 44', 'EU 46', 'EU 48', 'EU 50'];
const productZones = [
  { value: 'new', label: '新款区' },
  { value: 'clearance', label: '特价区' },
  { value: 'private', label: '授权订货区' }
];

function contentTypeForPath(path) {
  const extension = String(path).split('?')[0].split('.').pop().toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'mp4') return 'video/mp4';
  if (extension === 'webm') return 'video/webm';
  return 'image/jpeg';
}

function requestKey() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
    const random = Math.floor(Math.random() * 16);
    return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

function variantSlug(value) {
  return String(value || '').normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseOptions(value) {
  return Array.from(new Set(String(value || '').split(/[,，、;；\n]+/).map(item => item.trim()).filter(Boolean)));
}

function selectableOptions(choices, selected, swatches, includeSelected = true) {
  const selectedSet = new Set(selected);
  return Array.from(new Set(includeSelected ? choices.concat(selected) : choices)).map(value => {
    const option = { value, selected: selectedSet.has(value) };
    if (swatches && swatches[value]) option.swatch = swatches[value];
    return option;
  });
}

function sizeOptionState(selected) {
  const additionalChoices = Array.from(new Set(additionalSizeChoices.concat(
    selected.filter(value => !commonSizeChoices.includes(value) && !additionalSizeChoices.includes(value))
  )));
  const additionalSelection = selected.some(value => !commonSizeChoices.includes(value));
  return {
    sizeOptions: selectableOptions(commonSizeChoices, selected),
    otherSizeOptions: selectableOptions(additionalChoices, selected),
    hasSelectedOtherSizes: additionalSelection
  };
}

function colorOptionState(selected) {
  const knownColors = new Set(colorChoices);
  const additionalChoices = Array.from(new Set(additionalColorChoices.concat(
    selected.filter(value => !knownColors.has(value))
  )));
  return {
    colorOptions: selectableOptions(commonColorChoices, selected, colorSwatches, false),
    otherColorOptions: selectableOptions(additionalChoices, selected, colorSwatches, false)
      .map(option => Object.assign(option, { custom: !knownColors.has(option.value) })),
    hasSelectedOtherColors: selected.some(value => !commonColorChoices.includes(value))
  };
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
            else reject(new Error(`图片上传失败（${response.statusCode}）。`));
          },
          fail() { reject(new Error('图片上传失败，请检查网络和微信上传域名配置。')); }
        });
      },
      fail() { reject(new Error('无法读取所选图片，请重新选择。')); }
    });
  });
}

function industryFieldsWithLabels(fields, values) {
  return (fields || []).map(field => {
    const raw = values && values[field.key] != null ? String(values[field.key]) : '';
    let selectedLabel = raw;
    let selectedIndex = 0;
    if (field.type === 'select' && Array.isArray(field.options)) {
      const index = field.options.findIndex(option => option.value === raw);
      selectedIndex = index >= 0 ? index : 0;
      selectedLabel = index >= 0 ? field.options[index].label : '';
    }
    return Object.assign({}, field, { value: raw, selectedLabel, selectedIndex });
  });
}

Page({
  data: {
    categories,
    productZones,
    colorOptions: colorOptionState([]).colorOptions,
    otherColorOptions: colorOptionState([]).otherColorOptions,
    hasSelectedOtherColors: false,
    showMoreColors: false,
    customColorName: '',
    sizeOptions: selectableOptions(commonSizeChoices, []),
    otherSizeOptions: selectableOptions(additionalSizeChoices, []),
    showOtherSizes: false,
    customSizeName: '',
    hasSelectedOtherSizes: false,
    selectedColors: [],
    selectedSizes: [],
    categoryIndex: 0,
    category: categories[0].value,
    categoryLabel: categories[0].label,
    productId: '',
    updatedAt: '',
    name: '',
    styleNo: '',
    subCategory: '',
    brand: '',
    season: '',
    wholesalePrice: '',
    wholesalePrice100: '',
    bulkPriceMinimumQuantity: '100',
    rrpPrice: '',
    costPrice: '',
    moq: '1',
    packSize: '6',
    requiresFullCarton: false,
    origin: '',
    fabric: '',
    composition: '',
    manufacturingProcess: '',
    fit: '',
    weight: '',
    packaging: '',
    washCare: '',
    description: '',
    status: 'new',
    visibility: 'public',
    lifecycleStatus: 'draft',
    zoneIndex: 0,
    zoneLabel: productZones[0].label,
    mode: 'quick',
    isFullMode: false,
    mediaLimit: 9,
    colorInput: '',
    sizeInput: '',
    media: [],
    uploadingMedia: false,
    mediaUploadingId: '',
    mediaUploadCurrent: 0,
    mediaUploadTotal: 0,
    statusBarHeight: 0,
    variants: [],
    isEdit: false,
    isCopy: false,
    industryFields: [],
    industryValues: {},
    industryLabel: '',
    variantColorLabel: '颜色',
    variantSizeLabel: '尺码',
    canManage: false,
    canManageCosts: false,
    loading: false,
    saving: false,
    error: ''
  },

  onLoad(options) {
    const systemInfo = typeof wx.getWindowInfo === 'function' ? wx.getWindowInfo() : wx.getSystemInfoSync();
    this.setData({ statusBarHeight: systemInfo.statusBarHeight || 0 });
    return this.initialize(options || {});
  },

  async initialize(options) {
    try {
      const auth = await requireMerchantSession(this);
      if (!auth) return;
      if (!canAccessPermissions(auth, ['product.publish'])) {
        this.setData({ error: '当前账号没有商品编辑权限。' });
        return;
      }
      this.setData({
        canManage: true,
        canManageCosts: canAccessPermissions(auth, ['product.cost.view']),
        mode: options.id || options.copy ? 'full' : 'quick',
        isFullMode: Boolean(options.id || options.copy),
        mediaLimit: options.id || options.copy ? 32 : 9,
        styleNo: options.id ? this.data.styleNo : `STY-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
      });
      await this.loadIndustryFields();
      if (options.id) {
        this.setData({ productId: options.id, isEdit: true, isCopy: false });
        await this.loadProduct(options.id, false);
      } else if (options.copy) {
        this.setData({ isEdit: false, isCopy: true });
        await this.loadProduct(options.copy, true);
      }
      if (options.id || options.copy) {
        this.syncIndustryFields(this._loadedIndustryAttributes || {});
      }
    } catch (error) {
      this.setData({ error: error.message || '账号验证失败。' });
    }
  },

  async loadIndustryFields() {
    try {
      const context = await loadIndustryContext();
      const fields = (context.productFields || []).filter(field =>
        field && !field.column && field.type !== 'media' && field.type !== 'variants');
      this._industryFieldDefs = fields;
      this.setData({
        industryLabel: context.templateLabel || '',
        variantColorLabel: (context.variant && context.variant.colorLabel) || '颜色',
        variantSizeLabel: (context.variant && context.variant.sizeLabel) || '尺码'
      });
      this.syncIndustryFields(this.data.industryValues);
    } catch (error) {
      // 行业上下文不可用时退回通用表单，服务端仍会按行业规则校验。
      this._industryFieldDefs = [];
      this.setData({ industryFields: [] });
    }
  },

  syncIndustryFields(values) {
    const definitions = this._industryFieldDefs || [];
    const normalized = {};
    definitions.forEach(field => {
      normalized[field.key] = values && values[field.key] != null ? String(values[field.key]) : '';
    });
    this.setData({
      industryValues: normalized,
      industryFields: industryFieldsWithLabels(definitions, normalized)
    });
  },

  onIndustryInput(event) {
    const key = event.currentTarget.dataset.key;
    if (!key) return;
    const values = Object.assign({}, this.data.industryValues);
    values[key] = event.detail.value;
    this.syncIndustryFields(values);
  },

  onIndustrySelect(event) {
    const key = event.currentTarget.dataset.key;
    const field = (this._industryFieldDefs || []).find(item => item.key === key);
    const options = field && Array.isArray(field.options) ? field.options : [];
    const option = options[Number(event.detail.value)];
    if (!key || !option) return;
    const values = Object.assign({}, this.data.industryValues);
    values[key] = option.value;
    this.syncIndustryFields(values);
  },

  async loadProduct(productId, copyMode) {
    if (!this.data.canManage) return;
    this.setData({ loading: true });
    try {
      const response = await request(`/api/merchant/products/${encodeURIComponent(productId)}`);
      const product = response.product;
      if (!product) throw new Error('没有找到该商品或当前账号无权编辑。');
      this._loadedIndustryAttributes = parseIndustryAttributes(product.industryAttributes);
      let pickerCategories = categories;
      let categoryIndex = categories.findIndex(item => item.value === product.category);
      if (product.category && categoryIndex < 0) {
        pickerCategories = categories.concat([{ value: product.category, label: getProductCategoryLabel(product.category) }]);
        categoryIndex = pickerCategories.length - 1;
      }
      const media = Array.isArray(product.media) && product.media.length
        ? product.media
        : (product.images || []).map((url, index) => ({ id: `existing-image-${index}`, type: 'image', url, role: index === 0 ? 'main' : 'detail' }));
      const variants = (product.skus || []).map(sku => ({
        sku: sku.sku || '',
        color: sku.color || '',
        colorCode: sku.colorCode || '',
        size: sku.size || '',
        barcode: sku.barcode || '',
        stockCentral: copyMode ? 0 : Number(sku.stockCentral || 0),
        isActive: sku.isActive !== false
      }));
      const zoneIndex = product.status === 'clearance' ? 1 : product.visibility === 'private' ? 2 : 0;
      const selectedColors = parseOptions(variants.map(item => item.color).join(','));
      const selectedSizes = parseOptions(variants.map(item => item.size).join(','));
      const colorState = colorOptionState(selectedColors);
      const sizeState = sizeOptionState(selectedSizes);
      this.setData({
        productId: copyMode ? '' : productId,
        updatedAt: copyMode ? '' : String(product.updatedAt || ''),
        isEdit: !copyMode,
        isCopy: Boolean(copyMode),
        mode: 'full',
        isFullMode: true,
        mediaLimit: 32,
        categoryIndex,
        categories: pickerCategories,
        category: product.category || categories[0].value,
        categoryLabel: categoryIndex >= 0 ? pickerCategories[categoryIndex].label : (product.category || ''),
        name: product.name || '',
        styleNo: product.styleNo || '',
        subCategory: product.subCategory || '',
        brand: product.brand || '',
        season: product.season || '',
        wholesalePrice: String(product.wholesalePrice ?? ''),
        wholesalePrice100: product.wholesalePrice100 == null ? '' : String(product.wholesalePrice100),
        bulkPriceMinimumQuantity: String(product.bulkPriceMinimumQuantity || 100),
        rrpPrice: String(product.rrpPrice ?? ''),
        costPrice: this.data.canManageCosts ? String(product.costPrice ?? 0) : '',
        moq: String(product.moq ?? 1),
        packSize: String(product.packSize ?? 6),
        requiresFullCarton: product.requiresFullCarton === true,
        origin: product.origin || '',
        fabric: product.fabric || '',
        composition: product.composition || '',
        manufacturingProcess: product.manufacturingProcess || '',
        fit: product.fit || '',
        weight: product.weight || '',
        packaging: product.packaging || '',
        washCare: product.washCare || '',
        description: product.description || '',
        status: product.status || 'new',
        visibility: product.visibility || 'public',
        lifecycleStatus: copyMode ? 'draft' : product.lifecycleStatus || 'draft',
        zoneIndex,
        zoneLabel: productZones[zoneIndex].label,
        variants,
        selectedColors,
        selectedSizes,
        colorInput: selectedColors.join(', '),
        sizeInput: selectedSizes.join(', '),
        colorOptions: colorState.colorOptions,
        otherColorOptions: colorState.otherColorOptions,
        hasSelectedOtherColors: colorState.hasSelectedOtherColors,
        showMoreColors: false,
        sizeOptions: sizeState.sizeOptions,
        otherSizeOptions: sizeState.otherSizeOptions,
        hasSelectedOtherSizes: sizeState.hasSelectedOtherSizes,
        showOtherSizes: false,
        customSizeName: '',
        media
      });
    } catch (error) {
      this.setData({ error: error.message || '商品资料加载失败。' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field;
    const allowed = [
      'name', 'styleNo', 'subCategory', 'brand', 'season', 'wholesalePrice', 'wholesalePrice100',
      'bulkPriceMinimumQuantity', 'rrpPrice', 'costPrice', 'moq', 'packSize', 'description',
      'origin', 'fabric', 'composition', 'manufacturingProcess', 'fit', 'weight', 'packaging',
      'washCare', 'colorInput', 'sizeInput'
    ];
    if (allowed.includes(field)) {
      const update = { error: '' };
      update[field] = event.detail.value;
      if (field === 'colorInput') {
        const selectedColors = parseOptions(event.detail.value);
        update.selectedColors = selectedColors;
        Object.assign(update, colorOptionState(selectedColors));
      }
      if (field === 'sizeInput') {
        const selectedSizes = parseOptions(event.detail.value);
        update.selectedSizes = selectedSizes;
        Object.assign(update, sizeOptionState(selectedSizes));
      }
      this.setData(update);
    }
  },

  toggleOtherSizes() {
    this.setData({ showOtherSizes: !this.data.showOtherSizes });
  },

  toggleMoreColors() {
    this.setData({ showMoreColors: !this.data.showMoreColors });
  },

  onCustomColorInput(event) {
    this.setData({ customColorName: event.detail.value });
  },

  onCustomSizeInput(event) {
    this.setData({ customSizeName: event.detail.value });
  },

  addCustomColor() {
    const value = String(this.data.customColorName || '').trim();
    if (!value) return;
    const selected = Array.from(new Set(this.data.selectedColors.concat(value)));
    this.setData(Object.assign({
      selectedColors: selected,
      colorInput: selected.join(', '),
      customColorName: '',
      showMoreColors: true,
      error: ''
    }, colorOptionState(selected)));
  },

  addCustomSize() {
    const value = String(this.data.customSizeName || '').trim();
    if (!value) return;
    const selected = Array.from(new Set(this.data.selectedSizes.concat(value)));
    this.setData(Object.assign({
      selectedSizes: selected,
      sizeInput: selected.join(', '),
      customSizeName: '',
      showOtherSizes: true,
      error: ''
    }, sizeOptionState(selected)));
  },

  toggleMatrixOption(event) {
    const group = event.currentTarget.dataset.group;
    const value = event.currentTarget.dataset.value;
    if (!value || (group !== 'color' && group !== 'size')) return;
    const selectedKey = group === 'color' ? 'selectedColors' : 'selectedSizes';
    const inputKey = group === 'color' ? 'colorInput' : 'sizeInput';
    const optionsKey = group === 'color' ? 'colorOptions' : 'sizeOptions';
    const selected = this.data[selectedKey].slice();
    const index = selected.indexOf(value);
    if (index >= 0) selected.splice(index, 1);
    else selected.push(value);
    const update = {};
    update[selectedKey] = selected;
    update[inputKey] = selected.join(', ');
    if (group === 'color') Object.assign(update, colorOptionState(selected));
    else Object.assign(update, sizeOptionState(selected));
    update.error = '';
    this.setData(update);
  },

  onCancel() {
    wx.navigateBack();
  },

  onCategoryChange(event) {
    const index = Number(event.detail.value);
    const options = this.data.categories;
    if (options[index]) this.setData({ categoryIndex: index, category: options[index].value, categoryLabel: options[index].label });
  },

  onZoneChange(event) {
    const index = Number(event.detail.value);
    this.setProductZone(index);
  },

  setProductZone(index) {
    const zone = productZones[index];
    if (!Number.isInteger(index) || !zone) return;
    this.setData({
      zoneIndex: index,
      zoneLabel: zone.label,
      visibility: zone.value === 'private' ? 'private' : 'public',
      status: zone.value === 'clearance' ? 'clearance' : 'new'
    });
  },

  onModeChange(event) {
    const mode = event.currentTarget.dataset.mode;
    if (mode === 'quick' || mode === 'full') {
      const mediaLimit = mode === 'full' ? 32 : 9;
      if (this.data.media.length > mediaLimit) {
        this.setData({ error: `当前媒体已超过快捷录入的 ${mediaLimit} 个限制，请先移除多余媒体。` });
        return;
      }
      this.setData({ mode, isFullMode: mode === 'full', mediaLimit, error: '' });
    }
  },

  chooseImage() {
    if (!this.data.canManage) return;
    const mediaLimit = this.data.mediaLimit;
    if (this.data.media.length >= mediaLimit) {
      this.setData({ error: this.data.mode === 'full' ? '完整资料最多添加 32 个媒体。' : '快捷录入最多添加 9 个媒体。' });
      return;
    }
    wx.chooseMedia({
      count: Math.min(9, mediaLimit - this.data.media.length),
      mediaType: ['image', 'video'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: result => {
        const files = (result.tempFiles || []).filter(file => file && file.tempFilePath);
        if (files.some(file => file.size > 10 * 1024 * 1024)) {
          this.setData({ error: '单个图片或视频不能超过 10 MB。' });
          return;
        }
        const media = files.map((file, index) => ({
          id: `local-${Date.now()}-${index}`,
          type: file.fileType === 'video' ? 'video' : 'image',
          url: file.tempFilePath,
          localPath: file.tempFilePath,
          sizeBytes: file.size,
          role: this.data.media.some(item => item.type === 'image') || index > 0 ? 'detail' : 'main'
        }));
        this.setData({ media: this.data.media.concat(media), error: '' });
      },
      fail: result => {
        if (!result || !String(result.errMsg).includes('cancel')) this.setData({ error: '无法选择商品媒体，请检查相册/相机权限。' });
      }
    });
  },

  removeMedia(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isInteger(index) || index < 0 || index >= this.data.media.length) return;
    const media = this.data.media.filter((_, current) => current !== index);
    const firstImageIndex = media.findIndex(item => item.type === 'image');
    this.setData({
      media: media.map((item, current) => item.type === 'image'
        ? Object.assign({}, item, { role: current === firstImageIndex ? 'main' : 'detail' })
        : item)
    });
  },

  setMainMedia(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isInteger(index) || index < 0 || index >= this.data.media.length) return;
    if (this.data.media[index].type !== 'image') return;
    this.setData({
      media: this.data.media.map((item, current) => item.type === 'image'
        ? Object.assign({}, item, { role: current === index ? 'main' : 'detail' })
        : item)
    });
  },

  moveMedia(event) {
    const index = Number(event.currentTarget.dataset.index);
    const direction = Number(event.currentTarget.dataset.direction);
    const target = index + direction;
    if (!Number.isInteger(index) || !Number.isInteger(direction) || index < 0 || target < 0 || target >= this.data.media.length) return;
    const media = this.data.media.slice();
    const current = media[index];
    media[index] = media[target];
    media[target] = current;
    this.setData({ media });
  },

  onVariantInput(event) {
    const index = Number(event.currentTarget.dataset.index);
    const field = event.currentTarget.dataset.field;
    const allowed = ['sku', 'color', 'colorCode', 'size', 'barcode'];
    if (!Number.isInteger(index) || !allowed.includes(field) || !this.data.variants[index]) return;
    const variants = this.data.variants.slice();
    variants[index] = Object.assign({}, variants[index]);
    variants[index][field] = event.detail.value;
    this.setData({ variants, error: '' });
  },

  onVariantStockInput(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isInteger(index) || !this.data.variants[index]) return;
    const variants = this.data.variants.slice();
    variants[index] = Object.assign({}, variants[index], { stockCentral: event.detail.value });
    this.setData({ variants, error: '' });
  },

  onVariantActiveChange(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isInteger(index) || !this.data.variants[index]) return;
    const variants = this.data.variants.slice();
    variants[index] = Object.assign({}, variants[index], { isActive: event.detail.value });
    this.setData({ variants });
  },

  removeVariant(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isInteger(index) || index < 0 || index >= this.data.variants.length) return;
    this.setData({ variants: this.data.variants.filter((_, current) => current !== index) });
  },

  addVariant() {
    if (this.data.variants.length >= 500) {
      this.setData({ error: '一个商品最多添加 500 个 SKU。' });
      return;
    }
    this.setData({
      variants: this.data.variants.concat([{ sku: '', color: '', colorCode: '', size: '', barcode: '', stockCentral: '0', isActive: true }])
    });
  },

  generateVariants() {
    const colors = Array.from(new Set(this.data.colorInput.split(/[,，、;；\n]+/).map(value => value.trim()).filter(Boolean)));
    const sizes = Array.from(new Set(this.data.sizeInput.split(/[,，、;；\n]+/).map(value => value.trim()).filter(Boolean)));
    if (!colors.length || !sizes.length || colors.length * sizes.length > 500) {
      this.setData({ error: '请填写颜色和尺码；组合总数不能超过 500。' });
      return;
    }
    const styleNo = this.data.styleNo.trim().toUpperCase();
    const existing = this.data.variants.slice();
    const existingKeys = new Set(existing.map(item => `${item.color.toLowerCase()}\\u0000${item.size.toLowerCase()}`));
    colors.forEach((color, colorIndex) => sizes.forEach((size, sizeIndex) => {
      const key = `${color.toLowerCase()}\\u0000${size.toLowerCase()}`;
      if (existingKeys.has(key)) return;
      existingKeys.add(key);
      existing.push({
        sku: `${styleNo}-${variantSlug(color) || `COLOR-${colorIndex + 1}`}-${variantSlug(size) || `SIZE-${sizeIndex + 1}`}`,
        color, colorCode: '', size, barcode: '', stockCentral: '0', isActive: true
      });
    }));
    if (existing.length > 500) {
      this.setData({ error: '一个商品最多添加 500 个 SKU。' });
      return;
    }
    this.setData({ variants: existing, error: '' });
  },

  async uploadMedia(item) {
    const contentType = contentTypeForPath(item.localPath);
    const presigned = await request('/api/merchant/media/presign', {
      method: 'POST',
      data: { contentType, fileSize: item.sizeBytes }
    });
    if (!presigned.uploadUrl || !presigned.publicUrl || !presigned.key) {
      throw new Error('图片上传服务返回了无效地址。');
    }
    if (!/^https:\/\//i.test(presigned.uploadUrl) || !/^https:\/\//i.test(presigned.publicUrl)) {
      throw new Error('图片上传与访问地址必须使用 HTTPS。');
    }
    await uploadFile(presigned.uploadUrl, item.localPath, contentType);
    const uploaded = Object.assign({}, item, {
      url: presigned.publicUrl,
      storageKey: presigned.key,
      contentType: presigned.contentType,
      sizeBytes: presigned.sizeBytes,
      source: 'merchant-upload'
    });
    delete uploaded.localPath;
    return uploaded;
  },

  async uploadPendingMedia() {
    const media = [];
    const pendingCount = this.data.media.filter(item => item.localPath).length;
    let current = 0;
    this.setData({
      uploadingMedia: pendingCount > 0,
      mediaUploadingId: '',
      mediaUploadCurrent: 0,
      mediaUploadTotal: pendingCount
    });
    try {
      for (const item of this.data.media) {
        if (item.localPath) {
          current += 1;
          this.setData({ mediaUploadingId: item.id, mediaUploadCurrent: current });
          media.push(await this.uploadMedia(item));
        } else {
          media.push(item);
        }
      }
    } finally {
      this.setData({
        uploadingMedia: false,
        mediaUploadingId: '',
        mediaUploadCurrent: 0,
        mediaUploadTotal: 0
      });
    }
    const firstImageIndex = media.findIndex(item => item.type === 'image');
    return media.map((item, index) => item.type === 'image'
      ? Object.assign({}, item, { role: index === firstImageIndex ? 'main' : 'detail' })
      : item);
  },

  onCartonChange(event) {
    this.setData({ requiresFullCarton: event.detail.value });
  },

  async save(event) {
    if (!this.data.canManage) return;
    if (this.data.saving) return;
    const action = event && event.currentTarget && event.currentTarget.dataset.action;
    const isPublishing = !this.data.isEdit && action === 'publish';
    const isFullPublish = isPublishing && this.data.mode === 'full';
    const { name, styleNo, category, variants, media } = this.data;
    const wholesalePrice = Number(this.data.wholesalePrice);
    const wholesalePrice100 = this.data.wholesalePrice100.trim() ? Number(this.data.wholesalePrice100) : null;
    const rrpPrice = Number(this.data.rrpPrice);
    const moq = Number(this.data.moq);
    const packSize = Number(this.data.packSize);
    const bulkPriceMinimumQuantity = Number(this.data.bulkPriceMinimumQuantity);
    const costPrice = this.data.canManageCosts && this.data.costPrice !== '' ? Number(this.data.costPrice) : 0;
    if ((isPublishing || this.data.isEdit) && (!name.trim() || !styleNo.trim() || !category || !Number.isFinite(wholesalePrice) || wholesalePrice <= 0
      || !Number.isFinite(rrpPrice) || rrpPrice < 0 || !Number.isInteger(moq) || moq < 1
      || !Number.isInteger(packSize) || packSize < 1
      || (wholesalePrice100 !== null && (!Number.isFinite(wholesalePrice100) || wholesalePrice100 <= 0 || wholesalePrice100 > wholesalePrice)))) {
      this.setData({ error: '请检查商品名称、款号、分类、价格、起订量和箱规；批量价不能高于基础价。' });
      return;
    }
    if ((isPublishing || this.data.isEdit) && (!Number.isInteger(bulkPriceMinimumQuantity) || bulkPriceMinimumQuantity < 1
      || !Number.isFinite(costPrice) || costPrice < 0)) {
      this.setData({ error: '优惠门槛必须为正整数，成本价必须为非负金额。' });
      return;
    }
    if ((isPublishing || this.data.isEdit) && (!variants.length || variants.some(item => !item.sku.trim() || !item.color.trim() || !item.size.trim()
      || !Number.isInteger(Number(item.stockCentral)) || Number(item.stockCentral) < 0))) {
      this.setData({ error: '至少添加一个有效 SKU，并填写颜色、尺码及非负整数初始库存。' });
      return;
    }
    const skuKeys = variants.map(item => item.sku.trim().toLowerCase());
    const combinationKeys = variants.map(item => `${item.color.trim().toLowerCase()}\\u0000${item.size.trim().toLowerCase()}`);
    if ((isPublishing || this.data.isEdit) && (new Set(skuKeys).size !== skuKeys.length || new Set(combinationKeys).size !== combinationKeys.length)) {
      this.setData({ error: 'SKU 编号和颜色尺码组合不能重复。' });
      return;
    }
    const mediaLimit = this.data.mediaLimit;
    if (media.length > mediaLimit || (isPublishing && !media.some(item => item.type === 'image'))) {
      this.setData({ error: `媒体不能超过 ${mediaLimit} 个；发布商品至少需要一张图片。` });
      return;
    }
    if (isPublishing && (!name.trim() || !styleNo.trim() || !category)) {
      this.setData({ error: '发布商品请填写款号、商品名称并选择产品分类。' });
      return;
    }
    if (isFullPublish && (!this.data.brand.trim() || !this.data.season.trim()
      || !this.data.origin.trim() || !this.data.fabric.trim() || !this.data.composition.trim())) {
      this.setData({ error: '完整发布请填写品牌、季节、产地、面料和材质成分。' });
      return;
    }
    this.setData({ saving: true, error: '' });
    try {
      const uploadedMedia = await this.uploadPendingMedia();
      const product = {
        name: name.trim(),
        styleNo: styleNo.trim(),
        category,
        subCategory: this.data.subCategory.trim(),
        brand: this.data.brand.trim(),
        season: this.data.season.trim(),
        wholesalePrice,
        wholesalePrice100,
        bulkPriceMinimumQuantity,
        rrpPrice,
        moq,
        packSize,
        requiresFullCarton: this.data.requiresFullCarton,
        origin: this.data.origin.trim(),
        fabric: this.data.fabric.trim(),
        composition: this.data.composition.trim(),
        manufacturingProcess: this.data.manufacturingProcess.trim(),
        fit: this.data.fit.trim(),
        weight: this.data.weight.trim(),
        packaging: this.data.packaging.trim(),
        washCare: this.data.washCare.trim(),
        description: this.data.description.trim(),
        status: this.data.status,
        visibility: this.data.visibility,
        lifecycleStatus: isPublishing ? 'published' : this.data.isEdit ? this.data.lifecycleStatus : 'draft',
        media: uploadedMedia,
        images: uploadedMedia.filter(item => item.type === 'image').map(item => item.url),
        skus: variants.map(item => ({
          sku: item.sku.trim(),
          color: item.color.trim(),
          colorCode: item.colorCode.trim(),
          size: item.size.trim(),
          barcode: item.barcode.trim(),
          stockCentral: Number(item.stockCentral),
          isActive: item.isActive !== false
        }))
      };
      if ((this._industryFieldDefs || []).length) {
        const industryAttributes = {};
        (this._industryFieldDefs || []).forEach(field => {
          const value = String(this.data.industryValues[field.key] || '').trim();
          if (value) industryAttributes[field.key] = value;
        });
        product.industryAttributes = industryAttributes;
      }
      if (this.data.canManageCosts) product.costPrice = costPrice;
      if (this.data.isEdit) {
        if (this.data.updatedAt) product.expectedUpdatedAt = this.data.updatedAt;
        await request(`/api/merchant/products/${encodeURIComponent(this.data.productId)}`, {
          method: 'PUT',
          data: product
        });
      } else {
        product.creationRequestKey = requestKey();
        await request('/api/merchant/products', { method: 'POST', data: product });
      }
      wx.showToast({ title: this.data.isEdit ? '商品资料已保存' : isPublishing ? '商品已发布' : '商品草稿已创建', icon: 'success' });
      wx.navigateBack();
    } catch (error) {
      if (error && error.code === 'PRODUCT_VERSION_CONFLICT') {
        this.setData({ error: '商品已在其他端更新。为避免覆盖，本次保存未提交；请返回商品详情重新打开后再编辑。' });
        return;
      }
      if (error && error.code === 'INDUSTRY_PRODUCT_FIELDS_INVALID') {
        this.setData({ error: '请填写本行业必填商品字段（行业专属字段中标为必填的项）。' });
        return;
      }
      this.setData({ error: error.message || '商品保存失败，请检查权限和媒体存储配置。' });
    } finally {
      this.setData({ saving: false });
    }
  }
});

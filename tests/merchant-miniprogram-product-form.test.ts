import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const require = createRequire(import.meta.url);
const productCategories = require('../merchant-miniprogram/utils/product-categories.js');

const formSource = readFileSync(new URL('../merchant-miniprogram/pages/product-form/index.js', import.meta.url), 'utf8');
const formMarkup = readFileSync(new URL('../merchant-miniprogram/pages/product-form/index.wxml', import.meta.url), 'utf8');
const formStyles = readFileSync(new URL('../merchant-miniprogram/pages/product-form/index.wxss', import.meta.url), 'utf8');
const formConfig = JSON.parse(readFileSync(new URL('../merchant-miniprogram/pages/product-form/index.json', import.meta.url), 'utf8'));

function createPage(request: (path: string, options?: Record<string, unknown>) => Promise<any>) {
  let definition: Record<string, any> | undefined;
  const notices: Array<Record<string, unknown>> = [];
  runInNewContext(formSource, {
    Page: (page: Record<string, any>) => { definition = page; },
    require: (specifier: string) => {
      if (specifier === '../../utils/api') return { request };
      if (specifier === '../../utils/page-auth') return { requireMerchantSession: async () => ({ session: { role: 'merchant' } }) };
      if (specifier === '../../utils/permissions') return { canAccessPermissions: () => true };
      if (specifier === '../../utils/product-categories') return productCategories;
      if (specifier === '../../utils/industry') {
        return {
          loadIndustryContext: async () => ({ templateId: 'apparel_wholesale', productFields: [] }),
          parseIndustryAttributes: () => ({})
        };
      }
      throw new Error(`Unexpected module: ${specifier}`);
    },
    wx: {
      showToast: (notice: Record<string, unknown>) => notices.push(notice),
      navigateBack: () => notices.push({ action: 'navigateBack' }),
      getWindowInfo: () => ({ statusBarHeight: 24 }),
      chooseMedia: (options: Record<string, unknown>) => notices.push({ action: 'chooseMedia', options })
    },
    console
  });
  assert.ok(definition);
  const page = Object.assign({}, definition, {
    data: JSON.parse(JSON.stringify(definition.data)),
    notices,
    setData(update: Record<string, unknown>) {
      Object.assign(this.data, update);
    }
  });
  return page;
}

test('mini program product form exposes the mobile app product upload fields and multi-SKU/media controls', () => {
  for (const field of [
    'styleNo', 'name', 'brand', 'season', 'subCategory', 'wholesalePrice100',
    'bulkPriceMinimumQuantity', 'costPrice', 'packSize', 'requiresFullCarton',
    'origin', 'fabric', 'composition', 'manufacturingProcess', 'fit',
    'weight', 'packaging', 'washCare', 'description'
  ]) {
    assert.match(formMarkup, new RegExp(`data-field="${field}"`), `missing product field ${field}`);
  }
  assert.match(formMarkup, /生成颜色 × 尺码组合/);
  assert.match(formMarkup, /class="color-option-swatch"/);
  assert.match(formMarkup, /size-option-chip-selected/);
  assert.match(formMarkup, /继续添加/);
  assert.match(formMarkup, /wx:if="\{\{!isEdit\}\}" class="secondary-button form-button" bindtap="addVariant"/);
  assert.match(formMarkup, /data-action="publish"/);
  assert.match(formMarkup, />草稿</);
  assert.match(formMarkup, />发布</);
  assert.match(formMarkup, /拍照 \/ 上传/);
  assert.match(formMarkup, /最多 \{\{mediaLimit\}\} 项/);
  assert.match(formMarkup, /bindchange="onZoneChange"/);
  assert.match(formMarkup, />取消</);
  assert.match(formMarkup, /保存修改/);
});

test('product form uses the shared refined component style while preserving save and publish actions', () => {
  assert.equal(formConfig.navigationStyle, 'custom');
  assert.doesNotMatch(formMarkup, /form-header|form-back-icon|form-header-title/);
  assert.match(formMarkup, /style="padding-top: \{\{statusBarHeight\}\}px;"/);
  assert.match(formMarkup, /class="image-plus-icon" src="\/assets\/icons\/plus\.png"/);
  assert.match(formMarkup, /class="picker-chevron" src="\/assets\/icons\/chevron_right\.png"/);
  assert.match(formMarkup, /hover-class="ui-button-pressed"[^>]*bindtap="onModeChange"/);
  assert.match(formStyles, /\.form-card\s*\{[^}]*border-radius:\s*26rpx/);
  assert.match(formStyles, /\.product-form-screen \.input\s*\{[^}]*border:\s*1rpx solid #e7e5e1/);
  assert.match(formStyles, /\.form-card\s*\{[^}]*box-shadow:\s*0 7rpx 22rpx rgba\(31, 28, 23, \.04\)/);
  assert.match(formStyles, /\.product-form-screen \.input:focus,[\s\S]*box-shadow:\s*0 0 0 3rpx rgba\(29, 27, 25, \.055\)/);
  assert.match(formStyles, /\.product-zone-picker\s*\{[^}]*box-shadow:\s*0 3rpx 8rpx rgba\(29, 27, 25, \.035\)/);
  assert.match(formStyles, /\.form-actions \.primary-button\s*\{[^}]*linear-gradient/);
  assert.match(formStyles, /\.product-form-screen \.item-meta\s*\{[^}]*color:\s*#858585/);
  assert.match(formStyles, /\.preference-row\s*\{[^}]*justify-content:\s*space-between/);
  assert.match(formStyles, /\.media-role\s*\{[^}]*top:\s*8rpx/);
  assert.match(formStyles, /\.media-order\s*\{[^}]*z-index:\s*1/);
  assert.match(formStyles, /\.color-option-swatch\s*\{[^}]*border-radius:\s*50%/);
  assert.match(formStyles, /\.media-item-main\s*\{[^}]*grid-column:\s*span 2/);
  assert.match(formStyles, /\.media-upload-spinner\s*\{[^}]*animation:\s*media-upload-spin/);
  assert.match(formStyles, /\.form-actions \.save-button\s*\{[^}]*min-height:\s*72rpx/);
  assert.match(formStyles, /\.form-actions \.save-button\s*\{[^}]*font-size:\s*28rpx/);
  assert.match(formStyles, /\.form-actions \.save-button\s*\{[^}]*flex:\s*1/);
  assert.match(formStyles, /\.form-actions \.primary-button\s*\{[^}]*background:\s*linear-gradient/);
  assert.match(formStyles, /\.mode-button\s*\{[^}]*min-height:\s*35rpx/);
  assert.match(formStyles, /\.mode-button\s*\{[^}]*font-size:\s*22rpx/);
  assert.match(formStyles, /\.mode-switch\s*\{[^}]*width:\s*94%/);
  assert.match(formStyles, /\.image-select-empty\s*\{[^}]*grid-column:\s*span 3/);
  assert.match(formStyles, /\.image-select-empty\s*\{[^}]*height:\s*460rpx/);
  assert.match(formStyles, /\.more-colors-toggle,\s*\.other-size-toggle\s*\{[^}]*width:\s*44rpx/);
  assert.match(formStyles, /\.color-options\s*\{[^}]*grid-template-columns:\s*repeat\(8/);
  assert.match(formStyles, /\.size-options\s*\{[^}]*grid-template-columns:\s*repeat\(8/);
  assert.match(formMarkup, /mode === 'quick' \? 'mode-selected' : ''/);
  assert.match(formStyles, /\.mode-button\.mode-selected\s*\{[^}]*background:\s*linear-gradient\(180deg, #303030 0%, #171717 100%\)/);
  assert.match(formStyles, /\.mode-button\.mode-selected\s*\{[^}]*color:\s*#fff/);
  assert.match(formMarkup, /aria-label="更多颜色"/);
  assert.match(formMarkup, /placeholder="自定义颜色名称"/);
  assert.match(formMarkup, /placeholder="自定义尺码"/);
  assert.match(formStyles, /\.form-card \.form-button\s*\{[^}]*min-height:\s*56rpx/);
  assert.doesNotMatch(formMarkup, /form-section-heading|form-section-index|form-section-subtitle|form-section-title|商品图片与视频|款号、名称与商品分类|选择商品在店铺中的展示位置|01\s*基本信息|02\s*颜色尺码/);
  assert.match(formMarkup, /form-input-primary/);
  assert.match(formMarkup, /class="product-zone-title">商品展示区/);
  assert.match(formMarkup, /<picker range="\{\{productZones\}\}" range-key="label" value="\{\{zoneIndex\}\}" bindchange="onZoneChange">/);
  assert.match(formStyles, /\.product-zone-picker\s*\{[^}]*min-height:\s*96rpx/);
  assert.match(formMarkup, /class="price-pair">[\s\S]*data-field="rrpPrice"[\s\S]*placeholder="原价 \(€\)"[\s\S]*data-field="wholesalePrice"[\s\S]*placeholder="批发价 \(€ \/ 件\)"/);
  assert.match(formStyles, /\.price-pair\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(formSource, /label: '新款区'/);
  assert.match(formSource, /label: '特价区'/);
  assert.match(formSource, /label: '授权订货区'/);
  assert.doesNotMatch(formMarkup, /data-field="(?:colorInput|sizeInput)"/);
  assert.match(formMarkup, /data-action="draft"[^>]*>草稿<\/button>/);
  assert.match(formMarkup, /data-action="publish"[^>]*>发布<\/button>/);
  assert.match(formMarkup, /class="color-option-swatch" style="background: \{\{item.swatch \|\| '#d8d8d8'\}\};"/);
  assert.match(formMarkup, /正在上传 \{\{mediaUploadCurrent\}\} \/ \{\{mediaUploadTotal\}\}/);
  assert.match(formMarkup, /loading="\{\{saving\}\}"/);
  assert.match(formMarkup, /data-action="draft"[^>]*bindtap="save"/);
  assert.match(formMarkup, /data-action="publish"[^>]*bindtap="save"/);
  assert.match(formMarkup, /bindtap="toggleMoreColors"/);
  assert.match(formMarkup, /bindtap="toggleOtherSizes"/);
});

test('product display zone is available in quick mode and updates real visibility and status', () => {
  const page = createPage(async () => ({ success: true }));

  page.onZoneChange({ detail: { value: '1' } });
  assert.equal(page.data.zoneIndex, 1);
  assert.equal(page.data.zoneLabel, '特价区');
  assert.equal(page.data.status, 'clearance');
  assert.equal(page.data.visibility, 'public');

  page.onZoneChange({ detail: { value: '2' } });
  assert.equal(page.data.zoneIndex, 2);
  assert.equal(page.data.zoneLabel, '授权订货区');
  assert.equal(page.data.status, 'new');
  assert.equal(page.data.visibility, 'private');

  page.onZoneChange({ detail: { value: '0' } });
  assert.equal(page.data.zoneIndex, 0);
  assert.equal(page.data.zoneLabel, '新款区');
  assert.equal(page.data.status, 'new');
  assert.equal(page.data.visibility, 'public');
});

test('editing products restores the matching display-zone selection', async () => {
  for (const [status, visibility, expectedZone] of [
    ['new', 'public', 0],
    ['clearance', 'public', 1],
    ['new', 'private', 2]
  ] as const) {
    const page = createPage(async () => ({
      product: { status, visibility, skus: [], media: [] }
    }));
    page.setData({ canManage: true });
    await page.loadProduct('product-1', false);
    assert.equal(page.data.zoneIndex, expectedZone);
    assert.equal(page.data.zoneLabel, ['新款区', '特价区', '授权订货区'][expectedZone]);
  }
});

test('product form exposes actual media upload progress and clears it after each media is uploaded', async () => {
  const page = createPage(async () => ({ success: true }));
  const progress: Array<{ id: string; current: number; total: number }> = [];
  page.setData({
    media: [
      { id: 'image-a', type: 'image', localPath: '/tmp/a.jpg' },
      { id: 'image-b', type: 'image', localPath: '/tmp/b.jpg' }
    ]
  });
  page.uploadMedia = async function (item: Record<string, unknown>) {
    progress.push({
      id: String(this.data.mediaUploadingId),
      current: Number(this.data.mediaUploadCurrent),
      total: Number(this.data.mediaUploadTotal)
    });
    return { ...item, localPath: undefined, url: `https://cdn.example.test/${item.id}.jpg` };
  };

  const uploaded = await page.uploadPendingMedia();

  assert.deepEqual(progress, [
    { id: 'image-a', current: 1, total: 2 },
    { id: 'image-b', current: 2, total: 2 }
  ]);
  assert.equal(page.data.uploadingMedia, false);
  assert.equal(page.data.mediaUploadingId, '');
  assert.equal(page.data.mediaUploadCurrent, 0);
  assert.equal(page.data.mediaUploadTotal, 0);
  assert.deepEqual(
    JSON.parse(JSON.stringify(uploaded.map((item: Record<string, unknown>) => item.role))),
    ['main', 'detail']
  );
});

test('quick product entry supports choosing multiple media in one selection', () => {
  const page = createPage(async () => ({ success: true }));
  page.setData({ canManage: true });
  assert.equal(page.data.mediaLimit, 9);
  page.chooseImage();
  const choice = page.notices.find((notice: Record<string, unknown>) => notice.action === 'chooseMedia');
  assert.equal((choice?.options as Record<string, unknown>).count, 9);

  page.onModeChange({ currentTarget: { dataset: { mode: 'full' } } });
  assert.equal(page.data.mediaLimit, 32);
});

test('product form shows seven common color and size choices with compact expandable alternatives', () => {
  const page = createPage(async () => ({ success: true }));
  assert.equal(page.data.colorOptions.length, 7);
  assert.equal(page.data.otherColorOptions.length, 9);
  assert.equal(page.data.sizeOptions.length, 7);
  assert.deepEqual(
    JSON.parse(JSON.stringify(page.data.sizeOptions.map((option: Record<string, unknown>) => option.value))),
    ['均码', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
  );
  assert.equal(page.data.otherSizeOptions.length, 10);
  assert.match(formMarkup, /aria-label="选择\{\{item.value\}\}"/);
  assert.doesNotMatch(formMarkup, /<text>\{\{item\.value\}\}<\/text>\s*<view wx:if="\{\{item\.selected\}\}" class="color-selected-mark"/);
  assert.match(formMarkup, /bindtap="toggleOtherSizes"/);
  assert.match(formMarkup, /class="other-size-toggle[^"]*"[^>]*aria-label="更多尺码"/);

  page.toggleMoreColors();
  assert.equal(page.data.showMoreColors, true);
  page.toggleMatrixOption({ currentTarget: { dataset: { group: 'color', value: '红色' } } });
  page.toggleMatrixOption({ currentTarget: { dataset: { group: 'color', value: '蓝色' } } });
  assert.deepEqual(JSON.parse(JSON.stringify(page.data.selectedColors)), ['红色', '蓝色']);
  assert.equal(page.data.otherColorOptions.find((option: Record<string, unknown>) => option.value === '红色').selected, true);
  assert.equal(page.data.hasSelectedOtherColors, true);
  page.onCustomColorInput({ detail: { value: '午夜蓝 ' } });
  page.addCustomColor();
  assert.ok(page.data.selectedColors.includes('午夜蓝'));
  assert.equal(page.data.otherColorOptions.find((option: Record<string, unknown>) => option.value === '午夜蓝').custom, true);

  page.toggleOtherSizes();
  assert.equal(page.data.showOtherSizes, true);
  page.toggleMatrixOption({ currentTarget: { dataset: { group: 'size', value: 'EU 38' } } });
  assert.equal(page.data.otherSizeOptions.find((option: Record<string, unknown>) => option.value === 'EU 38').selected, true);
  assert.equal(page.data.hasSelectedOtherSizes, true);
  assert.ok(page.data.sizeInput.includes('EU 38'));
  page.onCustomSizeInput({ detail: { value: '2XL 短款' } });
  page.addCustomSize();
  assert.ok(page.data.selectedSizes.includes('2XL 短款'));
  assert.equal(page.data.otherSizeOptions.find((option: Record<string, unknown>) => option.value === '2XL 短款').selected, true);
});

test('mini program product creation generates distinct SKU combinations and submits real product details', async () => {
  const calls: Array<{ path: string; options?: Record<string, any> }> = [];
  const page = createPage(async (path, options) => {
    calls.push({ path, options });
    return { success: true };
  });
  await page.onLoad({});
  page.toggleMatrixOption({ currentTarget: { dataset: { group: 'color', value: '黑色' } } });
  assert.equal(page.data.colorInput, '黑色');
  assert.equal(page.data.colorOptions.find((option: { value: string }) => option.value === '黑色').selected, true);
  assert.equal(page.data.colorOptions.find((option: { value: string }) => option.value === '黑色').swatch, '#252525');
  page.setData({
    styleNo: 'RUDA-2608',
    colorInput: '黑色, 米白色',
    sizeInput: 'S,M',
    name: '轻薄外套',
    category: 'tops',
    brand: 'RUDA',
    season: '2026 秋冬',
    subCategory: '外套',
    wholesalePrice: '24',
    wholesalePrice100: '20',
    bulkPriceMinimumQuantity: '100',
    rrpPrice: '48',
    costPrice: '10',
    moq: '6',
    packSize: '6',
    origin: '意大利',
    fabric: '羊毛',
    composition: '100% 羊毛',
    manufacturingProcess: '常规车缝',
    fit: '常规',
    description: '真实商品描述',
    media: [{ id: 'main-image', type: 'image', url: 'https://cdn.example.test/coat.jpg', role: 'main' }]
  });
  page.generateVariants();
  assert.equal(page.data.variants.length, 4);
  assert.deepEqual(
    JSON.parse(JSON.stringify(page.data.variants.map((variant: Record<string, unknown>) => variant.sku))),
    ['RUDA-2608-COLOR-1-S', 'RUDA-2608-COLOR-1-M', 'RUDA-2608-COLOR-2-S', 'RUDA-2608-COLOR-2-M']
  );

  await page.save();
  const creation = calls.find(call => call.path === '/api/merchant/products');
  assert.ok(creation);
  assert.equal(creation.options?.method, 'POST');
  const submitted = creation.options?.data;
  assert.equal(submitted.brand, 'RUDA');
  assert.equal(submitted.season, '2026 秋冬');
  assert.equal(submitted.manufacturingProcess, '常规车缝');
  assert.equal(submitted.bulkPriceMinimumQuantity, 100);
  assert.equal(submitted.media[0].url, 'https://cdn.example.test/coat.jpg');
  assert.equal(submitted.skus.length, 4);
  assert.match(submitted.creationRequestKey, /^[0-9a-f-]{36}$/i);
});

test('mini program product edit fetches the detail endpoint and submits extended fields without changing stock', async () => {
  const calls: Array<{ path: string; options?: Record<string, any> }> = [];
  const existingProduct = {
    id: 'product-1',
    styleNo: 'RUDA-1',
    name: '外套',
    category: 'outerwear',
    brand: 'Brand',
    season: '2026',
    wholesalePrice: 20,
    wholesalePrice100: 18,
    bulkPriceMinimumQuantity: 50,
    rrpPrice: 40,
    costPrice: 7,
    moq: 6,
    packSize: 6,
    requiresFullCarton: false,
    origin: 'Italy',
    fabric: 'Wool',
    composition: '100% wool',
    manufacturingProcess: 'Sewing',
    fit: 'Regular',
    weight: '1 kg',
    packaging: 'Box',
    washCare: 'Dry clean',
    description: 'Details',
    status: 'new',
    visibility: 'public',
    lifecycleStatus: 'draft',
    images: ['https://cdn.example.test/coat.jpg'],
    media: [{ id: 'main', type: 'image', url: 'https://cdn.example.test/coat.jpg', role: 'main' }],
    skus: [{ sku: 'RUDA-1-BLK-M', color: 'Black', colorCode: '#000000', size: 'M', barcode: '123', stockCentral: 9, isActive: true }]
  };
  const page = createPage(async (path, options) => {
    calls.push({ path, options });
    if (path === '/api/merchant/products/product-1') return { product: existingProduct };
    return { success: true };
  });

  await page.onLoad({ id: 'product-1' });
  assert.ok(calls.some(call => call.path === '/api/merchant/products/product-1'));
  assert.equal(page.data.variants[0].stockCentral, 9);
  await page.save();
  const update = calls.find(call => call.path === '/api/merchant/products/product-1' && call.options?.method === 'PUT');
  assert.ok(update);
  assert.equal(update.options?.data.category, 'outerwear', 'editing legacy categories must not silently reset them');
  assert.equal(update.options?.data.manufacturingProcess, 'Sewing');
  assert.equal(update.options?.data.packaging, 'Box');
  assert.equal(update.options?.data.skus[0].stockCentral, 9);
  assert.equal(update.options?.data.costPrice, 7);
});

test('mini program product media supports main-image selection and ordering', async () => {
  const page = createPage(async () => ({ success: true }));
  await page.onLoad({});
  page.setData({
    media: [
      { id: 'image-a', type: 'image', role: 'main' },
      { id: 'image-b', type: 'image', role: 'detail' },
      { id: 'video-c', type: 'video', role: 'detail' }
    ]
  });

  page.setMainMedia({ currentTarget: { dataset: { index: '1' } } });
  assert.deepEqual(
    JSON.parse(JSON.stringify(page.data.media.map((item: Record<string, unknown>) => item.role))),
    ['detail', 'main', 'detail']
  );
  page.moveMedia({ currentTarget: { dataset: { index: '1', direction: '-1' } } });
  assert.deepEqual(
    JSON.parse(JSON.stringify(page.data.media.map((item: Record<string, unknown>) => item.id))),
    ['image-b', 'image-a', 'video-c']
  );
});

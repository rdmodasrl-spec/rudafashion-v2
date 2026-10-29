import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMerchantProduct,
  createMerchantProductDraft,
  generateMerchantProductVariants,
  isValidMerchantProductPricing,
  normalizeMerchantProductDefaultMoq,
  normalizeMerchantProductVariantSettings,
  validateMerchantProductDraft
} from '../src/shared/merchantProductCreation';

const validDraft = () => ({
  ...createMerchantProductDraft(),
  styleNo: 'TEST-001',
  name: 'Test garment',
  category: 'tops',
  brand: 'Test brand',
  season: 'Autumn / Winter',
  origin: 'Italy',
  fabric: 'Wool',
  composition: '100% wool',
  lifecycleStatus: 'published' as const,
  wholesalePrice: 24,
  wholesalePrice100: 20,
  costPrice: 10,
  variants: [{
    sku: 'TEST-001-BLACK-S',
    color: 'Black',
    colorCode: '',
    size: 'S',
    barcode: '',
    initialStock: 4,
    isActive: true
  }, {
    sku: 'TEST-001-WHITE-M',
    color: 'White',
    colorCode: '',
    size: 'M',
    barcode: '',
    initialStock: 2,
    isActive: true
  }],
  media: [{ id: 'image-1', type: 'image' as const, url: 'https://cdn.example.test/test-image.jpg' }]
});

test('mobile publish validation allows optional details without changing web validation', () => {
  const draft = validDraft();
  assert.equal(validateMerchantProductDraft(draft), null);
  const optionalDetails = {
    ...draft,
    brand: '',
    season: '',
    origin: '',
    fabric: '',
    composition: ''
  };
  assert.match(validateMerchantProductDraft(optionalDetails, 'publish', 'full') || '', /完整创建/);
  assert.equal(validateMerchantProductDraft(optionalDetails, 'publish', 'full', { allowOptionalFullDetails: true }), null);
  assert.match(validateMerchantProductDraft({ ...draft, category: 'invalid-category' }) || '', /产品分类/);
  assert.equal(validateMerchantProductDraft({ ...draft, media: [] }), null);
  assert.match(validateMerchantProductDraft({ ...draft, media: [] }, 'publish', 'quick', { requireImageOnPublish: true }) || '', /商品图片/);
  assert.match(validateMerchantProductDraft({ ...draft, wholesalePrice100: 25 }) || '', /批发价/);
  assert.match(validateMerchantProductDraft({
    ...draft,
    variants: draft.variants.map(variant => ({ ...variant, wholesalePrice: 0 }))
  }, 'publish', 'quick', { validateVariantPrices: true }) || '', /SKU 的批发价/);
});

test('quick creation drafts may be incomplete, while publish requires real SKU inventory inputs', () => {
  const draft = createMerchantProductDraft();
  assert.equal(validateMerchantProductDraft(draft, 'draft', 'quick'), null);
  assert.match(validateMerchantProductDraft(draft, 'publish', 'quick') || '', /款号/);
});

test('merchant default MOQ is prefilled for new drafts and invalid settings use the standard default', () => {
  assert.equal(createMerchantProductDraft(24).moq, 24);
  assert.equal(createMerchantProductDraft().moq, 6);
  assert.equal(normalizeMerchantProductDefaultMoq(0), 6);
  assert.equal(normalizeMerchantProductDefaultMoq(100001), 6);
  assert.equal(normalizeMerchantProductDefaultMoq(2.5), 6);
});

test('variant matrix generation keeps unique color-size combinations and excludes missing combinations', () => {
  const variants = generateMerchantProductVariants(
    'RD-001',
    ['Black', 'White'],
    ['S', 'M'],
    [{ color: 'white', size: 'M' }]
  );
  assert.deepEqual(variants.map(({ sku }) => sku), [
    'RD-001-BLACK-S',
    'RD-001-BLACK-M',
    'RD-001-WHITE-S'
  ]);
  assert(variants.every(variant => variant.initialStock === 0));
});

test('SKU API settings preserve legacy defaults and validate optional mobile fields', () => {
  assert.deepEqual(normalizeMerchantProductVariantSettings({ sku: 'LEGACY-1' }), {});
  assert.deepEqual(normalizeMerchantProductVariantSettings({
    wholesalePrice: 21.5,
    allowBackorder: false
  }), { wholesalePrice: 21.5, allowBackorder: false });
  assert.equal(normalizeMerchantProductVariantSettings({ wholesalePrice: 0 }), null);
  assert.equal(normalizeMerchantProductVariantSettings({ wholesalePrice: Number.NaN }), null);
  assert.equal(normalizeMerchantProductVariantSettings({ allowBackorder: 'false' }), null);
});

test('merchant API accepts zero RRP when a product has only its base wholesale price', () => {
  assert.equal(isValidMerchantProductPricing({
    wholesalePrice: 24,
    wholesalePrice100: null,
    rrpPrice: 0,
    costPrice: 10
  }), true);
  assert.equal(isValidMerchantProductPricing({
    wholesalePrice: 24,
    wholesalePrice100: 25,
    rrpPrice: 0,
    costPrice: 10
  }), false);
});

test('mobile product builder persists SKU price and backorder while the shared web builder stays unchanged', () => {
  const draft = {
    ...validDraft(),
    variants: validDraft().variants.map((variant, index) => ({
      ...variant,
      wholesalePrice: index === 0 ? 21 : undefined,
      allowBackorder: index === 0
    }))
  };
  const webProduct = buildMerchantProduct(draft, 'merchant-1', 'Merchant One');
  assert.equal(Object.hasOwn(webProduct.skus[0], 'wholesalePrice'), false);
  assert.equal(Object.hasOwn(webProduct.skus[0], 'allowBackorder'), false);

  const product = buildMerchantProduct(draft, 'merchant-1', 'Merchant One', { persistVariantPricing: true });
  assert.equal(product.lifecycleStatus, 'published');
  assert.equal(product.merchantId, 'merchant-1');
  assert.equal(product.merchantName, 'Merchant One');
  assert.equal(product.wholesalePrice100, 20);
  assert.deepEqual(product.images, ['https://cdn.example.test/test-image.jpg']);
  assert.equal(product.skus.length, 2);
  assert.equal(product.skus[0].stockCentral, 4);
  assert.equal(product.skus[0].wholesalePrice, 21);
  assert.equal(product.skus[0].allowBackorder, true);
  assert.equal(product.skus[1].wholesalePrice, draft.wholesalePrice);
  assert.equal(product.skus[1].allowBackorder, false);
  assert.equal(product.costPrice, 10);
});

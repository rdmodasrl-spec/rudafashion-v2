import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { PRODUCT_CATEGORIES, getProductCategoryLabel } from '../src/constants/productCategories';
import { createMerchantProductDraft, validateMerchantProductDraft } from '../src/shared/merchantProductCreation';

const require = createRequire(import.meta.url);
const miniProgramCategories = require('../merchant-miniprogram/utils/product-categories.js');

const draftWithCategory = (category: string) => ({
  ...createMerchantProductDraft(),
  styleNo: 'RD-CAT-001',
  name: 'Category test garment',
  category,
  wholesalePrice: 24,
  variants: [{
    sku: 'RD-CAT-001-BLACK-S',
    color: '黑色',
    colorCode: '',
    size: 'S',
    barcode: '',
    initialStock: 3,
    isActive: true
  }]
});

test('product categories are unique, bilingual and cover basic apparel plus bags', () => {
  const values = PRODUCT_CATEGORIES.map(item => item.value);

  assert.equal(new Set(values).size, values.length);
  assert.ok(values.includes('bags'), '箱包 is a first-level category');
  assert.ok(values.includes('tops') && values.includes('pants') && values.includes('skirts'), 'existing values are kept');

  for (const category of PRODUCT_CATEGORIES) {
    assert.match(category.value, /^[a-z]+(?:_[a-z]+)*$/);
    assert.match(category.zh, /^[A-Za-z\u4e00-\u9fff]{2,5}$/);
    assert.match(category.zh, /[\u4e00-\u9fff]/);
    assert.ok(category.it.trim().length > 0);
    assert.equal(getProductCategoryLabel(category.value, false), category.zh);
    assert.equal(getProductCategoryLabel(category.value, true), category.it);
  }

  // 创建入口按 3 列（手机）与 4/6 列（桌面）排布，保持整行不出现残缺
  assert.equal(values.length % 3, 0);
  assert.equal(values.length % 6, 0);
});

test('legacy gender categories stay readable while every category passes draft validation', () => {
  assert.equal(getProductCategoryLabel('women', false), '女装');
  assert.equal(getProductCategoryLabel('men', true), 'Uomo');
  assert.equal(getProductCategoryLabel('children', false), '童装');

  for (const category of PRODUCT_CATEGORIES) {
    const error = validateMerchantProductDraft(draftWithCategory(category.value), 'publish', 'quick');
    assert.doesNotMatch(error || '', /产品分类/, `${category.value} is accepted`);
  }
  assert.match(validateMerchantProductDraft(draftWithCategory('not-a-category'), 'publish', 'quick') || '', /产品分类/);
});

test('mini program category copy mirrors the authoritative directory', () => {
  assert.deepEqual(
    miniProgramCategories.PRODUCT_CATEGORIES,
    PRODUCT_CATEGORIES.map(item => ({ value: item.value, label: item.zh }))
  );
  for (const category of PRODUCT_CATEGORIES) {
    assert.equal(miniProgramCategories.getProductCategoryLabel(category.value), category.zh);
  }
  assert.equal(miniProgramCategories.getProductCategoryLabel('bags'), '箱包');
});

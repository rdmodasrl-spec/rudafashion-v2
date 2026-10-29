import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveProductFollowUpQuery } from '../src/server/publicAssistantFollowUp';
import { searchPublicProducts, type PublicProductSearchRecord } from '../src/utils/publicProductSearch';

const cityProducts: PublicProductSearchRecord[] = [
  {
    id: 'milan-pants',
    status: 'new',
    styleNo: 'MI-1',
    name: 'Cotton Pants',
    category: 'women',
    subCategory: 'pants',
    brand: 'Milan House',
    wholesalePrice: 14,
    moq: 6,
    merchant: { id: 'milan', name: 'Milan House', storeSlug: 'milan', city: 'Milan', country: 'Italy' }
  },
  {
    id: 'rome-pants',
    status: 'new',
    styleNo: 'RO-1',
    name: 'Linen Pants',
    category: 'women',
    subCategory: 'pants',
    brand: 'Rome House',
    wholesalePrice: 18,
    moq: 6,
    merchant: { id: 'rome', name: 'Rome House', storeSlug: 'rome', city: 'Rome', country: 'Italy' }
  }
];

test('retains the previous product and location criteria for a cheaper follow-up', () => {
  const query = resolveProductFollowUpQuery('更便宜一点', [
    { role: 'user', text: '找米兰的裤子' },
    { role: 'assistant', text: '找到 3 款裤子。' }
  ]);

  assert.equal(query, '找米兰的裤子 更便宜一点');
});

test('replaces the old location when a product follow-up names another city', () => {
  const query = resolveProductFollowUpQuery('换成罗马的呢？', [
    { role: 'user', text: '找米兰的裤子' },
    { role: 'assistant', text: '找到 3 款裤子。' }
  ]);

  assert.equal(query, '找 的裤子 换成罗马的呢？');
  assert.deepEqual(searchPublicProducts(cityProducts, `${query} 找商品`).matches.map(product => product.id), ['rome-pants']);
});

test('does not reuse unrelated conversation or non-refinement turns', () => {
  assert.equal(resolveProductFollowUpQuery('更便宜一点', [
    { role: 'user', text: '你好，今天怎么样？' },
    { role: 'assistant', text: '我很好，谢谢。' }
  ]), null);
  assert.equal(resolveProductFollowUpQuery('还有吗', [
    { role: 'user', text: '找意大利的连衣裙' }
  ]), '找意大利的连衣裙 还有吗');
  assert.equal(resolveProductFollowUpQuery('你多大？', [
    { role: 'user', text: '找米兰的裤子' }
  ]), null);
});

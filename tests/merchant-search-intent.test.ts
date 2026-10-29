import assert from 'node:assert/strict';
import test from 'node:test';
import {
  expandMerchantSearchColor,
  expandMerchantSearchSynonyms,
  interpretMerchantSearch,
  interpretMerchantSearchDebounced,
  shouldInterpretMerchantSearch
} from '../src/server/merchantSearchIntent';

test('only complex stock and sales searches call the intent parser', () => {
  assert.equal(shouldInterpretMerchantSearch('Q00000123'), false);
  assert.equal(shouldInterpretMerchantSearch('black jacket'), false);
  assert.equal(shouldInterpretMerchantSearch('帮我找库存低于10件的黑色外套'), true);
  assert.equal(shouldInterpretMerchantSearch('上周销量最高的外套'), true);
});

test('business synonyms and a single English spelling typo expand without AI', () => {
  assert.deepEqual(expandMerchantSearchSynonyms('裙子'), ['裙子', '连衣裙', '半身裙', 'dress', 'skirt']);
  assert.ok(expandMerchantSearchSynonyms('jakcet').includes('jacket'));
  assert.deepEqual(expandMerchantSearchSynonyms('unrelated'), ['unrelated']);
});

test('known apparel colors match Chinese and English SKU values', () => {
  assert.deepEqual(expandMerchantSearchColor('黑色'), ['黑色', 'black']);
  assert.deepEqual(expandMerchantSearchColor('grey'), ['grey', 'gray', '灰色']);
  assert.deepEqual(expandMerchantSearchColor('not-a-color'), []);
});

test('intent parser accepts only the constrained structured result', async () => {
  const result = await interpretMerchantSearch(
    '帮我找库存低于10件的黑色外套',
    async () => JSON.stringify({
      intent: 'inventory',
      keywords: '外套',
      color: '黑色',
      stockThreshold: 10,
      period: 'all_time'
    })
  );
  assert.deepEqual(result, {
    intent: 'inventory',
    keywords: '外套',
    color: '黑色',
    stockThreshold: 10,
    period: 'all_time'
  });
});

test('explicit stock and sales language overrides an ambiguous model classification', async () => {
  const result = await interpretMerchantSearch(
    '库存低于20件的端到端测试商品',
    async () => JSON.stringify({
      intent: 'products',
      keywords: '端到端测试商品',
      color: '',
      stockThreshold: null,
      period: 'all_time'
    })
  );
  assert.equal(result.intent, 'inventory');
  assert.equal(result.stockThreshold, 20);
});

test('intent parser rejects SQL-like or malformed model output', async () => {
  await assert.rejects(
    interpretMerchantSearch('查库存', async () => '{"intent":"inventory","sql":"SELECT *"}'),
    { message: 'MERCHANT_SEARCH_INTENT_INVALID' }
  );
  await assert.rejects(
    interpretMerchantSearch('查库存', async () => 'not-json'),
    { message: 'MERCHANT_SEARCH_INTENT_INVALID' }
  );
});

test('only the latest natural-language query in a user scope reaches the AI parser', async () => {
  let generated = 0;
  const generate = async () => {
    generated += 1;
    return JSON.stringify({
      intent: 'inventory',
      keywords: '外套',
      color: '',
      stockThreshold: 10,
      period: 'all_time'
    });
  };
  const first = interpretMerchantSearchDebounced('库存低于10件的黑色外套', 'merchant:employee', 5, generate);
  const latest = interpretMerchantSearchDebounced('库存低于10件的外套', 'merchant:employee', 5, generate);
  assert.equal(await first, null);
  assert.equal((await latest)?.keywords, '外套');
  assert.equal(generated, 1);
});

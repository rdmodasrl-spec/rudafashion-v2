import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeFashionHashtags } from '../src/utils/fashionHashtags';

test('fashion hashtags normalize prefixes and remove case-insensitive duplicates', () => {
  assert.deepEqual(normalizeFashionHashtags(['#Moda', 'moda', '  #estate  ', '']), ['Moda', 'estate']);
});

test('fashion hashtags reject invalid types, unsafe characters and overlong tags', () => {
  assert.equal(normalizeFashionHashtags('moda'), null);
  assert.equal(normalizeFashionHashtags(['fashion!']), null);
  assert.equal(normalizeFashionHashtags(['a'.repeat(31)]), null);
  assert.equal(normalizeFashionHashtags(Array.from({ length: 9 }, (_, index) => `tag${index}`)), null);
});

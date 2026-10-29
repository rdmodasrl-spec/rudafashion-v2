import assert from 'node:assert/strict';
import test from 'node:test';
import { getFeedWindowBounds } from '../src/utils/feedWindow';

test('large fashion feeds keep a fixed-size mounted card window', () => {
  const window = getFeedWindowBounds(20_000, 10_000);
  assert.deepEqual(window, { start: 9_998, end: 10_005 });
  assert.equal(window.end - window.start, 7);
});

test('feed window clamps at the beginning and end', () => {
  assert.deepEqual(getFeedWindowBounds(20_000, 0), { start: 0, end: 5 });
  assert.deepEqual(getFeedWindowBounds(20_000, 19_999), { start: 19_997, end: 20_000 });
});

test('empty feeds and invalid indexes do not produce invalid ranges', () => {
  assert.deepEqual(getFeedWindowBounds(0, 0), { start: 0, end: 0 });
  assert.deepEqual(getFeedWindowBounds(8, Number.NaN), { start: 0, end: 5 });
});

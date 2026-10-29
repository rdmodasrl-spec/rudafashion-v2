import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseFashionDismissedItems,
  parseFashionTasteProfile,
  rankFashionItems,
  updateFashionDismissedItems,
  updateFashionTaste
} from '../src/utils/fashionTaste';

test('taste signals build category preferences with stronger saves than likes', () => {
  const liked = updateFashionTaste({}, '女装趋势', 'like', true);
  const saved = updateFashionTaste(liked, '女装趋势', 'save', true);

  assert.equal(liked['女装趋势'], 2);
  assert.equal(saved['女装趋势'], 5);
});

test('removing a reaction reverses its preference signal', () => {
  const likedAndSaved = { '女装趋势': 5 };
  const withoutLike = updateFashionTaste(likedAndSaved, '女装趋势', 'like', false);
  const withoutBoth = updateFashionTaste(withoutLike, '女装趋势', 'save', false);

  assert.equal(withoutLike['女装趋势'], 3);
  assert.equal('女装趋势' in withoutBoth, false);
});

test('not-interested feedback lowers category affinity and can be reversed', () => {
  const disliked = updateFashionTaste({}, '女装趋势', 'dislike', true);
  const reset = updateFashionTaste(disliked, '女装趋势', 'dislike', false);

  assert.equal(disliked['女装趋势'], -4);
  assert.equal('女装趋势' in reset, false);
});

test('dismissed items are deduplicated, validated, and capped', () => {
  const items = updateFashionDismissedItems(['post-1'], 'post-1');
  const expanded = Array.from({ length: 520 }, (_, index) =>
    updateFashionDismissedItems(index === 0 ? items : [], `post-${index + 2}`)
  ).flat();
  const parsed = parseFashionDismissedItems(['ok_1', 'ok_1', '../invalid', 4, 'x'.repeat(101)]);

  assert.deepEqual(items, ['post-1']);
  assert.equal(parseFashionDismissedItems(expanded).length, 500);
  assert.deepEqual(parsed, ['ok_1']);
});

test('preference scores are bounded and invalid stored values are ignored', () => {
  const saturated = Array.from({ length: 20 }).reduce<Record<string, number>>(
    profile => updateFashionTaste(profile, '女装趋势', 'save', true),
    {}
  );

  assert.equal(saturated['女装趋势'], 20);
  assert.deepEqual(parseFashionTasteProfile({
    '女装趋势': 28,
    invalid: Number.NaN,
    ['x'.repeat(81)]: 4
  }), { '女装趋势': 20 });
});

test('recommendation ranking boosts preferred categories and preserves ties', () => {
  const items = [
    { id: 'first', category: '男装趋势' },
    { id: 'second', category: '女装趋势' },
    { id: 'third', category: '女装趋势' },
    { id: 'uncategorized' }
  ];

  assert.deepEqual(
    rankFashionItems(items, { '女装趋势': 3 }).map(item => item.id),
    ['second', 'third', 'first', 'uncategorized']
  );
  assert.deepEqual(rankFashionItems(items, {}).map(item => item.id), items.map(item => item.id));
});

test('recommendations diversify long category streaks when alternatives are close', () => {
  const items = [
    { id: 'womens-1', category: '女装趋势' },
    { id: 'womens-2', category: '女装趋势' },
    { id: 'womens-3', category: '女装趋势' },
    { id: 'mens-1', category: '男装趋势' },
    { id: 'womens-4', category: '女装趋势' }
  ];

  assert.deepEqual(
    rankFashionItems(items, { '女装趋势': 4, '男装趋势': 3 }).map(item => item.id),
    ['womens-1', 'womens-2', 'mens-1', 'womens-3', 'womens-4']
  );
});

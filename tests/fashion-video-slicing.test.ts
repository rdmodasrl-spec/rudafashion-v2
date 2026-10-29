import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FashionVideoProcessingError,
  parseFashionClipCount,
  planFashionVideoCuts
} from '../src/server/fashionVideoSlicing';

test('accepts only the supported clip counts', () => {
  assert.equal(parseFashionClipCount(4), 4);
  assert.equal(parseFashionClipCount('8'), 8);
  assert.equal(parseFashionClipCount(12), 12);
  assert.equal(parseFashionClipCount('16'), 16);
  assert.equal(parseFashionClipCount(5), null);
  assert.equal(parseFashionClipCount('four'), null);
});

test('places cuts at nearby scene changes and keeps every clip within three minutes', () => {
  const cuts = planFashionVideoCuts(480, [113, 246, 369], 4);
  assert.deepEqual(cuts, [0, 113, 246, 369, 480]);
  assert.ok(cuts.slice(1).every((end, index) => end - cuts[index] <= 180));
});

test('uses even intervals when no suitable scene boundaries exist', () => {
  assert.deepEqual(planFashionVideoCuts(480, [], 4), [0, 120, 240, 360, 480]);
});

test('rejects insufficient clip counts and falls back to safe even cuts near the duration cap', () => {
  assert.throws(
    () => planFashionVideoCuts(1800, [], 4),
    (error: unknown) => error instanceof FashionVideoProcessingError && error.code === 'FASHION_SLICE_COUNT_TOO_LOW'
  );
  assert.throws(
    () => planFashionVideoCuts(1801, [], 16),
    (error: unknown) => error instanceof FashionVideoProcessingError && error.code === 'FASHION_SOURCE_VIDEO_DURATION_INVALID'
  );
  assert.deepEqual(planFashionVideoCuts(720, [165, 350, 540], 4), [0, 180, 360, 540, 720]);
});

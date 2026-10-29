import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveFashionStudioTimelinePosition } from '../src/shared/fashionStudioTimeline';

test('maps timeline time to reordered source clips', () => {
  const clips = [
    { startSeconds: 10, endSeconds: 12 },
    { startSeconds: 3, endSeconds: 6 },
    { startSeconds: 20, endSeconds: 21 }
  ];

  assert.deepEqual(resolveFashionStudioTimelinePosition(clips, 0), {
    clipIndex: 0,
    timelineSeconds: 0,
    sourceSeconds: 10
  });
  assert.deepEqual(resolveFashionStudioTimelinePosition(clips, 2.5), {
    clipIndex: 1,
    timelineSeconds: 2.5,
    sourceSeconds: 3.5
  });
  assert.deepEqual(resolveFashionStudioTimelinePosition(clips, 5), {
    clipIndex: 2,
    timelineSeconds: 5,
    sourceSeconds: 20
  });
  assert.deepEqual(resolveFashionStudioTimelinePosition(clips, 6), {
    clipIndex: 2,
    timelineSeconds: 6,
    sourceSeconds: 21
  });
});

test('clamps timeline seeks and rejects invalid clip ranges', () => {
  const clips = [{ startSeconds: 4, endSeconds: 8 }];

  assert.deepEqual(resolveFashionStudioTimelinePosition(clips, -2), {
    clipIndex: 0,
    timelineSeconds: 0,
    sourceSeconds: 4
  });
  assert.deepEqual(resolveFashionStudioTimelinePosition(clips, 40), {
    clipIndex: 0,
    timelineSeconds: 4,
    sourceSeconds: 8
  });
  assert.equal(resolveFashionStudioTimelinePosition([], 0), null);
  assert.equal(resolveFashionStudioTimelinePosition(clips, Number.NaN), null);
  assert.equal(resolveFashionStudioTimelinePosition([{ startSeconds: 2, endSeconds: 2 }], 0), null);
});

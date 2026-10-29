import assert from 'node:assert/strict';
import test from 'node:test';
import { alternateFashionMedia, buildFashionGalleryLayout } from '../src/utils/fashionFeedOrder';

const item = (id: string, mediaType: 'image' | 'video') => ({
  id,
  mediaType,
  videoUrl: mediaType === 'video' ? `${id}.mp4` : null
});

test('immersive fashion feed alternates videos and images while preserving order', () => {
  const items = [
    item('image-1', 'image'),
    item('video-1', 'video'),
    item('video-2', 'video'),
    item('image-2', 'image'),
    item('image-3', 'image')
  ];
  assert.deepEqual(
    alternateFashionMedia(items).map(entry => entry.id),
    ['video-1', 'image-1', 'video-2', 'image-2', 'image-3']
  );
});

test('image-only feeds keep their original order', () => {
  const items = [item('image-1', 'image'), item('image-2', 'image')];
  assert.deepEqual(alternateFashionMedia(items), items);
});

test('fashion gallery mixes three pairs of medium images, large images, and videos', () => {
  const items = [
    ...Array.from({ length: 10 }, (_, index) => ({ ...item(`image-${index + 1}`, 'image'), title: `Image ${index + 1}` })),
    ...Array.from({ length: 2 }, (_, index) => ({ ...item(`video-${index + 1}`, 'video'), title: `Video ${index + 1}` }))
  ];

  assert.deepEqual(
    buildFashionGalleryLayout(items).map(({ item: entry, size }) => [entry.id, size]),
    [
      ['image-1', 'medium'], ['image-2', 'medium'], ['image-3', 'medium'],
      ['image-4', 'medium'], ['image-5', 'medium'], ['image-6', 'medium'],
      ['image-7', 'feature'], ['image-8', 'feature'], ['video-1', 'feature'],
      ['image-9', 'medium'], ['image-10', 'medium'], ['video-2', 'feature']
    ]
  );
});

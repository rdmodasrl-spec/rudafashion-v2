import test from 'node:test';
import assert from 'node:assert/strict';
import { canPublishToMetaChannel, hasMetaPublishingTask, isPublicHttpsMediaUrl } from '../src/server/metaPublishing';

test('accepts only HTTPS image URLs on public hosts', () => {
  assert.equal(isPublicHttpsMediaUrl('https://cdn.example.com/product/sku.jpg'), true);
  assert.equal(isPublicHttpsMediaUrl('http://cdn.example.com/product/sku.jpg'), false);
  assert.equal(isPublicHttpsMediaUrl('https://user:password@cdn.example.com/sku.jpg'), false);
  assert.equal(isPublicHttpsMediaUrl('https://localhost/sku.jpg'), false);
  assert.equal(isPublicHttpsMediaUrl('https://images.internal/sku.jpg'), false);
  assert.equal(isPublicHttpsMediaUrl('https://127.0.0.1/sku.jpg'), false);
  assert.equal(isPublicHttpsMediaUrl('https://192.168.1.12/sku.jpg'), false);
  assert.equal(isPublicHttpsMediaUrl('https://[::1]/sku.jpg'), false);
  assert.equal(isPublicHttpsMediaUrl(`https://cdn.example.com/${'a'.repeat(2000)}.jpg`), false);
  assert.equal(isPublicHttpsMediaUrl('not a URL'), false);
});

test('allows only Page tasks that grant content publishing access', () => {
  assert.equal(hasMetaPublishingTask(['ANALYZE', 'CREATE_CONTENT']), true);
  assert.equal(hasMetaPublishingTask(['PROFILE_PLUS_FULL_CONTROL']), true);
  assert.equal(hasMetaPublishingTask(['ANALYZE', 'ADVERTISE']), false);
  assert.equal(hasMetaPublishingTask(['CREATE_CONTENT', 12]), false);
  assert.equal(hasMetaPublishingTask(null), false);
});

test('enforces publishing tasks separately for Instagram and Facebook Pages', () => {
  assert.equal(canPublishToMetaChannel(['CREATE_CONTENT'], 'instagram'), true);
  assert.equal(canPublishToMetaChannel(['PROFILE_PLUS_FULL_CONTROL'], 'facebook'), true);
  assert.equal(canPublishToMetaChannel(['CREATE_CONTENT', 'MANAGE', 'MODERATE'], 'facebook'), true);
  assert.equal(canPublishToMetaChannel(['CREATE_CONTENT', 'MODERATE'], 'facebook'), false);
  assert.equal(canPublishToMetaChannel(['ANALYZE', 'ADVERTISE'], 'instagram'), false);
});

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { buyerAvatarOptions, isBuyerAvatarUrl } from '../src/utils/buyerAvatars';

const publicRoot = join(process.cwd(), 'public');

test('buyer registration offers nine distinct bundled avatars', () => {
  assert.equal(buyerAvatarOptions.length, 9);
  assert.equal(new Set(buyerAvatarOptions.map(avatar => avatar.url)).size, 9);
  for (const avatar of buyerAvatarOptions) {
    assert.equal(isBuyerAvatarUrl(avatar.url), true);
    assert.equal(existsSync(join(publicRoot, avatar.url.slice(1))), true, `${avatar.url} exists`);
  }
});

test('buyer avatar validation only accepts the bundled choices', () => {
  assert.equal(isBuyerAvatarUrl('/buyer-avatars/avatar-1.webp'), true);
  assert.equal(isBuyerAvatarUrl('/uploads/other-avatar.png'), false);
  assert.equal(isBuyerAvatarUrl('https://example.com/avatar.webp'), false);
  assert.equal(isBuyerAvatarUrl(null), false);
});

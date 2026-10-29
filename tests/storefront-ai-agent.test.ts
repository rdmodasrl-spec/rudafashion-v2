import test from 'node:test';
import assert from 'node:assert/strict';
import { canUseStorefrontAiAgent } from '../src/server/storefrontAiAgent';

test('allows storefront agent access only for verified merchants with paid activation enabled', () => {
  assert.equal(canUseStorefrontAiAgent(true, true, true), true);
  assert.equal(canUseStorefrontAiAgent(true, false, true), false);
  assert.equal(canUseStorefrontAiAgent(false, true, true), false);
  assert.equal(canUseStorefrontAiAgent(true, true, false), false);
  assert.equal(canUseStorefrontAiAgent(false, false, false), false);
});

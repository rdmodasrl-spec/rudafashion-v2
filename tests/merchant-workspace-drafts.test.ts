import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isMerchantWorkspaceDraftKind,
  serializeMerchantWorkspaceDraft
} from '../src/shared/merchantWorkspaceDrafts';

test('workspace draft kinds are restricted to supported merchant workspaces', () => {
  assert.equal(isMerchantWorkspaceDraftKind('content'), true);
  assert.equal(isMerchantWorkspaceDraftKind('growth'), true);
  for (const value of [null, undefined, '', 'settings', 'admin']) {
    assert.equal(isMerchantWorkspaceDraftKind(value), false);
  }
});

test('workspace draft documents must be bounded JSON objects', () => {
  assert.equal(serializeMerchantWorkspaceDraft({ drafts: [] }), '{"drafts":[]}');
  assert.throws(() => serializeMerchantWorkspaceDraft(null), /MERCHANT_WORKSPACE_DRAFT_INVALID/);
  assert.throws(() => serializeMerchantWorkspaceDraft([]), /MERCHANT_WORKSPACE_DRAFT_INVALID/);
  assert.throws(
    () => serializeMerchantWorkspaceDraft({ body: 'x'.repeat(1_000_001) }),
    /MERCHANT_WORKSPACE_DRAFT_TOO_LARGE/
  );
});

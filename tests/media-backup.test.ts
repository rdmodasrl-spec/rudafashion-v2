import assert from 'node:assert/strict';
import test from 'node:test';
import { validateMediaBackupTarget } from '../src/shared/mediaBackup';

test('requires a distinct media backup bucket and a safe object prefix', () => {
  assert.equal(validateMediaBackupTarget('ruda-media', 'ruda-media-backup', 'media-backups'), true);
  assert.equal(validateMediaBackupTarget('ruda-media', 'ruda-media', 'media-backups'), false);
  assert.equal(validateMediaBackupTarget('ruda-media', 'ruda-media-backup', '../backup'), false);
  assert.equal(validateMediaBackupTarget('ruda-media', 'ruda-media-backup', '/backup'), false);
  assert.equal(validateMediaBackupTarget('ruda-media', 'ruda-media-backup', 'backup/'), false);
});

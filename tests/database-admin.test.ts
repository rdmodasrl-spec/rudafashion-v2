import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getBackupScheduleDate,
  isDatabaseBackupScheduleDue,
  isValidBackupFilename,
  validateDatabaseBackupSchedule,
  validateGoogleDriveServiceAccountJson
} from '../src/server/databaseAdmin';
import {
  isValidGoogleCloudProjectId,
  parseGoogleCloudServiceAccountJson
} from '../src/server/googleCloudDatabase';

test('database backup filenames only accept generated dump names', () => {
  assert.equal(isValidBackupFilename('ruda-db-20260929-100842.dump'), true);
  assert.equal(isValidBackupFilename('ruda-db-20260929-100842-a1b2c3d4.dump'), true);
  assert.equal(isValidBackupFilename('../ruda-db-20260929-100842.dump'), false);
  assert.equal(isValidBackupFilename('ruda-db-2026-09-29.dump'), false);
  assert.equal(isValidBackupFilename('ruda-db-20260929-100842.dump/other'), false);
});

test('database backup schedule validates IANA timezones, time, and retention boundaries', () => {
  const policy = { enabled: true, hour: 3, minute: 15, timezone: 'Europe/Rome', retentionCount: 30 };
  assert.equal(validateDatabaseBackupSchedule(policy), true);
  assert.equal(validateDatabaseBackupSchedule({ ...policy, timezone: 'Not/A_Timezone' }), false);
  assert.equal(validateDatabaseBackupSchedule({ ...policy, hour: 24 }), false);
  assert.equal(validateDatabaseBackupSchedule({ ...policy, retentionCount: 0 }), false);
  assert.equal(validateDatabaseBackupSchedule({ ...policy, retentionCount: 366 }), false);
});

test('automatic backup schedule runs once the local scheduled time has passed', () => {
  const policy = { enabled: true, hour: 3, minute: 15, timezone: 'Europe/Rome', retentionCount: 30 };
  const beforeSchedule = new Date('2026-01-15T02:14:00.000Z');
  const atSchedule = new Date('2026-01-15T02:15:00.000Z');
  assert.deepEqual(getBackupScheduleDate(atSchedule, policy.timezone), { date: '2026-01-15', hour: 3, minute: 15 });
  assert.equal(isDatabaseBackupScheduleDue(beforeSchedule, policy, ''), false);
  assert.equal(isDatabaseBackupScheduleDue(atSchedule, policy, ''), true);
  assert.equal(isDatabaseBackupScheduleDue(new Date('2026-01-15T05:00:00.000Z'), policy, '2026-01-15'), false);
  assert.equal(isDatabaseBackupScheduleDue(atSchedule, { ...policy, enabled: false }, ''), false);
});

test('Google Drive backup service account credentials require email and private key fields', () => {
  assert.doesNotThrow(() => validateGoogleDriveServiceAccountJson(JSON.stringify({
    client_email: 'backup@example.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\nprivate-key\n-----END PRIVATE KEY-----'
  })));
  assert.throws(
    () => validateGoogleDriveServiceAccountJson(JSON.stringify({ client_email: 'backup@example.com' })),
    { message: 'DATABASE_BACKUP_GOOGLE_DRIVE_CREDENTIALS_INVALID' }
  );
  assert.throws(
    () => validateGoogleDriveServiceAccountJson('{'),
    { message: 'DATABASE_BACKUP_GOOGLE_DRIVE_CREDENTIALS_INVALID' }
  );
});

test('Google Cloud project IDs follow Google project ID constraints', () => {
  assert.equal(isValidGoogleCloudProjectId('ruda-prod-2026'), true);
  assert.equal(isValidGoogleCloudProjectId('project-3d37d9ec-1775-403e-a6f'), true);
  assert.equal(isValidGoogleCloudProjectId('a23456'), true);
  assert.equal(isValidGoogleCloudProjectId('Ruda-Production'), false);
  assert.equal(isValidGoogleCloudProjectId('abc'), false);
  assert.equal(isValidGoogleCloudProjectId('ruda_prod_1'), false);
});

test('Google Cloud read-only credentials require a service account and private key', () => {
  const credentials = parseGoogleCloudServiceAccountJson(JSON.stringify({
    client_email: 'database-reader@example.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\\nkey\\n-----END PRIVATE KEY-----'
  }));
  assert.match(credentials.private_key, /\n/);
  assert.throws(
    () => parseGoogleCloudServiceAccountJson(JSON.stringify({
      client_email: 'not-a-service-account@example.com',
      private_key: '-----BEGIN PRIVATE KEY-----key'
    })),
    { message: 'DATABASE_GOOGLE_CLOUD_CREDENTIALS_INVALID' }
  );
  assert.throws(
    () => parseGoogleCloudServiceAccountJson('{'),
    { message: 'DATABASE_GOOGLE_CLOUD_CREDENTIALS_INVALID' }
  );
});

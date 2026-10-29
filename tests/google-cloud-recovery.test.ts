import assert from 'node:assert/strict';
import test from 'node:test';
import {
  generateGoogleCloudRecoveryTargetId,
  getGoogleCloudDatabaseEngine,
  getGoogleCloudUserDatabaseNames,
  isGoogleCloudSqlMySqlVersion,
  isValidGoogleCloudProjectId,
  isValidGoogleCloudSqlBackupRunId,
  isValidGoogleCloudSqlInstanceId,
  transitionGoogleCloudRecoveryDrill,
  type GoogleCloudRecoveryDrill
} from '../src/server/googleCloudDatabase';

const drill: GoogleCloudRecoveryDrill = {
  id: '12abcdef-1234-4234-8234-123456789abc',
  projectId: 'ruda-prod-123',
  sourceInstanceId: 'ruda-production',
  backupRunId: '1234567890',
  targetInstanceId: 'ruda-drill-12abcdef123442348234123456789abc',
  ownershipLabels: { ruda_owner: 'restore_drill', ruda_run: '12abcdef123442348234123456789abc' },
  status: 'CREATING',
  creationResolved: false,
  recoveryVerified: false,
  cleanupComplete: false,
  createdAt: '2026-09-29T00:00:00.000Z',
  updatedAt: '2026-09-29T00:00:00.000Z'
};

test('validates Cloud SQL project, source-instance, and backup-run identifiers', () => {
  assert.equal(isValidGoogleCloudProjectId('ruda-prod-123'), true);
  assert.equal(isValidGoogleCloudProjectId('Ruda-prod'), false);
  assert.equal(isValidGoogleCloudProjectId('ab'), false);

  assert.equal(isValidGoogleCloudSqlInstanceId('ruda-production'), true);
  assert.equal(isValidGoogleCloudSqlInstanceId('bad/instance'), false);
  assert.equal(isValidGoogleCloudSqlInstanceId('-invalid'), false);

  assert.equal(isValidGoogleCloudSqlBackupRunId('1234567890'), true);
  assert.equal(isValidGoogleCloudSqlBackupRunId('SUCCESS'), false);
  assert.equal(isValidGoogleCloudSqlBackupRunId('1/2'), false);
  assert.equal(isGoogleCloudSqlMySqlVersion('MYSQL_8_4'), true);
  assert.equal(isGoogleCloudSqlMySqlVersion('POSTGRES_16'), false);
  assert.equal(getGoogleCloudDatabaseEngine('MYSQL_8_4'), 'MySQL');
  assert.equal(getGoogleCloudDatabaseEngine('POSTGRES_16'), 'PostgreSQL');
  assert.equal(getGoogleCloudDatabaseEngine('SQLSERVER_2022_STANDARD'), undefined);
  assert.deepEqual(
    getGoogleCloudUserDatabaseNames(
      [{ name: 'postgres' }, { name: 'template0' }, { name: 'template1' }],
      'PostgreSQL'
    ),
    ['postgres']
  );
  assert.deepEqual(
    getGoogleCloudUserDatabaseNames(
      [{ name: 'mysql' }, { name: 'information_schema' }, { name: 'app' }],
      'MySQL'
    ),
    ['app']
  );
});

test('generates unpredictable, valid drill instance names with the required prefix', () => {
  const targetId = generateGoogleCloudRecoveryTargetId('01234567-89ab-cdef-0123-456789abcdef');
  assert.equal(targetId, 'ruda-drill-0123456789abcdef0123456789abcdef');
  assert.match(targetId, /^ruda-drill-[a-f0-9]{32}$/);
  assert.throws(() => generateGoogleCloudRecoveryTargetId('short'), /RANDOM_ID_INVALID/);
});

test('enforces recovery status transitions and verified-success invariant', () => {
  const restoring = transitionGoogleCloudRecoveryDrill(drill, 'RESTORING');
  const verifying = transitionGoogleCloudRecoveryDrill(restoring, 'VERIFYING');
  assert.throws(
    () => transitionGoogleCloudRecoveryDrill(verifying, 'SUCCEEDED'),
    /VERIFICATION_REQUIRED/
  );
  const cleanupPending = transitionGoogleCloudRecoveryDrill(verifying, 'CLEANUP_PENDING', {
    error: 'DATABASE_GOOGLE_CLOUD_RECOVERY_CLEANUP_FAILED'
  });
  assert.equal(cleanupPending.status, 'CLEANUP_PENDING');
  assert.equal(
    transitionGoogleCloudRecoveryDrill(cleanupPending, 'SUCCEEDED', {
      recoveryVerified: true,
      cleanupComplete: true
    }).status,
    'SUCCEEDED'
  );
  assert.throws(() => transitionGoogleCloudRecoveryDrill(drill, 'SUCCEEDED'), /INVALID_STATE_TRANSITION/);
});

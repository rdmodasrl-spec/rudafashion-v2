import assert from 'node:assert/strict';
import test from 'node:test';
import { getIsolatedE2ETestDatabaseUrl } from '../scripts/e2eTestDatabaseSafety';

const localTestDatabase = 'postgresql://test-user:test-password@127.0.0.1:5432/ruda_e2e_test';

test('E2E database URL requires test mode and an explicit dedicated URL', () => {
  assert.throws(
    () => getIsolatedE2ETestDatabaseUrl({ nodeEnv: 'production', testDatabaseUrl: localTestDatabase }),
    { message: 'E2E_TEST_DATABASE_URL_AND_NODE_ENV_TEST_REQUIRED' }
  );
  assert.throws(
    () => getIsolatedE2ETestDatabaseUrl({ nodeEnv: 'test' }),
    { message: 'E2E_TEST_DATABASE_URL_AND_NODE_ENV_TEST_REQUIRED' }
  );
});

test('E2E database URL must be PostgreSQL and explicitly named as a test database', () => {
  assert.throws(
    () => getIsolatedE2ETestDatabaseUrl({
      nodeEnv: 'test',
      testDatabaseUrl: 'mysql://test-user:test-password@127.0.0.1:3306/ruda_e2e_test'
    }),
    { message: 'E2E_TEST_DATABASE_URL_MUST_USE_POSTGRESQL' }
  );
  assert.throws(
    () => getIsolatedE2ETestDatabaseUrl({
      nodeEnv: 'test',
      testDatabaseUrl: 'postgresql://test-user:test-password@127.0.0.1:5432/ruda'
    }),
    { message: 'E2E_TEST_DATABASE_NAME_MUST_INCLUDE_TEST_OR_E2E' }
  );
});

test('E2E database URL cannot target the application database', () => {
  assert.throws(
    () => getIsolatedE2ETestDatabaseUrl({
      nodeEnv: 'test',
      testDatabaseUrl: localTestDatabase,
      applicationDatabaseUrl: 'postgresql://app:app-password@localhost:5432/ruda_e2e_test?schema=public'
    }),
    { message: 'E2E_TEST_DATABASE_MUST_NOT_MATCH_APPLICATION_DATABASE' }
  );
});

test('remote E2E database requires explicit opt-in and loopback test URL remains available', () => {
  assert.equal(
    getIsolatedE2ETestDatabaseUrl({
      nodeEnv: 'test',
      testDatabaseUrl: localTestDatabase
    }),
    new URL(localTestDatabase).toString()
  );
  assert.throws(
    () => getIsolatedE2ETestDatabaseUrl({
      nodeEnv: 'test',
      testDatabaseUrl: 'postgresql://user:password@qa.example.test:5432/ruda_e2e_test'
    }),
    { message: 'E2E_REMOTE_TEST_DATABASE_REQUIRES_E2E_ALLOW_REMOTE_DATABASE' }
  );
  assert.equal(
    getIsolatedE2ETestDatabaseUrl({
      nodeEnv: 'test',
      testDatabaseUrl: 'postgresql://user:password@qa.example.test:5432/ruda_e2e_test',
      allowRemoteDatabase: 'true'
    }),
    'postgresql://user:password@qa.example.test:5432/ruda_e2e_test'
  );
});

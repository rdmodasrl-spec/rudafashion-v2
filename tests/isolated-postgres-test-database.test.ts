import assert from 'node:assert/strict';
import test from 'node:test';
import { getIsolatedPostgresTestDatabaseUrl } from '../scripts/isolatedPostgresTestDatabase';

const runId = 'a'.repeat(32);
const containerId = 'b'.repeat(64);
const runOwnership = { runId, containerId };
const localTestDatabase = `postgresql://test:secret@127.0.0.1:5432/ruda_e2e_${runId}_test`;

test('isolated PostgreSQL target requires test mode, explicit URL, and a test database name', () => {
  assert.throws(
    () => getIsolatedPostgresTestDatabaseUrl({
      nodeEnv: 'production',
      testDatabaseUrl: localTestDatabase,
      ...runOwnership
    }),
    { message: 'POSTGRES_TEST_DATABASE_URL_AND_NODE_ENV_TEST_REQUIRED' }
  );
  assert.throws(
    () => getIsolatedPostgresTestDatabaseUrl({ nodeEnv: 'test', ...runOwnership }),
    { message: 'POSTGRES_TEST_DATABASE_URL_AND_NODE_ENV_TEST_REQUIRED' }
  );
  assert.throws(
    () => getIsolatedPostgresTestDatabaseUrl({
      nodeEnv: 'test',
      testDatabaseUrl: 'postgresql://test:secret@127.0.0.1:5432/ruda',
      ...runOwnership
    }),
    { message: 'POSTGRES_TEST_DATABASE_NAME_MUST_INCLUDE_TEST_OR_E2E' }
  );
});

test('isolated PostgreSQL target rejects remote and non-PostgreSQL endpoints', () => {
  assert.throws(
    () => getIsolatedPostgresTestDatabaseUrl({
      nodeEnv: 'test',
      testDatabaseUrl: `postgresql://test:secret@db.example.test:5432/ruda_e2e_${runId}_test`,
      ...runOwnership
    }),
    { message: 'POSTGRES_TEST_DATABASE_MUST_BE_LOOPBACK' }
  );
  assert.throws(
    () => getIsolatedPostgresTestDatabaseUrl({
      nodeEnv: 'test',
      testDatabaseUrl: `mysql://test:secret@127.0.0.1:3306/ruda_e2e_${runId}_test`,
      ...runOwnership
    }),
    { message: 'POSTGRES_TEST_DATABASE_URL_MUST_USE_POSTGRESQL' }
  );
});

test('isolated PostgreSQL target requires the run ID and full container ID', () => {
  assert.throws(
    () => getIsolatedPostgresTestDatabaseUrl({
      nodeEnv: 'test',
      testDatabaseUrl: localTestDatabase
    }),
    { message: 'POSTGRES_TEST_CONTAINER_OWNERSHIP_REQUIRED' }
  );
  assert.throws(
    () => getIsolatedPostgresTestDatabaseUrl({
      nodeEnv: 'test',
      testDatabaseUrl: 'postgresql://test:secret@127.0.0.1:5432/ruda_e2e_other_test',
      ...runOwnership
    }),
    { message: 'POSTGRES_TEST_DATABASE_NAME_MUST_MATCH_ISOLATED_RUN' }
  );
});

test('application database equality uses normalized loopback hosts and ports', () => {
  assert.throws(
    () => getIsolatedPostgresTestDatabaseUrl({
      nodeEnv: 'test',
      testDatabaseUrl: localTestDatabase,
      applicationDatabaseUrl: `postgresql://app:secret@localhost:5432/ruda_e2e_${runId}_test`,
      ...runOwnership
    }),
    { message: 'POSTGRES_TEST_DATABASE_MUST_NOT_MATCH_APPLICATION_DATABASE' }
  );
  assert.equal(
    getIsolatedPostgresTestDatabaseUrl({
      nodeEnv: 'test',
      testDatabaseUrl: localTestDatabase,
      applicationDatabaseUrl: 'postgresql://app:secret@localhost:5432/ruda_production',
      ...runOwnership
    }),
    new URL(localTestDatabase).toString()
  );
});

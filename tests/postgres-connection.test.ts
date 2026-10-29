import assert from 'node:assert/strict';
import test from 'node:test';
import { getPostgresToolEnvironment } from '../scripts/postgresConnection';

test('PostgreSQL tool environment uses only the supplied endpoint, not inherited PG targets', () => {
  const oldValues = {
    DATABASE_URL: process.env.DATABASE_URL,
    PGHOST: process.env.PGHOST,
    PGPORT: process.env.PGPORT,
    PGUSER: process.env.PGUSER,
    PGPASSWORD: process.env.PGPASSWORD,
    PGDATABASE: process.env.PGDATABASE,
    PGSERVICE: process.env.PGSERVICE
  };
  try {
    process.env.DATABASE_URL = 'postgresql://app:secret@prod.example:5432/ruda';
    process.env.PGHOST = 'prod.example';
    process.env.PGPORT = '5432';
    process.env.PGUSER = 'prod_user';
    process.env.PGPASSWORD = 'prod_password';
    process.env.PGDATABASE = 'ruda';
    process.env.PGSERVICE = 'production';

    const { environment, databaseName } = getPostgresToolEnvironment(
      'postgresql://test:secret@127.0.0.1:55432/ruda_e2e_test?sslmode=require'
    );

    assert.equal(databaseName, 'ruda_e2e_test');
    assert.equal(environment.PGHOST, '127.0.0.1');
    assert.equal(environment.PGPORT, '55432');
    assert.equal(environment.PGUSER, 'test');
    assert.equal(environment.PGDATABASE, 'ruda_e2e_test');
    assert.equal(environment.PGSSLMODE, 'require');
    assert.equal(environment.PGPASSWORD, 'secret');
    assert.equal(environment.PGSERVICE, undefined);
    assert.equal(environment.DATABASE_URL, undefined);
  } finally {
    for (const [name, value] of Object.entries(oldValues)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test('PostgreSQL tool environment refuses hostless URLs instead of inheriting PGHOST', () => {
  assert.throws(
    () => getPostgresToolEnvironment('postgresql:///ruda_e2e_test'),
    { message: 'POSTGRES_HOST_REQUIRED' }
  );
});

import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

export const isPostgresConfigured = Boolean(
  process.env.SQL_HOST?.trim() || process.env.DATABASE_URL?.trim()
);

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = (): Pool | null => {
  if (!isPostgresConfigured) {
    return null;
  }
  if (!global._postgresPool) {
    global._postgresPool = new Pool(
      process.env.DATABASE_URL
        ? {
            connectionString: process.env.DATABASE_URL,
            max: 10,
            connectionTimeoutMillis: 15000,
          }
        : {
            host: process.env.SQL_HOST,
            user: process.env.SQL_USER,
            password: process.env.SQL_PASSWORD,
            database: process.env.SQL_DB_NAME,
            max: 10,
            connectionTimeoutMillis: 15000,
          }
    );

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();
const db: NodePgDatabase<typeof schema> = pool
  ? drizzle(pool, { schema })
  : (new Proxy(
      {},
      {
        get: () => {
          throw new Error('PostgreSQL is not configured');
        },
      }
    ) as NodePgDatabase<typeof schema>);

export { db, pool };

import 'dotenv/config';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

async function runMigrations() {
  const host = process.env.SQL_HOST;
  const database = process.env.SQL_DB_NAME;
  const user = process.env.SQL_ADMIN_USER || process.env.SQL_USER;
  const password = process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD;

  if (!host || !database || !user || !password) {
    throw new Error('Missing required SQL_HOST / SQL_DB_NAME / SQL_ADMIN_USER / SQL_ADMIN_PASSWORD environment variables.');
  }

  const pool = new Pool({
    host,
    database,
    user,
    password,
    max: 3,
    connectionTimeoutMillis: 15000,
  });

  try {
    // Ensure pgvector extension is enabled before running Drizzle vector schema migrations
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector;');
    const db = drizzle(pool);
    await migrate(db, {
      migrationsFolder: path.resolve(process.cwd(), 'drizzle'),
    });
    console.log('PostgreSQL pgvector extension & Drizzle migrations verified cleanly.');
  } finally {
    await pool.end();
  }
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

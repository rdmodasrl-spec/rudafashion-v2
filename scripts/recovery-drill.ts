import 'dotenv/config';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { getPostgresToolEnvironment } from './postgresConnection';

type BackupManifest = {
  file: string;
  sizeBytes: number;
  sha256: string;
};

function run(command: string, args: string[], environment: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env: environment, stdio: 'inherit' });
    child.once('error', reject);
    child.once('close', code => code === 0
      ? resolve()
      : reject(new Error(`RECOVERY_DRILL_COMMAND_FAILED_${command}_${code ?? 'signal'}`)));
  });
}

async function checksum(filename: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filename)) hash.update(chunk);
  return hash.digest('hex');
}

async function main() {
  const sourceUrl = process.env.DATABASE_URL;
  const targetUrl = process.env.RECOVERY_DATABASE_URL;
  const dumpPath = process.env.RECOVERY_BACKUP_FILE;
  if (!sourceUrl || !targetUrl || !dumpPath) {
    throw new Error('DATABASE_URL_RECOVERY_DATABASE_URL_AND_RECOVERY_BACKUP_FILE_REQUIRED');
  }
  const source = getPostgresToolEnvironment(sourceUrl);
  const target = getPostgresToolEnvironment(targetUrl);
  if (source.databaseName === target.databaseName || !/^ruda_recovery_drill_[a-z0-9_]+$/i.test(target.databaseName)) {
    throw new Error('RECOVERY_TARGET_MUST_BE_A_DISTINCT_RUDA_RECOVERY_DRILL_DATABASE');
  }

  const absoluteDumpPath = path.resolve(dumpPath);
  const manifestPath = `${absoluteDumpPath}.json`;
  const [dumpStat, manifestText] = await Promise.all([stat(absoluteDumpPath), readFile(manifestPath, 'utf8')]);
  const manifest = JSON.parse(manifestText) as BackupManifest;
  if (
    !dumpStat.isFile()
    || dumpStat.size <= 0
    || manifest.file !== path.basename(absoluteDumpPath)
    || manifest.sizeBytes !== dumpStat.size
    || !/^[a-f0-9]{64}$/.test(manifest.sha256)
    || await checksum(absoluteDumpPath) !== manifest.sha256
  ) {
    throw new Error('RECOVERY_BACKUP_CHECKSUM_OR_MANIFEST_INVALID');
  }

  const targetPrisma = new PrismaClient({ datasources: { db: { url: targetUrl } } });
  try {
    const tables = await targetPrisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*)::bigint AS count
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name <> '_prisma_migrations'
    `;
    if (Number(tables[0]?.count || 0) > 0) {
      throw new Error('RECOVERY_TARGET_DATABASE_MUST_BE_EMPTY');
    }
  } finally {
    await targetPrisma.$disconnect();
  }

  const pgRestoreEnvironment = target.environment;
  await run('pg_restore', [
    '--no-owner',
    '--no-acl',
    '--exit-on-error',
    '--dbname',
    target.databaseName,
    absoluteDumpPath
  ], pgRestoreEnvironment);

  const restoreCheck = new PrismaClient({ datasources: { db: { url: targetUrl } } });
  try {
    const requiredTables = ['Merchant', 'Product', 'Order', 'WarehouseLocation', 'InventoryBalance'];
    const tableRows = await restoreCheck.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;
    const tableSet = new Set(tableRows.map(row => row.table_name));
    const missing = requiredTables.filter(name => !tableSet.has(name));
    if (missing.length) throw new Error(`RECOVERY_REQUIRED_TABLES_MISSING_${missing.join('_')}`);
    const counts = await restoreCheck.$queryRaw<Array<{ merchants: bigint; products: bigint; orders: bigint }>>`
      SELECT
        (SELECT count(*) FROM "Merchant")::bigint AS merchants,
        (SELECT count(*) FROM "Product")::bigint AS products,
        (SELECT count(*) FROM "Order")::bigint AS orders
    `;
    await restoreCheck.$queryRaw`SELECT 1`;
    console.log(JSON.stringify({
      status: 'restore_verified',
      targetDatabase: target.databaseName,
      tableCount: tableRows.length,
      counts: {
        merchants: String(counts[0]?.merchants || 0),
        products: String(counts[0]?.products || 0),
        orders: String(counts[0]?.orders || 0)
      }
    }));
  } finally {
    await restoreCheck.$disconnect();
  }

  await run('npm', ['run', 'db:migrate'], { ...process.env, DATABASE_URL: targetUrl });
  console.log('Migration rehearsal passed on the restored recovery database. The drill database was intentionally retained for inspection.');
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'RECOVERY_DRILL_FAILED');
  process.exitCode = 1;
});

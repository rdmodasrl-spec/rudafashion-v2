import 'dotenv/config';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { chmod, mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { getPostgresToolEnvironment } from './postgresConnection';

function run(command: string, args: string[], environment: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env: environment, stdio: 'inherit' });
    child.once('error', reject);
    child.once('close', code => code === 0
      ? resolve()
      : reject(new Error(`PREDEPLOY_BACKUP_COMMAND_FAILED_${command}_${code ?? 'signal'}`)));
  });
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL_REQUIRED');
  const { environment } = getPostgresToolEnvironment(databaseUrl);
  const backupDirectory = path.resolve(process.env.DEPLOY_BACKUP_DIR || 'release/pre-deploy-backups');
  await mkdir(backupDirectory, { recursive: true, mode: 0o700 });
  await chmod(backupDirectory, 0o700);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dumpPath = path.join(backupDirectory, `pre-deploy-${timestamp}.dump`);
  const manifestPath = `${dumpPath}.json`;
  try {
    await run('pg_dump', ['--format=custom', '--no-owner', '--no-acl', `--file=${dumpPath}`], environment);
    await chmod(dumpPath, 0o600);
    const dumpStat = await stat(dumpPath);
    if (!dumpStat.isFile() || dumpStat.size === 0) throw new Error('PREDEPLOY_BACKUP_EMPTY');
    await run('pg_restore', ['--list', dumpPath], environment);
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(dumpPath)) hash.update(chunk);
    const manifest = {
      createdAt: new Date().toISOString(),
      file: path.basename(dumpPath),
      sizeBytes: dumpStat.size,
      sha256: hash.digest('hex'),
      databaseName: environment.PGDATABASE
    };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    await chmod(manifestPath, 0o600);
    console.log(`Pre-deploy database backup verified: ${dumpPath} (${dumpStat.size} bytes).`);
  } catch (error) {
    await Promise.all([
      import('node:fs/promises').then(fs => fs.unlink(dumpPath).catch(() => undefined)),
      import('node:fs/promises').then(fs => fs.unlink(manifestPath).catch(() => undefined))
    ]);
    throw error;
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'PREDEPLOY_BACKUP_FAILED');
  process.exitCode = 1;
});

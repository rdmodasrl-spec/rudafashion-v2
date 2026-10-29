import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open, chmod, lstat, mkdir, readFile, readdir, rename, stat, statfs, unlink, writeFile } from 'node:fs/promises';
import { request as httpsRequest } from 'node:https';
import path from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { HeadBucketCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { JWT } from 'google-auth-library';

const BACKUP_DIR = path.join(process.cwd(), 'logs', 'db-backups');
const DEFAULT_BACKUP_RETENTION_COUNT = 30;
const MAX_BACKUP_RETENTION_COUNT = 365;
const BACKUP_FILENAME_PATTERN = /^ruda-db-[0-9]{8}-[0-9]{6}(?:-[a-f0-9]{8})?\.dump$/;
const BACKUP_SYNC_STATE_PATH = path.join(BACKUP_DIR, 'sync-state.json');
const BACKUP_METADATA_PATH = path.join(BACKUP_DIR, 'metadata.json');
const BACKUP_LOCK_PATH = path.join(BACKUP_DIR, 'backup.lock');
const AUTOMATIC_BACKUP_STATE_PATH = path.join(BACKUP_DIR, 'automatic-backup-state.json');
const BACKUP_LOCK_MAX_AGE_MS = 20 * 60 * 1000;

export type DatabaseBackupSchedule = {
  enabled: boolean;
  hour: number;
  minute: number;
  timezone: string;
  retentionCount: number;
};

export type DatabaseTableStat = {
  name: string;
  rowEstimate: number;
  sizeBytes: number;
};

export type DatabaseMigrationStatus = {
  applied: string[];
  pending: string[];
  failed: string[];
};

export type DatabaseOverview = {
  status: 'connected' | 'degraded';
  latencyMs: number;
  databaseName: string;
  serverVersion: string;
  sizeBytes: number;
  tableCount: number;
  topTables: DatabaseTableStat[];
  activeConnections: number;
  maxConnections: number;
  backupDiskTotalBytes: number;
  backupDiskAvailableBytes: number;
  slowQueriesAvailable: boolean;
  slowQueries: { query: string; calls: number; meanMs: number }[];
  migrations: DatabaseMigrationStatus;
  checkedAt: string;
};

export type DatabaseBackupInfo = {
  filename: string;
  sizeBytes: number;
  createdAt: string;
  checksumSha256?: string;
  verifiedAt?: string;
  verificationStatus: 'verified' | 'unverified' | 'failed';
  sync?: DatabaseBackupSyncStatus;
};

export type BackupProviderStatus = {
  status: 'disabled' | 'pending' | 'synced' | 'failed';
  syncedAt?: string;
  remoteId?: string;
  error?: string;
};

export type DatabaseBackupSyncStatus = {
  s3: BackupProviderStatus;
  googleDrive: BackupProviderStatus;
};

export type BackupSyncTargets = {
  s3: { enabled: boolean; client?: S3Client; bucket?: string; prefix: string };
  googleDrive: { enabled: boolean; serviceAccountJson?: string; folderId?: string };
};

type StoredBackupSyncStatus = Record<string, DatabaseBackupSyncStatus>;
type StoredBackupMetadata = Record<string, {
  checksumSha256?: string;
  verifiedAt?: string;
  verificationStatus?: 'verified' | 'unverified' | 'failed';
}>;

const emptySyncStatus = (): DatabaseBackupSyncStatus => ({
  s3: { status: 'disabled' },
  googleDrive: { status: 'disabled' }
});

let syncStateWriteQueue = Promise.resolve();
const activeBackupSyncs = new Set<string>();
let activeBackupCreation = false;

export function validateDatabaseBackupSchedule(schedule: DatabaseBackupSchedule): boolean {
  if (
    typeof schedule.enabled !== 'boolean' ||
    !Number.isInteger(schedule.hour) || schedule.hour < 0 || schedule.hour > 23 ||
    !Number.isInteger(schedule.minute) || schedule.minute < 0 || schedule.minute > 59 ||
    !Number.isInteger(schedule.retentionCount) ||
    schedule.retentionCount < 1 || schedule.retentionCount > MAX_BACKUP_RETENTION_COUNT ||
    typeof schedule.timezone !== 'string' || schedule.timezone.length > 100
  ) {
    return false;
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone: schedule.timezone }).format();
    return true;
  } catch {
    return false;
  }
}

export function getBackupScheduleDate(date: Date, timezone: string): { date: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour),
    minute: Number(values.minute)
  };
}

export function isDatabaseBackupScheduleDue(date: Date, schedule: DatabaseBackupSchedule, lastRunDate: string): boolean {
  if (!schedule.enabled || !validateDatabaseBackupSchedule(schedule)) return false;
  const localTime = getBackupScheduleDate(date, schedule.timezone);
  return localTime.date !== lastRunDate &&
    (localTime.hour > schedule.hour || (localTime.hour === schedule.hour && localTime.minute >= schedule.minute));
}

async function readBackupSyncState(): Promise<StoredBackupSyncStatus> {
  try {
    const parsed: unknown = JSON.parse(await readFile(BACKUP_SYNC_STATE_PATH, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('DATABASE_BACKUP_SYNC_STATE_INVALID');
    }
    return parsed as StoredBackupSyncStatus;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return {};
    if (error instanceof SyntaxError) throw new Error('DATABASE_BACKUP_SYNC_STATE_INVALID');
    throw error;
  }
}

async function saveBackupSyncState(filename: string, status: DatabaseBackupSyncStatus): Promise<void> {
  const pendingWrite = syncStateWriteQueue.then(async () => {
    const current = await readBackupSyncState();
    current[filename] = status;
    const temporaryPath = `${BACKUP_SYNC_STATE_PATH}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, `${JSON.stringify(current, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
      await rename(temporaryPath, BACKUP_SYNC_STATE_PATH);
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
  });
  syncStateWriteQueue = pendingWrite.then(() => undefined, () => undefined);
  await pendingWrite;
}

async function removeBackupSyncState(filename: string): Promise<void> {
  const pendingWrite = syncStateWriteQueue.then(async () => {
    const current = await readBackupSyncState();
    delete current[filename];
    const temporaryPath = `${BACKUP_SYNC_STATE_PATH}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, `${JSON.stringify(current, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
      await rename(temporaryPath, BACKUP_SYNC_STATE_PATH);
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
  });
  syncStateWriteQueue = pendingWrite.then(() => undefined, () => undefined);
  await pendingWrite;
}

async function readBackupMetadata(): Promise<StoredBackupMetadata> {
  try {
    const parsed: unknown = JSON.parse(await readFile(BACKUP_METADATA_PATH, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('DATABASE_BACKUP_METADATA_INVALID');
    }
    return parsed as StoredBackupMetadata;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return {};
    if (error instanceof SyntaxError) throw new Error('DATABASE_BACKUP_METADATA_INVALID');
    throw error;
  }
}

async function updateBackupMetadata(
  filename: string,
  metadata: StoredBackupMetadata[string] | null
): Promise<void> {
  const pendingWrite = syncStateWriteQueue.then(async () => {
    const current = await readBackupMetadata();
    if (metadata) current[filename] = metadata;
    else delete current[filename];
    const temporaryPath = `${BACKUP_METADATA_PATH}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, `${JSON.stringify(current, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
      await rename(temporaryPath, BACKUP_METADATA_PATH);
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
  });
  syncStateWriteQueue = pendingWrite.then(() => undefined, () => undefined);
  await pendingWrite;
}

async function calculateSha256(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

async function validateBackupArchive(filePath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    execFile(
      'pg_restore',
      ['--list', filePath],
      { timeout: 2 * 60 * 1000, maxBuffer: 16 * 1024 * 1024 },
      error => error
        ? reject(new Error('DATABASE_BACKUP_ARCHIVE_INVALID'))
        : resolve()
    );
  });
}

async function acquireBackupLock(): Promise<() => Promise<void>> {
  await ensureBackupDir();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let lock: Awaited<ReturnType<typeof open>> | undefined;
    try {
      lock = await open(BACKUP_LOCK_PATH, 'wx', 0o600);
      await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
      return async () => {
        await lock?.close();
        await unlink(BACKUP_LOCK_PATH).catch(error => {
          if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
        });
      };
    } catch (error) {
      if (lock) {
        await lock.close().catch(() => undefined);
        await unlink(BACKUP_LOCK_PATH).catch(() => undefined);
      }
      if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
      try {
        const lockStat = await stat(BACKUP_LOCK_PATH);
        if (Date.now() - lockStat.mtimeMs <= BACKUP_LOCK_MAX_AGE_MS) {
          throw new Error('DATABASE_BACKUP_IN_PROGRESS');
        }
        await unlink(BACKUP_LOCK_PATH);
      } catch (lockError) {
        if (lockError instanceof Error && lockError.message === 'DATABASE_BACKUP_IN_PROGRESS') throw lockError;
        if (lockError instanceof Error && 'code' in lockError && lockError.code === 'ENOENT') continue;
        throw lockError;
      }
    }
  }
  throw new Error('DATABASE_BACKUP_IN_PROGRESS');
}

function parseDriveServiceAccount(serviceAccountJson: string): { client_email: string; private_key: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serviceAccountJson);
  } catch {
    throw new Error('DATABASE_BACKUP_GOOGLE_DRIVE_CREDENTIALS_INVALID');
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    typeof (parsed as { client_email?: unknown }).client_email !== 'string' ||
    typeof (parsed as { private_key?: unknown }).private_key !== 'string' ||
    !(parsed as { client_email: string }).client_email.includes('@') ||
    !(parsed as { private_key: string }).private_key.includes('PRIVATE KEY')
  ) {
    throw new Error('DATABASE_BACKUP_GOOGLE_DRIVE_CREDENTIALS_INVALID');
  }
  return parsed as { client_email: string; private_key: string };
}

export function validateGoogleDriveServiceAccountJson(serviceAccountJson: string): void {
  parseDriveServiceAccount(serviceAccountJson);
}

export async function testGoogleDriveConnection(serviceAccountJson: string, folderId?: string): Promise<void> {
  const credentials = parseDriveServiceAccount(serviceAccountJson);
  const auth = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/drive']
  });
  const { token } = await auth.getAccessToken();
  if (!token) throw new Error('DATABASE_BACKUP_GOOGLE_DRIVE_AUTH_FAILED');
  if (!folderId) return;

  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,mimeType&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error(`DATABASE_BACKUP_GOOGLE_DRIVE_HTTP_${response.status}`);
  const folder = await response.json() as { mimeType?: unknown };
  if (folder.mimeType !== 'application/vnd.google-apps.folder') {
    throw new Error('DATABASE_BACKUP_GOOGLE_DRIVE_FOLDER_INVALID');
  }

}

export async function testS3BackupConnection(client: S3Client, bucket: string, prefix: string): Promise<void> {
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
  const normalizedPrefix = prefix.split('/').filter(part => part && part !== '.' && part !== '..').join('/');
  const key = [normalizedPrefix, '.ruda-backup-connection-check'].filter(Boolean).join('/');
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: 'RUDA database backup upload test',
    ContentType: 'text/plain',
    Metadata: { purpose: 'database-backup-connection-test' }
  }));
  const result = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  if (result.Metadata?.purpose !== 'database-backup-connection-test') {
    throw new Error('DATABASE_BACKUP_S3_TEST_UPLOAD_VERIFY_FAILED');
  }
}

function parseDatabaseUrl(): { user: string; password: string; host: string; port: string; database: string } {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL_NOT_CONFIGURED');
  const url = new URL(raw);
  return {
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    host: url.hostname,
    port: url.port || '5432',
    database: url.pathname.replace(/^\//, '')
  };
}

async function ensureBackupDir(): Promise<void> {
  await mkdir(BACKUP_DIR, { recursive: true, mode: 0o700 });
  const directory = await lstat(BACKUP_DIR);
  if (!directory.isDirectory() || directory.isSymbolicLink()) {
    throw new Error('DATABASE_BACKUP_DIRECTORY_INVALID');
  }
  await chmod(BACKUP_DIR, 0o700);
  for (const metadataPath of [BACKUP_SYNC_STATE_PATH, BACKUP_METADATA_PATH, AUTOMATIC_BACKUP_STATE_PATH]) {
    try {
      const metadata = await lstat(metadataPath);
      if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error('DATABASE_BACKUP_METADATA_INVALID');
      await chmod(metadataPath, 0o600);
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
  }
}

export async function getMigrationStatus(prisma: PrismaClient): Promise<DatabaseMigrationStatus> {
  const migrationsRoot = path.join(process.cwd(), 'prisma', 'migrations');
  let migrationFolders: string[] = [];
  try {
    const entries = await readdir(migrationsRoot, { withFileTypes: true });
    migrationFolders = entries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  } catch {
    migrationFolders = [];
  }

  let appliedRows: { migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }[] = [];
  try {
    appliedRows = await prisma.$queryRawUnsafe<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }[]>(
      'SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"'
    );
  } catch {
    appliedRows = [];
  }

  const appliedNames = new Set(appliedRows.filter(row => row.finished_at && !row.rolled_back_at).map(row => row.migration_name));
  const failedNames = appliedRows.filter(row => !row.finished_at || row.rolled_back_at).map(row => row.migration_name);

  return {
    applied: migrationFolders.filter(name => appliedNames.has(name)),
    pending: migrationFolders.filter(name => !appliedNames.has(name) && !failedNames.includes(name)),
    failed: failedNames
  };
}

export async function getDatabaseOverview(prisma: PrismaClient): Promise<DatabaseOverview> {
  const startedAt = Date.now();
  await prisma.$queryRawUnsafe('SELECT 1');
  const latencyMs = Date.now() - startedAt;

  await ensureBackupDir();
  const [sizeRows, identityRows, tableRows, tableCountRows, connectionRows, maxConnRows, backupFs, migrations] = await Promise.all([
    prisma.$queryRawUnsafe<{ size: bigint }[]>('SELECT pg_database_size(current_database()) AS size'),
    prisma.$queryRawUnsafe<{ database_name: string; server_version: string }[]>(`
      SELECT current_database() AS database_name, current_setting('server_version') AS server_version
    `),
    prisma.$queryRawUnsafe<{ table_name: string; row_estimate: number; size_bytes: bigint }[]>(`
      SELECT
        relname AS table_name,
        GREATEST(reltuples, 0)::bigint AS row_estimate,
        pg_total_relation_size(c.oid) AS size_bytes
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'r' AND n.nspname = 'public'
      ORDER BY size_bytes DESC
      LIMIT 12
    `),
    prisma.$queryRawUnsafe<{ count: bigint }[]>(`
      SELECT count(*) AS count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'r' AND n.nspname = 'public'
    `),
    prisma.$queryRawUnsafe<{ count: bigint }[]>(
      "SELECT count(*) AS count FROM pg_stat_activity WHERE datname = current_database()"
    ),
    prisma.$queryRawUnsafe<{ setting: string }[]>("SELECT setting FROM pg_settings WHERE name = 'max_connections'"),
    statfs(BACKUP_DIR),
    getMigrationStatus(prisma)
  ]);

  let slowQueriesAvailable = false;
  let slowQueries: { query: string; calls: number; meanMs: number }[] = [];
  try {
    const rows = await prisma.$queryRawUnsafe<{ query: string; calls: bigint; mean_exec_time: number }[]>(`
      SELECT query, calls, mean_exec_time
      FROM pg_stat_statements
      WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
      ORDER BY mean_exec_time DESC
      LIMIT 8
    `);
    slowQueriesAvailable = true;
    slowQueries = rows.map(row => ({
      query: row.query.length > 200 ? `${row.query.slice(0, 200)}…` : row.query,
      calls: Number(row.calls),
      meanMs: Math.round(row.mean_exec_time)
    }));
  } catch {
    slowQueriesAvailable = false;
    slowQueries = [];
  }

  const tableRowsSafe = Array.isArray(tableRows) ? tableRows : [];
  return {
    status: 'connected',
    latencyMs,
    databaseName: identityRows[0]?.database_name || 'unknown',
    serverVersion: identityRows[0]?.server_version || 'unknown',
    sizeBytes: Number(sizeRows[0]?.size ?? 0),
    tableCount: Number(tableCountRows[0]?.count ?? 0),
    topTables: tableRowsSafe.map(row => ({
      name: row.table_name,
      rowEstimate: Number(row.row_estimate),
      sizeBytes: Number(row.size_bytes)
    })),
    activeConnections: Number(connectionRows[0]?.count ?? 0),
    maxConnections: Number(maxConnRows[0]?.setting ?? 0),
    backupDiskTotalBytes: backupFs.blocks * backupFs.bsize,
    backupDiskAvailableBytes: backupFs.bavail * backupFs.bsize,
    slowQueriesAvailable,
    slowQueries,
    migrations,
    checkedAt: new Date().toISOString()
  };
}

export async function createDatabaseBackup(retentionCount = DEFAULT_BACKUP_RETENTION_COUNT): Promise<DatabaseBackupInfo> {
  if (!Number.isInteger(retentionCount) || retentionCount < 1 || retentionCount > MAX_BACKUP_RETENTION_COUNT) {
    throw new Error('DATABASE_BACKUP_RETENTION_INVALID');
  }
  if (activeBackupCreation) throw new Error('DATABASE_BACKUP_IN_PROGRESS');
  activeBackupCreation = true;
  let releaseLock: (() => Promise<void>) | undefined;
  try {
    releaseLock = await acquireBackupLock();
    const conn = parseDatabaseUrl();
    const now = new Date();
    const stamp = now.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    const filename = `ruda-db-${stamp}-${randomUUID().slice(0, 8)}.dump`;
    const filePath = path.join(BACKUP_DIR, filename);
    const temporaryFilePath = path.join(BACKUP_DIR, `.${filename}.${randomUUID()}.tmp`);

    try {
      await new Promise<void>((resolve, reject) => {
        execFile(
          'pg_dump',
          ['-h', conn.host, '-p', conn.port, '-U', conn.user, '-d', conn.database, '-Fc', '-f', temporaryFilePath],
          { env: { ...process.env, PGPASSWORD: conn.password }, timeout: 5 * 60 * 1000 },
          (error, _stdout, stderr) => {
            if (error) reject(new Error(`DATABASE_BACKUP_FAILED: ${stderr || error.message}`));
            else resolve();
          }
        );
      });
      const dumpEntry = await lstat(temporaryFilePath);
      if (!dumpEntry.isFile() || dumpEntry.isSymbolicLink()) throw new Error('DATABASE_BACKUP_FILE_INVALID');
      await chmod(temporaryFilePath, 0o600);
      const info = await stat(temporaryFilePath);
      if (info.size === 0) throw new Error('DATABASE_BACKUP_EMPTY');
      await validateBackupArchive(temporaryFilePath);
      const checksumSha256 = await calculateSha256(temporaryFilePath);
      await rename(temporaryFilePath, filePath);
      const verifiedAt = new Date().toISOString();
      const backup: DatabaseBackupInfo = {
        filename,
        sizeBytes: info.size,
        createdAt: now.toISOString(),
        checksumSha256,
        verifiedAt,
        verificationStatus: 'verified'
      };
      try {
        await updateBackupMetadata(filename, { checksumSha256, verifiedAt, verificationStatus: 'verified' });
      } catch (error) {
        console.error('[database-backup-metadata-save]', error instanceof Error ? error.message : error);
      }
      try {
        await pruneOldBackups(retentionCount);
      } catch (error) {
        console.error('[database-backup-retention-prune]', error instanceof Error ? error.message : error);
      }
      return backup;
    } catch (error) {
      await unlink(temporaryFilePath).catch(() => undefined);
      throw error;
    }
  } finally {
    activeBackupCreation = false;
    await releaseLock?.().catch(error => {
      console.error('[database-backup-lock-release]', error instanceof Error ? error.message : error);
    });
  }
}

async function uploadBackupToGoogleDrive(
  filePath: string,
  filename: string,
  sizeBytes: number,
  checksumSha256: string,
  serviceAccountJson: string,
  folderId?: string
): Promise<string> {
  const credentials = parseDriveServiceAccount(serviceAccountJson);
  const auth = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/drive']
  });
  const { token } = await auth.getAccessToken();
  if (!token) throw new Error('DATABASE_BACKUP_GOOGLE_DRIVE_AUTH_FAILED');
  const authorization = ['Bearer', token].join(' ');

  const metadata: { name: string; parents?: string[]; description: string; appProperties: Record<string, string> } = {
    name: filename,
    description: `RUDA PostgreSQL custom-format backup. SHA-256: ${checksumSha256}`,
    appProperties: { rudaBackupSha256: checksumSha256 }
  };
  if (folderId) metadata.parents = [folderId];
  const parentQuery = folderId ? `'${folderId}' in parents` : "'root' in parents";
  const existingQuery = `name='${filename}' and ${parentQuery} and trashed=false`;
  const existingResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(existingQuery)}&fields=files(id,size,appProperties)&supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=10`,
    { headers: { Authorization: authorization }, signal: AbortSignal.timeout(30_000) }
  );
  if (!existingResponse.ok) throw new Error(`DATABASE_BACKUP_GOOGLE_DRIVE_HTTP_${existingResponse.status}`);
  const existingFiles = await existingResponse.json() as {
    files?: Array<{ id?: unknown; size?: unknown; appProperties?: Record<string, string> }>;
  };
  if (existingFiles.files?.length) {
    const matchingFile = existingFiles.files.find(file =>
      file.appProperties?.rudaBackupSha256 === checksumSha256 && Number(file.size) === sizeBytes
    );
    if (matchingFile && typeof matchingFile.id === 'string') return matchingFile.id;
    throw new Error('DATABASE_BACKUP_GOOGLE_DRIVE_OBJECT_MISMATCH');
  }
  const initResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,size', {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'application/octet-stream',
      'X-Upload-Content-Length': String(sizeBytes)
    },
    body: JSON.stringify(metadata),
    signal: AbortSignal.timeout(30_000)
  });
  if (!initResponse.ok) throw new Error(`DATABASE_BACKUP_GOOGLE_DRIVE_HTTP_${initResponse.status}`);
  const uploadUrl = initResponse.headers.get('location');
  if (!uploadUrl) throw new Error('DATABASE_BACKUP_GOOGLE_DRIVE_UPLOAD_SESSION_MISSING');
  const parsedUploadUrl = new URL(uploadUrl);
  if (parsedUploadUrl.protocol !== 'https:' || parsedUploadUrl.hostname !== 'www.googleapis.com') {
    throw new Error('DATABASE_BACKUP_GOOGLE_DRIVE_UPLOAD_SESSION_INVALID');
  }

  return new Promise<string>((resolve, reject) => {
    const request = httpsRequest(parsedUploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(sizeBytes)
      }
    }, response => {
      const chunks: Buffer[] = [];
      let receivedBytes = 0;
      response.on('data', (chunk: Buffer | string) => {
        if (receivedBytes >= 16_384) return;
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        chunks.push(buffer.subarray(0, 16_384 - receivedBytes));
        receivedBytes += buffer.length;
      });
      response.on('end', () => {
        if (response.statusCode !== 200 && response.statusCode !== 201) {
          reject(new Error(`DATABASE_BACKUP_GOOGLE_DRIVE_HTTP_${response.statusCode || 0}`));
          return;
        }
        try {
          const result = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { id?: unknown; size?: unknown };
          if (typeof result.id !== 'string' || Number(result.size) !== sizeBytes) {
            reject(new Error('DATABASE_BACKUP_GOOGLE_DRIVE_UPLOAD_VERIFY_FAILED'));
            return;
          }
          resolve(result.id);
        } catch {
          reject(new Error('DATABASE_BACKUP_GOOGLE_DRIVE_UPLOAD_RESPONSE_INVALID'));
        }
      });
    });
    request.setTimeout(15 * 60 * 1000, () => request.destroy(new Error('DATABASE_BACKUP_GOOGLE_DRIVE_UPLOAD_TIMEOUT')));
    request.on('error', error => reject(error));
    const fileStream = createReadStream(filePath);
    fileStream.on('error', error => request.destroy(error));
    fileStream.pipe(request);
  });
}

export async function syncDatabaseBackup(filename: string, targets: BackupSyncTargets): Promise<DatabaseBackupSyncStatus> {
  if (activeBackupSyncs.has(filename)) throw new Error('DATABASE_BACKUP_SYNC_IN_PROGRESS');
  activeBackupSyncs.add(filename);
  try {
    return await syncDatabaseBackupInternal(filename, targets);
  } finally {
    activeBackupSyncs.delete(filename);
  }
}

async function syncDatabaseBackupInternal(filename: string, targets: BackupSyncTargets): Promise<DatabaseBackupSyncStatus> {
  const filePath = getBackupFilePath(filename);
  const info = await stat(filePath);
  const metadata = await readBackupMetadata();
  const checksumSha256 = metadata[filename]?.checksumSha256 || await calculateSha256(filePath);
  const status: DatabaseBackupSyncStatus = {
    s3: targets.s3.enabled ? { status: 'pending' } : { status: 'disabled' },
    googleDrive: targets.googleDrive.enabled ? { status: 'pending' } : { status: 'disabled' }
  };
  await saveBackupSyncState(filename, status);

  const syncS3 = async (): Promise<void> => {
    if (!targets.s3.enabled) return;
    if (!targets.s3.client || !targets.s3.bucket) {
      status.s3 = { status: 'failed', error: 'DATABASE_BACKUP_S3_NOT_CONFIGURED' };
      await saveBackupSyncState(filename, status);
      return;
    }
    try {
      const prefix = targets.s3.prefix.split('/').filter(part => part && part !== '.' && part !== '..').join('/');
      const key = [prefix, filename].filter(Boolean).join('/');
      try {
        const existing = await targets.s3.client.send(new HeadObjectCommand({ Bucket: targets.s3.bucket, Key: key }));
        if (existing.ContentLength !== info.size || existing.Metadata?.sha256 !== checksumSha256) {
          throw new Error('DATABASE_BACKUP_S3_OBJECT_MISMATCH');
        }
        status.s3 = { status: 'synced', remoteId: key, syncedAt: new Date().toISOString() };
        await saveBackupSyncState(filename, status);
        return;
      } catch (error) {
        const responseStatus = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
        const errorName = (error as { name?: string }).name;
        if (errorName !== 'NotFound' && errorName !== 'NoSuchKey' && responseStatus !== 404) throw error;
      }
      await targets.s3.client.send(new PutObjectCommand({
        Bucket: targets.s3.bucket,
        Key: key,
        Body: createReadStream(filePath),
        ContentLength: info.size,
        ContentType: 'application/octet-stream',
        Metadata: { 'backup-filename': filename, 'sha256': checksumSha256 }
      }));
      const remoteObject = await targets.s3.client.send(new HeadObjectCommand({ Bucket: targets.s3.bucket, Key: key }));
      if (
        remoteObject.ContentLength !== info.size ||
        remoteObject.Metadata?.sha256 !== checksumSha256
      ) {
        throw new Error('DATABASE_BACKUP_S3_UPLOAD_VERIFY_FAILED');
      }
      status.s3 = { status: 'synced', remoteId: key, syncedAt: new Date().toISOString() };
    } catch (error) {
      status.s3 = {
        status: 'failed',
        error: error instanceof Error && error.message === 'DATABASE_BACKUP_S3_OBJECT_MISMATCH'
          ? error.message
          : 'DATABASE_BACKUP_S3_UPLOAD_FAILED'
      };
    }
    await saveBackupSyncState(filename, status);
  };

  const syncGoogleDrive = async (): Promise<void> => {
    if (!targets.googleDrive.enabled) return;
    if (!targets.googleDrive.serviceAccountJson) {
      status.googleDrive = { status: 'failed', error: 'DATABASE_BACKUP_GOOGLE_DRIVE_NOT_CONFIGURED' };
      await saveBackupSyncState(filename, status);
      return;
    }
    try {
      const remoteId = await uploadBackupToGoogleDrive(
        filePath,
        filename,
        info.size,
        checksumSha256,
        targets.googleDrive.serviceAccountJson,
        targets.googleDrive.folderId
      );
      status.googleDrive = { status: 'synced', remoteId, syncedAt: new Date().toISOString() };
    } catch (error) {
      status.googleDrive = {
        status: 'failed',
        error: error instanceof Error && /^DATABASE_BACKUP_GOOGLE_DRIVE_[A-Z0-9_]+$/.test(error.message)
          ? error.message
          : 'DATABASE_BACKUP_GOOGLE_DRIVE_UPLOAD_FAILED'
      };
    }
    await saveBackupSyncState(filename, status);
  };

  await Promise.all([syncS3(), syncGoogleDrive()]);
  return status;
}

async function pruneOldBackups(retentionCount: number): Promise<void> {
  const backups = await listDatabaseBackups();
  const stale = backups.slice(retentionCount);
  for (const backup of stale) {
    await unlink(path.join(BACKUP_DIR, backup.filename));
    await removeBackupSyncState(backup.filename);
    await updateBackupMetadata(backup.filename, null);
  }
}

export async function listDatabaseBackups(): Promise<DatabaseBackupInfo[]> {
  await ensureBackupDir();
  const [entries, syncState, metadata] = await Promise.all([
    readdir(BACKUP_DIR),
    readBackupSyncState(),
    readBackupMetadata()
  ]);
  const backups = await Promise.all(
    entries
      .filter(name => BACKUP_FILENAME_PATTERN.test(name))
      .map(async name => {
        const filePath = path.join(BACKUP_DIR, name);
        const entry = await lstat(filePath);
        if (!entry.isFile() || entry.isSymbolicLink()) throw new Error('DATABASE_BACKUP_FILE_INVALID');
        await chmod(filePath, 0o600);
        const info = await stat(filePath);
        return {
          filename: name,
          sizeBytes: info.size,
          createdAt: info.mtime.toISOString(),
          sync: syncState[name] || emptySyncStatus(),
          checksumSha256: metadata[name]?.checksumSha256,
          verifiedAt: metadata[name]?.verifiedAt,
          verificationStatus: metadata[name]?.verificationStatus || 'unverified'
        };
      })
  );
  return backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function verifyDatabaseBackup(filename: string): Promise<{
  filename: string;
  sizeBytes: number;
  checksumSha256: string;
  verifiedAt: string;
}> {
  const filePath = getBackupFilePath(filename);
  try {
    const info = await stat(filePath);
    if (info.size === 0) throw new Error('DATABASE_BACKUP_EMPTY');
    await validateBackupArchive(filePath);
    const checksumSha256 = await calculateSha256(filePath);
    const verifiedAt = new Date().toISOString();
    await updateBackupMetadata(filename, { checksumSha256, verifiedAt, verificationStatus: 'verified' });
    return { filename, sizeBytes: info.size, checksumSha256, verifiedAt };
  } catch (error) {
    try {
      await updateBackupMetadata(filename, { verifiedAt: new Date().toISOString(), verificationStatus: 'failed' });
    } catch (metadataError) {
      console.error('[database-backup-verification-state]', metadataError instanceof Error ? metadataError.message : metadataError);
    }
    throw error;
  }
}

export function isValidBackupFilename(filename: string): boolean {
  return BACKUP_FILENAME_PATTERN.test(filename);
}

export function getBackupFilePath(filename: string): string {
  if (!isValidBackupFilename(filename)) throw new Error('DATABASE_BACKUP_FILENAME_INVALID');
  const resolved = path.join(BACKUP_DIR, filename);
  if (path.dirname(resolved) !== BACKUP_DIR) throw new Error('DATABASE_BACKUP_FILENAME_INVALID');
  return resolved;
}

export async function deleteDatabaseBackup(filename: string): Promise<void> {
  const filePath = getBackupFilePath(filename);
  await unlink(filePath);
  await removeBackupSyncState(filename);
}

let scheduled = false;
let automaticBackupCheckRunning = false;
let lastAutomaticBackupDate = '';

export function scheduleAutomaticDatabaseBackups(
  onResult: (result: { success: boolean; error?: string; backup?: DatabaseBackupInfo; sync?: DatabaseBackupSyncStatus }) => void,
  getTargets: () => BackupSyncTargets,
  getSchedule: () => DatabaseBackupSchedule
): void {
  if (scheduled) return;
  scheduled = true;
  const checkAndRun = async () => {
    if (automaticBackupCheckRunning) return;
    automaticBackupCheckRunning = true;
    try {
      const schedule = getSchedule();
      if (!validateDatabaseBackupSchedule(schedule)) {
        onResult({ success: false, error: 'DATABASE_BACKUP_POLICY_INVALID' });
        return;
      }
      const localTime = getBackupScheduleDate(new Date(), schedule.timezone);
      let lastRunDate = '';
      try {
        const saved = JSON.parse(await readFile(AUTOMATIC_BACKUP_STATE_PATH, 'utf8')) as { lastRunDate?: unknown };
        if (typeof saved.lastRunDate === 'string') lastRunDate = saved.lastRunDate;
      } catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
      }
      if (!isDatabaseBackupScheduleDue(new Date(), schedule, lastRunDate || lastAutomaticBackupDate)) return;

      let backup: DatabaseBackupInfo;
      try {
        backup = await createDatabaseBackup(schedule.retentionCount);
      } catch (error) {
        onResult({ success: false, error: error instanceof Error ? error.message : 'DATABASE_BACKUP_FAILED' });
        return;
      }

      lastAutomaticBackupDate = localTime.date;
      const temporaryStatePath = `${AUTOMATIC_BACKUP_STATE_PATH}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporaryStatePath, `${JSON.stringify({ lastRunDate: localTime.date })}\n`, { encoding: 'utf8', mode: 0o600 });
        await rename(temporaryStatePath, AUTOMATIC_BACKUP_STATE_PATH);
      } catch (error) {
        await unlink(temporaryStatePath).catch(() => undefined);
        onResult({
          success: true,
          backup,
          error: error instanceof Error ? error.message : 'DATABASE_BACKUP_SCHEDULE_STATE_FAILED'
        });
        return;
      }

      try {
        const sync = await syncDatabaseBackup(backup.filename, getTargets());
        onResult({ success: true, backup: { ...backup, sync }, sync });
      } catch (error) {
        onResult({
          success: true,
          backup,
          error: error instanceof Error ? error.message : 'DATABASE_BACKUP_SYNC_FAILED'
        });
      }
    } catch (error) {
      onResult({ success: false, error: error instanceof Error ? error.message : 'DATABASE_BACKUP_SCHEDULER_FAILED' });
    } finally {
      automaticBackupCheckRunning = false;
    }
  };
  void checkAndRun();
  setInterval(() => void checkAndRun(), 60 * 1000);
}

import { JWT } from 'google-auth-library';
import { randomUUID } from 'node:crypto';
import { chmod, lstat, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getGoogleCloudDatabaseEngine, GOOGLE_CLOUD_RECOVERY_COST_WARNING } from '../shared/googleCloudRecovery';
export { getGoogleCloudDatabaseEngine } from '../shared/googleCloudRecovery';

const GOOGLE_CLOUD_READONLY_SCOPE = 'https://www.googleapis.com/auth/cloud-platform.read-only';
const GOOGLE_CLOUD_RECOVERY_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const GOOGLE_API_TIMEOUT_MS = 30_000;
const RECOVERY_OPERATION_TIMEOUT_MS = 30 * 60_000;
const RECOVERY_OPERATION_POLL_MS = 5_000;
const GOOGLE_CLOUD_PROJECT_ID_PATTERN = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
const CLOUD_SQL_INSTANCE_ID_PATTERN = /^[a-z](?:[a-z0-9-]{0,96}[a-z0-9])?$/;
const CLOUD_SQL_BACKUP_RUN_ID_PATTERN = /^[0-9]{1,20}$/;

type GoogleCloudServiceAccount = {
  client_email: string;
  private_key: string;
};

type CloudSqlBackupConfiguration = {
  enabled?: boolean;
  pointInTimeRecoveryEnabled?: boolean;
  startTime?: string;
  backupRetentionSettings?: {
    retainedBackups?: number;
    transactionLogRetentionDays?: number;
  };
};

type CloudSqlInstance = {
  name: string;
  region?: string;
  databaseVersion?: string;
  state?: string;
  connectionName?: string;
  settings?: {
    availabilityType?: string;
    edition?: string;
    tier?: string;
    dataDiskType?: string;
    dataDiskSizeGb?: string;
    backupConfiguration?: CloudSqlBackupConfiguration;
    ipConfiguration?: { ipv4Enabled?: boolean };
    userLabels?: Record<string, string>;
  };
  userLabels?: Record<string, string>;
};

type CloudSqlDatabase = { name?: string };
type CloudSqlOperation = {
  name?: string;
  status?: string;
  error?: { errors?: Array<{ code?: string; message?: string }> };
};

export type GoogleCloudRecoveryApi = {
  listBackupRuns: (projectId: string, instanceId: string) => Promise<CloudSqlBackupRun[]>;
  getInstance: (projectId: string, instanceId: string) => Promise<CloudSqlInstance>;
  listDatabases: (projectId: string, instanceId: string) => Promise<CloudSqlDatabase[]>;
  createInstance: (projectId: string, instance: Record<string, unknown>) => Promise<CloudSqlOperation>;
  restoreBackup: (projectId: string, targetInstanceId: string, sourceInstanceId: string, backupRunId: string) => Promise<CloudSqlOperation>;
  getOperation: (projectId: string, operationName: string) => Promise<CloudSqlOperation>;
  deleteInstance: (projectId: string, instanceId: string) => Promise<CloudSqlOperation>;
};

export type GoogleCloudRecoveryApiFactory = (
  projectId: string,
  recoveryServiceAccountJson: string
) => Promise<GoogleCloudRecoveryApi>;

type CloudSqlBackupRun = {
  id?: string;
  status?: string;
  startTime?: string;
  type?: string;
};

export type GoogleCloudRecoveryDrillStatus =
  | 'CREATING'
  | 'RESTORING'
  | 'VERIFYING'
  | 'CLEANUP_PENDING'
  | 'SUCCEEDED'
  | 'FAILED';

export type GoogleCloudRecoveryDrill = {
  id: string;
  projectId: string;
  sourceInstanceId: string;
  backupRunId: string;
  targetInstanceId: string;
  databaseVersion?: string;
  ownershipLabels: Record<string, string>;
  status: GoogleCloudRecoveryDrillStatus;
  creationResolved: boolean;
  createOperationName?: string;
  recoveryVerified: boolean;
  cleanupComplete: boolean;
  createdAt: string;
  updatedAt: string;
  error?: string;
};

export type GoogleCloudSuccessfulBackup = {
  id: string;
  status: 'SUCCESSFUL';
  startTime?: string;
  type?: string;
};

export type GoogleCloudBackupInventory = {
  databaseEngine: 'MySQL' | 'PostgreSQL';
  databaseVersion: string;
  backups: GoogleCloudSuccessfulBackup[];
};

export function isValidGoogleCloudSqlInstanceId(instanceId: string): boolean {
  return CLOUD_SQL_INSTANCE_ID_PATTERN.test(instanceId);
}

export function isGoogleCloudSqlMySqlVersion(databaseVersion: string): boolean {
  return /^MYSQL_[0-9]+_[0-9]+$/.test(databaseVersion);
}

export function isValidGoogleCloudSqlBackupRunId(backupRunId: string): boolean {
  return CLOUD_SQL_BACKUP_RUN_ID_PATTERN.test(backupRunId);
}

export function generateGoogleCloudRecoveryTargetId(randomId: string = randomUUID()): string {
  const suffix = randomId.replace(/[^a-f0-9]/gi, '').toLowerCase().slice(0, 32);
  if (suffix.length < 16) throw new Error('DATABASE_GOOGLE_CLOUD_RECOVERY_RANDOM_ID_INVALID');
  return `ruda-drill-${suffix}`;
}

export function transitionGoogleCloudRecoveryDrill(
  drill: GoogleCloudRecoveryDrill,
  status: GoogleCloudRecoveryDrillStatus,
  patch: Partial<Pick<GoogleCloudRecoveryDrill, 'recoveryVerified' | 'cleanupComplete' | 'error'>> = {}
): GoogleCloudRecoveryDrill {
  const allowed: Record<GoogleCloudRecoveryDrillStatus, GoogleCloudRecoveryDrillStatus[]> = {
    CREATING: ['RESTORING', 'CLEANUP_PENDING', 'FAILED'],
    RESTORING: ['VERIFYING', 'CLEANUP_PENDING', 'FAILED'],
    VERIFYING: ['SUCCEEDED', 'CLEANUP_PENDING', 'FAILED'],
    CLEANUP_PENDING: ['SUCCEEDED', 'FAILED'],
    SUCCEEDED: [],
    FAILED: ['CLEANUP_PENDING']
  };
  if (status !== drill.status && !allowed[drill.status].includes(status)) {
    throw new Error('DATABASE_GOOGLE_CLOUD_RECOVERY_INVALID_STATE_TRANSITION');
  }
  if (status === 'SUCCEEDED' && (patch.recoveryVerified ?? drill.recoveryVerified) !== true) {
    throw new Error('DATABASE_GOOGLE_CLOUD_RECOVERY_VERIFICATION_REQUIRED');
  }
  return {
    ...drill,
    ...patch,
    status,
    updatedAt: new Date().toISOString()
  };
}

export type GoogleCloudDatabaseOverview = {
  projectId: string;
  checkedAt: string;
  cloudSql: {
    available: boolean;
    error?: string;
    instances: Array<{
      name: string;
      region: string;
      databaseVersion: string;
      state: string;
      connectionName: string;
      availabilityType: string;
      automatedBackupsEnabled: boolean;
      pointInTimeRecoveryEnabled: boolean;
      retainedBackups?: number;
      transactionLogRetentionDays?: number;
      backupStartTime?: string;
      latestBackup?: {
        id?: string;
        status?: string;
        startTime?: string;
        type?: string;
      };
      backupError?: string;
    }>;
  };
  cloudStorage: {
    available: boolean;
    error?: string;
    buckets: Array<{
      name: string;
      location: string;
      storageClass: string;
      versioningEnabled: boolean;
      retentionPeriodSeconds?: number;
      uniformBucketLevelAccess: boolean;
    }>;
  };
};

export function isValidGoogleCloudProjectId(projectId: string): boolean {
  return GOOGLE_CLOUD_PROJECT_ID_PATTERN.test(projectId);
}

export function parseGoogleCloudServiceAccountJson(raw: string): GoogleCloudServiceAccount {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('DATABASE_GOOGLE_CLOUD_CREDENTIALS_INVALID');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('DATABASE_GOOGLE_CLOUD_CREDENTIALS_INVALID');
  }
  const account = parsed as Record<string, unknown>;
  if (
    typeof account.client_email !== 'string' ||
    !/^[^@\s]+@[^@\s]+\.iam\.gserviceaccount\.com$/.test(account.client_email) ||
    typeof account.private_key !== 'string' ||
    !account.private_key.includes('PRIVATE KEY')
  ) {
    throw new Error('DATABASE_GOOGLE_CLOUD_CREDENTIALS_INVALID');
  }
  return {
    client_email: account.client_email,
    private_key: account.private_key.replace(/\\n/g, '\n')
  };
}

async function getGoogleCloudAccessToken(
  serviceAccountJson: string,
  scope = GOOGLE_CLOUD_READONLY_SCOPE
): Promise<string> {
  const account = parseGoogleCloudServiceAccountJson(serviceAccountJson);
  try {
    const client = new JWT({
      email: account.client_email,
      key: account.private_key,
      scopes: [scope]
    });
    const { token } = await client.getAccessToken();
    if (!token) throw new Error('DATABASE_GOOGLE_CLOUD_AUTH_FAILED');
    return token;
  } catch {
    throw new Error('DATABASE_GOOGLE_CLOUD_AUTH_FAILED');
  }
}

async function getGoogleApiJson<T>(url: URL, token: string, errorCode: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(GOOGLE_API_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`${errorCode}_${response.status}`);
  return await response.json() as T;
}

async function callGoogleApi<T>(
  url: URL,
  token: string,
  errorCode: string,
  method: 'GET' | 'POST' | 'DELETE' = 'GET',
  body?: unknown
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(GOOGLE_API_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`${errorCode}_${response.status}`);
  return await response.json() as T;
}

function providerErrorCode(error: unknown, prefix: string): string {
  if (error instanceof Error && error.message.startsWith(`${prefix}_`) && /^[A-Z0-9_]+$/.test(error.message)) return error.message;
  return `${prefix}_FAILED`;
}

async function fetchCloudSqlInstances(projectId: string, token: string): Promise<GoogleCloudDatabaseOverview['cloudSql']['instances']> {
  const url = new URL(`https://sqladmin.googleapis.com/sql/v1beta4/projects/${encodeURIComponent(projectId)}/instances`);
  url.searchParams.set('maxResults', '100');
  const instances: CloudSqlInstance[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 20; page += 1) {
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    else url.searchParams.delete('pageToken');
    const response = await getGoogleApiJson<{ items?: CloudSqlInstance[]; nextPageToken?: string }>(url, token, 'GOOGLE_CLOUD_SQL_API');
    instances.push(...(response.items || []));
    pageToken = response.nextPageToken;
    if (!pageToken) break;
  }
  if (pageToken) throw new Error('GOOGLE_CLOUD_SQL_API_RESULT_LIMIT_EXCEEDED');
  const backupRuns = new Map<string, CloudSqlBackupRun | undefined>();
  const backupErrors = new Map<string, string>();
  let nextIndex = 0;

  const workers = Array.from({ length: Math.min(4, instances.length) }, async () => {
    while (nextIndex < instances.length) {
      const index = nextIndex++;
      const instance = instances[index];
      const backupUrl = new URL(
        `https://sqladmin.googleapis.com/sql/v1beta4/projects/${encodeURIComponent(projectId)}/instances/${encodeURIComponent(instance.name)}/backupRuns`
      );
      backupUrl.searchParams.set('maxResults', '1');
      try {
        const result = await getGoogleApiJson<{ items?: CloudSqlBackupRun[] }>(backupUrl, token, 'GOOGLE_CLOUD_SQL_BACKUPS_API');
        backupRuns.set(instance.name, result.items?.[0]);
      } catch (error) {
        backupErrors.set(instance.name, providerErrorCode(error, 'GOOGLE_CLOUD_SQL_BACKUPS_API'));
      }
    }
  });
  await Promise.all(workers);

  return instances.map(instance => {
    const configuration = instance.settings?.backupConfiguration;
    return {
      name: instance.name,
      region: instance.region || '',
      databaseVersion: instance.databaseVersion || '',
      state: instance.state || 'UNKNOWN',
      connectionName: instance.connectionName || '',
      availabilityType: instance.settings?.availabilityType || '',
      automatedBackupsEnabled: configuration?.enabled === true,
      pointInTimeRecoveryEnabled: configuration?.pointInTimeRecoveryEnabled === true,
      retainedBackups: configuration?.backupRetentionSettings?.retainedBackups,
      transactionLogRetentionDays: configuration?.backupRetentionSettings?.transactionLogRetentionDays,
      backupStartTime: configuration?.startTime,
      latestBackup: backupRuns.get(instance.name),
      backupError: backupErrors.get(instance.name)
    };
  });
}

async function fetchCloudStorageBuckets(projectId: string, token: string): Promise<GoogleCloudDatabaseOverview['cloudStorage']['buckets']> {
  const url = new URL('https://storage.googleapis.com/storage/v1/b');
  url.searchParams.set('project', projectId);
  url.searchParams.set('maxResults', '1000');
  url.searchParams.set('fields', 'items(name,location,storageClass,versioning,retentionPolicy,iamConfiguration),nextPageToken');
  const buckets: Array<{
      name: string;
      location?: string;
      storageClass?: string;
      versioning?: { enabled?: boolean };
      retentionPolicy?: { retentionPeriod?: number | string };
      iamConfiguration?: { uniformBucketLevelAccess?: { enabled?: boolean } };
    }> = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 5; page += 1) {
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    else url.searchParams.delete('pageToken');
    const response = await getGoogleApiJson<{
      items?: typeof buckets;
      nextPageToken?: string;
    }>(url, token, 'GOOGLE_CLOUD_STORAGE_API');
    buckets.push(...(response.items || []));
    pageToken = response.nextPageToken;
    if (!pageToken) break;
  }
  if (pageToken) throw new Error('GOOGLE_CLOUD_STORAGE_API_RESULT_LIMIT_EXCEEDED');
  return buckets.map(bucket => {
    const retentionPeriodSeconds = Number(bucket.retentionPolicy?.retentionPeriod);
    return {
      name: bucket.name,
      location: bucket.location || '',
      storageClass: bucket.storageClass || '',
      versioningEnabled: bucket.versioning?.enabled === true,
      retentionPeriodSeconds: Number.isFinite(retentionPeriodSeconds) && retentionPeriodSeconds > 0
        ? retentionPeriodSeconds
        : undefined,
      uniformBucketLevelAccess: bucket.iamConfiguration?.uniformBucketLevelAccess?.enabled === true
    };
  });
}

export async function getGoogleCloudDatabaseOverview(
  projectId: string,
  serviceAccountJson: string
): Promise<GoogleCloudDatabaseOverview> {
  if (!isValidGoogleCloudProjectId(projectId)) throw new Error('DATABASE_GOOGLE_CLOUD_PROJECT_ID_INVALID');
  const token = await getGoogleCloudAccessToken(serviceAccountJson);
  const [sqlResult, storageResult] = await Promise.allSettled([
    fetchCloudSqlInstances(projectId, token),
    fetchCloudStorageBuckets(projectId, token)
  ]);
  return {
    projectId,
    checkedAt: new Date().toISOString(),
    cloudSql: sqlResult.status === 'fulfilled'
      ? { available: true, instances: sqlResult.value }
      : { available: false, error: providerErrorCode(sqlResult.reason, 'GOOGLE_CLOUD_SQL_API'), instances: [] },
    cloudStorage: storageResult.status === 'fulfilled'
      ? { available: true, buckets: storageResult.value }
      : { available: false, error: providerErrorCode(storageResult.reason, 'GOOGLE_CLOUD_STORAGE_API'), buckets: [] }
  };
}

export async function testGoogleCloudDatabaseConnection(
  projectId: string,
  serviceAccountJson: string
): Promise<void> {
  if (!isValidGoogleCloudProjectId(projectId)) throw new Error('DATABASE_GOOGLE_CLOUD_PROJECT_ID_INVALID');
  const token = await getGoogleCloudAccessToken(serviceAccountJson);
  const url = new URL(`https://sqladmin.googleapis.com/sql/v1beta4/projects/${encodeURIComponent(projectId)}/instances`);
  url.searchParams.set('maxResults', '1');
  await getGoogleApiJson<{ items?: unknown[] }>(url, token, 'GOOGLE_CLOUD_SQL_API');
}

export async function listGoogleCloudSqlSuccessfulBackups(
  projectId: string,
  serviceAccountJson: string,
  sourceInstanceId: string
): Promise<GoogleCloudBackupInventory> {
  validateRecoveryRequest(projectId, sourceInstanceId, '1');
  const token = await getGoogleCloudAccessToken(serviceAccountJson);
  const instanceUrl = new URL(
    `https://sqladmin.googleapis.com/sql/v1beta4/projects/${encodeURIComponent(projectId)}/instances/${encodeURIComponent(sourceInstanceId)}`
  );
  const instance = await getGoogleApiJson<CloudSqlInstance>(instanceUrl, token, 'GOOGLE_CLOUD_SQL_INSTANCE_API');
  const databaseEngine = getGoogleCloudDatabaseEngine(instance.databaseVersion || '');
  if (!databaseEngine) throw new Error('DATABASE_GOOGLE_CLOUD_RECOVERY_ENGINE_UNSUPPORTED');
  const url = new URL(
    `https://sqladmin.googleapis.com/sql/v1beta4/projects/${encodeURIComponent(projectId)}/instances/${encodeURIComponent(sourceInstanceId)}/backupRuns`
  );
  url.searchParams.set('maxResults', '100');
  const results: CloudSqlBackupRun[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 20; page += 1) {
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    else url.searchParams.delete('pageToken');
    const response = await getGoogleApiJson<{ items?: CloudSqlBackupRun[]; nextPageToken?: string }>(
      url, token, 'GOOGLE_CLOUD_SQL_BACKUPS_API'
    );
    results.push(...(response.items || []));
    pageToken = response.nextPageToken;
    if (!pageToken) break;
  }
  if (pageToken) throw new Error('GOOGLE_CLOUD_SQL_BACKUPS_API_RESULT_LIMIT_EXCEEDED');
  return {
    databaseEngine,
    databaseVersion: instance.databaseVersion || '',
    backups: results
      .filter((backup): backup is CloudSqlBackupRun & { id: string; status: 'SUCCESSFUL' } =>
        typeof backup.id === 'string' && isValidGoogleCloudSqlBackupRunId(backup.id) && backup.status === 'SUCCESSFUL'
      )
      .map(backup => ({ id: backup.id, status: 'SUCCESSFUL' as const, startTime: backup.startTime, type: backup.type }))
      .sort((left, right) => (right.startTime || '').localeCompare(left.startTime || ''))
  };
}

function validateRecoveryRequest(projectId: string, sourceInstanceId: string, backupRunId: string): void {
  if (!isValidGoogleCloudProjectId(projectId)) throw new Error('DATABASE_GOOGLE_CLOUD_PROJECT_ID_INVALID');
  if (!isValidGoogleCloudSqlInstanceId(sourceInstanceId)) throw new Error('DATABASE_GOOGLE_CLOUD_SOURCE_INSTANCE_INVALID');
  if (!isValidGoogleCloudSqlBackupRunId(backupRunId)) throw new Error('DATABASE_GOOGLE_CLOUD_BACKUP_RUN_INVALID');
}

async function recoveryApi(projectId: string, recoveryServiceAccountJson: string): Promise<GoogleCloudRecoveryApi> {
  const token = await getGoogleCloudAccessToken(recoveryServiceAccountJson, GOOGLE_CLOUD_RECOVERY_SCOPE);
  const urlFor = (endpoint: string) => new URL(`https://sqladmin.googleapis.com/sql/v1beta4/projects/${encodeURIComponent(projectId)}${endpoint}`);
  const call = <T>(url: URL, code: string, method: 'GET' | 'POST' | 'DELETE' = 'GET', body?: unknown) =>
    callGoogleApi<T>(url, token, code, method, body);
  return {
      listBackupRuns: async (project, instance) => {
        const response = await call<{ items?: CloudSqlBackupRun[] }>(
          urlFor(`/instances/${encodeURIComponent(instance)}/backupRuns?maxResults=100`), 'GOOGLE_CLOUD_SQL_BACKUPS_API'
        );
        return response.items || [];
      },
      getInstance: (project, instance) => call<CloudSqlInstance>(
        urlFor(`/instances/${encodeURIComponent(instance)}`), 'GOOGLE_CLOUD_SQL_INSTANCE_API'
      ),
      listDatabases: async (project, instance) => {
        const response = await call<{ items?: CloudSqlDatabase[] }>(
          urlFor(`/instances/${encodeURIComponent(instance)}/databases?maxResults=100`), 'GOOGLE_CLOUD_SQL_DATABASES_API'
        );
        return response.items || [];
      },
      createInstance: (project, instance) => call<CloudSqlOperation>(
        urlFor('/instances'), 'GOOGLE_CLOUD_SQL_CREATE_API', 'POST', instance
      ),
      restoreBackup: (project, target, source, backupRunId) => call<CloudSqlOperation>(
        urlFor(`/instances/${encodeURIComponent(target)}/restoreBackup`),
        'GOOGLE_CLOUD_SQL_RESTORE_API',
        'POST',
        { restoreBackupContext: { backupRunId, instanceId: source, project } }
      ),
      getOperation: (project, operationName) => call<CloudSqlOperation>(
        urlFor(`/operations/${encodeURIComponent(operationName)}`), 'GOOGLE_CLOUD_SQL_OPERATION_API'
      ),
      deleteInstance: (project, instance) => call<CloudSqlOperation>(
        urlFor(`/instances/${encodeURIComponent(instance)}`), 'GOOGLE_CLOUD_SQL_DELETE_API', 'DELETE'
      )
  };
}

export type GoogleCloudRecoveryAuditEvent = {
  action: 'launch' | 'cleanup' | 'cleanup-failed';
  drill: GoogleCloudRecoveryDrill;
  actor?: string;
};

export class GoogleCloudRecoveryDrillManager {
  private readonly records = new Map<string, GoogleCloudRecoveryDrill>();
  private readonly activeRuns = new Set<string>();
  private writeQueue: Promise<void> = Promise.resolve();
  private initialized = false;
  private reconcileTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly options: {
      storagePath: string;
      apiFactory: GoogleCloudRecoveryApiFactory;
      onAudit?: (event: GoogleCloudRecoveryAuditEvent) => void;
    }
  ) {}

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await mkdir(path.dirname(this.options.storagePath), { recursive: true, mode: 0o700 });
    try {
      const stat = await lstat(this.options.storagePath);
      if (!stat.isFile()) throw new Error('DATABASE_GOOGLE_CLOUD_RECOVERY_STORE_INVALID');
      const parsed = JSON.parse(await readFile(this.options.storagePath, 'utf8')) as unknown;
      if (!Array.isArray(parsed)) throw new Error('DATABASE_GOOGLE_CLOUD_RECOVERY_STORE_INVALID');
      for (const item of parsed) {
        if (!isRecoveryDrillRecord(item)) throw new Error('DATABASE_GOOGLE_CLOUD_RECOVERY_STORE_INVALID');
        this.records.set(item.id, item);
      }
      await chmod(this.options.storagePath, 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new Error('DATABASE_GOOGLE_CLOUD_RECOVERY_STORE_INVALID');
      }
      await this.persist();
    }
    this.initialized = true;
  }

  startReconciliation(): void {
    void this.reconcile().catch(error => console.error('[google-cloud-recovery] startup reconciliation failed', error));
    if (!this.reconcileTimer) {
      this.reconcileTimer = setInterval(() => {
        void this.reconcile().catch(error => console.error('[google-cloud-recovery] cleanup reconciliation failed', error));
      }, 15 * 60_000);
      this.reconcileTimer.unref?.();
    }
  }

  list(): GoogleCloudRecoveryDrill[] {
    return [...this.records.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  get(id: string): GoogleCloudRecoveryDrill | undefined {
    return this.records.get(id);
  }

  async launch(input: {
    projectId: string;
    sourceInstanceId: string;
    backupRunId: string;
    readonlyServiceAccountJson: string;
    recoveryServiceAccountJson: string;
    requestedBy?: string;
  }): Promise<GoogleCloudRecoveryDrill> {
    await this.initialize();
    validateRecoveryRequest(input.projectId, input.sourceInstanceId, input.backupRunId);
    parseGoogleCloudServiceAccountJson(input.readonlyServiceAccountJson);
    parseGoogleCloudServiceAccountJson(input.recoveryServiceAccountJson);
    const backupInventory = await listGoogleCloudSqlSuccessfulBackups(
      input.projectId, input.readonlyServiceAccountJson, input.sourceInstanceId
    );
    if (!backupInventory.backups.some(backup => backup.id === input.backupRunId && backup.status === 'SUCCESSFUL')) {
      throw new Error('DATABASE_GOOGLE_CLOUD_BACKUP_RUN_NOT_SUCCESSFUL');
    }
    const api = await this.options.apiFactory(input.projectId, input.recoveryServiceAccountJson);
    const source = await api.getInstance(input.projectId, input.sourceInstanceId);
    if (!source.region || !source.databaseVersion || !source.settings?.tier) {
      throw new Error('DATABASE_GOOGLE_CLOUD_SOURCE_INSTANCE_UNSUPPORTED');
    }
    const databaseEngine = getGoogleCloudDatabaseEngine(source.databaseVersion);
    if (!databaseEngine || databaseEngine !== backupInventory.databaseEngine) {
      throw new Error('DATABASE_GOOGLE_CLOUD_RECOVERY_ENGINE_MISMATCH');
    }
    const existingSourceDatabases = await api.listDatabases(input.projectId, input.sourceInstanceId);
    if (!getGoogleCloudUserDatabaseNames(existingSourceDatabases, databaseEngine).length) {
      throw new Error('DATABASE_GOOGLE_CLOUD_RECOVERY_SOURCE_DATABASES_EMPTY');
    }
    const runUuid = randomUUID();
    const targetInstanceId = generateGoogleCloudRecoveryTargetId(runUuid);
    const ownershipLabels = { ruda_owner: 'restore_drill', ruda_run: runUuid.replace(/-/g, '') };
    try {
      await api.getInstance(input.projectId, targetInstanceId);
      throw new Error('DATABASE_GOOGLE_CLOUD_RECOVERY_TARGET_ALREADY_EXISTS');
    } catch (error) {
      if (!(error instanceof Error) || !error.message.endsWith('_404')) throw error;
    }
    const now = new Date().toISOString();
    const drill: GoogleCloudRecoveryDrill = {
      id: runUuid,
      projectId: input.projectId,
      sourceInstanceId: input.sourceInstanceId,
      backupRunId: input.backupRunId,
      targetInstanceId,
      databaseVersion: source.databaseVersion,
      ownershipLabels,
      status: 'CREATING',
      creationResolved: false,
      recoveryVerified: false,
      cleanupComplete: false,
      createdAt: now,
      updatedAt: now
    };
    this.records.set(drill.id, drill);
    await this.persist();
    this.audit('launch', drill, input.requestedBy);
    this.activeRuns.add(drill.id);
    void this.run(drill.id, source, api, input.projectId, input.sourceInstanceId, input.backupRunId);
    return drill;
  }

  async retryCleanup(id: string, recoveryServiceAccountJson: string): Promise<GoogleCloudRecoveryDrill> {
    await this.initialize();
    const drill = this.records.get(id);
    if (!drill) throw new Error('DATABASE_GOOGLE_CLOUD_RECOVERY_DRILL_NOT_FOUND');
    if (drill.cleanupComplete) return drill;
    if (this.activeRuns.has(id)) throw new Error('DATABASE_GOOGLE_CLOUD_RECOVERY_DRILL_IN_PROGRESS');
    const api = await this.options.apiFactory(drill.projectId, recoveryServiceAccountJson);
    await this.cleanup(drill, api);
    return this.records.get(id)!;
  }

  async reconcile(): Promise<void> {
    await this.initialize();
    const records = [...this.records.values()];
    for (const drill of records) {
      if (this.activeRuns.has(drill.id) || drill.cleanupComplete) continue;
      if (drill.status === 'SUCCEEDED') continue;
      try {
        const api = await this.options.apiFactory(drill.projectId, '');
        await this.cleanup(drill, api);
      } catch (error) {
        const latest = this.records.get(drill.id)!;
        const pending = transitionGoogleCloudRecoveryDrill(latest, 'CLEANUP_PENDING', {
          error: safeRecoveryError(error)
        });
        this.records.set(drill.id, pending);
        await this.persist();
      }
    }
  }

  private async run(
    id: string,
    source: CloudSqlInstance,
    api: GoogleCloudRecoveryApi,
    projectId: string,
    sourceInstanceId: string,
    backupRunId: string
  ): Promise<void> {
    try {
      let drill = this.records.get(id)!;
      const settings = source.settings || {};
      const createRequest = {
        name: drill.targetInstanceId,
        region: source.region,
        databaseVersion: source.databaseVersion,
        settings: {
          tier: settings.tier,
          dataDiskType: settings.dataDiskType,
          ...(settings.dataDiskSizeGb ? { dataDiskSizeGb: settings.dataDiskSizeGb } : {}),
          ...(settings.edition ? { edition: settings.edition } : {}),
          availabilityType: 'ZONAL',
          ipConfiguration: { ipv4Enabled: false },
          userLabels: drill.ownershipLabels
        }
      };
      const createOperation = await api.createInstance(projectId, createRequest);
      drill = { ...drill, createOperationName: createOperation.name, updatedAt: new Date().toISOString() };
      this.records.set(id, drill);
      await this.persist();
      await this.waitForOperation(projectId, createOperation, api);
      drill = transitionGoogleCloudRecoveryDrill({ ...drill, creationResolved: true }, 'RESTORING');
      this.records.set(id, drill);
      await this.persist();

      const restoreOperation = await api.restoreBackup(projectId, drill.targetInstanceId, sourceInstanceId, backupRunId);
      await this.waitForOperation(projectId, restoreOperation, api);
      drill = transitionGoogleCloudRecoveryDrill(drill, 'VERIFYING');
      this.records.set(id, drill);
      await this.persist();

      const restoredNames = getGoogleCloudUserDatabaseNames(
        await api.listDatabases(projectId, drill.targetInstanceId),
        getGoogleCloudDatabaseEngine(drill.databaseVersion || '')
      );
      if (!restoredNames.length) {
        throw new Error('DATABASE_GOOGLE_CLOUD_RECOVERY_DATABASE_VERIFICATION_FAILED');
      }
      drill = { ...drill, recoveryVerified: true, updatedAt: new Date().toISOString() };
      this.records.set(id, drill);
      await this.persist();
      await this.cleanup(drill, api);
    } catch (error) {
      let drill = this.records.get(id);
      if (drill && !drill.cleanupComplete) {
        if (
          drill.status === 'CREATING' &&
          !drill.createOperationName &&
          error instanceof Error &&
          /^GOOGLE_CLOUD_SQL_CREATE_API_4\d\d$/.test(error.message)
        ) {
          drill = { ...drill, creationResolved: true, updatedAt: new Date().toISOString() };
          this.records.set(id, drill);
          await this.persist();
        }
        await this.cleanup({ ...drill, error: safeRecoveryError(error) }, api);
      }
    } finally {
      this.activeRuns.delete(id);
    }
  }

  private async cleanup(drill: GoogleCloudRecoveryDrill, api: GoogleCloudRecoveryApi): Promise<void> {
    try {
      let target: CloudSqlInstance;
      try {
        target = await api.getInstance(drill.projectId, drill.targetInstanceId);
      } catch (error) {
        if (error instanceof Error && error.message.endsWith('_404')) {
          let current = this.records.get(drill.id) || drill;
          if (!current.creationResolved) {
            if (!current.createOperationName) {
              throw new Error('DATABASE_GOOGLE_CLOUD_RECOVERY_CREATE_OUTCOME_UNCONFIRMED');
            }
            try {
              await this.waitForOperation(
                current.projectId,
                { name: current.createOperationName, status: 'PENDING' },
                api
              );
            } catch (operationError) {
              if (!(operationError instanceof Error) || operationError.message !== 'DATABASE_GOOGLE_CLOUD_OPERATION_FAILED') {
                throw operationError;
              }
            }
            current = { ...current, creationResolved: true, updatedAt: new Date().toISOString() };
            this.records.set(current.id, current);
            await this.persist();
          }
          try {
            target = await api.getInstance(drill.projectId, drill.targetInstanceId);
          } catch (visibilityError) {
            if (visibilityError instanceof Error && visibilityError.message.endsWith('_404')) {
              await this.finishCleanup(current, true);
              return;
            }
            throw visibilityError;
          }
        } else {
          throw error;
        }
      }
      if (!sameLabels(target.settings?.userLabels ?? target.userLabels ?? {}, drill.ownershipLabels)) {
        throw new Error('DATABASE_GOOGLE_CLOUD_RECOVERY_OWNERSHIP_LABEL_MISMATCH');
      }
      this.audit('cleanup', drill);
      const operation = await api.deleteInstance(drill.projectId, drill.targetInstanceId);
      await this.waitForOperation(drill.projectId, operation, api);
      await this.finishCleanup(drill, true);
    } catch (error) {
      const current = this.records.get(drill.id) || drill;
      const pending = transitionGoogleCloudRecoveryDrill(current, 'CLEANUP_PENDING', {
        recoveryVerified: current.recoveryVerified,
        cleanupComplete: false,
        error: safeRecoveryError(error)
      });
      this.records.set(drill.id, pending);
      await this.persist();
      this.audit('cleanup-failed', pending);
    }
  }

  private async finishCleanup(drill: GoogleCloudRecoveryDrill, complete: boolean): Promise<void> {
    const current = this.records.get(drill.id) || drill;
    const status = current.recoveryVerified ? 'SUCCEEDED' : 'FAILED';
    const finished = transitionGoogleCloudRecoveryDrill(current, status, {
      cleanupComplete: complete,
      recoveryVerified: current.recoveryVerified,
      error: current.recoveryVerified ? undefined : current.error
    });
    this.records.set(drill.id, finished);
    await this.persist();
    this.audit('cleanup', finished);
  }

  private async waitForOperation(projectId: string, initial: CloudSqlOperation, api: GoogleCloudRecoveryApi): Promise<void> {
    if (!initial.name) throw new Error('DATABASE_GOOGLE_CLOUD_OPERATION_NAME_MISSING');
    const deadline = Date.now() + RECOVERY_OPERATION_TIMEOUT_MS;
    let operation = initial;
    while (operation.status !== 'DONE') {
      if (Date.now() >= deadline) throw new Error('DATABASE_GOOGLE_CLOUD_OPERATION_TIMEOUT');
      await new Promise(resolve => setTimeout(resolve, RECOVERY_OPERATION_POLL_MS));
      const operationName = operation.name;
      if (!operationName) throw new Error('DATABASE_GOOGLE_CLOUD_OPERATION_NAME_MISSING');
      operation = await api.getOperation(projectId, operationName.split('/').pop() || operationName);
    }
    if (operation.error?.errors?.length) throw new Error('DATABASE_GOOGLE_CLOUD_OPERATION_FAILED');
  }

  private async persist(): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      const filePath = this.options.storagePath;
      await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
      const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporaryPath, `${JSON.stringify([...this.records.values()], null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
        await chmod(temporaryPath, 0o600);
        await rename(temporaryPath, filePath);
        await chmod(filePath, 0o600);
      } finally {
        await unlink(temporaryPath).catch(() => undefined);
      }
    });
    return this.writeQueue;
  }

  private audit(action: GoogleCloudRecoveryAuditEvent['action'], drill: GoogleCloudRecoveryDrill, actor?: string): void {
    this.options.onAudit?.({ action, drill, actor });
  }
}

function sameLabels(actual: Record<string, string>, expected: Record<string, string>): boolean {
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  return actualKeys.length === expectedKeys.length &&
    actualKeys.every((key, index) => key === expectedKeys[index] && actual[key] === expected[key]);
}

export function getGoogleCloudUserDatabaseNames(
  databases: CloudSqlDatabase[],
  databaseEngine: 'MySQL' | 'PostgreSQL' | undefined
): string[] {
  const systemDatabases = databaseEngine === 'MySQL'
    ? ['mysql', 'information_schema', 'performance_schema', 'sys']
    : ['template0', 'template1'];
  return databases
    .map(database => database.name)
    .filter((name): name is string =>
      Boolean(name) && !systemDatabases.includes(name!)
    );
}

function safeRecoveryError(error: unknown): string {
  return error instanceof Error && /^DATABASE_GOOGLE_CLOUD_[A-Z0-9_]+$/.test(error.message)
    ? error.message
    : error instanceof Error && /^GOOGLE_CLOUD_[A-Z0-9_]+$/.test(error.message)
      ? error.message
      : 'DATABASE_GOOGLE_CLOUD_RECOVERY_FAILED';
}

function isRecoveryDrillRecord(value: unknown): value is GoogleCloudRecoveryDrill {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<GoogleCloudRecoveryDrill>;
  return typeof record.id === 'string' &&
    /^[0-9a-f-]{36}$/.test(record.id) &&
    typeof record.projectId === 'string' && isValidGoogleCloudProjectId(record.projectId) &&
    typeof record.sourceInstanceId === 'string' && isValidGoogleCloudSqlInstanceId(record.sourceInstanceId) &&
    typeof record.backupRunId === 'string' && isValidGoogleCloudSqlBackupRunId(record.backupRunId) &&
    typeof record.targetInstanceId === 'string' && record.targetInstanceId === generateGoogleCloudRecoveryTargetId(record.id) &&
    (record.databaseVersion === undefined ||
      (typeof record.databaseVersion === 'string' && getGoogleCloudDatabaseEngine(record.databaseVersion) !== undefined)) &&
    !!record.ownershipLabels &&
    sameLabels(record.ownershipLabels, {
      ruda_owner: 'restore_drill',
      ruda_run: record.id.replace(/-/g, '')
    }) && record.status !== undefined &&
    ['CREATING', 'RESTORING', 'VERIFYING', 'CLEANUP_PENDING', 'SUCCEEDED', 'FAILED'].includes(record.status) &&
    typeof record.creationResolved === 'boolean' &&
    (record.createOperationName === undefined || typeof record.createOperationName === 'string') &&
    typeof record.recoveryVerified === 'boolean' && typeof record.cleanupComplete === 'boolean' &&
    typeof record.createdAt === 'string' && typeof record.updatedAt === 'string';
}

export function createGoogleCloudRecoveryApiFactory(): GoogleCloudRecoveryApiFactory {
  return recoveryApi;
}

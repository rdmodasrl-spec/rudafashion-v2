import {
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client
} from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import type { MediaBackupManifest, MediaBackupObject, MediaBackupRun } from '../shared/mediaBackup';

const MAX_MEDIA_OBJECTS_PER_RUN = 50_000;
const MEDIA_BACKUP_HISTORY_LIMIT = 365;

type MediaBackupState = { runs: MediaBackupRun[] };
type MediaBackupStorage = Pick<S3Client, 'send'>;
type MediaBackupResult = { run: MediaBackupRun; success: boolean };

function storageErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return 'MEDIA_BACKUP_PROVIDER_FAILED';
  const name = 'name' in error && typeof error.name === 'string' ? error.name : '';
  const code = 'Code' in error && typeof error.Code === 'string' ? error.Code : '';
  const candidate = name || code;
  return /^[A-Za-z0-9_-]{1,80}$/.test(candidate) ? `MEDIA_BACKUP_${candidate.toUpperCase()}` : 'MEDIA_BACKUP_PROVIDER_FAILED';
}

function isMediaBackupRun(value: unknown): value is MediaBackupRun {
  if (!value || typeof value !== 'object') return false;
  const run = value as Partial<MediaBackupRun>;
  return typeof run.id === 'string' &&
    /^[0-9a-f-]{36}$/.test(run.id) &&
    ['RUNNING', 'SUCCEEDED', 'FAILED', 'INTERRUPTED'].includes(String(run.status)) &&
    typeof run.sourceBucket === 'string' &&
    typeof run.destinationBucket === 'string' &&
    typeof run.destinationPrefix === 'string' &&
    Number.isSafeInteger(run.objectCount) &&
    Number.isSafeInteger(run.copiedObjects) &&
    Number.isSafeInteger(run.copiedBytes) &&
    typeof run.startedAt === 'string' &&
    (run.completedAt === undefined || typeof run.completedAt === 'string') &&
    (run.error === undefined || typeof run.error === 'string');
}

function mediaBackupRoot(prefix: string, runId: string): string {
  return `${prefix ? `${prefix}/` : ''}${runId}`;
}

export class MediaBackupManager {
  private state: MediaBackupState = { runs: [] };
  private initialized?: Promise<void>;
  private activeRunId?: string;
  private writeQueue = Promise.resolve();

  constructor(
    private readonly statePath: string,
    private readonly onResult?: (result: MediaBackupResult) => void
  ) {}

  async initialize(): Promise<void> {
    this.initialized ??= this.load();
    await this.initialized;
  }

  async latest(): Promise<MediaBackupRun | undefined> {
    await this.initialize();
    return this.state.runs[0];
  }

  async history(): Promise<MediaBackupRun[]> {
    await this.initialize();
    return this.state.runs;
  }

  async testConnection(client: MediaBackupStorage, bucket: string): Promise<void> {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  }

  async start(input: {
    sourceClient: MediaBackupStorage;
    sourceBucket: string;
    destinationClient: MediaBackupStorage;
    destinationBucket: string;
    destinationPrefix: string;
  }): Promise<MediaBackupRun> {
    await this.initialize();
    if (this.activeRunId) throw new Error('MEDIA_BACKUP_ALREADY_RUNNING');
    const run: MediaBackupRun = {
      id: randomUUID(),
      status: 'RUNNING',
      sourceBucket: input.sourceBucket,
      destinationBucket: input.destinationBucket,
      destinationPrefix: mediaBackupRoot(input.destinationPrefix, randomUUID()),
      objectCount: 0,
      copiedObjects: 0,
      copiedBytes: 0,
      startedAt: new Date().toISOString()
    };
    this.activeRunId = run.id;
    this.state.runs = [run, ...this.state.runs.filter(item => item.id !== run.id)].slice(0, MEDIA_BACKUP_HISTORY_LIMIT);
    try {
      await this.persist();
    } catch (error) {
      this.activeRunId = undefined;
      throw error;
    }
    void this.run(run.id, input).catch(async error => {
      const current = this.find(run.id);
      if (!current) return;
      const failed = {
        ...current,
        status: 'FAILED',
        completedAt: new Date().toISOString(),
        error: storageErrorCode(error)
      } satisfies MediaBackupRun;
      this.replace(failed);
      try {
        await this.persist();
      } catch (persistError) {
        console.error('[media-backup] failed to persist failure status', storageErrorCode(persistError));
      }
      this.activeRunId = undefined;
      this.notify({ run: failed, success: false });
    });
    return run;
  }

  async restoreMissing(input: {
    backupClient: MediaBackupStorage;
    backupBucket: string;
    mediaClient: MediaBackupStorage;
    mediaBucket: string;
    runId: string;
  }): Promise<{ restoredObjects: number; alreadyPresentObjects: number; restoredBytes: number }> {
    await this.initialize();
    if (this.activeRunId) throw new Error('MEDIA_BACKUP_ALREADY_RUNNING');
    if (!/^[0-9a-f-]{36}$/.test(input.runId)) throw new Error('MEDIA_BACKUP_RUN_ID_INVALID');
    const restoreLock = `restore-${randomUUID()}`;
    this.activeRunId = restoreLock;
    try {
      const run = this.state.runs.find(item =>
        item.id === input.runId &&
        item.status === 'SUCCEEDED' &&
        item.destinationBucket === input.backupBucket &&
        item.sourceBucket === input.mediaBucket
      );
      if (!run) throw new Error('MEDIA_BACKUP_RUN_NOT_RESTORABLE');
      const manifestKey = `${run.destinationPrefix}/manifest.json`;
      const response = await input.backupClient.send(new GetObjectCommand({ Bucket: input.backupBucket, Key: manifestKey }));
      if (
        !response.Body ||
        !Number.isSafeInteger(response.ContentLength) ||
        (response.ContentLength ?? 0) > 25 * 1024 * 1024
      ) {
        throw new Error('MEDIA_BACKUP_MANIFEST_INVALID');
      }
      let manifest: unknown;
      try {
        manifest = JSON.parse(await response.Body.transformToString());
      } catch {
        throw new Error('MEDIA_BACKUP_MANIFEST_INVALID');
      }
      if (!this.isValidManifest(manifest, run)) throw new Error('MEDIA_BACKUP_MANIFEST_INVALID');

      let restoredObjects = 0;
      let alreadyPresentObjects = 0;
      let restoredBytes = 0;
      let nextIndex = 0;
      let restoreFailure: unknown;
      const workers = Array.from({ length: Math.min(2, manifest.objects.length) }, async () => {
        while (!restoreFailure && nextIndex < manifest.objects.length) {
          const object = manifest.objects[nextIndex++];
          try {
            const existing = await input.mediaClient.send(new HeadObjectCommand({
              Bucket: input.mediaBucket,
              Key: object.key
            })).catch(error => {
              if (error && typeof error === 'object' && 'name' in error && error.name === 'NotFound') return undefined;
              if (error && typeof error === 'object' && '$metadata' in error) {
                const metadata = error.$metadata;
                if (metadata && typeof metadata === 'object' && 'httpStatusCode' in metadata && metadata.httpStatusCode === 404) {
                  return undefined;
                }
              }
              throw error;
            });
            if (existing) {
              if (
                existing.ContentLength !== object.size ||
                (object.etag !== undefined && existing.ETag !== object.etag)
              ) {
                throw new Error('MEDIA_BACKUP_RESTORE_OBJECT_CONFLICT');
              }
              alreadyPresentObjects += 1;
              continue;
            }
            const archivedObject = await input.backupClient.send(new GetObjectCommand({
              Bucket: input.backupBucket,
              Key: `${run.destinationPrefix}/${object.key}`
            }));
            if (!archivedObject.Body) throw new Error('MEDIA_BACKUP_ARCHIVE_OBJECT_MISSING');
            if (!(archivedObject.Body instanceof Readable)) throw new Error('MEDIA_BACKUP_ARCHIVE_STREAM_UNSUPPORTED');
            await input.mediaClient.send(new PutObjectCommand({
              Bucket: input.mediaBucket,
              Key: object.key,
              Body: archivedObject.Body,
              ContentLength: object.size,
              IfNoneMatch: '*',
              ...(object.contentType ? { ContentType: object.contentType } : {}),
              ...(object.cacheControl ? { CacheControl: object.cacheControl } : {}),
              ...(object.contentDisposition ? { ContentDisposition: object.contentDisposition } : {}),
              ...(object.contentEncoding ? { ContentEncoding: object.contentEncoding } : {}),
              ...(object.contentLanguage ? { ContentLanguage: object.contentLanguage } : {}),
              ...(object.expires ? { Expires: new Date(object.expires) } : {}),
              ...(object.metadata ? { Metadata: object.metadata } : {})
            }));
            const restored = await input.mediaClient.send(new HeadObjectCommand({ Bucket: input.mediaBucket, Key: object.key }));
            if (
              restored.ContentLength !== object.size ||
              (object.etag !== undefined && restored.ETag !== object.etag)
            ) {
              throw new Error('MEDIA_BACKUP_RESTORE_VERIFICATION_FAILED');
            }
            restoredObjects += 1;
            restoredBytes += object.size;
          } catch (error) {
            restoreFailure ??= error;
            throw error;
          }
        }
      });
      await Promise.allSettled(workers);
      if (restoreFailure) throw restoreFailure;
      return { restoredObjects, alreadyPresentObjects, restoredBytes };
    } finally {
      if (this.activeRunId === restoreLock) this.activeRunId = undefined;
    }
  }

  private async run(runId: string, input: {
    sourceClient: MediaBackupStorage;
    sourceBucket: string;
    destinationClient: MediaBackupStorage;
    destinationBucket: string;
    destinationPrefix: string;
  }): Promise<void> {
    try {
      const objects = await this.listObjects(input.sourceClient, input.sourceBucket);
      const run = this.find(runId);
      if (!run) throw new Error('MEDIA_BACKUP_RUN_NOT_FOUND');
      this.replace({
        ...run,
        objectCount: objects.length
      });
      await this.persist();

      let nextIndex = 0;
      let lastPersistedAt = Date.now();
      let copyFailure: unknown;
      const workers = Array.from({ length: Math.min(4, objects.length) }, async () => {
        while (!copyFailure && nextIndex < objects.length) {
          const object = objects[nextIndex++];
          try {
            await this.copyAndVerify(object, input, run);
            const current = this.find(runId);
            if (!current) throw new Error('MEDIA_BACKUP_RUN_NOT_FOUND');
            this.replace({
              ...current,
              copiedObjects: current.copiedObjects + 1,
              copiedBytes: current.copiedBytes + object.size
            });
            if (Date.now() - lastPersistedAt >= 10_000) {
              await this.persist();
              lastPersistedAt = Date.now();
            }
          } catch (error) {
            copyFailure ??= error;
            throw error;
          }
        }
      });
      await Promise.allSettled(workers);
      if (copyFailure) throw copyFailure;

      const manifest: MediaBackupManifest = {
        version: 1,
        runId,
        sourceBucket: input.sourceBucket,
        destinationBucket: input.destinationBucket,
        createdAt: new Date().toISOString(),
        objects
      };
      const current = this.find(runId);
      if (!current) throw new Error('MEDIA_BACKUP_RUN_NOT_FOUND');
      await input.destinationClient.send(new PutObjectCommand({
        Bucket: input.destinationBucket,
        Key: `${current.destinationPrefix}/manifest.json`,
        Body: JSON.stringify(manifest),
        ContentType: 'application/json',
        Metadata: { 'ruda-media-backup-run': runId }
      }));
      this.replace({ ...current, status: 'SUCCEEDED', completedAt: new Date().toISOString() });
      await this.persist();
      this.notify({ run: this.find(runId)!, success: true });
    } finally {
      if (this.activeRunId === runId) this.activeRunId = undefined;
    }
  }

  private async listObjects(client: MediaBackupStorage, bucket: string): Promise<MediaBackupObject[]> {
    const objects: MediaBackupObject[] = [];
    let continuationToken: string | undefined;
    do {
      const response = await client.send(new ListObjectsV2Command({
        Bucket: bucket,
        MaxKeys: 1000,
        ...(continuationToken ? { ContinuationToken: continuationToken } : {})
      }));
      for (const item of response.Contents || []) {
        if (!item.Key || item.Key.startsWith('/') || item.Key.split('/').some(segment => segment === '..') ||
          !Number.isSafeInteger(item.Size) || (item.Size ?? -1) < 0) {
          throw new Error('MEDIA_BACKUP_SOURCE_OBJECT_INVALID');
        }
        objects.push({
          key: item.Key,
          size: item.Size!,
          ...(item.ETag ? { etag: item.ETag } : {}),
          ...(item.LastModified ? { lastModified: item.LastModified.toISOString() } : {})
        });
        if (objects.length > MAX_MEDIA_OBJECTS_PER_RUN) throw new Error('MEDIA_BACKUP_OBJECT_LIMIT_EXCEEDED');
      }
      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
      if (response.IsTruncated && !continuationToken) throw new Error('MEDIA_BACKUP_PAGINATION_INVALID');
    } while (continuationToken);
    return objects;
  }

  private async copyAndVerify(
    object: MediaBackupObject,
    input: {
      sourceClient: MediaBackupStorage;
      sourceBucket: string;
      destinationClient: MediaBackupStorage;
      destinationBucket: string;
    },
    run: MediaBackupRun
  ): Promise<void> {
    const response = await input.sourceClient.send(new GetObjectCommand({
      Bucket: input.sourceBucket,
      Key: object.key,
      ...(object.etag ? { IfMatch: object.etag } : {})
    }));
    if (!response.Body) throw new Error('MEDIA_BACKUP_SOURCE_OBJECT_MISSING');
    if (!(response.Body instanceof Readable)) throw new Error('MEDIA_BACKUP_SOURCE_STREAM_UNSUPPORTED');
    await input.destinationClient.send(new PutObjectCommand({
      Bucket: input.destinationBucket,
      Key: `${run.destinationPrefix}/${object.key}`,
      Body: response.Body,
      ContentLength: object.size,
      ...(response.ContentType ? { ContentType: response.ContentType } : {}),
      ...(response.CacheControl ? { CacheControl: response.CacheControl } : {}),
      ...(response.ContentDisposition ? { ContentDisposition: response.ContentDisposition } : {}),
      ...(response.ContentEncoding ? { ContentEncoding: response.ContentEncoding } : {}),
      ...(response.ContentLanguage ? { ContentLanguage: response.ContentLanguage } : {}),
      ...(response.Expires ? { Expires: response.Expires } : {}),
      ...(response.Metadata ? { Metadata: response.Metadata } : {})
    }));
    const copied = await input.destinationClient.send(new HeadObjectCommand({
      Bucket: input.destinationBucket,
      Key: `${run.destinationPrefix}/${object.key}`
    }));
    if (copied.ContentLength !== object.size) throw new Error('MEDIA_BACKUP_OBJECT_VERIFICATION_FAILED');
    const source = await input.sourceClient.send(new HeadObjectCommand({ Bucket: input.sourceBucket, Key: object.key }));
    if (source.ContentLength !== object.size || (object.etag && source.ETag !== object.etag)) {
      throw new Error('MEDIA_BACKUP_SOURCE_CHANGED_DURING_RUN');
    }
    if (copied.ContentType) object.contentType = copied.ContentType;
    if (copied.CacheControl) object.cacheControl = copied.CacheControl;
    if (copied.ContentDisposition) object.contentDisposition = copied.ContentDisposition;
    if (copied.ContentEncoding) object.contentEncoding = copied.ContentEncoding;
    if (copied.ContentLanguage) object.contentLanguage = copied.ContentLanguage;
    if (copied.Expires) object.expires = copied.Expires.toISOString();
    if (copied.Metadata) object.metadata = copied.Metadata;
  }

  private isValidManifest(value: unknown, run: MediaBackupRun): value is MediaBackupManifest {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const manifest = value as Partial<MediaBackupManifest>;
    return manifest.version === 1 &&
      manifest.runId === run.id &&
      manifest.sourceBucket === run.sourceBucket &&
      manifest.destinationBucket === run.destinationBucket &&
      Array.isArray(manifest.objects) &&
      manifest.objects.length === run.objectCount &&
      manifest.objects.every(object =>
        object &&
        typeof object.key === 'string' &&
        object.key.length > 0 &&
        !object.key.startsWith('/') &&
        !object.key.split('/').some(segment => segment === '.' || segment === '..') &&
        Number.isSafeInteger(object.size) &&
        object.size >= 0 &&
        (object.etag === undefined || typeof object.etag === 'string') &&
        (object.contentType === undefined || typeof object.contentType === 'string') &&
        (object.cacheControl === undefined || typeof object.cacheControl === 'string') &&
        (object.contentDisposition === undefined || typeof object.contentDisposition === 'string') &&
        (object.contentEncoding === undefined || typeof object.contentEncoding === 'string') &&
        (object.contentLanguage === undefined || typeof object.contentLanguage === 'string') &&
        (object.expires === undefined || typeof object.expires === 'string') &&
        (object.metadata === undefined || (
          object.metadata !== null &&
          typeof object.metadata === 'object' &&
          !Array.isArray(object.metadata) &&
          Object.values(object.metadata).every(value => typeof value === 'string')
        ))
      );
  }

  private async load(): Promise<void> {
    try {
      const parsed: unknown = JSON.parse(await readFile(this.statePath, 'utf8'));
      if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as Partial<MediaBackupState>).runs)) {
        throw new Error('MEDIA_BACKUP_STATE_INVALID');
      }
      this.state.runs = (parsed as MediaBackupState).runs.filter(isMediaBackupRun).slice(0, MEDIA_BACKUP_HISTORY_LIMIT);
      if (this.state.runs.some(run => run.status === 'RUNNING')) {
        this.state.runs = this.state.runs.map(run =>
          run.status === 'RUNNING'
            ? { ...run, status: 'INTERRUPTED', completedAt: new Date().toISOString(), error: 'MEDIA_BACKUP_PROCESS_INTERRUPTED' }
            : run
        );
        await this.persist();
      }
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return;
      throw error;
    }
  }

  private find(runId: string): MediaBackupRun | undefined {
    return this.state.runs.find(run => run.id === runId);
  }

  private replace(run: MediaBackupRun): void {
    this.state.runs = [run, ...this.state.runs.filter(item => item.id !== run.id)].slice(0, MEDIA_BACKUP_HISTORY_LIMIT);
  }

  private notify(result: MediaBackupResult): void {
    try {
      this.onResult?.(result);
    } catch (error) {
      console.error('[media-backup] result notification failed', storageErrorCode(error));
    }
  }

  private async persist(): Promise<void> {
    const pendingWrite = this.writeQueue.then(async () => {
      await mkdir(path.dirname(this.statePath), { recursive: true, mode: 0o700 });
      const temporaryPath = `${this.statePath}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporaryPath, `${JSON.stringify({ runs: this.state.runs }, null, 2)}\n`, { mode: 0o600 });
        await chmod(temporaryPath, 0o600);
        await rename(temporaryPath, this.statePath);
        await chmod(this.statePath, 0o600);
      } finally {
        await unlink(temporaryPath).catch(() => undefined);
      }
    });
    this.writeQueue = pendingWrite.then(() => undefined, () => undefined);
    return pendingWrite;
  }
}

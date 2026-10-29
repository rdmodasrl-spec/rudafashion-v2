export type MediaBackupRunStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'INTERRUPTED';

export type MediaBackupRun = {
  id: string;
  status: MediaBackupRunStatus;
  sourceBucket: string;
  destinationBucket: string;
  destinationPrefix: string;
  objectCount: number;
  copiedObjects: number;
  copiedBytes: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
};

export type MediaBackupObject = {
  key: string;
  size: number;
  etag?: string;
  contentType?: string;
  cacheControl?: string;
  contentDisposition?: string;
  contentEncoding?: string;
  contentLanguage?: string;
  expires?: string;
  metadata?: Record<string, string>;
  lastModified?: string;
};

export type MediaBackupManifest = {
  version: 1;
  runId: string;
  sourceBucket: string;
  destinationBucket: string;
  createdAt: string;
  objects: MediaBackupObject[];
};

export function validateMediaBackupTarget(
  sourceBucket: string,
  destinationBucket: string,
  prefix: string
): boolean {
  return Boolean(
    sourceBucket &&
    destinationBucket &&
    sourceBucket !== destinationBucket &&
    sourceBucket.length <= 255 &&
    destinationBucket.length <= 255 &&
    !/[\s/\\]/.test(sourceBucket) &&
    !/[\s/\\]/.test(destinationBucket) &&
    prefix.length <= 512 &&
    !prefix.startsWith('/') &&
    !prefix.endsWith('/') &&
    !prefix.split('/').some(segment => !segment || segment === '.' || segment === '..')
  );
}

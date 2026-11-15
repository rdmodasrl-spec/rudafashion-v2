import { createHash } from 'node:crypto';

const allowedFileTypes = new Map<string, { extensions: readonly string[]; maxBytes: number }>([
  ['image/jpeg', { extensions: ['jpg', 'jpeg'], maxBytes: 12 * 1024 * 1024 }],
  ['image/png', { extensions: ['png'], maxBytes: 12 * 1024 * 1024 }],
  ['image/webp', { extensions: ['webp'], maxBytes: 12 * 1024 * 1024 }],
  ['application/pdf', { extensions: ['pdf'], maxBytes: 50 * 1024 * 1024 }],
  ['application/dxf', { extensions: ['dxf'], maxBytes: 50 * 1024 * 1024 }],
  ['application/x-dxf', { extensions: ['dxf'], maxBytes: 50 * 1024 * 1024 }],
  ['image/vnd.dxf', { extensions: ['dxf'], maxBytes: 50 * 1024 * 1024 }],
  ['model/gltf-binary', { extensions: ['glb'], maxBytes: 25 * 1024 * 1024 }]
]);

export type MerchantStudioFileInput = {
  fileName: string;
  contentType: string;
  sizeBytes: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isMerchantStudioUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function normalizeMerchantStudioFileInput(value: unknown):
  | { ok: true; input: MerchantStudioFileInput }
  | { ok: false; reason: 'invalid_file_name' | 'invalid_content_type' | 'invalid_size' } {
  if (!isRecord(value) || typeof value.fileName !== 'string') {
    return { ok: false, reason: 'invalid_file_name' };
  }
  const fileName = value.fileName
    .replace(/[\\/]/g, '_')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
  if (!fileName || fileName.length > 255 || fileName === '.' || fileName === '..') {
    return { ok: false, reason: 'invalid_file_name' };
  }

  if (typeof value.contentType !== 'string') return { ok: false, reason: 'invalid_content_type' };
  const contentType = value.contentType.trim().toLowerCase();
  const definition = allowedFileTypes.get(contentType);
  if (!definition) return { ok: false, reason: 'invalid_content_type' };
  const extension = fileName.split('.').at(-1)?.toLowerCase();
  if (!extension || !definition.extensions.includes(extension)) {
    return { ok: false, reason: 'invalid_content_type' };
  }

  const sizeBytes = value.sizeBytes;
  if (!Number.isSafeInteger(sizeBytes) || Number(sizeBytes) <= 0 || Number(sizeBytes) > definition.maxBytes) {
    return { ok: false, reason: 'invalid_size' };
  }
  return { ok: true, input: { fileName, contentType, sizeBytes: Number(sizeBytes) } };
}

export function hashMerchantStudioFileInput(input: MerchantStudioFileInput): string {
  return createHash('sha256')
    .update(JSON.stringify([input.fileName, input.contentType, input.sizeBytes]))
    .digest('hex');
}

export function normalizeMerchantStudioProjectFileIds(value: unknown):
  | { ok: true; fileIds: string[] | null }
  | { ok: false } {
  if (!isRecord(value) || !Object.hasOwn(value, 'fileIds')) return { ok: true, fileIds: null };
  if (!Array.isArray(value.fileIds) || value.fileIds.length > 100) return { ok: false };
  const fileIds: string[] = [];
  for (const fileId of value.fileIds) {
    if (!isMerchantStudioUuid(fileId) || fileIds.includes(fileId)) {
      return { ok: false };
    }
    fileIds.push(fileId);
  }
  return { ok: true, fileIds };
}

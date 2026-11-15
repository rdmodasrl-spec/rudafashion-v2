/**
 * MODAUI AI 服务商产物落库 — 下载供应商临时文件并写入既有对象存储。
 *
 * 约束（见 docs/engineering/modules/modaui-ai-provider-console.md §8）：
 * - 只写既有存储桶与既有公网地址规则，不另建文件库、不做第二套 CDN。
 * - 不做「下载失败也当成功」：任何一步失败都返回明确错误码，由调用方写 failed/rejected。
 * - 校验 MIME、文件头与大小，避免把 HTML 错误页伪装成图片/视频存进素材库。
 */

export type AiProviderAssetKind = 'images' | 'videos' | 'audio';

const ALLOWED_TYPES: Record<AiProviderAssetKind, readonly string[]> = {
  images: ['image/jpeg', 'image/png', 'image/webp'],
  videos: ['video/mp4', 'video/webm', 'video/quicktime'],
  audio: ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav']
};

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav'
};

const MAX_BYTES: Record<AiProviderAssetKind, number> = {
  images: 12 * 1024 * 1024,
  videos: 100 * 1024 * 1024,
  audio: 20 * 1024 * 1024
};

export function detectAiProviderAssetKind(contentType: string | null | undefined): AiProviderAssetKind | null {
  const value = (contentType ?? '').split(';')[0].trim().toLowerCase();
  if ((ALLOWED_TYPES.images as readonly string[]).includes(value)) return 'images';
  if ((ALLOWED_TYPES.videos as readonly string[]).includes(value)) return 'videos';
  if ((ALLOWED_TYPES.audio as readonly string[]).includes(value)) return 'audio';
  return null;
}

function hasExpectedSignature(body: Buffer, contentType: string): boolean {
  if (body.length < 12) return false;
  if (contentType === 'image/jpeg') return body.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  if (contentType === 'image/png') return body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (contentType === 'image/webp') {
    return body.subarray(0, 4).toString('ascii') === 'RIFF' && body.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  if (contentType === 'video/webm') return body.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (contentType === 'video/mp4' || contentType === 'video/quicktime' || contentType === 'audio/mp4') {
    return body.subarray(4, 8).toString('ascii') === 'ftyp';
  }
  if (contentType === 'audio/mpeg') {
    return body.subarray(0, 3).toString('ascii') === 'ID3' || (body[0] === 0xff && (body[1] & 0xe0) === 0xe0);
  }
  if (contentType === 'audio/wav' || contentType === 'audio/x-wav') {
    return body.subarray(0, 4).toString('ascii') === 'RIFF' && body.subarray(8, 12).toString('ascii') === 'WAVE';
  }
  return false;
}

/**
 * 对象键：与商家前台素材同桶同前缀规则，仅路径段区分 ai-ad 产物，
 * 便于运营按商家清理，且不触碰 `verifyMerchantMediaObject` 的商品素材校验范围。
 */
export function buildAiProviderAssetKey(input: {
  merchantId: string;
  kind: AiProviderAssetKind;
  contentType: string;
  version: 'r2' | 'v2';
  id: string;
}): string | null {
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(input.merchantId)) return null;
  if (!(ALLOWED_TYPES[input.kind] as readonly string[]).includes(input.contentType)) return null;
  if (!/^[0-9a-f-]{36}$/i.test(input.id)) return null;
  const extension = EXTENSIONS[input.contentType];
  if (!extension) return null;
  return `merchants/${input.merchantId}/ai-ad/${input.kind}/${input.version}/${input.id}.${extension}`;
}

export type AiProviderAssetErrorCode =
  | 'ASSET_URL_INVALID'
  | 'ASSET_TYPE_NOT_ALLOWED'
  | 'ASSET_TOO_LARGE'
  | 'ASSET_DOWNLOAD_FAILED'
  | 'ASSET_CONTENT_MISMATCH';

export type StoreAiProviderAssetResult =
  | { ok: true; assetId: string; key: string; url: string; contentType: string; bytes: number; kind: AiProviderAssetKind }
  | { ok: false; errorCode: AiProviderAssetErrorCode };

export async function storeAiProviderAsset(input: {
  url: string;
  merchantId: string;
  version: 'r2' | 'v2';
  expectedKind?: AiProviderAssetKind;
  fetchImpl: (url: string, init?: { signal?: AbortSignal }) => Promise<{
    ok: boolean;
    status: number;
    headers: { get(name: string): string | null };
    arrayBuffer(): Promise<ArrayBuffer>;
  }>;
  putObject: (input: { Bucket: string; Key: string; Body: Buffer; ContentType: string; CacheControl: string }) => Promise<unknown>;
  bucket: string;
  publicUrl: (key: string) => string;
  createId: () => string;
  timeoutMs?: number;
}): Promise<StoreAiProviderAssetResult> {
  const url = typeof input.url === 'string' ? input.url.trim() : '';
  if (!/^https?:\/\/\S+$/i.test(url)) return { ok: false, errorCode: 'ASSET_URL_INVALID' };
  if (!input.bucket) return { ok: false, errorCode: 'ASSET_DOWNLOAD_FAILED' };

  let response;
  try {
    response = await input.fetchImpl(url, { signal: AbortSignal.timeout(input.timeoutMs ?? 30_000) });
  } catch {
    return { ok: false, errorCode: 'ASSET_DOWNLOAD_FAILED' };
  }
  if (!response.ok) return { ok: false, errorCode: 'ASSET_DOWNLOAD_FAILED' };

  const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  const kind = detectAiProviderAssetKind(contentType);
  if (!kind || (input.expectedKind && kind !== input.expectedKind)) {
    return { ok: false, errorCode: 'ASSET_TYPE_NOT_ALLOWED' };
  }
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BYTES[kind]) {
    return { ok: false, errorCode: 'ASSET_TOO_LARGE' };
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await response.arrayBuffer());
  } catch {
    return { ok: false, errorCode: 'ASSET_DOWNLOAD_FAILED' };
  }
  if (!buffer.length) return { ok: false, errorCode: 'ASSET_DOWNLOAD_FAILED' };
  if (buffer.length > MAX_BYTES[kind]) return { ok: false, errorCode: 'ASSET_TOO_LARGE' };
  if (!hasExpectedSignature(buffer, contentType)) return { ok: false, errorCode: 'ASSET_CONTENT_MISMATCH' };

  const assetId = input.createId();
  const key = buildAiProviderAssetKey({ merchantId: input.merchantId, kind, contentType, version: input.version, id: assetId });
  if (!key) return { ok: false, errorCode: 'ASSET_TYPE_NOT_ALLOWED' };

  try {
    await input.putObject({
      Bucket: input.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public,max-age=31536000,immutable'
    });
  } catch {
    return { ok: false, errorCode: 'ASSET_DOWNLOAD_FAILED' };
  }

  return { ok: true, assetId, key, url: input.publicUrl(key), contentType, bytes: buffer.length, kind };
}

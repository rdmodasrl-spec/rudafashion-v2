export type FashionMediaCommandInput = {
  Bucket: string;
  Key: string;
};

export type FashionMediaPutInput = FashionMediaCommandInput & {
  Body: Buffer;
  ContentType: string;
  CacheControl: string;
};

const privateFashionMediaPrefix = 'fashion/community/r2-private/';
const supportedFashionMediaTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime'
]);
const fashionMediaExtensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov'
};

function hasExpectedFileSignature(body: Buffer, contentType: string) {
  if (contentType === 'image/jpeg') return body.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  if (contentType === 'image/png') return body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (contentType === 'image/webp') {
    return body.length >= 12
      && body.subarray(0, 4).toString('ascii') === 'RIFF'
      && body.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  if (contentType === 'video/webm') return body.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (contentType === 'video/mp4' || contentType === 'video/quicktime') {
    return body.subarray(4, 8).toString('ascii') === 'ftyp';
  }
  return false;
}

export function isPrivateFashionMediaKey(key: string | null | undefined): key is string {
  return Boolean(key && /^fashion\/community\/r2-private\/[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.(?:jpg|png|webp|mp4|webm|mov)$/i.test(key));
}

export async function putPrivateFashionMedia(
  putObject: (input: FashionMediaPutInput) => Promise<unknown>,
  input: FashionMediaPutInput
) {
  if (!input.Bucket || !isPrivateFashionMediaKey(input.Key)
    || !supportedFashionMediaTypes.has(input.ContentType)
    || input.Body.length === 0
    || input.Body.length > (input.ContentType.startsWith('image/') ? 12 : 100) * 1024 * 1024
    || !hasExpectedFileSignature(input.Body, input.ContentType)
    || !input.Key.endsWith(`.${fashionMediaExtensions[input.ContentType]}`)) {
    throw new Error('FASHION_MEDIA_UPLOAD_INVALID');
  }
  await putObject(input);
}

export async function getPrivateFashionMediaUrl(
  signGetObject: (input: FashionMediaCommandInput & { ContentType?: string; expiresIn: number }) => Promise<string>,
  input: FashionMediaCommandInput & {
    expectedBucket: string | undefined;
    publicationStatus: string | null | undefined;
    adminAccess: boolean;
    contentType?: string;
    expiresIn?: number;
  }
) {
  if (!input.adminAccess && input.publicationStatus !== 'approved') {
    throw new Error('FASHION_MEDIA_NOT_FOUND');
  }
  if (!input.Bucket || input.Bucket !== input.expectedBucket || !isPrivateFashionMediaKey(input.Key)) {
    throw new Error('FASHION_MEDIA_NOT_FOUND');
  }
  if (input.contentType && !supportedFashionMediaTypes.has(input.contentType)) {
    throw new Error('FASHION_MEDIA_NOT_FOUND');
  }
  const expiresIn = input.expiresIn ?? 300;
  if (!Number.isSafeInteger(expiresIn) || expiresIn < 1 || expiresIn > 300) {
    throw new Error('FASHION_MEDIA_EXPIRY_INVALID');
  }
  return signGetObject({
    Bucket: input.Bucket,
    Key: input.Key,
    ...(input.contentType ? { ContentType: input.contentType } : {}),
    expiresIn
  });
}

export async function deletePrivateFashionMedia(
  deleteObject: (input: FashionMediaCommandInput) => Promise<unknown>,
  input: FashionMediaCommandInput
) {
  if (!input.Bucket || !isPrivateFashionMediaKey(input.Key)) {
    throw new Error('FASHION_MEDIA_DELETE_INVALID');
  }
  await deleteObject(input);
}

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deletePrivateFashionMedia,
  getPrivateFashionMediaUrl,
  isPrivateFashionMediaKey,
  putPrivateFashionMedia,
  type FashionMediaCommandInput,
  type FashionMediaPutInput
} from '../src/server/fashionMediaStorage';

const bucket = 'ruda-media-private';
const key = 'fashion/community/r2-private/7dfc1d2a-79ca-48f1-8ae1-c4c37983dd30.jpg';

test('accepts only generated fashion-private object keys', () => {
  assert.equal(isPrivateFashionMediaKey(key), true);
  assert.equal(isPrivateFashionMediaKey('fashion/community/r2-private/../../credentials.jpg'), false);
  assert.equal(isPrivateFashionMediaKey('fashion/community/public/image.jpg'), false);
});

test('uploads validated private media and surfaces storage failures', async () => {
  let uploaded: FashionMediaPutInput | undefined;
  await putPrivateFashionMedia(async input => {
    uploaded = input;
  }, {
    Bucket: bucket,
    Key: key,
    Body: Buffer.from([0xff, 0xd8, 0xff]),
    ContentType: 'image/jpeg',
    CacheControl: 'private,max-age=0,no-cache,no-store'
  });
  assert.equal(uploaded?.Bucket, bucket);
  assert.equal(uploaded?.Key, key);
  assert.equal(uploaded?.ContentType, 'image/jpeg');

  await assert.rejects(
    putPrivateFashionMedia(async () => assert.fail('invalid upload must not reach storage'), {
      Bucket: bucket,
      Key: '../../outside.jpg',
      Body: Buffer.from([1]),
      ContentType: 'image/jpeg',
      CacheControl: 'private'
    }),
    /FASHION_MEDIA_UPLOAD_INVALID/
  );
  await assert.rejects(
    putPrivateFashionMedia(async () => assert.fail('oversized upload must not reach storage'), {
      Bucket: bucket,
      Key: key,
      Body: Buffer.alloc(12 * 1024 * 1024 + 1),
      ContentType: 'image/jpeg',
      CacheControl: 'private'
    }),
    /FASHION_MEDIA_UPLOAD_INVALID/
  );
  await assert.rejects(
    putPrivateFashionMedia(async () => assert.fail('unsupported MIME must not reach storage'), {
      Bucket: bucket,
      Key: key,
      Body: Buffer.from([1]),
      ContentType: 'application/octet-stream',
      CacheControl: 'private'
    }),
    /FASHION_MEDIA_UPLOAD_INVALID/
  );
  await assert.rejects(
    putPrivateFashionMedia(async () => assert.fail('invalid file signature must not reach storage'), {
      Bucket: bucket,
      Key: key,
      Body: Buffer.from('not-a-jpeg'),
      ContentType: 'image/jpeg',
      CacheControl: 'private'
    }),
    /FASHION_MEDIA_UPLOAD_INVALID/
  );
  await assert.rejects(
    putPrivateFashionMedia(async () => { throw new Error('storage offline'); }, {
      Bucket: bucket,
      Key: key,
      Body: Buffer.from([0xff, 0xd8, 0xff]),
      ContentType: 'image/jpeg',
      CacheControl: 'private'
    }),
    /storage offline/
  );
});

test('signs private reads only for approved public posts or authenticated admin access', async () => {
  const readRequests: Array<FashionMediaCommandInput & { expiresIn: number }> = [];
  const sign = async (input: FashionMediaCommandInput & { expiresIn: number }) => {
    readRequests.push(input);
    return 'https://signed.example.test/media?expires=300';
  };
  await assert.rejects(
    getPrivateFashionMediaUrl(sign, {
      Bucket: bucket,
      Key: key,
      expectedBucket: bucket,
      publicationStatus: 'pending',
      adminAccess: false
    }),
    /FASHION_MEDIA_NOT_FOUND/
  );
  assert.equal(readRequests.length, 0);

  const publicUrl = await getPrivateFashionMediaUrl(sign, {
    Bucket: bucket,
    Key: key,
    expectedBucket: bucket,
    publicationStatus: 'approved',
    adminAccess: false
  });
  assert.equal(publicUrl, 'https://signed.example.test/media?expires=300');
  assert.equal(readRequests[0].expiresIn, 300);

  const adminUrl = await getPrivateFashionMediaUrl(sign, {
    Bucket: bucket,
    Key: key,
    expectedBucket: bucket,
    publicationStatus: 'pending',
    adminAccess: true,
    expiresIn: 120
  });
  assert.equal(adminUrl, 'https://signed.example.test/media?expires=300');
  assert.equal(readRequests[1].expiresIn, 120);
});

test('rejects wrong bucket, public object keys, and excessive signed URL lifetime', async () => {
  const sign = async () => 'should-not-sign';
  await assert.rejects(
    getPrivateFashionMediaUrl(sign, {
      Bucket: 'other-bucket',
      Key: key,
      expectedBucket: bucket,
      publicationStatus: 'approved',
      adminAccess: false
    }),
    /FASHION_MEDIA_NOT_FOUND/
  );
  await assert.rejects(
    getPrivateFashionMediaUrl(sign, {
      Bucket: bucket,
      Key: 'fashion/community/public/old.jpg',
      expectedBucket: bucket,
      publicationStatus: 'approved',
      adminAccess: false
    }),
    /FASHION_MEDIA_NOT_FOUND/
  );
  await assert.rejects(
    getPrivateFashionMediaUrl(sign, {
      Bucket: bucket,
      Key: key,
      expectedBucket: bucket,
      publicationStatus: 'approved',
      adminAccess: false,
      expiresIn: 301
    }),
    /FASHION_MEDIA_EXPIRY_INVALID/
  );
  await assert.rejects(
    getPrivateFashionMediaUrl(sign, {
      Bucket: bucket,
      Key: key,
      expectedBucket: bucket,
      publicationStatus: 'approved',
      adminAccess: false,
      contentType: 'text/html'
    }),
    /FASHION_MEDIA_NOT_FOUND/
  );
});

test('deletes only private fashion objects and surfaces delete failures', async () => {
  let deleted: FashionMediaCommandInput | undefined;
  await deletePrivateFashionMedia(async input => {
    deleted = input;
  }, { Bucket: bucket, Key: key });
  assert.deepEqual(deleted, { Bucket: bucket, Key: key });

  await assert.rejects(
    deletePrivateFashionMedia(async () => assert.fail('invalid delete must not reach storage'), {
      Bucket: bucket,
      Key: 'fashion/community/other-object.jpg'
    }),
    /FASHION_MEDIA_DELETE_INVALID/
  );
  await assert.rejects(
    deletePrivateFashionMedia(async () => { throw new Error('delete denied'); }, {
      Bucket: bucket,
      Key: key
    }),
    /delete denied/
  );
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveR2Environment } from '../src/server/r2Environment';

const accountId = '5c30b9d637c252b8faf821fddfa4be04';

test('derives the account endpoint and normalizes an endpoint containing the bucket path', () => {
  const derived = resolveR2Environment({ R2_ACCOUNT_ID: accountId, R2_BUCKET_NAME: 'ruda888' });
  const pathEndpoint = resolveR2Environment({
    R2_ENDPOINT: `https://${accountId}.r2.cloudflarestorage.com/ruda888`,
    R2_BUCKET_NAME: 'ruda888'
  });

  assert.equal(derived.endpoint, `https://${accountId}.r2.cloudflarestorage.com`);
  assert.equal(pathEndpoint.endpoint, derived.endpoint);
  assert.equal(derived.region, 'auto');
  assert.equal(derived.forcePathStyle, false);
});

test('uses configured public and private buckets without exposing credentials in derived URLs', () => {
  const config = resolveR2Environment({
    R2_ENDPOINT: `https://${accountId}.r2.cloudflarestorage.com`,
    R2_BUCKET_NAME: 'ruda888',
    R2_PRIVATE_BUCKET_NAME: 'ruda-private',
    R2_ACCESS_KEY_ID: 'test-access-key',
    R2_SECRET_ACCESS_KEY: 'test-secret-key',
    R2_PUBLIC_URL: 'https://images.ruda.fashion///'
  });

  assert.equal(config.bucket, 'ruda888');
  assert.equal(config.privateBucket, 'ruda-private');
  assert.equal(config.publicBaseUrl, 'https://images.ruda.fashion');
  assert.equal(config.active, true);
  assert.equal(config.endpoint.includes('test-secret-key'), false);
});

test('does not treat invalid or bucket-scoped endpoint URLs as valid R2 endpoints', () => {
  assert.equal(resolveR2Environment({ R2_ENDPOINT: 'http://r2.example.test' }).endpoint, '');
  assert.equal(resolveR2Environment({
    R2_ENDPOINT: `https://${accountId}.r2.cloudflarestorage.com/another-bucket`,
    R2_BUCKET_NAME: 'ruda888'
  }).endpoint, '');
  assert.equal(resolveR2Environment({ R2_ACCOUNT_ID: 'not-an-account-id' }).endpoint, '');
});

test('leaves legacy S3 selection to the caller when no R2 values are set', () => {
  assert.equal(resolveR2Environment({ OBJECT_STORAGE_BUCKET: 'legacy-media' }).active, false);
});

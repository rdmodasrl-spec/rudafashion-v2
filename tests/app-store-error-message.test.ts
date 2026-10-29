import assert from 'node:assert/strict';
import test from 'node:test';
import { describeAppStoreError } from '../src/apps/platform-admin-common/appStoreErrors';
import { ApiError } from '../src/api/client';

const FALLBACK = '应用数据读取失败';

test('service error envelopes never render as [object Object]', () => {
  const envelope = { success: false, error: { code: 'APP_STORE_INPUT_INVALID', message: '应用信息不完整' }, requestId: 'req_1' };
  const message = describeAppStoreError(envelope, FALLBACK);
  assert.equal(message, '应用信息不完整');
  assert.doesNotMatch(message, /\[object Object\]/);
});

test('ApiError with a known code maps to Chinese copy', () => {
  const error = new ApiError('应用标识已存在', 409, 'APP_STORE_SLUG_DUPLICATE');
  assert.equal(describeAppStoreError(error, FALLBACK), '应用标识已存在，请更换 appId 或 slug。');
});

test('ApiError without a known code falls back to its own message then to the fallback copy', () => {
  const withMessage = new ApiError('App record not found', 404, 'APP_STORE_APP_NOT_FOUND');
  assert.equal(describeAppStoreError(withMessage, FALLBACK), 'App record not found');
  const opaque = new ApiError('[object Object]', 500);
  assert.equal(describeAppStoreError(opaque, FALLBACK), FALLBACK);
});

test('plain values degrade safely instead of leaking [object Object]', () => {
  assert.equal(describeAppStoreError('网络不可用', FALLBACK), '网络不可用');
  assert.equal(describeAppStoreError(new Error('[object Object]'), FALLBACK), FALLBACK);
  assert.equal(describeAppStoreError(new Error('请求超时'), FALLBACK), '请求超时');
  assert.equal(describeAppStoreError(null, FALLBACK), FALLBACK);
  assert.equal(describeAppStoreError(undefined, FALLBACK), FALLBACK);
  assert.equal(describeAppStoreError({ status: 500 }, FALLBACK), FALLBACK);
  assert.equal(describeAppStoreError(42, FALLBACK), FALLBACK);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '../src/api/client';
import { describeGrowthError } from '../src/apps/platform-admin-common/components/admin/growthAdminErrors';

test('IP allowlist failures show the observed client IP and the real environment variable', () => {
  const error = new ApiError('Admin IP is not allowed', 403, 'ADMIN_IP_NOT_ALLOWED', undefined, false, undefined, {
    clientIp: '2001:db8:1::7',
    allowlistConfigured: true,
    allowPrivateAdminIps: false
  });
  const message = describeGrowthError(error);
  assert.match(message, /2001:db8:1::7/);
  assert.match(message, /ADMIN_IP_WHITELIST/);
  assert.doesNotMatch(message, /ADMIN_IP_ALLOWLIST/);
  assert.match(message, /ADMIN_IP_NOT_ALLOWED/);
});

test('allowlist failures without an observed IP still explain the remediation', () => {
  const error = new ApiError('Admin IP is not allowed', 403, 'ADMIN_IP_NOT_ALLOWED');
  const message = describeGrowthError(error);
  assert.match(message, /ADMIN_IP_WHITELIST/);
  assert.doesNotMatch(message, /Admin IP is not allowed/);
});

test('unconfigured prospect search lists the required environment variables', () => {
  const error = new ApiError('GROWTH_PROSPECT_SEARCH_NOT_CONFIGURED', 503, 'GROWTH_PROSPECT_SEARCH_NOT_CONFIGURED', undefined, false, undefined, {
    required: ['PROSPECT_SEARCH_PROVIDER=serper', 'SERPER_API_KEY']
  });
  const message = describeGrowthError(error);
  assert.match(message, /未接通/);
  assert.match(message, /PROSPECT_SEARCH_PROVIDER=serper/);
  assert.match(message, /SERPER_API_KEY/);
});

test('non-allowlist API failures keep the server message without an IP remediation hint', () => {
  const error = new ApiError('GROWTH_OVERVIEW_FAILED', 500, 'GROWTH_OVERVIEW_FAILED');
  assert.equal(describeGrowthError(error), 'GROWTH_OVERVIEW_FAILED');
});

test('AI provider failures point to the AI employee settings instead of the raw code alone', () => {
  const error = new ApiError('GROWTH_COPY_AI_PROVIDER_FAILED', 502, 'GROWTH_COPY_AI_PROVIDER_FAILED');
  const message = describeGrowthError(error);
  assert.match(message, /AI 员工设置/);
  assert.match(message, /GROWTH_COPY_AI_PROVIDER_FAILED/);
});

test('unknown failures fall back to a readable message', () => {
  assert.equal(describeGrowthError(new Error('网络中断')), '网络中断');
  assert.equal(describeGrowthError('failed'), '请求失败，请稍后重试');
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const apiSource = readFileSync(new URL('../merchant-miniprogram/utils/api.js', import.meta.url), 'utf8');

function createApiHarness(errMsg: string) {
  const logs: Array<{ label: string; details: Record<string, string> }> = [];
  const module = { exports: {} as Record<string, (...args: any[]) => any> };
  const wx = {
    getStorageSync: () => null,
    request: (options: Record<string, any>) => options.fail({ errMsg })
  };

  runInNewContext(apiSource, {
    module,
    exports: module.exports,
    require: (specifier: string) => {
      if (specifier === './constants') {
        return { API_BASE_URL: 'https://ruda.fashion', AUTH_STORAGE_KEY: 'ruda_merchant_mini_auth' };
      }
      throw new Error(`Unexpected module: ${specifier}`);
    },
    wx,
    console: {
      error: (label: string, details: Record<string, string>) => logs.push({ label, details })
    }
  });

  return { api: module.exports, logs };
}

test('merchant API explains when the active mini-program domain allowlist is missing the API host', async () => {
  const { api, logs } = createApiHarness('request:fail url not in domain list');
  await assert.rejects(api.request('/api/auth/me/merchant'), (error: Error & { code?: string; status?: number }) => {
    assert.equal(error.code, 'REQUEST_DOMAIN_NOT_ALLOWED');
    assert.equal(error.status, 0);
    assert.match(error.message, /商家小程序 AppID/);
    return true;
  });
  assert.equal(logs[0].label, '[merchant-mini-program] wx.request failed');
  assert.equal(logs[0].details.errMsg, 'request:fail url not in domain list');
});

test('merchant API distinguishes TLS and timeout failures from domain allowlist errors', async () => {
  const tlsHarness = createApiHarness('request:fail ssl hand shake error');
  await assert.rejects(tlsHarness.api.request('/api/auth/me/merchant'), (error: { code?: string }) => {
    assert.equal(error.code, 'REQUEST_TLS_FAILED');
    return true;
  });

  const timeoutHarness = createApiHarness('request:fail timeout');
  await assert.rejects(timeoutHarness.api.request('/api/auth/me/merchant'), (error: { code?: string }) => {
    assert.equal(error.code, 'REQUEST_TIMEOUT');
    return true;
  });
});

test('merchant API includes the original WeChat failure reason for unclassified network errors', async () => {
  const { api } = createApiHarness('request:fail net::ERR_CONNECTION_CLOSED');
  await assert.rejects(api.request('/api/auth/me/merchant'), (error: Error & { code?: string }) => {
    assert.equal(error.code, 'NETWORK_ERROR');
    assert.match(error.message, /ERR_CONNECTION_CLOSED/);
    return true;
  });
});

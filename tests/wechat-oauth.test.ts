import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildWechatWebAuthorizationUrl,
  getWechatCallbackUrl,
  isValidWechatOAuthState
} from '../src/server/wechatOAuth';

test('WeChat OAuth state comparison requires a matching non-empty secret', () => {
  assert.equal(isValidWechatOAuthState('same-state', 'same-state'), true);
  assert.equal(isValidWechatOAuthState('same-state', 'different-state'), false);
  assert.equal(isValidWechatOAuthState('', ''), false);
  assert.equal(isValidWechatOAuthState(undefined, 'state'), false);
});

test('WeChat web authorization only builds HTTPS SNSAPI_BASE requests', () => {
  const url = new URL(buildWechatWebAuthorizationUrl(
    'wx-app-id',
    'https://ruda.fashion/api/auth/callback/wechat',
    'state-value'
  ));
  assert.equal(url.origin, 'https://open.weixin.qq.com');
  assert.equal(url.searchParams.get('appid'), 'wx-app-id');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://ruda.fashion/api/auth/callback/wechat');
  assert.equal(url.searchParams.get('scope'), 'snsapi_base');
  assert.equal(url.searchParams.get('state'), 'state-value');
  assert.throws(
    () => buildWechatWebAuthorizationUrl('wx-app-id', 'http://ruda.fashion/callback', 'state'),
    /WECHAT_OAUTH_CONFIGURATION_INVALID/
  );
});

test('WeChat callback is fixed to the configured HTTPS application origin', () => {
  assert.equal(getWechatCallbackUrl('https://ruda.fashion/ignored/path'), 'https://ruda.fashion/api/auth/callback/wechat');
  assert.throws(() => getWechatCallbackUrl('http://ruda.fashion'), /WECHAT_CALLBACK_URL_NOT_CONFIGURED/);
  assert.throws(() => getWechatCallbackUrl(undefined), /WECHAT_CALLBACK_URL_NOT_CONFIGURED/);
});

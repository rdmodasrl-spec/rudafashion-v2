import { timingSafeEqual } from 'node:crypto';

export function isValidWechatOAuthState(cookieState: unknown, queryState: unknown): boolean {
  if (
    typeof cookieState !== 'string' ||
    typeof queryState !== 'string' ||
    !cookieState ||
    !queryState
  ) {
    return false;
  }

  const cookieBytes = Buffer.from(cookieState);
  const queryBytes = Buffer.from(queryState);
  return cookieBytes.length === queryBytes.length && timingSafeEqual(cookieBytes, queryBytes);
}

export function buildWechatWebAuthorizationUrl(appId: string, redirectUri: string, state: string): string {
  const callback = new URL(redirectUri);
  if (callback.protocol !== 'https:' || !appId.trim() || !state.trim()) {
    throw new Error('WECHAT_OAUTH_CONFIGURATION_INVALID');
  }
  const params = new URLSearchParams({
    appid: appId.trim(),
    redirect_uri: callback.toString(),
    response_type: 'code',
    scope: 'snsapi_base',
    state
  });
  return `https://open.weixin.qq.com/connect/oauth2/authorize?${params.toString()}#wechat_redirect`;
}

export function getWechatCallbackUrl(appUrl: string | undefined): string {
  if (!appUrl) throw new Error('WECHAT_CALLBACK_URL_NOT_CONFIGURED');
  let baseUrl: URL;
  try {
    baseUrl = new URL(appUrl);
  } catch {
    throw new Error('WECHAT_CALLBACK_URL_NOT_CONFIGURED');
  }
  if (baseUrl.protocol !== 'https:' || baseUrl.username || baseUrl.password) {
    throw new Error('WECHAT_CALLBACK_URL_NOT_CONFIGURED');
  }
  return new URL('/api/auth/callback/wechat', baseUrl.origin).toString();
}

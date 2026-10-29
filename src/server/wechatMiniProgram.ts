export class WechatMiniProgramError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number
  ) {
    super(code);
    this.name = 'WechatMiniProgramError';
  }
}

interface ExchangeOptions {
  appId?: string;
  appSecret?: string;
  fetchImpl?: typeof fetch;
}

interface WechatSessionResponse {
  errcode?: number;
  openid?: string;
}

export async function exchangeWechatMiniProgramCode(
  code: string,
  options: ExchangeOptions = {}
): Promise<{ appId: string; openId: string }> {
  if (typeof code !== 'string' || !code.trim() || code.length > 1024) {
    throw new WechatMiniProgramError('WECHAT_CODE_REQUIRED', 400);
  }

  const appId = options.appId ?? process.env.WECHAT_MINIPROGRAM_APP_ID;
  const appSecret = options.appSecret ?? process.env.WECHAT_MINIPROGRAM_APP_SECRET;
  if (!appId?.trim() || !appSecret) {
    throw new WechatMiniProgramError('WECHAT_MINIPROGRAM_NOT_CONFIGURED', 503);
  }

  const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
  url.searchParams.set('appid', appId.trim());
  url.searchParams.set('secret', appSecret);
  url.searchParams.set('js_code', code);
  url.searchParams.set('grant_type', 'authorization_code');

  let response: Response;
  try {
    response = await (options.fetchImpl ?? fetch)(url, {
      method: 'GET',
      signal: AbortSignal.timeout(8000)
    });
  } catch {
    throw new WechatMiniProgramError('WECHAT_CODE_EXCHANGE_UNAVAILABLE', 502);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new WechatMiniProgramError('WECHAT_PROVIDER_RESPONSE_INVALID', 502);
  }

  if (!response.ok) {
    throw new WechatMiniProgramError(
      response.status >= 500 ? 'WECHAT_CODE_EXCHANGE_UNAVAILABLE' : 'WECHAT_CODE_EXCHANGE_FAILED',
      response.status >= 500 ? 502 : 401
    );
  }
  if (!payload || typeof payload !== 'object') {
    throw new WechatMiniProgramError('WECHAT_CODE_EXCHANGE_FAILED', 401);
  }

  const session = payload as WechatSessionResponse;
  if (session.errcode !== undefined) {
    throw new WechatMiniProgramError('WECHAT_CODE_EXCHANGE_FAILED', 401);
  }
  if (typeof session.openid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(session.openid)) {
    throw new WechatMiniProgramError('WECHAT_PROVIDER_RESPONSE_INVALID', 502);
  }

  return { appId: appId.trim(), openId: session.openid };
}

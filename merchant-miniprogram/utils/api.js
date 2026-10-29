const { API_BASE_URL, AUTH_STORAGE_KEY, INDUSTRY_STORAGE_KEY } = require('./constants');

// 终端标识：服务端用它区分商家小程序与 Web/App，仅用于平台功能开关门禁，不作为身份依据。
const MINIPROGRAM_CLIENT_HEADER = 'X-Ruda-Client';
const MINIPROGRAM_CLIENT_VALUE = 'merchant-miniprogram';

class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function getRuntimeInfo() {
  try {
    const info = typeof wx !== 'undefined' && typeof wx.getAccountInfoSync === 'function'
      ? wx.getAccountInfoSync()
      : null;
    const miniProgram = info && info.miniProgram ? info.miniProgram : {};
    return {
      appId: typeof miniProgram.appId === 'string' ? miniProgram.appId : '',
      envVersion: typeof miniProgram.envVersion === 'string' ? miniProgram.envVersion : ''
    };
  } catch (error) {
    return { appId: '', envVersion: '' };
  }
}

function getRequestFailure(error) {
  const errMsg = error && typeof error.errMsg === 'string' ? error.errMsg : '';
  const normalized = errMsg.toLowerCase();
  if (/url not in domain list|domain list|合法域名/.test(normalized)) {
    const appId = getRuntimeInfo().appId;
    return {
      message: `请求域名未加载到当前小程序白名单。请核对商家小程序 AppID${appId ? `（当前：${appId}）` : ''}，并在开发者工具“详情-域名信息”刷新配置。`,
      code: 'REQUEST_DOMAIN_NOT_ALLOWED'
    };
  }
  if (/ssl|tls|certificate|cert verify/.test(normalized)) {
    return {
      message: 'HTTPS 证书校验失败，请检查请求域名和服务器证书。',
      code: 'REQUEST_TLS_FAILED'
    };
  }
  if (/timeout/.test(normalized)) {
    return {
      message: '网络请求超时，请检查网络后重试。',
      code: 'REQUEST_TIMEOUT'
    };
  }
  return {
    message: errMsg
      ? `网络连接失败（${errMsg}），请检查网络后重试。`
      : '网络连接失败，请检查网络后重试。',
    code: 'NETWORK_ERROR'
  };
}

function request(path, options = {}) {
  const method = options.method || 'GET';
  const headers = { Accept: 'application/json' };
  headers[MINIPROGRAM_CLIENT_HEADER] = MINIPROGRAM_CLIENT_VALUE;
  if (options.data !== undefined) headers['Content-Type'] = 'application/json';
  Object.assign(headers, options.headers || {});
  if (options.auth !== false) {
    const session = wx.getStorageSync(AUTH_STORAGE_KEY);
    if (session && session.token) headers.Authorization = `Bearer ${session.token}`;
  }
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE_URL}${path}`,
      method,
      data: options.data,
      header: headers,
      timeout: options.timeout || 20000,
      success(response) {
        const payload = response.data;
        if (response.statusCode < 200 || response.statusCode >= 300
          || (payload && payload.success === false)) {
          const errorBody = payload && payload.error;
          const code = errorBody && typeof errorBody === 'object'
            ? errorBody.code
            : typeof errorBody === 'string' ? errorBody : `REQUEST_FAILED_${response.statusCode}`;
          const message = errorBody && typeof errorBody === 'object'
            ? errorBody.message || code || `REQUEST_FAILED_${response.statusCode}`
            : typeof errorBody === 'string' ? errorBody : code;
          if (response.statusCode === 401 && options.auth !== false) {
            wx.removeStorageSync(AUTH_STORAGE_KEY);
            // 会话失效必须同时丢弃行业上下文，避免退出后复用上一个商家的行业配置。
            wx.removeStorageSync(INDUSTRY_STORAGE_KEY);
          }
          reject(new ApiError(message, response.statusCode, code));
          return;
        }
        if (payload === undefined || payload === null) {
          reject(new ApiError('INVALID_API_RESPONSE', response.statusCode, 'INVALID_API_RESPONSE'));
          return;
        }
        resolve(payload);
      },
      fail(error) {
        const failure = getRequestFailure(error);
        const runtime = getRuntimeInfo();
        console.error('[merchant-mini-program] wx.request failed', {
          path,
          url: `${API_BASE_URL}${path}`,
          appId: runtime.appId || 'unknown',
          envVersion: runtime.envVersion || 'unknown',
          errMsg: error && typeof error.errMsg === 'string' ? error.errMsg : 'unknown'
        });
        reject(new ApiError(failure.message, 0, failure.code));
      }
    });
  });
}

function queryString(parameters) {
  return Object.keys(parameters)
    .filter(key => parameters[key] !== undefined && parameters[key] !== null)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(parameters[key])}`)
    .join('&');
}

function getAssetUrl(path) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

module.exports = {
  ApiError,
  request,
  queryString,
  getAssetUrl
};

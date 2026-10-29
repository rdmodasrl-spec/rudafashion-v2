const { request } = require('./api');
const { AUTH_STORAGE_KEY } = require('./constants');

// 平台功能开关（总后台「平台管理 → 功能开关」控制）。
// 权威来源是服务端接口，本地只保存只读副本用于渲染；读取失败一律按关闭处理。
const FEATURE_FLAGS_STORAGE_KEY = 'ruda_merchant_feature_flags';
const MODAUI_FLAG_KEY = 'merchant_miniprogram_modaui_enabled';
const MODAUI_FLAG_DEFAULT = false;
// 全局总闸：关闭时任何终端都不能使用 ModaUI（默认开启，缺失时不误停）。
const GLOBAL_MODAUI_FLAG_KEY = 'modaui_enabled';
const REFRESH_THROTTLE_MS = 3000;

let inflight = null;
let lastAttemptAt = 0;

function readCache() {
  if (typeof wx === 'undefined') return null;
  try {
    const cached = wx.getStorageSync(FEATURE_FLAGS_STORAGE_KEY);
    if (!cached || typeof cached !== 'object') return null;
    const flags = cached.flags && typeof cached.flags === 'object' ? cached.flags : {};
    const fetchedAt = typeof cached.fetchedAt === 'number' ? cached.fetchedAt : 0;
    return { flags, fetchedAt };
  } catch (error) {
    return null;
  }
}

function getFlag(key) {
  const cached = readCache();
  if (cached && typeof cached.flags[key] === 'boolean') return cached.flags[key];
  return key === MODAUI_FLAG_KEY ? MODAUI_FLAG_DEFAULT : false;
}

function isModauiEnabled() {
  if (!getFlag(MODAUI_FLAG_KEY)) return false;
  const cached = readCache();
  if (cached && typeof cached.flags[GLOBAL_MODAUI_FLAG_KEY] === 'boolean') {
    return cached.flags[GLOBAL_MODAUI_FLAG_KEY];
  }
  return true;
}

function readSessionToken() {
  if (typeof wx === 'undefined') return '';
  try {
    const session = wx.getStorageSync(AUTH_STORAGE_KEY);
    return session && typeof session.token === 'string' ? session.token : '';
  } catch (error) {
    return '';
  }
}

function refreshFeatureFlags(options = {}) {
  const force = options.force === true;
  if (inflight) return inflight;
  // 该接口要求商家令牌：未登录时调用必然 401，还会触发 api.js 的 401 清理逻辑。
  // 冷启动本来就在登录页，直接返回本地副本，登录成功后再强制刷新一次。
  if (!readSessionToken()) {
    const stored = readCache();
    return Promise.resolve(stored ? stored.flags : {});
  }
  if (!force && Date.now() - lastAttemptAt < REFRESH_THROTTLE_MS && readCache()) {
    return Promise.resolve(readCache().flags);
  }
  lastAttemptAt = Date.now();
  inflight = request('/api/merchant/feature-flags')
    .then(response => {
      const flags = response && response.flags && typeof response.flags === 'object' ? response.flags : {};
      if (typeof wx !== 'undefined') {
        try {
          wx.setStorageSync(FEATURE_FLAGS_STORAGE_KEY, { flags, fetchedAt: Date.now() });
        } catch (error) {
          // 本地缓存失败不影响服务端判断。
        }
      }
      return flags;
    })
    .catch(() => {
      const cached = readCache();
      return cached ? cached.flags : {};
    })
    .then(flags => {
      inflight = null;
      return flags;
    });
  return inflight;
}

function clearFeatureFlagCache() {
  if (typeof wx === 'undefined') return;
  try {
    wx.removeStorageSync(FEATURE_FLAGS_STORAGE_KEY);
  } catch (error) {
    // 忽略本地存储异常。
  }
}

module.exports = {
  FEATURE_FLAGS_STORAGE_KEY,
  MODAUI_FLAG_KEY,
  MODAUI_FLAG_DEFAULT,
  getFlag,
  isModauiEnabled,
  refreshFeatureFlags,
  clearFeatureFlagCache
};

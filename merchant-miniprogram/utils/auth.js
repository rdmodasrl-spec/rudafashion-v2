const { AUTH_STORAGE_KEY } = require('./constants');
const { request } = require('./api');

function getSession() {
  const session = wx.getStorageSync(AUTH_STORAGE_KEY);
  if (!session || !['merchant', 'employee'].includes(session.role)
    || typeof session.token !== 'string' || !session.token) return null;
  if (typeof session.expiresAt === 'number' && session.expiresAt <= Date.now()) {
    clearSession();
    return null;
  }
  return session;
}

function saveSession(role, response) {
  if (!['merchant', 'employee'].includes(role) || !response || typeof response.token !== 'string' || !response.token) {
    throw new Error('登录服务返回了无效的账号信息。');
  }
  const session = {
    role,
    token: response.token,
    expiresAt: Date.now() + Number(response.expiresIn || 0) * 1000,
    profile: response[role] || null,
    merchant: response.merchant || (role === 'merchant' ? response.merchant : null)
  };
  wx.setStorageSync(AUTH_STORAGE_KEY, session);
  return session;
}

function clearSession() {
  wx.removeStorageSync(AUTH_STORAGE_KEY);
}

function setWorkMode(workMode) {
  const session = getSession();
  if (!session || session.role !== 'merchant') return false;
  wx.setStorageSync(AUTH_STORAGE_KEY, Object.assign({}, session, {
    workMode: workMode === 'employee' ? 'employee' : 'management'
  }));
  return true;
}

async function verifySession() {
  const session = getSession();
  if (!session) return null;
  try {
    const response = await request(`/api/auth/me/${session.role}`);
    if (response.success) {
      const updatedSession = Object.assign({}, session, {
        profile: response[session.role] || session.profile,
        merchant: response.merchant || session.merchant
      });
      wx.setStorageSync(AUTH_STORAGE_KEY, updatedSession);
      return { session: updatedSession, response };
    }
    clearSession();
    return null;
  } catch (error) {
    if (error.status === 401 || (error.status === 200 && error.code === 'REQUEST_FAILED_200')) {
      clearSession();
      return null;
    }
    const cachedResponse = session.role === 'employee'
      ? { employee: session.profile, merchant: session.merchant }
      : { merchant: session.merchant || session.profile };
    return {
      session,
      response: cachedResponse
    };
  }
}

module.exports = {
  getSession,
  saveSession,
  clearSession,
  setWorkMode,
  verifySession
};

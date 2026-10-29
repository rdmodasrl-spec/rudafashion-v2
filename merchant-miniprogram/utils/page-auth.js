const { verifySession } = require('./auth');

async function requireMerchantSession(page) {
  const auth = await verifySession();
  if (auth) return auth;
  if (!page._loginOpened) {
    page._loginOpened = true;
    wx.navigateTo({ url: '/pages/login/index' });
  }
  return null;
}

module.exports = { requireMerchantSession };

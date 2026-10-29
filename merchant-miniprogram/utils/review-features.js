const { isModauiEnabled } = require('./feature-flags');

// ModaUI 版块在小程序内的可见性由平台功能开关 merchant_miniprogram_modaui_enabled 决定。
const aiWorkspaceIds = new Set(['ai_home', 'tryon', 'ai_employees']);

function isWorkspaceEnabled(id) {
  if (!aiWorkspaceIds.has(id)) return true;
  return isModauiEnabled();
}

module.exports = { isWorkspaceEnabled, isModauiEnabled };

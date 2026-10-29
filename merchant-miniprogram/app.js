const { refreshFeatureFlags } = require('./utils/feature-flags');

App({
  onLaunch() {
    // 平台功能开关：启动时拉取一次，页面 onShow 会再校验；失败按关闭处理。
    refreshFeatureFlags().catch(() => {});
  }
});

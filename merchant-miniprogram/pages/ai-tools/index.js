const { request } = require('../../utils/api');
const { requireMerchantSession } = require('../../utils/page-auth');

/**
 * MODAUI AI Tools 商家小程序工具中心。
 * 与电脑端、手机网页端使用同一个权威接口 `/api/merchant/ai-tools`：
 * 工具可用性、试用期与额度全部来自服务端，前端不自行判断，也不缓存为业务事实。
 */
const languageOptions = [
  { id: 'it', label: '意大利语' },
  { id: 'en', label: '英语' },
  { id: 'zh', label: '简体中文' }
];
const channelOptions = [
  { id: 'product', label: '商品详情' },
  { id: 'social', label: '社媒' },
  { id: 'email', label: '邮件' }
];
const toneOptions = [
  { id: 'premium', label: '高端' },
  { id: 'neutral', label: '中性' },
  { id: 'bold', label: '强对比' }
];

const blockedReasonLabels = {
  app_disabled: '应用已停用',
  app_not_installed: '应用未安装',
  manifest_disabled: '工具清单已关闭',
  tool_not_declared: '工具未声明',
  tool_disabled: '工具已停用',
  tool_deprecated: '工具已下线',
  grant_missing: '无授权',
  grant_paused: '授权已暂停',
  grant_expired: '试用已结束',
  grant_revoked: '授权已撤销',
  permission_denied: '当前账号无权限',
  credential_missing: '缺少凭据',
  industry_mismatch: '行业不匹配',
  employee_mismatch: '员工不匹配'
};

const centerReasonLabels = {
  provider_not_configured: '模型服务未配置',
  adapter_not_built: '接口尚未接通',
  missing_credentials: '缺少平台授权凭据'
};

function remainingDays(expiresAt) {
  if (!expiresAt) return null;
  const diff = Date.parse(expiresAt) - Date.now();
  if (!Number.isFinite(diff)) return null;
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

function formatResult(payload) {
  if (!payload || typeof payload !== 'object') return '';
  if (typeof payload.translation === 'string') return payload.translation;
  const lines = [];
  if (typeof payload.headline === 'string' && payload.headline.trim()) lines.push(payload.headline.trim());
  if (typeof payload.body === 'string' && payload.body.trim()) lines.push(payload.body.trim());
  if (Array.isArray(payload.hashtags) && payload.hashtags.length) {
    lines.push(payload.hashtags.filter(tag => typeof tag === 'string').map(tag => `#${tag.replace(/^#/, '')}`).join(' '));
  }
  return lines.join('\n\n') || JSON.stringify(payload, null, 2);
}


Page({
  data: {
    loading: true,
    error: '',
    notice: '',
    manifestEnabled: true,
    planId: 'FREE',
    trialDays: null,
    billingEnabled: false,
    quota: null,
    capabilities: [],
    tools: [],
    blockedTools: [],
    activeTool: null,
    submitting: false,
    resultText: '',
    form: {
      brief: '',
      text: '',
      language: 'it',
      targetLanguage: 'it',
      channel: 'product',
      tone: 'premium'
    },
    languageOptions,
    channelOptions,
    toneOptions,
    labels: {
      channel: '商品详情',
      tone: '高端',
      language: '意大利语',
      targetLanguage: '意大利语'
    }
  },

  async onShow() {
    await requireMerchantSession();
    await this.load();
  },

  async load() {
    this.setData({ loading: true, error: '' });
    try {
      const response = await request('/api/merchant/ai-tools');
      const tools = Array.isArray(response.tools) ? response.tools : [];
      const capabilities = (Array.isArray(response.capabilities) ? response.capabilities : []).map(center => Object.assign({}, center, {
        reasonLabel: center.reason ? (centerReasonLabels[center.reason] || center.reason) : '',
        ready: center.status === 'ready'
      }));
      this.setData({
        loading: false,
        manifestEnabled: response.manifestEnabled !== false,
        planId: response.quota && response.quota.planId ? response.quota.planId : 'FREE',
        quota: response.quota || null,
        billingEnabled: Boolean(response.quota && response.quota.billingEnabled),
        trialDays: remainingDays(response.trialExpiresAt),
        capabilities,
        tools: tools.filter(tool => tool.availability === 'available').map(tool => Object.assign({}, tool, {
          title: (tool.displayName && tool.displayName.zh) || tool.toolId,
          expiresLabel: tool.grantExpiresAt ? new Date(tool.grantExpiresAt).toLocaleDateString('zh-CN') : ''
        })),
        blockedTools: tools.filter(tool => tool.availability !== 'available').map(tool => Object.assign({}, tool, {
          title: (tool.displayName && tool.displayName.zh) || tool.toolId,
          reasonLabel: blockedReasonLabels[tool.blockedReason] || tool.blockedReason || '不可用'
        }))
      });
      const activeId = this.data.activeTool && this.data.activeTool.toolId;
      if (activeId) {
        const stillAvailable = tools.find(tool => tool.toolId === activeId && tool.availability === 'available');
        if (!stillAvailable) this.setData({ activeTool: null });
      }
    } catch (error) {
      this.setData({ loading: false, error: (error && error.message) || '工具清单加载失败。' });
    }
  },

  openTool(event) {
    const toolId = event.currentTarget.dataset.id;
    const tool = this.data.tools.find(item => item.toolId === toolId);
    if (!tool) return;
    this.setData({ activeTool: tool, resultText: '', notice: '' });
  },

  closeTool() {
    this.setData({ activeTool: null, resultText: '' });
  },

  async toggleGrant(event) {
    const toolId = event.currentTarget.dataset.id;
    const tool = this.data.tools.find(item => item.toolId === toolId);
    if (!tool) return;
    const nextStatus = tool.grantStatus === 'paused' ? 'active' : 'paused';
    try {
      await request(`/api/merchant/ai-tools/${encodeURIComponent(toolId)}/grant`, {
        method: 'PATCH',
        data: { status: nextStatus }
      });
      wx.showToast({ title: nextStatus === 'paused' ? '已暂停' : '已恢复', icon: 'none' });
      await this.load();
    } catch (error) {
      wx.showToast({ title: (error && error.message) || '操作失败', icon: 'none' });
    }
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field;
    if (!field) return;
    this.setFormValue(field, event.detail.value);
  },

  // 小程序打包不允许计算属性名，这里用显式字符串键拼 patch。
  setFormValue(field, value, label) {
    const patch = {};
    patch['form.' + field] = value;
    if (label) patch['labels.' + field] = label;
    this.setData(patch);
  },

  onPickOption(event) {
    const field = event.currentTarget.dataset.field;
    const index = Number(event.detail.value);
    const options = field === 'language' || field === 'targetLanguage'
      ? languageOptions
      : field === 'channel' ? channelOptions : toneOptions;
    const picked = options[index];
    if (!field || !picked) return;
    this.setFormValue(field, picked.id, picked.label);
  },

  async invoke() {
    const tool = this.data.activeTool;
    if (!tool || this.data.submitting) return;
    const form = this.data.form;
    const isTranslate = tool.toolId === 'ai_tools_translate';
    const input = isTranslate
      ? { text: String(form.text || '').trim(), targetLanguage: form.targetLanguage }
      : { brief: String(form.brief || '').trim(), language: form.language, channel: form.channel, tone: form.tone };
    if (isTranslate ? !input.text : !input.brief) {
      wx.showToast({ title: '请先填写内容', icon: 'none' });
      return;
    }
    this.setData({ submitting: true, notice: '', resultText: '' });
    try {
      const response = await request(`/api/merchant/ai-tools/${encodeURIComponent(tool.toolId)}/invoke`, {
        method: 'POST',
        data: { input },
        timeout: 45000
      });
      this.setData({ submitting: false, resultText: formatResult(response.result) });
      await this.load();
    } catch (error) {
      const code = error && error.code;
      const message = code === 'AI_TOOL_QUOTA_EXCEEDED'
        ? '调用额度已用完，请下个周期再试或升级套餐。'
        : (error && error.message) || '调用失败，请稍后重试。';
      this.setData({ submitting: false, notice: message });
    }
  },

  copyResult() {
    if (!this.data.resultText) return;
    wx.setClipboardData({ data: this.data.resultText });
  }
});

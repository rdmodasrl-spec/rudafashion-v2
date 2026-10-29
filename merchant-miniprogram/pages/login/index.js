const { request } = require('../../utils/api');
const { saveSession } = require('../../utils/auth');
const { clearIndustryContext } = require('../../utils/industry');
const { refreshFeatureFlags } = require('../../utils/feature-flags');

Page({
  data: {
    account: '',
    password: '',
    acceptedTerms: false,
    acceptedPrivacy: false,
    showPassword: false,
    resetMode: false,
    resetCodeSent: false,
    resetEmail: '',
    resetCode: '',
    resetPassword: '',
    showResetPassword: false,
    accountType: '',
    merchantChoices: [],
    demoCredentials: null,
    demoError: '',
    loading: false,
    error: ''
  },

  onLoad() {
    void this.loadDemoCredentials();
  },

  async loadDemoCredentials() {
    try {
      const response = await request('/api/miniprogram/auth/demo-credentials', { auth: false });
      if (!response.enabled) return;
      if (!Array.isArray(response.accounts)
        || typeof response.password !== 'string'
        || typeof response.partnerUrl !== 'string'
        || response.accounts.some(item => (
          !item || typeof item.email !== 'string' || typeof item.label !== 'string'
            || !['merchant', 'employee', 'partner'].includes(item.type)
        ))) {
        throw new Error('演示账号信息格式无效。');
      }
      this.setData({
        demoCredentials: {
          accounts: response.accounts,
          password: response.password,
          partnerUrl: response.partnerUrl
        },
        demoError: ''
      });
    } catch (error) {
      this.setData({ demoError: error.message || '演示账号暂时无法加载。' });
    }
  },

  useDemoCredentials(event) {
    const credentials = this.data.demoCredentials;
    const email = event.currentTarget.dataset.email;
    if (!credentials || !email) return;
    this.setData({
      account: email,
      password: credentials.password,
      accountType: '',
      merchantChoices: [],
      error: ''
    });
  },

  openPartnerDemo() {
    if (!this.data.demoCredentials) return;
    wx.navigateTo({ url: '/pages/enterprise-register/index?portal=partner' });
  },

  onAccountInput(event) {
    this.setData({ account: event.detail.value, merchantChoices: [], accountType: '', error: '' });
  },

  onPasswordInput(event) {
    this.setData({ password: event.detail.value, error: '' });
  },

  onLegalConsentChange(event) {
    const values = event.detail.value || [];
    this.setData({
      acceptedTerms: values.includes('terms'),
      acceptedPrivacy: values.includes('privacy'),
      error: ''
    });
  },

  openLegalDocument(event) {
    const document = event.currentTarget.dataset.document;
    const route = document === 'terms'
      ? '/pages/service-agreement/index'
      : document === 'privacy' ? '/pages/privacy/index' : '';
    if (route) wx.navigateTo({ url: route });
  },

  togglePasswordVisibility(event) {
    const field = event.currentTarget.dataset.field;
    if (field === 'showPassword' || field === 'showResetPassword') {
      // Mini program tooling rejects computed object keys, so the flag is assigned explicitly.
      const update = {};
      update[field] = !this.data[field];
      this.setData(update);
    }
  },

  onResetInput(event) {
    const field = event.currentTarget.dataset.field;
    if (['resetEmail', 'resetCode', 'resetPassword'].includes(field)) {
      const update = { error: '' };
      update[field] = event.detail.value;
      this.setData(update);
    }
  },

  openForgotPassword() {
    this.setData({
      resetMode: true,
      resetEmail: this.data.account.includes('@') ? this.data.account.trim() : '',
      resetCodeSent: false,
      resetCode: '',
      resetPassword: '',
      showResetPassword: false,
      error: ''
    });
  },

  closeForgotPassword() {
    this.setData({
      resetMode: false,
      resetCodeSent: false,
      resetCode: '',
      resetPassword: '',
      showResetPassword: false,
      error: ''
    });
  },

  async requestPasswordResetCode() {
    if (this.data.loading) return;
    if (!this.data.acceptedTerms || !this.data.acceptedPrivacy) {
      this.setData({ error: '请先阅读并同意用户服务协议和隐私政策。' });
      return;
    }
    const email = this.data.resetEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.setData({ error: '请输入注册商家账号时使用的有效邮箱。' });
      return;
    }
    this.setData({ loading: true, error: '' });
    try {
      await request('/api/auth/login/merchant/password-reset/request', {
        method: 'POST',
        auth: false,
        data: { email }
      });
      this.setData({
        resetEmail: email,
        resetCodeSent: true,
        error: ''
      });
      wx.showToast({ title: '如账号存在，验证码已发送', icon: 'none' });
    } catch (error) {
      const messages = {
        EMAIL_VERIFICATION_NOT_CONFIGURED: '邮箱验证码服务暂未配置，请联系 RUDA 客服。',
        EMAIL_DELIVERY_FAILED: '验证码邮件发送失败，请稍后重试。',
        VERIFICATION_CODE_COOLDOWN: '请求过于频繁，请稍后再试。'
      };
      this.setData({ error: messages[error.code] || error.message || '验证码发送失败，请稍后重试。' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async submitPasswordReset() {
    if (this.data.loading) return;
    if (!this.data.acceptedTerms || !this.data.acceptedPrivacy) {
      this.setData({ error: '请先阅读并同意用户服务协议和隐私政策。' });
      return;
    }
    const email = this.data.resetEmail.trim().toLowerCase();
    const code = this.data.resetCode.trim();
    const password = this.data.resetPassword;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(code)) {
      this.setData({ error: '请输入有效邮箱和邮件中的 6 位验证码。' });
      return;
    }
    if (password.length < 8) {
      this.setData({ error: '新密码至少需要 8 位。' });
      return;
    }
    this.setData({ loading: true, error: '' });
    try {
      await request('/api/auth/login/merchant/password-reset/complete', {
        method: 'POST',
        auth: false,
        data: { email, code, password }
      });
      this.setData({
        account: email,
        password: '',
        resetMode: false,
        resetCodeSent: false,
        resetCode: '',
        resetPassword: '',
        showResetPassword: false,
        error: ''
      });
      wx.showToast({ title: '密码已重置，请登录', icon: 'success' });
    } catch (error) {
      const messages = {
        VERIFICATION_CODE_REQUIRED: '请输入邮件中的 6 位验证码。',
        PASSWORD_TOO_SHORT: '新密码至少需要 8 位。',
        INVALID_OR_EXPIRED_CODE: '验证码错误或已过期，请重新获取。'
      };
      this.setData({ error: messages[error.code] || error.message || '密码重置失败，请稍后重试。' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async submit(merchantId) {
    if (this.data.loading) return;
    if (!this.data.acceptedTerms || !this.data.acceptedPrivacy) {
      this.setData({ error: '请先阅读并同意用户服务协议和隐私政策。' });
      return;
    }
    const account = this.data.account.trim();
    if (!account || !this.data.password) {
      this.setData({ error: '请输入账号和密码。' });
      return;
    }
    this.setData({ loading: true, error: '' });
    try {
      const credentials = {
        account,
        password: this.data.password
      };
      if (merchantId) credentials.merchantId = merchantId;

      const response = await request('/api/miniprogram/auth/login', {
        method: 'POST',
        auth: false,
        data: credentials
      });
      if (response.requiresMerchantSelection) {
        this.setData({
          accountType: response.accountType || 'employee',
          merchantChoices: response.merchants || []
        });
        return;
      }
      const role = response.accountType || (response.employee ? 'employee' : 'merchant');
      if (!['merchant', 'employee'].includes(role)) throw new Error('登录服务返回了无效的账号类型。');
      saveSession(role, response);
      clearIndustryContext();
      // 登录后立刻按新令牌拉取平台功能开关，避免冷启动期的未登录 401 导致开关长期停留在默认关闭。
      refreshFeatureFlags({ force: true }).catch(() => {});
      wx.showToast({ title: '登录成功', icon: 'success' });
      // 登录后按服务端行业上下文进入对应行业工作台。
      wx.reLaunch({ url: '/pages/industry/index' });
    } catch (error) {
      const messages = {
        EMAIL_PASSWORD_REQUIRED: '请输入账号和密码。',
        MERCHANT_NOT_FOUND: '没有找到该商家账号。',
        EMPLOYEE_NOT_FOUND_OR_DISABLED: '员工账号不存在或已停用。',
        WRONG_PASSWORD: '密码不正确。',
        ACCOUNT_NOT_FOUND: '账号不存在或密码不正确。',
        MERCHANT_APPLICATION_REQUIRED: '该账号尚未关联已开通的商家。',
        MERCHANT_PENDING_REVIEW: '商家店铺尚未通过审核。',
        AUTH_RATE_LIMITED: '尝试次数过多，请稍后再试。'
      };
      this.setData({ error: messages[error.code] || error.message || '登录失败，请稍后重试。' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onSubmit() {
    return this.submit();
  },

  openEnterpriseRegistration() {
    wx.navigateTo({ url: '/pages/enterprise-register/index?portal=merchant-registration' });
  },

  selectMerchant(event) {
    const merchantId = event.currentTarget.dataset.id;
    if (merchantId) return this.submit(merchantId);
  }
});

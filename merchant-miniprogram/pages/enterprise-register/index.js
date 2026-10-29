const { request } = require('../../utils/api');
const { PUBLIC_SITE_URL } = require('../../utils/constants');
const PARTNER_URL = `${PUBLIC_SITE_URL}/partner`;

const roleOptions = [
  { id: 'PRODUCER', label: '生产商', selected: false },
  { id: 'WHOLESALER', label: '批发商', selected: false },
  { id: 'RETAILER', label: '零售商', selected: false }
];

const categoryOptions = [
  { id: 'WOMENSWEAR', label: '女装', selected: false },
  { id: 'MENSWEAR', label: '男装', selected: false },
  { id: 'KIDSWEAR', label: '童装', selected: false },
  { id: 'BABYWEAR', label: '婴童用品', selected: false },
  { id: 'CLOTHING', label: '服装', selected: false },
  { id: 'LINGERIE', label: '内衣家居服', selected: false },
  { id: 'SPORTSWEAR', label: '运动服', selected: false },
  { id: 'OUTERWEAR', label: '外套皮衣', selected: false },
  { id: 'DENIM', label: '牛仔', selected: false },
  { id: 'BAGS', label: '皮包', selected: false },
  { id: 'SHOES', label: '鞋类', selected: false },
  { id: 'JEWELRY', label: '珠宝首饰', selected: false },
  { id: 'WATCHES', label: '手表', selected: false },
  { id: 'ACCESSORIES', label: '时尚配饰', selected: false },
  { id: 'LEATHER_GOODS', label: '皮具', selected: false },
  { id: 'TEXTILES', label: '面料纺织', selected: false },
  { id: 'FABRICS_TRIMS', label: '辅料及饰品', selected: false },
  { id: 'BEAUTY_COSMETICS', label: '美妆护肤', selected: false },
  { id: 'PERFUME', label: '香水', selected: false },
  { id: 'HOME_LIFESTYLE', label: '家居生活', selected: false },
  { id: 'HOME_DECOR', label: '家居装饰', selected: false },
  { id: 'GIFT_STATIONERY', label: '礼品文具', selected: false },
  { id: 'LUGGAGE_TRAVEL', label: '箱包旅行', selected: false },
  { id: 'PET_PRODUCTS', label: '宠物用品', selected: false },
  { id: 'OTHER', label: '其他', selected: false }
];

const industryOptions = [
  { id: 'apparel_production_wholesale', label: '服装生产批发商' },
  { id: 'apparel_wholesale', label: '服装批发商' },
  { id: 'trading_wholesale', label: '贸易批发商' },
  { id: 'department_wholesale', label: '百货批发商' },
  { id: 'bags_wholesale', label: '箱包批发商' },
  { id: 'department_chain_retail', label: '百货连锁店' },
  { id: 'general_retail', label: '综合零售商' }
];

const countryOptions = [
  'Albania', 'Austria', 'Belgium', 'Bosnia and Herzegovina', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic',
  'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Iceland', 'Ireland', 'Italy',
  'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Moldova', 'Montenegro', 'North Macedonia', 'Netherlands',
  'Norway', 'Poland', 'Portugal', 'Romania', 'Serbia', 'Slovakia', 'Slovenia', 'Spain', 'Sweden',
  'Switzerland', 'Turkey', 'Ukraine', 'United Kingdom', 'China'
];

const cityOptionsByCountry = {
  Albania: ['Tirana', 'Durres', 'Vlore'],
  'Bosnia and Herzegovina': ['Sarajevo', 'Banja Luka', 'Mostar'],
  Austria: ['Vienna', 'Graz', 'Linz', 'Salzburg', 'Innsbruck'],
  Belgium: ['Brussels', 'Antwerp', 'Ghent', 'Bruges', 'Liege'],
  Bulgaria: ['Sofia', 'Plovdiv', 'Varna', 'Burgas'],
  Croatia: ['Zagreb', 'Split', 'Rijeka', 'Dubrovnik'],
  Cyprus: ['Nicosia', 'Limassol', 'Larnaca', 'Paphos'],
  'Czech Republic': ['Prague', 'Brno', 'Ostrava', 'Plzen'],
  Denmark: ['Copenhagen', 'Aarhus', 'Odense', 'Aalborg'],
  Estonia: ['Tallinn', 'Tartu', 'Parnu'],
  Finland: ['Helsinki', 'Espoo', 'Tampere', 'Turku'],
  France: ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice', 'Bordeaux', 'Lille'],
  Germany: ['Berlin', 'Hamburg', 'Munich', 'Cologne', 'Frankfurt', 'Dusseldorf', 'Stuttgart'],
  Greece: ['Athens', 'Thessaloniki', 'Patras', 'Heraklion'],
  Hungary: ['Budapest', 'Debrecen', 'Szeged', 'Pecs'],
  Iceland: ['Reykjavik', 'Kopavogur', 'Hafnarfjordur'],
  Ireland: ['Dublin', 'Cork', 'Galway', 'Limerick'],
  Italy: ['Milan', 'Prato', 'Rome', 'Florence', 'Turin', 'Bologna', 'Naples', 'Venice'],
  Latvia: ['Riga', 'Daugavpils', 'Liepaja'],
  Lithuania: ['Vilnius', 'Kaunas', 'Klaipeda'],
  Luxembourg: ['Luxembourg City', 'Esch-sur-Alzette', 'Differdange'],
  Malta: ['Valletta', 'Birkirkara', 'Mosta', 'Sliema'],
  Moldova: ['Chisinau', 'Balti', 'Tiraspol'],
  Montenegro: ['Podgorica', 'Budva', 'Kotor'],
  Netherlands: ['Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht', 'Eindhoven'],
  'North Macedonia': ['Skopje', 'Bitola', 'Ohrid'],
  Norway: ['Oslo', 'Bergen', 'Trondheim', 'Stavanger'],
  Poland: ['Warsaw', 'Krakow', 'Wroclaw', 'Poznan', 'Gdansk', 'Lodz'],
  Portugal: ['Lisbon', 'Porto', 'Braga', 'Coimbra', 'Faro'],
  Romania: ['Bucharest', 'Cluj-Napoca', 'Timisoara', 'Iasi', 'Constanta'],
  Serbia: ['Belgrade', 'Novi Sad', 'Nis'],
  Slovakia: ['Bratislava', 'Kosice', 'Presov'],
  Slovenia: ['Ljubljana', 'Maribor', 'Koper'],
  Spain: ['Madrid', 'Barcelona', 'Valencia', 'Seville', 'Malaga', 'Bilbao', 'Alicante'],
  Sweden: ['Stockholm', 'Gothenburg', 'Malmo', 'Uppsala'],
  Switzerland: ['Zurich', 'Geneva', 'Basel', 'Bern', 'Lausanne', 'Lugano'],
  Turkey: ['Istanbul', 'Ankara', 'Izmir', 'Bursa', 'Antalya'],
  Ukraine: ['Kyiv', 'Lviv', 'Odesa', 'Kharkiv', 'Dnipro'],
  'United Kingdom': ['London', 'Manchester', 'Birmingham', 'Liverpool', 'Leeds', 'Glasgow', 'Edinburgh'],
  China: ['Beijing', 'Shanghai', 'Guangzhou', 'Shenzhen', 'Hangzhou', 'Chengdu']
};

const citiesForCountry = country => (cityOptionsByCountry[country] || []).concat(['Other']);
const initialCountryIndex = countryOptions.indexOf('Italy');

Page({
  data: {
    step: 1,
    countryOptions,
    countryIndex: initialCountryIndex,
    countryCities: citiesForCountry('Italy'),
    cityIndex: 1,
    verificationCode: '',
    verificationSent: false,
    verificationToken: '',
    verificationBusy: false,
    verificationCooldown: 0,
    showPassword: false,
    showOptionalFields: false,
    busy: false,
    error: '',
    form: {
      email: '', password: '', displayName: '', legalName: '', vatNumber: '',
      country: 'Italy', city: 'Prato', phone: '', address: '', postalCode: '',
      contactName: '', website: '', acceptedTerms: false, acceptedPrivacy: false
    },
    roleOptions,
    categoryOptions,
    industryOptions,
    role: '',
    roleLabel: '',
    industry: '',
    industryLabel: '',
    industryIndex: 0,
    selectedCategoryLabels: '',
    companyId: '',
    companyStatus: '',
    accountIdentityReviewRequired: false,
    url: '',
    title: '暂时无法打开代理工作台',
    description: '请复制 RUDA Partner 登录链接，并在浏览器中打开。',
    copyLabel: '复制代理工作台链接',
    copySuccess: '代理工作台链接已复制',
    loadError: false,
    isPartnerPortal: false
  },

  onLoad(options) {
    if (options && options.portal === 'partner') {
      this.setData({
        url: PARTNER_URL,
        isPartnerPortal: true
      });
      wx.setNavigationBarTitle({ title: '代理后台' });
      return;
    }
    if (options && (options.portal === 'merchant-registration' || options.portal === 'merchant-onboarding')) {
      // 商家注册使用小程序原生两步表单，必须与 web 注册共用同一套企业注册 API。
      wx.setNavigationBarTitle({ title: '商家注册' });
      return;
    }
    wx.setNavigationBarTitle({ title: '' });
  },

  onUnload() {
    if (this._cooldownTimer) clearInterval(this._cooldownTimer);
  },

  onFormInput(event) {
    const field = event.currentTarget.dataset.field;
    const value = event.detail.value;
    if (!field || !Object.prototype.hasOwnProperty.call(this.data.form, field)) return;
    // Mini program tooling rejects computed object keys, so the dynamic field is assigned explicitly.
    const update = { error: '' };
    update[`form.${field}`] = value;
    if (field === 'email' || field === 'phone') {
      update.verificationToken = '';
      update.verificationSent = false;
      update.verificationCode = '';
    }
    this.setData(update);
  },

  onVerificationCodeInput(event) {
    this.setData({ verificationCode: event.detail.value.replace(/\D/g, '').slice(0, 6), error: '' });
  },

  onRegistrationCountryChange(event) {
    const countryIndex = Number(event.detail.value);
    const country = countryOptions[countryIndex];
    if (!country) return;
    const countryCities = citiesForCountry(country);
    this.setData({
      countryIndex,
      countryCities,
      cityIndex: 0,
      'form.country': country,
      'form.city': countryCities[0],
      error: ''
    });
  },

  onRegistrationCityChange(event) {
    const cityIndex = Number(event.detail.value);
    const city = this.data.countryCities[cityIndex];
    if (!city) return;
    this.setData({ cityIndex, 'form.city': city, error: '' });
  },

  togglePasswordVisibility() {
    this.setData({ showPassword: !this.data.showPassword });
  },

  getVerificationDestination() {
    return this.data.form.email.trim().toLowerCase();
  },

  async requestVerification() {
    if (this.data.verificationBusy || this.data.verificationCooldown > 0) return;
    if (!this.data.form.acceptedTerms || !this.data.form.acceptedPrivacy) {
      this.setData({ error: '请先阅读并同意用户服务协议和隐私政策，再获取验证码。' });
      return;
    }
    const destination = this.getVerificationDestination();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination)) {
      this.setData({ error: '请输入有效邮箱地址。' });
      return;
    }
    this.setData({ verificationBusy: true, error: '' });
    try {
      const response = await request('/api/auth/register/company/request-verification', {
        method: 'POST',
        auth: false,
        data: { channel: 'email', destination }
      });
      const cooldown = Number(response.retryAfter) || 60;
      this.setData({ verificationSent: true, verificationCooldown: cooldown });
      this._cooldownTimer = setInterval(() => {
        const remaining = Math.max(0, this.data.verificationCooldown - 1);
        this.setData({ verificationCooldown: remaining });
        if (remaining === 0 && this._cooldownTimer) {
          clearInterval(this._cooldownTimer);
          this._cooldownTimer = null;
        }
      }, 1000);
      wx.showToast({ title: '验证码已发送', icon: 'success' });
    } catch (error) {
      const messages = {
        EMAIL_VERIFICATION_NOT_CONFIGURED: '邮箱验证码服务暂未配置，请联系 RUDA 客服。',
        EMAIL_DELIVERY_FAILED: '验证码邮件发送失败，请稍后重试。',
        CONTACT_ALREADY_EXISTS: '该联系方式已注册，请直接登录。',
        VERIFICATION_CODE_COOLDOWN: '请求过于频繁，请稍后再试。'
      };
      this.setData({ error: messages[error.code] || error.message || '验证码发送失败，请稍后重试。' });
    } finally {
      this.setData({ verificationBusy: false });
    }
  },

  async verifyContact() {
    if (this.data.verificationBusy) return;
    if (!this.data.form.acceptedTerms || !this.data.form.acceptedPrivacy) {
      this.setData({ error: '请先阅读并同意用户服务协议和隐私政策。' });
      return;
    }
    const code = this.data.verificationCode.trim();
    if (!/^\d{6}$/.test(code)) {
      this.setData({ error: '请输入 6 位验证码。' });
      return;
    }
    this.setData({ verificationBusy: true, error: '' });
    try {
      const response = await request('/api/auth/register/company/verify', {
        method: 'POST',
        auth: false,
        data: {
          channel: 'email',
          destination: this.getVerificationDestination(),
          code
        }
      });
      this.setData({ verificationToken: response.verificationToken || '', error: '' });
      wx.showToast({ title: '联系方式已验证', icon: 'success' });
    } catch (error) {
      this.setData({ error: error.message || '验证码无效或已过期，请重新获取。' });
    } finally {
      this.setData({ verificationBusy: false });
    }
  },

  toggleRole(event) {
    const role = event.currentTarget.dataset.id;
    const selectedRole = this.data.role === role ? '' : role;
    const roleOptions = this.data.roleOptions.map(option => ({
      id: option.id,
      label: option.label,
      selected: option.id === selectedRole
    }));
    const roleOption = roleOptions.find(option => option.id === selectedRole);
    this.setData({ role: selectedRole, roleLabel: roleOption ? roleOption.label : '', roleOptions, error: '' });
  },

  toggleCategory(event) {
    const category = event.currentTarget.dataset.id;
    const selectedOption = this.data.categoryOptions.find(option => option.id === category);
    const selected = selectedOption ? selectedOption.selected : false;
    const categoryOptions = this.data.categoryOptions.map(option => ({
      id: option.id,
      label: option.label,
      selected: option.id === category ? !selected : option.selected
    }));
    const selectedCategoryLabels = categoryOptions.filter(option => option.selected).map(option => option.label).join('、');
    this.setData({ categoryOptions, selectedCategoryLabels, error: '' });
  },

  onIndustryChange(event) {
    const industryIndex = Number(event.detail.value);
    const option = this.data.industryOptions[industryIndex];
    this.setData({ industryIndex, industry: option ? option.id : '', industryLabel: option ? option.label : '', error: '' });
  },

  toggleOptionalFields() {
    this.setData({ showOptionalFields: !this.data.showOptionalFields });
  },

  onConsentChange(event) {
    const values = event.detail.value || [];
    this.setData({
      'form.acceptedTerms': values.includes('terms'),
      'form.acceptedPrivacy': values.includes('privacy'),
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

  nextStep() {
    const { step, form, verificationToken } = this.data;
    let error = '';
    if (step === 1) {
      const destination = this.getVerificationDestination();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination)) {
        error = '请输入有效邮箱地址。';
      } else if (form.password.length < 8) {
        error = '密码至少需要 8 位。';
      } else if (!verificationToken) {
        error = '请先完成联系方式验证。';
      }
    }
    if (error) {
      this.setData({ error });
      return;
    }
    this.setData({ step: 2, error: '' });
  },

  previousStep() {
    if (this.data.busy) return;
    if (this.data.step > 1) {
      this.setData({ step: this.data.step - 1, error: '' });
      return;
    }
    wx.navigateBack({ delta: 1 });
  },

  async submitRegistration() {
    if (this.data.busy) return;
    const { form, role, categoryOptions, industry, verificationToken } = this.data;
    if (!form.displayName.trim() || !form.country.trim() || !form.city.trim()) {
      this.setData({ error: '请填写企业名称、国家和城市。' });
      return;
    }
    if (!role || !categoryOptions.some(option => option.selected) || !industry) {
      this.setData({ error: '请选择业务类型、主营品类和所属行业。' });
      return;
    }
    if (!form.acceptedTerms || !form.acceptedPrivacy) {
      this.setData({ error: '请先阅读并同意服务协议和隐私政策。' });
      return;
    }
    this.setData({ busy: true, error: '' });
    try {
      const response = await request('/api/auth/register/company', {
        method: 'POST',
        auth: false,
        data: Object.assign({}, form, {
          email: form.email.trim().toLowerCase(),
          phone: '',
          legalName: form.legalName.trim() || form.displayName.trim(),
          roles: [role],
          categories: categoryOptions.filter(option => option.selected).map(option => option.id),
          industryTemplate: industry,
          verificationToken
        })
      });
      this.setData({
        step: 5,
        companyId: response.companyId || '',
        companyStatus: response.status || 'VERIFICATION_PENDING',
        accountIdentityReviewRequired: Boolean(response.accountIdentityReviewRequired),
        error: ''
      });
    } catch (error) {
      const messages = {
        MISSING_FIELDS: '申请资料不完整，请返回检查必填项目。',
        PASSWORD_TOO_SHORT: '密码至少需要 8 位。',
        CONSENTS_REQUIRED: '请先阅读并同意服务协议和隐私政策。',
        CONTACT_VERIFICATION_REQUIRED: '联系方式验证已失效，请重新验证。',
        EMAIL_NOT_VERIFIED: '邮箱验证与填写的邮箱不一致。',
        PHONE_NOT_VERIFIED: '手机号验证与填写的手机号不一致。',
        INVALID_OR_EXPIRED_CODE: '验证码错误或已过期，请重新获取。',
        EMAIL_ALREADY_EXISTS: '该邮箱已注册，请直接登录。',
        PHONE_ALREADY_EXISTS: '该手机号已注册，请直接登录。',
        VAT_ALREADY_EXISTS: '该税号已用于其他企业申请。',
        WRONG_IDENTIFIER_OR_PASSWORD: '该联系方式已关联账户，请使用原密码登录。'
      };
      this.setData({ error: messages[error.code] || error.message || '提交失败，请稍后重试。' });
    } finally {
      this.setData({ busy: false });
    }
  },

  finishRegistration() {
    wx.navigateBack({
      delta: 1,
      fail: () => wx.redirectTo({ url: '/pages/login/index' })
    });
  },

  copyRegistrationLink() {
    wx.setClipboardData({
      data: this.data.url || PARTNER_URL,
      success: () => wx.showToast({ title: this.data.copySuccess, icon: 'none' }),
      fail: () => wx.showToast({ title: '复制失败，请稍后重试', icon: 'none' })
    });
  },

  onWebViewError() {
    this.setData({ loadError: true });
  }
});

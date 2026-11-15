const { request } = require('../../utils/api');
const { requireMerchantSession } = require('../../utils/page-auth');

/**
 * MODAUI 广告策划 · 商家小程序。
 *
 * 与电脑端、手机网页端共用同一套接口（docs/engineering/modules/modaui-ai-advertising.md §23）：
 * - 商品列表 /api/merchant/products，商品事实 /api/merchant/ai-ad/products/:id/brief；
 * - 三套方案 /api/merchant/ai-ad/concepts（一次模型调用）；
 * - 项目 /api/merchant/ai-ad/projects（幂等 clientRequestId）与分镜版本 PATCH；
 * - 费用与能力状态全部来自服务端，未接通视频/配音时按钮禁用，不做假按钮。
 * 进度只保存在页面内存里，离开即回到第 1 步；项目与版本一律落服务端，不用本地缓存冒充数据库。
 */

const STEPS = [
  { id: 'product', label: '选择商品' },
  { id: 'concepts', label: '选择方案' },
  { id: 'budget', label: '确认预算' },
  { id: 'storyboard', label: '分镜与保存' }
];

const ROUTE_NAMES = { product: 'Product Ad', ugc: 'UGC Ad', quick: 'Quick Ad' };
const ROUTE_HINTS = {
  product: '商品为主角，突出材质与做工',
  ugc: '真人出镜讲解，接近用户视角',
  quick: '图片快剪，成本最低、出片最快'
};
const MISSING_LABELS = {
  price: '价格', images: '商品图片', skus: 'SKU', colors: '颜色',
  material: '面料成分', description: '商品描述', sellingPoints: '卖点'
};
const SERVICE_LABELS = { text: '文案生成', video: '视频生成', voice: '配音', digitalHuman: '数字人' };
const STATUS_LABELS = {
  ready: '已接通',
  provider_access_required: '缺少供应商凭据',
  adapter_not_built: '适配器未实现',
  price_not_configured: '未配置单价',
  provider_not_configured: '未配置供应商'
};
const FRAMING_LABELS = { wide: '全景', medium: '中景', close: '近景', macro: '特写' };
const SOURCE_LABELS = { ai_video: 'AI 视频', product_image: '商品图', local_motion: '本地动效' };
const CAMERA_LABELS = { static: '固定机位', push_in: '推近', pan: '横移', orbit: '环绕' };
const TRANSITION_LABELS = { cut: '硬切', fade: '淡入', slide: '滑动' };
const CROP_LABELS = { none: '原始比例', tight: '紧凑裁切', wide: '宽松留白' };
const POSITION_LABELS = { center: '居中', top: '偏上', bottom: '偏下' };

/**
 * 商家只选商业用途与发布平台；goal / aspectRatio 在这里确定性映射。
 * ready=false 表示依赖尚未接通的能力（数字人、口型同步），界面必须禁用并写明原因。
 */
const PURPOSE_OPTIONS = [
  { id: 'product_ad', label: '商品宣传', goal: 'conversion', route: 'product', ready: true },
  { id: 'creator_ugc', label: '数字人介绍', goal: 'awareness', route: 'ugc', ready: false, reason: '数字人与口型同步尚未接通' },
  { id: 'promotion', label: '促销广告', goal: 'conversion', route: 'quick', ready: true },
  { id: 'brand_film', label: '品牌视频', goal: 'launch', route: 'product', ready: true }
];
const PLATFORM_OPTIONS = [
  { id: 'douyin', label: '抖音', aspect: '9:16' },
  { id: 'xiaohongshu', label: '小红书', aspect: '9:16' },
  { id: 'wechat_channels', label: '视频号', aspect: '9:16' },
  { id: 'instagram_reels', label: 'Instagram Reels', aspect: '9:16' },
  { id: 'youtube_shorts', label: 'YouTube Shorts', aspect: '9:16' },
  { id: 'website', label: '官网 / 独立站', aspect: '16:9' },
  { id: 'marketplace_feed', label: '电商主图视频', aspect: '1:1' }
];
const purposeById = id => PURPOSE_OPTIONS.find(item => item.id === id) || PURPOSE_OPTIONS[0];
const platformById = id => PLATFORM_OPTIONS.find(item => item.id === id) || PLATFORM_OPTIONS[0];

/** 与电脑端共用同一批预设；generation 标记表示必须重新生成画面才能生效。 */
const SHOT_EDIT_PRESETS = [
  { id: 'premium', label: '更高级', generation: false },
  { id: 'product_clarity', label: '商品更清楚', generation: false },
  { id: 'background', label: '换一个背景', generation: true },
  { id: 'natural_person', label: '人物更自然', generation: true },
  { id: 'faster', label: '节奏更快', generation: false },
  { id: 'redesign', label: '重新设计', generation: true }
];

const FRAMING_KEYS = ['wide', 'medium', 'close', 'macro'];
const CAMERA_KEYS = ['static', 'push_in', 'pan', 'orbit'];
const SOURCE_KEYS = ['product_image', 'local_motion', 'ai_video'];
const TRANSITION_KEYS = ['cut', 'fade', 'slide'];
const CROP_KEYS = ['none', 'tight', 'wide'];
const POSITION_KEYS = ['center', 'top', 'bottom'];
const ERROR_MESSAGES = {
  PROVIDER_NOT_CONFIGURED: '未配置文本模型，无法生成方案。请先在工具中心检查 AI 能力。',
  PRICE_NOT_CONFIGURED: '商品缺少价格，方案无法报价。请先补全商品价格。',
  AI_AD_FACT_UNGROUNDED: '方案里出现了商品资料没有的数字，已整批拦下。',
  AI_TOOLS_PROVIDER_RESPONSE_INVALID: '模型返回格式异常，请重试。',
  AI_AD_VERSION_CONFLICT: '内容已被其他端更新，请重新加载后再保存。',
  AI_AD_STORYBOARD_EMPTY: '分镜为空，至少保留一个镜头。',
  AI_AD_SHOT_NOT_FOUND: '镜头不存在或已被其他端删除，请刷新后重试。',
  AI_AD_SHOT_EDIT_INVALID: '请选择一种修改方式，或写一句具体的要求（最多 200 字）。',
  AI_AD_PROJECT_NOT_FOUND: '项目不存在或已删除。',
  AI_AD_PRODUCT_NOT_FOUND: '商品不存在或不属于当前商家。'
};

const moneyText = (minor, currency) => {
  if (minor === null || minor === undefined) return '未定价';
  const amount = (Number(minor) / 100).toFixed(2);
  if (currency === 'EUR') return `€${amount}`;
  if (currency === 'USD') return `$${amount}`;
  return `${amount} ${currency || ''}`.trim();
};
const usdText = value => (value === null || value === undefined ? '' : `$${Number(value).toFixed(2)}`);
const durationText = ms => `${Math.round(Number(ms) / 100) / 10}s`;
const errorText = error => ERROR_MESSAGES[error && error.code]
  || (error && error.message)
  || '请求失败，请稍后重试';

function mapConcept(concept) {
  const providerStatus = concept.providerStatus || {};
  const estimate = concept.costEstimate || { lines: [], amountUsd: null, status: 'price_not_configured' };
  return {
    conceptKey: concept.conceptKey,
    routeName: ROUTE_NAMES[concept.route] || concept.route,
    hint: ROUTE_HINTS[concept.route] || '',
    hook: concept.hook,
    audience: concept.audience,
    cta: concept.cta,
    hashtags: (concept.hashtags || []).slice(0, 3).map(tag => `#${String(tag).replace(/^#/, '')}`),
    durationLabel: durationText(concept.durationMs),
    shotCount: (concept.storyboard || []).length,
    shots: (concept.storyboard || []).map((shot, index) => ({
      id: shot.shotId,
      label: `${index + 1} · ${FRAMING_LABELS[shot.framing] || shot.framing} · ${durationText(shot.durationMs)}`,
      visual: shot.visual
    })),
    voices: (concept.script || []).filter(scene => (scene.voiceover || '').trim()).map(scene => scene.voiceover),
    videoStatus: STATUS_LABELS[providerStatus.video] || providerStatus.video || '',
    videoReady: providerStatus.video === 'ready',
    voiceStatus: STATUS_LABELS[providerStatus.voice] || providerStatus.voice || '',
    voiceReady: providerStatus.voice === 'ready',
    estimate,
    providerStatus
  };
}

function mapEstimate(estimate) {
  const source = estimate || { lines: [], amountUsd: null, status: 'price_not_configured', currency: 'USD' };
  return {
    status: source.status,
    totalLabel: usdText(source.amountUsd),
    lines: (source.lines || []).map((line, index) => ({
      key: `${line.kind}-${index}`,
      label: line.label,
      modelId: line.modelId || '未匹配模型',
      statusLabel: line.status === 'ready' ? '' : (STATUS_LABELS[line.status] || line.status),
      amountLabel: usdText(line.amountUsd) || '未配置价格',
      priced: line.amountUsd !== null && line.amountUsd !== undefined
    }))
  };
}

function mapShot(shot, index) {
  const speed = typeof shot.speed === 'number' ? shot.speed : 1;
  const transition = shot.transition || 'cut';
  const crop = shot.crop || 'none';
  const position = shot.position || 'center';
  return {
    shotId: shot.shotId,
    index: index + 1,
    framingLabel: FRAMING_LABELS[shot.framing] || shot.framing,
    cameraLabel: CAMERA_LABELS[shot.camera] || shot.camera,
    sourceLabel: SOURCE_LABELS[shot.source] || shot.source,
    transitionLabel: TRANSITION_LABELS[transition] || transition,
    cropLabel: CROP_LABELS[crop] || crop,
    positionLabel: POSITION_LABELS[position] || position,
    speedLabel: `${speed.toFixed(1)}x`,
    directionNote: shot.directionNote || '',
    durationText: durationText(shot.durationMs),
    durationSeconds: Math.round(Number(shot.durationMs) / 100) / 10,
    visual: shot.visual,
    voiceover: shot.voiceover || '',
    subtitle: shot.subtitle || '',
    framingIndex: Math.max(0, FRAMING_KEYS.indexOf(shot.framing)),
    cameraIndex: Math.max(0, CAMERA_KEYS.indexOf(shot.camera)),
    sourceIndex: Math.max(0, SOURCE_KEYS.indexOf(shot.source)),
    transitionIndex: Math.max(0, TRANSITION_KEYS.indexOf(transition)),
    cropIndex: Math.max(0, CROP_KEYS.indexOf(crop)),
    positionIndex: Math.max(0, POSITION_KEYS.indexOf(position))
  };
}

Page({
  data: {
    step: 'product',
    steps: STEPS,
    stepIndex: 0,
    loadingProducts: true,
    productsError: '',
    search: '',
    products: [],
    selectedProductId: '',
    selectedProductName: '',
    heroImage: '',
    brief: null,
    briefView: null,
    briefMissing: [],
    briefError: '',
    briefLoading: false,
    // 商家只选用途与平台；goal / aspectRatio 由映射得出，语言与档位由 MODAUI 统一决定。
    purpose: 'product_ad',
    platform: 'douyin',
    purposeOptions: PURPOSE_OPTIONS.map(item => ({ id: item.id, label: item.label, ready: item.ready })),
    platformOptions: PLATFORM_OPTIONS.map(item => ({ id: item.id, label: item.label })),
    goal: 'conversion',
    language: 'zh',
    aspectRatio: '9:16',
    resolutionKey: '720p',
    shotProOpen: false,
    framingKeys: FRAMING_KEYS,
    framingLabels: FRAMING_KEYS.map(key => FRAMING_LABELS[key]),
    cameraKeys: CAMERA_KEYS,
    cameraLabels: CAMERA_KEYS.map(key => CAMERA_LABELS[key]),
    sourceKeys: SOURCE_KEYS,
    sourceLabels: SOURCE_KEYS.map(key => SOURCE_LABELS[key]),
    transitionKeys: TRANSITION_KEYS,
    transitionLabels: TRANSITION_KEYS.map(key => TRANSITION_LABELS[key]),
    cropKeys: CROP_KEYS,
    cropLabels: CROP_KEYS.map(key => CROP_LABELS[key]),
    positionKeys: POSITION_KEYS,
    positionLabels: POSITION_KEYS.map(key => POSITION_LABELS[key]),
    concepts: [],
    conceptsLoading: false,
    conceptError: '',
    selectedConceptKey: '',
    compareOpen: false,
    estimate: null,
    providerRows: [],
    quotaText: '',
    quotaMissing: false,
    project: null,
    shots: [],
    advancedOpen: false,
    editPresets: SHOT_EDIT_PRESETS,
    editOpenShotId: '',
    editPreset: '',
    editInstruction: '',
    editBusy: false,
    editError: '',
    editNotice: '',
    editGeneration: false,
    autoSaveLabel: '已同步',
    versions: [],
    versionsLoading: false,
    saving: false,
    notice: '',
    saveError: ''
  },

  rawConcepts: [],
  rawShots: [],
  clientRequestId: '',

  async onShow() {
    await requireMerchantSession();
    if (!this.loadedOnce) {
      this.loadedOnce = true;
      await this.loadProducts();
      await this.loadQuota();
    }
  },

  setStep(step) {
    const index = STEPS.findIndex(entry => entry.id === step);
    this.setData({ step, stepIndex: index < 0 ? 0 : index, notice: '', saveError: '' });
  },

  async loadProducts() {
    this.setData({ loadingProducts: true, productsError: '' });
    try {
      const result = await request('/api/merchant/products');
      const products = (result.products || []).map(product => ({
        id: product.id,
        name: product.name,
        styleNo: product.styleNo,
        image: (product.images || [])[0] || '',
        skuCount: (product.skus || []).length,
        colors: Array.from(new Set((product.skus || []).map(sku => sku.color).filter(Boolean))).slice(0, 3),
        priceLabel: moneyText(
          typeof product.wholesalePrice === 'number' ? Math.round(product.wholesalePrice * 100) : null,
          'EUR'
        ),
        keyword: `${product.name} ${product.styleNo} ${(product.skus || []).map(sku => `${sku.sku} ${sku.color || ''} ${sku.size || ''}`).join(' ')}`.toLowerCase()
      }));
      this.allProducts = products;
      this.setData({ products, loadingProducts: false });
      this.applySearch();
    } catch (error) {
      this.setData({ loadingProducts: false, productsError: errorText(error) });
    }
  },

  async loadQuota() {
    try {
      const result = await request('/api/merchant/ai-tools');
      const quota = result.quota || null;
      this.setData({
        quotaText: quota ? `今日 ${quota.remaining.daily} / ${quota.limits.dailyCalls} · 本月 ${quota.remaining.monthly} / ${quota.limits.monthlyCalls}` : '',
        quotaMissing: !quota
      });
    } catch (error) {
      this.setData({ quotaText: '', quotaMissing: true });
    }
  },

  onSearchInput(event) {
    this.setData({ search: event.detail.value });
    this.applySearch();
  },

  applySearch() {
    const keyword = (this.data.search || '').trim().toLowerCase();
    const all = this.allProducts || [];
    this.setData({ products: keyword ? all.filter(product => product.keyword.includes(keyword)) : all });
  },

  async selectProduct(event) {
    const productId = event.currentTarget.dataset.id;
    const product = (this.allProducts || []).find(item => item.id === productId);
    this.setData({
      selectedProductId: productId,
      selectedProductName: product ? product.name : '',
      brief: null,
      briefMissing: [],
      briefError: '',
      briefLoading: true,
      heroImage: '',
      concepts: [],
      conceptError: '',
      selectedConceptKey: '',
      estimate: null,
      providerRows: [],
      project: null,
      shots: [],
      versions: [],
      notice: '',
      saveError: ''
    });
    this.rawConcepts = [];
    this.rawShots = [];
    this.clientRequestId = '';
    try {
      const result = await request(`/api/merchant/ai-ad/products/${encodeURIComponent(productId)}/brief`);
      const brief = result.brief || null;
      this.setData({
        brief,
        briefView: brief ? {
          name: brief.name,
          styleNo: product ? product.styleNo : '',
          brand: brief.brand || '',
          priceLabel: moneyText(brief.price.minor, brief.price.currency),
          colorCount: (brief.colors || []).length,
          sizeCount: (brief.sizes || []).length,
          images: (brief.imageUrls || []).slice(0, 4),
          missing: (brief.missing || []).map(key => MISSING_LABELS[key] || key)
        } : null,
        briefMissing: (brief && brief.missing ? brief.missing : []).map(key => MISSING_LABELS[key] || key),
        heroImage: brief && brief.imageUrls && brief.imageUrls.length ? brief.imageUrls[0] : '',
        briefLoading: false
      });
    } catch (error) {
      this.setData({ briefLoading: false, briefError: errorText(error) });
    }
  },

  buildProviderRows(providerStatus) {
    const status = providerStatus || {};
    return ['text', 'video', 'voice', 'digitalHuman'].map(key => ({
      key,
      label: SERVICE_LABELS[key],
      statusLabel: STATUS_LABELS[status[key]] || status[key] || '',
      ready: status[key] === 'ready'
    }));
  },

  async generateConcepts() {
    if (!this.data.selectedProductId || this.data.conceptsLoading) return;
    this.setData({ step: 'concepts', stepIndex: 1, conceptsLoading: true, conceptError: '', concepts: [], compareOpen: false });
    try {
      const result = await request('/api/merchant/ai-ad/concepts', {
        method: 'POST',
        timeout: 120000,
        data: {
          productId: this.data.selectedProductId,
          goal: this.data.goal,
          language: this.data.language,
          aspectRatio: this.data.aspectRatio,
          resolutionKey: this.data.resolutionKey
        }
      });
      this.rawConcepts = result.concepts || [];
      // 用途映射的首选路线排在最前：本地确定性排序，不额外调用任何供应商。
      const preferred = purposeById(this.data.purpose).route;
      const ordered = this.rawConcepts.slice().sort((a, b) => {
        if (a.route === b.route) return 0;
        if (a.route === preferred) return -1;
        if (b.route === preferred) return 1;
        return 0;
      });
      this.rawConcepts = ordered;
      const mapped = ordered.map(mapConcept);
      this.setData({
        concepts: mapped,
        providerRows: this.buildProviderRows(result.providerStatus),
        conceptsLoading: false
      });
    } catch (error) {
      this.setData({ conceptsLoading: false, conceptError: errorText(error) });
    }
  },

  chooseConcept(event) {
    const conceptKey = event.currentTarget.dataset.key;
    const concept = (this.data.concepts || []).find(item => item.conceptKey === conceptKey);
    this.setData({
      selectedConceptKey: conceptKey,
      estimate: concept ? mapEstimate(concept.estimate) : null,
      providerRows: concept ? this.buildProviderRows(concept.providerStatus) : this.data.providerRows,
      step: 'budget',
      stepIndex: 2,
      notice: '',
      saveError: ''
    });
  },

  goStep(event) {
    const step = event.currentTarget.dataset.step;
    if (step === 'concepts' && !this.data.brief) return;
    if (step === 'budget' && !this.data.selectedConceptKey) return;
    if (step === 'storyboard' && !this.data.project) return;
    this.setStep(step);
  },

  async createProject() {
    if (!this.data.selectedProductId || !this.data.selectedConceptKey || this.data.saving) return;
    if (!this.clientRequestId) {
      this.clientRequestId = `mp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    this.setData({ saving: true, saveError: '', notice: '' });
    try {
      const result = await request('/api/merchant/ai-ad/projects', {
        method: 'POST',
        timeout: 30000,
        data: {
          productId: this.data.selectedProductId,
          concepts: this.rawConcepts,
          selectedConceptKey: this.data.selectedConceptKey,
          clientRequestId: this.clientRequestId
        }
      });
      this.applyProject(result.project);
      this.setData({
        saving: false,
        step: 'storyboard',
        stepIndex: 3,
        notice: `项目已保存，当前版本 v${result.project.currentVersionNo}`
      });
      await this.loadVersions(result.project.id);
    } catch (error) {
      this.setData({ saving: false, saveError: errorText(error) });
    }
  },

  applyProject(project) {
    if (!project) return;
    const concepts = project.concepts || [];
    const key = this.data.selectedConceptKey
      || (concepts.find(row => row.id === project.selectedConceptId) || {}).conceptKey
      || (concepts[0] || {}).conceptKey
      || '';
    const concept = concepts.find(row => row.conceptKey === key) || concepts[0] || null;
    this.rawShots = ((concept && concept.storyboard) || []).map(shot => Object.assign({}, shot));
    this.lastSavedSignature = JSON.stringify(this.rawShots);
    this.setData({
      project: {
        id: project.id,
        title: project.title,
        versionNo: project.currentVersionNo,
        conceptKey: key,
        routeName: ROUTE_NAMES[key] || key,
        budgetLabel: usdText(project.costEstimate && project.costEstimate.amountUsd) || '未配置价格'
      },
      selectedConceptKey: key,
      shots: this.rawShots.map(mapShot),
      estimate: mapEstimate((concept && concept.costEstimate) || project.costEstimate),
      advancedOpen: false,
      autoSaveLabel: '已同步',
      editOpenShotId: '',
      editPreset: '',
      editInstruction: '',
      editError: '',
      editNotice: '',
      editGeneration: false
    });
  },

  async loadVersions(projectId) {
    if (!projectId) return;
    this.setData({ versionsLoading: true });
    try {
      const result = await request(`/api/merchant/ai-ad/projects/${encodeURIComponent(projectId)}/versions`);
      this.versionRows = result.versions || [];
      this.setData({
        versions: this.versionRows.map(version => ({
          id: version.id,
          versionNo: version.versionNo,
          note: version.note || '',
          timeLabel: (version.createdAt || '').slice(5, 16).replace('T', ' '),
          routeName: ROUTE_NAMES[version.conceptKey] || version.conceptKey
        })),
        versionsLoading: false
      });
    } catch (error) {
      this.versionRows = [];
      this.setData({ versions: [], versionsLoading: false });
    }
  },

  toggleAdvanced() {
    this.setData({ advancedOpen: !this.data.advancedOpen });
  },

  onShotInput(event) {
    const index = Number(event.currentTarget.dataset.index);
    const field = event.currentTarget.dataset.field;
    const shot = this.rawShots[index];
    if (!shot) return;
    if (field === 'durationSeconds') {
      const seconds = Number(event.detail.value);
      if (!Number.isFinite(seconds)) return;
      shot.durationMs = Math.round(Math.min(Math.max(seconds, 0.5), 30) * 1000);
      this.setData({ shots: this.rawShots.map(mapShot) });
      this.markDirty();
      return;
    }
    if (field === 'subtitle') {
      const text = event.detail.value;
      shot.subtitle = text.trim() ? text : null;
    } else {
      shot[field] = event.detail.value;
    }
    this.setData({ shots: this.rawShots.map(mapShot) });
    this.markDirty();
  },

  onShotPick(event) {
    const index = Number(event.currentTarget.dataset.index);
    const field = event.currentTarget.dataset.field;
    const position = Number(event.detail.value);
    const shot = this.rawShots[index];
    if (!shot) return;
    const keyMap = {
      framing: FRAMING_KEYS,
      camera: CAMERA_KEYS,
      source: SOURCE_KEYS,
      transition: TRANSITION_KEYS,
      crop: CROP_KEYS,
      position: POSITION_KEYS
    };
    const keys = keyMap[field];
    if (!keys || !keys[position]) return;
    shot[field] = keys[position];
    this.setData({ shots: this.rawShots.map(mapShot) });
    this.markDirty();
  },

  onShotSpeed(event) {
    const index = Number(event.currentTarget.dataset.index);
    const shot = this.rawShots[index];
    if (!shot) return;
    const value = Number(event.currentTarget.dataset.value);
    if (!Number.isFinite(value)) return;
    shot.speed = value;
    this.setData({ shots: this.rawShots.map(mapShot) });
    this.markDirty();
  },

  moveShot(event) {
    const index = Number(event.currentTarget.dataset.index);
    const direction = Number(event.currentTarget.dataset.direction);
    const target = index + direction;
    if (target < 0 || target >= this.rawShots.length) return;
    const next = this.rawShots.slice();
    const item = next.splice(index, 1)[0];
    next.splice(target, 0, item);
    this.rawShots = next.map((shot, position) => Object.assign({}, shot, { order: position }));
    this.setData({ shots: this.rawShots.map(mapShot) });
    this.markDirty();
  },

  deleteShot(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (this.rawShots.length <= 1) return;
    this.rawShots = this.rawShots
      .filter((shot, position) => position !== index)
      .map((shot, position) => Object.assign({}, shot, { order: position }));
    this.setData({ shots: this.rawShots.map(mapShot) });
    this.markDirty();
  },

  addShot() {
    if (this.rawShots.length >= 24) return;
    this.rawShots = this.rawShots.concat([{
      shotId: `mp-shot-${Date.now().toString(36)}`,
      order: this.rawShots.length,
      durationMs: 4000,
      framing: 'medium',
      camera: 'static',
      source: 'local_motion',
      visual: '补充镜头画面',
      voiceover: '',
      subtitle: null
    }]);
    this.setData({ shots: this.rawShots.map(mapShot) });
    this.markDirty();
  },

  /** 用途是商业选择：映射 goal 与首选路线，未接通的用途直接忽略点击。 */
  choosePurpose(event) {
    const id = event.currentTarget.dataset.id;
    const option = PURPOSE_OPTIONS.find(item => item.id === id);
    if (!option) return;
    if (!option.ready) {
      wx.showToast({ title: option.reason || '该用途尚未接通', icon: 'none' });
      return;
    }
    this.setData({ purpose: option.id, goal: option.goal });
  },

  /** 平台只决定画幅与导出比例；发布能力未接通，界面已写明。 */
  choosePlatform(event) {
    const id = event.currentTarget.dataset.id;
    const option = PLATFORM_OPTIONS.find(item => item.id === id);
    if (!option) return;
    this.setData({ platform: option.id, aspectRatio: option.aspect });
  },

  toggleShotPro() {
    this.setData({ shotProOpen: !this.data.shotProOpen });
  },

  toggleCompare() {
    this.setData({ compareOpen: !this.data.compareOpen });
  },

  openShotEdit(event) {
    const shotId = event.currentTarget.dataset.id;
    if (this.data.editOpenShotId === shotId) {
      this.setData({
        editOpenShotId: '',
        editPreset: '',
        editInstruction: '',
        editError: '',
        editNotice: '',
        editGeneration: false
      });
      return;
    }
    this.setData({
      editOpenShotId: shotId,
      editPreset: '',
      editInstruction: '',
      editError: '',
      editNotice: '',
      editGeneration: false
    });
  },

  chooseShotPreset(event) {
    const preset = event.currentTarget.dataset.preset;
    this.setData({ editPreset: this.data.editPreset === preset ? '' : preset, editError: '' });
  },

  onEditInstruction(event) {
    this.setData({ editInstruction: event.detail.value });
  },

  async applyShotEdit() {
    const project = this.data.project;
    const shotId = this.data.editOpenShotId;
    if (!project || !shotId || this.data.editBusy) return;
    const preset = this.data.editPreset;
    const instruction = (this.data.editInstruction || '').trim();
    if (!preset && !instruction) {
      this.setData({ editError: '先选一种修改方式，或写一句具体要求' });
      return;
    }
    this.setData({ editBusy: true, editError: '', editNotice: '', editGeneration: false });
    try {
      const result = await request(
        `/api/merchant/ai-ad/projects/${encodeURIComponent(project.id)}/shots/${encodeURIComponent(shotId)}/edit`,
        {
          method: 'POST',
          timeout: 45000,
          data: {
            conceptKey: project.conceptKey,
            preset: preset || undefined,
            instruction: instruction || undefined,
            resolutionKey: this.data.resolutionKey
          }
        }
      );
      this.rawShots = (result.storyboard || []).map(shot => Object.assign({}, shot));
      this.lastSavedSignature = JSON.stringify(this.rawShots);
      const plan = result.plan || {};
      this.setData({
        shots: this.rawShots.map(mapShot),
        project: Object.assign({}, project, {
          versionNo: result.project.currentVersionNo,
          budgetLabel: usdText(result.costEstimate && result.costEstimate.amountUsd) || project.budgetLabel
        }),
        estimate: result.costEstimate ? mapEstimate(result.costEstimate) : this.data.estimate,
        editBusy: false,
        editInstruction: '',
        editNotice: plan.note || '已记录修改',
        editGeneration: Boolean(plan.requiresGeneration),
        autoSaveLabel: `已保存 v${result.project.currentVersionNo}`,
        notice: result.created
          ? `已保存为 v${result.project.currentVersionNo}`
          : '与上一版相同，未创建新版本'
      });
      await this.loadVersions(project.id);
    } catch (error) {
      this.setData({ editBusy: false, editError: errorText(error) });
    }
  },

  markDirty() {
    this.setData({ autoSaveLabel: '待保存' });
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = setTimeout(() => {
      this.autoSaveTimer = null;
      this.persistShots(null, { auto: true });
    }, 1500);
  },

  onUnload() {
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = null;
    if (this.data.project && JSON.stringify(this.rawShots) !== this.lastSavedSignature) {
      this.persistShots('离开页面自动保存', { auto: true });
    }
  },

  async persistShots(note, options) {
    if (!this.data.project) return;
    const auto = Boolean(options && options.auto);
    const signature = JSON.stringify(this.rawShots);
    if (auto && signature === this.lastSavedSignature) {
      this.setData({ autoSaveLabel: '已同步' });
      return;
    }
    if (this.savingInFlight) {
      this.pendingSave = { note: note || null, auto };
      return;
    }
    this.savingInFlight = true;
    if (auto) {
      this.setData({ autoSaveLabel: '保存中…' });
    } else {
      this.setData({ saving: true, notice: '', saveError: '' });
    }
    const editState = {
      editOpenShotId: this.data.editOpenShotId,
      editPreset: this.data.editPreset,
      editInstruction: this.data.editInstruction,
      editNotice: this.data.editNotice,
      editGeneration: this.data.editGeneration,
      editError: this.data.editError
    };
    try {
      const result = await request(`/api/merchant/ai-ad/projects/${encodeURIComponent(this.data.project.id)}`, {
        method: 'PATCH',
        timeout: 30000,
        data: {
          conceptKey: this.data.project.conceptKey,
          storyboard: this.rawShots,
          note: note || null,
          resolutionKey: this.data.resolutionKey
        }
      });
      this.applyProject(result.project);
      this.lastSavedSignature = JSON.stringify(result.storyboard || this.rawShots);
      this.setData(Object.assign({}, editState, {
        saving: false,
        autoSaveLabel: `已保存 v${result.project.currentVersionNo}`,
        notice: auto
          ? this.data.notice
          : (result.created ? `已保存为 v${result.project.currentVersionNo}` : '内容与当前版本一致，未产生新版本')
      }));
      await this.loadVersions(result.project.id);
    } catch (error) {
      this.setData({ saving: false, autoSaveLabel: '自动保存失败', saveError: errorText(error) });
    } finally {
      this.savingInFlight = false;
      const pending = this.pendingSave;
      this.pendingSave = null;
      if (pending) {
        setTimeout(() => this.persistShots(pending.note, { auto: pending.auto }), 400);
      }
    }
  },

  saveVersion() {
    if (this.data.saving) return;
    this.persistShots(null);
  },

  async restoreVersion(event) {
    if (this.data.saving) return;
    const versionNo = Number(event.currentTarget.dataset.version);
    const version = (this.versionRows || []).find(row => row.versionNo === versionNo);
    if (!version || !Array.isArray(version.storyboard) || version.storyboard.length === 0) {
      this.setData({ saveError: '该版本没有可恢复的分镜' });
      return;
    }
    this.rawShots = version.storyboard.map(shot => Object.assign({}, shot));
    this.setData({ shots: this.rawShots.map(mapShot) });
    await this.persistShots(`恢复 v${versionNo}`);
  }
});

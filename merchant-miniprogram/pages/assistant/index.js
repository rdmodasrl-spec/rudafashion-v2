const { request, getAssetUrl } = require('../../utils/api');
const { requireMerchantSession } = require('../../utils/page-auth');
const { canAccessTab } = require('../../utils/permissions');
const { syncTabBar } = require('../../utils/tabbar');
const { clearSession, getSession } = require('../../utils/auth');
const { recolorMaskedPixels } = require('../../utils/garment-recolor');
const { createModaCore } = require('../../utils/moda-core');
const { isModauiEnabled, refreshFeatureFlags } = require('../../utils/feature-flags');

const context = 'dashboard';
const scope = 'home';
const modes = [
  { id: 'design', title: '服装设计', description: '文字生成设计方案', icon: '/assets/icons/products.png', prompt: '帮我设计一款服装。先询问我还没有提供的关键信息，再整理成完整的设计方案。' },
  { id: 'generate', title: '图片生成', description: '生成服装图像', icon: '/assets/icons/assistant.png', prompt: '' },
  { id: 'tryon', title: '虚拟试衣', description: '上传图片生成试穿', icon: '/assets/icons/assistant.png', prompt: '请把服装图片中的服装自然地换到人物照片上，保持人物姿势和背景，并呈现真实合身效果。' },
  { id: 'inspiration', title: '设计灵感', description: '生成系列灵感', icon: '/assets/icons/module.png', prompt: '请为我提出三个服装系列创意方向，并说明配色、廓形、面料和适合的客群。' },
  { id: 'productLaunch', title: '商业模特', description: '描述模特与场景', icon: '/assets/icons/assistant.png', prompt: '' },
  { id: 'edit', title: '服装换色', description: '换色并保留纹理', icon: '/assets/icons/module.png', prompt: '' },
  { id: 'fashionVideo', title: '秀场视频', description: '暂未开放', icon: '/assets/icons/module.png', prompt: '', unavailable: true }
];
const homeModes = ['tryon', 'edit', 'fashionVideo', 'productLaunch'].map(id => modes.find(mode => mode.id === id));
const quickModes = ['design', 'generate', 'tryon', 'inspiration'].map(id => modes.find(mode => mode.id === id));
const welcomeLines = [
  'AI 真人试衣',
  '精准换色',
  'AI 秀场视频',
  '模特设计'
];
const welcomeModes = homeModes.map((mode, index) => Object.assign({}, mode, { welcomeText: welcomeLines[index] }));
const recolorColors = [
  { name: '正红', value: '#c62828' },
  { name: '酒红', value: '#7f1d3a' },
  { name: '橘色', value: '#e87524' },
  { name: '奶油黄', value: '#e6ca7a' },
  { name: '森林绿', value: '#286447' },
  { name: '海军蓝', value: '#243b63' },
  { name: '薰衣草', value: '#8b78aa' },
  { name: '黑色', value: '#252525' }
];
const categoryOptions = [
  { label: '上装、衬衫和外套', value: 'tops' },
  { label: '裤装和裙装', value: 'bottoms' },
  { label: '连衣裙和连体服', value: 'one-pieces' }
];

function makeRequestKey(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function displayPlanName(plan) {
  const value = String(plan || '').toLowerCase();
  if (value === 'pro' || value === 'fashion_pro') return value === 'fashion_pro' ? 'Fashion Pro' : 'Pro';
  if (value === 'plus') return 'Plus';
  if (value === 'business') return 'Business';
  return 'Free';
}

function knowledgeStatusLabel(status) {
  const labels = {
    ingested: '待审核',
    published: '已发布',
    superseded: '已被新版本替代',
    rejected: '已拒绝',
    invalidated: '已失效'
  };
  return labels[status] || '状态未知';
}

function knowledgeErrorDetails(error, fallback) {
  if (error && error.code === 'MODAGPT_BRAIN_DISABLED') {
    return {
      disabled: true,
      message: '店铺智库服务尚未启用，请联系管理员完成服务配置后再使用。'
    };
  }
  return {
    disabled: false,
    message: error && error.message || fallback
  };
}

function requestsProcurementDraft(message) {
  return /(?:创建|生成|准备|新建).{0,12}(?:采购草稿|采购单|采购订单|进货单|补货订单)/i.test(message);
}

function merchantTaskErrorMessage(error) {
  const code = error && error.code || '';
  const known = {
    MODAGPT_TASK_PERMISSION_REQUIRED: '当前员工没有采购管理权限，任务未执行。',
    EMPLOYEE_PERMISSION_REQUIRED: '当前员工没有采购管理权限，任务未执行。',
    MODAGPT_TASK_WORKFLOW_UNAVAILABLE: '当前商家行业暂不支持此任务。',
    MODAGPT_TASK_NOT_FOUND: '任务不存在或不属于当前商家。',
    REQUEST_TIMEOUT: '请求超时；如已提交，请使用同一任务重试或查询状态。'
  };
  if (known[code]) return known[code];
  if (error && error.status === 401) return '登录已过期，请重新登录。';
  if (error && error.status === 403) return '缺少采购管理权限，任务未执行。';
  const message = error && typeof error.message === 'string' ? error.message : '';
  if (message && !/^[A-Z0-9_]{6,}$/.test(message)) return message;
  return `任务未能完成${code ? `（${code}）` : ''}。请检查权限和输入后重试。`;
}

function readImageDataUrl(filePath) {
  const extension = String(filePath).split('?')[0].split('.').pop().toLowerCase();
  const contentType = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
    filePath,
    success: result => {
      if (!(result.data instanceof ArrayBuffer)) {
        reject(new Error('无法读取图片，请重新选择。'));
        return;
      }
      resolve(`data:${contentType};base64,${wx.arrayBufferToBase64(result.data)}`);
    },
    fail: () => reject(new Error('无法读取图片，请重新选择。'))
    });
  });
}

function persistImageDataUrl(dataUrl) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!match) return Promise.reject(new Error('图片生成结果格式无效。'));
  const extension = match[1] === 'image/png' ? 'png' : match[1] === 'image/webp' ? 'webp' : 'jpg';
  const filePath = `${wx.env.USER_DATA_PATH}/modaui-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().writeFile({
      filePath,
      data: match[2],
      encoding: 'base64',
      success: () => resolve(filePath),
      fail: () => reject(new Error('无法暂存生成图片，请稍后重试。'))
    });
  });
}

Page({
  data: {
    statusBarHeight: 0,
    section: 'chat',
    messages: [],
    input: '',
    loading: false,
    error: '',
    modes,
    homeModes,
    quickModes,
    visibleHomeModes: [],
    conversations: [],
    filteredConversations: [],
    historyOpen: false,
    historySearch: '',
    menuOpen: false,
    navigationOpen: false,
    navigationAvailable: false,
    toolsOpen: false,
    activeMode: '',
    selectedMode: null,
    entitlements: null,
    personPath: '',
    garmentPath: '',
    personImage: '',
    garmentImage: '',
    consent: false,
    recolorColors,
    recolorColor: '#c62828',
    recolorBrushSize: 34,
    recolorErasing: false,
    recolorImageReady: false,
    recolorHasSelection: false,
    recolorCanvasHeight: 1,
    recolorProgress: '',
    menuPlanLabel: 'Free',
    chatQuotaPercent: 0,
    knowledgeDocuments: [],
    knowledgeLoading: false,
    knowledgeBusy: false,
    knowledgeFeatureDisabled: false,
    knowledgeError: '',
    knowledgeNotice: '',
    knowledgeTitle: '',
    knowledgeSourceId: '',
    knowledgeContent: '',
    knowledgeFormats: [
      { label: 'Markdown', value: 'text/markdown' },
      { label: '纯文本', value: 'text/plain' }
    ],
    knowledgeFormatIndex: 0,
    selectedKnowledgeDocument: null,
    categories: categoryOptions,
    categoryIndex: 0,
    candidateCounts: [2, 3, 4],
    candidateCountIndex: 1,
    launchCounts: [1, 2, 3, 4],
    launchCountIndex: 3,
    productLaunchProgress: '',
    designs: [],
    designsLoading: false,
    designFilter: 'all',
    designFilters: [
      { id: 'all', label: '全部' },
      { id: 'design', label: '服装设计' },
      { id: 'imageGeneration', label: '生成图片' },
      { id: 'tryOn', label: '虚拟试衣' },
      { id: 'favorite', label: '收藏' }
    ],
    selectedDesign: null,
    modauiBlocked: false,
    canSend: false,
    taskMode: false,
    taskPreview: null,
    taskSuppliers: [],
    taskProducts: [],
    taskSkuOptions: [],
    taskSupplierIndex: 0,
    taskProductIndex: 0,
    taskSkuIndex: 0,
    taskQuantity: '1',
    taskUnitCost: '',
    taskAmount: '0.00',
    taskDraftReady: false,
    taskCatalogLoading: false,
    taskIdempotencyLocked: false,
    taskToolSummary: '',
    taskAgentSummary: '',
    taskId: '',
    taskStatus: '',
  },

  onLoad() {
    const systemInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight || 0,
      navigationAvailable: typeof this.getTabBar === 'function'
    });
    this._welcomeIndex = 0;
    this.hideTabBar();
    this.startWelcomeSequence();
  },

  onReady() {
    this.mountModaCore();
  },

  mountModaCore() {
    if (this._modaCore || this.data.messages.length || this.data.section !== 'chat') return;
    wx.createSelectorQuery().in(this).select('#modaui-core').fields({ node: true, size: true }).exec(result => {
      const entry = result && result[0];
      if (!entry || !entry.node || !entry.width || !entry.height || this._modaCore) return;
      const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      let core = null;
      core = createModaCore({
        canvas: entry.node,
        width: entry.width,
        height: entry.height,
        pixelRatio: windowInfo.pixelRatio || 1,
        readState: () => {
          if (this.data.messages.length) {
            if (core) core.stop();
            return 'idle';
          }
          if (this.data.loading) {
            this._modaCoreWasLoading = true;
            return 'thinking';
          }
          if (this.data.error) return 'error';
          if (this._modaCoreWasLoading) {
            this._modaCoreWasLoading = false;
            this._modaCoreFlashUntil = Date.now() + 1600;
          }
          if (this._modaCoreFlashUntil && Date.now() < this._modaCoreFlashUntil) return 'success';
          return 'idle';
        }
      });
      this._modaCore = core;
      core.start();
    });
  },

  unmountModaCore() {
    if (!this._modaCore) return;
    this._modaCore.dispose();
    this._modaCore = null;
  },

  async onShow() {
    const navigationAvailable = typeof this.getTabBar === 'function';
    if (navigationAvailable !== this.data.navigationAvailable) this.setData({ navigationAvailable });
    this.hideTabBar();
    try {
      const auth = await requireMerchantSession(this);
      if (auth) syncTabBar(this, auth, 'assistant');
      if (!auth) return;
      // 平台功能开关关闭时，收藏链接或历史路由进入也必须停在此页，不发起任何生成请求。
      await refreshFeatureFlags();
      if (!isModauiEnabled()) {
        this.stopWelcomeSequence();
        this.unmountModaCore();
        this.setData({ modauiBlocked: true, messages: [], input: '', canSend: false, error: '' });
        return;
      }
      if (this.data.modauiBlocked) this.setData({ modauiBlocked: false });
      if (!this.data.messages.length && this.data.section === 'chat') {
        this.startWelcomeSequence();
        wx.nextTick(() => this.mountModaCore());
      }
      if (!canAccessTab(auth, 'assistant')) {
        this.setData({ error: '当前账号没有 ModaUI 访问权限。', messages: [], input: '', canSend: false });
        return;
      }
      if (!this._initialized) {
        this._initialized = true;
        await Promise.all([this.loadEntitlements(), this.loadConversations(true)]);
        return;
      }
      void this.loadConversations(false);
    } catch (error) {
      this.setData({ error: error.message || '账号验证失败。' });
    }
  },

  onHide() {
    this.stopWelcomeSequence();
    this.unmountModaCore();
    this.showTabBar();
  },

  onUnload() {
    this.stopWelcomeSequence();
    this.unmountModaCore();
    this.showTabBar();
  },

  customTabBar() {
    return typeof this.getTabBar === 'function' ? this.getTabBar() : null;
  },

  hideTabBar() {
    const tabBar = this.customTabBar();
    if (tabBar && typeof tabBar.setHidden === 'function') {
      tabBar.setHidden(true);
      return;
    }
    if (typeof wx.hideTabBar !== 'function') return;
    wx.hideTabBar({ animation: false, fail: () => {} });
  },

  showTabBar() {
    const tabBar = this.customTabBar();
    if (tabBar && typeof tabBar.setHidden === 'function') {
      tabBar.setHidden(false);
      return;
    }
    if (typeof wx.showTabBar !== 'function') return;
    wx.showTabBar({ animation: false, fail: () => {} });
  },

  toggleNavigation() {
    if (!this.data.navigationAvailable) return;
    const opening = !this.data.navigationOpen;
    this.setNavigationOpen(opening);
  },

  setNavigationOpen(opening) {
    if (!this.data.navigationAvailable) return;
    if (this.data.navigationOpen === opening) return;
    this.setData({ navigationOpen: opening });
    if (opening) {
      const tabBar = this.customTabBar();
      if (tabBar && typeof tabBar.setHidden === 'function') {
        tabBar.setHidden(false);
        return;
      }
      wx.showTabBar({
        animation: true,
        fail: () => {
          this.setData({ navigationOpen: false });
          wx.showToast({ title: '底部导航暂不可用', icon: 'none' });
        }
      });
    } else {
      this.hideTabBar();
    }
  },

  onNavTouchStart(event) {
    const touch = (event.touches && event.touches[0]) || (event.changedTouches && event.changedTouches[0]);
    this._navTouchStartY = touch ? touch.clientY : null;
  },

  onNavTouchMove() {
    // 拖动期间只记录纵向位移，不切换状态，避免拖动过程中反复开合。
  },

  onNavTouchEnd(event) {
    const startY = this._navTouchStartY;
    this._navTouchStartY = null;
    if (startY === null || startY === undefined) return;
    const touch = (event.changedTouches && event.changedTouches[0]) || (event.touches && event.touches[0]);
    if (!touch) return;
    const delta = startY - touch.clientY;
    if (Math.abs(delta) < 18) return;
    this.setNavigationOpen(delta > 0);
  },

  onNavTouchCancel() {
    this._navTouchStartY = null;
  },

  startWelcomeSequence() {
    if (this._welcomeTimer || this.data.messages.length || this.data.section !== 'chat') return;
    if (this._welcomeIndex >= welcomeModes.length) return;
    this.revealWelcomeMode();
  },

  revealWelcomeMode() {
    const index = this._welcomeIndex || 0;
    if (index >= welcomeModes.length || this.data.messages.length || this.data.section !== 'chat') return;
    this._welcomeIndex = index + 1;
    this.setData({ visibleHomeModes: this.data.visibleHomeModes.concat([welcomeModes[index]]) });
    if (this._welcomeIndex < welcomeModes.length) {
      this._welcomeTimer = setTimeout(() => {
        this._welcomeTimer = null;
        this.revealWelcomeMode();
      }, 5000);
    }
  },

  stopWelcomeSequence() {
    if (this._welcomeTimer) clearTimeout(this._welcomeTimer);
    this._welcomeTimer = null;
  },

  async loadEntitlements() {
    try {
    const result = await request('/api/merchant/modagpt/entitlements');
    const quota = Number(result.quotas && result.quotas.chat) || 0;
    const remaining = Number(result.remaining && result.remaining.chat) || 0;
    const percent = quota > 0 ? Math.max(0, Math.min(100, remaining / quota * 100)) : 0;
    const menuPlanLabel = displayPlanName(result.plan);
    this.setData({
      entitlements: result,
      menuPlanLabel,
      chatQuotaPercent: percent,
      error: ''
    });
    } catch (error) {
    this.setData({ error: error.message || 'AI 权益读取失败，请稍后重试。' });
    }
  },

  async loadConversations(openLatest) {
    try {
    const result = await request(`/api/merchant/assistant/conversations?context=${context}&scope=${scope}`);
    const conversations = Array.isArray(result.conversations) ? result.conversations : [];
    this.setData({ conversations, error: '' }, () => this.applyHistorySearch());
    if (openLatest && conversations.length) await this.openConversation(conversations[0].id);
    } catch (error) {
    this.setData({ error: error.message || '对话历史加载失败，请重试。' });
    }
  },

  async openConversation(id) {
    if (!id || this.data.loading) return;
    this.stopWelcomeSequence();
    this._conversationId = id;
    this.setData({ messages: [], historyOpen: false, menuOpen: false, error: '' });
    try {
    const result = await request(`/api/merchant/assistant/conversations/${encodeURIComponent(id)}?context=${context}&scope=${scope}`);
    if (this._conversationId !== id) return;
    const messages = (result.conversation && result.conversation.messages || [])
      .filter(item => item.role === 'user' || item.role === 'assistant')
      .map(item => ({
        id: item.id,
        role: item.role,
        content: item.text || '',
        actions: item.actions || []
      }));
    this.setData({ messages });
    } catch (error) {
    this.setData({ error: error.message || '无法打开这段对话，请重试。' });
    }
  },

  startNewConversation() {
    if (this.data.loading) return;
    if (this._pendingTaskRequestKey || this.data.taskId) {
      this.setData({ error: '当前任务结果尚未确认，请先查询任务状态。' });
      return;
    }
    this.stopWelcomeSequence();
    this._conversationId = '';
    this._pendingChatRequestKey = '';
    this._pendingTaskRequestKey = '';
    this._welcomeIndex = 0;
    this.setData({
    messages: [],
    visibleHomeModes: [],
    input: '',
    canSend: false,
    error: '',
    section: 'chat',
    activeMode: '',
    selectedMode: null,
    historyOpen: false,
    menuOpen: false,
    toolsOpen: false,
    taskMode: false,
    taskPreview: null,
    taskSuppliers: [],
    taskProducts: [],
    taskSkuOptions: [],
    taskSupplierIndex: 0,
    taskProductIndex: 0,
    taskSkuIndex: 0,
    taskQuantity: '1',
    taskUnitCost: '',
    taskAmount: '0.00',
    taskDraftReady: false,
    taskCatalogLoading: false,
    taskIdempotencyLocked: false,
    taskToolSummary: '',
    taskAgentSummary: '',
    taskId: '',
    taskStatus: '',
    personPath: '',
    garmentPath: '',
    personImage: '',
    garmentImage: '',
    consent: false
    }, () => {
      this.startWelcomeSequence();
      this.mountModaCore();
    });
  },

  toggleHistory() {
    const opening = !this.data.historyOpen;
    this.setData({ historyOpen: opening, menuOpen: false, toolsOpen: false });
    if (opening) void this.loadConversations(false);
  },

  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 });
      return;
    }
    wx.switchTab({ url: '/pages/dashboard/index' });
  },

  onHistorySearch(event) {
    this.setData({ historySearch: event.detail.value || '' }, () => this.applyHistorySearch());
  },

  applyHistorySearch() {
    const query = String(this.data.historySearch || '').trim().toLowerCase();
    const filteredConversations = this.data.conversations.filter(item =>
      !query || String(item.title || '').toLowerCase().includes(query)
    );
    this.setData({ filteredConversations });
  },

  toggleMenu() {
    const opening = !this.data.menuOpen;
    this.setData({ menuOpen: opening, historyOpen: false, toolsOpen: false });
    if (opening) void this.loadConversations(false);
  },

  closeOverlays() {
    this.setData({ menuOpen: false, historyOpen: false, toolsOpen: false });
  },

  openSection(event) {
    const section = event.currentTarget.dataset.section;
    if (section !== 'chat') this.stopWelcomeSequence();
    this.setData({ section, menuOpen: false, historyOpen: false, toolsOpen: false, error: '' });
    if (section === 'designs') void this.loadDesigns();
    if (section === 'knowledge') void this.loadKnowledgeDocuments();
  },

  async loadKnowledgeDocuments() {
    this.setData({ knowledgeLoading: true, knowledgeError: '' });
    try {
      const result = await request('/api/merchant/modagpt/brain/documents');
      const knowledgeDocuments = (Array.isArray(result.documents) ? result.documents : []).map(item =>
        Object.assign({}, item, { statusLabel: knowledgeStatusLabel(item.status) })
      );
      this.setData({ knowledgeDocuments, knowledgeFeatureDisabled: false, knowledgeError: '' });
    } catch (error) {
      const details = knowledgeErrorDetails(error, '知识库读取失败，请确认账号权限后重试。');
      this.setData({
        knowledgeFeatureDisabled: details.disabled,
        knowledgeError: details.message
      });
    } finally {
      this.setData({ knowledgeLoading: false });
    }
  },

  onKnowledgeTitleInput(event) {
    this.setData({ knowledgeTitle: event.detail.value || '' });
  },

  onKnowledgeSourceInput(event) {
    this.setData({ knowledgeSourceId: event.detail.value || '' });
  },

  onKnowledgeContentInput(event) {
    this.setData({ knowledgeContent: event.detail.value || '' });
  },

  onKnowledgeFormatChange(event) {
    const index = Number(event.detail.value);
    if (this.data.knowledgeFormats[index]) this.setData({ knowledgeFormatIndex: index });
  },

  async submitKnowledgeDocument() {
    if (this.data.knowledgeBusy || !this.data.knowledgeTitle.trim() || !this.data.knowledgeContent.trim()) return;
    this.setData({ knowledgeBusy: true, knowledgeError: '', knowledgeNotice: '' });
    try {
      const format = this.data.knowledgeFormats[this.data.knowledgeFormatIndex];
      await request('/api/merchant/modagpt/brain/documents', {
        method: 'POST',
        data: {
          title: this.data.knowledgeTitle.trim(),
          sourceId: this.data.knowledgeSourceId.trim() || undefined,
          mimeType: format.value,
          content: this.data.knowledgeContent
        }
      });
      this.setData({
        knowledgeTitle: '',
        knowledgeSourceId: '',
        knowledgeContent: '',
        knowledgeNotice: '文档已提交审核；审核通过前不会作为 ModaUI 的知识回答。'
      });
      await this.loadKnowledgeDocuments();
    } catch (error) {
      const details = knowledgeErrorDetails(error, '提交知识文档失败，请重试。');
      this.setData({
        knowledgeFeatureDisabled: details.disabled,
        knowledgeError: details.message
      });
    } finally {
      this.setData({ knowledgeBusy: false });
    }
  },

  async openKnowledgeDocument(event) {
    const id = event.currentTarget.dataset.id;
    if (!id || this.data.knowledgeBusy) return;
    this.setData({ knowledgeBusy: true, knowledgeError: '' });
    try {
      const result = await request(`/api/merchant/modagpt/brain/documents/${encodeURIComponent(id)}`);
      this.setData({
        selectedKnowledgeDocument: Object.assign({}, result.document, {
          statusLabel: knowledgeStatusLabel(result.document.status)
        })
      });
    } catch (error) {
      const details = knowledgeErrorDetails(error, '无法读取知识文档。');
      this.setData({
        knowledgeFeatureDisabled: details.disabled,
        knowledgeError: details.message
      });
    } finally {
      this.setData({ knowledgeBusy: false });
    }
  },

  closeKnowledgeDocument() {
    this.setData({ selectedKnowledgeDocument: null });
  },

  async reviewKnowledgeDocument(event) {
    const document = this.data.selectedKnowledgeDocument;
    const decision = event.currentTarget.dataset.decision;
    if (!document || !['approve', 'reject'].includes(decision) || this.data.knowledgeBusy) return;
    this.setData({ knowledgeBusy: true, knowledgeError: '', knowledgeNotice: '' });
    try {
      await request(`/api/merchant/modagpt/brain/documents/${encodeURIComponent(document.id)}/review`, {
        method: 'PATCH',
        data: { decision }
      });
      this.setData({
        selectedKnowledgeDocument: null,
        knowledgeNotice: decision === 'approve' ? '文档审核通过，已可供 ModaUI 检索。' : '文档已拒绝。'
      });
      await this.loadKnowledgeDocuments();
    } catch (error) {
      const details = knowledgeErrorDetails(error, '文档审核失败，请确认审核权限后重试。');
      this.setData({
        knowledgeFeatureDisabled: details.disabled,
        knowledgeError: details.message
      });
    } finally {
      this.setData({ knowledgeBusy: false });
    }
  },

  async invalidateKnowledgeDocument() {
    const document = this.data.selectedKnowledgeDocument;
    if (!document || this.data.knowledgeBusy) return;
    this.setData({ knowledgeBusy: true, knowledgeError: '', knowledgeNotice: '' });
    try {
      await request(`/api/merchant/modagpt/brain/documents/${encodeURIComponent(document.id)}/invalidate`, {
        method: 'POST',
        data: {}
      });
      this.setData({ selectedKnowledgeDocument: null, knowledgeNotice: '文档已标记为失效。' });
      await this.loadKnowledgeDocuments();
    } catch (error) {
      const details = knowledgeErrorDetails(error, '文档失效操作失败，请重试。');
      this.setData({
        knowledgeFeatureDisabled: details.disabled,
        knowledgeError: details.message
      });
    } finally {
      this.setData({ knowledgeBusy: false });
    }
  },

  selectMode(event) {
    const mode = modes.find(item => item.id === event.currentTarget.dataset.mode);
    if (!mode) return;
    if (mode.id === 'fashionVideo') {
    wx.showModal({
      title: '视频生成暂不可用',
      content: '当前服务端没有接入 AI 秀场视频生成接口。视频导入和剪辑不等于 AI 生成，因此这里不会伪装成已开通，也不会扣额度。',
      confirmText: '知道了',
      showCancel: false
    });
    return;
    }
    if (mode.id === 'edit') {
      this.stopWelcomeSequence();
      this.setData({
        section: 'chat',
        activeMode: mode.id,
        selectedMode: mode,
        menuOpen: false,
        toolsOpen: false,
        error: '',
        recolorImageReady: false,
        recolorHasSelection: false,
        recolorProgress: ''
      });
      return;
    }
    if (mode.unavailable) {
      wx.showToast({ title: '该功能暂未开放', icon: 'none' });
      return;
    }
    this.stopWelcomeSequence();
    this.setData({
    section: 'chat',
    activeMode: mode.id,
    selectedMode: mode,
    input: mode.prompt || this.data.input,
    canSend: Boolean((mode.prompt || this.data.input).trim()),
    menuOpen: false,
    toolsOpen: false,
    error: ''
    });
  },

  exitMode() {
    this.setData({ activeMode: '', selectedMode: null, personPath: '', garmentPath: '', personImage: '', garmentImage: '', consent: false });
  },

  onInput(event) {
    const input = event.detail.value;
    if (input !== this.data.input) this._pendingChatRequestKey = '';
    this.setData({ input, canSend: Boolean(input.trim()) || this.data.attachmentsReady, error: '' });
  },

  toggleTaskMode() {
    if (this.data.loading) return;
    if (this._pendingTaskRequestKey) {
      this.setData({ error: '提交结果尚未确认，请使用同一请求重试，避免重复采购。' });
      return;
    }
    const enabled = !this.data.taskMode;
    const previousMessage = this.data.taskPreview && this.data.taskPreview.message || '';
    this.setData({
      taskMode: enabled,
      taskPreview: null,
      taskSuppliers: [],
      taskProducts: [],
      taskSkuOptions: [],
      activeMode: '',
      selectedMode: null,
      input: previousMessage || this.data.input,
      canSend: Boolean(previousMessage || this.data.input.trim()),
      error: '',
      toolsOpen: false
    });
  },

  updateTaskDraftState(changes) {
    const next = Object.assign({}, this.data, changes || {});
    const supplier = next.taskSuppliers[next.taskSupplierIndex];
    const product = next.taskProducts[next.taskProductIndex];
    const sku = next.taskSkuOptions[next.taskSkuIndex];
    const quantity = Number(next.taskQuantity);
    const unitCost = Number(next.taskUnitCost);
    const ready = Boolean(
      supplier && supplier.id
      && product && product.id
      && sku && sku.variantId
      && String(next.taskQuantity).trim()
      && Number.isInteger(quantity) && quantity > 0
      && String(next.taskUnitCost).trim()
      && Number.isFinite(unitCost) && unitCost >= 0
    );
    this.setData(Object.assign({}, changes || {}, {
      taskDraftReady: ready,
      taskAmount: ready ? (quantity * unitCost).toFixed(2) : '0.00'
    }));
  },

  onTaskSupplierChange(event) {
    this.updateTaskDraftState({ taskSupplierIndex: Number(event.detail.value) || 0 });
  },

  onTaskProductChange(event) {
    const index = Number(event.detail.value) || 0;
    const product = this.data.taskProducts[index];
    const skuOptions = (product && product.skus || []).filter(item => item.variantId && item.isActive !== false);
    this.updateTaskDraftState({
      taskProductIndex: index,
      taskSkuOptions: skuOptions,
      taskSkuIndex: 0
    });
  },

  onTaskSkuChange(event) {
    this.updateTaskDraftState({ taskSkuIndex: Number(event.detail.value) || 0 });
  },

  onTaskDraftInput(event) {
    const field = event.currentTarget.dataset.field;
    if (field !== 'quantity' && field !== 'unitCost') return;
    const changes = {};
    changes[field === 'quantity' ? 'taskQuantity' : 'taskUnitCost'] = event.detail.value;
    this.updateTaskDraftState(changes);
  },

  async previewMerchantTask(message) {
    const preview = await request('/api/merchant/modagpt/task/preview', {
      method: 'POST',
      timeout: 30000,
      data: { message }
    });
    const draftRequired = preview.workflow === 'procurement_management' && requestsProcurementDraft(message);
    let taskSuppliers = [];
    let taskProducts = [];
    let taskSkuOptions = [];
    let taskSupplierIndex = 0;
    let taskProductIndex = 0;
    let taskSkuIndex = 0;
    if (draftRequired) {
      this.setData({ taskCatalogLoading: true });
      try {
        const results = await Promise.all([
          request('/api/merchant/suppliers'),
          request('/api/merchant/products')
        ]);
        taskSuppliers = (results[0].suppliers || []).filter(supplier => supplier.status === 'active');
        taskProducts = (results[1].products || []).filter(product =>
          product.lifecycleStatus !== 'archived'
          && Array.isArray(product.skus)
          && product.skus.some(sku => sku.variantId && sku.isActive !== false)
        );
        if (taskProducts.length) {
          taskSkuOptions = taskProducts[0].skus.filter(sku => sku.variantId && sku.isActive !== false);
        }
      } finally {
        this.setData({ taskCatalogLoading: false });
      }
    }
    this._pendingTaskRequestKey = '';
    this.setData({
      taskPreview: Object.assign({}, preview, { message, draftRequired }),
      taskToolSummary: Array.isArray(preview.tools) ? preview.tools.join(' · ') : '—',
      taskAgentSummary: Array.isArray(preview.agents) ? preview.agents.join(' · ') : '—',
      taskSuppliers,
      taskProducts,
      taskSkuOptions,
      taskSupplierIndex,
      taskProductIndex,
      taskSkuIndex,
      taskQuantity: '1',
      taskUnitCost: '',
      taskDraftReady: false,
      taskAmount: '0.00',
      taskId: '',
      taskStatus: '',
      taskIdempotencyLocked: false,
      input: '',
      canSend: false,
      error: '',
      taskCatalogLoading: false
    }, () => this.updateTaskDraftState({}));
  },

  cancelTaskPreview() {
    if (this._pendingTaskRequestKey) {
      this.setData({ error: '提交结果尚未确认，请使用同一请求重试，避免重复采购。' });
      return;
    }
    const message = this.data.taskPreview && this.data.taskPreview.message || '';
    this.setData({
      taskPreview: null,
      taskSuppliers: [],
      taskProducts: [],
      taskSkuOptions: [],
      input: message,
      canSend: Boolean(message),
      taskIdempotencyLocked: false,
      error: ''
    });
  },

  async confirmMerchantTask() {
    const preview = this.data.taskPreview;
    if (!preview || this.data.loading) return;
    let inputs = {};
    if (preview.draftRequired) {
      if (!this.data.taskDraftReady) {
        this.setData({ error: '请选择有效供应商、商品和 SKU，并填写正整数数量及非负单位成本。' });
        return;
      }
      const supplier = this.data.taskSuppliers[this.data.taskSupplierIndex];
      const product = this.data.taskProducts[this.data.taskProductIndex];
      const sku = this.data.taskSkuOptions[this.data.taskSkuIndex];
      inputs = {
        create_procurement_draft: {
          supplierId: supplier.id,
          items: [{
            productId: product.id,
            variantId: sku.variantId,
            quantity: Number(this.data.taskQuantity),
            unitCost: Number(this.data.taskUnitCost)
          }],
          currency: 'EUR'
        }
      };
    }
    if (!this._pendingTaskRequestKey) this._pendingTaskRequestKey = makeRequestKey('merchant-task');
    this.setData({ loading: true, error: '', taskIdempotencyLocked: true });
    try {
      const created = await request('/api/merchant/modagpt/task', {
        method: 'POST',
        timeout: 30000,
        headers: { 'Idempotency-Key': this._pendingTaskRequestKey },
        data: {
          message: preview.message,
          conversationId: this._conversationId || undefined,
          inputs
        }
      });
      if (!created || typeof created.taskId !== 'string' || !created.taskId) {
        throw new Error('MODAGPT_TASK_RESPONSE_INVALID');
      }
      this._pendingTaskRequestKey = '';
      this._activeTaskStatusMessageId = `task-status-${created.taskId}`;
      const userMessage = { role: 'user', content: preview.message };
      const statusMessage = {
        id: this._activeTaskStatusMessageId,
        role: 'assistant',
        content: `任务已提交（${created.taskId}），正在读取服务端状态。`,
        actions: []
      };
      this.setData({
        taskPreview: null,
        taskMode: true,
        taskId: created.taskId,
        taskStatus: statusMessage.content,
        messages: this.data.messages.concat([userMessage, statusMessage])
      });
      await this.pollMerchantTask(created.taskId);
    } catch (error) {
      this.setData({ error: merchantTaskErrorMessage(error) });
    } finally {
      this.setData({ loading: false });
    }
  },

  async pollMerchantTask(taskId) {
    try {
      let latest = null;
      for (let attempt = 0; attempt < 60; attempt += 1) {
        latest = await request(`/api/merchant/modagpt/task/${encodeURIComponent(taskId)}`, { timeout: 20000 });
        if (['completed', 'failed', 'dead_letter', 'cancelled', 'waiting_approval'].includes(latest.runtimeStatus)) break;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      if (!latest || typeof latest.runtimeStatus !== 'string') throw new Error('MODAGPT_TASK_STATUS_INVALID');
      const terminal = ['completed', 'failed', 'dead_letter', 'cancelled', 'waiting_approval'].includes(latest.runtimeStatus);
      const errors = Array.isArray(latest.errors) ? latest.errors.filter(item => typeof item === 'string') : [];
      const finalStatus = latest.runtimeStatus === 'waiting_approval'
        ? `任务等待商家审批${latest.approvalId ? `（${latest.approvalId}）` : ''}；审批前不会执行敏感操作。${latest.summary || ''}`
        : ['failed', 'dead_letter', 'cancelled'].includes(latest.runtimeStatus)
          ? `任务未完成（${latest.runtimeStatus}）：${errors.join('、') || '请检查任务后重试。'}`
          : latest.runtimeStatus === 'completed'
            ? latest.status === 'needs_input'
              ? `任务尚未创建采购草稿：${latest.summary || '请补充必需的采购信息后重新提交。'}`
              : `任务已完成：${latest.summary || latest.status}。`
            : `任务仍在处理中，任务编号：${taskId}。`;
      const messages = this.data.messages.map(item => item.id === this._activeTaskStatusMessageId
        ? Object.assign({}, item, { content: finalStatus })
        : item);
      this.setData({
        messages,
        taskStatus: terminal ? '' : finalStatus,
        taskId: terminal ? '' : taskId
      });
    } catch (error) {
      const finalStatus = `任务已受理（${taskId}），但暂时无法读取状态：${merchantTaskErrorMessage(error)}`;
      const messages = this.data.messages.map(item => item.id === this._activeTaskStatusMessageId
        ? Object.assign({}, item, { content: finalStatus })
        : item);
      this.setData({ messages, taskStatus: finalStatus, taskId });
    }
  },

  async retryMerchantTaskStatus() {
    if (!this.data.taskId || this.data.loading) return;
    this.setData({ loading: true });
    try {
      await this.pollMerchantTask(this.data.taskId);
    } finally {
      this.setData({ loading: false });
    }
  },

  toggleTools() {
    this.setData({ toolsOpen: !this.data.toolsOpen, menuOpen: false });
  },

  chooseTryOnImage(event) {
    if (this.data.loading) return;
    const field = event.currentTarget.dataset.field;
    wx.chooseMedia({
    count: 1,
    mediaType: ['image'],
    sourceType: ['album', 'camera'],
    sizeType: ['compressed'],
    success: async result => {
      const file = result.tempFiles && result.tempFiles[0];
      if (!file || !file.tempFilePath) return;
      if (file.size > 3 * 1024 * 1024) {
        this.setData({ error: '图片不能超过 3 MB。' });
        return;
      }
      try {
        const image = await readImageDataUrl(file.tempFilePath);
        if (field === 'person') this.setData({ personPath: file.tempFilePath, personImage: image, error: '' });
        else this.setData({ garmentPath: file.tempFilePath, garmentImage: image, error: '' });
      } catch (error) {
        this.setData({ error: error.message || '无法读取图片。' });
      }
    },
    fail: error => {
      if (!String(error.errMsg || '').includes('cancel')) this.setData({ error: '无法选择图片。' });
    }
    });
  },

  onCategoryChange(event) {
    const categoryIndex = Number(event.detail.value);
    if (this.data.categories[categoryIndex]) this.setData({ categoryIndex });
  },

  onConsentChange(event) {
    this.setData({ consent: Boolean(event.detail.value && event.detail.value.length) });
  },

  chooseRecolorImage() {
    if (this.data.loading) return;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: async result => {
        const file = result.tempFiles && result.tempFiles[0];
        if (!file || !file.tempFilePath) return;
        if (file.size > 8 * 1024 * 1024) {
          this.setData({ error: '图片不能超过 8 MB。' });
          return;
        }
        try {
          await this.loadRecolorImage(file.tempFilePath);
          this.setData({ error: '' });
        } catch (error) {
          this.setData({ recolorImageReady: false, error: error.message || '图片无法读取，请重新选择。' });
        }
      },
      fail: error => {
        if (!String(error.errMsg || '').includes('cancel')) this.setData({ error: '无法选择服装图片。' });
      }
    });
  },

  loadRecolorImage(filePath) {
    return new Promise((resolve, reject) => {
      wx.createSelectorQuery().in(this)
        .select('#recolor-source').fields({ node: true, size: true })
        .select('#recolor-mask').fields({ node: true, size: true })
        .exec(result => {
          const sourceInfo = result && result[0];
          const maskInfo = result && result[1];
          if (!sourceInfo || !maskInfo || !sourceInfo.node || !maskInfo.node) {
            reject(new Error('图片编辑器初始化失败，请重新进入换色工具。'));
            return;
          }
          const sourceCanvas = sourceInfo.node;
          const maskCanvas = maskInfo.node;
          const sourceContext = sourceCanvas.getContext('2d');
          const maskContext = maskCanvas.getContext('2d');
          if (!sourceContext || !maskContext) {
            reject(new Error('当前微信版本不支持图片编辑，请升级微信后重试。'));
            return;
          }
          const image = sourceCanvas.createImage();
          image.onload = () => {
            const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
            const width = Math.max(1, Math.round(image.width * scale));
            const height = Math.max(1, Math.round(image.height * scale));
            sourceCanvas.width = width;
            sourceCanvas.height = height;
            maskCanvas.width = width;
            maskCanvas.height = height;
            sourceContext.drawImage(image, 0, 0, width, height);
            maskContext.clearRect(0, 0, width, height);
            this._recolorSourceCanvas = sourceCanvas;
            this._recolorMaskCanvas = maskCanvas;
            this._recolorSourcePixels = sourceContext.getImageData(0, 0, width, height);
            this._recolorBrushSize = this.data.recolorBrushSize;
            this._recolorDrawing = false;
            this._recolorUndo = null;
            const displayWidth = sourceInfo.width || sourceCanvas.width;
            this.setData({
              recolorCanvasHeight: Math.max(1, Math.round(displayWidth * height / width)),
              recolorImageReady: true,
              recolorHasSelection: false,
              recolorProgress: ''
            }, () => {
              wx.createSelectorQuery().in(this).select('#recolor-mask').boundingClientRect(rect => {
                this._recolorRect = rect;
                resolve();
              }).exec();
            });
          };
          image.onerror = () => reject(new Error('服装图片无法解码，请换一张 JPG、PNG 或 WebP 图片。'));
          image.src = filePath;
        });
    });
  },

  getRecolorPoint(event) {
    const touch = event.touches && event.touches[0];
    const rect = this._recolorRect;
    const canvas = this._recolorMaskCanvas;
    if (!touch || !rect || !canvas || !rect.width || !rect.height) return null;
    return {
      x: Math.max(0, Math.min(canvas.width, (touch.pageX - rect.left) * canvas.width / rect.width)),
      y: Math.max(0, Math.min(canvas.height, (touch.pageY - rect.top) * canvas.height / rect.height))
    };
  },

  drawRecolorStroke(from, to) {
    const canvas = this._recolorMaskCanvas;
    if (!canvas) return;
    const context2d = canvas.getContext('2d');
    const rect = this._recolorRect;
    if (!context2d || !rect || !rect.width) return;
    context2d.save();
    context2d.globalCompositeOperation = this.data.recolorErasing ? 'destination-out' : 'source-over';
    context2d.globalAlpha = this.data.recolorErasing ? 1 : 0.4;
    context2d.strokeStyle = '#1685d1';
    context2d.lineCap = 'round';
    context2d.lineJoin = 'round';
    context2d.lineWidth = this.data.recolorBrushSize * (wx.getWindowInfo ? wx.getWindowInfo().windowWidth : wx.getSystemInfoSync().windowWidth) / 750 * canvas.width / rect.width;
    context2d.beginPath();
    context2d.moveTo(from.x, from.y);
    context2d.lineTo(to.x, to.y);
    context2d.stroke();
    context2d.restore();
  },

  onRecolorTouchStart(event) {
    if (!this.data.recolorImageReady || this.data.loading || !this._recolorMaskCanvas) return;
    const point = this.getRecolorPoint(event);
    const context2d = this._recolorMaskCanvas.getContext('2d');
    if (!point || !context2d) return;
    this._recolorUndo = context2d.getImageData(0, 0, this._recolorMaskCanvas.width, this._recolorMaskCanvas.height);
    this._recolorDrawing = true;
    this._recolorLastPoint = point;
    this.drawRecolorStroke(point, point);
  },

  onRecolorTouchMove(event) {
    if (!this._recolorDrawing || !this._recolorLastPoint) return;
    const point = this.getRecolorPoint(event);
    if (!point) return;
    this.drawRecolorStroke(this._recolorLastPoint, point);
    this._recolorLastPoint = point;
  },

  onRecolorTouchEnd() {
    if (!this._recolorDrawing || !this._recolorMaskCanvas) return;
    this._recolorDrawing = false;
    this._recolorLastPoint = null;
    this.updateRecolorSelection();
  },

  updateRecolorSelection() {
    if (!this._recolorMaskCanvas) return;
    const pixels = this._recolorMaskCanvas.getContext('2d').getImageData(0, 0, this._recolorMaskCanvas.width, this._recolorMaskCanvas.height).data;
    let selected = false;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] > 0) {
        selected = true;
        break;
      }
    }
    this.setData({ recolorHasSelection: selected });
  },

  onRecolorBrushSizeChange(event) {
    const size = Number(event.detail.value);
    if (Number.isFinite(size)) this.setData({ recolorBrushSize: size });
  },

  selectRecolorColor(event) {
    const color = event.currentTarget.dataset.color;
    if (/^#[0-9a-f]{6}$/i.test(color || '')) this.setData({ recolorColor: color });
  },

  setRecolorEraser(event) {
    this.setData({ recolorErasing: Boolean(Number(event.currentTarget.dataset.value)) });
  },

  undoRecolorStroke() {
    if (!this._recolorUndo || !this._recolorMaskCanvas) return;
    const context2d = this._recolorMaskCanvas.getContext('2d');
    context2d.putImageData(this._recolorUndo, 0, 0);
    this._recolorUndo = null;
    this.updateRecolorSelection();
  },

  clearRecolorSelection() {
    if (!this._recolorMaskCanvas || this.data.loading) return;
    this._recolorMaskCanvas.getContext('2d').clearRect(0, 0, this._recolorMaskCanvas.width, this._recolorMaskCanvas.height);
    this._recolorUndo = null;
    this.setData({ recolorHasSelection: false });
  },

  async generateRecolor() {
    if (this.data.loading || !this.data.recolorImageReady || !this.data.recolorHasSelection || !this._recolorSourcePixels || !this._recolorMaskCanvas) return;
    this.setData({ loading: true, error: '', recolorProgress: '正在保留明暗与纹理并生成换色预览…' });
    try {
      const maskData = this._recolorMaskCanvas.getContext('2d').getImageData(0, 0, this._recolorMaskCanvas.width, this._recolorMaskCanvas.height).data;
      const maskAlpha = new Uint8ClampedArray(maskData.length / 4);
      for (let pixel = 0; pixel < maskAlpha.length; pixel += 1) maskAlpha[pixel] = Math.min(255, Math.round(maskData[pixel * 4 + 3] / 0.4));
      const source = this._recolorSourcePixels.data;
      const resultPixels = new Uint8ClampedArray(source);
      const target = this.data.recolorColor;
      for (let start = 0; start < maskAlpha.length; start += 40000) {
        const end = Math.min(start + 40000, maskAlpha.length);
        const recolored = recolorMaskedPixels(source.subarray(start * 4, end * 4), maskAlpha.subarray(start, end), target);
        resultPixels.set(recolored, start * 4);
        if (end < maskAlpha.length) await new Promise(resolve => setTimeout(resolve, 0));
      }
      const sourceContext = this._recolorSourceCanvas.getContext('2d');
      const resultImage = sourceContext.createImageData(this._recolorSourceCanvas.width, this._recolorSourceCanvas.height);
      resultImage.data.set(resultPixels);
      sourceContext.putImageData(resultImage, 0, 0);
      const filePath = await new Promise((resolve, reject) => wx.canvasToTempFilePath({
        canvas: this._recolorSourceCanvas,
        x: 0,
        y: 0,
        width: this._recolorSourceCanvas.width,
        height: this._recolorSourceCanvas.height,
        destWidth: this._recolorSourceCanvas.width,
        destHeight: this._recolorSourceCanvas.height,
        fileType: 'jpg',
        quality: 0.9,
        success: result => resolve(result.tempFilePath),
        fail: () => reject(new Error('换色图片导出失败，请重试。'))
      }, this));
      const imageDataUrl = await readImageDataUrl(filePath);
      await this.addGeneratedImage(imageDataUrl, `服装局部换色预览（${target.toUpperCase()}），请检查选区边缘、阴影和相邻区域。`, 'imageGeneration');
      this.setData({ recolorProgress: '换色完成，可在对话中保存到作品库。' });
      sourceContext.putImageData(this._recolorSourcePixels, 0, 0);
    } catch (error) {
      if (this._recolorSourceCanvas && this._recolorSourcePixels) {
        this._recolorSourceCanvas.getContext('2d').putImageData(this._recolorSourcePixels, 0, 0);
      }
      this.setData({ error: error.message || '换色预览失败，请重试。', recolorProgress: '' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onCandidateCountChange(event) {
    const candidateCountIndex = Number(event.detail.value);
    if (this.data.candidateCounts[candidateCountIndex]) this.setData({ candidateCountIndex });
  },

  onLaunchCountChange(event) {
    const launchCountIndex = Number(event.detail.value);
    if (this.data.launchCounts[launchCountIndex]) this.setData({ launchCountIndex });
  },

  confirmAction(title, content) {
    return new Promise(resolve => wx.showModal({
      title,
      content,
      confirmText: '继续',
      cancelText: '取消',
      success: result => resolve(Boolean(result.confirm)),
      fail: () => resolve(false)
    }));
  },

  async addGeneratedImage(imageDataUrl, content, category) {
    const imagePath = imageDataUrl.startsWith('data:') ? await persistImageDataUrl(imageDataUrl) : imageDataUrl;
    const designToken = imageDataUrl.startsWith('data:') ? makeRequestKey('image') : '';
    if (designToken) {
      if (!this._imagesByToken) this._imagesByToken = Object.create(null);
      this._imagesByToken[designToken] = imageDataUrl;
    }
    this.setData({
      messages: this.data.messages.concat([{
        role: 'assistant',
        content,
        imagePath,
        designToken,
        designCategory: category
      }])
    });
  },

  async generateDesignCandidates() {
    if (this.data.loading) return;
    const count = this.data.candidateCounts[this.data.candidateCountIndex];
    const prompt = this.data.input.trim()
      || this.data.messages.slice().reverse().find(item => item.role === 'assistant')?.content
      || this.data.messages.slice().reverse().find(item => item.role === 'user')?.content
      || '';
    if (!prompt) {
      this.setData({ error: '先填写服装设计简报，再生成概念图。' });
      return;
    }
    if (!this.data.entitlements?.capabilities?.imageGeneration) {
      this.setData({ error: this.data.entitlements?.plan === 'free' ? '设计概念图需要 ModaUI 高级版，请联系管理员开通。' : '图片生成服务暂不可用。' });
      return;
    }
    if (!this.data.entitlements.billing?.active && this.data.entitlements.remaining.imageGeneration < count) {
      this.setData({ error: `图片额度不足；本次需要 ${count} 次图片生成额度。` });
      return;
    }
    const confirmed = await this.confirmAction('生成设计候选图', `将生成 ${count} 张独立概念图，并按当前套餐额度或 Credits 结算。结果需人工核对，不会自动保存或发布。继续吗？`);
    if (!confirmed || this.data.loading) return;
    this.setData({ loading: true, productLaunchProgress: `正在生成概念图 0/${count}`, error: '' });
    let completed = 0;
    try {
      for (let index = 0; index < count; index += 1) {
        const result = await request('/api/merchant/modagpt/images', {
          method: 'POST',
          timeout: 180000,
          headers: { 'Idempotency-Key': makeRequestKey('image') },
          data: {
            task: 'imageGeneration',
            prompt: `为以下服装设计简报生成第 ${index + 1} 张独立概念图。每张图应呈现不同且合理的设计构思，结果需要人工核对：${prompt}`
          }
        });
        if (!result.imageDataUrl && !result.imageUrl) throw new Error('图片生成服务没有返回结果。');
        await this.addGeneratedImage(result.imageDataUrl || result.imageUrl, `设计概念图 ${index + 1}/${count}，请核对后决定是否保存。`, 'imageGeneration');
        completed = index + 1;
        this.setData({ productLaunchProgress: `正在生成概念图 ${completed}/${count}` });
        if (result.quota) this.updateRemaining('imageGeneration', result.quota.remaining);
      }
      this.setData({ productLaunchProgress: '' });
    } catch (error) {
      this.setData({ error: `已生成 ${completed}/${count} 张概念图；后续请求失败：${error.message || '图片生成失败'}。已完成图片保留在当前对话。`, productLaunchProgress: '' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async sendMessage() {
    if (this.data.modauiBlocked) return;
    const question = this.data.input.trim();
    if ((!question && this.data.activeMode !== 'tryon') || this.data.loading) return;
    this.stopWelcomeSequence();
    if (!this.data.taskMode && !this._pendingChatRequestKey) this._pendingChatRequestKey = makeRequestKey('modagpt');
    let responseReceived = false;
    try {
    const auth = await requireMerchantSession(this);
    if (!auth) return;
    if (!canAccessTab(auth, 'assistant')) throw new Error('当前账号没有 ModaUI 访问权限。');
    const mode = this.data.activeMode;
    if (mode === 'generate' && !this.data.entitlements?.capabilities?.imageGeneration) {
      throw new Error(this.data.entitlements?.plan === 'free' ? '图片生成需要 ModaUI 高级版，请联系管理员开通。' : '图片生成服务暂不可用，请联系管理员。');
    }
    if (mode === 'tryon') {
      if (!this.data.entitlements?.capabilities?.tryOn) throw new Error(this.data.entitlements?.plan === 'free' ? 'AI 试衣需要 ModaUI 高级版，请联系管理员开通。' : 'AI 试衣服务暂不可用，请联系管理员。');
      if (!this.data.personImage || !this.data.garmentImage || !this.data.consent) throw new Error('请上传人物和服装图片，并确认授权后再试衣。');
    }
    syncTabBar(this, auth, 'assistant');
    const displayQuestion = question || '请根据我上传的人物和服装图片生成虚拟试衣效果。';
    if (this.data.taskMode) {
      this.setData({ loading: true, error: '', toolsOpen: false });
      await this.previewMerchantTask(displayQuestion);
      return;
    }
    const userMessage = { role: 'user', content: displayQuestion };
    this.setData({ messages: this.data.messages.concat([userMessage]), input: '', canSend: false, loading: true, error: '', toolsOpen: false });
    let response;
    if (mode === 'generate' || mode === 'tryon') {
      response = await request('/api/merchant/modagpt/images', {
        method: 'POST',
        timeout: 180000,
        headers: { 'Idempotency-Key': this._pendingChatRequestKey },
        data: mode === 'tryon'
          ? {
            task: 'tryOn',
            prompt: displayQuestion,
            category: this.data.categories[this.data.categoryIndex].value,
            personImage: this.data.personImage,
            garmentImage: this.data.garmentImage,
            privacyConsent: true
          }
          : { task: 'imageGeneration', prompt: displayQuestion }
      });
      responseReceived = true;
      this._pendingChatRequestKey = '';
      const imageUrl = response.imageDataUrl || response.imageUrl;
      if (!imageUrl) throw new Error('图片生成服务没有返回结果，请稍后重试。');
      await this.addGeneratedImage(imageUrl, mode === 'tryon' ? '这是本次 AI 虚拟试衣效果图。' : '这是生成的服装创意图。', mode === 'tryon' ? 'tryOn' : 'imageGeneration');
      this.setData({ personPath: '', garmentPath: '', personImage: '', garmentImage: '', consent: false });
      if (response.quota) this.updateRemaining(mode === 'tryon' ? 'tryOn' : 'imageGeneration', response.quota.remaining);
    } else {
      response = await request('/api/merchant/assistant/query', {
        method: 'POST',
        timeout: 60000,
        headers: { 'Idempotency-Key': this._pendingChatRequestKey },
        data: {
          question: displayQuestion,
          conversationId: this._conversationId || undefined,
          workflow: mode === 'productLaunch' ? 'product_launch_copy' : undefined,
          context,
          scope
        }
      });
    }
    responseReceived = true;
    this._pendingChatRequestKey = '';
    if (mode !== 'generate' && mode !== 'tryon') {
      this._conversationId = response.conversationId || this._conversationId;
      const answer = response.reply || response.answer || response.message;
      if (typeof answer !== 'string' || !answer) throw new Error('ModaUI 返回内容为空，请重试。');
      this.setData({
        messages: this.data.messages.concat([{
          role: 'assistant',
          id: response.messageId || '',
          content: answer,
          actions: response.actions || []
        }])
      });
      if (mode === 'productLaunch') {
        const count = this.data.launchCounts[this.data.launchCountIndex];
        if (!this.data.entitlements?.capabilities?.imageGeneration) throw new Error('商品上新图片生成服务暂不可用，请联系管理员。');
        if (!this.data.entitlements.billing?.active && this.data.entitlements.remaining.imageGeneration < count) {
          throw new Error(`图片额度不足；本次需要 ${count} 次图片生成额度。文案草稿已保留。`);
        }
        const confirmed = await this.confirmAction('生成商品上新图片', `文案草稿已生成。接下来将逐张生成 ${count} 张商品展示图，按额度或 Credits 结算；不会自动发布商品。继续吗？`);
        if (!confirmed) return;
        let completed = 0;
        this.setData({ productLaunchProgress: `正在生成商品图片 0/${count}` });
        try {
          const directions = [
            '正面全身图，清晰呈现服装廓形',
            '三分之四侧面姿势，商业时尚摄影',
            '全身侧面姿势，展示服装合身效果',
            '编辑大片姿势，突出服装细节'
          ];
          for (let index = 0; index < count; index += 1) {
            const imageResult = await request('/api/merchant/modagpt/images', {
              method: 'POST',
              timeout: 180000,
              headers: { 'Idempotency-Key': makeRequestKey('image') },
              data: {
                task: 'imageGeneration',
                prompt: `生成时尚商品展示照片。款式和拍摄要求：${displayQuestion}。镜头方向：${directions[index]}。请勿添加文字、商标或水印。`
              }
            });
            if (!imageResult.imageDataUrl && !imageResult.imageUrl) throw new Error('图片生成服务没有返回结果。');
            await this.addGeneratedImage(imageResult.imageDataUrl || imageResult.imageUrl, `商品上新视觉图 ${index + 1}/${count}，请检查后手动保存。`, 'imageGeneration');
            completed = index + 1;
            this.setData({ productLaunchProgress: `正在生成商品图片 ${completed}/${count}` });
            if (imageResult.quota) this.updateRemaining('imageGeneration', imageResult.quota.remaining);
          }
          this.setData({ productLaunchProgress: '' });
        } catch (imageError) {
          this.setData({ error: `商品文案已生成，图片完成 ${completed}/${count} 张。已完成图片保留在当前对话：${imageError.message || '图片生成失败'}`, productLaunchProgress: '' });
        }
      }
      if (response.conversationId) {
        const conversation = {
          id: response.conversationId,
          title: response.conversationTitle || displayQuestion.slice(0, 48),
          updatedAt: response.conversationUpdatedAt || new Date().toISOString(),
          messageCount: response.messageCount || 2
        };
        this.setData({
          conversations: [conversation].concat(this.data.conversations.filter(item => item.id !== conversation.id)).slice(0, 30)
        }, () => this.applyHistorySearch());
      }
      if (response.quota) this.updateRemaining('chat', response.quota.remaining);
    }
    } catch (error) {
    if (responseReceived) this._pendingChatRequestKey = '';
    this.setData({
      input: question || this.data.input,
      canSend: Boolean(question || this.data.input.trim()),
      messages: this.data.messages.filter((message, index, messages) =>
        !(index === messages.length - 1 && message.role === 'user' && message.content === (question || '请根据我上传的人物和服装图片生成虚拟试衣效果。'))
      ),
      error: this.data.taskMode
        ? merchantTaskErrorMessage(error)
        : error.message || 'ModaUI 暂时无法回复，请稍后重试。'
    });
    } finally {
    this.setData({ loading: false });
    }
  },

  updateRemaining(feature, remaining) {
    if (!this.data.entitlements || !this.data.entitlements.remaining) return;
    const next = Object.assign({}, this.data.entitlements, {
    remaining: Object.assign({}, this.data.entitlements.remaining, { [feature]: remaining })
    });
    this.setData({ entitlements: next });
  },

  async loadDesigns() {
    this.setData({ designsLoading: true, designNotice: '' });
    try {
    const result = await request(`/api/merchant/modagpt/designs?category=${encodeURIComponent(this.data.designFilter)}`);
    this.setData({ designs: result.designs || [] });
    } catch (error) {
    this.setData({ designNotice: error.message || '作品加载失败，请稍后重试。' });
    } finally {
    this.setData({ designsLoading: false });
    }
  },

  onDesignFilter(event) {
    this.setData({ designFilter: event.currentTarget.dataset.filter }, () => this.loadDesigns());
  },

  openDesign(event) {
    const design = this.data.designs[Number(event.currentTarget.dataset.index)];
    if (!design || this.data.designLoadingId) return;
    const session = getSession();
    if (!session) {
      this.setData({ error: '登录状态已失效，请重新登录。' });
      return;
    }
    this.setData({ designLoadingId: design.id, error: '' });
    wx.downloadFile({
      url: getAssetUrl(design.imageUrl),
      header: { Authorization: `Bearer ${session.token}` },
      success: result => {
        if (result.statusCode < 200 || result.statusCode >= 300) {
          this.setData({ designLoadingId: '', designNotice: '作品图片加载失败，请重试。' });
          return;
        }
        this.setData({
          designLoadingId: '',
          selectedDesign: Object.assign({}, design, { imageUrl: result.tempFilePath })
        });
      },
      fail: () => this.setData({ designLoadingId: '', designNotice: '作品图片加载失败，请检查网络后重试。' })
    });
  },

  closeDesign() {
    this.setData({ selectedDesign: null });
  },

  stopPropagation(event) {
    if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
  },

  copyReply(event) {
    const index = Number(event.currentTarget.dataset.index);
    const message = this.data.messages[index];
    if (!message || !message.content) return;
    wx.setClipboardData({
      data: message.content,
      success: () => wx.showToast({ title: '已复制', icon: 'none', duration: 1200 }),
      fail: () => this.setData({ error: '复制失败，请检查剪贴板权限。' })
    });
  },

  deleteReply(event) {
    const index = Number(event.currentTarget.dataset.index);
    const message = this.data.messages[index];
    if (!message || message.role === 'user') return;
    const removeLocal = () => this.setData({ messages: this.data.messages.filter((_, itemIndex) => itemIndex !== index) });
    wx.showModal({
      title: '删除这条回复？',
      content: '只删除当前这条 AI 回复，无法恢复。',
      confirmText: '删除',
      confirmColor: '#b91c1c',
      success: async result => {
        if (!result.confirm) return;
        if (!message.id) {
          removeLocal();
          return;
        }
        try {
          await request(`/api/merchant/assistant/messages/${encodeURIComponent(message.id)}`, { method: 'DELETE' });
          removeLocal();
        } catch (error) {
          if (error && (error.code === 'ASSISTANT_MESSAGE_NOT_FOUND' || error.message === 'ASSISTANT_MESSAGE_NOT_FOUND')) {
            removeLocal();
            return;
          }
          this.setData({ error: (error && error.message) || '删除失败，请稍后重试。' });
        }
      }
    });
  },

  navigateAction(event) {
    const target = event.currentTarget.dataset.target;
    const routes = {
      products: '/pages/products/index',
      orders: '/pages/orders/index',
      inventory: '/pages/workspace/index?id=inventory',
      customers: '/pages/workspace/index?id=customers',
      materials: '/pages/workspace/index?id=materials',
      production: '/pages/workspace/index?id=production',
      finance: '/pages/workspace/index?id=finance',
      procurement: '/pages/workspace/index?id=procurement',
      growth: '/pages/workspace/index?id=growth',
      content: '/pages/workspace/index?id=media',
      profile: '/pages/more/index'
    };
    const url = routes[target];
    if (!url) return;
    this.closeOverlays();
    if (url.startsWith('/pages/products/') || url.startsWith('/pages/orders/') || url.startsWith('/pages/more/')) {
      wx.switchTab({ url });
    } else {
      wx.navigateTo({ url });
    }
  },

  async saveDesign(event) {
    const index = Number(event.currentTarget.dataset.index);
    const message = this.data.messages[index];
    const imageDataUrl = message && this._imagesByToken && this._imagesByToken[message.designToken];
    if (!message || !imageDataUrl || !message.designCategory || message.designId || this.data.savingDesign) return;
    const userMessage = this.data.messages.slice(0, index).reverse().find(item => item.role === 'user');
    this.setData({ savingDesign: true, error: '' });
    try {
    const result = await request('/api/merchant/modagpt/designs', {
      method: 'POST',
      data: {
        title: (userMessage && userMessage.content || message.content).slice(0, 160),
        prompt: userMessage && userMessage.content || message.content,
        category: message.designCategory,
        imageDataUrl,
        clientRequestId: makeRequestKey('design')
      }
    });
    const messages = this.data.messages.slice();
    messages[index] = Object.assign({}, messages[index], { designId: result.design && result.design.id });
    this.setData({ messages, savingDesign: false, error: '' });
    } catch (error) {
    this.setData({ savingDesign: false, error: error.message || '作品保存失败，请稍后重试。' });
    }
  },

  async toggleFavorite(event) {
    const design = this.data.designs[Number(event.currentTarget.dataset.index)];
    if (!design || this.data.designActionId) return;
    this.setData({ designActionId: design.id, designNotice: '' });
    try {
    await request(`/api/merchant/modagpt/designs/${encodeURIComponent(design.id)}/favorite`, {
      method: 'PATCH',
      data: { isFavorite: !design.isFavorite }
    });
    const designs = this.data.designs.map(item => item.id === design.id ? Object.assign({}, item, { isFavorite: !item.isFavorite }) : item);
    this.setData({ designs: this.data.designFilter === 'favorite' ? designs.filter(item => item.isFavorite) : designs, designActionId: '' });
    } catch (error) {
    this.setData({ designActionId: '', designNotice: error.message || '收藏状态更新失败，请重试。' });
    }
  },

  showVoiceNotice() {
    wx.showToast({ title: '请使用手机键盘的语音输入功能', icon: 'none' });
  },

  async showPricing() {
    this.setData({ menuOpen: false });
    try {
      const result = await request('/api/merchant/modagpt/plans');
      const plans = Array.isArray(result.plans) ? result.plans : [];
      const planLines = plans.slice(0, 5).map(plan => {
        const price = Number(plan.monthlyPriceMinor);
        const priceText = Number.isFinite(price) ? `€${(price / 100).toFixed(price % 100 ? 2 : 0)}/月` : '价格待公布';
        return `${plan.displayName || plan.id}　${priceText}`;
      });
      const checkoutStatus = result.checkoutReady
        ? '网页端安全结账已配置；小程序内支付尚未接入。'
        : '订阅购买暂未开放；小程序不会发起扣款。';
      wx.showModal({
        title: '会员中心',
        content: `当前套餐：${displayPlanName(result.currentPlanId || this.data.menuPlanLabel)}\n${result.creditBalance === undefined ? '' : `Credits：${result.creditBalance}\n`}${planLines.join('\n')}\n\n${checkoutStatus}`,
        confirmText: '知道了',
        showCancel: false
      });
    } catch (error) {
      wx.showModal({
        title: '会员中心暂不可用',
        content: error.message || '套餐信息读取失败，请检查网络后重试。',
        confirmText: '知道了',
        showCancel: false
      });
    }
  },

  logout() {
    this.setData({ menuOpen: false });
    wx.showModal({
      title: '退出企业账号',
      content: '退出后需要重新登录才能继续使用 ModaUI。',
      success: result => {
        if (!result.confirm) return;
        clearSession();
        wx.reLaunch({ url: '/pages/login/index' });
      }
    });
  },

  usePrompt(event) {
    const prompt = event.currentTarget.dataset.prompt;
    if (prompt) {
    this.setData({ input: prompt, canSend: true }, () => this.sendMessage());
    }
  }
});

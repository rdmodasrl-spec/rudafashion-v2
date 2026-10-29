const {
  getMiniProgramFeatures,
  getModaGptEntitlements,
  getModaGptImageTask,
  requestModaGptImage
} = require('../../utils/api');
const { getAuthSession, getVerifiedAuthProfile } = require('../../utils/auth');

const maximumImageSize = 3 * 1024 * 1024;
const taskPollInterval = 1500;
const taskPollTimeout = 180000;
const categories = [
  { label: '外套', value: 'tops' },
  { label: '上装', value: 'tops' },
  { label: '下装', value: 'bottoms' },
  { label: '连衣裙', value: 'one-pieces' }
];

function imageContentType(path) {
  const extension = String(path).split('?')[0].split('.').pop().toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return 'image/jpeg';
}

function readImageDataUrl(file) {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath: file.tempFilePath,
      success: result => {
        if (!(result.data instanceof ArrayBuffer)) {
          reject(new Error('无法读取图片，请重新选择。'));
          return;
        }
        resolve(`data:${imageContentType(file.tempFilePath)};base64,${wx.arrayBufferToBase64(result.data)}`);
      },
      fail: () => reject(new Error('无法读取图片，请重新选择。'))
    });
  });
}

function createTaskKey() {
  const uuid = typeof wx.getRandomValues === 'function'
    ? Array.from(wx.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, '0')).join('')
    : `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
  return `image-${uuid}`;
}

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

Page({
  data: {
    categories,
    categoryIndex: 0,
    personPath: '',
    garmentPath: '',
    resultUrl: '',
    remaining: null,
    pendingTaskKey: '',
    privacyConsent: false,
    loading: false,
    checking: false,
    error: '',
    status: ''
  },

  async onShow() {
    if (this._profileLoading || this._featureCheckInFlight) return;
    this._featureCheckInFlight = true;
    try {
      const result = await getMiniProgramFeatures();
      if (!result || !result.features || result.features.aiSectionEnabled !== true) {
        wx.showToast({ title: 'AI 版块暂未开放', icon: 'none' });
        wx.switchTab({ url: '/pages/home/index' });
        return;
      }
    } catch (error) {
      console.error('[tryon-features]', error);
      wx.showToast({ title: 'AI 版块暂不可用', icon: 'none' });
      wx.switchTab({ url: '/pages/home/index' });
      return;
    } finally {
      this._featureCheckInFlight = false;
    }

    if (this._profileLoading) return;
    this._profileLoading = true;
    try {
      const session = getAuthSession();
      if (!session || !['merchant', 'employee'].includes(session.role)) {
        wx.navigateTo({ url: '/pages/login/index?role=merchant' });
        return;
      }
      const auth = await getVerifiedAuthProfile();
      if (!auth || !['merchant', 'employee'].includes(auth.session.role)) {
        wx.navigateTo({ url: '/pages/login/index?role=merchant' });
        return;
      }
      this._merchantId = String(auth.response.merchant && auth.response.merchant.id || '');
      if (!this._merchantId) throw new Error('无法确认商家账户。');
      const entitlements = await getModaGptEntitlements();
      this.setData({ remaining: Number(entitlements.remaining && entitlements.remaining.tryOn) || 0 });
      const pendingKey = wx.getStorageSync(this._pendingStorageKey());
      if (typeof pendingKey === 'string' && pendingKey) {
        this.setData({ pendingTaskKey: pendingKey });
        void this.checkTask();
      }
    } catch (error) {
      this.setData({ error: error.message || '试衣服务暂时无法加载。' });
    } finally {
      this._profileLoading = false;
    }
  },

  _pendingStorageKey() {
    return `ruda.modagpt.pending-tryon.${this._merchantId}`;
  },

  chooseImage(event) {
    if (this.data.loading || this.data.checking) return;
    const field = event.currentTarget.dataset.field;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: result => {
        const file = result.tempFiles && result.tempFiles[0];
        if (!file || !file.tempFilePath) return;
        if (file.size > maximumImageSize) {
          this.setData({ error: '图片不能超过 3 MB。' });
          return;
        }
        this.setData({
          [field === 'person' ? 'personPath' : 'garmentPath']: file.tempFilePath,
          resultUrl: '',
          error: ''
        });
      },
      fail: result => {
        if (result && result.errMsg && result.errMsg.includes('cancel')) return;
        this.setData({ error: '无法选择图片。' });
      }
    });
  },

  onCategoryChange(event) {
    const categoryIndex = Number(event.detail.value);
    if (categories[categoryIndex]) this.setData({ categoryIndex });
  },

  onConsentChange(event) {
    this.setData({ privacyConsent: Boolean(event.detail.value && event.detail.value.length) });
  },

  async startTryOn() {
    if (this.data.loading || this.data.checking) return;
    if (this.data.pendingTaskKey) {
      this.setData({ error: '先查询上一次任务结果。' });
      return;
    }
    if (!this.data.personPath || !this.data.garmentPath || !this.data.privacyConsent) {
      this.setData({ error: '请上传两张图片并确认授权。' });
      return;
    }
    if (!this.data.remaining) {
      this.setData({ error: '暂无可用次数。' });
      return;
    }

    this.setData({ loading: true, error: '', status: '正在处理' });
    const key = createTaskKey();
    try {
      const images = await Promise.all([
        readImageDataUrl({ tempFilePath: this.data.personPath }),
        readImageDataUrl({ tempFilePath: this.data.garmentPath })
      ]);
      const personImage = images[0];
      const garmentImage = images[1];
      const category = categories[this.data.categoryIndex].value;
      wx.setStorageSync(this._pendingStorageKey(), key);
      this.setData({ pendingTaskKey: key });
      const task = await requestModaGptImage({
        task: 'tryOn',
        prompt: '将样衣自然地穿到模特身上，保留服装款式、颜色和细节。',
        category,
        personImage,
        garmentImage,
        privacyConsent: true
      }, key);
      await this.finishOrPoll(task, key);
    } catch (error) {
      this.setData({
        status: '',
        error: this.data.pendingTaskKey
          ? '任务结果待确认，请查询状态，不要重复提交。'
          : error.message || '试衣失败，请重试。'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  async checkTask() {
    const key = this.data.pendingTaskKey;
    if (!key || this.data.checking || this.data.loading) return;
    this.setData({ checking: true, error: '', status: '查询中' });
    try {
      const task = await getModaGptImageTask(key);
      await this.finishOrPoll(task, key);
    } catch (error) {
      if (error.code === 'MODAGPT_IMAGE_TASK_NOT_FOUND' || error.status === 404) {
        this.clearPendingTask(key);
        this.setData({ error: '未找到任务，请重新试衣。', status: '' });
      } else {
        this.setData({ error: '暂时无法确认任务结果，请稍后再查。', status: '' });
      }
    } finally {
      this.setData({ checking: false });
    }
  },

  async finishOrPoll(task, key) {
    const deadline = Date.now() + taskPollTimeout;
    let current = task;
    while (current
      && !['completed', 'failed', 'unknown'].includes(current.status)
      && Date.now() < deadline) {
      this.setData({ status: '正在处理' });
      await wait(taskPollInterval);
      current = await getModaGptImageTask(key);
    }

    if (current && current.status === 'completed' && current.imageDataUrl) {
      this.clearPendingTask(key);
      this.setData({
        resultUrl: current.imageDataUrl,
        remaining: current.quota ? current.quota.remaining : Math.max(0, (this.data.remaining || 0) - 1),
        status: '',
        error: ''
      });
      return;
    }
    if (current && current.status === 'failed') {
      this.clearPendingTask(key);
      this.setData({ status: '', error: current.error || '试衣失败，请重试。' });
      return;
    }
    this.setData({
      status: '',
      error: '任务结果待确认，请查询状态，不要重复提交。'
    });
  },

  clearPendingTask(key) {
    if (this._merchantId) wx.removeStorageSync(this._pendingStorageKey());
    if (this.data.pendingTaskKey === key) this.setData({ pendingTaskKey: '' });
  }
});

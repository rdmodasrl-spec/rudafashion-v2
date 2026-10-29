const { request } = require('../../utils/api');
const { requireMerchantSession } = require('../../utils/page-auth');
const { canAccessWorkspace } = require('../../utils/permissions');

const maximumImageSize = 3 * 1024 * 1024;
const taskPollInterval = 1500;
const taskPollTimeout = 180000;
const categories = [
  { label: '外套 / 上装', value: 'tops' },
  { label: '下装', value: 'bottoms' },
  { label: '连衣裙', value: 'one-pieces' }
];

function contentTypeForPath(path) {
  const extension = String(path).split('?')[0].split('.').pop().toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return 'image/jpeg';
}

function readImageDataUrl(filePath) {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath,
      success: result => {
        if (!(result.data instanceof ArrayBuffer)) {
          reject(new Error('无法读取图片，请重新选择。'));
          return;
        }
        resolve(`data:${contentTypeForPath(filePath)};base64,${wx.arrayBufferToBase64(result.data)}`);
      },
      fail: () => reject(new Error('无法读取图片，请重新选择。'))
    });
  });
}

function createTaskKey() {
  return `tryon-${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

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
    if (this._profileLoading) return;
    this._profileLoading = true;
    try {
      const auth = await requireMerchantSession(this);
      if (!auth) return;
      if (!canAccessWorkspace(auth, 'tryon')) {
        this.setData({ error: '当前账号没有虚拟试衣访问权限。', resultUrl: '', pendingTaskKey: '' });
        return;
      }
      this._merchantId = String(auth.response.merchant && auth.response.merchant.id || '');
      if (!this._merchantId) throw new Error('无法确认商家账户。');
      const entitlements = await request('/api/merchant/modagpt/entitlements');
      this.setData({ remaining: Number(entitlements.remaining && entitlements.remaining.tryOn) || 0 });
      const pendingKey = wx.getStorageSync(this.pendingStorageKey());
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

  pendingStorageKey() {
    return `ruda.merchant-mini.pending-tryon.${this._merchantId}`;
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
        const targetField = field === 'person' ? 'personPath' : 'garmentPath';
        const update = { resultUrl: '', error: '' };
        update[targetField] = file.tempFilePath;
        this.setData(update);
      },
      fail: result => {
        if (!result || !String(result.errMsg).includes('cancel')) this.setData({ error: '无法选择图片。' });
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
        readImageDataUrl(this.data.personPath),
        readImageDataUrl(this.data.garmentPath)
      ]);
      const personImage = images[0];
      const garmentImage = images[1];
      wx.setStorageSync(this.pendingStorageKey(), key);
      this.setData({ pendingTaskKey: key });
      const task = await request('/api/merchant/modagpt/images', {
        method: 'POST',
        timeout: 30000,
        headers: { 'Idempotency-Key': key },
        data: {
          task: 'tryOn',
          prompt: '将样衣自然地穿到模特身上，保留服装款式、颜色和细节。',
          category: categories[this.data.categoryIndex].value,
          personImage,
          garmentImage,
          privacyConsent: true
        }
      });
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
      const task = await request(`/api/merchant/modagpt/images/tasks/${encodeURIComponent(key)}`);
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
    while (current && !['completed', 'failed', 'unknown'].includes(current.status) && Date.now() < deadline) {
      this.setData({ status: '正在处理' });
      await wait(taskPollInterval);
      current = await request(`/api/merchant/modagpt/images/tasks/${encodeURIComponent(key)}`);
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
    this.setData({ status: '', error: '任务结果待确认，请查询状态，不要重复提交。' });
  },

  clearPendingTask(key) {
    if (this._merchantId) wx.removeStorageSync(this.pendingStorageKey());
    if (this.data.pendingTaskKey === key) this.setData({ pendingTaskKey: '' });
  }
});

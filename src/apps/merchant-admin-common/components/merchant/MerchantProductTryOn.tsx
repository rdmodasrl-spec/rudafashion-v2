import React, { useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { ApiError, apiGet, apiPost } from '../../../../api/client';
import { uploadMerchantMedia } from '../../../../api/merchantMedia';
import type { ProductMedia } from '../../../../types/b2b';

type Props = {
  media: ProductMedia[];
  maxItems: number;
  onAddMedia: (media: ProductMedia) => void;
};

type TryOnEntitlements = {
  capabilities: { tryOn: boolean };
  providers: { image: string };
  remaining: { tryOn: number };
  billing: { active: boolean; creditBalance: number };
};

type TryOnResult = {
  success: true;
  imageDataUrl: string;
  quota?: { remaining: number };
  credits?: { remaining: number };
};

const MAX_REFERENCE_IMAGE_BYTES = 3 * 1024 * 1024;

const tryOnErrorMessage = (code: string): string => ({
  MODAGPT_TRYON_PROVIDER_NOT_CONFIGURED: '平台尚未配置 Fal 虚拟试穿服务，请联系管理员。',
  MODAGPT_FEATURE_NOT_ENTITLED: '当前套餐未开通虚拟试穿。',
  MODAGPT_QUOTA_EXCEEDED: '本期虚拟试穿额度已用完。',
  MODAGPT_CREDITS_INSUFFICIENT: 'Credits 不足，无法生成试穿图片。',
  MODAGPT_AI_REQUEST_ALREADY_PROCESSED: '该生成请求已处理，请先检查结果；如需新结果请明确重新生成。',
  MODAGPT_IMAGE_STORAGE_NOT_CONFIGURED: '商品图片存储服务暂不可用。',
  MODAGPT_IMAGE_INPUT_INVALID: '图片无效、缺失或超过大小限制，请重新上传。',
  AI_EMPLOYEE_FAL_TRYON_TIMEOUT: 'Fal 试穿处理超时，原请求未自动重复提交。请稍后检查额度后再手动重试。',
  AI_EMPLOYEE_FAL_TRYON_REQUEST_FAILED: 'Fal 试穿生成失败，未自动重复提交。请检查图片后再手动重试。'
} as Record<string, string>)[code] || code;

async function compressReferenceImage(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 12 * 1024 * 1024) {
    throw new Error('模特图片需为 JPG、PNG 或 WebP，且不超过 12 MB');
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 25_000_000) {
      throw new Error('模特图片尺寸无效或过大');
    }
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('浏览器无法处理该图片');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      result => result ? resolve(result) : reject(new Error('模特图片压缩失败')),
      'image/webp',
      0.84
    ));
    if (!blob.size || blob.size > MAX_REFERENCE_IMAGE_BYTES) throw new Error('压缩后的模特图片仍超过 3 MB');
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('模特图片读取失败'));
      reader.onerror = () => reject(new Error('模特图片读取失败'));
      reader.readAsDataURL(blob);
    });
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export const MerchantProductTryOn: React.FC<Props> = ({ media, maxItems, onAddMedia }) => {
  const [open, setOpen] = useState(false);
  const [personImage, setPersonImage] = useState('');
  const [personPreview, setPersonPreview] = useState('');
  const [category, setCategory] = useState<'tops' | 'bottoms' | 'one-pieces'>('one-pieces');
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [preview, setPreview] = useState('');
  const [remaining, setRemaining] = useState<number | null>(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [billingActive, setBillingActive] = useState(false);
  const [serviceReady, setServiceReady] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef<string | null>(null);
  const garmentImages = media.filter(item => item.type === 'image' && item.storageKey);
  const [garmentId, setGarmentId] = useState('');
  const selectedGarment = garmentImages.find(item => item.id === garmentId) || garmentImages[0];

  const openPanel = async () => {
    setOpen(true);
    setError('');
    setServiceReady(false);
    try {
      const entitlements = await apiGet<{ success: true } & TryOnEntitlements>('/api/merchant/modagpt/entitlements');
      setRemaining(entitlements.remaining.tryOn);
      setBillingActive(entitlements.billing.active);
      setCreditBalance(entitlements.billing.creditBalance);
      setServiceReady(entitlements.capabilities.tryOn && entitlements.providers.image === 'fal');
      if (!entitlements.capabilities.tryOn || entitlements.providers.image !== 'fal') {
        setError(entitlements.providers.image !== 'fal'
          ? 'Fal 虚拟试穿服务尚未配置，请联系平台管理员。'
          : '当前商家套餐没有可用的虚拟试穿额度。');
      }
    } catch (loadError) {
      setError(loadError instanceof ApiError ? tryOnErrorMessage(loadError.code || loadError.message) : '无法读取 AI 试穿权限，请稍后重试。');
    }
  };

  const selectPersonImage = async (file?: File) => {
    if (!file) return;
    setError('');
    try {
      const compressed = await compressReferenceImage(file);
      setPersonImage(compressed);
      setPersonPreview(compressed);
      setPreview('');
      requestId.current = null;
    } catch (imageError) {
      setError(imageError instanceof Error ? imageError.message : '模特图片处理失败');
    }
  };

  const generate = async () => {
    if (!selectedGarment?.storageKey || !personImage || !consent || loading || confirming) return;
    setLoading(true);
    setError('');
    setPreview('');
    const idempotencyKey = `tryon-${crypto.randomUUID()}`;
    requestId.current = idempotencyKey;
    try {
      const result = await apiPost<TryOnResult>('/api/merchant/modagpt/images', {
        task: 'tryOn',
        prompt: 'Fashion product virtual try-on preview for merchant review.',
        category,
        personImage,
        garmentStorageKey: selectedGarment.storageKey,
        privacyConsent: true
      }, 180_000, { 'Idempotency-Key': idempotencyKey });
      setPreview(result.imageDataUrl);
      if (result.quota) setRemaining(result.quota.remaining);
      if (result.credits) setCreditBalance(result.credits.remaining);
      requestId.current = null;
    } catch (generationError) {
      const message = generationError instanceof ApiError
        ? tryOnErrorMessage(generationError.code || generationError.message)
        : generationError instanceof Error ? generationError.message : 'AI_TRYON_FAILED';
      setError(`${message}。未自动重复提交；点击重新生成会再次消耗套餐额度或 Credits。`);
    } finally {
      setLoading(false);
    }
  };

  const confirmResult = async () => {
    if (!preview || confirming) return;
    if (media.length >= maxItems) {
      setError('商品媒体已达到上限，请先删除一项后再确认。');
      return;
    }
    setConfirming(true);
    setError('');
    try {
      const imageBlob = await (await fetch(preview)).blob();
      const uploaded = await uploadMerchantMedia(imageBlob, 'image/webp');
      onAddMedia({
        id: `media-${crypto.randomUUID()}`,
        type: 'image',
        url: uploaded.url,
        storageKey: uploaded.storageKey,
        contentType: uploaded.contentType,
        sizeBytes: uploaded.sizeBytes,
        role: 'detail',
        source: 'ai-try-on',
        reviewStatus: 'approved',
        alt: '商家确认的 AI 模特试穿图'
      });
      setPreview('');
      setOpen(false);
      setPersonImage('');
      setPersonPreview('');
      setConsent(false);
    } catch (uploadError) {
      setError(uploadError instanceof ApiError ? uploadError.code || uploadError.message : uploadError instanceof Error ? uploadError.message : '生成图片保存失败，请重试');
    } finally {
      setConfirming(false);
    }
  };

  return <div className="rounded-xl border border-neutral-200 bg-white p-4">
    <div className="flex flex-wrap items-center gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-neutral-100 text-neutral-800" aria-hidden="true"><Sparkles className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-neutral-900">AI 模特试穿</p>
        <p className="mt-0.5 text-xs text-neutral-500">生成待确认预览，确认后才加入商品图片</p>
      </div>
      <button type="button" onClick={() => open ? setOpen(false) : void openPanel()} disabled={!garmentImages.length || media.length >= maxItems} className="h-9 rounded-lg bg-neutral-950 px-4 text-xs font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50">
        {open ? '收起' : '立即试穿'}
      </button>
    </div>
    {!garmentImages.length && <p className="mt-2 text-xs text-neutral-500">先上传商品原图</p>}
    {open && <div className="mt-3 space-y-3 border-t border-neutral-200 pt-3">
      <div className="flex justify-end">
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-neutral-500 hover:text-neutral-900">关闭</button>
      </div>
      {error && <p role="alert" className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">{error}</p>}
      {preview ? (
        <div className="space-y-2">
          <img src={preview} alt="AI 模特试穿待确认预览" className="max-h-[55vh] w-full rounded-lg border border-neutral-200 bg-white object-contain" />
          <div className="flex flex-wrap gap-2 text-[10px] text-neutral-600"><span>确认前不发布</span><span>审核细节再用</span></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void confirmResult()} disabled={confirming} className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{confirming ? '保存中...' : '确认使用并加入媒体'}</button>
            <button type="button" onClick={() => { setPreview(''); void generate(); }} disabled={loading || confirming} className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-800 disabled:opacity-50">重新生成</button>
            <button type="button" onClick={() => setPreview('')} disabled={confirming} className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-600 disabled:opacity-50">放弃</button>
          </div>
        </div>
      ) : <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-neutral-700">商品原图
          <select value={selectedGarment?.id || ''} onChange={event => setGarmentId(event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 bg-white p-2 font-normal">
            {garmentImages.map(item => <option key={item.id} value={item.id}>{item.alt || `商品图片 ${garmentImages.indexOf(item) + 1}`}</option>)}
          </select>
        </label>
        <label className="block text-xs font-semibold text-neutral-700">服装类型
          <select value={category} onChange={event => setCategory(event.target.value as typeof category)} className="mt-1 w-full rounded-lg border border-neutral-300 bg-white p-2 font-normal">
            <option value="tops">上装</option>
            <option value="bottoms">下装</option>
            <option value="one-pieces">连衣裙 / 连体装</option>
          </select>
        </label>
        <label className="block text-xs font-semibold text-neutral-700 sm:col-span-2">模特参考图
          <input type="file" accept="image/jpeg,image/png,image/webp" capture="user" onChange={event => { void selectPersonImage(event.currentTarget.files?.[0]); event.currentTarget.value = ''; }} className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs" />
          {personPreview && <img src={personPreview} alt="模特参考图预览" className="mt-2 h-28 w-24 rounded-lg border border-neutral-200 object-cover" />}
        </label>
        <label className="flex items-start gap-2 text-[10px] leading-4 text-neutral-600 sm:col-span-2">
          <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} className="mt-0.5" />
          我确认已获模特照片使用授权，并同意将人物图和商品图发送至 Fal AI 进行试穿处理。
        </label>
        <div className="flex items-center justify-between sm:col-span-2">
          <span className="text-[10px] text-neutral-500">{billingActive
            ? `剩余 ${creditBalance ?? 0} Credits`
            : remaining === null ? '额度将在检查服务权限后显示' : `本期剩余 ${remaining} 次`}</span>
          <button type="button" onClick={() => void generate()} disabled={!serviceReady || !selectedGarment || !personImage || !consent || loading || confirming} className="rounded-lg bg-neutral-900 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? '正在生成试穿预览…' : '生成试穿预览'}
          </button>
        </div>
      </div>}
      <div className="flex flex-wrap gap-2 text-[9px] leading-4 text-neutral-500"><span>使用试穿额度</span><span>图片经 Fal 处理</span><span>失败不自动重试</span></div>
    </div>}
  </div>;
};

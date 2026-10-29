import React, { useId, useRef, useState } from 'react';
import { Check, ChevronLeft, GripVertical, ImagePlus, Loader2, Film, Trash2, UploadCloud, Star, X, ArrowLeft, ArrowRight, Play } from 'lucide-react';
import { ProductMedia } from '../../../../types/b2b';
import { useB2B } from '../../../../context/B2BContext';
import { uploadMerchantMedia } from '../../../../api/merchantMedia';

type MediaUploaderVariant = 'default' | 'editor';
type Props = { value: ProductMedia[]; onChange: (media: ProductMedia[]) => void; maxItems?: number; isIt?: boolean; capture?: boolean; compact?: boolean; allowVideo?: boolean; onBusyChange?: (busy: boolean) => void; variant?: MediaUploaderVariant };
const MAX_IMAGE = 12 * 1024 * 1024;
const MAX_VIDEO = 100 * 1024 * 1024;
const MAX_IMAGE_OUTPUT = 4.5 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic', 'image/heif'];
const SUPPORTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

const getUploadErrorLabel = (reason: string, isIt: boolean) => {
  if (reason === 'UNSUPPORTED_MEDIA_TYPE') return isIt ? 'Choose a JPG, PNG, WebP, AVIF, MP4, WebM or MOV file' : '请选择 JPG、PNG、WebP、AVIF 图片或 MP4、WebM、MOV 视频';
  if (reason === 'IMAGE_FILE_TOO_LARGE') return isIt ? 'Image must be 12 MB or smaller' : '图片不能超过 12 MB';
  if (reason === 'VIDEO_FILE_TOO_LARGE') return isIt ? 'Video must be 100 MB or smaller' : '视频不能超过 100 MB';
  if (reason === 'INVALID_IMAGE' || reason === 'IMAGE_PROCESSING_UNAVAILABLE') return isIt ? 'Image could not be processed; choose another photo' : '图片无法处理，请换一张图片';
  if (reason === 'COMPRESSED_IMAGE_TOO_LARGE') return isIt ? 'Image is too large; choose a smaller photo' : '图片体积过大，请换一张较小的图片';
  if (reason === 'MEDIA_UPLOAD_CONNECTION_FAILED' || reason === 'Failed to fetch') return isIt ? 'Upload connection failed; check the network and retry' : '图片上传连接失败，请检查网络后重试';
  if (reason.startsWith('MEDIA_UPLOAD_FAILED_')) return isIt ? 'Media upload failed; retry' : '媒体上传失败，请重试';
  if (reason === 'MEDIA_UPLOAD_TIMEOUT') return isIt ? 'Upload timed out; retry on a stable network' : '上传超时，请在网络稳定后重试';
  if (reason === 'MEDIA_UPLOAD_ABORTED') return isIt ? 'Upload was interrupted; retry' : '上传中断，请重试';
  return isIt ? 'Upload failed; retry' : '上传失败，请重试';
};

const compressImage = (file: File): Promise<Blob> => new Promise((resolve, reject) => {
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  const loadTimeout = window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
    reject(new Error('INVALID_IMAGE'));
  }, 30_000);
  image.onload = () => {
    window.clearTimeout(loadTimeout);
    URL.revokeObjectURL(objectUrl);
    if (!image.naturalWidth || !image.naturalHeight) {
      reject(new Error('INVALID_IMAGE'));
      return;
    }
    const scale = Math.min(1, 2200 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) {
      reject(new Error('IMAGE_PROCESSING_UNAVAILABLE'));
      return;
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const encode = (quality: number) => canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error('IMAGE_PROCESSING_UNAVAILABLE'));
      } else if (blob.size > MAX_IMAGE_OUTPUT && quality > 0.42) {
        encode(quality - 0.08);
      } else if (blob.size > MAX_IMAGE_OUTPUT) {
        reject(new Error('COMPRESSED_IMAGE_TOO_LARGE'));
      } else {
        resolve(blob);
      }
    }, 'image/webp', quality);
    encode(0.86);
  };
  image.onerror = () => {
    window.clearTimeout(loadTimeout);
    URL.revokeObjectURL(objectUrl);
    reject(new Error('INVALID_IMAGE'));
  };
  image.src = objectUrl;
});

export const SmartMediaUploader: React.FC<Props> = ({ value, onChange, maxItems = 32, isIt = false, capture = false, compact = false, allowVideo = true, onBusyChange, variant = 'default' }) => {
  const { localizeCopy } = useB2B();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [retryFiles, setRetryFiles] = useState<File[]>([]);
  const [imageAspectRatios, setImageAspectRatios] = useState<Record<string, number>>({});
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [editorDragId, setEditorDragId] = useState<string | null>(null);
  const isEditor = variant === 'editor' && !compact;
  const imageInputId = `${inputId}-images`;
  const videoInputId = `${inputId}-videos`;
  const mainImageIndex = value.findIndex(item => item.type === 'image' && item.role === 'main') >= 0
    ? value.findIndex(item => item.type === 'image' && item.role === 'main')
    : value.findIndex(item => item.type === 'image');
  const addFiles = async (files: FileList | File[]) => {
    if (busy) return;
    const candidates = Array.from(files);
    const selected = candidates.slice(0, Math.max(0, maxItems - value.length));
    if (!selected.length) return;
    setBusy(true); onBusyChange?.(true); setMessage(''); setProgress(0);
    try {
      const existing = new Set(value.map(item => `${item.type}:${item.url.length}:${item.url.slice(-80)}`));
      const added: ProductMedia[] = [];
      const rejected: string[] = [];
      const failedUploads: File[] = [];
      for (const [index, file] of selected.entries()) {
        const mimeType = file.type.toLowerCase();
        const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
        const imageExtension = /^(?:jpe?g|png|webp|avif|heic|heif)$/.test(fileExtension);
        const imageType = SUPPORTED_IMAGE_TYPES.includes(mimeType)
          || (imageExtension && (!mimeType || mimeType === 'application/octet-stream' || mimeType === 'image/jpg'));
        const videoContentType = SUPPORTED_VIDEO_TYPES.includes(mimeType)
          ? mimeType
          : fileExtension === 'mov' ? 'video/quicktime'
            : fileExtension === 'mp4' || fileExtension === 'm4v' ? 'video/mp4'
              : fileExtension === 'webm' ? 'video/webm' : '';
        const type = imageType ? 'image' : videoContentType && allowVideo ? 'video' : null;
        let uploadStarted = false;
        try {
          if (!type) throw new Error('UNSUPPORTED_MEDIA_TYPE');
          if (type === 'image' && file.size > MAX_IMAGE) throw new Error('IMAGE_FILE_TOO_LARGE');
          if (type === 'video' && file.size > MAX_VIDEO) throw new Error('VIDEO_FILE_TOO_LARGE');
          const uploadBody = type === 'image' ? await compressImage(file) : file;
          const contentType = type === 'image' ? uploadBody.type || 'image/jpeg' : videoContentType;
          uploadStarted = true;
          const uploaded = await uploadMerchantMedia(uploadBody, contentType, percent => {
            setProgress(Math.round(((index + percent / 100) / selected.length) * 100));
          });
          const fingerprint = `${type}:${uploaded.url.length}:${uploaded.url.slice(-80)}`;
          if (existing.has(fingerprint)) throw new Error('DUPLICATE_MEDIA');
          existing.add(fingerprint);
          added.push({
            id: `media-${crypto.randomUUID()}`,
            type,
            url: uploaded.url,
            storageKey: uploaded.storageKey,
            contentType: uploaded.contentType,
            sizeBytes: uploaded.sizeBytes,
            role: type === 'image' && !value.some(item => item.type === 'image') && !added.some(item => item.type === 'image') ? 'main' : undefined,
            source: 'merchant-upload',
            alt: file.name
          });
        } catch (error) {
          const reason = error instanceof Error ? error.message : 'INVALID_MEDIA';
          rejected.push(`${file.name}（${getUploadErrorLabel(reason, isIt)}）`);
          if (uploadStarted) failedUploads.push(file);
        } finally {
          setProgress(Math.round(((index + 1) / selected.length) * 100));
        }
      }
      if (added.length) onChange([...value, ...added]);
      setRetryFiles(failedUploads);
      setMessage(rejected.length
        ? (isIt ? `${rejected.length} file(s) skipped` : `${rejected.length} 个文件未添加：${rejected.slice(0, 2).join('、')}${rejected.length > 2 ? '…' : ''}`)
        : (localizeCopy("已处理 {{RUDA_ARG_0}} 个媒体文件", "{{RUDA_ARG_0}} media item(s) ready", [String(added.length)])));
    } finally { setBusy(false); onBusyChange?.(false); }
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length || from === to) return;
    const next = [...value]; const [item] = next.splice(from, 1); next.splice(to, 0, item); onChange(next);
  };
  const editorImages = value.filter(item => item.type === 'image');
  const editorVideos = value.filter(item => item.type === 'video');
  const editorMainId = (editorImages.find(item => item.role === 'main') || editorImages[0])?.id ?? null;
  const previewItem = value.find(item => item.id === previewId);
  const promoteEditorMain = (id: string) => {
    onChange(value.map(item => item.type !== 'image'
      ? item
      : { ...item, role: item.id === id ? 'main' : item.role === 'main' ? 'detail' : item.role }));
  };
  const removeEditorItem = (id: string) => {
    const target = value.find(item => item.id === id);
    if (!target || busy) return;
    const next = value.filter(item => item.id !== id);
    if (target.type === 'image' && !next.some(item => item.type === 'image' && item.role === 'main')) {
      const firstImage = next.find(item => item.type === 'image');
      if (firstImage) onChange(next.map(item => item.id === firstImage.id ? { ...item, role: 'main' } : item));
      else onChange(next);
    } else {
      onChange(next);
    }
    if (previewId === id) setPreviewId(null);
  };
  const moveEditorItem = (fromId: string, toId: string) => {
    const from = value.findIndex(item => item.id === fromId);
    const to = value.findIndex(item => item.id === toId);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };
  if (isEditor) {
    return <div className="min-w-0 space-y-4">
      <label
        htmlFor={`${inputId}-all`}
        onDragOver={event => event.preventDefault()}
        onDrop={event => { event.preventDefault(); void addFiles(event.dataTransfer.files); }}
        className={`flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-center transition-colors hover:border-neutral-900 hover:bg-white ${busy ? 'pointer-events-none opacity-60' : ''}`}
      >
        {busy ? <Loader2 className="h-7 w-7 animate-spin text-neutral-700" aria-hidden="true" /> : <UploadCloud className="h-7 w-7 text-neutral-500" aria-hidden="true" />}
        <span className="text-sm font-semibold text-neutral-900">{busy ? `上传中 ${progress}%` : '拖拽图片或视频到这里，或点击上传'}</span>
        <span className="text-xs text-neutral-500">JPG / PNG / WebP / AVIF · 单张不超过 12 MB · 视频 MP4 / WebM / MOV · 最多 {maxItems} 项</span>
        <input
          id={`${inputId}-all`}
          ref={inputRef}
          type="file"
          accept={`image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif${allowVideo ? ',video/mp4,video/webm,video/quicktime,.mov,.m4v' : ''}`}
          multiple
          disabled={busy}
          className="sr-only"
          onChange={event => { if (event.target.files) void addFiles(event.target.files); event.currentTarget.value = ''; }}
        />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-600">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-neutral-800">图片 {editorImages.length}</span>
          <span className="font-semibold text-neutral-800">视频 {editorVideos.length}</span>
        </div>
        <span className="tabular-nums text-neutral-500">合计 {value.length} / {maxItems}</span>
      </div>

      <section className="min-w-0" aria-label="商品图片">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-neutral-900">图片</h4>
          <span className="text-xs text-neutral-500">首图为主图，可拖拽调整顺序</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">

          {editorImages.map(item => {
            const isMain = item.id === editorMainId;
            const index = value.findIndex(media => media.id === item.id);
            return (
              <div
                key={item.id}
                draggable={!busy}
                onDragStart={() => setEditorDragId(item.id)}
                onDragOver={event => event.preventDefault()}
                onDrop={() => { if (!busy && editorDragId) moveEditorItem(editorDragId, item.id); setEditorDragId(null); }}
                className="group relative aspect-square overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100"
              >
                <button type="button" onClick={() => setPreviewId(item.id)} className="absolute inset-0 h-full w-full" aria-label={`预览图片 ${index + 1}`}>
                  <img src={item.url} alt={item.alt || `商品图 ${index + 1}`} className="h-full w-full object-cover" />
                </button>
                <span className={`absolute left-1.5 top-1.5 z-10 rounded px-1.5 py-0.5 text-[10px] font-semibold text-white ${isMain ? 'bg-neutral-950' : 'bg-neutral-900/70'}`}>
                  {isMain ? '主图' : `图 ${index + 1}`}
                </span>
                {item.source === 'ai-try-on' && <span className="absolute right-8 top-1.5 z-10 rounded bg-violet-700/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">AI</span>}
                <button type="button" disabled={busy} onClick={() => removeEditorItem(item.id)} aria-label={`删除图片 ${index + 1}`} className="absolute right-1.5 top-1.5 z-10 grid h-8 w-8 place-items-center rounded bg-white/95 text-neutral-700 shadow-sm hover:bg-white hover:text-red-700 disabled:opacity-50">
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <div className="absolute inset-x-1 bottom-1 z-10 flex items-center justify-between gap-1">
                  <div className="flex gap-1">
                    <button type="button" disabled={busy || index <= 0} onClick={() => move(index, index - 1)} aria-label={`图片 ${index + 1} 前移`} className="grid h-8 w-8 place-items-center rounded bg-white/90 text-neutral-800 shadow-sm hover:bg-white disabled:opacity-30">
                      <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button type="button" disabled={busy || index >= value.length - 1} onClick={() => move(index, index + 1)} aria-label={`图片 ${index + 1} 后移`} className="grid h-8 w-8 place-items-center rounded bg-white/90 text-neutral-800 shadow-sm hover:bg-white disabled:opacity-30">
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  {!isMain && (
                    <button type="button" disabled={busy} onClick={() => promoteEditorMain(item.id)} aria-label={`将图片 ${index + 1} 设为主图`} className="inline-flex h-8 items-center gap-0.5 rounded bg-white/95 px-1.5 text-[10px] font-semibold text-neutral-800 shadow-sm hover:bg-white disabled:opacity-50">
                      <Star className="h-3 w-3" aria-hidden="true" />主图
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {value.length < maxItems && (
            <label htmlFor={imageInputId} className={`flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 text-neutral-500 transition-colors hover:border-neutral-900 hover:bg-white ${busy ? 'pointer-events-none opacity-60' : ''}`}>
              <ImagePlus className="h-5 w-5" aria-hidden="true" />
              <span className="text-[11px] font-semibold">添加图片</span>
              <input id={imageInputId} type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif" multiple disabled={busy} className="sr-only" onChange={event => { if (event.target.files) void addFiles(event.target.files); event.currentTarget.value = ''; }} />
            </label>
          )}
        </div>
      </section>
      <section className="min-w-0" aria-label="商品视频">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-neutral-900">视频</h4>
          <span className="text-xs text-neutral-500">单独展示 · 不占用图片位</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {editorVideos.map(item => {
            const index = value.findIndex(media => media.id === item.id);
            return (
              <div
                key={item.id}
                draggable={!busy}
                onDragStart={() => setEditorDragId(item.id)}
                onDragOver={event => event.preventDefault()}
                onDrop={() => { if (!busy && editorDragId) moveEditorItem(editorDragId, item.id); setEditorDragId(null); }}
                className="group relative aspect-video overflow-hidden rounded-lg border border-neutral-200 bg-neutral-950"
              >
                <button type="button" onClick={() => setPreviewId(item.id)} className="absolute inset-0 h-full w-full" aria-label="预览视频">
                  <video src={item.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                  <span className="absolute inset-0 grid place-items-center bg-black/20"><Play className="h-7 w-7 text-white" aria-hidden="true" /></span>
                </button>
                <span className="absolute left-1.5 top-1.5 z-10 inline-flex items-center gap-1 rounded bg-neutral-900/80 px-1.5 py-0.5 text-[10px] font-semibold text-white"><Film className="h-3 w-3" aria-hidden="true" />视频</span>
                <button type="button" disabled={busy} onClick={() => removeEditorItem(item.id)} aria-label="删除视频" className="absolute right-1.5 top-1.5 z-10 grid h-8 w-8 place-items-center rounded bg-white/95 text-neutral-700 shadow-sm hover:bg-white hover:text-red-700 disabled:opacity-50">
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <div className="absolute inset-x-1 bottom-1 z-10 flex gap-1">
                  <button type="button" disabled={busy || index <= 0} onClick={() => move(index, index - 1)} aria-label="视频前移" className="grid h-8 w-8 place-items-center rounded bg-white/90 text-neutral-800 shadow-sm hover:bg-white disabled:opacity-30">
                    <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button type="button" disabled={busy || index >= value.length - 1} onClick={() => move(index, index + 1)} aria-label="视频后移" className="grid h-8 w-8 place-items-center rounded bg-white/90 text-neutral-800 shadow-sm hover:bg-white disabled:opacity-30">
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
          {allowVideo && value.length < maxItems && (
            <label htmlFor={videoInputId} className={`flex aspect-video cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 text-neutral-500 transition-colors hover:border-neutral-900 hover:bg-white ${busy ? 'pointer-events-none opacity-60' : ''}`}>
              <Film className="h-5 w-5" aria-hidden="true" />
              <span className="text-[11px] font-semibold">添加视频</span>
              <input id={videoInputId} type="file" accept="video/mp4,video/webm,video/quicktime,.mov,.m4v" disabled={busy} className="sr-only" onChange={event => { if (event.target.files) void addFiles(event.target.files); event.currentTarget.value = ''; }} />
            </label>
          )}
        </div>
      </section>
      {message && (
        <div className={`flex flex-wrap items-center gap-3 rounded-lg px-3 py-2 text-xs ${retryFiles.length > 0 ? 'bg-red-50 text-red-800' : 'bg-neutral-100 text-neutral-700'}`} role={retryFiles.length > 0 ? 'alert' : 'status'}>
          <p>{message}</p>
          {retryFiles.length > 0 && <button type="button" disabled={busy} onClick={() => void addFiles(retryFiles)} className="font-semibold underline disabled:opacity-50">重试上传</button>}
        </div>
      )}

      {previewItem && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4" role="presentation" onClick={() => setPreviewId(null)}>
          <div role="dialog" aria-modal="true" aria-label="媒体预览" className="flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white" onClick={event => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-2.5">
              <p className="text-sm font-semibold text-neutral-900">{previewItem.type === 'video' ? '视频预览' : '图片预览'}</p>
              <button type="button" onClick={() => setPreviewId(null)} aria-label="关闭预览" className="grid h-8 w-8 place-items-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="grid min-h-0 flex-1 place-items-center overflow-auto bg-neutral-950 p-2">
              {previewItem.type === 'video'
                ? <video src={previewItem.url} controls autoPlay playsInline className="max-h-[72dvh] w-full" />
                : <img src={previewItem.url} alt={previewItem.alt || '商品图片预览'} className="max-h-[72dvh] max-w-full object-contain" />}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 px-4 py-2.5">
              <span className="text-xs text-neutral-500">第 {value.findIndex(media => media.id === previewItem.id) + 1} / {value.length} 项</span>
              <div className="flex items-center gap-2">
                {previewItem.type === 'image' && previewItem.id !== editorMainId && (
                  <button type="button" onClick={() => promoteEditorMain(previewItem.id)} className="inline-flex h-8 items-center gap-1 rounded-md border border-neutral-300 px-2.5 text-xs font-semibold text-neutral-800 hover:border-neutral-900"><Star className="h-3.5 w-3.5" aria-hidden="true" />设为主图</button>
                )}
                <button type="button" onClick={() => removeEditorItem(previewItem.id)} className="inline-flex h-8 items-center gap-1 rounded-md bg-red-700 px-2.5 text-xs font-semibold text-white hover:bg-red-800"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />删除</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>;
  }
  return <div className={compact ? 'space-y-2' : 'space-y-3'}>

    {!compact && <div className="flex items-center justify-between"><div><div className="text-sm font-semibold">商品媒体资产</div><div className="text-[11px] text-neutral-500">图片压缩后上传；可排序并设置商品封面，最多 {maxItems} 项</div></div><span className="text-[11px] font-medium text-neutral-500">{value.length}/{maxItems}</span></div>}
    <div className={compact ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-2 gap-2 sm:grid-cols-4'} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); void addFiles(event.dataTransfer.files); }}>
      {value.map((item, index) => {
        const isMainImage = item.type === 'image' && index === mainImageIndex;
        const tileSize = compact
          ? `${isMainImage ? 'col-span-2' : 'aspect-[4/5]'} min-w-0 rounded-xl border border-neutral-200`
          : 'aspect-square rounded-xl border';
        return <div key={item.id} draggable={!busy} onDragStart={() => setDragIndex(index)} onDragOver={event => event.preventDefault()} onDrop={() => { if (!busy && dragIndex !== null) move(dragIndex, index); setDragIndex(null); }} style={compact && isMainImage ? { aspectRatio: imageAspectRatios[item.id] ?? 0.8, maxHeight: '58dvh' } : undefined} className={`group relative overflow-hidden bg-neutral-100 ${tileSize}`}>
          {item.type === 'video'
            ? <video src={item.url} controls playsInline preload="metadata" className="h-full w-full bg-neutral-950 object-contain" />
            : <img src={item.url} alt={item.alt || `商品图 ${index + 1}`} onLoad={event => {
                if (!compact || !isMainImage) return;
                const image = event.currentTarget;
                const ratio = Math.min(1.5, Math.max(0.72, image.naturalWidth / image.naturalHeight));
                setImageAspectRatios(previous => previous[item.id] === ratio ? previous : { ...previous, [item.id]: ratio });
              }} className={`h-full w-full ${compact ? (isMainImage ? 'object-contain' : 'object-contain p-2') : 'object-cover'}`} />}
          {compact && item.type === 'image' && <button type="button" disabled={busy} aria-label={isMainImage ? '当前商品封面' : `将图片 ${index + 1} 设为商品封面`} aria-pressed={isMainImage} onClick={() => onChange(value.map((media, current) => ({ ...media, role: current === index ? 'main' : media.type === 'image' && (media.role === 'main' || current === mainImageIndex) ? 'detail' : media.role })))} className={`absolute left-2 top-2 inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-white shadow-sm disabled:opacity-50 ${isMainImage ? 'bg-neutral-950' : 'bg-neutral-700/85'}`}>
            {isMainImage && <Check className="h-3.5 w-3.5" />}{isMainImage ? '商品封面' : '设为封面'}
          </button>}
          {!compact && isMainImage && <span className="absolute left-1 top-1 rounded bg-black/75 px-1.5 py-1 text-[10px] font-bold text-white"><Check className="mr-0.5 inline h-3 w-3" />主图</span>}
          {item.source === 'ai-try-on' && <span className="absolute right-1 top-1 rounded bg-violet-700/90 px-1.5 py-1 text-[10px] font-bold text-white">AI 生成</span>}
          {item.type === 'video' && <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-lg bg-neutral-900/85 px-2 py-1.5 text-[11px] font-semibold text-white"><Film className="h-3.5 w-3.5" />视频</span>}
          {compact
            ? <div className="absolute inset-x-2 bottom-2 flex items-center justify-between">
                <button type="button" aria-label={`媒体 ${index + 1} 左移`} onClick={() => move(index, index - 1)} disabled={busy || index === 0} className="grid h-10 w-10 place-items-center rounded-xl border border-neutral-200 bg-white text-neutral-800 shadow-sm disabled:opacity-40"><ChevronLeft className="h-5 w-5" /></button>
                <button type="button" aria-label={`删除媒体 ${index + 1}`} title="删除" disabled={busy} onClick={() => onChange(value.filter((_, i) => i !== index))} className="grid h-10 w-10 place-items-center rounded-xl bg-neutral-950 text-white shadow-sm disabled:opacity-50"><Trash2 className="h-4 w-4" /></button>
              </div>
            : <div className="absolute inset-x-1 bottom-1 flex justify-between opacity-0 transition-opacity group-hover:opacity-100"><button type="button" onClick={() => move(index, index - 1)} disabled={busy || index === 0} className="rounded bg-white/90 p-1 disabled:opacity-30"><GripVertical className="h-3.5 w-3.5" /></button>{item.type === 'image' && <button type="button" disabled={busy} onClick={() => onChange(value.map((media, current) => ({ ...media, role: current === index ? 'main' : media.role === 'main' ? 'detail' : media.role })))} className="rounded bg-white/90 px-1.5 py-1 text-[10px] font-semibold disabled:opacity-50">设为主图</button>}<button type="button" disabled={busy} onClick={() => onChange(value.filter((_, i) => i !== index))} className="rounded bg-rose-600 p-1 text-white disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button></div>}
        </div>;
      })}
      {value.length < maxItems && <label htmlFor={inputId} className={`${compact ? `${value.length === 0 ? 'col-span-2 aspect-[4/3] ' : 'aspect-[4/5] '}flex min-h-0 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-3 text-neutral-600 transition-colors hover:border-neutral-900 hover:bg-white` : 'flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 text-neutral-500 transition-colors hover:border-neutral-900 hover:bg-white'} ${busy ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}>
        {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
        <span className="text-center text-xs font-semibold">{busy ? `上传中 ${progress}%` : capture ? '添加图片 / 视频' : '添加媒体'}</span>
        {compact && <span className="text-center text-[10px] text-neutral-400">可一次多选 · 最多 {maxItems} 项</span>}
        {!compact && <span className="text-[10px] text-neutral-400">支持拖拽</span>}
        <input ref={inputRef} id={inputId} type="file" accept={`image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif${allowVideo ? ',video/mp4,video/webm,video/quicktime,.mov,.m4v' : ''}`} capture={capture && !allowVideo ? 'environment' : undefined} multiple disabled={busy} className={compact ? 'sr-only' : 'hidden'} onChange={event => { if (event.target.files) void addFiles(event.target.files); event.currentTarget.value = ''; }} />
      </label>}
    </div>
    {message && <div className="flex flex-wrap items-center gap-3 text-xs text-amber-700" role="status"><p>{message}</p>{retryFiles.length > 0 && <button type="button" disabled={busy} onClick={() => void addFiles(retryFiles)} className="min-h-9 font-semibold underline disabled:opacity-50">重试上传</button>}</div>}
  </div>;
};

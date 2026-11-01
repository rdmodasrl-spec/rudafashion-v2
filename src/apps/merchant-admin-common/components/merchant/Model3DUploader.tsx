/**
 * 商家商品 3D 模型上传（GLB / glTF）。
 *
 * 复用现有 `uploadMerchantMedia`（同一套 R2 预签名 + 对象存储），不另建媒体库。
 * 约束：只接受 model/gltf-binary 与 model/gltf+json；≤25 MB；
 * 上传后写入 ProductMedia(type='model')，与商品一起保存；支持替换、删除与审核状态展示。
 */
import React, { useRef, useState } from 'react';
import { Box, Loader2, Trash2, UploadCloud } from 'lucide-react';
import type { ProductMedia } from '../../../../types/b2b';
import { uploadMerchantMedia } from '../../../../api/merchantMedia';

const MAX_MODEL_BYTES = 25 * 1024 * 1024;
const ACCEPTED = ['.glb', '.gltf'];
/** 前端只做体验层校验，服务端 presign 是真正的安全边界 */
const ALLOWED_TYPES = ['model/gltf-binary', 'model/gltf+json'];

type Props = {
  value: ProductMedia[];
  onChange: (media: ProductMedia[]) => void;
  isIt?: boolean;
  disabled?: boolean;
};

const resolveContentType = (file: File): string => {
  if (file.type && ALLOWED_TYPES.includes(file.type)) return file.type;
  return file.name.toLowerCase().endsWith('.gltf') ? 'model/gltf+json' : 'model/gltf-binary';
};

export const Model3DUploader: React.FC<Props> = ({ value, onChange, isIt = false, disabled = false }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const models = value.filter(item => item.type === 'model');
  const t = (zh: string, it: string) => (isIt ? it : zh);

  const pick = () => inputRef.current?.click();

  const onFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    if (!ACCEPTED.some(ext => file.name.toLowerCase().endsWith(ext))) {
      setError(t('只支持 .glb / .gltf 文件', 'Only .glb / .gltf files are supported'));
      return;
    }
    if (file.size > MAX_MODEL_BYTES) {
      setError(t('模型不能超过 25 MB', 'Model must be 25 MB or smaller'));
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      const uploaded = await uploadMerchantMedia(file, resolveContentType(file), setProgress);
      const next: ProductMedia = {
        id: `model-${Date.now()}`,
        type: 'model',
        url: uploaded.url,
        storageKey: uploaded.storageKey,
        contentType: uploaded.contentType,
        sizeBytes: uploaded.sizeBytes,
        role: 'main',
        source: 'merchant-upload',
        reviewStatus: 'pending',
        alt: file.name
      };
      onChange([...value.filter(item => item.type !== 'model'), next]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('上传失败，请重试', 'Upload failed; retry'));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-neutral-900">
            <Box className="h-4 w-4" strokeWidth={1.7} />
            {t('3D 商品模型', '3D product model')}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            {t('GLB / glTF，≤25 MB。买家可在商品详情里 360° 旋转查看。', 'GLB / glTF up to 25 MB. Buyers can rotate it in 3D on the product page.')}
          </p>
        </div>
        {models.length === 0 && (
          <button
            type="button"
            onClick={pick}
            disabled={disabled || busy}
            className="inline-flex shrink-0 items-center gap-1.5 border border-neutral-300 px-2.5 py-1.5 text-xs hover:border-neutral-950 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
            {busy ? `${progress}%` : t('上传模型', 'Upload model')}
          </button>
        )}
      </div>

      {models.map(model => (
        <div key={model.id} className="mt-3 flex items-center justify-between gap-3 border-t border-neutral-200 pt-3">
          <div className="min-w-0">
            <p className="truncate text-xs text-neutral-800">{model.alt || model.url}</p>
            <p className="mt-0.5 text-xs text-neutral-500">
              {model.reviewStatus === 'approved'
                ? t('已审核通过', 'Approved')
                : t('待审核（审核通过后买家可见）', 'Pending review (visible after approval)')}
              {model.sizeBytes ? ` · ${(model.sizeBytes / 1024 / 1024).toFixed(1)} MB` : ''}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={pick} disabled={disabled || busy} className="border border-neutral-300 px-2 py-1 text-xs hover:border-neutral-950 disabled:opacity-50">
              {t('替换', 'Replace')}
            </button>
            <button
              type="button"
              onClick={() => onChange(value.filter(item => item.id !== model.id))}
              disabled={disabled}
              aria-label={t('删除模型', 'Delete model')}
              className="border border-neutral-300 px-2 py-1 text-xs text-rose-600 hover:border-rose-500 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}

      {busy && (
        <div className="mt-3 h-1 w-full overflow-hidden bg-neutral-200" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-neutral-950 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
        className="hidden"
        onChange={event => void onFiles(event.target.files)}
      />
    </div>
  );
};

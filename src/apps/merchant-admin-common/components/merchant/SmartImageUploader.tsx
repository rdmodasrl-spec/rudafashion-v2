import React, { useId, useRef, useState } from 'react';
import { Check, GripVertical, ImagePlus, Loader2, Sparkles, Trash2, UploadCloud } from 'lucide-react';
import { useB2B } from '../../../../context/B2BContext';


type SmartImageUploaderProps = {
  value: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
  isIt?: boolean;
};

const MAX_FILE_SIZE = 12 * 1024 * 1024;
const MAX_OUTPUT_SIZE = 1.6 * 1024 * 1024;

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, 1800 / Math.max(image.naturalWidth, image.naturalHeight));
      if (image.naturalWidth < 500 || image.naturalHeight < 500) {
        URL.revokeObjectURL(objectUrl);
        return reject(new Error('IMAGE_RESOLUTION_LOW'));
      }
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) return reject(new Error('IMAGE_PROCESSING_UNAVAILABLE'));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      let quality = 0.86;
      let result = canvas.toDataURL('image/jpeg', quality);
      while (result.length > MAX_OUTPUT_SIZE * 1.37 && quality > 0.5) {
        quality -= 0.08;
        result = canvas.toDataURL('image/jpeg', quality);
      }
      resolve(result);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('INVALID_IMAGE'));
    };
    image.src = objectUrl;
  });
}

export const SmartImageUploader: React.FC<SmartImageUploaderProps> = ({
  value,
  onChange,
  maxImages = 8,
  isIt = false
}) => {
  const { localizeCopy } = useB2B();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  const addFiles = async (files: FileList | File[]) => {
    const candidates = Array.from(files);
    if (!candidates.length) return;
    setMessage('');
    const available = Math.max(0, maxImages - value.length);
    const selected = candidates.slice(0, available);
    if (!selected.length) {
      setMessage(localizeCopy("最多上传 {{RUDA_ARG_0}} 张图片", "Massimo {{RUDA_ARG_0}} immagini", [String(maxImages)]));
      return;
    }
    setProcessing(true);
    try {
      const images: string[] = [];
      const knownImages = new Set(value.map(imageFingerprint));
      for (const file of selected) {
        if (!file.type.startsWith('image/')) continue;
        if (file.size > MAX_FILE_SIZE) {
          setMessage(localizeCopy('有图片超过 12 MB', 'Un file supera 12 MB'));
          continue;
        }
        const image = await compressImage(file);
        const fingerprint = imageFingerprint(image);
        if (knownImages.has(fingerprint)) {
          setMessage(localizeCopy('重复图片已自动跳过', 'Immagine duplicata ignorata'));
          continue;
        }
        knownImages.add(fingerprint);
        images.push(image);
      }
      if (images.length) onChange([...value, ...images]);
    } catch (error) {
      setMessage(error instanceof Error && error.message === 'INVALID_IMAGE'
        ? (localizeCopy('图片格式无法识别', 'Immagine non valida'))
        : error instanceof Error && error.message === 'IMAGE_RESOLUTION_LOW'
          ? (localizeCopy('请使用至少 500×500 像素的图片', 'Usa un’immagine di almeno 500×500 px'))
        : (localizeCopy('图片处理失败，请重试', 'Elaborazione immagine non riuscita')));
    } finally {
      setProcessing(false);
    }
  };

  function imageFingerprint(value: string): string {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += Math.max(1, Math.floor(value.length / 4096))) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `${hash >>> 0}:${value.length}`;
  }

  const moveImage = (from: number, to: number) => {
    if (from === to || to < 0 || to >= value.length) return;
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-neutral-900 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-500" />
            {localizeCopy('智能图片库', 'Galleria intelligente')}
          </div>
          <div className="text-[11px] text-neutral-500">
            {localizeCopy('第一张为商品主图 · 支持 JPG、PNG、WebP，自动压缩', 'La prima immagine sarà la copertina · JPG/PNG/WebP')}
          </div>
        </div>
        <span className="text-[11px] font-medium text-neutral-500">{value.length}/{maxImages}</span>
      </div>

      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-2"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (dragIndex !== null) moveImage(dragIndex, value.length - 1);
          setDragIndex(null);
        }}
      >
        {value.map((image, index) => (
          <div
            key={`${image.slice(0, 40)}-${index}`}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragEnd={() => setDragIndex(null)}
            className="relative aspect-square overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 group"
          >
            <img src={image} alt={`${isIt ? 'Immagine' : '图片'} ${index + 1}`} className="h-full w-full object-cover" />
            {index === 0 && (
              <span className="absolute left-1.5 top-1.5 rounded-md bg-black/75 px-1.5 py-1 text-[10px] font-semibold text-white">
                <Check className="mr-0.5 inline h-3 w-3" />{localizeCopy('主图', 'Copertina')}
              </span>
            )}
            <div className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-between opacity-0 transition-opacity group-hover:opacity-100">
              <button type="button" onClick={() => moveImage(index, index - 1)} disabled={index === 0} className="rounded bg-white/90 p-1 text-neutral-700 disabled:opacity-30" title={localizeCopy('设为主图', 'Imposta come copertina')}>
                <GripVertical className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))} className="rounded bg-red-600/90 p-1 text-white" title={localizeCopy('删除', 'Rimuovi')}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
        {value.length < maxImages && (
          <label htmlFor={inputId} className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 text-neutral-500 transition-colors hover:border-black hover:bg-white">
            {processing ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
            <span className="text-[11px] font-semibold">{processing ? (localizeCopy('处理中...', 'Elaborazione...')) : (localizeCopy('添加图片', 'Aggiungi foto'))}</span>
            <input ref={inputRef} id={inputId} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(event) => { if (event.target.files) void addFiles(event.target.files); event.currentTarget.value = ''; }} />
          </label>
        )}
      </div>

      <label
        htmlFor={inputId}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); void addFiles(event.dataTransfer.files); }}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
      >
        <UploadCloud className="h-4 w-4" /> {localizeCopy('拖拽或选择多张图片', 'Trascina o seleziona più immagini')}
      </label>
      {message && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">{message}</div>}
    </div>
  );
};

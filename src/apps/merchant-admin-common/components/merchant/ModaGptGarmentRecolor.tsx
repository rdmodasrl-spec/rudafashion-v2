import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Download, Eraser, ImagePlus, Paintbrush, RefreshCw, RotateCcw, Save, Undo2 } from 'lucide-react';
import { apiPost } from '../../../../api/client';
import { useB2B } from '../../../../context/B2BContext';
import { recolorMaskedPixelsAsync } from '../../../../shared/garmentRecolor';

type ModaGptGarmentRecolorProps = {
  onBack: () => void;
  /** 保存成功后回调：携带本次保存的预览与颜色，便于上层工作台记录结果版本。 */
  onSaved: (detail?: { dataUrl: string; color: string }) => void;
  /** 由工作台带入的源图（例如刚生成的结果），避免用户重新上传。 */
  initialImageDataUrl?: string;
};

const garmentColorPresets = [
  { name: '正红', value: '#c62828' },
  { name: '酒红', value: '#7f1d3a' },
  { name: '橘色', value: '#e87524' },
  { name: '奶油黄', value: '#e6ca7a' },
  { name: '森林绿', value: '#286447' },
  { name: '海军蓝', value: '#243b63' },
  { name: '薰衣草', value: '#8b78aa' },
  { name: '黑色', value: '#252525' }
] as const;

function readLocalImage(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size === 0 || file.size > 8 * 1024 * 1024) {
    return Promise.reject(new Error('MODAGPT_RECOLOR_IMAGE_INVALID'));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('MODAGPT_RECOLOR_IMAGE_READ_FAILED'));
    reader.onerror = () => reject(reader.error || new Error('MODAGPT_RECOLOR_IMAGE_READ_FAILED'));
    reader.readAsDataURL(file);
  });
}

export const ModaGptGarmentRecolor: React.FC<ModaGptGarmentRecolorProps> = ({ onBack, onSaved, initialImageDataUrl }) => {
  const { localizeCopy } = useB2B();
  const [sourceDataUrl, setSourceDataUrl] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [targetColor, setTargetColor] = useState('#c62828');
  const [selectedColors, setSelectedColors] = useState<string[]>(['#c62828']);
  const [variantResults, setVariantResults] = useState<Array<{ color: string; dataUrl: string; saved: boolean; clientRequestId?: string }>>([]);
  const [brushSize, setBrushSize] = useState(34);
  const [erasing, setErasing] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<{ completed: number; total: number } | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [savingColor, setSavingColor] = useState<string | null>(null);
  const [error, setError] = useState('');
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const maskUndoRef = useRef<ImageData | null>(null);
  const overlayUndoRef = useRef<ImageData | null>(null);
  const activeResult = variantResults.find(result => result.color === targetColor) || null;
  const hasVariants = variantResults.length > 0;

  useEffect(() => {
    if (!sourceDataUrl) {
      setImageReady(false);
      return;
    }
    let active = true;
    const image = new Image();
    image.onload = () => {
      if (!active) return;
      const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const sourceCanvas = sourceCanvasRef.current;
      const maskCanvas = maskCanvasRef.current;
      const overlayCanvas = overlayCanvasRef.current;
      const sourceContext = sourceCanvas?.getContext('2d');
      if (!sourceCanvas || !maskCanvas || !overlayCanvas || !sourceContext) {
        setError(localizeCopy('图片编辑器无法初始化，请刷新后重试。', 'Impossibile inizializzare l’editor immagini. Ricarica e riprova.'));
        return;
      }
      sourceCanvas.width = width;
      sourceCanvas.height = height;
      maskCanvas.width = width;
      maskCanvas.height = height;
      overlayCanvas.width = width;
      overlayCanvas.height = height;
      sourceContext.drawImage(image, 0, 0, width, height);
      setImageReady(true);
      setHasSelection(false);
      setCanUndo(false);
      maskUndoRef.current = null;
      overlayUndoRef.current = null;
      setVariantResults([]);
      setShowOriginal(false);
      setError('');
    };
    image.onerror = () => {
      if (active) {
        setImageReady(false);
        setError(localizeCopy('图片无法读取，请选择 JPG、PNG 或 WebP 图片。', 'Impossibile leggere l’immagine. Scegli JPG, PNG o WebP.'));
      }
    };
    image.src = sourceDataUrl;
    return () => { active = false; };
  }, [sourceDataUrl]);

  // 工作台把已生成的结果直接带入换色，用户不需要重新上传同一张图。
  useEffect(() => {
    if (!initialImageDataUrl) return;
    setSourceDataUrl(initialImageDataUrl);
    setSourceName(localizeCopy('当前结果', 'Risultato corrente'));
    setVariantResults([]);
    setShowOriginal(false);
    setError('');
  }, [initialImageDataUrl, localizeCopy]);

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * canvas.width / bounds.width,
      y: (event.clientY - bounds.top) * canvas.height / bounds.height
    };
  };

  const drawStroke = (from: { x: number; y: number }, to: { x: number; y: number }, canvas: HTMLCanvasElement, color: string, erase: boolean) => {
    const context = canvas.getContext('2d');
    if (!context) return;
    const bounds = canvas.getBoundingClientRect();
    context.save();
    context.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
    context.strokeStyle = color;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = brushSize * canvas.width / Math.max(1, bounds.width);
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
    context.restore();
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!imageReady || hasVariants || generating) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    const point = getPoint(event);
    lastPointRef.current = point;
    const maskCanvas = maskCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!maskCanvas || !overlayCanvas) return;
    const maskContext = maskCanvas.getContext('2d');
    const overlayContext = overlayCanvas.getContext('2d');
    if (!maskContext || !overlayContext) return;
    maskUndoRef.current = maskContext.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    overlayUndoRef.current = overlayContext.getImageData(0, 0, overlayCanvas.width, overlayCanvas.height);
    setCanUndo(true);
    drawStroke(point, point, maskCanvas, '#ffffff', erasing);
    drawStroke(point, point, overlayCanvas, 'rgba(16, 185, 129, 0.5)', erasing);
    setError('');
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !lastPointRef.current) return;
    const maskCanvas = maskCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!maskCanvas || !overlayCanvas) return;
    const point = getPoint(event);
    drawStroke(lastPointRef.current, point, maskCanvas, '#ffffff', erasing);
    drawStroke(lastPointRef.current, point, overlayCanvas, 'rgba(16, 185, 129, 0.5)', erasing);
    lastPointRef.current = point;
  };

  const finishStroke = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    setHasSelection(Boolean(maskCanvasRef.current?.getContext('2d')
      ?.getImageData(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height).data.some((value, index) => index % 4 === 3 && value > 0)));
  };

  const undoLastStroke = () => {
    const maskCanvas = maskCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!maskCanvas || !overlayCanvas || !maskUndoRef.current || !overlayUndoRef.current) return;
    maskCanvas.getContext('2d')?.putImageData(maskUndoRef.current, 0, 0);
    overlayCanvas.getContext('2d')?.putImageData(overlayUndoRef.current, 0, 0);
    maskUndoRef.current = null;
    overlayUndoRef.current = null;
    setCanUndo(false);
    setHasSelection(Boolean(maskCanvas.getContext('2d')
      ?.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data.some((value, index) => index % 4 === 3 && value > 0)));
    setVariantResults([]);
  };

  const clearSelection = () => {
    if (hasVariants || generating) return;
    const maskCanvas = maskCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    maskCanvas?.getContext('2d')?.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    overlayCanvas?.getContext('2d')?.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    setHasSelection(false);
    setCanUndo(false);
    maskUndoRef.current = null;
    overlayUndoRef.current = null;
    setVariantResults([]);
    setShowOriginal(false);
    setError('');
  };

  const applyRecolor = async () => {
    const sourceCanvas = sourceCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (generating || savingColor !== null) return;
    if (!sourceCanvas || !maskCanvas || !imageReady) {
      setError(localizeCopy('请先上传一张服装图片。', 'Carica prima un’immagine del capo.'));
      return;
    }
    if (!hasSelection) {
      setError(localizeCopy('请先用画笔涂选需要换色的服装区域。', 'Seleziona prima l’area del capo da ricolorare.'));
      return;
    }
    if (!selectedColors.length) {
      setError(localizeCopy('至少选择一种目标颜色。', 'Seleziona almeno un colore.'));
      return;
    }
    if (variantResults.some(result => selectedColors.includes(result.color))
      && !window.confirm(localizeCopy(
        '重新生成会替换这些颜色的当前预览；已保存到作品库的版本不会删除。继续吗？',
        'La nuova generazione sostituirà le anteprime selezionate; le varianti già salvate resteranno nel portfolio. Continuare?'
      ))) return;
    setGenerating(true);
    setGenerationProgress({ completed: 0, total: selectedColors.length });
    setError('');
    let completed = 0;
    try {
      const sourceContext = sourceCanvas.getContext('2d');
      const maskContext = maskCanvas.getContext('2d');
      if (!sourceContext || !maskContext) throw new Error('GARMENT_RECOLOR_CANVAS_UNAVAILABLE');
      const source = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
      const mask = maskContext.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
      const maskAlpha = new Uint8ClampedArray(mask.data.length / 4);
      for (let pixel = 0; pixel < maskAlpha.length; pixel += 1) maskAlpha[pixel] = mask.data[pixel * 4 + 3];
      const results = variantResults.filter(result => !selectedColors.includes(result.color));
      setTargetColor(selectedColors[0]);
      for (let index = 0; index < selectedColors.length; index += 1) {
        if (index > 0) await new Promise<void>(resolve => window.setTimeout(resolve, 0));
        const resultCanvas = document.createElement('canvas');
        resultCanvas.width = sourceCanvas.width;
        resultCanvas.height = sourceCanvas.height;
        const resultContext = resultCanvas.getContext('2d');
        if (!resultContext) throw new Error('GARMENT_RECOLOR_CANVAS_UNAVAILABLE');
        const resultPixels = await recolorMaskedPixelsAsync(source.data, maskAlpha, selectedColors[index]);
        const resultImage = new ImageData(resultPixels, source.width, source.height);
        resultContext.putImageData(resultImage, 0, 0);
        results.push({
          color: selectedColors[index],
          dataUrl: resultCanvas.toDataURL('image/webp', 0.9),
          saved: false
        });
        completed = index + 1;
        setVariantResults([...results]);
        setGenerationProgress({ completed, total: selectedColors.length });
      }
      setShowOriginal(false);
    } catch (recolorError) {
      const reason = recolorError instanceof Error ? recolorError.message : 'GARMENT_RECOLOR_FAILED';
      setError(completed
        ? localizeCopy(
          `已生成 ${completed}/${selectedColors.length} 个颜色候选，其余失败：${reason}`,
          `${completed}/${selectedColors.length} varianti generate; le altre non sono riuscite: ${reason}`
        )
        : `${localizeCopy('换色预览生成失败：', 'Anteprima non riuscita: ')}${reason}`);
    } finally {
      setGenerating(false);
      setGenerationProgress(null);
    }
  };

  const saveResult = async (color: string) => {
    const result = variantResults.find(item => item.color === color);
    if (!result || result.saved || savingColor || generating) return;
    const clientRequestId = result.clientRequestId || crypto.randomUUID();
    if (!result.clientRequestId) {
      setVariantResults(current => current.map(item => item.color === color ? { ...item, clientRequestId } : item));
    }
    setSavingColor(color);
    setError('');
    try {
      await apiPost('/api/merchant/modagpt/designs', {
        title: `${(sourceName || '服装').slice(0, 130)} · ${color}`,
        prompt: `ModaUI 局部换色（手动选区） · ${color} · ${(sourceName || '本地图片').slice(0, 850)}`,
        category: 'imageGeneration',
        imageDataUrl: result.dataUrl,
        clientRequestId
      });
      setVariantResults(current => current.map(item => item.color === color ? { ...item, saved: true } : item));
      onSaved({ dataUrl: result.dataUrl, color });
    } catch (saveError) {
      setError(saveError instanceof Error
        ? `${localizeCopy('保存到作品库失败：', 'Salvataggio non riuscito: ')}${saveError.message}`
        : localizeCopy('保存到作品库失败，请稍后重试。', 'Salvataggio non riuscito. Riprova.'));
    } finally {
      setSavingColor(null);
    }
  };

  const chooseImage = async (file: File | undefined) => {
    if (!file || generating || savingColor !== null) return;
    setError('');
    try {
      const nextDataUrl = await readLocalImage(file);
      if (nextDataUrl !== sourceDataUrl) setImageReady(false);
      setSourceDataUrl(nextDataUrl);
      setSourceName(file.name);
      if (maskCanvasRef.current) maskCanvasRef.current.getContext('2d')?.clearRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
      if (overlayCanvasRef.current) overlayCanvasRef.current.getContext('2d')?.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
      setHasSelection(false);
      setCanUndo(false);
      maskUndoRef.current = null;
      overlayUndoRef.current = null;
      setVariantResults([]);
      setShowOriginal(false);
    } catch {
      setError(localizeCopy('图片格式或大小不符合要求。请上传 8 MB 以内的 JPG、PNG 或 WebP。', 'Formato o dimensione non validi. Carica JPG, PNG o WebP fino a 8 MB.'));
    }
  };

  const toggleSelectedColor = (color: string) => {
    if (generating) return;
    if (selectedColors.includes(color)) {
      const nextColors = selectedColors.filter(item => item !== color);
      setSelectedColors(nextColors);
      if (color === targetColor && nextColors.length) setTargetColor(nextColors[0]);
      return;
    }
    if (selectedColors.length >= 4) {
      setError(localizeCopy('一次最多比较 4 种颜色。', 'Puoi confrontare al massimo 4 colori.'));
      return;
    }
    setSelectedColors(current => [...current, color]);
    setTargetColor(color);
    setError('');
  };

  const addCustomColor = () => {
    if (generating) return;
    if (selectedColors.includes(targetColor)) return;
    if (selectedColors.length >= 4) {
      setError(localizeCopy('一次最多比较 4 种颜色。', 'Puoi confrontare al massimo 4 colori.'));
      return;
    }
    setSelectedColors(current => [...current, targetColor]);
    setError('');
  };

  return (
    <div className="mx-auto w-full max-w-6xl py-4 sm:py-6">
      <button type="button" disabled={generating} onClick={onBack} className="mb-4 inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50">
        <ArrowLeft className="h-4 w-4" />{localizeCopy('返回五项创作', 'Torna alle funzioni')}
      </button>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-800">GARMENT RECOLOR</p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-neutral-950">{localizeCopy('服装换色', 'Ricolorazione capo')}</h1>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-neutral-600">{localizeCopy('本机手动选区换色，原图不变；自动识别尚未接入。', 'Selezione manuale locale; originale intatto. Riconoscimento automatico non disponibile.')}</p>
            </div>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[9px] font-semibold text-amber-800">{localizeCopy('手动选区 · 本地预览', 'Selezione manuale · anteprima locale')}</span>
          </div>

          <div className="mt-5 flex min-h-[320px] items-center justify-center overflow-hidden rounded-3xl border border-dashed border-neutral-300 bg-neutral-50 p-3 sm:min-h-[420px]">
            {sourceDataUrl ? (
              <div className="relative inline-block max-h-[58dvh] max-w-full overflow-hidden rounded-xl">
                <img
                  src={activeResult && !showOriginal ? activeResult.dataUrl : sourceDataUrl}
                  alt={localizeCopy(showOriginal ? '服装原图' : activeResult ? '服装换色预览' : '服装原图与选区', showOriginal ? 'Immagine originale' : activeResult ? 'Anteprima ricolorata' : 'Immagine originale con selezione')}
                  draggable={false}
                  className="block max-h-[58dvh] max-w-full select-none object-contain"
                />
                <canvas
                  ref={overlayCanvasRef}
                  aria-label={localizeCopy('涂刷需要换色的服装区域', 'Seleziona con il pennello l’area da ricolorare')}
                  className={`absolute inset-0 h-full w-full touch-none ${imageReady && !hasVariants && !generating ? 'pointer-events-auto' : 'pointer-events-none'} ${hasVariants ? 'opacity-0' : ''}`}
                  style={{ cursor: erasing ? 'cell' : 'crosshair' }}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={finishStroke}
                  onPointerCancel={finishStroke}
                  onLostPointerCapture={finishStroke}
                />
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()} className="flex min-h-64 w-full max-w-sm flex-col items-center justify-center rounded-2xl px-5 text-center transition hover:bg-white">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-neutral-700 shadow-sm"><ImagePlus className="h-5 w-5" /></span>
                <b className="mt-3 text-sm text-neutral-900">{localizeCopy('上传服装商品图', 'Carica foto del capo')}</b>
                <span className="mt-1 text-[10px] leading-4 text-neutral-500">{localizeCopy('JPG、PNG 或 WebP，最大 8 MB。图片先在本机浏览器处理。', 'JPG, PNG o WebP, massimo 8 MB. L’immagine viene elaborata localmente nel browser.')}</span>
              </button>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-neutral-500">
            <span className="truncate">{sourceName || localizeCopy('尚未上传图片', 'Nessuna immagine caricata')}</span>
            <div className="flex flex-wrap items-center gap-2">
              {activeResult && <button type="button" onClick={() => setShowOriginal(value => !value)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-neutral-200 px-3 font-semibold text-neutral-700">
                <RotateCcw className="h-3.5 w-3.5" />{showOriginal ? localizeCopy('查看换色结果', 'Mostra risultato') : localizeCopy('对比原图', 'Confronta originale')}
              </button>}
              {sourceDataUrl && <button type="button" disabled={generating || savingColor !== null} onClick={() => fileInputRef.current?.click()} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-neutral-200 px-3 font-semibold text-neutral-700 disabled:opacity-50">
                <ImagePlus className="h-3.5 w-3.5" />{localizeCopy('更换图片', 'Cambia immagine')}
              </button>}
            </div>
          </div>
          {hasVariants && <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {variantResults.map(result => <button
              key={result.color}
              type="button"
              disabled={generating}
              aria-pressed={targetColor === result.color}
              onClick={() => { setTargetColor(result.color); setShowOriginal(false); }}
              className={`overflow-hidden rounded-2xl border text-left disabled:cursor-wait ${targetColor === result.color ? 'border-neutral-950 ring-1 ring-neutral-950' : 'border-neutral-200'}`}
            >
              <img src={result.dataUrl} alt={`${localizeCopy('换色候选', 'Variante colore')} ${result.color}`} className="aspect-[4/3] w-full bg-neutral-50 object-contain" />
              <span className="flex items-center justify-between px-2 py-1.5 text-[9px] font-semibold text-neutral-700">
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: result.color }} />{result.color.toUpperCase()}</span>
                {result.saved && <Check className="h-3 w-3 text-emerald-700" />}
              </span>
            </button>)}
          </div>}
          {error && <p role="alert" className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] leading-5 text-rose-800">{error}</p>}
          {variantResults.some(result => result.saved) && <p role="status" className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-800"><Check className="h-4 w-4" />{localizeCopy(`已保存 ${variantResults.filter(result => result.saved).length} 个颜色到 ModaUI 作品库。`, `${variantResults.filter(result => result.saved).length} varianti salvate nel portfolio ModaUI.`)}</p>}
        </section>

        <aside className="space-y-4">
          <section className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-neutral-950">{localizeCopy('1. 选择区域', '1. Seleziona area')}</h2>
            <div className="mt-1 flex flex-wrap gap-2 text-[10px] leading-4 text-neutral-500"><span>{localizeCopy('涂选衣物', 'Dipingi il capo')}</span><span>{localizeCopy('边缘缩小画笔', 'Pennello più piccolo')}</span><span>{localizeCopy('橡皮可修正', 'Usa la gomma')}</span><span>{localizeCopy('勿涂人物背景', 'Evita pelle e sfondo')}</span><span>{localizeCopy('勿涂配饰', 'Evita accessori')}</span></div>
            <div className="mt-3 flex gap-2">
              <button type="button" disabled={!imageReady || hasVariants || generating} onClick={() => setErasing(false)} className={`inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-2xl border text-xs font-semibold ${!erasing ? 'border-neutral-950 bg-neutral-950 text-white hover:bg-neutral-800' : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50'}`}><Paintbrush className="h-4 w-4" />{localizeCopy('画笔', 'Pennello')}</button>
              <button type="button" disabled={!imageReady || hasVariants || generating} onClick={() => setErasing(true)} className={`inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-2xl border text-xs font-semibold ${erasing ? 'border-neutral-950 bg-neutral-950 text-white hover:bg-neutral-800' : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50'}`}><Eraser className="h-4 w-4" />{localizeCopy('橡皮擦', 'Gomma')}</button>
            </div>
            <label className="mt-4 block text-[10px] font-semibold text-neutral-700">{localizeCopy('画笔大小', 'Dimensione pennello')} · {brushSize}px
              <input type="range" min="8" max="100" step="2" value={brushSize} disabled={!imageReady || hasVariants || generating} onChange={event => setBrushSize(Number(event.target.value))} className="mt-2 w-full accent-neutral-900" />
            </label>
            <button type="button" disabled={!hasSelection || hasVariants || generating} onClick={clearSelection} className="mt-3 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-2xl border border-neutral-200 text-[10px] font-semibold text-neutral-700 disabled:opacity-40 hover:bg-neutral-50"><RotateCcw className="h-3.5 w-3.5" />{localizeCopy('清除选区，重新涂刷', 'Cancella selezione')}</button>
            <button type="button" disabled={!canUndo || hasVariants || generating} onClick={undoLastStroke} className="mt-2 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-2xl border border-neutral-200 text-[10px] font-semibold text-neutral-700 disabled:opacity-40 hover:bg-neutral-50"><Undo2 className="h-3.5 w-3.5" />{localizeCopy('撤销上一步涂刷', 'Annulla ultima pennellata')}</button>
            {hasVariants && <button type="button" disabled={generating} onClick={() => { setVariantResults([]); setShowOriginal(false); }} className="mt-2 inline-flex min-h-9 w-full items-center justify-center rounded-2xl border border-neutral-200 text-[10px] font-semibold text-neutral-700 disabled:cursor-wait disabled:opacity-50">{localizeCopy('返回修改选区', 'Modifica selezione')}</button>}
          </section>

          <section className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-neutral-950">{localizeCopy('2. 选择颜色候选', '2. Scegli colori')}</h2>
            <p className="mt-1 text-[10px] leading-4 text-neutral-500">{localizeCopy('最多选 4 色，同一选区批量对比。', 'Confronta fino a 4 colori sulla stessa selezione.')}</p>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {garmentColorPresets.map(color => <button key={color.value} type="button" disabled={generating} aria-label={localizeCopy(color.name, color.name)} aria-pressed={selectedColors.includes(color.value)} onClick={() => toggleSelectedColor(color.value)} className={`flex h-9 items-center justify-center rounded-xl border disabled:cursor-wait disabled:opacity-50 ${selectedColors.includes(color.value) ? 'border-neutral-950 ring-2 ring-neutral-900 ring-offset-1' : 'border-neutral-200'}`}><span className="h-5 w-5 rounded-full border border-black/10" style={{ backgroundColor: color.value }} /></button>)}
            </div>
            <label className="mt-3 flex min-h-10 items-center gap-3 rounded-2xl border border-neutral-200 px-3 text-[10px] font-semibold text-neutral-700">
              <input type="color" value={targetColor} disabled={generating} onChange={event => setTargetColor(event.target.value)} className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0 disabled:cursor-wait" />
              {localizeCopy('自定义颜色', 'Colore personalizzato')} <span className="ml-auto font-mono">{targetColor.toUpperCase()}</span>
            </label>
            <button type="button" onClick={addCustomColor} disabled={generating || selectedColors.includes(targetColor) || selectedColors.length >= 4} className="mt-2 min-h-9 w-full rounded-2xl border border-neutral-200 text-[10px] font-semibold text-neutral-700 disabled:opacity-40">{localizeCopy('加入候选颜色', 'Aggiungi colore')}</button>
          </section>

          <section className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-neutral-950">{localizeCopy('3. 预览与保存', '3. Anteprima e salvataggio')}</h2>
            <div className="mt-1 flex flex-wrap gap-2 text-[10px] leading-4 text-neutral-500"><span>{localizeCopy('预览仅本机生成', 'Anteprima locale')}</span><span>{localizeCopy('保存后上传作品库', 'Salva nel portfolio')}</span></div>
            <button type="button" disabled={!imageReady || !hasSelection || !selectedColors.length || generating || savingColor !== null} onClick={() => void applyRecolor()} className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-4 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500 hover:bg-neutral-800">
              {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Paintbrush className="h-4 w-4" />}{generating ? localizeCopy(`生成中 ${generationProgress?.completed || 0}/${generationProgress?.total || selectedColors.length}`, `Generazione ${generationProgress?.completed || 0}/${generationProgress?.total || selectedColors.length}`) : localizeCopy(`生成 ${selectedColors.length} 个颜色候选`, `Genera ${selectedColors.length} varianti`)}
            </button>
            {activeResult && <>
              <a href={activeResult.dataUrl} download={`modagpt-recolor-${targetColor.slice(1)}.webp`} className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-2xl border border-neutral-200 px-4 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"><Download className="h-4 w-4" />{localizeCopy('下载此颜色', 'Scarica variante')}</a>
              <button type="button" disabled={generating || savingColor !== null || activeResult.saved} onClick={() => void saveResult(activeResult.color)} className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 hover:bg-emerald-800">
                {savingColor === activeResult.color ? <RefreshCw className="h-4 w-4 animate-spin" /> : activeResult.saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                {savingColor === activeResult.color ? localizeCopy('保存中…', 'Salvataggio…') : activeResult.saved ? localizeCopy('已保存', 'Salvato') : localizeCopy('保存此颜色到作品库', 'Salva variante nel portfolio')}
              </button>
            </>}
          </section>
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[10px] leading-4 text-amber-900">{localizeCopy('请检查选区边缘、阴影和相邻衣物。', 'Controlla bordi, ombre e capi adiacenti.')}</p>
        </aside>
      </div>
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={event => { void chooseImage(event.target.files?.[0]); event.currentTarget.value = ''; }} />
      <canvas ref={sourceCanvasRef} className="hidden" />
      <canvas ref={maskCanvasRef} className="hidden" />
    </div>
  );
};

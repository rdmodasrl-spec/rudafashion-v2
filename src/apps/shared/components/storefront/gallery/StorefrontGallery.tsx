import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 商品多图画廊：主图 + 缩略图 + 点击切换 + 放大查看 + 键盘 + 触控滑动。
 * 图片缺失/加载失败时显示中性占位，不回落品牌 Logo。
 */
export const StorefrontGallery: React.FC<{
  images: string[];
  alt: string;
  ratio?: string;
  priority?: boolean;
  thumbClassName?: string;
}> = ({ images, alt, ratio = '4 / 5', priority = false, thumbClassName = '' }) => {
  const usable = images.filter(Boolean);
  const [index, setIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  const touchStart = useRef<number | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const signature = usable.join('|');

  useEffect(() => { setIndex(0); setFailed({}); }, [signature]);

  const move = useCallback((delta: number) => {
    if (!usable.length) return;
    setIndex(current => (current + delta + usable.length) % usable.length);
  }, [usable.length]);

  useEffect(() => {
    if (!zoomOpen) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setZoomOpen(false);
      if (event.key === 'ArrowRight') move(1);
      if (event.key === 'ArrowLeft') move(-1);
    };
    window.addEventListener('keydown', onKey);
    dialogRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomOpen, move]);

  const current = usable[index];
  const currentFailed = failed[index];

  return (
    <div>
      <div
        className="relative overflow-hidden bg-neutral-100"
        style={{ aspectRatio: ratio }}
        onTouchStart={event => { touchStart.current = event.touches[0]?.clientX ?? null; }}
        onTouchEnd={event => {
          const start = touchStart.current;
          touchStart.current = null;
          if (start === null) return;
          const end = event.changedTouches[0]?.clientX ?? start;
          if (Math.abs(end - start) > 40) move(end < start ? 1 : -1);
        }}
      >
        {current && !currentFailed ? (
          <button
            type="button"
            onClick={() => setZoomOpen(true)}
            aria-label={`放大查看 ${alt}`}
            className="group absolute inset-0 block h-full w-full cursor-zoom-in"
          >
            <img
              src={current}
              alt={alt}
              loading={priority && index === 0 ? 'eager' : 'lazy'}
              fetchPriority={priority && index === 0 ? 'high' : 'auto'}
              decoding="async"
              onError={() => setFailed(previous => ({ ...previous, [index]: true }))}
              className="h-full w-full object-cover"
            />
            <span className="pointer-events-none absolute bottom-2 right-2 bg-white/90 px-2 py-1 text-[12px] text-neutral-700 opacity-0 transition-opacity group-hover:opacity-100">点击放大</span>
          </button>
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <span className="text-xs text-neutral-500">图片暂不可用</span>
          </div>
        )}

        {usable.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => move(-1)}
              aria-label="上一张"
              className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-lg leading-none text-neutral-800 shadow-sm hover:bg-white"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              aria-label="下一张"
              className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-lg leading-none text-neutral-800 shadow-sm hover:bg-white"
            >
              ›
            </button>
            <span className="absolute bottom-2 left-2 bg-white/90 px-1.5 py-0.5 text-[12px] tabular-nums text-neutral-700">{index + 1} / {usable.length}</span>
          </>
        )}
      </div>

      {usable.length > 1 && (
        <div className={`mt-2 flex gap-2 overflow-x-auto ${thumbClassName}`} role="tablist" aria-label={`${alt} 缩略图`}>
          {usable.map((image, thumbIndex) => (
            <button
              key={`${image}-${thumbIndex}`}
              type="button"
              role="tab"
              aria-selected={thumbIndex === index}
              aria-label={`查看第 ${thumbIndex + 1} 张`}
              onClick={() => setIndex(thumbIndex)}
              className={`relative h-16 w-14 shrink-0 overflow-hidden border ${thumbIndex === index ? 'border-neutral-950' : 'border-neutral-200'}`}
            >
              {failed[thumbIndex] ? (
                <span className="grid h-full w-full place-items-center bg-neutral-100 text-[12px] text-neutral-500">无图</span>
              ) : (
                <img
                  src={image}
                  alt=""
                  loading="lazy"
                  onError={() => setFailed(previous => ({ ...previous, [thumbIndex]: true }))}
                  className="h-full w-full object-cover"
                />
              )}
            </button>
          ))}
        </div>
      )}

      {zoomOpen && current && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={`${alt} 大图`}
          tabIndex={-1}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 outline-none"
          onClick={() => setZoomOpen(false)}
        >
          <img src={current} alt={alt} className="max-h-[92vh] max-w-[94vw] object-contain" onClick={event => event.stopPropagation()} />
          <button type="button" onClick={() => setZoomOpen(false)} aria-label="关闭大图" className="absolute right-4 top-4 grid h-10 w-10 place-items-center bg-white/15 text-white">✕</button>
          {usable.length > 1 && (
            <>
              <button type="button" onClick={event => { event.stopPropagation(); move(-1); }} aria-label="上一张" className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center bg-white/15 text-lg leading-none text-white">‹</button>
              <button type="button" onClick={event => { event.stopPropagation(); move(1); }} aria-label="下一张" className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center bg-white/15 text-lg leading-none text-white">›</button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

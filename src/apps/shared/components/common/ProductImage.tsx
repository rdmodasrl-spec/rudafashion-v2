import React, { useState } from 'react';

type ProductImageProps = {
  src?: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  contain?: boolean;
  flush?: boolean;
};

const FALLBACK_PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" role="presentation"><rect width="400" height="500" fill="#f5f3ef"/><g fill="none" stroke="#d9d5cc" stroke-width="6" stroke-linecap="square"><rect x="132" y="182" width="136" height="136"/><path d="M132 288l34-34 26 26 18-18 28 28"/><circle cx="240" cy="214" r="12"/></g></svg>`;

// 裂图回落用中性占位，不再使用品牌图标：品牌标识出现在内容区域会被误读为真图。
const FALLBACK_IMAGE = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(FALLBACK_PLACEHOLDER_SVG)}`;

export const ProductImage: React.FC<ProductImageProps> = ({
  src,
  alt,
  className = '',
  imageClassName = '',
  priority = false,
  contain = false,
  flush = false
}) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const imageSource = failed || !src ? FALLBACK_IMAGE : src;
  const imageFrameClass = flush ? 'bg-transparent' : 'bg-[#f4f1ed]';

  return (
    <div className={`relative overflow-hidden ${imageFrameClass} ${className}`}>
      {!loaded && (
        <div className={`absolute inset-0 ${flush ? 'bg-white' : 'animate-pulse bg-gradient-to-br from-[#f7f4f0] via-[#ebe7e1] to-[#f7f4f0]'}`} aria-hidden="true" />
      )}
      {!flush && <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/10 via-transparent to-white/10 opacity-60" aria-hidden="true" />}
      <img
        src={imageSource}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => {
          setFailed(true);
          setLoaded(true);
        }}
        className={`relative z-0 h-full w-full transition duration-700 ease-out ${
          contain ? `object-contain ${flush ? '' : 'p-2 sm:p-3'}` : 'object-cover object-center'
        } ${loaded ? 'opacity-100' : 'opacity-0'} ${imageClassName}`}
      />
    </div>
  );
};

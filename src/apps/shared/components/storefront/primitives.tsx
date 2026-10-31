import React from 'react';

/** 固定比例图片：避免布局跳动，裂图回落中性占位，不回落品牌 Logo。 */
export const StorefrontImage: React.FC<{
  src?: string;
  alt: string;
  ratio?: string;
  priority?: boolean;
  className?: string;
  sizes?: string;
  /** cover 用于商品格；contain 用于编辑型大图，避免把白底商品图裁掉边 */
  fit?: 'cover' | 'contain';
}> = ({ src, alt, ratio = '4 / 5', priority = false, className = '', sizes, fit = 'cover' }) => {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => { setFailed(false); }, [src]);
  const unavailable = !src || failed;
  return (
    <div
      className={`relative overflow-hidden bg-neutral-100 ${className}`}
      style={{ aspectRatio: unavailable ? '3 / 2' : ratio }}
    >
      {src && !failed ? (
        <img
          src={src}
          alt={alt}
          sizes={sizes}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          onError={() => setFailed(true)}
          className={`h-full w-full ${fit === 'contain' ? 'object-contain' : 'object-cover'}`}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-neutral-100">
          <span className="text-xs text-neutral-500">图片暂不可用</span>
        </div>
      )}
    </div>
  );
};

export function formatMoney(amount: number): string {
  if (!Number.isFinite(amount)) return '—';
  return `€${amount.toFixed(2)}`;
}

export function formatStock(quantity: number): string {
  if (quantity <= 0) return '已售罄';
  if (quantity <= 5) return `仅剩 ${quantity}`;
  return `${quantity} 件可售`;
}

/**
 * 价格 < 0 或缺失时不显示数字，避免出现 €0.00 假价。
 * compact：窄卡片里用短文案，避免「登录后查看批发价」在 390px 断成两行。
 */
export function priceText(amount: number, authorized: boolean, compact = false): string {
  if (!authorized) return compact ? '登录可见' : '登录后查看批发价';
  if (!Number.isFinite(amount) || amount <= 0) return '价格面议';
  return formatMoney(amount);
}

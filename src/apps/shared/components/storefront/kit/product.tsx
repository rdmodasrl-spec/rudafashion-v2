/**
 * 店铺模板构件：商品卡片与栅格。
 *
 * 五种卡片形态对应不同的商业目标，不是同一张卡换配色：
 * - editorial：大图叙事，价格弱化（品牌官网）
 * - dense：小图高密度，属性优先（目录检索）
 * - trade：价格/库存/MOQ 前置 + 快速加单（B2B 批发）
 * - tile：圆角柔化，价格突出（零售）
 * - spec：横向属性行（出口目录 / 订货单）
 */
import React from 'react';
import { Plus, SlidersHorizontal } from 'lucide-react';
import type { StorefrontProduct } from '../useStorefrontData';
import { StorefrontImage, formatStock, priceText } from '../primitives';

export type CardVariant = 'editorial' | 'dense' | 'trade' | 'tile' | 'spec';

export const ProductCard: React.FC<{
  product: StorefrontProduct;
  authorized: boolean;
  variant?: CardVariant;
  onOpen: (product: StorefrontProduct) => void;
  onQuickAdd?: (product: StorefrontProduct) => void;
  priority?: boolean;
}> = ({ product, authorized, variant = 'editorial', onOpen, onQuickAdd, priority = false }) => {
  const soldOut = product.availableStock <= 0;

  if (variant === 'spec') {
    return (
      <button
        type="button"
        onClick={() => onOpen(product)}
        className="grid w-full grid-cols-[64px_1fr] items-center gap-3 border-b border-neutral-200 py-3 text-left transition-colors hover:bg-neutral-50 sm:grid-cols-[72px_1.4fr_1fr_1fr_auto]"
      >
        <StorefrontImage src={product.images[0]} alt={product.name} ratio="1 / 1" className="w-16 sm:w-[72px]" />
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold text-neutral-900">{product.name}</span>
          <span className="block truncate text-xs text-neutral-500">{product.styleNo}</span>
        </span>
        <span className="hidden truncate text-xs text-neutral-600 sm:block">{product.material || '—'}</span>
        <span className="hidden truncate text-xs text-neutral-600 sm:block">{product.colors.join(' / ') || '—'}</span>
        <span className="hidden text-right text-xs font-semibold tabular-nums text-neutral-900 sm:block">
          {priceText(product.unitPrice, authorized, true)}
        </span>
      </button>
    );
  }

  if (variant === 'dense') {
    return (
      <button type="button" onClick={() => onOpen(product)} className="group text-left">
        <div className="relative">
          <StorefrontImage src={product.images[0]} alt={product.name} ratio="1 / 1" priority={priority} />
          {soldOut ? <span className="absolute left-2 top-2 bg-neutral-900 px-1.5 py-0.5 text-xs font-semibold text-white">售罄</span> : null}
        </div>
        <p className="mt-2 truncate text-xs font-semibold text-neutral-900">{product.name}</p>
        <p className="truncate text-xs text-neutral-500">{product.styleNo} · {product.subCategory || product.category || '—'}</p>
        <p className="mt-0.5 text-xs tabular-nums text-neutral-700">{priceText(product.unitPrice, authorized, true)}</p>
      </button>
    );
  }

  if (variant === 'trade') {
    return (
      <div className="border border-neutral-300 bg-white">
        <button type="button" onClick={() => onOpen(product)} className="block w-full text-left">
          <StorefrontImage src={product.images[0]} alt={product.name} ratio="1 / 1" priority={priority} />
          <div className="px-3 pt-2">
            <p className="truncate text-xs font-semibold text-neutral-900">{product.name}</p>
            <p className="truncate text-xs text-neutral-500">{product.styleNo}</p>
            <div className="mt-1.5 flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold tabular-nums text-neutral-900">{priceText(product.unitPrice, authorized, true)}</span>
              <span className={`text-xs ${soldOut ? 'text-neutral-400' : 'text-neutral-600'}`}>{formatStock(product.availableStock)}</span>
            </div>
            <p className="mt-1 text-xs text-neutral-500">MOQ {product.moq} · 装箱 {product.packSize}</p>
          </div>
        </button>
        <div className="flex divide-x divide-neutral-200 border-t border-neutral-200">
          <button type="button" onClick={() => onOpen(product)} className="flex-1 py-2 text-xs font-semibold text-neutral-800 transition-colors hover:bg-neutral-50">选规格</button>
          {onQuickAdd ? (
            <button
              type="button"
              disabled={soldOut}
              onClick={() => onQuickAdd(product)}
              className="flex flex-1 items-center justify-center gap-1 py-2 text-xs font-semibold text-neutral-900 transition-colors hover:bg-neutral-50 disabled:text-neutral-400"
            >
              <Plus className="h-3.5 w-3.5" />加订
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (variant === 'tile') {
    return (
      <button type="button" onClick={() => onOpen(product)} className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white text-left transition-shadow hover:shadow-sm">
        <StorefrontImage src={product.images[0]} alt={product.name} ratio="4 / 5" priority={priority} />
        <div className="p-3">
          <p className="truncate text-xs font-semibold text-neutral-900">{product.name}</p>
          <p className="mt-0.5 truncate text-xs text-neutral-500">{product.subCategory || product.category || '新品'}</p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold tabular-nums text-neutral-900">{priceText(product.unitPrice, authorized, true)}</span>
            {product.isClearance ? <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-xs font-semibold text-white">特价</span> : null}
          </div>
        </div>
      </button>
    );
  }

  return (
    <button type="button" onClick={() => onOpen(product)} className="group block text-left">
      <StorefrontImage src={product.images[0]} alt={product.name} ratio="4 / 5" priority={priority} fit="cover" />
      <div className="pt-3">
        <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">{product.subCategory || product.category || '系列'}</p>
        <p className="mt-1 truncate text-sm font-medium text-neutral-900">{product.name}</p>
        <p className="mt-1 text-xs text-neutral-500">{product.material || product.composition || product.styleNo}</p>
        <p className="mt-2 text-xs tabular-nums text-neutral-700">{priceText(product.unitPrice, authorized, true)}</p>
      </div>
    </button>
  );
};

const GRID: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5'
};

export const ProductGrid: React.FC<{
  products: StorefrontProduct[];
  authorized: boolean;
  variant?: CardVariant;
  columns?: 2 | 3 | 4 | 5;
  onOpen: (product: StorefrontProduct) => void;
  onQuickAdd?: (product: StorefrontProduct) => void;
  className?: string;
}> = ({ products, authorized, variant = 'editorial', columns = 3, onOpen, onQuickAdd, className = '' }) => (
  <div className={`grid ${GRID[columns]} gap-x-4 gap-y-8 sm:gap-x-6 ${className}`}>
    {products.map((product, index) => (
      <ProductCard
        key={product.id}
        product={product}
        authorized={authorized}
        variant={variant}
        onOpen={onOpen}
        onQuickAdd={onQuickAdd}
        priority={index < 4}
      />
    ))}
  </div>
);

/** 桌面端筛选侧栏：属性来自真实数据（分类/材质/颜色/尺码/是否有货）。 */
export const FilterRail: React.FC<{
  categories: Array<{ value: string; label: string; count: number }>;
  materials: string[];
  colors: string[];
  sizes: string[];
  selected: { category: string; material: string; color: string; size: string; inStock: boolean };
  onChange: (next: Partial<{ category: string; material: string; color: string; size: string; inStock: boolean }>) => void;
  onReset: () => void;
}> = ({ categories, materials, colors, sizes, selected, onChange, onReset }) => {
  const group = (title: string, values: string[], active: string, key: 'material' | 'color' | 'size') => (
    values.length ? (
      <div className="border-b border-neutral-200 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">{title}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onChange({ [key]: '' } as never)}
            className={`border px-2 py-0.5 text-xs ${!active ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 text-neutral-700'}`}
          >
            不限
          </button>
          {values.map(value => (
            <button
              key={value}
              type="button"
              onClick={() => onChange({ [key]: active === value ? '' : value } as never)}
              className={`border px-2 py-0.5 text-xs ${active === value ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 text-neutral-700'}`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
    ) : null
  );

  return (
    <aside className="hidden w-56 shrink-0 lg:block">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-900">筛选</p>
        <button type="button" onClick={onReset} className="text-xs text-neutral-500 underline underline-offset-2">重置</button>
      </div>
      <div className="mt-3 border-b border-neutral-200 pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">分类</p>
        <div className="mt-2 space-y-1">
          <button type="button" onClick={() => onChange({ category: 'all' })} className={`block w-full text-left text-xs ${selected.category === 'all' ? 'font-semibold text-neutral-900' : 'text-neutral-600'}`}>
            全部（{categories.reduce((sum, item) => sum + item.count, 0)}）
          </button>
          {categories.map(item => (
            <button
              key={item.value}
              type="button"
              onClick={() => onChange({ category: item.value })}
              className={`block w-full text-left text-xs ${selected.category === item.value ? 'font-semibold text-neutral-900' : 'text-neutral-600'}`}
            >
              {item.label}（{item.count}）
            </button>
          ))}
        </div>
      </div>
      {group('材质', materials, selected.material, 'material')}
      {group('颜色', colors, selected.color, 'color')}
      {group('尺码', sizes, selected.size, 'size')}
      <label className="flex items-center gap-2 py-4 text-xs text-neutral-700">
        <input type="checkbox" checked={selected.inStock} onChange={event => onChange({ inStock: event.target.checked })} className="h-3.5 w-3.5 accent-neutral-900" />
        仅看有货
      </label>
    </aside>
  );
};

/** 手机端筛选抽屉：与桌面侧栏同源数据，但用全屏抽屉，避免横向挤压。 */
export const FilterDrawer: React.FC<{
  open: boolean;
  onClose: () => void;
  categories: Array<{ value: string; label: string; count: number }>;
  materials: string[];
  colors: string[];
  sizes: string[];
  selected: { category: string; material: string; color: string; size: string; inStock: boolean };
  onChange: (next: Partial<{ category: string; material: string; color: string; size: string; inStock: boolean }>) => void;
  onReset: () => void;
  resultCount: number;
}> = ({ open, onClose, categories, materials, colors, sizes, selected, onChange, onReset, resultCount }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white lg:hidden" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <p className="text-sm font-semibold text-neutral-900">筛选</p>
        <button type="button" onClick={onClose} className="text-xs text-neutral-600" aria-label="关闭筛选">关闭</button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <p className="pt-4 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">分类</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button type="button" onClick={() => onChange({ category: 'all' })} className={`border px-2 py-1 text-xs ${selected.category === 'all' ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300'}`}>全部</button>
          {categories.map(item => (
            <button key={item.value} type="button" onClick={() => onChange({ category: item.value })} className={`border px-2 py-1 text-xs ${selected.category === item.value ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300'}`}>
              {item.label}（{item.count}）
            </button>
          ))}
        </div>
        {[['材质', materials, 'material'] as const, ['颜色', colors, 'color'] as const, ['尺码', sizes, 'size'] as const].map(([title, values, key]) => (
          values.length ? (
            <div key={key}>
              <p className="pt-5 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">{title}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {values.map(value => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onChange({ [key]: selected[key] === value ? '' : value } as never)}
                    className={`border px-2 py-1 text-xs ${selected[key] === value ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300'}`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          ) : null
        ))}
        <label className="mt-6 flex items-center gap-2 text-xs text-neutral-700">
          <input type="checkbox" checked={selected.inStock} onChange={event => onChange({ inStock: event.target.checked })} className="h-3.5 w-3.5 accent-neutral-900" />
          仅看有货
        </label>
      </div>
      <div className="flex gap-2 border-t border-neutral-200 p-4">
        <button type="button" onClick={onReset} className="flex-1 border border-neutral-300 py-2 text-xs font-semibold text-neutral-800">重置</button>
        <button type="button" onClick={onClose} className="flex-1 bg-neutral-900 py-2 text-xs font-semibold text-white">查看 {resultCount} 款</button>
      </div>
    </div>
  );
};

export const FilterTrigger: React.FC<{ onClick: () => void; activeCount: number }> = ({ onClick, activeCount }) => (
  <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 border border-neutral-300 px-2.5 py-1.5 text-xs font-semibold text-neutral-800 lg:hidden">
    <SlidersHorizontal className="h-3.5 w-3.5" />筛选{activeCount > 0 ? `（${activeCount}）` : ''}
  </button>
);

/**
 * 店铺模板构件：商品详情、规格矩阵、询价。
 *
 * 详情提供四种结构，而不是同一页面换样式：
 * - editorial：全屏左右分栏，左图右文，价格收在底部（品牌官网）
 * - spec：属性表 + 尺码表，适合目录检索与出口规格
 * - order：颜色 × 尺码数量矩阵 + MOQ + 阶梯价 + 加订（B2B）
 * - sheet：横向订货单行项目（订货会 / 批量补货）
 *
 * 所有写入都走真实 API：订货车用 addMultipleToCart，询价用 createBuyerRfq；
 * 未授权时价格显示「登录可见」，绝不显示假价格。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Check, Minus, Plus, X } from 'lucide-react';
import type { StorefrontData, StorefrontProduct } from '../useStorefrontData';
import { StorefrontImage, formatMoney, formatStock, priceText } from '../primitives';
import { Tag } from './shell';

export type Matrix = Record<string, number>;
export const cellKey = (color: string, size: string) => `${color}__${size}`;

export function useOrderMatrix(product: StorefrontProduct | null) {
  const [matrix, setMatrix] = useState<Matrix>({});
  useEffect(() => { setMatrix({}); }, [product?.id]);
  const grid = useMemo(() => {
    if (!product) return { colors: [] as string[], sizes: [] as string[], stock: {} as Record<string, number>, skuByCell: {} as Record<string, string> };
    const colors = product.colors.length ? product.colors : [''];
    const sizes = product.sizes.length ? product.sizes : [''];
    const stock: Record<string, number> = {};
    const skuByCell: Record<string, string> = {};
    product.skus.forEach(sku => {
      const key = cellKey(sku.color || '', sku.size || '');
      stock[key] = Number(sku.stockCentral || 0);
      skuByCell[key] = sku.sku;
    });
    return { colors, sizes, stock, skuByCell };
  }, [product]);
  const total = useMemo(() => Object.values(matrix).reduce((sum, value) => sum + value, 0), [matrix]);
  const set = (key: string, value: number, max: number) => {
    const next = Math.max(0, Math.min(value, Math.max(0, max)));
    setMatrix(prev => ({ ...prev, [key]: next }));
  };
  return { matrix, set, setMatrix, total, ...grid };
}

export const QtyMatrix: React.FC<{
  colors: string[];
  sizes: string[];
  stock: Record<string, number>;
  matrix: Matrix;
  onSet: (key: string, value: number, max: number) => void;
  dark?: boolean;
}> = ({ colors, sizes, stock, matrix, onSet, dark = false }) => (
  <div className={dark ? 'overflow-x-auto' : 'overflow-x-auto border border-neutral-200'}>
    <table className={`w-full border-collapse text-xs ${dark ? 'text-neutral-200' : 'text-neutral-800'}`}>
      <thead>
        <tr className={dark ? 'text-neutral-500' : 'text-neutral-500'}>
          <th className={`sticky left-0 px-2 py-2 text-left font-semibold ${dark ? 'bg-neutral-950' : 'bg-white'}`}>颜色 \ 尺码</th>
          {sizes.map(size => <th key={size} className="px-2 py-2 text-center font-semibold">{size || '均码'}</th>)}
        </tr>
      </thead>
      <tbody>
        {colors.map(color => (
          <tr key={color} className={dark ? 'border-t border-neutral-800' : 'border-t border-neutral-200'}>
            <th className={`sticky left-0 px-2 py-2 text-left font-medium ${dark ? 'bg-neutral-950' : 'bg-white'}`}>{color || '默认'}</th>
            {sizes.map(size => {
              const key = cellKey(color, size);
              const available = stock[key] ?? 0;
              const value = matrix[key] ?? 0;
              return (
                <td key={key} className="px-1 py-1.5 text-center">
                  <div className={`mx-auto flex w-[86px] items-center justify-between border ${dark ? 'border-neutral-700' : 'border-neutral-300'}`}>
                    <button type="button" onClick={() => onSet(key, value - 1, available)} className="px-1.5 py-1 text-neutral-500" aria-label="减少">−</button>
                    <input
                      value={value || ''}
                      onChange={event => onSet(key, Number(event.target.value.replace(/\D/g, '')) || 0, available)}
                      inputMode="numeric"
                      aria-label={`${color} ${size} 数量`}
                      className={`w-8 bg-transparent text-center tabular-nums outline-none ${dark ? 'text-white' : 'text-neutral-900'}`}
                    />
                    <button type="button" onClick={() => onSet(key, value + 1, available)} className="px-1.5 py-1 text-neutral-500" aria-label="增加">+</button>
                  </div>
                  <span className={`mt-0.5 block text-xs ${available <= 0 ? 'text-neutral-400' : 'text-neutral-500'}`}>{available <= 0 ? '无货' : available}</span>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

type DetailProps = {
  data: StorefrontData;
  product: StorefrontProduct;
  mode: 'editorial' | 'spec' | 'order';
  onClose: () => void;
  onSubmitted?: (message: string) => void;
};

const SpecTable: React.FC<{ product: StorefrontProduct; authorized: boolean }> = ({ product, authorized }) => (
  <dl className="divide-y divide-neutral-200 border-y border-neutral-200 text-xs">
    {[
      ['款号', product.styleNo],
      ['品类', [product.category, product.subCategory].filter(Boolean).join(' / ') || '—'],
      ['材质', product.material || '—'],
      ['成分', product.composition || '—'],
      ['产地', product.origin || '—'],
      ['颜色', product.colors.join(' / ') || '—'],
      ['尺码', product.sizes.join(' / ') || '—'],
      ['最小起订', `${product.moq} 件`],
      ['装箱规格', `${product.packSize} 件/箱`],
      ['库存', formatStock(product.availableStock)],
      ['批发价', priceText(product.unitPrice, authorized)],
      ['阶梯价（100+）', product.tierPrice ? priceText(product.tierPrice, authorized) : '未设置']
    ].map(([label, value]) => (
      <div key={label} className="flex justify-between gap-4 py-2">
        <dt className="text-neutral-500">{label}</dt>
        <dd className="text-right font-medium text-neutral-900">{value}</dd>
      </div>
    ))}
  </dl>
);

export const ProductDetail: React.FC<DetailProps> = ({ data, product, mode, onClose, onSubmitted }) => {
  const { matrix, set, setMatrix, total, colors, sizes, stock, skuByCell } = useOrderMatrix(product);
  const [activeImage, setActiveImage] = useState(0);
  const [rfqOpen, setRfqOpen] = useState(false);
  const [rfqNote, setRfqNote] = useState('');
  const [rfqBusy, setRfqBusy] = useState(false);
  const [message, setMessage] = useState('');
  const authorized = data.isWholesaleAuthorized;
  const images = product.images.length ? product.images : [''];

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const submitCart = () => {
    if (total <= 0) return;
    const items = Object.entries(matrix).flatMap(([key, quantity]) => {
      if (quantity <= 0) return [];
      const [color, size] = key.split('__');
      const sku = skuByCell[key];
      if (!sku) return [];
      return [{
        productId: product.id,
        styleNo: product.styleNo,
        productName: product.name,
        image: product.images[0] || '',
        sku,
        color,
        size,
        quantity,
        unitPrice: product.unitPrice,
        packSize: product.packSize
      }];
    });
    if (!items.length) return;
    data.addMultipleToCart(items);
    setMatrix({});
    const text = `已加入订货车：${total} 件`;
    setMessage(text);
    onSubmitted?.(text);
  };

  const submitRfq = async () => {
    setRfqBusy(true);
    const quantity = total > 0 ? total : product.moq;
    const result = await data.createBuyerRfq({
      title: `${product.styleNo} 询价 · ${product.name}`,
      description: rfqNote || `询价 ${quantity} 件`,
      category: product.category,
      targetQuantity: quantity,
      targetPrice: product.unitPrice,
      targetCurrency: 'EUR',
      deadlineAt: new Date(Date.now() + 14 * 86400000).toISOString(),
      preferredCountries: [],
      productIds: [product.id],
      merchantId: data.merchant?.id,
      remarks: rfqNote
    });
    setRfqBusy(false);
    if (result.ok) {
      setRfqOpen(false);
      const text = `询价已提交，单号 ${result.rfqNo}。商家可在后台「询价」中查看。`;
      setMessage(text);
      onSubmitted?.(text);
    } else {
      setMessage(data.authRole === 'buyer' ? (result.error || '提交失败，请稍后重试。') : '请先登录采购账号后再询价。');
    }
  };

  const gallery = (
    <div className="space-y-2">
      <StorefrontImage src={images[activeImage]} alt={product.name} ratio={mode === 'editorial' ? '3 / 4' : '1 / 1'} priority />
      {images.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto">
          {images.map((src, index) => (
            <button
              key={`${src}-${index}`}
              type="button"
              onClick={() => setActiveImage(index)}
              aria-label={`查看第 ${index + 1} 张图`}
              className={`w-16 shrink-0 border ${index === activeImage ? 'border-neutral-900' : 'border-transparent'}`}
            >
              <StorefrontImage src={src} alt={`${product.name} 图 ${index + 1}`} ratio="1 / 1" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );

  const priceBlock = (
    <div className="flex flex-wrap items-baseline gap-3">
      <span className="text-xl font-semibold tabular-nums text-neutral-900">{priceText(product.unitPrice, authorized)}</span>
      {product.tierPrice ? <span className="text-xs text-neutral-600">100 件以上 {formatMoney(product.tierPrice)}</span> : null}
      <Tag tone={product.availableStock > 0 ? 'outline' : 'muted'}>{formatStock(product.availableStock)}</Tag>
      <Tag tone="muted">MOQ {product.moq}</Tag>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white" role="dialog" aria-modal="true" aria-label={product.name}>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
        <button type="button" onClick={onClose} className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700">
          <X className="h-4 w-4" />关闭
        </button>
        <p className="truncate px-3 text-xs text-neutral-500">{product.styleNo}</p>
        <span className="text-xs text-neutral-500">{data.cartCount} 件在订货车</span>
      </div>

      {mode === 'editorial' ? (
        <div className="mx-auto grid max-w-[1200px] gap-8 px-5 py-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14 lg:py-14">
          {gallery}
          <div className="lg:sticky lg:top-20 lg:self-start">
            <p className="text-xs uppercase tracking-[0.24em] text-neutral-500">{product.subCategory || product.category || '系列'}</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">{product.name}</h1>
            {product.description ? <p className="mt-4 text-xs leading-6 text-neutral-600">{product.description}</p> : null}
            <div className="mt-6 space-y-1 text-xs text-neutral-600">
              <p>{product.material || '—'} {product.origin ? `· ${product.origin}` : ''}</p>
              <p>{product.colors.join(' / ') || '—'} · {product.sizes.join(' / ') || '—'}</p>
            </div>
            <div className="mt-6">{priceBlock}</div>
            <div className="mt-6 flex flex-wrap gap-2">
              <button type="button" onClick={() => setRfqOpen(true)} className="flex-1 bg-neutral-900 px-4 py-3 text-xs font-semibold text-white transition-colors hover:bg-black">
                预约咨询 / 询价
              </button>
              <button type="button" onClick={onClose} className="border border-neutral-300 px-4 py-3 text-xs font-semibold text-neutral-800">
                返回系列
              </button>
            </div>
            {message ? <p className="mt-3 flex items-center gap-1.5 text-xs text-neutral-800"><Check className="h-3.5 w-3.5" />{message}</p> : null}
            <div className="mt-8"><SpecTable product={product} authorized={authorized} /></div>
          </div>
        </div>
      ) : mode === 'spec' ? (
        <div className="mx-auto max-w-[1200px] px-5 py-8">
          <div className="grid gap-8 lg:grid-cols-[420px_1fr]">
            {gallery}
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-neutral-900">{product.name}</h1>
              <p className="mt-1 text-xs text-neutral-500">{product.styleNo} · {product.category} {product.subCategory ? `/ ${product.subCategory}` : ''}</p>
              <div className="mt-5"><SpecTable product={product} authorized={authorized} /></div>
              <div className="mt-6">{priceBlock}</div>
              <div className="mt-6 flex flex-wrap gap-2">
                <button type="button" onClick={() => setRfqOpen(true)} className="bg-neutral-900 px-4 py-2.5 text-xs font-semibold text-white">索取报价单</button>
                <button type="button" onClick={onClose} className="border border-neutral-300 px-4 py-2.5 text-xs font-semibold text-neutral-800">返回目录</button>
              </div>
              {message ? <p className="mt-3 text-xs text-neutral-800">{message}</p> : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-[1200px] px-4 py-6 pb-28 lg:pb-10">
          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            {gallery}
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-neutral-900">{product.name}</h1>
              <p className="mt-1 text-xs text-neutral-500">{product.styleNo} · 装箱 {product.packSize} 件</p>
              <div className="mt-4">{priceBlock}</div>
              <p className="mt-4 text-xs font-semibold text-neutral-800">颜色 × 尺码数量</p>
              <div className="mt-2"><QtyMatrix colors={colors} sizes={sizes} stock={stock} matrix={matrix} onSet={set} /></div>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-neutral-600">
                <span>已选 <b className="tabular-nums text-neutral-900">{total}</b> 件</span>
                <span>·</span>
                <span>不足 MOQ {product.moq} 件时商家可能与您确认</span>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" disabled={total <= 0} onClick={submitCart} className="bg-neutral-900 px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-40">
                  加入订货车
                </button>
                <button type="button" onClick={() => setRfqOpen(true)} className="border border-neutral-300 px-5 py-2.5 text-xs font-semibold text-neutral-800">
                  询价 / 索样
                </button>
              </div>
              {message ? <p className="mt-3 flex items-center gap-1.5 text-xs text-neutral-800"><Check className="h-3.5 w-3.5" />{message}</p> : null}
              <div className="mt-6"><SpecTable product={product} authorized={authorized} /></div>
            </div>
          </div>
          <div className="fixed inset-x-0 bottom-0 z-10 flex items-center gap-3 border-t border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
            <span className="text-xs text-neutral-600">已选 <b className="tabular-nums text-neutral-900">{total}</b> 件</span>
            <button type="button" disabled={total <= 0} onClick={submitCart} className="ml-auto flex-1 bg-neutral-900 py-2.5 text-xs font-semibold text-white disabled:opacity-40">
              加入订货车
            </button>
          </div>
        </div>
      )}

      {rfqOpen ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-neutral-900/50 p-4">
          <div className="w-full max-w-md border border-neutral-200 bg-white p-5">
            <h2 className="text-base font-semibold text-neutral-900">询价 · {product.styleNo}</h2>
            <p className="mt-1 text-xs leading-5 text-neutral-500">提交后写入商家询价记录，商家在后台可见并回复报价。</p>
            <label htmlFor="rfq-note" className="mt-4 block text-xs font-semibold text-neutral-800">备注（可选）</label>
            <textarea
              id="rfq-note"
              rows={3}
              value={rfqNote}
              onChange={event => setRfqNote(event.target.value)}
              placeholder="需要的颜色、尺码比例、目标交期"
              className="mt-1 w-full border border-neutral-300 px-3 py-2 text-xs outline-none focus:border-neutral-900"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setRfqOpen(false)} className="border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700">取消</button>
              <button type="button" disabled={rfqBusy} onClick={() => void submitRfq()} className="bg-neutral-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                {rfqBusy ? '提交中…' : '提交询价'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

/** 订货车抽屉：只展示已通过 addMultipleToCart 写入的真实副本。 */
export const CartDrawer: React.FC<{ data: StorefrontData; open: boolean; onClose: () => void }> = ({ data, open, onClose }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-neutral-900/40" role="dialog" aria-modal="true">
      <div className="flex h-full w-full max-w-md flex-col bg-white">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <p className="text-sm font-semibold text-neutral-900">订货车（{data.cartCount}）</p>
          <button type="button" onClick={onClose} className="text-xs text-neutral-600">关闭</button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 text-xs leading-6 text-neutral-600">
          {data.cartCount === 0
            ? '订货车为空。在商品详情里选择颜色与数量后加入。'
            : '订货车已包含所选规格。前往商家结算页可确认数量、交期与运费。'}
        </div>
        <div className="border-t border-neutral-200 p-4">
          <button
            type="button"
            onClick={() => { onClose(); data.setCurrentView?.('cart'); }}
            className="w-full bg-neutral-900 py-2.5 text-xs font-semibold text-white"
          >
            前往结算
          </button>
        </div>
      </div>
    </div>
  );
};

/** 快速加单：按 MOQ 直接加一箱，用于高密度目录与批量补货场景。 */
export function quickAddToCart(data: StorefrontData, product: StorefrontProduct): string {
  const sku = product.skus.find(item => Number(item.stockCentral || 0) > 0) || product.skus[0];
  if (!sku) return '该商品暂无可订规格';
  const quantity = Math.max(product.moq, product.packSize);
  data.addMultipleToCart([{
    productId: product.id,
    styleNo: product.styleNo,
    productName: product.name,
    image: product.images[0] || '',
    sku: sku.sku,
    color: sku.color || '',
    size: sku.size || '',
    quantity,
    unitPrice: product.unitPrice,
    packSize: product.packSize
  }]);
  return `已加入 ${quantity} 件（${sku.color || ''} ${sku.size || ''}）`;
}

export const Stepper: React.FC<{ value: number; onChange: (value: number) => void; min?: number; max?: number }> = ({ value, onChange, min = 0, max = 9999 }) => (
  <div className="inline-flex items-center border border-neutral-300">
    <button type="button" onClick={() => onChange(Math.max(min, value - 1))} className="px-2 py-1 text-neutral-600" aria-label="减少"><Minus className="h-3 w-3" /></button>
    <input
      value={value}
      inputMode="numeric"
      onChange={event => onChange(Math.min(max, Math.max(min, Number(event.target.value.replace(/\D/g, '')) || 0)))}
      className="w-10 bg-transparent text-center text-xs tabular-nums outline-none"
    />
    <button type="button" onClick={() => onChange(Math.min(max, value + 1))} className="px-2 py-1 text-neutral-600" aria-label="增加"><Plus className="h-3 w-3" /></button>
  </div>
);

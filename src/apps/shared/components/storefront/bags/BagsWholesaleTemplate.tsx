/**
 * 箱包模板 C：Wholesale Commerce
 *
 * B2B 商城结构：工具条 + 分类导航 + 促销带 + 商品格 + 数量矩阵订货。
 * 与编辑版/目录版的差异：价格、库存、MOQ 前置；订货以「颜色 × 尺寸矩阵」完成，
 * 手机端使用底部固定操作条 + 抽屉。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Minus, Plus, Search, ShoppingCart, X } from 'lucide-react';
import type { StorefrontData, StorefrontProduct } from '../useStorefrontData';
import { StorefrontImage, formatMoney, formatStock, priceText } from '../primitives';
import { StorefrontGallery } from '../gallery/StorefrontGallery';
import { Ruda3DProductViewer, Ruda3DHero } from '../../premium3d/ruda3d';
import { readPremium3DFlag } from '../../premium3d/usePremium3DFlag';

type Props = { data: StorefrontData; onExit?: () => void; initialProductId?: string | null; onProductChange?: (productId: string | null) => void };
type Matrix = Record<string, number>;

const cellKey = (color: string, size: string) => `${color}__${size}`;

export const BagsWholesaleTemplate: React.FC<Props> = ({ data, onExit, initialProductId = null, onProductChange }) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [activeProduct, setActiveProduct] = useState<StorefrontProduct | null>(null);
  const [matrix, setMatrix] = useState<Matrix>({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const [rfqOpen, setRfqOpen] = useState(false);
  const [rfqBusy, setRfqBusy] = useState(false);
  const [rfqResult, setRfqResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [rfqNote, setRfqNote] = useState('');

  const merchant = data.merchant;

  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return data.products.filter(product => {
      if (category !== 'all' && product.category !== category) return false;
      if (!normalized) return true;
      return [product.name, product.styleNo, product.material].some(value => (value || '').toLowerCase().includes(normalized));
    });
  }, [data.products, query, category]);

  const clearance = useMemo(() => data.products.filter(product => product.isClearance).slice(0, 3), [data.products]);
  const stats = useMemo(() => ({
    styles: data.products.length,
    inStock: data.products.filter(product => product.availableStock > 0).length,
    categories: data.categories.length,
    packSizes: new Set(data.products.map(product => product.packSize)).size,
    units: data.products.reduce((sum, product) => sum + product.availableStock, 0)
  }), [data.products, data.categories]);

  const matrixRows = useMemo(() => {
    if (!activeProduct) return { colors: [] as string[], sizes: [] as string[], stockByCell: {} as Record<string, number> };
    const colors = activeProduct.colors.length ? activeProduct.colors : [''];
    const sizes = activeProduct.sizes.length ? activeProduct.sizes : [''];
    const stockByCell: Record<string, number> = {};
    activeProduct.skus.forEach(sku => {
      stockByCell[cellKey(sku.color || '', sku.size || '')] = Number(sku.stockCentral || 0);
    });
    return { colors, sizes, stockByCell };
  }, [activeProduct]);

  const matrixTotal = useMemo(() => Object.values(matrix).reduce((sum, value) => sum + value, 0), [matrix]);
  const matrixUnits = matrixTotal;
  const matrixAmount = activeProduct ? matrixTotal * activeProduct.unitPrice : 0;

  useEffect(() => {
    if (!initialProductId) { setActiveProduct(null); setMatrix({}); return; }
    const target = data.products.find(product => product.id === initialProductId);
    if (target) { setActiveProduct(target); setMatrix({}); }
  }, [initialProductId, data.products]);

  const openProduct = (product: StorefrontProduct) => {
    setActiveProduct(product);
    setMatrix({});
    setSheetOpen(false);
    onProductChange?.(product.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const setCellQuantity = (key: string, next: number, stock: number) => {
    const capped = Math.max(0, Math.min(next, stock > 0 ? stock : 0));
    setMatrix(prev => {
      const copy = { ...prev };
      if (capped === 0) delete copy[key];
      else copy[key] = capped;
      return copy;
    });
  };

  const submitMatrix = () => {
    if (!activeProduct || matrixTotal <= 0) return;
    const items = Object.entries(matrix).flatMap(([key, quantity]) => {
      const [color, size] = key.split('__');
      const sku = activeProduct.skus.find(item => (item.color || '') === color && (item.size || '') === size);
      if (!sku) return [];
      return [{
        productId: activeProduct.id,
        styleNo: activeProduct.styleNo,
        productName: activeProduct.name,
        image: activeProduct.images[0] || '',
        sku: sku.sku,
        color,
        size,
        quantity,
        unitPrice: activeProduct.unitPrice,
        packSize: activeProduct.packSize
      }];
    });
    if (items.length) data.addMultipleToCart(items);
    setMatrix({});
    setSheetOpen(false);
  };

  if (!merchant) {
    return <div className="grid min-h-[60vh] place-items-center text-sm text-neutral-500">该商家暂未开通网站。</div>;
  }

  const accent = '#7a5c3e';
  // 电商版的 3D 只服务于「看清商品」，不进入搜索、矩阵、加购、询价路径
  const visual3d = readPremium3DFlag(true);

  return (
    <div data-storefront-template="bags_wholesale" className="min-h-screen bg-neutral-50 pb-24 text-neutral-950 lg:pb-0">
      <div className="bg-neutral-950 text-neutral-300">
        <div className="mx-auto flex h-9 max-w-[1440px] items-center justify-between px-4 text-[12px] sm:px-8">
          <span>{merchant.name} · B2B 批发采购</span>
          <span className="hidden sm:inline">{data.isWholesaleAuthorized ? '批发价已生效' : '登录采购账号查看批发价'}</span>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-8">
          <div className="flex h-14 items-center gap-3 sm:h-16">
            <button type="button" onClick={() => setActiveProduct(null)} className="shrink-0 text-sm font-bold uppercase tracking-[0.2em]">{merchant.name}</button>
            <div className="relative min-w-0 flex-1">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" strokeWidth={1.7} />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="搜索款号"
                aria-label="搜索批发商品"
                className="h-10 w-full rounded-sm border border-neutral-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-neutral-950"
              />
            </div>
            <button
              type="button"
              onClick={() => data.setCurrentView('cart')}
              className="relative grid h-10 w-10 shrink-0 place-items-center rounded-sm border border-neutral-300"
              aria-label={`采购车，${data.cartCount} 项`}
            >
              <ShoppingCart className="h-4 w-4" strokeWidth={1.7} />
              {data.cartCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-neutral-950 px-1 text-[12px] font-semibold text-white tabular-nums">{data.cartCount}</span>
              )}
            </button>
          </div>
          <nav aria-label="分类" className="flex items-center gap-1 overflow-x-auto py-2">
            <button type="button" onClick={() => setCategory('all')} className={`shrink-0 border-b-2 px-3 py-1.5 text-xs ${category === 'all' ? 'border-neutral-950 font-semibold text-neutral-950' : 'border-transparent text-neutral-600'}`}>全部</button>
            {data.categories.map(item => (
              <button key={item.value} type="button" onClick={() => setCategory(item.value)} className={`shrink-0 border-b-2 px-3 py-1.5 text-xs ${category === item.value ? 'border-neutral-950 font-semibold text-neutral-950' : 'border-transparent text-neutral-600'}`}>
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-8 sm:py-8">
        {activeProduct ? (
          <section>
            <button type="button" onClick={() => { setActiveProduct(null); onProductChange?.(null); }} className="inline-flex items-center gap-2 text-xs text-neutral-600 hover:text-neutral-950">
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.7} /> 返回商品
            </button>
            <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,0.46fr)_minmax(0,0.54fr)]">
              <div>
                {visual3d ? (
                  <>
                    <Ruda3DProductViewer
                      productName={activeProduct.name}
                      productCode={activeProduct.styleNo}
                      images={activeProduct.images}
                      model={activeProduct.model}
                      angleFrames={activeProduct.angleFrames}
                      ratio="4 / 5"
                    />
                    <div className="mt-3">
                      <StorefrontGallery images={activeProduct.images} alt={activeProduct.name} ratio="1 / 1" />
                    </div>
                  </>
                ) : (
                  <StorefrontGallery images={activeProduct.images} alt={activeProduct.name} ratio="4 / 5" priority />
                )}
              </div>
              <div>
                <p className="text-xs text-neutral-500">{activeProduct.styleNo} · {activeProduct.material || activeProduct.category}</p>
                <h1 className="mt-1 text-2xl font-semibold leading-tight">{activeProduct.name}</h1>
                <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <span className={`font-semibold tabular-nums ${data.isWholesaleAuthorized ? 'text-2xl' : 'text-base text-neutral-600'}`}>{priceText(activeProduct.unitPrice, data.isWholesaleAuthorized)}</span>
                  {activeProduct.tierPrice !== null && data.isWholesaleAuthorized && (
                    <span className="text-sm text-neutral-600">100 件以上 {formatMoney(activeProduct.tierPrice)} / 件</span>
                  )}
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 border-y border-neutral-200 py-4 text-sm sm:grid-cols-4">
                  <div><dt className="text-xs text-neutral-500">起订</dt><dd className="mt-0.5 tabular-nums">{activeProduct.moq} 件</dd></div>
                  <div><dt className="text-xs text-neutral-500">整包</dt><dd className="mt-0.5 tabular-nums">{activeProduct.packSize} 件</dd></div>
                  <div><dt className="text-xs text-neutral-500">可售</dt><dd className="mt-0.5 tabular-nums">{activeProduct.availableStock}</dd></div>
                  <div><dt className="text-xs text-neutral-500">产地</dt><dd className="mt-0.5">{activeProduct.origin || '—'}</dd></div>
                </dl>

                <div className="mt-5">
                  <div className="mb-2 flex items-baseline justify-between">
                    <p className="text-sm font-semibold">填写订货数量</p>
                    <p className="text-xs text-neutral-500">低于起订量 {activeProduct.moq} 件无法提交</p>
                  </div>
                  <div className="overflow-x-auto border border-neutral-200 bg-white">
                    <table className="w-full min-w-[420px] text-sm">
                      <thead>
                        <tr className="bg-neutral-50 text-xs text-neutral-600">
                          <th scope="col" className="px-3 py-2 text-left font-medium">颜色 / 尺寸</th>
                          {matrixRows.sizes.map(size => <th key={size} scope="col" className="px-2 py-2 text-center font-medium">{size || '均码'}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {matrixRows.colors.map(color => (
                          <tr key={color}>
                            <th scope="row" className="px-3 py-2 text-left font-normal">{color || '默认'}</th>
                            {matrixRows.sizes.map(size => {
                              const key = cellKey(color, size);
                              const stock = matrixRows.stockByCell[key] || 0;
                              const value = matrix[key] || 0;
                              return (
                                <td key={key} className="px-1.5 py-1.5 text-center">
                                  <div className="mx-auto flex w-[74px] items-center border border-neutral-300">
                                    <button type="button" disabled={stock <= 0} onClick={() => setCellQuantity(key, value - 1, stock)} aria-label={`${color} ${size} 减少`} className="grid h-8 w-6 place-items-center text-neutral-600 disabled:opacity-30">
                                      <Minus className="h-3 w-3" strokeWidth={1.7} />
                                    </button>
                                    <input
                                      value={value || ''}
                                      onChange={event => setCellQuantity(key, Number(event.target.value.replace(/\D/g, '')) || 0, stock)}
                                      inputMode="numeric"
                                      aria-label={`${color} ${size} 数量`}
                                      placeholder={stock > 0 ? '0' : '—'}
                                      disabled={stock <= 0}
                                      className="h-8 w-full min-w-0 border-x border-neutral-200 text-center text-xs tabular-nums outline-none disabled:bg-neutral-50"
                                    />
                                    <button type="button" disabled={stock <= 0 || value >= stock} onClick={() => setCellQuantity(key, value + 1, stock)} aria-label={`${color} ${size} 增加`} className="grid h-8 w-6 place-items-center text-neutral-600 disabled:opacity-30">
                                      <Plus className="h-3 w-3" strokeWidth={1.7} />
                                    </button>
                                  </div>
                                  <span className="mt-1 block text-[12px] tabular-nums text-neutral-500">{stock > 0 ? `可售 ${stock}` : '售罄'}</span>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => { setRfqResult(null); setRfqOpen(true); }}
                  className="mt-3 inline-flex items-center gap-1.5 border border-neutral-300 px-4 py-2.5 text-xs font-medium hover:border-neutral-950"
                >
                  询价 / 报价申请
                </button>

                <div className="mt-5 hidden items-center justify-between gap-4 border-t border-neutral-200 pt-4 lg:flex">
                  <div className="text-sm">
                    合计 <span className="font-semibold tabular-nums">{matrixUnits}</span> 件
                    <span className="ml-3 text-neutral-600 tabular-nums">{data.isWholesaleAuthorized ? formatMoney(matrixAmount) : '—'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={submitMatrix}
                    disabled={matrixUnits < activeProduct.moq}
                    className="min-w-48 px-6 py-3 text-sm font-medium text-white transition-opacity disabled:opacity-40"
                    style={{ backgroundColor: accent }}
                  >
                    加入采购车
                  </button>
                </div>
                {matrixUnits > 0 && matrixUnits < activeProduct.moq && (
                  <p className="mt-3 text-xs" style={{ color: '#a1372b' }}>已选 {matrixUnits} 件，还需 {activeProduct.moq - matrixUnits} 件达到起订量。</p>
                )}
              </div>
            </div>
          </section>
        ) : (
          <>
            {visual3d && rows.length > 0 && (
              <section className="mb-6" aria-label="品牌三维展示">
                <div className="mb-2 flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-neutral-600">品牌 3D 陈列</h2>
                  <span className="text-xs text-neutral-500">滚动查看镜头推进 · 不进入采购路径</span>
                </div>
                <Ruda3DHero
                  productName={rows[0].name}
                  image={rows[0].images[0]}
                  modelUrl={rows[0].model?.url}
                  scrollLength={1.35}
                >
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-gradient-to-t from-black/30 to-transparent px-5 pb-5 pt-12 text-white">
                    <div>
                      <p className="text-[12px] uppercase tracking-[0.28em] opacity-80">{merchant.name}</p>
                      <p className="mt-1 font-serif text-xl">{rows[0].name}</p>
                    </div>
                    <button type="button" onClick={() => openProduct(rows[0])} className="pointer-events-auto border border-white/70 px-3 py-1.5 text-xs">
                      查看商品
                    </button>
                  </div>
                </Ruda3DHero>
              </section>
            )}

            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="经营数据">
              {[
                { label: '在售款式', value: stats.styles },
                { label: '有货款式', value: stats.inStock },
                // 品类为 0 说明商品未填分类，显示 0 属于无意义指标，改为真实的整包规格数
                stats.categories > 0
                  ? { label: '品类', value: stats.categories }
                  : { label: '整包规格', value: stats.packSizes },
                { label: '可售件数', value: stats.units }
              ].map(item => (
                <div key={item.label} className="border border-neutral-200 bg-white px-4 py-3">
                  <p className="text-xs text-neutral-500">{item.label}</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">{item.value}</p>
                </div>
              ))}
            </section>

            {clearance.length > 0 && (
              <section className="mt-6 border-l-2 bg-white px-4 py-3" style={{ borderColor: accent }}>
                <p className="text-sm font-semibold">清仓现货</p>
                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-neutral-600">
                  {clearance.map(product => (
                    <button key={product.id} type="button" onClick={() => openProduct(product)} className="underline-offset-4 hover:underline">
                      {product.name} · {product.styleNo}
                    </button>
                  ))}
                </div>
              </section>
            )}

            <div className="mt-6 flex items-baseline justify-between">
              <p className="text-sm text-neutral-600"><span className="font-semibold text-neutral-950 tabular-nums">{rows.length}</span> 款批发商品</p>
              <p className="text-xs text-neutral-500">{data.isWholesaleAuthorized ? '批发价已生效' : '登录采购账号后显示批发价'}</p>
            </div>

            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {rows.map(product => (
                <li key={product.id} className="flex flex-col border border-neutral-200 bg-white">
                  <button type="button" onClick={() => openProduct(product)} className="text-left">
                    <StorefrontImage src={product.images[0]} alt={product.name} ratio="1 / 1" />
                    <div className="px-3 pt-2.5">
                      <p className="line-clamp-2 text-sm font-medium leading-snug">{product.name}</p>
                      <p className="mt-0.5 truncate text-xs text-neutral-500">{product.styleNo} · {product.material || product.category}</p>
                    </div>
                  </button>
                  <div className="mt-auto px-3 pb-3 pt-2">
                    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between">
                      <span className="whitespace-nowrap text-sm font-semibold tabular-nums">{priceText(product.unitPrice, data.isWholesaleAuthorized, true)}</span>
                      <span className="whitespace-nowrap text-[12px] tabular-nums text-neutral-500">{product.availableStock > 0 ? `可售 ${product.availableStock}` : '售罄'}</span>
                    </div>
                    <div className="mt-0.5 text-[12px] text-neutral-500">起订 {product.moq} 件 · 整包 {product.packSize}</div>
                    <button
                      type="button"
                      onClick={() => openProduct(product)}
                      disabled={product.availableStock <= 0}
                      className="mt-2 w-full border border-neutral-300 py-1.5 text-xs font-medium hover:border-neutral-950 disabled:opacity-40"
                    >
                      选择规格订货
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            {!rows.length && (
              <div className="mt-14 border border-dashed border-neutral-300 bg-white px-6 py-14 text-center">
                <p className="text-sm font-medium">没有匹配的批发商品</p>
                <p className="mt-1 text-xs text-neutral-500">换个关键词或选择其他品类。</p>
              </div>
            )}

            {data.hiddenWholesaleCount > 0 && (
              <p className="mt-6 border border-neutral-200 bg-white px-4 py-3 text-xs text-neutral-600">
                另有 {data.hiddenWholesaleCount} 款批发商品需登录采购账号后查看。
              </p>
            )}
          </>
        )}
      </main>

      {activeProduct && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1 text-xs">
              <p className="tabular-nums">合计 {matrixUnits} 件</p>
              <p className="text-neutral-500 tabular-nums">{data.isWholesaleAuthorized ? formatMoney(matrixAmount) : '登录后显示价格'}</p>
            </div>
            <button type="button" onClick={() => setSheetOpen(true)} className="border border-neutral-300 px-3 py-2.5 text-xs">数量</button>
            <button
              type="button"
              onClick={submitMatrix}
              disabled={matrixUnits < activeProduct.moq}
              className="px-5 py-2.5 text-xs font-medium text-white disabled:opacity-40"
              style={{ backgroundColor: accent }}
            >
              加入采购车
            </button>
          </div>
        </div>
      )}

      {sheetOpen && activeProduct && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="订货数量">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSheetOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[80svh] overflow-y-auto bg-white">
            <div className="sticky top-0 flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
              <p className="text-sm font-semibold">填写订货数量</p>
              <button type="button" onClick={() => setSheetOpen(false)} aria-label="关闭" className="grid h-9 w-9 place-items-center"><X className="h-4 w-4" strokeWidth={1.7} /></button>
            </div>
            <div className="space-y-4 p-4">
              {matrixRows.colors.map(color => (
                <div key={color}>
                  <p className="mb-1.5 text-xs font-medium text-neutral-700">{color || '默认'}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {matrixRows.sizes.map(size => {
                      const key = cellKey(color, size);
                      const stock = matrixRows.stockByCell[key] || 0;
                      const value = matrix[key] || 0;
                      return (
                        <label key={key} className={`flex items-center justify-between border px-2.5 py-2 text-xs ${stock <= 0 ? 'border-neutral-200 bg-neutral-50 text-neutral-400' : 'border-neutral-300'}`}>
                          <span>{size || '均码'}<span className="ml-1.5 text-[12px] text-neutral-500">{stock > 0 ? `库存 ${stock}` : '售罄'}</span></span>
                          <input
                            value={value || ''}
                            onChange={event => setCellQuantity(key, Number(event.target.value.replace(/\D/g, '')) || 0, stock)}
                            inputMode="numeric"
                            disabled={stock <= 0}
                            aria-label={`${color} ${size} 数量`}
                            placeholder="0"
                            className="h-8 w-12 border border-neutral-200 text-center tabular-nums outline-none disabled:bg-neutral-100"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="sticky bottom-0 border-t border-neutral-200 bg-white px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
              <button type="button" onClick={() => setSheetOpen(false)} className="w-full bg-neutral-950 py-3 text-sm font-medium text-white">完成 · 合计 {matrixUnits} 件</button>
            </div>
          </div>
        </div>
      )}

      {rfqOpen && activeProduct && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="询价">
          <div className="absolute inset-0 bg-black/40" onClick={() => setRfqOpen(false)} />
          <div className="relative w-full max-w-md bg-white p-5 sm:rounded-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold">询价 · {activeProduct.styleNo}</p>
                <p className="mt-0.5 text-xs text-neutral-500">{activeProduct.name}</p>
              </div>
              <button type="button" onClick={() => setRfqOpen(false)} aria-label="关闭询价" className="grid h-8 w-8 place-items-center text-neutral-500">✕</button>
            </div>
            <label className="mt-4 block text-xs text-neutral-600">
              询价数量（件）
              <input
                value={matrixTotal || activeProduct.moq}
                readOnly
                className="mt-1 h-10 w-full border border-neutral-300 bg-neutral-50 px-3 text-sm tabular-nums"
              />
            </label>
            <label className="mt-3 block text-xs text-neutral-600">
              备注（可选）
              <textarea
                value={rfqNote}
                onChange={event => setRfqNote(event.target.value)}
                rows={3}
                maxLength={500}
                className="mt-1 w-full border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-950"
                placeholder="交期、包装或颜色要求"
              />
            </label>
            {rfqResult && (
              <p className={`mt-3 text-xs ${rfqResult.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{rfqResult.message}</p>
            )}
            <button
              type="button"
              disabled={rfqBusy}
              onClick={async () => {
                setRfqBusy(true);
                setRfqResult(null);
                const quantity = matrixTotal > 0 ? matrixTotal : activeProduct.moq;
                const result = await data.createBuyerRfq({
                  title: `${activeProduct.styleNo} 询价 · ${activeProduct.name}`,
                  description: rfqNote || `询价 ${quantity} 件`,
                  category: activeProduct.category,
                  targetQuantity: quantity,
                  targetPrice: activeProduct.unitPrice,
                  targetCurrency: 'EUR',
                  deadlineAt: new Date(Date.now() + 14 * 86400000).toISOString(),
                  preferredCountries: [],
                  productIds: [activeProduct.id],
                  merchantId: data.merchant?.id,
                  remarks: rfqNote
                });
                setRfqBusy(false);
                setRfqResult(result.ok
                  ? { ok: true, message: `已提交，询价单号 ${result.rfqNo}。商家可在后台「询价」中查看。` }
                  : { ok: false, message: data.authRole === 'buyer' ? (result.error || '提交失败，请稍后重试。') : '请先登录采购账号后再询价。' });
              }}
              className="mt-4 w-full bg-neutral-950 py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              {rfqBusy ? '提交中…' : '提交询价'}
            </button>
            <p className="mt-2 text-[12px] leading-5 text-neutral-500">提交后写入商家询价记录，商家在后台可见并可回复报价。</p>
          </div>
        </div>
      )}

      <footer className="mt-10 border-t border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-4 py-8 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>{merchant.name} · {data.contact.address || 'Italia'}</span>
          <span>{formatStock(stats.units)} · 数据来自 RUDA 商家系统</span>
          {onExit && <button type="button" onClick={onExit} className="text-left underline underline-offset-4">退出预览</button>}
        </div>
      </footer>
    </div>
  );
};

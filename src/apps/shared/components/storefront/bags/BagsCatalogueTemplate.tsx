/**
 * 箱包模板 B：Product Catalogue
 *
 * 目录结构：左侧分类栏 + 顶部搜索/排序 + 密集网格 + 规格表。
 * 与编辑版/商城版的差异：以检索效率为先，商品以「规格条目」呈现，桌面常驻过滤栏。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Search, SlidersHorizontal, X } from 'lucide-react';
import type { StorefrontData, StorefrontProduct } from '../useStorefrontData';
import { StorefrontImage, formatStock, priceText } from '../primitives';
import { StorefrontGallery } from '../gallery/StorefrontGallery';

type Props = { data: StorefrontData; onExit?: () => void; initialProductId?: string | null; onProductChange?: (productId: string | null) => void };

type SortKey = 'newest' | 'price-asc' | 'price-desc' | 'stock';

const SORT_LABEL: Record<SortKey, string> = {
  newest: '最新上架',
  'price-asc': '价格从低到高',
  'price-desc': '价格从高到低',
  stock: '库存从多到少'
};

export const BagsCatalogueTemplate: React.FC<Props> = ({ data, onExit, initialProductId = null, onProductChange }) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [material, setMaterial] = useState('all');
  const [color, setColor] = useState('all');
  const [sort, setSort] = useState<SortKey>('newest');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState<StorefrontProduct | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);

  const merchant = data.merchant;

  useEffect(() => {
    if (!initialProductId) { setActiveProduct(null); return; }
    const target = data.products.find(product => product.id === initialProductId);
    if (target) setActiveProduct(target);
  }, [initialProductId, data.products]);

  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = data.products.filter(product => {
      if (category !== 'all' && product.category !== category) return false;
      if (material !== 'all' && product.material !== material) return false;
      if (color !== 'all' && !product.colors.includes(color)) return false;
      if (!normalized) return true;
      return [product.name, product.styleNo, product.material, product.category, product.subCategory]
        .some(value => (value || '').toLowerCase().includes(normalized));
    });
    const sorted = [...filtered];
    if (sort === 'price-asc') sorted.sort((a, b) => a.unitPrice - b.unitPrice);
    if (sort === 'price-desc') sorted.sort((a, b) => b.unitPrice - a.unitPrice);
    if (sort === 'stock') sorted.sort((a, b) => b.availableStock - a.availableStock);
    return sorted;
  }, [data.products, query, category, material, color, sort]);

  const activeFilterCount = [category !== 'all', material !== 'all', color !== 'all'].filter(Boolean).length;

  const resetFilters = () => { setCategory('all'); setMaterial('all'); setColor('all'); };

  if (!merchant) {
    return <div className="grid min-h-[60vh] place-items-center text-sm text-neutral-500">该商家暂未开通网站。</div>;
  }

  const filterPanel = (
    <div className="space-y-8">
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-neutral-500">分类</p>
        <ul className="mt-3 space-y-1">
          <li>
            <button type="button" onClick={() => setCategory('all')} className={`flex w-full items-center justify-between px-2 py-1.5 text-left text-sm ${category === 'all' ? 'bg-neutral-100 font-semibold' : 'text-neutral-700 hover:bg-neutral-50'}`}>
              全部 <span className="tabular-nums text-xs text-neutral-500">{data.products.length}</span>
            </button>
          </li>
          {data.categories.map(item => (
            <li key={item.value}>
              <button type="button" onClick={() => setCategory(item.value)} className={`flex w-full items-center justify-between px-2 py-1.5 text-left text-sm ${category === item.value ? 'bg-neutral-100 font-semibold' : 'text-neutral-700 hover:bg-neutral-50'}`}>
                <span className="truncate pr-2">{item.label}</span>
                <span className="tabular-nums text-xs text-neutral-500">{item.count}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      {data.materials.length > 0 && (
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-neutral-500">材质</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setMaterial('all')} className={`border px-2.5 py-1 text-xs ${material === 'all' ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-300 text-neutral-700'}`}>全部</button>
            {data.materials.map(item => (
              <button key={item} type="button" onClick={() => setMaterial(item)} className={`border px-2.5 py-1 text-xs ${material === item ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-300 text-neutral-700'}`}>{item}</button>
            ))}
          </div>
        </div>
      )}
      {data.colors.length > 0 && (
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-neutral-500">颜色</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setColor('all')} className={`border px-2.5 py-1 text-xs ${color === 'all' ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-300 text-neutral-700'}`}>全部</button>
            {data.colors.map(item => (
              <button key={item} type="button" onClick={() => setColor(item)} className={`border px-2.5 py-1 text-xs ${color === item ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-300 text-neutral-700'}`}>{item}</button>
            ))}
          </div>
        </div>
      )}
      {activeFilterCount > 0 && (
        <button type="button" onClick={resetFilters} className="inline-flex items-center gap-1.5 text-xs text-neutral-600 underline underline-offset-4">清除筛选</button>
      )}
    </div>
  );

  return (
    <div data-storefront-template="bags_catalogue" className="min-h-screen bg-white text-neutral-950">
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-8">
          <div className="flex h-14 items-center gap-4 sm:h-16">
            <button type="button" onClick={() => { setActiveProduct(null); setAboutOpen(false); }} className="shrink-0 text-sm font-semibold uppercase tracking-[0.22em]">{merchant.name}</button>
            <div className="relative min-w-0 flex-1">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" strokeWidth={1.7} />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="搜索款号、品类、材质"
                aria-label="搜索商品"
                className="h-10 w-full border border-neutral-300 bg-white pl-9 pr-9 text-sm outline-none focus:border-neutral-950"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} aria-label="清除搜索" className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center text-neutral-500">
                  <X className="h-4 w-4" strokeWidth={1.7} />
                </button>
              )}
            </div>
            <button type="button" onClick={() => setAboutOpen(true)} className="hidden shrink-0 text-xs uppercase tracking-[0.18em] text-neutral-600 hover:text-neutral-950 sm:block">公司</button>
            <span className="shrink-0 text-xs tabular-nums text-neutral-500">{data.cartCount} 件</span>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto border-t border-neutral-100 py-2 lg:hidden">
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="inline-flex shrink-0 items-center gap-1.5 border border-neutral-300 px-2.5 py-1.5 text-xs"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.7} /> 筛选{activeFilterCount ? ` (${activeFilterCount})` : ''}
            </button>
            {data.categories.slice(0, 6).map(item => (
              <button key={item.value} type="button" onClick={() => setCategory(item.value)} className={`shrink-0 border px-2.5 py-1.5 text-xs ${category === item.value ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-300 text-neutral-700'}`}>{item.label}</button>
            ))}
          </div>
        </div>
      </header>

      {filtersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="筛选">
          <div className="absolute inset-0 bg-black/40" onClick={() => setFiltersOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[82svh] overflow-y-auto bg-white p-5 pb-[max(20px,env(safe-area-inset-bottom))]">
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm font-semibold">筛选</p>
              <button type="button" onClick={() => setFiltersOpen(false)} aria-label="关闭筛选" className="grid h-9 w-9 place-items-center"><X className="h-4 w-4" strokeWidth={1.7} /></button>
            </div>
            {filterPanel}
            <button type="button" onClick={() => setFiltersOpen(false)} className="mt-7 w-full bg-neutral-950 py-3 text-sm font-medium text-white">查看 {rows.length} 款</button>
          </div>
        </div>
      )}

      <div className="mx-auto flex max-w-[1440px] gap-10 px-4 py-8 sm:px-8 sm:py-10">
        <aside className="hidden w-60 shrink-0 lg:block" aria-label="筛选">
          {filterPanel}
        </aside>

        <main className="min-w-0 flex-1">
          {activeProduct ? (
            <section>
              <button type="button" onClick={() => { setActiveProduct(null); onProductChange?.(null); }} className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-neutral-500 hover:text-neutral-950">
                <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.7} /> 返回目录
              </button>
              <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,0.5fr)_minmax(0,0.5fr)]">
                <div>
                  <StorefrontGallery images={activeProduct.images} alt={activeProduct.name} ratio="1 / 1" priority />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold leading-tight">{activeProduct.name}</h1>
                  <p className="mt-1 text-sm text-neutral-500">{activeProduct.styleNo} · {activeProduct.category}{activeProduct.subCategory ? ` / ${activeProduct.subCategory}` : ''}</p>
                  <p className="mt-4 text-xl font-semibold tabular-nums">{priceText(activeProduct.unitPrice, data.isWholesaleAuthorized)}</p>
                  {activeProduct.tierPrice !== null && data.isWholesaleAuthorized && (
                    <p className="mt-1 text-xs text-neutral-600">100 件以上 {priceText(activeProduct.tierPrice, true)} / 件</p>
                  )}
                  <table className="mt-6 w-full border-t border-neutral-200 text-sm">
                    <tbody className="divide-y divide-neutral-100">
                      <tr><th scope="row" className="w-28 py-2.5 text-left font-normal text-neutral-500">材质</th><td className="py-2.5">{activeProduct.material || '—'}</td></tr>
                      <tr><th scope="row" className="py-2.5 text-left font-normal text-neutral-500">产地</th><td className="py-2.5">{activeProduct.origin || '—'}</td></tr>
                      <tr><th scope="row" className="py-2.5 text-left font-normal text-neutral-500">颜色</th><td className="py-2.5">{activeProduct.colors.join(' / ') || '—'}</td></tr>
                      <tr><th scope="row" className="py-2.5 text-left font-normal text-neutral-500">尺寸</th><td className="py-2.5">{activeProduct.sizes.join(' / ') || '—'}</td></tr>
                      <tr><th scope="row" className="py-2.5 text-left font-normal text-neutral-500">起订</th><td className="py-2.5 tabular-nums">{activeProduct.moq} 件（整包 {activeProduct.packSize}）</td></tr>
                      <tr><th scope="row" className="py-2.5 text-left font-normal text-neutral-500">库存</th><td className="py-2.5 tabular-nums">{formatStock(activeProduct.availableStock)}</td></tr>
                    </tbody>
                  </table>
                  <button
                    type="button"
                    onClick={() => {
                      const sku = activeProduct.skus[0];
                      data.addToCart({
                        productId: activeProduct.id,
                        styleNo: activeProduct.styleNo,
                        productName: activeProduct.name,
                        image: activeProduct.images[0] || '',
                        sku: sku?.sku || activeProduct.styleNo,
                        color: sku?.color || activeProduct.colors[0] || '',
                        size: sku?.size || activeProduct.sizes[0] || '',
                        quantity: activeProduct.moq,
                        unitPrice: activeProduct.unitPrice,
                        packSize: activeProduct.packSize
                      });
                    }}
                    className="mt-6 w-full bg-neutral-950 py-3 text-sm font-medium text-white hover:bg-neutral-800"
                  >
                    加入采购车
                  </button>
                </div>
              </div>
            </section>
          ) : aboutOpen ? (
            <section className="max-w-2xl">
              <h1 className="text-2xl font-semibold">{merchant.name}</h1>
              {data.brandStory && (
                <p className="mt-4 text-sm leading-7 text-neutral-700">{data.brandStory}</p>
              )}
              <dl className="mt-8 space-y-4 border-t border-neutral-200 pt-6 text-sm">
                {data.contact.address && <div><dt className="text-xs uppercase tracking-[0.16em] text-neutral-500">地址</dt><dd className="mt-1">{data.contact.address}</dd></div>}
                {data.contact.phone && <div><dt className="text-xs uppercase tracking-[0.16em] text-neutral-500">电话</dt><dd className="mt-1"><a className="border-b border-neutral-300" href={`tel:${data.contact.phone}`}>{data.contact.phone}</a></dd></div>}
                {data.contact.email && <div><dt className="text-xs uppercase tracking-[0.16em] text-neutral-500">邮箱</dt><dd className="mt-1"><a className="border-b border-neutral-300" href={`mailto:${data.contact.email}`}>{data.contact.email}</a></dd></div>}
              </dl>
            </section>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-sm text-neutral-600"><span className="font-semibold text-neutral-950 tabular-nums">{rows.length}</span> 款商品</p>
                <label className="flex items-center gap-2 text-xs text-neutral-600">
                  排序
                  <select value={sort} onChange={event => setSort(event.target.value as SortKey)} className="border border-neutral-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-neutral-950">
                    {(Object.keys(SORT_LABEL) as SortKey[]).map(key => <option key={key} value={key}>{SORT_LABEL[key]}</option>)}
                  </select>
                </label>
              </div>

              <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
                {rows.map(product => (
                  <li key={product.id}>
                    <button type="button" onClick={() => { setActiveProduct(product); onProductChange?.(product.id); }} className="group w-full text-left">
                      <StorefrontImage src={product.images[0]} alt={product.name} ratio="1 / 1" className="border border-neutral-200 transition-colors group-hover:border-neutral-400" />
                      <span className="mt-2.5 block truncate text-sm font-medium">{product.name}</span>
                      <span className="mt-0.5 block text-xs text-neutral-500">{product.styleNo}</span>
                      <span className="mt-1 flex items-center justify-between gap-2 text-xs">
                        <span className="whitespace-nowrap tabular-nums text-neutral-900">{priceText(product.unitPrice, data.isWholesaleAuthorized, true)}</span>
                        <span className="whitespace-nowrap text-neutral-500">{product.availableStock > 0 ? `可售 ${product.availableStock}` : '售罄'}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              {!rows.length && (
                <div className="mt-16 border border-dashed border-neutral-300 px-6 py-16 text-center">
                  <p className="text-sm font-medium text-neutral-900">没有符合条件的商品</p>
                  <p className="mt-1.5 text-xs text-neutral-500">试试更换分类或清除筛选条件。</p>
                  <button type="button" onClick={() => { resetFilters(); setQuery(''); }} className="mt-4 inline-flex items-center gap-1.5 border border-neutral-300 px-3 py-1.5 text-xs">
                    <Check className="h-3.5 w-3.5" strokeWidth={1.7} /> 清除全部条件
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      <footer className="mt-8 border-t border-neutral-200">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-4 py-8 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>{merchant.name} · {data.contact.address || 'Italia'}</span>
          <span>商品数据来自 RUDA 商家系统，实时库存与批发价</span>
          {onExit && <button type="button" onClick={onExit} className="text-left underline underline-offset-4">退出预览</button>}
        </div>
      </footer>
    </div>
  );
};

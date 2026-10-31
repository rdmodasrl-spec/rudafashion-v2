/**
 * 箱包模板 A：Italian Editorial
 *
 * 品牌官网结构：全幅摄影 + 不对称双栏 + 系列叙事 + 工艺材质 + 品牌介绍。
 * 与目录版/商城版的差异：无卡片边框、无侧边筛选、商品以「作品」呈现而非商品格。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Menu, X } from 'lucide-react';
import type { StorefrontData, StorefrontProduct } from '../useStorefrontData';
import { StorefrontImage, formatMoney, formatStock, priceText } from '../primitives';
import { StorefrontGallery } from '../gallery/StorefrontGallery';

type View = 'home' | 'collection' | 'product' | 'maison';
type Props = { data: StorefrontData; onExit?: () => void; initialProductId?: string | null; onProductChange?: (productId: string | null) => void };

const NAV: Array<{ key: View; label: string }> = [
  { key: 'home', label: '首页' },
  { key: 'collection', label: '系列' },
  { key: 'maison', label: '品牌' }
];

export const BagsEditorialTemplate: React.FC<Props> = ({ data, onExit, initialProductId = null, onProductChange }) => {
  const [view, setView] = useState<View>('home');
  const [activeProduct, setActiveProduct] = useState<StorefrontProduct | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const merchant = data.merchant;
  const withImage = useMemo(() => data.products.filter(product => product.images.length > 0), [data.products]);
  const featured = useMemo(() => (withImage.length ? withImage : data.products).slice(0, 6), [withImage, data.products]);
  const hero = featured[0];
  const secondary = featured[1];

  const go = (next: View) => {
    setView(next);
    setActiveProduct(null);
    setMenuOpen(false);
    onProductChange?.(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const openProduct = (product: StorefrontProduct) => {
    setActiveProduct(product);
    setView('product');
    onProductChange?.(product.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 深链：URL 带 product=<id> 时直接打开详情（刷新、分享、前进后退都成立）
  useEffect(() => {
    if (!initialProductId) {
      // 浏览器后退回到列表：URL 已无 product 参数，详情应关闭
      setActiveProduct(null);
      setView(current => (current === 'product' ? 'collection' : current));
      return;
    }
    const target = data.products.find(product => product.id === initialProductId);
    if (target) { setActiveProduct(target); setView('product'); }
  }, [initialProductId, data.products]);

  if (!merchant) {
    return <div className="grid min-h-[60vh] place-items-center text-sm text-neutral-500">该商家暂未开通网站。</div>;
  }

  return (
    <div data-storefront-template="bags_editorial" className="min-h-screen bg-[#fbfaf8] text-neutral-950">
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-[#fbfaf8]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between px-5 sm:h-20 sm:px-8">
          <button type="button" onClick={() => go('home')} className="text-left">
            <span className="block font-serif text-xl tracking-[0.28em] sm:text-2xl">{(merchant.name || 'RUDA').toUpperCase()}</span>
            <span className="mt-0.5 block text-[12px] uppercase tracking-[0.34em] text-neutral-500">Pelletteria italiana</span>
          </button>
          <nav aria-label="主导航" className="hidden items-center gap-9 md:flex">
            {NAV.map(item => (
              <button
                key={item.key}
                type="button"
                onClick={() => go(item.key)}
                aria-current={view === item.key ? 'page' : undefined}
                className={`text-xs uppercase tracking-[0.22em] transition-colors ${view === item.key ? 'text-neutral-950' : 'text-neutral-500 hover:text-neutral-950'}`}
              >
                {item.label}
              </button>
            ))}
            <span className="text-xs uppercase tracking-[0.22em] text-neutral-500">{data.cartCount} 件</span>
          </nav>
          <button type="button" onClick={() => setMenuOpen(true)} aria-label="打开菜单" aria-expanded={menuOpen} className="grid h-10 w-10 place-items-center md:hidden">
            <Menu className="h-5 w-5" strokeWidth={1.7} />
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-[#fbfaf8] md:hidden" role="dialog" aria-modal="true" aria-label="菜单">
          <div className="flex h-16 items-center justify-between px-5">
            <span className="font-serif text-lg tracking-[0.28em]">{(merchant.name || 'RUDA').toUpperCase()}</span>
            <button type="button" onClick={() => setMenuOpen(false)} aria-label="关闭菜单" className="grid h-10 w-10 place-items-center"><X className="h-5 w-5" strokeWidth={1.7} /></button>
          </div>
          <nav className="mt-10 flex flex-col gap-8 px-8">
            {NAV.map(item => (
              <button key={item.key} type="button" onClick={() => go(item.key)} className="text-left font-serif text-3xl">{item.label}</button>
            ))}
          </nav>
        </div>
      )}

      <main>
        {view === 'home' && (
          <>
            {/* 编辑型首屏：左文右图的不对称双栏。图框固定 4:5，白底商品图用 contain 完整呈现，
                不靠裁切放大冒充大片，商家换成实拍大片后自然铺满同一画框。 */}
            <section className="mx-auto max-w-[1320px] px-5 pb-16 pt-10 sm:px-8 sm:pb-24 sm:pt-16">
              <div className="grid gap-10 lg:grid-cols-[minmax(0,0.46fr)_minmax(0,0.54fr)] lg:items-center lg:gap-16">
                <div>
                  <p className="text-[12px] uppercase tracking-[0.34em] text-neutral-500">Pelletteria italiana</p>
                  <h1 className="mt-6 font-serif text-4xl leading-[1.08] tracking-[-0.02em] sm:text-5xl lg:text-6xl">
                    皮革与时间<br />共同完成的形状
                  </h1>
                  {data.brandStory && (
                    <p className="mt-7 max-w-md text-sm leading-7 text-neutral-600">{data.brandStory}</p>
                  )}
                  <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
                    <button type="button" onClick={() => go('collection')} className="inline-flex items-center gap-2 border-b border-neutral-950 pb-1 text-xs uppercase tracking-[0.22em]">
                      浏览系列 <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.7} />
                    </button>
                    {hero && (
                      <button type="button" onClick={() => openProduct(hero)} className="text-xs uppercase tracking-[0.22em] text-neutral-500 hover:text-neutral-950">
                        {hero.styleNo}
                      </button>
                    )}
                  </div>
                </div>
                {hero?.images.length ? (
                  <button type="button" onClick={() => openProduct(hero)} className="group block text-left">
                    <StorefrontImage src={hero.images[0]} alt={hero.name} ratio="4 / 5" priority fit="contain" className="!bg-[#f0ece5] transition-opacity group-hover:opacity-95" />
                    <span className="mt-4 flex items-baseline justify-between gap-4">
                      <span className="font-serif text-lg">{hero.name}</span>
                      <span className="text-xs uppercase tracking-[0.18em] text-neutral-500">{hero.styleNo}</span>
                    </span>
                  </button>
                ) : (
                  <div className="aspect-[4/5] w-full bg-[#f0ece5]" aria-hidden="true" />
                )}
              </div>
            </section>

            <section className="mx-auto max-w-[1320px] px-5 py-20 sm:px-8 sm:py-28" aria-labelledby="editorial-selection">
              <div className="flex items-baseline justify-between">
                <h2 id="editorial-selection" className="font-serif text-2xl sm:text-3xl">本季精选</h2>
                <span className="text-xs uppercase tracking-[0.2em] text-neutral-500">{data.products.length} 款</span>
              </div>
              <div className="mt-10 grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                {featured.slice(1, 5).map((product, index) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => openProduct(product)}
                    className={`group text-left ${index === 0 ? 'lg:col-start-1' : ''} ${index === 1 ? 'lg:mt-24' : ''} ${index === 2 ? 'lg:col-start-2 lg:-mt-16' : ''}`}
                  >
                    <StorefrontImage src={product.images[0]} alt={product.name} ratio={index === 0 ? '4 / 5' : '1 / 1'} className="transition-opacity group-hover:opacity-90" />
                    <div className="mt-4 flex items-baseline justify-between gap-4">
                      <span className="font-serif text-lg leading-tight">{product.name}</span>
                      <span className="shrink-0 text-xs tabular-nums text-neutral-600">{priceText(product.unitPrice, data.isWholesaleAuthorized)}</span>
                    </div>
                    <span className="mt-1 block text-[12px] uppercase tracking-[0.18em] text-neutral-500">{product.material || product.category} · {product.styleNo}</span>
                  </button>
                ))}
              </div>
            </section>

            {secondary && (
              <section className="border-y border-neutral-200 bg-white">
                <div className="mx-auto grid max-w-[1320px] gap-10 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-2 lg:items-center">
                  <StorefrontImage src={secondary.images[0]} alt={secondary.name} ratio="3 / 4" />
                  <div className="lg:pl-10">
                    <p className="text-[12px] uppercase tracking-[0.28em] text-neutral-500">Materiali</p>
                    <h2 className="mt-4 font-serif text-3xl leading-tight sm:text-4xl">{secondary.name}</h2>
                    {secondary.description && (
                      <p className="mt-6 max-w-md text-sm leading-7 text-neutral-600">{secondary.description}</p>
                    )}
                    <dl className="mt-8 grid grid-cols-2 gap-6 border-t border-neutral-200 pt-6 text-sm">
                      {secondary.material && <div><dt className="text-xs uppercase tracking-[0.18em] text-neutral-500">材质</dt><dd className="mt-1">{secondary.material}</dd></div>}
                      {secondary.composition && <div><dt className="text-xs uppercase tracking-[0.18em] text-neutral-500">成分</dt><dd className="mt-1">{secondary.composition}</dd></div>}
                      {secondary.origin && <div><dt className="text-xs uppercase tracking-[0.18em] text-neutral-500">产地</dt><dd className="mt-1">{secondary.origin}</dd></div>}
                      <div><dt className="text-xs uppercase tracking-[0.18em] text-neutral-500">款号</dt><dd className="mt-1 tabular-nums">{secondary.styleNo}</dd></div>
                    </dl>
                    <button type="button" onClick={() => openProduct(secondary)} className="mt-8 inline-flex items-center gap-2 border-b border-neutral-950 pb-1 text-xs uppercase tracking-[0.22em]">
                      查看作品 <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.7} />
                    </button>
                  </div>
                </div>
              </section>
            )}

            <section className="mx-auto max-w-[1320px] px-5 py-20 sm:px-8 sm:py-28">
              <div className="grid gap-10 lg:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)]">
                <h2 className="font-serif text-2xl leading-tight sm:text-3xl">关于<br />{merchant.name}</h2>
                <div>
                  <p className="max-w-xl text-sm leading-7 text-neutral-600">
                    {data.brandStory || data.contact.address || data.contact.city || '联系方式与品牌资料由商家在后台维护。'}
                  </p>
                  <div className="mt-8 flex flex-wrap gap-x-10 gap-y-3 text-sm">
                    {data.contact.phone && <a href={`tel:${data.contact.phone}`} className="border-b border-neutral-300 pb-0.5">{data.contact.phone}</a>}
                    {data.contact.email && <a href={`mailto:${data.contact.email}`} className="border-b border-neutral-300 pb-0.5">{data.contact.email}</a>}
                    <button type="button" onClick={() => go('maison')} className="border-b border-neutral-950 pb-0.5 text-xs uppercase tracking-[0.2em]">联系方式</button>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {view === 'collection' && (
          <section className="mx-auto max-w-[1320px] px-5 py-14 sm:px-8 sm:py-20">
            <h1 className="font-serif text-3xl sm:text-4xl">系列</h1>
            <p className="mt-3 max-w-xl text-sm leading-7 text-neutral-600">全部 {data.products.length} 款现货，按上架顺序陈列。</p>
            <div className="mt-10 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {data.products.map(product => (
                <button key={product.id} type="button" onClick={() => openProduct(product)} className="group text-left">
                  <StorefrontImage src={product.images[0]} alt={product.name} ratio="4 / 5" className="transition-opacity group-hover:opacity-90" />
                  <span className="mt-4 block font-serif text-lg leading-tight">{product.name}</span>
                  <span className="mt-1 flex items-center justify-between text-xs text-neutral-500">
                    <span>{product.styleNo}</span>
                    <span className="tabular-nums">{priceText(product.unitPrice, data.isWholesaleAuthorized)}</span>
                  </span>
                </button>
              ))}
              {!data.products.length && <p className="text-sm text-neutral-500">该系列暂无可展示商品。</p>}
            </div>
          </section>
        )}

        {view === 'product' && activeProduct && (
          <section className="mx-auto max-w-[1320px] px-5 py-10 sm:px-8 sm:py-16">
            <button type="button" onClick={() => go('collection')} className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-neutral-500 hover:text-neutral-950">
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.7} /> 返回系列
            </button>
            <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,0.58fr)_minmax(0,0.42fr)]">
              <div>
                <StorefrontGallery images={activeProduct.images} alt={activeProduct.name} ratio="4 / 5" priority />
              </div>
              <div className="lg:sticky lg:top-28 lg:self-start">
                <p className="text-[12px] uppercase tracking-[0.28em] text-neutral-500">{activeProduct.category}</p>
                <h1 className="mt-3 font-serif text-3xl leading-tight sm:text-4xl">{activeProduct.name}</h1>
                <p className="mt-4 text-xl tabular-nums">{priceText(activeProduct.unitPrice, data.isWholesaleAuthorized)}</p>
                <p className="mt-1 text-xs text-neutral-500">{formatStock(activeProduct.availableStock)} · 起订 {activeProduct.moq} 件</p>
                <dl className="mt-8 space-y-3 border-t border-neutral-200 pt-6 text-sm">
                  <div className="flex justify-between gap-6"><dt className="text-neutral-500">款号</dt><dd className="tabular-nums">{activeProduct.styleNo}</dd></div>
                  {activeProduct.material && <div className="flex justify-between gap-6"><dt className="text-neutral-500">材质</dt><dd>{activeProduct.material}</dd></div>}
                  {activeProduct.origin && <div className="flex justify-between gap-6"><dt className="text-neutral-500">产地</dt><dd>{activeProduct.origin}</dd></div>}
                  {activeProduct.colors.length > 0 && <div className="flex justify-between gap-6"><dt className="text-neutral-500">颜色</dt><dd className="text-right">{activeProduct.colors.join(' / ')}</dd></div>}
                  {activeProduct.sizes.length > 0 && <div className="flex justify-between gap-6"><dt className="text-neutral-500">尺寸</dt><dd>{activeProduct.sizes.join(' / ')}</dd></div>}
                </dl>
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
                  className="mt-8 w-full bg-neutral-950 px-6 py-3.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
                >
                  加入采购车 · {activeProduct.moq} 件起
                </button>
                <p className="mt-3 text-xs leading-6 text-neutral-500">加入后可继续调整数量与规格，采购价按您的买家等级计算。</p>
              </div>
            </div>
          </section>
        )}

        {view === 'maison' && (
          <section className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 sm:py-24">
            <p className="text-[12px] uppercase tracking-[0.28em] text-neutral-500">Maison</p>
            <h1 className="mt-4 max-w-2xl font-serif text-3xl leading-tight sm:text-5xl">{merchant.name}</h1>
            <div className="mt-12 grid gap-12 lg:grid-cols-2">
              <div className="space-y-6 text-sm leading-8 text-neutral-700">
                <p>{((merchant as unknown as { description_zh?: string }).description_zh) || merchant.description || '意大利皮具工坊，为欧洲买手与精品店提供现货皮具与订货服务。'}</p>
                <p>我们保留传统做法：整张皮料裁剪、手工缝线、金属件逐个检验。每一次补货都以同一批皮料为准，确保颜色一致。</p>
              </div>
              <dl className="space-y-5 self-start border-t border-neutral-200 pt-6 text-sm">
                {data.contact.address && <div><dt className="text-xs uppercase tracking-[0.18em] text-neutral-500">地址</dt><dd className="mt-1">{data.contact.address}</dd></div>}
                {data.contact.phone && <div><dt className="text-xs uppercase tracking-[0.18em] text-neutral-500">电话</dt><dd className="mt-1"><a href={`tel:${data.contact.phone}`} className="border-b border-neutral-300 pb-0.5">{data.contact.phone}</a></dd></div>}
                {data.contact.email && <div><dt className="text-xs uppercase tracking-[0.18em] text-neutral-500">邮箱</dt><dd className="mt-1"><a href={`mailto:${data.contact.email}`} className="border-b border-neutral-300 pb-0.5">{data.contact.email}</a></dd></div>}
                <div><dt className="text-xs uppercase tracking-[0.18em] text-neutral-500">批发</dt><dd className="mt-1">登录采购账号后可查看批发价并下单</dd></div>
              </dl>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-3 px-5 py-10 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span className="font-serif text-base tracking-[0.2em] text-neutral-950">{(merchant.name || 'RUDA').toUpperCase()}</span>
          <span>{data.contact.address || 'Prato, Italia'} · RUDA Fashion B2B</span>
          {onExit && <button type="button" onClick={onExit} className="text-left underline-offset-4 hover:underline">退出预览</button>}
        </div>
      </footer>
    </div>
  );
};

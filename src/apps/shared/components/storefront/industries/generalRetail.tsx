/**
 * 综合零售商（general_retail）三套结构型模板。
 *
 * 行业业务：面向终端消费者的多品类零售，核心是「发现 → 浏览 → 快速下单」。
 * 三套结构差异：
 * - retail_editorial：杂志式（大图 + 编辑推荐 + 品类故事）
 * - retail_marketplace：市集式（分类横滑 + 混合尺寸网格 + 高密度）
 * - retail_quick_shop：快速购买（搜索优先首屏 + 2 列卡片 + 快速加购 + 底部购物条）
 */
import React, { useMemo, useState } from 'react';
import { Check, Search, ShoppingBag, Sparkles } from 'lucide-react';
import { AuthNotice, EmptyBlock, SectionHeading, StoreFooter, StoreShell, Tag } from '../kit/shell';
import { EditorialNav, UtilityNav } from '../kit/nav';
import { ProductCard, ProductGrid } from '../kit/product';
import { CartDrawer, ProductDetail, quickAddToCart } from '../kit/detail';
import { useActiveProduct, useStorefrontFilters, type StorefrontTemplateProps } from '../kit/filters';
import { StorefrontImage, priceText } from '../primitives';

/* ─────────────────────── 1. 杂志式 ─────────────────────── */

export const RetailEditorialTemplate: React.FC<StorefrontTemplateProps> = ({ data, initialProductId, onProductChange }) => {
  const [query, setQuery] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const { activeProduct, open, close } = useActiveProduct(data.products, initialProductId ?? null, onProductChange);

  const stories = useMemo(() => data.categories.slice(0, 3).map(category => ({
    ...category,
    items: data.products.filter(product => product.category === category.value).slice(0, 3)
  })).filter(story => story.items.length), [data.categories, data.products]);

  const picks = useMemo(() => data.products.slice(0, 6), [data.products]);
  const lead = data.products[0];

  return (
    <StoreShell
      tone="retail"
      header={<EditorialNav name={data.merchant?.name || 'RUDA'} links={['本期', '品类', '故事', '联系']} query={query} onQuery={setQuery} cartCount={data.cartCount} onContact={() => { window.location.hash = 'story'; }} />}
      footer={<StoreFooter data={data} note="零售价格含税，配送与退换按商家政策执行。" />}
    >
      <section className="mx-auto max-w-[1400px] px-5 py-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            {lead ? <StorefrontImage src={lead.images[0]} alt={lead.name} ratio="16 / 11" priority /> : <EmptyBlock title="商品即将上架" description="商家发布商品后会显示在这里。" />}
          </div>
          <div className="grid gap-4 sm:grid-rows-2">
            {picks.slice(1, 3).map(product => (
              <button key={product.id} type="button" onClick={() => open(product)} className="text-left">
                <StorefrontImage src={product.images[0]} alt={product.name} ratio="4 / 3" />
                <p className="mt-2 truncate text-xs font-medium text-neutral-900">{product.name}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="mt-8 flex flex-wrap items-end justify-between gap-3 border-t border-neutral-200 pt-6">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-neutral-500">This Week</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">{data.merchant?.tagline_zh || data.merchant?.tagline || '本期精选'}</h1>
            <p className="mt-2 max-w-xl text-xs leading-6 text-neutral-600">{data.brandStory || '按品类整理的本期精选，点击查看详情。'}</p>
          </div>
          <button type="button" onClick={() => setCartOpen(true)} className="inline-flex items-center gap-1.5 rounded-full border border-neutral-900 px-4 py-2 text-xs font-semibold text-neutral-900">
            <ShoppingBag className="h-3.5 w-3.5" />购物袋 {data.cartCount}
          </button>
        </div>
        <div className="mt-4"><AuthNotice data={data} /></div>
      </section>

      <section className="mx-auto max-w-[1400px] px-5 pb-12">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {picks.map(product => (
            <ProductCard key={product.id} product={product} authorized={data.isWholesaleAuthorized} variant="tile" onOpen={open} />
          ))}
        </div>
      </section>

      {stories.map(story => (
        <section key={story.value} className="border-t border-neutral-200">
          <div className="mx-auto grid max-w-[1400px] gap-6 px-5 py-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-neutral-500">Story</p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-neutral-900">{story.label}</h2>
              <p className="mt-2 text-xs leading-6 text-neutral-600">{story.count} 款 · 由商家提供的品类说明</p>
              <button type="button" onClick={() => open(story.items[0])} className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-900 underline underline-offset-4">
                进入该品类
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {story.items.map(product => (
                <button key={product.id} type="button" onClick={() => open(product)} aria-label={product.name}>
                  <StorefrontImage src={product.images[0]} alt={product.name} ratio="3 / 4" />
                </button>
              ))}
            </div>
          </div>
        </section>
      ))}

      <section id="story" className="mx-auto max-w-[1400px] px-5 py-12">
        <SectionHeading kicker="About" title="关于本店" description={data.brandStory || '商家暂未填写品牌介绍。'} />
        <div className="mt-4 flex flex-wrap gap-2">
          <Tag tone="outline">{data.products.length} 款在售</Tag>
          <Tag tone="outline">{data.categories.length} 个品类</Tag>
          <Tag tone="muted">{data.contact.city || '—'}</Tag>
        </div>
      </section>

      {activeProduct ? <ProductDetail data={data} product={activeProduct} mode="editorial" onClose={close} /> : null}
      <CartDrawer data={data} open={cartOpen} onClose={() => setCartOpen(false)} />
    </StoreShell>
  );
};

/* ─────────────────────── 2. 市集式 ─────────────────────── */

export const RetailMarketplaceTemplate: React.FC<StorefrontTemplateProps> = ({ data, initialProductId, onProductChange }) => {
  const { filters, update, query, setQuery, filtered, sort, setSort } = useStorefrontFilters(data.products);
  const { activeProduct, open, close } = useActiveProduct(data.products, initialProductId ?? null, onProductChange);
  const [notice, setNotice] = useState('');

  // 市集式栅格：混合尺寸，营造多摊位的丰富度；只改版式，不改数据
  const blocks = useMemo(() => filtered.map((product, index) => ({
    product,
    wide: index % 7 === 0,
    tall: index % 5 === 3
  })), [filtered]);

  return (
    <StoreShell
      tone="retail"
      header={(
        <UtilityNav
          name={data.merchant?.name || 'RUDA'}
          categories={data.categories}
          category={filters.category}
          onCategory={value => update({ category: value })}
          query={query}
          onQuery={setQuery}
          cartCount={data.cartCount}
          onCart={() => data.setCurrentView?.('cart')}
        />
      )}
      footer={<StoreFooter data={data} note="市集商品由本店统一履约。" />}
    >
      <div className="mx-auto max-w-[1400px] px-4 py-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-neutral-900"><Sparkles className="h-3.5 w-3.5" />全部市集</span>
          {data.categories.map(category => (
            <button
              key={category.value}
              type="button"
              onClick={() => update({ category: category.value })}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${filters.category === category.value ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 bg-white text-neutral-700'}`}
            >
              {category.label} · {category.count}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-neutral-500">{filtered.length} 款商品</p>
          <select value={sort} onChange={event => setSort(event.target.value as typeof sort)} aria-label="排序" className="border border-neutral-300 bg-white px-2 py-1.5 text-xs">
            <option value="featured">推荐</option>
            <option value="priceAsc">价格升序</option>
            <option value="priceDesc">价格降序</option>
            <option value="stock">库存优先</option>
          </select>
        </div>
        <div className="mt-3"><AuthNotice data={data} /></div>
        {notice ? <p className="mt-3 flex items-center gap-1.5 text-xs text-neutral-800"><Check className="h-3.5 w-3.5" />{notice}</p> : null}

        <div className="mt-5 grid auto-rows-[minmax(0,auto)] grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {blocks.map(({ product, wide, tall }) => (
            <div key={product.id} className={wide ? 'sm:col-span-2' : ''}>
              <button type="button" onClick={() => open(product)} className="group block text-left">
                <StorefrontImage src={product.images[0]} alt={product.name} ratio={tall ? '3 / 4' : wide ? '16 / 10' : '1 / 1'} />
                <div className="mt-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-neutral-900">{product.name}</p>
                    <p className="truncate text-xs text-neutral-500">{product.category} · {product.styleNo}</p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-neutral-900">{priceText(product.unitPrice, data.isWholesaleAuthorized, true)}</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setNotice(quickAddToCart(data, product))}
                className="mt-2 w-full rounded-full border border-neutral-300 py-1.5 text-xs font-semibold text-neutral-800 transition-colors hover:border-neutral-900"
              >
                快速加入
              </button>
            </div>
          ))}
        </div>
        {!blocks.length ? <div className="mt-6"><EmptyBlock title="没有匹配的商品" description="换个分类或清空搜索。" /></div> : null}
      </div>

      {activeProduct ? <ProductDetail data={data} product={activeProduct} mode="spec" onClose={close} onSubmitted={setNotice} /> : null}
    </StoreShell>
  );
};

/* ─────────────────────── 3. 快速购买 ─────────────────────── */

export const RetailQuickShopTemplate: React.FC<StorefrontTemplateProps> = ({ data, initialProductId, onProductChange }) => {
  const { filters, update, query, setQuery, filtered } = useStorefrontFilters(data.products);
  const { activeProduct, open, close } = useActiveProduct(data.products, initialProductId ?? null, onProductChange);
  const [notice, setNotice] = useState('');

  return (
    <StoreShell
      tone="retail"
      header={(
        <div className="mx-auto max-w-[900px] px-4">
          <div className="flex h-14 items-center gap-2">
            <p className="shrink-0 text-sm font-semibold tracking-tight text-neutral-900">{data.merchant?.name || 'RUDA'}</p>
            <button type="button" onClick={() => data.setCurrentView?.('cart')} className="ml-auto flex items-center gap-1 text-xs text-neutral-700">
              <ShoppingBag className="h-4 w-4" />{data.cartCount}
            </button>
          </div>
        </div>
      )}
      footer={<StoreFooter data={data} note="下单后由商家确认库存与配送。" />}
    >
      <div className="mx-auto max-w-[900px] px-4 pb-24">
        <div className="pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="搜索商品、款号或品类"
              className="h-12 w-full rounded-full border border-neutral-300 bg-white pl-10 pr-4 text-sm outline-none focus:border-neutral-900"
            />
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            <button type="button" onClick={() => update({ category: 'all' })} className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${filters.category === 'all' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700'}`}>全部</button>
            {data.categories.map(category => (
              <button
                key={category.value}
                type="button"
                onClick={() => update({ category: category.value })}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${filters.category === category.value ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700'}`}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4"><AuthNotice data={data} /></div>
        {notice ? <p className="mt-3 flex items-center gap-1.5 text-xs text-neutral-800"><Check className="h-3.5 w-3.5" />{notice}</p> : null}

        <div className="mt-4 grid grid-cols-2 gap-3">
          {filtered.map(product => (
            <div key={product.id} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
              <button type="button" onClick={() => open(product)} className="block w-full text-left">
                <StorefrontImage src={product.images[0]} alt={product.name} ratio="1 / 1" />
                <div className="p-3">
                  <p className="truncate text-xs font-semibold text-neutral-900">{product.name}</p>
                  <p className="mt-0.5 truncate text-xs text-neutral-500">{product.category}</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums text-neutral-900">{priceText(product.unitPrice, data.isWholesaleAuthorized, true)}</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setNotice(quickAddToCart(data, product))}
                className="w-full border-t border-neutral-200 py-2 text-xs font-semibold text-neutral-900 transition-colors hover:bg-neutral-50"
              >
                加入购物袋
              </button>
            </div>
          ))}
        </div>
        {!filtered.length ? <div className="mt-6"><EmptyBlock title="没有找到商品" description="换个关键词或分类。" /></div> : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[900px] items-center gap-3">
          <span className="text-xs text-neutral-600">购物袋 {data.cartCount} 件</span>
          <button type="button" onClick={() => data.setCurrentView?.('cart')} className="ml-auto rounded-full bg-neutral-900 px-5 py-2.5 text-xs font-semibold text-white">
            去结算
          </button>
        </div>
      </div>

      {activeProduct ? <ProductDetail data={data} product={activeProduct} mode="spec" onClose={close} onSubmitted={setNotice} /> : null}
    </StoreShell>
  );
};

export const GENERAL_RETAIL_TEMPLATES = {
  retail_editorial: RetailEditorialTemplate,
  retail_marketplace: RetailMarketplaceTemplate,
  retail_quick_shop: RetailQuickShopTemplate
} as const;

export const RetailQuickAddHint = ProductCard;

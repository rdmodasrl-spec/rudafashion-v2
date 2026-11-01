/**
 * 百货连锁店（department_chain_retail）三套结构型模板。
 *
 * 行业业务：集团 + 门店体系的零售，核心是「门店 → 到店/到货 → 集团活动」。
 * 三套结构差异：
 * - chain_stores：门店导向（门店信息卡 + 该店在售商品 + 到店说明）
 * - chain_campaign：活动导向（大促主视觉 + 活动商品带 + 服务权益）
 * - chain_group：集团目录（全类目面板 + 品类板块 + 集团介绍）
 */
import React, { useMemo, useState } from 'react';
import { ArrowRight, Clock, MapPin, Phone, Store, Truck } from 'lucide-react';
import { AuthNotice, EmptyBlock, SectionHeading, StoreFooter, StoreShell, Tag } from '../kit/shell';
import { MegaNav } from '../kit/nav';
import { ProductCard, ProductGrid } from '../kit/product';
import { ProductDetail } from '../kit/detail';
import { useActiveProduct, useStorefrontFilters, type StorefrontTemplateProps } from '../kit/filters';
import { StorefrontImage, priceText } from '../primitives';

/* ─────────────────────── 1. 门店导向 ─────────────────────── */

export const ChainStoresTemplate: React.FC<StorefrontTemplateProps> = ({ data, initialProductId, onProductChange }) => {
  const { activeProduct, open, close } = useActiveProduct(data.products, initialProductId ?? null, onProductChange);
  const merchant = data.merchant;
  const storeImage = merchant?.showroomImage || merchant?.banner || data.products[0]?.images[0];

  return (
    <StoreShell
      tone="retail"
      header={(
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4">
          <p className="text-sm font-semibold tracking-tight text-neutral-900">{merchant?.name || 'RUDA'}</p>
          <span className="hidden items-center gap-1.5 text-xs text-neutral-500 sm:flex"><Store className="h-3.5 w-3.5" />门店</span>
          <a href="#store" className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-900">门店信息 <ArrowRight className="h-3.5 w-3.5" /></a>
        </div>
      )}
      footer={<StoreFooter data={data} note="到店自提、同城配送与跨店调货以门店确认为准。" />}
    >
      <section id="store" className="mx-auto grid max-w-[1400px] gap-8 px-5 py-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-neutral-500">Store</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-900">{merchant?.name || '门店'}</h1>
          <p className="mt-2 text-xs text-neutral-500">{merchant?.companyLegalName || ''}</p>
          <div className="mt-6 space-y-3 text-xs leading-6 text-neutral-700">
            <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />{data.contact.address || '地址待补充'}{data.contact.city ? ` · ${data.contact.city}` : ''}</p>
            <p className="flex items-start gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />{data.contact.phone || '电话待补充'}</p>
            <p className="flex items-start gap-2"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />营业时间与节假日安排请联系门店确认</p>
            <p className="flex items-start gap-2"><Truck className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />支持到店自提；同城配送范围与运费由门店确认</p>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Tag tone="outline">{data.products.length} 款在售</Tag>
            <Tag tone="outline">{data.categories.length} 个品类</Tag>
            {merchant?.foundedYear ? <Tag tone="muted">成立于 {merchant.foundedYear}</Tag> : null}
          </div>
        </div>
        <div>{storeImage ? <StorefrontImage src={storeImage} alt={`${merchant?.name || '门店'} 门店照片`} ratio="4 / 3" priority /> : <EmptyBlock title="门店照片待上传" description="商家上传门店照片后会显示在这里。" />}</div>
      </section>

      <section className="mx-auto max-w-[1400px] px-5 pb-12">
        <SectionHeading kicker="In store" title="本店在售" description="以下为本店当前可售商品，价格以门店结算为准。" />
        <div className="mt-4"><AuthNotice data={data} /></div>
        <div className="mt-6">
          {data.products.length
            ? <ProductGrid products={data.products} authorized={data.isWholesaleAuthorized} variant="tile" columns={4} onOpen={open} />
            : <EmptyBlock title="本店暂无在售商品" description="商家发布后会显示在这里。" />}
        </div>
      </section>

      {activeProduct ? <ProductDetail data={data} product={activeProduct} mode="spec" onClose={close} /> : null}
    </StoreShell>
  );
};

/* ─────────────────────── 2. 集团活动 ─────────────────────── */

export const ChainCampaignTemplate: React.FC<StorefrontTemplateProps> = ({ data, initialProductId, onProductChange }) => {
  const { activeProduct, open, close } = useActiveProduct(data.products, initialProductId ?? null, onProductChange);
  const merchant = data.merchant;
  const highlight = useMemo(() => data.products.filter(product => product.isClearance).slice(0, 4), [data.products]);
  const featured = useMemo(() => (highlight.length ? highlight : data.products.slice(0, 4)), [highlight, data.products]);
  const rest = useMemo(() => data.products.filter(product => !featured.some(item => item.id === product.id)), [data.products, featured]);

  return (
    <StoreShell
      tone="retail"
      header={(
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-3 px-4">
          <p className="text-sm font-semibold tracking-tight text-neutral-900">{merchant?.name || 'RUDA'}</p>
          <nav className="hidden gap-6 text-xs text-neutral-600 sm:flex">
            <a href="#campaign" className="transition-colors hover:text-neutral-900">本期活动</a>
            <a href="#service" className="transition-colors hover:text-neutral-900">服务保障</a>
            <a href="#all" className="transition-colors hover:text-neutral-900">全部商品</a>
          </nav>
          <span className="text-xs text-neutral-500">购物车 {data.cartCount}</span>
        </div>
      )}
      footer={<StoreFooter data={data} note="活动价格与库存以门店/线上结算为准。" />}
    >
      <section id="campaign" className="relative">
        <div className="mx-auto max-w-[1400px] px-5 py-8">
          <div className="relative overflow-hidden rounded-3xl bg-neutral-900">
            {merchant?.banner ? <img src={merchant.banner} alt={`${merchant.name} 活动主视觉`} className="absolute inset-0 h-full w-full object-cover opacity-40" loading="eager" /> : null}
            <div className="relative px-6 py-14 sm:px-12">
              <p className="text-xs uppercase tracking-[0.28em] text-neutral-400">Campaign</p>
              <h1 className="mt-3 max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">
                {merchant?.tagline_zh || merchant?.tagline || '本期门店活动'}
              </h1>
              <p className="mt-4 max-w-xl text-xs leading-6 text-neutral-300">
                {data.brandStory || `${featured.length} 款参与本期活动，线上浏览、到店试穿或同城配送。`}
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <a href="#all" className="bg-white px-4 py-2.5 text-xs font-semibold text-neutral-950">立即选购</a>
                <a href="#service" className="border border-neutral-600 px-4 py-2.5 text-xs font-semibold text-white">服务保障</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-5 pb-10">
        <SectionHeading kicker="Featured" title="活动商品" description={highlight.length ? '含门店特价商品。' : '按本店在售商品展示。'} />
        <div className="mt-4"><AuthNotice data={data} /></div>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {featured.map(product => (
            <button key={product.id} type="button" onClick={() => open(product)} className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white text-left">
              <StorefrontImage src={product.images[0]} alt={product.name} ratio="1 / 1" />
              <div className="p-3">
                <p className="truncate text-xs font-semibold text-neutral-900">{product.name}</p>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-sm font-semibold tabular-nums text-neutral-900">{priceText(product.unitPrice, data.isWholesaleAuthorized, true)}</span>
                  {product.isClearance ? <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-xs font-semibold text-white">特价</span> : null}
                </div>
              </div>
            </button>
          ))}
          {!featured.length ? <div className="col-span-2 sm:col-span-4"><EmptyBlock title="本期暂无活动商品" description="商家发布商品或设置特价后会在这里展示。" /></div> : null}
        </div>
      </section>

      <section id="service" className="border-y border-neutral-200 bg-white">
        <div className="mx-auto grid max-w-[1400px] gap-6 px-5 py-10 sm:grid-cols-3">
          {[
            { title: '到店自提', detail: data.contact.address || '就近门店自提，具体时间与门店确认' },
            { title: '配送与运费', detail: merchant?.storefrontShippingPolicy || '同城配送范围与运费由门店确认' },
            { title: '退换政策', detail: merchant?.storefrontReturnsPolicy || '按门店退换政策执行' }
          ].map(item => (
            <div key={item.title}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">{item.title}</p>
              <p className="mt-2 text-xs leading-6 text-neutral-700">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="all" className="mx-auto max-w-[1400px] px-5 py-10">
        <SectionHeading kicker="All" title="全部商品" description={`${rest.length} 款`} />
        <div className="mt-6">
          {rest.length
            ? <ProductGrid products={rest} authorized={data.isWholesaleAuthorized} variant="tile" columns={4} onOpen={open} />
            : <EmptyBlock title="暂无更多商品" description="活动商品已全部展示。" />}
        </div>
      </section>

      {activeProduct ? <ProductDetail data={data} product={activeProduct} mode="spec" onClose={close} /> : null}
    </StoreShell>
  );
};

/* ─────────────────────── 3. 集团目录 ─────────────────────── */

export const ChainGroupTemplate: React.FC<StorefrontTemplateProps> = ({ data, initialProductId, onProductChange }) => {
  const { filters, update, query, setQuery, filtered } = useStorefrontFilters(data.products);
  const { activeProduct, open, close } = useActiveProduct(data.products, initialProductId ?? null, onProductChange);
  const groups = useMemo(() => data.categories.map(category => ({
    ...category,
    items: filtered.filter(product => product.category === category.value).slice(0, 4)
  })).filter(group => group.items.length), [data.categories, filtered]);

  return (
    <StoreShell
      tone="retail"
      header={<MegaNav name={data.merchant?.name || 'RUDA'} categories={data.categories} category={filters.category} onCategory={value => update({ category: value })} query={query} onQuery={setQuery} />}
      footer={<StoreFooter data={data} note="集团各门店库存可能不同，以门店实际库存为准。" />}
    >
      <section className="mx-auto max-w-[1400px] px-5 py-10">
        <p className="text-xs uppercase tracking-[0.24em] text-neutral-500">Retail Group</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">{data.merchant?.name || '集团商城'}</h1>
        <p className="mt-3 max-w-2xl text-xs leading-6 text-neutral-600">
          {data.brandStory || `覆盖 ${data.categories.length} 个品类、${data.products.length} 款在售商品，支持门店自提与配送。`}
        </p>
        <div className="mt-4"><AuthNotice data={data} /></div>
      </section>

      <section className="mx-auto max-w-[1400px] space-y-10 px-5 pb-12">
        {groups.map(group => (
          <div key={group.value}>
            <div className="flex items-end justify-between border-b border-neutral-200 pb-2">
              <h2 className="text-lg font-semibold tracking-tight text-neutral-900">{group.label}</h2>
              <button type="button" onClick={() => update({ category: group.value })} className="text-xs font-semibold text-neutral-900 underline underline-offset-4">
                查看全部 {group.count} 款
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {group.items.map(product => (
                <ProductCard key={product.id} product={product} authorized={data.isWholesaleAuthorized} variant="tile" onOpen={open} />
              ))}
            </div>
          </div>
        ))}
        {!groups.length ? <EmptyBlock title="没有匹配的商品" description="调整类目或搜索词。" /> : null}
      </section>

      {activeProduct ? <ProductDetail data={data} product={activeProduct} mode="spec" onClose={close} /> : null}
    </StoreShell>
  );
};

export const DEPARTMENT_CHAIN_TEMPLATES = {
  chain_stores: ChainStoresTemplate,
  chain_campaign: ChainCampaignTemplate,
  chain_group: ChainGroupTemplate
} as const;

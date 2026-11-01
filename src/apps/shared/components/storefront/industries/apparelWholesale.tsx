/**
 * 服装批发商（apparel_wholesale）三套结构型模板。
 *
 * 行业业务：按季度系列把成衣卖给零售商，核心是「看系列 → 定款式 → 按尺码配码下单」。
 * 三套结构差异：
 * - apparel_lookbook：品牌系列画册（分章 + 大图叙事），详情左右分栏
 * - apparel_collection：款式库检索（侧栏筛选 + 4 列高密度网格），详情属性表
 * - apparel_line_sheet：订货会 Line Sheet（横向行项目 + 实时汇总），详情数量矩阵
 */
import React, { useMemo, useState } from 'react';
import { ArrowRight, ShoppingCart } from 'lucide-react';
import { AuthNotice, EmptyBlock, MetricRow, SectionHeading, StoreFooter, StoreShell } from '../kit/shell';
import { EditorialNav, UtilityNav } from '../kit/nav';
import { FilterDrawer, FilterRail, FilterTrigger, ProductGrid } from '../kit/product';
import { CartDrawer, ProductDetail, Stepper } from '../kit/detail';
import { useActiveProduct, useStorefrontFilters, type StorefrontTemplateProps } from '../kit/filters';
import { StorefrontImage, priceText } from '../primitives';
import type { StorefrontProduct } from '../useStorefrontData';

/* ────────────────────────────── 1. 系列画册 ────────────────────────────── */

export const ApparelLookbookTemplate: React.FC<StorefrontTemplateProps> = ({ data, initialProductId, onProductChange }) => {
  const [query, setQuery] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const { activeProduct, open, close } = useActiveProduct(data.products, initialProductId ?? null, onProductChange);

  const searched = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return data.products;
    return data.products.filter(product =>
      [product.name, product.styleNo, product.material].some(value => (value || '').toLowerCase().includes(normalized))
    );
  }, [data.products, query]);

  const chapters = useMemo(() => {
    const map = new Map<string, StorefrontProduct[]>();
    searched.forEach(product => {
      const key = product.category || '本季系列';
      map.set(key, [...(map.get(key) || []), product]);
    });
    return Array.from(map, ([title, items]) => ({ title, items })).slice(0, 4);
  }, [searched]);

  const hero = data.products[0];

  return (
    <StoreShell
      tone="editorial"
      header={<EditorialNav name={data.merchant?.name || 'RUDA'} query={query} onQuery={setQuery} cartCount={data.cartCount} onContact={() => { window.location.hash = 'brand'; }} />}
      footer={<StoreFooter data={data} note="本季系列以商家确认为准；样衣与色卡可申请。" />}
    >
      <section className="mx-auto grid max-w-[1400px] items-center gap-8 px-5 py-10 lg:grid-cols-[1.25fr_0.75fr] lg:py-16">
        <div>
          {hero
            ? <StorefrontImage src={hero.images[0]} alt={hero.name} ratio="16 / 10" priority />
            : <EmptyBlock title="本季系列尚未上架" description="商家发布商品后，这里会显示当季主视觉。" />}
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-neutral-500">Season SS26</p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-neutral-900 sm:text-4xl">
            {data.merchant?.tagline_zh || data.merchant?.tagline || '当季系列'}
          </h1>
          <p className="mt-4 max-w-md text-xs leading-6 text-neutral-600">
            {data.brandStory || `${data.products.length} 款当季款式，按系列分章呈现。选择款式后可查看面料、配码与批发价格。`}
          </p>
          <div className="mt-6">
            <MetricRow items={[
              { label: '款式', value: String(data.products.length) },
              { label: '系列', value: String(chapters.length) },
              { label: '品类', value: String(data.categories.length) },
              { label: '起订', value: data.products[0] ? `${data.products[0].moq} 件` : '—' }
            ]} />
          </div>
          <a href="#chapters" className="mt-6 inline-flex items-center gap-2 border border-neutral-900 px-4 py-2.5 text-xs font-semibold text-neutral-900 transition-colors hover:bg-neutral-900 hover:text-white">
            浏览系列 <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </section>

      <div className="mx-auto max-w-[1400px] px-5"><AuthNotice data={data} /></div>

      <div id="chapters" className="mx-auto max-w-[1400px] space-y-14 px-5 py-12">
        {chapters.map((chapter, index) => (
          <section key={chapter.title}>
            <SectionHeading
              kicker={`第 ${String(index + 1).padStart(2, '0')} 章`}
              title={chapter.title}
              description={`${chapter.items.length} 款 · ${chapter.items[0]?.material || '面料见详情'}`}
              action={<span className="text-xs tabular-nums text-neutral-500">批发价 {priceText(chapter.items[0]?.unitPrice ?? 0, data.isWholesaleAuthorized, true)}</span>}
            />
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {chapter.items.slice(0, 3).map(product => (
                <button key={product.id} type="button" onClick={() => open(product)} className="group text-left">
                  <StorefrontImage src={product.images[0]} alt={product.name} ratio="4 / 5" />
                  <p className="mt-3 text-sm font-medium text-neutral-900">{product.name}</p>
                  <p className="mt-1 text-xs text-neutral-500">{product.styleNo} · {product.material || '—'}</p>
                </button>
              ))}
            </div>
            {chapter.items.length > 3 ? (
              <button type="button" onClick={() => setQuery(chapter.title)} className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-900 underline underline-offset-4">
                继续查看该系列 {chapter.items.length} 款 <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </section>
        ))}
        {!chapters.length ? <EmptyBlock title="没有匹配的款式" description="调整搜索词后再试。" /> : null}
      </div>

      <section id="brand" className="border-y border-neutral-200 bg-neutral-50">
        <div className="mx-auto grid max-w-[1400px] gap-8 px-5 py-12 lg:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-neutral-500">品牌</p>
            <p className="mt-3 text-xs leading-6 text-neutral-700">{data.brandStory || '商家暂未填写品牌介绍。'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-neutral-500">材质与工艺</p>
            <ul className="mt-3 space-y-1 text-xs text-neutral-700">
              {Array.from(new Set(data.materials)).slice(0, 5).map(material => <li key={material}>· {material}</li>)}
              {!data.materials.length ? <li>· 详见各款商品说明</li> : null}
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-neutral-500">联系与看样</p>
            <p className="mt-3 text-xs leading-6 text-neutral-700">
              {data.contact.phone || '—'}<br />{data.contact.email || '—'}<br />{data.contact.address || '—'}
            </p>
            <button type="button" onClick={() => setCartOpen(true)} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-900 underline underline-offset-4">
              查看订货车（{data.cartCount}）<ShoppingCart className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </section>

      {activeProduct ? <ProductDetail data={data} product={activeProduct} mode="editorial" onClose={close} /> : null}
      <CartDrawer data={data} open={cartOpen} onClose={() => setCartOpen(false)} />
    </StoreShell>
  );
};

/* ────────────────────────────── 2. 款式库 ────────────────────────────── */

export const ApparelCollectionTemplate: React.FC<StorefrontTemplateProps> = ({ data, initialProductId, onProductChange }) => {
  const { filters, update, reset, query, setQuery, sort, setSort, filtered, activeCount } = useStorefrontFilters(data.products);
  const [drawer, setDrawer] = useState(false);
  const { activeProduct, open, close } = useActiveProduct(data.products, initialProductId ?? null, onProductChange);
  const sizes = useMemo(() => Array.from(new Set(data.products.flatMap(product => product.sizes))), [data.products]);

  return (
    <StoreShell
      tone="utility"
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
      footer={<StoreFooter data={data} note="款式库价格按采购账号等级计算。" />}
    >
      <div className="mx-auto max-w-[1400px] px-4 py-6">
        <SectionHeading
          kicker="Collection"
          title="当季款式库"
          description={`${filtered.length} / ${data.products.length} 款 · 按品类、材质、颜色与尺码检索`}
          action={(
            <div className="flex items-center gap-2">
              <FilterTrigger onClick={() => setDrawer(true)} activeCount={activeCount} />
              <select value={sort} onChange={event => setSort(event.target.value as typeof sort)} aria-label="排序" className="border border-neutral-300 bg-white px-2 py-1.5 text-xs">
                <option value="featured">推荐顺序</option>
                <option value="priceAsc">价格从低到高</option>
                <option value="priceDesc">价格从高到低</option>
                <option value="stock">库存优先</option>
              </select>
            </div>
          )}
        />
        <div className="mt-4"><AuthNotice data={data} /></div>
        <div className="mt-6 flex gap-8">
          <FilterRail
            categories={data.categories}
            materials={data.materials}
            colors={data.colors}
            sizes={sizes}
            selected={filters}
            onChange={update}
            onReset={reset}
          />
          <div className="min-w-0 flex-1">
            {filtered.length ? (
              <ProductGrid products={filtered} authorized={data.isWholesaleAuthorized} variant="dense" columns={4} onOpen={open} />
            ) : (
              <EmptyBlock
                title="没有符合条件的款式"
                description="试试减少筛选条件或清空搜索。"
                action={<button type="button" onClick={reset} className="border border-neutral-900 px-3 py-2 text-xs font-semibold text-neutral-900">重置筛选</button>}
              />
            )}
          </div>
        </div>
      </div>

      <FilterDrawer
        open={drawer}
        onClose={() => setDrawer(false)}
        categories={data.categories}
        materials={data.materials}
        colors={data.colors}
        sizes={sizes}
        selected={filters}
        onChange={update}
        onReset={reset}
        resultCount={filtered.length}
      />
      {activeProduct ? <ProductDetail data={data} product={activeProduct} mode="spec" onClose={close} /> : null}
    </StoreShell>
  );
};

/* ────────────────────────────── 3. 订货会 Line Sheet ────────────────────────────── */

export const ApparelLineSheetTemplate: React.FC<StorefrontTemplateProps> = ({ data, initialProductId, onProductChange }) => {
  const { filters, update, filtered } = useStorefrontFilters(data.products);
  const { activeProduct, open, close } = useActiveProduct(data.products, initialProductId ?? null, onProductChange);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState('');

  const pickedRows = useMemo(() => data.products.filter(product => (picked[product.id] || 0) > 0), [data.products, picked]);
  const pickedUnits = useMemo(() => Object.values(picked).reduce((sum, value) => sum + value, 0), [picked]);

  const submit = () => {
    if (!pickedUnits) return;
    const items = pickedRows.flatMap(product => {
      const sku = product.skus.find(item => Number(item.stockCentral || 0) > 0) || product.skus[0];
      if (!sku) return [];
      return [{
        productId: product.id,
        styleNo: product.styleNo,
        productName: product.name,
        image: product.images[0] || '',
        sku: sku.sku,
        color: sku.color || '',
        size: sku.size || '',
        quantity: picked[product.id],
        unitPrice: product.unitPrice,
        packSize: product.packSize
      }];
    });
    data.addMultipleToCart(items);
    setNotice(`已提交 ${pickedRows.length} 款 / ${pickedUnits} 件到订货车`);
    setPicked({});
  };

  return (
    <StoreShell
      tone="utility"
      header={(
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4">
          <p className="text-sm font-semibold tracking-tight text-neutral-900">{data.merchant?.name || 'RUDA'}</p>
          <span className="hidden text-xs text-neutral-500 sm:inline">订货会 Line Sheet</span>
          <select value={filters.category} onChange={event => update({ category: event.target.value })} aria-label="系列" className="ml-auto border border-neutral-300 bg-white px-2 py-1.5 text-xs">
            <option value="all">全部系列</option>
            {data.categories.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <span className="flex items-center gap-1 text-xs text-neutral-700"><ShoppingCart className="h-3.5 w-3.5" />{data.cartCount}</span>
        </div>
      )}
      footer={<StoreFooter data={data} note="Line Sheet 数量即时汇总；最终尺码比例由商家确认。" />}
    >
      <div className="mx-auto grid max-w-[1400px] gap-6 px-4 py-6 lg:grid-cols-[1fr_320px]">
        <div>
          <SectionHeading kicker="Line Sheet" title="订货会款式清单" description="按行浏览款号与属性，直接填写件数；右侧实时汇总。" />
          <div className="mt-4"><AuthNotice data={data} /></div>
          <div className="mt-4 hidden grid-cols-[64px_1.4fr_1fr_1fr_auto_140px] gap-3 border-b border-neutral-300 pb-2 text-xs uppercase tracking-[0.14em] text-neutral-500 sm:grid">
            <span>图片</span><span>款号 / 品名</span><span>材质</span><span>颜色</span><span className="text-right">批发价</span><span className="text-right">订量</span>
          </div>
          <div className="mt-1 divide-y divide-neutral-200">
            {filtered.map(product => (
              <div key={product.id} className="grid grid-cols-[56px_1fr_auto] items-center gap-3 py-3 sm:grid-cols-[64px_1.4fr_1fr_1fr_auto_140px]">
                <button type="button" onClick={() => open(product)} aria-label={`查看 ${product.name}`}>
                  <StorefrontImage src={product.images[0]} alt={product.name} ratio="1 / 1" className="w-14" />
                </button>
                <button type="button" onClick={() => open(product)} className="min-w-0 text-left">
                  <span className="block truncate text-xs font-semibold text-neutral-900">{product.name}</span>
                  <span className="block truncate text-xs text-neutral-500">{product.styleNo} · MOQ {product.moq}</span>
                </button>
                <span className="hidden truncate text-xs text-neutral-600 sm:block">{product.material || '—'}</span>
                <span className="hidden truncate text-xs text-neutral-600 sm:block">{product.colors.join(' / ') || '—'}</span>
                <span className="hidden text-right text-xs font-semibold tabular-nums text-neutral-900 sm:block">{priceText(product.unitPrice, data.isWholesaleAuthorized, true)}</span>
                <div className="flex justify-end">
                  <Stepper value={picked[product.id] || 0} onChange={value => setPicked(prev => ({ ...prev, [product.id]: value }))} />
                </div>
              </div>
            ))}
            {!filtered.length ? <EmptyBlock title="该系列暂无款式" description="切换系列后再试。" /> : null}
          </div>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="border border-neutral-300 bg-white p-4">
            <p className="text-sm font-semibold text-neutral-900">订货汇总</p>
            <dl className="mt-3 space-y-1.5 text-xs">
              <div className="flex justify-between"><dt className="text-neutral-500">款式</dt><dd className="tabular-nums text-neutral-900">{pickedRows.length}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">总件数</dt><dd className="tabular-nums text-neutral-900">{pickedUnits}</dd></div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">估算金额</dt>
                <dd className="tabular-nums text-neutral-900">
                  {data.isWholesaleAuthorized
                    ? `€${pickedRows.reduce((sum, product) => sum + product.unitPrice * (picked[product.id] || 0), 0).toFixed(2)}`
                    : '登录可见'}
                </dd>
              </div>
            </dl>
            <button type="button" disabled={!pickedUnits} onClick={submit} className="mt-4 w-full bg-neutral-900 py-2.5 text-xs font-semibold text-white disabled:opacity-40">加入订货车</button>
            <button type="button" onClick={() => setPicked({})} className="mt-2 w-full border border-neutral-300 py-2 text-xs font-semibold text-neutral-700">清空数量</button>
            {notice ? <p className="mt-3 text-xs text-neutral-800">{notice}</p> : null}
            <p className="mt-3 text-xs leading-5 text-neutral-500">订货车与商家后台共用同一份数据，提交后可在结算页确认。</p>
          </div>
        </aside>
      </div>

      {activeProduct ? <ProductDetail data={data} product={activeProduct} mode="order" onClose={close} onSubmitted={setNotice} /> : null}
    </StoreShell>
  );
};

export const APPAREL_WHOLESALE_TEMPLATES = {
  apparel_lookbook: ApparelLookbookTemplate,
  apparel_collection: ApparelCollectionTemplate,
  apparel_line_sheet: ApparelLineSheetTemplate
} as const;

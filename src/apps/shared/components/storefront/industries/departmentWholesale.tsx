/**
 * 百货批发商（department_wholesale）三套结构型模板。
 *
 * 行业业务：多品类大规模供货给零售终端，核心是「类目导航 → 快速定位 → 批量补货」。
 * 三套结构差异：
 * - department_mega：超大类目（全类目面板 + 每类纵向板块 + 5 列密度）
 * - department_floors：楼层式（楼层标签 + 每楼层品类区块 + 4 列交易卡）
 * - department_reorder：批量补货台（表格 + 一键加箱 + 底部汇总）
 */
import React, { useMemo, useState } from 'react';
import { Boxes, Check, Layers, Plus } from 'lucide-react';
import { AuthNotice, EmptyBlock, MetricRow, SectionHeading, StoreFooter, StoreShell, Tag } from '../kit/shell';
import { FloorNav, MegaNav } from '../kit/nav';
import { ProductCard, ProductGrid } from '../kit/product';
import { ProductDetail, quickAddToCart } from '../kit/detail';
import { useActiveProduct, useStorefrontFilters, type StorefrontTemplateProps } from '../kit/filters';
import { StorefrontImage, formatStock, priceText } from '../primitives';

/* ─────────────────────── 1. 超大类目 ─────────────────────── */

export const DepartmentMegaTemplate: React.FC<StorefrontTemplateProps> = ({ data, initialProductId, onProductChange }) => {
  const { filters, update, query, setQuery, filtered } = useStorefrontFilters(data.products);
  const { activeProduct, open, close } = useActiveProduct(data.products, initialProductId ?? null, onProductChange);
  const [notice, setNotice] = useState('');

  const blocks = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    filtered.forEach(product => {
      const key = product.category || '其他';
      map.set(key, [...(map.get(key) || []), product]);
    });
    return Array.from(map, ([label, items]) => ({ label, items })).sort((a, b) => b.items.length - a.items.length);
  }, [filtered]);

  return (
    <StoreShell
      tone="department"
      header={<MegaNav name={data.merchant?.name || 'RUDA'} categories={data.categories} category={filters.category} onCategory={value => update({ category: value })} query={query} onQuery={setQuery} />}
      footer={<StoreFooter data={data} note="百货批发以整箱补货为主，混装比例与商家确认。" />}
    >
      <section className="border-b border-neutral-200 bg-neutral-100">
        <div className="mx-auto grid max-w-[1400px] gap-6 px-5 py-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-neutral-500">Department Wholesale</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
              {data.merchant?.name || 'RUDA'} · 全品类批发
            </h1>
            <p className="mt-2 max-w-2xl text-xs leading-6 text-neutral-600">{data.brandStory || `覆盖 ${data.categories.length} 个品类、${data.products.length} 个款式，支持整箱补货与混装。`}</p>
          </div>
          <div className="lg:w-[520px]">
            <MetricRow items={[
              { label: '品类', value: String(data.categories.length) },
              { label: '款式', value: String(data.products.length) },
              { label: '库存', value: String(data.products.reduce((sum, product) => sum + product.availableStock, 0)) },
              { label: '箱规', value: data.products[0] ? `${data.products[0].packSize} 件` : '—' }
            ]} />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1400px] px-5 py-6">
        <div><AuthNotice data={data} /></div>
        {notice ? <p className="mt-3 flex items-center gap-1.5 text-xs text-neutral-800"><Check className="h-3.5 w-3.5" />{notice}</p> : null}

        <div className="mt-8 space-y-10">
          {blocks.map(block => (
            <section key={block.label}>
              <div className="flex items-end justify-between gap-3 border-b-2 border-neutral-900 pb-2">
                <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-neutral-900">
                  <Layers className="h-4 w-4" />{block.label}
                </h2>
                <div className="flex items-center gap-3 text-xs text-neutral-500">
                  <span>{block.items.length} 款</span>
                  <button type="button" onClick={() => update({ category: block.label })} className="font-semibold text-neutral-900 underline underline-offset-4">查看该类</button>
                </div>
              </div>
              <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
                {block.items.slice(0, 8).map(product => (
                  <div key={product.id} className="w-40 shrink-0 sm:w-44">
                    <ProductCard
                      product={product}
                      authorized={data.isWholesaleAuthorized}
                      variant="dense"
                      onOpen={open}
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}
          {!blocks.length ? <EmptyBlock title="没有匹配的商品" description="调整筛选或搜索词。" /> : null}
        </div>
      </div>

      {activeProduct ? <ProductDetail data={data} product={activeProduct} mode="order" onClose={close} onSubmitted={setNotice} /> : null}
    </StoreShell>
  );
};

/* ─────────────────────── 2. 楼层式 ─────────────────────── */

export const DepartmentFloorsTemplate: React.FC<StorefrontTemplateProps> = ({ data, initialProductId, onProductChange }) => {
  const { filters, update, filtered } = useStorefrontFilters(data.products);
  const { activeProduct, open, close } = useActiveProduct(data.products, initialProductId ?? null, onProductChange);
  const [floor, setFloor] = useState('全部楼层');
  const [notice, setNotice] = useState('');

  const floors = useMemo(() => ['全部楼层', ...data.categories.map(item => item.label)], [data.categories]);
  const floorCategories = useMemo(() => new Set(data.categories.filter(item => floor === '全部楼层' || item.label === floor).map(item => item.value)), [data.categories, floor]);
  const rows = useMemo(() => filtered.filter(product => floorCategories.has(product.category)), [filtered, floorCategories]);

  return (
    <StoreShell
      tone="department"
      header={(
        <FloorNav
          name={data.merchant?.name || 'RUDA'}
          floors={floors}
          floor={floor}
          onFloor={setFloor}
          categories={data.categories}
          category={filters.category}
          onCategory={value => update({ category: value })}
          cartCount={data.cartCount}
        />
      )}
      footer={<StoreFooter data={data} note="楼层式陈列按品类分区；价格与库存实时来自商家数据。" />}
    >
      <div className="mx-auto max-w-[1400px] px-5 py-6">
        <SectionHeading
          kicker={floor}
          title="楼层品类"
          description={`${rows.length} 款 · 按品类分区陈列，可直接加订`}
          action={<Tag tone="muted">箱规 {data.products[0]?.packSize || '—'} 件</Tag>}
        />
        <div className="mt-4"><AuthNotice data={data} /></div>
        <div className="mt-6">
          {rows.length ? (
            <ProductGrid
              products={rows}
              authorized={data.isWholesaleAuthorized}
              variant="trade"
              columns={4}
              onOpen={open}
              onQuickAdd={product => setNotice(quickAddToCart(data, product))}
            />
          ) : <EmptyBlock title="该楼层暂无商品" description="切换楼层或品类。" />}
        </div>
        {notice ? <p className="mt-4 flex items-center gap-1.5 text-xs text-neutral-800"><Check className="h-3.5 w-3.5" />{notice}</p> : null}
      </div>
      {activeProduct ? <ProductDetail data={data} product={activeProduct} mode="order" onClose={close} onSubmitted={setNotice} /> : null}
    </StoreShell>
  );
};

/* ─────────────────────── 3. 批量补货台 ─────────────────────── */

export const DepartmentReorderTemplate: React.FC<StorefrontTemplateProps> = ({ data, initialProductId, onProductChange }) => {
  const { filters, update, query, setQuery, filtered } = useStorefrontFilters(data.products);
  const { activeProduct, open, close } = useActiveProduct(data.products, initialProductId ?? null, onProductChange);
  const [boxes, setBoxes] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState('');

  const lines = useMemo(() => data.products.filter(product => (boxes[product.id] || 0) > 0), [data.products, boxes]);
  const totalUnits = useMemo(() => lines.reduce((sum, product) => sum + (boxes[product.id] || 0) * product.packSize, 0), [lines, boxes]);

  const submit = () => {
    if (!lines.length) return;
    data.addMultipleToCart(lines.flatMap(product => {
      const sku = product.skus.find(item => Number(item.stockCentral || 0) > 0) || product.skus[0];
      if (!sku) return [];
      return [{
        productId: product.id, styleNo: product.styleNo, productName: product.name, image: product.images[0] || '',
        sku: sku.sku, color: sku.color || '', size: sku.size || '',
        quantity: (boxes[product.id] || 0) * product.packSize,
        unitPrice: product.unitPrice, packSize: product.packSize
      }];
    }));
    setNotice(`已按整箱补货：${lines.length} 款 / ${totalUnits} 件`);
    setBoxes({});
  };

  return (
    <StoreShell
      tone="department"
      header={(
        <div className="mx-auto max-w-[1400px] px-4">
          <div className="flex h-14 items-center gap-3">
            <p className="text-sm font-semibold tracking-tight text-neutral-900">{data.merchant?.name || 'RUDA'}</p>
            <span className="hidden items-center gap-1.5 text-xs text-neutral-500 sm:flex"><Boxes className="h-3.5 w-3.5" />批量补货台</span>
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索款号 / 品名" className="ml-auto h-9 w-36 border border-neutral-300 px-2 text-xs outline-none focus:border-neutral-900 sm:w-56" />
            <select value={filters.category} onChange={event => update({ category: event.target.value })} aria-label="分类" className="h-9 border border-neutral-300 bg-white px-2 text-xs">
              <option value="all">全部分类</option>
              {data.categories.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
        </div>
      )}
      footer={<StoreFooter data={data} note="补货以整箱为单位，混装按商家规则执行。" />}
    >
      <div className="mx-auto max-w-[1400px] px-4 py-6 pb-28 lg:pb-6">
        <SectionHeading kicker="Reorder" title="按箱补货" description="填写箱数即可按箱规换算件数，实时汇总后一次加入订货车。" />
        <div className="mt-4"><AuthNotice data={data} /></div>
        <div className="mt-5 overflow-x-auto border border-neutral-200">
          <table className="w-full text-xs">
            <thead className="bg-neutral-50 text-neutral-500">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">商品</th>
                <th className="hidden px-3 py-2 text-left font-semibold sm:table-cell">分类</th>
                <th className="hidden px-3 py-2 text-left font-semibold sm:table-cell">箱规</th>
                <th className="hidden px-3 py-2 text-left font-semibold sm:table-cell">库存</th>
                <th className="px-3 py-2 text-right font-semibold">单价</th>
                <th className="px-3 py-2 text-right font-semibold">箱数</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filtered.map(product => (
                <tr key={product.id}>
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => open(product)} className="flex items-center gap-2 text-left">
                      <StorefrontImage src={product.images[0]} alt={product.name} ratio="1 / 1" className="w-10" />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-neutral-900">{product.name}</span>
                        <span className="block truncate text-neutral-500">{product.styleNo} · MOQ {product.moq}</span>
                      </span>
                    </button>
                  </td>
                  <td className="hidden px-3 py-2 text-neutral-600 sm:table-cell">{product.category}</td>
                  <td className="hidden px-3 py-2 text-neutral-600 sm:table-cell">{product.packSize} 件</td>
                  <td className="hidden px-3 py-2 text-neutral-600 sm:table-cell">{formatStock(product.availableStock)}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-neutral-900">{priceText(product.unitPrice, data.isWholesaleAuthorized, true)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <input
                        value={boxes[product.id] || ''}
                        onChange={event => setBoxes(prev => ({ ...prev, [product.id]: Math.max(0, Number(event.target.value.replace(/\D/g, '')) || 0) }))}
                        inputMode="numeric"
                        aria-label={`${product.name} 箱数`}
                        className="w-12 border border-neutral-300 px-1 py-1 text-center tabular-nums outline-none focus:border-neutral-900"
                      />
                      <button
                        type="button"
                        onClick={() => setBoxes(prev => ({ ...prev, [product.id]: (prev[product.id] || 0) + 1 }))}
                        className="border border-neutral-300 p-1 text-neutral-600 hover:border-neutral-900"
                        aria-label="加一箱"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length ? <div className="px-3 py-10 text-center text-neutral-500">没有匹配的商品</div> : null}
        </div>
        {notice ? <p className="mt-3 flex items-center gap-1.5 text-xs text-neutral-800"><Check className="h-3.5 w-3.5" />{notice}</p> : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur lg:static lg:mx-auto lg:mt-4 lg:max-w-[1400px] lg:border-0 lg:bg-transparent lg:px-4">
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-600">已选 {lines.length} 款 · <b className="tabular-nums text-neutral-900">{totalUnits}</b> 件</span>
          <button type="button" disabled={!lines.length} onClick={submit} className="ml-auto bg-neutral-900 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40">
            加入订货车
          </button>
        </div>
      </div>

      {activeProduct ? <ProductDetail data={data} product={activeProduct} mode="order" onClose={close} onSubmitted={setNotice} /> : null}
    </StoreShell>
  );
};

export const DEPARTMENT_WHOLESALE_TEMPLATES = {
  department_mega: DepartmentMegaTemplate,
  department_floors: DepartmentFloorsTemplate,
  department_reorder: DepartmentReorderTemplate
} as const;

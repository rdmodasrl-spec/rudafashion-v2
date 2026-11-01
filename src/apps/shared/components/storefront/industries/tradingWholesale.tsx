/**
 * 贸易批发商（trading_wholesale）三套结构型模板。
 *
 * 行业业务：跨境与国内贸易撮合，核心是「规格合规 → 报价 → 装箱与交期」。
 * 三套结构差异：
 * - trading_export：出口目录（贸易条款条 + 规格行表格 + 装箱/MOQ 列）
 * - trading_sourcing：采购代理台（左侧目录 + 右侧采购清单 → 一次询盘）
 * - trading_program：常年供应计划（按品类的供应能力卡 + 计划询价）
 */
import React, { useMemo, useState } from 'react';
import { ArrowRight, Check, ClipboardList, Globe2, Package, Trash2 } from 'lucide-react';
import { AuthNotice, EmptyBlock, MetricRow, SectionHeading, StoreFooter, StoreShell, Tag } from '../kit/shell';
import { UtilityNav } from '../kit/nav';
import { ProductCard, ProductGrid } from '../kit/product';
import { ProductDetail } from '../kit/detail';
import { useActiveProduct, useStorefrontFilters, type StorefrontTemplateProps } from '../kit/filters';
import { StorefrontImage, formatStock, priceText } from '../primitives';

/* ─────────────────────── 1. 出口目录 ─────────────────────── */

export const TradingExportTemplate: React.FC<StorefrontTemplateProps> = ({ data, initialProductId, onProductChange }) => {
  const { filters, update, query, setQuery, filtered, sort, setSort } = useStorefrontFilters(data.products);
  const { activeProduct, open, close } = useActiveProduct(data.products, initialProductId ?? null, onProductChange);

  return (
    <StoreShell
      tone="utility"
      header={(
        <>
          <div className="border-b border-neutral-200 bg-neutral-900 text-neutral-300">
            <div className="mx-auto flex max-w-[1400px] items-center gap-4 overflow-x-auto px-4 py-1.5 text-xs">
              <span className="flex shrink-0 items-center gap-1.5"><Globe2 className="h-3 w-3" />出口目录</span>
              <span className="shrink-0 text-neutral-500">贸易条款：FOB / CIF 按商家报价确认</span>
              <span className="shrink-0 text-neutral-500">装箱与毛重以装箱单为准</span>
              <span className="ml-auto hidden shrink-0 text-neutral-500 sm:inline">{data.contact.city || ''}</span>
            </div>
          </div>
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
        </>
      )}
      footer={<StoreFooter data={data} note="报价不含运费与关税；以正式报价单为准。" />}
    >
      <div className="mx-auto max-w-[1400px] px-4 py-6">
        <SectionHeading
          kicker="Export Catalogue"
          title="出口产品目录"
          description={`${filtered.length} / ${data.products.length} 款 · 规格、装箱与起订量一览`}
          action={(
            <select value={sort} onChange={event => setSort(event.target.value as typeof sort)} aria-label="排序" className="border border-neutral-300 bg-white px-2 py-1.5 text-xs">
              <option value="featured">默认</option>
              <option value="priceAsc">价格升序</option>
              <option value="stock">库存优先</option>
            </select>
          )}
        />
        <div className="mt-4"><AuthNotice data={data} /></div>
        <div className="mt-6 hidden grid-cols-[64px_1.6fr_1fr_0.8fr_0.7fr_auto] gap-3 border-b border-neutral-300 pb-2 text-xs uppercase tracking-[0.14em] text-neutral-500 sm:grid">
          <span>图片</span><span>款号 / 品名</span><span>材质</span><span>产地</span><span>装箱</span><span className="text-right">价格</span>
        </div>
        <div className="divide-y divide-neutral-200">
          {filtered.map(product => (
            <button
              key={product.id}
              type="button"
              onClick={() => open(product)}
              className="grid w-full grid-cols-[56px_1fr_auto] items-center gap-3 py-3 text-left transition-colors hover:bg-neutral-50 sm:grid-cols-[64px_1.6fr_1fr_0.8fr_0.7fr_auto]"
            >
              <StorefrontImage src={product.images[0]} alt={product.name} ratio="1 / 1" className="w-14" />
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-neutral-900">{product.name}</span>
                <span className="block truncate text-xs text-neutral-500">{product.styleNo} · MOQ {product.moq} · {formatStock(product.availableStock)}</span>
              </span>
              <span className="hidden truncate text-xs text-neutral-600 sm:block">{product.material || '—'}</span>
              <span className="hidden truncate text-xs text-neutral-600 sm:block">{product.origin || '—'}</span>
              <span className="hidden truncate text-xs text-neutral-600 sm:block">{product.packSize} 件/箱</span>
              <span className="text-right text-xs font-semibold tabular-nums text-neutral-900">{priceText(product.unitPrice, data.isWholesaleAuthorized, true)}</span>
            </button>
          ))}
          {!filtered.length ? <div className="py-10 text-center text-xs text-neutral-500">没有匹配的款式</div> : null}
        </div>
      </div>
      {activeProduct ? <ProductDetail data={data} product={activeProduct} mode="spec" onClose={close} /> : null}
    </StoreShell>
  );
};

/* ─────────────────────── 2. 采购代理台 ─────────────────────── */

export const TradingSourcingTemplate: React.FC<StorefrontTemplateProps> = ({ data, initialProductId, onProductChange }) => {
  const { filters, update, query, setQuery, filtered, activeCount, reset } = useStorefrontFilters(data.products);
  const { activeProduct, open, close } = useActiveProduct(data.products, initialProductId ?? null, onProductChange);
  const [list, setList] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const listed = useMemo(() => data.products.filter(product => list.includes(product.id)), [data.products, list]);
  const toggle = (id: string) => setList(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);

  const submit = async () => {
    setBusy(true);
    const result = await data.createBuyerRfq({
      title: `采购询盘（${listed.length} 款）`,
      description: note || `采购清单询盘，共 ${listed.length} 款`,
      category: listed[0]?.category || '',
      targetQuantity: listed.reduce((sum, product) => sum + product.moq, 0),
      targetPrice: 0,
      targetCurrency: 'EUR',
      deadlineAt: new Date(Date.now() + 14 * 86400000).toISOString(),
      preferredCountries: [],
      productIds: listed.map(product => product.id),
      merchantId: data.merchant?.id,
      remarks: note
    });
    setBusy(false);
    setMessage(result.ok
      ? `询盘已提交，单号 ${result.rfqNo}。商家在后台可见。`
      : (data.authRole === 'buyer' ? (result.error || '提交失败，请稍后重试。') : '请先登录采购账号后再提交询盘。'));
    if (result.ok) { setList([]); setNote(''); }
  };

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
      footer={<StoreFooter data={data} note="代理采购报价含服务口径时由商家说明。" />}
    >
      <div className="mx-auto grid max-w-[1400px] gap-6 px-4 py-6 lg:grid-cols-[1fr_360px]">
        <div>
          <SectionHeading
            kicker="Sourcing Desk"
            title="采购代理台"
            description="勾选需要报价的款式，生成一份询盘；商家按清单统一回复。"
            action={activeCount > 0 ? <button type="button" onClick={reset} className="text-xs text-neutral-500 underline underline-offset-2">重置筛选</button> : undefined}
          />
          <div className="mt-4"><AuthNotice data={data} /></div>
          <div className="mt-5">
            {filtered.length ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {filtered.map(product => (
                  <div key={product.id} className="relative">
                    <ProductCard product={product} authorized={data.isWholesaleAuthorized} variant="dense" onOpen={open} />
                    <button
                      type="button"
                      onClick={() => toggle(product.id)}
                      aria-pressed={list.includes(product.id)}
                      className={`absolute right-2 top-2 border px-2 py-1 text-xs font-semibold ${list.includes(product.id) ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 bg-white/95 text-neutral-800'}`}
                    >
                      {list.includes(product.id) ? '已加入' : '加入清单'}
                    </button>
                  </div>
                ))}
              </div>
            ) : <EmptyBlock title="没有匹配的款式" description="调整筛选或搜索词。" />}
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="border border-neutral-300 bg-white">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900"><ClipboardList className="h-4 w-4" />采购清单（{listed.length}）</p>
              {listed.length ? <button type="button" onClick={() => setList([])} className="text-xs text-neutral-500">清空</button> : null}
            </div>
            <ul className="max-h-72 divide-y divide-neutral-100 overflow-y-auto">
              {listed.map(product => (
                <li key={product.id} className="flex items-center gap-2 px-4 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-neutral-900">{product.name}</span>
                    <span className="block truncate text-xs text-neutral-500">{product.styleNo} · MOQ {product.moq}</span>
                  </span>
                  <button type="button" onClick={() => toggle(product.id)} aria-label="移除" className="text-neutral-400 hover:text-neutral-900"><Trash2 className="h-3.5 w-3.5" /></button>
                </li>
              ))}
              {!listed.length ? <li className="px-4 py-6 text-center text-xs text-neutral-500">清单为空，先从左侧选择款式。</li> : null}
            </ul>
            <div className="border-t border-neutral-200 p-4">
              <textarea rows={3} value={note} onChange={event => setNote(event.target.value)} placeholder="目标市场、数量、认证要求" className="w-full border border-neutral-300 px-3 py-2 text-xs outline-none focus:border-neutral-900" />
              <button type="button" disabled={!listed.length || busy} onClick={() => void submit()} className="mt-3 w-full bg-neutral-900 py-2.5 text-xs font-semibold text-white disabled:opacity-40">
                {busy ? '提交中…' : '提交询盘'}
              </button>
              {message ? <p className="mt-2 flex items-start gap-1.5 text-xs text-neutral-800"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />{message}</p> : null}
            </div>
          </div>
        </aside>
      </div>
      {activeProduct ? <ProductDetail data={data} product={activeProduct} mode="spec" onClose={close} /> : null}
    </StoreShell>
  );
};

/* ─────────────────────── 3. 常年供应计划 ─────────────────────── */

export const TradingProgramTemplate: React.FC<StorefrontTemplateProps> = ({ data, initialProductId, onProductChange }) => {
  const { activeProduct, open, close } = useActiveProduct(data.products, initialProductId ?? null, onProductChange);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [note, setNote] = useState('');

  const programs = useMemo(() => {
    const map = new Map<string, typeof data.products>();
    data.products.forEach(product => {
      const key = product.category || '其他';
      map.set(key, [...(map.get(key) || []), product]);
    });
    return Array.from(map, ([label, items]) => ({
      label,
      items,
      units: items.reduce((sum, product) => sum + product.availableStock, 0),
      moq: Math.min(...items.map(product => product.moq))
    })).sort((a, b) => b.items.length - a.items.length);
  }, [data.products]);

  const inquire = async (label: string) => {
    setBusy(true);
    const items = programs.find(program => program.label === label)?.items || [];
    const result = await data.createBuyerRfq({
      title: `${label} 常年供应询价`,
      description: note || `${label} 品类常年供应计划`,
      category: label,
      targetQuantity: items.reduce((sum, product) => sum + product.moq, 0),
      targetPrice: 0,
      targetCurrency: 'EUR',
      deadlineAt: new Date(Date.now() + 30 * 86400000).toISOString(),
      preferredCountries: [],
      productIds: items.slice(0, 5).map(product => product.id),
      merchantId: data.merchant?.id,
      remarks: note
    });
    setBusy(false);
    setMessage(result.ok
      ? `${label} 询价已提交（单号 ${result.rfqNo}）。`
      : (data.authRole === 'buyer' ? (result.error || '提交失败，请稍后重试。') : '请先登录采购账号后再询价。'));
  };

  return (
    <StoreShell
      tone="utility"
      header={(
        <div className="mx-auto max-w-[1400px] px-4">
          <div className="flex h-16 items-center gap-4">
            <p className="text-sm font-semibold tracking-tight text-neutral-900">{data.merchant?.name || 'RUDA'}</p>
            <span className="hidden text-xs text-neutral-500 sm:inline">常年供应计划</span>
            <a href="#programs" className="ml-auto inline-flex items-center gap-1.5 border border-neutral-900 px-3 py-1.5 text-xs font-semibold text-neutral-900">
              品类计划 <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      )}
      footer={<StoreFooter data={data} note="常年供应计划按季度复核价格与产能。" />}
    >
      <section className="border-b border-neutral-200 bg-neutral-100">
        <div className="mx-auto grid max-w-[1400px] gap-8 px-5 py-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-neutral-500">Supply Program</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-900">按品类建立长期供应</h1>
            <p className="mt-4 max-w-xl text-xs leading-6 text-neutral-600">
              以品类为单位锁定供应能力：稳定补货、统一规格、按季度复核价格。{data.brandStory ? ` ${data.brandStory}` : ''}
            </p>
            <div className="mt-6">
              <MetricRow items={[
                { label: '供应品类', value: String(programs.length) },
                { label: '在供款式', value: String(data.products.length) },
                { label: '可用库存', value: String(data.products.reduce((sum, product) => sum + product.availableStock, 0)) },
                { label: '最小起订', value: programs[0] ? `${Math.min(...programs.map(program => program.moq))} 件` : '—' }
              ]} />
            </div>
          </div>
          <div className="border border-neutral-300 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">计划询价</p>
            <textarea rows={4} value={note} onChange={event => setNote(event.target.value)} placeholder="目标品类、年度数量、交付节奏" className="mt-2 w-full border border-neutral-300 px-3 py-2 text-xs outline-none focus:border-neutral-900" />
            <p className="mt-2 text-xs text-neutral-500">选择下方任一品类即可提交对应计划询价。</p>
            {message ? <p className="mt-2 text-xs text-neutral-800">{message}</p> : null}
          </div>
        </div>
      </section>

      <section id="programs" className="mx-auto max-w-[1400px] px-5 py-12">
        <SectionHeading kicker="Categories" title="品类供应能力" description="点击品类查看款式，或直接提交该品类的供应计划询价。" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map(program => (
            <article key={program.label} className="border border-neutral-200 bg-white">
              <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900"><Package className="h-4 w-4" />{program.label}</p>
                <Tag tone="muted">{program.items.length} 款</Tag>
              </div>
              <div className="grid grid-cols-3 gap-1 p-2">
                {program.items.slice(0, 3).map(product => (
                  <button key={product.id} type="button" onClick={() => open(product)} aria-label={product.name}>
                    <StorefrontImage src={product.images[0]} alt={product.name} ratio="1 / 1" />
                  </button>
                ))}
              </div>
              <dl className="grid grid-cols-2 gap-2 px-4 py-2 text-xs">
                <div><dt className="text-neutral-500">可用</dt><dd className="tabular-nums text-neutral-900">{program.units} 件</dd></div>
                <div><dt className="text-neutral-500">起订</dt><dd className="tabular-nums text-neutral-900">{program.moq} 件</dd></div>
              </dl>
              <button type="button" disabled={busy} onClick={() => void inquire(program.label)} className="w-full border-t border-neutral-200 py-2.5 text-xs font-semibold text-neutral-900 transition-colors hover:bg-neutral-50 disabled:opacity-50">
                询价该品类
              </button>
            </article>
          ))}
          {!programs.length ? <div className="sm:col-span-2 lg:col-span-3"><EmptyBlock title="暂无供应品类" description="商家发布商品后会按品类汇总。" /></div> : null}
        </div>
      </section>

      {data.products.length ? (
        <section className="mx-auto max-w-[1400px] px-5 pb-12">
          <SectionHeading kicker="All styles" title="全部在供款式" />
          <div className="mt-6"><ProductGrid products={data.products} authorized={data.isWholesaleAuthorized} variant="dense" columns={4} onOpen={open} /></div>
        </section>
      ) : null}

      {activeProduct ? <ProductDetail data={data} product={activeProduct} mode="spec" onClose={close} /> : null}
    </StoreShell>
  );
};

export const TRADING_WHOLESALE_TEMPLATES = {
  trading_export: TradingExportTemplate,
  trading_sourcing: TradingSourcingTemplate,
  trading_program: TradingProgramTemplate
} as const;

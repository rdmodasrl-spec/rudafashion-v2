/**
 * 服装生产批发商（apparel_production_wholesale）三套结构型模板。
 *
 * 行业业务：自有产能接单生产 / 贴牌代工，核心是「产能与工艺能力 → 打样 → 量产」。
 * 三套结构差异：
 * - apparel_capability：深色工厂能力页（指标 + 工艺关卡 + 可代工款式），询价前置
 * - apparel_schedule：产能排期表（按品类的在产款数与订量汇总），表格式浏览
 * - apparel_private_label：贴牌定制（四步流程 + 样板库 + 打样申请），流程导向
 */
import React, { useMemo, useState } from 'react';
import { Check, ClipboardList, Factory, Layers, Ruler, Scissors } from 'lucide-react';
import { EmptyBlock, MetricRow, SectionHeading, StoreFooter, StoreShell, Tag } from '../kit/shell';
import { FactoryNav, UtilityNav } from '../kit/nav';
import { ProductGrid } from '../kit/product';
import { ProductDetail, Stepper } from '../kit/detail';
import { useActiveProduct, useStorefrontFilters, type StorefrontTemplateProps } from '../kit/filters';
import { StorefrontImage, priceText } from '../primitives';

const STEPS = [
  { key: 'brief', title: '需求与技术包', detail: '款型、面料、尺码表、目标价与交期', icon: ClipboardList },
  { key: 'sample', title: '打样确认', detail: '首样、尺寸复核、色卡确认后再投产', icon: Ruler },
  { key: 'bulk', title: '量产', detail: '按确认样生产，分阶段质检', icon: Factory },
  { key: 'delivery', title: '验货交付', detail: '尾期验货、装箱单与物流交接', icon: Layers }
];

/* ─────────────────────── 1. 工厂能力 ─────────────────────── */

export const ProductionCapabilityTemplate: React.FC<StorefrontTemplateProps> = ({ data, initialProductId, onProductChange }) => {
  const [rfqOpen, setRfqOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const { activeProduct, open, close } = useActiveProduct(data.products, initialProductId ?? null, onProductChange);

  const submit = async (productId?: string) => {
    setBusy(true);
    const target = productId ? data.products.find(product => product.id === productId) : data.products[0];
    const result = await data.createBuyerRfq({
      title: target ? `${target.styleNo} 生产询价` : '生产合作询价',
      description: note || '生产 / 代工能力询价',
      category: target?.category || '',
      targetQuantity: target?.moq || 100,
      targetPrice: target?.unitPrice || 0,
      targetCurrency: 'EUR',
      deadlineAt: new Date(Date.now() + 21 * 86400000).toISOString(),
      preferredCountries: [],
      productIds: target ? [target.id] : [],
      merchantId: data.merchant?.id,
      remarks: note
    });
    setBusy(false);
    setMessage(result.ok
      ? `询价已提交，单号 ${result.rfqNo}。商家在后台「询价」中可见。`
      : (data.authRole === 'buyer' ? (result.error || '提交失败，请稍后重试。') : '请先登录采购账号后再询价。'));
    if (result.ok) { setRfqOpen(false); setNote(''); }
  };

  const capacities = useMemo(() => {
    const byCategory = new Map<string, number>();
    data.products.forEach(product => byCategory.set(product.category || '其他', (byCategory.get(product.category || '其他') || 0) + 1));
    return Array.from(byCategory, ([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [data.products]);

  return (
    <StoreShell
      tone="factory"
      header={<FactoryNav name={data.merchant?.name || 'RUDA'} onInquiry={() => setRfqOpen(true)} />}
      footer={<StoreFooter data={data} tone="factory" note="产能与交期按实际排产确认，不承诺固定交期。" />}
    >
      <section id="产能" className="mx-auto max-w-[1400px] px-5 py-14">
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Production Partner</p>
        <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">
          {data.merchant?.tagline_zh || data.merchant?.tagline || '自有产能 · 承接成衣生产与贴牌代工'}
        </h1>
        <p className="mt-4 max-w-2xl text-xs leading-6 text-neutral-400">
          {data.brandStory || `${data.products.length} 款在产款式，覆盖 ${data.categories.length} 个品类。提供打样、量产与验货交付。`}
        </p>
        <div className="mt-8 border border-neutral-800 px-4 py-2">
          <MetricRow dark items={[
            { label: '在产款式', value: String(data.products.length) },
            { label: '品类', value: String(data.categories.length) },
            { label: '最小起订', value: data.products[0] ? `${data.products[0].moq} 件` : '面议' },
            { label: '装箱规格', value: data.products[0] ? `${data.products[0].packSize} 件/箱` : '—' }
          ]} />
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" onClick={() => setRfqOpen(true)} className="bg-white px-4 py-2.5 text-xs font-semibold text-neutral-950 transition-colors hover:bg-neutral-200">
            发起生产询价
          </button>
          <a href="#款式" className="border border-neutral-700 px-4 py-2.5 text-xs font-semibold text-neutral-200 transition-colors hover:border-neutral-400">查看可代工款式</a>
        </div>
        {message ? <p className="mt-4 text-xs text-neutral-300">{message}</p> : null}
      </section>

      <section id="工艺" className="border-t border-neutral-800">
        <div className="mx-auto max-w-[1400px] px-5 py-12">
          <SectionHeading kicker="Capability" title="工艺与产能" description="按品类的在产款式分布；具体工序与设备以商家确认为准。" dark />
          <div className="mt-6 grid gap-px bg-neutral-800 sm:grid-cols-2 lg:grid-cols-5">
            {capacities.map(item => (
              <div key={item.label} className="bg-neutral-950 px-4 py-5">
                <p className="text-xs uppercase tracking-[0.14em] text-neutral-500">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-white">{item.count}</p>
                <p className="mt-1 text-xs text-neutral-500">款在产</p>
              </div>
            ))}
            {!capacities.length ? <div className="bg-neutral-950 px-4 py-5 text-xs text-neutral-500">暂无在产款式数据</div> : null}
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <div key={step.key} className="border border-neutral-800 p-4">
                <div className="flex items-center gap-2 text-neutral-400">
                  <step.icon className="h-3.5 w-3.5" />
                  <span className="text-xs uppercase tracking-[0.14em]">0{index + 1}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-white">{step.title}</p>
                <p className="mt-1 text-xs leading-5 text-neutral-500">{step.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="款式" className="bg-neutral-100">
        <div className="mx-auto max-w-[1400px] px-5 py-12">
          <SectionHeading
            kicker="Styles"
            title="可代工款式"
            description="以下款式可按现有工艺生产，也可按你的技术包调整面料与配色。"
            action={<span className="text-xs text-neutral-500">价格 {priceText(data.products[0]?.unitPrice ?? 0, data.isWholesaleAuthorized, true)}</span>}
          />
          <div className="mt-6">
            {data.products.length
              ? <ProductGrid products={data.products} authorized={data.isWholesaleAuthorized} variant="trade" columns={4} onOpen={open} onQuickAdd={product => void submit(product.id)} />
              : <EmptyBlock title="暂无可代工款式" description="商家发布商品后会显示在这里。" />}
          </div>
        </div>
      </section>

      {activeProduct ? <ProductDetail data={data} product={activeProduct} mode="spec" onClose={close} /> : null}

      {rfqOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-neutral-900/60 p-4">
          <div className="w-full max-w-md bg-white p-5">
            <h2 className="text-base font-semibold text-neutral-900">生产 / 打样询价</h2>
            <p className="mt-1 text-xs leading-5 text-neutral-500">写入商家询价记录，商家在后台查看并回复。</p>
            <label htmlFor="factory-note" className="mt-4 block text-xs font-semibold text-neutral-800">需求说明</label>
            <textarea id="factory-note" rows={4} value={note} onChange={event => setNote(event.target.value)} placeholder="品类、数量、面料、目标交期" className="mt-1 w-full border border-neutral-300 px-3 py-2 text-xs outline-none focus:border-neutral-900" />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setRfqOpen(false)} className="border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700">取消</button>
              <button type="button" disabled={busy} onClick={() => void submit()} className="bg-neutral-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy ? '提交中…' : '提交询价'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </StoreShell>
  );
};

/* ─────────────────────── 2. 产能排期 ─────────────────────── */

export const ProductionScheduleTemplate: React.FC<StorefrontTemplateProps> = ({ data, initialProductId, onProductChange }) => {
  const { filters, update, query, setQuery, filtered, sort, setSort } = useStorefrontFilters(data.products);
  const { activeProduct, open, close } = useActiveProduct(data.products, initialProductId ?? null, onProductChange);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState('');

  const groups = useMemo(() => {
    const map = new Map<string, { count: number; units: number; moq: number; styles: typeof filtered }>();
    filtered.forEach(product => {
      const key = product.category || '其他';
      const current = map.get(key) || { count: 0, units: 0, moq: product.moq, styles: [] };
      map.set(key, {
        count: current.count + 1,
        units: current.units + product.availableStock,
        moq: Math.min(current.moq, product.moq),
        styles: [...current.styles, product]
      });
    });
    return Array.from(map, ([label, value]) => ({ label, ...value })).sort((a, b) => b.count - a.count);
  }, [filtered]);

  const submit = () => {
    const rows = filtered.filter(product => (picked[product.id] || 0) > 0);
    if (!rows.length) return;
    data.addMultipleToCart(rows.flatMap(product => {
      const sku = product.skus.find(item => Number(item.stockCentral || 0) > 0) || product.skus[0];
      if (!sku) return [];
      return [{
        productId: product.id, styleNo: product.styleNo, productName: product.name, image: product.images[0] || '',
        sku: sku.sku, color: sku.color || '', size: sku.size || '', quantity: picked[product.id], unitPrice: product.unitPrice, packSize: product.packSize
      }];
    }));
    setNotice(`已提交 ${rows.length} 款到订货车`);
    setPicked({});
  };

  return (
    <StoreShell
      tone="factory"
      header={(
        <div className="mx-auto max-w-[1400px] px-4">
          <div className="flex h-14 items-center gap-3">
            <p className="text-sm font-semibold tracking-tight text-white">{data.merchant?.name || 'RUDA'}</p>
            <span className="hidden text-xs text-neutral-500 sm:inline">产能与排期</span>
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索款号 / 品类" className="ml-auto h-9 w-40 border border-neutral-700 bg-neutral-900 px-2 text-xs text-neutral-200 outline-none focus:border-neutral-400 sm:w-64" />
            <select value={filters.category} onChange={event => update({ category: event.target.value })} aria-label="品类" className="h-9 border border-neutral-700 bg-neutral-900 px-2 text-xs text-neutral-200">
              <option value="all">全部品类</option>
              {data.categories.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
        </div>
      )}
      footer={<StoreFooter data={data} tone="factory" note="排期与交期以商家书面确认为准。" />}
    >
      <div className="mx-auto max-w-[1400px] px-4 py-8">
        <SectionHeading kicker="Schedule" title="产能排期" description="按品类的在产款数与可用库存；交期需结合订单量与排产确认。" dark />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {groups.slice(0, 4).map(group => (
            <div key={group.label} className="border border-neutral-800 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-neutral-500">{group.label}</p>
              <p className="mt-2 text-xl font-semibold tabular-nums text-white">{group.count} 款</p>
              <p className="mt-1 text-xs text-neutral-500">可用 {group.units} 件 · MOQ {group.moq}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 border border-neutral-800">
          <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-neutral-800 px-4 py-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">款式与订量</p>
            <select value={sort} onChange={event => setSort(event.target.value as typeof sort)} aria-label="排序" className="border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200">
              <option value="featured">默认</option>
              <option value="stock">库存优先</option>
              <option value="priceAsc">价格升序</option>
            </select>
          </div>
          <div className="divide-y divide-neutral-800">
            {filtered.map(product => (
              <div key={product.id} className="grid grid-cols-[56px_1fr_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[56px_1.6fr_1fr_1fr_auto_140px]">
                <button type="button" onClick={() => open(product)} aria-label={`查看 ${product.name}`}>
                  <StorefrontImage src={product.images[0]} alt={product.name} ratio="1 / 1" className="w-12" />
                </button>
                <button type="button" onClick={() => open(product)} className="min-w-0 text-left">
                  <span className="block truncate text-xs font-semibold text-white">{product.name}</span>
                  <span className="block truncate text-xs text-neutral-500">{product.styleNo} · {product.material || '—'}</span>
                </button>
                <span className="hidden text-xs text-neutral-400 sm:block">{product.category}</span>
                <span className="hidden text-xs text-neutral-400 sm:block">MOQ {product.moq} · 装箱 {product.packSize}</span>
                <span className="hidden text-right text-xs font-semibold tabular-nums text-white sm:block">{priceText(product.unitPrice, data.isWholesaleAuthorized, true)}</span>
                <div className="flex justify-end"><Stepper value={picked[product.id] || 0} onChange={value => setPicked(prev => ({ ...prev, [product.id]: value }))} /></div>
              </div>
            ))}
            {!filtered.length ? <div className="px-4 py-10 text-center text-xs text-neutral-500">没有匹配的款式</div> : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-xs text-neutral-400">已选 {Object.values(picked).reduce((sum, value) => sum + value, 0)} 件</span>
          <button type="button" onClick={submit} disabled={!Object.values(picked).some(Boolean)} className="bg-white px-4 py-2 text-xs font-semibold text-neutral-950 disabled:opacity-40">加入订货车</button>
          {notice ? <span className="text-xs text-neutral-300">{notice}</span> : null}
        </div>
      </div>

      {activeProduct ? <ProductDetail data={data} product={activeProduct} mode="spec" onClose={close} /> : null}
    </StoreShell>
  );
};

/* ─────────────────────── 3. 贴牌定制 ─────────────────────── */

export const ProductionPrivateLabelTemplate: React.FC<StorefrontTemplateProps> = ({ data, initialProductId, onProductChange }) => {
  const [step, setStep] = useState(0);
  const { activeProduct, open, close } = useActiveProduct(data.products, initialProductId ?? null, onProductChange);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const submitSample = async () => {
    setBusy(true);
    const result = await data.createBuyerRfq({
      title: '贴牌打样申请',
      description: note || '贴牌 / 打样申请',
      category: data.products[0]?.category || '',
      targetQuantity: data.products[0]?.moq || 100,
      targetPrice: 0,
      targetCurrency: 'EUR',
      deadlineAt: new Date(Date.now() + 21 * 86400000).toISOString(),
      preferredCountries: [],
      productIds: data.products.slice(0, 3).map(product => product.id),
      merchantId: data.merchant?.id,
      remarks: note
    });
    setBusy(false);
    setMessage(result.ok
      ? `打样申请已提交，单号 ${result.rfqNo}。`
      : (data.authRole === 'buyer' ? (result.error || '提交失败，请稍后重试。') : '请先登录采购账号后再提交。'));
  };

  return (
    <StoreShell
      tone="factory"
      header={<FactoryNav name={data.merchant?.name || 'RUDA'} links={['流程', '样板', '打样', '联系']} onInquiry={() => void submitSample()} />}
      footer={<StoreFooter data={data} tone="factory" note="贴牌价格随工艺与数量变化，以报价单为准。" />}
    >
      <section className="mx-auto grid max-w-[1400px] gap-8 px-5 py-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Private Label</p>
          <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">贴牌定制</h1>
          <p className="mt-4 text-xs leading-6 text-neutral-400">{data.brandStory || '从样板到量产，按你的品牌与技术包生产。'}</p>
          <div className="mt-6 space-y-2">
            {STEPS.map((item, index) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setStep(index)}
                aria-pressed={step === index}
                className={`flex w-full items-start gap-3 border px-4 py-3 text-left transition-colors ${step === index ? 'border-white bg-white text-neutral-950' : 'border-neutral-800 text-neutral-300 hover:border-neutral-600'}`}
              >
                <item.icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="block text-xs font-semibold">{item.title}</span>
                  <span className={`mt-0.5 block text-xs ${step === index ? 'text-neutral-600' : 'text-neutral-500'}`}>{item.detail}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="mt-6 border border-neutral-800 p-4">
            <p className="text-xs font-semibold text-white">打样申请</p>
            <textarea rows={3} value={note} onChange={event => setNote(event.target.value)} placeholder="品牌、目标品类、数量、面料与交期" className="mt-2 w-full border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-neutral-200 outline-none focus:border-neutral-400" />
            <button type="button" disabled={busy} onClick={() => void submitSample()} className="mt-3 w-full bg-white py-2.5 text-xs font-semibold text-neutral-950 disabled:opacity-50">
              {busy ? '提交中…' : '提交打样申请'}
            </button>
            {message ? <p className="mt-2 flex items-center gap-1.5 text-xs text-neutral-300"><Check className="h-3.5 w-3.5" />{message}</p> : null}
          </div>
        </div>

        <div id="样板">
          <SectionHeading kicker="Range" title="样板库" description="可作为贴牌基础的现有款式，点击查看规格。" dark />
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {data.products.slice(0, 9).map(product => (
              <button key={product.id} type="button" onClick={() => open(product)} className="text-left">
                <StorefrontImage src={product.images[0]} alt={product.name} ratio="1 / 1" />
                <p className="mt-2 truncate text-xs font-semibold text-white">{product.name}</p>
                <p className="truncate text-xs text-neutral-500">{product.styleNo}</p>
              </button>
            ))}
          </div>
          {!data.products.length ? <div className="mt-4"><EmptyBlock title="样板库待补充" description="商家发布商品后自动出现在这里。" /></div> : null}
          <div className="mt-5 flex flex-wrap gap-2">
            <Tag tone="outline">打样周期以商家确认为准</Tag>
            <Tag tone="outline">支持面料替换</Tag>
          </div>
        </div>
      </section>

      {activeProduct ? <ProductDetail data={data} product={activeProduct} mode="spec" onClose={close} /> : null}
    </StoreShell>
  );
};

export const APPAREL_PRODUCTION_TEMPLATES = {
  apparel_capability: ProductionCapabilityTemplate,
  apparel_schedule: ProductionScheduleTemplate,
  apparel_private_label: ProductionPrivateLabelTemplate
} as const;

export const ProductionSteps = STEPS;

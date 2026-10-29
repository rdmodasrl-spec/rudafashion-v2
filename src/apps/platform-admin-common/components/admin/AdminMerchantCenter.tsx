import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, RefreshCw, Search } from 'lucide-react';
import { apiGet } from '../../../../api/client';

type MerchantCenterRange = { from: string; to: string };
type MerchantCenterOverview = {
  total: number;
  operating: number;
  newCount: number;
  paused: number;
  incomplete: number;
  unclassified: number;
  demo: number;
};
type MerchantCenterIndustry = {
  id: string;
  name: string;
  count: number;
  newCount: number;
  operatingCount: number;
  pausedCount: number;
  incompleteCount: number;
};
type MerchantCenterMerchant = {
  id: string;
  name: string;
  companyLegalName: string;
  code: string;
  logo: string;
  country: string;
  city: string;
  contactPerson: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  createdAt: string;
  industryTemplate: string | null;
  industryName: string;
  industryTemplateSource: string;
  industryTemplateInitializedAt: string | null;
  storefrontEnabled: boolean | null;
  storeSlug: string | null;
  storeUrl: string | null;
  isDemo: boolean;
  unclassified: boolean;
  incomplete: boolean;
  operating: boolean;
  status: 'operating' | 'paused' | 'incomplete' | 'setup';
  counts: { products: number; orders: number; activeEmployees: number; stores: number };
};
type MerchantCenterDetail = MerchantCenterMerchant & {
  showroomAddress: string;
  modules: string[];
  readiness: {
    profileComplete: boolean;
    storeInitialized: boolean;
    productsInitialized: boolean;
    employeesInitialized: boolean;
    loginState: string;
  };
  counts: {
    products: number;
    orders: number;
    employees: number;
    activeEmployees: number;
    stores: number;
  };
  productStatusCounts: Record<string, number>;
  orderStatusCounts: Record<string, number>;
  employeeRoleCounts: Record<string, number>;
  stores: Array<{ id: string; name: string; code: string; status: string; city: string; country: string }>;
};

interface AdminMerchantCenterProps {
  onEnterMerchant?: (merchant: Pick<MerchantCenterMerchant, 'id' | 'name'>) => void | Promise<void>;
  compact?: boolean;
}

const dateInputValue = (date: Date) => date.toISOString().slice(0, 10);
const statusLabels: Record<MerchantCenterMerchant['status'], string> = {
  operating: '正常营业',
  paused: '暂停营业',
  incomplete: '资料待完善',
  setup: '待确认'
};
const statusClasses: Record<MerchantCenterMerchant['status'], string> = {
  operating: 'border-neutral-300 bg-white text-neutral-800',
  paused: 'border-neutral-300 bg-neutral-100 text-neutral-600',
  incomplete: 'border-neutral-400 bg-neutral-50 text-neutral-700',
  setup: 'border-dashed border-neutral-300 bg-white text-neutral-500'
};
const moduleLabels: Record<string, string> = {
  dashboard: '经营概览',
  stores: '门店管理',
  products: '商品管理',
  sku_matrix: 'SKU 矩阵',
  materials: '原料管理',
  production: '生产管理',
  inventory: '库存管理',
  transfers: '门店调拨',
  pos: '收银',
  pos_sales: '销售记录',
  pos_shifts: '班次管理',
  orders: '订单管理',
  customers: '客户管理',
  suppliers: '供应商',
  procurement: '采购管理',
  settings: '店铺设置',
  team: '员工与权限',
  messages: '消息中心'
};
const employeeRoleLabels: Record<string, string> = {
  merchant_owner: '商家负责人',
  store_manager: '店长',
  sales: '销售',
  warehouse: '仓库',
  production: '生产',
  pos_cashier: 'POS 收银',
  knowledge_manager: '知识库管理员'
};

export const AdminMerchantCenter: React.FC<AdminMerchantCenterProps> = ({ onEnterMerchant, compact = false }) => {
  const [scope, setScope] = useState<'official' | 'demo'>('official');
  const [rangeMode, setRangeMode] = useState<'7' | '30' | 'custom'>('7');
  const [customFrom, setCustomFrom] = useState(() => dateInputValue(new Date(Date.now() - 6 * 86400000)));
  const [customTo, setCustomTo] = useState(() => dateInputValue(new Date()));
  const dateRange = useMemo<MerchantCenterRange>(() => {
    const to = new Date();
    const days = rangeMode === '30' ? 30 : 7;
    return rangeMode === 'custom'
      ? { from: customFrom, to: customTo }
      : { from: dateInputValue(new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate() - days + 1))), to: dateInputValue(to) };
  }, [rangeMode, customFrom, customTo]);
  const [overview, setOverview] = useState<MerchantCenterOverview | null>(null);
  const [industries, setIndustries] = useState<MerchantCenterIndustry[]>([]);
  const [unclassifiedCount, setUnclassifiedCount] = useState(0);
  const [rows, setRows] = useState<MerchantCenterMerchant[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [query, setQuery] = useState('');
  const [industry, setIndustry] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState<'createdAt' | 'products' | 'orders'>('createdAt');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const [filterByRegistration, setFilterByRegistration] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [detail, setDetail] = useState<MerchantCenterDetail | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoadingOverview(true);
    const params = new URLSearchParams({ newFrom: dateRange.from, newTo: dateRange.to });
    void apiGet<{
      success: true;
      overview: MerchantCenterOverview;
      industries: MerchantCenterIndustry[];
      unclassified?: { count: number } | null;
    }>(`/api/admin/merchant-center/overview?${params}`)
      .then(result => {
        if (!active) return;
        setOverview(result.overview);
        setIndustries(result.industries);
        setUnclassifiedCount(result.unclassified?.count ?? 0);
        setError('');
      })
      .catch(loadError => {
        if (active) setError(loadError instanceof Error ? loadError.message : '商家概览加载失败');
      })
      .finally(() => {
        if (active) setLoadingOverview(false);
      });
    return () => { active = false; };
  }, [dateRange, refreshKey]);

  useEffect(() => {
    let active = true;
    setLoadingList(true);
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        scope,
        sort,
        direction
      });
      if (query.trim()) params.set('q', query.trim());
      if (industry) params.set('industry', industry);
      if (status) params.set('status', status);
      if (filterByRegistration) {
        params.set('newFrom', dateRange.from);
        params.set('newTo', dateRange.to);
      }
      void apiGet<{ success: true; merchants: MerchantCenterMerchant[]; total: number }>(
        `/api/admin/merchant-center/merchants?${params}`
      )
        .then(result => {
          if (!active) return;
          setRows(result.merchants);
          setTotal(result.total);
          setError('');
        })
        .catch(loadError => {
          if (active) setError(loadError instanceof Error ? loadError.message : '商家列表加载失败');
        })
        .finally(() => {
          if (active) setLoadingList(false);
        });
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [page, pageSize, scope, sort, direction, query, industry, status, filterByRegistration, dateRange, refreshKey]);

  const loadDetail = async (merchantId: string) => {
    setLoadingDetail(true);
    setError('');
    try {
      const result = await apiGet<{ success: true; merchant: MerchantCenterDetail }>(
        `/api/admin/merchant-center/merchants/${encodeURIComponent(merchantId)}`
      );
      setDetail(result.merchant);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '商家详情加载失败');
    } finally {
      setLoadingDetail(false);
    }
  };

  const resetFilters = () => {
    setIndustry('');
    setStatus('');
    setQuery('');
    setPage(1);
    setFilterByRegistration(false);
    setDetail(null);
  };
  const setStatusFilter = (nextStatus: string) => {
    setScope('official');
    setIndustry('');
    setStatus(nextStatus);
    setFilterByRegistration(false);
    setPage(1);
    setDetail(null);
  };
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const dateRangeInvalid = rangeMode === 'custom' && (!customFrom || !customTo || customFrom > customTo);

  const renderMerchant = (merchant: MerchantCenterMerchant) => (
    <div key={merchant.id} className="grid gap-3 border-b border-neutral-200 px-3 py-3 last:border-b-0 sm:grid-cols-[minmax(190px,1.5fr)_minmax(120px,1fr)_minmax(150px,1fr)_minmax(140px,1fr)_minmax(130px,1fr)_auto] sm:items-center sm:px-4">
      <div className="flex min-w-0 items-center gap-3">
        {merchant.logo
          ? <img src={merchant.logo} alt="" className="h-10 w-10 shrink-0 rounded-md border border-neutral-200 bg-neutral-50 object-cover" />
          : <div aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-neutral-200 bg-neutral-50 text-xs font-semibold text-neutral-500">{merchant.name.slice(0, 1) || '商'}</div>}
        <div className="min-w-0">
          <button type="button" onClick={() => void loadDetail(merchant.id)} className="block max-w-full truncate text-left text-sm font-semibold text-neutral-950 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900">
            {merchant.name || '未填写'}
          </button>
          <p className="truncate text-xs text-neutral-600">{merchant.companyLegalName || '未填写'} · {merchant.code || '未填写'}</p>
        </div>
      </div>
      <div className="text-sm text-neutral-800">
        <span className="text-xs text-neutral-500 sm:hidden">行业 · </span>{merchant.industryName}
      </div>
      <div className="min-w-0 text-xs leading-5 text-neutral-700">
        <div className="truncate">{merchant.contactPerson || '负责人未填写'}</div>
        <div className="truncate text-neutral-500">{merchant.contactPhone || merchant.contactEmail || '联系方式未填写'}</div>
      </div>
      <div className="text-xs leading-5 text-neutral-700">
        <div>{new Date(merchant.createdAt).toLocaleDateString('zh-CN')}</div>
        <div className="truncate text-neutral-500">{merchant.storeSlug || '域名未填写'}</div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-neutral-700">
        <span>商品 {merchant.counts.products}</span><span>订单 {merchant.counts.orders}</span><span>员工 {merchant.counts.activeEmployees}</span>
      </div>
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <span className={`inline-flex whitespace-nowrap rounded-md border px-2 py-1 text-xs ${statusClasses[merchant.status]}`}>{statusLabels[merchant.status]}</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void loadDetail(merchant.id)} className="text-xs font-medium text-neutral-800 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900">详情</button>
          {onEnterMerchant && <button type="button" onClick={() => void onEnterMerchant(merchant)} className="text-xs font-medium text-neutral-800 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900">进入后台</button>}
        </div>
      </div>
    </div>
  );

  if (detail) {
    return (
      <section className="space-y-4" aria-label="商家详情">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-300 pb-3">
          <div>
            <h2 className="text-xl font-semibold text-neutral-950">{detail.name}</h2>
            <p className="mt-1 text-sm text-neutral-600">{detail.companyLegalName} · {detail.code} · {detail.industryName}</p>
          </div>
          <div className="flex gap-2">
            {detail.storeUrl && <a href={detail.storeUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-800 hover:bg-neutral-50"><ExternalLink className="h-4 w-4" />打开店铺</a>}
            <button type="button" onClick={() => setDetail(null)} className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-800 hover:bg-neutral-50">返回列表</button>
          </div>
        </header>
        {detail.isDemo && <p className="border-b border-neutral-300 pb-3 text-sm font-medium text-neutral-800">演示商家 · 不计入正式经营统计</p>}
        {loadingDetail ? <p className="py-8 text-center text-sm text-neutral-500">正在读取详情…</p> : (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-neutral-950">商家概览</h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div><dt className="text-xs text-neutral-500">负责人</dt><dd className="mt-1">{detail.contactPerson || '未填写'}</dd></div>
                <div><dt className="text-xs text-neutral-500">联系方式</dt><dd className="mt-1 break-all">{detail.contactPhone || detail.contactEmail || '未填写'}</dd></div>
                <div><dt className="text-xs text-neutral-500">注册时间</dt><dd className="mt-1">{new Date(detail.createdAt).toLocaleString('zh-CN')}</dd></div>
                <div><dt className="text-xs text-neutral-500">注册来源</dt><dd className="mt-1">{detail.industryTemplateSource || '未记录'}</dd></div>
                <div><dt className="text-xs text-neutral-500">营业状态</dt><dd className="mt-1">{statusLabels[detail.status]}</dd></div>
                <div><dt className="text-xs text-neutral-500">店铺域名</dt><dd className="mt-1 break-all">{detail.storeSlug || '未填写'}</dd></div>
                <div><dt className="text-xs text-neutral-500">店铺初始化</dt><dd className="mt-1">{detail.readiness.storeInitialized ? '已配置' : '未配置'}</dd></div>
                <div><dt className="text-xs text-neutral-500">账号登录记录</dt><dd className="mt-1">{detail.readiness.loginState}</dd></div>
              </dl>
            </section>
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-neutral-950">经营数据</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="border-b border-neutral-200 py-2">商品 <strong className="float-right tabular-nums">{detail.counts.products}</strong></div>
                <div className="border-b border-neutral-200 py-2">订单 <strong className="float-right tabular-nums">{detail.counts.orders}</strong></div>
                <div className="border-b border-neutral-200 py-2">启用员工 <strong className="float-right tabular-nums">{detail.counts.activeEmployees}</strong></div>
                <div className="border-b border-neutral-200 py-2">门店 <strong className="float-right tabular-nums">{detail.counts.stores}</strong></div>
              </div>
              <p className="text-xs leading-5 text-neutral-600">商品状态：{Object.entries(detail.productStatusCounts).map(([key, count]) => `${key} ${count}`).join(' · ') || '暂无记录'}</p>
              <p className="text-xs leading-5 text-neutral-600">订单状态：{Object.entries(detail.orderStatusCounts).map(([key, count]) => `${key} ${count}`).join(' · ') || '暂无记录'}</p>
            </section>
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-neutral-950">店铺与门店</h3>
              {detail.stores.length
                ? <ul className="divide-y divide-neutral-200 border-y border-neutral-200">{detail.stores.map(store => <li key={store.id} className="flex justify-between gap-3 py-2 text-sm"><span>{store.name} <span className="text-xs text-neutral-500">{store.code} · {store.city || store.country || '地址未填写'}</span></span><span className="text-xs text-neutral-600">{store.status === 'active' ? '营业中' : '已暂停'}</span></li>)}</ul>
                : <p className="text-sm text-neutral-500">暂无门店记录</p>}
              <p className="text-xs text-neutral-600">{detail.storeUrl ? <a href={detail.storeUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">打开该商家店铺</a> : '店铺域名未配置'}</p>
            </section>
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-neutral-950">员工与行业模块</h3>
              <p className="text-xs leading-5 text-neutral-600">启用员工角色：{Object.entries(detail.employeeRoleCounts).map(([key, count]) => `${employeeRoleLabels[key] || key} ${count}`).join(' · ') || '暂无记录'}</p>
              <p className="text-xs leading-5 text-neutral-600">已启用模块：{detail.modules.map(module => moduleLabels[module] || module).join('、') || '行业未分类'}</p>
              <p className="text-xs leading-5 text-neutral-600">商品初始化：{detail.readiness.productsInitialized ? '已有商品' : '暂无商品'} · 员工初始化：{detail.readiness.employeesInitialized ? '已有启用员工' : '暂无启用员工'}</p>
            </section>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className={`space-y-5 ${compact ? 'text-sm' : ''}`} aria-label="平台商家中心">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-neutral-300 pb-3">
        <div>
          <h2 className="text-xl font-semibold text-neutral-950">平台商家</h2>
          <p className="mt-1 text-sm text-neutral-600">按行业查看真实入驻、门店与经营进度</p>
        </div>
        <button type="button" onClick={() => { setPage(1); setRefreshKey(value => value + 1); }} className="inline-flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-800 hover:bg-neutral-50">
          <RefreshCw className="h-4 w-4" />刷新
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button type="button" aria-pressed={scope === 'official'} onClick={() => { setScope('official'); setPage(1); setDetail(null); }} className={`rounded-md px-3 py-2 ${scope === 'official' ? 'bg-neutral-950 text-white' : 'border border-neutral-300 text-neutral-700 hover:bg-neutral-50'}`}>正式商家</button>
        <button type="button" aria-pressed={scope === 'demo'} onClick={() => { setScope('demo'); setPage(1); setDetail(null); }} className={`rounded-md px-3 py-2 ${scope === 'demo' ? 'bg-neutral-950 text-white' : 'border border-neutral-300 text-neutral-700 hover:bg-neutral-50'}`}>演示商家 <span className="ml-1 tabular-nums">{overview?.demo ?? '—'}</span></button>
        {scope === 'demo' && <span className="text-xs text-neutral-600">独立演示数据，不计入正式商家统计</span>}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-neutral-200 py-4 sm:grid-cols-3 lg:grid-cols-6" aria-label="平台商家经营概览">
        {[
          { label: '平台商家总数', value: overview?.total, action: () => setStatusFilter('') },
          { label: '正常营业', value: overview?.operating, action: () => setStatusFilter('operating') },
          { label: `新入驻（${rangeMode === 'custom' ? '自定义' : `${rangeMode}天`}）`, value: overview?.newCount, action: () => { setScope('official'); setIndustry(''); setStatus(''); setFilterByRegistration(true); setPage(1); } },
          { label: '暂停营业', value: overview?.paused, action: () => setStatusFilter('paused') },
          { label: '资料待完善', value: overview?.incomplete, action: () => setStatusFilter('incomplete') },
          { label: '行业未分类', value: overview?.unclassified, action: () => { setScope('official'); setIndustry('unclassified'); setStatus(''); setPage(1); } }
        ].map(metric => (
          <button key={metric.label} type="button" onClick={metric.action} className="min-w-0 border-l border-neutral-300 pl-3 text-left hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900">
            <span className="block truncate text-xs text-neutral-600">{metric.label}</span>
            <span className="mt-1 block text-2xl font-semibold tabular-nums text-neutral-950">{loadingOverview ? '…' : metric.value ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-neutral-200 pb-3">
        <span className="text-sm font-medium text-neutral-900">新入驻统计</span>
        <div className="inline-flex rounded-md border border-neutral-300 p-0.5">
          {(['7', '30', 'custom'] as const).map(mode => <button key={mode} type="button" aria-pressed={rangeMode === mode} onClick={() => { setRangeMode(mode); setPage(1); }} className={`rounded px-2.5 py-1 text-xs ${rangeMode === mode ? 'bg-neutral-950 text-white' : 'text-neutral-700 hover:bg-neutral-100'}`}>{mode === 'custom' ? '自定义' : `近${mode}天`}</button>)}
        </div>
        {rangeMode === 'custom' && <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-700">
          <label>开始日期 <input aria-label="开始日期" type="date" value={customFrom} onChange={event => { setCustomFrom(event.target.value); setPage(1); }} className="ml-1 rounded border border-neutral-300 px-2 py-1.5" /></label>
          <label>结束日期 <input aria-label="结束日期" type="date" value={customTo} onChange={event => { setCustomTo(event.target.value); setPage(1); }} className="ml-1 rounded border border-neutral-300 px-2 py-1.5" /></label>
        </div>}
        <button type="button" aria-pressed={filterByRegistration} onClick={() => { setFilterByRegistration(value => !value); setPage(1); }} className={`rounded-md px-2.5 py-1 text-xs underline underline-offset-2 ${filterByRegistration ? 'bg-neutral-100 text-neutral-950' : 'text-neutral-700'}`}>
          {filterByRegistration ? '取消入驻时间筛选' : '按此时间筛选列表'}
        </button>
      </div>

      <section aria-label="七行业商家分类">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-neutral-950">七行业商家</h3>
          <span className="text-xs text-neutral-500">按注册时选择的行业分类；旧数据不推断</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {industries.map(item => (
            <button key={item.id} type="button" aria-pressed={industry === item.id} onClick={() => { setScope('official'); setIndustry(current => current === item.id ? '' : item.id); setStatus(''); setPage(1); setDetail(null); }} className={`min-w-0 rounded-lg border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 ${industry === item.id ? 'border-neutral-950 bg-neutral-100' : 'border-neutral-200 bg-white hover:bg-neutral-50'}`}>
              <span className="block truncate text-sm font-semibold text-neutral-950">{item.name}</span>
              <span className="mt-1 block text-xl font-semibold tabular-nums text-neutral-950">{loadingOverview ? '…' : item.count}</span>
              <span className="mt-1 block text-xs leading-5 text-neutral-600">新增 {item.newCount} · 营业 {item.operatingCount} · 暂停 {item.pausedCount}</span>
            </button>
          ))}
          <button type="button" aria-pressed={industry === 'unclassified'} onClick={() => { setScope('official'); setIndustry(current => current === 'unclassified' ? '' : 'unclassified'); setStatus(''); setPage(1); setDetail(null); }} className={`rounded-lg border p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 ${industry === 'unclassified' ? 'border-neutral-950 bg-neutral-100' : 'border-neutral-200 bg-white hover:bg-neutral-50'}`}>
            <span className="block text-sm font-semibold text-neutral-950">未分类</span>
            <span className="mt-1 block text-xl font-semibold tabular-nums text-neutral-950">{loadingOverview ? '…' : unclassifiedCount}</span>
            <span className="mt-1 block text-xs leading-5 text-neutral-600">行业字段缺失或不在权威模板中</span>
          </button>
        </div>
      </section>

      <section className="space-y-3" aria-label="商家列表">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-neutral-950">{scope === 'demo' ? '演示商家列表' : '商家列表'}</h3>
            <p className="mt-1 text-xs text-neutral-600">{industry ? industries.find(item => item.id === industry)?.name || '未分类' : '全部行业'} · {total} 家</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-[220px] flex-1">
              <span className="sr-only">搜索商家名称、代码、负责人、联系方式或域名</span>
              <Search aria-hidden="true" className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
              <input value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="名称、代码、负责人、联系方式、域名" className="w-full rounded-md border border-neutral-300 py-2 pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-500 focus:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-300" />
            </label>
            <select aria-label="商家状态" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }} className="rounded-md border border-neutral-300 bg-white px-2.5 py-2 text-sm text-neutral-800">
              <option value="">全部状态</option><option value="operating">正常营业</option><option value="paused">暂停营业</option><option value="incomplete">资料待完善</option><option value="setup">待确认</option>
            </select>
            <select aria-label="排序方式" value={sort} onChange={event => setSort(event.target.value as typeof sort)} className="rounded-md border border-neutral-300 bg-white px-2.5 py-2 text-sm text-neutral-800">
              <option value="createdAt">按注册时间</option><option value="products">按商品数量</option><option value="orders">按订单数量</option>
            </select>
            <button type="button" aria-label={direction === 'desc' ? '切换为升序' : '切换为降序'} onClick={() => setDirection(value => value === 'desc' ? 'asc' : 'desc')} className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-800 hover:bg-neutral-50">{direction === 'desc' ? '降序' : '升序'}</button>
            <select aria-label="每页数量" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }} className="rounded-md border border-neutral-300 bg-white px-2.5 py-2 text-sm text-neutral-800">
              {[20, 50, 100].map(size => <option key={size} value={size}>每页 {size}</option>)}
            </select>
            {(industry || status || query) && <button type="button" onClick={resetFilters} className="rounded-md px-2 py-2 text-sm text-neutral-700 underline underline-offset-2">清除筛选</button>}
          </div>
        </div>
        {dateRangeInvalid && <p role="alert" className="text-sm text-neutral-700">日期范围无效，请确认开始日期不晚于结束日期。</p>}
        {error && <p role="alert" className="border-y border-neutral-300 py-2 text-sm text-neutral-800">读取失败：{error}</p>}
        <div className="hidden border-y border-neutral-300 lg:block">
          <div className="grid grid-cols-[minmax(190px,1.5fr)_minmax(120px,1fr)_minmax(150px,1fr)_minmax(140px,1fr)_minmax(130px,1fr)_auto] gap-3 bg-neutral-50 px-4 py-2 text-xs font-medium text-neutral-600">
            <span>商家 / 商家代码</span><span>所属行业</span><span>负责人 / 联系方式</span><span>注册时间 / 域名</span><span>商品 / 订单 / 员工</span><span>状态 / 操作</span>
          </div>
          {loadingList ? <p className="py-8 text-center text-sm text-neutral-500">正在加载商家…</p> : rows.map(renderMerchant)}
        </div>
        <div className="divide-y divide-neutral-200 border-y border-neutral-200 lg:hidden">
          {loadingList ? <p className="py-8 text-center text-sm text-neutral-500">正在加载商家…</p> : rows.map(merchant => (
            <article key={merchant.id} className="space-y-2 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">{renderMerchant(merchant)}</div>
              </div>
            </article>
          ))}
        </div>
        {!loadingList && rows.length === 0 && <p className="border-y border-neutral-200 py-8 text-center text-sm text-neutral-500">没有符合条件的商家。</p>}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-sm text-neutral-700">
          <span>第 {page} / {pages} 页 · 共 {total} 家</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1 || loadingList} onClick={() => setPage(current => Math.max(1, current - 1))} className="rounded-md border border-neutral-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50">上一页</button>
            <button type="button" disabled={page >= pages || loadingList} onClick={() => setPage(current => Math.min(pages, current + 1))} className="rounded-md border border-neutral-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50">下一页</button>
          </div>
        </div>
      </section>
    </section>
  );
};

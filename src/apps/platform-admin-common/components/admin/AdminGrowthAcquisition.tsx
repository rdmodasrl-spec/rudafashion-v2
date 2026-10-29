import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, RefreshCw, Search, X } from 'lucide-react';
import { apiGet, apiPatch, apiPost } from '../../../../api/client';
import { AdminPageHeader } from './AdminPageHeader';
import { AdminPartnerGrowth } from './AdminPartnerGrowth';
import { describeGrowthError } from './growthAdminErrors';
import {
  growthProspectBusinessTypeLabels,
  growthProspectBusinessTypes,
  growthProspectStatusLabels,
  growthProspectStatuses,
  type GrowthProspect,
  type GrowthProspectDetailResponse,
  type GrowthProspectListResponse,
  type GrowthProspectStatus
} from './growthAdminTypes';

type ProspectSearchCandidate = {
  companyName: string;
  website: string | null;
  country: string | null;
  sourceUrl: string;
  sourceNote: string;
};

const dateTimeLocal = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const toIsoOrNull = (value: string) => (value ? new Date(value).toISOString() : null);

export const AdminGrowthAcquisition: React.FC = () => {
  const [list, setList] = useState<GrowthProspectListResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | GrowthProspectStatus>('all');
  const [dueFilter, setDueFilter] = useState<'' | 'today' | 'overdue'>('');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<GrowthProspectDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showPartnerNetwork, setShowPartnerNetwork] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [businessType, setBusinessType] = useState<(typeof growthProspectBusinessTypes)[number]>('wholesaler');
  const [nextFollowUpAt, setNextFollowUpAt] = useState(dateTimeLocal(new Date()));
  const [followUpNote, setFollowUpNote] = useState('');
  const [followUpCategory, setFollowUpCategory] = useState('sales');
  const [followUpDueAt, setFollowUpDueAt] = useState(dateTimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)));
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCountry, setSearchCountry] = useState('');
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<ProspectSearchCandidate[]>([]);
  const [searchNote, setSearchNote] = useState('');
  const listRequestRef = useRef(0);
  const detailRequestRef = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(async () => {
    const requestId = ++listRequestRef.current;
    setLoading(true);
    setError('');
    setList(null);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (dueFilter) params.set('due', dueFilter);
      if (debouncedQuery) params.set('q', debouncedQuery);
      const result = await apiGet<GrowthProspectListResponse>(`/api/admin/growth/prospects?${params.toString()}`);
      if (requestId !== listRequestRef.current) return;
      setList(result);
    } catch (loadError) {
      if (requestId !== listRequestRef.current) return;
      setList(null);
      setError(describeGrowthError(loadError));
    } finally {
      if (requestId === listRequestRef.current) setLoading(false);
    }
  }, [debouncedQuery, dueFilter, statusFilter]);

  useEffect(() => { void load(); }, [load]);

  const openDetail = async (id: string) => {
    const requestId = ++detailRequestRef.current;
    setDetailLoading(true);
    setDetail(null);
    setDetailError('');
    try {
      const result = await apiGet<GrowthProspectDetailResponse>(`/api/admin/growth/prospects/${id}`);
      if (requestId !== detailRequestRef.current) return;
      setDetail(result);
    } catch (loadError) {
      if (requestId !== detailRequestRef.current) return;
      setDetail(null);
      setDetailError(describeGrowthError(loadError));
    } finally {
      if (requestId === detailRequestRef.current) setDetailLoading(false);
    }
  };

  const createProspect = async () => {
    if (!companyName.trim()) {
      setError('请填写公司名称');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiPost<{ prospect: GrowthProspect }>('/api/admin/growth/prospects', {
        companyName: companyName.trim(),
        contactName: contactName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        website: website.trim() || null,
        country: country.trim() || null,
        city: city.trim() || null,
        businessType,
        source: 'manual',
        sourceUrl: null,
        sourceNote: null,
        nextFollowUpAt: toIsoOrNull(nextFollowUpAt)
      });
      setCompanyName(''); setContactName(''); setEmail(''); setPhone(''); setWebsite('');
      setCountry(''); setCity(''); setShowCreate(false);
      await load();
    } catch (createError) {
      setError(describeGrowthError(createError));
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (status: GrowthProspectStatus) => {
    if (!detail) return;
    setBusy(true);
    setError('');
    try {
      await apiPatch(`/api/admin/growth/prospects/${detail.prospect.id}`, { status });
      await Promise.all([openDetail(detail.prospect.id), load()]);
    } catch (updateError) {
      setError(describeGrowthError(updateError));
    } finally {
      setBusy(false);
    }
  };

  const addFollowUp = async () => {
    if (!detail || !followUpNote.trim()) {
      setError('请填写跟进记录');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiPost('/api/admin/growth/crm/follow-ups', {
        subjectType: 'prospect',
        subjectId: detail.prospect.id,
        category: followUpCategory,
        note: followUpNote.trim(),
        dueAt: toIsoOrNull(followUpDueAt) || new Date().toISOString()
      });
      setFollowUpNote('');
      await Promise.all([openDetail(detail.prospect.id), load()]);
    } catch (followUpError) {
      setError(describeGrowthError(followUpError));
    } finally {
      setBusy(false);
    }
  };

  const completeFollowUp = async (id: string) => {
    setBusy(true);
    setError('');
    try {
      await apiPatch(`/api/admin/growth/crm/follow-ups/${id}`, { status: 'completed', resolutionNote: '已在招商获客工具中完成' });
      if (detail) await Promise.all([openDetail(detail.prospect.id), load()]);
    } catch (followUpError) {
      setError(describeGrowthError(followUpError));
    } finally {
      setBusy(false);
    }
  };

  const runSearch = async () => {
    if (!searchQuery.trim()) {
      setError('请填写搜索关键词');
      return;
    }
    setSearching(true);
    setError('');
    setSearchNote('');
    setCandidates([]);
    try {
      const result = await apiPost<{ candidates: ProspectSearchCandidate[]; provider: string }>('/api/admin/growth/prospects/search', {
        query: searchQuery.trim(),
        country: searchCountry.trim() || undefined,
        limit: 10
      });
      setCandidates(result.candidates);
      setSearchNote(result.candidates.length ? '搜索结果来自已配置的搜索供应商，需人工核对后再保存。' : '搜索供应商未返回可用的企业候选。');
    } catch (searchError) {
      setError(describeGrowthError(searchError));
    } finally {
      setSearching(false);
    }
  };

  const saveCandidate = async (candidate: ProspectSearchCandidate) => {
    setBusy(true);
    setError('');
    try {
      await apiPost('/api/admin/growth/prospects', {
        companyName: candidate.companyName,
        contactName: null,
        email: null,
        phone: null,
        website: candidate.website,
        country: candidate.country,
        city: null,
        businessType: 'other',
        source: 'import',
        sourceUrl: candidate.sourceUrl,
        sourceNote: candidate.sourceNote || null,
        nextFollowUpAt: null
      });
      setCandidates(previous => previous.filter(item => item !== candidate));
      await load();
    } catch (saveError) {
      setError(describeGrowthError(saveError));
    } finally {
      setBusy(false);
    }
  };


  return (
    <section className="space-y-4">
      <AdminPageHeader
        title="招商获客"
        description="线索来自人工录入、导入或已配置的搜索供应商；系统不会生成虚构企业。"
        actions={(
          <>
            <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />刷新
            </button>
            <button type="button" onClick={() => setShowCreate(previous => !previous)} className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-950 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800">
              {showCreate ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}{showCreate ? '取消' : '录入线索'}
            </button>
          </>
        )}
      />

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: '全部线索', value: list ? list.counts.all : '—' },
          { label: '待联系', value: list ? list.counts.byStatus.new ?? 0 : '—' },
          { label: '今日到期', value: list ? list.counts.dueToday : '—' },
          { label: '已逾期', value: list ? list.counts.overdue : '—' }
        ].map(item => (
          <article key={item.label} className="rounded-xl border border-neutral-200 bg-white p-3.5">
            <p className="text-[11px] text-neutral-500">{item.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-neutral-950">{item.value}</p>
          </article>
        ))}
      </div>

      {showCreate && (
        <article className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-neutral-900">录入线索</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs text-neutral-600">公司名称<input value={companyName} onChange={event => setCompanyName(event.target.value)} maxLength={200} className="mt-1 w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm text-neutral-900" /></label>
            <label className="text-xs text-neutral-600">联系人<input value={contactName} onChange={event => setContactName(event.target.value)} maxLength={120} className="mt-1 w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm text-neutral-900" /></label>
            <label className="text-xs text-neutral-600">邮箱<input value={email} onChange={event => setEmail(event.target.value)} maxLength={200} className="mt-1 w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm text-neutral-900" /></label>
            <label className="text-xs text-neutral-600">电话<input value={phone} onChange={event => setPhone(event.target.value)} maxLength={60} className="mt-1 w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm text-neutral-900" /></label>
            <label className="text-xs text-neutral-600">网站<input value={website} onChange={event => setWebsite(event.target.value)} maxLength={300} placeholder="example.com" className="mt-1 w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm text-neutral-900" /></label>
            <label className="text-xs text-neutral-600">国家<input value={country} onChange={event => setCountry(event.target.value)} maxLength={80} className="mt-1 w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm text-neutral-900" /></label>
            <label className="text-xs text-neutral-600">城市<input value={city} onChange={event => setCity(event.target.value)} maxLength={120} className="mt-1 w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm text-neutral-900" /></label>
            <label className="text-xs text-neutral-600">业务类型
              <select value={businessType} onChange={event => setBusinessType(event.target.value as typeof businessType)} className="mt-1 w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm text-neutral-900">
                {growthProspectBusinessTypes.map(type => <option key={type} value={type}>{growthProspectBusinessTypeLabels[type]}</option>)}
              </select>
            </label>
            <label className="text-xs text-neutral-600">下次跟进
              <input type="datetime-local" value={nextFollowUpAt} onChange={event => setNextFollowUpAt(event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm text-neutral-900" />
            </label>
            <div className="flex items-end">
              <button type="button" onClick={() => void createProspect()} disabled={busy} className="rounded-lg bg-neutral-950 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50">保存线索</button>
            </div>
          </div>
        </article>
      )}

      <article className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-neutral-900">搜索候选</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="例如：fashion wholesaler Milan" maxLength={160} className="min-w-56 flex-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm" />
          <input value={searchCountry} onChange={event => setSearchCountry(event.target.value)} placeholder="国家（可选）" maxLength={80} className="w-32 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm" />
          <button type="button" onClick={() => void runSearch()} disabled={searching} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
            <Search className="h-3.5 w-3.5" />{searching ? '搜索中' : '搜索'}
          </button>
        </div>
        {searchNote && <p className="mt-2 text-[11px] text-neutral-500">{searchNote}</p>}
        {candidates.length > 0 && (
          <ul className="mt-3 divide-y divide-neutral-100 text-xs">
            {candidates.map(candidate => (
              <li key={`${candidate.companyName}-${candidate.sourceUrl}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="font-medium text-neutral-900">{candidate.companyName}</p>
                  <p className="truncate text-[11px] text-neutral-500">{candidate.website || candidate.sourceUrl}</p>
                </div>
                <button type="button" onClick={() => void saveCandidate(candidate)} disabled={busy} className="rounded-lg border border-neutral-200 px-2.5 py-1 text-[11px] text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">保存为线索</button>
              </li>
            ))}
          </ul>
        )}
      </article>

      <div className="flex flex-wrap items-center gap-2">
        <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)} className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs text-neutral-700">
          <option value="all">全部状态</option>
          {growthProspectStatuses.map(status => <option key={status} value={status}>{growthProspectStatusLabels[status]}</option>)}
        </select>
        <select value={dueFilter} onChange={event => setDueFilter(event.target.value as typeof dueFilter)} className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs text-neutral-700">
          <option value="">全部跟进时间</option>
          <option value="today">今日到期</option>
          <option value="overdue">已逾期</option>
        </select>
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索公司、联系人、邮箱" maxLength={160} className="min-w-48 flex-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <article className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="min-w-full divide-y divide-neutral-100 text-xs">
            <thead className="bg-neutral-50 text-left text-[11px] text-neutral-500">
              <tr>
                <th className="px-3 py-2 font-medium">公司</th>
                <th className="px-3 py-2 font-medium">联系方式</th>
                <th className="px-3 py-2 font-medium">状态</th>
                <th className="px-3 py-2 font-medium">跟进</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {(list?.prospects ?? []).map(prospect => (
                <tr
                  key={prospect.id}
                  onClick={() => void openDetail(prospect.id)}
                  className={`cursor-pointer hover:bg-neutral-50 ${detail?.prospect.id === prospect.id ? 'bg-neutral-50' : ''}`}
                >
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={event => { event.stopPropagation(); void openDetail(prospect.id); }}
                      className="text-left font-medium text-neutral-900 underline-offset-2 hover:underline"
                    >
                      {prospect.companyName}
                    </button>
                    <p className="text-[11px] text-neutral-500">{[prospect.country, prospect.city].filter(Boolean).join(' · ') || '未填写地区'}</p>
                  </td>
                  <td className="px-3 py-2 text-neutral-600">
                    <p>{prospect.contactName || '—'}</p>
                    <p className="text-[11px] text-neutral-400">{prospect.email || prospect.phone || '无'}</p>
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700">{growthProspectStatusLabels[prospect.status]}</span>
                  </td>
                  <td className="px-3 py-2 text-[11px] text-neutral-500">
                    {prospect.nextFollowUpAt ? new Date(prospect.nextFollowUpAt).toLocaleDateString('zh-CN') : '未排期'}
                    <span className="ml-1 text-neutral-400">({prospect.followUpCount})</span>
                  </td>
                </tr>
              ))}
              {list && list.prospects.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-neutral-500">没有符合条件的线索。</td></tr>
              )}
              {!list && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-neutral-500">{loading ? '加载中…' : '线索加载失败，请重试。'}</td></tr>
              )}
            </tbody>
          </table>
        </article>


        <article className="rounded-xl border border-neutral-200 bg-white p-4">
          {!detail && <p className={`text-xs ${detailError ? 'text-red-600' : 'text-neutral-500'}`}>{detailLoading ? '加载中…' : detailError || '选择左侧线索查看详情与跟进记录。'}</p>}
          {detail && (
            <div className="space-y-4">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-semibold text-neutral-900">{detail.prospect.companyName}</h2>
                  <select
                    value={detail.prospect.status}
                    onChange={event => void updateStatus(event.target.value as GrowthProspectStatus)}
                    disabled={busy}
                    aria-label="线索状态"
                    className="rounded-lg border border-neutral-200 px-2 py-1 text-[11px] text-neutral-700 disabled:opacity-50"
                  >
                    {growthProspectStatuses.map(status => <option key={status} value={status}>{growthProspectStatusLabels[status]}</option>)}
                  </select>
                </div>
                <dl className="mt-2 space-y-1 text-[11px] text-neutral-600">
                  <div>联系人：{detail.prospect.contactName || '—'}</div>
                  <div>邮箱：{detail.prospect.email || '—'}</div>
                  <div>电话：{detail.prospect.phone || '—'}</div>
                  <div>网站：{detail.prospect.website || '—'}</div>
                  <div>来源：{detail.prospect.source === 'manual' ? '人工录入' : detail.prospect.source === 'import' ? '搜索导入' : 'AI 调研'} {detail.prospect.sourceUrl ? `· ${detail.prospect.sourceUrl}` : ''}</div>
                </dl>
              </div>

              <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3">
                <h3 className="text-xs font-semibold text-neutral-900">新增跟进</h3>
                <textarea value={followUpNote} onChange={event => setFollowUpNote(event.target.value)} maxLength={1000} rows={2} className="mt-2 w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs" placeholder="记录沟通结果与下一步" />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select value={followUpCategory} onChange={event => setFollowUpCategory(event.target.value)} className="rounded-lg border border-neutral-200 px-2 py-1 text-[11px]">
                    <option value="sales">销售</option>
                    <option value="activation">激活</option>
                    <option value="retention">留存</option>
                    <option value="service">服务</option>
                  </select>
                  <input type="datetime-local" value={followUpDueAt} onChange={event => setFollowUpDueAt(event.target.value)} className="rounded-lg border border-neutral-200 px-2 py-1 text-[11px]" />
                  <button type="button" onClick={() => void addFollowUp()} disabled={busy} className="rounded-lg bg-neutral-950 px-2.5 py-1 text-[11px] font-medium text-white disabled:opacity-50">保存跟进</button>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-neutral-900">跟进记录</h3>
                <ul className="mt-2 space-y-2">
                  {detail.followUps.map(followUp => (
                    <li key={followUp.id} className="rounded-lg border border-neutral-100 p-2 text-[11px]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-neutral-500">{new Date(followUp.createdAt).toLocaleString('zh-CN')} · {followUp.category}</span>
                        {followUp.status === 'open' ? (
                          <button type="button" onClick={() => void completeFollowUp(followUp.id)} disabled={busy} className="text-neutral-700 underline disabled:opacity-50">完成</button>
                        ) : <span className="text-neutral-400">已完成</span>}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-neutral-800">{followUp.note}</p>
                    </li>
                  ))}
                  {detail.followUps.length === 0 && <li className="text-[11px] text-neutral-500">暂无跟进记录。</li>}
                </ul>
              </div>
            </div>
          )}
        </article>
      </div>

      <details
        className="rounded-xl border border-neutral-200 bg-white p-4"
        onToggle={event => setShowPartnerNetwork((event.currentTarget as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer text-sm font-semibold text-neutral-900">代理网络</summary>
        <p className="mt-1 text-[11px] text-neutral-500">沿用原「Partner 管理」页面：代理账号、推广链接与归属注册保持原有数据。</p>
        <div className="mt-3">{showPartnerNetwork && <AdminPartnerGrowth embedded />}</div>
      </details>
    </section>
  );
};


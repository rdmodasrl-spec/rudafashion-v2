import React, { useCallback, useEffect, useState } from 'react';
import { Check, ImageOff, LoaderCircle, RefreshCw, ShieldAlert, Tags, UserRound, X } from 'lucide-react';
import { apiGet, apiPatch } from '../../../../api/client';
import { AdminFashionTaxonomy } from './AdminFashionTaxonomy';
import { AdminFashionUserActions } from './AdminFashionUserActions';
import { AdminFashionMediaMonitor } from './AdminFashionMediaMonitor';

type ModerationTarget = {
  type: 'post' | 'comment';
  id: string;
  title?: string;
  text?: string;
  image?: string;
  displayName?: string;
  publicationStatus?: string;
  status?: string;
};

type ModerationReport = {
  id: string;
  targetType: 'post' | 'comment';
  targetId: string;
  detail: string | null;
  reason: string;
  status: 'pending' | 'reviewing' | 'resolved' | 'rejected';
  resolution: string | null;
  handledBy: string | null;
  createdAt: string;
  target: ModerationTarget | null;
};

type ModerationAppeal = {
  id: string;
  targetType: 'post' | 'comment';
  targetId: string;
  message: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  target: ModerationTarget | null;
};

const reasonLabels: Record<string, string> = {
  copyright: '侵犯版权',
  violence: '暴力危险',
  sexual: '不适宜内容',
  harassment: '骚扰仇恨',
  spam: '垃圾广告',
  misinformation: '虚假信息',
  other: '其他'
};

const reportStatusLabels: Record<string, string> = {
  pending: '待处理',
  reviewing: '审核中',
  resolved: '已处理',
  rejected: '已驳回'
};

const reportStatusClass: Record<string, string> = {
  pending: 'border-amber-200 bg-amber-50 text-amber-700',
  reviewing: 'border-sky-200 bg-sky-50 text-sky-700',
  resolved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  rejected: 'border-neutral-200 bg-neutral-100 text-neutral-600'
};

const formatTime = (value: string) => {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toLocaleString('zh-CN', { hour12: false }) : value;
};

export const AdminFashionReports: React.FC = () => {
  const [tab, setTab] = useState<'reports' | 'appeals' | 'users' | 'taxonomy' | 'media'>('reports');
  const [status, setStatus] = useState<'pending' | 'reviewing' | 'resolved' | 'rejected' | 'all'>('pending');
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [appeals, setAppeals] = useState<ModerationAppeal[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resolution, setResolution] = useState('');
  const [action, setAction] = useState<'none' | 'remove_comment' | 'unpublish_post'>('none');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiGet<{ success: boolean; reports: ModerationReport[]; counts: Record<string, number> }>(
        `/api/admin/fashion/reports?status=${status}`
      );
      setReports(result.reports || []);
      setCounts(result.counts || {});
      setSelectedId(previous => previous && (result.reports || []).some(report => report.id === previous)
        ? previous
        : (result.reports || [])[0]?.id || null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '举报列表加载失败');
    } finally {
      setLoading(false);
    }
  }, [status]);

  const loadAppeals = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiGet<{ success: boolean; appeals: ModerationAppeal[] }>('/api/admin/fashion/appeals?status=pending');
      setAppeals(result.appeals || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '申诉列表加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'reports') void loadReports();
    else if (tab === 'appeals') void loadAppeals();
  }, [tab, loadReports, loadAppeals]);

  const selected = reports.find(report => report.id === selectedId) || null;
  const availableActions = selected && selected.targetType === 'post'
    ? (['none', 'unpublish_post'] as const)
    : (['none', 'remove_comment'] as const);

  const handleReport = async (decision: 'resolved' | 'rejected') => {
    if (!selected) return;
    const chosenAction = decision === 'rejected' ? 'none' : action;
    if (decision === 'resolved' && chosenAction !== 'none' && !resolution.trim()) {
      setError('执行下架或删除前，请填写处理说明，便于后续审计与申诉。');
      return;
    }
    setBusy(selected.id);
    setError('');
    try {
      await apiPatch(`/api/admin/fashion/reports/${selected.id}`, {
        status: decision,
        action: chosenAction,
        resolution: resolution.trim()
      });
      setResolution('');
      setAction('none');
      await loadReports();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : '处理失败');
    } finally {
      setBusy(null);
    }
  };

  const handleAppeal = async (appeal: ModerationAppeal, decision: 'accepted' | 'rejected') => {
    setBusy(appeal.id);
    setError('');
    try {
      await apiPatch(`/api/admin/fashion/appeals/${appeal.id}`, {
        decision,
        resolution: decision === 'accepted' ? '复核通过，恢复内容' : '维持原处理结果'
      });
      await loadAppeals();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : '申诉处理失败');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white shadow-xs">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-neutral-700" />
          <h2 className="text-sm font-semibold text-neutral-900">社区治理</h2>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">待处理 {counts.pending || 0}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap rounded-full border border-neutral-200 p-0.5 text-[11px]">
            <button type="button" onClick={() => setTab('reports')} className={`rounded-full px-3 py-1 ${tab === 'reports' ? 'bg-neutral-900 text-white' : 'text-neutral-600'}`}>举报队列</button>
            <button type="button" onClick={() => setTab('appeals')} className={`rounded-full px-3 py-1 ${tab === 'appeals' ? 'bg-neutral-900 text-white' : 'text-neutral-600'}`}>申诉</button>
            <button type="button" onClick={() => setTab('users')} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ${tab === 'users' ? 'bg-neutral-900 text-white' : 'text-neutral-600'}`}>
              <UserRound className="h-3 w-3" />违规用户
            </button>
            <button type="button" onClick={() => setTab('taxonomy')} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ${tab === 'taxonomy' ? 'bg-neutral-900 text-white' : 'text-neutral-600'}`}>
              <Tags className="h-3 w-3" />分类标签
            </button>
            <button type="button" onClick={() => setTab('media')} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ${tab === 'media' ? 'bg-neutral-900 text-white' : 'text-neutral-600'}`}>
              <ImageOff className="h-3 w-3" />媒体异常
            </button>
          </div>
          {(tab === 'reports' || tab === 'appeals') && (
            <button type="button" onClick={() => tab === 'reports' ? void loadReports() : void loadAppeals()} className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-600 hover:bg-neutral-50" aria-label="刷新举报列表">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </header>
      {error && <p className="border-b border-rose-100 bg-rose-50 px-4 py-2 text-[11px] text-rose-700">{error}</p>}

      {tab === 'users' || tab === 'taxonomy' || tab === 'media' ? (
        <div className="p-4">
          {tab === 'users' && <AdminFashionUserActions />}
          {tab === 'taxonomy' && <AdminFashionTaxonomy />}
          {tab === 'media' && <AdminFashionMediaMonitor />}
        </div>
      ) : tab === 'reports' ? (
        <>
          <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 px-4 py-2 text-[11px]">
            {(['pending', 'reviewing', 'resolved', 'rejected', 'all'] as const).map(option => (
              <button key={option} type="button" onClick={() => setStatus(option)} className={`rounded-full px-2.5 py-1 ${status === option ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'}`}>
                {option === 'all' ? '全部' : reportStatusLabels[option]}
              </button>
            ))}
          </div>
          <div className="grid gap-0 lg:grid-cols-[1.15fr_1fr]">
            <div className="max-h-[28rem] overflow-y-auto border-b border-neutral-100 lg:border-b-0 lg:border-r">
              {loading && reports.length === 0 ? (
                <div className="flex justify-center py-10"><LoaderCircle className="h-5 w-5 animate-spin text-neutral-400" /></div>
              ) : reports.length === 0 ? (
                <div className="px-4 py-10 text-center text-[11px] text-neutral-500">当前筛选下没有举报。</div>
              ) : reports.map(report => (
                <button
                  key={report.id}
                  type="button"
                  onClick={() => { setSelectedId(report.id); setResolution(''); setAction('none'); }}
                  className={`block w-full border-b border-neutral-100 px-4 py-3 text-left transition-colors ${selectedId === report.id ? 'bg-neutral-50' : 'hover:bg-neutral-50'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-neutral-900">{reasonLabels[report.reason] || report.reason} · {report.targetType === 'post' ? '作品' : '评论'}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-medium ${reportStatusClass[report.status] || ''}`}>{reportStatusLabels[report.status]}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] text-neutral-600">{report.detail || report.target?.text || report.target?.title || report.targetId}</p>
                  <p className="mt-1 text-[10px] text-neutral-400">{formatTime(report.createdAt)}</p>
                </button>
              ))}
            </div>
            <div className="p-4">
              {!selected ? (
                <div className="flex h-full min-h-40 items-center justify-center text-[11px] text-neutral-500">选择左侧举报查看详情</div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-semibold text-neutral-900">举报 #{selected.id.slice(0, 8)}</h3>
                    <span className={`rounded-full border px-2 py-0.5 text-[9px] ${reportStatusClass[selected.status] || ''}`}>{reportStatusLabels[selected.status]}</span>
                  </div>
                  <dl className="space-y-1 text-[11px] text-neutral-600">
                    <div className="flex justify-between gap-2"><dt>原因</dt><dd className="text-neutral-900">{reasonLabels[selected.reason] || selected.reason}</dd></div>
                    <div className="flex justify-between gap-2"><dt>时间</dt><dd>{formatTime(selected.createdAt)}</dd></div>
                    <div className="flex justify-between gap-2"><dt>处理人</dt><dd>{selected.handledBy || '—'}</dd></div>
                  </dl>
                  {selected.detail && <p className="rounded-lg bg-neutral-50 p-2 text-[11px] leading-5 text-neutral-700">{selected.detail}</p>}
                  <div className="rounded-lg border border-neutral-200 p-2">
                    {selected.target?.type === 'post' && selected.target.image && <img src={selected.target.image} alt="" className="mb-2 max-h-32 w-full rounded object-cover" />}
                    <p className="text-[11px] font-medium text-neutral-900">{selected.target?.title || selected.target?.displayName || '内容已删除或不可见'}</p>
                    {selected.target?.text && <p className="mt-1 line-clamp-4 text-[11px] leading-5 text-neutral-600">{selected.target.text}</p>}
                    {selected.target?.publicationStatus && <p className="mt-1 text-[10px] text-neutral-500">当前状态：{selected.target.publicationStatus}</p>}
                    {selected.target?.status && <p className="mt-1 text-[10px] text-neutral-500">评论状态：{selected.target.status}</p>}
                  </div>
                  <label className="block text-[11px] font-medium text-neutral-700">
                    处理动作
                    <select value={action} onChange={event => setAction(event.target.value as typeof action)} disabled={selected.status === 'resolved' || selected.status === 'rejected'} className="mt-1 h-9 w-full rounded-lg border border-neutral-200 px-2 text-[11px] outline-none focus:border-neutral-900">
                      {availableActions.map(option => <option key={option} value={option}>{option === 'none' ? '仅标记处理' : option === 'remove_comment' ? '删除该评论' : '下架该作品'}</option>)}
                    </select>
                  </label>
                  <label className="block text-[11px] font-medium text-neutral-700">
                    处理说明
                    <textarea value={resolution} onChange={event => setResolution(event.target.value.slice(0, 1000))} rows={2} placeholder="记录处理依据" className="mt-1 w-full rounded-lg border border-neutral-200 p-2 text-[11px] outline-none focus:border-neutral-900" />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={busy === selected.id || selected.status === 'resolved' || selected.status === 'rejected'} onClick={() => void handleReport('resolved')} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-neutral-900 px-4 text-[11px] font-semibold text-white disabled:opacity-40">
                      {busy === selected.id ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}确认处理
                    </button>
                    <button type="button" disabled={busy === selected.id || selected.status === 'resolved' || selected.status === 'rejected'} onClick={() => void handleReport('rejected')} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-neutral-300 px-4 text-[11px] font-medium text-neutral-700 disabled:opacity-40">
                      <X className="h-3 w-3" />驳回举报
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </>
      ) : (
        <div className="p-4">
          {loading ? (
            <div className="flex justify-center py-10"><LoaderCircle className="h-5 w-5 animate-spin text-neutral-400" /></div>
          ) : appeals.length === 0 ? (
            <div className="py-10 text-center text-[11px] text-neutral-500">暂无待处理申诉。</div>
          ) : (
            <div className="space-y-2">
              {appeals.map(appeal => (
                <article key={appeal.id} className="rounded-xl border border-neutral-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold text-neutral-900">{appeal.targetType === 'post' ? '作品申诉' : '评论申诉'} · {appeal.target?.title || appeal.target?.displayName || appeal.targetId}</p>
                    <span className="text-[10px] text-neutral-400">{formatTime(appeal.createdAt)}</span>
                  </div>
                  {appeal.target?.text && <p className="mt-1 line-clamp-2 text-[11px] text-neutral-600">{appeal.target.text}</p>}
                  <p className="mt-2 rounded-lg bg-neutral-50 p-2 text-[11px] leading-5 text-neutral-700">{appeal.message}</p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" disabled={busy === appeal.id} onClick={() => void handleAppeal(appeal, 'accepted')} className="inline-flex min-h-8 items-center gap-1 rounded-full bg-neutral-900 px-3 text-[11px] font-medium text-white disabled:opacity-40">
                      {busy === appeal.id ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}通过并恢复
                    </button>
                    <button type="button" disabled={busy === appeal.id} onClick={() => void handleAppeal(appeal, 'rejected')} className="inline-flex min-h-8 items-center gap-1 rounded-full border border-neutral-300 px-3 text-[11px] font-medium text-neutral-700 disabled:opacity-40">
                      <X className="h-3 w-3" />维持处理
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

        </div>
      )}

    </section>
  );
};

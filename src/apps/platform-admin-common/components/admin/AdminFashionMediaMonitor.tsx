import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, LoaderCircle, RefreshCw, RotateCcw, ShieldOff } from 'lucide-react';
import { apiGet, apiPost } from '../../../../api/client';

type MediaEvent = {
  id: string;
  postId: string | null;
  stage: 'upload' | 'poster' | 'access' | 'transcode';
  status: 'failed' | 'resolved' | 'ignored';
  code: string;
  detail: string | null;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  resolvedAt: string | null;
  post: { id: string; title: string | null; text: string | null; image: string; publicationStatus: string } | null;
};

const stageLabels: Record<MediaEvent['stage'], string> = {
  upload: '上传存储',
  poster: '封面生成',
  access: '媒体访问',
  transcode: '视频转码'
};

const statusLabels: Record<MediaEvent['status'], string> = {
  failed: '待处理',
  resolved: '已恢复',
  ignored: '已忽略'
};

const statusClass: Record<MediaEvent['status'], string> = {
  failed: 'border-rose-200 bg-rose-50 text-rose-700',
  resolved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  ignored: 'border-neutral-200 bg-neutral-100 text-neutral-600'
};

const formatTime = (value: string | null) => {
  if (!value) return '—';
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toLocaleString('zh-CN', { hour12: false }) : value;
};

export const AdminFashionMediaMonitor: React.FC = () => {
  const [status, setStatus] = useState<'failed' | 'resolved' | 'ignored' | 'all'>('failed');
  const [stage, setStage] = useState('');
  const [events, setEvents] = useState<MediaEvent[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiGet<{ success: boolean; events: MediaEvent[]; counts: Record<string, number> }>(
        `/api/admin/fashion/media-events?status=${status}${stage ? `&stage=${stage}` : ''}`
      );
      setEvents(result.events || []);
      setCounts(result.counts || {});
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '媒体异常加载失败');
    } finally {
      setLoading(false);
    }
  }, [status, stage]);

  useEffect(() => { void load(); }, [load]);

  const retry = async (event: MediaEvent) => {
    setBusy(event.id);
    setError('');
    setNotice('');
    try {
      const result = await apiPost<{ success: boolean; resolved: boolean; checked: number; missing: string[] }>(
        `/api/admin/fashion/media-events/${event.id}/retry`,
        {}
      );
      setNotice(result.resolved
        ? `复查通过，${result.checked} 个媒体对象均可访问，异常已关闭。`
        : `复查完成，仍有 ${result.missing.length} 个对象缺失，已记录重试次数。`);
      await load();
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : '重试失败');
    } finally {
      setBusy(null);
    }
  };

  const ignore = async (event: MediaEvent) => {
    setBusy(event.id);
    setError('');
    setNotice('');
    try {
      await apiPost(`/api/admin/fashion/media-events/${event.id}/ignore`, { reason: '人工确认无需处理' });
      setNotice('已标记为忽略，保留记录与操作审计。');
      await load();
    } catch (ignoreError) {
      setError(ignoreError instanceof Error ? ignoreError.message : '操作失败');
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-neutral-200 p-0.5 text-[11px]">
            {(['failed', 'resolved', 'ignored', 'all'] as const).map(key => (
              <button
                key={key}
                type="button"
                onClick={() => setStatus(key)}
                className={`rounded-full px-3 py-1 ${status === key ? 'bg-neutral-900 text-white' : 'text-neutral-600'}`}
              >
                {key === 'all' ? '全部' : statusLabels[key]}{key !== 'all' && counts[key] ? ` ${counts[key]}` : ''}
              </button>
            ))}
          </div>
          <label>
            <span className="sr-only">媒体阶段</span>
            <select
              value={stage}
              onChange={event => setStage(event.target.value)}
              className="h-8 rounded-lg border border-neutral-200 bg-white px-2 text-[11px]"
            >
              <option value="">全部阶段</option>
              {Object.entries(stageLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-neutral-200 px-3 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />刷新
        </button>
      </div>

      {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] text-rose-700">{error}</p>}
      {notice && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">{notice}</p>}

      {loading && !events.length ? (
        <div className="flex justify-center py-10"><LoaderCircle className="h-5 w-5 animate-spin text-neutral-400" /></div>
      ) : events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-200 px-4 py-10 text-center">
          <AlertTriangle className="mx-auto h-5 w-5 text-neutral-300" />
          <p className="mt-2 text-[11px] text-neutral-500">当前筛选下没有媒体异常。</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {events.map(event => (
            <li key={event.id} className="rounded-xl border border-neutral-200 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2.5">
                  {event.post ? (
                    <img src={event.post.image} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-400">
                      <AlertTriangle className="h-4 w-4" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold text-neutral-900">
                      {event.post?.title || event.post?.text || event.postId || '未关联作品'}
                    </p>
                    <p className="mt-0.5 text-[10px] text-neutral-500">
                      {stageLabels[event.stage]} · {event.code} · 重试 {event.attempts} 次
                    </p>
                    {event.lastError && <p className="mt-1 line-clamp-2 text-[10px] text-rose-700">{event.lastError}</p>}
                    {event.detail && <p className="mt-0.5 line-clamp-2 text-[10px] text-neutral-500">{event.detail}</p>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] ${statusClass[event.status]}`}>
                    {statusLabels[event.status]}
                  </span>
                  <span className="text-[10px] text-neutral-400">{formatTime(event.createdAt)}</span>
                </div>
              </div>
              {event.status === 'failed' && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void retry(event)}
                    disabled={busy === event.id}
                    className="inline-flex h-8 items-center gap-1 rounded-md bg-neutral-900 px-2.5 text-[11px] font-medium text-white disabled:opacity-40"
                  >
                    {busy === event.id ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}复核并重试
                  </button>
                  <button
                    type="button"
                    onClick={() => void ignore(event)}
                    disabled={busy === event.id}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-neutral-300 px-2.5 text-[11px] font-medium text-neutral-700 disabled:opacity-40"
                  >
                    <ShieldOff className="h-3 w-3" />忽略
                  </button>
                </div>
              )}
              {event.status !== 'failed' && event.resolvedAt && (
                <p className="mt-1.5 text-[10px] text-neutral-500">处理时间 {formatTime(event.resolvedAt)}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};


import React, { useEffect, useState } from 'react';
import { RefreshCw, RotateCcw } from 'lucide-react';
import { apiGet, apiPost } from '../../../../api/client';

type NotificationEvent = {
  id: string;
  eventType: string;
  channel: string;
  status: 'pending' | 'sent' | 'failed' | string;
  attempts: number;
  lastError?: string | null;
  payload?: string;
  createdAt: string;
  updatedAt: string;
};

type StatusFilter = 'all' | 'pending' | 'sent' | 'failed';

function getDeadLetterDetails(event: NotificationEvent): {
  taskId: string;
  taskType: string;
  tenantId: string | null;
  errorCode: string;
} | null {
  if (event.eventType !== 'modagpt.task.dead_letter' || !event.payload) return null;
  try {
    const payload: unknown = JSON.parse(event.payload);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    const value = payload as Record<string, unknown>;
    if (typeof value.referenceId !== 'string'
      || typeof value.taskType !== 'string'
      || (value.tenantId !== null && typeof value.tenantId !== 'string')
      || typeof value.errorCode !== 'string') return null;
    return {
      taskId: value.referenceId,
      taskType: value.taskType,
      tenantId: typeof value.tenantId === 'string' ? value.tenantId : null,
      errorCode: value.errorCode
    };
  } catch {
    return null;
  }
}

export const AdminNotificationEvents: React.FC = () => {
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadEvents = async () => {
    setLoading(true);
    setError('');
    try {
      const query = filter === 'all' ? '' : `?status=${filter}`;
      const result = await apiGet<{ events: NotificationEvent[] }>(`/api/admin/notifications${query}`);
      setEvents(result.events);
      setLastUpdated(new Date());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '通知事件加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadEvents(); }, [filter]);

  const retry = async (event: NotificationEvent) => {
    if (retryingId) return;
    setRetryingId(event.id);
    setError('');
    setMessage('');
    try {
      await apiPost(`/api/admin/notifications/${encodeURIComponent(event.id)}/retry`, {});
      setMessage(`事件 ${event.id} 已重新排入发送队列；队列处理后可刷新确认最终状态。`);
      await loadEvents();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '重试失败。请确认 notifications.manage 权限并重试。');
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 p-4">
        <div>
          <h2 className="text-sm font-bold text-neutral-900">投递记录</h2>
          <p className="mt-1 text-xs text-neutral-500">失败事件可重新排队；重试操作需要 notifications.manage 权限。最近成功更新：{lastUpdated?.toLocaleString() ?? '尚未成功读取'}</p>
        </div>
        <div className="flex items-center gap-2">
          <select aria-label="通知事件状态筛选" value={filter} onChange={event => setFilter(event.target.value as StatusFilter)} className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs">
            <option value="all">全部状态</option>
            <option value="pending">待发送</option>
            <option value="sent">已发送</option>
            <option value="failed">发送失败</option>
          </select>
          <button type="button" onClick={() => void loadEvents()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />刷新
          </button>
        </div>
      </div>
      {message && <p role="status" className="m-4 rounded-lg border border-neutral-300 bg-neutral-50 p-3 text-xs text-neutral-800">{message}</p>}
      {error && <p role="alert" className="m-4 rounded-lg border border-neutral-300 bg-neutral-50 p-3 text-xs text-neutral-800">通知操作失败：{error}<button type="button" onClick={() => void loadEvents()} className="ml-2 underline">重试加载</button></p>}
      <div className="divide-y divide-neutral-100">
        {events.map(event => {
          const deadLetter = getDeadLetterDetails(event);
          return (
          <article key={event.id} className="grid gap-2 p-4 text-xs sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-neutral-900">{event.eventType}</span>
                <span className="rounded-full border border-neutral-300 bg-neutral-50 px-2 py-0.5 text-[10px] text-neutral-700">{event.status}</span>
                <span className="text-neutral-600">{event.channel}</span>
              </div>
              {deadLetter && <p className="mt-1 break-words text-[11px] text-rose-800">
                Task {deadLetter.taskId} · {deadLetter.taskType} · tenant {deadLetter.tenantId || 'platform'} · {deadLetter.errorCode}
              </p>}
              {event.eventType === 'growth.crm.follow_up.due' && <p className="mt-1 text-[11px] text-amber-800">内部 CRM 跟进任务已到期，请打开 Growth Center 查看。此通知不会发送给客户。</p>}
              <p className="mt-1 text-[11px] text-neutral-500">尝试 {event.attempts} 次 · 创建 {new Date(event.createdAt).toLocaleString()} · 更新 {new Date(event.updatedAt).toLocaleString()}</p>
              {event.lastError && <p className="mt-1 break-words text-[11px] text-neutral-700">{event.lastError}</p>}
            </div>
            {event.status === 'failed' && <button type="button" onClick={() => void retry(event)} disabled={retryingId !== null} className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-400 px-3 py-2 font-semibold text-neutral-900 disabled:opacity-50">
              <RotateCcw className="h-3.5 w-3.5" />{retryingId === event.id ? '正在排队…' : '重新发送'}
            </button>}
          </article>
          );
        })}
        {!loading && !error && events.length === 0 && <p className="p-8 text-center text-xs text-neutral-500">当前筛选下暂无通知事件</p>}
        {loading && events.length === 0 && <p className="p-8 text-center text-xs text-neutral-500">正在读取通知事件…</p>}
      </div>
    </section>
  );
};

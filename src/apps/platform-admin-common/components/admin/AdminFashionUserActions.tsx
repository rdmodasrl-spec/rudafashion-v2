import React, { useCallback, useEffect, useState } from 'react';
import { LoaderCircle, Search, ShieldOff, ShieldCheck, UserRound } from 'lucide-react';
import { apiGet, apiPost } from '../../../../api/client';

type AccountRow = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  postsCount: number;
  publishedCount: number;
  openReports: number;
  restriction: {
    id: string;
    kind: string;
    reason: string;
    appliedAt: string;
    expiresAt: string | null;
  } | null;
};

type AccountPost = {
  id: string;
  title: string | null;
  caption: string | null;
  image: string;
  category: string | null;
  season: string | null;
  publicationStatus: string;
  createdAt: string;
};

type AccountReport = {
  id: string;
  targetId: string;
  reason: string;
  detail: string | null;
  status: string;
  createdAt: string;
};

type AccountRestriction = {
  id: string;
  kind: string;
  reason: string;
  status: string;
  appliedBy: string;
  appliedAt: string;
  expiresAt: string | null;
  liftedAt: string | null;
  liftedReason: string | null;
};

type AccountAppeal = {
  id: string;
  targetType: string;
  targetId: string;
  message: string;
  status: string;
  createdAt: string;
};

type AccountDetail = {
  account: { id: string; displayName: string; bio: string | null; avatarUrl: string | null; createdAt: string };
  posts: AccountPost[];
  reports: AccountReport[];
  restrictions: AccountRestriction[];
  appeals: AccountAppeal[];
};

const formatTime = (value: string | null) => {
  if (!value) return '—';
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toLocaleString('zh-CN', { hour12: false }) : value;
};

const restrictionLabels: Record<string, string> = {
  limited: '限制发布',
  suspended: '暂停互动'
};

const statusLabels: Record<string, string> = {
  approved: '已发布',
  pending: '待审核',
  unpublished: '已下架',
  visible: '显示中',
  removed: '已移除'
};

export const AdminFashionUserActions: React.FC = () => {
  const [query, setQuery] = useState('');
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AccountDetail | null>(null);
  const [kind, setKind] = useState<'limited' | 'suspended'>('limited');
  const [days, setDays] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadAccounts = useCallback(async (search: string) => {
    setLoading(true);
    setError('');
    try {
      const result = await apiGet<{ success: boolean; accounts: AccountRow[] }>(
        `/api/admin/fashion/accounts?limit=25${search ? `&query=${encodeURIComponent(search)}` : ''}`
      );
      setAccounts(result.accounts || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '账号列表加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (accountId: string) => {
    setDetailLoading(true);
    setError('');
    try {
      const result = await apiGet<AccountDetail & { success: boolean }>(`/api/admin/fashion/accounts/${accountId}`);
      setDetail({ account: result.account, posts: result.posts || [], reports: result.reports || [], restrictions: result.restrictions || [], appeals: result.appeals || [] });
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : '账号详情加载失败');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => { void loadAccounts(''); }, [loadAccounts]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const activeRestriction = detail?.restrictions.find(item => item.status === 'active') || null;

  const applyRestriction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detail || reason.trim().length < 4) return;
    setBusy('apply');
    setError('');
    setNotice('');
    try {
      await apiPost(`/api/admin/fashion/accounts/${detail.account.id}/restrictions`, {
        kind,
        reason: reason.trim(),
        ...(days.trim() ? { days: Number(days) } : {})
      });
      setReason('');
      setDays('');
      setNotice(kind === 'suspended' ? '已暂停该账号互动权限，并发送站内通知。' : '已限制该账号发布与评论权限，并发送站内通知。');
      await Promise.all([loadDetail(detail.account.id), loadAccounts(query.trim())]);
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : '处置失败');
    } finally {
      setBusy(null);
    }
  };

  const liftRestriction = async (restrictionId: string) => {
    setBusy(restrictionId);
    setError('');
    setNotice('');
    try {
      await apiPost(`/api/admin/fashion/restrictions/${restrictionId}/lift`, { reason: '复核通过，解除限制' });
      setNotice('限制已解除。');
      if (detail) await Promise.all([loadDetail(detail.account.id), loadAccounts(query.trim())]);
    } catch (liftError) {
      setError(liftError instanceof Error ? liftError.message : '解除失败');
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="space-y-4">
      <form
        onSubmit={event => { event.preventDefault(); setSelectedId(null); void loadAccounts(query.trim()); }}
        className="flex flex-wrap items-center gap-2"
      >
        <label className="relative min-w-[200px] flex-1">
          <span className="sr-only">搜索账号</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
          <input
            value={query}
            onChange={event => setQuery(event.target.value.slice(0, 60))}
            placeholder="按昵称搜索账号"
            className="h-9 w-full rounded-lg border border-neutral-200 pl-9 pr-3 text-xs outline-none focus:border-neutral-800"
          />
        </label>
        <button type="submit" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-neutral-900 px-4 text-xs font-medium text-white">搜索</button>
      </form>

      {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] text-rose-700">{error}</p>}
      {notice && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">{notice}</p>}

      <div className="grid gap-4 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-xl border border-neutral-200">
          <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2">
            <p className="text-[11px] font-semibold text-neutral-800">账号</p>
            <span className="text-[10px] text-neutral-400">{accounts.length} 个</span>
          </div>
          {loading ? (
            <div className="flex justify-center py-8"><LoaderCircle className="h-4 w-4 animate-spin text-neutral-400" /></div>
          ) : accounts.length === 0 ? (
            <p className="px-3 py-8 text-center text-[11px] text-neutral-500">没有匹配的账号。</p>
          ) : (
            <ul className="max-h-[560px] divide-y divide-neutral-100 overflow-y-auto">
              {accounts.map(account => (
                <li key={account.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(account.id)}
                    className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-neutral-50 ${selectedId === account.id ? 'bg-neutral-50' : ''}`}
                  >
                    {account.avatarUrl ? (
                      <img src={account.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" loading="lazy" />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-500"><UserRound className="h-3.5 w-3.5" /></span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[11px] font-medium text-neutral-900">{account.displayName || '未命名账号'}</span>
                        {account.restriction && (
                          <span className="rounded-full border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[9px] text-rose-700">
                            {restrictionLabels[account.restriction.kind] || '已处置'}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-neutral-500">
                        作品 {account.publishedCount}/{account.postsCount} · 待处理举报 {account.openReports}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="min-w-0">
          {!selectedId ? (
            <p className="rounded-xl border border-dashed border-neutral-200 px-4 py-10 text-center text-[11px] text-neutral-500">
              选择左侧账号查看作品、举报、处置与申诉记录。
            </p>
          ) : detailLoading && !detail ? (
            <div className="flex justify-center py-10"><LoaderCircle className="h-5 w-5 animate-spin text-neutral-400" /></div>
          ) : detail ? (
            <div className="space-y-4">
              <section className="rounded-xl border border-neutral-200 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{detail.account.displayName || '未命名账号'}</p>
                    <p className="mt-0.5 text-[10px] text-neutral-500">
                      注册 {formatTime(detail.account.createdAt)} · 作品 {detail.posts.length} · 举报 {detail.reports.length}
                    </p>
                  </div>
                  {activeRestriction ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] text-rose-700">
                      <ShieldOff className="h-3 w-3" />{restrictionLabels[activeRestriction.kind] || '已处置'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">
                      <ShieldCheck className="h-3 w-3" />正常
                    </span>
                  )}
                </div>
                {detail.account.bio && <p className="mt-2 line-clamp-2 text-[11px] text-neutral-600">{detail.account.bio}</p>}

                {activeRestriction ? (
                  <div className="mt-3 rounded-lg bg-rose-50 p-2.5">
                    <p className="text-[11px] text-rose-800">处置原因：{activeRestriction.reason}</p>
                    <p className="mt-1 text-[10px] text-rose-700">
                      {formatTime(activeRestriction.appliedAt)} · {activeRestriction.expiresAt ? `至 ${formatTime(activeRestriction.expiresAt)}` : '长期有效'} · 操作人 {activeRestriction.appliedBy}
                    </p>
                    <button
                      type="button"
                      onClick={() => void liftRestriction(activeRestriction.id)}
                      disabled={busy === activeRestriction.id}
                      className="mt-2 inline-flex h-8 items-center gap-1 rounded-md border border-rose-300 bg-white px-2.5 text-[11px] font-medium text-rose-800 disabled:opacity-40"
                    >
                      {busy === activeRestriction.id ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}解除限制
                    </button>
                  </div>
                ) : (
                  <form onSubmit={event => void applyRestriction(event)} className="mt-3 grid gap-2 sm:grid-cols-[120px_110px_minmax(0,1fr)_auto]">
                    <label className="block">
                      <span className="sr-only">处置类型</span>
                      <select
                        value={kind}
                        onChange={event => setKind(event.target.value === 'suspended' ? 'suspended' : 'limited')}
                        className="h-9 w-full rounded-lg border border-neutral-200 px-2 text-[11px]"
                      >
                        <option value="limited">限制发布</option>
                        <option value="suspended">暂停互动</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="sr-only">有效天数</span>
                      <input
                        value={days}
                        onChange={event => setDays(event.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
                        placeholder="天数/留空"
                        className="h-9 w-full rounded-lg border border-neutral-200 px-2 text-[11px] outline-none focus:border-neutral-800"
                      />
                    </label>
                    <label className="block">
                      <span className="sr-only">处置原因</span>
                      <input
                        value={reason}
                        onChange={event => setReason(event.target.value.slice(0, 500))}
                        placeholder="处置原因（至少 4 个字）"
                        className="h-9 w-full rounded-lg border border-neutral-200 px-3 text-[11px] outline-none focus:border-neutral-800"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={busy === 'apply' || reason.trim().length < 4}
                      className="inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-neutral-900 px-3 text-[11px] font-semibold text-white disabled:opacity-40"
                    >
                      {busy === 'apply' ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <ShieldOff className="h-3 w-3" />}执行处置
                    </button>
                    <p className="text-[10px] leading-4 text-neutral-500 sm:col-span-4">
                      限制发布仅禁止发布与评论；暂停互动还会禁止点赞和关注。处置会记录管理员、原因和有效期，并通知作者。
                    </p>
                  </form>
                )}
              </section>
              <section className="rounded-xl border border-neutral-200 p-3">
                <p className="text-[11px] font-semibold text-neutral-800">作品</p>
                {detail.posts.length === 0 ? (
                  <p className="py-6 text-center text-[11px] text-neutral-500">该账号暂无作品。</p>
                ) : (
                  <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {detail.posts.slice(0, 8).map(post => (
                      <li key={post.id} className="overflow-hidden rounded-lg border border-neutral-200">
                        <img src={post.image} alt={post.title || '作品'} loading="lazy" className="h-24 w-full object-cover" />
                        <div className="p-2">
                          <p className="truncate text-[10px] font-medium text-neutral-800">{post.title || '未命名作品'}</p>
                          <p className="mt-0.5 text-[9px] text-neutral-500">
                            {statusLabels[post.publicationStatus] || post.publicationStatus} · {post.category || '未分类'}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <div className="grid gap-4 sm:grid-cols-2">
                <section className="rounded-xl border border-neutral-200 p-3">
                  <p className="text-[11px] font-semibold text-neutral-800">相关举报</p>
                  {detail.reports.length === 0 ? (
                    <p className="py-4 text-[11px] text-neutral-500">暂无举报记录。</p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {detail.reports.slice(0, 6).map(report => (
                        <li key={report.id} className="rounded-lg bg-neutral-50 px-2 py-1.5 text-[10px] text-neutral-700">
                          {report.reason} · {report.status} · {formatTime(report.createdAt)}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <section className="rounded-xl border border-neutral-200 p-3">
                  <p className="text-[11px] font-semibold text-neutral-800">处置记录</p>
                  {detail.restrictions.length === 0 ? (
                    <p className="py-4 text-[11px] text-neutral-500">暂无处置记录。</p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {detail.restrictions.map(item => (
                        <li key={item.id} className="rounded-lg bg-neutral-50 px-2 py-1.5 text-[10px] text-neutral-700">
                          {restrictionLabels[item.kind] || item.kind} · {item.status} · {formatTime(item.appliedAt)}
                          <span className="block text-[9px] text-neutral-500">{item.reason}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>

              {detail.appeals.length > 0 && (
                <section className="rounded-xl border border-neutral-200 p-3">
                  <p className="text-[11px] font-semibold text-neutral-800">申诉</p>
                  <ul className="mt-2 space-y-1.5">
                    {detail.appeals.slice(0, 5).map(appeal => (
                      <li key={appeal.id} className="rounded-lg bg-neutral-50 px-2 py-1.5 text-[10px] text-neutral-700">
                        {appeal.status} · {formatTime(appeal.createdAt)}
                        <span className="block text-[9px] text-neutral-500">{appeal.message}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};




import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Check, ExternalLink, RefreshCw, X } from 'lucide-react';
import { apiGet, apiPut } from '../../../../api/client';
import { AdminPageHeader } from './AdminPageHeader';

/**
 * 平台总后台 → 业务管理 → 模型审核。
 *
 * 只消费 GET /api/admin/model-reviews 与既有的
 * PUT /api/admin/products/:id/media/:mediaId/model-review，不在前端自建审核状态。
 * 契约见 docs/engineering/modules/platform-admin-model-review.md §4、§5.1。
 */

type ModelReviewItem = {
  productId: string;
  productName: string;
  styleNo: string;
  merchantId: string;
  merchantName: string;
  mediaId: string;
  modelUrl: string;
  sizeBytes: number | null;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  credentialValid: boolean;
  updatedAt: string;
  review: {
    reviewerId?: string;
    reviewerUsername?: string;
    reviewedAt?: string;
    decision?: string;
    reason?: string;
  } | null;
};

type ReviewStatusFilter = 'pending' | 'approved' | 'rejected' | 'all';

const STATUS_LABEL: Record<ModelReviewItem['reviewStatus'], string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已驳回'
};

const STATUS_STYLE: Record<ModelReviewItem['reviewStatus'], string> = {
  pending: 'border-neutral-300 bg-neutral-100 text-neutral-800',
  approved: 'border-neutral-900 bg-neutral-900 text-white',
  rejected: 'border-neutral-200 bg-white text-neutral-500'
};

function formatBytes(value: number | null): string {
  if (!value) return '—';
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(2)} MB`;
  return `${Math.max(1, Math.round(value / 1024))} KB`;
}

function formatTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}

export const AdminModelReview: React.FC = () => {
  const [status, setStatus] = useState<ReviewStatusFilter>('pending');
  const [items, setItems] = useState<ModelReviewItem[]>([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<ModelReviewItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async (nextStatus: ReviewStatusFilter) => {
    setLoading(true);
    setError('');
    try {
      const payload = await apiGet<{ items: ModelReviewItem[]; counts: typeof counts }>(
        `/api/admin/model-reviews?status=${nextStatus}&limit=100`
      );
      setItems(payload.items || []);
      setCounts(payload.counts || { pending: 0, approved: 0, rejected: 0 });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '模型审核清单读取失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(status); }, [load, status]);

  const decide = async (item: ModelReviewItem, decision: 'approved' | 'rejected', reason?: string) => {
    const key = `${item.productId}:${item.mediaId}`;
    setBusyKey(key);
    setError('');
    setNotice('');
    try {
      await apiPut(`/api/admin/products/${item.productId}/media/${item.mediaId}/model-review`, {
        decision,
        ...(reason ? { reason } : {})
      });
      setNotice(decision === 'approved' ? '模型已通过，买家端立即可见' : '模型已驳回，买家端不可见');
      setRejecting(null);
      setRejectReason('');
      await load(status);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '审核提交失败');
    } finally {
      setBusyKey(null);
    }
  };

  const summary = useMemo(
    () => `待审核 ${counts.pending} · 已通过 ${counts.approved} · 已驳回 ${counts.rejected}`,
    [counts]
  );

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="模型审核"
        description="商家上传的 3D 商品模型必须在此批准后才会对买家公开；驳回必须填写原因。"
        actions={(
          <button
            type="button"
            onClick={() => void load(status)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 transition hover:border-neutral-400 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        )}
      />

      <div className="flex flex-wrap items-center gap-2">
        {(['pending', 'approved', 'rejected', 'all'] as ReviewStatusFilter[]).map(value => (
          <button
            key={value}
            type="button"
            onClick={() => setStatus(value)}
            aria-pressed={status === value}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              status === value
                ? 'border-neutral-900 bg-neutral-900 text-white'
                : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400'
            }`}
          >
            {value === 'all' ? '全部' : STATUS_LABEL[value]}
          </button>
        ))}
        <span className="text-xs text-neutral-500">{summary}</span>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-neutral-900 bg-neutral-50 px-4 py-3 text-xs font-medium text-neutral-900">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-xs font-medium text-neutral-800">
          {notice}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        {loading && items.length === 0 ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map(row => (
              <div key={row} className="h-14 animate-pulse rounded-lg bg-neutral-100" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <Box className="h-6 w-6 text-neutral-300" />
            <p className="text-sm font-semibold text-neutral-800">暂无{status === 'all' ? '' : STATUS_LABEL[status]}模型</p>
            <p className="text-xs text-neutral-500">商家上传 3D 模型后会出现在这里。</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">商品</th>
                  <th className="px-4 py-3 font-semibold">商家</th>
                  <th className="px-4 py-3 font-semibold">模型</th>
                  <th className="px-4 py-3 font-semibold">状态</th>
                  <th className="px-4 py-3 font-semibold">审核记录</th>
                  <th className="px-4 py-3 text-right font-semibold">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const key = `${item.productId}:${item.mediaId}`;
                  const busy = busyKey === key;
                  return (
                    <tr key={key} className="border-b border-neutral-100 last:border-0 align-top">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-neutral-900">{item.productName}</p>
                        <p className="mt-0.5 text-neutral-500">{item.styleNo} · {item.productId}</p>
                      </td>
                      <td className="px-4 py-3 text-neutral-700">
                        <p>{item.merchantName}</p>
                        <p className="mt-0.5 text-neutral-400">{item.merchantId}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="break-all text-neutral-700">{item.mediaId}</p>
                        <p className="mt-0.5 text-neutral-500">GLB · {formatBytes(item.sizeBytes)}</p>
                        {item.modelUrl && (
                          <a
                            href={item.modelUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="mt-1 inline-flex items-center gap-1 text-neutral-900 underline underline-offset-2 hover:text-black"
                          >
                            预览模型
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[item.reviewStatus]}`}>
                          {STATUS_LABEL[item.reviewStatus]}
                        </span>
                        {item.reviewStatus === 'approved' && !item.credentialValid && (
                          <p className="mt-1 text-xs font-semibold text-neutral-900">
                            缺少有效审核凭证，买家不可见
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {item.review?.reviewedAt ? (
                          <>
                            <p>{item.review.reviewerUsername || item.review.reviewerId || '—'}</p>
                            <p className="mt-0.5 text-neutral-400">{formatTime(item.review.reviewedAt)}</p>
                            {item.review.reason && <p className="mt-1 text-neutral-700">原因：{item.review.reason}</p>}
                          </>
                        ) : (
                          <span className="text-neutral-400">尚未审核</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-start justify-end gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void decide(item, 'approved')}
                            className="inline-flex items-center gap-1 rounded-lg bg-neutral-900 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-black disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" />
                            通过
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => { setRejecting(item); setRejectReason(''); }}
                            className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-800 transition hover:border-neutral-500 disabled:opacity-50"
                          >
                            <X className="h-3.5 w-3.5" />
                            驳回
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-5">
            <h2 className="text-base font-semibold text-neutral-900">驳回模型</h2>
            <p className="mt-1 text-xs text-neutral-500">
              {rejecting.productName} · {rejecting.mediaId}
            </p>
            <label htmlFor="model-reject-reason" className="mt-4 block text-xs font-semibold text-neutral-800">
              驳回原因（必填）
            </label>
            <textarea
              id="model-reject-reason"
              value={rejectReason}
              onChange={event => setRejectReason(event.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs outline-none focus:border-black"
              placeholder="例如：模型比例失真、缺少五金细节"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setRejecting(null); setRejectReason(''); }}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-700 hover:border-neutral-400"
              >
                取消
              </button>
              <button
                type="button"
                disabled={!rejectReason.trim() || busyKey !== null}
                onClick={() => rejecting && void decide(rejecting, 'rejected', rejectReason.trim())}
                className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white hover:bg-black disabled:opacity-50"
              >
                确认驳回
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

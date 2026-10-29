import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { apiGet, apiPatch } from '../../../../api/client';

type FeatureFlag = {
  key: string;
  name: string;
  terminal: string;
  description: string;
  permission: string;
  enabled: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};

type FeatureFlagListResponse = {
  success: true;
  loadError: string | null;
  flags: FeatureFlag[];
};

type FeatureFlagPatchResponse = {
  success: true;
  flag: FeatureFlag;
};

function formatTimestamp(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (input: number) => String(input).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export const AdminFeatureFlags: React.FC = () => {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<FeatureFlag | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiGet<FeatureFlagListResponse>('/api/admin/feature-flags');
      setFlags(Array.isArray(result.flags) ? result.flags : []);
      setLoadError(result.loadError ?? null);
    } catch (loadFailure) {
      setFlags([]);
      setError(loadFailure instanceof Error ? loadFailure.message : '功能开关读取失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const applyToggle = async (flag: FeatureFlag) => {
    if (pendingKey) return;
    setPendingKey(flag.key);
    setError('');
    setNotice('');
    try {
      const result = await apiPatch<FeatureFlagPatchResponse>(
        `/api/admin/feature-flags/${encodeURIComponent(flag.key)}`,
        { enabled: !flag.enabled, expectedUpdatedAt: flag.updatedAt }
      );
      setFlags(current => current.map(item => (
        item.key === result.flag.key ? { ...item, ...result.flag } : item
      )));
      setNotice(`已${result.flag.enabled ? '开启' : '关闭'}「${result.flag.name}」，保存成功。`);
    } catch (updateFailure) {
      setError(updateFailure instanceof Error ? updateFailure.message : '功能开关更新失败');
      // 以服务端最终状态为准，避免界面与权威配置不一致。
      await load();
    } finally {
      setPendingKey(null);
      setConfirming(null);
    }
  };

  const toggle = (flag: FeatureFlag) => {
    if (pendingKey) return;
    // 关闭是有影响的全局操作：先确认，再调用服务端。
    if (flag.enabled) {
      setNotice('');
      setError('');
      setConfirming(flag);
      return;
    }
    void applyToggle(flag);
  };

  return (
    <section className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-950">功能开关</h2>
          <p className="mt-1 text-xs text-neutral-500">平台管理 · 功能开放控制</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex shrink-0 items-center gap-1 border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </header>

      {error && (
        <p role="alert" className="flex items-center gap-1 text-xs text-red-600">
          <AlertTriangle className="h-3.5 w-3.5" />
          {error}
        </p>
      )}
      {loadError && (
        <p role="alert" className="flex items-center gap-1 text-xs text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5" />
          开关配置读取异常（{loadError}），当前按已关闭处理。
        </p>
      )}
      {notice && (
        <p role="status" className="border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">{notice}</p>
      )}

      {confirming && (
        <div role="alertdialog" aria-label={`确认关闭${confirming.name}`} className="border border-neutral-900 bg-white px-4 py-3">
          <p className="text-sm font-semibold text-neutral-950">确认关闭「{confirming.name}」？</p>
          <p className="mt-1 text-xs leading-5 text-neutral-600">
            关闭后 {confirming.terminal} 将立即隐藏入口，服务端同时拒绝相关操作；已有数据不会删除，可随时重新开启。
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              disabled={pendingKey === confirming.key}
              onClick={() => void applyToggle(confirming)}
              className="border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-xs text-white disabled:opacity-50"
            >
              {pendingKey === confirming.key ? '保存中…' : '确认关闭'}
            </button>
            <button
              type="button"
              disabled={pendingKey === confirming.key}
              onClick={() => setConfirming(null)}
              className="border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700 disabled:opacity-50"
            >
              取消
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto border border-neutral-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
            <tr>
              <th className="px-3 py-2 font-medium">功能</th>
              <th className="hidden px-3 py-2 font-medium sm:table-cell">控制终端</th>
              <th className="px-3 py-2 font-medium">当前状态</th>
              <th className="hidden px-3 py-2 font-medium md:table-cell">最近操作</th>
              <th className="px-3 py-2 text-right font-medium">开关</th>
            </tr>
          </thead>
          <tbody>
            {loading && flags.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-neutral-500">读取中…</td></tr>
            )}
            {!loading && flags.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-neutral-500">{error ? '读取失败' : '暂无功能开关'}</td></tr>
            )}
            {flags.map(flag => (
              <tr key={flag.key} className="border-b border-neutral-100 align-top last:border-0">
                <td className="px-3 py-3">
                  <span className="block font-semibold text-neutral-950">{flag.name}</span>
                  <span className="mt-0.5 block text-[11px] text-neutral-500">{flag.description}</span>
                  <span className="mt-0.5 block text-[11px] text-neutral-400 sm:hidden">{flag.terminal}</span>
                </td>
                <td className="hidden px-3 py-3 text-neutral-700 sm:table-cell">{flag.terminal}</td>
                <td className="px-3 py-3">
                  <span className={`inline-flex border px-2 py-0.5 text-[11px] ${flag.enabled ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 text-neutral-500'}`}>
                    {flag.enabled ? '已开启' : '已关闭'}
                  </span>
                </td>
                <td className="hidden px-3 py-3 text-neutral-500 md:table-cell">
                  <span className="block">{flag.updatedBy || '—'}</span>
                  <span className="block text-[11px] text-neutral-400">{formatTimestamp(flag.updatedAt)}</span>
                </td>
                <td className="px-3 py-3 text-right">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={flag.enabled}
                    aria-label={`${flag.name}（${flag.terminal}）`}
                    disabled={pendingKey === flag.key}
                    onClick={() => void toggle(flag)}
                    className={`relative inline-flex h-6 w-9 shrink-0 items-center rounded-full border px-0.5 transition-colors ${flag.enabled ? 'border-neutral-900 bg-neutral-900' : 'border-neutral-300 bg-neutral-200'} ${pendingKey === flag.key ? 'opacity-50' : ''}`}
                  >
                    <span className={`block h-4 w-4 rounded-full bg-white transition-transform ${flag.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] leading-5 text-neutral-500">
        仅平台管理员可修改，服务端逐次校验权限并写入审计。关闭只停用入口与操作，不删除数据；「时尚版块」与「ModaUI AI 版块」互不影响，可单独开关。
      </p>
    </section>
  );
};

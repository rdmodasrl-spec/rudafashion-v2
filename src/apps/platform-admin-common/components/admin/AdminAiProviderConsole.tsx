import React, { useCallback, useEffect, useState } from 'react';
import { Activity, BadgeCheck, CircleSlash, KeyRound, RefreshCw, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { apiGet, apiPatch, apiPost, apiPut } from '../../../../api/client';
import { PasswordInput } from '../../../shared/components/common/PasswordInput';

/**
 * 平台总后台 → 平台管理 → AI 服务商。
 * 只展示脱敏密钥与调用事实；密钥明文永不进入前端（见 docs/engineering/modules/modaui-ai-provider-console.md）。
 */

type ProviderModelTest = { ok: boolean; status: string; checkedAt: string; modelId?: string };

type AiProviderModelRow = {
  modelId: string;
  label: string;
  taskType: string;
  requestMode: string;
  pricingUnit: string;
  priceCents: number | null;
  catalogPriceCents: number | null;
  priceOverridden: boolean;
  enabled: boolean;
  enabledOverridden: boolean;
  lastTest: ProviderModelTest | null;
};

type AiProviderView = {
  enabled: boolean;
  configured: boolean;
  source: 'database' | 'environment' | 'none';
  maskedKey: string;
  keyUpdatedAt: string | null;
  keyUpdatedBy: string | null;
  lastTest: ProviderModelTest | null;
  models: AiProviderModelRow[];
};

type AiProviderCall = {
  id: string;
  modelId: string;
  taskType: string;
  status: string;
  merchantId: string | null;
  costCents: number | null;
  costSource: string | null;
  estimatedCents: number | null;
  assetUrl: string | null;
  errorCode: string | null;
  failureReason: string | null;
  createdAt: string;
  finishedAt: string | null;
};

type AiProviderCallSummary = {
  totals: {
    count: number;
    succeeded: number;
    failed: number;
    succeededCostCents: number;
    succeededEstimatedCents: number;
    unknownCostCount: number;
  };
  byStatus: Array<{ status: string; count: number }>;
  byModel: Array<{ modelId: string; count: number; costCents: number; estimatedCents: number }>;
};

const SOURCE_LABELS: Record<AiProviderView['source'], string> = {
  database: '后台保存的密钥',
  environment: '服务器环境变量',
  none: '未配置'
};

const CALL_STATUS_LABELS: Record<string, string> = {
  pending: '进行中',
  succeeded: '成功',
  failed: '供应商失败',
  timeout: '供应商超时',
  cancelled: '已取消',
  rejected: '已拦截'
};

const TASK_TYPE_LABELS: Record<string, string> = {
  image: '图片生成',
  image_edit: '图片编辑',
  video: '视频生成',
  voice: '语音合成'
};

const TEST_STATUS_LABELS: Record<string, string> = {
  healthy: '连接正常',
  unauthorized: '密钥被拒绝',
  not_supported: '端点未开通健康检查',
  not_configured: '未配置'
};

function formatCents(cents: number | null): string {
  if (typeof cents !== 'number') return '未知';
  return `$${(cents / 100).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}`;
}

function formatAt(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}

function statusText(test: ProviderModelTest | null): string {
  if (!test) return '尚未测试';
  return `${test.ok ? '正常' : '异常'} · ${TEST_STATUS_LABELS[test.status] ?? test.status} · ${formatAt(test.checkedAt)}`;
}

export const AdminAiProviderConsole: React.FC = () => {
  const [provider, setProvider] = useState<AiProviderView | null>(null);
  const [calls, setCalls] = useState<AiProviderCall[]>([]);
  const [summary, setSummary] = useState<AiProviderCallSummary | null>(null);
  const [summaryDays, setSummaryDays] = useState(7);
  const [migrationPending, setMigrationPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});

  const loadCalls = useCallback(async (days: number) => {
    const [callResult, summaryResult] = await Promise.allSettled([
      apiGet<{ calls: AiProviderCall[]; migrationPending: boolean }>('/api/admin/ai-providers/runpod/calls?pageSize=20'),
      apiGet<{ summary: AiProviderCallSummary; migrationPending: boolean }>(
        `/api/admin/ai-providers/runpod/calls/summary?days=${days}`
      )
    ]);
    if (callResult.status === 'fulfilled' && Array.isArray(callResult.value.calls)) {
      setCalls(callResult.value.calls);
      setMigrationPending(Boolean(callResult.value.migrationPending));
    } else {
      setCalls([]);
    }
    if (summaryResult.status === 'fulfilled' && summaryResult.value.summary) {
      setSummary(summaryResult.value.summary);
    } else {
      setSummary(null);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiGet<{ provider: AiProviderView }>('/api/admin/ai-providers/runpod');
      if (!result?.provider || !Array.isArray(result.provider.models)) {
        throw new Error('服务商配置返回的数据格式无效');
      }
      setProvider(result.provider);
      setPriceDrafts(Object.fromEntries(
        result.provider.models.map(model => [model.modelId, typeof model.priceCents === 'number' ? String(model.priceCents) : ''])
      ));
      await loadCalls(summaryDays);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'AI 服务商配置读取失败');
    } finally {
      setLoading(false);
    }
  }, [loadCalls, summaryDays]);

  useEffect(() => {
    void load();
    // 只在首次挂载时读取；筛选变化由单独的处理函数刷新。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveProvider = async (input: { apiKey?: string; clearApiKey?: boolean; enabled?: boolean }, successText: string) => {
    setBusy('provider');
    setError('');
    setNotice('');
    try {
      const result = await apiPut<{ provider: AiProviderView }>('/api/admin/ai-providers/runpod', input);
      if (result?.provider) setProvider(result.provider);
      setApiKey('');
      setNotice(successText);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败');
    } finally {
      setBusy('');
    }
  };

  const saveModel = async (modelId: string, patch: { enabled?: boolean; priceCents?: number }) => {
    setBusy(modelId);
    setError('');
    setNotice('');
    try {
      const result = await apiPatch<{ provider: AiProviderView }>(
        `/api/admin/ai-providers/runpod/models/${encodeURIComponent(modelId)}`,
        patch
      );
      if (result?.provider) setProvider(result.provider);
      setNotice('模型配置已保存');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '模型配置保存失败');
    } finally {
      setBusy('');
    }
  };

  const runTest = async () => {
    setBusy('test');
    setError('');
    setNotice('');
    try {
      const result = await apiPost<{ provider: AiProviderView; test: ProviderModelTest }>(
        '/api/admin/ai-providers/runpod/test',
        {}
      );
      if (result?.provider) setProvider(result.provider);
      setNotice(result?.test ? `连接测试完成：${statusText(result.test)}` : '连接测试完成');
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : '连接测试失败');
    } finally {
      setBusy('');
    }
  };

  const providerReady = Boolean(provider);
  const pendingKey = apiKey.trim();

  return (
    <section className="space-y-5">
      <div className="rounded-xl bg-neutral-950 p-5 text-white sm:p-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-neutral-300" />
          <h2 className="text-base font-bold">AI 服务商</h2>
        </div>
        <p className="mt-2 text-xs leading-5 text-neutral-400">
          平台级配置，仅超级管理员可见。密钥只在服务端使用，页面只显示末四位；调用记录来自真实供应商响应。
        </p>
      </div>

      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{notice}</p>}

      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-bold text-neutral-900">
            <KeyRound className="h-4 w-4" />Runpod 密钥
          </h3>
          <div className="flex items-center gap-2 text-[11px] font-semibold">
            <span className={`rounded-full px-2 py-0.5 ${provider?.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-600'}`}>
              {provider?.enabled ? '已启用' : '已停用'}
            </span>
            <span className={`rounded-full px-2 py-0.5 ${provider?.configured ? 'bg-neutral-900 text-white' : 'bg-amber-50 text-amber-700'}`}>
              {provider?.configured ? '密钥已配置' : '未配置密钥'}
            </span>
          </div>
        </div>

        {loading && !provider && <p className="mt-4 text-xs text-neutral-500">正在读取配置…</p>}

        {providerReady && provider && (
          <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2">
              <dt className="text-[10px] font-semibold text-neutral-500">服务商</dt>
              <dd className="mt-1 text-neutral-900">Runpod Public Endpoints</dd>
            </div>
            <div className="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2">
              <dt className="text-[10px] font-semibold text-neutral-500">密钥来源</dt>
              <dd className="mt-1 text-neutral-900">{SOURCE_LABELS[provider.source]}</dd>
            </div>
            <div className="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2">
              <dt className="text-[10px] font-semibold text-neutral-500">脱敏密钥</dt>
              <dd className="mt-1 font-mono text-neutral-900">{provider.maskedKey || '—'}</dd>
            </div>
            <div className="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2">
              <dt className="text-[10px] font-semibold text-neutral-500">最后更新</dt>
              <dd className="mt-1 text-neutral-900">
                {provider.keyUpdatedAt ? `${formatAt(provider.keyUpdatedAt)} · ${provider.keyUpdatedBy ?? '未知操作人'}` : '—'}
              </dd>
            </div>
          </dl>
        )}
      </div>
      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
        <h3 className="text-sm font-bold text-neutral-900">更换密钥</h3>
        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <label className="block">
            <span className="text-[11px] font-semibold text-neutral-600">新的 API Key</span>
            <PasswordInput
              value={apiKey}
              onChange={event => setApiKey(event.target.value)}
              placeholder="留空表示不修改现有密钥"
              autoComplete="new-password"
              maxLength={4000}
              disabled={busy === 'provider'}
              className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 pr-10 text-xs text-neutral-800 disabled:opacity-60"
            />
            <span className="mt-1 block text-[10px] text-neutral-500">
              保存后立即生效；空白输入不会覆盖现有密钥；审计只记录「已替换」不含密钥内容。
            </span>
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <button
              type="button"
              onClick={() => void saveProvider(pendingKey ? { apiKey: pendingKey } : {}, pendingKey ? '密钥已更新' : '未填写新密钥，配置未变更')}
              disabled={busy === 'provider'}
              className="inline-flex items-center gap-2 rounded-lg bg-neutral-950 px-3.5 py-2 text-xs font-semibold text-white hover:bg-neutral-800 disabled:opacity-40"
            >
              <Save className="h-3.5 w-3.5" />{busy === 'provider' ? '保存中…' : '保存密钥'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('仅清除后台保存的密钥；若服务器仍配置环境变量密钥，调用会回落到环境变量。是否继续？')) {
                  void saveProvider({ clearApiKey: true }, '后台密钥已清除');
                }
              }}
              disabled={busy === 'provider' || !provider || !provider.configured || provider.source === 'environment'}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3.5 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />清除密钥
            </button>
            <button
              type="button"
              onClick={() => void saveProvider({ enabled: !provider?.enabled }, provider?.enabled ? '服务商已停用' : '服务商已启用')}
              disabled={busy === 'provider' || !provider}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3.5 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-40"
            >
              {provider?.enabled ? <CircleSlash className="h-3.5 w-3.5" /> : <BadgeCheck className="h-3.5 w-3.5" />}
              {provider?.enabled ? '停用服务商' : '启用服务商'}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-bold text-neutral-900">
            <Activity className="h-4 w-4" />连接测试
          </h3>
          <button
            type="button"
            onClick={() => void runTest()}
            disabled={busy === 'test' || !provider?.configured}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3.5 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${busy === 'test' ? 'animate-spin' : ''}`} />
            {busy === 'test' ? '测试中…' : '测试连接'}
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-5 text-neutral-500">
          仅访问 Runpod 端点健康检查，不发起生成任务，不产生生成费用。结果会记录时间并显示在模型条目上。
        </p>
        <p className="mt-2 text-xs text-neutral-800">{provider?.lastTest ? statusText(provider.lastTest) : '尚未测试'}</p>
      </div>
      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
        <h3 className="text-sm font-bold text-neutral-900">模型接入</h3>
        <p className="mt-2 text-[11px] leading-5 text-neutral-500">
          目录价格是基线；此处只做启停与参考价覆盖，不改代码价目表。停用后商家侧请求会被拒绝并记录为「已拦截」。
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="text-[10px] uppercase tracking-wide text-neutral-500">
              <tr className="border-b border-neutral-200">
                <th className="py-2 pr-3 font-semibold">模型</th>
                <th className="py-2 pr-3 font-semibold">功能</th>
                <th className="py-2 pr-3 font-semibold">模式</th>
                <th className="py-2 pr-3 font-semibold">参考价</th>
                <th className="py-2 pr-3 font-semibold">最后测试</th>
                <th className="py-2 pr-3 font-semibold">状态</th>
                <th className="py-2 font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {(provider?.models ?? []).map(model => {
                const draft = priceDrafts[model.modelId] ?? '';
                const parsedDraft = draft.trim() === '' ? null : Number(draft);
                const priceChanged = parsedDraft !== null
                  && Number.isSafeInteger(parsedDraft)
                  && parsedDraft >= 0
                  && parsedDraft !== model.priceCents;
                return (
                  <tr key={model.modelId} className="border-b border-neutral-100 last:border-0">
                    <td className="py-2 pr-3">
                      <div className="font-semibold text-neutral-900">{model.label}</div>
                      <div className="font-mono text-[10px] text-neutral-500">{model.modelId}</div>
                    </td>
                    <td className="py-2 pr-3 text-neutral-700">{TASK_TYPE_LABELS[model.taskType] ?? model.taskType}</td>
                    <td className="py-2 pr-3 font-mono text-[10px] text-neutral-600">{model.requestMode}</td>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-1.5">
                        <input
                          value={draft}
                          inputMode="numeric"
                          disabled={busy === model.modelId}
                          onChange={event => setPriceDrafts(current => ({ ...current, [model.modelId]: event.target.value.replace(/[^0-9]/g, '') }))}
                          className="w-16 rounded-lg border border-neutral-200 px-2 py-1 text-xs tabular-nums text-neutral-800 disabled:opacity-60"
                          aria-label={`${model.label} 参考价（美分）`}
                        />
                        <span className="text-[10px] text-neutral-500">{model.pricingUnit}</span>
                      </div>
                      {model.priceOverridden && <span className="mt-1 block text-[10px] text-amber-700">已覆盖目录价</span>}
                    </td>
                    <td className="py-2 pr-3 text-[10px] text-neutral-600">{model.lastTest ? statusText(model.lastTest) : '尚未测试'}</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${model.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>
                        {model.enabled ? '已启用' : '已停用'}
                      </span>
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={busy === model.modelId || !priceChanged}
                          onClick={() => void saveModel(model.modelId, { priceCents: parsedDraft as number })}
                          className="rounded-lg border border-neutral-300 px-2 py-1 text-[10px] font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-40"
                        >
                          保存价格
                        </button>
                        <button
                          type="button"
                          disabled={busy === model.modelId}
                          onClick={() => void saveModel(model.modelId, { enabled: !model.enabled })}
                          className="rounded-lg border border-neutral-300 px-2 py-1 text-[10px] font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-40"
                        >
                          {model.enabled ? '停用' : '启用'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && !(provider?.models ?? []).length && (
                <tr><td colSpan={7} className="py-4 text-center text-neutral-500">尚未接入模型</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>


      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-neutral-900">调用记录与费用</h3>
          <div className="flex items-center gap-2">
            <select
              value={summaryDays}
              onChange={event => {
                const days = Number(event.target.value);
                setSummaryDays(days);
                void loadCalls(days);
              }}
              className="rounded-lg border border-neutral-200 px-2 py-1 text-[11px] text-neutral-800"
              aria-label="统计窗口"
            >
              <option value={1}>近 1 天</option>
              <option value={7}>近 7 天</option>
              <option value={30}>近 30 天</option>
            </select>
            <button
              type="button"
              onClick={() => void loadCalls(summaryDays)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-2.5 py-1 text-[11px] font-semibold text-neutral-800 hover:bg-neutral-50"
            >
              <RefreshCw className="h-3 w-3" />刷新
            </button>
          </div>
        </div>

        {migrationPending && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            调用记录表尚未迁移，页面暂不显示记录。执行 `npm run db:migrate` 后恢复，不影响商家侧生成。
          </p>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          {[
            { label: '调用数', value: summary?.totals.count ?? 0 },
            { label: '成功', value: summary?.totals.succeeded ?? 0 },
            { label: '失败/拦截', value: summary?.totals.failed ?? 0 },
            { label: '实际费用', value: formatCents(summary?.totals.succeededCostCents ?? 0) }
          ].map(item => (
            <div key={item.label} className="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2">
              <div className="text-[10px] font-semibold text-neutral-500">{item.label}</div>
              <div className="mt-1 text-sm font-bold tabular-nums text-neutral-900">{item.value}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-neutral-500">
          估算费用（未取得供应商真实账单时）：{formatCents(summary?.totals.succeededEstimatedCents ?? 0)}
          ；费用未知的成功调用 {summary?.totals.unknownCostCount ?? 0} 条，未按 0 计入。
        </p>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="text-[10px] uppercase tracking-wide text-neutral-500">
              <tr className="border-b border-neutral-200">
                <th className="py-2 pr-3 font-semibold">时间</th>
                <th className="py-2 pr-3 font-semibold">商家</th>
                <th className="py-2 pr-3 font-semibold">模型</th>
                <th className="py-2 pr-3 font-semibold">任务</th>
                <th className="py-2 pr-3 font-semibold">状态</th>
                <th className="py-2 pr-3 font-semibold">费用</th>
                <th className="py-2 pr-3 font-semibold">结果</th>
                <th className="py-2 font-semibold">失败原因</th>
              </tr>
            </thead>
            <tbody>
              {calls.map(call => (
                <tr key={call.id} className="border-b border-neutral-100 last:border-0">
                  <td className="py-2 pr-3 text-[10px] text-neutral-600">{formatAt(call.createdAt)}</td>
                  <td className="py-2 pr-3 font-mono text-[10px] text-neutral-600">{call.merchantId ?? '—'}</td>
                  <td className="py-2 pr-3 font-mono text-[10px] text-neutral-700">{call.modelId}</td>
                  <td className="py-2 pr-3 text-neutral-700">{TASK_TYPE_LABELS[call.taskType] ?? call.taskType}</td>
                  <td className="py-2 pr-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      call.status === 'succeeded' ? 'bg-emerald-50 text-emerald-700'
                        : call.status === 'pending' ? 'bg-neutral-100 text-neutral-600'
                          : 'bg-rose-50 text-rose-700'
                    }`}>
                      {CALL_STATUS_LABELS[call.status] ?? call.status}
                    </span>
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-neutral-800">
                    {typeof call.costCents === 'number'
                      ? formatCents(call.costCents)
                      : typeof call.estimatedCents === 'number' ? `≈${formatCents(call.estimatedCents)}` : '未知'}
                  </td>
                  <td className="py-2 pr-3">
                    {call.assetUrl
                      ? <a href={call.assetUrl} target="_blank" rel="noreferrer" className="text-[10px] font-semibold text-neutral-900 underline">查看素材</a>
                      : <span className="text-[10px] text-neutral-400">—</span>}
                  </td>
                  <td className="py-2 text-[10px] text-neutral-600">
                    {call.errorCode ? `${call.errorCode}${call.failureReason ? ` · ${call.failureReason}` : ''}` : '—'}
                  </td>
                </tr>
              ))}
              {!calls.length && (
                <tr><td colSpan={8} className="py-4 text-center text-neutral-500">暂无调用记录</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

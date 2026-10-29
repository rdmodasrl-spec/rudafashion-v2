import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Brain, RefreshCw } from 'lucide-react';
import { apiGet, apiPost } from '../../../../api/client';
import { AdminPageHeader } from './AdminPageHeader';
import { AdminBIDashboard } from './AdminBIDashboard';
import { describeGrowthError } from './growthAdminErrors';
import type { GrowthAnalysis, GrowthOverview } from './growthAdminTypes';

const periodOptions = [7, 30, 90] as const;

const analysisMetricKeys = [
  'pageViews', 'customers', 'consumers', 'merchants', 'merchantsWithProducts',
  'merchantsWithPaidOrders', 'paidOrders', 'referralClicks', 'referralRegistrations',
  'referralFirstPaid', 'aiQuestions'
] as const;

const metricOrder = [
  'pageViews', 'aiOpens', 'aiQuestions', 'merchantApplicationViews', 'buyerRegistrationViews',
  'inquiries', 'customers', 'consumers', 'merchants', 'orders', 'paidOrders', 'repeatPaidOrders',
  'retainedConsumers', 'referralClicks', 'referralRegistrations', 'unknownRegistrations',
  'referralFirstPaid', 'merchantsWithProducts', 'merchantsWithPaidOrders', 'merchantsWithFirstPaidOrder'
] as const;

const unitLabels = { events: '事件', records: '记录', merchants: '商家' } as const;
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

export const AdminGrowthAnalytics: React.FC = () => {
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const [overview, setOverview] = useState<GrowthOverview | null>(null);
  const [analysis, setAnalysis] = useState<GrowthAnalysis | null>(null);
  const [analysisNotice, setAnalysisNotice] = useState('');
  const [analysisError, setAnalysisError] = useState('');
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [showBusinessReport, setShowBusinessReport] = useState(false);
  const requestRef = useRef(0);
  const analysisRequestRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    analysisRequestRef.current += 1;
    setAnalyzing(false);
    setLoading(true);
    setError('');
    setOverview(null);
    setAnalysis(null);
    setAnalysisNotice('');
    setAnalysisError('');
    try {
      const result = await apiGet<GrowthOverview>(`/api/admin/growth/overview?days=${period}`);
      if (requestId !== requestRef.current) return;
      setOverview(result);
    } catch (loadError) {
      if (requestId !== requestRef.current) return;
      setOverview(null);
      setError(describeGrowthError(loadError));
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [period]);

  useEffect(() => { void load(); }, [load]);

  const channels = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of overview?.channelEvents ?? []) {
      totals.set(row.source, (totals.get(row.source) ?? 0) + row.events);
    }
    return [...totals.entries()]
      .map(([source, events]) => ({ source, events }))
      .sort((left, right) => right.events - left.events)
      .slice(0, 10);
  }, [overview]);

  const runAnalysis = async () => {
    if (!overview) return;
    const requestId = ++analysisRequestRef.current;
    setAnalyzing(true);
    setAnalysisError('');
    setAnalysis(null);
    setAnalysisNotice('');
    try {
      const result = await apiPost<{ analysis: GrowthAnalysis; notice: string }>('/api/admin/growth/analysis', {
        periodDays: overview.periodDays,
        metrics: Object.fromEntries(analysisMetricKeys.map(key => [key, overview.metrics[key]])),
        channels
      });
      if (requestId !== analysisRequestRef.current) return;
      setAnalysis(result.analysis);
      setAnalysisNotice(result.notice);
    } catch (analysisFailure) {
      if (requestId !== analysisRequestRef.current) return;
      setAnalysisError(describeGrowthError(analysisFailure));
    } finally {
      if (requestId === analysisRequestRef.current) setAnalyzing(false);
    }
  };

  return (
    <section className="space-y-4">
      <AdminPageHeader
        title="增长数据"
        description="指标来自现有业务表；渠道事件按来源汇总，AI 诊断只读取本次提交的指标快照。"
        actions={(
          <>
            <div className="flex overflow-hidden rounded-lg border border-neutral-200">
              {periodOptions.map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setPeriod(option)}
                  className={`px-3 py-1.5 text-xs font-medium ${period === option ? 'bg-neutral-950 text-white' : 'bg-white text-neutral-600 hover:bg-neutral-50'}`}
                >
                  {option} 天
                </button>
              ))}
            </div>
            <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />刷新
            </button>
          </>
        )}
      />

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <article className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <div className="border-b border-neutral-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-neutral-900">指标明细</h2>
            <p className="mt-1 text-[11px] text-neutral-500">{overview ? `${new Date(overview.periodStart).toLocaleDateString('zh-CN')} 至 ${new Date(overview.periodEnd).toLocaleDateString('zh-CN')}` : error ? '加载失败' : '加载中…'}</p>
          </div>
          <div className="max-h-[430px] overflow-auto">
            <table className="min-w-full divide-y divide-neutral-100 text-xs">
              <thead className="bg-neutral-50 text-left text-[11px] text-neutral-500">
                <tr><th className="px-4 py-2 font-medium">指标</th><th className="px-2 py-2 font-medium">数值</th><th className="px-2 py-2 font-medium">口径</th></tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {metricOrder.map(key => {
                  const definition = overview?.metricDefinitions?.[key];
                  return (
                    <tr key={key}>
                      <td className="px-4 py-2 text-neutral-700">{definition?.definition ?? key}</td>
                      <td className="px-2 py-2 font-medium tabular-nums text-neutral-950">{overview ? overview.metrics[key].toLocaleString('zh-CN') : '—'}</td>
                      <td className="px-2 py-2 text-[11px] text-neutral-500">{definition ? `${unitLabels[definition.unit]} · ${definition.source}` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </article>

        <div className="space-y-4">
          <article className="rounded-xl border border-neutral-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-neutral-900">漏斗指标</h2>
            <dl className="mt-2 space-y-2 text-xs">
              {overview && [
                ['页面浏览 → 注册', overview.funnel.pageViewToRegistrationRate],
                ['注册 → 新商家', overview.funnel.registrationToMerchantRate],
                ['新商家发布商品', overview.funnel.merchantProductRate],
                ['新商家收到付款', overview.funnel.merchantPaidOrderRate]
              ].map(([label, value]) => (
                <div key={String(label)} className="flex items-center justify-between gap-3">
                  <dt className="text-neutral-600">{label}</dt>
                  <dd className="font-semibold tabular-nums text-neutral-950">{percent(Number(value))}</dd>
                </div>
              ))}
              {!overview && <p className="text-neutral-500">{loading ? '漏斗指标加载中…' : error ? '漏斗指标加载失败。' : '暂无漏斗数据。'}</p>}
            </dl>
            <p className="mt-2 text-[11px] text-neutral-400">分子与分母来自不同统计口径（窗口内事件 / 窗口内新记录），比例可能超过 100%。</p>
          </article>

          <article className="rounded-xl border border-neutral-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-neutral-900">渠道事件</h2>
            <ul className="mt-2 space-y-1.5 text-xs">
              {channels.map(row => (
                <li key={row.source} className="flex items-center justify-between gap-2">
                  <span className="truncate text-neutral-600">{row.source}</span>
                  <span className="tabular-nums text-neutral-950">{row.events.toLocaleString('zh-CN')}</span>
                </li>
              ))}
              {overview && channels.length === 0 && <li className="text-neutral-500">周期内没有渠道事件。</li>}
              {!overview && <li className="text-neutral-500">{loading ? '渠道事件加载中…' : error ? '渠道事件加载失败。' : '暂无渠道事件。'}</li>}
            </ul>
            <p className="mt-2 text-[11px] text-neutral-400">归因状态：{!overview ? '—' : overview.referralAttribution.status === 'migration_required' ? '需完成归因迁移，未归属注册已单列' : '归因数据可用'}。</p>
          </article>
        </div>
      </div>
      <article className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">AI 诊断</h2>
            <p className="mt-1 text-[11px] text-neutral-500">仅根据当前周期快照生成 3 至 6 条建议，不会创建活动、修改预算或写入业务数据。</p>
          </div>
          <button type="button" onClick={() => void runAnalysis()} disabled={analyzing || !overview} className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-950 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
            <Brain className="h-3.5 w-3.5" />{analyzing ? '分析中' : '生成诊断'}
          </button>
        </div>
        {analysisNotice && <p className="mt-3 rounded-lg bg-neutral-50 px-3 py-2 text-[11px] text-neutral-600">{analysisNotice}</p>}
        {!analysis && <p className={`mt-3 text-xs ${analysisError ? 'text-red-600' : 'text-neutral-500'}`}>{analyzing ? '正在生成诊断…' : analysisError ? `诊断生成失败：${analysisError}` : '尚未生成诊断。'}</p>}
        {analysis && (
          <ul className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {analysis.insights.map(insight => (
              <li key={insight.title} className="rounded-lg border border-neutral-100 p-3 text-xs">
                <p className="font-semibold text-neutral-900">{insight.title}</p>
                <p className="mt-1 text-neutral-600">{insight.finding}</p>
                <p className="mt-1 text-neutral-500">建议：{insight.action}</p>
              </li>
            ))}
          </ul>
        )}
      </article>

      <details
        className="rounded-xl border border-neutral-200 bg-white p-4"
        onToggle={event => setShowBusinessReport((event.currentTarget as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer text-sm font-semibold text-neutral-900">经营报表</summary>
        <p className="mt-1 text-[11px] text-neutral-500">沿用原「经营报表」页面：GMV、订单与买手结构等历史口径不变。</p>
        <div className="mt-3">{showBusinessReport && <AdminBIDashboard embedded />}</div>
      </details>
    </section>
  );
};


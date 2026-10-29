import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, Users, Store, ShoppingBag, MousePointerClick } from 'lucide-react';
import { apiGet } from '../../../../api/client';
import { AdminPageHeader } from './AdminPageHeader';
import { describeGrowthError } from './growthAdminErrors';
import type { GrowthOverview, GrowthProspectListResponse, MarketingCampaign } from './growthAdminTypes';

const periodOptions = [7, 30, 90] as const;
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const formatDate = (value: string) => new Date(value).toLocaleDateString('zh-CN');

const kpis = [
  { key: 'pageViews', label: '页面浏览事件', icon: MousePointerClick },
  { key: 'customers', label: '新买手账户', icon: Users },
  { key: 'merchants', label: '新商家记录', icon: Store },
  { key: 'paidOrders', label: '付款订单', icon: ShoppingBag },
  { key: 'referralRegistrations', label: 'Partner 归属注册', icon: Users }
] as const;

export const AdminGrowthWorkbench: React.FC<{
  onOpenTool: (tool: 'acquisition' | 'content' | 'analytics' | 'fashion') => void;
}> = ({ onOpenTool }) => {
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const [overview, setOverview] = useState<GrowthOverview | null>(null);
  const [dueProspects, setDueProspects] = useState<GrowthProspectListResponse | null>(null);
  const [campaigns, setCampaigns] = useState<MarketingCampaign[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setError('');
    setOverview(null);
    const [overviewResult, dueResult, campaignResult] = await Promise.allSettled([
      apiGet<GrowthOverview>(`/api/admin/growth/overview?days=${period}`),
      apiGet<GrowthProspectListResponse>('/api/admin/growth/prospects?due=overdue&limit=5'),
      apiGet<{ campaigns: MarketingCampaign[] }>('/api/admin/growth/campaigns')
    ]);
    if (requestId !== requestRef.current) return;
    const failures: string[] = [];
    if (overviewResult.status === 'fulfilled') {
      setOverview(overviewResult.value);
    } else {
      setOverview(null);
      failures.push(describeGrowthError(overviewResult.reason));
    }
    if (dueResult.status === 'fulfilled') {
      setDueProspects(dueResult.value);
    } else {
      setDueProspects(null);
      failures.push(describeGrowthError(dueResult.reason));
    }
    if (campaignResult.status === 'fulfilled') {
      setCampaigns(campaignResult.value.campaigns);
    } else {
      setCampaigns(null);
      failures.push(describeGrowthError(campaignResult.reason));
    }
    if (failures.length > 0) setError([...new Set(failures)].join(' '));
    setLoading(false);
  }, [period]);

  useEffect(() => { void load(); }, [load]);

  const draftCampaigns = (campaigns ?? []).filter(campaign => campaign.status === 'draft');
  const pendingCampaigns = draftCampaigns.slice(0, 3);

  return (
    <section className="space-y-4">
      <AdminPageHeader
        title="增长总览"
        description={`最近 ${period} 天已持久化的获客与成交记录，按服务器时间统计。`}
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map(item => {
          const Icon = item.icon;
          return (
            <article key={item.key} className="rounded-xl border border-neutral-200 bg-white p-3.5">
              <div className="flex items-center justify-between gap-2 text-[11px] text-neutral-500">
                <span>{item.label}</span><Icon className="h-4 w-4 text-neutral-400" />
              </div>
              <div className="mt-2 text-xl font-semibold tabular-nums text-neutral-950">
                {overview ? overview.metrics[item.key].toLocaleString('zh-CN') : '—'}
              </div>
            </article>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-neutral-900">注册到成交漏斗</h2>
          <dl className="mt-3 space-y-2 text-xs">
            {overview && [
              { label: '页面浏览 → 注册率', value: overview.funnel.pageViewToRegistrationRate, hint: `${overview.funnel.registrations} 个新注册` },
              { label: '注册 → 新商家率', value: overview.funnel.registrationToMerchantRate, hint: `${overview.metrics.merchants} 个新商家` },
              { label: '新商家发布商品率', value: overview.funnel.merchantProductRate, hint: `${overview.metrics.merchantsWithProducts} 个商家` },
              { label: '新商家收到付款率', value: overview.funnel.merchantPaidOrderRate, hint: `${overview.metrics.merchantsWithPaidOrders} 个商家` }
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between gap-3 border-b border-neutral-100 pb-2 last:border-0 last:pb-0">
                <div>
                  <dt className="text-neutral-700">{row.label}</dt>
                  <dd className="mt-0.5 text-[11px] text-neutral-400">{row.hint}</dd>
                </div>
                <span className="font-semibold tabular-nums text-neutral-950">{percent(row.value)}</span>
              </div>
            ))}
            {!overview && <p className="text-neutral-500">{loading ? '加载中…' : error ? '加载失败，请重试。' : '暂无数据'}</p>}
          </dl>
        </article>

        <article className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-neutral-900">招商待办</h2>
          <p className="mt-1 text-[11px] text-neutral-500">已过跟进时间：{dueProspects ? dueProspects.counts.overdue : '—'} 条，今日到期 {dueProspects ? dueProspects.counts.dueToday : '—'} 条。</p>
          <ul className="mt-3 space-y-2 text-xs">
            {(dueProspects?.prospects ?? []).map(prospect => (
              <li key={prospect.id} className="flex items-center justify-between gap-2 border-b border-neutral-100 pb-2 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate font-medium text-neutral-900">{prospect.companyName}</p>
                  <p className="truncate text-[11px] text-neutral-500">{prospect.contactName || prospect.email || '无联系方式'}</p>
                </div>
                <span className="shrink-0 text-[11px] text-red-600">{prospect.nextFollowUpAt ? formatDate(prospect.nextFollowUpAt) : '未排期'}</span>
              </li>
            ))}
            {dueProspects && dueProspects.prospects.length === 0 && <li className="text-neutral-500">暂无逾期待跟进线索。</li>}
            {!dueProspects && <li className="text-neutral-500">{loading ? '加载中…' : '加载失败，请重试。'}</li>}
          </ul>
        </article>

        <article className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-neutral-900">待审核文案</h2>
          <p className="mt-1 text-[11px] text-neutral-500">草稿 {campaigns ? draftCampaigns.length : '—'} 条{draftCampaigns.length > pendingCampaigns.length ? '（显示最新 3 条）' : ''}；审核只改变草稿状态，不代表已发布。</p>
          <ul className="mt-3 space-y-2 text-xs">
            {pendingCampaigns.map(campaign => (
              <li key={campaign.id} className="flex items-center justify-between gap-2 border-b border-neutral-100 pb-2 last:border-0 last:pb-0">
                <p className="truncate font-medium text-neutral-900">{campaign.name}</p>
                <span className="shrink-0 text-[11px] text-neutral-500">{formatDate(campaign.updatedAt)}</span>
              </li>
            ))}
            {campaigns && pendingCampaigns.length === 0 && <li className="text-neutral-500">暂无待审核草稿。</li>}
            {!campaigns && <li className="text-neutral-500">{loading ? '加载中…' : '加载失败，请重试。'}</li>}
          </ul>
        </article>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-neutral-900">最新买手账户</h2>
          <ul className="mt-3 space-y-2 text-xs">
            {(overview?.recentCustomers ?? []).map(customer => (
              <li key={customer.id} className="flex items-center justify-between gap-2 border-b border-neutral-100 pb-2 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate font-medium text-neutral-900">{customer.companyName}</p>
                  <p className="truncate text-[11px] text-neutral-500">{customer.contactPerson} · {customer.status}</p>
                </div>
                <span className="shrink-0 text-[11px] text-neutral-500">{formatDate(customer.createdAt)}</span>
              </li>
            ))}
            {overview && overview.recentCustomers.length === 0 && <li className="text-neutral-500">暂无记录。</li>}
            {!overview && <li className="text-neutral-500">{loading ? '加载中…' : '加载失败，请重试。'}</li>}
          </ul>
        </article>

        <article className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-neutral-900">最新商家</h2>
          <ul className="mt-3 space-y-2 text-xs">
            {(overview?.recentMerchants ?? []).map(merchant => (
              <li key={merchant.id} className="flex items-center justify-between gap-2 border-b border-neutral-100 pb-2 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate font-medium text-neutral-900">{merchant.name}</p>
                  <p className="truncate text-[11px] text-neutral-500">{[merchant.city, merchant.country].filter(Boolean).join(' · ') || '未填写地区'}</p>
                </div>
                <span className="shrink-0 text-[11px] text-neutral-500">{formatDate(merchant.createdAt)}</span>
              </li>
            ))}
            {overview && overview.recentMerchants.length === 0 && <li className="text-neutral-500">暂无记录。</li>}
            {!overview && <li className="text-neutral-500">{loading ? '加载中…' : '加载失败，请重试。'}</li>}
          </ul>
        </article>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <button type="button" onClick={() => onOpenTool('acquisition')} className="rounded-xl border border-neutral-200 bg-white p-4 text-left hover:border-neutral-300">
          <p className="text-sm font-semibold text-neutral-900">招商获客</p>
          <p className="mt-1 text-xs text-neutral-500">管理潜在线索、跟进记录与代理网络。</p>
        </button>
        <button type="button" onClick={() => onOpenTool('content')} className="rounded-xl border border-neutral-200 bg-white p-4 text-left hover:border-neutral-300">
          <p className="text-sm font-semibold text-neutral-900">内容推广</p>
          <p className="mt-1 text-xs text-neutral-500">用 AI 起草渠道文案，审核后保存为推广草稿。</p>
        </button>
        <button type="button" onClick={() => onOpenTool('analytics')} className="rounded-xl border border-neutral-200 bg-white p-4 text-left hover:border-neutral-300">
          <p className="text-sm font-semibold text-neutral-900">增长数据</p>
          <p className="mt-1 text-xs text-neutral-500">查看指标口径、渠道事件与 AI 诊断建议。</p>
        </button>
        <button type="button" onClick={() => onOpenTool('fashion')} className="rounded-xl border border-neutral-200 bg-white p-4 text-left hover:border-neutral-300">
          <p className="text-sm font-semibold text-neutral-900">时尚设计</p>
          <p className="mt-1 text-xs text-neutral-500">管理图库、社区内容与素材采集。</p>
        </button>
      </div>
    </section>
  );
};


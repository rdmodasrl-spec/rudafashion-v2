import React, { useEffect, useMemo, useRef } from 'react';
import { useB2B } from '../../../../context/B2BContext';
import { Activity, Award, BarChart3, DollarSign, Package, PieChart, ShoppingBag, Users } from 'lucide-react';
import { AdminPageHeader } from './AdminPageHeader';

type MetricPoint = { date: string; gmv: number; ordersCount: number; aov: number; unitsSold: number };

function comparison(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '新增' : '—';
  const percent = ((current - previous) / previous) * 100;
  return `${percent > 0 ? '+' : ''}${percent.toFixed(1)}%`;
}

function comparisonTone(current: number, previous: number): string {
  if (current === previous) return 'text-neutral-500';
  return current > previous ? 'text-neutral-900' : 'text-neutral-500';
}

export const AdminBIDashboard: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const {
    biSalesTrend,
    biCategoryPerformance,
    biMerchantRanking,
    loadBISalesTrend,
    loadBICategoryPerformance,
    loadBIMerchantRanking,
    formatMoney
  } = useB2B();
  const [range, setRange] = React.useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const days = range === '1y' ? 365 : Number.parseInt(range, 10);
  const sales = biSalesTrend.data;
  const previousSales = biSalesTrend.previousData;
  const merchants = biMerchantRanking.data;
  const previousMerchants = biMerchantRanking.previousData;
  const loaders = useRef({ loadBISalesTrend, loadBICategoryPerformance, loadBIMerchantRanking });
  loaders.current = { loadBISalesTrend, loadBICategoryPerformance, loadBIMerchantRanking };

  useEffect(() => {
    void loaders.current.loadBISalesTrend(days);
    void loaders.current.loadBICategoryPerformance(days);
    void loaders.current.loadBIMerchantRanking(days);
  }, [days]);

  const totals = useMemo(() => {
    const sum = (points: MetricPoint[]) => ({
      gmv: points.reduce((total, point) => total + point.gmv, 0),
      orders: points.reduce((total, point) => total + point.ordersCount, 0)
    });
    return { current: sum(sales), previous: sum(previousSales) };
  }, [sales, previousSales]);
  const currentAov = totals.current.orders ? totals.current.gmv / totals.current.orders : 0;
  const previousAov = totals.previous.orders ? totals.previous.gmv / totals.previous.orders : 0;
  const hasSales = totals.current.orders > 0;
  const maxGmv = Math.max(1, ...sales.map(point => point.gmv));
  const maxOrders = Math.max(1, ...sales.map(point => point.ordersCount));
  const chartWidth = Math.max(700, sales.length * 22);
  const currentCategoryGmv = biCategoryPerformance.reduce((sum, category) => sum + category.gmv, 0);

  const cards = [
    { label: 'GMV 总成交额', value: hasSales ? formatMoney(totals.current.gmv) : '—', current: totals.current.gmv, previous: totals.previous.gmv, icon: DollarSign },
    { label: '订单总数', value: hasSales ? totals.current.orders.toLocaleString() : '—', current: totals.current.orders, previous: totals.previous.orders, icon: ShoppingBag },
    { label: '平均客单价', value: hasSales ? formatMoney(currentAov) : '—', current: currentAov, previous: previousAov, icon: Package },
    { label: '有成交商家', value: hasSales ? merchants.length.toLocaleString() : '—', current: merchants.length, previous: previousMerchants.length, icon: Users }
  ];

  const rangeControl = (
    <div className="flex items-center gap-1 border border-neutral-200 bg-white p-1">
      {(['7d', '30d', '90d', '1y'] as const).map(key => (
        <button
          key={key}
          onClick={() => setRange(key)}
          className={`min-h-8 px-3 text-xs font-semibold transition ${range === key ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:text-neutral-900'}`}
        >
          {key === '7d' ? '近 7 天' : key === '30d' ? '近 30 天' : key === '90d' ? '近 90 天' : '近 1 年'}
        </button>
      ))}
    </div>
  );

  return (
    <div className={embedded ? 'space-y-4' : 'max-w-[1500px] mx-auto px-4 md:px-6 py-6 md:py-10'}>
      {embedded
        ? <div className="flex justify-end">{rangeControl}</div>
        : <AdminPageHeader title="经营报表" actions={rangeControl} />}

      <div className="text-xs text-neutral-500 mb-3">当前周期近 {days} 天 · 对比紧邻的前 {days} 天</div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(card => (
          <div key={card.label} className="ui-card p-5 md:p-6 border border-neutral-200">
            <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-700 flex items-center justify-center mb-4">
              <card.icon className="w-5 h-5" />
            </div>
            <div className="text-xs font-bold text-neutral-500 mb-1">{card.label}</div>
            <div className="font-black text-2xl md:text-3xl tabular-nums text-neutral-950">{card.value}</div>
            <div className={`text-xs font-semibold mt-2 ${comparisonTone(card.current, card.previous)}`}>
              {hasSales ? `${comparison(card.current, card.previous)} 对比前一周期` : '当前周期暂无订单数据'}
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mb-8">
        <section className="lg:col-span-2 ui-card p-6 md:p-8 border border-neutral-200">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="font-black text-lg md:text-xl text-neutral-950 flex items-center gap-2">
                <Activity className="w-5 h-5 text-neutral-600" /> 销售趋势
              </h2>
              <p className="text-xs text-neutral-500 mt-1">每日订单金额与订单数</p>
            </div>
            <div className="flex gap-4 text-xs text-neutral-600">
              <span className="flex items-center gap-2"><i className="w-3 h-3 rounded-full bg-neutral-800" />GMV</span>
              <span className="flex items-center gap-2"><i className="w-3 h-3 rounded-full bg-neutral-400" />订单</span>
            </div>
          </div>
          {hasSales ? (
            <div className="overflow-x-auto">
              <svg viewBox={`0 0 ${chartWidth} 250`} className="w-full min-w-[700px] h-64" preserveAspectRatio="none" role="img" aria-label="每日销售额和订单数趋势">
                <line x1="0" y1="225" x2={chartWidth} y2="225" stroke="#e5e5e5" />
                <polyline
                  points={sales.map((point, index) => `${index * 22 + 10},${220 - (point.gmv / maxGmv) * 185}`).join(' ')}
                  fill="none"
                  stroke="#262626"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {sales.map((point, index) => {
                  const x = index * 22 + 10;
                  const showDate = index % Math.max(1, Math.ceil(sales.length / 8)) === 0 || index === sales.length - 1;
                  return (
                    <g key={point.date}>
                      <circle cx={x} cy={220 - (point.gmv / maxGmv) * 185} r="2.5" fill="#262626" />
                      <circle cx={x} cy={220 - (point.ordersCount / maxOrders) * 185} r="2" fill="#a3a3a3" />
                      {showDate && <text x={x} y="244" fill="#737373" fontSize="9" textAnchor="middle">{point.date.slice(5)}</text>}
                    </g>
                  );
                })}
              </svg>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-neutral-400">当前周期暂无销售数据</div>
          )}
        </section>

        <section className="ui-card p-6 md:p-8 border border-neutral-200">
          <div className="mb-5">
            <h2 className="font-black text-lg md:text-xl text-neutral-950 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-neutral-600" /> 品类表现
            </h2>
            <p className="text-xs text-neutral-500 mt-1">按订单商品的实际成交单价与数量汇总</p>
          </div>
          {biCategoryPerformance.length ? (
            <div className="space-y-4 max-h-[360px] overflow-auto">
              {biCategoryPerformance.map(category => (
                <div key={category.category}>
                  <div className="flex items-center justify-between gap-3 text-xs mb-1.5">
                    <span className="font-semibold text-neutral-800 truncate">{category.category}</span>
                    <span className="text-neutral-600 tabular-nums shrink-0">{category.sharePercent.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                    <div className="h-full rounded-full bg-neutral-700" style={{ width: `${Math.min(100, category.sharePercent)}%` }} />
                  </div>
                  <div className="mt-1 flex justify-between text-[11px] text-neutral-500 tabular-nums">
                    <span>{formatMoney(category.gmv)} · {category.unitsSold.toLocaleString()} 件</span>
                    <span className={comparisonTone(category.gmv, category.previousGmv)}>{comparison(category.gmv, category.previousGmv)} 对比前期</span>
                  </div>
                </div>
              ))}
              <div className="pt-3 border-t border-neutral-100 flex justify-between text-xs font-semibold text-neutral-700">
                <span>本期品类成交额</span><span>{formatMoney(currentCategoryGmv)}</span>
              </div>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-neutral-400">当前周期暂无品类数据</div>
          )}
        </section>
      </div>

      <section className="ui-card overflow-hidden border border-neutral-200">
        <div className="px-6 md:px-8 py-5 border-b border-neutral-200">
          <h2 className="font-black text-lg md:text-xl text-neutral-950 flex items-center gap-2">
            <Award className="w-5 h-5 text-neutral-600" /> 商家销售排行
          </h2>
          <p className="text-xs text-neutral-500 mt-1">按商品成交金额排序 · 对比紧邻的前一周期</p>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-[11px] uppercase tracking-wider text-neutral-500 font-bold">
              <tr>
                <th className="text-left px-6 py-3">排名</th>
                <th className="text-left px-6 py-3">商家</th>
                <th className="text-right px-6 py-3">GMV</th>
                <th className="text-right px-6 py-3">较前期</th>
                <th className="text-right px-6 py-3">订单数</th>
                <th className="text-right px-6 py-3">客单价</th>
                <th className="text-right px-6 py-3">评分</th>
              </tr>
            </thead>
            <tbody>
              {merchants.length ? merchants.slice(0, 10).map((merchant, index) => (
                <tr key={merchant.merchantId} className="border-t border-neutral-100">
                  <td className="px-6 py-4 text-neutral-500 tabular-nums">{index + 1}</td>
                  <td className="px-6 py-4 font-semibold text-neutral-900">{merchant.merchantName}</td>
                  <td className="px-6 py-4 text-right font-bold text-neutral-950 tabular-nums">{formatMoney(merchant.gmv)}</td>
                  <td className={`px-6 py-4 text-right tabular-nums ${comparisonTone(merchant.gmv, merchant.previousGmv)}`}>{comparison(merchant.gmv, merchant.previousGmv)}</td>
                  <td className="px-6 py-4 text-right text-neutral-700 tabular-nums">{merchant.ordersCount.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right text-neutral-700 tabular-nums">{formatMoney(merchant.ordersCount ? merchant.gmv / merchant.ordersCount : 0)}</td>
                  <td className="px-6 py-4 text-right text-neutral-700 tabular-nums">{merchant.rating.toFixed(1)}</td>
                </tr>
              )) : (
                <tr><td colSpan={7} className="px-6 py-16 text-center text-neutral-400">当前周期暂无商家成交数据</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

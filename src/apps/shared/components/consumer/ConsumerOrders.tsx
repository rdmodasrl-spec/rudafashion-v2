import React, { useEffect } from 'react';
import { useB2B } from '../../../../context/B2BContext';
import { Package, ArrowLeft, ChevronRight, Truck, CheckCircle2, Clock, FileText, RotateCcw } from 'lucide-react';
import type { ConsumerOrder } from '../../../../types/b2b';

const statusBadge = (st: ConsumerOrder['status']) => {
  const map: Partial<Record<ConsumerOrder['status'], { label: string; cls: string; ic: any }>> = {
    payment_pending: { label: '待确认', cls: 'bg-amber-50 text-amber-700 border-amber-200', ic: Clock },
    processing: { label: '处理中', cls: 'bg-sky-50 text-sky-700 border-sky-200', ic: FileText },
    shipped: { label: '已发货', cls: 'bg-violet-50 text-violet-700 border-violet-200', ic: Truck },
    out_for_delivery: { label: '派送中', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200', ic: Package },
    delivered: { label: '已签收', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', ic: CheckCircle2 },
    cancelled: { label: '已取消', cls: 'bg-neutral-100 text-neutral-600 border-neutral-200', ic: FileText },
    refunded: { label: '已退款', cls: 'bg-rose-50 text-rose-700 border-rose-200', ic: RotateCcw },
    returned: { label: '已退货', cls: 'bg-rose-50 text-rose-700 border-rose-200', ic: RotateCcw },
    return_requested: { label: '售后处理中', cls: 'bg-amber-50 text-amber-700 border-amber-200', ic: RotateCcw },
    paid: { label: '已付款', cls: 'bg-sky-50 text-sky-700 border-sky-200', ic: CheckCircle2 },
  };
  return map[st] || map.payment_pending!;
};

const timelineSteps: ConsumerOrder['status'][] = ['payment_pending', 'processing', 'shipped', 'delivered'];

export const ConsumerOrders: React.FC = () => {
  const { consumerOrders, loadConsumerOrders, formatMoney, setCurrentView } = useB2B();
  useEffect(() => { void loadConsumerOrders(); }, [loadConsumerOrders]);

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <button onClick={() => setCurrentView('consumer_store')} className="mb-5 inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition">
        <ArrowLeft className="w-3.5 h-3.5" /> 继续购物
      </button>
      <div className="mb-8 flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-serif font-black text-3xl md:text-4xl text-neutral-950 mb-1">我的订单</h1>
          <p className="text-sm text-neutral-500">共 {consumerOrders.length} 个订单，最新优先显示</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className="flex rounded-2xl bg-white border border-neutral-200 p-1">
            {['全部', '进行中', '已完成', '已退款'].map((t, i) => (
              <button key={t} className={`px-3.5 py-1.5 rounded-xl font-semibold transition ${i === 0 ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:text-neutral-900'}`}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      {consumerOrders.length === 0 ? (
        <div className="ui-card p-16 text-center">
          <Package className="w-16 h-16 mx-auto mb-4 text-neutral-300" />
          <h2 className="font-black text-xl mb-2 text-neutral-950">暂无订单</h2>
          <p className="text-sm text-neutral-500 mb-6">您尚未在 RUDA 零售商城下单。现在开始选购，开启您的时尚之旅！</p>
          <button onClick={() => setCurrentView('consumer_store')} className="ui-primary-button px-6 py-3 text-sm">去逛逛</button>
        </div>
      ) : (
        <div className="space-y-5">
          {consumerOrders.map(o => {
            const badge = statusBadge(o.status);
            const Icon = badge.ic;
            const curIdx = Math.max(0, timelineSteps.indexOf(o.status));
            return (
              <div key={o.id} className="ui-card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 md:px-6 py-4 bg-neutral-50 border-b border-neutral-200/70">
                  <div className="flex flex-wrap items-center gap-4 text-xs md:text-sm">
                    <div><span className="text-neutral-500">订单号 · </span><span className="font-mono font-bold text-neutral-950">{o.id.slice(0, 10)}...</span></div>
                    <div><span className="text-neutral-500">下单 </span><span className="font-semibold text-neutral-800">{new Date(o.createdAt).toLocaleDateString()}</span></div>
                    <div><span className="text-neutral-500">合计 </span><span className="font-black text-neutral-950">{formatMoney(o.finalTotal)}</span></div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold ${badge.cls}`}><Icon className="w-3.5 h-3.5" /> {badge.label}</span>
                </div>
                <div className="p-5 md:p-6">
                  {(o.trackingEvents && o.trackingEvents.length > 0) ? (
                    <div className="mb-5 rounded-2xl bg-neutral-50 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-600">物流追踪 Logistics</h4>
                        <span className="text-[10px] font-bold text-neutral-400">#{o.trackingNumber || 'RFQ' + o.id.slice(0, 6).toUpperCase()}</span>
                      </div>
                      <ol className="relative border-l-2 border-neutral-200 ml-2 space-y-3">
                        {o.trackingEvents.slice(0, 4).map(ev => (
                          <li key={`${ev.time}-${ev.status}`} className="pl-5 relative">
                            <span className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 ${ev.status === 'delivered' ? 'bg-emerald-500 border-emerald-500' : ev.status === 'shipped' ? 'bg-violet-500 border-violet-500' : 'bg-white border-neutral-400'}`} />
                            <div className="text-xs font-semibold text-neutral-900">{ev.note || ev.status}</div>
                            <div className="text-[10px] text-neutral-500 mt-0.5">{ev.location} · {new Date(ev.time).toLocaleString()}</div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : (
                    <div className="mb-5">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-600">订单进度 Progress</h4>
                      </div>
                      <div className="flex items-center gap-1 relative">
                        {timelineSteps.slice(0, 4).map((st, i) => (
                          <div key={st} className="flex-1 flex flex-col items-center relative">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 transition-all ${i <= curIdx ? 'bg-neutral-900 text-white shadow-md' : 'bg-neutral-200 text-neutral-400'}`}>
                              {i <= curIdx ? <CheckCircle2 className="w-4 h-4" /> : <span className="text-[10px] font-black">{i + 1}</span>}
                            </div>
                            <div className={`mt-2 text-[10px] font-bold ${i <= curIdx ? 'text-neutral-900' : 'text-neutral-400'}`}>
                              {st === 'payment_pending' && '已下单'}
                              {st === 'processing' && '确认'}
                              {st === 'shipped' && '发货'}
                              {st === 'delivered' && '签收'}
                            </div>
                            {i < 3 && <div className={`absolute top-4 left-1/2 w-full h-0.5 -z-0 ${i < curIdx ? 'bg-neutral-900' : 'bg-neutral-200'}`} />}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                    {(o.items || []).slice(0, 3).map(it => (
                      <div key={it.productId} className="flex gap-3 p-3 rounded-2xl bg-neutral-50">
                        <img src={it.image || '/pwa-512x512.png'} className="w-16 h-20 rounded-xl object-cover shrink-0" />
                        <div className="min-w-0 text-xs">
                          <div className="font-bold text-neutral-900 line-clamp-2 mb-1">{it.productName}</div>
                          <div className="text-neutral-500">x{it.quantity} · {formatMoney(it.retailPrice)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-neutral-200/70">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-xs md:text-sm">
                      <div><span className="text-neutral-500">商品 </span><span className="font-semibold">{formatMoney(o.subtotal)}</span></div>
                      <div><span className="text-neutral-500">优惠 </span><span className="font-semibold text-emerald-700">-{formatMoney(o.discountTotal || 0)}</span></div>
                      <div><span className="text-neutral-500">运费 </span><span className="font-semibold">{formatMoney(o.shippingFee)}</span></div>
                      <div><span className="text-neutral-500">应付 </span><span className="font-black text-lg text-neutral-950">{formatMoney(o.finalTotal)}</span></div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button className="ui-secondary-button !py-2 !px-4 !text-xs">订单详情 <ChevronRight className="w-3.5 h-3.5 inline ml-0.5" /></button>
                      {o.status === 'delivered' && <button className="ui-secondary-button !py-2 !px-4 !text-xs !border-rose-200 !text-rose-600 hover:!bg-rose-50">申请售后</button>}
                      {o.status === 'payment_pending' && <button className="ui-secondary-button !py-2 !px-4 !text-xs !border-rose-200 !text-rose-600 hover:!bg-rose-50">取消订单</button>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

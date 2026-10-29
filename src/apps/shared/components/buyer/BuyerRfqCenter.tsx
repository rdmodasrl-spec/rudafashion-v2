import React, { useEffect, useState } from 'react';
import { useB2B } from '../../../../context/B2BContext';
import { MessageSquareQuote, Plus, Search, ChevronRight, Clock, CheckCircle2, Package, DollarSign, Users, Building2, Send, X, ChevronDown, Filter } from 'lucide-react';
import type { BuyerRfqView, RfqQuoteView, SupportedCurrency } from '../../../../types/b2b';

const statusBadge: Record<BuyerRfqView['status'], { label: string; cls: string; ic: any }> = {
  DRAFT: { label: '草稿 DRAFT', cls: 'bg-neutral-100 text-neutral-700 border-neutral-200', ic: Clock },
  OPEN: { label: '报价中 OPEN', cls: 'bg-sky-50 text-sky-700 border-sky-200', ic: MessageSquareQuote },
  QUOTED: { label: '已收到报价', cls: 'bg-violet-50 text-violet-700 border-violet-200', ic: DollarSign },
  ACCEPTED: { label: '已成交 ACCEPTED', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', ic: CheckCircle2 },
  CLOSED: { label: '已关闭', cls: 'bg-neutral-50 text-neutral-600 border-neutral-200', ic: CheckCircle2 },
  EXPIRED: { label: '已过期', cls: 'bg-rose-50 text-rose-700 border-rose-200', ic: Clock },
};

const qStatus: Record<RfqQuoteView['status'], string> = {
  PENDING: '待回复',
  ACCEPTED: '买家接受 ✓',
  REJECTED: '被谢绝',
  COUNTERED: '还盘中',
  WITHDRAWN: '已撤回',
};

export const BuyerRfqCenter: React.FC = () => {
  const { buyerRfqs, loadBuyerRfqs, createBuyerRfq, acceptRfqQuote, formatMoney, authBuyer, addNotification, setCurrentView, products } = useB2B();
  const [showNew, setShowNew] = useState(false);
  const [tab, setTab] = useState<'all' | BuyerRfqView['status']>('all');
  const [q, setQ] = useState('');
  const [detail, setDetail] = useState<BuyerRfqView | null>(null);
  const [form, setForm] = useState({ title: '', category: 'dresses', quantity: 100, targetPrice: 15, deadlineAt: '', description: '', targetCurrency: 'EUR', preferredCountries: 'Italy' });

  useEffect(() => { void loadBuyerRfqs(); }, [loadBuyerRfqs]);

  const filtered = buyerRfqs.filter(r => {
    if (tab !== 'all' && r.status !== tab) return false;
    if (q && !(r.title.toLowerCase().includes(q.toLowerCase()) || (r.description || '').toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  });

  const submitNew = async () => {
    if (!form.title || form.quantity <= 0 || !form.deadlineAt) { addNotification('warning', '表单不完整', '请填写标题、数量与截止日期'); return; }
    const result = await createBuyerRfq({
      title: form.title, description: form.description, category: form.category,
      targetQuantity: form.quantity, targetPrice: form.targetPrice, targetCurrency: form.targetCurrency as SupportedCurrency,
      deadlineAt: new Date(form.deadlineAt).toISOString(),
      preferredCountries: form.preferredCountries.split(',').map(s => s.trim()).filter(Boolean), productIds: []
    });
    if (result.ok) {
      setShowNew(false);
      setForm({ title: '', category: 'dresses', quantity: 100, targetPrice: 15, deadlineAt: '', description: '', targetCurrency: 'EUR', preferredCountries: 'Italy' });
      addNotification('success', 'RFQ 发布成功', '已向符合条件的商家推送询盘，48 小时内陆续收到报价。');
    }
  };

  const acceptQ = async (qid: string) => {
    if (!detail) return;
    if (!confirm('确认接受该报价？接受后商家将创建订单并安排备货。')) return;
    const ok = await acceptRfqQuote(detail.id, qid);
    if (ok && detail) {
      setDetail({ ...detail, status: 'ACCEPTED', quotes: (detail.quotes || []).map(x => ({ ...x, status: x.id === qid ? 'ACCEPTED' : x.status })) as any });
    }
  };

  const counts = { all: buyerRfqs.length, OPEN: buyerRfqs.filter(r => r.status === 'OPEN').length, QUOTED: buyerRfqs.filter(r => r.status === 'QUOTED').length, ACCEPTED: buyerRfqs.filter(r => r.status === 'ACCEPTED').length };

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-8 md:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-sky-600 mb-2 font-bold flex items-center gap-2"><MessageSquareQuote className="w-4 h-4" /> 买家 · RFQ 询报价中心</p>
          <h1 className="font-serif font-black text-3xl md:text-4xl text-neutral-950">智能询盘与多方报价</h1>
          <p className="text-sm text-neutral-500 mt-1">一站式发布需求，由 RUDA 匹配优质供应商，收到多份报价后择优下单。</p>
        </div>
        <button onClick={() => setShowNew(true)} className="ui-primary-button flex items-center gap-2 px-5 py-3 text-sm shadow-lg">
          <Plus className="w-4 h-4" /> 发布新询盘 Create RFQ
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {([
          ['all', '全部询盘', counts.all, 'bg-neutral-900'],
          ['OPEN', '报价中', counts.OPEN, 'bg-sky-500'],
          ['QUOTED', '已收报价', counts.QUOTED, 'bg-violet-500'],
          ['ACCEPTED', '已成交', counts.ACCEPTED, 'bg-emerald-500'],
        ] as const).map(([k, t, v, c]) => (
          <button key={k} onClick={() => setTab(k as any)} className={`p-5 rounded-2xl border-2 text-left transition ${tab === k ? 'border-neutral-900 bg-white shadow-md' : 'border-transparent bg-white hover:bg-neutral-50'}`}>
            <div className={`w-10 h-10 rounded-xl mb-3 flex items-center justify-center font-black text-sm text-white tabular-nums ${c}`}>{v as number}</div>
            <div className="text-sm font-black text-neutral-950">{t as string}</div>
          </button>
        ))}
      </div>

      <div className="ui-card p-4 mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="搜索询盘标题 / 描述 / 品类..." className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" />
        </div>
        <Filter className="w-4 h-4 text-neutral-500" />
        <span className="ml-auto text-xs text-neutral-500">{filtered.length} 条结果</span>
      </div>

      {filtered.length === 0 ? (
        <div className="ui-card p-16 text-center">
          <MessageSquareQuote className="w-16 h-16 mx-auto mb-4 text-neutral-300" />
          <h3 className="font-black text-xl mb-2">暂无询盘</h3>
          <p className="text-sm text-neutral-500 mb-6">点击顶部按钮发布您的第一个询盘，RUDA 将为您匹配 3-10 家符合条件的品牌商与工厂。</p>
          <button onClick={() => setShowNew(true)} className="ui-primary-button px-6 py-3 text-sm">立即发布询盘</button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4 pb-10">
          {filtered.map(r => {
            const s = statusBadge[r.status];
            const Ic = s.ic;
            return (
              <div key={r.id} className="ui-card p-5 hover:shadow-lg hover:-translate-y-0.5 transition cursor-pointer" onClick={() => setDetail(r)}>
                <div className="flex items-start justify-between mb-3 gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black border ${s.cls}`}><Ic className="w-3 h-3" /> {s.label}</span>
                    <span className="text-[10px] font-bold text-neutral-500 bg-neutral-100 px-2 py-1 rounded-lg">#{r.rfqNo || r.id.slice(0, 6).toUpperCase()}</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-neutral-400 shrink-0" />
                </div>
                <h3 className="font-black text-lg mb-2 text-neutral-950 leading-snug">{r.title}</h3>
                {r.description && <p className="text-sm text-neutral-500 leading-6 mb-4 line-clamp-2">{r.description}</p>}
                <div className="grid grid-cols-3 gap-3 mb-4 text-xs">
                  <div className="p-3 rounded-xl bg-sky-50"><div className="text-[10px] text-sky-600 font-bold uppercase mb-0.5">品类</div><div className="font-black text-neutral-900 text-sm">{r.category}</div></div>
                  <div className="p-3 rounded-xl bg-amber-50"><div className="text-[10px] text-amber-700 font-bold uppercase mb-0.5">数量</div><div className="font-black text-neutral-900 text-sm tabular-nums">{r.targetQuantity.toLocaleString()} pcs</div></div>
                  <div className="p-3 rounded-xl bg-emerald-50"><div className="text-[10px] text-emerald-700 font-bold uppercase mb-0.5">目标价</div><div className="font-black text-neutral-900 text-sm tabular-nums">{formatMoney(r.targetPrice || 0)}</div></div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-3 border-t border-neutral-200/70">
                  <span className="flex items-center gap-1.5"><Users className="w-3 h-3" /> {r.quotes?.length || 0} 家供应商报价</span>
                  <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> 截止 {new Date(r.deadlineAt).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-6 md:px-8 py-5 border-b border-neutral-200/70 sticky top-0 bg-white z-10 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black border ${statusBadge[detail.status].cls}`}>{React.createElement(statusBadge[detail.status].ic, { className: 'w-3 h-3' })} {statusBadge[detail.status].label}</span>
                  <span className="text-[10px] font-bold text-neutral-500 bg-neutral-100 px-2 py-1 rounded-lg">#{detail.rfqNo || detail.id.slice(0, 6).toUpperCase()}</span>
                </div>
                <h2 className="font-black text-2xl text-neutral-950 leading-snug">{detail.title}</h2>
              </div>
              <button onClick={() => setDetail(null)} className="w-10 h-10 rounded-xl hover:bg-neutral-100 flex items-center justify-center shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 md:p-8 space-y-6">
              {detail.description && <div className="p-5 rounded-2xl bg-neutral-50 border border-neutral-200/70">
                <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold mb-2">需求详情 Specs</div>
                <p className="text-sm text-neutral-700 leading-7 whitespace-pre-wrap">{detail.description}</p>
              </div>}
              <div className="grid md:grid-cols-4 gap-3">
                {[
                  { t: '品类 Category', v: detail.category, ic: <Package className="w-4 h-4" />, c: 'from-sky-500 to-indigo-500' },
                  { t: '数量 Target Qty', v: detail.targetQuantity.toLocaleString() + ' pcs', ic: <Users className="w-4 h-4" />, c: 'from-amber-500 to-orange-500' },
                  { t: '目标单价 Budget', v: formatMoney(detail.targetPrice || 0) + '/' + (detail.targetCurrency || 'EUR'), ic: <DollarSign className="w-4 h-4" />, c: 'from-emerald-500 to-teal-500' },
                  { t: '截止 Deadline', v: new Date(detail.deadlineAt).toLocaleDateString(), ic: <Clock className="w-4 h-4" />, c: 'from-rose-500 to-pink-500' },
                ].map((x, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-white border border-neutral-200/70">
                    <div className={`w-9 h-9 mb-3 rounded-xl bg-gradient-to-br ${x.c} text-white flex items-center justify-center shadow-sm`}>{x.ic}</div>
                    <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold mb-0.5">{x.t}</div>
                    <div className="font-black text-neutral-950">{x.v}</div>
                  </div>
                ))}
              </div>
              <div>
                <h3 className="font-black text-xl mb-4 flex items-center gap-2"><Building2 className="w-5 h-5 text-amber-600" /> 收到供应商报价 ({detail.quotes?.length || 0})</h3>
                {(!detail.quotes || detail.quotes.length === 0) ? (
                  <div className="p-8 rounded-2xl bg-neutral-50 border border-dashed border-neutral-300 text-center text-neutral-500 text-sm">
                    🕒 暂无报价，RUDA 已向 5 家匹配商家推送，建议耐心等待 24-48 小时
                  </div>
                ) : (
                  <div className="space-y-3">
                    {detail.quotes.map((q: RfqQuoteView) => (
                      <div key={q.id} className={`p-5 rounded-2xl border-2 transition ${q.status === 'ACCEPTED' ? 'border-emerald-400 bg-emerald-50' : q.status === 'REJECTED' ? 'opacity-60 border-neutral-200' : 'border-neutral-200 hover:border-neutral-400 bg-white'}`}>
                        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-sm font-black font-serif">
                              {q.merchantName?.slice(0, 1) || 'M'}
                            </div>
                            <div>
                              <div className="font-black text-base text-neutral-950">{q.merchantName}</div>
                              <div className="text-[10px] text-neutral-500">{q.country || 'Italy'} · 评分 {(4 + (q.id.length % 5) / 10).toFixed(1)} ★ · 报价 {new Date(q.createdAt).toLocaleString()}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-neutral-500">商家报价</div>
                            <div className="font-black text-2xl text-neutral-950 tabular-nums">{formatMoney(q.unitPrice)}</div>
                            <div className="text-[10px] text-neutral-500">最低起订 MOQ: {q.minOrderQty || detail.targetQuantity} pcs</div>
                          </div>
                        </div>
                        <div className="grid md:grid-cols-4 gap-2 mb-4 text-xs">
                          <div className="p-2.5 rounded-xl bg-neutral-50"><div className="text-[10px] text-neutral-500 font-bold">单价</div><div className="font-black tabular-nums">{formatMoney(q.unitPrice)}</div></div>
                          <div className="p-2.5 rounded-xl bg-neutral-50"><div className="text-[10px] text-neutral-500 font-bold">交期 Lead time</div><div className="font-black">{q.leadTimeDays || 15} 天</div></div>
                          <div className="p-2.5 rounded-xl bg-neutral-50"><div className="text-[10px] text-neutral-500 font-bold">总预估</div><div className="font-black tabular-nums">{formatMoney((q.unitPrice || 0) * (detail.targetQuantity || 1))}</div></div>
                          <div className="p-2.5 rounded-xl bg-neutral-50"><div className="text-[10px] text-neutral-500 font-bold">状态</div><div className={`font-black ${q.status === 'ACCEPTED' ? 'text-emerald-700' : q.status === 'REJECTED' ? 'text-neutral-500' : 'text-violet-700'}`}>{qStatus[q.status]}</div></div>
                        </div>
                        {q.notes && <p className="text-xs text-neutral-600 mb-4 leading-6 p-3 rounded-xl bg-amber-50">📝 {q.notes}</p>}
                        {detail.status === 'OPEN' || detail.status === 'QUOTED' ? (
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => acceptQ(q.id)} disabled={q.status !== 'PENDING'} className="ui-primary-button !py-2 !px-4 !text-xs flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
                              <CheckCircle2 className="w-3.5 h-3.5" /> 接受并生成订单
                            </button>
                            <button className="ui-secondary-button !py-2 !px-4 !text-xs flex items-center gap-1.5">
                              <MessageSquareQuote className="w-3.5 h-3.5" /> 发起还盘
                            </button>
                            <button className="ui-secondary-button !py-2 !px-4 !text-xs flex items-center gap-1.5 ml-auto">
                              <Building2 className="w-3.5 h-3.5" /> 进入店铺
                            </button>
                          </div>
                        ) : (
                          <div className={`text-xs font-bold p-3 rounded-xl text-center ${q.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-600'}`}>
                            此报价 {q.status === 'ACCEPTED' ? '已被接受，正在生成采购订单' : '已谢绝'}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowNew(false)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 md:px-8 py-5 border-b border-neutral-200/70 sticky top-0 bg-white flex items-center justify-between">
              <h2 className="font-black text-xl md:text-2xl flex items-center gap-2"><Plus className="w-5 h-5 text-sky-600" /> 发布新采购询盘 Create RFQ</h2>
              <button onClick={() => setShowNew(false)} className="w-10 h-10 rounded-xl hover:bg-neutral-100 flex items-center justify-center">×</button>
            </div>
            <div className="p-6 md:p-8 space-y-5">
              <label className="block"><span className="ui-section-title block mb-1.5">询盘标题 *</span><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="FW25 春季女装连衣裙现货 1000 件采购需求" className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
              <div className="grid md:grid-cols-2 gap-5">
                <label className="block"><span className="ui-section-title block mb-1.5">品类 Category *</span>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none">
                    {['dresses', 'tops', 'knitwear', 'outerwear', 'pants', 'skirts', 'shoes', 'bags', 'accessories', 'lingerie', 'kids'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label className="block"><span className="ui-section-title block mb-1.5">目标单价 (EUR)</span><input type="number" step="0.5" value={form.targetPrice} onChange={e => setForm(f => ({ ...f, targetPrice: Number(e.target.value) }))} className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
                <label className="block"><span className="ui-section-title block mb-1.5">采购数量 (件) *</span><input type="number" min={1} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))} className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
                <label className="block"><span className="ui-section-title block mb-1.5">报价截止日期 *</span><input type="datetime-local" value={form.deadlineAt} onChange={e => setForm(f => ({ ...f, deadlineAt: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
                <label className="block"><span className="ui-section-title block mb-1.5">优先产地</span><input value={form.preferredCountries} onChange={e => setForm(f => ({ ...f, preferredCountries: e.target.value }))} placeholder="Italy, China, Portugal (逗号分隔)" className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
                <label className="block"><span className="ui-section-title block mb-1.5">结算货币</span>
                  <select value={form.targetCurrency} onChange={e => setForm(f => ({ ...f, targetCurrency: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none">
                    {['EUR', 'USD', 'CNY', 'GBP', 'JPY'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </label>
              </div>
              <label className="block"><span className="ui-section-title block mb-1.5">详细需求 (面料/尺码/颜色/交期...)</span><textarea rows={5} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="例：需要 viscose / rayon 黏胶面料，尺码 S-L (EU)，10 色混批，意大利本地交期 30 天内优先..." className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none resize-none" /></label>
              <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 text-xs text-sky-800 leading-6">
                💡 <b>RUDA 小提示：</b>填写越详细，匹配的供应商越精准。建议附上面料成分表、尺码表、款式参考图或样衣照片。支持图片附件上传与 AI 自动规格解析。
              </div>
            </div>
            <div className="px-6 md:px-8 py-5 border-t border-neutral-200/70 sticky bottom-0 bg-gradient-to-t from-white via-white flex justify-end gap-3 backdrop-blur">
              <button onClick={() => setShowNew(false)} className="ui-secondary-button px-6 py-3 text-sm">取消</button>
              <button onClick={submitNew} className="ui-primary-button px-7 py-3 text-sm flex items-center gap-2">
                <Send className="w-4 h-4" /> 立即发布询盘
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

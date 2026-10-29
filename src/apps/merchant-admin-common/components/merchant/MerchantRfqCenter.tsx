import React, { useEffect, useState } from 'react';
import { useB2B } from '../../../../context/B2BContext';
import { Building2, MessageSquareQuote, Package, DollarSign, Clock, Search, ChevronRight, Filter, Send, CheckCircle2, X, Award, TrendingUp } from 'lucide-react';
import type { BuyerRfqView } from '../../../../types/b2b';

export const MerchantRfqCenter: React.FC = () => {
  const { merchantRfqs, loadMerchantRfqs, submitMerchantRfqQuote, authMerchantId, addNotification, formatMoney, merchants } = useB2B();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'all' | 'new' | 'quoted'>('all');
  const [replyId, setReplyId] = useState<BuyerRfqView | null>(null);
  const [form, setForm] = useState({ unitPrice: 0, minOrderQty: 50, leadTimeDays: 15, notes: '', validityDays: 14 });

  useEffect(() => { void loadMerchantRfqs(); }, [loadMerchantRfqs]);

  const mine = merchantRfqs;
  const filtered = mine.filter(r => {
    if (tab === 'new' && (r.quotes || []).some(q => q.merchantId === authMerchantId)) return false;
    if (tab === 'quoted' && !(r.quotes || []).some(q => q.merchantId === authMerchantId)) return false;
    if (q && !(r.title.toLowerCase().includes(q.toLowerCase()) || (r.description || '').toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  });

  const openReply = (r: BuyerRfqView) => {
    setReplyId(r);
    setForm(p => ({ ...p, unitPrice: Math.max(0, r.targetPrice ? r.targetPrice * 0.98 : 15), minOrderQty: Math.max(r.targetQuantity ? Math.round(r.targetQuantity * 0.5) : 50, 10), leadTimeDays: 15, notes: '', validityDays: 14 }));
  };
  const submitQ = async () => {
    if (!replyId) return;
    if (form.unitPrice <= 0 || form.minOrderQty <= 0 || form.leadTimeDays <= 0) { addNotification('warning', '报价参数不完整', '请填写单价、起订量和交期'); return; }
    const ok = await submitMerchantRfqQuote(replyId.id, { unitPrice: form.unitPrice, minOrderQty: form.minOrderQty, leadTimeDays: form.leadTimeDays, validityDays: form.validityDays, notes: form.notes });
    if (ok) {
      setReplyId(null);
      addNotification('success', '报价已提交', '买家将在 48h 内评估，如有接受将自动生成订单。');
      void loadMerchantRfqs();
    }
  };

  const myQuote = (r: BuyerRfqView) => (r.quotes || []).find(q => q.merchantId === authMerchantId);
  const totalPipeline = filtered.reduce((s, r) => s + (r.targetPrice || 0) * (r.targetQuantity || 0), 0);

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-8 md:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif font-black text-3xl md:text-4xl text-neutral-950">买家询盘</h1>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {([
          ['新询盘', mine.filter(r => !myQuote(r)).length, <Building2 className="w-5 h-5" />, 'from-sky-500 to-indigo-500'],
          ['已报价', mine.filter(r => !!myQuote(r)).length, <MessageSquareQuote className="w-5 h-5" />, 'from-amber-500 to-orange-500'],
          ['已中标', mine.filter(r => myQuote(r)?.status === 'ACCEPTED').length, <CheckCircle2 className="w-5 h-5" />, 'from-emerald-500 to-teal-500'],
          ['总机会金额', formatMoney(totalPipeline), <TrendingUp className="w-5 h-5" />, 'from-violet-500 to-fuchsia-500'],
        ] as const).map(([t, v, ic, c], i) => (
          <div key={i} className="ui-card p-5">
            <div className={`w-11 h-11 mb-4 rounded-2xl bg-gradient-to-br ${c} text-white flex items-center justify-center shadow-sm`}>{ic}</div>
            <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-bold mb-1">{t as string}</div>
            <div className="font-black text-2xl md:text-3xl tabular-nums text-neutral-950">{v as any}</div>
          </div>
        ))}
      </div>

      <div className="ui-card p-4 mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="搜索买家询盘标题 / 描述 / 品类..." className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" />
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-neutral-100">
          <Filter className="w-4 h-4 text-neutral-500 mx-2" />
          {([['all', '全部'], ['new', '未报价'], ['quoted', '我已报价']] as const).map(([k, t]) => (
            <button key={k} onClick={() => setTab(k)} className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${tab === k ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-600 hover:text-neutral-900'}`}>{t}</button>
          ))}
        </div>
        <span className="ml-auto text-xs text-neutral-500">{filtered.length} 条待响应</span>
      </div>

      {filtered.length === 0 ? (
        <div className="ui-card p-16 text-center">
          <Award className="w-16 h-16 mx-auto mb-4 text-amber-300" />
          <h3 className="font-black text-xl mb-2">暂无可响应的询盘</h3>
          <div className="flex flex-wrap justify-center gap-2 text-sm text-neutral-500"><span>AI 正在匹配</span><span>完善主营品类</span></div>
        </div>
      ) : (
        <div className="space-y-3 pb-10">
          {filtered.map(r => {
            const mineQ = myQuote(r);
            const daysLeft = Math.max(0, Math.ceil((new Date(r.deadlineAt).getTime() - Date.now()) / 86400000));
            return (
              <div key={r.id} className="ui-card p-5 md:p-6 hover:shadow-lg transition">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    <div className="w-14 h-14 shrink-0 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-md">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="text-[10px] font-bold bg-sky-100 text-sky-800 px-2 py-1 rounded-lg">询盘 {r.rfqNo || '编号待生成'}</span>
                        <span className="text-[10px] font-bold bg-neutral-100 text-neutral-700 px-2 py-1 rounded-lg uppercase">{r.category}</span>
                        {mineQ && <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${mineQ.status === 'ACCEPTED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : mineQ.status === 'REJECTED' ? 'bg-neutral-100 text-neutral-600 border-neutral-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                          {mineQ.status === 'ACCEPTED' ? '✓ 已中标' : mineQ.status === 'REJECTED' ? '未中标' : '等待买家确认'}
                        </span>}
                      </div>
                      <h3 className="font-black text-lg md:text-xl text-neutral-950 leading-snug mb-2">{r.title}</h3>
                      {r.description && <p className="text-sm text-neutral-500 leading-6 line-clamp-2">{r.description}</p>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold mb-1">报价截止</div>
                    <div className={`font-black text-lg ${daysLeft <= 2 ? 'text-rose-600' : 'text-neutral-900'}`}>
                      {daysLeft === 0 ? '今日截止' : `${daysLeft} 天`}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5 text-xs">
                  <div className="p-3 rounded-xl bg-sky-50">
                    <div className="text-[10px] text-sky-600 font-bold uppercase mb-0.5 flex items-center gap-1"><Package className="w-3 h-3" /> 采购量</div>
                    <div className="font-black text-lg tabular-nums">{r.targetQuantity.toLocaleString()}</div>
                    <div className="text-[10px] text-neutral-500">件</div>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50">
                    <div className="text-[10px] text-emerald-700 font-bold uppercase mb-0.5 flex items-center gap-1"><DollarSign className="w-3 h-3" /> 目标单价</div>
                    <div className="font-black text-lg tabular-nums">{formatMoney(r.targetPrice || 0)}</div>
                    <div className="text-[10px] text-neutral-500">{r.targetCurrency || 'EUR'}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50">
                    <div className="text-[10px] text-amber-700 font-bold uppercase mb-0.5 flex items-center gap-1"><MessageSquareQuote className="w-3 h-3" /> 已收到</div>
                    <div className="font-black text-lg tabular-nums">{r.quotes?.length || 0}</div>
                    <div className="text-[10px] text-neutral-500">供应商报价</div>
                  </div>
                  <div className="p-3 rounded-xl bg-violet-50">
                    <div className="text-[10px] text-violet-700 font-bold uppercase mb-0.5 flex items-center gap-1"><Building2 className="w-3 h-3" /> 买家</div>
                    <div className="font-black text-sm">{r.buyerCompany || '注册买手'}</div>
                    <div className="text-[10px] text-neutral-500">{r.buyerCountry || 'EU'}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-br from-neutral-50 to-neutral-100">
                    <div className="text-[10px] text-neutral-600 font-bold uppercase mb-0.5 flex items-center gap-1"><Clock className="w-3 h-3" /> 发布</div>
                    <div className="font-bold text-sm">{new Date(r.createdAt).toLocaleDateString()}</div>
                    <div className="text-[10px] text-neutral-500">询盘创建时间</div>
                  </div>
                </div>
                {mineQ && (
                  <div className="mb-4 p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/70">
                    <div className="text-[10px] uppercase tracking-wider text-amber-800 font-bold mb-2">✓ 我提交的报价 ({new Date(mineQ.createdAt).toLocaleDateString()})</div>
                    <div className="grid md:grid-cols-4 gap-3 text-xs">
                      <div className="bg-white p-3 rounded-xl"><div className="text-[10px] text-neutral-500 font-bold mb-0.5">单价</div><div className="font-black text-xl tabular-nums">{formatMoney(mineQ.unitPrice)}</div></div>
                      <div className="bg-white p-3 rounded-xl"><div className="text-[10px] text-neutral-500 font-bold mb-0.5">MOQ</div><div className="font-black text-xl tabular-nums">{mineQ.minOrderQty}</div></div>
                      <div className="bg-white p-3 rounded-xl"><div className="text-[10px] text-neutral-500 font-bold mb-0.5">交期</div><div className="font-black text-xl tabular-nums">{mineQ.leadTimeDays || 15}<span className="text-xs ml-1">天</span></div></div>
                      <div className="bg-white p-3 rounded-xl"><div className="text-[10px] text-neutral-500 font-bold mb-0.5">状态</div><div className={`font-black text-lg ${mineQ.status === 'ACCEPTED' ? 'text-emerald-700' : mineQ.status === 'REJECTED' ? 'text-neutral-500' : 'text-amber-700'}`}>
                        {mineQ.status === 'ACCEPTED' ? '✓ 已中标' : mineQ.status === 'REJECTED' ? '已谢绝' : mineQ.status === 'COUNTERED' ? '还盘' : '等待中'}
                      </div></div>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-neutral-200/70">
                  <div className="text-xs text-neutral-500 flex items-center gap-2">
                    {r.preferredCountries?.length ? <span className="px-2 py-1 bg-neutral-100 rounded-lg">优先产地：{r.preferredCountries.join(', ')}</span> : null}
                    {r.productIds?.length ? <span className="px-2 py-1 bg-neutral-100 rounded-lg">关联 {r.productIds.length} 件商品</span> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="ui-secondary-button !py-2 !px-4 !text-xs flex items-center gap-1.5">
                      <MessageSquareQuote className="w-3.5 h-3.5" /> 站内消息沟通
                    </button>
                    {!mineQ ? (
                      <button onClick={() => openReply(r)} className="ui-primary-button !py-2 !px-5 !text-xs flex items-center gap-1.5">
                        <Send className="w-3.5 h-3.5" /> 立即报价
                      </button>
                    ) : (
                      <button onClick={() => openReply(r)} className="ui-secondary-button !py-2 !px-4 !text-xs flex items-center gap-1.5">
                        <ChevronRight className="w-3.5 h-3.5" /> 重新报价
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {replyId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setReplyId(null)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 md:px-8 py-5 border-b border-neutral-200/70 sticky top-0 bg-white flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-widest text-amber-600 font-bold mb-1 flex items-center gap-1"><Send className="w-3 h-3" /> 提交报价 QUOTE</div>
                <h2 className="font-black text-xl md:text-2xl text-neutral-950 leading-snug truncate">{replyId.title}</h2>
              </div>
              <button onClick={() => setReplyId(null)} className="w-10 h-10 rounded-xl hover:bg-neutral-100 flex items-center justify-center shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 md:p-8 space-y-5">
              <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200/70 text-xs text-sky-800 leading-6">
                💡 <b>买家采购参数：</b> 品类 {replyId.category} · 数量 <b>{replyId.targetQuantity.toLocaleString()}</b> 件 · 目标单价 <b>{formatMoney(replyId.targetPrice || 0)}</b> · 截止 <b>{new Date(replyId.deadlineAt).toLocaleDateString()}</b>
              </div>
              <div className="grid md:grid-cols-2 gap-5">
                <label className="block"><span className="ui-section-title block mb-1.5">报价单价 (EUR) *</span><div className="relative"><DollarSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" /><input type="number" min={0.1} step={0.1} value={form.unitPrice || ''} onChange={e => setForm(f => ({ ...f, unitPrice: Number(e.target.value) }))} className="w-full pl-10 pr-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm font-bold tabular-nums focus:border-neutral-900 focus:outline-none" /></div></label>
                <label className="block"><span className="ui-section-title block mb-1.5">最低起订量 MOQ *</span><div className="relative"><Package className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" /><input type="number" min={1} value={form.minOrderQty || ''} onChange={e => setForm(f => ({ ...f, minOrderQty: Number(e.target.value) }))} className="w-full pl-10 pr-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm font-bold tabular-nums focus:border-neutral-900 focus:outline-none" /></div></label>
                <label className="block"><span className="ui-section-title block mb-1.5">交期 Lead Time (天) *</span><div className="relative"><Clock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" /><input type="number" min={1} value={form.leadTimeDays || ''} onChange={e => setForm(f => ({ ...f, leadTimeDays: Number(e.target.value) }))} className="w-full pl-10 pr-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm font-bold tabular-nums focus:border-neutral-900 focus:outline-none" /></div></label>
                <label className="block"><span className="ui-section-title block mb-1.5">报价有效期 (天)</span><input type="number" min={1} value={form.validityDays || ''} onChange={e => setForm(f => ({ ...f, validityDays: Number(e.target.value) }))} className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm font-bold tabular-nums focus:border-neutral-900 focus:outline-none" /></label>
              </div>
              <div className="pt-6 border-t border-dashed border-neutral-200">
                <div className="flex items-center justify-between mb-4">
                  <span className="ui-section-title">订单金额预估</span>
                  <span className="font-black text-2xl md:text-3xl text-neutral-950 tabular-nums">{formatMoney((form.unitPrice || 0) * Math.max(form.minOrderQty, replyId.targetQuantity))}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="p-3 rounded-xl bg-neutral-50"><div className="text-[10px] text-neutral-500 font-bold">买家目标</div><div className="font-black text-base tabular-nums">{formatMoney(replyId.targetPrice || 0)}</div></div>
                  <div className="p-3 rounded-xl bg-emerald-50"><div className="text-[10px] text-emerald-700 font-bold">我的单价</div><div className="font-black text-base tabular-nums">{formatMoney(form.unitPrice || 0)}</div></div>
                  <div className="p-3 rounded-xl bg-sky-50"><div className="text-[10px] text-sky-700 font-bold">报价数量</div><div className="font-black text-base tabular-nums">{Math.max(form.minOrderQty, replyId.targetQuantity).toLocaleString()}</div></div>
                  <div className="p-3 rounded-xl bg-amber-50"><div className="text-[10px] text-amber-700 font-bold">交期</div><div className="font-black text-base tabular-nums">{form.leadTimeDays} 天</div></div>
                </div>
              </div>
              <label className="block"><span className="ui-section-title block mb-1.5">备注 Notes (交付条款 / 付款方式 / 面料详情)</span><textarea rows={4} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="例：30% deposit + 70% 见提单副本 · 面料：95% Viscose 5% Elastane · 支持混批与贴牌" className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none resize-none" /></label>
            </div>
            <div className="px-6 md:px-8 py-5 border-t border-neutral-200/70 sticky bottom-0 bg-gradient-to-t from-white via-white flex justify-end gap-3 backdrop-blur">
              <button onClick={() => setReplyId(null)} className="ui-secondary-button px-6 py-3 text-sm">取消</button>
              <button onClick={submitQ} className="ui-primary-button px-8 py-3 text-sm font-bold flex items-center gap-2">
                <Send className="w-4 h-4" /> 提交报价给买家
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

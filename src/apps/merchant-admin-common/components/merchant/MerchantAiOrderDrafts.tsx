import React, { FormEvent, useEffect, useState } from 'react';
import { Check, Copy, RefreshCw, Sparkles, X } from 'lucide-react';
import { apiGet, apiPatch, apiPost } from '../../../../api/client';

type BuyerOption = { id: string; companyName: string; status: string };
type DraftItem = {
  productId: string;
  sku: string;
  styleNo: string;
  productName: string;
  color: string;
  size: string;
  quantity: number;
  unitPrice: number;
};
type AiOrderDraft = {
  id: string;
  customerId: string;
  customerName: string;
  request: string;
  status: 'pending_review' | 'approved' | 'rejected' | 'stale';
  leadTimeDays: number;
  deliveryTerms: string;
  paymentTerms: string;
  items: DraftItem[];
  salesQuoteId: string | null;
  createdAt: string;
  totalQty?: number;
  totalAmount?: number;
};

type MerchantAiOrderDraftsProps = {
  customers: BuyerOption[];
  onQuoteCreated: () => void;
};

const statusLabels: Record<AiOrderDraft['status'], string> = {
  pending_review: '待商家审核',
  approved: '已审核并生成报价草稿',
  rejected: '已拒绝',
  stale: '商品、价格或客户资料已变化'
};

export const MerchantAiOrderDrafts: React.FC<MerchantAiOrderDraftsProps> = ({ customers, onQuoteCreated }) => {
  const [drafts, setDrafts] = useState<AiOrderDraft[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [request, setRequest] = useState('');
  const [leadTimeDays, setLeadTimeDays] = useState('14');
  const [deliveryTerms, setDeliveryTerms] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [approvedQuote, setApprovedQuote] = useState<{ quoteNo: string; shareUrl: string } | null>(null);

  const loadDrafts = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiGet<{ success: true; drafts: AiOrderDraft[] }>('/api/merchant/ai-order-drafts');
      setDrafts(result.drafts);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'AI 订单草稿读取失败。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadDrafts(); }, []);
  useEffect(() => {
    if (!customerId && customers.length) setCustomerId(customers[0].id);
  }, [customerId, customers]);

  const createDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (creating) return;
    setCreating(true);
    setError('');
    setNotice('');
    setApprovedQuote(null);
    try {
      const result = await apiPost<{ success: true; draft: AiOrderDraft }>('/api/merchant/ai-order-drafts', {
        customerId,
        request,
        leadTimeDays: Number(leadTimeDays),
        deliveryTerms,
        paymentTerms
      });
      setDrafts(current => [result.draft, ...current.filter(draft => draft.id !== result.draft.id)].slice(0, 100));
      setRequest('');
      setNotice('AI 已生成方案。核对客户专属单价、每个 SKU 数量、交期与条款后，再由商家审批。');
    } catch (createError) {
      const code = createError instanceof Error ? createError.message : '';
      setError(code === 'AI_ORDER_DRAFT_MOQ_OR_PACK_INVALID'
        ? 'AI 建议的 SKU 数量不满足 MOQ 或装箱倍数；请调整需求后重新生成。'
        : code === 'AI_ORDER_DRAFT_BUYER_UNAVAILABLE'
          ? '该买家尚未审核，或不是本店已关联客户。'
          : code || 'AI 订单方案生成失败，请重试。');
    } finally {
      setCreating(false);
    }
  };

  const reviewDraft = async (draft: AiOrderDraft, action: 'approve' | 'reject') => {
    if (reviewingId) return;
    setReviewingId(draft.id);
    setError('');
    setNotice('');
    try {
      if (action === 'approve') {
        const result = await apiPatch<{
          success: true;
          status: 'approved';
          shareUrl: string;
          quote: { id: string; quoteNo: string };
        }>(`/api/merchant/ai-order-drafts/${encodeURIComponent(draft.id)}`, { action });
        setDrafts(current => current.map(item => item.id === draft.id ? { ...item, status: 'approved', salesQuoteId: result.quote.id } : item));
        setApprovedQuote({ quoteNo: result.quote.quoteNo, shareUrl: result.shareUrl });
        onQuoteCreated();
        setNotice('审核完成并创建了报价草稿。系统未发送给买家；复制链接并由商家确认发送。');
      } else {
        await apiPatch(`/api/merchant/ai-order-drafts/${encodeURIComponent(draft.id)}`, { action });
        setDrafts(current => current.map(item => item.id === draft.id ? { ...item, status: 'rejected' } : item));
        setNotice('AI 方案已拒绝，未创建报价或订单。');
      }
    } catch (reviewError) {
      const code = reviewError instanceof Error ? reviewError.message : '';
      setError(code === 'AI_ORDER_DRAFT_STALE'
        ? '客户资格、商品或价格已变化。草稿已标记为过期，请重新生成并审核。'
        : code || '审核操作失败，请重试。');
    } finally {
      setReviewingId(null);
    }
  };

  const copyApprovedQuoteLink = async () => {
    if (!approvedQuote) return;
    try {
      await navigator.clipboard.writeText(approvedQuote.shareUrl);
      setNotice(`${approvedQuote.quoteNo} 的买家确认链接已复制；只有买家确认后才会创建正式订单。`);
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : '复制报价链接失败，请检查浏览器剪贴板权限。');
    }
  };

  const formatMoney = (amount: number) => `€${amount.toFixed(2)}`;

  return (
    <section className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 sm:p-5" aria-labelledby="ai-wholesale-draft-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-emerald-800" /><h3 id="ai-wholesale-draft-title" className="text-sm font-bold text-neutral-950">AI 批发订货方案 · 商家审批</h3></div>
          <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-neutral-600">
            <span>按已上架 SKU</span>
            <span>按客户折扣</span>
            <span>审批后生成报价</span>
            <span>买家确认转订单</span>
            <span>发送至平台 AI</span>
            <span>勿填个人信息</span>
          </div>
        </div>
        <button type="button" onClick={() => void loadDrafts()} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[10px] font-semibold text-neutral-700 disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />刷新草稿
        </button>
      </div>

      {error && <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</p>}
      {notice && <p role="status" className="mt-3 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs text-emerald-800">{notice}</p>}
      {approvedQuote && <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-white p-3 text-xs">
        <b>{approvedQuote.quoteNo}</b>
        <button type="button" onClick={() => void copyApprovedQuoteLink()} className="inline-flex items-center gap-1 rounded-lg bg-neutral-950 px-3 py-2 text-[10px] font-semibold text-white"><Copy className="h-3 w-3" />复制买家报价链接</button>
      </div>}

      <form onSubmit={event => void createDraft(event)} className="mt-4 grid gap-3 rounded-xl border border-neutral-200 bg-white p-3 sm:grid-cols-2">
        <label className="grid gap-1 text-[10px] font-semibold text-neutral-600 sm:col-span-2">已审核并关联的买家
          <select required value={customerId} onChange={event => setCustomerId(event.target.value)} disabled={creating} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-normal text-neutral-800">
            <option value="">选择买家</option>{customers.filter(customer => customer.status === 'approved').map(customer => <option key={customer.id} value={customer.id}>{customer.companyName}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-[10px] font-semibold text-neutral-600 sm:col-span-2">订货需求 / 款号 / 尺码配比
          <textarea required value={request} maxLength={2000} rows={3} onChange={event => setRequest(event.target.value)} disabled={creating} placeholder="例如：为春季上新推荐款号 RU-120，M/L/XL 按 2:3:1 配货，每个 SKU 满足 MOQ 与装箱要求。" className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-normal leading-5 text-neutral-800" />
        </label>
        <label className="grid gap-1 text-[10px] font-semibold text-neutral-600">确认交期（天）
          <input required type="number" min="1" max="365" value={leadTimeDays} onChange={event => setLeadTimeDays(event.target.value)} disabled={creating} className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-normal text-neutral-800" />
        </label>
        <label className="grid gap-1 text-[10px] font-semibold text-neutral-600">交付 / 物流条款
          <input required maxLength={1000} value={deliveryTerms} onChange={event => setDeliveryTerms(event.target.value)} disabled={creating} placeholder="例如：EXW · Milano" className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-normal text-neutral-800" />
        </label>
        <label className="grid gap-1 text-[10px] font-semibold text-neutral-600 sm:col-span-2">付款条款
          <input required maxLength={1000} value={paymentTerms} onChange={event => setPaymentTerms(event.target.value)} disabled={creating} placeholder="由商家填写已确认的付款条件；AI 不会拟定或推断。" className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-normal text-neutral-800" />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2">
          <span className="text-[10px] text-neutral-500">AI 不会读取买家联系方式，不会决定条款、改库存或下单。</span>
          <button type="submit" disabled={creating || !customerId || !customers.some(customer => customer.id === customerId && customer.status === 'approved')} className="inline-flex items-center gap-2 rounded-lg bg-neutral-950 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">
            {creating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}{creating ? '正在拟定…' : '生成待审批方案'}
          </button>
        </div>
      </form>

      <div className="mt-4 space-y-3">
        {loading ? <p role="status" className="rounded-lg bg-white p-4 text-center text-xs text-neutral-500">加载审批方案…</p>
          : drafts.length === 0 ? <p className="rounded-lg bg-white p-4 text-center text-xs text-neutral-500">暂无 AI 批发订货方案。</p>
            : drafts.map(draft => {
              const totalQty = draft.totalQty ?? draft.items.reduce((sum, item) => sum + item.quantity, 0);
              const totalAmount = draft.totalAmount ?? draft.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
              return <article key={draft.id} className="rounded-xl border border-neutral-200 bg-white p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><b className="text-xs text-neutral-900">{draft.customerName || customers.find(customer => customer.id === draft.customerId)?.companyName || '买家'}</b><span className="ml-2 text-[10px] text-neutral-500">{new Date(draft.createdAt).toLocaleString()}</span></div>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${draft.status === 'pending_review' ? 'bg-amber-50 text-amber-800' : draft.status === 'approved' ? 'bg-emerald-50 text-emerald-800' : 'bg-neutral-100 text-neutral-600'}`}>{statusLabels[draft.status]}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-neutral-600">{draft.request}</p>
                <div className="mt-2 overflow-x-auto rounded-lg border border-neutral-100">
                  <table className="w-full min-w-[570px] text-left text-[10px]">
                    <thead className="bg-neutral-50 text-neutral-500"><tr>{['款号 / 商品', 'SKU', '颜色 / 尺码', '数量', '买家单价', '金额'].map(label => <th key={label} className="px-2.5 py-2 font-semibold">{label}</th>)}</tr></thead>
                    <tbody>{draft.items.map((item, index) => <tr key={`${item.productId}-${item.sku}-${index}`} className="border-t border-neutral-100 text-neutral-700"><td className="px-2.5 py-2">{item.styleNo} · {item.productName}</td><td className="px-2.5 py-2 font-mono">{item.sku}</td><td className="px-2.5 py-2">{item.color} / {item.size}</td><td className="px-2.5 py-2">{item.quantity}</td><td className="px-2.5 py-2">{formatMoney(item.unitPrice)}</td><td className="px-2.5 py-2">{formatMoney(item.unitPrice * item.quantity)}</td></tr>)}</tbody>
                  </table>
                </div>
                <div className="mt-2 grid gap-1 text-[10px] text-neutral-600 sm:grid-cols-3">
                  <span>总件数：<b>{totalQty}</b></span><span>报价金额：<b>{formatMoney(totalAmount)}</b></span><span>交期：<b>{draft.leadTimeDays} 天</b></span>
                  <span>交付条款：{draft.deliveryTerms}</span><span className="sm:col-span-2">付款条款：{draft.paymentTerms}</span>
                </div>
                {draft.status === 'pending_review' && <div className="mt-3 flex justify-end gap-2 border-t border-neutral-100 pt-3">
                  <button type="button" onClick={() => void reviewDraft(draft, 'reject')} disabled={reviewingId !== null} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-[10px] font-semibold text-neutral-700 disabled:opacity-50"><X className="h-3.5 w-3.5" />{reviewingId === draft.id ? '处理中…' : '拒绝方案'}</button>
                  <button type="button" onClick={() => void reviewDraft(draft, 'approve')} disabled={reviewingId !== null} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 px-3 py-2 text-[10px] font-semibold text-white disabled:opacity-50"><Check className="h-3.5 w-3.5" />{reviewingId === draft.id ? '审核中…' : '审批并创建报价草稿'}</button>
                </div>}
              </article>;
            })}
      </div>
    </section>
  );
};

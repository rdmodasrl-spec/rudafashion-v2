import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useB2B } from '../../../../context/B2BContext';
import { ApiError, apiGet, apiPost, apiPut } from '../../../../api/client';

type Tab = 'home' | 'orders' | 'statements' | 'payments';

interface VariantOption { id: string; sku: string; color: string | null; size: string | null }
interface ProductOption { id: string; name: string; styleNo: string | null; image: string | null; variants: VariantOption[] }
interface FactoryOption {
  id: string; name: string; status: string; contactName: string | null; phone: string | null;
  email: string | null; settlementTerms: string | null; inviteExpiresAt: string | null; inviteAcceptedAt: string | null;
}
interface OrderItemView {
  id: string; sku: string; color: string | null; size: string | null; plannedQuantity: number;
  deliveredQuantity: number; acceptedQuantity: number; rejectedQuantity: number; reworkQuantity: number;
  shortageQuantity: number; remainingQuantity: number; unitPrice?: number; amount?: number;
}
interface OrderView {
  id: string; orderNo: string; status: string; currency: string; plannedQuantity: number;
  deliveredQuantity: number; acceptedQuantity: number; rejectedQuantity: number; reworkQuantity: number;
  shortageQuantity: number; remainingQuantity: number; pickupDate: string | null; dueDate: string | null;
  notes: string | null; createdAt: string; factory: { id: string; name: string } | null;
  product: { id: string; name: string; styleNo: string | null; image: string | null } | null;
  items: OrderItemView[]; plannedAmount?: number; unitPrice?: number;
}
interface PickupView {
  id: string; pickupNo: string; pickupDate: string; pieces: number; packages: number;
  receivedPieces: number | null; difference: number; note: string | null; status: string;
}
interface DeliveryItemView {
  id: string; orderItemId: string; sku: string; color: string | null; size: string | null;
  declaredQuantity: number; receivedQuantity: number; acceptedQuantity: number;
  rejectedQuantity: number; reworkQuantity: number; shortageQuantity: number;
}
interface DeliveryView {
  id: string; deliveryNo: string; status: string; note: string | null; submittedAt: string;
  inspectedAt: string | null; items: DeliveryItemView[];
}
interface MessageView { id: string; authorSide: string; authorName: string; body: string; createdAt: string }
interface OrderDetailResponse {
  success: true; order: OrderView; pickups: PickupView[]; deliveries: DeliveryView[]; messages: MessageView[];
}
interface StatementLineView {
  id: string; orderId: string; orderNo: string; styleNo: string | null; productName: string;
  quantity: number; amount?: number; breakdown: { sku: string; color: string | null; size: string | null; quantity: number }[];
}
interface StatementView {
  id: string; statementNo: string; factoryId: string; factory: { id: string; name: string } | null;
  periodMonth: string; version: number; status: string; disputeReason: string | null; note: string | null;
  merchantConfirmedAt: string | null; factoryConfirmedAt: string | null; confirmedAt: string | null;
  createdAt: string; lines: StatementLineView[];
  adjustments: { id: string; reason: string; createdBySide: string; createdAt: string; amount?: number }[];
  payments: { id: string; paidAt: string; method: string | null; reference: string | null; note: string | null; amount?: number }[];
  currency?: string; openingBalance?: number; laborAmount?: number; adjustmentAmount?: number;
  totalAmount?: number; paidAmount?: number; closingBalance?: number;
}
interface StatementDetailResponse { success: true; statement: StatementView; messages: MessageView[] }
interface CatalogResponse { success: true; products: ProductOption[]; factories: FactoryOption[] }
interface FactoryRow extends FactoryOption { orderCount: number; members: { id: string; name: string; email: string; role: string; active: boolean; lastLoginAt: string | null }[] }
interface FactoriesResponse { success: true; factories: FactoryRow[] }
interface SummaryResponse {
  success: true;
  summary: {
    openOrders: number; pendingFactory: number; inProduction: number; pendingInspection: number;
    pendingStatements: number; completedOrders: number; plannedQuantity: number;
    monthPaid: number | null; monthLabor: number | null; outstanding: number | null; currency: string;
  };
}
interface PaymentView {
  id: string; amount: number | null; currency: string; method: string | null; reference: string | null;
  note: string | null; paidAt: string; factory: { id: string; name: string } | null;
  statement: { id: string; statementNo: string; periodMonth: string } | null;
}

const orderStatusLabels: Record<string, string> = {
  draft: '草稿',
  pending_factory: '待工厂接单',
  accepted: '工厂已接单',
  in_production: '加工中',
  completed: '已完成',
  cancelled: '已取消'
};
const statementStatusLabels: Record<string, string> = {
  draft: '草稿',
  pending_factory: '待工厂确认',
  confirmed: '双方已确认',
  disputed: '工厂有异议',
  superseded: '已作废'
};

function money(value: number | null | undefined, currency = 'EUR'): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}

function dateText(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const map: Record<string, string> = {
      PRODUCTION_INPUT_INVALID: '请检查填写内容。',
      PRODUCTION_ORDER_NOT_EDITABLE: '加工单状态已变化，请刷新后重试。',
      PRODUCTION_ORDER_NOT_FOUND: '加工单不存在或无权访问。',
      PRODUCTION_FACTORY_NOT_FOUND: '加工厂不存在或已被移除。',
      PRODUCTION_FACTORY_EXISTS: '该加工厂已存在。',
      PRODUCTION_FACTORY_NOT_ACTIVE: '工厂尚未接受邀请，暂时不能外发。',
      PRODUCTION_STATEMENT_CONFIRMED: '已确认的结算单不可重新生成。',
      PRODUCTION_STATEMENT_CONFLICT: '结算数据已被其他操作更新，请刷新后重试。',
      PRODUCTION_STATEMENT_STATUS_INVALID: '结算单当前状态不允许该操作。',
      PRODUCTION_PAYMENT_EXCEEDS_OUTSTANDING: '付款金额超过该结算单未结金额。',
      PRODUCTION_PAYMENT_CONFLICT: '结算单已变化，请刷新后重试。',
      PRODUCTION_PAYMENT_DUPLICATE: '该付款已登记。',
      PRODUCTION_DELIVERY_ALREADY_INSPECTED: '该送货单已验收。',
      PRODUCTION_INSPECTION_INVALID: '验收数量不成立：合格 + 不合格必须等于实收。',
      PRODUCTION_DELIVERY_EXCEEDS_PLANNED: '送货数量超过订单未交数量。'
    };
    if (error.code && map[error.code]) return map[error.code];
    return error.message || fallback;
  }
  return fallback;
}

function StatusBadge({ label, tone }: { label: string; tone?: 'neutral' | 'warn' | 'good' | 'bad' }) {
  const palette = {
    neutral: 'border-neutral-200 bg-neutral-50 text-neutral-600',
    warn: 'border-amber-200 bg-amber-50 text-amber-700',
    good: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    bad: 'border-rose-200 bg-rose-50 text-rose-700'
  };
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] tracking-wide ${palette[tone || 'neutral']}`}>{label}</span>;
}

function orderTone(status: string): 'neutral' | 'warn' | 'good' | 'bad' {
  if (status === 'completed') return 'good';
  if (status === 'cancelled') return 'bad';
  if (status === 'pending_factory' || status === 'accepted') return 'warn';
  return 'neutral';
}

function statementTone(status: string): 'neutral' | 'warn' | 'good' | 'bad' {
  if (status === 'confirmed') return 'good';
  if (status === 'disputed') return 'bad';
  if (status === 'pending_factory') return 'warn';
  return 'neutral';
}

const inputClass = 'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[13px] text-neutral-900 outline-none focus:border-neutral-900';
const primaryButton = 'inline-flex items-center justify-center whitespace-nowrap rounded-lg bg-neutral-900 px-4 py-2 text-[13px] font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButton = 'inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-[12px] font-medium text-neutral-800 transition hover:border-neutral-900 disabled:opacity-50';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-[12px] text-neutral-500">
      <span>{label}</span>
      {children}
    </label>
  );
}

function EmptyState({ title }: { title: string }) {
  return <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-10 text-center text-[13px] text-neutral-500">{title}</div>;
}

function StatCard({ label, value, emphasis }: { label: string; value: React.ReactNode; emphasis?: boolean }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${emphasis ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-white'}`}>
      <div className={`text-[11px] ${emphasis ? 'text-neutral-300' : 'text-neutral-500'}`}>{label}</div>
      <div className={`mt-1 text-xl font-semibold ${emphasis ? 'text-white' : 'text-neutral-950'}`}>{value}</div>
    </div>
  );
}

function MessageList({ messages }: { messages: MessageView[] }) {
  if (messages.length === 0) return <p className="text-[12px] text-neutral-500">暂无留言。</p>;
  return (
    <div className="space-y-2">
      {messages.map(message => (
        <div key={message.id} className={`rounded-lg border px-3 py-2 ${message.authorSide === 'merchant' ? 'border-neutral-200 bg-white' : 'border-neutral-200 bg-neutral-50'}`}>
          <div className="flex items-center justify-between text-[11px] text-neutral-500">
            <span>{message.authorName} · {message.authorSide === 'merchant' ? '商家' : '工厂'}</span>
            <span>{new Date(message.createdAt).toLocaleString('zh-CN')}</span>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-[13px] text-neutral-800">{message.body}</p>
        </div>
      ))}
    </div>
  );
}

function MessageComposer({ value, onChange, onSend, busy }: {
  value: string; onChange: (value: string) => void; onSend: () => void; busy: boolean;
}) {
  return (
    <div className="mt-3 flex gap-2">
      <input className={inputClass} placeholder="输入留言" value={value} onChange={event => onChange(event.target.value)} maxLength={2000} />
      <button type="button" className={primaryButton} onClick={onSend} disabled={busy || !value.trim()}>发送</button>
    </div>
  );
}


function OrderCreateForm({ catalog, onCancel, onCreated, notifyError }: {
  catalog: CatalogResponse;
  onCancel: () => void;
  onCreated: (order: OrderView) => void;
  notifyError: (message: string) => void;
}) {
  const [factoryId, setFactoryId] = useState(catalog.factories.find(factory => factory.status === 'active')?.id || '');
  const [productId, setProductId] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [unitPrice, setUnitPrice] = useState('0');
  const [pickupDate, setPickupDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const product = catalog.products.find(candidate => candidate.id === productId) || null;
  const colors = useMemo(() => Array.from(new Set((product?.variants || []).map(variant => variant.color || '未分组'))), [product]);
  const sizes = useMemo(() => Array.from(new Set((product?.variants || []).map(variant => variant.size || '均码'))), [product]);
  const totalQuantity = Object.values(quantities).reduce((sum, value) => sum + (Number(value) > 0 ? Number(value) : 0), 0);
  const totalAmount = totalQuantity * (Number(unitPrice) || 0);

  const submit = async (send: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const items = (product?.variants || [])
        .map(variant => ({ variantId: variant.id, quantity: Number(quantities[variant.id] || 0) }))
        .filter(item => Number.isInteger(item.quantity) && item.quantity > 0);
      if (!factoryId) throw new Error('请选择加工厂。');
      if (!productId) throw new Error('请选择商品。');
      if (items.length === 0) throw new Error('请至少填写一个尺码的数量。');
      const response = await apiPost<{ success: true; order: OrderView }>('/api/production/orders', {
        factoryId,
        productId,
        unitPrice: Number(unitPrice) || 0,
        pickupDate: pickupDate || null,
        dueDate: dueDate || null,
        notes: notes || null,
        items,
        send
      });
      onCreated(response.order);
    } catch (submitError) {
      const message = errorMessage(submitError, '加工单创建失败，请重试。');
      setError(message);
      notifyError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-neutral-900">新建加工单</h3>
        <button type="button" className={secondaryButton} onClick={onCancel}>返回</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="加工厂">
          <select className={inputClass} value={factoryId} onChange={event => setFactoryId(event.target.value)}>
            <option value="">请选择</option>
            {catalog.factories.map(factory => (
              <option key={factory.id} value={factory.id} disabled={factory.status !== 'active'}>
                {factory.name}{factory.status === 'active' ? '' : `（${factory.status === 'invited' ? '待接受邀请' : '已暂停'}）`}
              </option>
            ))}
          </select>
        </Field>
        <Field label="商品">
          <select className={inputClass} value={productId} onChange={event => { setProductId(event.target.value); setQuantities({}); }}>
            <option value="">请选择</option>
            {catalog.products.map(candidate => (
              <option key={candidate.id} value={candidate.id}>{candidate.styleNo ? `${candidate.styleNo} · ` : ''}{candidate.name}</option>
            ))}
          </select>
        </Field>
        <Field label="加工单价（EUR）">
          <input className={inputClass} type="number" min="0" step="0.01" value={unitPrice} onChange={event => setUnitPrice(event.target.value)} />
        </Field>
        <Field label="取货日期">
          <input className={inputClass} type="date" value={pickupDate} onChange={event => setPickupDate(event.target.value)} />
        </Field>
        <Field label="约定交期">
          <input className={inputClass} type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} />
        </Field>
        <Field label="备注">
          <input className={inputClass} value={notes} onChange={event => setNotes(event.target.value)} maxLength={1000} placeholder="颜色、工艺或交付要求" />
        </Field>
      </div>


      {product && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-[12px]">
            <thead>
              <tr className="text-neutral-500">
                <th className="border-b border-neutral-200 px-2 py-2 text-left font-medium">颜色 / 尺码</th>
                {sizes.map(size => <th key={size} className="border-b border-neutral-200 px-2 py-2 text-center font-medium">{size}</th>)}
              </tr>
            </thead>
            <tbody>
              {colors.map(color => (
                <tr key={color}>
                  <td className="border-b border-neutral-100 px-2 py-1.5 text-neutral-800">{color}</td>
                  {sizes.map(size => {
                    const variant = product.variants.find(candidate => (candidate.color || '未分组') === color && (candidate.size || '均码') === size);
                    if (!variant) return <td key={size} className="border-b border-neutral-100 px-2 py-1.5 text-center text-neutral-300">—</td>;
                    return (
                      <td key={size} className="border-b border-neutral-100 px-1 py-1">
                        <input
                          className="w-16 rounded border border-neutral-200 px-2 py-1 text-center text-[12px] outline-none focus:border-neutral-900"
                          type="number" min="0" step="1" placeholder="0"
                          value={quantities[variant.id] || ''}
                          onChange={event => setQuantities(previous => ({ ...previous, [variant.id]: event.target.value }))}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-3 text-[12px] text-neutral-600">
        <span>合计 {totalQuantity} 件 · {money(totalAmount)}</span>
        <div className="flex gap-2">
          <button type="button" className={secondaryButton} onClick={() => void submit(false)} disabled={busy}>保存草稿</button>
          <button type="button" className={primaryButton} onClick={() => void submit(true)} disabled={busy}>外发给工厂</button>
        </div>
      </div>
      {error && <p className="text-[12px] text-rose-600">{error}</p>}
    </div>
  );
}

function FactoryCreateForm({ onCreated, notifyError }: {
  onCreated: (invitePath: string, name: string) => void;
  notifyError: (message: string) => void;
}) {
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [settlementTerms, setSettlementTerms] = useState('月结');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const response = await apiPost<{ success: true; invitePath: string }>('/api/production/factories', {
        name: name.trim(), contactName, phone, email, settlementTerms
      });
      onCreated(response.invitePath, name.trim());
      setName(''); setContactName(''); setPhone(''); setEmail('');
    } catch (error) {
      notifyError(errorMessage(error, '加工厂创建失败，请重试。'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
      <h3 className="text-[15px] font-semibold text-neutral-900">新增加工厂</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="工厂名称"><input className={inputClass} value={name} onChange={event => setName(event.target.value)} maxLength={120} /></Field>
        <Field label="联系人"><input className={inputClass} value={contactName} onChange={event => setContactName(event.target.value)} maxLength={80} /></Field>
        <Field label="电话"><input className={inputClass} value={phone} onChange={event => setPhone(event.target.value)} maxLength={40} /></Field>
        <Field label="邮箱"><input className={inputClass} value={email} onChange={event => setEmail(event.target.value)} maxLength={160} /></Field>
        <Field label="结算方式"><input className={inputClass} value={settlementTerms} onChange={event => setSettlementTerms(event.target.value)} maxLength={200} /></Field>
      </div>
      <div className="flex justify-end">
        <button type="button" className={primaryButton} onClick={() => void submit()} disabled={busy || !name.trim()}>创建并生成邀请</button>
      </div>
    </div>
  );
}


function OrderDetail({ orderId, onBack, notifyError, notifySuccess, reloadList }: {
  orderId: string;
  onBack: () => void;
  notifyError: (message: string) => void;
  notifySuccess: (title: string, body: string) => void;
  reloadList: () => void;
}) {
  const [detail, setDetail] = useState<OrderDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [pickupDate, setPickupDate] = useState(new Date().toISOString().slice(0, 10));
  const [pieces, setPieces] = useState('');
  const [packages, setPackages] = useState('');
  const [pickupNote, setPickupNote] = useState('');
  const [inspection, setInspection] = useState<Record<string, { received: string; accepted: string; rejected: string; rework: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiGet<OrderDetailResponse>(`/api/production/orders/${orderId}`);
      setDetail(response);
      const next: Record<string, { received: string; accepted: string; rejected: string; rework: string }> = {};
      for (const delivery of response.deliveries) {
        for (const item of delivery.items) {
          next[item.id] = {
            received: String(item.receivedQuantity || item.declaredQuantity),
            accepted: String(item.acceptedQuantity || item.declaredQuantity),
            rejected: String(item.rejectedQuantity || 0),
            rework: String(item.reworkQuantity || 0)
          };
        }
      }
      setInspection(next);
    } catch (error) {
      notifyError(errorMessage(error, '加工单加载失败。'));
    } finally {
      setLoading(false);
    }
  }, [orderId, notifyError]);

  useEffect(() => { void load(); }, [load]);

  const act = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await action();
      notifySuccess(success, '操作已完成。');
      await load();
      reloadList();
    } catch (error) {
      notifyError(errorMessage(error, '操作失败，请重试。'));
    } finally {
      setBusy(false);
    }
  };

  const submitPickup = () => act(async () => {
    await apiPost(`/api/production/orders/${orderId}/pickups`, {
      pickupDate, pieces: Number(pieces), packages: Number(packages || 0), note: pickupNote || null
    });
    setPieces(''); setPackages(''); setPickupNote('');
  }, '取货已登记');

  const inspect = (delivery: DeliveryView) => act(async () => {
    await apiPost(`/api/production/orders/${orderId}/deliveries/${delivery.id}/inspect`, {
      items: delivery.items.map(item => {
        const current = inspection[item.id];
        return {
          deliveryItemId: item.id,
          receivedQuantity: Number(current?.received || 0),
          acceptedQuantity: Number(current?.accepted || 0),
          rejectedQuantity: Number(current?.rejected || 0),
          reworkQuantity: Number(current?.rework || 0)
        };
      })
    });
  }, '验收已保存');

  if (loading || !detail) {
    return <div className="rounded-xl border border-neutral-200 bg-white px-4 py-10 text-center text-[13px] text-neutral-500">正在加载加工单…</div>;
  }
  const { order } = detail;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button type="button" className={secondaryButton} onClick={onBack}>返回列表</button>
          <h2 className="mt-3 text-lg font-semibold text-neutral-950">{order.orderNo}</h2>
          <p className="mt-1 text-[12px] text-neutral-500">
            {order.product?.styleNo ? `${order.product.styleNo} · ` : ''}{order.product?.name || '加工商品'} · {order.factory?.name || '工厂'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge label={orderStatusLabels[order.status] || order.status} tone={orderTone(order.status)} />
          {order.status === 'draft' && (
            <button type="button" className={primaryButton} disabled={busy} onClick={() => void act(
              () => apiPost(`/api/production/orders/${orderId}/submit`, {}), '加工单已外发'
            )}>外发给工厂</button>
          )}
          {['draft', 'pending_factory', 'accepted', 'in_production'].includes(order.status) && (
            <button type="button" className={secondaryButton} disabled={busy} onClick={() => {
              if (!window.confirm('确认取消该加工单？')) return;
              void act(() => apiPost(`/api/production/orders/${orderId}/cancel`, {}), '加工单已取消');
            }}>取消加工单</button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="计划数量" value={order.plannedQuantity} />
        <StatCard label="已交数量" value={order.deliveredQuantity} />
        <StatCard label="合格数量" value={order.acceptedQuantity} emphasis />
        <StatCard label="不合格" value={order.rejectedQuantity} />
        <StatCard label="返工" value={order.reworkQuantity} />
        <StatCard label="短少" value={order.shortageQuantity} />
      </div>

      <div className="grid gap-3 text-[12px] text-neutral-600 sm:grid-cols-3">
        <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2">取货日期：{dateText(order.pickupDate)}</div>
        <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2">约定交期：{dateText(order.dueDate)}</div>
        <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2">加工费：{money(order.plannedAmount, order.currency)}</div>
      </div>
      {order.notes && <p className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[12px] text-neutral-600">备注：{order.notes}</p>}


      <section className="rounded-xl border border-neutral-200 bg-white">
        <div className="border-b border-neutral-100 px-4 py-3 text-[13px] font-medium text-neutral-900">尺码明细</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-[12px]">
            <thead>
              <tr className="text-neutral-500">
                <th className="px-3 py-2 text-left font-medium">SKU</th>
                <th className="px-3 py-2 text-left font-medium">颜色</th>
                <th className="px-3 py-2 text-left font-medium">尺码</th>
                <th className="px-3 py-2 text-right font-medium">计划</th>
                <th className="px-3 py-2 text-right font-medium">已交</th>
                <th className="px-3 py-2 text-right font-medium">合格</th>
                <th className="px-3 py-2 text-right font-medium">次品</th>
                <th className="px-3 py-2 text-right font-medium">剩余</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map(item => (
                <tr key={item.id} className="border-t border-neutral-100 text-neutral-800">
                  <td className="px-3 py-2">{item.sku}</td>
                  <td className="px-3 py-2">{item.color || '—'}</td>
                  <td className="px-3 py-2">{item.size || '—'}</td>
                  <td className="px-3 py-2 text-right">{item.plannedQuantity}</td>
                  <td className="px-3 py-2 text-right">{item.deliveredQuantity}</td>
                  <td className="px-3 py-2 text-right font-medium">{item.acceptedQuantity}</td>
                  <td className="px-3 py-2 text-right">{item.rejectedQuantity}</td>
                  <td className="px-3 py-2 text-right">{item.remainingQuantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
        <h3 className="text-[13px] font-medium text-neutral-900">取货交接</h3>
        {detail.pickups.length === 0 && <p className="text-[12px] text-neutral-500">尚未登记取货。</p>}
        {detail.pickups.map(pickup => (
          <div key={pickup.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2 text-[12px] text-neutral-700">
            <span>{pickup.pickupNo} · {dateText(pickup.pickupDate)} · {pickup.pieces} 件 / {pickup.packages} 包</span>
            <span className="flex items-center gap-2">
              <StatusBadge label={pickup.status === 'confirmed' ? '工厂已确认' : '待工厂确认'} tone={pickup.status === 'confirmed' ? 'good' : 'warn'} />
              {pickup.receivedPieces !== null && (
                <span className={pickup.difference === 0 ? 'text-emerald-700' : 'text-rose-600'}>
                  实收 {pickup.receivedPieces} 件{pickup.difference === 0 ? '' : `（差异 ${pickup.difference}）`}
                </span>
              )}
            </span>
          </div>
        ))}
        {order.status !== 'completed' && order.status !== 'cancelled' && (
          <div className="grid gap-2 sm:grid-cols-4">
            <Field label="取货日期"><input className={inputClass} type="date" value={pickupDate} onChange={event => setPickupDate(event.target.value)} /></Field>
            <Field label="件数"><input className={inputClass} type="number" min="1" value={pieces} onChange={event => setPieces(event.target.value)} /></Field>
            <Field label="包数"><input className={inputClass} type="number" min="0" value={packages} onChange={event => setPackages(event.target.value)} /></Field>
            <div className="flex items-end"><button type="button" className={primaryButton} disabled={busy || !pieces} onClick={() => void submitPickup()}>登记取货</button></div>
          </div>
        )}
      </section>


      <section className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
        <h3 className="text-[13px] font-medium text-neutral-900">送货与验收</h3>
        {detail.deliveries.length === 0 && <p className="text-[12px] text-neutral-500">工厂尚未登记送货。</p>}
        {detail.deliveries.map(delivery => (
          <div key={delivery.id} className="rounded-lg border border-neutral-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-3 py-2 text-[12px] text-neutral-600">
              <span>{delivery.deliveryNo} · {new Date(delivery.submittedAt).toLocaleString('zh-CN')}</span>
              <StatusBadge label={delivery.status === 'submitted' ? '待验收' : '已验收'} tone={delivery.status === 'submitted' ? 'warn' : 'good'} />
            </div>
            <div className="space-y-2 px-3 py-2">
              {delivery.items.map(item => {
                const current = inspection[item.id] || { received: '', accepted: '', rejected: '', rework: '' };
                const editable = delivery.status === 'submitted';
                return (
                  <div key={item.id} className="grid items-center gap-2 text-[12px] sm:grid-cols-[1fr_repeat(4,90px)]">
                    <div className="text-neutral-800">{item.sku} · 送货 {item.declaredQuantity}</div>
                    {(['received', 'accepted', 'rejected', 'rework'] as const).map(field => (
                      <label key={field} className="flex items-center gap-1 text-neutral-500">
                        <span className="w-8 shrink-0">{field === 'received' ? '实收' : field === 'accepted' ? '合格' : field === 'rejected' ? '次品' : '返工'}</span>
                        <input
                          className="w-full rounded border border-neutral-200 px-2 py-1 text-center text-[12px]"
                          type="number" min="0" disabled={!editable}
                          value={current[field]}
                          onChange={event => setInspection(previous => ({
                            ...previous,
                            [item.id]: { ...current, [field]: event.target.value }
                          }))}
                        />
                      </label>
                    ))}
                  </div>
                );
              })}
              {delivery.status === 'submitted' && (
                <div className="flex justify-end">
                  <button type="button" className={primaryButton} disabled={busy} onClick={() => void inspect(delivery)}>保存验收</button>
                </div>
              )}
              {delivery.status !== 'submitted' && delivery.inspectedAt && (
                <p className="text-[11px] text-neutral-500">验收时间：{new Date(delivery.inspectedAt).toLocaleString('zh-CN')}</p>
              )}
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h3 className="text-[13px] font-medium text-neutral-900">单据留言</h3>
        <div className="mt-3"><MessageList messages={detail.messages} /></div>
        <MessageComposer value={message} onChange={setMessage} busy={busy} onSend={() => {
          if (!message.trim()) return;
          void act(async () => {
            await apiPost('/api/production/messages', { scopeType: 'order', scopeId: orderId, body: message.trim() });
            setMessage('');
          }, '留言已发送');
        }} />
      </section>
    </div>
  );
}


function printStatement(statement: StatementView) {
  const win = window.open('', '_blank');
  if (!win) return;
  const currency = statement.currency || 'EUR';
  const rows = statement.lines.map(line => `
    <tr>
      <td>${line.orderNo}</td>
      <td>${line.styleNo || ''}</td>
      <td>${line.productName}</td>
      <td class="num">${line.quantity}</td>
      <td class="num">${money(line.amount, currency)}</td>
    </tr>`).join('');
  const adjustments = statement.adjustments.map(item => `
    <tr><td colspan="4">${item.reason}</td><td class="num">${money(item.amount, currency)}</td></tr>`).join('');
  const payments = statement.payments.map(item => `
    <tr><td colspan="4">${dateText(item.paidAt)} · ${item.method || '付款'}${item.reference ? ` · ${item.reference}` : ''}</td><td class="num">−${money(item.amount, currency)}</td></tr>`).join('');
  win.document.write(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8" />
  <title>${statement.statementNo}</title>
  <style>
    body{font-family:-apple-system,"Helvetica Neue",Arial,sans-serif;color:#111;margin:32px;font-size:12px}
    h1{font-size:18px;margin:0 0 4px}
    .meta{color:#555;margin-bottom:20px;line-height:1.7}
    table{width:100%;border-collapse:collapse;margin-top:12px}
    th,td{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left}
    th{font-weight:600;color:#555;font-size:11px}
    .num{text-align:right}
    .totals{margin-top:16px;margin-left:auto;width:280px}
    .totals div{display:flex;justify-content:space-between;padding:4px 0}
    .totals .grand{border-top:1px solid #111;font-weight:700;margin-top:6px;padding-top:8px}
    h2{font-size:13px;margin:22px 0 4px}
    .foot{margin-top:28px;color:#666;font-size:11px}
  </style></head><body>
  <h1>对账单 ${statement.statementNo}</h1>
  <div class="meta">
    加工厂：${statement.factory?.name || ''}<br />
    结算月份：${statement.periodMonth} · 版本 ${statement.version}<br />
    生成时间：${dateText(statement.createdAt)}
  </div>
  <table>
    <thead><tr><th>加工单</th><th>款号</th><th>商品</th><th class="num">合格数量</th><th class="num">加工费</th></tr></thead>
    <tbody>${rows}${adjustments}${payments}</tbody>
  </table>
  <div class="totals">
    <div><span>期初未结</span><span>${money(statement.openingBalance, currency)}</span></div>
    <div><span>本期加工费</span><span>${money(statement.laborAmount, currency)}</span></div>
    <div><span>调整</span><span>${money(statement.adjustmentAmount, currency)}</span></div>
    <div><span>本期付款</span><span>−${money(statement.paidAmount, currency)}</span></div>
    <div class="grand"><span>期末未结</span><span>${money(statement.closingBalance, currency)}</span></div>
  </div>
  <div class="foot">本对账单由 RUDA 智能生产链生成。仅已验收合格数量计入加工费。</div>
  </body></html>`);
  win.document.close();
  win.focus();
  win.print();
}

function StatementCreateForm({ catalog, onCancel, onCreated, notifyError }: {
  catalog: CatalogResponse;
  onCancel: () => void;
  onCreated: (statement: StatementView) => void;
  notifyError: (message: string) => void;
}) {
  const [factoryId, setFactoryId] = useState(catalog.factories[0]?.id || '');
  const [periodMonth, setPeriodMonth] = useState(new Date().toISOString().slice(0, 7));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const response = await apiPost<{ success: true; statement: StatementView }>('/api/production/statements', {
        factoryId, periodMonth, note: note || null
      });
      onCreated(response.statement);
    } catch (error) {
      notifyError(errorMessage(error, '对账生成失败，请重试。'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-neutral-900">生成月度对账</h3>
        <button type="button" className={secondaryButton} onClick={onCancel}>返回</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="加工厂">
          <select className={inputClass} value={factoryId} onChange={event => setFactoryId(event.target.value)}>
            <option value="">请选择</option>
            {catalog.factories.map(factory => <option key={factory.id} value={factory.id}>{factory.name}</option>)}
          </select>
        </Field>
        <Field label="结算月份">
          <input className={inputClass} type="month" value={periodMonth} onChange={event => setPeriodMonth(event.target.value)} />
        </Field>
        <Field label="备注">
          <input className={inputClass} value={note} onChange={event => setNote(event.target.value)} maxLength={1000} />
        </Field>
      </div>
      <p className="text-[12px] text-neutral-500">只统计该月已验收合格的送货数量；确认后的对账单一经生成不可覆盖。</p>
      <div className="flex justify-end">
        <button type="button" className={primaryButton} disabled={busy || !factoryId} onClick={() => void submit()}>生成对账单</button>
      </div>
    </div>
  );
}


function StatementDetail({ statementId, onBack, notifyError, notifySuccess, reloadList }: {
  statementId: string;
  onBack: () => void;
  notifyError: (message: string) => void;
  notifySuccess: (title: string, body: string) => void;
  reloadList: () => void;
}) {
  const [detail, setDetail] = useState<StatementDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payMethod, setPayMethod] = useState('银行转账');
  const [payReference, setPayReference] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiGet<StatementDetailResponse>(`/api/production/statements/${statementId}`);
      setDetail(response);
      setPayAmount(String(response.statement.closingBalance ?? ''));
    } catch (error) {
      notifyError(errorMessage(error, '对账单加载失败。'));
    } finally {
      setLoading(false);
    }
  }, [statementId, notifyError]);

  useEffect(() => { void load(); }, [load]);

  const act = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await action();
      notifySuccess(success, '操作已完成。');
      await load();
      reloadList();
    } catch (error) {
      notifyError(errorMessage(error, '操作失败，请重试。'));
    } finally {
      setBusy(false);
    }
  };

  if (loading || !detail) {
    return <div className="rounded-xl border border-neutral-200 bg-white px-4 py-10 text-center text-[13px] text-neutral-500">正在加载对账单…</div>;
  }
  const { statement } = detail;
  const currency = statement.currency || 'EUR';
  const editable = statement.status === 'draft' || statement.status === 'disputed';
  const totalQuantity = statement.lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button type="button" className={secondaryButton} onClick={onBack}>返回列表</button>
          <h2 className="mt-3 text-lg font-semibold text-neutral-950">对账单 {statement.statementNo}</h2>
          <p className="mt-1 text-[12px] text-neutral-500">
            {statement.factory?.name || '加工厂'} · {statement.periodMonth} · 版本 {statement.version} · 合格 {totalQuantity} 件
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge label={statementStatusLabels[statement.status] || statement.status} tone={statementTone(statement.status)} />
          <button type="button" className={secondaryButton} onClick={() => printStatement(statement)}>打印 / 导出 PDF</button>
          {editable && (
            <button type="button" className={primaryButton} disabled={busy} onClick={() => void act(
              () => apiPost(`/api/production/statements/${statementId}/submit`, {}), '对账单已提交工厂'
            )}>提交工厂确认</button>
          )}
        </div>
      </div>

      {statement.disputeReason && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">工厂异议：{statement.disputeReason}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="期初未结" value={money(statement.openingBalance, currency)} />
        <StatCard label="本期加工费" value={money(statement.laborAmount, currency)} />
        <StatCard label="调整" value={money(statement.adjustmentAmount, currency)} />
        <StatCard label="本期付款" value={money(statement.paidAmount, currency)} />
        <StatCard label="期末未结" value={money(statement.closingBalance, currency)} emphasis />
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white">
        <div className="border-b border-neutral-100 px-4 py-3 text-[13px] font-medium text-neutral-900">明细</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-[12px]">
            <thead>
              <tr className="text-neutral-500">
                <th className="px-3 py-2 text-left font-medium">加工单</th>
                <th className="px-3 py-2 text-left font-medium">款号</th>
                <th className="px-3 py-2 text-left font-medium">商品</th>
                <th className="px-3 py-2 text-right font-medium">合格数量</th>
                <th className="px-3 py-2 text-right font-medium">加工费</th>
              </tr>
            </thead>
            <tbody>
              {statement.lines.map(line => (
                <tr key={line.id} className="border-t border-neutral-100 text-neutral-800">
                  <td className="px-3 py-2">{line.orderNo}</td>
                  <td className="px-3 py-2">{line.styleNo || '—'}</td>
                  <td className="px-3 py-2">
                    <div>{line.productName}</div>
                    <div className="text-[11px] text-neutral-500">{line.breakdown.map(entry => `${entry.color || ''}${entry.size ? `/${entry.size}` : ''} ×${entry.quantity}`).join(' · ')}</div>
                  </td>
                  <td className="px-3 py-2 text-right">{line.quantity}</td>
                  <td className="px-3 py-2 text-right">{money(line.amount, currency)}</td>
                </tr>
              ))}
              {statement.lines.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-neutral-500">该月没有可结算的合格数量。</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>


      <div className="grid gap-3 lg:grid-cols-2">
        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h3 className="text-[13px] font-medium text-neutral-900">调整项</h3>
          {statement.adjustments.length === 0 && <p className="mt-2 text-[12px] text-neutral-500">暂无调整。</p>}
          <div className="mt-2 space-y-2">
            {statement.adjustments.map(item => (
              <div key={item.id} className="flex items-center justify-between text-[12px] text-neutral-700">
                <span>{item.reason} <span className="text-neutral-400">({item.createdBySide === 'merchant' ? '商家' : '工厂'})</span></span>
                <span>{money(item.amount, currency)}</span>
              </div>
            ))}
          </div>
          {editable && (
            <div className="mt-3 grid gap-2 sm:grid-cols-[110px_1fr_auto]">
              <input className={inputClass} type="number" step="0.01" placeholder="金额" value={adjustAmount} onChange={event => setAdjustAmount(event.target.value)} />
              <input className={inputClass} placeholder="调整原因" value={adjustReason} onChange={event => setAdjustReason(event.target.value)} maxLength={300} />
              <button type="button" className={secondaryButton} disabled={busy || !adjustAmount || !adjustReason} onClick={() => void act(async () => {
                await apiPost(`/api/production/statements/${statementId}/adjustments`, { amount: Number(adjustAmount), reason: adjustReason });
                setAdjustAmount(''); setAdjustReason('');
              }, '调整已添加')}>添加调整</button>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h3 className="text-[13px] font-medium text-neutral-900">付款</h3>
          {statement.payments.length === 0 && <p className="mt-2 text-[12px] text-neutral-500">本期尚无付款记录。</p>}
          <div className="mt-2 space-y-2">
            {statement.payments.map(item => (
              <div key={item.id} className="flex items-center justify-between text-[12px] text-neutral-700">
                <span>{dateText(item.paidAt)} · {item.method || '付款'}{item.reference ? ` · ${item.reference}` : ''}</span>
                <span>{money(item.amount, currency)}</span>
              </div>
            ))}
          </div>
          {statement.status === 'confirmed' && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <input className={inputClass} type="number" min="0" step="0.01" placeholder="付款金额" value={payAmount} onChange={event => setPayAmount(event.target.value)} />
              <input className={inputClass} type="date" value={payDate} onChange={event => setPayDate(event.target.value)} />
              <input className={inputClass} placeholder="方式" value={payMethod} onChange={event => setPayMethod(event.target.value)} maxLength={40} />
              <input className={inputClass} placeholder="流水号/参考" value={payReference} onChange={event => setPayReference(event.target.value)} maxLength={120} />
              <div className="sm:col-span-2 flex justify-end">
                <button type="button" className={primaryButton} disabled={busy || !payAmount || Number(payAmount) <= 0} onClick={() => void act(async () => {
                  await apiPost('/api/production/payments', {
                    factoryId: statement.factoryId,
                    statementId,
                    amount: Number(payAmount),
                    paidAt: payDate,
                    method: payMethod,
                    reference: payReference || null,
                    idempotencyKey: `statement-${statementId.slice(0, 8)}-${Date.now()}`
                  });
                  setPayReference('');
                }, '付款已登记')}>登记付款</button>
              </div>
            </div>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h3 className="text-[13px] font-medium text-neutral-900">单据留言</h3>
        <div className="mt-3"><MessageList messages={detail.messages} /></div>
        <MessageComposer value={message} onChange={setMessage} busy={busy} onSend={() => {
          if (!message.trim()) return;
          void act(async () => {
            await apiPost('/api/production/messages', { scopeType: 'statement', scopeId: statementId, body: message.trim() });
            setMessage('');
          }, '留言已发送');
        }} />
      </section>
    </div>
  );
}


export const ProductionChain: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { addNotification } = useB2B();
  const [tab, setTab] = useState<Tab>('home');
  const [summary, setSummary] = useState<SummaryResponse['summary'] | null>(null);
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [factories, setFactories] = useState<FactoryRow[]>([]);
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [statements, setStatements] = useState<StatementView[]>([]);
  const [payments, setPayments] = useState<PaymentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'list' | 'create-order' | 'create-statement' | 'create-factory'>('list');
  const [detail, setDetail] = useState<{ type: 'order' | 'statement'; id: string } | null>(null);
  const [invitePath, setInvitePath] = useState<{ path: string; name: string } | null>(null);
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [payFactoryId, setPayFactoryId] = useState('');
  const [payStatementId, setPayStatementId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payMethod, setPayMethod] = useState('银行转账');
  const [payReference, setPayReference] = useState('');
  const [busy, setBusy] = useState(false);

  const notifyError = useCallback((message: string) => addNotification('warning', '智能生产链', message), [addNotification]);
  const notifySuccess = useCallback((title: string, body: string) => addNotification('success', title, body), [addNotification]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryResponse, catalogResponse, factoriesResponse, ordersResponse, statementsResponse, paymentsResponse] = await Promise.all([
        apiGet<SummaryResponse>('/api/production/summary'),
        apiGet<CatalogResponse>('/api/production/catalog'),
        apiGet<FactoriesResponse>('/api/production/factories'),
        apiGet<{ success: true; orders: OrderView[] }>('/api/production/orders'),
        apiGet<{ success: true; statements: StatementView[] }>('/api/production/statements'),
        apiGet<{ success: true; payments: PaymentView[] }>('/api/production/payments')
      ]);
      setSummary(summaryResponse.summary);
      setCatalog(catalogResponse);
      setFactories(factoriesResponse.factories);
      setOrders(ordersResponse.orders);
      setStatements(statementsResponse.statements);
      setPayments(paymentsResponse.payments);
    } catch (error) {
      notifyError(errorMessage(error, '智能生产链加载失败，请重试。'));
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => { void load(); }, [load]);

  const copyInvite = async (path: string, name: string) => {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setInvitePath({ path, name });
      notifySuccess('邀请链接已复制', '把链接发给工厂，14 天内有效。');
    } catch {
      setInvitePath({ path, name });
    }
  };

  const rotateInvite = async (factoryId: string) => {
    setBusy(true);
    try {
      const response = await apiPost<{ success: true; invitePath: string }>(`/api/production/factories/${factoryId}/invite`, {});
      const factory = factories.find(item => item.id === factoryId);
      await copyInvite(response.invitePath, factory?.name || '加工厂');
      await load();
    } catch (error) {
      notifyError(errorMessage(error, '邀请链接生成失败。'));
    } finally {
      setBusy(false);
    }
  };

  const toggleFactory = async (factoryId: string) => {
    setBusy(true);
    try {
      await apiPost(`/api/production/factories/${factoryId}/revoke`, {});
      await load();
      notifySuccess('工厂状态已更新', '工厂访问权限已同步。');
    } catch (error) {
      notifyError(errorMessage(error, '工厂状态更新失败。'));
    } finally {
      setBusy(false);
    }
  };

  const registerPayment = async () => {
    setBusy(true);
    try {
      await apiPost('/api/production/payments', {
        factoryId: payFactoryId,
        statementId: payStatementId || null,
        amount: Number(payAmount),
        paidAt: payDate,
        method: payMethod,
        reference: payReference || null,
        idempotencyKey: `payment-${payFactoryId.slice(0, 8)}-${Date.now()}`
      });
      setPayAmount(''); setPayReference('');
      await load();
      notifySuccess('付款已登记', '未结金额已更新。');
    } catch (error) {
      notifyError(errorMessage(error, '付款登记失败。'));
    } finally {
      setBusy(false);
    }
  };


  const filteredOrders = orderStatusFilter ? orders.filter(order => order.status === orderStatusFilter) : orders;
  const factoryStatements = statements.filter(statement => !payFactoryId || statement.factoryId === payFactoryId);
  const activeFactories = factories.filter(factory => factory.status === 'active');

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'home', label: '概览' },
    { key: 'orders', label: '加工单', badge: tab === 'home' ? undefined : summary?.openOrders },
    { key: 'statements', label: '对账', badge: tab === 'home' ? undefined : summary?.pendingStatements },
    { key: 'payments', label: '付款' }
  ];

  return (
    <div className="min-h-full bg-neutral-50 px-4 py-5 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button type="button" className={secondaryButton} onClick={onBack}>返回工作台</button>
          <h1 className="mt-3 text-xl font-semibold text-neutral-950">智能生产链</h1>
          <p className="mt-1 text-[12px] text-neutral-500">外发加工、取货交接、送货验收与月度结算。</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={primaryButton} onClick={() => { setMode(mode === 'create-order' ? 'list' : 'create-order'); setDetail(null); }}>新建加工单</button>
          <button type="button" className={secondaryButton} onClick={() => { setMode(mode === 'create-statement' ? 'list' : 'create-statement'); setDetail(null); }}>生成对账</button>
        </div>
      </header>

      <nav className="mt-4 flex gap-1 overflow-x-auto rounded-xl border border-neutral-200 bg-white p-1">
        {tabs.map(item => (
          <button
            key={item.key}
            type="button"
            className={`flex items-center gap-1 whitespace-nowrap rounded-lg px-3 py-2 text-[13px] ${tab === item.key ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'}`}
            onClick={() => { setTab(item.key); setDetail(null); setMode('list'); }}
          >
            {item.label}
            {item.badge ? <span className={`rounded-full px-1.5 text-[10px] ${tab === item.key ? 'bg-white/20' : 'bg-neutral-100 text-neutral-600'}`}>{item.badge}</span> : null}
          </button>
        ))}
      </nav>

      {invitePath && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
          <span>{invitePath.name} 的邀请链接：{window.location.origin}{invitePath.path}</span>
          <button type="button" className={secondaryButton} onClick={() => setInvitePath(null)}>关闭</button>
        </div>
      )}

      {loading && (
        <div className="mt-4 rounded-xl border border-neutral-200 bg-white px-4 py-10 text-center text-[13px] text-neutral-500">正在加载生产数据…</div>
      )}

      {!loading && detail?.type === 'order' && (
        <div className="mt-4">
          <OrderDetail
            orderId={detail.id}
            onBack={() => setDetail(null)}
            notifyError={notifyError}
            notifySuccess={notifySuccess}
            reloadList={() => { void load(); }}
          />
        </div>
      )}

      {!loading && detail?.type === 'statement' && (
        <div className="mt-4">
          <StatementDetail
            statementId={detail.id}
            onBack={() => setDetail(null)}
            notifyError={notifyError}
            notifySuccess={notifySuccess}
            reloadList={() => { void load(); }}
          />
        </div>
      )}


      {!loading && !detail && tab === 'home' && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="待工厂接单" value={summary?.pendingFactory ?? 0} />
            <StatCard label="加工中" value={summary?.inProduction ?? 0} />
            <StatCard label="待验收送货" value={summary?.pendingInspection ?? 0} />
            <StatCard label="待确认对账" value={summary?.pendingStatements ?? 0} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="本月对账金额" value={money(summary?.monthLabor ?? null, summary?.currency)} />
            <StatCard label="本月已付款" value={money(summary?.monthPaid ?? null, summary?.currency)} />
            <StatCard label="未结余额" value={money(summary?.outstanding ?? null, summary?.currency)} emphasis />
          </div>

          <section className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[15px] font-semibold text-neutral-900">加工厂</h2>
              <button type="button" className={secondaryButton} onClick={() => setMode(mode === 'create-factory' ? 'list' : 'create-factory')}>新增加工厂</button>
            </div>
            {mode === 'create-factory' && catalog && (
              <div className="mt-3">
                <FactoryCreateForm
                  notifyError={notifyError}
                  onCreated={(path, name) => { setMode('list'); void copyInvite(path, name); void load(); }}
                />
              </div>
            )}
            <div className="mt-3 space-y-2">
              {factories.length === 0 && <p className="text-[12px] text-neutral-500">还没有加工厂。先创建工厂并发送邀请链接。</p>}
              {factories.map(factory => (
                <div key={factory.id} className="rounded-lg border border-neutral-200 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-[13px] font-medium text-neutral-900">{factory.name}</div>
                      <div className="text-[11px] text-neutral-500">
                        {factory.contactName || '未填写联系人'}{factory.phone ? ` · ${factory.phone}` : ''} · {factory.orderCount} 张加工单
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        label={factory.status === 'active' ? '已启用' : factory.status === 'invited' ? '待接受邀请' : factory.status === 'suspended' ? '已暂停' : factory.status}
                        tone={factory.status === 'active' ? 'good' : factory.status === 'suspended' ? 'bad' : 'warn'}
                      />
                      <button type="button" className={secondaryButton} disabled={busy} onClick={() => void rotateInvite(factory.id)}>邀请链接</button>
                      <button type="button" className={secondaryButton} disabled={busy} onClick={() => void toggleFactory(factory.id)}>
                        {factory.status === 'suspended' ? '恢复' : '暂停'}
                      </button>
                    </div>
                  </div>
                  {factory.members.length > 0 && (
                    <p className="mt-1 text-[11px] text-neutral-500">
                      登录成员：{factory.members.map(member => `${member.name}（${member.email}）`).join('、')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}


      {!loading && !detail && tab === 'orders' && (
        <div className="mt-4 space-y-3">
          {mode === 'create-order' && catalog && (
            <OrderCreateForm
              catalog={catalog}
              notifyError={notifyError}
              onCancel={() => setMode('list')}
              onCreated={order => { setMode('list'); void load(); setDetail({ type: 'order', id: order.id }); }}
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            {['', 'draft', 'pending_factory', 'accepted', 'in_production', 'completed', 'cancelled'].map(status => (
              <button
                key={status || 'all'}
                type="button"
                className={`rounded-full border px-3 py-1 text-[12px] ${orderStatusFilter === status ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-white text-neutral-600'}`}
                onClick={() => setOrderStatusFilter(status)}
              >
                {status ? orderStatusLabels[status] : '全部'}
              </button>
            ))}
          </div>
          {filteredOrders.length === 0 && <EmptyState title="没有符合条件的加工单。" />}
          <div className="space-y-2">
            {filteredOrders.map(order => (
              <button
                key={order.id}
                type="button"
                className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left transition hover:border-neutral-400"
                onClick={() => setDetail({ type: 'order', id: order.id })}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[13px] font-medium text-neutral-900">
                      {order.orderNo} · {order.product?.styleNo ? `${order.product.styleNo} · ` : ''}{order.product?.name || '加工商品'}
                    </div>
                    <div className="mt-0.5 text-[11px] text-neutral-500">
                      {order.factory?.name || '工厂'} · 计划 {order.plannedQuantity} 件 · 合格 {order.acceptedQuantity} 件 · 交期 {dateText(order.dueDate)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] text-neutral-700">{money(order.plannedAmount, order.currency)}</span>
                    <StatusBadge label={orderStatusLabels[order.status] || order.status} tone={orderTone(order.status)} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {!loading && !detail && tab === 'statements' && (
        <div className="mt-4 space-y-3">
          {mode === 'create-statement' && catalog && (
            <StatementCreateForm
              catalog={catalog}
              notifyError={notifyError}
              onCancel={() => setMode('list')}
              onCreated={statement => { setMode('list'); void load(); setDetail({ type: 'statement', id: statement.id }); }}
            />
          )}
          {statements.length === 0 && <EmptyState title="还没有对账单。按工厂和月份生成第一份对账。" />}
          <div className="space-y-2">
            {statements.map(statement => (
              <button
                key={statement.id}
                type="button"
                className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left transition hover:border-neutral-400"
                onClick={() => setDetail({ type: 'statement', id: statement.id })}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[13px] font-medium text-neutral-900">{statement.statementNo} · {statement.periodMonth}</div>
                    <div className="mt-0.5 text-[11px] text-neutral-500">
                      {statement.factory?.name || '加工厂'} · 版本 {statement.version} · 本期 {money(statement.totalAmount, statement.currency)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] text-neutral-700">未结 {money(statement.closingBalance, statement.currency)}</span>
                    <StatusBadge label={statementStatusLabels[statement.status] || statement.status} tone={statementTone(statement.status)} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}


      {!loading && !detail && tab === 'payments' && (
        <div className="mt-4 space-y-3">
          <section className="rounded-xl border border-neutral-200 bg-white p-4">
            <h2 className="text-[15px] font-semibold text-neutral-900">登记付款</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <Field label="加工厂">
                <select className={inputClass} value={payFactoryId} onChange={event => { setPayFactoryId(event.target.value); setPayStatementId(''); }}>
                  <option value="">请选择</option>
                  {activeFactories.map(factory => <option key={factory.id} value={factory.id}>{factory.name}</option>)}
                </select>
              </Field>
              <Field label="关联对账单（可选）">
                <select className={inputClass} value={payStatementId} onChange={event => setPayStatementId(event.target.value)}>
                  <option value="">不关联</option>
                  {factoryStatements.map(statement => (
                    <option key={statement.id} value={statement.id}>
                      {statement.periodMonth} · {statementStatusLabels[statement.status] || statement.status} · 未结 {money(statement.closingBalance, statement.currency)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="金额（EUR）">
                <input className={inputClass} type="number" min="0" step="0.01" value={payAmount} onChange={event => setPayAmount(event.target.value)} />
              </Field>
              <Field label="付款日期"><input className={inputClass} type="date" value={payDate} onChange={event => setPayDate(event.target.value)} /></Field>
              <Field label="方式"><input className={inputClass} value={payMethod} onChange={event => setPayMethod(event.target.value)} maxLength={40} /></Field>
              <Field label="流水号/参考"><input className={inputClass} value={payReference} onChange={event => setPayReference(event.target.value)} maxLength={120} /></Field>
            </div>
            <div className="mt-3 flex justify-end">
              <button type="button" className={primaryButton} disabled={busy || !payFactoryId || !payAmount || Number(payAmount) <= 0} onClick={() => void registerPayment()}>登记付款</button>
            </div>
          </section>

          {payments.length === 0 && <EmptyState title="还没有付款记录。" />}
          <div className="space-y-2">
            {payments.map(payment => (
              <div key={payment.id} className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-[12px] text-neutral-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[13px] font-medium text-neutral-900">{payment.factory?.name || '加工厂'} · {money(payment.amount, payment.currency)}</div>
                    <div className="mt-0.5 text-[11px] text-neutral-500">
                      {dateText(payment.paidAt)}{payment.method ? ` · ${payment.method}` : ''}{payment.reference ? ` · ${payment.reference}` : ''}
                      {payment.statement ? ` · 对账单 ${payment.statement.statementNo}` : ' · 未关联对账单'}
                    </div>
                  </div>
                  <span className="text-[11px] text-neutral-400">{new Date(payment.paidAt).toLocaleDateString('zh-CN')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};


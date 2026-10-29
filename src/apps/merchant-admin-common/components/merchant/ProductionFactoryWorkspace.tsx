import React, { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * 加工厂工作区（独立会话）。
 * 入口 /merchant/factory：工厂通过邀请链接设置密码或使用已有账号登录，
 * 只能访问本厂加工单、取货确认、送货登记、月度对账与单据留言。
 */

const TOKEN_KEY = 'ruda-production-factory-token';

interface FactorySession {
  factory: { id: string; name: string; status: string };
  member: { id: string; name: string; role: string };
}

interface OrderItem {
  id: string; sku: string; color: string | null; size: string | null;
  plannedQuantity: number; deliveredQuantity: number; acceptedQuantity: number;
  rejectedQuantity: number; remainingQuantity: number;
}
interface Pickup {
  id: string; pickupNo: string; pickupDate: string; pieces: number; packages: number;
  receivedPieces: number | null; difference: number; status: string;
}
interface Delivery {
  id: string; deliveryNo: string; status: string; submittedAt: string;
  items: { id: string; sku: string; declaredQuantity: number; acceptedQuantity: number }[];
}
interface Order {
  id: string; orderNo: string; status: string; plannedQuantity: number; acceptedQuantity: number;
  dueDate: string | null; pickupDate: string | null; notes: string | null;
  product: { name: string; styleNo: string | null } | null;
  items: OrderItem[]; pickups: Pickup[]; deliveries: Delivery[];
}
interface StatementLine { id: string; orderNo: string; productName: string; quantity: number; amount: number }
interface Statement {
  id: string; statementNo: string; periodMonth: string; version: number; status: string;
  disputeReason: string | null; openingBalance: number; laborAmount: number; adjustmentAmount: number;
  totalAmount: number; paidAmount: number; closingBalance: number; currency: string;
  lines: StatementLine[];
  adjustments: { id: string; reason: string; createdBySide: string; amount: number }[];
  payments: { id: string; paidAt: string; method: string | null; reference: string | null; amount: number }[];
}
interface Message { id: string; authorSide: string; authorName: string; body: string; createdAt: string }

function factoryToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function isProductionFactoryEntry(): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.replace(/\/+$/, '').toLowerCase();
  return path === '/merchant/factory' || path === '/factory';
}

async function factoryRequest<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = factoryToken();
  const response = await fetch(path, {
    method: options.method || 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' })
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(typeof payload?.error === 'string' ? payload.error : 'REQUEST_FAILED');
    (error as Error & { code?: string }).code = payload?.error;
    throw error;
  }
  return payload as T;
}

const errorLabels: Record<string, string> = {
  PRODUCTION_FACTORY_AUTH_REQUIRED: '登录已过期，请重新登录。',
  PRODUCTION_FACTORY_AUTH_INVALID: '邮箱或密码不正确。',
  PRODUCTION_FACTORY_ACCESS_REVOKED: '工厂访问已被暂停，请联系商家。',
  PRODUCTION_FACTORY_INVITE_INVALID: '邀请链接无效或已被使用。',
  PRODUCTION_FACTORY_INVITE_EXPIRED: '邀请链接已过期，请联系商家重新生成。',
  PRODUCTION_FACTORY_MEMBER_EXISTS: '该邮箱已设置过登录。',
  PRODUCTION_ORDER_STATUS_INVALID: '加工单状态已变化，请刷新。',
  PRODUCTION_DELIVERY_EXCEEDS_PLANNED: '送货数量超过未交数量。',
  PRODUCTION_STATEMENT_STATUS_INVALID: '对账单当前状态不允许该操作。',
  PRODUCTION_INPUT_INVALID: '请检查填写内容。'
};

function messageOf(error: unknown, fallback: string): string {
  const code = (error as { code?: string })?.code;
  if (code && errorLabels[code]) return errorLabels[code];
  return fallback;
}

const input = 'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[13px] outline-none focus:border-neutral-900';
const primary = 'rounded-lg bg-neutral-900 px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50';
const secondary = 'whitespace-nowrap rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-[12px] font-medium text-neutral-800 disabled:opacity-50';

function money(value: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}

function day(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('zh-CN');
}

const orderLabels: Record<string, string> = {
  pending_factory: '待接单',
  accepted: '已接单',
  in_production: '加工中',
  completed: '已完成',
  cancelled: '已取消',
  draft: '草稿'
};
const statementLabels: Record<string, string> = {
  draft: '草稿',
  pending_factory: '待你确认',
  confirmed: '已确认',
  disputed: '已提异议',
  superseded: '已作废'
};

function printFactoryStatement(statement: Statement) {
  const win = window.open('', '_blank');
  if (!win) return;
  const rows = statement.lines.map(line => `<tr><td>${line.orderNo}</td><td>${line.productName}</td><td style="text-align:right">${line.quantity}</td><td style="text-align:right">${money(line.amount, statement.currency)}</td></tr>`).join('');
  win.document.write(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${statement.statementNo}</title>
  <style>body{font-family:-apple-system,Arial,sans-serif;margin:32px;font-size:12px;color:#111}h1{font-size:18px}
  table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left}
  .totals{margin-top:16px;margin-left:auto;width:280px}.totals div{display:flex;justify-content:space-between;padding:4px 0}
  .grand{border-top:1px solid #111;font-weight:700;margin-top:6px;padding-top:8px}</style></head><body>
  <h1>对账单 ${statement.statementNo}</h1>
  <p>结算月份：${statement.periodMonth} · 版本 ${statement.version}</p>
  <table><thead><tr><th>加工单</th><th>商品</th><th style="text-align:right">合格数量</th><th style="text-align:right">加工费</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="totals">
    <div><span>期初未结</span><span>${money(statement.openingBalance, statement.currency)}</span></div>
    <div><span>本期加工费</span><span>${money(statement.laborAmount, statement.currency)}</span></div>
    <div><span>调整</span><span>${money(statement.adjustmentAmount, statement.currency)}</span></div>
    <div><span>本期付款</span><span>−${money(statement.paidAmount, statement.currency)}</span></div>
    <div class="grand"><span>期末未结</span><span>${money(statement.closingBalance, statement.currency)}</span></div>
  </div></body></html>`);
  win.document.close();
  win.focus();
  win.print();
}

function LoginPanel({ inviteToken, onSignedIn }: { inviteToken: string; onSignedIn: (session: FactorySession, token: string) => void }) {
  const [mode, setMode] = useState<'login' | 'invite'>(inviteToken ? 'invite' : 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = mode === 'invite'
        ? await factoryRequest<FactorySession & { success: true; token: string }>('/api/production/factory/accept-invite', {
          method: 'POST', body: { token: inviteToken, name, email, password }
        })
        : await factoryRequest<FactorySession & { success: true; token: string }>('/api/production/factory/login', {
          method: 'POST', body: { email, password }
        });
      window.localStorage.setItem(TOKEN_KEY, response.token);
      onSignedIn({ factory: response.factory, member: response.member }, response.token);
    } catch (submitError) {
      setError(messageOf(submitError, mode === 'invite' ? '接受邀请失败，请检查链接和填写内容。' : '登录失败，请检查邮箱和密码。'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6">
        <h1 className="text-lg font-semibold text-neutral-950">RUDA 加工厂工作区</h1>
        <p className="mt-1 text-[12px] text-neutral-500">
          {mode === 'invite' ? '设置登录后即可查看本厂加工单与月度对账。' : '使用商家邀请时设置的邮箱和密码登录。'}
        </p>
        <div className="mt-4 flex gap-2">
          <button type="button" className={`flex-1 rounded-lg border px-3 py-1.5 text-[12px] ${mode === 'login' ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 text-neutral-600'}`} onClick={() => setMode('login')}>登录</button>
          <button type="button" className={`flex-1 rounded-lg border px-3 py-1.5 text-[12px] disabled:opacity-40 ${mode === 'invite' ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 text-neutral-600'}`} onClick={() => setMode('invite')} disabled={!inviteToken}>接受邀请</button>
        </div>
        <div className="mt-4 space-y-3">
          {mode === 'invite' && (
            <label className="block text-[12px] text-neutral-500">联系人姓名
              <input className={`${input} mt-1`} value={name} onChange={event => setName(event.target.value)} maxLength={80} />
            </label>
          )}
          <label className="block text-[12px] text-neutral-500">邮箱
            <input className={`${input} mt-1`} type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="username" />
          </label>
          <label className="block text-[12px] text-neutral-500">密码
            <input className={`${input} mt-1`} type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete={mode === 'invite' ? 'new-password' : 'current-password'} />
          </label>
          {mode === 'invite' && <p className="text-[11px] text-neutral-500">密码至少 8 位。邀请链接仅能使用一次。</p>}
          {error && <p className="text-[12px] text-rose-600">{error}</p>}
          <button type="button" className={`${primary} w-full`} disabled={busy || !email || !password || (mode === 'invite' && (!name || !inviteToken))} onClick={() => void submit()}>
            {mode === 'invite' ? '设置登录并进入' : '登录'}
          </button>
        </div>
      </div>
    </div>
  );
}


export const ProductionFactoryWorkspace: React.FC = () => {
  const inviteToken = useMemo(() => new URLSearchParams(window.location.search).get('invite') || '', []);
  const [session, setSession] = useState<FactorySession | null>(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<'orders' | 'statements'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [openStatementId, setOpenStatementId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [messageDraft, setMessageDraft] = useState('');
  const [deliveryQuantities, setDeliveryQuantities] = useState<Record<string, string>>({});
  const [pickupReceived, setPickupReceived] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersResponse, statementsResponse] = await Promise.all([
        factoryRequest<{ success: true; orders: Order[] }>('/api/production/factory/orders'),
        factoryRequest<{ success: true; statements: Statement[] }>('/api/production/factory/statements')
      ]);
      setOrders(ordersResponse.orders);
      setStatements(statementsResponse.statements);
    } catch (loadError) {
      const code = (loadError as { code?: string }).code;
      if (code === 'PRODUCTION_FACTORY_AUTH_REQUIRED' || code === 'PRODUCTION_FACTORY_ACCESS_REVOKED') {
        window.localStorage.removeItem(TOKEN_KEY);
        setSession(null);
      }
      setError(messageOf(loadError, '数据加载失败，请稍后重试。'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = factoryToken();
    if (!token) { setChecking(false); return; }
    factoryRequest<FactorySession & { success: true }>('/api/production/factory/me')
      .then(response => setSession({ factory: response.factory, member: response.member }))
      .catch(() => { window.localStorage.removeItem(TOKEN_KEY); setSession(null); })
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => { if (session) void load(); }, [session, load]);

  const action = async (run: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setError(null);
    try {
      await run();
      await load();
      if (openOrderId) await loadMessages('order', openOrderId);
      if (openStatementId) await loadMessages('statement', openStatementId);
      window.alert(success);
    } catch (actionError) {
      setError(messageOf(actionError, '操作失败，请刷新后重试。'));
    } finally {
      setBusy(false);
    }
  };

  const loadMessages = async (scopeType: 'order' | 'statement', scopeId: string) => {
    try {
      const response = await factoryRequest<{ success: true; messages: Message[] }>(
        `/api/production/factory/messages?scopeType=${scopeType}&scopeId=${encodeURIComponent(scopeId)}`
      );
      setMessages(previous => ({ ...previous, [`${scopeType}:${scopeId}`]: response.messages }));
    } catch {
      // 留言失败不影响主流程。
    }
  };

  const toggleOrder = async (orderId: string) => {
    if (openOrderId === orderId) { setOpenOrderId(null); return; }
    setOpenOrderId(orderId);
    setOpenStatementId(null);
    await loadMessages('order', orderId);
  };

  const toggleStatement = async (statementId: string) => {
    if (openStatementId === statementId) { setOpenStatementId(null); return; }
    setOpenStatementId(statementId);
    setOpenOrderId(null);
    await loadMessages('statement', statementId);
  };

  const sendMessage = async (scopeType: 'order' | 'statement', scopeId: string) => {
    if (!messageDraft.trim()) return;
    setBusy(true);
    try {
      await factoryRequest('/api/production/factory/messages', {
        method: 'POST', body: { scopeType, scopeId, body: messageDraft.trim() }
      });
      setMessageDraft('');
      await loadMessages(scopeType, scopeId);
    } catch (sendError) {
      setError(messageOf(sendError, '留言发送失败。'));
    } finally {
      setBusy(false);
    }
  };

  const submitDelivery = (order: Order) => {
    const items = order.items
      .map(item => ({ orderItemId: item.id, declaredQuantity: Number(deliveryQuantities[item.id] || 0) }))
      .filter(item => Number.isInteger(item.declaredQuantity) && item.declaredQuantity > 0);
    if (items.length === 0) { setError('请填写本次送货数量。'); return; }
    void action(async () => {
      await factoryRequest(`/api/production/factory/orders/${order.id}/deliveries`, { method: 'POST', body: { items } });
      setDeliveryQuantities({});
    }, '送货已登记，等待商家验收。');
  };


  if (checking) {
    return <div className="flex min-h-screen items-center justify-center bg-neutral-100 text-[13px] text-neutral-500">正在进入加工厂工作区…</div>;
  }

  if (!session) {
    return <LoginPanel inviteToken={inviteToken} onSignedIn={next => { setSession(next); window.history.replaceState(null, '', '/merchant/factory'); }} />;
  }

  const pendingOrders = orders.filter(order => order.status === 'pending_factory').length;

  return (
    <div className="min-h-screen bg-neutral-100">
      <header className="border-b border-neutral-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-[15px] font-semibold text-neutral-950">{session.factory.name}</h1>
            <p className="text-[11px] text-neutral-500">{session.member.name} · 加工厂工作区</p>
          </div>
          <button type="button" className={secondary} onClick={() => {
            window.localStorage.removeItem(TOKEN_KEY);
            setSession(null);
          }}>退出登录</button>
        </div>
        <nav className="mt-3 flex gap-2">
          <button type="button" className={`rounded-lg px-3 py-1.5 text-[12px] ${tab === 'orders' ? 'bg-neutral-900 text-white' : 'border border-neutral-200 bg-white text-neutral-600'}`} onClick={() => setTab('orders')}>
            加工单{pendingOrders ? ` (${pendingOrders})` : ''}
          </button>
          <button type="button" className={`rounded-lg px-3 py-1.5 text-[12px] ${tab === 'statements' ? 'bg-neutral-900 text-white' : 'border border-neutral-200 bg-white text-neutral-600'}`} onClick={() => setTab('statements')}>
            对账
          </button>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl space-y-3 px-4 py-4 sm:px-6">
        {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{error}</div>}
        {loading && <div className="rounded-xl border border-neutral-200 bg-white px-4 py-8 text-center text-[13px] text-neutral-500">正在加载…</div>}

        {!loading && tab === 'orders' && orders.length === 0 && (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-10 text-center text-[13px] text-neutral-500">暂无加工单。</div>
        )}

        {!loading && tab === 'orders' && orders.map(order => (
          <article key={order.id} className="rounded-xl border border-neutral-200 bg-white">
            <button type="button" className="w-full px-4 py-3 text-left" onClick={() => void toggleOrder(order.id)}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[13px] font-medium text-neutral-900">
                    {order.orderNo} · {order.product?.styleNo ? `${order.product.styleNo} · ` : ''}{order.product?.name || ''}
                  </div>
                  <div className="mt-0.5 text-[11px] text-neutral-500">
                    计划 {order.plannedQuantity} 件 · 合格 {order.acceptedQuantity} 件 · 交期 {day(order.dueDate)}
                  </div>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] ${order.status === 'completed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : order.status === 'cancelled' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                  {orderLabels[order.status] || order.status}
                </span>
              </div>
            </button>


            {openOrderId === order.id && (
              <div className="space-y-3 border-t border-neutral-100 px-4 py-3">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-[12px]">
                    <thead><tr className="text-neutral-500">
                      <th className="py-1 text-left font-medium">SKU</th>
                      <th className="py-1 text-left font-medium">颜色/尺码</th>
                      <th className="py-1 text-right font-medium">计划</th>
                      <th className="py-1 text-right font-medium">已交</th>
                      <th className="py-1 text-right font-medium">合格</th>
                      <th className="py-1 text-right font-medium">剩余</th>
                    </tr></thead>
                    <tbody>
                      {order.items.map(item => (
                        <tr key={item.id} className="border-t border-neutral-100">
                          <td className="py-1.5">{item.sku}</td>
                          <td className="py-1.5">{item.color || '—'}/{item.size || '—'}</td>
                          <td className="py-1.5 text-right">{item.plannedQuantity}</td>
                          <td className="py-1.5 text-right">{item.deliveredQuantity}</td>
                          <td className="py-1.5 text-right">{item.acceptedQuantity}</td>
                          <td className="py-1.5 text-right">{item.remainingQuantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {order.notes && <p className="text-[12px] text-neutral-600">备注：{order.notes}</p>}
                <div className="flex flex-wrap gap-2">
                  {order.status === 'pending_factory' && (
                    <button type="button" className={primary} disabled={busy} onClick={() => void action(
                      () => factoryRequest(`/api/production/factory/orders/${order.id}/accept`, { method: 'POST', body: {} }),
                      '已接单。'
                    )}>接单</button>
                  )}
                  {order.status === 'accepted' && (
                    <button type="button" className={primary} disabled={busy} onClick={() => void action(
                      () => factoryRequest(`/api/production/factory/orders/${order.id}/start`, { method: 'POST', body: {} }),
                      '已开始加工。'
                    )}>开始加工</button>
                  )}
                </div>

                {order.pickups.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-[12px] font-medium text-neutral-900">取货确认</h3>
                    {order.pickups.map(pickup => (
                      <div key={pickup.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-neutral-50 px-2 py-1.5 text-[12px] text-neutral-700">
                        <span>{pickup.pickupNo} · {day(pickup.pickupDate)} · {pickup.pieces} 件 / {pickup.packages} 包</span>
                        {pickup.status === 'confirmed' ? (
                          <span className="text-emerald-700">实收 {pickup.receivedPieces} 件（差异 {pickup.difference}）</span>
                        ) : (
                          <>
                            <input
                              className="w-24 rounded border border-neutral-300 px-2 py-1 text-center"
                              type="number" min="0" placeholder="实收件数"
                              value={pickupReceived[pickup.id] ?? String(pickup.pieces)}
                              onChange={event => setPickupReceived(previous => ({ ...previous, [pickup.id]: event.target.value }))}
                            />
                            <button type="button" className={secondary} disabled={busy} onClick={() => void action(
                              () => factoryRequest(`/api/production/factory/pickups/${pickup.id}/confirm`, {
                                method: 'POST',
                                body: { receivedPieces: Number(pickupReceived[pickup.id] ?? pickup.pieces) }
                              }),
                              '取货已确认。'
                            )}>确认取货</button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}


                {['accepted', 'in_production'].includes(order.status) && (
                  <div className="space-y-2 rounded-lg border border-neutral-200 p-2">
                    <h3 className="text-[12px] font-medium text-neutral-900">登记送货</h3>
                    {order.items.filter(item => item.remainingQuantity > 0).map(item => (
                      <div key={item.id} className="flex items-center justify-between gap-2 text-[12px] text-neutral-700">
                        <span>{item.sku} · 未交 {item.remainingQuantity}</span>
                        <input
                          className="w-24 rounded border border-neutral-300 px-2 py-1 text-center"
                          type="number" min="0" max={item.remainingQuantity} placeholder="数量"
                          value={deliveryQuantities[item.id] || ''}
                          onChange={event => setDeliveryQuantities(previous => ({ ...previous, [item.id]: event.target.value }))}
                        />
                      </div>
                    ))}
                    <div className="flex justify-end">
                      <button type="button" className={primary} disabled={busy} onClick={() => submitDelivery(order)}>提交送货</button>
                    </div>
                  </div>
                )}

                {order.deliveries.length > 0 && (
                  <div className="space-y-1">
                    <h3 className="text-[12px] font-medium text-neutral-900">送货记录</h3>
                    {order.deliveries.map(delivery => (
                      <div key={delivery.id} className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-neutral-600">
                        <span>{delivery.deliveryNo} · {new Date(delivery.submittedAt).toLocaleDateString('zh-CN')}</span>
                        <span className={delivery.status === 'submitted' ? 'text-amber-700' : 'text-emerald-700'}>
                          {delivery.status === 'submitted' ? '待商家验收' : `已验收合格 ${delivery.items.reduce((sum, item) => sum + item.acceptedQuantity, 0)} 件`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <h3 className="text-[12px] font-medium text-neutral-900">单据留言</h3>
                  <div className="mt-1 space-y-1">
                    {(messages[`order:${order.id}`] || []).map(message => (
                      <div key={message.id} className={`rounded-lg px-2 py-1.5 text-[12px] ${message.authorSide === 'factory' ? 'bg-neutral-50' : 'border border-neutral-100 bg-white'}`}>
                        <span className="text-neutral-500">{message.authorName} · {new Date(message.createdAt).toLocaleString('zh-CN')}</span>
                        <p className="mt-0.5 whitespace-pre-wrap text-neutral-800">{message.body}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input className={input} placeholder="回复商家" value={messageDraft} onChange={event => setMessageDraft(event.target.value)} maxLength={2000} />
                    <button type="button" className={secondary} disabled={busy || !messageDraft.trim()} onClick={() => void sendMessage('order', order.id)}>发送</button>
                  </div>
                </div>
              </div>
            )}
          </article>
        ))}

        {!loading && tab === 'statements' && statements.length === 0 && (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-10 text-center text-[13px] text-neutral-500">暂无对账单。</div>
        )}


        {!loading && tab === 'statements' && statements.map(statement => (
          <article key={statement.id} className="rounded-xl border border-neutral-200 bg-white">
            <button type="button" className="w-full px-4 py-3 text-left" onClick={() => void toggleStatement(statement.id)}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[13px] font-medium text-neutral-900">{statement.statementNo} · {statement.periodMonth}</div>
                  <div className="mt-0.5 text-[11px] text-neutral-500">版本 {statement.version} · 本期 {money(statement.totalAmount, statement.currency)} · 未结 {money(statement.closingBalance, statement.currency)}</div>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] ${statement.status === 'confirmed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : statement.status === 'disputed' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                  {statementLabels[statement.status] || statement.status}
                </span>
              </div>
            </button>
            {openStatementId === statement.id && (
              <div className="space-y-3 border-t border-neutral-100 px-4 py-3">
                {statement.disputeReason && <p className="rounded-lg bg-rose-50 px-2 py-1.5 text-[12px] text-rose-700">异议：{statement.disputeReason}</p>}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[380px] text-[12px]">
                    <thead><tr className="text-neutral-500">
                      <th className="py-1 text-left font-medium">加工单</th>
                      <th className="py-1 text-left font-medium">商品</th>
                      <th className="py-1 text-right font-medium">合格数量</th>
                      <th className="py-1 text-right font-medium">加工费</th>
                    </tr></thead>
                    <tbody>
                      {statement.lines.map(line => (
                        <tr key={line.id} className="border-t border-neutral-100">
                          <td className="py-1.5">{line.orderNo}</td>
                          <td className="py-1.5">{line.productName}</td>
                          <td className="py-1.5 text-right">{line.quantity}</td>
                          <td className="py-1.5 text-right">{money(line.amount, statement.currency)}</td>
                        </tr>
                      ))}
                      {statement.lines.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-neutral-500">本期无可结算数量。</td></tr>}
                    </tbody>
                  </table>
                </div>
                <div className="ml-auto w-full max-w-xs space-y-1 text-[12px] text-neutral-700">
                  <div className="flex justify-between"><span>期初未结</span><span>{money(statement.openingBalance, statement.currency)}</span></div>
                  <div className="flex justify-between"><span>本期加工费</span><span>{money(statement.laborAmount, statement.currency)}</span></div>
                  <div className="flex justify-between"><span>调整</span><span>{money(statement.adjustmentAmount, statement.currency)}</span></div>
                  <div className="flex justify-between"><span>本期付款</span><span>−{money(statement.paidAmount, statement.currency)}</span></div>
                  <div className="flex justify-between border-t border-neutral-900 pt-1 font-semibold"><span>期末未结</span><span>{money(statement.closingBalance, statement.currency)}</span></div>
                </div>
                {(statement.adjustments.length > 0 || statement.payments.length > 0) && (
                  <div className="grid gap-2 text-[12px] text-neutral-600 sm:grid-cols-2">
                    {statement.adjustments.length > 0 && (
                      <div>
                        <div className="font-medium text-neutral-900">调整项</div>
                        {statement.adjustments.map(item => (
                          <div key={item.id} className="flex justify-between gap-2">
                            <span>{item.reason}</span><span>{money(item.amount, statement.currency)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {statement.payments.length > 0 && (
                      <div>
                        <div className="font-medium text-neutral-900">本期付款</div>
                        {statement.payments.map(item => (
                          <div key={item.id} className="flex justify-between gap-2">
                            <span>{day(item.paidAt)} · {item.method || '付款'}{item.reference ? ` · ${item.reference}` : ''}</span>
                            <span>{money(item.amount, statement.currency)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={secondary} onClick={() => printFactoryStatement(statement)}>打印 / 导出 PDF</button>
                  {statement.status === 'pending_factory' && (
                    <>
                      <button type="button" className={primary} disabled={busy} onClick={() => void action(
                        () => factoryRequest(`/api/production/factory/statements/${statement.id}/confirm`, { method: 'POST', body: {} }),
                        '对账已确认。'
                      )}>确认对账</button>
                      <button type="button" className={secondary} disabled={busy} onClick={() => {
                        const reason = window.prompt('请填写异议原因');
                        if (!reason?.trim()) return;
                        void action(
                          () => factoryRequest(`/api/production/factory/statements/${statement.id}/dispute`, { method: 'POST', body: { reason } }),
                          '异议已提交。'
                        );
                      }}>提出异议</button>
                    </>
                  )}
                </div>


                <div>
                  <h3 className="text-[12px] font-medium text-neutral-900">单据留言</h3>
                  <div className="mt-1 space-y-1">
                    {(messages[`statement:${statement.id}`] || []).map(message => (
                      <div key={message.id} className={`rounded-lg px-2 py-1.5 text-[12px] ${message.authorSide === 'factory' ? 'bg-neutral-50' : 'border border-neutral-100 bg-white'}`}>
                        <span className="text-neutral-500">{message.authorName} · {new Date(message.createdAt).toLocaleString('zh-CN')}</span>
                        <p className="mt-0.5 whitespace-pre-wrap text-neutral-800">{message.body}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input className={input} placeholder="回复商家" value={messageDraft} onChange={event => setMessageDraft(event.target.value)} maxLength={2000} />
                    <button type="button" className={secondary} disabled={busy || !messageDraft.trim()} onClick={() => void sendMessage('statement', statement.id)}>发送</button>
                  </div>
                </div>
              </div>
            )}
          </article>
        ))}
      </main>
    </div>
  );
};


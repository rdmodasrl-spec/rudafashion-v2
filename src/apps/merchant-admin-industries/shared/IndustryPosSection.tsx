/**
 * POS 收银区段：销售、退货、交接班与现金收支全部走既有服务端契约。
 *
 * - 销售：`POST /api/merchant/pos/sales`（生成 POS- 订单、扣减门店/中心库存、记录支付）
 * - 退货：`POST /api/merchant/pos/returns`（必须关联原销售单，退款按净单价计算）
 * - 班次：`GET /api/merchant/pos/shifts/current`、`POST /api/merchant/pos/shifts`、`.../:id/close`
 * - 现金：`POST /api/merchant/pos/shifts/:id/cash-movements`
 *
 * 页面不缓存成功状态：每次写操作后重新读取班次与销售记录，以服务端结果为准。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Minus, Plus, Printer, Receipt, RefreshCcw, Trash2, Undo2 } from 'lucide-react';
import type { MerchantIndustryCapability } from '../../../constants/merchantIndustryCapabilities';
import type { Product } from '../../../types/b2b';
import {
  addPosCashMovement,
  closePosShift,
  createPosReturn,
  createPosSale,
  describeApiError,
  fetchCurrentPosShift,
  fetchPosShiftDetail,
  listPosShiftEmployees,
  listPosShifts,
  openPosShift,
  type IndustryPosSale,
  type IndustryPosShift,
  type IndustryPosShiftDetail,
  type IndustryPosShiftRow,
  type IndustryStore
} from './data';
import {
  Button,
  DataTable,
  ErrorBanner,
  PageHeader,
  SearchInput,
  SectionCard,
  StatusPill,
  formatDate,
  formatMoney,
  inputClass
} from './kit';

type CartLine = { productId: string; sku: string; name: string; code: string; unitPrice: number; quantity: number };

function retailPrice(product: Product): number {
  const retail = Number(product.rrpPrice || 0);
  return retail > 0 ? retail : Number(product.wholesalePrice || 0);
}

function paymentLabel(method: string): string {
  if (method === 'cash') return '现金';
  if (method === 'card') return '刷卡';
  if (method === 'bank_transfer' || method === 'bank_transfer_prepay') return '转账';
  if (method === 'other') return '其他';
  return method || '—';
}

function escapeReceiptHtml(value: string): string {
  return String(value).replace(/[&<>"']/g, char => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char
  ));
}

/** 小票以独立窗口打印，不改动后台页面样式，也不依赖浏览器打印样式表。 */
function printReceipt(sale: IndustryPosSale): void {
  const win = window.open('', '_blank', 'width=420,height=640');
  if (!win) return;
  const rows = sale.items.map(item => (
    `<tr><td>${escapeReceiptHtml(item.productName)}<br><small>${escapeReceiptHtml(item.sku)}</small></td>`
    + `<td class="right">${item.quantity}</td><td class="right">${item.unitPrice.toFixed(2)}</td>`
    + `<td class="right">${item.lineTotal.toFixed(2)}</td></tr>`
  )).join('');
  win.document.write(
    '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'
    + `<title>${escapeReceiptHtml(sale.saleNo)}</title>`
    + '<style>body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;padding:12px;font-size:12px;color:#111}'
    + 'table{width:100%;border-collapse:collapse}th,td{padding:4px 0;border-bottom:1px dashed #ddd;text-align:left}'
    + '.right{text-align:right}h1{font-size:14px;margin:0 0 4px}</style></head><body>'
    + `<h1>销售小票</h1><div>${escapeReceiptHtml(sale.saleNo)}</div>`
    + `<div>${escapeReceiptHtml(new Date(sale.createdAt).toLocaleString())}</div>`
    + `<div>门店：${escapeReceiptHtml(sale.storeName || '总店')}</div>`
    + '<table><thead><tr><th>商品</th><th class="right">数量</th><th class="right">单价</th><th class="right">金额</th></tr></thead>'
    + `<tbody>${rows}</tbody></table>`
    + `<p>合计：${sale.totalAmount.toFixed(2)}　收款：${escapeReceiptHtml(paymentLabel(sale.paymentMethod))}</p>`
    + '</body></html>'
  );
  win.document.close();
  win.focus();
  win.print();
}

/** 销售小票与明细：金额字段全部来自服务端返回，不做本地重算。 */
const PosReceiptModal: React.FC<{ sale: IndustryPosSale; onClose: () => void }> = ({ sale, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/40 p-4">
    <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-neutral-950">销售小票</h2>
          <p className="text-xs text-neutral-500">{sale.saleNo} · {new Date(sale.createdAt).toLocaleString()}</p>
        </div>
        <button type="button" aria-label="关闭小票" onClick={onClose} className="text-neutral-400 hover:text-neutral-900">×</button>
      </div>
      <dl className="mt-3 space-y-1 text-xs text-neutral-600">
        <div className="flex justify-between"><dt>门店</dt><dd>{sale.storeName || '总店'}</dd></div>
        <div className="flex justify-between"><dt>收款方式</dt><dd>{paymentLabel(sale.paymentMethod)}</dd></div>
      </dl>
      <div className="mt-3 divide-y divide-neutral-100 border-y border-neutral-100 text-xs">
        {sale.items.map(item => (
          <div key={item.id} className="flex items-center justify-between gap-3 py-1.5">
            <span className="min-w-0 flex-1 truncate">{item.productName}<span className="text-neutral-400"> · {item.sku}</span></span>
            <span className="tabular-nums text-neutral-500">{formatMoney(item.unitPrice)} × {item.quantity}</span>
            <span className="tabular-nums font-medium">{formatMoney(item.lineTotal)}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between text-xs text-neutral-500">
          <span>商品金额</span>
          <span className="tabular-nums">{formatMoney(sale.totalAmount + Number(sale.discountAmount || 0))}</span>
        </div>
        {Number(sale.discountAmount || 0) > 0 ? (
          <div className="flex justify-between text-xs text-neutral-500">
            <span>折扣</span>
            <span className="tabular-nums">-{formatMoney(Number(sale.discountAmount || 0))}</span>
          </div>
        ) : null}
        <div className="flex justify-between font-semibold text-neutral-950">
          <span>实收</span>
          <span className="tabular-nums">{formatMoney(sale.totalAmount)}</span>
        </div>
        {Number(sale.refundedAmount || 0) > 0 ? (
          <div className="flex justify-between text-xs text-neutral-500">
            <span>已退</span>
            <span className="tabular-nums">{formatMoney(Number(sale.refundedAmount || 0))}</span>
          </div>
        ) : null}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>关闭</Button>
        <Button variant="primary" onClick={() => printReceipt(sale)}><Printer className="h-4 w-4" />打印小票</Button>
      </div>
    </div>
  </div>
);

export const IndustryPosSection: React.FC<{
  capability: MerchantIndustryCapability;
  products: Product[];
  sales: IndustryPosSale[];
  stores?: IndustryStore[];
  notify: (type: 'success' | 'info' | 'warning', title: string, message: string) => void;
  onSaleCreated: () => void;
}> = ({ products, sales, stores, notify, onSaleCreated }) => {
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'other'>('cash');
  const [storeId, setStoreId] = useState(stores?.find(store => store.status === 'active')?.id || '');
  const [discountInput, setDiscountInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requiresStore = !!stores?.length;

  const [shift, setShift] = useState<IndustryPosShift | null>(null);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [shiftBusy, setShiftBusy] = useState(false);
  const [openingCash, setOpeningCash] = useState('0.00');
  const [openingNote, setOpeningNote] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [closingNote, setClosingNote] = useState('');
  const [cashDirection, setCashDirection] = useState<'in' | 'out'>('in');
  const [cashAmount, setCashAmount] = useState('');
  const [cashReason, setCashReason] = useState('');

  const [returnSale, setReturnSale] = useState<IndustryPosSale | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [returnReason, setReturnReason] = useState('');
  const [returnBusy, setReturnBusy] = useState(false);
  const [returnError, setReturnError] = useState('');
  const [receiptSale, setReceiptSale] = useState<IndustryPosSale | null>(null);

  const reloadShift = useCallback(async () => {
    setShiftLoading(true);
    try {
      const current = await fetchCurrentPosShift(requiresStore ? storeId || undefined : undefined);
      setShift(current);
      if (current) setClosingCash(current.expectedCash.toFixed(2));
    } catch (caught) {
      setError(describeApiError(caught, '班次读取失败'));
    } finally {
      setShiftLoading(false);
    }
  }, [requiresStore, storeId]);

  useEffect(() => { void reloadShift(); }, [reloadShift]);

  const results = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return products.filter(product => (product.lifecycleStatus || 'published') === 'published').slice(0, 8);
    return products.filter(product => {
      if ((product.lifecycleStatus || 'published') !== 'published') return false;
      if ([product.styleNo, product.name].some(value => String(value || '').toLowerCase().includes(keyword))) return true;
      return (product.skus || []).some(sku => String(sku.sku || '').toLowerCase().includes(keyword) || String(sku.barcode || '').toLowerCase().includes(keyword));
    }).slice(0, 12);
  }, [products, query]);

  const addToCart = (line: Omit<CartLine, 'quantity'>) => {
    setCart(previous => {
      const existing = previous.find(item => item.productId === line.productId && item.sku === line.sku);
      if (existing) return previous.map(item => item === existing ? { ...item, quantity: item.quantity + 1 } : item);
      return [...previous, { ...line, quantity: 1 }];
    });
  };

  const addProduct = (product: Product) => {
    const sku = (product.skus || []).find(item => item.isActive !== false) || (product.skus || [])[0];
    if (!sku) {
      setError(`${product.styleNo} 没有可用 SKU，无法收银`);
      return;
    }
    addToCart({
      productId: product.id,
      sku: sku.sku,
      name: product.name,
      code: product.styleNo,
      unitPrice: retailPrice(product)
    });
  };

  const setQuantity = (line: CartLine, quantity: number) => {
    if (quantity <= 0) {
      setCart(previous => previous.filter(item => !(item.productId === line.productId && item.sku === line.sku)));
      return;
    }
    setCart(previous => previous.map(item => item.productId === line.productId && item.sku === line.sku ? { ...item, quantity } : item));
  };

  const grossTotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const discountValue = Math.max(0, Number(discountInput) || 0);
  const netTotal = Math.max(0, Number((grossTotal - discountValue).toFixed(2)));

  const checkout = async () => {
    if (!cart.length) {
      setError('请先添加商品');
      return;
    }
    if (requiresStore && !storeId) {
      setError('请选择收银门店');
      return;
    }
    if (!shift) {
      setError('请先开班，收银与退款都需要进行中的班次');
      return;
    }
    if (discountValue > grossTotal) {
      setError('折扣金额不能大于应收金额');
      return;
    }
    if (requiresStore && shift.storeId && shift.storeId !== storeId) {
      setError('当前班次属于其他门店，请切换到对应门店或重新开班');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const sale = await createPosSale({
        items: cart.map(line => ({ productId: line.productId, sku: line.sku, quantity: line.quantity })),
        paymentMethod,
        ...(requiresStore ? { storeId } : {}),
        posShiftId: shift.id,
        ...(discountValue > 0 ? { discountAmount: discountValue } : {})
      });
      setCart([]);
      setDiscountInput('');
      setReceiptSale(sale);
      notify('success', '销售已入账', `${sale.saleNo} · ${formatMoney(sale.totalAmount)}`);
      await reloadShift();
      onSaleCreated();
    } catch (caught) {
      setError(describeApiError(caught, '销售失败'));
    } finally {
      setBusy(false);
    }
  };

  const submitOpenShift = async () => {
    if (shiftBusy) return;
    setShiftBusy(true);
    setError('');
    try {
      const opened = await openPosShift({
        openingCash: Number(openingCash) || 0,
        note: openingNote.trim(),
        ...(requiresStore && storeId ? { storeId } : {})
      });
      setShift(opened);
      setOpeningNote('');
      notify('success', '班次已开始', `期初现金 ${formatMoney(opened.openingCash)}`);
    } catch (caught) {
      setError(describeApiError(caught, '开班失败'));
    } finally {
      setShiftBusy(false);
    }
  };

  const submitCashMovement = async () => {
    if (!shift || shiftBusy) return;
    const amount = Number(cashAmount);
    if (!(amount > 0) || !cashReason.trim()) {
      setError('请填写现金金额与原因');
      return;
    }
    setShiftBusy(true);
    setError('');
    try {
      await addPosCashMovement(shift.id, { direction: cashDirection, amount, reason: cashReason.trim() });
      setCashAmount('');
      setCashReason('');
      notify('success', '现金流水已记录', `${cashDirection === 'in' ? '收入' : '支出'} ${formatMoney(amount)}`);
      await reloadShift();
    } catch (caught) {
      setError(describeApiError(caught, '现金流水记录失败'));
    } finally {
      setShiftBusy(false);
    }
  };

  const submitCloseShift = async () => {
    if (!shift || shiftBusy) return;
    const amount = Number(closingCash);
    if (!Number.isFinite(amount) || amount < 0) {
      setError('请填写正确的交班现金');
      return;
    }
    setShiftBusy(true);
    setError('');
    try {
      const closed = await closePosShift(shift.id, { closingCash: amount, note: closingNote.trim() });
      setShift(null);
      setClosingNote('');
      notify(
        'success',
        '班次已交班',
        `应存 ${formatMoney(closed.expectedCash)} · 实存 ${formatMoney(amount)} · 差异 ${formatMoney(Number(closed.cashDifference || 0))}`
      );
      await reloadShift();
    } catch (caught) {
      setError(describeApiError(caught, '交班失败'));
    } finally {
      setShiftBusy(false);
    }
  };

  const openReturn = (sale: IndustryPosSale) => {
    setReturnSale(sale);
    setReturnError('');
    setReturnReason('');
    setReturnQuantities(Object.fromEntries(sale.items.map(item => [item.id, 0])));
  };

  const submitReturn = async () => {
    if (!returnSale || returnBusy) return;
    const items = returnSale.items
      .map(item => ({ productId: item.productId, sku: item.sku, quantity: Number(returnQuantities[item.id] || 0) }))
      .filter(item => item.quantity > 0);
    if (!items.length) {
      setReturnError('请填写退货数量');
      return;
    }
    if (!returnReason.trim()) {
      setReturnError('请填写退货原因');
      return;
    }
    setReturnBusy(true);
    setReturnError('');
    try {
      const result = await createPosReturn({ orderId: returnSale.id, items, reason: returnReason.trim() });
      notify('success', '退货已入账', `${returnSale.saleNo} · 退款 ${formatMoney(result.refundAmount)}`);
      setReturnSale(null);
      await reloadShift();
      onSaleCreated();
    } catch (caught) {
      setReturnError(describeApiError(caught, '退货失败'));
    } finally {
      setReturnBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="POS 收银"
        description="销售、退货、交接班与现金流水均写入服务端；退货必须关联原始销售单。"
        actions={<Button variant="ghost" busy={shiftLoading} onClick={() => void reloadShift()}><RefreshCcw className="h-4 w-4" />刷新班次</Button>}
      />
      {error ? <ErrorBanner message={error} onDismiss={() => setError('')} /> : null}

      <SectionCard
        title="班次与现金"
        description={shift
          ? `进行中的班次：${shift.storeId ? `${stores?.find(store => store.id === shift.storeId)?.name || '门店'} · ` : ''}现金销售、退款与现金收支都会计入应交现金。`
          : '未开班不能收银；开班后才开始累计本班现金。'}
        actions={<StatusPill tone={shift ? 'success' : 'warning'}>{shift ? '班次进行中' : '未开班'}</StatusPill>}
      >
        {shiftLoading ? (
          <p className="rounded-lg bg-neutral-50 p-3 text-xs text-neutral-500">正在读取班次…</p>
        ) : shift ? (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6 text-xs">
              <div className="rounded-lg bg-neutral-50 p-3"><span className="text-neutral-500">收银员</span><strong className="mt-1 block text-sm">{shift.employee?.name || '店主'}</strong></div>
              <div className="rounded-lg bg-neutral-50 p-3"><span className="text-neutral-500">开班时间</span><strong className="mt-1 block text-sm">{new Date(shift.openedAt).toLocaleString()}</strong></div>
              <div className="rounded-lg bg-neutral-50 p-3"><span className="text-neutral-500">期初现金</span><strong className="mt-1 block text-sm tabular-nums">{formatMoney(shift.openingCash)}</strong></div>
              <div className="rounded-lg bg-neutral-50 p-3"><span className="text-neutral-500">现金销售 / 退款</span><strong className="mt-1 block text-sm tabular-nums">{formatMoney(shift.cashSales)} / {formatMoney(shift.cashRefunds)}</strong></div>
              <div className="rounded-lg bg-neutral-50 p-3"><span className="text-neutral-500">现金收入 / 支出</span><strong className="mt-1 block text-sm tabular-nums">{formatMoney(shift.cashIn)} / {formatMoney(shift.cashOut)}</strong></div>
              <div className="rounded-lg bg-neutral-50 p-3"><span className="text-neutral-500">应存现金</span><strong className="mt-1 block text-sm tabular-nums">{formatMoney(shift.expectedCash)}</strong></div>
            </div>
            <div className="grid gap-3 border-t border-neutral-100 pt-3 lg:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-neutral-700">现金收支</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <select className={inputClass} value={cashDirection} onChange={event => setCashDirection(event.target.value as 'in' | 'out')}>
                    <option value="in">现金收入</option>
                    <option value="out">现金支出</option>
                  </select>
                  <input className={inputClass} inputMode="decimal" placeholder="金额" value={cashAmount} onChange={event => setCashAmount(event.target.value)} />
                </div>
                <input className={inputClass} maxLength={300} placeholder="原因（如备用金、零钱兑换、费用支出）" value={cashReason} onChange={event => setCashReason(event.target.value)} />
                <Button variant="secondary" busy={shiftBusy} onClick={() => void submitCashMovement()}>记录现金流水</Button>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-neutral-700">交班</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input className={inputClass} inputMode="decimal" placeholder="实存现金" value={closingCash} onChange={event => setClosingCash(event.target.value)} />
                  <input className={inputClass} maxLength={500} placeholder="交班备注（可留空）" value={closingNote} onChange={event => setClosingNote(event.target.value)} />
                </div>
                <p className="text-[11px] text-neutral-500">差异 = 实存现金 − 应存现金，交班后不可再修改。</p>
                <Button variant="primary" busy={shiftBusy} onClick={() => void submitCloseShift()}>确认交班</Button>
              </div>
            </div>
            {shift.movements?.length ? (
              <ul className="divide-y divide-neutral-100 border-t border-neutral-100 pt-2 text-xs">
                {shift.movements.slice(0, 8).map(movement => (
                  <li key={movement.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                    <span className={movement.direction === 'in' ? 'text-emerald-700' : 'text-rose-700'}>
                      {movement.direction === 'in' ? '收入' : '支出'} {formatMoney(movement.amount)}
                    </span>
                    <span className="text-neutral-500">{movement.reason}</span>
                    <span className="text-neutral-400">{new Date(movement.createdAt).toLocaleTimeString()}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-neutral-700">期初现金
              <input className={`${inputClass} mt-1`} inputMode="decimal" value={openingCash} onChange={event => setOpeningCash(event.target.value)} />
            </label>
            <label className="text-xs font-semibold text-neutral-700">开班备注
              <input className={`${inputClass} mt-1`} maxLength={300} value={openingNote} onChange={event => setOpeningNote(event.target.value)} placeholder="可留空" />
            </label>
            <div className="sm:col-span-2">
              <Button variant="primary" busy={shiftBusy} onClick={() => void submitOpenShift()}><Receipt className="h-4 w-4" />开班</Button>
            </div>
          </div>
        )}
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <SectionCard title="选择商品" description="按款号、名称或条码搜索；仅上架商品可收银。">
          <SearchInput value={query} onChange={setQuery} placeholder="搜索款号、名称或条码" />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {results.map(product => {
              const sku = (product.skus || []).find(item => item.isActive !== false) || (product.skus || [])[0];
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addProduct(product)}
                  className="flex items-start justify-between gap-2 rounded-lg border border-neutral-200 p-3 text-left hover:border-neutral-400"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-neutral-950">{product.name}</span>
                    <span className="mt-0.5 block text-[11px] text-neutral-500">{product.styleNo}{sku ? ` · ${sku.sku}` : ''}</span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{formatMoney(retailPrice(product))}</span>
                </button>
              );
            })}
            {results.length === 0 ? <p className="rounded-lg bg-neutral-50 p-3 text-xs text-neutral-500">没有匹配的上架商品。</p> : null}
          </div>
        </SectionCard>

        <SectionCard title="当前购物车" description={`${cart.reduce((sum, line) => sum + line.quantity, 0)} 件`}>
          <div className="space-y-2">
            {cart.map(line => (
              <div key={`${line.productId}:${line.sku}`} className="rounded-lg border border-neutral-200 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-neutral-900">{line.name}</p>
                    <p className="text-[11px] text-neutral-500">{line.code} · {line.sku}</p>
                  </div>
                  <button type="button" onClick={() => setQuantity(line, 0)} aria-label={`移除 ${line.name}`} className="text-neutral-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-1">
                    <button type="button" onClick={() => setQuantity(line, line.quantity - 1)} aria-label="减少数量" className="rounded border border-neutral-200 p-1"><Minus className="h-3.5 w-3.5" /></button>
                    <span className="w-8 text-center text-sm font-semibold tabular-nums">{line.quantity}</span>
                    <button type="button" onClick={() => setQuantity(line, line.quantity + 1)} aria-label="增加数量" className="rounded border border-neutral-200 p-1"><Plus className="h-3.5 w-3.5" /></button>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{formatMoney(line.unitPrice * line.quantity)}</span>
                </div>
              </div>
            ))}
            {cart.length === 0 ? <p className="rounded-lg bg-neutral-50 p-3 text-center text-xs text-neutral-500">购物车为空</p> : null}
          </div>
          <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3">
            {requiresStore ? (
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-neutral-700">收银门店</span>
                <select className={inputClass} value={storeId} onChange={event => setStoreId(event.target.value)}>
                  <option value="">请选择门店</option>
                  {stores?.map(store => <option key={store.id} value={store.id}>{store.name}（{store.code}）</option>)}
                </select>
              </label>
            ) : null}
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-neutral-700">收款方式</span>
              <select className={inputClass} value={paymentMethod} onChange={event => setPaymentMethod(event.target.value as 'cash' | 'card' | 'other')}>
                <option value="cash">现金</option>
                <option value="card">刷卡（线下）</option>
                <option value="other">其他</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-neutral-700">整单折扣（需折扣权限）</span>
              <input className={inputClass} inputMode="decimal" placeholder="0.00" value={discountInput} onChange={event => setDiscountInput(event.target.value)} />
            </label>
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>商品金额</span><span className="tabular-nums">{formatMoney(grossTotal)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>折扣</span><span className="tabular-nums">−{formatMoney(discountValue)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-500">应收合计</span>
              <span className="text-xl font-bold tabular-nums">{formatMoney(netTotal)}</span>
            </div>
            <Button variant="primary" className="w-full" busy={busy} onClick={() => void checkout()} disabled={!shift}>完成结算</Button>
            <p className="text-[11px] text-neutral-500">
              {shift ? '现金与刷卡由门店线下完成；系统记录销售单、库存变化与班次现金。' : '请先在「班次与现金」开班后再结算。'}
            </p>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="销售记录" description={`共 ${sales.length} 笔；退货按原销售单计算退款并回补库存。`}>
        <DataTable
          minWidth={860}
          rows={sales}
          rowKey={sale => sale.id}
          emptyText="暂无 POS 销售记录。"
          columns={[
            { key: 'no', header: '销售单号', render: sale => <span className="font-semibold text-neutral-950">{sale.saleNo}</span> },
            { key: 'date', header: '时间', render: sale => formatDate(sale.createdAt) },
            { key: 'store', header: '门店', render: sale => sale.storeName || '—' },
            { key: 'items', header: '件数', align: 'right', render: sale => sale.items.reduce((sum, item) => sum + item.quantity, 0) },
            { key: 'amount', header: '金额', align: 'right', render: sale => formatMoney(sale.totalAmount) },
            { key: 'refund', header: '已退', align: 'right', render: sale => sale.refundedAmount ? formatMoney(sale.refundedAmount) : '—' },
            { key: 'payment', header: '收款', render: sale => sale.paymentMethod === 'cash' ? '现金' : sale.paymentMethod === 'card' ? '刷卡' : '其他' },
            {
              key: 'action',
              header: '操作',
              align: 'right',
              render: sale => sale.returnable ? (
                <Button size="sm" variant="secondary" onClick={() => openReturn(sale)}><Undo2 className="h-3.5 w-3.5" />退货</Button>
              ) : <span className="text-[11px] text-neutral-400">{sale.source === 'legacy' ? '历史单不支持退货' : '不可退'}</span>
            }
          ]}
        />
      </SectionCard>

      {receiptSale ? <PosReceiptModal sale={receiptSale} onClose={() => setReceiptSale(null)} /> : null}

      {returnSale ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-neutral-900">退货 · {returnSale.saleNo}</h3>
                <p className="mt-1 text-xs text-neutral-500">{returnSale.storeName || '总部'} · {formatMoney(returnSale.totalAmount)}</p>
              </div>
              <button type="button" onClick={() => setReturnSale(null)} aria-label="关闭退货" className="text-xl text-neutral-400">×</button>
            </div>
            {returnError ? <div role="alert" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">{returnError}</div> : null}
            <div className="mt-3 space-y-2">
              {returnSale.items.map(item => {
                const max = Number(item.returnableQuantity ?? item.quantity);
                return (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 p-2.5 text-xs">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-neutral-900">{item.productName}</p>
                      <p className="text-[11px] text-neutral-500">{item.sku} · 可退 {max} · {formatMoney(item.unitPrice)}</p>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={max}
                      step={1}
                      disabled={max === 0}
                      value={returnQuantities[item.id] ?? 0}
                      onChange={event => setReturnQuantities(previous => ({ ...previous, [item.id]: Math.max(0, Math.min(max, Number(event.target.value) || 0)) }))}
                      aria-label={`${item.productName} 退货数量`}
                      className="w-20 rounded-lg border border-neutral-300 px-2 py-1.5 text-right"
                    />
                  </div>
                );
              })}
            </div>
            <label className="mt-3 block text-xs font-semibold text-neutral-700">退货原因
              <input className={`${inputClass} mt-1`} maxLength={500} value={returnReason} onChange={event => setReturnReason(event.target.value)} />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setReturnSale(null)}>取消</Button>
              <Button variant="primary" busy={returnBusy} onClick={() => void submitReturn()}>确认退货退款</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};


export const IndustryPosSalesHistory: React.FC<{
  sales: IndustryPosSale[];
  onRefresh: () => void;
}> = ({ sales, onRefresh }) => {
  const [receipt, setReceipt] = useState<IndustryPosSale | null>(null);
  return (
  <div className="space-y-4">
    <PageHeader
      title="销售记录"
      description={`共 ${sales.length} 笔 POS 销售，金额、退款与库存变化均来自服务端。`}
      actions={<Button variant="ghost" onClick={onRefresh}><RefreshCcw className="h-4 w-4" />刷新</Button>}
    />
    <SectionCard title="POS 销售单">
      <DataTable
        minWidth={900}
        rows={sales}
        rowKey={sale => sale.id}
        emptyText="暂无 POS 销售记录。"
        columns={[
          { key: 'no', header: '销售单号', render: sale => <span className="font-semibold text-neutral-950">{sale.saleNo}</span> },
          { key: 'date', header: '时间', render: sale => formatDate(sale.createdAt) },
          { key: 'store', header: '门店', render: sale => sale.storeName || '—' },
          { key: 'items', header: '商品明细', render: sale => sale.items.map(item => `${item.productName} ×${item.quantity}`).join('，') || '—' },
          { key: 'amount', header: '金额', align: 'right', render: sale => formatMoney(sale.totalAmount) },
          { key: 'refund', header: '已退', align: 'right', render: sale => sale.refundedAmount ? formatMoney(sale.refundedAmount) : '—' },
          { key: 'payment', header: '收款', render: sale => paymentLabel(sale.paymentMethod) },
          { key: 'receipt', header: '小票', render: sale => (
            <button type="button" onClick={() => setReceipt(sale)} className="text-xs font-semibold text-neutral-700 hover:text-neutral-950">查看小票</button>
          ) }
        ]}
      />
    </SectionCard>
    {receipt ? <PosReceiptModal sale={receipt} onClose={() => setReceipt(null)} /> : null}
  </div>
  );
};

/**
 * 班次明细：销售、退款与现金流水全部来自 `GET /api/merchant/pos/shifts/:id`，
 * 不做前端汇总，金额与服务端班次汇总口径一致。
 */
const PosShiftDetailPanel: React.FC<{ detail: IndustryPosShiftDetail; onClose: () => void }> = ({ detail, onClose }) => {
  const { shift, sales, refunds, movements } = detail;
  return (
    <SectionCard
      title={`班次明细 · ${new Date(shift.openedAt).toLocaleString()}`}
      description={`${shift.storeName || '总店'} · ${shift.employeeName || '店主'} · 销售 ${shift.salesCount} 笔`}
      actions={<Button variant="ghost" onClick={onClose}>收起</Button>}
    >
      <div className="grid gap-2 text-xs sm:grid-cols-3 xl:grid-cols-6">
        {[
          ['期初现金', shift.openingCash],
          ['现金销售', shift.cashSales],
          ['刷卡/其他', shift.cardSales],
          ['现金退款', shift.cashRefunds],
          ['现金收支', shift.cashIn - shift.cashOut],
          ['应交现金', shift.expectedCash]
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg bg-neutral-50 p-3">
            <span className="text-neutral-500">{label}</span>
            <strong className="mt-1 block text-sm tabular-nums">{formatMoney(Number(value))}</strong>
          </div>
        ))}
      </div>
      {shift.closingCash !== null ? (
        <p className="mt-3 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-600">
          实交 {formatMoney(shift.closingCash)} · 差额 {formatMoney(shift.cashDifference || 0)} · 交班时间 {shift.closedAt ? formatDate(shift.closedAt) : '—'}
        </p>
      ) : null}
      <div className="mt-4 space-y-3">
        <details open className="rounded-lg border border-neutral-200 p-3">
          <summary className="cursor-pointer text-xs font-semibold text-neutral-800">销售 {sales.length} 笔</summary>
          <ul className="mt-2 divide-y divide-neutral-100 text-xs">
            {sales.length ? sales.map(sale => (
              <li key={sale.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                <span className="font-semibold text-neutral-900">{sale.saleNo}</span>
                <span className="text-neutral-500">{sale.items.map(item => `${item.productName} ×${item.quantity}`).join('，') || '—'}</span>
                <span className="tabular-nums">{formatMoney(sale.totalAmount)}{sale.refundedAmount ? `（已退 ${formatMoney(sale.refundedAmount)}）` : ''}</span>
                <span className="text-neutral-400">{paymentLabel(sale.paymentMethod)}</span>
              </li>
            )) : <li className="py-2 text-neutral-500">本班次暂无销售。</li>}
          </ul>
        </details>
        <details className="rounded-lg border border-neutral-200 p-3">
          <summary className="cursor-pointer text-xs font-semibold text-neutral-800">退款 {refunds.length} 笔</summary>
          <ul className="mt-2 divide-y divide-neutral-100 text-xs">
            {refunds.length ? refunds.map(refund => (
              <li key={refund.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                <span className="tabular-nums text-rose-700">-{formatMoney(refund.amount)}</span>
                <span className="text-neutral-500">{refund.reason || '无原因记录'}</span>
                <span className="text-neutral-400">{refund.status} · {formatDate(refund.createdAt)}</span>
              </li>
            )) : <li className="py-2 text-neutral-500">本班次暂无退款。</li>}
          </ul>
        </details>
        <details className="rounded-lg border border-neutral-200 p-3">
          <summary className="cursor-pointer text-xs font-semibold text-neutral-800">现金流水 {movements.length} 条</summary>
          <ul className="mt-2 divide-y divide-neutral-100 text-xs">
            {movements.length ? movements.map(movement => (
              <li key={movement.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                <span className={movement.direction === 'in' ? 'tabular-nums text-emerald-700' : 'tabular-nums text-rose-700'}>
                  {movement.direction === 'in' ? '+' : '−'}{formatMoney(movement.amount)}
                </span>
                <span className="text-neutral-500">{movement.reason}</span>
                <span className="text-neutral-400">{movement.employeeName || '—'} · {formatDate(movement.createdAt)}</span>
              </li>
            )) : <li className="py-2 text-neutral-500">本班次暂无现金流水。</li>}
          </ul>
        </details>
      </div>
    </SectionCard>
  );
};

/**
 * 班次历史：按门店、员工、日期范围与状态查询真实班次记录。
 * 已交班班次展示交班时封存的应交现金与差额，页面不做二次计算。
 */
export const IndustryPosShiftHistory: React.FC<{ stores?: IndustryStore[] }> = ({ stores }) => {
  const [storeId, setStoreId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState<'' | 'open' | 'closed'>('');
  const [rows, setRows] = useState<IndustryPosShiftRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [employees, setEmployees] = useState<Array<{ id: string; name: string }>>([]);
  const [detail, setDetail] = useState<IndustryPosShiftDetail | null>(null);
  const [detailBusy, setDetailBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await listPosShifts({
        storeId: storeId || undefined,
        employeeId: employeeId || undefined,
        from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
        to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
        status: status || undefined,
        limit: 50
      });
      setRows(result.shifts);
      setTotal(result.total);
    } catch (caught) {
      setError(describeApiError(caught, '班次历史读取失败'));
    } finally {
      setLoading(false);
    }
  }, [storeId, employeeId, from, to, status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let active = true;
    void listPosShiftEmployees().then(list => { if (active) setEmployees(list); });
    return () => { active = false; };
  }, []);

  const toggleDetail = async (row: IndustryPosShiftRow) => {
    if (detail?.shift.id === row.id) {
      setDetail(null);
      return;
    }
    setDetailBusy(row.id);
    setError('');
    try {
      setDetail(await fetchPosShiftDetail(row.id));
    } catch (caught) {
      setError(describeApiError(caught, '班次明细读取失败'));
    } finally {
      setDetailBusy('');
    }
  };

  const money = (value: number | null | undefined) => (value === null || value === undefined ? '—' : formatMoney(value));

  return (
    <div className="space-y-4">
      <PageHeader
        title="班次历史"
        description="应交现金 = 期初现金 + 现金销售 + 现金收入 − 现金退款 − 现金支出，全部由服务端结算。"
        actions={<Button variant="ghost" busy={loading} onClick={() => void load()}><RefreshCcw className="h-4 w-4" />刷新</Button>}
      />
      {error ? <ErrorBanner message={error} onDismiss={() => setError('')} /> : null}

      <SectionCard title="查询条件" description={`共 ${total} 个班次，按开班时间倒序返回。`}>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {stores?.length ? (
            <label className="text-xs font-semibold text-neutral-700">门店
              <select className={`${inputClass} mt-1`} value={storeId} onChange={event => setStoreId(event.target.value)}>
                <option value="">全部门店</option>
                {stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}
              </select>
            </label>
          ) : null}
          {employees.length ? (
            <label className="text-xs font-semibold text-neutral-700">员工
              <select className={`${inputClass} mt-1`} value={employeeId} onChange={event => setEmployeeId(event.target.value)}>
                <option value="">全部员工</option>
                {employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
              </select>
            </label>
          ) : null}
          <label className="text-xs font-semibold text-neutral-700">开始日期
            <input type="date" className={`${inputClass} mt-1`} value={from} onChange={event => setFrom(event.target.value)} />
          </label>
          <label className="text-xs font-semibold text-neutral-700">结束日期
            <input type="date" className={`${inputClass} mt-1`} value={to} onChange={event => setTo(event.target.value)} />
          </label>
          <label className="text-xs font-semibold text-neutral-700">状态
            <select className={`${inputClass} mt-1`} value={status} onChange={event => setStatus(event.target.value as '' | 'open' | 'closed')}>
              <option value="">全部状态</option>
              <option value="open">进行中</option>
              <option value="closed">已交班</option>
            </select>
          </label>
        </div>
      </SectionCard>

      <SectionCard title="班次记录">
        <DataTable
          minWidth={1120}
          rows={rows}
          rowKey={row => row.id}
          emptyText={loading ? '正在读取班次…' : '没有符合条件的班次。'}
          columns={[
            { key: 'openedAt', header: '开班时间', render: row => formatDate(row.openedAt) },
            { key: 'store', header: '门店', render: row => row.storeName || '总店' },
            { key: 'employee', header: '员工', render: row => row.employeeName || '店主' },
            { key: 'opening', header: '期初现金', align: 'right', render: row => money(row.openingCash) },
            { key: 'sales', header: '现金销售', align: 'right', render: row => money(row.cashSales) },
            { key: 'refunds', header: '现金退款', align: 'right', render: row => money(row.cashRefunds) },
            { key: 'flows', header: '收支', align: 'right', render: row => money(row.cashIn - row.cashOut) },
            { key: 'expected', header: '应交现金', align: 'right', render: row => money(row.expectedCash) },
            { key: 'closing', header: '实交现金', align: 'right', render: row => money(row.closingCash) },
            { key: 'diff', header: '差额', align: 'right', render: row => money(row.cashDifference) },
            {
              key: 'status',
              header: '状态',
              render: row => (
                <StatusPill tone={row.status === 'open' ? 'warning' : 'neutral'}>
                  {row.status === 'open' ? '进行中' : '已交班'}
                </StatusPill>
              )
            },
            {
              key: 'detail',
              header: '明细',
              render: row => (
                <button
                  type="button"
                  onClick={() => void toggleDetail(row)}
                  className="text-xs font-semibold text-neutral-700 hover:text-neutral-950"
                  disabled={detailBusy === row.id}
                >
                  {detailBusy === row.id ? '读取中…' : detail?.shift.id === row.id ? '收起' : '查看'}
                </button>
              )
            }
          ]}
        />
      </SectionCard>

      {detail ? <PosShiftDetailPanel detail={detail} onClose={() => setDetail(null)} /> : null}
    </div>
  );
};

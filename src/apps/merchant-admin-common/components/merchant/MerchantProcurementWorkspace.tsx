import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, PackageCheck, Plus, RefreshCw, Truck, X } from 'lucide-react';
import type { Product } from '../../../../types/b2b';
import { apiGet, apiPatch, apiPost } from '../../../../api/client';
import { useB2B } from '../../../../context/B2BContext';


type Supplier = {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  country: string | null;
  leadTimeDays: number;
  status: string;
};

type PurchaseOrderItem = {
  id: string;
  productId: string;
  variantId: string;
  styleNo: string;
  productName: string;
  sku: string;
  color: string | null;
  size: string | null;
  orderedQuantity: number;
  receivedQuantity: number;
  unitCost: number | string;
};

type PurchaseOrder = {
  id: string;
  purchaseOrderNo: string;
  createdAt: string;
  status: 'draft' | 'ordered' | 'partially_received' | 'received' | 'cancelled';
  expectedAt: string | null;
  orderedAt: string | null;
  notes: string | null;
  supplier: { id: string; name: string; leadTimeDays: number };
  items: PurchaseOrderItem[];
  receipts: Array<{
    id: string;
    receivedAt: string;
    note: string | null;
    items: Array<{ purchaseOrderItemId: string; quantity: number; unitCost: number | string }>;
  }>;
};

type DraftItem = { productId: string; sku: string; quantity: string; unitCost: string };
type ReceiptDraft = Record<string, { quantity: string; unitCost: string }>;

const emptyItem = (): DraftItem => ({ productId: '', sku: '', quantity: '1', unitCost: '' });
const statusLabels: Record<PurchaseOrder['status'], string> = {
  draft: '草稿',
  ordered: '已下单',
  partially_received: '部分收货',
  received: '已收齐',
  cancelled: '已取消'
};

export const MerchantProcurementWorkspace: React.FC<{
  products: Product[];
  isIt: boolean;
}> = ({ products, isIt }) => {
  const { localizeCopy } = useB2B();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [supplierContact, setSupplierContact] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [supplierLeadTime, setSupplierLeadTime] = useState('14');
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [draftItems, setDraftItems] = useState<DraftItem[]>([emptyItem()]);
  const [receivingOrder, setReceivingOrder] = useState<PurchaseOrder | null>(null);
  const [receiptDraft, setReceiptDraft] = useState<ReceiptDraft>({});

  const reload = async () => {
    setLoading(true);
    setError('');
    try {
      const [supplierResult, orderResult] = await Promise.all([
        apiGet<{ suppliers: Supplier[] }>('/api/merchant/suppliers'),
        apiGet<{ purchaseOrders: PurchaseOrder[] }>('/api/merchant/purchase-orders')
      ]);
      setSuppliers(supplierResult.suppliers);
      setPurchaseOrders(orderResult.purchaseOrders);
      setSupplierId(current => current || supplierResult.suppliers.find(supplier => supplier.status === 'active')?.id || '');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '采购数据读取失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    const onMerchantDataChanged = (event: Event) => {
      const resources = (event as CustomEvent<{ resources?: unknown }>).detail?.resources;
      if (Array.isArray(resources) && resources.some(resource =>
        resource === 'inventory' || resource === 'production' || resource === 'suppliers' || resource === 'purchase-orders'
      )) {
        void reload();
      }
    };
    window.addEventListener('merchant-data-changed', onMerchantDataChanged);
    return () => window.removeEventListener('merchant-data-changed', onMerchantDataChanged);
  }, []);

  const activeProducts = useMemo(
    () => products.filter(product => product.lifecycleStatus !== 'archived' && product.skus.length > 0),
    [products]
  );
  const openCount = purchaseOrders.filter(order => ['ordered', 'partially_received'].includes(order.status)).length;
  const totalExpectedValue = purchaseOrders
    .filter(order => !['received', 'cancelled'].includes(order.status))
    .reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.orderedQuantity * Number(item.unitCost), 0), 0);

  const createSupplier = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supplierName.trim()) return;
    setBusy(true);
    setError('');
    try {
      const result = await apiPost<{ supplier: Supplier }>('/api/merchant/suppliers', {
        name: supplierName.trim(),
        contactName: supplierContact.trim(),
        email: supplierEmail.trim(),
        leadTimeDays: Number(supplierLeadTime)
      });
      setSuppliers(current => [...current, result.supplier]);
      setSupplierId(result.supplier.id);
      setSupplierName('');
      setSupplierContact('');
      setSupplierEmail('');
      setShowSupplierForm(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '供应商创建失败');
    } finally {
      setBusy(false);
    }
  };

  const createPurchaseOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    const items = draftItems.map(item => ({
      productId: item.productId,
      sku: item.sku,
      quantity: Number(item.quantity),
      unitCost: Number(item.unitCost)
    }));
    if (!supplierId || items.some(item => !item.productId || !item.sku || !Number.isInteger(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unitCost) || item.unitCost < 0)) {
      setError('请为每一行选择商品和 SKU，并填写有效数量及采购单价。');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiPost('/api/merchant/purchase-orders', {
        supplierId,
        expectedAt: expectedDate || undefined,
        notes: orderNotes.trim(),
        idempotencyKey: crypto.randomUUID(),
        items
      });
      setShowOrderForm(false);
      setDraftItems([emptyItem()]);
      setExpectedDate('');
      setOrderNotes('');
      await reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '采购单创建失败');
    } finally {
      setBusy(false);
    }
  };

  const changeOrderStatus = async (order: PurchaseOrder, status: 'ordered' | 'cancelled') => {
    setBusy(true);
    setError('');
    try {
      await apiPatch(`/api/merchant/purchase-orders/${encodeURIComponent(order.id)}/status`, { status });
      await reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '采购单状态更新失败');
    } finally {
      setBusy(false);
    }
  };

  const beginReceiving = (order: PurchaseOrder) => {
    setReceivingOrder(order);
    setReceiptDraft(Object.fromEntries(order.items
      .filter(item => item.orderedQuantity > item.receivedQuantity)
      .map(item => [item.id, {
        quantity: String(item.orderedQuantity - item.receivedQuantity),
        unitCost: String(Number(item.unitCost))
      }])));
  };

  const receiveItems = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!receivingOrder) return;
    const items = Object.entries(receiptDraft)
      .map(([itemId, values]) => ({ itemId, quantity: Number(values.quantity), unitCost: Number(values.unitCost) }))
      .filter(item => item.quantity > 0);
    if (!items.length || items.some(item => !Number.isInteger(item.quantity) || item.quantity < 0 || !Number.isFinite(item.unitCost) || item.unitCost < 0)) {
      setError('请输入至少一项有效的本次收货数量和实际单价。');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiPost(`/api/merchant/purchase-orders/${encodeURIComponent(receivingOrder.id)}/receipts`, {
        idempotencyKey: crypto.randomUUID(),
        note: '采购到货验收',
        items
      });
      setReceivingOrder(null);
      await reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '收货登记失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 py-3">
        <h1 className="text-lg font-semibold tracking-tight text-neutral-950">{localizeCopy('采购', 'Acquisti')}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-1 text-[11px] text-neutral-600">
            <span>采购单 {purchaseOrders.length}</span><span className="mx-1.5 text-neutral-300">·</span>
            <span>待到货 {openCount}</span><span className="mx-1.5 text-neutral-300">·</span>
            <span>待收货 €{totalExpectedValue.toFixed(2)}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowSupplierForm(value => !value)} className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"><Plus className="h-4 w-4" />供应商</button>
            <button type="button" onClick={() => setShowOrderForm(value => !value)} disabled={!suppliers.some(supplier => supplier.status === 'active')} className="inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-4 py-2.5 text-xs font-semibold text-white hover:bg-neutral-700 disabled:opacity-40"><Plus className="h-4 w-4" />新建采购单</button>
            <button type="button" onClick={() => void reload()} aria-label="刷新采购数据" className="rounded-xl border border-neutral-200 bg-white p-2.5 text-neutral-600 hover:bg-neutral-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
          </div>
        </div>
      </header>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">{error}</div>}

      {showSupplierForm && <form onSubmit={event => void createSupplier(event)} className="grid gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-[10px] font-semibold text-neutral-700">供应商名称<input required maxLength={160} value={supplierName} onChange={event => setSupplierName(event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs font-normal" /></label>
        <label className="text-[10px] font-semibold text-neutral-700">联系人<input maxLength={120} value={supplierContact} onChange={event => setSupplierContact(event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs font-normal" /></label>
        <label className="text-[10px] font-semibold text-neutral-700">邮箱<input type="email" maxLength={254} value={supplierEmail} onChange={event => setSupplierEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs font-normal" /></label>
        <label className="text-[10px] font-semibold text-neutral-700">供货周期（天）<input type="number" min="0" max="3650" value={supplierLeadTime} onChange={event => setSupplierLeadTime(event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs font-normal" /></label>
        <button disabled={busy} className="self-end rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">保存供应商</button>
      </form>}

      {showOrderForm && <form onSubmit={event => void createPurchaseOrder(event)} className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-neutral-900">采购草稿</h2><button type="button" onClick={() => setShowOrderForm(false)} aria-label="关闭采购单表单" className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100"><X className="h-4 w-4" /></button></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-[10px] font-semibold text-neutral-700">供应商<select required value={supplierId} onChange={event => setSupplierId(event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-xs"><option value="">选择供应商</option>{suppliers.filter(supplier => supplier.status === 'active').map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name} · 预计 {supplier.leadTimeDays} 天</option>)}</select></label>
          <label className="text-[10px] font-semibold text-neutral-700">预计到货日期<input type="date" value={expectedDate} onChange={event => setExpectedDate(event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs" /></label>
        </div>
        <div className="space-y-2">
          {draftItems.map((item, index) => {
            const product = activeProducts.find(candidate => candidate.id === item.productId);
            return <div key={index} className="grid gap-2 rounded-xl bg-neutral-50 p-3 sm:grid-cols-[minmax(180px,1.2fr)_minmax(140px,1fr)_100px_120px_auto]">
              <label className="text-[9px] font-semibold text-neutral-600">商品<select value={item.productId} onChange={event => setDraftItems(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, productId: event.target.value, sku: '' } : row))} className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-2 text-[11px]"><option value="">选择商品</option>{activeProducts.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.styleNo} · {candidate.name}</option>)}</select></label>
              <label className="text-[9px] font-semibold text-neutral-600">SKU<select value={item.sku} onChange={event => setDraftItems(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, sku: event.target.value } : row))} disabled={!product} className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-2 text-[11px] disabled:bg-neutral-100"><option value="">选择 SKU</option>{product?.skus.map(sku => <option key={sku.sku} value={sku.sku}>{sku.sku} · {[sku.color, sku.size].filter(Boolean).join(' / ')}</option>)}</select></label>
              <label className="text-[9px] font-semibold text-neutral-600">数量<input required type="number" min="1" max="1000000" step="1" value={item.quantity} onChange={event => setDraftItems(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: event.target.value } : row))} className="mt-1 w-full rounded-lg border border-neutral-200 px-2 py-2 text-[11px]" /></label>
              <label className="text-[9px] font-semibold text-neutral-600">预计单件成本 €<input required type="number" min="0" max="1000000" step="0.0001" value={item.unitCost} onChange={event => setDraftItems(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, unitCost: event.target.value } : row))} className="mt-1 w-full rounded-lg border border-neutral-200 px-2 py-2 text-[11px]" /></label>
              <button type="button" disabled={draftItems.length === 1} onClick={() => setDraftItems(current => current.filter((_, rowIndex) => rowIndex !== index))} className="self-end rounded-lg p-2 text-neutral-500 hover:bg-white disabled:opacity-30" aria-label="删除采购商品行"><X className="h-4 w-4" /></button>
            </div>;
          })}
          <button type="button" onClick={() => setDraftItems(current => [...current, emptyItem()])} className="rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-[10px] font-semibold text-neutral-600 hover:bg-neutral-50"><Plus className="mr-1 inline h-3.5 w-3.5" />添加商品行</button>
        </div>
        <label className="block text-[10px] font-semibold text-neutral-700">备注<textarea maxLength={4000} value={orderNotes} onChange={event => setOrderNotes(event.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs font-normal" /></label>
        <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-[10px] text-neutral-500">保存后仍为草稿</span><button disabled={busy} className="rounded-lg bg-neutral-950 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{busy ? '保存中…' : '保存草稿'}</button></div>
      </form>}

      {receivingOrder && <form onSubmit={event => void receiveItems(event)} className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-neutral-950">登记到货 · {receivingOrder.purchaseOrderNo}</h2><p className="mt-1 text-[10px] text-neutral-600">确认后更新库存并记流水</p></div><button type="button" onClick={() => setReceivingOrder(null)} aria-label="关闭收货表单"><X className="h-4 w-4" /></button></div>
        {receivingOrder.items.filter(item => item.orderedQuantity > item.receivedQuantity).map(item => <div key={item.id} className="grid items-center gap-2 rounded-xl bg-white p-3 sm:grid-cols-[1fr_120px_150px]">
          <div className="min-w-0"><strong className="block truncate text-[11px] text-neutral-900">{item.styleNo} · {item.productName}</strong><span className="text-[9px] text-neutral-500">{item.sku} · 已收 {item.receivedQuantity}/{item.orderedQuantity}</span></div>
          <label className="text-[9px] font-semibold text-neutral-600">本次到货<input type="number" min="0" max={item.orderedQuantity - item.receivedQuantity} step="1" value={receiptDraft[item.id]?.quantity ?? '0'} onChange={event => setReceiptDraft(current => ({ ...current, [item.id]: { ...current[item.id], quantity: event.target.value } }))} className="mt-1 w-full rounded-lg border border-neutral-200 px-2 py-2 text-xs" /></label>
          <label className="text-[9px] font-semibold text-neutral-600">实际单件成本 €<input type="number" min="0" step="0.0001" value={receiptDraft[item.id]?.unitCost ?? String(Number(item.unitCost))} onChange={event => setReceiptDraft(current => ({ ...current, [item.id]: { ...current[item.id], unitCost: event.target.value } }))} className="mt-1 w-full rounded-lg border border-neutral-200 px-2 py-2 text-xs" /></label>
        </div>)}
        <button disabled={busy} className="rounded-lg bg-emerald-800 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{busy ? '登记中…' : '确认本次收货并入库'}</button>
      </form>}

      <section className="space-y-3">
        <div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-neutral-900">采购记录</h2><span className="text-[10px] text-neutral-500">最多显示最近 200 张</span></div>
        {loading ? <div className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white p-6 text-xs text-neutral-500"><RefreshCw className="h-4 w-4 animate-spin" />正在读取采购单…</div> : purchaseOrders.length ? purchaseOrders.map(order => {
          const remainingValue = order.items.reduce((sum, item) => sum + (item.orderedQuantity - item.receivedQuantity) * Number(item.unitCost), 0);
          const receivedCost = order.receipts.reduce((sum, receipt) =>
            sum + receipt.items.reduce((receiptSum, item) => receiptSum + item.quantity * Number(item.unitCost), 0), 0);
          return <article key={order.id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-neutral-950">{order.purchaseOrderNo}</h3><span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[9px] font-semibold text-neutral-700">{statusLabels[order.status]}</span></div><p className="mt-1 text-[10px] text-neutral-600">{order.supplier.name} · 创建于 {new Date(order.createdAt).toLocaleDateString()}</p></div><div className="text-right"><strong className="text-sm text-neutral-950">€{order.items.reduce((sum, item) => sum + item.orderedQuantity * Number(item.unitCost), 0).toFixed(2)}</strong><p className="mt-1 text-[9px] text-neutral-500">未收货计划成本 €{remainingValue.toFixed(2)} · 已收实际成本 €{receivedCost.toFixed(2)}</p></div></div>
            <div className="mt-3 space-y-1.5">{order.items.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-neutral-50 px-3 py-2 text-[10px]"><span className="min-w-0 truncate font-medium text-neutral-800">{item.styleNo} · {item.productName} · {item.sku}</span><span className="shrink-0 text-neutral-600">{item.receivedQuantity}/{item.orderedQuantity} 件 · €{Number(item.unitCost).toFixed(2)} / 件</span></div>)}</div>
            {order.receipts.length > 0 && <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3"><p className="text-[9px] font-semibold text-emerald-900">收货流水</p>{order.receipts.slice(0, 3).map(receipt => <p key={receipt.id} className="mt-1 text-[9px] text-neutral-600">{new Date(receipt.receivedAt).toLocaleString()} · {receipt.items.reduce((sum, item) => sum + item.quantity, 0)} 件 · {receipt.note || '已验收入库'}</p>)}</div>}
            {order.expectedAt && <p className="mt-2 text-[9px] text-neutral-500">预计到货：{new Date(order.expectedAt).toLocaleDateString()}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {order.status === 'draft' && <button type="button" disabled={busy} onClick={() => void changeOrderStatus(order, 'ordered')} className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-950 px-3 py-2 text-[10px] font-semibold text-white"><Truck className="h-3.5 w-3.5" />标记已向供应商下单</button>}
              {['ordered', 'partially_received'].includes(order.status) && <button type="button" onClick={() => beginReceiving(order)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-[10px] font-semibold text-white"><PackageCheck className="h-3.5 w-3.5" />登记到货</button>}
              {['draft', 'ordered', 'partially_received'].includes(order.status) && <button type="button" disabled={busy} onClick={() => void changeOrderStatus(order, 'cancelled')} className="rounded-lg border border-neutral-200 px-3 py-2 text-[10px] font-semibold text-neutral-600 hover:bg-neutral-50">取消采购单</button>}
            </div>
          </article>;
        }) : <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center"><ClipboardList className="mx-auto h-8 w-8 text-neutral-300" /><p className="mt-2 text-xs font-semibold text-neutral-700">暂无采购单</p><button type="button" onClick={() => setShowSupplierForm(true)} className="mt-3 rounded-lg border border-neutral-200 px-3 py-2 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50">新增供应商</button></div>}
      </section>
    </div>
  );
};

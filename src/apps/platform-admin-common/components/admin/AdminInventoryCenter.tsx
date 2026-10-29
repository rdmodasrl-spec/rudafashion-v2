import React, { useEffect, useState } from 'react';
import { Check, RefreshCw, Warehouse } from 'lucide-react';
import { apiGet, apiPost } from '../../../../api/client';
import { useB2B } from '../../../../context/B2BContext';

type StockMovement = {
  id: string;
  productId: string;
  sku: string;
  location: string;
  quantity: number;
  movementType: string;
  referenceId: string | null;
  operatorId: string | null;
  note: string | null;
  createdAt: string;
};

const movementLabels: Record<string, string> = {
  inbound: '入库',
  reservation: '订单预留',
  release: '释放预留',
  sale: '销售出库',
  return: '退货入库',
  transfer: '调拨'
};

export const AdminInventoryCenter: React.FC = () => {
  const { products, replaceProductFromServer, addNotification } = useB2B();
  const [productId, setProductId] = useState('');
  const [sku, setSku] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [requestReferenceId, setRequestReferenceId] = useState('');
  const [requestSignature, setRequestSignature] = useState('');

  const selectedProduct = products.find(product => product.id === productId) ?? products[0];
  const selectedSku = selectedProduct?.skus.find(item => item.sku === sku) ?? selectedProduct?.skus[0];
  const totalSkus = products.reduce((count, product) => count + product.skus.length, 0);
  const loadMovements = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiGet<{ success: true; movements: StockMovement[] }>('/api/admin/inventory/movements?limit=100');
      setMovements(result.movements);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '库存流水读取失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadMovements(); }, []);

  useEffect(() => {
    if (!products.length) return;
    const currentProduct = products.find(product => product.id === productId);
    const nextProduct = currentProduct ?? products[0];
    if (nextProduct.id !== productId) setProductId(nextProduct.id);
    if (!nextProduct.skus.some(item => item.sku === sku)) setSku(nextProduct.skus[0]?.sku ?? '');
  }, [products, productId, sku]);

  const receiveStock = async () => {
    if (!selectedProduct || !selectedSku || !Number.isInteger(quantity) || quantity <= 0 || saving) return;
    setSaving(true);
    setError('');
    try {
      const signature = JSON.stringify([selectedProduct.id, selectedSku.sku, quantity, note.trim()]);
      const referenceId = requestSignature === signature && requestReferenceId ? requestReferenceId : `INV-${crypto.randomUUID()}`;
      setRequestReferenceId(referenceId);
      setRequestSignature(signature);
      const result = await apiPost<{ success: true; product: typeof selectedProduct }>('/api/admin/inventory/inbound', {
        productId: selectedProduct.id,
        sku: selectedSku.sku,
        location: 'central',
        quantity,
        referenceId,
        note: note.trim()
      });
      replaceProductFromServer(result.product);
      addNotification('success', '库存入库完成', `${selectedSku.sku} 已增加 ${quantity} 件，凭证 ${referenceId}`);
      setNote('');
      setRequestReferenceId('');
      setRequestSignature('');
      await loadMovements();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : '入库失败，请刷新库存后重试';
      setError(message);
      addNotification('warning', '库存入库失败', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="flex items-center gap-2 text-sm font-bold text-neutral-950">
          <Warehouse className="h-4 w-4" /> 单仓库存管理
        </div>
        <p className="mt-1 text-xs leading-5 text-neutral-600">
          当前平台启用单仓模式。此处支持总仓入库与库存流水；跨仓调拨在启用多个仓库前不可用。
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">总仓现货</p>
          <p className="mt-1 text-2xl font-bold text-neutral-950">
            {products.reduce((sum, product) => sum + product.skus.reduce((total, item) => total + item.stockCentral, 0), 0).toLocaleString()} 件
          </p>
        </article>
        <article className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">商品 / SKU</p>
          <p className="mt-1 text-2xl font-bold text-neutral-950">{products.length} 款 · {totalSkus} 组</p>
        </article>
      </div>

      <article className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-bold text-neutral-950">登记入库</h2>
        <p className="mt-1 text-xs text-neutral-500">提交前请核对商品、SKU 与实收数量；服务端会校验并记录操作员及库存流水。</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-xs font-semibold text-neutral-700">
            商品
            <select value={selectedProduct?.id ?? ''} onChange={event => {
              const next = products.find(product => product.id === event.target.value);
              setProductId(event.target.value);
              setSku(next?.skus[0]?.sku ?? '');
            }} className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2">
              {products.map(product => <option key={product.id} value={product.id}>{product.styleNo} · {product.name}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-neutral-700">
            SKU
            <select value={selectedSku?.sku ?? ''} onChange={event => setSku(event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2">
              {(selectedProduct?.skus ?? []).map(item => <option key={item.sku} value={item.sku}>{item.sku} · {item.color} / {item.size} · 现货 {item.stockCentral}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-neutral-700">
            实收入库数量
            <input type="number" min={1} step={1} value={quantity} onChange={event => setQuantity(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2" />
          </label>
          <label className="text-xs font-semibold text-neutral-700">
            入库说明（可选）
            <input maxLength={500} value={note} onChange={event => setNote(event.target.value)} placeholder="采购单号、收货批次或备注" className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2" />
          </label>
        </div>
        <button type="button" onClick={() => {
          if (!selectedProduct || !selectedSku || quantity <= 0) return;
          if (window.confirm(`确认将 ${selectedSku.sku} 的总仓库存增加 ${quantity} 件？`)) void receiveStock();
        }} disabled={!selectedSku || !Number.isInteger(quantity) || quantity <= 0 || saving} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-neutral-950 px-4 text-xs font-semibold text-white disabled:opacity-40">
          <Check className="h-4 w-4" />{saving ? '正在登记…' : '确认入库'}
        </button>
      </article>

      <article className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-bold text-neutral-950">库存流水</h2>
            <p className="mt-0.5 text-[11px] text-neutral-500">最近 100 条服务端记录</p>
          </div>
          <button type="button" onClick={() => void loadMovements()} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700 disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />刷新
          </button>
        </div>
        {error && <div role="alert" className="m-4 rounded-lg border border-neutral-300 bg-neutral-50 p-3 text-xs text-neutral-800">{error}</div>}
        <div className="divide-y divide-neutral-100">
          {loading ? <p className="p-6 text-center text-xs text-neutral-500">正在读取库存流水…</p> : movements.length ? movements.map(movement => {
            const product = products.find(item => item.id === movement.productId);
            return (
              <div key={movement.id} className="grid gap-1 px-4 py-3 text-xs sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-neutral-900">{product?.styleNo ?? movement.productId} · {movement.sku}</p>
                  <p className="mt-0.5 text-[11px] text-neutral-500">{movement.note || movement.referenceId || '无备注'} · {movement.operatorId || '系统'}</p>
                </div>
                <span className="text-neutral-600">{movementLabels[movement.movementType] ?? movement.movementType} · {movement.location}</span>
                <span className={`font-semibold tabular-nums ${movement.quantity < 0 ? 'text-neutral-700' : 'text-neutral-950'}`}>{movement.quantity > 0 ? '+' : ''}{movement.quantity}</span>
                <time className="text-[10px] text-neutral-500 sm:col-span-3">{new Date(movement.createdAt).toLocaleString()}</time>
              </div>
            );
          }) : !error && <p className="p-8 text-center text-xs text-neutral-500">暂无库存流水</p>}
        </div>
      </article>
    </section>
  );
};

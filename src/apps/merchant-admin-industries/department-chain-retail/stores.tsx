/**
 * 百货连锁店：门店档案与门店库存。
 */
import React, { useEffect, useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import type { Product } from '../../../types/b2b';
import {
  adjustStoreStock,
  createIndustryStore,
  describeApiError,
  listIndustryStores,
  listStoreStock,
  updateIndustryStore,
  type IndustryStore,
  type IndustryStoreStock
} from '../shared/data';
import {
  Button,
  DataTable,
  ErrorBanner,
  FormField,
  LoadingBlock,
  Modal,
  PageHeader,
  SectionCard,
  StatusPill,
  inputClass
} from '../shared/kit';

export const ChainStoresSection: React.FC<{
  products: Product[];
  notify: (type: 'success' | 'info' | 'warning', title: string, message: string) => void;
}> = ({ products, notify }) => {
  const [stores, setStores] = useState<IndustryStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', address: '', city: '', country: 'Italy', phone: '', status: 'active' });
  const [selected, setSelected] = useState<IndustryStore | null>(null);
  const [stock, setStock] = useState<IndustryStoreStock[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockForm, setStockForm] = useState({ productId: '', sku: '', quantity: '0', note: '' });
  const [stockError, setStockError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await listIndustryStores();
      setStores(list);
      setSelected(previous => previous ? list.find(store => store.id === previous.id) || null : null);
    } catch (caught) {
      setError(describeApiError(caught, '门店读取失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!selected) {
      setStock([]);
      return;
    }
    let alive = true;
    setStockLoading(true);
    listStoreStock(selected.id)
      .then(list => { if (alive) setStock(list); })
      .catch(caught => { if (alive) setError(describeApiError(caught, '门店库存读取失败')); })
      .finally(() => { if (alive) setStockLoading(false); });
    return () => { alive = false; };
  }, [selected]);

  const submitStore = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      setError('门店名称与门店编码必填');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await createIndustryStore(form);
      notify('success', '门店已创建', `${form.name}（${form.code}）`);
      setCreateOpen(false);
      setForm({ name: '', code: '', address: '', city: '', country: 'Italy', phone: '', status: 'active' });
      await load();
    } catch (caught) {
      setError(describeApiError(caught, '门店创建失败'));
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (store: IndustryStore) => {
    setError('');
    try {
      await updateIndustryStore(store.id, { status: store.status === 'active' ? 'suspended' : 'active' });
      notify('success', '门店状态已更新', store.name);
      await load();
    } catch (caught) {
      setError(describeApiError(caught, '门店状态更新失败'));
    }
  };

  const submitStock = async () => {
    if (!selected) return;
    const quantity = Math.trunc(Number(stockForm.quantity));
    if (!stockForm.productId || !stockForm.sku || !Number.isFinite(quantity) || quantity === 0 || !stockForm.note.trim()) {
      setStockError('请选择商品/SKU，填写非零数量与原因');
      return;
    }
    setBusy(true);
    setStockError('');
    try {
      await adjustStoreStock(selected.id, {
        productId: stockForm.productId,
        sku: stockForm.sku,
        quantity,
        note: stockForm.note.trim()
      });
      notify('success', '门店库存已调整', `${selected.name} ${stockForm.sku} ${quantity > 0 ? '+' : ''}${quantity}`);
      setStockForm({ productId: '', sku: '', quantity: '0', note: '' });
      setStock(await listStoreStock(selected.id));
      await load();
    } catch (caught) {
      setStockError(describeApiError(caught, '门店库存调整失败'));
    } finally {
      setBusy(false);
    }
  };

  const selectedProduct = products.find(product => product.id === stockForm.productId);

  return (
    <div className="space-y-4">
      <PageHeader
        title="门店管理"
        description="门店档案、营业状态与门店库存归属同一商家；门店之间库存独立计算。"
        actions={<><Button variant="ghost" onClick={() => void load()}><RefreshCcw className="h-4 w-4" />刷新</Button><Button variant="primary" onClick={() => setCreateOpen(true)}>新增门店</Button></>}
      />
      {error ? <ErrorBanner message={error} onDismiss={() => setError('')} /> : null}
      <SectionCard title="门店列表" description={`共 ${stores.length} 家门店`}>
        {loading ? <LoadingBlock label="正在读取门店" /> : (
          <DataTable
            minWidth={900}
            rows={stores}
            rowKey={store => store.id}
            emptyText="暂无门店。请先创建门店后再分配库存。"
            onRowClick={store => setSelected(store)}
            columns={[
              { key: 'name', header: '门店', render: store => <span className="font-semibold text-neutral-950">{store.name}</span> },
              { key: 'code', header: '门店 ID', render: store => store.code },
              { key: 'city', header: '城市', render: store => [store.city, store.country].filter(Boolean).join(' / ') || '—' },
              { key: 'phone', header: '电话', render: store => store.phone || '—' },
              { key: 'stock', header: 'SKU / 件数', align: 'right', render: store => `${store.stockSummary?.skuCount ?? 0} / ${store.stockSummary?.onHandQuantity ?? 0}` },
              { key: 'status', header: '状态', render: store => <StatusPill tone={store.status === 'active' ? 'success' : 'warning'}>{store.status === 'active' ? '营业中' : '已停用'}</StatusPill> },
              {
                key: 'actions',
                header: '操作',
                render: store => (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setSelected(store)}>门店库存</Button>
                    <Button size="sm" variant="ghost" onClick={() => void toggleStatus(store)}>{store.status === 'active' ? '停用' : '启用'}</Button>
                  </div>
                )
              }
            ]}
          />
        )}
      </SectionCard>

      <Modal
        open={createOpen}
        title="新增门店"
        onClose={() => setCreateOpen(false)}
        footer={<><Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={busy}>取消</Button><Button variant="primary" busy={busy} onClick={() => void submitStore()}>保存门店</Button></>}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="门店名称" required><input className={inputClass} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></FormField>
          <FormField label="门店编码" required help="商家内唯一，用于门店识别"><input className={inputClass} value={form.code} onChange={event => setForm({ ...form, code: event.target.value })} /></FormField>
          <FormField label="城市"><input className={inputClass} value={form.city} onChange={event => setForm({ ...form, city: event.target.value })} /></FormField>
          <FormField label="国家"><input className={inputClass} value={form.country} onChange={event => setForm({ ...form, country: event.target.value })} /></FormField>
          <FormField label="电话"><input className={inputClass} value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /></FormField>
          <div className="sm:col-span-2"><FormField label="地址"><input className={inputClass} value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} /></FormField></div>
        </div>
      </Modal>
      {selected ? (
        <SectionCard
          title={`${selected.name} · 门店库存`}
          description={`门店编码 ${selected.code}`}
          actions={<Button size="sm" variant="ghost" onClick={() => setSelected(null)}>关闭</Button>}
        >
          {stockLoading ? <LoadingBlock label="正在读取门店库存" /> : (
            <DataTable
              minWidth={720}
              rows={stock}
              rowKey={item => item.id}
              emptyText="该门店暂无库存记录。调拨或门店入库后会显示在这里。"
              columns={[
                { key: 'product', header: '商品', render: item => `${item.styleNo} · ${item.productName}` },
                { key: 'sku', header: 'SKU', render: item => item.sku },
                { key: 'qty', header: '门店数量', align: 'right', render: item => item.quantity }
              ]}
            />
          )}
          <div className="mt-4 rounded-md border border-neutral-200 p-3">
            <h3 className="text-xs font-bold text-neutral-900">门店入库 / 出库</h3>
            {stockError ? <div className="mt-2"><ErrorBanner message={stockError} /></div> : null}
            <div className="mt-2 grid gap-2 sm:grid-cols-4">
              <select
                className={inputClass}
                value={stockForm.productId}
                onChange={event => setStockForm({ ...stockForm, productId: event.target.value, sku: '' })}
                aria-label="选择商品"
              >
                <option value="">选择商品</option>
                {products.map(product => <option key={product.id} value={product.id}>{product.styleNo} · {product.name}</option>)}
              </select>
              <select
                className={inputClass}
                value={stockForm.sku}
                onChange={event => setStockForm({ ...stockForm, sku: event.target.value })}
                aria-label="选择 SKU"
                disabled={!selectedProduct}
              >
                <option value="">选择 SKU</option>
                {(selectedProduct?.skus || []).map(sku => <option key={sku.sku} value={sku.sku}>{sku.sku}</option>)}
              </select>
              <input className={inputClass} inputMode="numeric" value={stockForm.quantity} onChange={event => setStockForm({ ...stockForm, quantity: event.target.value })} aria-label="调整数量" placeholder="正数入库/负数出库" />
              <input className={inputClass} value={stockForm.note} onChange={event => setStockForm({ ...stockForm, note: event.target.value })} aria-label="调整原因" placeholder="调整原因" />
            </div>
            <div className="mt-2 flex justify-end">
              <Button variant="primary" size="sm" busy={busy} onClick={() => void submitStock()}>提交调整</Button>
            </div>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
};


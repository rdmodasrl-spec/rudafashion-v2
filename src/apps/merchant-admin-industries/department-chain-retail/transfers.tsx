/**
 * 百货连锁店：门店间库存调拨（申请 → 发出 → 收货）。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCcw, Trash2 } from 'lucide-react';
import type { Product } from '../../../types/b2b';
import {
  advanceStoreTransfer,
  createStoreTransfer,
  describeApiError,
  listIndustryStores,
  listStoreTransfers,
  type IndustryStore,
  type IndustryStoreTransfer
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
  formatDate,
  inputClass
} from '../shared/kit';

type TransferItemDraft = { productId: string; sku: string; quantity: string };

const STATUS_LABELS: Record<string, string> = {
  requested: '待发出',
  dispatched: '运输中',
  received: '已收货',
  cancelled: '已取消'
};

export const ChainTransfersSection: React.FC<{
  products: Product[];
  notify: (type: 'success' | 'info' | 'warning', title: string, message: string) => void;
}> = ({ products, notify }) => {
  const [stores, setStores] = useState<IndustryStore[]>([]);
  const [transfers, setTransfers] = useState<IndustryStoreTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [fromStoreId, setFromStoreId] = useState('');
  const [toStoreId, setToStoreId] = useState('');
  const [note, setNote] = useState('');
  const [items, setItems] = useState<TransferItemDraft[]>([{ productId: '', sku: '', quantity: '1' }]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [storeList, transferList] = await Promise.all([listIndustryStores(), listStoreTransfers()]);
      setStores(storeList);
      setTransfers(transferList);
    } catch (caught) {
      setError(describeApiError(caught, '调拨数据读取失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const activeStores = useMemo(() => stores.filter(store => store.status === 'active'), [stores]);

  const submit = async () => {
    if (!fromStoreId || !toStoreId) {
      setFormError('请选择调出门店与调入门店');
      return;
    }
    if (fromStoreId === toStoreId) {
      setFormError('调出门店与调入门店不能相同');
      return;
    }
    const payloadItems = items
      .map(item => ({ productId: item.productId, sku: item.sku, quantity: Math.trunc(Number(item.quantity)) }))
      .filter(item => item.productId && item.sku);
    if (!payloadItems.length || payloadItems.some(item => !Number.isFinite(item.quantity) || item.quantity <= 0)) {
      setFormError('请为每个调拨明细选择商品与 SKU，并填写正整数数量');
      return;
    }
    setBusy(true);
    setFormError('');
    try {
      await createStoreTransfer({ fromStoreId, toStoreId, items: payloadItems, note: note.trim() });
      notify('success', '调拨申请已创建', '状态为待发出，发货后才会扣减调出门店库存');
      setOpen(false);
      setItems([{ productId: '', sku: '', quantity: '1' }]);
      setNote('');
      await load();
    } catch (caught) {
      setFormError(describeApiError(caught, '调拨创建失败'));
    } finally {
      setBusy(false);
    }
  };

  const advance = async (transfer: IndustryStoreTransfer, status: 'dispatched' | 'received' | 'cancelled') => {
    setBusy(true);
    setError('');
    try {
      await advanceStoreTransfer(transfer.id, status);
      notify('success', '调拨状态已更新', `${transfer.transferNo} → ${STATUS_LABELS[status]}`);
      await load();
    } catch (caught) {
      setError(describeApiError(caught, '调拨状态更新失败'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="库存调拨"
        description="调拨在发出时扣减调出门店库存，收货时增加调入门店库存。"
        actions={<><Button variant="ghost" onClick={() => void load()}><RefreshCcw className="h-4 w-4" />刷新</Button><Button variant="primary" onClick={() => setOpen(true)}>发起调拨</Button></>}
      />
      {error ? <ErrorBanner message={error} onDismiss={() => setError('')} /> : null}
      <SectionCard title="调拨单" description={`共 ${transfers.length} 张调拨单`}>
        {loading ? <LoadingBlock label="正在读取调拨单" /> : (
          <DataTable
            minWidth={980}
            rows={transfers}
            rowKey={transfer => transfer.id}
            emptyText="暂无调拨单。"
            columns={[
              { key: 'no', header: '调拨单号', render: transfer => <span className="font-semibold text-neutral-950">{transfer.transferNo}</span> },
              { key: 'route', header: '调出 → 调入', render: transfer => `${transfer.fromStoreName} → ${transfer.toStoreName}` },
              { key: 'items', header: '明细', render: transfer => transfer.items.map(item => `${item.sku} ×${item.quantity}`).join('，') || '—' },
              { key: 'date', header: '创建日期', render: transfer => formatDate(transfer.createdAt) },
              { key: 'status', header: '状态', render: transfer => <StatusPill tone={transfer.status === 'received' ? 'success' : transfer.status === 'cancelled' ? 'neutral' : 'warning'}>{STATUS_LABELS[transfer.status] || transfer.status}</StatusPill> },
              {
                key: 'actions',
                header: '操作',
                render: transfer => (
                  <div className="flex flex-wrap gap-1">
                    {transfer.status === 'requested' ? <Button size="sm" variant="secondary" busy={busy} onClick={() => void advance(transfer, 'dispatched')}>发出</Button> : null}
                    {transfer.status === 'dispatched' ? <Button size="sm" variant="secondary" busy={busy} onClick={() => void advance(transfer, 'received')}>确认收货</Button> : null}
                    {['requested', 'dispatched'].includes(transfer.status) ? <Button size="sm" variant="danger" busy={busy} onClick={() => void advance(transfer, 'cancelled')}>取消</Button> : null}
                    {!['requested', 'dispatched'].includes(transfer.status) ? <span className="text-xs text-neutral-400">已完成</span> : null}
                  </div>
                )
              }
            ]}
          />
        )}
      </SectionCard>


      <Modal
        open={open}
        title="发起门店调拨"
        onClose={() => setOpen(false)}
        wide
        footer={<><Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>取消</Button><Button variant="primary" busy={busy} onClick={() => void submit()}>提交调拨申请</Button></>}
      >
        <div className="space-y-3">
          {formError ? <ErrorBanner message={formError} /> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="调出门店" required>
              <select className={inputClass} value={fromStoreId} onChange={event => setFromStoreId(event.target.value)}>
                <option value="">请选择</option>
                {activeStores.map(store => <option key={store.id} value={store.id}>{store.name}（{store.code}）</option>)}
              </select>
            </FormField>
            <FormField label="调入门店" required>
              <select className={inputClass} value={toStoreId} onChange={event => setToStoreId(event.target.value)}>
                <option value="">请选择</option>
                {activeStores.map(store => <option key={store.id} value={store.id}>{store.name}（{store.code}）</option>)}
              </select>
            </FormField>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-neutral-900">调拨明细</h3>
              <Button size="sm" variant="ghost" onClick={() => setItems(previous => [...previous, { productId: '', sku: '', quantity: '1' }])}><Plus className="h-3.5 w-3.5" />添加明细</Button>
            </div>
            {items.map((item, index) => {
              const product = products.find(candidate => candidate.id === item.productId);
              return (
                <div key={index} className="grid gap-2 rounded-md bg-neutral-50 p-2 sm:grid-cols-[1.2fr_1fr_0.6fr_auto]">
                  <select className={inputClass} value={item.productId} onChange={event => setItems(previous => previous.map((row, rowIndex) => rowIndex === index ? { ...row, productId: event.target.value, sku: '' } : row))} aria-label="选择商品">
                    <option value="">选择商品</option>
                    {products.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.styleNo} · {candidate.name}</option>)}
                  </select>
                  <select className={inputClass} value={item.sku} onChange={event => setItems(previous => previous.map((row, rowIndex) => rowIndex === index ? { ...row, sku: event.target.value } : row))} aria-label="选择 SKU">
                    <option value="">选择 SKU</option>
                    {(product?.skus || []).map(sku => <option key={sku.sku} value={sku.sku}>{sku.sku}</option>)}
                  </select>
                  <input className={inputClass} inputMode="numeric" value={item.quantity} onChange={event => setItems(previous => previous.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: event.target.value } : row))} aria-label="调拨数量" />
                  {items.length > 1 ? (
                    <Button size="sm" variant="ghost" aria-label="删除明细" onClick={() => setItems(previous => previous.filter((_, rowIndex) => rowIndex !== index))}><Trash2 className="h-3.5 w-3.5" /></Button>
                  ) : null}
                </div>
              );
            })}
          </div>
          <FormField label="备注"><input className={inputClass} value={note} onChange={event => setNote(event.target.value)} /></FormField>
        </div>
      </Modal>
    </div>
  );
};


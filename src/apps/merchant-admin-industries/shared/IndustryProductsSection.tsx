/**
 * 行业商品与库存区段。列与操作由行业能力决定，但读取/写入走同一权威 API。
 */
import React, { useMemo, useState } from 'react';
import { Archive, Eye, RefreshCcw } from 'lucide-react';
import type { MerchantIndustryCapability } from '../../../constants/merchantIndustryCapabilities';
import { getProductCategoryLabel } from '../../../constants/productCategories';
import type { Product } from '../../../types/b2b';
import { IndustryProductForm } from './IndustryProductForm';
import {
  adjustIndustryInventory,
  archiveIndustryProduct,
  describeApiError,
  parseIndustryProductAttributes,
  updateIndustryProductLifecycle,
  useRemoteList,
  type IndustryInventoryBalance
} from './data';
import {
  Button,
  DataTable,
  ErrorBanner,
  FormField,
  LoadingBlock,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  SectionCard,
  StatusPill,
  formatMoney,
  inputClass
} from './kit';

const PAGE_SIZE = 10;

function priceLabel(capability: MerchantIndustryCapability): string {
  return capability.pricing.primary === 'retail' ? '零售价' : '批发价';
}

function productPrice(product: Product, capability: MerchantIndustryCapability): number {
  return capability.pricing.primary === 'retail' ? Number(product.rrpPrice || 0) : Number(product.wholesalePrice || 0);
}

function productAttributes(product: Product): Record<string, string> {
  return parseIndustryProductAttributes(product as unknown as { industryAttributes?: unknown });
}

function totalStock(product: Product): number {
  return Number((product.skus || []).reduce((sum, sku) => sum + Number(sku.stockCentral || 0), 0));
}

export const IndustryProductsSection: React.FC<{
  capability: MerchantIndustryCapability;
  products: Product[];
  editingEnabled: boolean;
  onRefresh: () => void;
  notify: (type: 'success' | 'info' | 'warning', title: string, message: string) => void;
}> = ({ capability, products, editingEnabled, onRefresh, notify }) => {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<Product | null>(null);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return products.filter(product => {
      if (statusFilter !== 'all' && (product.lifecycleStatus || 'published') !== statusFilter) return false;
      if (!keyword) return true;
      return [product.styleNo, product.name, product.brand, product.category]
        .some(value => String(value || '').toLowerCase().includes(keyword));
    });
  }, [products, query, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const outOfStock = products.filter(product => totalStock(product) <= 0);

  const toggleLifecycle = async (product: Product) => {
    if (!editingEnabled) {
      setError('商品编辑权限未开启，请先在设置中开启商品编辑。');
      return;
    }
    const next = (product.lifecycleStatus || 'published') === 'published' ? 'draft' : 'published';
    setBusyId(product.id);
    setError('');
    try {
      await updateIndustryProductLifecycle(product, next);
      notify('success', next === 'published' ? '商品已上架' : '商品已下架', `${product.styleNo} · ${product.name}`);
      onRefresh();
    } catch (caught) {
      setError(describeApiError(caught, '商品状态更新失败'));
    } finally {
      setBusyId('');
    }
  };

  const archive = async (product: Product) => {
    if (!editingEnabled) {
      setError('商品编辑权限未开启，请先在设置中开启商品编辑。');
      return;
    }
    if (!window.confirm(`确认归档 ${product.styleNo}？归档后历史订单会保留。`)) return;
    setBusyId(product.id);
    setError('');
    try {
      await archiveIndustryProduct(product);
      notify('success', '商品已归档', product.styleNo);
      setDetail(null);
      onRefresh();
    } catch (caught) {
      setError(describeApiError(caught, '商品归档失败'));
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="商品管理"
        description={`${capability.productModel === 'apparel' ? '款式与颜色尺码 SKU' : capability.productModel === 'bags' ? '箱包款号、材质与尺寸 SKU' : '通用商品、规格与条码'}；定价以${priceLabel(capability)}为准。`}
        actions={
          <>
            <Button variant="ghost" onClick={onRefresh}><RefreshCcw className="h-4 w-4" />刷新</Button>
            <Button variant="primary" onClick={() => setCreateOpen(true)}>新增商品</Button>
          </>
        }
      />
      {error ? <ErrorBanner message={error} onDismiss={() => setError('')} /> : null}
      {!editingEnabled ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          商品编辑锁未开启：可以新增商品，但上下架与归档需要在“设置”中开启商品编辑。
        </div>
      ) : null}

      <SectionCard
        title="商品列表"
        description={`共 ${products.length} 个商品，其中 ${outOfStock.length} 个无可售库存`}
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <SearchInput value={query} onChange={value => { setQuery(value); setPage(1); }} placeholder="搜索编码、名称、品牌" />
            <select
              className="h-10 rounded-md border border-neutral-300 bg-white px-2 text-sm"
              value={statusFilter}
              onChange={event => { setStatusFilter(event.target.value as 'all' | 'published' | 'draft'); setPage(1); }}
              aria-label="商品状态筛选"
            >
              <option value="all">全部状态</option>
              <option value="published">已上架</option>
              <option value="draft">草稿</option>
            </select>
          </div>
        }
      >
        <DataTable
          minWidth={900}
          rows={rows}
          rowKey={product => product.id}
          emptyText={products.length ? '没有符合条件的商品。' : '还没有商品，点击右上角新增商品。'}
          columns={[
            { key: 'code', header: '编码', render: product => <span className="font-semibold text-neutral-950">{product.styleNo}</span> },
            { key: 'name', header: '名称', render: product => product.name },
            { key: 'category', header: '品类', render: product => getProductCategoryLabel(product.category, false) },
            { key: 'price', header: priceLabel(capability), align: 'right', render: product => formatMoney(productPrice(product, capability)) },
            { key: 'stock', header: '可售库存', align: 'right', render: product => totalStock(product) },
            {
              key: 'status',
              header: '状态',
              render: product => (
                <StatusPill tone={(product.lifecycleStatus || 'published') === 'published' ? 'success' : 'neutral'}>
                  {(product.lifecycleStatus || 'published') === 'published' ? '已上架' : '草稿'}
                </StatusPill>
              )
            },
            {
              key: 'actions',
              header: '操作',
              render: product => (
                <div className="flex flex-wrap items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setDetail(product)}><Eye className="h-3.5 w-3.5" />详情</Button>
                  <Button size="sm" variant="ghost" busy={busyId === product.id} onClick={() => void toggleLifecycle(product)}>
                    {(product.lifecycleStatus || 'published') === 'published' ? '下架' : '上架'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void archive(product)}><Archive className="h-3.5 w-3.5" />归档</Button>
                </div>
              )
            }
          ]}
        />
        <Pagination page={currentPage} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} />
      </SectionCard>

      <Modal open={createOpen} title="新增商品" onClose={() => setCreateOpen(false)} wide>
        <IndustryProductForm
          capability={capability}
          onCancel={() => setCreateOpen(false)}
          onCreated={message => {
            setCreateOpen(false);
            notify('success', '商品已保存', message);
            onRefresh();
          }}
        />
      </Modal>

      <ProductDetailModal
        capability={capability}
        product={detail}
        onClose={() => setDetail(null)}
        onToggle={product => void toggleLifecycle(product)}
        onArchive={product => void archive(product)}
      />
    </div>
  );
};


export const ProductDetailModal: React.FC<{
  capability: MerchantIndustryCapability;
  product: Product | null;
  onClose: () => void;
  onToggle: (product: Product) => void;
  onArchive: (product: Product) => void;
}> = ({ capability, product, onClose, onToggle, onArchive }) => (
  <Modal open={!!product} title={product ? `${product.styleNo} · ${product.name}` : '商品详情'} onClose={onClose} wide>
    {product ? (
      <div className="space-y-3 text-sm">
        <dl className="grid gap-2 sm:grid-cols-2">
          <div><dt className="text-xs text-neutral-500">品类</dt><dd className="font-semibold">{getProductCategoryLabel(product.category, false)}</dd></div>
          <div><dt className="text-xs text-neutral-500">{priceLabel(capability)}</dt><dd className="font-semibold">{formatMoney(productPrice(product, capability))}</dd></div>
          <div><dt className="text-xs text-neutral-500">品牌</dt><dd>{product.brand || '—'}</dd></div>
          <div><dt className="text-xs text-neutral-500">状态</dt><dd>{(product.lifecycleStatus || 'published') === 'published' ? '已上架' : '草稿'}</dd></div>
        </dl>
        {Object.keys(productAttributes(product)).length ? (
          <div>
            <h3 className="text-xs font-semibold text-neutral-700">行业属性</h3>
            <dl className="mt-1 grid gap-2 sm:grid-cols-2">
              {Object.entries(productAttributes(product)).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-xs text-neutral-500">{capability.productFields.find(field => field.key === key)?.label || key}</dt>
                  <dd>{value || '—'}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
        <div>
          <h3 className="text-xs font-semibold text-neutral-700">SKU</h3>
          <ul className="mt-1 divide-y divide-neutral-100 rounded-md border border-neutral-200">
            {(product.skus || []).map(sku => (
              <li key={sku.sku} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="font-medium">{sku.sku}{sku.color ? ` · ${sku.color}` : ''}{sku.size ? ` · ${sku.size}` : ''}</span>
                <span className="text-neutral-500">可售 {Number(sku.stockCentral || 0)}</span>
              </li>
            ))}
            {!(product.skus || []).length ? <li className="px-3 py-3 text-neutral-500">该商品没有 SKU 记录。</li> : null}
          </ul>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onToggle(product)}>
            {(product.lifecycleStatus || 'published') === 'published' ? '下架商品' : '上架商品'}
          </Button>
          <Button variant="danger" onClick={() => onArchive(product)}>归档商品</Button>
        </div>
      </div>
    ) : null}
  </Modal>
);


export const IndustryInventorySection: React.FC<{
  capability: MerchantIndustryCapability;
  notify: (type: 'success' | 'info' | 'warning', title: string, message: string) => void;
}> = ({ capability, notify }) => {
  const { items, loading, error, reload } = useRemoteList<IndustryInventoryBalance>('/api/merchant/inventory/balances?pageSize=300', 'balances');
  const [adjustTarget, setAdjustTarget] = useState<IndustryInventoryBalance | null>(null);
  const [quantity, setQuantity] = useState('0');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const lowStock = items.filter(item => item.availableQuantity <= 5);

  const submitAdjustment = async () => {
    if (!adjustTarget) return;
    const delta = Math.trunc(Number(quantity));
    if (!Number.isFinite(delta) || delta === 0 || !note.trim()) {
      setFormError('请填写非零调整数量与调整原因');
      return;
    }
    setBusy(true);
    setFormError('');
    try {
      await adjustIndustryInventory(adjustTarget, delta, note.trim());
      notify('success', '库存已调整', `${adjustTarget.product.styleNo} ${adjustTarget.sku} ${delta > 0 ? '+' : ''}${delta}`);
      setAdjustTarget(null);
      setQuantity('0');
      setNote('');
      await reload();
    } catch (caught) {
      setFormError(describeApiError(caught, '库存调整失败'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={capability.inventory.mode === 'store' ? '总部库存' : '库存管理'}
        description="库存以服务端 SKU 余额为准；调整会写入库存流水并受版本冲突保护。"
        actions={<Button variant="ghost" onClick={() => void reload()}><RefreshCcw className="h-4 w-4" />刷新</Button>}
      />
      {error ? <ErrorBanner message={error} /> : null}
      <SectionCard title="SKU 库存" description={`共 ${items.length} 条，低库存 ${lowStock.length} 条`}>
        {loading ? <LoadingBlock label="正在读取库存" /> : (
          <DataTable
            minWidth={860}
            rows={items}
            rowKey={item => item.id}
            emptyText="暂无库存记录。完成商品入库后会显示在这里。"
            columns={[
              { key: 'product', header: '商品', render: item => `${item.product.styleNo} · ${item.product.name}` },
              { key: 'sku', header: 'SKU', render: item => item.sku },
              { key: 'variant', header: '属性', render: item => [item.color, item.size].filter(Boolean).join(' / ') || '—' },
              { key: 'onHand', header: '在库', align: 'right', render: item => item.onHandQuantity },
              { key: 'reserved', header: '预留', align: 'right', render: item => item.reservedQuantity },
              { key: 'available', header: '可售', align: 'right', render: item => <span className={item.availableQuantity <= 5 ? 'font-bold text-amber-700' : 'font-semibold'}>{item.availableQuantity}</span> },
              {
                key: 'actions',
                header: '操作',
                render: item => <Button size="sm" variant="ghost" onClick={() => { setAdjustTarget(item); setFormError(''); }}>调整库存</Button>
              }
            ]}
          />
        )}
      </SectionCard>

      <Modal
        open={!!adjustTarget}
        title={adjustTarget ? `调整库存 · ${adjustTarget.sku}` : '调整库存'}
        onClose={() => setAdjustTarget(null)}
        footer={<><Button variant="ghost" onClick={() => setAdjustTarget(null)} disabled={busy}>取消</Button><Button variant="primary" busy={busy} onClick={() => void submitAdjustment()}>提交调整</Button></>}
      >
        <div className="space-y-3">
          {formError ? <ErrorBanner message={formError} /> : null}
          <p className="text-sm text-neutral-600">当前可售 {adjustTarget?.availableQuantity ?? 0}，填写正数入库、负数出库。</p>
          <FormField label="调整数量" required>
            <input className={inputClass} inputMode="numeric" value={quantity} onChange={event => setQuantity(event.target.value)} />
          </FormField>
          <FormField label="调整原因" required>
            <input className={inputClass} value={note} onChange={event => setNote(event.target.value)} placeholder="如到货入库、盘点差异" />
          </FormField>
        </div>
      </Modal>
    </div>
  );
};


import React, { useEffect, useRef, useState } from 'react';
import { Pencil, Plus, RefreshCw, X } from 'lucide-react';
import { ApiError, apiGet, apiPatch, apiPost } from '../../../../api/client';

type RestaurantStore = { id: string; code: string; name: string; city: string };
type RestaurantTable = {
  id: string;
  storeId: string;
  code: string;
  name: string;
  capacity: number;
  area: string;
  status: 'active' | 'inactive';
  version: number;
};
type TableDraft = { code: string; name: string; capacity: string; area: string };

const emptyDraft = (): TableDraft => ({ code: '', name: '', capacity: '2', area: '' });

function tableErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return error instanceof Error ? error.message : fallback;
  switch (error.code) {
    case 'RESTAURANT_TABLE_VERSION_CONFLICT':
      return '桌台资料已被其他员工更新，请检查最新信息后重试。';
    case 'RESTAURANT_TABLE_CODE_CONFLICT':
      return '该门店已存在此桌号，请更换桌号。';
    case 'IDEMPOTENCY_KEY_REUSED':
      return '请求状态不确定，请刷新桌台列表后确认结果。';
    case 'STORE_ACCESS_DENIED':
      return '你没有访问所选门店的权限。';
    case 'RESTAURANT_INDUSTRY_REQUIRED':
    case 'RESTAURANT_MODULE_DISABLED':
      return '当前账号没有餐饮工作区权限，请确认商家行业和审核状态。';
    default:
      return error.message || fallback;
  }
}

export const RestaurantTableWorkspace: React.FC = () => {
  const [stores, setStores] = useState<RestaurantStore[]>([]);
  const [storeId, setStoreId] = useState('');
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [draft, setDraft] = useState<TableDraft>(emptyDraft);
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null);
  const [editingDraft, setEditingDraft] = useState<Omit<TableDraft, 'code'>>({ name: '', capacity: '', area: '' });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loadingStores, setLoadingStores] = useState(true);
  const [loadingTables, setLoadingTables] = useState(false);
  const [busyTableId, setBusyTableId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const loadSequence = useRef(0);
  const createRequest = useRef<{ fingerprint: string; idempotencyKey: string } | null>(null);

  useEffect(() => {
    let active = true;
    apiGet<{ stores: RestaurantStore[] }>('/api/merchant/restaurant/table-stores')
      .then(result => {
        if (!active) return;
        setStores(result.stores);
        setStoreId(current => current || result.stores[0]?.id || '');
      })
      .catch(requestError => {
        if (active) setError(tableErrorMessage(requestError, '门店列表读取失败'));
      })
      .finally(() => {
        if (active) setLoadingStores(false);
      });
    return () => { active = false; };
  }, []);

  const reloadTables = async (targetStoreId: string) => {
    const sequence = ++loadSequence.current;
    setLoadingTables(true);
    setError('');
    try {
      const result = await apiGet<{ tables: RestaurantTable[] }>(
        `/api/merchant/restaurant/tables?storeId=${encodeURIComponent(targetStoreId)}`
      );
      if (sequence === loadSequence.current) setTables(result.tables);
    } catch (requestError) {
      if (sequence === loadSequence.current) {
        setTables([]);
        setError(tableErrorMessage(requestError, '桌台列表读取失败'));
      }
    } finally {
      if (sequence === loadSequence.current) setLoadingTables(false);
    }
  };

  useEffect(() => {
    if (storeId) void reloadTables(storeId);
  }, [storeId]);

  const createTable = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!storeId || busy) return;
    const payload = {
      storeId,
      code: draft.code,
      name: draft.name,
      capacity: Number(draft.capacity),
      area: draft.area
    };
    const fingerprint = JSON.stringify(payload);
    if (createRequest.current?.fingerprint !== fingerprint) {
      createRequest.current = { fingerprint, idempotencyKey: crypto.randomUUID() };
    }
    setBusy(true);
    setError('');
    try {
      await apiPost('/api/merchant/restaurant/tables', payload, undefined, {
        'Idempotency-Key': createRequest.current.idempotencyKey
      });
      createRequest.current = null;
      setDraft(emptyDraft());
      setShowCreateForm(false);
      await reloadTables(storeId);
    } catch (requestError) {
      setError(tableErrorMessage(requestError, '桌台创建失败'));
    } finally {
      setBusy(false);
    }
  };

  const saveTable = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingTable || busyTableId) return;
    setBusyTableId(editingTable.id);
    setError('');
    try {
      await apiPatch(`/api/merchant/restaurant/tables/${encodeURIComponent(editingTable.id)}`, {
        expectedVersion: editingTable.version,
        name: editingDraft.name,
        capacity: Number(editingDraft.capacity),
        area: editingDraft.area
      });
      setEditingTable(null);
      await reloadTables(storeId);
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.code === 'RESTAURANT_TABLE_VERSION_CONFLICT') {
        setEditingTable(null);
        await reloadTables(storeId);
      }
      setError(tableErrorMessage(requestError, '桌台保存失败，请刷新后重试'));
    } finally {
      setBusyTableId('');
    }
  };

  const toggleTableStatus = async (table: RestaurantTable) => {
    setBusyTableId(table.id);
    setError('');
    try {
      await apiPatch(`/api/merchant/restaurant/tables/${encodeURIComponent(table.id)}`, {
        expectedVersion: table.version,
        status: table.status === 'active' ? 'inactive' : 'active'
      });
      await reloadTables(storeId);
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.code === 'RESTAURANT_TABLE_VERSION_CONFLICT') {
        await reloadTables(storeId);
      }
      setError(tableErrorMessage(requestError, '桌台状态更新失败，请刷新后重试'));
    } finally {
      setBusyTableId('');
    }
  };

  const selectedStore = stores.find(store => store.id === storeId);

  return (
    <section className="space-y-5" aria-labelledby="restaurant-tables-title">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-neutral-200 pb-4">
        <div>
          <h2 id="restaurant-tables-title" className="text-xl font-semibold text-neutral-950">桌台管理</h2>
          <p className="mt-1 text-sm text-neutral-600">维护门店桌号与座位数。桌台目录不会创建订单或收款。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="restaurant-table-store">选择门店</label>
          <select
            id="restaurant-table-store"
            value={storeId}
            onChange={event => {
              setStoreId(event.target.value);
              setTables([]);
              setEditingTable(null);
            }}
            disabled={loadingStores || stores.length < 2}
            className="min-h-10 rounded-[var(--radius-ruda-input)] border border-neutral-200 bg-white px-3 text-sm text-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-500 disabled:bg-neutral-100"
          >
            {stores.map(store => <option key={store.id} value={store.id}>{store.name}{store.city ? ` · ${store.city}` : ''}</option>)}
          </select>
          <button
            type="button"
            onClick={() => storeId && void reloadTables(storeId)}
            disabled={!storeId || loadingTables}
            className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-ruda-control)] border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-500 disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loadingTables ? 'animate-spin' : ''}`} aria-hidden="true" />
            刷新
          </button>
          <button
            type="button"
            onClick={() => setShowCreateForm(value => !value)}
            disabled={!storeId}
            className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-ruda-control)] bg-neutral-950 px-3 text-sm font-semibold text-white hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 disabled:opacity-50"
          >
            {showCreateForm ? <X className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
            {showCreateForm ? '取消' : '新增桌台'}
          </button>
        </div>
      </header>

      {error && <p role="alert" className="rounded-[var(--radius-ruda-card)] border border-neutral-300 bg-neutral-100 px-4 py-3 text-sm text-neutral-800">{error}</p>}

      {!loadingStores && stores.length === 0 && (
        <div className="border-y border-neutral-200 py-8">
          <h3 className="text-base font-semibold text-neutral-900">暂无可用门店</h3>
          <p className="mt-1 text-sm text-neutral-600">请先在商家门店资料中创建并启用门店，再管理桌台。</p>
        </div>
      )}

      {showCreateForm && selectedStore && (
        <form onSubmit={event => void createTable(event)} className="grid gap-3 border-b border-neutral-200 pb-5 sm:grid-cols-2 xl:grid-cols-5">
          <label className="space-y-1 text-sm font-medium text-neutral-700">
            桌号
            <input autoComplete="off" required maxLength={32} disabled={busy} value={draft.code} onChange={event => setDraft(current => ({ ...current, code: event.target.value }))} placeholder="例如 A01" className="min-h-10 w-full rounded-[var(--radius-ruda-input)] border border-neutral-200 px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-500 disabled:bg-neutral-100" />
          </label>
          <label className="space-y-1 text-sm font-medium text-neutral-700">
            显示名称
            <input required maxLength={80} disabled={busy} value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} placeholder="例如 靠窗桌" className="min-h-10 w-full rounded-[var(--radius-ruda-input)] border border-neutral-200 px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-500 disabled:bg-neutral-100" />
          </label>
          <label className="space-y-1 text-sm font-medium text-neutral-700">
            座位数
            <input required type="number" min={1} max={40} step={1} disabled={busy} value={draft.capacity} onChange={event => setDraft(current => ({ ...current, capacity: event.target.value }))} className="min-h-10 w-full rounded-[var(--radius-ruda-input)] border border-neutral-200 px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-500 disabled:bg-neutral-100" />
          </label>
          <label className="space-y-1 text-sm font-medium text-neutral-700">
            区域（选填）
            <input maxLength={80} disabled={busy} value={draft.area} onChange={event => setDraft(current => ({ ...current, area: event.target.value }))} placeholder="例如 一层" className="min-h-10 w-full rounded-[var(--radius-ruda-input)] border border-neutral-200 px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-500 disabled:bg-neutral-100" />
          </label>
          <div className="flex items-end">
            <button type="submit" disabled={busy} className="min-h-10 w-full rounded-[var(--radius-ruda-control)] bg-neutral-950 px-4 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-wait disabled:opacity-60">
              {busy ? '保存中…' : '保存桌台'}
            </button>
          </div>
        </form>
      )}

      {loadingStores || loadingTables ? (
        <div role="status" className="space-y-3 py-4">
          <span className="sr-only">正在读取桌台</span>
          <div className="h-10 animate-pulse rounded-[var(--radius-ruda-card)] bg-neutral-100" />
          <div className="h-10 animate-pulse rounded-[var(--radius-ruda-card)] bg-neutral-100" />
        </div>
      ) : tables.length === 0 && stores.length > 0 ? (
        <div className="border-y border-neutral-200 py-8">
          <h3 className="text-base font-semibold text-neutral-900">该门店还没有桌台</h3>
          <p className="mt-1 text-sm text-neutral-600">新增桌号和座位数后，桌台资料会保存在当前门店。</p>
        </div>
      ) : (
        <ul className="divide-y divide-neutral-200" aria-label={`${selectedStore?.name ?? ''}桌台列表`}>
          {tables.map(table => (
            <li key={table.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
              {editingTable?.id === table.id ? (
                <form onSubmit={event => void saveTable(event)} className="col-span-full grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                  <label className="space-y-1 text-sm font-medium text-neutral-700">
                    显示名称
                    <input required maxLength={80} value={editingDraft.name} onChange={event => setEditingDraft(current => ({ ...current, name: event.target.value }))} className="min-h-10 w-full rounded-[var(--radius-ruda-input)] border border-neutral-200 px-3 text-sm" />
                  </label>
                  <label className="space-y-1 text-sm font-medium text-neutral-700">
                    座位数
                    <input required type="number" min={1} max={40} step={1} value={editingDraft.capacity} onChange={event => setEditingDraft(current => ({ ...current, capacity: event.target.value }))} className="min-h-10 w-full rounded-[var(--radius-ruda-input)] border border-neutral-200 px-3 text-sm" />
                  </label>
                  <label className="space-y-1 text-sm font-medium text-neutral-700">
                    区域
                    <input maxLength={80} value={editingDraft.area} onChange={event => setEditingDraft(current => ({ ...current, area: event.target.value }))} className="min-h-10 w-full rounded-[var(--radius-ruda-input)] border border-neutral-200 px-3 text-sm" />
                  </label>
                  <div className="flex gap-2">
                    <button type="submit" disabled={busyTableId === table.id} className="min-h-10 rounded-[var(--radius-ruda-control)] bg-neutral-950 px-3 text-sm font-semibold text-white disabled:opacity-50">保存</button>
                    <button type="button" onClick={() => setEditingTable(null)} className="min-h-10 rounded-[var(--radius-ruda-control)] border border-neutral-200 px-3 text-sm font-semibold text-neutral-700">取消</button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-950">{table.name}</p>
                    <p className="mt-1 text-sm text-neutral-600">桌号 {table.code}</p>
                  </div>
                  <p className="text-sm text-neutral-700">{table.capacity} 个座位</p>
                  <p className="text-sm text-neutral-600">{table.area || '未分区域'}</p>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <span className={`rounded-[var(--radius-ruda-tag)] px-2 py-1 text-xs font-medium ${table.status === 'active' ? 'bg-neutral-100 text-neutral-800' : 'bg-neutral-200 text-neutral-600'}`}>
                      {table.status === 'active' ? '启用' : '停用'}
                    </span>
                    <button type="button" aria-label={`编辑${table.name}`} onClick={() => {
                      setEditingTable(table);
                      setEditingDraft({ name: table.name, capacity: String(table.capacity), area: table.area });
                    }} className="inline-flex min-h-9 items-center gap-1.5 rounded-[var(--radius-ruda-control)] border border-neutral-200 px-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-500">
                      <Pencil className="h-4 w-4" aria-hidden="true" />编辑
                    </button>
                    <button type="button" disabled={busyTableId === table.id} onClick={() => void toggleTableStatus(table)} className="min-h-9 rounded-[var(--radius-ruda-control)] px-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-100 disabled:cursor-wait disabled:opacity-50">
                      {busyTableId === table.id ? '更新中…' : table.status === 'active' ? '停用' : '启用'}
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

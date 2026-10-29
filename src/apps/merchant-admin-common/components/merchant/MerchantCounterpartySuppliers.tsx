import React, { useEffect, useMemo, useState } from 'react';
import { Building2, ChevronLeft, ChevronRight, Plus, RefreshCw, Search, X } from 'lucide-react';
import { apiGet, apiPatch, apiPost } from '../../../../api/client';
import { useB2B } from '../../../../context/B2BContext';

type Supplier = {
  id: string;
  counterpartyId: string | null;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  country: string | null;
  leadTimeDays: number;
  status: string;
  notes: string | null;
  counterparty?: { companyName: string; city: string | null; address: string | null; vatNumber: string | null } | null;
  material?: Array<{ name: string; category: string; status: string }>;
};

type CounterpartyOption = {
  id: string;
  companyName: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  vatNumber: string | null;
  customerLink: { customerId: string; status: string } | null;
  supplier: { id: string; status: string } | null;
};

type SupplierPurchaseOrder = {
  id: string;
  purchaseOrderNo: string;
  createdAt: string;
  status: string;
  expectedAt: string | null;
  orderedAt: string | null;
  supplier: { id: string; name: string };
  items: Array<{ id: string; orderedQuantity: number; receivedQuantity: number }>;
  receipts: Array<{ id: string; receivedAt: string; items: Array<{ quantity: number }> }>;
};

type SupplierForm = {
  name: string;
  contactName: string;
  phone: string;
  email: string;
  country: string;
  city: string;
  address: string;
  vatNumber: string;
  leadTimeDays: string;
  notes: string;
};

const emptyForm: SupplierForm = {
  name: '',
  contactName: '',
  phone: '',
  email: '',
  country: '',
  city: '',
  address: '',
  vatNumber: '',
  leadTimeDays: '0',
  notes: ''
};

const supplierErrorText = (error: unknown) => error instanceof Error ? error.message : '供应商操作失败，请重试。';

export const MerchantCounterpartySuppliers: React.FC = () => {
  const { localizeCopy, addNotification } = useB2B();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [counterparties, setCounterparties] = useState<CounterpartyOption[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<SupplierPurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busySupplierId, setBusySupplierId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [counterpartyError, setCounterpartyError] = useState('');
  const [purchaseOrderError, setPurchaseOrderError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [form, setForm] = useState<SupplierForm>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [selectedCounterpartyId, setSelectedCounterpartyId] = useState('');

  const reload = async () => {
    setLoading(true);
    setError('');
    setCounterpartyError('');
    const supplierRequest = apiGet<{ success: true; suppliers: Supplier[] }>('/api/merchant/suppliers');
    const orderRequest = apiGet<{ success: true; purchaseOrders: SupplierPurchaseOrder[] }>('/api/merchant/purchase-orders');
    const counterpartyRequest = apiGet<{ success: true; counterparties: CounterpartyOption[] }>('/api/merchant/counterparties');
    const [supplierResult, orderResult, counterpartyResult] = await Promise.allSettled([supplierRequest, orderRequest, counterpartyRequest]);
    if (supplierResult.status === 'fulfilled') {
      setSuppliers(supplierResult.value.suppliers);
    } else {
      setError(supplierErrorText(supplierResult.reason));
      setSuppliers([]);
    }
    if (orderResult.status === 'fulfilled') {
      setPurchaseOrders(orderResult.value.purchaseOrders);
      setPurchaseOrderError('');
    } else {
      setPurchaseOrders([]);
      setPurchaseOrderError(supplierErrorText(orderResult.reason));
    }
    if (counterpartyResult.status === 'fulfilled') setCounterparties(counterpartyResult.value.counterparties);
    else setCounterpartyError(supplierErrorText(counterpartyResult.reason));
    setLoading(false);
  };

  useEffect(() => {
    void reload();
    const onMerchantDataChanged = (event: Event) => {
      const resources = (event as CustomEvent<{ resources?: unknown }>).detail?.resources;
      if (Array.isArray(resources) && resources.some(resource => resource === 'suppliers' || resource === 'purchase-orders')) {
        void reload();
      }
    };
    window.addEventListener('merchant-data-changed', onMerchantDataChanged);
    return () => window.removeEventListener('merchant-data-changed', onMerchantDataChanged);
  }, []);

  const filteredSuppliers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return suppliers.filter(supplier => {
      const matchesQuery = !normalizedQuery
        || `${supplier.name} ${supplier.contactName || ''} ${supplier.phone || ''} ${supplier.email || ''}`
          .toLocaleLowerCase()
          .includes(normalizedQuery);
      const matchesStatus = statusFilter === 'all' || supplier.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [query, statusFilter, suppliers]);

  const supplierOrders = (supplierId: string) => purchaseOrders
    .filter(order => order.supplier.id === supplierId)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

  const beginCreate = () => {
    setEditingSupplierId(null);
    setSelectedCounterpartyId('');
    setForm(emptyForm);
    setShowForm(true);
  };

  const beginEdit = (supplier: Supplier) => {
    setSelectedSupplier(null);
    setEditingSupplierId(supplier.id);
    setForm({
      name: supplier.name,
      contactName: supplier.contactName || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      country: supplier.country || '',
      city: supplier.counterparty?.city || '',
      address: supplier.counterparty?.address || '',
      vatNumber: supplier.counterparty?.vatNumber || '',
      leadTimeDays: String(supplier.leadTimeDays),
      notes: supplier.notes || ''
    });
    setShowForm(true);
  };

  const saveSupplier = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const normalizedName = form.name.trim().toLocaleLowerCase();
    const normalizedEmail = form.email.trim().toLocaleLowerCase();
    const normalizedVat = form.vatNumber.trim().toLocaleLowerCase();
    const likelyExistingCustomer = counterparties.some(item =>
      item.customerLink
      && !item.supplier
      && (
        item.companyName.trim().toLocaleLowerCase() === normalizedName
        || Boolean(normalizedEmail && item.email?.trim().toLocaleLowerCase() === normalizedEmail)
        || Boolean(normalizedVat && item.vatNumber?.trim().toLocaleLowerCase() === normalizedVat)
      )
    );
    if (counterpartyError && !window.confirm(localizeCopy(
      '无法检查现有客户单位，确认后将作为独立供应商创建。',
      'Impossibile verificare i clienti esistenti. Conferma per creare un fornitore separato.'
    ))) return;
    if (!selectedCounterpartyId && likelyExistingCustomer && !window.confirm(localizeCopy(
      '发现资料相似的客户单位，确认后可继续独立创建。',
      'Esiste un possibile cliente corrispondente. Conferma per creare un fornitore separato.'
    ))) return;
    setSaving(true);
    setError('');
    const payload = {
      ...form,
      name: form.name.trim(),
      contactName: form.contactName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      country: form.country.trim(),
      city: form.city.trim(),
      address: form.address.trim(),
      vatNumber: form.vatNumber.trim(),
      leadTimeDays: Number(form.leadTimeDays),
      notes: form.notes.trim()
    };
    if (!editingSupplierId && selectedCounterpartyId) Object.assign(payload, { counterpartyId: selectedCounterpartyId });
    try {
      const result = editingSupplierId
        ? await apiPatch<{ success: true; supplier: Supplier }>(`/api/merchant/suppliers/${encodeURIComponent(editingSupplierId)}`, payload)
        : await apiPost<{ success: true; supplier: Supplier }>('/api/merchant/suppliers', payload);
      setSuppliers(current => editingSupplierId
        ? current.map(supplier => supplier.id === result.supplier.id ? result.supplier : supplier)
        : [...current, result.supplier].sort((left, right) => left.name.localeCompare(right.name)));
      if (selectedCounterpartyId) {
        setCounterparties(current => current.map(item => item.id === selectedCounterpartyId
          ? { ...item, supplier: { id: result.supplier.id, status: result.supplier.status } }
          : item));
      }
      setSelectedSupplier(result.supplier);
      setShowForm(false);
      setEditingSupplierId(null);
      setForm(emptyForm);
      setSelectedCounterpartyId('');
      addNotification('success', editingSupplierId ? '供应商资料已更新' : '供应商已创建', result.supplier.name);
    } catch (requestError) {
      setError(supplierErrorText(requestError));
    } finally {
      setSaving(false);
    }
  };

  const toggleSupplier = async (supplier: Supplier) => {
    const status = supplier.status === 'active' ? 'suspended' : 'active';
    if (status === 'suspended' && !window.confirm(`停用供应商“${supplier.name}”？已有采购记录会保留。`)) return;
    setBusySupplierId(supplier.id);
    try {
      await apiPatch(`/api/merchant/suppliers/${encodeURIComponent(supplier.id)}/status`, { status });
      setSuppliers(current => current.map(item => item.id === supplier.id ? { ...item, status } : item));
      setSelectedSupplier(current => current?.id === supplier.id ? { ...current, status } : current);
      addNotification('success', status === 'active' ? '供应商已启用' : '供应商已停用', supplier.name);
    } catch (requestError) {
      setError(supplierErrorText(requestError));
    } finally {
      setBusySupplierId(null);
    }
  };

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between gap-2 px-1">
        <div>
          <h2 className="text-[15px] font-semibold text-neutral-900">{localizeCopy('供应商管理', 'Gestione fornitori')}</h2>
        </div>
        <button type="button" onClick={beginCreate} className="inline-flex h-9 shrink-0 items-center gap-1 rounded-xl bg-neutral-900 px-3 text-[11px] font-semibold text-white">
          <Plus className="h-3.5 w-3.5" />{localizeCopy('新增供应商', 'Nuovo fornitore')}
        </button>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2 rounded-2xl bg-white p-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <label className="relative min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder={localizeCopy('搜索供应商名称、联系人或电话', 'Cerca fornitore, contatto o telefono')}
            className="h-10 w-full rounded-xl bg-neutral-50 pl-9 pr-3 text-[12px] outline-none focus:ring-2 focus:ring-neutral-900/10"
          />
        </label>
        <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)} aria-label="供应商状态" className="h-10 max-w-[96px] rounded-xl bg-neutral-50 px-2 text-[10px] text-neutral-700 outline-none">
          <option value="all">{localizeCopy('全部状态', 'Tutti')}</option>
          <option value="active">{localizeCopy('正常使用', 'Attivi')}</option>
          <option value="suspended">{localizeCopy('已停用', 'Disattivati')}</option>
        </select>
        <button type="button" onClick={() => void reload()} disabled={loading} aria-label="刷新供应商" className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-100 text-neutral-600 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[11px] text-rose-800">{error}</div>}
      {purchaseOrderError && <p className="rounded-xl bg-amber-50 p-3 text-[10px] text-amber-800">{localizeCopy('无采购权限', 'Accesso acquisti negato')}</p>}

      {loading && suppliers.length === 0 ? (
        <div className="space-y-2" aria-label="加载供应商">
          {[0, 1, 2].map(item => <div key={item} className="h-20 animate-pulse rounded-2xl bg-white" />)}
        </div>
      ) : !error && filteredSuppliers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-200 bg-white px-4 py-8 text-center">
          <Building2 className="mx-auto h-6 w-6 text-neutral-400" />
          <p className="mt-2 text-[12px] font-semibold text-neutral-700">{query ? localizeCopy('无匹配供应商', 'Nessun fornitore trovato') : localizeCopy('暂无供应商', 'Nessun fornitore')}</p>
          {query
            ? <button type="button" onClick={() => setQuery('')} className="mt-2 text-[11px] font-semibold text-neutral-600">{localizeCopy('清除搜索', 'Cancella ricerca')}</button>
            : <button type="button" onClick={beginCreate} className="mt-3 inline-flex h-9 items-center gap-1 rounded-xl bg-neutral-900 px-3 text-[11px] font-semibold text-white"><Plus className="h-3.5 w-3.5" />{localizeCopy('新增供应商', 'Nuovo fornitore')}</button>}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredSuppliers.map(supplier => {
            const orders = supplierOrders(supplier.id);
            const latestOrder = orders[0];
            return (
              <article key={supplier.id} className="rounded-2xl bg-white p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <button type="button" onClick={() => setSelectedSupplier(supplier)} className="flex w-full items-start gap-3 text-left">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600"><Building2 className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <strong className="truncate text-[13px] font-semibold text-neutral-900">{supplier.name}</strong>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold ${supplier.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>
                        {supplier.status === 'active' ? localizeCopy('正常', 'Attivo') : localizeCopy('已停用', 'Disattivato')}
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-[11px] text-neutral-600">{supplier.contactName || localizeCopy('联系人未填写', 'Contatto non indicato')}{supplier.phone ? ` · ${supplier.phone}` : ''}</span>
                    <span className="mt-1 block text-[10px] text-neutral-400">
                      {orders.length} {localizeCopy('笔采购记录', 'ordini di acquisto')}
                      {latestOrder ? ` · ${localizeCopy('最近', 'Ultimo')}: ${new Date(latestOrder.createdAt).toLocaleDateString()}` : ''}
                    </span>
                    {supplier.material?.length ? <span className="mt-1 block truncate text-[10px] text-neutral-500">{[...new Set(supplier.material.filter(material => material.status === 'active').map(material => material.category))].join(' · ')}</span> : null}
                  </span>
                  <ChevronRight className="mt-3 h-4 w-4 shrink-0 text-neutral-400" />
                </button>
                <div className="mt-2 flex gap-2 border-t border-neutral-100 pt-2">
                  <button type="button" onClick={() => beginEdit(supplier)} className="min-h-9 flex-1 rounded-lg border border-neutral-200 text-[10px] font-semibold text-neutral-700">{localizeCopy('编辑资料', 'Modifica dati')}</button>
                  <button type="button" onClick={() => void toggleSupplier(supplier)} disabled={busySupplierId === supplier.id} className="min-h-9 flex-1 rounded-lg border border-neutral-200 text-[10px] font-semibold text-neutral-700 disabled:opacity-50">
                    {busySupplierId === supplier.id ? localizeCopy('处理中…', 'Attendere…') : supplier.status === 'active' ? localizeCopy('停用', 'Disattiva') : localizeCopy('启用', 'Attiva')}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {selectedSupplier && (
        <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/45 p-0 pb-[env(safe-area-inset-bottom)] sm:items-center sm:p-4" onClick={() => setSelectedSupplier(null)}>
          <section role="dialog" aria-modal="true" className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl sm:rounded-2xl" onClick={event => event.stopPropagation()}>
            <header className="flex items-center justify-between gap-2">
              <button type="button" onClick={() => setSelectedSupplier(null)} className="flex h-10 items-center gap-1 text-[11px] font-semibold text-neutral-600"><ChevronLeft className="h-4 w-4" />{localizeCopy('返回列表', 'Torna all’elenco')}</button>
              <button type="button" aria-label="关闭供应商详情" onClick={() => setSelectedSupplier(null)} className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100"><X className="h-4 w-4" /></button>
            </header>
            <div className="mt-2 flex items-start justify-between gap-3">
              <div><h3 className="break-words text-[17px] font-bold text-neutral-900">{selectedSupplier.name}</h3><p className="mt-1 text-[11px] text-neutral-500">{localizeCopy('供应商档案', 'Profilo fornitore')}</p></div>
              <button type="button" onClick={() => beginEdit(selectedSupplier)} className="h-9 shrink-0 rounded-lg border border-neutral-200 px-3 text-[10px] font-semibold">{localizeCopy('编辑', 'Modifica')}</button>
            </div>
            <dl className="mt-4 grid grid-cols-1 gap-2 text-[11px]">
              {[
                [localizeCopy('联系人', 'Contatto'), selectedSupplier.contactName],
                [localizeCopy('电话', 'Telefono'), selectedSupplier.phone],
                [localizeCopy('邮箱', 'Email'), selectedSupplier.email],
                [localizeCopy('国家 / 地区', 'Paese / area'), selectedSupplier.country],
                [localizeCopy('城市', 'Città'), selectedSupplier.counterparty?.city],
                [localizeCopy('公司地址', 'Indirizzo aziendale'), selectedSupplier.counterparty?.address],
                [localizeCopy('VAT / P.IVA', 'Partita IVA'), selectedSupplier.counterparty?.vatNumber],
                [localizeCopy('供货周期', 'Tempi di fornitura'), `${selectedSupplier.leadTimeDays} ${localizeCopy('天', 'giorni')}`],
                [localizeCopy('关联材料', 'Materiali forniti'), selectedSupplier.material?.filter(material => material.status === 'active').map(material => `${material.name} · ${material.category}`).join('、')],
                [localizeCopy('备注', 'Note'), selectedSupplier.notes]
              ].map(([label, value]) => value ? <div key={label} className="rounded-xl bg-neutral-50 p-3"><dt className="text-[10px] text-neutral-500">{label}</dt><dd className="mt-1 break-words text-neutral-800">{value}</dd></div> : null)}
            </dl>
            <section className="mt-5">
              <h4 className="text-[13px] font-semibold text-neutral-900">{localizeCopy('采购往来', 'Rapporti di acquisto')}</h4>
              {purchaseOrderError
                ? <p className="mt-2 text-[11px] text-amber-700">{localizeCopy('无权读取采购', 'Non hai accesso agli acquisti')}</p>
                : supplierOrders(selectedSupplier.id).length === 0
                  ? <p className="mt-2 rounded-xl bg-neutral-50 p-3 text-[11px] text-neutral-500">{localizeCopy('暂无采购记录', 'Nessun ordine di acquisto')}</p>
                  : <div className="mt-2 divide-y divide-neutral-100 rounded-xl border border-neutral-100">
                    {supplierOrders(selectedSupplier.id).map(order => (
                      <div key={order.id} className="p-3">
                        <div className="flex items-center justify-between gap-2"><strong className="text-[11px] text-neutral-800">{order.purchaseOrderNo}</strong><span className="text-[10px] text-neutral-500">{order.status}</span></div>
                        <p className="mt-1 text-[10px] text-neutral-500">{new Date(order.createdAt).toLocaleDateString()} · {order.items.length} {localizeCopy('项商品', 'articoli')}</p>
                        {order.receipts.map(receipt => <p key={receipt.id} className="mt-1 text-[10px] text-emerald-700">{localizeCopy('收货', 'Ricevuto')} {new Date(receipt.receivedAt).toLocaleDateString()} · {receipt.items.reduce((sum, item) => sum + item.quantity, 0)} {localizeCopy('件', 'unità')}</p>)}
                      </div>
                    ))}
                    <label className="col-span-2 text-[10px] font-semibold text-neutral-600">
                      {localizeCopy('公司地址', 'Indirizzo aziendale')}
                      <input value={form.address} maxLength={300} onChange={event => setForm(previous => ({ ...previous, address: event.target.value }))} className="mt-1 h-10 w-full rounded-xl bg-neutral-50 px-3 text-[12px] font-normal outline-none focus:ring-2 focus:ring-neutral-900/10" />
                    </label>
                  </div>}
            </section>
          </section>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-[76] flex items-end justify-center bg-black/45 p-0 pb-[env(safe-area-inset-bottom)] sm:items-center sm:p-4" onClick={() => setShowForm(false)}>
          <form onSubmit={event => void saveSupplier(event)} className="max-h-[92vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl sm:rounded-2xl" onClick={event => event.stopPropagation()}>
            <header className="flex items-start justify-between gap-2">
              <div><h3 className="text-[16px] font-bold text-neutral-900">{editingSupplierId ? localizeCopy('编辑供应商', 'Modifica fornitore') : localizeCopy('新增供应商', 'Nuovo fornitore')}</h3><div className="mt-1 flex flex-wrap gap-2 text-[10px] text-neutral-500"><span>{localizeCopy('资料仅用于采购', 'Solo per acquisti')}</span><span>{localizeCopy('不影响历史采购', 'Ordini storici invariati')}</span></div></div>
              <button type="button" onClick={() => setShowForm(false)} aria-label="关闭表单" className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100"><X className="h-4 w-4" /></button>
            </header>
            <div className="grid grid-cols-2 gap-2.5">
              {!editingSupplierId && (
                <label className="col-span-2 text-[10px] font-semibold text-neutral-600">
                  {localizeCopy('关联已有客户单位', 'Collega un cliente esistente')}
                  <select
                    value={selectedCounterpartyId}
                    onChange={event => {
                      const counterpartyId = event.target.value;
                      setSelectedCounterpartyId(counterpartyId);
                      const counterparty = counterparties.find(item => item.id === counterpartyId);
                      setForm(previous => counterparty
                        ? {
                            ...previous,
                            name: counterparty.companyName,
                            contactName: counterparty.contactName || '',
                            phone: counterparty.phone || '',
                            email: counterparty.email || '',
                            country: counterparty.country || '',
                            city: counterparty.city || '',
                            address: counterparty.address || '',
                            vatNumber: counterparty.vatNumber || ''
                          }
                        : { ...previous, name: '', contactName: '', phone: '', email: '', country: '', city: '', address: '', vatNumber: '' });
                    }}
                    className="mt-1 h-10 w-full rounded-xl bg-neutral-50 px-3 text-[12px] font-normal outline-none"
                  >
                    <option value="">{localizeCopy('新建供应商资料', 'Nuovo profilo fornitore')}</option>
                    {counterparties.filter(item => item.customerLink && !item.supplier).map(item => (
                      <option key={item.id} value={item.id}>{item.companyName}</option>
                    ))}
                  </select>
                </label>
              )}
              {!editingSupplierId && counterpartyError && (
                <p role="alert" className="col-span-2 rounded-lg bg-amber-50 p-2.5 text-[10px] text-amber-800">
                  {localizeCopy('无法读取现有客户单位，创建前需确认独立建档。', 'Impossibile leggere i clienti esistenti; conferma prima di creare un profilo separato.')}
                </p>
              )}
              {([
                ['name', localizeCopy('供应商名称 *', 'Nome fornitore *')],
                ['contactName', localizeCopy('联系人', 'Contatto')],
                ['phone', localizeCopy('电话', 'Telefono')],
                ['email', localizeCopy('邮箱', 'Email')],
                ['country', localizeCopy('国家 / 地区', 'Paese / area')],
                ['city', localizeCopy('城市', 'Città')],
                ['vatNumber', localizeCopy('VAT / P.IVA', 'Partita IVA')],
                ['leadTimeDays', localizeCopy('供货周期（天）', 'Tempi (giorni)')]
              ] as const).map(([key, label]) => (
                <label key={key} className="text-[10px] font-semibold text-neutral-600">
                  {label}
                  <input
                    required={key === 'name'}
                    type={key === 'email' ? 'email' : key === 'leadTimeDays' ? 'number' : 'text'}
                    min={key === 'leadTimeDays' ? 0 : undefined}
                    max={key === 'leadTimeDays' ? 3650 : undefined}
                    maxLength={key === 'name' ? 160 : key === 'contactName' ? 120 : key === 'phone' ? 80 : key === 'email' ? 254 : 80}
                    value={form[key]}
                    onChange={event => setForm(previous => ({ ...previous, [key]: event.target.value }))}
                    className="mt-1 h-10 w-full rounded-xl bg-neutral-50 px-3 text-[12px] font-normal outline-none focus:ring-2 focus:ring-neutral-900/10"
                  />
                </label>
              ))}
              <label className="col-span-2 text-[10px] font-semibold text-neutral-600">{localizeCopy('备注', 'Note')}<textarea value={form.notes} maxLength={2000} onChange={event => setForm(previous => ({ ...previous, notes: event.target.value }))} className="mt-1 min-h-20 w-full rounded-xl bg-neutral-50 p-3 text-[12px] font-normal outline-none focus:ring-2 focus:ring-neutral-900/10" /></label>
            </div>
            {error && <p role="alert" className="rounded-lg bg-rose-50 p-2.5 text-[10px] text-rose-700">{error}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="h-11 rounded-xl border border-neutral-200 text-[12px] font-semibold text-neutral-700">{localizeCopy('取消', 'Annulla')}</button>
              <button type="submit" disabled={saving} className="h-11 rounded-xl bg-neutral-900 text-[12px] font-semibold text-white disabled:opacity-50">{saving ? localizeCopy('保存中…', 'Salvataggio…') : localizeCopy('保存供应商', 'Salva fornitore')}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};

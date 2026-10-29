/**
 * 行业供应商区段。复用 /api/merchant/suppliers 与采购工作区。
 */
import React, { useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import { createIndustrySupplier, describeApiError, useRemoteList, type IndustrySupplier } from './data';
import {
  Button,
  DataTable,
  ErrorBanner,
  FormField,
  Modal,
  PageHeader,
  SearchInput,
  SectionCard,
  StatusPill,
  inputClass
} from './kit';

export const IndustrySuppliersSection: React.FC<{
  notify: (type: 'success' | 'info' | 'warning', title: string, message: string) => void;
}> = ({ notify }) => {
  const { items, loading, error, reload } = useRemoteList<IndustrySupplier>('/api/merchant/suppliers', 'suppliers');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({ name: '', contactName: '', phone: '', email: '', country: '', leadTimeDays: '0', notes: '' });
  const filtered = items.filter(item => !query.trim() || [item.name, item.contactName, item.email]
    .some(value => String(value || '').toLowerCase().includes(query.trim().toLowerCase())));

  const submit = async () => {
    if (!form.name.trim()) {
      setFormError('供应商名称必填');
      return;
    }
    setBusy(true);
    setFormError('');
    try {
      await createIndustrySupplier({ ...form, leadTimeDays: Number(form.leadTimeDays) || 0 });
      notify('success', '供应商已创建', form.name);
      setOpen(false);
      setForm({ name: '', contactName: '', phone: '', email: '', country: '', leadTimeDays: '0', notes: '' });
      await reload();
    } catch (caught) {
      setFormError(describeApiError(caught, '供应商创建失败'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="供应商管理"
        description={`共 ${items.length} 家供应商；采购单与收货使用同一供应商档案。`}
        actions={<><Button variant="ghost" onClick={() => void reload()}><RefreshCcw className="h-4 w-4" />刷新</Button><Button variant="primary" onClick={() => setOpen(true)}>新增供应商</Button></>}
      />
      {error ? <ErrorBanner message={error} /> : null}
      <SectionCard
        title="供应商列表"
        description={loading ? '正在读取供应商…' : undefined}
        actions={<SearchInput value={query} onChange={setQuery} placeholder="搜索供应商或联系人" />}
      >
        <DataTable
          minWidth={820}
          rows={filtered}
          rowKey={supplier => supplier.id}
          emptyText={loading ? '正在读取供应商…' : '暂无供应商。'}
          columns={[
            { key: 'name', header: '供应商', render: supplier => <span className="font-semibold text-neutral-950">{supplier.name}</span> },
            { key: 'contact', header: '联系人', render: supplier => supplier.contactName || '—' },
            { key: 'phone', header: '电话', render: supplier => supplier.phone || '—' },
            { key: 'country', header: '国家', render: supplier => supplier.country || '—' },
            { key: 'lead', header: '交期(天)', align: 'right', render: supplier => supplier.leadTimeDays },
            { key: 'status', header: '状态', render: supplier => <StatusPill tone={supplier.status === 'active' ? 'success' : 'warning'}>{supplier.status === 'active' ? '合作中' : '已暂停'}</StatusPill> }
          ]}
        />
      </SectionCard>

      <Modal
        open={open}
        title="新增供应商"
        onClose={() => setOpen(false)}
        footer={<><Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>取消</Button><Button variant="primary" busy={busy} onClick={() => void submit()}>保存供应商</Button></>}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {formError ? <div className="sm:col-span-2"><ErrorBanner message={formError} /></div> : null}
          <FormField label="供应商名称" required><input className={inputClass} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></FormField>
          <FormField label="联系人"><input className={inputClass} value={form.contactName} onChange={event => setForm({ ...form, contactName: event.target.value })} /></FormField>
          <FormField label="电话"><input className={inputClass} value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /></FormField>
          <FormField label="邮箱"><input className={inputClass} value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></FormField>
          <FormField label="国家"><input className={inputClass} value={form.country} onChange={event => setForm({ ...form, country: event.target.value })} /></FormField>
          <FormField label="交期(天)"><input className={inputClass} inputMode="numeric" value={form.leadTimeDays} onChange={event => setForm({ ...form, leadTimeDays: event.target.value })} /></FormField>
        </div>
      </Modal>
    </div>
  );
};

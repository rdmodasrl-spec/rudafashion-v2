/**
 * 行业客户区段。客户数据来自 B2B 上下文（同一 /api/merchant/customers 权威源）。
 */
import React, { useMemo, useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import { apiPost } from '../../../api/client';
import type { WholesaleCustomer } from '../../../types/b2b';
import { describeApiError } from './data';
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

const CUSTOMER_BUSINESS_TYPES = ['Boutique', 'Retail Store', 'Online Store', 'Department Store', 'Wholesale Buyer', 'Distributor', 'Brand', 'Stylist / Atelier', 'Other'];

export const IndustryCustomersSection: React.FC<{
  customers: WholesaleCustomer[];
  onRefresh: () => void;
  notify: (type: 'success' | 'info' | 'warning', title: string, message: string) => void;
}> = ({ customers, onRefresh, notify }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    companyName: '',
    contactPerson: '',
    phone: '',
    email: '',
    country: 'Italy',
    city: '',
    address: '',
    businessType: 'Boutique',
    merchantNotes: ''
  });

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return customers;
    return customers.filter(customer => [customer.companyName, customer.contactPerson, customer.email, customer.phone]
      .some(value => String(value || '').toLowerCase().includes(keyword)));
  }, [customers, query]);

  const submit = async () => {
    if (!form.companyName.trim() || !form.phone.trim()) {
      setError('公司名称与联系电话必填');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiPost('/api/merchant/customers', form);
      notify('success', '客户已创建', form.companyName);
      setOpen(false);
      setForm({ companyName: '', contactPerson: '', phone: '', email: '', country: 'Italy', city: '', address: '', businessType: 'Boutique', merchantNotes: '' });
      onRefresh();
    } catch (caught) {
      setError(describeApiError(caught, '客户创建失败'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="客户管理"
        description={`共 ${customers.length} 位客户；只显示与本商家有订单或授权关系的客户。`}
        actions={<><Button variant="ghost" onClick={onRefresh}><RefreshCcw className="h-4 w-4" />刷新</Button><Button variant="primary" onClick={() => setOpen(true)}>新增客户</Button></>}
      />
      {error ? <ErrorBanner message={error} onDismiss={() => setError('')} /> : null}
      <SectionCard title="客户列表" actions={<SearchInput value={query} onChange={setQuery} placeholder="搜索公司、联系人或电话" />}>
        <DataTable
          minWidth={820}
          rows={filtered}
          rowKey={customer => customer.id}
          emptyText="暂无客户。客户下单或手动新增后会显示在这里。"
          columns={[
            { key: 'company', header: '公司', render: customer => <span className="font-semibold text-neutral-950">{customer.companyName}</span> },
            { key: 'contact', header: '联系人', render: customer => customer.contactPerson || '—' },
            { key: 'phone', header: '电话', render: customer => customer.phone || '—' },
            { key: 'email', header: '邮箱', render: customer => customer.email || '—' },
            { key: 'level', header: '等级', render: customer => <StatusPill>{customer.customerLevel || customer.tier || 'standard'}</StatusPill> },
            { key: 'credit', header: '信用额度', align: 'right', render: customer => Number(customer.creditLimit || 0).toFixed(2) }
          ]}
        />
      </SectionCard>

      <Modal
        open={open}
        title="新增客户"
        onClose={() => setOpen(false)}
        wide
        footer={<><Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>取消</Button><Button variant="primary" busy={busy} onClick={() => void submit()}>保存客户</Button></>}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {error ? <div className="sm:col-span-2"><ErrorBanner message={error} /></div> : null}
          <FormField label="公司名称" required><input className={inputClass} value={form.companyName} onChange={event => setForm({ ...form, companyName: event.target.value })} /></FormField>
          <FormField label="联系人"><input className={inputClass} value={form.contactPerson} onChange={event => setForm({ ...form, contactPerson: event.target.value })} /></FormField>
          <FormField label="联系电话" required><input className={inputClass} value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /></FormField>
          <FormField label="邮箱"><input className={inputClass} value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></FormField>
          <FormField label="国家"><input className={inputClass} value={form.country} onChange={event => setForm({ ...form, country: event.target.value })} /></FormField>
          <FormField label="城市"><input className={inputClass} value={form.city} onChange={event => setForm({ ...form, city: event.target.value })} /></FormField>
          <FormField label="地址"><input className={inputClass} value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} /></FormField>
          <FormField label="客户类型">
            <select className={inputClass} value={form.businessType} onChange={event => setForm({ ...form, businessType: event.target.value })}>
              {CUSTOMER_BUSINESS_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
          </FormField>
          <div className="sm:col-span-2">
            <FormField label="备注"><input className={inputClass} value={form.merchantNotes} onChange={event => setForm({ ...form, merchantNotes: event.target.value })} /></FormField>
          </div>
        </div>
      </Modal>
    </div>
  );
};

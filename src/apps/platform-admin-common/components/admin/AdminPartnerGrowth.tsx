import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Copy, Link2, Plus, RefreshCw, Users, Wallet } from 'lucide-react';
import { apiGet, apiPatch, apiPost } from '../../../../api/client';
import { partnerCampaignChannelOptions } from '../../../../shared/partnerCampaignChannels';
import { AdminPageHeader } from './AdminPageHeader';

type PartnerRole = 'agent' | 'city_agent' | 'partner';
type PartnerStatus = 'pending' | 'active' | 'paused' | 'disabled';
type PartnerRecord = {
  id: string;
  partnerCode: string;
  role: PartnerRole;
  status: PartnerStatus;
  name: string;
  email: string;
  country: string;
  city: string;
  commissionRate: number | string;
  cityCommissionRate: number | string;
  partnerCommissionRate: number | string;
  parent?: { id: string; partnerCode: string; name: string; role: PartnerRole } | null;
  account?: { email: string; lastLoginAt: string | null } | null;
  _count: { referrals: number; children: number; campaigns: number };
};
type CommissionEntry = {
  id: string;
  entryType: 'commission' | 'reversal';
  basisAmount: number | string;
  amount: number | string;
  effectiveAmount: number | string;
  rate: number | string;
  status: string;
  role: PartnerRole;
  createdAt: string;
  partner: { partnerCode: string; name: string };
  order: { orderNo: string; paymentStatus: string; refundStatus: string };
  referral: { customer: { companyName: string } };
};
type Overview = {
  partners: Record<string, Record<string, number>>;
  referredCustomers: number;
  paidOrders: number;
  paidSales: number;
  commissions: Record<string, number>;
};

const roleLabel: Record<PartnerRole, string> = {
  agent: '代理',
  city_agent: '城市代理',
  partner: '合伙人'
};
const statusLabel: Record<PartnerStatus, string> = {
  pending: '待审核',
  active: '正常',
  paused: '暂停',
  disabled: '禁用'
};
const roleRate = (partner: PartnerRecord) => Number(
  partner.role === 'agent' ? partner.commissionRate
    : partner.role === 'city_agent' ? partner.cityCommissionRate
      : partner.partnerCommissionRate
);

export const AdminPartnerGrowth: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const [tab, setTab] = useState<'overview' | 'partners' | 'commissions'>('overview');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [partners, setPartners] = useState<PartnerRecord[]>([]);
  const [entries, setEntries] = useState<CommissionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [campaignTarget, setCampaignTarget] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [campaignChannel, setCampaignChannel] = useState('instagram');
  const [campaignUrl, setCampaignUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    role: 'agent' as PartnerRole,
    name: '',
    email: '',
    password: '',
    country: '',
    city: '',
    parentId: '',
    commissionRate: '0'
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [overviewResult, partnerResult, commissionResult] = await Promise.all([
        apiGet<{ success: true } & Overview>('/api/admin/partners/overview'),
        apiGet<{ partners: PartnerRecord[] }>('/api/admin/partners'),
        apiGet<{ entries: CommissionEntry[] }>('/api/admin/partners/commissions')
      ]);
      setOverview(overviewResult);
      setPartners(partnerResult.partners);
      setEntries(commissionResult.entries);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '代理系统数据读取失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const parentOptions = useMemo(() => partners.filter(partner => partner.status === 'active' && (
    form.role === 'city_agent'
      ? partner.role === 'partner'
      : form.role === 'agent'
        ? partner.role === 'city_agent'
        : false
  )), [form.role, partners]);

  const submitPartner = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiPost('/api/admin/partners', {
        ...form,
        parentId: form.parentId || null,
        commissionRate: Number(form.commissionRate),
        status: 'pending'
      });
      setForm({ role: 'agent', name: '', email: '', password: '', country: '', city: '', parentId: '', commissionRate: '0' });
      await load();
      setTab('partners');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '代理账号创建失败');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (partner: PartnerRecord) => {
    const next: PartnerStatus = partner.status === 'active' ? 'paused' : 'active';
    setSaving(true);
    setError('');
    try {
      await apiPatch(`/api/admin/partners/${encodeURIComponent(partner.id)}/status`, { status: next });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '代理状态更新失败');
    } finally {
      setSaving(false);
    }
  };

  const updateRate = async (partner: PartnerRecord) => {
    const input = window.prompt(`设置 ${partner.partnerCode} 的佣金比例（0–100%）`, String(roleRate(partner)));
    if (input === null) return;
    const rate = Number(input);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      setError('佣金比例必须是 0 到 100 之间的数字');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await apiPatch(`/api/admin/partners/${encodeURIComponent(partner.id)}/commission-rate`, { rate });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '佣金比例更新失败');
    } finally {
      setSaving(false);
    }
  };

  const createCampaign = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!campaignTarget) return;
    setSaving(true);
    setError('');
    setCampaignUrl('');
    try {
      const result = await apiPost<{ url: string }>(
        `/api/admin/partners/${encodeURIComponent(campaignTarget)}/campaigns`,
        { name: campaignName, channel: campaignChannel }
      );
      setCampaignUrl(result.url);
      setCampaignName('');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '推广链接创建失败');
    } finally {
      setSaving(false);
    }
  };

  const approveCommission = async (entryId: string) => {
    setSaving(true);
    setError('');
    try {
      await apiPost(`/api/admin/partners/commissions/${encodeURIComponent(entryId)}/approve`, {});
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '佣金审核失败');
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(campaignUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '复制失败，请检查浏览器剪贴板权限');
    }
  };

  const metricCards = [
    { label: '总代理', value: partners.length, icon: Users },
    { label: '有效商家归属', value: overview?.referredCustomers ?? 0, icon: BadgeCheck },
    { label: '归属已付款订单', value: overview?.paidOrders ?? 0, icon: Link2 },
    { label: '已付款销售额', value: `€${Number(overview?.paidSales || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, icon: Wallet },
    { label: '未结佣金净额', value: `€${Number((overview?.commissions.pending || 0) + (overview?.commissions.approved || 0) + (overview?.commissions.available || 0)).toFixed(2)}`, icon: Wallet },
    { label: '已支付佣金净额', value: `€${Number(overview?.commissions.paid || 0).toFixed(2)}`, icon: BadgeCheck }
  ];

  const refreshButton = (
    <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-9 items-center gap-2 border border-neutral-300 bg-white px-3 text-xs font-semibold text-neutral-700">
      <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />刷新
    </button>
  );

  return (
    <section className="space-y-5">
      {embedded
        ? <div className="flex justify-end">{refreshButton}</div>
        : <AdminPageHeader title="代理网络" actions={refreshButton} />}

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">{error}</div>}

      <nav className="flex gap-2 border-b border-neutral-200">
        {([
          ['overview', '经营概览'],
          ['partners', '代理管理'],
          ['commissions', '佣金管理']
        ] as const).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={`min-h-10 border-b-2 px-3 text-xs font-semibold ${tab === key ? 'border-neutral-950 text-neutral-950' : 'border-transparent text-neutral-500'}`}>{label}</button>
        ))}
      </nav>

      {tab === 'overview' && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {metricCards.map(metric => {
            const Icon = metric.icon;
            return <article key={metric.label} className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-500">{metric.label}<Icon className="h-4 w-4" /></div>
              <div className="mt-2 text-xl font-bold text-neutral-950">{loading ? '—' : metric.value}</div>
            </article>;
          })}
        </div>
      )}

      {tab === 'partners' && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(20rem,0.7fr)]">
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-xs">
                <thead className="bg-neutral-50 text-[10px] uppercase tracking-wide text-neutral-500">
                  <tr>{['代理编号', '姓名 / 登录邮箱', '角色', '城市', '上级', '客户', '佣金', '状态', '操作'].map(label => <th key={label} className="px-3 py-3 font-semibold">{label}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {partners.map(partner => <tr key={partner.id}>
                    <td className="px-3 py-3 font-mono font-semibold">{partner.partnerCode}</td>
                    <td className="px-3 py-3"><div className="font-semibold text-neutral-900">{partner.name}</div><div className="mt-1 text-[10px] text-neutral-500">{partner.account?.email || partner.email}</div></td>
                    <td className="px-3 py-3">{roleLabel[partner.role]}</td>
                    <td className="px-3 py-3">{[partner.city, partner.country].filter(Boolean).join(', ') || '—'}</td>
                    <td className="px-3 py-3">{partner.parent ? `${partner.parent.partnerCode} · ${partner.parent.name}` : '—'}</td>
                    <td className="px-3 py-3">{partner._count.referrals}</td>
                    <td className="px-3 py-3">{roleRate(partner)}%</td>
                    <td className="px-3 py-3">{statusLabel[partner.status]}</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2">
                        <button type="button" disabled={saving} onClick={() => void updateRate(partner)} className="font-semibold underline">佣金</button>
                        {partner.status !== 'disabled' && <button type="button" disabled={saving} onClick={() => void setStatus(partner)} className="font-semibold underline">{partner.status === 'active' ? '暂停' : '启用'}</button>}
                        {partner.status === 'active' && <button type="button" onClick={() => setCampaignTarget(partner.id)} className="font-semibold underline">链接</button>}
                      </div>
                    </td>
                  </tr>)}
                  {!partners.length && <tr><td colSpan={9} className="px-4 py-10 text-center text-neutral-500">{loading ? '读取中…' : '还没有代理账户'}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-5">
            <form onSubmit={submitPartner} className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
              <h2 className="flex items-center gap-2 text-sm font-bold"><Plus className="h-4 w-4" />创建代理账号</h2>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] font-semibold text-neutral-600">角色<select value={form.role} onChange={event => setForm(current => ({ ...current, role: event.target.value as PartnerRole, parentId: '' }))} className="mt-1 h-10 w-full border border-neutral-300 bg-white px-2 text-xs">{Object.entries(roleLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
                <label className="text-[10px] font-semibold text-neutral-600">佣金比例 (%)<input required type="number" min="0" max="100" step="0.01" value={form.commissionRate} onChange={event => setForm(current => ({ ...current, commissionRate: event.target.value }))} className="mt-1 h-10 w-full border border-neutral-300 px-2 text-xs" /></label>
              </div>
              <label className="block text-[10px] font-semibold text-neutral-600">姓名<input required maxLength={120} value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} className="mt-1 h-10 w-full border border-neutral-300 px-3 text-xs" /></label>
              <label className="block text-[10px] font-semibold text-neutral-600">登录邮箱<input required type="email" maxLength={254} value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} className="mt-1 h-10 w-full border border-neutral-300 px-3 text-xs" /></label>
              <label className="block text-[10px] font-semibold text-neutral-600">初始密码（至少 12 位）<input required type="password" minLength={12} autoComplete="new-password" value={form.password} onChange={event => setForm(current => ({ ...current, password: event.target.value }))} className="mt-1 h-10 w-full border border-neutral-300 px-3 text-xs" /></label>
              {form.role !== 'partner' && <label className="block text-[10px] font-semibold text-neutral-600">上级{parentOptions.length ? '' : '（暂无符合角色的活跃上级）'}<select required value={form.parentId} onChange={event => setForm(current => ({ ...current, parentId: event.target.value }))} className="mt-1 h-10 w-full border border-neutral-300 bg-white px-2 text-xs"><option value="">选择上级</option>{parentOptions.map(parent => <option key={parent.id} value={parent.id}>{parent.partnerCode} · {parent.name}</option>)}</select></label>}
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] font-semibold text-neutral-600">国家<input maxLength={80} value={form.country} onChange={event => setForm(current => ({ ...current, country: event.target.value }))} className="mt-1 h-10 w-full border border-neutral-300 px-2 text-xs" /></label>
                <label className="text-[10px] font-semibold text-neutral-600">城市<input maxLength={100} value={form.city} onChange={event => setForm(current => ({ ...current, city: event.target.value }))} className="mt-1 h-10 w-full border border-neutral-300 px-2 text-xs" /></label>
              </div>
              <button disabled={saving || (form.role !== 'partner' && !parentOptions.length)} className="min-h-10 w-full bg-neutral-950 px-4 text-xs font-semibold text-white disabled:opacity-50">{saving ? '保存中…' : '创建待审核代理'}</button>
              <p className="text-[10px] leading-4 text-neutral-500">账号与代理档案同时创建；初始密码通过代理登录入口使用。启用状态仅由管理员修改。</p>
            </form>

            <form onSubmit={createCampaign} className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
              <h2 className="text-sm font-bold">创建推广链接</h2>
              <label className="block text-[10px] font-semibold text-neutral-600">代理<select required value={campaignTarget} onChange={event => setCampaignTarget(event.target.value)} className="mt-1 h-10 w-full border border-neutral-300 bg-white px-2 text-xs"><option value="">选择正常代理</option>{partners.filter(partner => partner.status === 'active').map(partner => <option key={partner.id} value={partner.id}>{partner.partnerCode} · {partner.name}</option>)}</select></label>
              <label className="block text-[10px] font-semibold text-neutral-600">推广名称<input required maxLength={100} value={campaignName} onChange={event => setCampaignName(event.target.value)} className="mt-1 h-10 w-full border border-neutral-300 px-3 text-xs" placeholder="秋季推广活动" /></label>
              <label className="block text-[10px] font-semibold text-neutral-600">渠道<select value={campaignChannel} onChange={event => setCampaignChannel(event.target.value)} className="mt-1 h-10 w-full border border-neutral-300 bg-white px-2 text-xs">{partnerCampaignChannelOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <button disabled={saving || !campaignTarget} className="min-h-10 w-full border border-neutral-900 px-4 text-xs font-semibold disabled:opacity-50">{saving ? '创建中…' : '生成链接'}</button>
              {campaignUrl && <div className="flex items-center gap-2 rounded-lg bg-neutral-50 p-2"><code className="min-w-0 flex-1 break-all text-[10px]">{campaignUrl}</code><button type="button" aria-label="复制链接" onClick={() => void copyLink()} className="shrink-0 p-2"><Copy className="h-4 w-4" /></button><span className="sr-only" aria-live="polite">{copied ? '链接已复制' : ''}</span></div>}
            </form>
          </div>
        </div>
      )}

      {tab === 'commissions' && (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-xs">
              <thead className="bg-neutral-50 text-[10px] text-neutral-500"><tr>{['类型', '时间', '代理', '订单', '客户', '收入基数', '佣金率', '金额', '状态', '审核'].map(label => <th key={label} className="px-3 py-3 font-semibold">{label}</th>)}</tr></thead>
              <tbody className="divide-y divide-neutral-100">
                {entries.map(entry => <tr key={entry.id}>
                  <td className="px-3 py-3">{entry.entryType === 'reversal' ? '退款冲回' : '佣金'}</td>
                  <td className="px-3 py-3">{new Date(entry.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-3">{entry.partner.partnerCode} · {entry.partner.name}</td>
                  <td className="px-3 py-3">{entry.order.orderNo}</td>
                  <td className="px-3 py-3">{entry.referral.customer.companyName}</td>
                  <td className="px-3 py-3">€{Number(entry.basisAmount).toFixed(2)}</td>
                  <td className="px-3 py-3">{entry.rate}%</td>
                  <td className={`px-3 py-3 font-semibold ${Number(entry.amount) < 0 ? 'text-red-700' : ''}`}>€{Number(entry.amount).toFixed(2)}</td>
                  <td className="px-3 py-3">{entry.status}</td>
                  <td className="px-3 py-3">{entry.entryType === 'commission' && entry.status === 'pending'
                    && ['paid', 'partially_refunded'].includes(entry.order.paymentStatus)
                    && ['none', 'partially_refunded'].includes(entry.order.refundStatus)
                    && Number(entry.effectiveAmount) > 0
                    ? <button type="button" disabled={saving} onClick={() => void approveCommission(entry.id)} className="font-semibold underline">批准</button>
                    : '—'}</td>
                </tr>)}
                {!entries.length && <tr><td colSpan={10} className="px-4 py-10 text-center text-neutral-500">{loading ? '读取中…' : '暂无佣金记录'}</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="border-t border-neutral-100 px-4 py-3 text-[10px] leading-4 text-neutral-500">退款按成功退款金额比例生成不可变负向佣金记录；部分退款后的净佣金仍须在无未完成退款时审核。</p>
        </div>
      )}
    </section>
  );
};

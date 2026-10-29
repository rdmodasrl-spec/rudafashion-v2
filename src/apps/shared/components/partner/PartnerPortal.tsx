import React, { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../../../api/client';
import { partnerCampaignChannelOptions } from '../../../../shared/partnerCampaignChannels';

type PartnerProfile = {
  partnerCode: string;
  name: string;
  role: string;
  status: string;
  country: string;
  city: string;
};
type PartnerStats = {
  customers: number;
  activeCustomers: number;
  newCustomersThisMonth: number;
  paidSales: number;
  commissions: number;
  commissionsThisMonth: number;
  pendingCommissions: number;
  activeCampaigns: number;
};
type PartnerCustomer = {
  registeredAt: string;
  firstPaidAt: string | null;
  campaign: { name: string; channel: string } | null;
  customer: {
    companyName: string;
    contactPerson: string;
    email: string;
    phone: string;
    country: string;
    city: string;
    status: string;
    ordersCount: number;
  };
};
type PartnerCampaign = {
  id: string;
  campaignCode: string;
  name: string;
  channel: string;
  status: string;
  url: string;
  _count: { clicks: number; referrals: number };
};
type CommissionEntry = {
  id: string;
  entryType: 'commission' | 'reversal';
  basisAmount: number | string;
  amount: number | string;
  rate: number | string;
  status: string;
  createdAt: string;
  order: { orderNo: string; createdAt: string; paymentStatus: string };
  referral: { customer: { companyName: string } };
};

const roleLabel: Record<string, string> = {
  agent: '代理',
  city_agent: '城市代理',
  partner: '合伙人'
};

export default function PartnerPortal() {
  const [profile, setProfile] = useState<PartnerProfile | null>(null);
  const [stats, setStats] = useState<PartnerStats | null>(null);
  const [customers, setCustomers] = useState<PartnerCustomer[]>([]);
  const [campaigns, setCampaigns] = useState<PartnerCampaign[]>([]);
  const [commissions, setCommissions] = useState<CommissionEntry[]>([]);
  const [tab, setTab] = useState<'overview' | 'customers' | 'campaigns' | 'commissions'>('overview');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [campaignChannel, setCampaignChannel] = useState('instagram');
  const [copied, setCopied] = useState('');

  const loadPortal = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [profileResult, customerResult, campaignResult, commissionResult] = await Promise.all([
        apiGet<{ partner: PartnerProfile; stats: PartnerStats }>('/api/partner/profile'),
        apiGet<{ customers: PartnerCustomer[] }>('/api/partner/customers'),
        apiGet<{ campaigns: PartnerCampaign[] }>('/api/partner/campaigns'),
        apiGet<{ entries: CommissionEntry[] }>('/api/partner/commissions')
      ]);
      setProfile(profileResult.partner);
      setStats(profileResult.stats);
      setCustomers(customerResult.customers);
      setCampaigns(campaignResult.campaigns);
      setCommissions(commissionResult.entries);
    } catch (cause) {
      if (cause instanceof Error && !('status' in cause && (cause as Error & { status?: number }).status === 401)) {
        setError(cause.message);
      }
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadPortal(); }, [loadPortal]);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiPost('/api/auth/login/partner', { email, password });
      setPassword('');
      await loadPortal();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登录失败');
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    setError('');
    try {
      await apiPost('/api/auth/logout/partner', {});
      setProfile(null);
      setStats(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '退出登录失败');
    } finally {
      setBusy(false);
    }
  };

  const createCampaign = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiPost('/api/partner/campaigns', { name: campaignName, channel: campaignChannel });
      setCampaignName('');
      await loadPortal();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Campaign 创建失败');
    } finally {
      setBusy(false);
    }
  };

  const copy = async (id: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(id);
      window.setTimeout(() => setCopied(''), 1600);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '复制失败，请检查浏览器剪贴板权限');
    }
  };

  if (loading && !profile) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-neutral-500">正在读取 Partner 工作台…</div>;
  }

  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
        <form onSubmit={signIn} className="w-full max-w-sm space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">RUDA · PARTNER</div>
            <h1 className="mt-2 text-xl font-bold text-neutral-950">代理工作台登录</h1>
            <p className="mt-1 text-xs leading-5 text-neutral-500">使用总后台为你创建的代理账号登录。</p>
          </div>
          {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</div>}
          <label className="block text-xs font-semibold text-neutral-700">邮箱<input required type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} className="mt-1 h-11 w-full rounded-md border border-neutral-300 px-3" /></label>
          <label className="block text-xs font-semibold text-neutral-700">密码<input required type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} className="mt-1 h-11 w-full rounded-md border border-neutral-300 px-3" /></label>
          <button disabled={busy} className="min-h-11 w-full rounded-md bg-neutral-950 px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? '登录中…' : '登录 Partner 工作台'}</button>
          <a href="/" className="block text-center text-xs text-neutral-500 underline">返回 RUDA Fashion</a>
        </form>
      </main>
    );
  }

  const metricCards = [
    ['客户总数', stats?.customers ?? 0],
    ['活跃客户', stats?.activeCustomers ?? 0],
    ['本月新增', stats?.newCustomersThisMonth ?? 0],
    ['已付款销售额', `€${Number(stats?.paidSales || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`],
    ['本月佣金', `€${Number(stats?.commissionsThisMonth || 0).toFixed(2)}`],
    ['待处理佣金', `€${Number(stats?.pendingCommissions || 0).toFixed(2)}`]
  ];

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-900">
      <header className="border-b border-neutral-200 bg-white px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div><div className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">Partner Growth System</div><h1 className="mt-1 text-lg font-bold">{profile.name} <span className="ml-2 font-mono text-xs text-neutral-500">{profile.partnerCode}</span></h1><div className="mt-1 text-[11px] text-neutral-500">{roleLabel[profile.role] || profile.role} · {[profile.city, profile.country].filter(Boolean).join(', ')}</div></div>
          <button type="button" disabled={busy} onClick={() => void signOut()} className="min-h-9 border border-neutral-300 px-3 text-xs font-semibold">退出登录</button>
        </div>
      </header>
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-8">
        {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">{error}</div>}
        <nav className="flex gap-2 overflow-x-auto border-b border-neutral-200">
          {([
            ['overview', '数据总览'],
            ['customers', '客户'],
            ['campaigns', '推广 Campaign'],
            ['commissions', '佣金 Ledger']
          ] as const).map(([key, label]) => <button key={key} type="button" onClick={() => setTab(key)} className={`min-h-10 shrink-0 border-b-2 px-3 text-xs font-semibold ${tab === key ? 'border-neutral-950 text-neutral-950' : 'border-transparent text-neutral-500'}`}>{label}</button>)}
        </nav>

        {tab === 'overview' && <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{metricCards.map(([label, value]) => <article key={label} className="rounded-xl border border-neutral-200 bg-white p-4"><div className="text-[11px] font-semibold text-neutral-500">{label}</div><div className="mt-2 text-xl font-bold">{value}</div></article>)}</section>}

        {tab === 'customers' && <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-xs"><thead className="bg-neutral-50 text-neutral-500"><tr>{['商家/客户', '联系人', '联系方式', '国家 / 城市', '注册时间', '状态', 'Campaign'].map(label => <th key={label} className="px-3 py-3 font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y divide-neutral-100">{customers.map((item, index) => <tr key={`${item.customer.email}-${index}`}><td className="px-3 py-3 font-semibold">{item.customer.companyName}</td><td className="px-3 py-3">{item.customer.contactPerson}</td><td className="px-3 py-3"><div>{item.customer.email}</div><div className="mt-1 text-neutral-500">{item.customer.phone}</div></td><td className="px-3 py-3">{[item.customer.city, item.customer.country].filter(Boolean).join(', ')}</td><td className="px-3 py-3">{new Date(item.registeredAt).toLocaleDateString()}</td><td className="px-3 py-3">{item.customer.status}</td><td className="px-3 py-3">{item.campaign ? `${item.campaign.name} · ${item.campaign.channel}` : '—'}</td></tr>)}{!customers.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-neutral-500">暂无归属客户</td></tr>}</tbody></table></div></section>}

        {tab === 'campaigns' && <section className="space-y-4">
          <form onSubmit={createCampaign} className="grid gap-3 rounded-xl border border-neutral-200 bg-white p-4 sm:grid-cols-[1fr_12rem_auto]">
            <label className="text-[10px] font-semibold text-neutral-600">Campaign 名称<input required maxLength={100} value={campaignName} onChange={event => setCampaignName(event.target.value)} className="mt-1 h-10 w-full border border-neutral-300 px-3 text-xs" placeholder="Instagram 秋季推广" /></label>
            <label className="text-[10px] font-semibold text-neutral-600">推广渠道<select value={campaignChannel} onChange={event => setCampaignChannel(event.target.value)} className="mt-1 h-10 w-full border border-neutral-300 bg-white px-2 text-xs">{partnerCampaignChannelOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <button disabled={busy} className="mt-auto min-h-10 bg-neutral-950 px-4 text-xs font-semibold text-white disabled:opacity-50">{busy ? '保存中…' : '创建推广链接'}</button>
          </form>
          <div className="space-y-3">{campaigns.map(campaign => <article key={campaign.id} className="rounded-xl border border-neutral-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-semibold">{campaign.name}</div><div className="mt-1 text-[10px] text-neutral-500">{campaign.channel} · 点击 {campaign._count.clicks} · 注册 {campaign._count.referrals}</div></div><button type="button" onClick={() => void copy(campaign.id, campaign.url)} className="inline-flex min-h-9 items-center gap-2 border border-neutral-300 px-3 text-xs font-semibold"><span>{copied === campaign.id ? '已复制' : '复制链接'}</span></button></div><div className="mt-3 break-all rounded-md bg-neutral-50 p-2 font-mono text-[10px] text-neutral-700">{campaign.url}</div></article>)}{!campaigns.length && <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-xs text-neutral-500">创建不同渠道的链接，系统会分别统计点击与注册归属。</div>}</div>
        </section>}

        {tab === 'commissions' && <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-neutral-50 text-neutral-500"><tr>{['类型', '时间', '订单', '客户', '基数', '比例', '金额', '状态'].map(label => <th key={label} className="px-3 py-3 font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y divide-neutral-100">{commissions.map(entry => <tr key={entry.id}><td className="px-3 py-3">{entry.entryType === 'reversal' ? '退款冲回' : '佣金'}</td><td className="px-3 py-3">{new Date(entry.createdAt).toLocaleString()}</td><td className="px-3 py-3">{entry.order.orderNo}</td><td className="px-3 py-3">{entry.referral.customer.companyName}</td><td className="px-3 py-3">€{Number(entry.basisAmount).toFixed(2)}</td><td className="px-3 py-3">{entry.rate}%</td><td className={`px-3 py-3 font-semibold ${Number(entry.amount) < 0 ? 'text-red-700' : ''}`}>€{Number(entry.amount).toFixed(2)}</td><td className="px-3 py-3">{entry.status}</td></tr>)}{!commissions.length && <tr><td colSpan={8} className="px-4 py-10 text-center text-neutral-500">真实付款订单生成佣金后会显示在这里。</td></tr>}</tbody></table></div></section>}
      </div>
    </main>
  );
}

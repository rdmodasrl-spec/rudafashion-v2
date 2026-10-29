import React, { useEffect, useState } from 'react';
import { useB2B } from '../../../../context/B2BContext';
import { User, Mail, Phone, MapPin, CreditCard, Gift, ChevronRight, Settings, Bell, LogOut, Heart, ShoppingBag, Package, Plus, Trash2, Edit2, Check } from 'lucide-react';
import type { ConsumerAddress } from '../../../../types/b2b';
import { LanguagePicker } from '../common/LanguagePicker';
import { ApiError, apiGet, apiPost, apiPut } from '../../../../api/client';

type ConsumerAddressForm = Partial<ConsumerAddress> & { line1?: string; line2?: string; province?: string; postalCode?: string };
type FashionAccountSummary = {
  account: {
    id: string;
    displayName: string;
    bio: string | null;
    avatarUrl: string | null;
    identities: string[];
  };
  stats: { posts: number; saved: number; following: number; followers: number };
  posts: Array<{ id: string; title: string; image: string; createdAt: string; mediaType: string; publicationStatus: string }>;
  savedPosts: Array<{ id: string; title: string; image: string; createdAt: string; mediaType: string }>;
  followingIds: string[];
};

export const ConsumerAccount: React.FC = () => {
  const { authConsumer, updateConsumerProfile, loadConsumerAddresses, saveConsumerAddress, removeConsumerAddress, consumerAddresses, formatMoney, setCurrentView, logout, exchangeRates, loadExchangeRates, displayCurrency, setDisplayCurrency, convertCurrency, loadConsumerOrders, consumerOrders, localizeCopy, addNotification } = useB2B();
  const [tab, setTab] = useState<'overview' | 'profile' | 'addresses' | 'wallet' | 'prefs' | 'fashion'>('overview');
  const [profileDraft, setProfileDraft] = useState({ firstName: authConsumer?.firstName || '', lastName: authConsumer?.lastName || '', phone: authConsumer?.phone || '', country: authConsumer?.country || 'Italy' });
  const [showAddAddr, setShowAddAddr] = useState(false);
  const [addrDraft, setAddrDraft] = useState<ConsumerAddressForm>({});
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [fashionAccount, setFashionAccount] = useState<FashionAccountSummary | null>(null);
  const [fashionAccountLoading, setFashionAccountLoading] = useState(true);
  const [fashionAccountError, setFashionAccountError] = useState('');
  const [fashionProfileError, setFashionProfileError] = useState('');
  const [fashionDisplayName, setFashionDisplayName] = useState('');
  const [fashionBio, setFashionBio] = useState('');
  const [fashionLinkRole, setFashionLinkRole] = useState<'consumer' | 'buyer' | 'company' | 'merchant'>('buyer');
  const [fashionLinkIdentifier, setFashionLinkIdentifier] = useState('');
  const [fashionLinkPassword, setFashionLinkPassword] = useState('');
  const [fashionLinkError, setFashionLinkError] = useState('');
  const [fashionBusy, setFashionBusy] = useState(false);

  useEffect(() => { void loadConsumerAddresses(); void loadExchangeRates(); void loadConsumerOrders(); }, [loadConsumerAddresses, loadExchangeRates, loadConsumerOrders]);
  useEffect(() => {
    let active = true;
    setFashionAccountLoading(true);
    void apiPost('/api/fashion/account/activate', {})
      .then(() => apiGet<FashionAccountSummary & { success: true }>('/api/fashion/account/me'))
      .then(result => {
        if (!active) return;
        setFashionAccount(result);
        setFashionDisplayName(result.account.displayName);
        setFashionBio(result.account.bio || '');
      })
      .catch(error => {
        if (active) setFashionAccountError(error instanceof ApiError ? error.message : 'FASHION_ACCOUNT_LOAD_FAILED');
      })
      .finally(() => {
        if (active) setFashionAccountLoading(false);
      });
    return () => { active = false; };
  }, []);

  const saveProfile = async () => {
    setSaving(true);
    await updateConsumerProfile(profileDraft);
    setSavedOk(true); setTimeout(() => setSavedOk(false), 2000);
    setSaving(false);
  };
  const saveAddr = async () => {
    if (!addrDraft.firstName || !addrDraft.lastName || !addrDraft.line1 || !addrDraft.city || !addrDraft.phone || !addrDraft.country || !addrDraft.postalCode) return;
    setSaving(true);
    await saveConsumerAddress({
      ...addrDraft,
      street: [addrDraft.line1, addrDraft.line2].filter(Boolean).join(', '),
      city: [addrDraft.city, addrDraft.province].filter(Boolean).join(', '),
      zip: addrDraft.postalCode,
    } as ConsumerAddress);
    setSaving(false); setShowAddAddr(false); setAddrDraft({});
  };
  const saveFashionProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFashionBusy(true);
    setFashionProfileError('');
    try {
      const result = await apiPut<{ success: true; account: FashionAccountSummary['account'] }>('/api/fashion/account/profile', {
        displayName: fashionDisplayName,
        bio: fashionBio
      });
      if (fashionAccount) setFashionAccount({ ...fashionAccount, account: result.account });
      addNotification('success', localizeCopy('Tik 资料已保存', 'Profilo Tik salvato'), localizeCopy('此资料只用于你的创作者主页，不会更改商城或商家资料。', 'Queste informazioni valgono solo per il profilo creator e non modificano i dati commerciali.'));
    } catch (error) {
      setFashionProfileError(error instanceof Error ? error.message : 'FASHION_PROFILE_UPDATE_FAILED');
    } finally {
      setFashionBusy(false);
    }
  };
  const linkFashionIdentity = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFashionBusy(true);
    setFashionLinkError('');
    try {
      await apiPost('/api/fashion/account/link', {
        role: fashionLinkRole,
        identifier: fashionLinkIdentifier,
        password: fashionLinkPassword
      });
      const result = await apiGet<FashionAccountSummary & { success: true }>('/api/fashion/account/me');
      setFashionAccount(result);
      setFashionDisplayName(result.account.displayName);
      setFashionBio(result.account.bio || '');
      setFashionLinkIdentifier('');
      setFashionLinkPassword('');
      addNotification('success', localizeCopy('账号已验证并关联', 'Account collegato'), localizeCopy('业务权限保持不变；Tik 内容现在归属这个统一账户。', 'I permessi commerciali restano invariati; i contenuti Tik appartengono ora a questo account.'));
    } catch (error) {
      setFashionLinkError(error instanceof Error ? error.message : 'FASHION_IDENTITY_VERIFICATION_FAILED');
    } finally {
      setFashionBusy(false);
    }
  };

  const spentLifetime = consumerOrders.reduce((s, o) => s + o.finalTotal, 0);
  const lvl = spentLifetime > 3000 ? '钻石会员 Diamond' : spentLifetime > 1000 ? '金卡 Gold' : '银卡 Silver';
  const tierAccent = spentLifetime > 3000 ? 'from-violet-500 to-fuchsia-500' : spentLifetime > 1000 ? 'from-amber-400 to-orange-500' : 'from-neutral-400 to-neutral-500';

  const tabs = [
    ['overview', '概览 Overview', Package],
    ['profile', '个人信息 Profile', User],
    ['addresses', '收货地址 Addresses', MapPin],
    ['wallet', '钱包 · 积分 Wallet', CreditCard],
    ['prefs', '设置 Preferences', Settings],
    ['fashion', 'Tik 创作者', User],
  ] as const;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <div className="rounded-3xl bg-gradient-to-br from-neutral-900 to-neutral-950 text-white p-6 md:p-10 mb-8 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-72 h-72 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute right-40 bottom-0 w-40 h-40 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-center gap-5 md:gap-8">
          {authConsumer?.avatarUrl ? (
            <img src={authConsumer.avatarUrl} alt="" className="w-20 h-20 md:w-24 md:h-24 rounded-full border border-white/20 object-cover shrink-0 shadow-xl" />
          ) : (
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-white/20 to-white/5 border border-white/20 backdrop-blur flex items-center justify-center text-3xl md:text-4xl font-black font-serif shrink-0 shadow-xl">
              {(authConsumer?.firstName?.[0] || authConsumer?.email?.[0] || 'U').toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className={`inline-block mb-2 px-3 py-1 rounded-full text-[10px] font-black tracking-wide bg-gradient-to-r ${tierAccent} text-white shadow-lg`}>
              {lvl}
            </div>
            <h1 className="font-serif font-black text-2xl md:text-3xl mb-1">Hi, {authConsumer?.firstName || authConsumer?.email?.split('@')[0]}! 👋</h1>
            <p className="text-sm text-white/70 flex items-center gap-2">
              <Mail className="w-3.5 h-3.5" /> {authConsumer?.email}
              {authConsumer?.phone && <><Phone className="w-3.5 h-3.5 ml-2" /> {authConsumer.phone}</>}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 md:gap-5 text-center md:text-right">
            <div className="p-3 md:p-4 rounded-2xl bg-white/5 backdrop-blur border border-white/10">
              <div className="font-black text-xl md:text-2xl tabular-nums">{consumerOrders.length}</div>
              <div className="text-[10px] md:text-xs text-white/60 mt-0.5">订单 Orders</div>
            </div>
            <div className="p-3 md:p-4 rounded-2xl bg-white/5 backdrop-blur border border-white/10">
              <div className="font-black text-xl md:text-2xl tabular-nums">{authConsumer?.points || 0}</div>
              <div className="text-[10px] md:text-xs text-white/60 mt-0.5">积分 Points</div>
            </div>
            <div className="p-3 md:p-4 rounded-2xl bg-white/5 backdrop-blur border border-white/10">
              <div className="font-black text-xl md:text-2xl tabular-nums">{formatMoney(spentLifetime)}</div>
              <div className="text-[10px] md:text-xs text-white/60 mt-0.5">累计消费</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        <aside className="lg:col-span-1">
          <nav className="ui-card p-2 sticky top-24 space-y-1">
            {tabs.map(([k, t, Ic]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition ${tab === k ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-700 hover:bg-neutral-100'}`}>
                <span className="flex items-center gap-2.5"><Ic className="w-4 h-4" /> {t}</span>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>
            ))}
            <div className="pt-2 mt-3 border-t border-neutral-200/70 space-y-1">
              <button onClick={() => setCurrentView('consumer_orders')} className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-neutral-700 hover:bg-neutral-100 transition">
                <span className="flex items-center gap-2.5"><Package className="w-4 h-4" /> 我的全部订单</span><ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>
              <button onClick={() => setCurrentView('consumer_wishlist')} className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-neutral-700 hover:bg-neutral-100 transition">
                <span className="flex items-center gap-2.5"><Heart className="w-4 h-4 text-rose-500" /> 愿望清单</span><ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>
              <button onClick={() => setCurrentView('consumer_cart')} className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-neutral-700 hover:bg-neutral-100 transition">
                <span className="flex items-center gap-2.5"><ShoppingBag className="w-4 h-4" /> 购物袋</span><ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>
              <button onClick={() => { logout(); setCurrentView('home'); }} className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-rose-600 hover:bg-rose-50 transition">
                <span className="flex items-center gap-2.5"><LogOut className="w-4 h-4" /> 退出登录</span>
              </button>
            </div>
          </nav>
        </aside>

        <main className="lg:col-span-3 space-y-6">
          {tab === 'overview' && (
            <>
              <div className="grid md:grid-cols-3 gap-4">
                {[
                  { t: '待付款', v: consumerOrders.filter(o => o.status === 'payment_pending').length, c: 'bg-amber-50 text-amber-700' },
                  { t: '配送中', v: consumerOrders.filter(o => ['processing', 'shipped'].includes(o.status)).length, c: 'bg-sky-50 text-sky-700' },
                  { t: '已完成', v: consumerOrders.filter(o => o.status === 'delivered').length, c: 'bg-emerald-50 text-emerald-700' },
                ].map(x => (
                  <button key={x.t} onClick={() => setCurrentView('consumer_orders')} className={`ui-card p-5 text-left hover:shadow-md transition`}>
                    <div className={`w-10 h-10 rounded-xl mb-3 flex items-center justify-center ${x.c}`}>
                      <Package className="w-5 h-5" />
                    </div>
                    <div className="font-black text-3xl tabular-nums mb-1 text-neutral-950">{x.v}</div>
                    <div className="text-xs text-neutral-500">{x.t}</div>
                  </button>
                ))}
              </div>
              <div className="ui-card p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-black text-lg text-neutral-950 flex items-center gap-2"><Gift className="w-5 h-5 text-amber-500" /> 会员权益 / 下一级进度</h3>
                  <span className="text-xs text-neutral-500">本月预计获得积分 · 1,240</span>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs mb-2">
                      <span className="font-semibold text-neutral-800">距下一等级 · 金卡 Gold</span>
                      <span className="text-neutral-500 tabular-nums">{formatMoney(Math.max(0, 1000 - spentLifetime))} / {formatMoney(1000)}</span>
                    </div>
                    <div className="h-3 rounded-full bg-neutral-100 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all" style={{ width: `${Math.min(100, (spentLifetime / 1000) * 100)}%` }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                    {[
                      ['🎁 生日礼券', '€50'],
                      ['💎 专属折扣', '95 折起'],
                      ['🚚 免费快递', '无限次'],
                      ['📞 VIP 客服', '1v1 服务'],
                    ].map(([k, v]) => (
                      <div key={k} className="p-4 rounded-2xl bg-gradient-to-br from-neutral-50 to-neutral-100 border border-neutral-200/70">
                        <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold mb-1">{v}</div>
                        <div className="text-sm font-bold text-neutral-900">{k}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {consumerOrders.length > 0 && (
                <div className="ui-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-black text-lg text-neutral-950">最近订单</h3>
                    <button onClick={() => setCurrentView('consumer_orders')} className="text-xs font-semibold text-neutral-500 hover:text-neutral-900">查看全部 →</button>
                  </div>
                  <div className="space-y-2">
                    {consumerOrders.slice(0, 3).map(o => (
                      <div key={o.id} className="flex items-center justify-between gap-4 p-3 rounded-xl hover:bg-neutral-50 transition cursor-pointer">
                        <div className="flex items-center gap-3 min-w-0">
                          <img src={o.items?.[0]?.image || '/pwa-512x512.png'} className="w-12 h-14 rounded-lg object-cover shrink-0" />
                          <div className="min-w-0">
                            <div className="text-xs font-mono text-neutral-500">#{o.id.slice(0, 10).toUpperCase()}</div>
                            <div className="text-sm font-bold text-neutral-900 truncate">{o.items?.[0]?.productName || '商品订单'}</div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-black text-neutral-950">{formatMoney(o.finalTotal)}</div>
                          <div className="text-[10px] text-neutral-500">{new Date(o.createdAt).toLocaleDateString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'profile' && (
            <div className="ui-card p-6 md:p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-black text-xl text-neutral-950">个人资料</h2>
                {savedOk && <span className="text-xs font-bold text-emerald-600 flex items-center gap-1"><Check className="w-4 h-4" /> 已保存</span>}
              </div>
              <div className="grid md:grid-cols-2 gap-5">
                <label className="block"><span className="ui-section-title block mb-2">姓 · Surname</span><input value={profileDraft.lastName} onChange={e => setProfileDraft(p => ({ ...p, lastName: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
                <label className="block"><span className="ui-section-title block mb-2">名 · Given Name</span><input value={profileDraft.firstName} onChange={e => setProfileDraft(p => ({ ...p, firstName: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
                <label className="block"><span className="ui-section-title block mb-2">邮箱 E-mail</span><input value={authConsumer?.email || ''} disabled className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 text-sm text-neutral-500 cursor-not-allowed" /></label>
                <label className="block"><span className="ui-section-title block mb-2">手机号 Phone</span><input value={profileDraft.phone} onChange={e => setProfileDraft(p => ({ ...p, phone: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
                <label className="block md:col-span-2"><span className="ui-section-title block mb-2">常驻地 Country</span><input value={profileDraft.country} onChange={e => setProfileDraft(p => ({ ...p, country: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setProfileDraft({ firstName: authConsumer?.firstName || '', lastName: authConsumer?.lastName || '', phone: authConsumer?.phone || '', country: authConsumer?.country || 'Italy' })} className="ui-secondary-button px-6 py-3 text-sm">重置</button>
                <button onClick={saveProfile} disabled={saving} className="ui-primary-button px-6 py-3 text-sm flex items-center gap-2 disabled:opacity-60">
                  {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />} 保存修改
                </button>
              </div>
            </div>
          )}

          {tab === 'addresses' && (
            <div className="ui-card p-6 md:p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-black text-xl text-neutral-950">收货地址管理</h2>
                <button onClick={() => setShowAddAddr(s => !s)} className="ui-secondary-button !py-2.5 !px-4 !text-xs flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> {showAddAddr ? '取消' : '新增地址'}
                </button>
              </div>
              {showAddAddr && (
                <div className="mb-6 p-5 rounded-2xl bg-neutral-50 border border-neutral-200/70 grid md:grid-cols-2 gap-3.5">
                  {([
                    ['firstName', '名'], ['lastName', '姓'], ['phone', '电话'], ['country', '国家'],
                    ['province', '省份'], ['city', '城市'], ['postalCode', '邮编'],
                  ] as const).map(([k, l]) => (
                    <label key={k} className="block"><span className="ui-section-title block mb-1.5 text-[11px]">{l}</span><input value={addrDraft[k] || ''} onChange={e => setAddrDraft(a => ({ ...a, [k]: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
                  ))}
                  <label className="block md:col-span-2"><span className="ui-section-title block mb-1.5 text-[11px]">地址 Line 1 (街道门牌号)</span><input value={addrDraft.line1 || ''} onChange={e => setAddrDraft(a => ({ ...a, line1: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
                  <label className="block md:col-span-2"><span className="ui-section-title block mb-1.5 text-[11px]">地址 Line 2 (可选)</span><input value={addrDraft.line2 || ''} onChange={e => setAddrDraft(a => ({ ...a, line2: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
                  <div className="md:col-span-2 flex justify-end gap-2">
                    <button onClick={saveAddr} disabled={saving} className="ui-primary-button px-5 py-2.5 text-xs flex items-center gap-2 disabled:opacity-60">
                      {saving && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />} 保存地址
                    </button>
                  </div>
                </div>
              )}
              {consumerAddresses.length === 0 ? (
                <div className="text-center py-12 text-neutral-500">
                  <MapPin className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
                  <p className="text-sm">您还未添加收货地址，建议下单前先保存。</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-3.5">
                  {consumerAddresses.map(a => (
                    <div key={a.id} className="p-5 rounded-2xl border border-neutral-200 hover:border-neutral-400 transition bg-white relative group">
                      {a.isDefault && <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-neutral-900 text-white text-[9px] font-black tracking-wider">DEFAULT</div>}
                      <div className="font-bold text-sm mb-1.5 text-neutral-900">{a.firstName} {a.lastName}</div>
                      <div className="text-xs text-neutral-600 leading-6 mb-2 min-h-[3rem]">
                        {a.street}<br />
                        {a.zip} {a.city}, {a.country}
                      </div>
                      <div className="text-xs text-neutral-500 mb-3 flex items-center gap-1.5"><Phone className="w-3 h-3" /> {a.phone}</div>
                      <div className="flex gap-2 pt-3 border-t border-neutral-200/70">
                        <button className="text-[11px] font-bold text-neutral-700 hover:text-neutral-950 flex items-center gap-1"><Edit2 className="w-3 h-3" /> 编辑</button>
                        <button onClick={() => removeConsumerAddress(a.id)} className="text-[11px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 ml-auto"><Trash2 className="w-3 h-3" /> 删除</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'wallet' && (
            <div className="space-y-6">
              <div className="ui-card p-6 md:p-8 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-56 h-56 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 blur-3xl opacity-60" />
                <div className="relative">
                  <h3 className="font-black text-lg mb-1 text-neutral-950 flex items-center gap-2"><Gift className="w-5 h-5 text-amber-500" /> RUDA 积分</h3>
                  <p className="text-xs text-neutral-500 mb-4">购物可累计积分，结账时每 100 积分可抵扣 €1</p>
                  <div className="grid grid-cols-3 gap-4 mb-5">
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-neutral-900 to-neutral-700 text-white">
                      <div className="text-[10px] uppercase tracking-wider text-white/60 mb-1">当前可用</div>
                      <div className="font-black text-3xl tabular-nums">{authConsumer?.points || 0}</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                      <div className="text-[10px] uppercase tracking-wider text-emerald-600 mb-1 font-bold">本月累计</div>
                      <div className="font-black text-3xl tabular-nums text-emerald-800">+1,240</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-violet-50 border border-violet-100">
                      <div className="text-[10px] uppercase tracking-wider text-violet-600 mb-1 font-bold">抵值金额</div>
                      <div className="font-black text-3xl tabular-nums text-violet-800">{formatMoney(((authConsumer?.points || 0) / 100))}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200/70 flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div><div className="font-bold text-neutral-900 mb-0.5">购物得积分</div><div className="text-neutral-500 leading-5">每消费 €1 获 10 积分，会员等级加倍。</div></div>
                    </div>
                    <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200/70 flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div><div className="font-bold text-neutral-900 mb-0.5">结账抵扣</div><div className="text-neutral-500 leading-5">100 积分 = €1，可与优惠券叠加使用。</div></div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="ui-card p-6 md:p-8">
                <h3 className="font-black text-lg mb-5 text-neutral-950 flex items-center gap-2"><Bell className="w-5 h-5" /> 可用优惠券</h3>
                <div className="grid md:grid-cols-2 gap-3.5">
                  {[
                    { t: '新品首单', d: '满 €150 立减', v: '€20', exp: '2025-12-31', c: 'from-rose-500 to-pink-500' },
                    { t: '节日特惠', d: '订单总额 15% OFF', v: '15%', exp: '2025-11-30', c: 'from-amber-500 to-orange-500' },
                    { t: '免邮券', d: '全场不限金额包邮', v: 'FREE', exp: '2026-01-15', c: 'from-sky-500 to-indigo-500' },
                    { t: 'VIP 专属', d: '正价商品 9 折', v: '10%', exp: '长期有效', c: 'from-neutral-800 to-neutral-950' },
                  ].map(c => (
                    <div key={c.t} className="relative rounded-2xl overflow-hidden border border-neutral-200 hover:border-neutral-400 transition group">
                      <div className={`absolute inset-y-0 left-0 w-28 bg-gradient-to-br ${c.c} flex flex-col items-center justify-center text-white`}>
                        <div className="text-[10px] uppercase tracking-wider opacity-75">Discount</div>
                        <div className="font-black text-2xl md:text-3xl">{c.v}</div>
                      </div>
                      <div className="pl-32 pr-4 py-4">
                        <div className="font-black text-sm text-neutral-900 mb-0.5">{c.t}</div>
                        <div className="text-xs text-neutral-500 mb-2">{c.d}</div>
                        <div className="flex items-center justify-between pt-2 border-t border-neutral-200/70">
                          <span className="text-[10px] text-neutral-400">有效期至 {c.exp}</span>
                          <button className="text-[11px] font-bold text-neutral-950 hover:underline">立即使用 →</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'prefs' && (
            <div className="space-y-6">
              <div className="ui-card p-6 md:p-8">
                <h3 className="font-black text-lg mb-5 text-neutral-950">显示与语言</h3>
                <p className="mb-5 text-xs leading-5 text-neutral-500">消费者账户暂未接入后台偏好同步；当前语言和展示货币仅保存在本设备。订单仍以 EUR 结算。</p>
                <div className="space-y-5">
                  <div>
                    <span className="ui-section-title block mb-3">展示货币 Display Currency</span>
                    <div className="flex flex-wrap gap-2">
                      {(['EUR', 'USD', 'CNY', 'GBP', 'JPY', 'CHF'] as const).map(c => (
                        <button key={c} onClick={() => setDisplayCurrency(c)}
                          className={`min-w-20 px-4 py-2.5 rounded-xl text-sm font-bold transition ${displayCurrency === c ? 'bg-neutral-900 text-white shadow-md' : 'bg-white border border-neutral-200 text-neutral-700 hover:border-neutral-400'}`}>
                          {c}
                          {exchangeRates?.rates[c] && <span className="block text-[10px] font-normal opacity-70 mt-0.5">1 EUR = {Number(exchangeRates.rates[c]).toFixed(3)}</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="ui-section-title">语言 Language / Lingua</span>
                    <LanguagePicker />
                  </div>
                  <div className="pt-3 border-t border-neutral-200/70 text-xs text-neutral-500 leading-6 space-y-1">
                    <p>💡 所有订单均以 EUR 作为结算基准，其他货币仅作展示参考，汇率每 24 小时自动更新（央行中间价）。</p>
                    <p>示例：{formatMoney(500)} 约等于 {formatMoney(convertCurrency(500))}（{displayCurrency}）</p>
                  </div>
                </div>
              </div>
              <div className="ui-card p-6 md:p-8">
                <h3 className="font-black text-lg mb-5 text-neutral-950">通知偏好 Notification</h3>
                <div className="space-y-3">
                  {([
                    ['订单发货提醒', '包裹发出/签收时立即推送', true],
                    ['专属折扣 & 新品', '每周不超过 2 封精选邮件', true],
                    ['补货到货通知', '心愿清单到货即提醒', true],
                    ['营销短信/WhatsApp', '限大促期间，可随时退订', false],
                  ] as const).map(([t, d, def]) => (
                    <label key={t} className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-neutral-50 hover:bg-neutral-100 transition cursor-pointer">
                      <div>
                        <div className="font-bold text-sm text-neutral-900">{t}</div>
                        <div className="text-xs text-neutral-500 mt-0.5">{d}</div>
                      </div>
                      <div className="relative">
                        <input type="checkbox" defaultChecked={def} className="sr-only peer" />
                        <div className="w-11 h-6 rounded-full bg-neutral-300 peer-checked:bg-neutral-900 transition" />
                        <div className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'fashion' && (
            <section aria-label={localizeCopy('Tik 创作者资料', 'Profilo creator Tik')} className="space-y-5">
              {fashionAccountLoading ? (
                <p role="status" className="py-8 text-center text-xs text-neutral-500">{localizeCopy('正在加载 Tik 账户…', 'Caricamento account Tik…')}</p>
              ) : fashionAccountError ? (
                <p role="alert" className="border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">{localizeCopy('Tik 账户暂时无法加载：{{RUDA_ARG_0}}', 'Impossibile caricare l’account Tik: {{RUDA_ARG_0}}', [fashionAccountError])}</p>
              ) : fashionAccount ? (
                <>
                  <div className="ui-card flex flex-wrap items-center gap-4 p-5">
                    {fashionAccount.account.avatarUrl ? (
                      <img src={fashionAccount.account.avatarUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
                    ) : (
                      <span className="grid h-14 w-14 place-items-center rounded-full bg-neutral-100 text-lg font-semibold text-neutral-500">{fashionAccount.account.displayName.slice(0, 1).toUpperCase()}</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-base font-semibold text-neutral-950">{fashionAccount.account.displayName}</h2>
                      <p className="mt-1 text-[10px] text-neutral-500">{localizeCopy('统一创作者账户', 'Account creator unificato')} · {fashionAccount.account.identities.length} {localizeCopy('个已验证身份', 'identità verificate')}</p>
                      {fashionAccount.account.bio && <p className="mt-2 text-xs text-neutral-600">{fashionAccount.account.bio}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      [localizeCopy('作品', 'Post'), fashionAccount.stats.posts],
                      [localizeCopy('收藏', 'Salvati'), fashionAccount.stats.saved],
                      [localizeCopy('关注', 'Seguiti'), fashionAccount.stats.following],
                      [localizeCopy('粉丝', 'Follower'), fashionAccount.stats.followers]
                    ].map(([label, value]) => (
                      <div key={String(label)} className="ui-card px-3 py-4 text-center">
                        <p className="text-lg font-semibold text-neutral-950">{value}</p>
                        <p className="mt-1 text-[10px] text-neutral-500">{label}</p>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={event => void saveFashionProfile(event)} className="ui-card grid gap-3 p-4 sm:grid-cols-2">
                    <label className="text-[10px] font-semibold text-neutral-600">
                      {localizeCopy('创作者名称', 'Nome creator')}
                      <input required maxLength={80} value={fashionDisplayName} onChange={event => setFashionDisplayName(event.target.value)} className="mt-1.5 min-h-10 w-full border border-neutral-200 px-3 text-xs font-normal text-neutral-900" />
                    </label>
                    <label className="text-[10px] font-semibold text-neutral-600">
                      {localizeCopy('个人简介', 'Bio')}
                      <input maxLength={300} value={fashionBio} onChange={event => setFashionBio(event.target.value)} className="mt-1.5 min-h-10 w-full border border-neutral-200 px-3 text-xs font-normal text-neutral-900" />
                    </label>
                    {fashionProfileError && <p role="alert" className="text-[11px] text-rose-700 sm:col-span-2">{localizeCopy('资料保存失败：{{RUDA_ARG_0}}', 'Impossibile salvare il profilo: {{RUDA_ARG_0}}', [fashionProfileError])}</p>}
                    <p className="text-[10px] leading-4 text-neutral-500 sm:col-span-2">{localizeCopy('此资料只用于你的创作者主页，不会更改商城或商家资料。', 'Queste informazioni valgono solo per il profilo creator e non modificano i dati commerciali.')}</p>
                    <button type="submit" disabled={fashionBusy} className="min-h-10 bg-neutral-950 px-4 text-xs font-semibold text-white disabled:opacity-50 sm:col-span-2">
                      {fashionBusy ? localizeCopy('正在保存…', 'Salvataggio…') : localizeCopy('保存 Tik 资料', 'Salva profilo Tik')}
                    </button>
                  </form>

                  <section className="ui-card p-4">
                    <h3 className="text-xs font-semibold text-neutral-950">{localizeCopy('已关联的 RUDA 身份', 'Identità RUDA collegate')}</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {fashionAccount.account.identities.map(provider => (
                        <span key={provider} className="border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-[10px] font-medium text-neutral-700">
                          {provider === 'consumer' ? localizeCopy('消费者账户', 'Account consumatore') : provider === 'account_identity' ? localizeCopy('采购商 / 企业 / 商家', 'Buyer / azienda / negozio') : localizeCopy('RUDA 账户', 'Account RUDA')}
                        </span>
                      ))}
                    </div>
                    <form onSubmit={event => void linkFashionIdentity(event)} className="mt-4 grid gap-2 border-t border-neutral-100 pt-4 sm:grid-cols-2">
                      <label className="text-[10px] font-semibold text-neutral-600">
                        {localizeCopy('要关联的账户类型', 'Tipo di account')}
                        <select value={fashionLinkRole} onChange={event => setFashionLinkRole(event.target.value as typeof fashionLinkRole)} className="mt-1.5 min-h-10 w-full border border-neutral-200 bg-white px-2 text-xs font-normal text-neutral-900">
                          <option value="consumer">{localizeCopy('消费者', 'Consumatore')}</option>
                          <option value="buyer">{localizeCopy('采购商', 'Buyer')}</option>
                          <option value="company">{localizeCopy('企业', 'Azienda')}</option>
                          <option value="merchant">{localizeCopy('商家', 'Negozio')}</option>
                        </select>
                      </label>
                      <label className="text-[10px] font-semibold text-neutral-600">
                        {localizeCopy('账户邮箱、电话或商家编号', 'Email, telefono o codice negozio')}
                        <input required autoComplete="username" maxLength={254} value={fashionLinkIdentifier} onChange={event => setFashionLinkIdentifier(event.target.value)} className="mt-1.5 min-h-10 w-full border border-neutral-200 px-3 text-xs font-normal text-neutral-900" />
                      </label>
                      <label className="text-[10px] font-semibold text-neutral-600 sm:col-span-2">
                        {localizeCopy('重新验证密码', 'Verifica di nuovo la password')}
                        <input required type="password" autoComplete="current-password" maxLength={200} value={fashionLinkPassword} onChange={event => setFashionLinkPassword(event.target.value)} className="mt-1.5 min-h-10 w-full border border-neutral-200 px-3 text-xs font-normal text-neutral-900" />
                      </label>
                      {fashionLinkError && <p role="alert" className="text-[11px] text-rose-700 sm:col-span-2">{localizeCopy('身份验证或关联失败：{{RUDA_ARG_0}}', 'Verifica o collegamento non riusciti: {{RUDA_ARG_0}}', [fashionLinkError])}</p>}
                      <p className="text-[10px] leading-4 text-neutral-500 sm:col-span-2">{localizeCopy('密码只用于本次向 RUDA 验证身份，不会保存；关联只统一 Tik 归属，不会授予或扩大商家、采购或企业权限。', 'La password viene usata solo per questa verifica e non viene salvata; il collegamento unifica Tik senza concedere o ampliare permessi commerciali.')}</p>
                      <button type="submit" disabled={fashionBusy} className="min-h-10 bg-neutral-950 px-4 text-xs font-semibold text-white disabled:opacity-50 sm:col-span-2">
                        {fashionBusy ? localizeCopy('正在验证…', 'Verifica in corso…') : localizeCopy('验证并关联账户', 'Verifica e collega account')}
                      </button>
                    </form>
                  </section>

                  <div className="grid gap-5 lg:grid-cols-2">
                    <section className="ui-card p-4">
                      <h3 className="text-xs font-semibold text-neutral-950">{localizeCopy('我的作品', 'I miei contenuti')}</h3>
                      {fashionAccount.posts.length ? (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          {fashionAccount.posts.map(post => (
                            <article key={post.id} className="overflow-hidden border border-neutral-100">
                              {post.image && <img src={post.image} alt="" className="aspect-square w-full object-cover" loading="lazy" />}
                              <div className="p-2">
                                <p className="line-clamp-2 text-[10px] font-medium text-neutral-800">{post.title}</p>
                                <p className="mt-1 text-[9px] text-neutral-500">{post.publicationStatus === 'approved' ? localizeCopy('已发布', 'Pubblicato') : localizeCopy('审核中', 'In revisione')}</p>
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : <p className="mt-2 text-xs text-neutral-500">{localizeCopy('还没有作品。', 'Non hai ancora pubblicato contenuti.')}</p>}
                    </section>
                    <section className="ui-card p-4">
                      <h3 className="text-xs font-semibold text-neutral-950">{localizeCopy('我的收藏', 'I miei salvati')}</h3>
                      {fashionAccount.savedPosts.length ? (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          {fashionAccount.savedPosts.map(post => (
                            <article key={post.id} className="overflow-hidden border border-neutral-100">
                              {post.image && <img src={post.image} alt="" className="aspect-square w-full object-cover" loading="lazy" />}
                              <p className="line-clamp-2 p-2 text-[10px] font-medium text-neutral-800">{post.title}</p>
                            </article>
                          ))}
                        </div>
                      ) : <p className="mt-2 text-xs text-neutral-500">{localizeCopy('还没有收藏内容。', 'Non hai ancora salvato contenuti.')}</p>}
                    </section>
                  </div>
                </>
              ) : null}
            </section>
          )}
        </main>
      </div>
    </div>
  );
};

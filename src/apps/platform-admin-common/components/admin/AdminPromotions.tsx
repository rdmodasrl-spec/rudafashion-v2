import React, { useEffect, useMemo, useState } from 'react';
import { useB2B } from '../../../../context/B2BContext';
import { Tag, Percent, Calendar, Plus, Trash2, Edit2, Check, X, Zap, Gift, ShoppingCart, Coins, ToggleLeft, ToggleRight, Search } from 'lucide-react';
import type { PromotionRule } from '../../../../types/b2b';
import { AdminPageHeader } from './AdminPageHeader';

const PROMO_TYPES: { k: PromotionRule['type']; t: string; d: string; ic: any; accent: string }[] = [
  { k: 'percent_discount', t: '百分折扣', d: '订单或商品按百分比减免', ic: Percent, accent: 'bg-neutral-800' },
  { k: 'fixed_amount', t: '金额减免', d: '满 X 元直减 Y 元', ic: Tag, accent: 'bg-neutral-800' },
  { k: 'tiered_discount', t: '阶梯优惠', d: '满 A 减 B / 满 C 减 D 递进', ic: Coins, accent: 'bg-neutral-800' },
  { k: 'buy_x_get_y', t: '买赠优惠', d: '买赠 + 组合营销', ic: Gift, accent: 'bg-neutral-800' },
  { k: 'free_shipping', t: '包邮优惠', d: '订单满 X 免运费', ic: ShoppingCart, accent: 'bg-neutral-800' },
  { k: 'bundle_deal', t: '组合促销', d: '多件商品组合优惠', ic: Zap, accent: 'bg-neutral-800' },
];

const emptyForm: Partial<PromotionRule> = {
  type: 'percent_discount', name: '', description: '', scope: 'sitewide', appliesOn: 'both',
  percentOff: undefined, fixedAmountOff: undefined, minSubtotal: 0,
  buyQty: undefined, getQty: undefined, getPercentOff: undefined,
  startsAt: new Date().toISOString(), expiresAt: undefined,
  isActive: true, code: '', totalUsageLimit: undefined, merchantIds: [], categoryIds: [], productIds: []
};

export const AdminPromotions: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const { adminPromotions, loadAdminPromotions, saveAdminPromotion, deleteAdminPromotion, toggleAdminPromotionActive, formatMoney, products, merchants } = useB2B();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'all' | PromotionRule['type']>('all');
  const [editing, setEditing] = useState<Partial<PromotionRule> | null>(null);
  const [tiersJsonDraft, setTiersJsonDraft] = useState('[]');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(false);
  const categoryOptions = useMemo(() => [...new Set(products.map(product => product.category).filter(Boolean))].sort(), [products]);

  const refreshPromotions = async () => {
    setLoading(true);
    setLoadError('');
    try {
      await loadAdminPromotions();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '促销列表读取失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refreshPromotions(); }, []);

  const filtered = useMemo(() => {
    return adminPromotions.filter(p => {
      if (tab !== 'all' && p.type !== tab) return false;
      if (search) {
        const s = search.toLowerCase();
        return p.name.toLowerCase().includes(s) || (p.code || '').toLowerCase().includes(s) || p.description?.toLowerCase().includes(s);
      }
      return true;
    });
  }, [adminPromotions, tab, search]);

  const patch = <K extends keyof PromotionRule>(k: K, v: PromotionRule[K]) => {
    if (!editing) return;
    setEditing(prev => prev ? ({ ...prev, [k]: v }) : prev);
  };

  const toggleTarget = (field: 'merchantIds' | 'categoryIds' | 'productIds', id: string) => {
    const selected = editing?.[field] ?? [];
    patch(field, selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id]);
  };

  const submit = async () => {
    if (!editing || !editing.name || !editing.type || !editing.scope || !editing.appliesOn || !editing.startsAt) return;
    if ((editing.scope === 'merchant' && !editing.merchantIds?.length) ||
        (editing.scope === 'category' && !editing.categoryIds?.length) ||
        (editing.scope === 'product' && !editing.productIds?.length)) {
      setActionError('请为指定范围至少选择一个目标，不能保存未绑定目标的促销。');
      return;
    }
    if (editing.scope === 'consumer_tier') {
      setActionError('消费者等级定向目前没有后端目标字段，暂不能保存；请选择全站、商户、品类或商品范围。');
      return;
    }
    setSaving(true);
    setActionError('');
    try {
      let tiers: NonNullable<PromotionRule['tiers']> = editing.tiers || [];
      if (editing.type === 'tiered_discount') {
        const parsed: unknown = JSON.parse(tiersJsonDraft);
        if (!Array.isArray(parsed)) throw new Error('阶梯规则必须是 JSON 数组。');
        tiers = parsed as NonNullable<PromotionRule['tiers']>;
      }
      await saveAdminPromotion({ ...editing, tiers });
      setEditing(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '保存失败，请重试。');
    } finally {
      setSaving(false);
    }
  };

  const typeStats = useMemo(() => {
    const m: Record<string, number> = { all: adminPromotions.length };
    PROMO_TYPES.forEach(t => { m[t.k] = adminPromotions.filter(p => p.type === t.k).length; });
    return m;
  }, [adminPromotions]);

  const togglePromotion = async (id: string, isActive: boolean) => {
    setActionError('');
    try {
      await toggleAdminPromotionActive(id, isActive);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '促销状态更新失败');
    }
  };

  const removePromotion = async (id: string) => {
    setActionError('');
    try {
      await deleteAdminPromotion(id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '促销删除失败');
    }
  };

  const createButton = (
    <button onClick={() => { setActionError(''); setTiersJsonDraft('[]'); setEditing({ ...emptyForm }); }} className="ui-primary-button inline-flex min-h-9 items-center gap-2 px-3 text-xs">
      <Plus className="w-4 h-4" /> 新增促销
    </button>
  );

  return (
    <div className={embedded ? 'space-y-4' : 'max-w-[1400px] mx-auto px-4 md:px-6 py-6 md:py-10'}>
      {embedded
        ? <div className="flex justify-end">{createButton}</div>
        : <AdminPageHeader title="促销管理" actions={createButton} />}
      {loadError && <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-300 bg-white p-4 text-sm text-neutral-800"><span>促销列表加载失败：{loadError}</span><button type="button" onClick={() => void refreshPromotions()} className="rounded-lg border border-neutral-400 px-3 py-2 text-xs font-semibold">重试加载</button></div>}
      {actionError && !editing && <div role="alert" className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-neutral-300 bg-white p-4 text-sm text-neutral-800"><span>{actionError}</span><button type="button" onClick={() => setActionError('')} className="text-xs underline">关闭</button></div>}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {([['all', '全部活动', adminPromotions.length, 'bg-neutral-900'], ...PROMO_TYPES.map(t => [t.k, t.t.split('/')[0], typeStats[t.k] || 0, t.accent])] as const).map(([k, t, v, c]) => (
          <button key={k as string} onClick={() => setTab(k as any)} className={`p-4 rounded-2xl border-2 text-left transition ${tab === k ? 'border-neutral-900 bg-white shadow-md' : 'border-transparent bg-white/70 hover:bg-white'}`}>
            <div className={`w-9 h-9 rounded-xl ${c} text-white flex items-center justify-center mb-3`}>
              <span className="font-black text-sm tabular-nums">{v as number}</span>
            </div>
            <div className="text-sm font-black text-neutral-950">{t as string}</div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative max-w-md flex-1">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索促销名称、描述或券码 RUDA20 ..."
            className="w-full pl-11 pr-4 py-3 rounded-2xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none transition" />
        </div>
        <span className="ml-auto text-xs text-neutral-500">共 {filtered.length} 条结果</span>
      </div>

      <div className={`grid md:grid-cols-2 xl:grid-cols-3 gap-5 ${embedded ? '' : 'pb-10'}`}>
        {filtered.map(p => {
          const meta = PROMO_TYPES.find(t => t.k === p.type) || PROMO_TYPES[0];
          const Ic = meta.ic;
          return (
            <div key={p.id} className="bg-white rounded-2xl border border-neutral-200 overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300">
              <div className={`${meta.accent} px-5 py-4 text-white flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center"><Ic className="w-5 h-5" /></div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest opacity-80 font-bold">{meta.t}</div>
                    <div className="text-xs opacity-90">{p.scope === 'sitewide' ? '全站' : p.scope === 'merchant' ? '商户专属' : p.scope === 'consumer_tier' ? '会员等级' : '指定商品'}</div>
                  </div>
                </div>
                <button onClick={() => void togglePromotion(p.id, !p.isActive)} className="text-white/90 hover:text-white transition">
                  {p.isActive ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7 opacity-70" />}
                </button>
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between mb-3 gap-2">
                  <h3 className="font-black text-lg text-neutral-950 leading-snug">{p.name}</h3>
                  {p.code && <span className="shrink-0 px-2.5 py-1 rounded-lg bg-neutral-50 border border-neutral-200 font-mono font-black text-[10px] text-neutral-700 tracking-wider">{p.code}</span>}
                </div>
                {p.description && <p className="text-xs text-neutral-500 leading-6 mb-4 line-clamp-2">{p.description}</p>}
                <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
                  {p.percentOff && <div className="p-2.5 rounded-xl bg-neutral-50 text-neutral-800"><span className="font-black text-lg mr-1">{p.percentOff}%</span> OFF</div>}
                  {p.fixedAmountOff && <div className="p-2.5 rounded-xl bg-neutral-50 text-neutral-800"><span className="font-black text-lg mr-1">-{formatMoney(p.fixedAmountOff)}</span>直减</div>}
                  {p.minSubtotal && <div className="p-2.5 rounded-xl bg-neutral-50 text-neutral-800">门槛 {formatMoney(p.minSubtotal)}+</div>}
                  {(p.buyQty && p.getQty) && <div className="col-span-2 p-2.5 rounded-xl bg-neutral-50 text-neutral-800">买 {p.buyQty} 赠 {p.getQty} {p.getPercentOff ? ` · 赠 ${p.getPercentOff}% OFF` : ''}</div>}
                </div>
                <div className="flex items-center justify-between text-[11px] text-neutral-500 mb-4 pt-3 border-t border-neutral-200/70">
                  <span>{new Date(p.startsAt).toLocaleDateString()} 生效</span>
                  {p.expiresAt ? <span>至 {new Date(p.expiresAt).toLocaleDateString()}</span> : <span className="text-neutral-600 font-bold">● 永久有效</span>}
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4 text-center text-[10px]">
                  <div className="p-2 rounded-lg bg-neutral-50"><div className="font-black text-sm tabular-nums">{p.totalUsedCount ?? 0}</div><div className="text-neutral-500 mt-0.5">已核销</div></div>
                  <div className="p-2 rounded-lg bg-neutral-50"><div className="font-black text-sm tabular-nums">{p.totalUsageLimit ?? '∞'}</div><div className="text-neutral-500 mt-0.5">上限</div></div>
                  <div className="p-2 rounded-lg bg-neutral-50"><div className="font-black text-sm tabular-nums text-neutral-800">{p.isActive ? 'ON' : 'OFF'}</div><div className="text-neutral-500 mt-0.5">状态</div></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setActionError(''); setTiersJsonDraft(JSON.stringify(p.tiers || [], null, 2)); setEditing(p); }} className="flex-1 ui-secondary-button !py-2 !text-xs flex items-center justify-center gap-1.5"><Edit2 className="w-3.5 h-3.5" /> 编辑</button>
                  <button onClick={() => { if (confirm('确认删除该促销活动？')) void removePromotion(p.id); }} className="w-11 h-9 rounded-xl border border-neutral-300 text-neutral-700 hover:bg-neutral-100 flex items-center justify-center transition">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {!loading && !loadError && filtered.length === 0 && (
          <div className="md:col-span-2 xl:col-span-3 ui-card p-16 text-center">
            <Tag className="w-16 h-16 mx-auto mb-4 text-neutral-300" />
            <h3 className="font-black text-xl mb-2">暂无匹配的促销活动</h3>
            <p className="text-sm text-neutral-500 mb-6">点击右上角"创建新促销"开始配置您的第一个营销活动。</p>
          </div>
        )}
        {loading && <div className="md:col-span-2 xl:col-span-3 ui-card p-12 text-center text-sm text-neutral-500">正在读取促销活动…</div>}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !saving && setEditing(null)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 md:px-8 py-5 border-b border-neutral-200/70 sticky top-0 bg-white/95 backdrop-blur z-10">
              <h2 className="font-black text-xl md:text-2xl text-neutral-950 flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-800 flex items-center justify-center"><Plus className="w-5 h-5" /></div>
                {editing.id ? '编辑促销活动' : '创建新促销活动'}
              </h2>
              <button onClick={() => !saving && setEditing(null)} disabled={saving} className="w-10 h-10 rounded-xl hover:bg-neutral-100 flex items-center justify-center transition disabled:opacity-40">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 md:p-8 space-y-6">
              {actionError && <p role="alert" className="rounded-xl border border-neutral-300 bg-neutral-50 p-3 text-xs text-neutral-800">{actionError}</p>}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {PROMO_TYPES.map(t => {
                  const Ic = t.ic;
                  return (
                    <button key={t.k} onClick={() => patch('type', t.k)} className={`p-3 rounded-2xl border-2 text-left transition ${editing.type === t.k ? 'border-neutral-900 bg-neutral-50 shadow-sm' : 'border-neutral-200 hover:border-neutral-400'}`}>
                      <div className={`w-8 h-8 rounded-lg ${t.accent} text-white flex items-center justify-center mb-2`}><Ic className="w-4 h-4" /></div>
                      <div className="text-[10px] font-bold text-neutral-900 leading-snug line-clamp-2">{t.t}</div>
                    </button>
                  );
                })}
              </div>

              <div className="grid md:grid-cols-2 gap-5">
                <label className="block md:col-span-2"><span className="ui-section-title block mb-1.5">促销标题 *</span><input required value={editing.name || ''} onChange={e => patch('name', e.target.value)} placeholder="黑色星期五 · 全场 20% OFF" className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
                <label className="block md:col-span-2"><span className="ui-section-title block mb-1.5">描述（前台展示）</span><textarea rows={2} value={editing.description || ''} onChange={e => patch('description', e.target.value)} placeholder="限 RUDA 零售端，全场正价商品参与，特例品除外" className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none resize-none" /></label>
                <label className="block"><span className="ui-section-title block mb-1.5">生效范围</span>
                  <select value={editing.scope || 'sitewide'} onChange={e => {
                    patch('scope', e.target.value as PromotionRule['scope']);
                    patch('merchantIds', []);
                    patch('categoryIds', []);
                    patch('productIds', []);
                  }} className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none">
                    <option value="sitewide">全站</option>
                    <option value="merchant">指定商户</option>
                    <option value="category">指定品类</option>
                    <option value="product">指定商品</option>
                    <option value="consumer_tier" disabled>消费者等级（暂不支持配置）</option>
                  </select>
                </label>
                {editing.scope === 'merchant' && <fieldset className="md:col-span-2 rounded-xl border border-neutral-200 p-4">
                  <legend className="px-1 text-xs font-bold text-neutral-800">指定商户目标 *</legend>
                  <div className="grid max-h-48 gap-2 overflow-auto sm:grid-cols-2">
                    {merchants.map(merchant => <label key={merchant.id} className="flex items-center gap-2 rounded-lg border border-neutral-100 p-2 text-xs text-neutral-700">
                      <input type="checkbox" checked={editing.merchantIds?.includes(merchant.id) ?? false} onChange={() => toggleTarget('merchantIds', merchant.id)} className="accent-neutral-900" />
                      <span>{merchant.name} · {merchant.code}</span>
                    </label>)}
                    {(editing.merchantIds ?? []).filter(id => !merchants.some(merchant => merchant.id === id)).map(id => <label key={id} className="flex items-center gap-2 rounded-lg border border-neutral-300 p-2 text-xs text-neutral-600">
                      <input type="checkbox" checked onChange={() => toggleTarget('merchantIds', id)} className="accent-neutral-900" />Unavailable merchant: {id}
                    </label>)}
                  </div>
                  {!merchants.length && <p className="text-xs text-neutral-600">商户列表为空，暂不能配置指定商户促销。</p>}
                </fieldset>}
                {editing.scope === 'category' && <fieldset className="md:col-span-2 rounded-xl border border-neutral-200 p-4">
                  <legend className="px-1 text-xs font-bold text-neutral-800">指定商品品类 *</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {categoryOptions.map(category => <label key={category} className="flex items-center gap-2 rounded-lg border border-neutral-100 p-2 text-xs text-neutral-700">
                      <input type="checkbox" checked={editing.categoryIds?.includes(category) ?? false} onChange={() => toggleTarget('categoryIds', category)} className="accent-neutral-900" />{category}
                    </label>)}
                    {(editing.categoryIds ?? []).filter(category => !categoryOptions.includes(category)).map(category => <label key={category} className="flex items-center gap-2 rounded-lg border border-neutral-300 p-2 text-xs text-neutral-600">
                      <input type="checkbox" checked onChange={() => toggleTarget('categoryIds', category)} className="accent-neutral-900" />Unavailable category: {category}
                    </label>)}
                  </div>
                  {!categoryOptions.length && <p className="text-xs text-neutral-600">当前没有可选择的商品品类，不能保存指定品类促销。</p>}
                </fieldset>}
                {editing.scope === 'product' && <fieldset className="md:col-span-2 rounded-xl border border-neutral-200 p-4">
                  <legend className="px-1 text-xs font-bold text-neutral-800">指定商品目标 *</legend>
                  <div className="grid max-h-48 gap-2 overflow-auto sm:grid-cols-2">
                    {products.map(product => <label key={product.id} className="flex items-center gap-2 rounded-lg border border-neutral-100 p-2 text-xs text-neutral-700">
                      <input type="checkbox" checked={editing.productIds?.includes(product.id) ?? false} onChange={() => toggleTarget('productIds', product.id)} className="accent-neutral-900" />
                      <span>{product.styleNo} · {product.name}</span>
                    </label>)}
                    {(editing.productIds ?? []).filter(id => !products.some(product => product.id === id)).map(id => <label key={id} className="flex items-center gap-2 rounded-lg border border-neutral-300 p-2 text-xs text-neutral-600">
                      <input type="checkbox" checked onChange={() => toggleTarget('productIds', id)} className="accent-neutral-900" />Unavailable product: {id}
                    </label>)}
                  </div>
                  {!products.length && <p className="text-xs text-neutral-600">商品列表为空，暂不能配置指定商品促销。</p>}
                </fieldset>}
                <label className="block"><span className="ui-section-title block mb-1.5">适用业务</span>
                  <select value={editing.appliesOn || 'both'} onChange={e => patch('appliesOn', e.target.value as PromotionRule['appliesOn'])} className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none">
                    <option value="both">批发与零售</option>
                    <option value="wholesale">仅批发</option>
                    <option value="retail">仅零售</option>
                  </select>
                </label>
                <label className="block"><span className="ui-section-title block mb-1.5">券码 Coupon Code</span><input value={editing.code || ''} onChange={e => patch('code', e.target.value.toUpperCase())} placeholder="RUDA20 / NEW20 / BLACK15" className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm font-mono uppercase focus:border-neutral-900 focus:outline-none" /></label>
                {editing.type === 'percent_discount' && <label className="block"><span className="ui-section-title block mb-1.5">折扣 % OFF *</span><input type="number" min={1} max={99} value={editing.percentOff ?? ''} onChange={e => patch('percentOff', Number(e.target.value) || undefined)} placeholder="20" className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>}
                {(editing.type === 'fixed_amount' || editing.type === 'tiered_discount' || editing.type === 'bundle_deal') && <label className="block"><span className="ui-section-title block mb-1.5">固定减免 EUR</span><input type="number" min={0} step="0.01" value={editing.fixedAmountOff ?? ''} onChange={e => patch('fixedAmountOff', Number(e.target.value) || undefined)} placeholder="20" className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>}
                <label className="block"><span className="ui-section-title block mb-1.5">最低消费门槛 €</span><input type="number" min={0} step="0.01" value={editing.minSubtotal ?? ''} onChange={e => patch('minSubtotal', Number(e.target.value) || 0)} className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
                {editing.type === 'bundle_deal' && <>
                  <label className="block"><span className="ui-section-title block mb-1.5">组合最低件数 *</span><input type="number" min={1} value={editing.minQty ?? ''} onChange={e => patch('minQty', Number(e.target.value) || undefined)} className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
                  <label className="block"><span className="ui-section-title block mb-1.5">组合折扣 %（或使用固定减免）</span><input type="number" min={0} max={100} value={editing.percentOff ?? ''} onChange={e => patch('percentOff', Number(e.target.value) || undefined)} className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
                </>}
                {editing.type === 'tiered_discount' && <label className="block md:col-span-2"><span className="ui-section-title block mb-1.5">阶梯规则 JSON *</span><textarea rows={4} value={tiersJsonDraft} onChange={e => setTiersJsonDraft(e.target.value)} placeholder={'[{"thresholdAmount":100,"percentOff":10},{"thresholdQty":10,"percentOff":15}]'} className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 font-mono text-xs focus:border-neutral-900 focus:outline-none" /><span className="mt-1 block text-[10px] text-neutral-500">每档至少填写消费门槛或件数门槛，以及 0–100 的 percentOff。</span></label>}
                {editing.type === 'buy_x_get_y' && (
                  <>
                    <label className="block"><span className="ui-section-title block mb-1.5">买 X 件</span><input type="number" min={1} value={editing.buyQty ?? ''} onChange={e => patch('buyQty', Number(e.target.value) || undefined)} className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
                    <label className="block"><span className="ui-section-title block mb-1.5">赠 Y 件</span><input type="number" min={1} value={editing.getQty ?? ''} onChange={e => patch('getQty', Number(e.target.value) || undefined)} className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
                    <label className="block md:col-span-2"><span className="ui-section-title block mb-1.5">赠品折扣百分比（100 = 免费）</span><input type="number" min={0} max={100} value={editing.getPercentOff ?? 100} onChange={e => patch('getPercentOff', Number(e.target.value))} placeholder="100" className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
                  </>
                )}
                <label className="block"><span className="ui-section-title block mb-1.5">总核销上限 (留空不限)</span><input type="number" min={1} value={editing.totalUsageLimit ?? ''} onChange={e => patch('totalUsageLimit', Number(e.target.value) || undefined)} placeholder="1000" className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
                <label className="block"><span className="ui-section-title block mb-1.5">开始日期</span><input type="date" value={(editing.startsAt || '').toString().slice(0, 10)} onChange={e => patch('startsAt', new Date(e.target.value).toISOString())} className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
                <label className="block"><span className="ui-section-title block mb-1.5">结束日期（留空=永久）</span><input type="date" value={editing.expiresAt ? editing.expiresAt.toString().slice(0, 10) : ''} onChange={e => patch('expiresAt', e.target.value ? new Date(e.target.value).toISOString() : undefined)} className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
                <label className="flex items-center gap-3 p-4 rounded-xl bg-neutral-50 cursor-pointer col-span-2">
                  <input type="checkbox" checked={editing.isActive} onChange={e => patch('isActive', e.target.checked)} className="w-5 h-5 accent-neutral-900" />
                  <div>
                    <div className="font-bold text-sm text-neutral-900">立即启用</div>
                    <div className="text-xs text-neutral-500">保存后该促销立即进入引擎计算</div>
                  </div>
                  {editing.isActive ? <ToggleRight className="w-8 h-8 ml-auto text-neutral-900" /> : <ToggleLeft className="w-8 h-8 ml-auto text-neutral-400" />}
                </label>
              </div>
            </div>
            <div className="px-6 md:px-8 py-5 border-t border-neutral-200/70 sticky bottom-0 bg-gradient-to-t from-white to-white/90 flex justify-end gap-3 backdrop-blur">
              <button onClick={() => !saving && setEditing(null)} disabled={saving} className="ui-secondary-button px-6 py-3 text-sm disabled:opacity-40">取消</button>
              <button onClick={submit} disabled={saving || !editing.name} className="ui-primary-button px-7 py-3 text-sm flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                {saving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 保存中...</> : <><Check className="w-4 h-4" /> 保存并启用</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

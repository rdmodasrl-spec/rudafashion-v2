import React, { useEffect, useRef, useState } from 'react';
import { useB2B } from '../../../../context/B2BContext';
import { Building2, Upload, CheckCircle2, FileCheck, UserCheck, ArrowLeft, Shield, Truck, Percent, Mail, Phone, MapPin, Globe, CreditCard, Bot, Activity, ShieldCheck, Store, BrainCircuit, Search, Palette, Rocket } from 'lucide-react';
import { apiPost } from '../../../../api/client';

const ZONE_OPTIONS = [
  { v: 'iolo', t: '服装现货区', d: '现货批发 / 快速返单' },
  { v: 'tavoro', t: '服装订货区', d: '订货会 / 期货生产' },
  { v: 'leather', t: '精品皮包区', d: '箱包与皮具专营' },
  { v: 'boutique_department', t: '精品百货区', d: '综合精品百货零售' },
] as const;

const STYLE_OPTIONS = [
  { v: 'growth', t: '🚀 快速增长', d: '优先冲流量与订单量' },
  { v: 'margin', t: '💰 注重利润', d: '优先保证客单与毛利' },
  { v: 'brand', t: '🎨 注重品牌', d: '优先视觉与品牌调性' },
  { v: 'automation', t: '🤖 尽可能自动化', d: '交给 AI 团队自主决策' },
  { v: 'test', t: '🧪 先小规模测试', d: '先跑通再逐步放量' },
] as const;

// AI 团队花名册：提交后按顺序“报到发言”，营造平台已为商家配好一整支 AI 员工团队的感觉。
// name 为占位角色名，manager 项会在渲染时替换成用户为 AI 店长起的名字。
const AI_ROSTER: { ic: typeof ShieldCheck; name: string; quote: string; system?: boolean; manager?: boolean }[] = [
  { ic: ShieldCheck, name: 'AI 资质核验专员', quote: '企业与品牌资质核验通过', system: true },
  { ic: BrainCircuit, name: 'AI 店长', quote: '我来负责统筹整个店铺的运营决策。', manager: true },
  { ic: Search, name: 'AI 选品师', quote: '我来帮你寻找和分析值得上架的商品。' },
  { ic: Palette, name: 'AI 设计师', quote: '我来负责店铺视觉、Banner 和商品图片。' },
  { ic: Activity, name: 'AI 运营', quote: '我来负责商品文案、活动和营销。' },
  { ic: Bot, name: 'AI 客服', quote: '我来负责接待你的每一位买手和客户。' },
  { ic: Store, name: '专属店铺', quote: '框架搭建完成，AI 团队集结完毕！', system: true },
] as const;

export const MerchantOnboarding: React.FC = () => {
  const {
    addNotification,
    setCurrentView,
    merchantOnboardingPrefill,
    setMerchantOnboardingPrefill
  } = useB2B();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [namingManager, setNamingManager] = useState(false);
  const [managerName, setManagerName] = useState('');
  const [operatingStyle, setOperatingStyle] = useState<typeof STYLE_OPTIONS[number]['v']>('growth');
  const [provisioning, setProvisioning] = useState(false);
  const [rosterIndex, setRosterIndex] = useState(0);
  const [rosterComplete, setRosterComplete] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const pendingApplicationId = useRef<string | null>(null);
  const [form, setForm] = useState({
    brandName: '', brandNameIt: '', brandNameZh: '', legalCompanyName: '',
    vatId: '', taxCode: '', country: 'Italy', city: '', address: '', postalCode: '',
    phone: '', supportEmail: '', website: '',
    ownerFirstName: '', ownerLastName: '', ownerEmail: '', ownerPhone: '', ownerIdType: 'PASSPORT', ownerIdNumber: '',
    businessType: 'wholesale' as 'wholesale' | 'retail' | 'both',
    merchantZone: 'iolo' as 'iolo' | 'tavoro' | 'leather' | 'boutique_department',
    categories: [] as string[],
    estimatedSkus: 50, avgWholesalePrice: 25, targetMargin: 2.2,
    bankAccountHolder: '', bankIban: '', bankBic: '', bankName: '',
    platformFee: 8, agreeToS: false, agreePrivacy: false, agreeAuthenticity: false,
    bio: '', tagline: '',
  });
  const cats = ['dresses', 'tops', 'knitwear', 'outerwear', 'pants', 'skirts', 'accessories', 'shoes', 'bags', 'lingerie', 'kids'];
  const patch = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const toggleCat = (c: string) => patch('categories', form.categories.includes(c) ? form.categories.filter(x => x !== c) : [...form.categories, c]);
  const [onboardingIndustrySummary, setOnboardingIndustrySummary] = useState<string[]>([]);

  useEffect(() => {
    if (!merchantOnboardingPrefill) return;
    const supportedTypes = merchantOnboardingPrefill.businessTypeIds.filter(id =>
      ['wholesale', 'apparel', 'leather', 'department', 'retail'].includes(id)
    );
    if (supportedTypes.length) {
      const selectedZone = supportedTypes.includes('leather')
        ? 'leather'
        : supportedTypes.includes('department')
          ? 'boutique_department'
          : supportedTypes.includes('apparel')
            ? 'tavoro'
            : 'iolo';
      const selectedBusinessType = ['retail_only'].includes(merchantOnboardingPrefill.operatingModeId || '')
        ? 'retail'
        : ['wholesale_retail', 'store_online'].includes(merchantOnboardingPrefill.operatingModeId || '')
          ? 'both'
          : 'wholesale';
      setForm(current => ({
        ...current,
        city: merchantOnboardingPrefill.city?.trim().slice(0, 120) || current.city,
        merchantZone: selectedZone,
        businessType: selectedBusinessType
      }));
      setOnboardingIndustrySummary(supportedTypes);
    }
    setMerchantOnboardingPrefill(null);
  }, [merchantOnboardingPrefill, setMerchantOnboardingPrefill]);

  // AI 团队“报到”动画：逐个揭示名单，全部到齐后再进入成功页
  useEffect(() => {
    if (!provisioning) return;
    if (rosterIndex >= AI_ROSTER.length) {
      const t = setTimeout(() => setRosterComplete(true), 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setRosterIndex(i => i + 1), 850);
    return () => clearTimeout(t);
  }, [provisioning, rosterIndex]);

  const steps = [
    { n: 1, t: '品牌信息', d: '企业资质', ic: Building2 },
    { n: 2, t: '法人与联系', d: '负责人资料', ic: UserCheck },
    { n: 3, t: '经营范围', d: '品类与定价', ic: Truck },
    { n: 4, t: '结算与条款', d: '费率与银行', ic: CreditCard },
  ];

  const next = () => {
    if (step === 1 && (!form.brandName || !form.legalCompanyName || !form.vatId)) { alert('请完整填写品牌名称、公司抬头和增值税号'); return; }
    if (step === 2 && (!form.ownerFirstName || !form.ownerLastName || !form.ownerEmail)) { alert('请完整填写法人姓名与联系邮箱'); return; }
    if (step === 3 && form.categories.length === 0) { alert('请至少选择 1 个主营品类'); return; }
    setStep(s => Math.min(4, s + 1));
  };
  const prev = () => setStep(s => Math.max(1, s - 1));

  const openNaming = () => {
    if (!form.agreeToS || !form.agreePrivacy || !form.agreeAuthenticity) { alert('请阅读并同意平台条款、隐私政策及正品承诺'); return; }
    setNamingManager(true);
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await apiPost<{ applicationId?: string; applicationNo?: string; message?: string }>('/api/onboarding/merchant/submit', form);
      if (res && res.applicationId) {
        pendingApplicationId.current = res.applicationNo || res.applicationId;
        setNamingManager(false);
        setRosterIndex(0);
        setRosterComplete(false);
        setProvisioning(true);
        addNotification('success', '商户入驻申请已提交', `申请号 ${(res.applicationNo || res.applicationId).slice(0, 14)}…，审核结果将在 48 小时内通过邮件通知。`);
      } else {
        addNotification('warning', '提交失败', res?.message || '请检查表单后重试');
      }
    } catch (e: any) {
      addNotification('warning', '提交失败', e?.message || '网络异常');
    } finally {
      setSubmitting(false);
    }
  };

  if (namingManager) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-16 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
        <div className="max-w-lg w-full">
          <div className="ui-card bg-white p-8 md:p-10 shadow-2xl">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white flex items-center justify-center shadow-lg">
              <BrainCircuit className="w-8 h-8" />
            </div>
            <h1 className="font-serif font-black text-2xl md:text-3xl mb-3 text-center text-neutral-950">先认识你的 AI 店长</h1>
            <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/70 text-sm text-neutral-600 leading-6 mb-6">
              "你好，我是你的 AI 店长。从今天开始，我会帮你安排其他 AI 员工，和你一起把店开起来。"
            </div>
            <label className="block mb-6">
              <span className="ui-section-title block mb-1.5">给你的 AI 店长起个名字</span>
              <input value={managerName} onChange={e => setManagerName(e.target.value)} placeholder="例如：小智 / Alex / Luna" className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" />
            </label>
            <div className="mb-8">
              <span className="ui-section-title block mb-3">你的经营风格是什么？</span>
              <div className="grid grid-cols-1 gap-2">
                {STYLE_OPTIONS.map(s => (
                  <label key={s.v} className={`flex items-center justify-between p-3.5 rounded-xl border-2 cursor-pointer transition ${operatingStyle === s.v ? 'border-neutral-900 bg-neutral-50 shadow-sm' : 'border-neutral-200 hover:border-neutral-400 bg-white'}`}>
                    <input type="radio" className="sr-only" name="style" checked={operatingStyle === s.v} onChange={() => setOperatingStyle(s.v)} />
                    <div>
                      <div className="font-bold text-sm text-neutral-900">{s.t}</div>
                      <div className="text-xs text-neutral-500">{s.d}</div>
                    </div>
                    {operatingStyle === s.v && <CheckCircle2 className="w-5 h-5 text-neutral-900 shrink-0" />}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-col md:flex-row gap-3">
              <button onClick={() => setNamingManager(false)} className="ui-secondary-button px-6 py-3 text-sm flex items-center justify-center gap-2"><ArrowLeft className="w-4 h-4" /> 返回修改</button>
              <button onClick={submit} disabled={submitting} className="ui-primary-button flex-1 px-8 py-3.5 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60">
                {submitting ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 提交中...</> : <><Rocket className="w-4 h-4" /> 任命 AI 店长，提交申请</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (provisioning) {
    const displayManagerName = managerName.trim() || 'AI 店长';
    if (rosterComplete) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4 py-16 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
          <div className="max-w-lg w-full text-center onboarding-roster-enter">
            <div className="onboarding-badge-pulse w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-2xl shadow-amber-500/20">
              <Rocket className="w-10 h-10" />
            </div>
            <h1 className="font-serif font-black text-2xl md:text-3xl mb-2 text-white">你的 AI 团队已经就位</h1>
            <p className="text-sm text-neutral-400 mb-7">你负责决策，AI 团队负责执行。</p>
            <div className="rounded-2xl bg-white/5 border border-white/10 divide-y divide-white/10 text-left mb-8 overflow-hidden">
              <div className="flex items-center gap-3 p-3.5"><span className="text-lg">👤</span><div><div className="text-sm font-bold text-white">你</div><div className="text-xs text-neutral-400">创始人</div></div></div>
              {AI_ROSTER.filter(m => !m.system).map(m => (
                <div key={m.name} className="flex items-center gap-3 p-3.5">
                  <div className="w-8 h-8 shrink-0 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center"><m.ic className="w-4 h-4" /></div>
                  <div>
                    <div className="text-sm font-bold text-white">{m.manager ? `${displayManagerName}（AI 店长）` : m.name}</div>
                    <div className="text-xs text-neutral-400">{m.manager ? '团队负责人' : '已就位'}</div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setDone(pendingApplicationId.current)} className="w-full ui-primary-button px-8 py-4 text-sm font-bold flex items-center justify-center gap-2">
              <Rocket className="w-4 h-4" /> 和我的 AI 团队一起开店
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-16 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
        <div className="max-w-xl w-full text-center">
          <div className="onboarding-badge-pulse w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-2xl shadow-amber-500/20">
            <Store className="w-10 h-10" />
          </div>
          <h1 className="font-serif font-black text-2xl md:text-3xl mb-2 text-white">正在组建你的开店团队…</h1>
          <p className="text-sm text-neutral-400 mb-8">{displayManagerName} 正在召集其他 AI 员工，请稍候片刻…</p>

          <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden mb-8">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-700 ease-out"
              style={{ width: `${Math.min(100, (rosterIndex / AI_ROSTER.length) * 100)}%` }}
            />
          </div>

          <div className="space-y-3 text-left">
            {AI_ROSTER.map((member, i) => {
              const arrived = i < rosterIndex;
              const active = i === rosterIndex;
              if (!arrived && !active) return null;
              const Ic = member.ic;
              const displayName = member.manager ? `${displayManagerName}（AI 店长）` : member.name;
              return (
                <div
                  key={member.name}
                  className={`onboarding-roster-enter flex items-center gap-3 p-3.5 rounded-2xl border transition ${arrived ? 'bg-emerald-500/10 border-emerald-400/30' : 'bg-white/5 border-white/10'}`}
                >
                  <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${arrived ? 'bg-emerald-500 text-white' : 'bg-white/10 text-amber-300'}`}>
                    {arrived ? <CheckCircle2 className="onboarding-checkmark-pop w-5 h-5" /> : <Ic className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white">{displayName}</div>
                    <div className="text-xs text-neutral-400 truncate">{active ? '正在报到...' : `“${member.quote}”`}</div>
                  </div>
                  {active && <div className="w-4 h-4 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-16">
        <div className="max-w-2xl w-full text-center ui-card p-10 md:p-14">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white flex items-center justify-center shadow-xl">
            <CheckCircle2 className="w-12 h-12" />
          </div>
          <h1 className="font-serif font-black text-3xl md:text-4xl mb-3 text-neutral-950">入驻申请提交成功 🎉</h1>
          <p className="text-sm text-neutral-500 mb-2 leading-7">RUDA Fashion 欢迎优质品牌商加入！您的申请将在 <b className="text-neutral-900">24-48 小时</b>内由平台招商团队审核。<br />申请编号：</p>
          <div className="inline-block px-5 py-3 rounded-2xl bg-amber-50 border border-amber-200 font-mono font-black text-lg text-amber-900 mb-4 shadow-inner">
            {done.toUpperCase()}
          </div>
          <p className="text-xs text-emerald-700 font-semibold mb-6 flex items-center justify-center gap-1.5"><Bot className="w-4 h-4" /> 您的专属 AI 团队已在后台集结待命，审核通过即可直接上岗为店铺服务</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-10 text-xs">
            {[
              { ic: <Mail className="w-5 h-5" />, t: '邮件通知', d: form.ownerEmail },
              { ic: <Shield className="w-5 h-5" />, t: '资质审核', d: '48 小时内' },
              { ic: <Percent className="w-5 h-5" />, t: '约定费率', d: `${form.platformFee}% 平台佣金` },
            ].map((x, i) => (
              <div key={i} className="p-5 rounded-2xl bg-gradient-to-br from-neutral-50 to-neutral-100 border border-neutral-200/70">
                <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-neutral-900 text-white flex items-center justify-center">{x.ic}</div>
                <div className="font-black text-neutral-900 mb-1">{x.t}</div>
                <div className="text-neutral-500 leading-6">{x.d}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <button onClick={() => setCurrentView('home')} className="ui-primary-button px-7 py-3.5 text-sm">返回首页</button>
            <button onClick={() => setCurrentView('consumer_store')} className="ui-secondary-button px-7 py-3.5 text-sm">逛零售商城</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50/40 via-neutral-50 to-white">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-10 md:py-14">
        <button onClick={() => setCurrentView('home')} className="mb-6 inline-flex items-center gap-1.5 text-xs font-bold text-neutral-500 hover:text-neutral-900 transition">
          <ArrowLeft className="w-3.5 h-3.5" /> 返回 RUDA 首页
        </button>

        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg mb-5">
            <Building2 className="w-8 h-8" />
          </div>
          <h1 className="font-serif font-black text-4xl md:text-5xl mb-3 text-neutral-950">RUDA 商户入驻申请</h1>
          <p className="text-base md:text-lg text-neutral-500 max-w-2xl mx-auto leading-8">
            加入 RUDA Fashion 多渠道 B2B2C 平台，直达 <b className="text-neutral-900">50,000+</b> 全球买手与 <b className="text-neutral-900">200 万+</b> 零售会员，平台提供全链路运营、营销与风控支持。
          </p>
        </div>

        <div className="grid grid-cols-4 gap-2 md:gap-4 mb-8">
          {steps.map(s => {
            const Ic = s.ic;
            const active = step === s.n;
            const done = step > s.n;
            return (
              <button key={s.n} onClick={() => { if (step > s.n) setStep(s.n); }} className={`p-3 md:p-4 rounded-2xl border-2 transition text-left ${active ? 'border-neutral-900 bg-white shadow-lg scale-[1.02]' : done ? 'border-emerald-300 bg-emerald-50' : 'border-transparent bg-white/60'}`}>
                <div className={`w-10 h-10 mb-2 md:mb-3 rounded-xl flex items-center justify-center font-black transition ${done ? 'bg-emerald-500 text-white' : active ? 'bg-neutral-900 text-white' : 'bg-neutral-200 text-neutral-500'}`}>
                  {done ? <CheckCircle2 className="w-5 h-5" /> : <s.ic className="w-5 h-5" />}
                </div>
                <div className="text-[11px] md:text-xs font-bold text-neutral-900 leading-tight mb-0.5">{s.t}</div>
                <div className="text-[9px] md:text-[10px] text-neutral-500 truncate">{s.d}</div>
              </button>
            );
          })}
        </div>

        <div className="ui-card p-6 md:p-10 shadow-xl">
          {onboardingIndustrySummary.length > 0 && (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <div className="font-semibold">已带入 AI 识别的行业建议：{onboardingIndustrySummary.join('、')}</div>
              <div className="mt-1 text-xs leading-5">这是你之前确认的预览信息；请检查并在下方自行修改。AI 不会代填资质、银行资料，也不会代你提交申请。</div>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-5 max-w-3xl">
              <h2 className="font-black text-2xl mb-2 flex items-center gap-2"><Building2 className="w-6 h-6 text-amber-600" /> 品牌与企业资质</h2>
              <p className="text-sm text-neutral-500 mb-6">请填写品牌与主体公司信息，用于平台招商团队的资质审核。</p>
              <div className="grid md:grid-cols-2 gap-5">
                <label className="block md:col-span-2"><span className="ui-section-title block mb-1.5">品牌名称 (英文/国际通用) *</span><input value={form.brandName} onChange={e => patch('brandName', e.target.value)} placeholder="例: Milano Atelier" className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
                <label className="block"><span className="ui-section-title block mb-1.5">品牌名 (意大利语)</span><input value={form.brandNameIt} onChange={e => patch('brandNameIt', e.target.value)} placeholder="Atelier Milano" className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
                <label className="block"><span className="ui-section-title block mb-1.5">品牌名 (中文)</span><input value={form.brandNameZh} onChange={e => patch('brandNameZh', e.target.value)} placeholder="米兰工坊" className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
                <label className="block md:col-span-2"><span className="ui-section-title block mb-1.5">公司法定名称 *</span><input value={form.legalCompanyName} onChange={e => patch('legalCompanyName', e.target.value)} placeholder="S.R.L. / LTD / 有限公司全称" className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
                <label className="block"><span className="ui-section-title block mb-1.5">VAT / 增值税号 *</span><input value={form.vatId} onChange={e => patch('vatId', e.target.value.toUpperCase())} placeholder="IT 12345670987" className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm font-mono focus:border-neutral-900 focus:outline-none" /></label>
                <label className="block"><span className="ui-section-title block mb-1.5">税号 / TAX ID</span><input value={form.taxCode} onChange={e => patch('taxCode', e.target.value.toUpperCase())} className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm font-mono focus:border-neutral-900 focus:outline-none" /></label>
                <label className="block"><span className="ui-section-title block mb-1.5">注册国家</span><input value={form.country} onChange={e => patch('country', e.target.value)} className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
                <label className="block"><span className="ui-section-title block mb-1.5">城市 / 展厅所在地</span><input value={form.city} onChange={e => patch('city', e.target.value)} placeholder="Milan / Prato / Florence" className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
                <label className="block md:col-span-2"><span className="ui-section-title block mb-1.5">办公 / 展厅地址</span><input value={form.address} onChange={e => patch('address', e.target.value)} className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
                <label className="block"><span className="ui-section-title block mb-1.5">邮编</span><input value={form.postalCode} onChange={e => patch('postalCode', e.target.value)} className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
                <label className="block"><span className="ui-section-title block mb-1.5">电话 *</span><input value={form.phone} onChange={e => patch('phone', e.target.value)} placeholder="+39 02 ..." className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
                <label className="block"><span className="ui-section-title block mb-1.5">客服邮箱 *</span><input value={form.supportEmail} onChange={e => patch('supportEmail', e.target.value)} type="email" className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
                <label className="block md:col-span-2"><span className="ui-section-title block mb-1.5">品牌独立站 / 社媒</span><div className="relative"><Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" /><input value={form.website} onChange={e => patch('website', e.target.value)} placeholder="https://www.your-brand.com / IG: @..." className="w-full pl-10 pr-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></div></label>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5 max-w-3xl">
              <h2 className="font-black text-2xl mb-2 flex items-center gap-2"><UserCheck className="w-6 h-6 text-sky-600" /> 法定代表人 / 授权联系人</h2>
              <div className="grid md:grid-cols-2 gap-5">
                <label className="block"><span className="ui-section-title block mb-1.5">名 *</span><input value={form.ownerFirstName} onChange={e => patch('ownerFirstName', e.target.value)} className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
                <label className="block"><span className="ui-section-title block mb-1.5">姓 *</span><input value={form.ownerLastName} onChange={e => patch('ownerLastName', e.target.value)} className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
                <label className="block"><span className="ui-section-title block mb-1.5">邮箱 *</span><input type="email" value={form.ownerEmail} onChange={e => patch('ownerEmail', e.target.value)} className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
                <label className="block"><span className="ui-section-title block mb-1.5">手机 *</span><input value={form.ownerPhone} onChange={e => patch('ownerPhone', e.target.value)} className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
                <label className="block"><span className="ui-section-title block mb-1.5">证件类型</span>
                  <select value={form.ownerIdType} onChange={e => patch('ownerIdType', e.target.value)} className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none">
                    <option value="PASSPORT">护照 Passport</option>
                    <option value="ID_CARD">身份证 ID Card</option>
                    <option value="DRIVERS">驾照 Driving License</option>
                  </select>
                </label>
                <label className="block"><span className="ui-section-title block mb-1.5">证件号码</span><input value={form.ownerIdNumber} onChange={e => patch('ownerIdNumber', e.target.value.toUpperCase())} className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm font-mono focus:border-neutral-900 focus:outline-none" /></label>
              </div>
              <div className="mt-4 p-5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/70">
                <h4 className="font-bold text-neutral-900 mb-2 flex items-center gap-2"><FileCheck className="w-4 h-4 text-amber-600" /> 资质证件上传（供平台审核）</h4>
                <p className="text-xs text-neutral-600 mb-4 leading-6">请上传：营业执照、法人身份证正反面、品牌授权文件或商标注册证书、对公户银行开户证明。审核将在 24 小时内完成。</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {['营业执照', '法人身份证', '品牌/商标证', '开户许可'].map((k, i) => (
                    <label key={k} className="aspect-square rounded-2xl border-2 border-dashed border-amber-300 bg-white flex flex-col items-center justify-center text-amber-700 cursor-pointer hover:bg-amber-100/50 transition p-2 text-center">
                      <Upload className="w-6 h-6 mb-2" />
                      <div className="text-xs font-bold leading-tight">{k}</div>
                      <div className="text-[10px] opacity-70 mt-1">点击上传</div>
                      <input type="file" className="hidden" />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5 max-w-3xl">
              <h2 className="font-black text-2xl mb-2 flex items-center gap-2"><Truck className="w-6 h-6 text-emerald-600" /> 经营范围与商品结构</h2>
              <div>
                <span className="ui-section-title block mb-3">主营品类 (至少 1 项) *</span>
                <div className="flex flex-wrap gap-2">
                  {cats.map(c => (
                    <button key={c} onClick={() => toggleCat(c)} type="button" className={`px-4 py-2.5 rounded-xl text-xs font-bold transition ${form.categories.includes(c) ? 'bg-neutral-900 text-white shadow-md' : 'bg-white border border-neutral-200 text-neutral-700 hover:border-neutral-400'}`}>
                      {c === 'dresses' ? '👗 连衣裙' : c === 'tops' ? '👚 上装' : c === 'knitwear' ? '🧶 针织' : c === 'outerwear' ? '🧥 外套' : c === 'pants' ? '👖 裤装' : c === 'skirts' ? '🩱 半裙' : c === 'accessories' ? '💍 配饰' : c === 'shoes' ? '👠 鞋履' : c === 'bags' ? '👜 包袋' : c === 'lingerie' ? '🩲 内衣' : c === 'kids' ? '🧒 童装' : c}
                    </button>
                  ))}
                </div>
                <div className="mt-3 text-[11px] text-neutral-500">已选 {form.categories.length} 个品类</div>
              </div>
              <div>
                <span className="ui-section-title block mb-3">所属经营专区 *</span>
                <div className="grid md:grid-cols-4 gap-3">
                  {ZONE_OPTIONS.map(z => (
                    <label key={z.v} className={`p-4 rounded-2xl border-2 cursor-pointer transition ${form.merchantZone === z.v ? 'border-neutral-900 bg-neutral-50 shadow-sm' : 'border-neutral-200 hover:border-neutral-400 bg-white'}`}>
                      <input type="radio" className="sr-only" name="zone" checked={form.merchantZone === z.v} onChange={() => patch('merchantZone', z.v)} />
                      <div className="font-bold text-sm text-neutral-900 mb-1">{z.t}</div>
                      <div className="text-xs text-neutral-500 leading-5">{z.d}</div>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <span className="ui-section-title block mb-2">业务模式</span>
                <div className="grid md:grid-cols-3 gap-3">
                  {([
                    ['wholesale', '纯批发 B2B', '只对买手开放采购价'],
                    ['retail', '纯零售 D2C', '仅在 RUDA 零售端销售'],
                    ['both', 'B2B2C 双通道', '批发 + 零售，平台自动分价'],
                  ] as const).map(([k, t, d]) => (
                    <label key={k} className={`p-4 rounded-2xl border-2 cursor-pointer transition ${form.businessType === k ? 'border-neutral-900 bg-neutral-50 shadow-sm' : 'border-neutral-200 hover:border-neutral-400 bg-white'}`}>
                      <input type="radio" className="sr-only" name="bt" checked={form.businessType === k} onChange={() => patch('businessType', k)} />
                      <div className="font-bold text-sm text-neutral-900 mb-1">{t}</div>
                      <div className="text-xs text-neutral-500 leading-5">{d}</div>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-5">
                <label className="block"><span className="ui-section-title block mb-1.5">SKU 数预估</span><input type="number" value={form.estimatedSkus} onChange={e => patch('estimatedSkus', Number(e.target.value))} className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
                <label className="block"><span className="ui-section-title block mb-1.5">平均批发价 €</span><input type="number" step="0.5" value={form.avgWholesalePrice} onChange={e => patch('avgWholesalePrice', Number(e.target.value))} className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
                <label className="block"><span className="ui-section-title block mb-1.5">建议零售倍率</span><input type="number" step="0.1" value={form.targetMargin} onChange={e => patch('targetMargin', Number(e.target.value))} className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
              </div>
              <label className="block"><span className="ui-section-title block mb-1.5">品牌简介 (200-500 字)</span><textarea rows={4} value={form.bio} onChange={e => patch('bio', e.target.value)} placeholder="品牌成立年份、风格定位、明星客户、销售渠道..." className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none resize-none" /></label>
              <label className="block"><span className="ui-section-title block mb-1.5">品牌 slogan / Tagline</span><input value={form.tagline} onChange={e => patch('tagline', e.target.value)} placeholder="例：Timeless Italian elegance for modern women" className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5 max-w-3xl">
              <h2 className="font-black text-2xl mb-2 flex items-center gap-2"><CreditCard className="w-6 h-6 text-violet-600" /> 结算、费率与协议</h2>
              <div className="p-5 rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200/70">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-violet-700 font-black mb-1">平台佣金费率 (默认)</div>
                    <div className="text-3xl md:text-4xl font-black text-neutral-950 tabular-nums">{form.platformFee}<span className="text-xl align-top">%</span></div>
                  </div>
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white flex items-center justify-center shadow-lg">
                    <Percent className="w-8 h-8" />
                  </div>
                </div>
                <input type="range" min={3} max={18} value={form.platformFee} onChange={e => patch('platformFee', Number(e.target.value))} className="w-full accent-violet-600" />
                <div className="flex justify-between text-[10px] text-violet-700 font-bold mt-1">
                  <span>3% (KA 品牌)</span>
                  <span>8% (标准)</span>
                  <span>18% (含代运营)</span>
                </div>
                <p className="text-[11px] text-neutral-500 mt-3 leading-6">实际费率由招商团队根据品牌势能、SKU 数量和年度 GMV 目标确定。提交后平台商务会与您协商最终方案。</p>
              </div>
              <div className="grid md:grid-cols-2 gap-5">
                <label className="block md:col-span-2"><span className="ui-section-title block mb-1.5">银行账户持有人 (与公司一致)</span><input value={form.bankAccountHolder} onChange={e => patch('bankAccountHolder', e.target.value)} className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
                <label className="block"><span className="ui-section-title block mb-1.5">IBAN (欧元区)</span><input value={form.bankIban} onChange={e => patch('bankIban', e.target.value.toUpperCase())} className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm font-mono focus:border-neutral-900 focus:outline-none" /></label>
                <label className="block"><span className="ui-section-title block mb-1.5">BIC / SWIFT</span><input value={form.bankBic} onChange={e => patch('bankBic', e.target.value.toUpperCase())} className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm font-mono focus:border-neutral-900 focus:outline-none" /></label>
                <label className="block md:col-span-2"><span className="ui-section-title block mb-1.5">开户行名称</span><input value={form.bankName} onChange={e => patch('bankName', e.target.value)} placeholder="例: Intesa Sanpaolo S.p.A." className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
              </div>
              <div className="space-y-3 pt-3">
                <label className="flex items-start gap-3 p-4 rounded-2xl bg-neutral-50 hover:bg-neutral-100 transition cursor-pointer">
                  <input type="checkbox" checked={form.agreeToS} onChange={e => patch('agreeToS', e.target.checked)} className="mt-1 w-5 h-5 accent-neutral-900" />
                  <div>
                    <div className="font-bold text-sm text-neutral-900 mb-0.5">《RUDA Fashion 商户入驻服务条款》*</div>
                    <div className="text-xs text-neutral-500 leading-6">我确认已阅读并同意遵守平台商户入驻规则、运营规范、平台交易纠纷处理办法等文件。</div>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-4 rounded-2xl bg-neutral-50 hover:bg-neutral-100 transition cursor-pointer">
                  <input type="checkbox" checked={form.agreePrivacy} onChange={e => patch('agreePrivacy', e.target.checked)} className="mt-1 w-5 h-5 accent-neutral-900" />
                  <div>
                    <div className="font-bold text-sm text-neutral-900 mb-0.5">《隐私与数据处理同意》*</div>
                    <div className="text-xs text-neutral-500 leading-6">我同意平台基于欧盟 GDPR 与中国《个保法》收集并处理我提交的企业与个人身份信息用于审核。</div>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-50 hover:bg-emerald-100/50 transition cursor-pointer border border-emerald-200/70">
                  <input type="checkbox" checked={form.agreeAuthenticity} onChange={e => patch('agreeAuthenticity', e.target.checked)} className="mt-1 w-5 h-5 accent-emerald-600" />
                  <div>
                    <div className="font-bold text-sm text-emerald-900 mb-0.5">《正品与知识产权承诺》*</div>
                    <div className="text-xs text-emerald-800 leading-6">我保证上架销售的所有商品均为正品、来源合法合规、不存在任何知识产权侵权问题，如有违规自愿承担相应赔偿。</div>
                  </div>
                </label>
              </div>
            </div>
          )}

          <div className="mt-10 pt-6 border-t border-neutral-200/70 flex flex-col md:flex-row justify-between gap-3">
            <button onClick={step === 1 ? () => setCurrentView('home') : prev} className="ui-secondary-button px-6 py-3 text-sm flex items-center gap-2">
              {step === 1 ? <>返回首页</> : <><ArrowLeft className="w-4 h-4" /> 上一步</>}
            </button>
            <div className="text-xs text-neutral-400 self-center">Step {step} / 4</div>
            {step < 4 ? (
              <button onClick={next} className="ui-primary-button px-7 py-3 text-sm flex items-center gap-2 ml-auto md:ml-0">下一步 →</button>
            ) : (
              <button onClick={openNaming} disabled={submitting} className="ui-primary-button px-8 py-3.5 text-sm font-bold flex items-center gap-2 disabled:opacity-60 ml-auto md:ml-0">
                <FileCheck className="w-4 h-4" /> 立即提交入驻申请
              </button>
            )}
          </div>
        </div>

        <div className="mt-12 grid md:grid-cols-3 gap-5 text-sm">
          {[
            { ic: <Shield className="w-6 h-6" />, t: '平台 7×24 风控保障', d: '反欺诈、账期管理、争议仲裁，交易无忧。' },
            { ic: <Truck className="w-6 h-6" />, t: '全链路物流打通', d: 'RUDA 合作仓配 DHL/GLS/顺丰，一单到底可追踪。' },
            { ic: <Percent className="w-6 h-6" />, t: '多渠道营销流量', d: 'B2B 分销 + 零售商城 + 买手私域，多元获客。' },
          ].map((x, i) => (
            <div key={i} className="p-5 rounded-2xl bg-white/80 border border-neutral-200/70 backdrop-blur">
              <div className="w-12 h-12 mb-3 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow">{x.ic}</div>
              <h4 className="font-black text-neutral-900 mb-1.5">{x.t}</h4>
              <p className="text-xs text-neutral-500 leading-6">{x.d}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

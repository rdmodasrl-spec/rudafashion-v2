import React, { useMemo, useState } from 'react';
import { useB2B } from '../../../../context/B2BContext';
import {
  ArrowLeft, BrainCircuit, Bot, Search, Palette, Activity, Percent, ShoppingBag,
  UtensilsCrossed, Scissors, Store, Package, Users, MessageCircle, BarChart3,
  Wallet, Globe2, ClipboardList, Star, Boxes, Ruler, ChefHat, Megaphone
} from 'lucide-react';

type Role = { ic: any; name: string; desc: string };
type Module = { ic: any; label: string };

type BusinessType = {
  key: string;
  label: string;
  emoji: string;
  supported: boolean; // 是否已有真实可用的后台功能（目前仅服装/皮具/百货/批发/零售）
  roles: Role[];
  modules: Module[];
};

// 每个行业对应的 AI 团队与后台模块——这是本次“最小可行预览”的核心配置表。
// supported=true 的行业接入的是我们已经真实存在的服装 B2B 后台；其余行业目前只做效果预览，
// 避免出现“看起来能点，实际点了没反应”的假按钮。
const BUSINESS_TYPES: BusinessType[] = [
  {
    key: 'wholesale', label: '批发', emoji: '📦', supported: true,
    roles: [
      { ic: Package, name: 'AI 采购', desc: '负责进货与供应商对接' },
      { ic: Users, name: 'AI 批发客户', desc: '管理批发商与账期' },
    ],
    modules: [{ ic: Package, label: '批发客户' }, { ic: Percent, label: '阶梯价格' }],
  },
  {
    key: 'apparel', label: '服装店', emoji: '👕', supported: true,
    roles: [
      { ic: Search, name: 'AI 选品', desc: '分析爆款与选品建议' },
      { ic: ShoppingBag, name: 'AI 商品员', desc: '维护商品资料与图片' },
    ],
    modules: [{ ic: ShoppingBag, label: '服装商品' }, { ic: Boxes, label: '库存' }],
  },
  {
    key: 'leather', label: '皮具店', emoji: '👜', supported: true,
    roles: [
      { ic: ShoppingBag, name: 'AI 商品员', desc: '维护皮具商品资料' },
    ],
    modules: [{ ic: ShoppingBag, label: '皮具商品' }],
  },
  {
    key: 'department', label: '百货店', emoji: '🏪', supported: true,
    roles: [
      { ic: Boxes, name: 'AI 品类分析师', desc: '跨品类销售结构分析' },
    ],
    modules: [{ ic: Boxes, label: '多品类库存' }],
  },
  {
    key: 'retail', label: '零售店', emoji: '🛍️', supported: true,
    roles: [
      { ic: Users, name: 'AI 零售客户', desc: '管理会员与复购' },
    ],
    modules: [{ ic: Users, label: '零售客户' }, { ic: Star, label: '会员积分' }],
  },
  {
    key: 'tailor', label: '裁剪 / 裁缝公司', emoji: '✂️', supported: false,
    roles: [
      { ic: ClipboardList, name: 'AI 订单助手', desc: '跟进定制订单进度' },
      { ic: Ruler, name: 'AI 生产计划', desc: '排产与工时安排' },
      { ic: Wallet, name: 'AI 报价助手', desc: '自动生成报价单' },
    ],
    modules: [{ ic: ClipboardList, label: '定制订单' }, { ic: Ruler, label: '生产计划' }, { ic: Wallet, label: '报价单' }],
  },
  {
    key: 'restaurant', label: '餐馆', emoji: '🍜', supported: false,
    roles: [
      { ic: ChefHat, name: 'AI 菜单助手', desc: '维护菜单与价格' },
      { ic: Star, name: 'AI 评论助手', desc: '监控与回复顾客评价' },
      { ic: Megaphone, name: 'AI 营销员', desc: '策划到店促销活动' },
    ],
    modules: [{ ic: UtensilsCrossed, label: '菜单管理' }, { ic: ClipboardList, label: '今日订单' }, { ic: Star, label: '评论管理' }],
  },
  {
    key: 'chinese_shop', label: '中国店', emoji: '🇨🇳', supported: false,
    roles: [
      { ic: Globe2, name: 'AI 欧洲语言助手', desc: '多语言沟通与翻译' },
    ],
    modules: [{ ic: Globe2, label: '多语言客服' }],
  },
];

// 所有行业共有的“核心团队”，任何组合都会包含
const CORE_ROLES: Role[] = [
  { ic: BrainCircuit, name: 'AI 店长', desc: '统筹整个团队的运营决策' },
  { ic: Bot, name: 'AI 客服', desc: '接待客户与买手咨询' },
  { ic: Palette, name: 'AI 设计', desc: '负责视觉、Banner 与宣传' },
  { ic: Activity, name: 'AI 数据员', desc: '跟踪销售、流量与利润' },
];

export const AiTeamPreview: React.FC = () => {
  const { setCurrentView } = useB2B();
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (key: string) => setSelected(s => s.includes(key) ? s.filter(x => x !== key) : [...s, key]);

  const activeTypes = useMemo(() => BUSINESS_TYPES.filter(b => selected.includes(b.key)), [selected]);

  const roster = useMemo(() => {
    const extra: Role[] = [];
    const seen = new Set<string>();
    for (const t of activeTypes) {
      for (const r of t.roles) {
        if (!seen.has(r.name)) { seen.add(r.name); extra.push(r); }
      }
    }
    return [...CORE_ROLES, ...extra];
  }, [activeTypes]);

  const modules = useMemo(() => {
    const list: Module[] = [];
    const seen = new Set<string>();
    for (const t of activeTypes) {
      for (const m of t.modules) {
        if (!seen.has(m.label)) { seen.add(m.label); list.push(m); }
      }
    }
    return list;
  }, [activeTypes]);

  const allSupported = activeTypes.length > 0 && activeTypes.every(t => t.supported);
  const hasUnsupported = activeTypes.some(t => !t.supported);
  const anySupported = activeTypes.some(t => t.supported);
  const continueToOnboarding = () => {
    setCurrentView('register_wholesale');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50/40 via-neutral-50 to-white">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-10 md:py-14">
        <button onClick={() => setCurrentView('home')} className="mb-6 inline-flex items-center gap-1.5 text-xs font-bold text-neutral-500 hover:text-neutral-900 transition">
          <ArrowLeft className="w-3.5 h-3.5" /> 返回 RUDA 首页
        </button>

        <div className="mb-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-[11px] font-black">
          <Star className="w-3 h-3" /> 效果预览 Demo · 非最终产品
        </div>
        <div className="text-center mb-10">
          <h1 className="font-serif font-black text-4xl md:text-5xl mb-3 text-neutral-950">老板，欢迎加入你的 AI 生意团队 👋</h1>
          <p className="text-base md:text-lg text-neutral-500 max-w-2xl mx-auto leading-8">
            一个老板，也可以拥有一支 AI 团队。告诉我们你做什么生意，看看 AI 会为你配出一支怎样的团队、生成怎样的后台。
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <div>
            <h2 className="font-black text-lg mb-4">你现在主要做什么生意？（可多选）</h2>
            <div className="grid grid-cols-2 gap-3">
              {BUSINESS_TYPES.map(t => (
                <button
                  key={t.key}
                  onClick={() => toggle(t.key)}
                  className={`p-4 rounded-2xl border-2 text-left transition ${selected.includes(t.key) ? 'border-neutral-900 bg-white shadow-lg scale-[1.02]' : 'border-neutral-200 bg-white/60 hover:border-neutral-400'}`}
                >
                  <div className="text-2xl mb-1.5">{t.emoji}</div>
                  <div className="font-bold text-sm text-neutral-900">{t.label}</div>
                  {!t.supported && <div className="mt-1 text-[10px] font-bold text-amber-600">开发中</div>}
                </button>
              ))}
            </div>
          </div>

          <div className="ui-card p-6 md:p-7 shadow-xl bg-neutral-950 text-white">
            {selected.length === 0 ? (
              <div className="h-full min-h-[320px] flex items-center justify-center text-center text-neutral-500 text-sm">
                请选择至少一个生意类型，<br />查看 AI 为你组建的团队与后台
              </div>
            ) : (
              <>
                <div className="mb-5">
                  <div className="text-xs uppercase tracking-wider text-neutral-400 font-black mb-1">为你自动组建的 AI 团队</div>
                  <div className="space-y-2">
                    {roster.map(r => (
                      <div key={r.name} className="onboarding-roster-enter flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/10">
                        <div className="w-8 h-8 shrink-0 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center"><r.ic className="w-4 h-4" /></div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold">{r.name}</div>
                          <div className="text-[11px] text-neutral-400 truncate">{r.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {modules.length > 0 && (
                  <div className="mb-6">
                    <div className="text-xs uppercase tracking-wider text-neutral-400 font-black mb-2">你的专属后台菜单（预览）</div>
                    <div className="flex flex-wrap gap-2">
                      {modules.map(m => (
                        <div key={m.label} className="onboarding-roster-enter inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-xs font-bold">
                          <m.ic className="w-3.5 h-3.5" /> {m.label}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {allSupported && (
                  <button onClick={continueToOnboarding} className="w-full ui-primary-button px-6 py-3.5 text-sm font-bold">
                    去提交入驻申请 →
                  </button>
                )}
                {hasUnsupported && (
                  <>
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-400/30 text-xs text-amber-200 leading-6">
                      你选的行业里有正在开发中的模块（标注"开发中"）。这里只会把已支持的行业带入真实入驻表单；开发中行业不会自动创建员工或配置后台。最终内容请在表单中检查并确认。
                    </div>
                    {anySupported && (
                      <button onClick={continueToOnboarding} className="mt-3 w-full ui-primary-button px-6 py-3.5 text-sm font-bold">
                        仅用已支持行业继续，检查真实入驻表单 →
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <div className="mt-10 p-5 rounded-2xl bg-white/70 border border-neutral-200/70 text-xs text-neutral-500 leading-6">
          <b className="text-neutral-900">说明：</b>本页是产品方向的效果演示，用于验证"选生意类型 → 自动生成 AI 团队与后台"这个概念是否成立。当前仅「批发 / 服装店 / 皮具店 / 百货店 / 零售店」这几个行业接入了真实可用的后台系统；其余行业仅做视觉预览，不代表功能已完成。
        </div>
      </div>
    </div>
  );
};

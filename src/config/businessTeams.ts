/** Shared business-type configuration for AI team and onboarding previews. */

import type { LucideIcon } from 'lucide-react';
import {
  ShieldCheck,
  Store,
  BrainCircuit,
  Search,
  Palette,
  Rocket,
  Bot,
  Activity,
  Scissors,
  UtensilsCrossed,
  ShoppingBag,
  Package,
  Shirt,
  Briefcase,
} from 'lucide-react';

export interface Role {
  icon: LucideIcon;
  name: string;
  desc: string;
}

export interface Module {
  key: string;
  label: string;
}

export interface BusinessType {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Whether this vertical has a real, working back office today. */
  supported: boolean;
  /** Extra AI roles specific to this vertical, appended to CORE_ROLES. */
  extraRoles: Role[];
  /** Extra back-office modules specific to this vertical. */
  extraModules: Module[];
}

// Roles every business gets regardless of vertical.
export const CORE_ROLES: Role[] = [
  { icon: ShieldCheck, name: 'AI 资质核验', desc: '核验营业执照 / VAT，确保合规' },
  { icon: Store, name: 'AI 店长', desc: '统筹全局，日常经营决策建议' },
  { icon: BrainCircuit, name: 'AI 运营', desc: '订单、库存、数据分析' },
  { icon: Bot, name: 'AI 客服', desc: '7x24 多语言客户咨询与售后' },
];

export const BUSINESS_TYPES: BusinessType[] = [
  {
    id: 'wholesale',
    label: '服装批发',
    icon: Package,
    supported: true,
    extraRoles: [{ icon: Search, name: 'AI 选品师', desc: '追踪流行趋势，推荐爆款货源' }],
    extraModules: [
      { key: 'batch_orders', label: '批发订单' },
      { key: 'inventory', label: '库存管理' },
    ],
  },
  {
    id: 'apparel',
    label: '服装设计/制造',
    icon: Shirt,
    supported: true,
    extraRoles: [{ icon: Palette, name: 'AI 设计师', desc: '款式灵感与打版建议' }],
    extraModules: [
      { key: 'production', label: '生产排期' },
      { key: 'design_library', label: '款式库' },
    ],
  },
  {
    id: 'leather',
    label: '精品皮具',
    icon: Briefcase,
    supported: true,
    extraRoles: [{ icon: Search, name: 'AI 选品师', desc: '甄选皮具供应链与品质把关' }],
    extraModules: [
      { key: 'inventory', label: '库存管理' },
      { key: 'quality_check', label: '品质核验' },
    ],
  },
  {
    id: 'department',
    label: '精品百货',
    icon: ShoppingBag,
    supported: true,
    extraRoles: [{ icon: Search, name: 'AI 选品师', desc: '多品类选品与陈列建议' }],
    extraModules: [
      { key: 'inventory', label: '库存管理' },
      { key: 'categories', label: '品类管理' },
    ],
  },
  {
    id: 'retail',
    label: '零售/实体店',
    icon: Store,
    supported: true,
    extraRoles: [{ icon: Activity, name: 'AI 导购', desc: '到店客流转化与会员维护' }],
    extraModules: [
      { key: 'pos', label: '收银/POS' },
      { key: 'members', label: '会员管理' },
    ],
  },
  {
    id: 'tailor',
    label: '裁缝/定制',
    icon: Scissors,
    supported: false,
    extraRoles: [{ icon: Palette, name: 'AI 设计师', desc: '版型与定制方案建议' }],
    extraModules: [{ key: 'custom_orders', label: '定制订单' }],
  },
  {
    id: 'restaurant',
    label: '餐馆/餐饮',
    icon: UtensilsCrossed,
    supported: false,
    extraRoles: [{ icon: Activity, name: 'AI 前厅', desc: '预订、排队与外卖协调' }],
    extraModules: [
      { key: 'reservations', label: '预订管理' },
      { key: 'menu', label: '菜单管理' },
    ],
  },
  {
    id: 'chinese_shop',
    label: '中国超市/杂货',
    icon: ShoppingBag,
    supported: false,
    extraRoles: [{ icon: Search, name: 'AI 采购', desc: '进口货源与补货建议' }],
    extraModules: [{ key: 'inventory', label: '库存管理' }],
  },
];

// Operating-mode choices offered during onboarding (kept generic across verticals).
export const OPERATING_MODES: { id: string; label: string; desc: string }[] = [
  { id: 'wholesale_only', label: '纯批发', desc: '只做 B2B，不接触终端消费者' },
  { id: 'retail_only', label: '纯零售', desc: '直接面向消费者销售' },
  { id: 'wholesale_retail', label: '批发 + 零售', desc: '两条腿走路，兼顾大单与散客' },
  { id: 'production_wholesale', label: '生产 + 批发', desc: '自己生产，批量卖给下游商家' },
  { id: 'store_online', label: '实体店 + 线上', desc: '门店与线上渠道同时经营' },
];

/** Build the combined AI roster (core + vertical-specific) for a selection of business types, deduped by role name. */
export function buildRoster(selected: BusinessType[]): Role[] {
  const roster: Role[] = [...CORE_ROLES];
  const seen = new Set(roster.map((r) => r.name));
  selected.forEach((bt) => {
    bt.extraRoles.forEach((role) => {
      if (!seen.has(role.name)) {
        seen.add(role.name);
        roster.push(role);
      }
    });
  });
  // Every finished roster ends with a "store is live" style closer.
  roster.push({ icon: Rocket, name: '专属店铺', desc: '为你自动配置好的经营后台' });
  return roster;
}

/** Build the combined back-office module list for a selection of business types, deduped by key. */
export function buildModules(selected: BusinessType[]): Module[] {
  const modules: Module[] = [];
  const seen = new Set<string>();
  selected.forEach((bt) => {
    bt.extraModules.forEach((m) => {
      if (!seen.has(m.key)) {
        seen.add(m.key);
        modules.push(m);
      }
    });
  });
  return modules;
}

export const ZONE_LABELS: Record<string, string> = {
  iolo: '服装现货区',
  tavoro: '服装订货区',
  leather: '精品皮包区',
  boutique_department: '精品百货区',
};

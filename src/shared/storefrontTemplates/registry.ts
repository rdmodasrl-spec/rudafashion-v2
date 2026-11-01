/**
 * 商家私人网站模板注册表（唯一映射）。
 *
 * 七个行业 × 三套结构型模板 = 21 套，另有服装两行业沿用的三套 legacy 皮肤
 * （`fashion_monochrome` / `luxury_black_gold` / `ecommerce_standard`）继续保留，
 * 既有商家网站行为不变。
 *
 * 这里只登记「有哪些模板、属于哪个行业」，不承载业务逻辑与授权判断。
 */
import type { MerchantIndustryTemplateId } from '../../constants/merchantIndustryTemplates';

export type StorefrontTemplateKind =
  | 'legacy-skin'
  | 'bags-editorial' | 'bags-catalogue' | 'bags-wholesale'
  | 'apparel-lookbook' | 'apparel-collection' | 'apparel-line-sheet'
  | 'apparel-capability' | 'apparel-schedule' | 'apparel-private-label'
  | 'trading-export' | 'trading-sourcing' | 'trading-program'
  | 'department-mega' | 'department-floors' | 'department-reorder'
  | 'chain-stores' | 'chain-campaign' | 'chain-group'
  | 'retail-editorial' | 'retail-marketplace' | 'retail-quick-shop';

export type StorefrontTemplateDefinition = {
  id: string;
  name: string;
  positioning: string;
  kind: StorefrontTemplateKind;
  /** 行业作用域内的强调色；null 表示沿用 RUDA 墨色 */
  accent: string | null;
  /** 模板默认是否启用 3D 视觉能力；商家可关闭，关闭后回落真实商品图 */
  premium3d?: 'immersive' | 'gallery' | 'commerce' | null;
};

export type StorefrontIndustryGroup = {
  industry: MerchantIndustryTemplateId;
  label: string;
  templates: readonly StorefrontTemplateDefinition[];
};

/** 服装两行业保留的既有三套皮肤（不改动行为） */
export const LEGACY_STOREFRONT_TEMPLATES = [
  { id: 'fashion_monochrome', name: '时尚版 · 黑白', positioning: '黑白留白', kind: 'legacy-skin', accent: null },
  { id: 'luxury_black_gold', name: '豪华版 · 黑金', positioning: '黑金精品感', kind: 'legacy-skin', accent: '#c9a96e' },
  { id: 'ecommerce_standard', name: '标准版 · 电商', positioning: '清晰商品目录', kind: 'legacy-skin', accent: '#2563eb' }
] as const satisfies readonly StorefrontTemplateDefinition[];

export const BAGS_STOREFRONT_TEMPLATES = [
  { id: 'bags_editorial', name: '意大利编辑版', positioning: '品牌官网：3D 沉浸首屏、工艺叙事、系列画册', kind: 'bags-editorial', accent: null, premium3d: 'immersive' },
  { id: 'bags_catalogue', name: '产品目录版', positioning: '专业目录：3D 商品画廊、分类筛选、规格检索', kind: 'bags-catalogue', accent: null, premium3d: 'gallery' },
  { id: 'bags_wholesale', name: '批发电商版', positioning: 'B2B 商城：3D 商品检视、库存、MOQ、数量矩阵、采购车', kind: 'bags-wholesale', accent: '#7a5c3e', premium3d: 'commerce' }
] as const satisfies readonly StorefrontTemplateDefinition[];

export const APPAREL_WHOLESALE_TEMPLATES = [
  { id: 'apparel_lookbook', name: '系列画册版', positioning: '品牌画册：按系列分章的大图叙事，详情左右分栏', kind: 'apparel-lookbook', accent: null },
  { id: 'apparel_collection', name: '款式库版', positioning: '检索优先：侧栏筛选 + 四列高密度网格 + 属性表详情', kind: 'apparel-collection', accent: null },
  { id: 'apparel_line_sheet', name: '订货单版', positioning: '订货会 Line Sheet：横向行项目 + 实时订单汇总 + 数量矩阵', kind: 'apparel-line-sheet', accent: null }
] as const satisfies readonly StorefrontTemplateDefinition[];

export const APPAREL_PRODUCTION_TEMPLATES = [
  { id: 'apparel_capability', name: '工厂能力版', positioning: '深色工厂官网：产能指标、工艺关卡、可代工款式', kind: 'apparel-capability', accent: null },
  { id: 'apparel_schedule', name: '产能排期版', positioning: '排期导向：按品类的在产款数与订量表格', kind: 'apparel-schedule', accent: null },
  { id: 'apparel_private_label', name: '贴牌定制版', positioning: '四步流程 + 样板库 + 打样申请', kind: 'apparel-private-label', accent: null }
] as const satisfies readonly StorefrontTemplateDefinition[];

export const TRADING_WHOLESALE_TEMPLATES = [
  { id: 'trading_export', name: '出口目录版', positioning: '贸易条款条 + 规格行目录，突出装箱与起订', kind: 'trading-export', accent: null },
  { id: 'trading_sourcing', name: '采购代理版', positioning: '目录 + 采购清单，一次提交多款询盘', kind: 'trading-sourcing', accent: null },
  { id: 'trading_program', name: '供应计划版', positioning: '按品类的常年供应能力卡 + 计划询价', kind: 'trading-program', accent: null }
] as const satisfies readonly StorefrontTemplateDefinition[];

export const DEPARTMENT_WHOLESALE_TEMPLATES = [
  { id: 'department_mega', name: '超大类目版', positioning: '全类目面板 + 每类纵向板块 + 五列密度', kind: 'department-mega', accent: null },
  { id: 'department_floors', name: '楼层陈列版', positioning: '楼层标签 + 品类区块 + 交易卡快速加订', kind: 'department-floors', accent: null },
  { id: 'department_reorder', name: '批量补货版', positioning: '按箱补货表格 + 一键加箱 + 实时汇总', kind: 'department-reorder', accent: null }
] as const satisfies readonly StorefrontTemplateDefinition[];

export const DEPARTMENT_CHAIN_TEMPLATES = [
  { id: 'chain_stores', name: '门店导向版', positioning: '门店信息卡 + 本店在售 + 到店自提说明', kind: 'chain-stores', accent: null },
  { id: 'chain_campaign', name: '集团活动版', positioning: '大促主视觉 + 活动商品带 + 服务权益', kind: 'chain-campaign', accent: null },
  { id: 'chain_group', name: '集团目录版', positioning: '全类目面板 + 品类板块 + 集团介绍', kind: 'chain-group', accent: null }
] as const satisfies readonly StorefrontTemplateDefinition[];

export const GENERAL_RETAIL_TEMPLATES = [
  { id: 'retail_editorial', name: '杂志精选版', positioning: '杂志式首页：大图 + 精选 + 品类故事', kind: 'retail-editorial', accent: null },
  { id: 'retail_marketplace', name: '多品类市集版', positioning: '分类横滑 + 混合尺寸网格 + 快速加入', kind: 'retail-marketplace', accent: null },
  { id: 'retail_quick_shop', name: '快速购物版', positioning: '搜索优先 + 两列卡片 + 快速加购 + 底部结算条', kind: 'retail-quick-shop', accent: null }
] as const satisfies readonly StorefrontTemplateDefinition[];

/** 七行业 × 三套（21 套结构型模板） */
export const STOREFRONT_INDUSTRY_GROUPS = [
  { industry: 'bags_wholesale', label: '箱包批发商', templates: BAGS_STOREFRONT_TEMPLATES },
  { industry: 'apparel_wholesale', label: '服装批发商', templates: APPAREL_WHOLESALE_TEMPLATES },
  { industry: 'apparel_production_wholesale', label: '服装生产批发商', templates: APPAREL_PRODUCTION_TEMPLATES },
  { industry: 'trading_wholesale', label: '贸易批发商', templates: TRADING_WHOLESALE_TEMPLATES },
  { industry: 'department_wholesale', label: '百货批发商', templates: DEPARTMENT_WHOLESALE_TEMPLATES },
  { industry: 'department_chain_retail', label: '百货连锁店', templates: DEPARTMENT_CHAIN_TEMPLATES },
  { industry: 'general_retail', label: '综合零售商', templates: GENERAL_RETAIL_TEMPLATES }
] as const satisfies readonly StorefrontIndustryGroup[];

export type StructuralStorefrontTemplateId =
  (typeof STOREFRONT_INDUSTRY_GROUPS)[number]['templates'][number]['id'];

export const ALL_STRUCTURAL_TEMPLATES: readonly StorefrontTemplateDefinition[] =
  STOREFRONT_INDUSTRY_GROUPS.reduce<StorefrontTemplateDefinition[]>((templates, group) => {
    templates.push(...group.templates);
    return templates;
  }, []);

export function getStorefrontTemplatesForIndustry(
  templateId: string | null | undefined
): readonly StorefrontTemplateDefinition[] {
  const key = (templateId || '').trim() as MerchantIndustryTemplateId;
  return STOREFRONT_INDUSTRY_GROUPS.find(group => group.industry === key)?.templates
    ?? LEGACY_STOREFRONT_TEMPLATES;
}

export function getStorefrontTemplateOptionsForIndustry(
  industry: string | null | undefined,
  currentTemplateId?: string | null
): readonly StorefrontTemplateDefinition[] {
  const industryKey = (industry || '').trim() as MerchantIndustryTemplateId;
  const industryTemplates = STOREFRONT_INDUSTRY_GROUPS.find(group => group.industry === industryKey)?.templates;
  if (!industryTemplates) return LEGACY_STOREFRONT_TEMPLATES;

  const currentLegacyTemplate = LEGACY_STOREFRONT_TEMPLATES.find(template => template.id === currentTemplateId);
  return currentLegacyTemplate
    ? [...industryTemplates, currentLegacyTemplate]
    : industryTemplates;
}

export function findStorefrontTemplate(templateId: string | null | undefined): StorefrontTemplateDefinition | null {
  const id = (templateId || '').trim();
  if (!id) return null;
  return [...LEGACY_STOREFRONT_TEMPLATES, ...ALL_STRUCTURAL_TEMPLATES].find(template => template.id === id) || null;
}

export function findStorefrontIndustryGroup(templateId: string | null | undefined): StorefrontIndustryGroup | null {
  const id = (templateId || '').trim();
  if (!id) return null;
  return STOREFRONT_INDUSTRY_GROUPS.find(group => group.templates.some(template => template.id === id)) || null;
}

export function isStructuralStorefrontTemplate(
  templateId: string | null | undefined
): templateId is StructuralStorefrontTemplateId {
  const template = findStorefrontTemplate(templateId);
  return template !== null && template.kind !== 'legacy-skin';
}

export function isStorefrontTemplateAllowedForIndustry(
  templateId: string,
  industry: string | null | undefined
): boolean {
  if (LEGACY_STOREFRONT_TEMPLATES.some(template => template.id === templateId)) return true;
  return STOREFRONT_INDUSTRY_GROUPS.some(group =>
    group.industry === industry && group.templates.some(template => template.id === templateId)
  );
}

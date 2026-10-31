/**
 * 商家私人网站模板注册表（唯一映射）。
 *
 * 行业 → 该行业可用的模板。服装两个行业保留既有三套（颜色皮肤型），
 * 其余行业逐步替换为结构型模板；未迁移前回落到 legacy 三套。
 *
 * 这里只登记「有哪些模板」，不承载业务逻辑与授权判断。
 */
import type { MerchantIndustryTemplateId } from '../../constants/merchantIndustryTemplates';

export type StorefrontTemplateKind = 'legacy-skin' | 'bags-editorial' | 'bags-catalogue' | 'bags-wholesale';

export type StorefrontTemplateDefinition = {
  id: string;
  name: string;
  positioning: string;
  kind: StorefrontTemplateKind;
  /** 行业作用域内的强调色；null 表示沿用 RUDA 墨色 */
  accent: string | null;
};

/** 现有三套（颜色皮肤，服装两行业保留） */
export const LEGACY_STOREFRONT_TEMPLATES: readonly StorefrontTemplateDefinition[] = [
  { id: 'fashion_monochrome', name: '时尚版 · 黑白', positioning: '黑白留白', kind: 'legacy-skin', accent: null },
  { id: 'luxury_black_gold', name: '豪华版 · 黑金', positioning: '黑金精品感', kind: 'legacy-skin', accent: '#c9a96e' },
  { id: 'ecommerce_standard', name: '标准版 · 电商', positioning: '清晰商品目录', kind: 'legacy-skin', accent: '#2563eb' }
];

/** 箱包行业三套结构型模板（阶段 B 黄金样板） */
export const BAGS_STOREFRONT_TEMPLATES: readonly StorefrontTemplateDefinition[] = [
  { id: 'bags_editorial', name: '意大利编辑版', positioning: '品牌官网：大幅摄影、工艺叙事、系列画册', kind: 'bags-editorial', accent: null },
  { id: 'bags_catalogue', name: '产品目录版', positioning: '专业目录：分类、筛选、规格检索', kind: 'bags-catalogue', accent: null },
  { id: 'bags_wholesale', name: '批发电商版', positioning: 'B2B 商城：库存、MOQ、数量矩阵、采购车', kind: 'bags-wholesale', accent: '#7a5c3e' }
];

const INDUSTRY_TEMPLATES: Partial<Record<MerchantIndustryTemplateId, readonly StorefrontTemplateDefinition[]>> = {
  bags_wholesale: BAGS_STOREFRONT_TEMPLATES
};

/** 该行业可选的模板；未迁移行业返回保留的三套。 */
export function getStorefrontTemplatesForIndustry(
  templateId: string | null | undefined
): readonly StorefrontTemplateDefinition[] {
  const key = (templateId || '').trim() as MerchantIndustryTemplateId;
  return INDUSTRY_TEMPLATES[key] ?? LEGACY_STOREFRONT_TEMPLATES;
}

export function findStorefrontTemplate(templateId: string | null | undefined): StorefrontTemplateDefinition | null {
  const id = (templateId || '').trim();
  if (!id) return null;
  return [...LEGACY_STOREFRONT_TEMPLATES, ...BAGS_STOREFRONT_TEMPLATES].find(template => template.id === id) || null;
}

export function isStructuralStorefrontTemplate(templateId: string | null | undefined): boolean {
  const template = findStorefrontTemplate(templateId);
  return template !== null && template.kind !== 'legacy-skin';
}

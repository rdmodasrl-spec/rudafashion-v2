/**
 * 七行业 × Premium 3D 组件映射。
 *
 * 同一套 3D 能力不能七个行业一个用法：
 * 每个行业按业务特征选择「首屏 / 材质 / 检视 / 画廊」四类位置，
 * 且每套模板最多出现 2 个 3D 区块，避免全站动画。
 */
import type { MerchantIndustryTemplateId } from '../../../../constants/merchantIndustryTemplates';

export type Premium3DSlot = 'hero' | 'material' | 'inspect' | 'gallery' | 'ambient';

export type IndustryPremium3DPlan = {
  /** 行业首屏主视觉 */
  hero: 'immersive-stage' | 'fluid-backdrop' | 'brand-wordmark' | 'scroll-stage';
  /** 商品细节检视 */
  inspect: 'turntable' | 'flip-transition' | 'depth-hover';
  /** 材质/质感叙事 */
  material?: 'leather' | 'metal' | 'matte' | 'glass';
  /** 环境氛围（背景层） */
  ambient?: 'particle' | 'fluid';
  /** 该行业建议的 3D 区块数量上限 */
  maxBlocks: number;
  /** 行业说明，写清为什么这样选，避免下一个人机械复制 */
  rationale: string;
};

export const INDUSTRY_PREMIUM_3D: Record<MerchantIndustryTemplateId, IndustryPremium3DPlan> = {
  apparel_production_wholesale: {
    hero: 'scroll-stage',
    inspect: 'depth-hover',
    ambient: 'particle',
    maxBlocks: 2,
    rationale: '生产批发看款式与工艺推进，用滚动舞台呈现系列递进，详情用悬停景深展示面料纹理。'
  },
  apparel_wholesale: {
    hero: 'brand-wordmark',
    inspect: 'depth-hover',
    material: 'matte',
    maxBlocks: 2,
    rationale: '服装批发以系列与品牌调性为主，字标首屏 + 悬停景深，避免大面积 3D 拖慢目录浏览。'
  },
  trading_wholesale: {
    hero: 'fluid-backdrop',
    inspect: 'flip-transition',
    maxBlocks: 2,
    rationale: '贸易批发强调供应能力与流程感，流体背景 + 商品转场足够，不做无意义旋转展示。'
  },
  department_wholesale: {
    hero: 'fluid-backdrop',
    inspect: 'turntable',
    material: 'matte',
    maxBlocks: 2,
    rationale: '百货批发品类多，用轻背景 + 单品转台，重点仍在检索效率。'
  },
  bags_wholesale: {
    hero: 'immersive-stage',
    inspect: 'turntable',
    material: 'leather',
    ambient: 'particle',
    maxBlocks: 2,
    rationale: '皮具靠材质与轮廓，首屏沉浸式舞台 + 详情转台，皮革材质台辅助质感表达。'
  },
  department_chain_retail: {
    hero: 'immersive-stage',
    inspect: 'flip-transition',
    material: 'glass',
    maxBlocks: 2,
    rationale: '连锁零售强调门店与集团形象，首屏舞台 + 门店/商品转场，弱化单品检视。'
  },
  general_retail: {
    hero: 'fluid-backdrop',
    inspect: 'depth-hover',
    ambient: 'particle',
    maxBlocks: 2,
    rationale: '综合零售追求浏览节奏，动态背景 + 悬停景深即可，避免多品类场景堆叠。'
  }
};

export function getIndustryPremium3DPlan(templateId?: string | null): IndustryPremium3DPlan {
  const key = (templateId || '') as MerchantIndustryTemplateId;
  return INDUSTRY_PREMIUM_3D[key] || {
    hero: 'immersive-stage',
    inspect: 'turntable',
    maxBlocks: 2,
    rationale: '未登记行业：只启用最小组合，等产品确认后再扩展。'
  };
}

/**
 * 行业模块注册表（唯一映射）：templateId → 行业模块。
 *
 * - 服装生产批发商与餐饮工作区由 MerchantPortal / 对应端的既有入口承载。
 * - 其他已开放行业各自指向独立目录，不存在“同一组件切标题”的入口。
 * - 尚未建立独立行业工作区的模板返回 null，禁止回退到任一其他行业工作区。
 */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { MerchantIndustryTemplateId } from '../../constants/merchantIndustryTemplates';
import type { IndustryWorkspaceModuleProps } from './shared/IndustryWorkspaceShell';

export type IndustryWorkspaceComponent = ComponentType<IndustryWorkspaceModuleProps>;

export const industryWorkspaceModules: Readonly<Record<MerchantIndustryTemplateId, LazyExoticComponent<IndustryWorkspaceComponent> | null>> = {
  apparel_production_wholesale: null,
  apparel_wholesale: lazy(() => import('./apparel-wholesale').then(module => ({ default: module.ApparelWholesaleWorkspace }))),
  trading_wholesale: lazy(() => import('./trading-wholesale').then(module => ({ default: module.TradingWholesaleWorkspace }))),
  department_wholesale: lazy(() => import('./department-wholesale').then(module => ({ default: module.DepartmentWholesaleWorkspace }))),
  bags_wholesale: lazy(() => import('./bags-wholesale').then(module => ({ default: module.BagsWholesaleWorkspace }))),
  department_chain_retail: lazy(() => import('./department-chain-retail').then(module => ({ default: module.DepartmentChainRetailWorkspace }))),
  general_retail: lazy(() => import('./general-retail').then(module => ({ default: module.GeneralRetailWorkspace }))),
  restaurant_ordering: null
};

export function getIndustryWorkspaceModule(templateId: unknown): LazyExoticComponent<IndustryWorkspaceComponent> | null {
  if (typeof templateId !== 'string') return null;
  return (industryWorkspaceModules as Record<string, LazyExoticComponent<IndustryWorkspaceComponent> | null>)[templateId.trim()] || null;
}

export function hasIndustryWorkspaceModule(templateId: unknown): boolean {
  return getIndustryWorkspaceModule(templateId) !== null;
}

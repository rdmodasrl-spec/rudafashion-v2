/**
 * 行业模块注册表（唯一映射）：templateId → 行业模块。
 *
 * - 服装生产批发商返回 null，由 `MerchantPortal` 继续承载（保护现有后台）。
 * - 其他 6 种行业各自指向独立目录，不存在“同一组件切标题”的入口。
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
  general_retail: lazy(() => import('./general-retail').then(module => ({ default: module.GeneralRetailWorkspace })))
};

export function getIndustryWorkspaceModule(templateId: unknown): LazyExoticComponent<IndustryWorkspaceComponent> | null {
  if (typeof templateId !== 'string') return null;
  return (industryWorkspaceModules as Record<string, LazyExoticComponent<IndustryWorkspaceComponent> | null>)[templateId.trim()] || null;
}

export function hasIndustryWorkspaceModule(templateId: unknown): boolean {
  return getIndustryWorkspaceModule(templateId) !== null;
}

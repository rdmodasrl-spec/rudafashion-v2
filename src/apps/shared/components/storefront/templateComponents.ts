import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { StructuralStorefrontTemplateId } from '../../../../shared/storefrontTemplates/registry';
import type { StorefrontTemplateProps } from './kit/filters';

type StorefrontTemplateComponent = LazyExoticComponent<ComponentType<StorefrontTemplateProps>>;

export const STOREFRONT_TEMPLATE_COMPONENTS: Record<
  StructuralStorefrontTemplateId,
  StorefrontTemplateComponent
> = {
  bags_editorial: lazy(() => import('./bags/BagsEditorialTemplate').then(module => ({ default: module.BagsEditorialTemplate }))),
  bags_catalogue: lazy(() => import('./bags/BagsCatalogueTemplate').then(module => ({ default: module.BagsCatalogueTemplate }))),
  bags_wholesale: lazy(() => import('./bags/BagsWholesaleTemplate').then(module => ({ default: module.BagsWholesaleTemplate }))),
  apparel_lookbook: lazy(() => import('./industries/apparelWholesale').then(module => ({ default: module.ApparelLookbookTemplate }))),
  apparel_collection: lazy(() => import('./industries/apparelWholesale').then(module => ({ default: module.ApparelCollectionTemplate }))),
  apparel_line_sheet: lazy(() => import('./industries/apparelWholesale').then(module => ({ default: module.ApparelLineSheetTemplate }))),
  apparel_capability: lazy(() => import('./industries/apparelProduction').then(module => ({ default: module.ProductionCapabilityTemplate }))),
  apparel_schedule: lazy(() => import('./industries/apparelProduction').then(module => ({ default: module.ProductionScheduleTemplate }))),
  apparel_private_label: lazy(() => import('./industries/apparelProduction').then(module => ({ default: module.ProductionPrivateLabelTemplate }))),
  trading_export: lazy(() => import('./industries/tradingWholesale').then(module => ({ default: module.TradingExportTemplate }))),
  trading_sourcing: lazy(() => import('./industries/tradingWholesale').then(module => ({ default: module.TradingSourcingTemplate }))),
  trading_program: lazy(() => import('./industries/tradingWholesale').then(module => ({ default: module.TradingProgramTemplate }))),
  department_mega: lazy(() => import('./industries/departmentWholesale').then(module => ({ default: module.DepartmentMegaTemplate }))),
  department_floors: lazy(() => import('./industries/departmentWholesale').then(module => ({ default: module.DepartmentFloorsTemplate }))),
  department_reorder: lazy(() => import('./industries/departmentWholesale').then(module => ({ default: module.DepartmentReorderTemplate }))),
  chain_stores: lazy(() => import('./industries/departmentChain').then(module => ({ default: module.ChainStoresTemplate }))),
  chain_campaign: lazy(() => import('./industries/departmentChain').then(module => ({ default: module.ChainCampaignTemplate }))),
  chain_group: lazy(() => import('./industries/departmentChain').then(module => ({ default: module.ChainGroupTemplate }))),
  retail_editorial: lazy(() => import('./industries/generalRetail').then(module => ({ default: module.RetailEditorialTemplate }))),
  retail_marketplace: lazy(() => import('./industries/generalRetail').then(module => ({ default: module.RetailMarketplaceTemplate }))),
  retail_quick_shop: lazy(() => import('./industries/generalRetail').then(module => ({ default: module.RetailQuickShopTemplate })))
};

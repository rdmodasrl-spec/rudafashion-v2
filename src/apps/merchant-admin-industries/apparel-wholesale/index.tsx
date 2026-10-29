/**
 * 服装批发商后台：成衣批发、现货与订单为核心，不含生产原料与生产流程。
 */
import React, { useState } from 'react';
import { ShoppingCart, Store } from 'lucide-react';
import type { MerchantIndustryModuleKey } from '../../../constants/merchantIndustryCapabilities';
import { MerchantProcurementWorkspace } from '../../merchant-admin-common/components/merchant/MerchantProcurementWorkspace';
import { IndustryWorkspaceShell, type IndustryWorkspaceModuleProps } from '../shared/IndustryWorkspaceShell';
import { IndustryProductsSection, IndustryInventorySection } from '../shared/IndustryProductsSection';
import { IndustryOrdersSection } from '../shared/IndustryOrdersSection';
import { IndustryCustomersSection } from '../shared/IndustryCustomersSection';
import { IndustrySuppliersSection } from '../shared/IndustrySuppliersSection';
import { IndustrySettingsSection } from '../shared/IndustrySettingsSection';
import { IndustryTeamSection } from '../shared/IndustryTeamSection';
import { IndustryMessageSection } from '../shared/IndustryMessageSection';
import { IndustryLowStock, RecentIndustryOrders } from '../shared/IndustryDashboardParts';
import { KpiCard, KpiGrid, PageHeader, SectionCard, formatMoney } from '../shared/kit';
import { industryModuleIcons } from '../shared/navIcons';
import { useIndustryWorkspace } from '../shared/useIndustryWorkspace';
import { apparelWholesaleManifest } from './manifest';

export const ApparelWholesaleWorkspace: React.FC<IndustryWorkspaceModuleProps> = ({ mobileMode, onBackToDesktop, embedded, activeSection, onSectionChange }) => {
  const manifest = apparelWholesaleManifest;
  const capability = manifest.capability;
  const workspace = useIndustryWorkspace(capability);
  const [localActive, setLocalActive] = useState<MerchantIndustryModuleKey>('dashboard');
  const active = activeSection ?? localActive;
  const setActive = (key: MerchantIndustryModuleKey) => onSectionChange ? onSectionChange(key) : setLocalActive(key);
  const nav = manifest.nav.map(item => ({ ...item, icon: industryModuleIcons[item.key] }));

  const dashboard = (
    <div className="space-y-4">
      <PageHeader
        title="服装批发经营首页"
        description="现货款式、批发订单与库存预警来自真实数据。"
      />
      <KpiGrid>
        <KpiCard label="在售款式" value={workspace.metrics.publishedProducts} hint={`全部款式 ${workspace.metrics.productCount}`} />
        <KpiCard label="待处理批发订单" value={workspace.metrics.pendingOrders} />
        <KpiCard label="成衣可售件数" value={workspace.metrics.stockTotal} />
        <KpiCard label="本月销售额" value={formatMoney(workspace.metrics.monthSales)} />
      </KpiGrid>
      <SectionCard title="快捷入口">
        <div className="grid gap-2 sm:grid-cols-3">
          <button type="button" onClick={() => setActive('products')} className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-3 text-sm font-semibold hover:border-neutral-400">
            新增服装款式<Store className="h-4 w-4 text-neutral-500" />
          </button>
          <button type="button" onClick={() => setActive('inventory')} className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-3 text-sm font-semibold hover:border-neutral-400">
            查看现货库存<ShoppingCart className="h-4 w-4 text-neutral-500" />
          </button>
          <button type="button" onClick={() => setActive('orders')} className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-3 text-sm font-semibold hover:border-neutral-400">
            处理批发订单<Store className="h-4 w-4 text-neutral-500" />
          </button>
        </div>
      </SectionCard>
      <div className="grid gap-3 lg:grid-cols-2">
        <RecentIndustryOrders orders={workspace.orders} title="最近批发订单" onOpenOrders={() => setActive('orders')} />
        <IndustryLowStock balances={workspace.inventory.items} title="现货库存预警" />
      </div>
    </div>
  );

  const page = (() => {
    switch (active) {
      case 'products':
        return (
          <IndustryProductsSection
            capability={capability}
            products={workspace.products}
            editingEnabled={workspace.editingEnabled}
            onRefresh={() => { void workspace.refresh(); void workspace.inventory.reload(); }}
            notify={workspace.addNotification}
          />
        );
      case 'inventory':
        return <IndustryInventorySection capability={capability} notify={workspace.addNotification} />;
      case 'orders':
        return <IndustryOrdersSection orders={workspace.orders} title="批发订单" onRefresh={() => void workspace.refresh()} notify={workspace.addNotification} />;
      case 'customers':
        return <IndustryCustomersSection customers={workspace.customers} onRefresh={() => void workspace.refresh()} notify={workspace.addNotification} />;
      case 'suppliers':
        return <IndustrySuppliersSection notify={workspace.addNotification} />;
      case 'procurement':
        return <MerchantProcurementWorkspace products={workspace.products} isIt={false} />;
      case 'team':
        return <IndustryTeamSection workspaceName={manifest.workspaceName} merchantId={workspace.merchantId} notify={workspace.addNotification} />;
      case 'messages':
        return <IndustryMessageSection merchantId={workspace.merchantId} onOpenOrders={() => setActive('orders')} />;
      case 'settings':
        return (
          <IndustrySettingsSection
            workspaceName={manifest.workspaceName}
            templateName="服装批发商"
            notify={workspace.addNotification}
          />
        );
      default:
        return dashboard;
    }
  })();

  return (
    <IndustryWorkspaceShell
      workspaceName={manifest.workspaceName}
      merchantName={workspace.merchant?.name || ''}
      nav={nav}
      active={active}
      onNavigate={setActive}
      mobileMode={mobileMode}
      onBackToDesktop={onBackToDesktop}
      embedded={embedded}
    >
      {page}
    </IndustryWorkspaceShell>
  );
};

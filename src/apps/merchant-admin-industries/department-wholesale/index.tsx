/**
 * 百货批发商后台：多品类商品、批量采购与批发订单为核心。
 */
import React, { useState } from 'react';
import { ClipboardList, Package } from 'lucide-react';
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
import { IndustryLowStock, RecentIndustryOrders, RecentPurchaseOrders } from '../shared/IndustryDashboardParts';
import { KpiCard, KpiGrid, PageHeader, SectionCard, formatMoney } from '../shared/kit';
import { industryModuleIcons } from '../shared/navIcons';
import { useIndustryWorkspace } from '../shared/useIndustryWorkspace';
import { departmentWholesaleManifest } from './manifest';

export const DepartmentWholesaleWorkspace: React.FC<IndustryWorkspaceModuleProps> = ({ mobileMode, onBackToDesktop, embedded, activeSection, onSectionChange }) => {
  const manifest = departmentWholesaleManifest;
  const capability = manifest.capability;
  const workspace = useIndustryWorkspace(capability);
  const [localActive, setLocalActive] = useState<MerchantIndustryModuleKey>('dashboard');
  const active = activeSection ?? localActive;
  const setActive = (key: MerchantIndustryModuleKey) => onSectionChange ? onSectionChange(key) : setLocalActive(key);
  const nav = manifest.nav.map(item => ({ ...item, icon: industryModuleIcons[item.key] }));

  const dashboard = (
    <div className="space-y-4">
      <PageHeader title="百货批发经营首页" description="多品类商品、采购到货与批量订单状态。" />
      <KpiGrid>
        <KpiCard label="商品总量" value={workspace.metrics.productCount} hint={`在售 ${workspace.metrics.publishedProducts}`} />
        <KpiCard label="待处理批发订单" value={workspace.metrics.pendingOrders} />
        <KpiCard label="待处理采购单" value={workspace.metrics.pendingPurchases} />
        <KpiCard label="本月销售额" value={formatMoney(workspace.metrics.monthSales)} />
      </KpiGrid>
      <SectionCard title="快捷入口">
        <div className="grid gap-2 sm:grid-cols-3">
          <button type="button" onClick={() => setActive('products')} className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-3 text-sm font-semibold hover:border-neutral-400">
            新增百货商品<Package className="h-4 w-4 text-neutral-500" />
          </button>
          <button type="button" onClick={() => setActive('procurement')} className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-3 text-sm font-semibold hover:border-neutral-400">
            批量采购<ClipboardList className="h-4 w-4 text-neutral-500" />
          </button>
          <button type="button" onClick={() => setActive('orders')} className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-3 text-sm font-semibold hover:border-neutral-400">
            查看客户订单<ClipboardList className="h-4 w-4 text-neutral-500" />
          </button>
        </div>
      </SectionCard>
      <div className="grid gap-3 lg:grid-cols-2">
        <RecentIndustryOrders orders={workspace.orders} title="最近批发订单" onOpenOrders={() => setActive('orders')} />
        <RecentPurchaseOrders orders={workspace.purchaseOrders.items} title="待跟进采购单" onOpen={() => setActive('procurement')} />
      </div>
      <IndustryLowStock balances={workspace.inventory.items} title="仓储库存预警" threshold={10} />
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
      case 'procurement':
        return <MerchantProcurementWorkspace products={workspace.products} isIt={false} />;
      case 'suppliers':
        return <IndustrySuppliersSection notify={workspace.addNotification} />;
      case 'orders':
        return <IndustryOrdersSection orders={workspace.orders} title="客户批发订单" onRefresh={() => void workspace.refresh()} notify={workspace.addNotification} />;
      case 'customers':
        return <IndustryCustomersSection customers={workspace.customers} onRefresh={() => void workspace.refresh()} notify={workspace.addNotification} />;
      case 'team':
        return <IndustryTeamSection workspaceName={manifest.workspaceName} merchantId={workspace.merchantId} notify={workspace.addNotification} />;
      case 'messages':
        return <IndustryMessageSection merchantId={workspace.merchantId} onOpenOrders={() => setActive('orders')} />;
      case 'settings':
        return <IndustrySettingsSection workspaceName={manifest.workspaceName} templateName="百货批发商" notify={workspace.addNotification} />;
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

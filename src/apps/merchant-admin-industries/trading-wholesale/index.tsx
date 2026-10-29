/**
 * 贸易批发商后台：多供应商采购、采购成本与批发销售为核心。
 */
import React, { useState } from 'react';
import { ClipboardList, Truck } from 'lucide-react';
import type { MerchantIndustryModuleKey, MerchantIndustryCapability } from '../../../constants/merchantIndustryCapabilities';
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
import { tradingWholesaleManifest } from './manifest';

function TradingDashboard({ workspace, capability, onNavigate }: {
  workspace: ReturnType<typeof useIndustryWorkspace>;
  capability: MerchantIndustryCapability;
  onNavigate: (key: MerchantIndustryModuleKey) => void;
}) {
  return (
    <div className="space-y-4">
      <PageHeader title="贸易批发经营首页" description="采购、库存与批发销售均来自同一商家数据源。" />
      <KpiGrid>
        <KpiCard label="在售商品" value={workspace.metrics.publishedProducts} hint={`全部商品 ${workspace.metrics.productCount}`} />
        <KpiCard label="待处理采购" value={workspace.metrics.pendingPurchases} />
        <KpiCard label="待处理销售订单" value={workspace.metrics.pendingOrders} />
        <KpiCard label="本月销售额" value={formatMoney(workspace.metrics.monthSales)} />
      </KpiGrid>
      <SectionCard title="快捷入口">
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => onNavigate('procurement')} className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-3 text-sm font-semibold hover:border-neutral-400">
            新建采购单<ClipboardList className="h-4 w-4 text-neutral-500" />
          </button>
          <button type="button" onClick={() => onNavigate('suppliers')} className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-3 text-sm font-semibold hover:border-neutral-400">
            维护供应商<Truck className="h-4 w-4 text-neutral-500" />
          </button>
        </div>
      </SectionCard>
      <div className="grid gap-3 lg:grid-cols-2">
        <RecentPurchaseOrders orders={workspace.purchaseOrders.items} title="最近采购单" onOpen={() => onNavigate('procurement')} />
        <RecentIndustryOrders orders={workspace.orders} title="最近批发销售" onOpenOrders={() => onNavigate('orders')} />
      </div>
      <IndustryLowStock balances={workspace.inventory.items} title="可售库存预警" />
      {!capability.features.stores ? (
        <p className="text-xs text-neutral-500">贸易批发不包含多门店库存与调拨；如需门店经营请使用百货连锁店后台。</p>
      ) : null}
    </div>
  );
}

export const TradingWholesaleWorkspace: React.FC<IndustryWorkspaceModuleProps> = ({ mobileMode, onBackToDesktop, embedded, activeSection, onSectionChange }) => {
  const manifest = tradingWholesaleManifest;
  const capability = manifest.capability;
  const workspace = useIndustryWorkspace(capability);
  const [localActive, setLocalActive] = useState<MerchantIndustryModuleKey>('dashboard');
  const active = activeSection ?? localActive;
  const setActive = (key: MerchantIndustryModuleKey) => onSectionChange ? onSectionChange(key) : setLocalActive(key);
  const nav = manifest.nav.map(item => ({ ...item, icon: industryModuleIcons[item.key] }));

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
      case 'procurement':
        return <MerchantProcurementWorkspace products={workspace.products} isIt={false} />;
      case 'suppliers':
        return <IndustrySuppliersSection notify={workspace.addNotification} />;
      case 'inventory':
        return <IndustryInventorySection capability={capability} notify={workspace.addNotification} />;
      case 'orders':
        return <IndustryOrdersSection orders={workspace.orders} title="批发销售订单" onRefresh={() => void workspace.refresh()} notify={workspace.addNotification} />;
      case 'customers':
        return <IndustryCustomersSection customers={workspace.customers} onRefresh={() => void workspace.refresh()} notify={workspace.addNotification} />;
      case 'team':
        return <IndustryTeamSection workspaceName={manifest.workspaceName} merchantId={workspace.merchantId} notify={workspace.addNotification} />;
      case 'messages':
        return <IndustryMessageSection merchantId={workspace.merchantId} onOpenOrders={() => setActive('orders')} />;
      case 'settings':
        return <IndustrySettingsSection workspaceName={manifest.workspaceName} templateName="贸易批发商" notify={workspace.addNotification} />;
      default:
        return <TradingDashboard workspace={workspace} capability={capability} onNavigate={setActive} />;
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

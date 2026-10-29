/**
 * 综合零售商后台：通用商品、零售价、POS 收银与库存闭环。
 */
import React, { useMemo, useState } from 'react';
import { Receipt, ShoppingCart } from 'lucide-react';
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
import { IndustryPosSection, IndustryPosSalesHistory, IndustryPosShiftHistory } from '../shared/IndustryPosSection';
import { IndustryLowStock, RecentIndustryOrders } from '../shared/IndustryDashboardParts';
import { KpiCard, KpiGrid, PageHeader, SectionCard, formatMoney } from '../shared/kit';
import { industryModuleIcons } from '../shared/navIcons';
import { useIndustryWorkspace } from '../shared/useIndustryWorkspace';
import { generalRetailManifest } from './manifest';

export const GeneralRetailWorkspace: React.FC<IndustryWorkspaceModuleProps> = ({ mobileMode, onBackToDesktop, embedded, activeSection, onSectionChange }) => {
  const manifest = generalRetailManifest;
  const capability = manifest.capability;
  const workspace = useIndustryWorkspace(capability);
  const [localActive, setLocalActive] = useState<MerchantIndustryModuleKey>('dashboard');
  const active = activeSection ?? localActive;
  const setActive = (key: MerchantIndustryModuleKey) => onSectionChange ? onSectionChange(key) : setLocalActive(key);
  const nav = manifest.nav.map(item => ({ ...item, icon: industryModuleIcons[item.key] }));

  const todaySales = useMemo(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    return workspace.posSales.items
      .filter(sale => {
        const stamp = Date.parse(sale.createdAt);
        return Number.isFinite(stamp) && stamp >= start;
      })
      .reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0);
  }, [workspace.posSales.items]);

  const dashboard = (
    <div className="space-y-4">
      <PageHeader title="零售经营首页" description="销售、库存与商品数据来自真实记录；无数据时显示为零。" />
      <KpiGrid>
        <KpiCard label="今日 POS 销售额" value={formatMoney(todaySales)} hint={`累计 ${workspace.posSales.items.length} 笔`} />
        <KpiCard label="在售商品" value={workspace.metrics.publishedProducts} hint={`全部 ${workspace.metrics.productCount}`} />
        <KpiCard label="待处理订单" value={workspace.metrics.pendingOrders} />
        <KpiCard label="库存预警 SKU" value={workspace.metrics.lowStockSkus} />
      </KpiGrid>
      <SectionCard title="快捷入口">
        <div className="grid gap-2 sm:grid-cols-3">
          <button type="button" onClick={() => setActive('pos')} className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-3 text-sm font-semibold hover:border-neutral-400">
            开始收银<Receipt className="h-4 w-4 text-neutral-500" />
          </button>
          <button type="button" onClick={() => setActive('products')} className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-3 text-sm font-semibold hover:border-neutral-400">
            录入零售商品<ShoppingCart className="h-4 w-4 text-neutral-500" />
          </button>
          <button type="button" onClick={() => setActive('inventory')} className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-3 text-sm font-semibold hover:border-neutral-400">
            管理库存<ShoppingCart className="h-4 w-4 text-neutral-500" />
          </button>
        </div>
      </SectionCard>
      <div className="grid gap-3 lg:grid-cols-2">
        <RecentIndustryOrders orders={workspace.orders} title="最近订单" onOpenOrders={() => setActive('orders')} />
        <IndustryLowStock balances={workspace.inventory.items} title="零售库存预警" />
      </div>
    </div>
  );

  const page = (() => {
    switch (active) {
      case 'pos':
        return (
          <IndustryPosSection
            capability={capability}
            products={workspace.products}
            sales={workspace.posSales.items}
            notify={workspace.addNotification}
            onSaleCreated={() => { void workspace.posSales.reload(); void workspace.inventory.reload(); void workspace.refresh(); }}
          />
        );
      case 'pos_sales':
        return <IndustryPosSalesHistory sales={workspace.posSales.items} onRefresh={() => void workspace.posSales.reload()} />;
      case 'pos_shifts':
        return <IndustryPosShiftHistory />;
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
        return <IndustryOrdersSection orders={workspace.orders} title="零售订单" onRefresh={() => void workspace.refresh()} notify={workspace.addNotification} />;
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
        return <IndustrySettingsSection workspaceName={manifest.workspaceName} templateName="综合零售商" notify={workspace.addNotification} />;
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

/**
 * 箱包批发商后台：款号、材质、颜色尺寸 SKU 与批发订单为核心。
 */
import React, { useMemo, useState } from 'react';
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
import { KpiCard, KpiGrid, PageHeader, SectionCard, StatusPill, formatMoney } from '../shared/kit';
import { industryModuleIcons } from '../shared/navIcons';
import { parseIndustryProductAttributes } from '../shared/data';
import { useIndustryWorkspace } from '../shared/useIndustryWorkspace';
import { bagsWholesaleManifest } from './manifest';

export const BagsWholesaleWorkspace: React.FC<IndustryWorkspaceModuleProps> = ({ mobileMode, onBackToDesktop, embedded, activeSection, onSectionChange }) => {
  const manifest = bagsWholesaleManifest;
  const capability = manifest.capability;
  const workspace = useIndustryWorkspace(capability);
  const [localActive, setLocalActive] = useState<MerchantIndustryModuleKey>('dashboard');
  const active = activeSection ?? localActive;
  const setActive = (key: MerchantIndustryModuleKey) => onSectionChange ? onSectionChange(key) : setLocalActive(key);
  const nav = manifest.nav.map(item => ({ ...item, icon: industryModuleIcons[item.key] }));

  const materialBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of workspace.products) {
      const attributes = parseIndustryProductAttributes(product as unknown as { industryAttributes?: unknown });
      const material = String(attributes.material || product.fabric || '未填写材质');
      counts.set(material, (counts.get(material) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((left, right) => right[1] - left[1]).slice(0, 5);
  }, [workspace.products]);

  const dashboard = (
    <div className="space-y-4">
      <PageHeader title="箱包批发经营首页" description="款号、材质、颜色尺寸 SKU 与现货数据来自真实商品与库存。" />
      <KpiGrid>
        <KpiCard label="箱包款式" value={workspace.metrics.publishedProducts} hint={`全部 ${workspace.metrics.productCount}`} />
        <KpiCard label="待处理订单" value={workspace.metrics.pendingOrders} />
        <KpiCard label="SKU 可售件数" value={workspace.metrics.stockTotal} />
        <KpiCard label="本月销售额" value={formatMoney(workspace.metrics.monthSales)} />
      </KpiGrid>
      <SectionCard title="材质分布" description="按商品材质字段统计，用于补货决策。">
        <ul className="divide-y divide-neutral-100">
          {materialBreakdown.map(([material, count]) => (
            <li key={material} className="flex items-center justify-between py-2 text-sm">
              <span className="font-medium">{material}</span>
              <StatusPill>{count} 款</StatusPill>
            </li>
          ))}
          {!materialBreakdown.length ? <li className="py-6 text-center text-sm text-neutral-500">暂无商品材质数据。</li> : null}
        </ul>
      </SectionCard>
      <div className="grid gap-3 lg:grid-cols-2">
        <RecentIndustryOrders orders={workspace.orders} title="最近箱包订单" onOpenOrders={() => setActive('orders')} />
        <IndustryLowStock balances={workspace.inventory.items} title="箱包库存预警" />
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
        return <IndustryOrdersSection orders={workspace.orders} title="箱包批发订单" onRefresh={() => void workspace.refresh()} notify={workspace.addNotification} />;
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
        return <IndustrySettingsSection workspaceName={manifest.workspaceName} templateName="箱包批发商" notify={workspace.addNotification} />;
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

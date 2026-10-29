/**
 * 百货连锁店后台：总部商品、门店库存、调拨与门店 POS。
 */
import React, { useEffect, useState } from 'react';
import { ArrowLeftRight, Store } from 'lucide-react';
import type { MerchantIndustryModuleKey } from '../../../constants/merchantIndustryCapabilities';
import { IndustryWorkspaceShell, type IndustryWorkspaceModuleProps } from '../shared/IndustryWorkspaceShell';
import { IndustryProductsSection, IndustryInventorySection } from '../shared/IndustryProductsSection';
import { IndustryOrdersSection } from '../shared/IndustryOrdersSection';
import { IndustryCustomersSection } from '../shared/IndustryCustomersSection';
import { IndustrySettingsSection } from '../shared/IndustrySettingsSection';
import { IndustryTeamSection } from '../shared/IndustryTeamSection';
import { IndustryMessageSection } from '../shared/IndustryMessageSection';
import { IndustryPosSection, IndustryPosSalesHistory, IndustryPosShiftHistory } from '../shared/IndustryPosSection';
import { IndustryLowStock, RecentIndustryOrders } from '../shared/IndustryDashboardParts';
import { KpiCard, KpiGrid, PageHeader, SectionCard, StatusPill, formatMoney } from '../shared/kit';
import { industryModuleIcons } from '../shared/navIcons';
import { useIndustryWorkspace } from '../shared/useIndustryWorkspace';
import { describeApiError, listIndustryStores, type IndustryStore } from '../shared/data';
import { ChainStoresSection } from './stores';
import { ChainTransfersSection } from './transfers';
import { departmentChainRetailManifest } from './manifest';

export const DepartmentChainRetailWorkspace: React.FC<IndustryWorkspaceModuleProps> = ({ mobileMode, onBackToDesktop, embedded, activeSection, onSectionChange }) => {
  const manifest = departmentChainRetailManifest;
  const capability = manifest.capability;
  const workspace = useIndustryWorkspace(capability);
  const [localActive, setLocalActive] = useState<MerchantIndustryModuleKey>('dashboard');
  const active = activeSection ?? localActive;
  const setActive = (key: MerchantIndustryModuleKey) => onSectionChange ? onSectionChange(key) : setLocalActive(key);
  const [stores, setStores] = useState<IndustryStore[]>([]);
  const [storeError, setStoreError] = useState('');
  const nav = manifest.nav.map(item => ({ ...item, icon: industryModuleIcons[item.key] }));

  const reloadStores = () => {
    listIndustryStores()
      .then(list => { setStores(list); setStoreError(''); })
      .catch(caught => setStoreError(describeApiError(caught, '门店读取失败')));
  };

  useEffect(() => { reloadStores(); }, []);

  const activeStores = stores.filter(store => store.status === 'active');

  const dashboard = (
    <div className="space-y-4">
      <PageHeader title="连锁经营首页" description="门店、门店库存、调拨与门店销售来自真实数据。" />
      <KpiGrid>
        <KpiCard label="营业门店" value={activeStores.length} hint={`门店总数 ${stores.length}`} />
        <KpiCard label="门店 POS 销售额" value={formatMoney(workspace.metrics.posSalesTotal)} hint={`${workspace.metrics.posSalesCount} 笔`} />
        <KpiCard label="待处理门店订单" value={workspace.metrics.pendingOrders} />
        <KpiCard label="总部库存预警" value={workspace.metrics.lowStockSkus} />
      </KpiGrid>
      {storeError ? <p className="text-sm text-red-600">{storeError}</p> : null}
      <SectionCard title="门店概览" description="门店库存独立核算，调拨完成后才会变更。" actions={<button type="button" onClick={() => setActive('stores')} className="text-xs font-semibold text-neutral-700 hover:text-neutral-950">门店管理</button>}>
        <ul className="divide-y divide-neutral-100">
          {stores.map(store => (
            <li key={store.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <div>
                <p className="font-semibold text-neutral-900">{store.name}</p>
                <p className="text-xs text-neutral-500">{store.code} · {[store.city, store.country].filter(Boolean).join(' / ') || '未填写地址'}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill tone={store.status === 'active' ? 'success' : 'warning'}>{store.status === 'active' ? '营业中' : '已停用'}</StatusPill>
                <span className="text-xs text-neutral-500">SKU {store.stockSummary?.skuCount ?? 0} · {store.stockSummary?.onHandQuantity ?? 0} 件</span>
              </div>
            </li>
          ))}
          {!stores.length ? <li className="py-6 text-center text-sm text-neutral-500">还没有门店。请先在门店管理中创建门店。</li> : null}
        </ul>
      </SectionCard>
      <SectionCard title="快捷入口">
        <div className="grid gap-2 sm:grid-cols-3">
          <button type="button" onClick={() => setActive('stores')} className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-3 text-sm font-semibold hover:border-neutral-400">
            门店管理<Store className="h-4 w-4 text-neutral-500" />
          </button>
          <button type="button" onClick={() => setActive('transfers')} className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-3 text-sm font-semibold hover:border-neutral-400">
            发起调拨<ArrowLeftRight className="h-4 w-4 text-neutral-500" />
          </button>
          <button type="button" onClick={() => setActive('pos')} className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-3 text-sm font-semibold hover:border-neutral-400">
            门店收银<Store className="h-4 w-4 text-neutral-500" />
          </button>
        </div>
      </SectionCard>
      <div className="grid gap-3 lg:grid-cols-2">
        <RecentIndustryOrders orders={workspace.orders} title="最近门店订单" onOpenOrders={() => setActive('orders')} />
        <IndustryLowStock balances={workspace.inventory.items} title="总部库存预警" threshold={10} />
      </div>
    </div>
  );

  const page = (() => {
    switch (active) {
      case 'stores':
        return <ChainStoresSection products={workspace.products} notify={workspace.addNotification} />;
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
      case 'transfers':
        return <ChainTransfersSection products={workspace.products} notify={workspace.addNotification} />;
      case 'pos':
        return (
          <IndustryPosSection
            capability={capability}
            products={workspace.products}
            sales={workspace.posSales.items}
            stores={activeStores}
            notify={workspace.addNotification}
            onSaleCreated={() => {
              void workspace.posSales.reload();
              void workspace.inventory.reload();
              reloadStores();
            }}
          />
        );
      case 'pos_sales':
        return <IndustryPosSalesHistory sales={workspace.posSales.items} onRefresh={() => void workspace.posSales.reload()} />;
      case 'pos_shifts':
        return <IndustryPosShiftHistory stores={activeStores} />;
      case 'orders':
        return <IndustryOrdersSection orders={workspace.orders} title="门店订单" onRefresh={() => void workspace.refresh()} notify={workspace.addNotification} />;
      case 'customers':
        return <IndustryCustomersSection customers={workspace.customers} onRefresh={() => void workspace.refresh()} notify={workspace.addNotification} />;
      case 'team':
        return <IndustryTeamSection workspaceName={manifest.workspaceName} merchantId={workspace.merchantId} notify={workspace.addNotification} />;
      case 'messages':
        return <IndustryMessageSection merchantId={workspace.merchantId} onOpenOrders={() => setActive('orders')} />;
      case 'settings':
        return <IndustrySettingsSection workspaceName={manifest.workspaceName} templateName="百货连锁店" notify={workspace.addNotification} />;
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

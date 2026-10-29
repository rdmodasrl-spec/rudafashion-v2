/**
 * 首页通用区块（真实数据）：只负责展示，指标口径由各行业页面决定。
 */
import React from 'react';
import { ArrowRight } from 'lucide-react';
import type { Order } from '../../../types/b2b';
import type { IndustryInventoryBalance, IndustryPurchaseOrder } from './data';
import { SectionCard, StatusPill, formatDate, formatMoney } from './kit';
import { orderStatusLabel } from './IndustryOrdersSection';

export const RecentIndustryOrders: React.FC<{
  orders: Order[];
  title: string;
  onOpenOrders: () => void;
}> = ({ orders, title, onOpenOrders }) => (
  <SectionCard
    title={title}
    actions={<button type="button" onClick={onOpenOrders} className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-700 hover:text-neutral-950">查看全部<ArrowRight className="h-3.5 w-3.5" /></button>}
  >
    <ul className="divide-y divide-neutral-100">
      {orders.slice(0, 5).map(order => (
        <li key={order.id} className="flex items-center justify-between gap-3 py-2 text-sm">
          <div className="min-w-0">
            <p className="truncate font-semibold text-neutral-900">{order.orderNo}</p>
            <p className="truncate text-xs text-neutral-500">{order.companyName || order.customerCompanyName || '—'} · {formatDate(order.createdAt || order.date)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusPill tone={order.status === 'delivered' ? 'success' : order.status === 'cancelled' ? 'neutral' : 'warning'}>{orderStatusLabel(order.status)}</StatusPill>
            <span className="tabular-nums font-semibold">{formatMoney(order.totalAmount)}</span>
          </div>
        </li>
      ))}
      {!orders.length ? <li className="py-6 text-center text-sm text-neutral-500">暂无订单。</li> : null}
    </ul>
  </SectionCard>
);

export const IndustryLowStock: React.FC<{
  balances: IndustryInventoryBalance[];
  title: string;
  threshold?: number;
}> = ({ balances, title, threshold = 5 }) => {
  const low = balances.filter(item => item.availableQuantity <= threshold).slice(0, 6);
  return (
    <SectionCard title={title} description={`可售数量 ≤ ${threshold} 的 SKU`}>
      <ul className="divide-y divide-neutral-100">
        {low.map(item => (
          <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium text-neutral-900">{item.product.styleNo} · {item.product.name}</p>
              <p className="truncate text-xs text-neutral-500">{item.sku}{item.color ? ` · ${item.color}` : ''}{item.size ? ` · ${item.size}` : ''}</p>
            </div>
            <StatusPill tone={item.availableQuantity <= 0 ? 'danger' : 'warning'}>{item.availableQuantity} 可售</StatusPill>
          </li>
        ))}
        {!low.length ? <li className="py-6 text-center text-sm text-neutral-500">暂无库存预警。</li> : null}
      </ul>
    </SectionCard>
  );
};

export const RecentPurchaseOrders: React.FC<{
  orders: IndustryPurchaseOrder[];
  title: string;
  onOpen: () => void;
}> = ({ orders, title, onOpen }) => (
  <SectionCard
    title={title}
    actions={<button type="button" onClick={onOpen} className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-700 hover:text-neutral-950">采购工作区<ArrowRight className="h-3.5 w-3.5" /></button>}
  >
    <ul className="divide-y divide-neutral-100">
      {orders.slice(0, 5).map(order => (
        <li key={order.id} className="flex items-center justify-between gap-3 py-2 text-sm">
          <div className="min-w-0">
            <p className="truncate font-semibold text-neutral-900">{order.purchaseOrderNo}</p>
            <p className="truncate text-xs text-neutral-500">{order.supplier?.name || '—'} · {formatDate(order.orderedAt || order.expectedAt)}</p>
          </div>
          <StatusPill tone={order.status === 'received' ? 'success' : order.status === 'cancelled' ? 'neutral' : 'warning'}>
            {order.status === 'draft' ? '草稿' : order.status === 'ordered' ? '已下单' : order.status === 'partially_received' ? '部分到货' : order.status === 'received' ? '已到货' : '已取消'}
          </StatusPill>
        </li>
      ))}
      {!orders.length ? <li className="py-6 text-center text-sm text-neutral-500">暂无采购单。</li> : null}
    </ul>
  </SectionCard>
);

/**
 * 行业订单区段：读取与状态推进都走现有订单 API，遵守服务端允许的状态机。
 */
import React, { useMemo, useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import type { Order } from '../../../types/b2b';
import { advanceIndustryOrder, describeApiError } from './data';
import {
  Button,
  DataTable,
  ErrorBanner,
  FormField,
  Modal,
  PageHeader,
  SearchInput,
  SectionCard,
  StatusPill,
  formatMoney,
  inputClass,
  type StatusTone
} from './kit';

const ORDER_TONES: Record<string, StatusTone> = {
  pending: 'warning',
  placed: 'warning',
  confirmed: 'info',
  picking: 'info',
  shipped: 'info',
  delivered: 'success',
  cancelled: 'neutral',
  refunded: 'danger'
};

export const orderStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    pending: '待接单',
    placed: '待接单',
    confirmed: '已接单',
    picking: '备货中',
    shipped: '已发货',
    delivered: '已完成',
    cancelled: '已取消',
    refunded: '已退款'
  };
  return labels[status] || status;
};

function nextActions(order: Order): Array<{ status: string; label: string }> {
  switch (order.status) {
    case 'pending':
    case 'placed':
      return [{ status: 'confirmed', label: '接单' }, { status: 'cancelled', label: '取消' }];
    case 'confirmed':
      return [{ status: 'picking', label: '开始备货' }, { status: 'cancelled', label: '取消' }];
    case 'picking':
      return [{ status: 'shipped', label: '发货' }, { status: 'cancelled', label: '取消' }];
    case 'shipped':
      return [{ status: 'delivered', label: '完成订单' }];
    default:
      return [];
  }
}

export const IndustryOrdersSection: React.FC<{
  orders: Order[];
  title?: string;
  onRefresh?: () => void;
  notify: (type: 'success' | 'info' | 'warning', title: string, message: string) => void;
}> = ({ orders, title = '订单管理', onRefresh, notify }) => {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [shipTarget, setShipTarget] = useState<Order | null>(null);
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');

  const statuses = useMemo(() => Array.from(new Set(orders.map(order => order.status))), [orders]);
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return orders.filter(order => {
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;
      if (!keyword) return true;
      return [order.orderNo, order.companyName, order.customerCompanyName]
        .some(value => String(value || '').toLowerCase().includes(keyword));
    });
  }, [orders, query, statusFilter]);

  const runAction = async (order: Order, status: string) => {
    setBusyId(order.id);
    setError('');
    try {
      await advanceIndustryOrder(order, status);
      notify('success', '订单状态已更新', `${order.orderNo} → ${orderStatusLabel(status)}`);
      onRefresh?.();
    } catch (caught) {
      setError(describeApiError(caught, '订单状态更新失败'));
    } finally {
      setBusyId('');
    }
  };

  const submitShipment = async () => {
    if (!shipTarget) return;
    if (!carrier.trim() || !trackingNumber.trim()) {
      setError('发货需要填写承运商与运单号');
      return;
    }
    setBusyId(shipTarget.id);
    setError('');
    try {
      await advanceIndustryOrder(shipTarget, 'shipped', { carrier: carrier.trim(), trackingNumber: trackingNumber.trim() });
      notify('success', '订单已发货', `${shipTarget.orderNo} · ${carrier.trim()} ${trackingNumber.trim()}`);
      setShipTarget(null);
      setCarrier('');
      setTrackingNumber('');
      onRefresh?.();
    } catch (caught) {
      setError(describeApiError(caught, '发货失败'));
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        description={`共 ${orders.length} 个订单；状态推进由服务端订单状态机校验。`}
        actions={<Button variant="ghost" onClick={() => onRefresh?.()}><RefreshCcw className="h-4 w-4" />刷新</Button>}
      />
      {error ? <ErrorBanner message={error} onDismiss={() => setError('')} /> : null}
      <SectionCard
        title="订单列表"
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <SearchInput value={query} onChange={setQuery} placeholder="搜索订单号或客户" />
            <select className="h-10 rounded-md border border-neutral-300 bg-white px-2 text-sm" value={statusFilter} onChange={event => setStatusFilter(event.target.value)} aria-label="订单状态筛选">
              <option value="all">全部状态</option>
              {statuses.map(status => <option key={status} value={status}>{orderStatusLabel(status)}</option>)}
            </select>
          </div>
        }
      >
        <DataTable
          minWidth={940}
          rows={filtered}
          rowKey={order => order.id}
          emptyText={orders.length ? '没有符合条件的订单。' : '暂无订单。'}
          columns={[
            { key: 'no', header: '订单号', render: order => <span className="font-semibold text-neutral-950">{order.orderNo}</span> },
            { key: 'customer', header: '客户', render: order => order.companyName || order.customerCompanyName || '—' },
            { key: 'qty', header: '件数', align: 'right', render: order => order.totalQty },
            { key: 'amount', header: '金额', align: 'right', render: order => formatMoney(order.totalAmount) },
            { key: 'status', header: '状态', render: order => <StatusPill tone={ORDER_TONES[order.status] || 'neutral'}>{orderStatusLabel(order.status)}</StatusPill> },
            { key: 'payment', header: '支付', render: order => order.paymentStatus },
            {
              key: 'actions',
              header: '操作',
              render: order => (
                <div className="flex flex-wrap items-center gap-1">
                  {nextActions(order).map(action => (
                    <Button
                      key={action.status}
                      size="sm"
                      variant={action.status === 'cancelled' ? 'danger' : 'secondary'}
                      busy={busyId === order.id}
                      onClick={() => {
                        if (action.status === 'shipped') {
                          setShipTarget(order);
                          setError('');
                          return;
                        }
                        if (action.status === 'cancelled' && !window.confirm(`确认取消订单 ${order.orderNo}？`)) return;
                        void runAction(order, action.status);
                      }}
                    >
                      {action.label}
                    </Button>
                  ))}
                  {!nextActions(order).length ? <span className="text-xs text-neutral-400">无可用操作</span> : null}
                </div>
              )
            }
          ]}
        />
      </SectionCard>

      <Modal
        open={!!shipTarget}
        title={shipTarget ? `发货 · ${shipTarget.orderNo}` : '发货'}
        onClose={() => setShipTarget(null)}
        footer={<><Button variant="ghost" onClick={() => setShipTarget(null)} disabled={busyId === shipTarget?.id}>取消</Button><Button variant="primary" busy={busyId === shipTarget?.id} onClick={() => void submitShipment()}>确认发货</Button></>}
      >
        <div className="space-y-3">
          <FormField label="承运商" required>
            <input className={inputClass} value={carrier} onChange={event => setCarrier(event.target.value)} placeholder="如 DHL / 顺丰" />
          </FormField>
          <FormField label="运单号" required>
            <input className={inputClass} value={trackingNumber} onChange={event => setTrackingNumber(event.target.value)} />
          </FormField>
        </div>
      </Modal>
    </div>
  );
};


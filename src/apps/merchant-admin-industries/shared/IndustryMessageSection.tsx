/**
 * 行业后台消息中心：复用商家通知基础设施（`/api/merchant/notifications` + 已读接口），
 * 不生成模拟消息；没有真实消息时显示空状态。
 */
import React, { useMemo, useState } from 'react';
import { BellRing, CheckCheck, RefreshCcw } from 'lucide-react';
import {
  merchantNotificationKind,
  merchantNotificationText,
  useMerchantNotifications
} from '../../merchant-admin-common/components/merchant/merchantNotifications';
import { Button, PageHeader, SectionCard, StatusPill, formatDate } from './kit';

const kindLabels: Record<string, string> = {
  order: '订单与收款',
  inventory: '库存与商品',
  system: '商家与账号',
  other: '其他'
};

export const IndustryMessageSection: React.FC<{
  merchantId: string | null;
  onOpenOrders?: () => void;
}> = ({ merchantId, onOpenOrders }) => {
  const { notifications, unread, loading, error, reload, markRead } = useMerchantNotifications({ scopeKey: merchantId || '' });
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const items = useMemo(
    () => (filter === 'unread' ? notifications.filter(item => !item.readAt) : notifications),
    [filter, notifications]
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="消息中心"
        description="订单状态、库存预警、采购到货与调拨提醒来自服务端通知，未读状态与铃铛一致。"
        actions={<Button variant="ghost" busy={loading} onClick={reload}><RefreshCcw className="h-4 w-4" />刷新</Button>}
      />
      {error ? <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">消息读取失败：{error}</p> : null}
      <SectionCard title="消息列表" description={`未读 ${unread} 条 · 共 ${notifications.length} 条`}>
        <div className="mb-3 flex flex-wrap gap-2">
          <Button size="sm" variant={filter === 'all' ? 'primary' : 'secondary'} onClick={() => setFilter('all')}>全部</Button>
          <Button size="sm" variant={filter === 'unread' ? 'primary' : 'secondary'} onClick={() => setFilter('unread')}>未读 {unread}</Button>
        </div>
        {loading && notifications.length === 0 ? (
          <p className="rounded-lg bg-neutral-50 p-4 text-center text-xs text-neutral-500">正在读取消息…</p>
        ) : items.length === 0 ? (
          <p className="rounded-lg bg-neutral-50 p-4 text-center text-xs text-neutral-500">
            {notifications.length === 0 ? '暂无消息。业务事件产生后会出现在这里。' : '没有未读消息'}
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {items.map(notification => {
              const text = merchantNotificationText(notification);
              const kind = merchantNotificationKind(notification.eventType);
              return (
                <li key={notification.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill tone={notification.readAt ? 'neutral' : 'warning'}>{notification.readAt ? '已读' : '未读'}</StatusPill>
                      <span className="text-[11px] font-semibold text-neutral-500">{kindLabels[kind] || '其他'}</span>
                      <span className="text-[11px] text-neutral-400">{formatDate(notification.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-neutral-950">{text.title || notification.eventType}</p>
                    {text.message ? <p className="mt-1 text-xs leading-5 text-neutral-600">{text.message}</p> : null}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {kind === 'order' && onOpenOrders ? (
                      <Button size="sm" variant="secondary" onClick={onOpenOrders}>查看订单</Button>
                    ) : null}
                    {notification.readAt ? null : (
                      <Button
                        size="sm"
                        variant="ghost"
                        busy={busyId === notification.id}
                        onClick={() => {
                          setBusyId(notification.id);
                          void markRead(notification.id).finally(() => setBusyId(null));
                        }}
                      >
                        <CheckCheck className="h-3.5 w-3.5" />标记已读
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 inline-flex items-center gap-1 text-[11px] text-neutral-500"><BellRing className="h-3.5 w-3.5" />通知由服务端按商家会话隔离，不会显示其他商家消息。</p>
      </SectionCard>
    </div>
  );
};

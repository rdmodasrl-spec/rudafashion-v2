import React, { useEffect, useRef, useState } from 'react';
import { Bell, X } from 'lucide-react';
import {
  merchantNotificationText,
  useMerchantNotifications,
  type MerchantNotification
} from './merchantNotifications';

export type { MerchantNotification };

interface MerchantNotificationBellProps {
  onOpenNotification?: (notification: MerchantNotification) => void;
  className?: string;
  buttonClassName?: string;
  iconClassName?: string;
  badgeClassName?: string;
}

export function MerchantNotificationBell({
  onOpenNotification,
  className = '',
  buttonClassName = '',
  iconClassName = '',
  badgeClassName = ''
}: MerchantNotificationBellProps) {
  const { notifications, unread, error, loading, markRead } = useMerchantNotifications();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<MerchantNotification | null>(null);
  const initialIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (loading) return;
    const previousIds = initialIdsRef.current;
    initialIdsRef.current = new Set(notifications.map(item => item.id));
    if (!previousIds) return;
    const newest = notifications.find(item => item.priority === 'high' && !previousIds.has(item.id) && !item.readAt);
    if (!newest) return;
    setToast(newest);
    const timer = window.setTimeout(() => setToast(current => current?.id === newest.id ? null : current), 6000);
    return () => window.clearTimeout(timer);
  }, [notifications, loading]);

  const openNotification = async (notification: MerchantNotification) => {
    setToast(null);
    const marked = await markRead(notification.id);
    if (marked) onOpenNotification?.(notification);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        aria-label={unread ? `通知，${unread} 条未读` : '通知'}
        aria-expanded={open}
        onClick={() => { setOpen(value => !value); setToast(null); }}
        className={`relative inline-flex items-center justify-center ${buttonClassName}`}
      >
        <Bell className={`${iconClassName} ${unread ? 'animate-[bell-ring_1.8s_ease-in-out_infinite]' : ''}`} />
        {unread > 0 && <span className={`absolute -right-1 -top-1 min-w-[17px] rounded-full bg-rose-500 px-1 text-center text-[9px] font-bold leading-[17px] text-white ${badgeClassName}`}>{unread > 99 ? '99+' : unread}</span>}
      </button>
      {toast && !open && (
        <div role="status" aria-live="polite" className="fixed right-3 top-16 z-[100] w-[min(22rem,calc(100vw-1.5rem))] rounded-xl border border-neutral-200 bg-white text-neutral-900 shadow-xl">
          <button type="button" onClick={() => void openNotification(toast)} className="block w-full px-3 pb-3 pt-3 text-left">
            <p className="text-xs font-semibold">{merchantNotificationText(toast).title || '业务通知'}</p>
            {merchantNotificationText(toast).message && <p className="mt-1 text-[11px] text-neutral-600">{merchantNotificationText(toast).message}</p>}
            <p className="mt-1 text-[9px] text-neutral-400">{new Date(toast.createdAt).toLocaleString()}</p>
          </button>
          <button type="button" aria-label="关闭提示" onClick={() => setToast(null)} className="absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {open && (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-[100] max-h-80 w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-neutral-200 bg-white py-1 text-neutral-900 shadow-xl">
          <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2">
            <span className="text-xs font-semibold">通知</span>
            <span className="text-[10px] text-neutral-500">{unread} 条未读</span>
          </div>
          {error ? <p role="alert" className="px-3 py-3 text-xs text-rose-600">{error}</p>
            : notifications.length ? notifications.map(notification => {
              const text = merchantNotificationText(notification);
              return (
                <div key={notification.id} className={`border-b border-neutral-100 px-3 py-2.5 last:border-b-0 ${notification.readAt ? 'opacity-70' : ''}`}>
                  <button type="button" onClick={() => void openNotification(notification)} className="block w-full text-left hover:bg-neutral-50">
                    <span className="flex items-center gap-2 text-xs font-semibold">
                      {!notification.readAt && <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />}
                      {text.title || '业务通知'}
                    </span>
                    {text.message && <span className="mt-1 block text-[10px] leading-4 text-neutral-600">{text.message}</span>}
                    <span className="mt-1 block text-[9px] text-neutral-400">{new Date(notification.createdAt).toLocaleString()}</span>
                  </button>
                </div>
              );
            }) : <p className="px-3 py-4 text-center text-xs text-neutral-500">暂无通知</p>}
        </div>
      )}
    </div>
  );
}

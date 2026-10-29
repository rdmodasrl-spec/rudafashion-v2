import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  CheckCircle2, 
  Truck, 
  Lock, 
  Flame, 
  X, 
  Volume2, 
  VolumeX, 
  ExternalLink,
  Smartphone
} from 'lucide-react';
import { useB2B } from '../../../../context/B2BContext';
import { apiGet, apiPost } from '../../../../api/client';
import { getIntlLocale } from '../../../../i18n/translations';


interface PushNotificationItem {
  id: string;
  type: 'order_confirmed' | 'order_shipped' | 'private_collection' | 'restock';
  title: string;
  body: string;
  time: string;
  read: boolean;
  actionUrl?: string;
  targetView?: 'account' | 'catalog' | 'merchant_portal';
}

interface PWANotificationsCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PWANotificationsCenter: React.FC<PWANotificationsCenterProps> = ({ isOpen, onClose }) => {
  const { setCurrentView, setActiveBuyerTab, lang, authRole, localizeCopy } = useB2B();
  const isIt = lang === 'it';

  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Notifications must always come from the authenticated notification feed.
  const [notifications, setNotifications] = useState<PushNotificationItem[]>([]);

  useEffect(() => {
    if (!isOpen || (authRole !== 'buyer' && authRole !== 'merchant')) return;
    const endpoint = authRole === 'buyer' ? '/api/notifications?limit=50' : '/api/merchant/notifications';
    void apiGet<{ success: true; notifications: Array<{ id: string; eventType: string; payload: Record<string, unknown>; createdAt: string; readAt: string | null }> }>(endpoint)
      .then(result => {
        const mapped = result.notifications.map(item => {
          const type: PushNotificationItem['type'] = item.eventType.includes('fulfillment') ? 'order_shipped'
            : item.eventType.includes('order') ? 'order_confirmed'
              : item.eventType.includes('vault') ? 'private_collection' : 'restock';
          const payload = item.payload || {};
          const targetView: PushNotificationItem['targetView'] = authRole === 'merchant'
            ? 'merchant_portal' : (type === 'restock' ? 'catalog' : 'account');
          return {
            id: item.id,
            type,
            title: String(payload.title || (type === 'order_shipped' ? '🚚 订单物流状态更新' : 'RUDA 业务通知')),
            body: String(payload.message || payload.description || item.eventType),
            time: new Date(item.createdAt).toLocaleString(getIntlLocale(lang)),
            read: Boolean(item.readAt),
            targetView
          };
        });
        setNotifications(mapped);
      })
      .catch(() => {
        setNotifications([]);
      });
  }, [authRole, isIt, isOpen]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  if (!isOpen) return null;

  const requestPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const res = await Notification.requestPermission();
        setPermission(res);
        if (res === 'granted') {
          triggerNativePush(localizeCopy('🔔 消息通知已启用', '🔔 Notifiche attivate'), localizeCopy('您将能第一时间接收 RUDA 订单发货、缺货补齐与私密爆款提醒。', 'Riceverai aggiornamenti su ordini, spedizioni e riassortimenti RUDA.'));
        }
      } catch (err) {
        console.warn('Web push permission error:', err);
      }
    }
  };

  const triggerNativePush = (title: string, body: string) => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/pwa-192x192.png',
          badge: '/apple-touch-icon.png'
        });
      } catch (e) {
        // Fallback for environments where new Notification() without service worker fails
        if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
          navigator.serviceWorker.ready.then(reg => {
            reg.showNotification(title, {
              body,
              icon: '/pwa-192x192.png',
              badge: '/apple-touch-icon.png'
            });
          });
        }
      }
    }
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    const persistent = notifications.filter(item => !item.read);
    void Promise.all(persistent.map(item => apiPost(`/api/${authRole === 'merchant' ? 'merchant/' : ''}notifications/${encodeURIComponent(item.id)}/read`, {}))).catch(() => undefined);
  };

  const handleItemClick = (item: PushNotificationItem) => {
    setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, read: true } : n));
    void apiPost(`/api/${authRole === 'merchant' ? 'merchant/' : ''}notifications/${encodeURIComponent(item.id)}/read`, {}).catch(() => undefined);
    onClose();
    if (item.targetView === 'account') {
      if (item.type === 'private_collection') {
        setActiveBuyerTab('private_vault');
      } else {
        setActiveBuyerTab('orders');
      }
      setCurrentView('account');
    } else if (item.targetView === 'catalog') {
      setCurrentView('catalog');
    } else if (item.targetView === 'merchant_portal') {
      setCurrentView('merchant_portal');
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div 
      id="pwa-notifications-overlay"
      className="fixed inset-0 z-50 flex items-start justify-end p-2 sm:p-4 bg-black/50 backdrop-blur-xs animate-fadeIn"
      role="dialog"
      aria-modal="true"
    >
      <div 
        id="pwa-notifications-drawer"
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[92vh] animate-slideInRight"
      >
        {/* Header */}
        <div className="p-4 bg-neutral-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center text-amber-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold tracking-tight">{localizeCopy('实时消息通知中心', 'Centro notifiche')}</h3>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-[10px] font-bold">
                    {unreadCount} {localizeCopy('未读', 'non lette')}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-400">RUDA Fashion B2B · Web Push 订阅</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? '提示音已开启' : '提示音已静音'}
              className="p-1.5 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-neutral-500" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Web Push Permission Bar */}
        <div className="px-4 py-2.5 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-neutral-700">
            <Smartphone className="w-3.5 h-3.5 text-neutral-500" />
            <span>浏览器系统级通知权限:</span>
            <span className={`font-bold ${
              permission === 'granted' ? 'text-emerald-700' : permission === 'denied' ? 'text-rose-600' : 'text-amber-700'
            }`}>
              {permission === 'granted' ? '已授权接收' : permission === 'denied' ? '已拒绝' : '未授权'}
            </span>
          </div>

          {permission !== 'granted' ? (
            <button
              onClick={requestPermission}
              className="px-2.5 py-1 bg-neutral-900 text-white text-[11px] font-bold rounded hover:bg-black transition-colors cursor-pointer"
            >
              开启通知
            </button>
          ) : (
            <button
              onClick={markAllRead}
              className="text-[11px] text-neutral-500 hover:text-neutral-900 font-medium cursor-pointer"
            >
              全部标为已读
            </button>
          )}
        </div>

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 p-2 space-y-1">
          {notifications.length === 0 && (
            <div className="p-8 text-center text-xs text-neutral-500">
              {localizeCopy('暂无真实业务通知。', 'Nessuna notifica disponibile.')}
            </div>
          )}
          {notifications.map((item) => {
            return (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`p-3 rounded-xl transition-all cursor-pointer flex items-start gap-3 ${
                  !item.read 
                    ? 'bg-neutral-50/90 hover:bg-neutral-100/90 border border-neutral-200/80 shadow-xs' 
                    : 'hover:bg-neutral-50 opacity-80'
                }`}
              >
                <div className="shrink-0 mt-0.5">
                  {item.type === 'order_confirmed' && (
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  )}
                  {item.type === 'order_shipped' && (
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center">
                      <Truck className="w-4 h-4" />
                    </div>
                  )}
                  {item.type === 'private_collection' && (
                    <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-800 flex items-center justify-center">
                      <Lock className="w-4 h-4" />
                    </div>
                  )}
                  {item.type === 'restock' && (
                    <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center">
                      <Flame className="w-4 h-4" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-neutral-900 truncate">
                      {item.title}
                    </h4>
                    <span className="text-[10px] text-neutral-400 shrink-0">
                      {item.time}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-600 line-clamp-2 mt-0.5 leading-relaxed">
                    {item.body}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[10px] font-bold text-neutral-900 flex items-center gap-0.5 hover:underline">
                      点击前往处理 <ExternalLink className="w-2.5 h-2.5" />
                    </span>
                  </div>
                </div>

                {!item.read && (
                  <span className="w-2 h-2 rounded-full bg-neutral-900 mt-2 shrink-0"></span>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
};

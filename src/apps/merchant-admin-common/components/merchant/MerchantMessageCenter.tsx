import React, { useEffect, useRef, useState } from 'react';
import { Bell, ChevronLeft, RefreshCw } from 'lucide-react';
import { useB2B } from '../../../../context/B2BContext';
import { getIntlLocale } from '../../../../i18n/translations';
import {
  merchantNotificationKind,
  merchantNotificationText,
  type MerchantNotification,
  type MerchantNotificationKind
} from './merchantNotifications';

type MessageCenterFilter = 'all' | 'unread' | 'pending';

interface MerchantMessageCenterProps {
  open: boolean;
  notifications: MerchantNotification[];
  unread: number;
  loading: boolean;
  error: string;
  onClose: () => void;
  onMarkRead: (id: string) => Promise<boolean>;
  onReload: () => void;
}

/**
 * 商家手机端统一消息中心（只读列表）。
 * 数据由调用方通过 useMerchantNotifications 提供，接口与未读口径和铃铛完全一致；
 * 本组件不自行发起请求、不使用模拟消息。
 */
export const MerchantMessageCenter: React.FC<MerchantMessageCenterProps> = ({
  open,
  notifications,
  unread,
  loading,
  error,
  onClose,
  onMarkRead,
  onReload
}) => {
  const { lang, localizeCopy } = useB2B();
  const [filter, setFilter] = useState<MessageCenterFilter>('all');
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    setFilter('all');
  }, [open]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (!open) return null;

  const kindLabel = (kind: MerchantNotificationKind) => kind === 'order'
    ? localizeCopy('订单消息', 'Ordini')
    : kind === 'inventory'
      ? localizeCopy('库存提醒', 'Scorte')
      : kind === 'system'
        ? localizeCopy('系统通知', 'Sistema')
        : localizeCopy('业务通知', 'Attività');

  const filtered = notifications.filter(notification => filter === 'all'
    ? true
    : filter === 'unread'
      ? !notification.readAt
      : notification.businessStatus !== 'resolved');

  const filters: Array<{ id: MessageCenterFilter; label: string }> = [
    { id: 'all', label: localizeCopy('全部', 'Tutte') },
    { id: 'unread', label: localizeCopy('未读', 'Non lette') },
    { id: 'pending', label: localizeCopy('待处理', 'Da gestire') }
  ];

  const emptyCopy = error
    ? localizeCopy('消息暂时无法加载', 'Messaggi non disponibili')
    : filter === 'unread'
      ? localizeCopy('没有未读消息', 'Nessun messaggio non letto')
      : filter === 'pending'
        ? localizeCopy('没有待处理消息', 'Nessun messaggio da gestire')
        : localizeCopy('暂无消息', 'Nessun messaggio');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={localizeCopy('消息中心', 'Centro messaggi')}
      className="fixed inset-0 z-[95] flex flex-col bg-[#f5f5f7] text-neutral-900"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-neutral-200 bg-white px-3 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2">
        <button
          type="button"
          onClick={onClose}
          aria-label={localizeCopy('返回', 'Indietro')}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-neutral-700 transition active:scale-[0.98] active:bg-neutral-100"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <h1 className="min-w-0 truncate text-[15px] font-semibold tracking-tight text-neutral-950">{localizeCopy('消息中心', 'Centro messaggi')}</h1>
        <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
          {unread > 0 ? localizeCopy(`${unread} 条未读`, `${unread} non lette`) : localizeCopy('已全部读完', 'Tutto letto')}
        </span>
        <button
          type="button"
          onClick={onReload}
          aria-label={localizeCopy('刷新消息', 'Aggiorna messaggi')}
          className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-full text-neutral-700 transition active:scale-[0.98] active:bg-neutral-100"
        >
          <RefreshCw className={`h-[18px] w-[18px] ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
        </button>
      </header>

      <p role="status" aria-live="polite" className="sr-only">
        {unread > 0 ? localizeCopy(`消息中心，${unread} 条未读`, `Centro messaggi, ${unread} non lette`) : localizeCopy('消息中心，没有未读消息', 'Centro messaggi, nessun messaggio non letto')}
      </p>

      <div className="shrink-0 border-b border-neutral-200/70 bg-white/95 px-4 py-2 backdrop-blur-xl">
        <div role="tablist" aria-label={localizeCopy('消息筛选', 'Filtra messaggi')} className="flex items-center gap-1.5">
          {filters.map(item => {
            const active = filter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(item.id)}
                className={`min-h-8 rounded-full px-3 text-[11px] font-semibold transition ${
                  active ? 'bg-neutral-950 text-white' : 'bg-neutral-100 text-neutral-600'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        {error ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-center">
            <p role="alert" className="text-xs font-semibold text-rose-600">{localizeCopy('消息加载失败', 'Caricamento messaggi non riuscito')}</p>
            <p className="mt-1 text-[11px] leading-4 text-neutral-600">{localizeCopy('请检查网络后重试。', 'Controlla la rete e riprova.')}</p>
            <button type="button" onClick={onReload} className="mt-3 min-h-9 rounded-xl border border-neutral-300 px-4 text-xs font-semibold text-neutral-800 transition active:scale-[0.99]">
              {localizeCopy('重新加载', 'Ricarica')}
            </button>
          </div>
        ) : loading && !notifications.length ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-center text-xs text-neutral-500">{localizeCopy('正在加载消息', 'Caricamento messaggi')}</div>
        ) : filtered.length ? (
          <ul className="space-y-2">
            {filtered.map(notification => {
              const text = merchantNotificationText(notification);
              const kind = merchantNotificationKind(notification.eventType);
              const title = text.title || kindLabel(kind);
              const unreadMessage = !notification.readAt;
              return (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => { if (unreadMessage) void onMarkRead(notification.id); }}
                    aria-label={unreadMessage
                      ? localizeCopy(`未读消息 ${title}，点击标记已读`, `Non letta ${title}, tocca per segnare come letta`)
                      : localizeCopy(`已读消息 ${title}`, `Letta ${title}`)}
                    className={`w-full rounded-2xl border bg-white p-3 text-left shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition ${
                      unreadMessage ? 'border-neutral-200 active:scale-[0.995]' : 'border-neutral-100 opacity-80'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {unreadMessage && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" aria-hidden="true" />}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`min-w-0 break-words text-[13px] leading-5 ${unreadMessage ? 'font-semibold text-neutral-950' : 'font-medium text-neutral-700'}`}>{title}</p>
                          {notification.priority === 'high' && <span className="shrink-0 rounded-full bg-neutral-950 px-1.5 py-0.5 text-[9px] font-semibold text-white">{localizeCopy('重要', 'Importante')}</span>}
                        </div>
                        {text.message && <p className="mt-1 break-words text-[11px] leading-4 text-neutral-600">{text.message}</p>}
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-neutral-500">
                          <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 font-medium text-neutral-600">{kindLabel(kind)}</span>
                          <span>{new Date(notification.createdAt).toLocaleString(getIntlLocale(lang))}</span>
                          {notification.businessStatus !== 'resolved' && <span>{localizeCopy('待处理', 'Da gestire')}</span>}
                          {unreadMessage && <span className="font-semibold text-neutral-700">{localizeCopy('未读', 'Non letta')}</span>}
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-center">
            <Bell className="mx-auto h-5 w-5 text-neutral-400" aria-hidden="true" />
            <p className="mt-2 text-xs text-neutral-600">{emptyCopy}</p>
          </div>
        )}
      </div>
    </div>
  );
};

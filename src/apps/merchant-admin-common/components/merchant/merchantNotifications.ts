import { useEffect, useRef, useState } from 'react';
import { apiGet, apiPost } from '../../../../api/client';

export interface MerchantNotification {
  id: string;
  eventType: string;
  payload: Record<string, unknown>;
  priority: 'low' | 'normal' | 'high';
  businessStatus: string;
  createdAt: string;
  readAt: string | null;
}

export interface MerchantNotificationsResponse {
  success: true;
  unread: number;
  notifications: MerchantNotification[];
}

export type MerchantNotificationKind = 'order' | 'inventory' | 'system' | 'other';

const asText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export function merchantNotificationText(notification: MerchantNotification) {
  const payload = notification.payload || {};
  return {
    title: asText(payload.title),
    message: asText(payload.message) || asText(payload.body) || asText(payload.description)
  };
}

export function merchantNotificationKind(eventType: string): MerchantNotificationKind {
  const type = String(eventType || '').toLowerCase();
  if (/order|agreement|payment|fulfil|ship|bank_transfer|return|invoice/.test(type)) return 'order';
  if (/inventory|stock|material|product|reservation|restock/.test(type)) return 'inventory';
  if (/merchant|company|buyer|admin|customer|account|verif|system|database/.test(type)) return 'system';
  return 'other';
}

type UseMerchantNotificationsOptions = {
  enabled?: boolean;
  intervalMs?: number;
  /** 切换商家（会话租户）时重置列表，避免显示上一个商家的消息。 */
  scopeKey?: string;
};

/**
 * 商家通知的唯一定义：铃铛未读数与消息中心列表共用同一份读取/已读逻辑，
 * 数据全部来自 GET /api/merchant/notifications（服务端按商家会话隔离）。
 */
export function useMerchantNotifications({ enabled = true, intervalMs = 30_000, scopeKey }: UseMerchantNotificationsOptions = {}) {
  const [notifications, setNotifications] = useState<MerchantNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reloadNonce, setReloadNonce] = useState(0);
  const pendingReadIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    setNotifications([]);
    setUnread(0);
    setError('');
    setLoading(true);
  }, [scopeKey]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const load = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      try {
        const response = await apiGet<MerchantNotificationsResponse>('/api/merchant/notifications');
        if (!active) return;
        setNotifications(Array.isArray(response.notifications) ? response.notifications : []);
        setUnread(Number.isFinite(response.unread) ? response.unread : 0);
        setError('');
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : 'NOTIFICATIONS_UNAVAILABLE');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), intervalMs);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [enabled, intervalMs, reloadNonce, scopeKey]);

  const reload = () => {
    setLoading(true);
    setReloadNonce(nonce => nonce + 1);
  };

  const markRead = async (id: string): Promise<boolean> => {
    const target = notifications.find(item => item.id === id);
    if (!target || target.readAt) return true;
    if (pendingReadIds.current.has(id)) return false;
    pendingReadIds.current.add(id);
    try {
      await apiPost(`/api/merchant/notifications/${encodeURIComponent(id)}/read`, {});
      setNotifications(current => current.map(item => item.id === id
        ? { ...item, readAt: new Date().toISOString() }
        : item));
      setUnread(count => Math.max(0, count - 1));
      setError('');
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'NOTIFICATION_READ_FAILED');
      return false;
    } finally {
      pendingReadIds.current.delete(id);
    }
  };

  return { notifications, unread, error, loading, reload, markRead };
}

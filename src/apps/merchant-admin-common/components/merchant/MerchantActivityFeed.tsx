import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Boxes, Clock, Package, RefreshCw, ShieldAlert, ShoppingBag } from 'lucide-react';
import { apiGet, ApiError } from '../../../../api/client';
import { useB2B } from '../../../../context/B2BContext';

export type MerchantActivityTarget = {
  tab: 'products' | 'inventory' | 'orders' | 'app_store';
  productId?: string;
  orderId?: string;
  search?: string;
};

export type MerchantActivityType =
  | 'product_created'
  | 'product_updated'
  | 'inventory_changed'
  | 'order_updated'
  | 'app_installed'
  | 'app_enabled'
  | 'app_disabled'
  | 'app_uninstalled';

export type MerchantActivity = {
  id: string;
  type: MerchantActivityType;
  category: 'product' | 'inventory' | 'order' | 'app';
  occurredAt: string;
  data: Record<string, unknown>;
  target: MerchantActivityTarget;
};

type MerchantActivityResponse = {
  success: true;
  generatedAt: string;
  activities: MerchantActivity[];
};

const activityIcons: Record<MerchantActivity['category'], React.ComponentType<{ className?: string }>> = {
  product: Package,
  inventory: Boxes,
  order: ShoppingBag,
  app: Clock
};

export function MerchantActivityFeed({ onOpenTarget }: { onOpenTarget?: (target: MerchantActivityTarget) => void }) {
  const { localizeCopy, lang } = useB2B();
  const isIt = lang === 'it';
  const [activities, setActivities] = useState<MerchantActivity[]>([]);
  const [loading, setLoading] = useState(true);
  // 错误只保存稳定代码，渲染时再本地化，避免文案回调变化触发重复请求。
  const [error, setError] = useState<'forbidden' | 'failed' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiGet<MerchantActivityResponse>('/api/merchant/activity?limit=40');
      setActivities(Array.isArray(result.activities) ? result.activities : []);
    } catch (loadError) {
      setActivities([]);
      setError(loadError instanceof ApiError && loadError.status === 403 ? 'forbidden' : 'failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const describe = useCallback((activity: MerchantActivity) => {
    const data = activity.data || {};
    const text = (value: unknown) => (typeof value === 'string' || typeof value === 'number' ? String(value) : '');
    switch (activity.type) {
      case 'product_created':
        return {
          title: localizeCopy('新建商品', 'Nuovo prodotto'),
          detail: [text(data.styleNo), text(data.name)].filter(Boolean).join(' · ')
        };
      case 'product_updated':
        return {
          title: localizeCopy('更新商品', 'Prodotto aggiornato'),
          detail: [text(data.styleNo), text(data.name)].filter(Boolean).join(' · ')
        };
      case 'inventory_changed': {
        const quantity = Number(data.quantity);
        const signed = Number.isFinite(quantity) && quantity > 0 ? `+${quantity}` : text(quantity);
        return {
          title: localizeCopy('库存变动', 'Movimento scorte'),
          detail: [text(data.styleNo), text(data.sku), signed, text(data.movementType)].filter(Boolean).join(' · ')
        };
      }
      case 'order_updated':
        return {
          title: localizeCopy('订单更新', 'Ordine aggiornato'),
          detail: [text(data.orderNo), text(data.title) || text(data.step), text(data.status)].filter(Boolean).join(' · ')
        };
      case 'app_installed':
        return { title: localizeCopy('安装应用', 'App installata'), detail: text(data.appName) };
      case 'app_enabled':
        return { title: localizeCopy('启用应用', 'App attivata'), detail: text(data.appName) };
      case 'app_disabled':
        return { title: localizeCopy('停用应用', 'App disattivata'), detail: text(data.appName) };
      case 'app_uninstalled':
        return { title: localizeCopy('卸载应用', 'App disinstallata'), detail: text(data.appName) };
      default:
        return { title: localizeCopy('业务动态', 'Attività'), detail: '' };
    }
  }, [localizeCopy]);

  const formatter = useMemo(
    () => new Intl.DateTimeFormat(isIt ? 'it-IT' : 'zh-CN', { dateStyle: 'medium', timeStyle: 'short' }),
    [isIt]
  );

  const relativeTime = useCallback((iso: string) => {
    const timestamp = new Date(iso).getTime();
    if (Number.isNaN(timestamp)) return '';
    const diffMinutes = Math.round((Date.now() - timestamp) / 60000);
    if (diffMinutes < 1) return localizeCopy('刚刚', 'Adesso');
    if (diffMinutes < 60) return `${diffMinutes}${localizeCopy(' 分钟前', ' min fa')}`;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}${localizeCopy(' 小时前', ' ore fa')}`;
    const diffDays = Math.round(diffHours / 24);
    if (diffDays < 30) return `${diffDays}${localizeCopy(' 天前', ' giorni fa')}`;
    return formatter.format(new Date(timestamp));
  }, [formatter, localizeCopy]);

  return (
    <section id="merchant-recent-activity" className="space-y-3">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-base font-bold text-neutral-950">{localizeCopy('最近动态', 'Attività recenti')}</h1>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[11px] font-semibold text-neutral-700 transition hover:border-neutral-300 hover:text-neutral-950 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          {localizeCopy('刷新', 'Aggiorna')}
        </button>
      </header>

      {error ? (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-4">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-neutral-900">{error === 'forbidden'
              ? localizeCopy('无权限查看动态', 'Permesso insufficiente per le attività')
              : localizeCopy('无法加载动态', 'Impossibile caricare le attività')}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-2 rounded-lg border border-neutral-200 px-3 py-1.5 text-[11px] font-semibold text-neutral-700 hover:border-neutral-300 hover:text-neutral-950"
            >
              {localizeCopy('重试', 'Riprova')}
            </button>
          </div>
        </div>
      ) : loading && !activities.length ? (
        <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
          {[0, 1, 2, 3, 4].map(index => (
            <li key={index} className="flex items-center gap-3 px-4 py-3">
              <span className="h-8 w-8 animate-pulse rounded-lg bg-neutral-100" />
              <span className="flex-1 space-y-2">
                <span className="block h-2.5 w-24 animate-pulse rounded bg-neutral-100" />
                <span className="block h-2.5 w-40 animate-pulse rounded bg-neutral-100" />
              </span>
            </li>
          ))}
        </ul>
      ) : !activities.length ? (
        <p className="rounded-xl border border-neutral-200 bg-white px-4 py-10 text-center text-xs text-neutral-500">
          {localizeCopy('暂无动态', 'Nessuna attività')}
        </p>
      ) : (
        <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {activities.map(activity => {
            const Icon = activityIcons[activity.category] || Clock;
            const { title, detail } = describe(activity);
            const clickable = Boolean(onOpenTarget);
            return (
              <li key={activity.id}>
                {clickable ? (
                  <button
                    type="button"
                    onClick={() => onOpenTarget?.(activity.target)}
                    aria-label={`${title} ${detail}`.trim()}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-neutral-50 focus:bg-neutral-50 focus:outline-none"
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-neutral-900">{title}</span>
                      {detail ? <span className="mt-0.5 block truncate text-[11px] text-neutral-500">{detail}</span> : null}
                    </span>
                    <time
                      dateTime={activity.occurredAt}
                      title={formatter.format(new Date(activity.occurredAt))}
                      className="mt-0.5 shrink-0 text-[10px] font-medium text-neutral-500"
                    >
                      {relativeTime(activity.occurredAt)}
                    </time>
                  </button>
                ) : (
                  <div className="flex items-start gap-3 px-4 py-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-neutral-900">{title}</span>
                      {detail ? <span className="mt-0.5 block truncate text-[11px] text-neutral-500">{detail}</span> : null}
                    </span>
                    <time
                      dateTime={activity.occurredAt}
                      className="mt-0.5 shrink-0 text-[10px] font-medium text-neutral-500"
                    >
                      {relativeTime(activity.occurredAt)}
                    </time>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

import { randomUUID } from 'node:crypto';

export const merchantSyncResources = [
  'products',
  'orders',
  'inventory',
  'customers',
  'production',
  'finance',
  'settings',
  'content',
  'growth'
] as const;

export type MerchantSyncResource = (typeof merchantSyncResources)[number];

export type MerchantSyncEvent = {
  id: string;
  occurredAt: string;
  resources: readonly MerchantSyncResource[];
};

export class MerchantSyncEventHub {
  private readonly subscribers = new Map<string, Set<(event: MerchantSyncEvent) => void>>();

  constructor(private readonly maxSubscribersPerMerchant = 8) {
    if (!Number.isSafeInteger(maxSubscribersPerMerchant) || maxSubscribersPerMerchant < 1) {
      throw new Error('MERCHANT_SYNC_SUBSCRIBER_LIMIT_INVALID');
    }
  }

  subscribe(merchantId: string, listener: (event: MerchantSyncEvent) => void): (() => void) | null {
    if (!merchantId || typeof listener !== 'function') throw new Error('MERCHANT_SYNC_SUBSCRIBER_INVALID');
    let listeners = this.subscribers.get(merchantId);
    if (!listeners) {
      listeners = new Set();
      this.subscribers.set(merchantId, listeners);
    }
    if (listeners.size >= this.maxSubscribersPerMerchant) return null;
    listeners.add(listener);
    let subscribed = true;
    return () => {
      if (!subscribed) return;
      subscribed = false;
      listeners?.delete(listener);
      if (listeners?.size === 0 && this.subscribers.get(merchantId) === listeners) {
        this.subscribers.delete(merchantId);
      }
    };
  }

  publish(merchantId: string, resources: readonly MerchantSyncResource[], occurredAt = new Date()): void {
    if (!merchantId || !resources.length || resources.some(resource => !merchantSyncResources.includes(resource))) {
      throw new Error('MERCHANT_SYNC_EVENT_INVALID');
    }
    const listeners = this.subscribers.get(merchantId);
    if (!listeners?.size) return;
    const event: MerchantSyncEvent = {
      id: randomUUID(),
      occurredAt: occurredAt.toISOString(),
      resources: [...new Set(resources)]
    };
    for (const listener of [...listeners]) {
      try {
        listener(event);
      } catch (error) {
        listeners.delete(listener);
        console.error('[merchant-sync-subscriber]', error instanceof Error ? error.name : 'unknown error');
      }
    }
    if (!listeners.size) this.subscribers.delete(merchantId);
  }

  subscriberCount(merchantId: string): number {
    return this.subscribers.get(merchantId)?.size || 0;
  }
}

export function merchantSyncResourcesForMutation(method: string, path: string): MerchantSyncResource[] {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) return [];
  const normalizedPath = path.split('?')[0] || '';
  const rules: Array<[RegExp, MerchantSyncResource]> = [
    [/^\/products(?:\/|$)/, 'products'],
    [/^\/(?:orders|quotes|employee-orders|employee-picking|ai-order-drafts|pricing-approvals|modagpt\/approvals)(?:\/|$)/, 'orders'],
    [/^\/pos\/(?!settings(?:\/|$))/, 'orders'],
    [/^\/pos\/returns(?:\/|$)/, 'customers'],
    [/^\/(?:inventory|transfers|vault-requests|suppliers|purchase-orders)(?:\/|$)/, 'inventory'],
    [/^\/(?:customers|returns)(?:\/|$)/, 'customers'],
    [/^\/(?:materials|production|suppliers|purchase-orders)(?:\/|$)/, 'production'],
    [/^\/(?:finance|bank-accounts|payouts)(?:\/|$)/, 'finance'],
    [/^\/(?:settings|employees|ai-employees|payment-config|pos\/settings|email)(?:\/|$)/, 'settings'],
    [/^\/installations(?:\/|$)/, 'settings'],
    [/^\/(?:storefront|store-categories|content|gallery|modagpt\/designs)(?:\/|$)/, 'content'],
    [/^\/(?:growth|campaigns|social)(?:\/|$)/, 'growth'],
    [/^\/workspace-drafts\/content(?:\/|$)/, 'content'],
    [/^\/workspace-drafts\/growth(?:\/|$)/, 'growth'],
    [/^\/products\/[^/]+\/(?:bom|materials)(?:\/|$)/, 'production']
  ];
  return [...new Set(rules.flatMap(([pattern, resource]) => pattern.test(normalizedPath) ? [resource] : []))];
}

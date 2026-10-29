/**
 * 门店、调拨与 POS 销售的服务端纯函数。
 *
 * 路由内只负责鉴权、事务与序列化；状态机与输入归一化集中在这里，便于单测。
 */

export type MerchantStoreTransferStatus = 'requested' | 'dispatched' | 'received' | 'cancelled';

const transferTransitions: Record<MerchantStoreTransferStatus, readonly MerchantStoreTransferStatus[]> = {
  requested: ['dispatched', 'cancelled'],
  dispatched: ['received', 'cancelled'],
  received: [],
  cancelled: []
};

export function normalizeStoreTransferStatus(value: unknown): MerchantStoreTransferStatus | null {
  return value === 'requested' || value === 'dispatched' || value === 'received' || value === 'cancelled' ? value : null;
}

export function canTransitionStoreTransfer(current: unknown, next: unknown): boolean {
  const from = normalizeStoreTransferStatus(current);
  const to = normalizeStoreTransferStatus(next);
  if (!from || !to) return false;
  return transferTransitions[from].includes(to);
}

export function normalizeStoreText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export type MerchantStoreInput = {
  name: string;
  code: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  status: 'active' | 'suspended';
};

export function normalizeStoreInput(body: unknown, fallbackStatus: 'active' | 'suspended' = 'active'): MerchantStoreInput | null {
  const raw = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {};
  const name = normalizeStoreText(raw.name, 160);
  const code = normalizeStoreText(raw.code, 64).toUpperCase();
  if (!name || !code) return null;
  const status = raw.status === 'suspended' ? 'suspended' : raw.status === 'active' ? 'active' : fallbackStatus;
  return {
    name,
    code,
    address: normalizeStoreText(raw.address, 300),
    city: normalizeStoreText(raw.city, 120),
    country: normalizeStoreText(raw.country, 120),
    phone: normalizeStoreText(raw.phone, 60),
    status
  };
}

export type MerchantPosCartLine = { productId: string; sku: string; quantity: number };

export function normalizePosCart(items: unknown): MerchantPosCartLine[] | null {
  if (!Array.isArray(items) || items.length < 1 || items.length > 100) return null;
  const lines: MerchantPosCartLine[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const raw = item as Record<string, unknown>;
    const productId = typeof raw.productId === 'string' ? raw.productId.trim() : '';
    const sku = typeof raw.sku === 'string' ? raw.sku.trim() : '';
    const quantity = Number(raw.quantity);
    if (!productId || !sku || !Number.isInteger(quantity) || quantity < 1 || quantity > 100000) return null;
    lines.push({ productId, sku, quantity });
  }
  const keys = lines.map(line => `${line.productId}:${line.sku}`);
  if (new Set(keys).size !== keys.length) return null;
  return lines;
}

export function posSaleNo(now: Date, random: number): string {
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `POS-${date}-${String(random).padStart(6, '0').slice(-6)}`;
}

export function storeTransferNo(now: Date, random: number): string {
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `ST-${date}-${String(random).padStart(6, '0').slice(-6)}`;
}

/** 零售价优先，缺失时回退到批发价；金额以服务端价格为准。 */
export function resolvePosUnitPrice(product: { rrpPrice: unknown; wholesalePrice: unknown }): number {
  const retail = Number(product.rrpPrice ?? 0);
  if (Number.isFinite(retail) && retail > 0) return Number(retail.toFixed(4));
  const wholesale = Number(product.wholesalePrice ?? 0);
  return Number.isFinite(wholesale) && wholesale > 0 ? Number(wholesale.toFixed(4)) : 0;
}

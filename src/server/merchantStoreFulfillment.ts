import type { Prisma } from '@prisma/client';
import { getMerchantIndustryCapability } from '../constants/merchantIndustryCapabilities';

export type MerchantStoreOrderItem = {
  productId: string;
  sku: string;
  quantity: number;
};

type StoreCandidate = {
  id: string;
  code: string;
  status: string;
};

type StoreStockRow = {
  storeId: string;
  productId: string;
  sku: string;
  quantity: number;
};

type StoreReservationRow = {
  location: string;
  productId: string;
  sku: string;
  quantity: number;
  status: string;
};

type StoreSelectionInput = {
  stores: StoreCandidate[];
  items: MerchantStoreOrderItem[];
  stock: StoreStockRow[];
  reservations: StoreReservationRow[];
  requestedStoreId?: string | null;
  employeeStoreId?: string | null;
};

const activeReservationStatuses = ['active', 'reserved'];

function aggregateItems(items: MerchantStoreOrderItem[]): MerchantStoreOrderItem[] {
  const grouped = new Map<string, MerchantStoreOrderItem>();
  for (const item of items) {
    if (!item.productId || !item.sku || !Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error('STORE_ORDER_ITEMS_INVALID');
    }
    const key = `${item.productId}\u0000${item.sku}`;
    const current = grouped.get(key);
    if (current) current.quantity += item.quantity;
    else grouped.set(key, { ...item });
  }
  return [...grouped.values()].sort((left, right) =>
    `${left.productId}:${left.sku}`.localeCompare(`${right.productId}:${right.sku}`)
  );
}

function reservationKey(location: string, productId: string, sku: string): string {
  return `${location}\u0000${productId}\u0000${sku}`;
}

export function selectStoreForOrder(input: StoreSelectionInput): string {
  const items = aggregateItems(input.items);
  if (!items.length) throw new Error('STORE_ORDER_ITEMS_INVALID');

  const requestedStoreId = input.requestedStoreId?.trim() || null;
  const employeeStoreId = input.employeeStoreId?.trim() || null;
  if (requestedStoreId && employeeStoreId && requestedStoreId !== employeeStoreId) {
    throw new Error('STORE_ACCESS_DENIED');
  }

  const eligibleStores = input.stores.filter(store => store.status === 'active');
  const fixedStoreId = employeeStoreId || requestedStoreId;
  const candidates = fixedStoreId
    ? eligibleStores.filter(store => store.id === fixedStoreId)
    : eligibleStores;
  if (fixedStoreId && !candidates.length) throw new Error('STORE_ACCESS_DENIED');

  const stockByKey = new Map<string, number>();
  for (const row of input.stock) {
    const key = `${row.storeId}\u0000${row.productId}\u0000${row.sku}`;
    stockByKey.set(key, (stockByKey.get(key) || 0) + row.quantity);
  }
  const reservedByKey = new Map<string, number>();
  for (const row of input.reservations) {
    if (!activeReservationStatuses.includes(row.status)) continue;
    const key = reservationKey(row.location, row.productId, row.sku);
    reservedByKey.set(key, (reservedByKey.get(key) || 0) + row.quantity);
  }

  const fulfillable = candidates.map(store => {
    let totalAvailable = 0;
    for (const item of items) {
      const location = `store:${store.id}`;
      const onHand = stockByKey.get(`${store.id}\u0000${item.productId}\u0000${item.sku}`) || 0;
      const reserved = reservedByKey.get(reservationKey(location, item.productId, item.sku)) || 0;
      const available = Math.max(0, onHand - reserved);
      if (available < item.quantity) return null;
      totalAvailable += available;
    }
    return { store, totalAvailable };
  }).filter((candidate): candidate is { store: StoreCandidate; totalAvailable: number } => candidate !== null);

  fulfillable.sort((left, right) =>
    right.totalAvailable - left.totalAvailable || left.store.code.localeCompare(right.store.code)
  );
  const selected = fulfillable[0];
  if (!selected) throw new Error('STORE_STOCK_INSUFFICIENT');
  return selected.store.id;
}

export async function lockStoreInventoryRows(
  tx: Prisma.TransactionClient,
  merchantId: string,
  storeIds: string[],
  items: MerchantStoreOrderItem[]
): Promise<void> {
  const lockKeys = storeIds.flatMap(storeId => items.map(item =>
    `${storeId}:${item.productId}:${item.sku}`
  )).sort();
  for (const lockKey of lockKeys) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${merchantId}), hashtext(${lockKey}))`;
  }
}

export async function reserveStoreInventoryForOrder(
  tx: Prisma.TransactionClient,
  input: {
    merchantId: string;
    orderId: string;
    items: MerchantStoreOrderItem[];
    requestedStoreId?: string | null;
    employeeStoreId?: string | null;
  }
): Promise<string | null> {
  const merchant = await tx.merchant.findUnique({
    where: { id: input.merchantId },
    select: { industryTemplate: true }
  });
  if (getMerchantIndustryCapability(merchant?.industryTemplate)?.inventory.mode !== 'store') return null;

  const items = aggregateItems(input.items);
  const productIds = [...new Set(items.map(item => item.productId))];
  const products = await tx.product.findMany({
    where: { id: { in: productIds }, merchantId: input.merchantId },
    select: { id: true }
  });
  if (products.length !== productIds.length) throw new Error('STORE_ORDER_PRODUCT_FORBIDDEN');

  const stores = await tx.merchantStore.findMany({
    where: { merchantId: input.merchantId, status: 'active' },
    orderBy: { code: 'asc' },
    select: { id: true, code: true, status: true }
  });
  const fixedStoreId = input.employeeStoreId?.trim() || input.requestedStoreId?.trim() || null;
  if (fixedStoreId && !stores.some(store => store.id === fixedStoreId)) {
    throw new Error('STORE_ACCESS_DENIED');
  }
  const candidateStoreIds = fixedStoreId ? [fixedStoreId] : stores.map(store => store.id);
  if (!candidateStoreIds.length) throw new Error('STORE_STOCK_INSUFFICIENT');

  await lockStoreInventoryRows(tx, input.merchantId, candidateStoreIds, items);
  const locations = candidateStoreIds.map(storeId => `store:${storeId}`);
  const skus = [...new Set(items.map(item => item.sku))];
  const [stock, reservations] = await Promise.all([
    tx.merchantStoreStock.findMany({
      where: {
        merchantId: input.merchantId,
        storeId: { in: candidateStoreIds },
        productId: { in: productIds },
        sku: { in: skus }
      },
      select: { storeId: true, productId: true, sku: true, quantity: true }
    }),
    tx.stockReservation.findMany({
      where: {
        location: { in: locations },
        productId: { in: productIds },
        sku: { in: skus },
        status: { in: activeReservationStatuses }
      },
      select: { location: true, productId: true, sku: true, quantity: true, status: true }
    })
  ]);
  const existingReservations = await tx.stockReservation.findMany({
    where: {
      orderId: input.orderId,
      location: { startsWith: 'store:' },
      status: { in: activeReservationStatuses }
    },
    select: { location: true, productId: true, sku: true, quantity: true }
  });
  if (existingReservations.length) {
    const existingStoreIds = new Set(existingReservations
      .filter(row => row.location.startsWith('store:'))
      .map(row => row.location.slice('store:'.length)));
    if (existingStoreIds.size !== 1) throw new Error('STORE_ORDER_RESERVATION_CHANGED');
    const existingStoreId = [...existingStoreIds][0];
    if (!stores.some(store => store.id === existingStoreId)
      || (fixedStoreId && fixedStoreId !== existingStoreId)) {
      throw new Error('STORE_ACCESS_DENIED');
    }
    const reservedByKey = new Map<string, number>();
    for (const row of existingReservations) {
      const key = `${row.productId}\u0000${row.sku}`;
      reservedByKey.set(key, (reservedByKey.get(key) || 0) + row.quantity);
    }
    if (items.some(item => (reservedByKey.get(`${item.productId}\u0000${item.sku}`) || 0) !== item.quantity)
      || existingReservations.some(row => !items.some(item => item.productId === row.productId && item.sku === row.sku))) {
      throw new Error('STORE_ORDER_RESERVATION_CHANGED');
    }
    await tx.order.update({ where: { id: input.orderId }, data: { storeId: existingStoreId } });
    return existingStoreId;
  }
  const storeId = selectStoreForOrder({
    stores,
    items,
    stock,
    reservations,
    requestedStoreId: input.requestedStoreId,
    employeeStoreId: input.employeeStoreId
  });

  await tx.stockReservation.createMany({
    data: items.map(item => ({
      id: crypto.randomUUID(),
      orderId: input.orderId,
      productId: item.productId,
      sku: item.sku,
      location: `store:${storeId}`,
      quantity: item.quantity,
      status: 'reserved'
    }))
  });
  await tx.order.update({ where: { id: input.orderId }, data: { storeId } });
  return storeId;
}

export async function getStoreStockAvailability(
  tx: Prisma.TransactionClient,
  input: { merchantId: string; storeId: string; productId: string; sku: string }
): Promise<{ quantity: number; reservedQuantity: number; availableQuantity: number }> {
  const [stock, reservation] = await Promise.all([
    tx.merchantStoreStock.findUnique({
      where: {
        storeId_productId_sku: {
          storeId: input.storeId,
          productId: input.productId,
          sku: input.sku
        }
      },
      select: { merchantId: true, quantity: true }
    }),
    tx.stockReservation.aggregate({
      where: {
        location: `store:${input.storeId}`,
        productId: input.productId,
        sku: input.sku,
        status: { in: activeReservationStatuses }
      },
      _sum: { quantity: true }
    })
  ]);
  if (stock && stock.merchantId !== input.merchantId) throw new Error('STORE_ACCESS_DENIED');
  const quantity = stock?.quantity || 0;
  const reservedQuantity = reservation._sum.quantity || 0;
  return {
    quantity,
    reservedQuantity,
    availableQuantity: Math.max(0, quantity - reservedQuantity)
  };
}

export async function releaseStoreReservationsForOrder(
  tx: Prisma.TransactionClient,
  orderId: string,
  storeId?: string | null
): Promise<void> {
  await tx.stockReservation.updateMany({
    where: {
      orderId,
      ...(storeId ? { location: `store:${storeId}` } : { location: { startsWith: 'store:' } }),
      status: { in: activeReservationStatuses }
    },
    data: { status: 'released' }
  });
}

export async function consumeStoreReservationsForOrder(
  tx: Prisma.TransactionClient,
  input: {
    merchantId: string;
    orderId: string;
    orderNo: string;
    storeId: string | null;
    operatorId?: string | null;
    items: MerchantStoreOrderItem[];
  }
): Promise<void> {
  if (!input.storeId) throw new Error('STORE_FULFILLMENT_LOCATION_REQUIRED');
  const items = aggregateItems(input.items);
  await lockStoreInventoryRows(tx, input.merchantId, [input.storeId], items);

  const location = `store:${input.storeId}`;
  const reservations = await tx.stockReservation.findMany({
    where: { orderId: input.orderId, location, status: { in: activeReservationStatuses } },
    select: { id: true, productId: true, sku: true, quantity: true }
  });
  const reservedByKey = new Map<string, number>();
  for (const reservation of reservations) {
    const key = `${reservation.productId}\u0000${reservation.sku}`;
    reservedByKey.set(key, (reservedByKey.get(key) || 0) + reservation.quantity);
  }
  if (items.some(item => (reservedByKey.get(`${item.productId}\u0000${item.sku}`) || 0) < item.quantity)) {
    throw new Error('STORE_ORDER_RESERVATION_MISSING');
  }

  for (const item of items) {
    const changed = await tx.merchantStoreStock.updateMany({
      where: {
        merchantId: input.merchantId,
        storeId: input.storeId,
        productId: item.productId,
        sku: item.sku,
        quantity: { gte: item.quantity }
      },
      data: { quantity: { decrement: item.quantity } }
    });
    if (changed.count !== 1) throw new Error('STORE_STOCK_INSUFFICIENT');
  }

  const consumed = await tx.stockReservation.updateMany({
    where: { orderId: input.orderId, location, status: { in: activeReservationStatuses } },
    data: { status: 'consumed' }
  });
  if (consumed.count !== reservations.length) throw new Error('STORE_ORDER_RESERVATION_CHANGED');

  await tx.stockMovement.createMany({
    data: items.map(item => ({
      id: crypto.randomUUID(),
      productId: item.productId,
      sku: item.sku,
      location,
      quantity: -item.quantity,
      movementType: 'sale',
      referenceId: input.orderId,
      operatorId: input.operatorId || null,
      note: `Online order ${input.orderNo}`
    }))
  });
}

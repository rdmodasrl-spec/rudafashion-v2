import crypto from 'node:crypto';
import express, { type Express, type Request, type RequestHandler, type Response } from 'express';
import { Prisma, type PrismaClient } from '@prisma/client';
import {
  normalizeRestaurantDishCreate,
  normalizeRestaurantDishUpdate,
  normalizeRestaurantIngredientCreate,
  normalizeRestaurantIngredientUpdate,
  normalizeRestaurantIdempotencyKey,
  isRestaurantMerchant,
  normalizeRestaurantMenuCreate,
  normalizeRestaurantMenuItemCreate,
  normalizeRestaurantMenuItemUpdate,
  normalizeRestaurantMenuUpdate,
  normalizeRestaurantMenuTransition,
  normalizeRestaurantRecipeActivate,
  normalizeRestaurantRecipeCreate,
  normalizeRestaurantStockAdjustment,
  normalizeRestaurantTableCreate,
  normalizeRestaurantTableUpdate,
  restaurantRequestHash
} from './restaurantCatalog';
import {
  normalizeRestaurantPurchaseOrderCreate,
  normalizeRestaurantPurchaseReceipt,
  normalizeRestaurantPurchaseTransition
} from './restaurantProcurement';
import { calculateRestaurantRecipeCost } from './restaurantCosting';
import { isPublicStorefront } from './publicProductVisibility';

type RestaurantMerchantRequest = Request & {
  merchant?: {
    merchantId: string;
    employeeId?: string;
    employeeStoreId?: string | null;
  };
};

type RestaurantCatalogRouteDependencies = {
  prisma: PrismaClient;
  requireMerchantTenant: RequestHandler[];
  requireRestaurantMenuModule: RequestHandler;
  requireRestaurantTablesModule: RequestHandler;
  requireDraftPermission: RequestHandler;
  requireMenuPublishPermission: RequestHandler;
  publicMenuRateLimit: RequestHandler;
  requireInventoryPermission: RequestHandler;
  requirePurchasePermission: RequestHandler;
  sendInternalError: (res: Response, error: unknown, context: string) => void;
  logEmployeeAudit: (
    merchantId: string,
    employeeId: string | undefined,
    action: string,
    entityType: string,
    entityId: string | undefined,
    req: Request,
    metadata?: Record<string, unknown>
  ) => Promise<void>;
};

const pageSizeMaximum = 100;

function merchantContext(req: RestaurantMerchantRequest) {
  const merchant = req.merchant;
  if (!merchant?.merchantId) return null;
  return {
    merchantId: merchant.merchantId,
    employeeId: merchant.employeeId,
    employeeStoreId: merchant.employeeStoreId ?? null
  };
}

function asErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('code' in error)) return null;
  return typeof error.code === 'string' ? error.code : null;
}

function pageValue(value: unknown, fallback: number, maximum: number): number | null {
  if (value === undefined) return fallback;
  const normalized = typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isInteger(normalized) && normalized >= 1 && normalized <= maximum ? normalized : null;
}

function stringQuery(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isStoreWriteAllowed(employeeStoreId: string | null, storeId: string | null): boolean {
  return employeeStoreId === null || employeeStoreId === storeId;
}

function stockSnapshot(
  ingredientId: string,
  balance: { onHandQuantity: Prisma.Decimal; reservedQuantity: Prisma.Decimal; version: number } | null
) {
  const onHand = new Prisma.Decimal(balance?.onHandQuantity ?? 0);
  const reserved = new Prisma.Decimal(balance?.reservedQuantity ?? 0);
  return {
    ingredientId,
    locationCode: 'central',
    onHandQuantity: onHand.toFixed(3),
    reservedQuantity: reserved.toFixed(3),
    availableQuantity: onHand.minus(reserved).toFixed(3),
    version: balance?.version ?? 0
  };
}

function purchaseReceiptResponse<T extends {
  items: Array<{ quantity: Prisma.Decimal; unitCost: Prisma.Decimal }>;
}>(receipt: T) {
  return {
    ...receipt,
    items: receipt.items.map(item => ({
      ...item,
      quantity: item.quantity.toFixed(3),
      unitCost: item.unitCost.toFixed(4)
    }))
  };
}

function purchaseOrderResponse<T extends {
  items: Array<{
    orderedQuantity: Prisma.Decimal;
    receivedQuantity: Prisma.Decimal;
    quotedUnitCost: Prisma.Decimal;
  }>;
  receipts?: Array<{ items: Array<{ quantity: Prisma.Decimal; unitCost: Prisma.Decimal }> }>;
}>(purchaseOrder: T) {
  return {
    ...purchaseOrder,
    items: purchaseOrder.items.map(item => ({
      ...item,
      orderedQuantity: item.orderedQuantity.toFixed(3),
      receivedQuantity: item.receivedQuantity.toFixed(3),
      quotedUnitCost: item.quotedUnitCost.toFixed(4)
    })),
    ...(purchaseOrder.receipts
      ? { receipts: purchaseOrder.receipts.map(purchaseReceiptResponse) }
      : {})
  };
}

export function registerRestaurantCatalogRoutes(
  app: Express,
  dependencies: RestaurantCatalogRouteDependencies
): void {
  const {
    prisma,
    requireMerchantTenant,
    requireRestaurantMenuModule,
    requireRestaurantTablesModule,
    requireDraftPermission,
    requireMenuPublishPermission,
    publicMenuRateLimit,
    requireInventoryPermission,
    requirePurchasePermission,
    sendInternalError,
    logEmployeeAudit
  } = dependencies;
  const guards = [...requireMerchantTenant, requireRestaurantMenuModule, requireDraftPermission];
  const ingredientCategories = new Set([
    'produce', 'meat', 'seafood', 'dairy', 'grain', 'seasoning', 'beverage', 'packaging', 'other'
  ]);

  const requireRestaurantMerchant: RequestHandler = async (request, res, next) => {
    const req = request as RestaurantMerchantRequest;
    const context = merchantContext(req);
    if (!context) return res.status(401).json({ success: false, error: 'MERCHANT_AUTH_REQUIRED' });
    try {
      const merchant = await prisma.merchant.findUnique({
        where: { id: context.merchantId },
        select: { industryTemplate: true, industry: true }
      });
      if (!isRestaurantMerchant(merchant)) {
        return res.status(403).json({ success: false, error: 'RESTAURANT_INDUSTRY_REQUIRED' });
      }
      next();
    } catch (error) {
      sendInternalError(res, error, 'restaurant-catalog-industry-guard');
    }
  };

  const routeGuards = [...guards, requireRestaurantMerchant];
  const menuPublishGuards = [
    ...requireMerchantTenant,
    requireRestaurantMenuModule,
    requireRestaurantMerchant,
    requireMenuPublishPermission
  ];
  const inventoryRouteGuards = [
    ...requireMerchantTenant,
    requireRestaurantMenuModule,
    requireRestaurantMerchant,
    requireInventoryPermission
  ];
  const purchaseRouteGuards = [
    ...requireMerchantTenant,
    requireRestaurantMenuModule,
    requireRestaurantMerchant,
    requirePurchasePermission
  ];
  const tableReadGuards = [
    ...requireMerchantTenant,
    requireRestaurantTablesModule,
    requireRestaurantMerchant
  ];
  const tableWriteGuards = [...tableReadGuards, requireMenuPublishPermission];

  app.get('/api/restaurant/stores/:storeSlug/menus', (_request, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  }, publicMenuRateLimit, async (request, res) => {
    try {
      const storeSlug = String(request.params.storeSlug).trim().toLowerCase();
      const merchant = await prisma.merchant.findFirst({
        where: { storeSlug },
        select: {
          id: true,
          industryTemplate: true,
          industry: true,
          storefrontEnabled: true,
          isVerified: true
        }
      });
      if (!isRestaurantMerchant(merchant) || !merchant || !isPublicStorefront(merchant)) {
        return res.status(404).json({ success: false, error: 'RESTAURANT_STORE_NOT_FOUND' });
      }
      const menus = await prisma.restaurantMenu.findMany({
        where: { merchantId: merchant.id, storeId: null, status: 'published' },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        select: {
          name: true,
          description: true,
          currency: true,
          items: {
            where: {
              merchantId: merchant.id,
              status: 'available',
              dish: { merchantId: merchant.id, status: 'active' }
            },
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            select: {
              price: true,
              sortOrder: true,
              dish: { select: { name: true, nameZh: true, nameIt: true, category: true, description: true, allergens: true } }
            }
          }
        }
      });
      return res.json({
        success: true,
        menus: menus.map(menu => ({
          name: menu.name,
          description: menu.description,
          currency: menu.currency,
          items: menu.items.map(item => ({
            name: item.dish.name,
            nameZh: item.dish.nameZh,
            nameIt: item.dish.nameIt,
            category: item.dish.category,
            description: item.dish.description,
            allergens: item.dish.allergens,
            price: item.price.toFixed(2),
            sortOrder: item.sortOrder
          }))
        }))
      });
    } catch (error) {
      return sendInternalError(res, error, 'restaurant-public-menu-read');
    }
  });

  app.get('/api/merchant/restaurant/table-stores', ...tableReadGuards, async (request, res) => {
    const req = request as RestaurantMerchantRequest;
    const context = merchantContext(req);
    if (!context) return res.status(401).json({ success: false, error: 'MERCHANT_AUTH_REQUIRED' });
    try {
      const stores = await prisma.merchantStore.findMany({
        where: {
          merchantId: context.merchantId,
          status: 'active',
          ...(context.employeeStoreId ? { id: context.employeeStoreId } : {})
        },
        select: { id: true, code: true, name: true, city: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }]
      });
      return res.json({ success: true, stores });
    } catch (error) {
      return sendInternalError(res, error, 'restaurant-table-stores-list');
    }
  });

  app.get('/api/merchant/restaurant/tables', ...tableReadGuards, async (request, res) => {
    const req = request as RestaurantMerchantRequest;
    const context = merchantContext(req);
    if (!context) return res.status(401).json({ success: false, error: 'MERCHANT_AUTH_REQUIRED' });
    const storeId = stringQuery(req.query.storeId);
    const page = pageValue(req.query.page, 1, 1_000_000);
    const limit = pageValue(req.query.limit, 50, pageSizeMaximum);
    const status = req.query.status === undefined ? undefined : stringQuery(req.query.status);
    if (!storeId || page === null || limit === null
      || (status !== undefined && status !== 'active' && status !== 'inactive')) {
      return res.status(400).json({ success: false, error: 'RESTAURANT_TABLE_QUERY_INVALID' });
    }
    if (context.employeeStoreId && context.employeeStoreId !== storeId) {
      return res.status(403).json({ success: false, error: 'STORE_ACCESS_DENIED' });
    }
    try {
      const store = await prisma.merchantStore.findFirst({
        where: { id: storeId, merchantId: context.merchantId, status: 'active' },
        select: { id: true }
      });
      if (!store) return res.status(404).json({ success: false, error: 'STORE_NOT_FOUND' });
      const where: Prisma.RestaurantTableWhereInput = {
        merchantId: context.merchantId,
        storeId,
        ...(status ? { status } : {})
      };
      const [tables, total] = await Promise.all([
        prisma.restaurantTable.findMany({
          where,
          orderBy: [{ code: 'asc' }, { id: 'asc' }],
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.restaurantTable.count({ where })
      ]);
      return res.json({ success: true, tables, page, limit, total });
    } catch (error) {
      return sendInternalError(res, error, 'restaurant-tables-list');
    }
  });

  app.post('/api/merchant/restaurant/tables', ...tableWriteGuards, async (request, res) => {
    const req = request as RestaurantMerchantRequest;
    const context = merchantContext(req);
    const input = normalizeRestaurantTableCreate(req.body);
    const idempotencyKey = normalizeRestaurantIdempotencyKey(req.get('Idempotency-Key'));
    if (!context) return res.status(401).json({ success: false, error: 'MERCHANT_AUTH_REQUIRED' });
    if (!input || !idempotencyKey) {
      return res.status(400).json({ success: false, error: 'RESTAURANT_TABLE_INPUT_INVALID' });
    }
    if (!isStoreWriteAllowed(context.employeeStoreId, input.storeId)) {
      return res.status(403).json({ success: false, error: 'STORE_ACCESS_DENIED' });
    }
    const requestHash = restaurantRequestHash(input);
    try {
      const result = await prisma.$transaction(async tx => {
        const existing = await tx.restaurantTable.findUnique({
          where: { merchantId_idempotencyKey: { merchantId: context.merchantId, idempotencyKey } }
        });
        if (existing) {
          if (existing.requestHash !== requestHash) return { conflict: true as const };
          return { table: existing, replay: true as const };
        }
        const store = await tx.merchantStore.findFirst({
          where: { id: input.storeId, merchantId: context.merchantId, status: 'active' },
          select: { id: true }
        });
        if (!store) return { storeNotFound: true as const };
        const table = await tx.restaurantTable.create({
          data: {
            id: crypto.randomUUID(),
            merchantId: context.merchantId,
            storeId: store.id,
            code: input.code,
            name: input.name,
            capacity: input.capacity,
            area: input.area,
            idempotencyKey,
            requestHash
          }
        });
        return { table, replay: false as const };
      });
      if ('conflict' in result) return res.status(409).json({ success: false, error: 'IDEMPOTENCY_KEY_REUSED' });
      if ('storeNotFound' in result) return res.status(404).json({ success: false, error: 'STORE_NOT_FOUND' });
      await logEmployeeAudit(context.merchantId, context.employeeId, 'RESTAURANT_TABLE_CREATED', 'RestaurantTable', result.table.id, req, {
        storeId: result.table.storeId,
        code: result.table.code,
        replay: result.replay
      });
      return res.status(result.replay ? 200 : 201).json({ success: true, table: result.table, replay: result.replay });
    } catch (error) {
      const code = asErrorCode(error);
      if (code === 'P2002') {
        const existing = await prisma.restaurantTable.findUnique({
          where: { merchantId_idempotencyKey: { merchantId: context.merchantId, idempotencyKey } }
        });
        if (existing?.requestHash === requestHash) {
          return res.status(200).json({ success: true, table: existing, replay: true });
        }
        if (existing) return res.status(409).json({ success: false, error: 'IDEMPOTENCY_KEY_REUSED' });
        return res.status(409).json({ success: false, error: 'RESTAURANT_TABLE_CODE_CONFLICT' });
      }
      return sendInternalError(res, error, 'restaurant-table-create');
    }
  });

  app.patch('/api/merchant/restaurant/tables/:tableId', ...tableWriteGuards, async (request, res) => {
    const req = request as RestaurantMerchantRequest;
    const context = merchantContext(req);
    const input = normalizeRestaurantTableUpdate(req.body);
    if (!context) return res.status(401).json({ success: false, error: 'MERCHANT_AUTH_REQUIRED' });
    if (!input) return res.status(400).json({ success: false, error: 'RESTAURANT_TABLE_INPUT_INVALID' });
    try {
      const existing = await prisma.restaurantTable.findFirst({
        where: { id: req.params.tableId, merchantId: context.merchantId },
        select: { id: true, storeId: true, version: true }
      });
      if (!existing) return res.status(404).json({ success: false, error: 'RESTAURANT_TABLE_NOT_FOUND' });
      if (context.employeeStoreId && context.employeeStoreId !== existing.storeId) {
        return res.status(403).json({ success: false, error: 'STORE_ACCESS_DENIED' });
      }
      if (existing.version !== input.expectedVersion) {
        return res.status(409).json({ success: false, error: 'RESTAURANT_TABLE_VERSION_CONFLICT' });
      }
      const { expectedVersion, ...data } = input;
      const updated = await prisma.restaurantTable.updateMany({
        where: {
          id: existing.id,
          merchantId: context.merchantId,
          storeId: existing.storeId,
          version: expectedVersion
        },
        data: { ...data, version: { increment: 1 } }
      });
      if (updated.count !== 1) {
        return res.status(409).json({ success: false, error: 'RESTAURANT_TABLE_VERSION_CONFLICT' });
      }
      const table = await prisma.restaurantTable.findUniqueOrThrow({ where: { id: existing.id } });
      await logEmployeeAudit(context.merchantId, context.employeeId, 'RESTAURANT_TABLE_UPDATED', 'RestaurantTable', table.id, req, {
        version: table.version,
        changedFields: Object.keys(data)
      });
      return res.json({ success: true, table });
    } catch (error) {
      return sendInternalError(res, error, 'restaurant-table-update');
    }
  });

  app.get('/api/merchant/restaurant/menus', ...routeGuards, async (request, res) => {
    const req = request as RestaurantMerchantRequest;
    const context = merchantContext(req);
    if (!context) return res.status(401).json({ success: false, error: 'MERCHANT_AUTH_REQUIRED' });
    const page = pageValue(req.query.page, 1, 1000000);
    const limit = pageValue(req.query.limit, 25, pageSizeMaximum);
    if (page === null || limit === null) return res.status(400).json({ success: false, error: 'PAGINATION_INVALID' });
    const status = req.query.status === undefined ? undefined : stringQuery(req.query.status);
    if (req.query.status !== undefined && status !== 'draft' && status !== 'published' && status !== 'archived') {
      return res.status(400).json({ success: false, error: 'RESTAURANT_MENU_STATUS_INVALID' });
    }
    const requestedStoreId = stringQuery(req.query.storeId);
    if (requestedStoreId && context.employeeStoreId && requestedStoreId !== context.employeeStoreId) {
      return res.status(403).json({ success: false, error: 'STORE_ACCESS_DENIED' });
    }
    const storeFilter: Prisma.RestaurantMenuWhereInput = context.employeeStoreId
      ? { OR: [{ storeId: null }, { storeId: context.employeeStoreId }] }
      : {};
    const where: Prisma.RestaurantMenuWhereInput = {
      merchantId: context.merchantId,
      ...(requestedStoreId ? { storeId: requestedStoreId } : storeFilter),
      ...(status ? { status } : {})
    };
    try {
      const [menus, total] = await Promise.all([
        prisma.restaurantMenu.findMany({
          where,
          orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
          skip: (page - 1) * limit,
          take: limit,
          include: { _count: { select: { items: true } } }
        }),
        prisma.restaurantMenu.count({ where })
      ]);
      return res.json({ success: true, menus, page, limit, total });
    } catch (error) {
      return sendInternalError(res, error, 'restaurant-menus-list');
    }
  });

  app.post('/api/merchant/restaurant/menus', ...routeGuards, async (request, res) => {
    const req = request as RestaurantMerchantRequest;
    const context = merchantContext(req);
    const input = normalizeRestaurantMenuCreate(req.body);
    const idempotencyKey = normalizeRestaurantIdempotencyKey(req.get('Idempotency-Key'));
    if (!context) return res.status(401).json({ success: false, error: 'MERCHANT_AUTH_REQUIRED' });
    if (!input || !idempotencyKey) return res.status(400).json({ success: false, error: 'RESTAURANT_MENU_INPUT_INVALID' });
    if (!isStoreWriteAllowed(context.employeeStoreId, input.storeId ?? null)) {
      return res.status(403).json({ success: false, error: 'STORE_ACCESS_DENIED' });
    }
    const requestHash = restaurantRequestHash(input);
    try {
      const result = await prisma.$transaction(async tx => {
        const existing = await tx.restaurantMenu.findUnique({
          where: { merchantId_idempotencyKey: { merchantId: context.merchantId, idempotencyKey } }
        });
        if (existing) {
          if (existing.requestHash !== requestHash) return { conflict: true as const };
          return { menu: existing, replay: true as const };
        }
        if (input.storeId) {
          const store = await tx.merchantStore.findFirst({
            where: { id: input.storeId, merchantId: context.merchantId, status: 'active' },
            select: { id: true }
          });
          if (!store) return { storeNotFound: true as const };
        }
        const menu = await tx.restaurantMenu.create({
          data: {
            id: crypto.randomUUID(),
            merchantId: context.merchantId,
            storeId: input.storeId ?? null,
            name: input.name,
            description: input.description ?? '',
            currency: input.currency,
            status: 'draft',
            idempotencyKey,
            requestHash
          }
        });
        return { menu, replay: false as const };
      });
      if ('conflict' in result) return res.status(409).json({ success: false, error: 'IDEMPOTENCY_KEY_REUSED' });
      if ('storeNotFound' in result) return res.status(404).json({ success: false, error: 'STORE_NOT_FOUND' });
      await logEmployeeAudit(context.merchantId, context.employeeId, 'RESTAURANT_MENU_CREATED', 'RestaurantMenu', result.menu.id, req, {
        replay: result.replay
      });
      return res.status(result.replay ? 200 : 201).json({ success: true, menu: result.menu, replay: result.replay });
    } catch (error) {
      if (asErrorCode(error) === 'P2002') {
        const existing = await prisma.restaurantMenu.findUnique({
          where: { merchantId_idempotencyKey: { merchantId: context.merchantId, idempotencyKey } }
        });
        if (existing?.requestHash === requestHash) {
          return res.status(200).json({ success: true, menu: existing, replay: true });
        }
        if (existing) return res.status(409).json({ success: false, error: 'IDEMPOTENCY_KEY_REUSED' });
      }
      return sendInternalError(res, error, 'restaurant-menu-create');
    }
  });

  app.get('/api/merchant/restaurant/menus/:menuId', ...routeGuards, async (request, res) => {
    const req = request as RestaurantMerchantRequest;
    const context = merchantContext(req);
    if (!context) return res.status(401).json({ success: false, error: 'MERCHANT_AUTH_REQUIRED' });
    try {
      const menu = await prisma.restaurantMenu.findFirst({
        where: {
          id: req.params.menuId,
          merchantId: context.merchantId,
          ...(context.employeeStoreId ? { OR: [{ storeId: null }, { storeId: context.employeeStoreId }] } : {})
        },
        include: {
          items: {
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            include: { dish: true }
          }
        }
      });
      if (!menu) return res.status(404).json({ success: false, error: 'RESTAURANT_MENU_NOT_FOUND' });
      return res.json({ success: true, menu });
    } catch (error) {
      return sendInternalError(res, error, 'restaurant-menu-get');
    }
  });

  app.patch('/api/merchant/restaurant/menus/:menuId', ...routeGuards, async (request, res) => {
    const req = request as RestaurantMerchantRequest;
    const context = merchantContext(req);
    const input = normalizeRestaurantMenuUpdate(req.body);
    if (!context) return res.status(401).json({ success: false, error: 'MERCHANT_AUTH_REQUIRED' });
    if (!input) return res.status(400).json({ success: false, error: 'RESTAURANT_MENU_INPUT_INVALID' });
    try {
      const result = await prisma.$transaction(async tx => {
        const menu = await tx.restaurantMenu.findFirst({
          where: { id: req.params.menuId, merchantId: context.merchantId, status: 'draft' }
        });
        if (!menu) return { notFound: true as const };
        if (!isStoreWriteAllowed(context.employeeStoreId, menu.storeId)) return { storeDenied: true as const };
        if (menu.version !== input.expectedVersion) return { conflict: true as const };
        const update = await tx.restaurantMenu.updateMany({
          where: { id: menu.id, merchantId: context.merchantId, status: 'draft', version: input.expectedVersion },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.currency !== undefined ? { currency: input.currency } : {}),
            version: { increment: 1 }
          }
        });
        if (!update.count) return { conflict: true as const };
        return { menu: await tx.restaurantMenu.findUniqueOrThrow({ where: { id: menu.id } }) };
      });
      if ('notFound' in result) return res.status(404).json({ success: false, error: 'RESTAURANT_MENU_NOT_FOUND' });
      if ('storeDenied' in result) return res.status(403).json({ success: false, error: 'STORE_ACCESS_DENIED' });
      if ('conflict' in result) return res.status(409).json({ success: false, error: 'RESTAURANT_MENU_VERSION_CONFLICT' });
      await logEmployeeAudit(context.merchantId, context.employeeId, 'RESTAURANT_MENU_UPDATED', 'RestaurantMenu', result.menu.id, req, {
        version: result.menu.version
      });
      return res.json({ success: true, menu: result.menu });
    } catch (error) {
      return sendInternalError(res, error, 'restaurant-menu-update');
    }
  });

  app.post('/api/merchant/restaurant/menus/:menuId/publish', ...menuPublishGuards, async (request, res) => {
    const req = request as RestaurantMerchantRequest;
    const context = merchantContext(req);
    const input = normalizeRestaurantMenuTransition(req.body);
    if (!context) return res.status(401).json({ success: false, error: 'MERCHANT_AUTH_REQUIRED' });
    if (!input) return res.status(400).json({ success: false, error: 'RESTAURANT_MENU_TRANSITION_INPUT_INVALID' });
    try {
      const result = await prisma.$transaction(async tx => {
        const menu = await tx.restaurantMenu.findFirst({
          where: { id: req.params.menuId, merchantId: context.merchantId },
          include: { items: { select: { dishId: true, dish: { select: { status: true } } } } }
        });
        if (!menu) return { notFound: true as const };
        if (!isStoreWriteAllowed(context.employeeStoreId, menu.storeId)) return { storeDenied: true as const };
        if (menu.status !== 'draft' || menu.version !== input.expectedVersion) return { conflict: true as const };
        const dishIds = [...new Set(menu.items.map(item => item.dishId))];
        if (!dishIds.length) return { emptyMenu: true as const };
        if (menu.items.some(item => item.dish.status === 'archived')) return { archivedDish: true as const };
        const activeRecipes = await tx.restaurantRecipe.findMany({
          where: { merchantId: context.merchantId, dishId: { in: dishIds }, status: 'active' },
          select: { dishId: true },
          distinct: ['dishId']
        });
        if (activeRecipes.length !== dishIds.length) return { recipeRequired: true as const };
        await tx.restaurantDish.updateMany({
          where: { merchantId: context.merchantId, id: { in: dishIds }, status: 'draft' },
          data: { status: 'active', version: { increment: 1 } }
        });
        const changed = await tx.restaurantMenu.updateMany({
          where: {
            id: menu.id,
            merchantId: context.merchantId,
            status: 'draft',
            version: input.expectedVersion
          },
          data: { status: 'published', version: { increment: 1 } }
        });
        if (changed.count !== 1) return { conflict: true as const };
        return { menu: await tx.restaurantMenu.findUniqueOrThrow({ where: { id: menu.id } }) };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      if ('notFound' in result) return res.status(404).json({ success: false, error: 'RESTAURANT_MENU_NOT_FOUND' });
      if ('storeDenied' in result) return res.status(403).json({ success: false, error: 'STORE_ACCESS_DENIED' });
      if ('conflict' in result) return res.status(409).json({ success: false, error: 'RESTAURANT_MENU_VERSION_CONFLICT' });
      if ('emptyMenu' in result) return res.status(409).json({ success: false, error: 'RESTAURANT_MENU_EMPTY' });
      if ('archivedDish' in result) return res.status(409).json({ success: false, error: 'RESTAURANT_MENU_CONTAINS_ARCHIVED_DISH' });
      if ('recipeRequired' in result) return res.status(409).json({ success: false, error: 'RESTAURANT_MENU_ACTIVE_RECIPE_REQUIRED' });
      await logEmployeeAudit(context.merchantId, context.employeeId, 'RESTAURANT_MENU_PUBLISHED', 'RestaurantMenu', result.menu.id, req, {
        version: result.menu.version
      });
      return res.json({ success: true, menu: result.menu });
    } catch (error) {
      if (asErrorCode(error) === 'P2034') {
        return res.status(409).json({ success: false, error: 'RESTAURANT_MENU_CONCURRENT_CHANGE' });
      }
      return sendInternalError(res, error, 'restaurant-menu-publish');
    }
  });

  app.post('/api/merchant/restaurant/menus/:menuId/unpublish', ...menuPublishGuards, async (request, res) => {
    const req = request as RestaurantMerchantRequest;
    const context = merchantContext(req);
    const input = normalizeRestaurantMenuTransition(req.body);
    if (!context) return res.status(401).json({ success: false, error: 'MERCHANT_AUTH_REQUIRED' });
    if (!input) return res.status(400).json({ success: false, error: 'RESTAURANT_MENU_TRANSITION_INPUT_INVALID' });
    try {
      const menu = await prisma.restaurantMenu.findFirst({
        where: { id: req.params.menuId, merchantId: context.merchantId }
      });
      if (!menu) return res.status(404).json({ success: false, error: 'RESTAURANT_MENU_NOT_FOUND' });
      if (!isStoreWriteAllowed(context.employeeStoreId, menu.storeId)) {
        return res.status(403).json({ success: false, error: 'STORE_ACCESS_DENIED' });
      }
      const changed = await prisma.restaurantMenu.updateMany({
        where: {
          id: menu.id,
          merchantId: context.merchantId,
          status: 'published',
          version: input.expectedVersion
        },
        data: { status: 'draft', version: { increment: 1 } }
      });
      if (!changed.count) return res.status(409).json({ success: false, error: 'RESTAURANT_MENU_VERSION_CONFLICT' });
      const updatedMenu = await prisma.restaurantMenu.findUniqueOrThrow({ where: { id: menu.id } });
      await logEmployeeAudit(context.merchantId, context.employeeId, 'RESTAURANT_MENU_UNPUBLISHED', 'RestaurantMenu', updatedMenu.id, req, {
        version: updatedMenu.version
      });
      return res.json({ success: true, menu: updatedMenu });
    } catch (error) {
      return sendInternalError(res, error, 'restaurant-menu-unpublish');
    }
  });

  app.get('/api/merchant/restaurant/dishes', ...routeGuards, async (request, res) => {
    const req = request as RestaurantMerchantRequest;
    const context = merchantContext(req);
    if (!context) return res.status(401).json({ success: false, error: 'MERCHANT_AUTH_REQUIRED' });
    const page = pageValue(req.query.page, 1, 1000000);
    const limit = pageValue(req.query.limit, 25, pageSizeMaximum);
    if (page === null || limit === null) return res.status(400).json({ success: false, error: 'PAGINATION_INVALID' });
    const status = req.query.status === undefined ? undefined : stringQuery(req.query.status);
    if (req.query.status !== undefined && status !== 'draft' && status !== 'active' && status !== 'archived') {
      return res.status(400).json({ success: false, error: 'RESTAURANT_DISH_STATUS_INVALID' });
    }
    const search = stringQuery(req.query.q);
    const where: Prisma.RestaurantDishWhereInput = {
      merchantId: context.merchantId,
      ...(status ? { status } : {}),
      ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { category: { contains: search, mode: 'insensitive' } }] } : {})
    };
    try {
      const [dishes, total] = await Promise.all([
        prisma.restaurantDish.findMany({
          where,
          orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.restaurantDish.count({ where })
      ]);
      return res.json({ success: true, dishes, page, limit, total });
    } catch (error) {
      return sendInternalError(res, error, 'restaurant-dishes-list');
    }
  });

  app.post('/api/merchant/restaurant/dishes', ...routeGuards, async (request, res) => {
    const req = request as RestaurantMerchantRequest;
    const context = merchantContext(req);
    const input = normalizeRestaurantDishCreate(req.body);
    const idempotencyKey = normalizeRestaurantIdempotencyKey(req.get('Idempotency-Key'));
    if (!context) return res.status(401).json({ success: false, error: 'MERCHANT_AUTH_REQUIRED' });
    if (!input || !idempotencyKey) return res.status(400).json({ success: false, error: 'RESTAURANT_DISH_INPUT_INVALID' });
    const requestHash = restaurantRequestHash(input);
    try {
      const result = await prisma.$transaction(async tx => {
        const existing = await tx.restaurantDish.findUnique({
          where: { merchantId_idempotencyKey: { merchantId: context.merchantId, idempotencyKey } }
        });
        if (existing) {
          if (existing.requestHash !== requestHash) return { conflict: true as const };
          return { dish: existing, replay: true as const };
        }
        if (input.productId) {
          const product = await tx.product.findFirst({
            where: { id: input.productId, merchantId: context.merchantId },
            select: { id: true }
          });
          if (!product) return { productNotFound: true as const };
        }
        const dish = await tx.restaurantDish.create({
          data: {
            id: crypto.randomUUID(),
            merchantId: context.merchantId,
            productId: input.productId ?? null,
            name: input.name,
            nameZh: input.nameZh ?? null,
            nameIt: input.nameIt ?? null,
            category: input.category ?? '',
            description: input.description ?? '',
            allergens: input.allergens ?? [],
            status: 'draft',
            idempotencyKey,
            requestHash
          }
        });
        return { dish, replay: false as const };
      });
      if ('conflict' in result) return res.status(409).json({ success: false, error: 'IDEMPOTENCY_KEY_REUSED' });
      if ('productNotFound' in result) return res.status(404).json({ success: false, error: 'PRODUCT_NOT_FOUND' });
      await logEmployeeAudit(context.merchantId, context.employeeId, 'RESTAURANT_DISH_CREATED', 'RestaurantDish', result.dish.id, req, {
        replay: result.replay
      });
      return res.status(result.replay ? 200 : 201).json({ success: true, dish: result.dish, replay: result.replay });
    } catch (error) {
      if (asErrorCode(error) === 'P2002') {
        const existing = await prisma.restaurantDish.findUnique({
          where: { merchantId_idempotencyKey: { merchantId: context.merchantId, idempotencyKey } }
        });
        if (existing?.requestHash === requestHash) {
          return res.status(200).json({ success: true, dish: existing, replay: true });
        }
        if (existing) return res.status(409).json({ success: false, error: 'IDEMPOTENCY_KEY_REUSED' });
      }
      return sendInternalError(res, error, 'restaurant-dish-create');
    }
  });

  app.get('/api/merchant/restaurant/dishes/:dishId', ...routeGuards, async (request, res) => {
    const req = request as RestaurantMerchantRequest;
    const context = merchantContext(req);
    if (!context) return res.status(401).json({ success: false, error: 'MERCHANT_AUTH_REQUIRED' });
    try {
      const dish = await prisma.restaurantDish.findFirst({
        where: { id: req.params.dishId, merchantId: context.merchantId }
      });
      if (!dish) return res.status(404).json({ success: false, error: 'RESTAURANT_DISH_NOT_FOUND' });
      return res.json({ success: true, dish });
    } catch (error) {
      return sendInternalError(res, error, 'restaurant-dish-get');
    }
  });

  app.patch('/api/merchant/restaurant/dishes/:dishId', ...routeGuards, async (request, res) => {
    const req = request as RestaurantMerchantRequest;
    const context = merchantContext(req);
    const input = normalizeRestaurantDishUpdate(req.body);
    if (!context) return res.status(401).json({ success: false, error: 'MERCHANT_AUTH_REQUIRED' });
    if (!input) return res.status(400).json({ success: false, error: 'RESTAURANT_DISH_INPUT_INVALID' });
    try {
      const result = await prisma.$transaction(async tx => {
        const dish = await tx.restaurantDish.findFirst({
          where: { id: req.params.dishId, merchantId: context.merchantId, status: 'draft' }
        });
        if (!dish) return { notFound: true as const };
        if (input.productId) {
          const product = await tx.product.findFirst({
            where: { id: input.productId, merchantId: context.merchantId },
            select: { id: true }
          });
          if (!product) return { productNotFound: true as const };
        }
        if (dish.version !== input.expectedVersion) return { conflict: true as const };
        const update = await tx.restaurantDish.updateMany({
          where: { id: dish.id, merchantId: context.merchantId, status: 'draft', version: input.expectedVersion },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.nameZh !== undefined ? { nameZh: input.nameZh } : {}),
            ...(input.nameIt !== undefined ? { nameIt: input.nameIt } : {}),
            ...(input.category !== undefined ? { category: input.category } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.allergens !== undefined ? { allergens: input.allergens } : {}),
            ...(input.productId !== undefined ? { productId: input.productId } : {}),
            version: { increment: 1 }
          }
        });
        if (!update.count) return { conflict: true as const };
        return { dish: await tx.restaurantDish.findUniqueOrThrow({ where: { id: dish.id } }) };
      });
      if ('notFound' in result) return res.status(404).json({ success: false, error: 'RESTAURANT_DISH_NOT_FOUND' });
      if ('productNotFound' in result) return res.status(404).json({ success: false, error: 'PRODUCT_NOT_FOUND' });
      if ('conflict' in result) return res.status(409).json({ success: false, error: 'RESTAURANT_DISH_VERSION_CONFLICT' });
      await logEmployeeAudit(context.merchantId, context.employeeId, 'RESTAURANT_DISH_UPDATED', 'RestaurantDish', result.dish.id, req, {
        version: result.dish.version
      });
      return res.json({ success: true, dish: result.dish });
    } catch (error) {
      return sendInternalError(res, error, 'restaurant-dish-update');
    }
  });

  app.post('/api/merchant/restaurant/menus/:menuId/items', ...routeGuards, async (request, res) => {
    const req = request as RestaurantMerchantRequest;
    const context = merchantContext(req);
    const input = normalizeRestaurantMenuItemCreate(req.body);
    if (!context) return res.status(401).json({ success: false, error: 'MERCHANT_AUTH_REQUIRED' });
    if (!input) return res.status(400).json({ success: false, error: 'RESTAURANT_MENU_ITEM_INPUT_INVALID' });
    try {
      const result = await prisma.$transaction(async tx => {
        const menu = await tx.restaurantMenu.findFirst({
          where: { id: req.params.menuId, merchantId: context.merchantId, status: 'draft' }
        });
        if (!menu) return { menuNotFound: true as const };
        if (!isStoreWriteAllowed(context.employeeStoreId, menu.storeId)) return { storeDenied: true as const };
        const dish = await tx.restaurantDish.findFirst({
          where: { id: input.dishId, merchantId: context.merchantId, status: { not: 'archived' } },
          select: { id: true }
        });
        if (!dish) return { dishNotFound: true as const };
        const existing = await tx.restaurantMenuItem.findUnique({
          where: { menuId_dishId: { menuId: menu.id, dishId: dish.id } }
        });
        if (existing) return { duplicate: true as const };
        const item = await tx.restaurantMenuItem.create({
          data: {
            id: crypto.randomUUID(),
            merchantId: context.merchantId,
            menuId: menu.id,
            dishId: dish.id,
            price: input.price,
            sortOrder: input.sortOrder ?? 0,
            status: 'available'
          },
          include: { dish: true }
        });
        return { item };
      });
      if ('menuNotFound' in result) return res.status(404).json({ success: false, error: 'RESTAURANT_MENU_NOT_FOUND' });
      if ('storeDenied' in result) return res.status(403).json({ success: false, error: 'STORE_ACCESS_DENIED' });
      if ('dishNotFound' in result) return res.status(404).json({ success: false, error: 'RESTAURANT_DISH_NOT_FOUND' });
      if ('duplicate' in result) return res.status(409).json({ success: false, error: 'RESTAURANT_MENU_ITEM_EXISTS' });
      await logEmployeeAudit(context.merchantId, context.employeeId, 'RESTAURANT_MENU_ITEM_CREATED', 'RestaurantMenuItem', result.item.id, req, {
        menuId: result.item.menuId,
        dishId: result.item.dishId
      });
      return res.status(201).json({ success: true, item: result.item });
    } catch (error) {
      if (asErrorCode(error) === 'P2002') return res.status(409).json({ success: false, error: 'RESTAURANT_MENU_ITEM_EXISTS' });
      return sendInternalError(res, error, 'restaurant-menu-item-create');
    }
  });

  app.patch('/api/merchant/restaurant/menus/:menuId/items/:itemId', ...routeGuards, async (request, res) => {
    const req = request as RestaurantMerchantRequest;
    const context = merchantContext(req);
    const input = normalizeRestaurantMenuItemUpdate(req.body);
    if (!context) return res.status(401).json({ success: false, error: 'MERCHANT_AUTH_REQUIRED' });
    if (!input) return res.status(400).json({ success: false, error: 'RESTAURANT_MENU_ITEM_INPUT_INVALID' });
    try {
      const result = await prisma.$transaction(async tx => {
        const item = await tx.restaurantMenuItem.findFirst({
          where: {
            id: req.params.itemId,
            menuId: req.params.menuId,
            merchantId: context.merchantId,
            menu: { status: 'draft' }
          },
          include: { menu: { select: { storeId: true } } }
        });
        if (!item) return { notFound: true as const };
        if (!isStoreWriteAllowed(context.employeeStoreId, item.menu.storeId)) return { storeDenied: true as const };
        if (item.version !== input.expectedVersion) return { conflict: true as const };
        const update = await tx.restaurantMenuItem.updateMany({
          where: { id: item.id, menuId: item.menuId, merchantId: context.merchantId, version: input.expectedVersion },
          data: {
            ...(input.price !== undefined ? { price: input.price } : {}),
            ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
            ...(input.status !== undefined ? { status: input.status } : {}),
            version: { increment: 1 }
          }
        });
        if (!update.count) return { conflict: true as const };
        return { item: await tx.restaurantMenuItem.findUniqueOrThrow({ where: { id: item.id }, include: { dish: true } }) };
      });
      if ('notFound' in result) return res.status(404).json({ success: false, error: 'RESTAURANT_MENU_ITEM_NOT_FOUND' });
      if ('storeDenied' in result) return res.status(403).json({ success: false, error: 'STORE_ACCESS_DENIED' });
      if ('conflict' in result) return res.status(409).json({ success: false, error: 'RESTAURANT_MENU_ITEM_VERSION_CONFLICT' });
      await logEmployeeAudit(context.merchantId, context.employeeId, 'RESTAURANT_MENU_ITEM_UPDATED', 'RestaurantMenuItem', result.item.id, req, {
        version: result.item.version
      });
      return res.json({ success: true, item: result.item });
    } catch (error) {
      return sendInternalError(res, error, 'restaurant-menu-item-update');
    }
  });

  app.get('/api/merchant/restaurant/ingredients', ...routeGuards, async (request, res) => {
    const req = request as RestaurantMerchantRequest;
    const context = merchantContext(req);
    if (!context) return res.status(401).json({ success: false, error: 'MERCHANT_AUTH_REQUIRED' });
    const category = req.query.category === undefined ? undefined : stringQuery(req.query.category);
    const page = pageValue(req.query.page, 1, 1000000);
    const limit = pageValue(req.query.limit, 25, pageSizeMaximum);
    if (page === null || limit === null) return res.status(400).json({ success: false, error: 'PAGINATION_INVALID' });
    if (req.query.category !== undefined && (!category || !ingredientCategories.has(category))) {
      return res.status(400).json({ success: false, error: 'RESTAURANT_INGREDIENT_CATEGORY_INVALID' });
    }
    try {
      const where: Prisma.RestaurantIngredientWhereInput = {
        merchantId: context.merchantId,
        ...(category ? { category } : {})
      };
      const [ingredients, total] = await Promise.all([
        prisma.restaurantIngredient.findMany({
          where,
          include: {
            material: {
              select: {
                id: true, code: true, name: true, unit: true, reorderPoint: true, leadTimeDays: true,
                status: true, supplierId: true, supplier: { select: { id: true, name: true } }
              }
            }
          },
          orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.restaurantIngredient.count({ where })
      ]);
      return res.json({
        success: true,
        page,
        limit,
        total,
        ingredients: ingredients.map(ingredient => ({
          id: ingredient.id,
          category: ingredient.category,
          allergens: ingredient.allergens,
          version: ingredient.version,
          createdAt: ingredient.createdAt,
          updatedAt: ingredient.updatedAt,
          material: {
            ...ingredient.material,
            reorderPoint: Number(ingredient.material.reorderPoint)
          }
        }))
      });
    } catch (error) {
      return sendInternalError(res, error, 'restaurant-ingredients-list');
    }
  });

  app.post('/api/merchant/restaurant/ingredients', ...routeGuards, async (request, res) => {
    const req = request as RestaurantMerchantRequest;
    const context = merchantContext(req);
    const input = normalizeRestaurantIngredientCreate(req.body);
    const idempotencyKey = normalizeRestaurantIdempotencyKey(req.get('Idempotency-Key'));
    if (!context) return res.status(401).json({ success: false, error: 'MERCHANT_AUTH_REQUIRED' });
    if (!input || !idempotencyKey) {
      return res.status(400).json({ success: false, error: 'RESTAURANT_INGREDIENT_INPUT_INVALID' });
    }
    const requestHash = restaurantRequestHash(input);
    try {
      const result = await prisma.$transaction(async tx => {
        const existing = await tx.restaurantIngredient.findUnique({
          where: { merchantId_idempotencyKey: { merchantId: context.merchantId, idempotencyKey } },
          include: { material: { select: { id: true, code: true, name: true, unit: true, reorderPoint: true, leadTimeDays: true, status: true, supplierId: true } } }
        });
        if (existing) {
          if (existing.requestHash !== requestHash) return { conflict: true as const };
          return { ingredient: existing, replay: true as const };
        }
        if (input.supplierId) {
          const supplier = await tx.supplier.findFirst({
            where: { id: input.supplierId, merchantId: context.merchantId, status: 'active' },
            select: { id: true }
          });
          if (!supplier) return { supplierNotFound: true as const };
        }
        const material = await tx.material.create({
          data: {
            merchantId: context.merchantId,
            code: input.code,
            name: input.name,
            category: 'restaurant_ingredient',
            unit: input.unit,
            reorderPoint: input.reorderPoint,
            leadTimeDays: input.leadTimeDays,
            supplierId: input.supplierId ?? null,
            notes: input.notes ?? null
          }
        });
        const ingredient = await tx.restaurantIngredient.create({
          data: {
            merchantId: context.merchantId,
            materialId: material.id,
            category: input.category,
            allergens: input.allergens,
            idempotencyKey,
            requestHash
          },
          include: {
            material: {
              select: {
                id: true, code: true, name: true, unit: true, reorderPoint: true,
                leadTimeDays: true, status: true, supplierId: true
              }
            }
          }
        });
        return { ingredient, replay: false as const };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      if ('conflict' in result) return res.status(409).json({ success: false, error: 'IDEMPOTENCY_KEY_REUSED' });
      if ('supplierNotFound' in result) return res.status(404).json({ success: false, error: 'RESTAURANT_SUPPLIER_NOT_FOUND' });
      await logEmployeeAudit(context.merchantId, context.employeeId, 'RESTAURANT_INGREDIENT_CREATED', 'RestaurantIngredient', result.ingredient.id, req, {
        replay: result.replay
      });
      return res.status(result.replay ? 200 : 201).json({
        success: true,
        ingredient: {
          ...result.ingredient,
          material: {
            ...result.ingredient.material,
            reorderPoint: Number(result.ingredient.material.reorderPoint)
          }
        },
        replay: result.replay
      });
    } catch (error) {
      if (asErrorCode(error) === 'P2002') {
        const existing = await prisma.restaurantIngredient.findUnique({
          where: { merchantId_idempotencyKey: { merchantId: context.merchantId, idempotencyKey } },
          include: { material: { select: { id: true, code: true, name: true, unit: true, reorderPoint: true, leadTimeDays: true, status: true, supplierId: true } } }
        });
        if (existing) {
          if (existing.requestHash !== requestHash) return res.status(409).json({ success: false, error: 'IDEMPOTENCY_KEY_REUSED' });
          return res.status(200).json({ success: true, ingredient: existing, replay: true });
        }
        return res.status(409).json({ success: false, error: 'RESTAURANT_INGREDIENT_CODE_ALREADY_EXISTS' });
      }
      if (asErrorCode(error) === 'P2034') {
        return res.status(409).json({ success: false, error: 'RESTAURANT_INGREDIENT_CONCURRENT_CHANGE' });
      }
      return sendInternalError(res, error, 'restaurant-ingredient-create');
    }
  });

  app.get('/api/merchant/restaurant/ingredients/:ingredientId', ...routeGuards, async (request, res) => {
    const req = request as RestaurantMerchantRequest;
    const context = merchantContext(req);
    if (!context) return res.status(401).json({ success: false, error: 'MERCHANT_AUTH_REQUIRED' });
    try {
      const ingredient = await prisma.restaurantIngredient.findFirst({
        where: { id: req.params.ingredientId, merchantId: context.merchantId },
        include: {
          material: {
            select: {
              id: true, code: true, name: true, unit: true, reorderPoint: true, leadTimeDays: true,
              status: true, supplierId: true, supplier: { select: { id: true, name: true } }
            }
          }
        }
      });
      if (!ingredient) return res.status(404).json({ success: false, error: 'RESTAURANT_INGREDIENT_NOT_FOUND' });
      return res.json({
        success: true,
        ingredient: {
          id: ingredient.id,
          category: ingredient.category,
          allergens: ingredient.allergens,
          version: ingredient.version,
          createdAt: ingredient.createdAt,
          updatedAt: ingredient.updatedAt,
          material: { ...ingredient.material, reorderPoint: Number(ingredient.material.reorderPoint) }
        }
      });
    } catch (error) {
      return sendInternalError(res, error, 'restaurant-ingredient-read');
    }
  });

  app.patch('/api/merchant/restaurant/ingredients/:ingredientId', ...routeGuards, async (request, res) => {
    const req = request as RestaurantMerchantRequest;
    const context = merchantContext(req);
    const input = normalizeRestaurantIngredientUpdate(req.body);
    if (!context) return res.status(401).json({ success: false, error: 'MERCHANT_AUTH_REQUIRED' });
    if (!input) return res.status(400).json({ success: false, error: 'RESTAURANT_INGREDIENT_INPUT_INVALID' });
    try {
      const result = await prisma.$transaction(async tx => {
        const current = await tx.restaurantIngredient.findFirst({
          where: { id: req.params.ingredientId, merchantId: context.merchantId },
          include: {
            material: {
              select: {
                id: true, unit: true, supplierId: true,
                _count: { select: { balances: true, movements: true } }
              }
            }
          }
        });
        if (!current) return { notFound: true as const };
        if (current.version !== input.expectedVersion) return { conflict: true as const };
        if (input.unit && input.unit !== current.material.unit
          && (current.material._count.balances > 0 || current.material._count.movements > 0)) {
          return { unitLocked: true as const };
        }
        if (input.supplierId) {
          const supplier = await tx.supplier.findFirst({
            where: { id: input.supplierId, merchantId: context.merchantId, status: 'active' },
            select: { id: true }
          });
          if (!supplier) return { supplierNotFound: true as const };
        }
        const changed = await tx.restaurantIngredient.updateMany({
          where: { id: current.id, merchantId: context.merchantId, version: input.expectedVersion },
          data: {
            ...(input.category !== undefined ? { category: input.category } : {}),
            ...(input.allergens !== undefined ? { allergens: input.allergens } : {}),
            version: { increment: 1 }
          }
        });
        if (changed.count !== 1) return { conflict: true as const };
        await tx.material.update({
          where: { id: current.material.id },
          data: {
            ...(input.code !== undefined ? { code: input.code } : {}),
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.unit !== undefined ? { unit: input.unit } : {}),
            ...(input.reorderPoint !== undefined ? { reorderPoint: input.reorderPoint } : {}),
            ...(input.leadTimeDays !== undefined ? { leadTimeDays: input.leadTimeDays } : {}),
            ...(input.supplierId !== undefined ? { supplierId: input.supplierId } : {}),
            ...(input.notes !== undefined ? { notes: input.notes } : {}),
            ...(input.status !== undefined ? { status: input.status } : {})
          }
        });
        return {
          ingredient: await tx.restaurantIngredient.findUniqueOrThrow({
            where: { id: current.id },
            include: {
              material: {
                select: {
                  id: true, code: true, name: true, unit: true, reorderPoint: true, leadTimeDays: true,
                  status: true, supplierId: true, supplier: { select: { id: true, name: true } }
                }
              }
            }
          })
        };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      if ('notFound' in result) return res.status(404).json({ success: false, error: 'RESTAURANT_INGREDIENT_NOT_FOUND' });
      if ('conflict' in result) return res.status(409).json({ success: false, error: 'RESTAURANT_INGREDIENT_VERSION_CONFLICT' });
      if ('unitLocked' in result) return res.status(409).json({ success: false, error: 'RESTAURANT_INGREDIENT_UNIT_LOCKED' });
      if ('supplierNotFound' in result) return res.status(404).json({ success: false, error: 'RESTAURANT_SUPPLIER_NOT_FOUND' });
      await logEmployeeAudit(context.merchantId, context.employeeId, 'RESTAURANT_INGREDIENT_UPDATED', 'RestaurantIngredient', result.ingredient.id, req, {
        version: result.ingredient.version,
        status: result.ingredient.material.status
      });
      return res.json({
        success: true,
        ingredient: {
          id: result.ingredient.id,
          category: result.ingredient.category,
          allergens: result.ingredient.allergens,
          version: result.ingredient.version,
          createdAt: result.ingredient.createdAt,
          updatedAt: result.ingredient.updatedAt,
          material: { ...result.ingredient.material, reorderPoint: Number(result.ingredient.material.reorderPoint) }
        }
      });
    } catch (error) {
      if (asErrorCode(error) === 'P2002') {
        return res.status(409).json({ success: false, error: 'RESTAURANT_INGREDIENT_CODE_ALREADY_EXISTS' });
      }
      if (asErrorCode(error) === 'P2034') {
        return res.status(409).json({ success: false, error: 'RESTAURANT_INGREDIENT_CONCURRENT_CHANGE' });
      }
      return sendInternalError(res, error, 'restaurant-ingredient-update');
    }
  });

  app.get('/api/merchant/restaurant/ingredients/:ingredientId/stock', ...inventoryRouteGuards, async (request, res) => {
    const req = request as RestaurantMerchantRequest;
    const context = merchantContext(req);
    if (!context) return res.status(401).json({ success: false, error: 'MERCHANT_AUTH_REQUIRED' });
    if (context.employeeStoreId) {
      return res.status(403).json({ success: false, error: 'RESTAURANT_STORE_INVENTORY_NOT_CONFIGURED' });
    }
    try {
      const ingredient = await prisma.restaurantIngredient.findFirst({
        where: { id: req.params.ingredientId, merchantId: context.merchantId },
        select: { id: true, materialId: true, material: { select: { status: true } } }
      });
      if (!ingredient || ingredient.material.status !== 'active') {
        return res.status(404).json({ success: false, error: 'RESTAURANT_INGREDIENT_NOT_FOUND' });
      }
      const location = await prisma.warehouseLocation.findFirst({
        where: { merchantId: null, code: 'central', isActive: true },
        select: { id: true }
      });
      if (!location) return res.status(503).json({ success: false, error: 'RESTAURANT_CENTRAL_LOCATION_NOT_CONFIGURED' });
      const balance = await prisma.materialInventoryBalance.findFirst({
        where: { merchantId: context.merchantId, materialId: ingredient.materialId, locationId: location.id },
        select: { onHandQuantity: true, reservedQuantity: true, version: true }
      });
      return res.json({ success: true, stock: stockSnapshot(ingredient.id, balance) });
    } catch (error) {
      return sendInternalError(res, error, 'restaurant-ingredient-stock-read');
    }
  });

  app.post('/api/merchant/restaurant/ingredients/:ingredientId/stock-adjustments', ...inventoryRouteGuards, async (request, res) => {
    const req = request as RestaurantMerchantRequest;
    const context = merchantContext(req);
    const input = normalizeRestaurantStockAdjustment(req.body);
    const idempotencyKey = normalizeRestaurantIdempotencyKey(req.get('Idempotency-Key'));
    if (!context) return res.status(401).json({ success: false, error: 'MERCHANT_AUTH_REQUIRED' });
    if (context.employeeStoreId) {
      return res.status(403).json({ success: false, error: 'RESTAURANT_STORE_INVENTORY_NOT_CONFIGURED' });
    }
    if (!input || !idempotencyKey) {
      return res.status(400).json({ success: false, error: 'RESTAURANT_STOCK_ADJUSTMENT_INPUT_INVALID' });
    }
    const requestHash = restaurantRequestHash({ ingredientId: req.params.ingredientId, ...input });
    try {
      const result = await prisma.$transaction(async tx => {
        const existingMovement = await tx.materialInventoryMovement.findUnique({
          where: { idempotencyKey }
        });
        if (existingMovement) {
          if (existingMovement.merchantId !== context.merchantId
            || existingMovement.referenceType !== 'RestaurantInventoryAdjustment'
            || existingMovement.referenceId !== requestHash) return { idempotencyConflict: true as const };
          const balance = await tx.materialInventoryBalance.findUnique({
            where: {
              materialId_locationId: {
                materialId: existingMovement.materialId,
                locationId: existingMovement.locationId
              }
            }
          });
          return { movement: existingMovement, balance, replay: true as const };
        }

        const ingredient = await tx.restaurantIngredient.findFirst({
          where: {
            id: req.params.ingredientId,
            merchantId: context.merchantId,
            material: { is: { status: 'active' } }
          },
          select: { id: true, materialId: true }
        });
        if (!ingredient) return { ingredientNotFound: true as const };
        const location = await tx.warehouseLocation.findFirst({
          where: { merchantId: null, code: input.locationCode, isActive: true },
          select: { id: true }
        });
        if (!location) return { locationNotFound: true as const };

        const balance = await tx.materialInventoryBalance.findUnique({
          where: {
            materialId_locationId: {
              materialId: ingredient.materialId,
              locationId: location.id
            }
          }
        });
        if ((balance?.version ?? 0) !== input.expectedVersion) return { versionConflict: true as const };
        const currentOnHand = new Prisma.Decimal(balance?.onHandQuantity ?? 0);
        const reserved = new Prisma.Decimal(balance?.reservedQuantity ?? 0);
        const nextOnHand = currentOnHand.plus(input.delta);
        if (nextOnHand.lessThan(reserved) || nextOnHand.isNegative()) return { reservedConflict: true as const };

        let updatedBalance: { onHandQuantity: Prisma.Decimal; reservedQuantity: Prisma.Decimal; version: number };
        if (balance) {
          const update = await tx.materialInventoryBalance.updateMany({
            where: { id: balance.id, merchantId: context.merchantId, version: input.expectedVersion },
            data: { onHandQuantity: nextOnHand, version: { increment: 1 } }
          });
          if (update.count !== 1) return { versionConflict: true as const };
          updatedBalance = {
            onHandQuantity: nextOnHand,
            reservedQuantity: balance.reservedQuantity,
            version: balance.version + 1
          };
        } else {
          if (input.expectedVersion !== 0) return { versionConflict: true as const };
          const createdBalance = await tx.materialInventoryBalance.create({
            data: {
              merchantId: context.merchantId,
              materialId: ingredient.materialId,
              locationId: location.id,
              onHandQuantity: nextOnHand,
              version: 1
            },
            select: { onHandQuantity: true, reservedQuantity: true, version: true }
          });
          updatedBalance = createdBalance;
        }
        const movement = await tx.materialInventoryMovement.create({
          data: {
            merchantId: context.merchantId,
            materialId: ingredient.materialId,
            locationId: location.id,
            quantity: input.delta,
            movementType: input.reason === 'waste' ? 'restaurant_waste' : 'restaurant_count_correction',
            referenceType: 'RestaurantInventoryAdjustment',
            referenceId: requestHash,
            idempotencyKey,
            operatorId: context.employeeId ?? context.merchantId,
            note: input.note ?? null
          }
        });
        return { movement, balance: updatedBalance, replay: false as const };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      if ('idempotencyConflict' in result) {
        return res.status(409).json({ success: false, error: 'IDEMPOTENCY_KEY_REUSED' });
      }
      if ('ingredientNotFound' in result) {
        return res.status(404).json({ success: false, error: 'RESTAURANT_INGREDIENT_NOT_FOUND' });
      }
      if ('locationNotFound' in result) {
        return res.status(503).json({ success: false, error: 'RESTAURANT_CENTRAL_LOCATION_NOT_CONFIGURED' });
      }
      if ('versionConflict' in result) {
        return res.status(409).json({ success: false, error: 'RESTAURANT_STOCK_VERSION_CONFLICT' });
      }
      if ('reservedConflict' in result) {
        return res.status(409).json({ success: false, error: 'RESTAURANT_STOCK_BELOW_RESERVED' });
      }
      if (!result.balance) {
        return res.status(409).json({ success: false, error: 'RESTAURANT_STOCK_VERSION_CONFLICT' });
      }
      if (!result.replay) {
        await logEmployeeAudit(context.merchantId, context.employeeId, 'RESTAURANT_STOCK_ADJUSTED', 'RestaurantIngredient', req.params.ingredientId, req, {
          delta: input.delta,
          reason: input.reason,
          version: result.balance.version
        });
      }
      return res.status(result.replay ? 200 : 201).json({
        success: true,
        movement: result.movement ? {
          id: result.movement.id,
          quantity: result.movement.quantity.toString(),
          movementType: result.movement.movementType,
          createdAt: result.movement.createdAt
        } : null,
        stock: stockSnapshot(req.params.ingredientId, result.balance),
        replay: result.replay
      });
    } catch (error) {
      if (asErrorCode(error) === 'P2002' || asErrorCode(error) === 'P2034') {
        const existing = await prisma.materialInventoryMovement.findUnique({ where: { idempotencyKey } });
        if (existing?.merchantId === context.merchantId
          && existing.referenceType === 'RestaurantInventoryAdjustment'
          && existing.referenceId === requestHash) {
          const balance = await prisma.materialInventoryBalance.findUnique({
            where: {
              materialId_locationId: {
                materialId: existing.materialId,
                locationId: existing.locationId
              }
            },
            select: { onHandQuantity: true, reservedQuantity: true, version: true }
          });
          return res.status(200).json({
            success: true,
            movement: {
              id: existing.id,
              quantity: existing.quantity.toString(),
              movementType: existing.movementType,
              createdAt: existing.createdAt
            },
            stock: stockSnapshot(req.params.ingredientId, balance),
            replay: true
          });
        }
        if (asErrorCode(error) === 'P2002') {
          return res.status(409).json({ success: false, error: 'IDEMPOTENCY_KEY_REUSED' });
        }
        return res.status(409).json({ success: false, error: 'RESTAURANT_STOCK_VERSION_CONFLICT' });
      }
      return sendInternalError(res, error, 'restaurant-ingredient-stock-adjust');
    }
  });

  app.get('/api/merchant/restaurant/dishes/:dishId/recipes', ...routeGuards, async (request, res) => {
    const req = request as RestaurantMerchantRequest;
    const context = merchantContext(req);
    if (!context) return res.status(401).json({ success: false, error: 'MERCHANT_AUTH_REQUIRED' });
    const page = pageValue(req.query.page, 1, 1000000);
    const limit = pageValue(req.query.limit, 25, pageSizeMaximum);
    if (page === null || limit === null) return res.status(400).json({ success: false, error: 'PAGINATION_INVALID' });
    try {
      const dish = await prisma.restaurantDish.findFirst({
        where: { id: req.params.dishId, merchantId: context.merchantId },
        select: { id: true }
      });
      if (!dish) return res.status(404).json({ success: false, error: 'RESTAURANT_DISH_NOT_FOUND' });
      const where = { dishId: dish.id, merchantId: context.merchantId };
      const [recipes, total] = await Promise.all([
        prisma.restaurantRecipe.findMany({
          where,
          include: { items: { orderBy: { id: 'asc' } } },
          orderBy: { version: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.restaurantRecipe.count({ where })
      ]);
      return res.json({ success: true, page, limit, total, recipes });
    } catch (error) {
      return sendInternalError(res, error, 'restaurant-recipes-list');
    }
  });

  app.get('/api/merchant/restaurant/dishes/:dishId/cost', ...purchaseRouteGuards, async (request, res) => {
    const req = request as RestaurantMerchantRequest;
    const context = merchantContext(req);
    if (!context) return res.status(401).json({ success: false, error: 'MERCHANT_AUTH_REQUIRED' });
    const menuId = req.query.menuId === undefined ? null : stringQuery(req.query.menuId);
    if (req.query.menuId !== undefined && !menuId) {
      return res.status(400).json({ success: false, error: 'RESTAURANT_COST_MENU_ID_INVALID' });
    }
    if (context.employeeStoreId) {
      return res.status(403).json({ success: false, error: 'RESTAURANT_STORE_COSTING_NOT_CONFIGURED' });
    }
    try {
      const dish = await prisma.restaurantDish.findFirst({
        where: { id: req.params.dishId, merchantId: context.merchantId },
        select: { id: true }
      });
      if (!dish) return res.status(404).json({ success: false, error: 'RESTAURANT_DISH_NOT_FOUND' });
      const recipe = await prisma.restaurantRecipe.findFirst({
        where: { dishId: dish.id, merchantId: context.merchantId, status: 'active' },
        orderBy: { version: 'desc' },
        include: { items: { orderBy: { id: 'asc' } } }
      });
      if (!recipe) return res.status(409).json({ success: false, error: 'RESTAURANT_ACTIVE_RECIPE_NOT_FOUND' });

      const ingredientIds = recipe.items.map(item => item.ingredientId);
      const receiptCosts = await prisma.$queryRaw<Array<{
        ingredientId: string;
        currency: string;
        quantity: Prisma.Decimal;
        totalValue: Prisma.Decimal;
        receiptCount: bigint;
        receivedAt: Date;
      }>>(Prisma.sql`
        SELECT
          purchase_item."ingredientId" AS "ingredientId",
          receipt_item."currency" AS "currency",
          SUM(receipt_item."quantity") AS "quantity",
          SUM(receipt_item."quantity" * receipt_item."unitCost") AS "totalValue",
          COUNT(*) AS "receiptCount",
          MAX(receipt."receivedAt") AS "receivedAt"
        FROM "RestaurantPurchaseReceiptItem" receipt_item
        INNER JOIN "RestaurantPurchaseReceipt" receipt
          ON receipt."id" = receipt_item."receiptId"
        INNER JOIN "RestaurantPurchaseOrderItem" purchase_item
          ON purchase_item."id" = receipt_item."purchaseOrderItemId"
        INNER JOIN "RestaurantPurchaseOrder" purchase_order
          ON purchase_order."id" = purchase_item."purchaseOrderId"
        INNER JOIN "RestaurantIngredient" ingredient
          ON ingredient."id" = purchase_item."ingredientId"
        WHERE receipt."merchantId" = ${context.merchantId}
          AND purchase_order."merchantId" = ${context.merchantId}
          AND ingredient."merchantId" = ${context.merchantId}
          AND purchase_item."ingredientId" IN (${Prisma.join(ingredientIds)})
        GROUP BY purchase_item."ingredientId", receipt_item."currency"
      `);
      const receiptsByIngredient = new Map<string, typeof receiptCosts>();
      for (const receipt of receiptCosts) {
        const receipts = receiptsByIngredient.get(receipt.ingredientId) ?? [];
        receipts.push(receipt);
        receiptsByIngredient.set(receipt.ingredientId, receipts);
      }
      const cost = calculateRestaurantRecipeCost({
        yieldQuantity: recipe.yieldQuantity.toString(),
        items: recipe.items.map(item => ({
          ingredientId: item.ingredientId,
          ingredientCode: item.ingredientCodeSnapshot,
          ingredientName: item.ingredientNameSnapshot,
          unit: item.unitSnapshot,
          quantity: item.quantity.toString(),
          wasteRate: item.wasteRate.toString(),
          receipts: (receiptsByIngredient.get(item.ingredientId) ?? []).map(receipt => ({
            quantity: receipt.quantity.toString(),
            unitCost: '0',
            totalValue: receipt.totalValue.toString(),
            receiptCount: Number(receipt.receiptCount),
            currency: receipt.currency,
            receivedAt: receipt.receivedAt
          }))
        }))
      });
      let menuComparison: {
        menuId: string;
        menuStatus: string;
        menuCurrency: string;
        menuPrice: string;
        status: string;
        grossMargin: string | null;
        grossMarginRate: string | null;
      } | undefined;
      if (menuId) {
        const menu = await prisma.restaurantMenu.findFirst({
          where: { id: menuId, merchantId: context.merchantId },
          select: {
            id: true,
            status: true,
            currency: true,
            storeId: true,
            items: {
              where: { merchantId: context.merchantId, dishId: dish.id },
              select: { price: true }
            }
          }
        });
        if (!menu || !menu.items.length) {
          return res.status(404).json({ success: false, error: 'RESTAURANT_MENU_ITEM_NOT_FOUND' });
        }
        if (!isStoreWriteAllowed(context.employeeStoreId, menu.storeId)) {
          return res.status(403).json({ success: false, error: 'STORE_ACCESS_DENIED' });
        }
        const menuPrice = menu.items[0].price;
        const currenciesMatch = cost.status === 'ready' && menu.currency === cost.currency;
        const grossMargin = currenciesMatch && cost.costPerYield !== null
          ? menuPrice.minus(cost.costPerYield)
          : null;
        menuComparison = {
          menuId: menu.id,
          menuStatus: menu.status,
          menuCurrency: menu.currency,
          menuPrice: menuPrice.toFixed(2),
          status: currenciesMatch ? 'ready' : cost.status === 'ready' ? 'currency_mismatch' : cost.status,
          grossMargin: grossMargin?.toFixed(4, Prisma.Decimal.ROUND_HALF_UP) ?? null,
          grossMarginRate: grossMargin && !menuPrice.isZero()
            ? grossMargin.div(menuPrice).mul(100).toFixed(2, Prisma.Decimal.ROUND_HALF_UP)
            : null
        };
      }
      return res.json({
        success: true,
        cost: {
          recipeId: recipe.id,
          recipeVersion: recipe.version,
          yieldQuantity: recipe.yieldQuantity.toFixed(3),
          yieldUnit: recipe.yieldUnit,
          ...cost
        },
        ...(menuComparison ? { menuComparison } : {})
      });
    } catch (error) {
      return sendInternalError(res, error, 'restaurant-dish-cost-read');
    }
  });

  app.post('/api/merchant/restaurant/dishes/:dishId/recipes', ...routeGuards, async (request, res) => {
    const req = request as RestaurantMerchantRequest;
    const context = merchantContext(req);
    const input = normalizeRestaurantRecipeCreate(req.body);
    const idempotencyKey = normalizeRestaurantIdempotencyKey(req.get('Idempotency-Key'));
    if (!context) return res.status(401).json({ success: false, error: 'MERCHANT_AUTH_REQUIRED' });
    if (!input || !idempotencyKey) return res.status(400).json({ success: false, error: 'RESTAURANT_RECIPE_INPUT_INVALID' });
    const requestHash = restaurantRequestHash({ dishId: req.params.dishId, ...input });
    try {
      const result = await prisma.$transaction(async tx => {
        const existing = await tx.restaurantRecipe.findUnique({
          where: { merchantId_idempotencyKey: { merchantId: context.merchantId, idempotencyKey } },
          include: { items: { orderBy: { id: 'asc' } } }
        });
        if (existing) {
          if (existing.requestHash !== requestHash) return { conflict: true as const };
          return { recipe: existing, replay: true as const };
        }
        const dish = await tx.restaurantDish.findFirst({
          where: { id: req.params.dishId, merchantId: context.merchantId },
          select: { id: true, status: true }
        });
        if (!dish) return { dishNotFound: true as const };
        if (dish.status === 'archived') return { dishArchived: true as const };
        const ingredientIds = input.items.map(item => item.ingredientId);
        const ingredients = await tx.restaurantIngredient.findMany({
          where: {
            merchantId: context.merchantId,
            id: { in: ingredientIds },
            material: { is: { merchantId: context.merchantId, status: 'active' } }
          },
          include: {
            material: { select: { code: true, name: true, unit: true } }
          }
        });
        if (ingredients.length !== ingredientIds.length) return { ingredientNotFound: true as const };
        const currentVersion = await tx.restaurantRecipe.aggregate({
          where: { dishId: dish.id, merchantId: context.merchantId },
          _max: { version: true }
        });
        const recipe = await tx.restaurantRecipe.create({
          data: {
            merchantId: context.merchantId,
            dishId: dish.id,
            version: (currentVersion._max.version ?? 0) + 1,
            yieldQuantity: input.yieldQuantity,
            yieldUnit: input.yieldUnit,
            notes: input.notes,
            idempotencyKey,
            requestHash,
            items: {
              create: input.items.map(item => {
                const ingredient = ingredients.find(candidate => candidate.id === item.ingredientId)!;
                return {
                  merchantId: context.merchantId,
                  ingredientId: ingredient.id,
                  ingredientCodeSnapshot: ingredient.material.code,
                  ingredientNameSnapshot: ingredient.material.name,
                  unitSnapshot: ingredient.material.unit,
                  quantity: item.quantity,
                  wasteRate: item.wasteRate
                };
              })
            }
          },
          include: { items: { orderBy: { id: 'asc' } } }
        });
        return { recipe, replay: false as const };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      if ('conflict' in result) return res.status(409).json({ success: false, error: 'IDEMPOTENCY_KEY_REUSED' });
      if ('dishNotFound' in result) return res.status(404).json({ success: false, error: 'RESTAURANT_DISH_NOT_FOUND' });
      if ('dishArchived' in result) return res.status(409).json({ success: false, error: 'RESTAURANT_DISH_ARCHIVED' });
      if ('ingredientNotFound' in result) return res.status(404).json({ success: false, error: 'RESTAURANT_INGREDIENT_NOT_FOUND' });
      await logEmployeeAudit(context.merchantId, context.employeeId, 'RESTAURANT_RECIPE_VERSION_CREATED', 'RestaurantRecipe', result.recipe.id, req, {
        dishId: result.recipe.dishId,
        version: result.recipe.version,
        replay: result.replay
      });
      return res.status(result.replay ? 200 : 201).json({ success: true, recipe: result.recipe, replay: result.replay });
    } catch (error) {
      if (asErrorCode(error) === 'P2002') {
        const existing = await prisma.restaurantRecipe.findUnique({
          where: { merchantId_idempotencyKey: { merchantId: context.merchantId, idempotencyKey } },
          include: { items: { orderBy: { id: 'asc' } } }
        });
        if (existing) {
          if (existing.requestHash !== requestHash) return res.status(409).json({ success: false, error: 'IDEMPOTENCY_KEY_REUSED' });
          return res.status(200).json({ success: true, recipe: existing, replay: true });
        }
        return res.status(409).json({ success: false, error: 'RESTAURANT_RECIPE_VERSION_CONFLICT' });
      }
      if (asErrorCode(error) === 'P2034') {
        return res.status(409).json({ success: false, error: 'RESTAURANT_RECIPE_VERSION_CONFLICT' });
      }
      return sendInternalError(res, error, 'restaurant-recipe-create');
    }
  });

  app.post('/api/merchant/restaurant/recipes/:recipeId/activate', ...routeGuards, async (request, res) => {
    const req = request as RestaurantMerchantRequest;
    const context = merchantContext(req);
    const input = normalizeRestaurantRecipeActivate(req.body);
    if (!context) return res.status(401).json({ success: false, error: 'MERCHANT_AUTH_REQUIRED' });
    if (!input) return res.status(400).json({ success: false, error: 'RESTAURANT_RECIPE_VERSION_INVALID' });
    try {
      const result = await prisma.$transaction(async tx => {
        const recipe = await tx.restaurantRecipe.findFirst({
          where: { id: req.params.recipeId, merchantId: context.merchantId },
          select: { id: true, dishId: true, version: true, status: true }
        });
        if (!recipe) return { notFound: true as const };
        if (recipe.version !== input.expectedVersion || recipe.status !== 'draft') return { conflict: true as const };
        const changed = await tx.restaurantRecipe.updateMany({
          where: {
            id: recipe.id,
            merchantId: context.merchantId,
            version: input.expectedVersion,
            status: 'draft'
          },
          data: { status: 'active' }
        });
        if (changed.count !== 1) return { conflict: true as const };
        await tx.restaurantRecipe.updateMany({
          where: {
            merchantId: context.merchantId,
            dishId: recipe.dishId,
            id: { not: recipe.id },
            status: 'active'
          },
          data: { status: 'archived' }
        });
        return {
          recipe: await tx.restaurantRecipe.findUniqueOrThrow({
            where: { id: recipe.id },
            include: { items: { orderBy: { id: 'asc' } } }
          })
        };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      if ('notFound' in result) return res.status(404).json({ success: false, error: 'RESTAURANT_RECIPE_NOT_FOUND' });
      if ('conflict' in result) return res.status(409).json({ success: false, error: 'RESTAURANT_RECIPE_VERSION_CONFLICT' });
      await logEmployeeAudit(context.merchantId, context.employeeId, 'RESTAURANT_RECIPE_ACTIVATED', 'RestaurantRecipe', result.recipe.id, req, {
        dishId: result.recipe.dishId,
        version: result.recipe.version
      });
      return res.json({ success: true, recipe: result.recipe });
    } catch (error) {
      if (asErrorCode(error) === 'P2034') {
        return res.status(409).json({ success: false, error: 'RESTAURANT_RECIPE_VERSION_CONFLICT' });
      }
      return sendInternalError(res, error, 'restaurant-recipe-activate');
    }
  });

  app.get('/api/merchant/restaurant/purchase-orders', ...purchaseRouteGuards, async (request, res) => {
    const req = request as RestaurantMerchantRequest;
    const context = merchantContext(req);
    if (!context) return res.status(401).json({ success: false, error: 'MERCHANT_AUTH_REQUIRED' });
    const page = pageValue(req.query.page, 1, 100000);
    const pageSize = pageValue(req.query.pageSize, 20, 100);
    const status = stringQuery(req.query.status);
    const statuses = ['draft', 'ordered', 'partially_received', 'received', 'cancelled'];
    if (!page || !pageSize || (status && !statuses.includes(status))) {
      return res.status(400).json({ success: false, error: 'RESTAURANT_PURCHASE_ORDER_QUERY_INVALID' });
    }
    try {
      const where = {
        merchantId: context.merchantId,
        ...(status ? { status } : {})
      };
      const [purchaseOrders, total] = await Promise.all([
        prisma.restaurantPurchaseOrder.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            supplier: { select: { id: true, name: true } },
            items: { orderBy: { id: 'asc' } }
          }
        }),
        prisma.restaurantPurchaseOrder.count({ where })
      ]);
      return res.json({ success: true, purchaseOrders: purchaseOrders.map(purchaseOrderResponse), page, pageSize, total });
    } catch (error) {
      return sendInternalError(res, error, 'restaurant-purchase-order-list');
    }
  });

  app.post('/api/merchant/restaurant/purchase-orders', ...purchaseRouteGuards, async (request, res) => {
    const req = request as RestaurantMerchantRequest;
    const context = merchantContext(req);
    const input = normalizeRestaurantPurchaseOrderCreate(req.body);
    const idempotencyKey = normalizeRestaurantIdempotencyKey(req.get('Idempotency-Key'));
    if (!context) return res.status(401).json({ success: false, error: 'MERCHANT_AUTH_REQUIRED' });
    if (!input || !idempotencyKey) {
      return res.status(400).json({ success: false, error: 'RESTAURANT_PURCHASE_ORDER_INPUT_INVALID' });
    }
    const requestHash = restaurantRequestHash(input);
    try {
      const result = await prisma.$transaction(async tx => {
        const replay = await tx.restaurantPurchaseOrder.findUnique({ where: { idempotencyKey } });
        if (replay) {
          if (replay.merchantId !== context.merchantId || replay.requestHash !== requestHash) {
            return { idempotencyConflict: true as const };
          }
          const purchaseOrder = await tx.restaurantPurchaseOrder.findUniqueOrThrow({
            where: { id: replay.id },
            include: {
              supplier: { select: { id: true, name: true } },
              items: { orderBy: { id: 'asc' } }
            }
          });
          return { purchaseOrder, replay: true as const };
        }
        const supplier = await tx.supplier.findFirst({
          where: { id: input.supplierId, merchantId: context.merchantId, status: 'active' },
          select: { id: true }
        });
        if (!supplier) return { referenceInvalid: true as const };
        const ingredients = await tx.restaurantIngredient.findMany({
          where: {
            merchantId: context.merchantId,
            id: { in: input.items.map(item => item.ingredientId) },
            material: { is: { status: 'active' } }
          },
          select: {
            id: true,
            material: { select: { code: true, name: true, unit: true } }
          }
        });
        const ingredientById = new Map(ingredients.map(ingredient => [ingredient.id, ingredient]));
        if (ingredients.length !== input.items.length
          || input.items.some(item => !ingredientById.has(item.ingredientId))) {
          return { referenceInvalid: true as const };
        }
        const purchaseOrder = await tx.restaurantPurchaseOrder.create({
          data: {
            merchantId: context.merchantId,
            supplierId: supplier.id,
            currency: input.currency,
            notes: input.notes,
            status: 'draft',
            version: 1,
            idempotencyKey,
            requestHash,
            createdBy: context.employeeId ?? context.merchantId,
            items: {
              create: input.items.map(item => {
                const ingredient = ingredientById.get(item.ingredientId)!;
                return {
                  ingredientId: ingredient.id,
                  ingredientCodeSnapshot: ingredient.material.code,
                  ingredientNameSnapshot: ingredient.material.name,
                  unitSnapshot: ingredient.material.unit,
                  orderedQuantity: item.orderedQuantity,
                  quotedUnitCost: item.quotedUnitCost
                };
              })
            }
          },
          include: {
            supplier: { select: { id: true, name: true } },
            items: { orderBy: { id: 'asc' } }
          }
        });
        return { purchaseOrder, replay: false as const };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      if ('idempotencyConflict' in result) {
        return res.status(409).json({ success: false, error: 'IDEMPOTENCY_KEY_REUSED' });
      }
      if ('referenceInvalid' in result) {
        return res.status(404).json({ success: false, error: 'RESTAURANT_PURCHASE_REFERENCE_NOT_FOUND' });
      }
      if (!result.replay) {
        await logEmployeeAudit(context.merchantId, context.employeeId, 'RESTAURANT_PURCHASE_ORDER_CREATED', 'RestaurantPurchaseOrder', result.purchaseOrder.id, req, {
          supplierId: result.purchaseOrder.supplierId,
          itemCount: result.purchaseOrder.items.length
        });
      }
      return res.status(result.replay ? 200 : 201).json({
        success: true,
        purchaseOrder: purchaseOrderResponse(result.purchaseOrder),
        replay: result.replay
      });
    } catch (error) {
      if (asErrorCode(error) === 'P2002') {
        const existing = await prisma.restaurantPurchaseOrder.findUnique({ where: { idempotencyKey } });
        if (existing?.merchantId === context.merchantId && existing.requestHash === requestHash) {
          const purchaseOrder = await prisma.restaurantPurchaseOrder.findUniqueOrThrow({
            where: { id: existing.id },
            include: {
              supplier: { select: { id: true, name: true } },
              items: { orderBy: { id: 'asc' } }
            }
          });
          return res.status(200).json({ success: true, purchaseOrder: purchaseOrderResponse(purchaseOrder), replay: true });
        }
        return res.status(409).json({ success: false, error: 'IDEMPOTENCY_KEY_REUSED' });
      }
      if (asErrorCode(error) === 'P2034') {
        return res.status(409).json({ success: false, error: 'RESTAURANT_PURCHASE_ORDER_CONCURRENT_CHANGE' });
      }
      return sendInternalError(res, error, 'restaurant-purchase-order-create');
    }
  });

  app.get('/api/merchant/restaurant/purchase-orders/:purchaseOrderId', ...purchaseRouteGuards, async (request, res) => {
    const req = request as RestaurantMerchantRequest;
    const context = merchantContext(req);
    if (!context) return res.status(401).json({ success: false, error: 'MERCHANT_AUTH_REQUIRED' });
    try {
      const purchaseOrder = await prisma.restaurantPurchaseOrder.findFirst({
        where: { id: req.params.purchaseOrderId, merchantId: context.merchantId },
        include: {
          supplier: { select: { id: true, name: true } },
          items: { orderBy: { id: 'asc' } },
          receipts: {
            orderBy: { receivedAt: 'asc' },
            include: { items: { orderBy: { id: 'asc' } } }
          }
        }
      });
      if (!purchaseOrder) return res.status(404).json({ success: false, error: 'RESTAURANT_PURCHASE_ORDER_NOT_FOUND' });
      return res.json({ success: true, purchaseOrder: purchaseOrderResponse(purchaseOrder) });
    } catch (error) {
      return sendInternalError(res, error, 'restaurant-purchase-order-read');
    }
  });

  const transitionRestaurantPurchaseOrder = async (
    req: RestaurantMerchantRequest,
    res: Response,
    status: 'ordered' | 'cancelled'
  ) => {
    const context = merchantContext(req);
    const input = normalizeRestaurantPurchaseTransition(req.body);
    if (!context) return res.status(401).json({ success: false, error: 'MERCHANT_AUTH_REQUIRED' });
    if (!input) return res.status(400).json({ success: false, error: 'RESTAURANT_PURCHASE_ORDER_VERSION_REQUIRED' });
    try {
      const result = await prisma.$transaction(async tx => {
        const current = await tx.restaurantPurchaseOrder.findFirst({
          where: { id: req.params.purchaseOrderId, merchantId: context.merchantId },
          select: { id: true, supplierId: true, status: true, version: true }
        });
        if (!current) return { notFound: true as const };
        if (current.version !== input.expectedVersion) return { conflict: true as const };
        if (status === 'ordered') {
          const supplier = await tx.supplier.findFirst({
            where: { id: current.supplierId, merchantId: context.merchantId, status: 'active' },
            select: { id: true }
          });
          if (!supplier) return { referenceInvalid: true as const };
        }
        const allowed = status === 'ordered'
          ? current.status === 'draft'
          : current.status === 'draft' || current.status === 'ordered';
        if (!allowed) return { invalidState: true as const };
        const changed = await tx.restaurantPurchaseOrder.updateMany({
          where: { id: current.id, merchantId: context.merchantId, version: input.expectedVersion, status: current.status },
          data: { status, version: { increment: 1 } }
        });
        if (changed.count !== 1) return { conflict: true as const };
        return {
          purchaseOrder: await tx.restaurantPurchaseOrder.findUniqueOrThrow({
            where: { id: current.id },
            include: {
              supplier: { select: { id: true, name: true } },
              items: { orderBy: { id: 'asc' } }
            }
          })
        };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      if ('notFound' in result) return res.status(404).json({ success: false, error: 'RESTAURANT_PURCHASE_ORDER_NOT_FOUND' });
      if ('referenceInvalid' in result) return res.status(409).json({ success: false, error: 'RESTAURANT_PURCHASE_SUPPLIER_INACTIVE' });
      if ('conflict' in result) return res.status(409).json({ success: false, error: 'RESTAURANT_PURCHASE_ORDER_VERSION_CONFLICT' });
      if ('invalidState' in result) return res.status(409).json({ success: false, error: 'RESTAURANT_PURCHASE_ORDER_STATE_INVALID' });
      await logEmployeeAudit(context.merchantId, context.employeeId, `RESTAURANT_PURCHASE_ORDER_${status.toUpperCase()}`, 'RestaurantPurchaseOrder', result.purchaseOrder.id, req, {
        version: result.purchaseOrder.version
      });
      return res.json({ success: true, purchaseOrder: purchaseOrderResponse(result.purchaseOrder) });
    } catch (error) {
      if (asErrorCode(error) === 'P2034') {
        return res.status(409).json({ success: false, error: 'RESTAURANT_PURCHASE_ORDER_VERSION_CONFLICT' });
      }
      return sendInternalError(res, error, 'restaurant-purchase-order-transition');
    }
  };

  app.post('/api/merchant/restaurant/purchase-orders/:purchaseOrderId/submit', ...purchaseRouteGuards, (request, res) =>
    transitionRestaurantPurchaseOrder(request as RestaurantMerchantRequest, res, 'ordered'));
  app.post('/api/merchant/restaurant/purchase-orders/:purchaseOrderId/cancel', ...purchaseRouteGuards, (request, res) =>
    transitionRestaurantPurchaseOrder(request as RestaurantMerchantRequest, res, 'cancelled'));

  app.post('/api/merchant/restaurant/purchase-orders/:purchaseOrderId/receipts', ...purchaseRouteGuards, async (request, res) => {
    const req = request as RestaurantMerchantRequest;
    const context = merchantContext(req);
    const input = normalizeRestaurantPurchaseReceipt(req.body);
    const idempotencyKey = normalizeRestaurantIdempotencyKey(req.get('Idempotency-Key'));
    if (!context) return res.status(401).json({ success: false, error: 'MERCHANT_AUTH_REQUIRED' });
    if (context.employeeStoreId) {
      return res.status(403).json({ success: false, error: 'RESTAURANT_STORE_INVENTORY_NOT_CONFIGURED' });
    }
    if (!input || !idempotencyKey) {
      return res.status(400).json({ success: false, error: 'RESTAURANT_PURCHASE_RECEIPT_INPUT_INVALID' });
    }
    const requestHash = restaurantRequestHash({ purchaseOrderId: req.params.purchaseOrderId, ...input });
    try {
      const result = await prisma.$transaction(async tx => {
        const replay = await tx.restaurantPurchaseReceipt.findUnique({ where: { idempotencyKey } });
        if (replay) {
          if (replay.merchantId !== context.merchantId
            || replay.purchaseOrderId !== req.params.purchaseOrderId
            || replay.payloadHash !== requestHash) return { idempotencyConflict: true as const };
          const receipt = await tx.restaurantPurchaseReceipt.findUniqueOrThrow({
            where: { id: replay.id },
            include: { items: { orderBy: { id: 'asc' } } }
          });
          return { receipt, replay: true as const };
        }
        const purchaseOrder = await tx.restaurantPurchaseOrder.findFirst({
          where: {
            id: req.params.purchaseOrderId,
            merchantId: context.merchantId,
            status: { in: ['ordered', 'partially_received'] }
          },
          include: {
            items: {
              orderBy: { id: 'asc' },
              include: { ingredient: { select: { merchantId: true, materialId: true, material: { select: { status: true } } } } }
            }
          }
        });
        if (!purchaseOrder) return { purchaseOrderNotReceivable: true as const };
        if (purchaseOrder.version !== input.expectedVersion) return { versionConflict: true as const };
        const location = await tx.warehouseLocation.findFirst({
          where: { merchantId: null, code: 'central', isActive: true },
          select: { id: true }
        });
        if (!location) return { locationNotFound: true as const };
        const orderItemById = new Map(purchaseOrder.items.map(item => [item.id, item]));
        const rows = input.items.map(item => {
          const orderItem = orderItemById.get(item.itemId);
          if (!orderItem
            || orderItem.ingredient.merchantId !== context.merchantId
            || orderItem.ingredient.material.status !== 'active') return null;
          const quantity = new Prisma.Decimal(item.quantity);
          const remaining = new Prisma.Decimal(orderItem.orderedQuantity).minus(orderItem.receivedQuantity);
          if (quantity.greaterThan(remaining)) return null;
          return { input: item, orderItem, quantity };
        });
        if (rows.some(row => row === null)) return { receiptLinesInvalid: true as const };
        const validRows = rows as Array<{
          input: (typeof input.items)[number];
          orderItem: typeof purchaseOrder.items[number];
          quantity: Prisma.Decimal;
        }>;
        const receiptId = crypto.randomUUID();
        const receipt = await tx.restaurantPurchaseReceipt.create({
          data: {
            id: receiptId,
            merchantId: context.merchantId,
            purchaseOrderId: purchaseOrder.id,
            idempotencyKey,
            payloadHash: requestHash,
            note: input.note,
            receivedBy: context.employeeId ?? context.merchantId,
            items: {
              create: validRows.map(row => ({
                id: crypto.randomUUID(),
                purchaseOrderItemId: row.orderItem.id,
                quantity: row.quantity,
                unitCost: row.input.unitCost,
                currency: purchaseOrder.currency
              }))
            }
          },
          include: { items: { orderBy: { id: 'asc' } } }
        });
        for (const row of validRows) {
          const nextReceived = new Prisma.Decimal(row.orderItem.receivedQuantity).plus(row.quantity);
          const itemUpdate = await tx.restaurantPurchaseOrderItem.updateMany({
            where: {
              id: row.orderItem.id,
              purchaseOrderId: purchaseOrder.id,
              receivedQuantity: row.orderItem.receivedQuantity
            },
            data: { receivedQuantity: nextReceived }
          });
          if (itemUpdate.count !== 1) throw new Error('RESTAURANT_PURCHASE_ORDER_CONCURRENT_CHANGE');
          const balance = await tx.materialInventoryBalance.findUnique({
            where: {
              materialId_locationId: {
                materialId: row.orderItem.ingredient.materialId,
                locationId: location.id
              }
            }
          });
          const nextOnHand = new Prisma.Decimal(balance?.onHandQuantity ?? 0).plus(row.quantity);
          if (balance) {
            const balanceUpdate = await tx.materialInventoryBalance.updateMany({
              where: { id: balance.id, merchantId: context.merchantId, version: balance.version },
              data: { onHandQuantity: nextOnHand, version: { increment: 1 } }
            });
            if (balanceUpdate.count !== 1) throw new Error('RESTAURANT_PURCHASE_STOCK_CONCURRENT_CHANGE');
          } else {
            await tx.materialInventoryBalance.create({
              data: {
                merchantId: context.merchantId,
                materialId: row.orderItem.ingredient.materialId,
                locationId: location.id,
                onHandQuantity: nextOnHand,
                version: 1
              }
            });
          }
          await tx.materialInventoryMovement.create({
            data: {
              merchantId: context.merchantId,
              materialId: row.orderItem.ingredient.materialId,
              locationId: location.id,
              quantity: row.quantity,
              movementType: 'restaurant_purchase_receipt',
              referenceType: 'RestaurantPurchaseReceipt',
              referenceId: receiptId,
              idempotencyKey: `restaurant-purchase-receipt:${receiptId}:${row.orderItem.id}`,
              operatorId: context.employeeId ?? context.merchantId,
              note: `采购单 ${purchaseOrder.id}${input.note ? `：${input.note}` : ''}`
            }
          });
        }
        const receivedByItemId = new Map(validRows.map(row => [row.orderItem.id, row.quantity]));
        const allReceived = purchaseOrder.items.every(item =>
          new Prisma.Decimal(item.receivedQuantity).plus(receivedByItemId.get(item.id) ?? 0)
            .greaterThanOrEqualTo(item.orderedQuantity)
        );
        const orderUpdate = await tx.restaurantPurchaseOrder.updateMany({
          where: {
            id: purchaseOrder.id,
            merchantId: context.merchantId,
            status: purchaseOrder.status,
            version: input.expectedVersion
          },
          data: {
            status: allReceived ? 'received' : 'partially_received',
            version: { increment: 1 }
          }
        });
        if (orderUpdate.count !== 1) throw new Error('RESTAURANT_PURCHASE_ORDER_CONCURRENT_CHANGE');
        return { receipt, replay: false as const };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      if ('idempotencyConflict' in result) {
        return res.status(409).json({ success: false, error: 'IDEMPOTENCY_KEY_REUSED' });
      }
      if ('purchaseOrderNotReceivable' in result) {
        return res.status(409).json({ success: false, error: 'RESTAURANT_PURCHASE_ORDER_NOT_RECEIVABLE' });
      }
      if ('versionConflict' in result) {
        return res.status(409).json({ success: false, error: 'RESTAURANT_PURCHASE_ORDER_VERSION_CONFLICT' });
      }
      if ('locationNotFound' in result) {
        return res.status(503).json({ success: false, error: 'RESTAURANT_CENTRAL_LOCATION_NOT_CONFIGURED' });
      }
      if ('receiptLinesInvalid' in result) {
        return res.status(400).json({ success: false, error: 'RESTAURANT_PURCHASE_RECEIPT_LINES_INVALID' });
      }
      if (!result.replay) {
        await logEmployeeAudit(context.merchantId, context.employeeId, 'RESTAURANT_PURCHASE_RECEIVED', 'RestaurantPurchaseReceipt', result.receipt.id, req, {
          purchaseOrderId: req.params.purchaseOrderId,
          itemCount: result.receipt.items.length
        });
      }
      return res.status(result.replay ? 200 : 201).json({
        success: true,
        receipt: purchaseReceiptResponse(result.receipt),
        replay: result.replay
      });
    } catch (error) {
      if (asErrorCode(error) === 'P2002') {
        const existing = await prisma.restaurantPurchaseReceipt.findUnique({ where: { idempotencyKey } });
        if (existing?.merchantId === context.merchantId
          && existing.purchaseOrderId === req.params.purchaseOrderId
          && existing.payloadHash === requestHash) {
          const receipt = await prisma.restaurantPurchaseReceipt.findUniqueOrThrow({
            where: { id: existing.id },
            include: { items: { orderBy: { id: 'asc' } } }
          });
          return res.status(200).json({ success: true, receipt: purchaseReceiptResponse(receipt), replay: true });
        }
        return res.status(409).json({ success: false, error: 'IDEMPOTENCY_KEY_REUSED' });
      }
      if (asErrorCode(error) === 'P2034'
        || error instanceof Error && error.message.startsWith('RESTAURANT_PURCHASE_')) {
        return res.status(409).json({ success: false, error: 'RESTAURANT_PURCHASE_ORDER_CONCURRENT_CHANGE' });
      }
      return sendInternalError(res, error, 'restaurant-purchase-receive');
    }
  });
}

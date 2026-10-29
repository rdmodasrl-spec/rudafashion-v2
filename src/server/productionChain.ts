import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Express, NextFunction, Request, RequestHandler, Response } from 'express';
import type { PrismaClient } from '@prisma/client';

/**
 * RUDA 智能生产链服务端模块（外发加工记账与月度结算）。
 *
 * 边界：
 * - 商品、SKU、员工、权限、审计、应用安装复用 RUDA 既有权威模型；
 * - 本模块只负责加工单、取货交接、送货验收、月度结算、付款与单据留言；
 * - 商家路由先经过会话 + 应用安装门禁；工厂路由使用独立主体与受限范围。
 */

export const PRODUCTION_APP_ID = 'ruda-production-chain';
export const PRODUCTION_APP_VERSION = '1.0.0';

export const productionOrderStatuses = [
  'draft',
  'pending_factory',
  'accepted',
  'in_production',
  'completed',
  'cancelled'
] as const;
export type ProductionOrderStatus = (typeof productionOrderStatuses)[number];

const orderTransitions: Record<ProductionOrderStatus, readonly ProductionOrderStatus[]> = {
  draft: ['pending_factory', 'cancelled'],
  pending_factory: ['accepted', 'cancelled'],
  accepted: ['in_production', 'completed', 'cancelled'],
  in_production: ['completed', 'cancelled'],
  completed: [],
  cancelled: []
};

export function canTransitionProductionOrder(from: string, to: string): boolean {
  if (!productionOrderStatuses.includes(from as ProductionOrderStatus)) return false;
  return orderTransitions[from as ProductionOrderStatus].includes(to as ProductionOrderStatus);
}

export function isOpenProductionOrderStatus(status: string): boolean {
  return status !== 'completed' && status !== 'cancelled';
}

export interface ProductionItemInput {
  variantId: string;
  quantity: number;
  unitPrice?: number;
}

export function normalizeProductionItems(input: unknown): ProductionItemInput[] | null {
  if (!Array.isArray(input) || input.length < 1 || input.length > 200) return null;
  const seen = new Set<string>();
  const items: ProductionItemInput[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') return null;
    const record = raw as Record<string, unknown>;
    const variantId = typeof record.variantId === 'string' ? record.variantId.trim() : '';
    const quantity = Number(record.quantity);
    const unitPrice = record.unitPrice === undefined || record.unitPrice === null
      ? undefined
      : Number(record.unitPrice);
    if (!variantId || seen.has(variantId)) return null;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1_000_000) return null;
    if (unitPrice !== undefined && (!Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 1_000_000)) return null;
    seen.add(variantId);
    items.push({ variantId, quantity, ...(unitPrice === undefined ? {} : { unitPrice }) });
  }
  return items;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function computeProductionTotals(
  items: readonly ProductionItemInput[],
  defaultUnitPrice: number
): { plannedQuantity: number; plannedAmount: number } {
  let quantity = 0;
  let amount = 0;
  for (const item of items) {
    quantity += item.quantity;
    amount += item.quantity * (item.unitPrice === undefined ? defaultUnitPrice : item.unitPrice);
  }
  return { plannedQuantity: quantity, plannedAmount: roundMoney(amount) };
}

export interface InspectionLine {
  declaredQuantity: number;
  receivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  reworkQuantity: number;
}

/**
 * 验收数量校验：实收不得超过送货；合格 + 不合格 = 实收；返工不超过不合格；短少 = 送货 − 实收。
 */
export function normalizeInspectionLine(input: InspectionLine): InspectionLine | null {
  const values = [input.declaredQuantity, input.receivedQuantity, input.acceptedQuantity, input.rejectedQuantity, input.reworkQuantity];
  if (values.some(value => !Number.isInteger(value) || value < 0)) return null;
  if (input.receivedQuantity > input.declaredQuantity) return null;
  if (input.acceptedQuantity + input.rejectedQuantity !== input.receivedQuantity) return null;
  if (input.reworkQuantity > input.rejectedQuantity) return null;
  return input;
}

export function computeStatementTotals(input: {
  openingBalance: number;
  laborAmount: number;
  adjustmentAmount: number;
  paidAmount: number;
}): { totalAmount: number; closingBalance: number } {
  const totalAmount = roundMoney(input.laborAmount + input.adjustmentAmount);
  return {
    totalAmount,
    closingBalance: roundMoney(input.openingBalance + totalAmount - input.paidAmount)
  };
}

export function computeDeliveryShortage(declared: number, received: number): number {
  return Math.max(0, declared - received);
}

export function createProductionInviteToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashProductionInviteToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function isProductionIdempotencyKey(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9._:-]{16,80}$/.test(value);
}

export function productionSequenceNo(prefix: string, at: Date = new Date()): string {
  const date = at.toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefix}-${date}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

export function normalizePeriodMonth(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  return value;
}

export function periodMonthRange(month: string): { start: Date; end: Date } {
  const [year, monthIndex] = month.split('-').map(Number);
  return {
    start: new Date(Date.UTC(year, monthIndex - 1, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0))
  };
}

export interface ProductionChainDeps {
  prisma: PrismaClient;
  merchantAuth: RequestHandler | RequestHandler[];
  employeePermission: (permission: string, ...roles: string[]) => RequestHandler;
  requireAppInstalled: RequestHandler;
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
  jwtSecret: string;
  publishMerchantSync?: (merchantId: string, resources: readonly string[]) => void;
}

type AnyRecord = Record<string, any>;

function fail(res: Response, status: number, code: string): Response {
  return res.status(status).json({ success: false, error: code });
}

function num(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: unknown, max = 2000): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function parseRequiredDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseOptionalDate(value: unknown): Date | null | 'invalid' {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') return 'invalid';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'invalid' : parsed;
}

function firstImage(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) {
      const found = parsed.find((item): item is string => typeof item === 'string' && item.trim().length > 0);
      return found || null;
    }
  } catch {
    // 历史数据可能直接存 URL。
  }
  return value.startsWith('http') || value.startsWith('/') ? value : null;
}

async function merchantCanViewCost(deps: ProductionChainDeps, req: Request): Promise<boolean> {
  const merchant = (req as AnyRecord).merchant || {};
  if (!merchant.employeeId) return true;
  const role = String(merchant.employeeRole || '');
  const configured = merchant.permissions;
  if (configured === undefined || configured === null) return role === 'store_manager';
  const values = Array.isArray(configured) ? configured : [configured];
  return values.includes('*') || values.includes('production.cost.view');
}


function resolveFactorySession(deps: ProductionChainDeps): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) return fail(res, 401, 'PRODUCTION_FACTORY_AUTH_REQUIRED');
    let payload: AnyRecord | null = null;
    try {
      payload = jwt.verify(token, deps.jwtSecret) as AnyRecord;
    } catch {
      return fail(res, 401, 'PRODUCTION_FACTORY_AUTH_REQUIRED');
    }
    if (!payload || payload.role !== 'factory' || typeof payload.factoryMemberId !== 'string') {
      return fail(res, 401, 'PRODUCTION_FACTORY_AUTH_REQUIRED');
    }
    const member = await deps.prisma.productionFactoryMember.findUnique({
      where: { id: payload.factoryMemberId },
      include: { factory: { select: { id: true, merchantId: true, name: true, status: true } } }
    });
    if (!member || !member.active || member.factory.status !== 'active'
      || member.factoryId !== payload.factoryId || member.factory.merchantId !== payload.merchantId) {
      return fail(res, 403, 'PRODUCTION_FACTORY_ACCESS_REVOKED');
    }
    const installation = await deps.prisma.appInstallation.findFirst({
      where: {
        merchantId: member.factory.merchantId,
        status: 'active',
        app: { appId: PRODUCTION_APP_ID, status: 'published' }
      },
      select: { id: true }
    });
    if (!installation) return fail(res, 403, 'PRODUCTION_FACTORY_ACCESS_REVOKED');
    (req as AnyRecord).factory = {
      factoryMemberId: member.id,
      factoryId: member.factoryId,
      merchantId: member.factory.merchantId,
      memberName: member.name,
      role: member.role,
      factoryName: member.factory.name
    };
    next();
  };
}

function signFactoryToken(deps: ProductionChainDeps, member: { id: string; factoryId: string }, merchantId: string) {
  return jwt.sign(
    { role: 'factory', factoryMemberId: member.id, factoryId: member.factoryId, merchantId },
    deps.jwtSecret,
    { expiresIn: '7d' }
  );
}

function serializeMessage(message: AnyRecord) {
  return {
    id: message.id,
    scopeType: message.scopeType,
    scopeId: message.scopeId,
    authorSide: message.authorSide,
    authorName: message.authorName,
    body: message.body,
    createdAt: message.createdAt,
    readByMerchantAt: message.readByMerchantAt || null,
    readByFactoryAt: message.readByFactoryAt || null
  };
}

function serializeOrderItem(item: AnyRecord, canViewCost: boolean) {
  return {
    id: item.id,
    variantId: item.variantId,
    sku: item.sku,
    color: item.color || null,
    size: item.size || null,
    plannedQuantity: item.plannedQuantity,
    deliveredQuantity: item.deliveredQuantity,
    acceptedQuantity: item.acceptedQuantity,
    rejectedQuantity: item.rejectedQuantity,
    reworkQuantity: item.reworkQuantity,
    shortageQuantity: item.shortageQuantity,
    remainingQuantity: Math.max(0, item.plannedQuantity - item.acceptedQuantity),
    ...(canViewCost ? { unitPrice: num(item.unitPrice), amount: roundMoney(num(item.unitPrice) * item.plannedQuantity) } : {})
  };
}


function serializeOrder(order: AnyRecord, canViewCost: boolean) {
  const items = (Array.isArray(order.items) ? order.items : []).map((item: AnyRecord) => serializeOrderItem(item, canViewCost));
  return {
    id: order.id,
    orderNo: order.orderNo,
    status: order.status,
    currency: order.currency,
    plannedQuantity: order.plannedQuantity,
    deliveredQuantity: items.reduce((sum: number, item: AnyRecord) => sum + item.deliveredQuantity, 0),
    acceptedQuantity: items.reduce((sum: number, item: AnyRecord) => sum + item.acceptedQuantity, 0),
    rejectedQuantity: items.reduce((sum: number, item: AnyRecord) => sum + item.rejectedQuantity, 0),
    reworkQuantity: items.reduce((sum: number, item: AnyRecord) => sum + item.reworkQuantity, 0),
    shortageQuantity: items.reduce((sum: number, item: AnyRecord) => sum + item.shortageQuantity, 0),
    remainingQuantity: items.reduce((sum: number, item: AnyRecord) => sum + item.remainingQuantity, 0),
    pickupDate: order.pickupDate || null,
    dueDate: order.dueDate || null,
    notes: order.notes || null,
    acceptedAt: order.acceptedAt || null,
    completedAt: order.completedAt || null,
    cancelledAt: order.cancelledAt || null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    factory: order.factory ? { id: order.factory.id, name: order.factory.name, status: order.factory.status } : null,
    product: order.product
      ? { id: order.product.id, styleNo: order.product.styleNo || null, name: order.product.name, image: firstImage(order.product.media) }
      : null,
    items,
    ...(canViewCost ? { unitPrice: num(order.unitPrice), plannedAmount: num(order.plannedAmount) } : {})
  };
}

function serializeDelivery(delivery: AnyRecord) {
  const items = (Array.isArray(delivery.items) ? delivery.items : []).map((item: AnyRecord) => ({
    id: item.id,
    orderItemId: item.orderItemId,
    sku: item.orderItem?.sku || '',
    color: item.orderItem?.color || null,
    size: item.orderItem?.size || null,
    declaredQuantity: item.declaredQuantity,
    receivedQuantity: item.receivedQuantity,
    acceptedQuantity: item.acceptedQuantity,
    rejectedQuantity: item.rejectedQuantity,
    reworkQuantity: item.reworkQuantity,
    shortageQuantity: item.shortageQuantity
  }));
  return {
    id: delivery.id,
    deliveryNo: delivery.deliveryNo,
    status: delivery.status,
    note: delivery.note || null,
    submittedAt: delivery.submittedAt,
    inspectedAt: delivery.inspectedAt || null,
    items
  };
}

function serializePickup(pickup: AnyRecord) {
  return {
    id: pickup.id,
    pickupNo: pickup.pickupNo,
    pickupDate: pickup.pickupDate,
    pieces: pickup.pieces,
    packages: pickup.packages,
    receivedPieces: pickup.receivedPieces === null || pickup.receivedPieces === undefined ? null : pickup.receivedPieces,
    difference: pickup.difference,
    note: pickup.note || null,
    status: pickup.status,
    factoryConfirmedAt: pickup.factoryConfirmedAt || null,
    createdAt: pickup.createdAt
  };
}


function serializeStatement(statement: AnyRecord, canViewCost: boolean) {
  const lines = (Array.isArray(statement.lines) ? statement.lines : []).map((line: AnyRecord) => {
    let breakdown: AnyRecord[] = [];
    if (typeof line.breakdown === 'string') {
      try {
        const parsed: unknown = JSON.parse(line.breakdown);
        if (Array.isArray(parsed)) breakdown = parsed as AnyRecord[];
      } catch {
        breakdown = [];
      }
    }
    return {
      id: line.id,
      orderId: line.orderId,
      orderNo: line.orderNo,
      styleNo: line.styleNo || null,
      productName: line.productName,
      quantity: line.quantity,
      sortOrder: line.sortOrder,
      breakdown: breakdown.map(entry => ({ sku: entry.sku, color: entry.color || null, size: entry.size || null, quantity: entry.quantity })),
      ...(canViewCost ? { amount: num(line.amount) } : {})
    };
  });
  const payments = (Array.isArray(statement.payments) ? statement.payments : []).map((payment: AnyRecord) => ({
    id: payment.id,
    paidAt: payment.paidAt,
    method: payment.method || null,
    reference: payment.reference || null,
    note: payment.note || null,
    ...(canViewCost ? { amount: num(payment.amount), currency: payment.currency } : {})
  }));
  const adjustments = (Array.isArray(statement.adjustments) ? statement.adjustments : []).map((adjustment: AnyRecord) => ({
    id: adjustment.id,
    reason: adjustment.reason,
    createdBySide: adjustment.createdBySide,
    createdAt: adjustment.createdAt,
    ...(canViewCost ? { amount: num(adjustment.amount) } : {})
  }));
  return {
    id: statement.id,
    statementNo: statement.statementNo,
    factoryId: statement.factoryId,
    factory: statement.factory ? { id: statement.factory.id, name: statement.factory.name } : null,
    periodMonth: statement.periodMonth,
    version: statement.version,
    status: statement.status,
    disputeReason: statement.disputeReason || null,
    note: statement.note || null,
    merchantConfirmedAt: statement.merchantConfirmedAt || null,
    factoryConfirmedAt: statement.factoryConfirmedAt || null,
    confirmedAt: statement.confirmedAt || null,
    createdAt: statement.createdAt,
    updatedAt: statement.updatedAt,
    lines,
    adjustments,
    payments,
    ...(canViewCost ? {
      currency: statement.currency,
      openingBalance: num(statement.openingBalance),
      laborAmount: num(statement.laborAmount),
      adjustmentAmount: num(statement.adjustmentAmount),
      totalAmount: num(statement.totalAmount),
      paidAmount: num(statement.paidAmount),
      closingBalance: num(statement.closingBalance)
    } : {})
  };
}

const orderInclude = {
  factory: { select: { id: true, name: true, status: true } },
  product: { select: { id: true, name: true, styleNo: true, media: true } },
  items: { orderBy: { sku: 'asc' } }
} as const;

const statementInclude = {
  factory: { select: { id: true, name: true } },
  lines: { orderBy: { sortOrder: 'asc' } },
  adjustments: { orderBy: { createdAt: 'asc' } },
  payments: { orderBy: { paidAt: 'asc' } }
} as const;


export function registerProductionChainRoutes(app: Express, deps: ProductionChainDeps): void {
  const prisma = deps.prisma;
  const appGuard: RequestHandler[] = [
    ...(Array.isArray(deps.merchantAuth) ? deps.merchantAuth : [deps.merchantAuth]),
    deps.requireAppInstalled
  ];
  const viewGuard: RequestHandler[] = [...appGuard, deps.employeePermission('production.view')];
  const manageGuard: RequestHandler[] = [...appGuard, deps.employeePermission('production.manage')];
  const factoryGuard: RequestHandler[] = [resolveFactorySession(deps)];

  const merchantIdOf = (req: Request): string => String((req as AnyRecord).merchant?.merchantId || '');
  const employeeIdOf = (req: Request): string | undefined => {
    const value = (req as AnyRecord).merchant?.employeeId;
    return typeof value === 'string' ? value : undefined;
  };
  const factoryOf = (req: Request): AnyRecord => (req as AnyRecord).factory || {};
  const audit = async (req: Request, action: string, entityId: string, metadata?: Record<string, unknown>) => {
    try {
      await deps.logEmployeeAudit(merchantIdOf(req), employeeIdOf(req), action, 'production', entityId, req, metadata);
    } catch {
      // 审计失败不回滚业务，由统一审计日志自行告警。
    }
  };

  // GET /api/production/catalog — 商品与工厂
  app.get('/api/production/catalog', ...viewGuard, async (req, res) => {
    try {
      const merchantId = merchantIdOf(req);
      const canViewCost = await merchantCanViewCost(deps, req);
      const [products, factories] = await Promise.all([
        prisma.product.findMany({
          where: { merchantId },
          orderBy: { updatedAt: 'desc' },
          take: 200,
          select: {
            id: true,
            name: true,
            styleNo: true,
            media: true,
            variants: {
              where: { isActive: true },
              orderBy: [{ color: 'asc' }, { size: 'asc' }],
              select: { id: true, sku: true, color: true, size: true }
            }
          }
        }),
        prisma.productionFactory.findMany({
          where: { merchantId },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            status: true,
            contactName: true,
            phone: true,
            email: true,
            settlementTerms: true,
            inviteExpiresAt: true,
            inviteAcceptedAt: true
          }
        })
      ]);
      res.json({
        success: true,
        products: products.map(product => ({
          id: product.id,
          name: product.name,
          styleNo: product.styleNo || null,
          image: firstImage(product.media),
          variants: product.variants
        })),
        factories: factories.map(factory => ({
          ...factory,
          ...(canViewCost ? {} : { settlementTerms: null })
        }))
      });
    } catch (error) {
      deps.sendInternalError(res, error, 'production-catalog');
    }
  });


  // GET /api/production/summary — 首页汇总
  app.get('/api/production/summary', ...viewGuard, async (req, res) => {
    try {
      const merchantId = merchantIdOf(req);
      const canViewCost = await merchantCanViewCost(deps, req);
      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      const [orders, statements, payments, pendingDelivery] = await Promise.all([
        prisma.productionOrder.findMany({
          where: { merchantId },
          select: { id: true, status: true, plannedQuantity: true }
        }),
        prisma.productionStatement.findMany({
          where: { merchantId, status: { not: 'superseded' } },
          orderBy: [{ periodMonth: 'desc' }, { version: 'desc' }],
          select: {
            id: true,
            factoryId: true,
            status: true,
            periodMonth: true,
            totalAmount: true,
            closingBalance: true
          }
        }),
        prisma.productionPayment.findMany({
          where: { merchantId, paidAt: { gte: monthStart, lt: monthEnd } },
          select: { amount: true }
        }),
        prisma.productionDelivery.count({ where: { merchantId, status: 'submitted' } })
      ]);
      const latestByFactory = new Map<string, AnyRecord>();
      for (const statement of statements) {
        if (!latestByFactory.has(statement.factoryId)) latestByFactory.set(statement.factoryId, statement);
      }
      const outstanding = Array.from(latestByFactory.values())
        .filter(statement => statement.status === 'confirmed' || statement.status === 'pending_factory')
        .reduce((sum, statement) => sum + num(statement.closingBalance), 0);
      res.json({
        success: true,
        summary: {
          openOrders: orders.filter(order => isOpenProductionOrderStatus(order.status)).length,
          pendingFactory: orders.filter(order => order.status === 'pending_factory').length,
          inProduction: orders.filter(order => order.status === 'in_production' || order.status === 'accepted').length,
          pendingInspection: pendingDelivery,
          pendingStatements: statements.filter(statement => statement.status === 'pending_factory').length,
          completedOrders: orders.filter(order => order.status === 'completed').length,
          plannedQuantity: orders.reduce((sum, order) => sum + order.plannedQuantity, 0),
          monthPaid: canViewCost ? roundMoney(payments.reduce((sum, payment) => sum + num(payment.amount), 0)) : null,
          monthLabor: canViewCost
            ? roundMoney(statements
              .filter(statement => statement.periodMonth === now.toISOString().slice(0, 7))
              .reduce((sum, statement) => sum + num(statement.totalAmount), 0))
            : null,
          outstanding: canViewCost ? roundMoney(outstanding) : null,
          currency: 'EUR'
        }
      });
    } catch (error) {
      deps.sendInternalError(res, error, 'production-summary');
    }
  });

  // GET /api/production/factories — 加工厂列表
  app.get('/api/production/factories', ...viewGuard, async (req, res) => {
    try {
      const merchantId = merchantIdOf(req);
      const factories = await prisma.productionFactory.findMany({
        where: { merchantId },
        orderBy: { createdAt: 'desc' },
        include: {
          members: { select: { id: true, name: true, email: true, role: true, active: true, lastLoginAt: true } },
          _count: { select: { orders: true } }
        }
      });
      res.json({
        success: true,
        factories: factories.map(factory => ({
          id: factory.id,
          name: factory.name,
          status: factory.status,
          contactName: factory.contactName || null,
          phone: factory.phone || null,
          email: factory.email || null,
          address: factory.address || null,
          settlementTerms: factory.settlementTerms || null,
          inviteExpiresAt: factory.inviteExpiresAt || null,
          inviteAcceptedAt: factory.inviteAcceptedAt || null,
          orderCount: factory._count.orders,
          members: factory.members
        }))
      });
    } catch (error) {
      deps.sendInternalError(res, error, 'production-factories');
    }
  });


  // POST /api/production/factories — 新建加工厂并签发一次性邀请
  app.post('/api/production/factories', ...manageGuard, async (req, res) => {
    try {
      const merchantId = merchantIdOf(req);
      const name = text(req.body?.name, 120);
      if (!name) return fail(res, 400, 'PRODUCTION_INPUT_INVALID');
      const token = createProductionInviteToken();
      const factory = await prisma.productionFactory.create({
        data: {
          merchantId,
          name,
          contactName: text(req.body?.contactName, 80),
          phone: text(req.body?.phone, 40),
          email: text(req.body?.email, 160),
          address: text(req.body?.address, 400),
          settlementTerms: text(req.body?.settlementTerms, 200),
          status: 'invited',
          inviteTokenHash: hashProductionInviteToken(token),
          inviteExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        }
      });
      await audit(req, 'production.factory.create', factory.id, { name });
      res.status(201).json({
        success: true,
        factory: { id: factory.id, name: factory.name, status: factory.status, inviteExpiresAt: factory.inviteExpiresAt },
        inviteToken: token,
        invitePath: `/merchant/factory?invite=${encodeURIComponent(token)}`
      });
    } catch (error) {
      if ((error as AnyRecord)?.code === 'P2002') return fail(res, 409, 'PRODUCTION_FACTORY_EXISTS');
      deps.sendInternalError(res, error, 'production-factory-create');
    }
  });

  // POST /api/production/factories/:id/invite — 轮换邀请链接
  app.post('/api/production/factories/:id/invite', ...manageGuard, async (req, res) => {
    try {
      const merchantId = merchantIdOf(req);
      const factory = await prisma.productionFactory.findFirst({ where: { id: req.params.id, merchantId } });
      if (!factory) return fail(res, 404, 'PRODUCTION_FACTORY_NOT_FOUND');
      const token = createProductionInviteToken();
      const updated = await prisma.productionFactory.update({
        where: { id: factory.id },
        data: {
          inviteTokenHash: hashProductionInviteToken(token),
          inviteExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          status: factory.status === 'active' ? 'active' : 'invited'
        }
      });
      await audit(req, 'production.factory.invite', factory.id);
      res.json({
        success: true,
        factory: { id: updated.id, name: updated.name, status: updated.status, inviteExpiresAt: updated.inviteExpiresAt },
        inviteToken: token,
        invitePath: `/merchant/factory?invite=${encodeURIComponent(token)}`
      });
    } catch (error) {
      deps.sendInternalError(res, error, 'production-factory-invite');
    }
  });

  // POST /api/production/factories/:id/revoke — 暂停/恢复工厂访问
  app.post('/api/production/factories/:id/revoke', ...manageGuard, async (req, res) => {
    try {
      const merchantId = merchantIdOf(req);
      const factory = await prisma.productionFactory.findFirst({ where: { id: req.params.id, merchantId } });
      if (!factory) return fail(res, 404, 'PRODUCTION_FACTORY_NOT_FOUND');
      const nextStatus = factory.status === 'suspended' ? 'active' : 'suspended';
      const updated = await prisma.productionFactory.update({
        where: { id: factory.id },
        data: { status: nextStatus, version: { increment: 1 } }
      });
      await audit(req, 'production.factory.revoke', factory.id, { status: nextStatus });
      res.json({ success: true, factory: { id: updated.id, name: updated.name, status: updated.status } });
    } catch (error) {
      deps.sendInternalError(res, error, 'production-factory-revoke');
    }
  });


  // POST /api/production/factory/accept-invite — 工厂接受邀请并设置登录
  app.post('/api/production/factory/accept-invite', async (req, res) => {
    try {
      const token = text(req.body?.token, 200);
      const name = text(req.body?.name, 80);
      const email = text(req.body?.email, 160)?.toLowerCase() || null;
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (!token || !name || !email || password.length < 8) return fail(res, 400, 'PRODUCTION_INPUT_INVALID');
      const factory = await prisma.productionFactory.findUnique({
        where: { inviteTokenHash: hashProductionInviteToken(token) },
        select: { id: true, name: true, status: true, merchantId: true, inviteExpiresAt: true }
      });
      if (!factory) return fail(res, 404, 'PRODUCTION_FACTORY_INVITE_INVALID');
      if (factory.status === 'suspended') return fail(res, 403, 'PRODUCTION_FACTORY_ACCESS_REVOKED');
      if (factory.inviteExpiresAt && factory.inviteExpiresAt.getTime() < Date.now()) {
        return fail(res, 410, 'PRODUCTION_FACTORY_INVITE_EXPIRED');
      }
      const existing = await prisma.productionFactoryMember.findFirst({
        where: { factoryId: factory.id, email }
      });
      if (existing) return fail(res, 409, 'PRODUCTION_FACTORY_MEMBER_EXISTS');
      const member = await prisma.productionFactoryMember.create({
        data: {
          factoryId: factory.id,
          name,
          email,
          passwordHash: await bcrypt.hash(password, 10),
          role: 'owner'
        }
      });
      await prisma.productionFactory.update({
        where: { id: factory.id },
        data: {
          status: 'active',
          inviteAcceptedAt: new Date(),
          inviteTokenHash: null,
          inviteExpiresAt: null,
          email,
          contactName: name
        }
      });
      res.status(201).json({
        success: true,
        token: signFactoryToken(deps, member, factory.merchantId),
        factory: { id: factory.id, name: factory.name, status: 'active' },
        member: { id: member.id, name: member.name, email: member.email, role: member.role }
      });
    } catch (error) {
      deps.sendInternalError(res, error, 'production-factory-accept-invite');
    }
  });

  // POST /api/production/factory/login — 工厂工作区登录
  app.post('/api/production/factory/login', async (req, res) => {
    try {
      const email = text(req.body?.email, 160)?.toLowerCase();
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      const factoryId = text(req.body?.factoryId, 80);
      if (!email || !password) return fail(res, 400, 'PRODUCTION_INPUT_INVALID');
      const members = await prisma.productionFactoryMember.findMany({
        where: { email, active: true, ...(factoryId ? { factoryId } : {}) },
        include: { factory: { select: { id: true, name: true, status: true, merchantId: true } } }
      });
      const matched: typeof members = [];
      for (const member of members) {
        if (await bcrypt.compare(password, member.passwordHash)) matched.push(member);
      }
      if (matched.length === 0) return fail(res, 401, 'PRODUCTION_FACTORY_AUTH_INVALID');
      if (matched.length > 1) return fail(res, 409, 'PRODUCTION_FACTORY_LOGIN_AMBIGUOUS');
      const member = matched[0];
      if (member.factory.status !== 'active') return fail(res, 403, 'PRODUCTION_FACTORY_ACCESS_REVOKED');
      await prisma.productionFactoryMember.update({ where: { id: member.id }, data: { lastLoginAt: new Date() } });
      res.json({
        success: true,
        token: signFactoryToken(deps, member, member.factory.merchantId),
        factory: { id: member.factory.id, name: member.factory.name, status: member.factory.status },
        member: { id: member.id, name: member.name, email: member.email, role: member.role }
      });
    } catch (error) {
      deps.sendInternalError(res, error, 'production-factory-login');
    }
  });

  // GET /api/production/factory/me — 工厂会话信息
  app.get('/api/production/factory/me', ...factoryGuard, async (req, res) => {
    const factory = factoryOf(req);
    res.json({
      success: true,
      factory: { id: factory.factoryId, name: factory.factoryName, status: 'active' },
      member: { id: factory.factoryMemberId, name: factory.memberName, role: factory.role }
    });
  });


  // GET /api/production/orders — 加工单列表
  app.get('/api/production/orders', ...viewGuard, async (req, res) => {
    try {
      const merchantId = merchantIdOf(req);
      const canViewCost = await merchantCanViewCost(deps, req);
      const status = text(req.query.status, 40);
      const factoryId = text(req.query.factoryId, 80);
      const q = text(req.query.q, 80);
      const orders = await prisma.productionOrder.findMany({
        where: {
          merchantId,
          ...(status ? { status } : {}),
          ...(factoryId ? { factoryId } : {}),
          ...(q ? { OR: [{ orderNo: { contains: q, mode: 'insensitive' } }, { product: { name: { contains: q, mode: 'insensitive' } } }] } : {})
        },
        orderBy: [{ createdAt: 'desc' }],
        take: 200,
        include: orderInclude
      });
      res.json({ success: true, orders: orders.map(order => serializeOrder(order, canViewCost)) });
    } catch (error) {
      deps.sendInternalError(res, error, 'production-orders');
    }
  });

  // POST /api/production/orders — 新建加工单（直接外发或先存草稿）
  app.post('/api/production/orders', ...manageGuard, async (req, res) => {
    try {
      const merchantId = merchantIdOf(req);
      const factoryId = text(req.body?.factoryId, 80);
      const productId = text(req.body?.productId, 80);
      const items = normalizeProductionItems(req.body?.items);
      const unitPrice = Number(req.body?.unitPrice ?? 0);
      if (!factoryId || !productId || !items || !Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 1_000_000) {
        return fail(res, 400, 'PRODUCTION_INPUT_INVALID');
      }
      const pickupDate = parseOptionalDate(req.body?.pickupDate);
      const dueDate = parseOptionalDate(req.body?.dueDate);
      if (pickupDate === 'invalid' || dueDate === 'invalid') return fail(res, 400, 'PRODUCTION_INPUT_INVALID');
      const send = req.body?.send === true;
      const [factory, product] = await Promise.all([
        prisma.productionFactory.findFirst({ where: { id: factoryId, merchantId } }),
        prisma.product.findFirst({ where: { id: productId, merchantId }, select: { id: true, name: true } })
      ]);
      if (!factory || factory.status === 'suspended') return fail(res, 404, 'PRODUCTION_FACTORY_NOT_FOUND');
      if (!product) return fail(res, 404, 'PRODUCTION_PRODUCT_NOT_FOUND');
      const variants = await prisma.productVariant.findMany({
        where: { id: { in: items.map(item => item.variantId) }, productId },
        select: { id: true, sku: true, color: true, size: true }
      });
      if (variants.length !== items.length) return fail(res, 400, 'PRODUCTION_VARIANT_INVALID');
      const variantById = new Map(variants.map(variant => [variant.id, variant]));
      const totals = computeProductionTotals(items, unitPrice);
      const order = await prisma.productionOrder.create({
        data: {
          orderNo: productionSequenceNo('PO'),
          merchantId,
          factoryId,
          productId,
          status: send ? 'pending_factory' : 'draft',
          currency: 'EUR',
          plannedQuantity: totals.plannedQuantity,
          plannedAmount: totals.plannedAmount,
          unitPrice,
          pickupDate: pickupDate as Date | null,
          dueDate: dueDate as Date | null,
          notes: text(req.body?.notes, 1000),
          createdBy: employeeIdOf(req) || null,
          items: {
            create: items.map(item => {
              const variant = variantById.get(item.variantId)!;
              return {
                variantId: item.variantId,
                sku: variant.sku,
                color: variant.color,
                size: variant.size,
                plannedQuantity: item.quantity,
                unitPrice: item.unitPrice === undefined ? unitPrice : item.unitPrice
              };
            })
          },
          events: {
            create: {
              merchantId,
              type: send ? 'order_sent' : 'order_created',
              actorType: 'merchant',
              actorId: employeeIdOf(req) || null,
              toStatus: send ? 'pending_factory' : 'draft'
            }
          }
        },
        include: orderInclude
      });
      await audit(req, 'production.order.create', order.id, { orderNo: order.orderNo, send });
      deps.publishMerchantSync?.(merchantId, ['production']);
      res.status(201).json({ success: true, order: serializeOrder(order, true) });
    } catch (error) {
      deps.sendInternalError(res, error, 'production-order-create');
    }
  });


  // GET /api/production/orders/:id — 加工单详情
  app.get('/api/production/orders/:id', ...viewGuard, async (req, res) => {
    try {
      const merchantId = merchantIdOf(req);
      const canViewCost = await merchantCanViewCost(deps, req);
      const order = await prisma.productionOrder.findFirst({
        where: { id: req.params.id, merchantId },
        include: {
          ...orderInclude,
          pickups: { orderBy: { pickupDate: 'desc' } },
          deliveries: {
            orderBy: { submittedAt: 'desc' },
            include: { items: { include: { orderItem: { select: { sku: true, color: true, size: true } } } } }
          },
          events: { orderBy: { createdAt: 'desc' }, take: 100 }
        }
      });
      if (!order) return fail(res, 404, 'PRODUCTION_ORDER_NOT_FOUND');
      const messages = await prisma.productionMessage.findMany({
        where: { merchantId, scopeType: 'order', scopeId: order.id },
        orderBy: { createdAt: 'asc' },
        take: 200
      });
      res.json({
        success: true,
        order: serializeOrder(order, canViewCost),
        pickups: order.pickups.map(serializePickup),
        deliveries: order.deliveries.map(serializeDelivery),
        events: order.events.map(event => ({
          id: event.id,
          type: event.type,
          actorType: event.actorType,
          fromStatus: event.fromStatus || null,
          toStatus: event.toStatus || null,
          createdAt: event.createdAt
        })),
        messages: messages.map(serializeMessage)
      });
    } catch (error) {
      deps.sendInternalError(res, error, 'production-order-detail');
    }
  });

  // PUT /api/production/orders/:id — 仅草稿可调整数量、交期与备注
  app.put('/api/production/orders/:id', ...manageGuard, async (req, res) => {
    try {
      const merchantId = merchantIdOf(req);
      const order = await prisma.productionOrder.findFirst({
        where: { id: req.params.id, merchantId }
      });
      if (!order) return fail(res, 404, 'PRODUCTION_ORDER_NOT_FOUND');
      if (order.status !== 'draft') return fail(res, 409, 'PRODUCTION_ORDER_NOT_EDITABLE');
      const items = normalizeProductionItems(req.body?.items);
      const unitPrice = req.body?.unitPrice === undefined ? num(order.unitPrice) : Number(req.body.unitPrice);
      if (!items || !Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 1_000_000) {
        return fail(res, 400, 'PRODUCTION_INPUT_INVALID');
      }
      const pickupDate = parseOptionalDate(req.body?.pickupDate);
      const dueDate = parseOptionalDate(req.body?.dueDate);
      if (pickupDate === 'invalid' || dueDate === 'invalid') return fail(res, 400, 'PRODUCTION_INPUT_INVALID');
      const variants = await prisma.productVariant.findMany({
        where: { id: { in: items.map(item => item.variantId) }, productId: order.productId },
        select: { id: true, sku: true, color: true, size: true }
      });
      if (variants.length !== items.length) return fail(res, 400, 'PRODUCTION_VARIANT_INVALID');
      const variantById = new Map(variants.map(variant => [variant.id, variant]));
      const totals = computeProductionTotals(items, unitPrice);
      const updated = await prisma.$transaction(async tx => {
        const guard = await tx.productionOrder.updateMany({
          where: { id: order.id, merchantId, status: 'draft' },
          data: {
            plannedQuantity: totals.plannedQuantity,
            plannedAmount: totals.plannedAmount,
            unitPrice,
            pickupDate: pickupDate as Date | null,
            dueDate: dueDate as Date | null,
            notes: text(req.body?.notes, 1000),
            version: { increment: 1 }
          }
        });
        if (guard.count === 0) return null;
        await tx.productionOrderItem.deleteMany({ where: { orderId: order.id } });
        await tx.productionOrderItem.createMany({
          data: items.map(item => {
            const variant = variantById.get(item.variantId)!;
            return {
              orderId: order.id,
              variantId: item.variantId,
              sku: variant.sku,
              color: variant.color,
              size: variant.size,
              plannedQuantity: item.quantity,
              unitPrice: item.unitPrice === undefined ? unitPrice : item.unitPrice
            };
          })
        });
        return tx.productionOrder.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
      });
      if (!updated) return fail(res, 409, 'PRODUCTION_ORDER_NOT_EDITABLE');
      await audit(req, 'production.order.update', order.id);
      res.json({ success: true, order: serializeOrder(updated, await merchantCanViewCost(deps, req)) });
    } catch (error) {
      deps.sendInternalError(res, error, 'production-order-update');
    }
  });


  // POST /api/production/orders/:id/submit — 草稿外发给工厂
  app.post('/api/production/orders/:id/submit', ...manageGuard, async (req, res) => {
    try {
      const merchantId = merchantIdOf(req);
      const order = await prisma.productionOrder.findFirst({
        where: { id: req.params.id, merchantId },
        include: { factory: { select: { status: true } } }
      });
      if (!order) return fail(res, 404, 'PRODUCTION_ORDER_NOT_FOUND');
      if (order.status !== 'draft') return fail(res, 409, 'PRODUCTION_ORDER_NOT_EDITABLE');
      if (order.factory.status !== 'active') return fail(res, 409, 'PRODUCTION_FACTORY_NOT_ACTIVE');
      const result = await prisma.$transaction(async tx => {
        const guard = await tx.productionOrder.updateMany({
          where: { id: order.id, merchantId, status: 'draft' },
          data: { status: 'pending_factory', version: { increment: 1 } }
        });
        if (guard.count === 0) return null;
        await tx.productionOrderEvent.create({
          data: {
            orderId: order.id,
            merchantId,
            type: 'order_sent',
            actorType: 'merchant',
            actorId: employeeIdOf(req) || null,
            fromStatus: 'draft',
            toStatus: 'pending_factory'
          }
        });
        return tx.productionOrder.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
      });
      if (!result) return fail(res, 409, 'PRODUCTION_ORDER_NOT_EDITABLE');
      await audit(req, 'production.order.submit', order.id);
      deps.publishMerchantSync?.(merchantId, ['production']);
      res.json({ success: true, order: serializeOrder(result, true) });
    } catch (error) {
      deps.sendInternalError(res, error, 'production-order-submit');
    }
  });

  // POST /api/production/orders/:id/cancel — 取消加工单
  app.post('/api/production/orders/:id/cancel', ...manageGuard, async (req, res) => {
    try {
      const merchantId = merchantIdOf(req);
      const order = await prisma.productionOrder.findFirst({ where: { id: req.params.id, merchantId } });
      if (!order) return fail(res, 404, 'PRODUCTION_ORDER_NOT_FOUND');
      if (!['draft', 'pending_factory', 'accepted', 'in_production'].includes(order.status)) {
        return fail(res, 409, 'PRODUCTION_ORDER_NOT_CANCELLABLE');
      }
      const reason = text(req.body?.reason, 500);
      const result = await prisma.$transaction(async tx => {
        const guard = await tx.productionOrder.updateMany({
          where: { id: order.id, merchantId, status: order.status },
          data: { status: 'cancelled', cancelledAt: new Date(), version: { increment: 1 } }
        });
        if (guard.count === 0) return false;
        await tx.productionOrderEvent.create({
          data: {
            orderId: order.id,
            merchantId,
            type: 'order_cancelled',
            actorType: 'merchant',
            actorId: employeeIdOf(req) || null,
            fromStatus: order.status,
            toStatus: 'cancelled',
            payload: reason ? JSON.stringify({ reason }) : null
          }
        });
        return true;
      });
      if (!result) return fail(res, 409, 'PRODUCTION_ORDER_CONFLICT');
      await audit(req, 'production.order.cancel', order.id, { reason });
      deps.publishMerchantSync?.(merchantId, ['production']);
      res.json({ success: true });
    } catch (error) {
      deps.sendInternalError(res, error, 'production-order-cancel');
    }
  });

  // POST /api/production/orders/:id/pickups — 商家登记取货，工厂确认实收
  app.post('/api/production/orders/:id/pickups', ...manageGuard, async (req, res) => {
    try {
      const merchantId = merchantIdOf(req);
      const order = await prisma.productionOrder.findFirst({
        where: { id: req.params.id, merchantId },
        select: { id: true, factoryId: true, status: true }
      });
      if (!order) return fail(res, 404, 'PRODUCTION_ORDER_NOT_FOUND');
      if (!isOpenProductionOrderStatus(order.status)) return fail(res, 409, 'PRODUCTION_ORDER_NOT_OPEN');
      const pickupDate = parseRequiredDate(req.body?.pickupDate);
      const pieces = Number(req.body?.pieces);
      const packages = req.body?.packages === undefined ? 0 : Number(req.body.packages);
      if (!pickupDate || !Number.isInteger(pieces) || pieces < 1 || pieces > 1_000_000
        || !Number.isInteger(packages) || packages < 0 || packages > 100_000) {
        return fail(res, 400, 'PRODUCTION_INPUT_INVALID');
      }
      const pickup = await prisma.productionPickup.create({
        data: {
          pickupNo: productionSequenceNo('PK'),
          orderId: order.id,
          merchantId,
          factoryId: order.factoryId,
          pickupDate,
          pieces,
          packages,
          note: text(req.body?.note, 500),
          status: 'pending',
          createdBy: employeeIdOf(req) || null
        }
      });
      await audit(req, 'production.pickup.create', pickup.id, { pieces });
      res.status(201).json({ success: true, pickup: serializePickup(pickup) });
    } catch (error) {
      deps.sendInternalError(res, error, 'production-pickup-create');
    }
  });


  // GET /api/production/deliveries — 待验收/已验收送货单
  app.get('/api/production/deliveries', ...viewGuard, async (req, res) => {
    try {
      const merchantId = merchantIdOf(req);
      const status = text(req.query.status, 40);
      const deliveries = await prisma.productionDelivery.findMany({
        where: { merchantId, ...(status ? { status } : {}) },
        orderBy: { submittedAt: 'desc' },
        take: 200,
        include: {
          order: { select: { id: true, orderNo: true, product: { select: { name: true } } } },
          factory: { select: { id: true, name: true } },
          items: { include: { orderItem: { select: { sku: true, color: true, size: true } } } }
        }
      });
      res.json({
        success: true,
        deliveries: deliveries.map(delivery => ({
          ...serializeDelivery(delivery),
          order: delivery.order
            ? { id: delivery.order.id, orderNo: delivery.order.orderNo, productName: delivery.order.product?.name || '' }
            : null,
          factory: delivery.factory ? { id: delivery.factory.id, name: delivery.factory.name } : null
        }))
      });
    } catch (error) {
      deps.sendInternalError(res, error, 'production-deliveries');
    }
  });


  // POST /api/production/orders/:orderId/deliveries/:deliveryId/inspect — 商家一次性验收
  app.post('/api/production/orders/:orderId/deliveries/:deliveryId/inspect', ...manageGuard, async (req, res) => {
    try {
      const merchantId = merchantIdOf(req);
      const delivery = await prisma.productionDelivery.findFirst({
        where: { id: req.params.deliveryId, orderId: req.params.orderId, merchantId },
        include: { items: true }
      });
      if (!delivery) return fail(res, 404, 'PRODUCTION_DELIVERY_NOT_FOUND');
      if (delivery.status !== 'submitted') return fail(res, 409, 'PRODUCTION_DELIVERY_ALREADY_INSPECTED');
      const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
      if (rawItems.length !== delivery.items.length) return fail(res, 400, 'PRODUCTION_INPUT_INVALID');
      const lines: { itemId: string; received: number; accepted: number; rejected: number; rework: number; shortage: number }[] = [];
      const seen = new Set<string>();
      for (const raw of rawItems) {
        if (!raw || typeof raw !== 'object') return fail(res, 400, 'PRODUCTION_INPUT_INVALID');
        const record = raw as AnyRecord;
        const itemId = typeof record.deliveryItemId === 'string' ? record.deliveryItemId : '';
        const item = delivery.items.find(candidate => candidate.id === itemId);
        if (!item || seen.has(itemId)) return fail(res, 400, 'PRODUCTION_INPUT_INVALID');
        seen.add(itemId);
        const line = normalizeInspectionLine({
          declaredQuantity: item.declaredQuantity,
          receivedQuantity: Number(record.receivedQuantity),
          acceptedQuantity: Number(record.acceptedQuantity),
          rejectedQuantity: Number(record.rejectedQuantity),
          reworkQuantity: record.reworkQuantity === undefined ? 0 : Number(record.reworkQuantity)
        });
        if (!line) return fail(res, 400, 'PRODUCTION_INSPECTION_INVALID');
        lines.push({
          itemId,
          received: line.receivedQuantity,
          accepted: line.acceptedQuantity,
          rejected: line.rejectedQuantity,
          rework: line.reworkQuantity,
          shortage: computeDeliveryShortage(item.declaredQuantity, line.receivedQuantity)
        });
      }
      const note = text(req.body?.note, 1000);
      const result = await prisma.$transaction(async tx => {
        const guard = await tx.productionDelivery.updateMany({
          where: { id: delivery.id, merchantId, status: 'submitted' },
          data: { status: 'inspected', inspectedAt: new Date(), inspectedBy: employeeIdOf(req) || null, note }
        });
        if (guard.count === 0) return null;
        for (const line of lines) {
          await tx.productionDeliveryItem.update({
            where: { id: line.itemId },
            data: {
              receivedQuantity: line.received,
              acceptedQuantity: line.accepted,
              rejectedQuantity: line.rejected,
              reworkQuantity: line.rework,
              shortageQuantity: line.shortage
            }
          });
          const deliveryItem = delivery.items.find(item => item.id === line.itemId)!;
          await tx.productionOrderItem.update({
            where: { id: deliveryItem.orderItemId },
            data: {
              deliveredQuantity: { increment: line.received },
              acceptedQuantity: { increment: line.accepted },
              rejectedQuantity: { increment: line.rejected },
              reworkQuantity: { increment: line.rework },
              shortageQuantity: { increment: line.shortage }
            }
          });
        }
        await tx.productionQualityInspection.create({
          data: {
            deliveryId: delivery.id,
            result: lines.some(line => line.rejected > 0) ? 'partial' : 'passed',
            inspector: employeeIdOf(req) || null,
            notes: note
          }
        });
        const items = await tx.productionOrderItem.findMany({ where: { orderId: delivery.orderId } });
        const complete = items.every(item => item.acceptedQuantity >= item.plannedQuantity);
        await tx.productionOrder.update({
          where: { id: delivery.orderId },
          data: {
            status: complete ? 'completed' : undefined,
            completedAt: complete ? new Date() : undefined,
            version: { increment: 1 }
          }
        });
        await tx.productionOrderEvent.create({
          data: {
            orderId: delivery.orderId,
            merchantId,
            type: 'delivery_inspected',
            actorType: 'merchant',
            actorId: employeeIdOf(req) || null,
            toStatus: complete ? 'completed' : undefined,
            payload: JSON.stringify({ deliveryId: delivery.id, accepted: lines.reduce((sum, line) => sum + line.accepted, 0) })
          }
        });
        return tx.productionOrder.findUniqueOrThrow({ where: { id: delivery.orderId }, include: orderInclude });
      });
      if (!result) return fail(res, 409, 'PRODUCTION_DELIVERY_ALREADY_INSPECTED');
      await audit(req, 'production.delivery.inspect', delivery.id, { orderId: delivery.orderId });
      deps.publishMerchantSync?.(merchantId, ['production']);
      res.json({ success: true, order: serializeOrder(result, await merchantCanViewCost(deps, req)) });
    } catch (error) {
      deps.sendInternalError(res, error, 'production-delivery-inspect');
    }
  });


  // GET /api/production/statements — 月度结算列表
  app.get('/api/production/statements', ...viewGuard, async (req, res) => {
    try {
      const merchantId = merchantIdOf(req);
      const canViewCost = await merchantCanViewCost(deps, req);
      const factoryId = text(req.query.factoryId, 80);
      const periodMonth = normalizePeriodMonth(req.query.periodMonth);
      const statements = await prisma.productionStatement.findMany({
        where: {
          merchantId,
          status: { not: 'superseded' },
          ...(factoryId ? { factoryId } : {}),
          ...(periodMonth ? { periodMonth } : {})
        },
        orderBy: [{ periodMonth: 'desc' }, { createdAt: 'desc' }],
        take: 100,
        include: statementInclude
      });
      res.json({ success: true, statements: statements.map(statement => serializeStatement(statement, canViewCost)) });
    } catch (error) {
      deps.sendInternalError(res, error, 'production-statements');
    }
  });

  // GET /api/production/statements/:id — 结算单详情（含留言）
  app.get('/api/production/statements/:id', ...viewGuard, async (req, res) => {
    try {
      const merchantId = merchantIdOf(req);
      const canViewCost = await merchantCanViewCost(deps, req);
      const statement = await prisma.productionStatement.findFirst({
        where: { id: req.params.id, merchantId },
        include: statementInclude
      });
      if (!statement) return fail(res, 404, 'PRODUCTION_STATEMENT_NOT_FOUND');
      const messages = await prisma.productionMessage.findMany({
        where: { merchantId, scopeType: 'statement', scopeId: statement.id },
        orderBy: { createdAt: 'asc' },
        take: 200
      });
      res.json({
        success: true,
        statement: serializeStatement(statement, canViewCost),
        messages: messages.map(serializeMessage)
      });
    } catch (error) {
      deps.sendInternalError(res, error, 'production-statement-detail');
    }
  });


  // POST /api/production/statements — 按工厂 + 月份生成结算草稿
  app.post('/api/production/statements', ...manageGuard, async (req, res) => {
    try {
      const merchantId = merchantIdOf(req);
      const factoryId = text(req.body?.factoryId, 80);
      const periodMonth = normalizePeriodMonth(req.body?.periodMonth);
      if (!factoryId || !periodMonth) return fail(res, 400, 'PRODUCTION_INPUT_INVALID');
      const factory = await prisma.productionFactory.findFirst({ where: { id: factoryId, merchantId } });
      if (!factory) return fail(res, 404, 'PRODUCTION_FACTORY_NOT_FOUND');
      const range = periodMonthRange(periodMonth);
      const latest = await prisma.productionStatement.findFirst({
        where: { merchantId, factoryId, periodMonth },
        orderBy: { version: 'desc' },
        include: { adjustments: true }
      });
      if (latest?.status === 'confirmed') return fail(res, 409, 'PRODUCTION_STATEMENT_CONFIRMED');
      const openingStatement = await prisma.productionStatement.findFirst({
        where: { merchantId, factoryId, status: 'confirmed', periodMonth: { lt: periodMonth } },
        orderBy: [{ periodMonth: 'desc' }, { version: 'desc' }],
        select: { closingBalance: true }
      });
      const openingBalance = num(openingStatement?.closingBalance);
      const billableItems = await prisma.productionDeliveryItem.findMany({
        where: {
          statementId: null,
          acceptedQuantity: { gt: 0 },
          delivery: { merchantId, factoryId, status: 'inspected', inspectedAt: { gte: range.start, lt: range.end } }
        },
        include: {
          orderItem: {
            select: {
              orderId: true,
              sku: true,
              color: true,
              size: true,
              unitPrice: true,
              order: { select: { orderNo: true, product: { select: { name: true, styleNo: true } } } }
            }
          }
        }
      });
      const groups = new Map<string, {
        orderNo: string;
        styleNo: string | null;
        productName: string;
        quantity: number;
        amount: number;
        breakdown: AnyRecord[];
      }>();
      for (const item of billableItems) {
        const orderItem = item.orderItem;
        const group = groups.get(orderItem.orderId) || {
          orderNo: orderItem.order.orderNo,
          styleNo: orderItem.order.product?.styleNo || null,
          productName: orderItem.order.product?.name || '加工商品',
          quantity: 0,
          amount: 0,
          breakdown: []
        };
        group.quantity += item.acceptedQuantity;
        group.amount += item.acceptedQuantity * num(orderItem.unitPrice);
        group.breakdown.push({
          sku: orderItem.sku,
          color: orderItem.color,
          size: orderItem.size,
          quantity: item.acceptedQuantity
        });
        groups.set(orderItem.orderId, group);
      }
      const laborAmount = roundMoney(Array.from(groups.values()).reduce((sum, group) => sum + group.amount, 0));
      const unassignedPayments = await prisma.productionPayment.findMany({
        where: { merchantId, factoryId, statementId: null, paidAt: { lt: range.end } },
        select: { id: true, amount: true }
      });
      const paidAmount = roundMoney(unassignedPayments.reduce((sum, payment) => sum + num(payment.amount), 0));
      const adjustmentAmount = roundMoney((latest?.adjustments || []).reduce((sum, adjustment) => sum + num(adjustment.amount), 0));
      const totals = computeStatementTotals({ openingBalance, laborAmount, adjustmentAmount, paidAmount });
      const version = (latest?.version || 0) + 1;


      const created = await prisma.$transaction(async tx => {
        if (latest && latest.status !== 'draft') {
          const superseded = await tx.productionStatement.updateMany({
            where: { id: latest.id, status: latest.status },
            data: { status: 'superseded' }
          });
          if (superseded.count === 0) throw Object.assign(new Error('statement conflict'), { code: 'CONFLICT' });
          await tx.productionDeliveryItem.updateMany({ where: { statementId: latest.id }, data: { statementId: null } });
          await tx.productionPayment.updateMany({ where: { statementId: latest.id }, data: { statementId: null } });
        }
        let statementId: string;
        if (latest && latest.status === 'draft') {
          statementId = latest.id;
          await tx.productionStatementLine.deleteMany({ where: { statementId } });
          await tx.productionDeliveryItem.updateMany({ where: { statementId }, data: { statementId: null } });
        } else {
          const statement = await tx.productionStatement.create({
            data: {
              statementNo: productionSequenceNo('ST'),
              merchantId,
              factoryId,
              periodMonth,
              version,
              status: 'draft',
              openingBalance,
              laborAmount,
              adjustmentAmount,
              totalAmount: totals.totalAmount,
              paidAmount,
              closingBalance: totals.closingBalance,
              note: text(req.body?.note, 1000),
              createdBy: employeeIdOf(req) || null
            }
          });
          statementId = statement.id;
          if (latest) {
            for (const adjustment of latest.adjustments) {
              await tx.productionStatementAdjustment.create({
                data: {
                  statementId,
                  amount: adjustment.amount,
                  reason: adjustment.reason,
                  createdBySide: adjustment.createdBySide,
                  createdBy: adjustment.createdBy
                }
              });
            }
          }
        }
        if (billableItems.length > 0) {
          const lock = await tx.productionDeliveryItem.updateMany({
            where: { id: { in: billableItems.map(item => item.id) }, statementId: null },
            data: { statementId }
          });
          if (lock.count !== billableItems.length) throw Object.assign(new Error('statement lock conflict'), { code: 'CONFLICT' });
        }
        if (unassignedPayments.length > 0) {
          await tx.productionPayment.updateMany({
            where: { id: { in: unassignedPayments.map(payment => payment.id) }, statementId: null },
            data: { statementId }
          });
        }
        let sortOrder = 0;
        for (const [orderId, group] of groups.entries()) {
          await tx.productionStatementLine.create({
            data: {
              statementId,
              orderId,
              orderNo: group.orderNo,
              styleNo: group.styleNo,
              productName: group.productName,
              quantity: group.quantity,
              amount: roundMoney(group.amount),
              breakdown: JSON.stringify(group.breakdown),
              sortOrder
            }
          });
          sortOrder += 1;
        }
        const assignedPayments = await tx.productionPayment.findMany({ where: { statementId }, select: { amount: true } });
        const actualPaid = roundMoney(assignedPayments.reduce((sum, payment) => sum + num(payment.amount), 0));
        const adjustments = await tx.productionStatementAdjustment.findMany({ where: { statementId }, select: { amount: true } });
        const actualAdjustment = roundMoney(adjustments.reduce((sum, adjustment) => sum + num(adjustment.amount), 0));
        const finalTotals = computeStatementTotals({
          openingBalance,
          laborAmount,
          adjustmentAmount: actualAdjustment,
          paidAmount: actualPaid
        });
        await tx.productionStatement.update({
          where: { id: statementId },
          data: {
            laborAmount,
            adjustmentAmount: actualAdjustment,
            totalAmount: finalTotals.totalAmount,
            paidAmount: actualPaid,
            closingBalance: finalTotals.closingBalance
          }
        });
        return tx.productionStatement.findUniqueOrThrow({ where: { id: statementId }, include: statementInclude });
      });
      await audit(req, 'production.statement.generate', created.id, { factoryId, periodMonth, version });
      deps.publishMerchantSync?.(merchantId, ['production']);
      res.status(201).json({ success: true, statement: serializeStatement(created, true) });
    } catch (error) {
      if ((error as AnyRecord)?.code === 'CONFLICT') return fail(res, 409, 'PRODUCTION_STATEMENT_CONFLICT');
      deps.sendInternalError(res, error, 'production-statement-generate');
    }
  });


  // POST /api/production/statements/:id/submit — 商家提交工厂确认
  app.post('/api/production/statements/:id/submit', ...manageGuard, async (req, res) => {
    try {
      const merchantId = merchantIdOf(req);
      const statement = await prisma.productionStatement.findFirst({ where: { id: req.params.id, merchantId } });
      if (!statement) return fail(res, 404, 'PRODUCTION_STATEMENT_NOT_FOUND');
      const guard = await prisma.productionStatement.updateMany({
        where: { id: statement.id, merchantId, status: { in: ['draft', 'disputed'] } },
        data: { status: 'pending_factory', merchantConfirmedAt: new Date() }
      });
      if (guard.count === 0) return fail(res, 409, 'PRODUCTION_STATEMENT_STATUS_INVALID');
      await audit(req, 'production.statement.submit', statement.id);
      const updated = await prisma.productionStatement.findUniqueOrThrow({
        where: { id: statement.id },
        include: statementInclude
      });
      deps.publishMerchantSync?.(merchantId, ['production']);
      res.json({ success: true, statement: serializeStatement(updated, true) });
    } catch (error) {
      deps.sendInternalError(res, error, 'production-statement-submit');
    }
  });

  // POST /api/production/statements/:id/adjustments — 增加加工费调整
  app.post('/api/production/statements/:id/adjustments', ...manageGuard, async (req, res) => {
    try {
      const merchantId = merchantIdOf(req);
      const statement = await prisma.productionStatement.findFirst({ where: { id: req.params.id, merchantId } });
      if (!statement) return fail(res, 404, 'PRODUCTION_STATEMENT_NOT_FOUND');
      if (statement.status !== 'draft' && statement.status !== 'disputed') {
        return fail(res, 409, 'PRODUCTION_STATEMENT_STATUS_INVALID');
      }
      const amount = Number(req.body?.amount);
      const reason = text(req.body?.reason, 300);
      if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 1_000_000 || !reason) {
        return fail(res, 400, 'PRODUCTION_INPUT_INVALID');
      }
      const updated = await prisma.$transaction(async tx => {
        await tx.productionStatementAdjustment.create({
          data: {
            statementId: statement.id,
            amount: roundMoney(amount),
            reason,
            createdBySide: 'merchant',
            createdBy: employeeIdOf(req) || null
          }
        });
        const adjustments = await tx.productionStatementAdjustment.findMany({ where: { statementId: statement.id }, select: { amount: true } });
        const adjustmentAmount = roundMoney(adjustments.reduce((sum, adjustment) => sum + num(adjustment.amount), 0));
        const totals = computeStatementTotals({
          openingBalance: num(statement.openingBalance),
          laborAmount: num(statement.laborAmount),
          adjustmentAmount,
          paidAmount: num(statement.paidAmount)
        });
        return tx.productionStatement.update({
          where: { id: statement.id },
          data: {
            status: 'draft',
            adjustmentAmount,
            totalAmount: totals.totalAmount,
            closingBalance: totals.closingBalance
          },
          include: statementInclude
        });
      });
      await audit(req, 'production.statement.adjust', statement.id, { amount });
      res.status(201).json({ success: true, statement: serializeStatement(updated, true) });
    } catch (error) {
      deps.sendInternalError(res, error, 'production-statement-adjust');
    }
  });

  // GET /api/production/payments — 付款记录
  app.get('/api/production/payments', ...viewGuard, async (req, res) => {
    try {
      const merchantId = merchantIdOf(req);
      const canViewCost = await merchantCanViewCost(deps, req);
      const factoryId = text(req.query.factoryId, 80);
      const payments = await prisma.productionPayment.findMany({
        where: { merchantId, ...(factoryId ? { factoryId } : {}) },
        orderBy: { paidAt: 'desc' },
        take: 200,
        include: {
          factory: { select: { id: true, name: true } },
          statement: { select: { id: true, statementNo: true, periodMonth: true } }
        }
      });
      res.json({
        success: true,
        payments: payments.map(payment => ({
          id: payment.id,
          amount: canViewCost ? num(payment.amount) : null,
          currency: payment.currency,
          method: payment.method || null,
          reference: payment.reference || null,
          note: payment.note || null,
          paidAt: payment.paidAt,
          proofUrl: payment.proofUrl || null,
          createdAt: payment.createdAt,
          factory: payment.factory ? { id: payment.factory.id, name: payment.factory.name } : null,
          statement: payment.statement
            ? { id: payment.statement.id, statementNo: payment.statement.statementNo, periodMonth: payment.statement.periodMonth }
            : null
        }))
      });
    } catch (error) {
      deps.sendInternalError(res, error, 'production-payments');
    }
  });


  // POST /api/production/payments — 登记付款（幂等 + 不超过未结金额）
  app.post('/api/production/payments', ...manageGuard, async (req, res) => {
    try {
      const merchantId = merchantIdOf(req);
      const factoryId = text(req.body?.factoryId, 80);
      const statementId = text(req.body?.statementId, 80);
      const amount = Number(req.body?.amount);
      const idempotencyKey = req.body?.idempotencyKey === undefined ? null : req.body.idempotencyKey;
      if (!factoryId || !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
        return fail(res, 400, 'PRODUCTION_INPUT_INVALID');
      }
      if (idempotencyKey !== null && !isProductionIdempotencyKey(idempotencyKey)) {
        return fail(res, 400, 'PRODUCTION_IDEMPOTENCY_KEY_INVALID');
      }
      const paidAt = parseOptionalDate(req.body?.paidAt);
      if (paidAt === 'invalid') return fail(res, 400, 'PRODUCTION_INPUT_INVALID');
      const factory = await prisma.productionFactory.findFirst({ where: { id: factoryId, merchantId } });
      if (!factory) return fail(res, 404, 'PRODUCTION_FACTORY_NOT_FOUND');
      if (idempotencyKey) {
        const existing = await prisma.productionPayment.findUnique({ where: { idempotencyKey } });
        if (existing) {
          if (existing.merchantId !== merchantId) return fail(res, 409, 'PRODUCTION_IDEMPOTENCY_KEY_INVALID');
          return res.json({
            success: true,
            payment: { id: existing.id, amount: num(existing.amount), paidAt: existing.paidAt },
            idempotent: true
          });
        }
      }
      let statement: AnyRecord | null = null;
      if (statementId) {
        statement = await prisma.productionStatement.findFirst({
          where: { id: statementId, merchantId, factoryId, status: { not: 'superseded' } }
        });
        if (!statement) return fail(res, 404, 'PRODUCTION_STATEMENT_NOT_FOUND');
        const outstanding = num(statement.openingBalance) + num(statement.totalAmount) - num(statement.paidAmount);
        if (amount > outstanding + 0.005) return fail(res, 409, 'PRODUCTION_PAYMENT_EXCEEDS_OUTSTANDING');
      }
      const payment = await prisma.$transaction(async tx => {
        const created = await tx.productionPayment.create({
          data: {
            merchantId,
            factoryId,
            statementId: statement ? statement.id : null,
            amount: roundMoney(amount),
            currency: 'EUR',
            method: text(req.body?.method, 40),
            reference: text(req.body?.reference, 120),
            note: text(req.body?.note, 500),
            paidAt: (paidAt as Date | null) || new Date(),
            recordedBy: employeeIdOf(req) || null,
            proofUrl: text(req.body?.proofUrl, 500),
            idempotencyKey
          }
        });
        if (statement) {
          const update = await tx.productionStatement.updateMany({
            where: { id: statement.id, paidAmount: statement.paidAmount },
            data: { paidAmount: { increment: roundMoney(amount) }, closingBalance: { decrement: roundMoney(amount) } }
          });
          if (update.count === 0) throw Object.assign(new Error('payment conflict'), { code: 'CONFLICT' });
        }
        return created;
      });
      await audit(req, 'production.payment.create', payment.id, { factoryId, statementId, amount });
      deps.publishMerchantSync?.(merchantId, ['production']);
      res.status(201).json({
        success: true,
        payment: {
          id: payment.id,
          amount: num(payment.amount),
          currency: payment.currency,
          paidAt: payment.paidAt,
          statementId: payment.statementId,
          factoryId: payment.factoryId
        }
      });
    } catch (error) {
      if ((error as AnyRecord)?.code === 'CONFLICT') return fail(res, 409, 'PRODUCTION_PAYMENT_CONFLICT');
      if ((error as AnyRecord)?.code === 'P2002') return fail(res, 409, 'PRODUCTION_PAYMENT_DUPLICATE');
      deps.sendInternalError(res, error, 'production-payment-create');
    }
  });


  // 留言范围校验：只允许订单或结算单，且必须属于当前商家/工厂
  async function resolveMerchantScope(merchantId: string, scopeType: unknown, scopeId: unknown) {
    if (typeof scopeId !== 'string' || !scopeId) return null;
    if (scopeType === 'order') {
      const order = await prisma.productionOrder.findFirst({
        where: { id: scopeId, merchantId },
        select: { id: true, factoryId: true, orderNo: true }
      });
      return order;
    }
    if (scopeType === 'statement') {
      const statement = await prisma.productionStatement.findFirst({
        where: { id: scopeId, merchantId },
        select: { id: true, factoryId: true, statementNo: true }
      });
      return statement;
    }
    return null;
  }

  // GET /api/production/messages — 单据留言
  app.get('/api/production/messages', ...viewGuard, async (req, res) => {
    try {
      const merchantId = merchantIdOf(req);
      const scope = await resolveMerchantScope(merchantId, req.query.scopeType, req.query.scopeId);
      if (!scope) return fail(res, 404, 'PRODUCTION_SCOPE_NOT_FOUND');
      const messages = await prisma.productionMessage.findMany({
        where: { merchantId, scopeType: String(req.query.scopeType), scopeId: String(req.query.scopeId) },
        orderBy: { createdAt: 'asc' },
        take: 200
      });
      await prisma.productionMessage.updateMany({
        where: { merchantId, scopeType: String(req.query.scopeType), scopeId: String(req.query.scopeId), readByMerchantAt: null },
        data: { readByMerchantAt: new Date() }
      });
      res.json({ success: true, messages: messages.map(serializeMessage) });
    } catch (error) {
      deps.sendInternalError(res, error, 'production-messages');
    }
  });

  // POST /api/production/messages — 商家发送留言
  app.post('/api/production/messages', ...manageGuard, async (req, res) => {
    try {
      const merchantId = merchantIdOf(req);
      const scope = await resolveMerchantScope(merchantId, req.body?.scopeType, req.body?.scopeId);
      const body = text(req.body?.body, 2000);
      if (!scope) return fail(res, 404, 'PRODUCTION_SCOPE_NOT_FOUND');
      if (!body) return fail(res, 400, 'PRODUCTION_INPUT_INVALID');
      const message = await prisma.productionMessage.create({
        data: {
          merchantId,
          factoryId: scope.factoryId,
          scopeType: String(req.body.scopeType),
          scopeId: scope.id,
          authorSide: 'merchant',
          authorName: String((req as AnyRecord).merchant?.name || (req as AnyRecord).merchant?.employeeName || '商家'),
          body,
          readByMerchantAt: new Date()
        }
      });
      res.status(201).json({ success: true, message: serializeMessage(message) });
    } catch (error) {
      deps.sendInternalError(res, error, 'production-message-create');
    }
  });


  // GET /api/production/factory/orders — 工厂工作区加工单
  app.get('/api/production/factory/orders', ...factoryGuard, async (req, res) => {
    try {
      const factoryId = String(factoryOf(req).factoryId);
      const status = text(req.query.status, 40);
      const orders = await prisma.productionOrder.findMany({
        where: { factoryId, ...(status ? { status } : {}) },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        take: 200,
        include: {
          ...orderInclude,
          pickups: { orderBy: { pickupDate: 'desc' } },
          deliveries: {
            orderBy: { submittedAt: 'desc' },
            include: { items: { include: { orderItem: { select: { sku: true, color: true, size: true } } } } }
          }
        }
      });
      res.json({
        success: true,
        orders: orders.map(order => ({
          ...serializeOrder(order, true),
          pickups: order.pickups.map(serializePickup),
          deliveries: order.deliveries.map(serializeDelivery)
        }))
      });
    } catch (error) {
      deps.sendInternalError(res, error, 'production-factory-orders');
    }
  });

  // GET /api/production/factory/orders/:id — 工厂查看单个加工单
  app.get('/api/production/factory/orders/:id', ...factoryGuard, async (req, res) => {
    try {
      const factoryId = String(factoryOf(req).factoryId);
      const order = await prisma.productionOrder.findFirst({
        where: { id: req.params.id, factoryId },
        include: {
          ...orderInclude,
          pickups: { orderBy: { pickupDate: 'desc' } },
          deliveries: {
            orderBy: { submittedAt: 'desc' },
            include: { items: { include: { orderItem: { select: { sku: true, color: true, size: true } } } } }
          }
        }
      });
      if (!order) return fail(res, 404, 'PRODUCTION_ORDER_NOT_FOUND');
      const messages = await prisma.productionMessage.findMany({
        where: { factoryId, scopeType: 'order', scopeId: order.id },
        orderBy: { createdAt: 'asc' },
        take: 200
      });
      res.json({
        success: true,
        order: serializeOrder(order, true),
        pickups: order.pickups.map(serializePickup),
        deliveries: order.deliveries.map(serializeDelivery),
        messages: messages.map(serializeMessage)
      });
    } catch (error) {
      deps.sendInternalError(res, error, 'production-factory-order-detail');
    }
  });

  // POST /api/production/factory/orders/:id/accept — 工厂接单
  app.post('/api/production/factory/orders/:id/accept', ...factoryGuard, async (req, res) => {
    try {
      const factory = factoryOf(req);
      const order = await prisma.productionOrder.findFirst({
        where: { id: req.params.id, factoryId: factory.factoryId },
        select: { id: true, merchantId: true, status: true }
      });
      if (!order) return fail(res, 404, 'PRODUCTION_ORDER_NOT_FOUND');
      const guard = await prisma.productionOrder.updateMany({
        where: { id: order.id, factoryId: factory.factoryId, status: 'pending_factory' },
        data: { status: 'accepted', acceptedAt: new Date(), version: { increment: 1 } }
      });
      if (guard.count === 0) return fail(res, 409, 'PRODUCTION_ORDER_STATUS_INVALID');
      await prisma.productionOrderEvent.create({
        data: {
          orderId: order.id,
          merchantId: order.merchantId,
          type: 'order_accepted',
          actorType: 'factory',
          actorId: String(factory.factoryMemberId),
          fromStatus: 'pending_factory',
          toStatus: 'accepted'
        }
      });
      res.json({ success: true });
    } catch (error) {
      deps.sendInternalError(res, error, 'production-factory-order-accept');
    }
  });

  // POST /api/production/factory/orders/:id/start — 工厂开始加工
  app.post('/api/production/factory/orders/:id/start', ...factoryGuard, async (req, res) => {
    try {
      const factory = factoryOf(req);
      const order = await prisma.productionOrder.findFirst({
        where: { id: req.params.id, factoryId: factory.factoryId },
        select: { id: true, merchantId: true }
      });
      if (!order) return fail(res, 404, 'PRODUCTION_ORDER_NOT_FOUND');
      const guard = await prisma.productionOrder.updateMany({
        where: { id: order.id, factoryId: factory.factoryId, status: { in: ['accepted', 'pending_factory'] } },
        data: { status: 'in_production', version: { increment: 1 } }
      });
      if (guard.count === 0) return fail(res, 409, 'PRODUCTION_ORDER_STATUS_INVALID');
      await prisma.productionOrderEvent.create({
        data: {
          orderId: order.id,
          merchantId: order.merchantId,
          type: 'order_started',
          actorType: 'factory',
          actorId: String(factory.factoryMemberId),
          toStatus: 'in_production'
        }
      });
      res.json({ success: true });
    } catch (error) {
      deps.sendInternalError(res, error, 'production-factory-order-start');
    }
  });


  // POST /api/production/factory/orders/:id/deliveries — 工厂登记送货
  app.post('/api/production/factory/orders/:id/deliveries', ...factoryGuard, async (req, res) => {
    try {
      const factory = factoryOf(req);
      const order = await prisma.productionOrder.findFirst({
        where: { id: req.params.id, factoryId: factory.factoryId },
        include: {
          items: true,
          deliveries: { where: { status: 'submitted' }, include: { items: true } }
        }
      });
      if (!order) return fail(res, 404, 'PRODUCTION_ORDER_NOT_FOUND');
      if (!['accepted', 'in_production'].includes(order.status)) {
        return fail(res, 409, 'PRODUCTION_ORDER_STATUS_INVALID');
      }
      const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
      if (rawItems.length < 1 || rawItems.length > 200) return fail(res, 400, 'PRODUCTION_INPUT_INVALID');
      const pendingByOrderItem = new Map<string, number>();
      for (const delivery of order.deliveries) {
        for (const item of delivery.items) {
          pendingByOrderItem.set(item.orderItemId, (pendingByOrderItem.get(item.orderItemId) || 0) + item.declaredQuantity);
        }
      }
      const seen = new Set<string>();
      const lines: { orderItemId: string; declaredQuantity: number }[] = [];
      for (const raw of rawItems) {
        if (!raw || typeof raw !== 'object') return fail(res, 400, 'PRODUCTION_INPUT_INVALID');
        const record = raw as AnyRecord;
        const orderItemId = typeof record.orderItemId === 'string' ? record.orderItemId : '';
        const declaredQuantity = Number(record.declaredQuantity);
        const orderItem = order.items.find(item => item.id === orderItemId);
        if (!orderItem || seen.has(orderItemId)) return fail(res, 400, 'PRODUCTION_INPUT_INVALID');
        if (!Number.isInteger(declaredQuantity) || declaredQuantity < 1) return fail(res, 400, 'PRODUCTION_INPUT_INVALID');
        const available = orderItem.plannedQuantity - orderItem.deliveredQuantity - (pendingByOrderItem.get(orderItemId) || 0);
        if (declaredQuantity > available) return fail(res, 409, 'PRODUCTION_DELIVERY_EXCEEDS_PLANNED');
        seen.add(orderItemId);
        lines.push({ orderItemId, declaredQuantity });
      }
      const delivery = await prisma.$transaction(async tx => {
        const created = await tx.productionDelivery.create({
          data: {
            deliveryNo: productionSequenceNo('DL'),
            orderId: order.id,
            merchantId: order.merchantId,
            factoryId: order.factoryId,
            status: 'submitted',
            note: text(req.body?.note, 1000),
            items: {
              create: lines.map(line => ({
                orderItemId: line.orderItemId,
                declaredQuantity: line.declaredQuantity
              }))
            }
          },
          include: { items: { include: { orderItem: { select: { sku: true, color: true, size: true } } } } }
        });
        if (order.status === 'accepted') {
          await tx.productionOrder.updateMany({
            where: { id: order.id, status: 'accepted' },
            data: { status: 'in_production', version: { increment: 1 } }
          });
        }
        await tx.productionOrderEvent.create({
          data: {
            orderId: order.id,
            merchantId: order.merchantId,
            type: 'delivery_submitted',
            actorType: 'factory',
            actorId: String(factory.factoryMemberId),
            payload: JSON.stringify({ deliveryId: created.id, pieces: lines.reduce((sum, line) => sum + line.declaredQuantity, 0) })
          }
        });
        return created;
      });
      res.status(201).json({ success: true, delivery: serializeDelivery(delivery) });
    } catch (error) {
      deps.sendInternalError(res, error, 'production-factory-delivery-create');
    }
  });

  // POST /api/production/factory/pickups/:id/confirm — 工厂确认取货件数
  app.post('/api/production/factory/pickups/:id/confirm', ...factoryGuard, async (req, res) => {
    try {
      const factory = factoryOf(req);
      const pickup = await prisma.productionPickup.findFirst({
        where: { id: req.params.id, factoryId: factory.factoryId }
      });
      if (!pickup) return fail(res, 404, 'PRODUCTION_PICKUP_NOT_FOUND');
      const receivedPieces = req.body?.receivedPieces === undefined ? pickup.pieces : Number(req.body.receivedPieces);
      if (!Number.isInteger(receivedPieces) || receivedPieces < 0 || receivedPieces > 1_000_000) {
        return fail(res, 400, 'PRODUCTION_INPUT_INVALID');
      }
      const guard = await prisma.productionPickup.updateMany({
        where: { id: pickup.id, factoryId: factory.factoryId, status: 'pending' },
        data: {
          receivedPieces,
          difference: pickup.pieces - receivedPieces,
          status: 'confirmed',
          factoryConfirmedAt: new Date(),
          note: text(req.body?.note, 500) || pickup.note
        }
      });
      if (guard.count === 0) return fail(res, 409, 'PRODUCTION_PICKUP_ALREADY_CONFIRMED');
      await prisma.productionOrderEvent.create({
        data: {
          orderId: pickup.orderId,
          merchantId: pickup.merchantId,
          type: 'pickup_confirmed',
          actorType: 'factory',
          actorId: String(factory.factoryMemberId),
          payload: JSON.stringify({ pickupId: pickup.id, receivedPieces, difference: pickup.pieces - receivedPieces })
        }
      });
      const updated = await prisma.productionPickup.findUniqueOrThrow({ where: { id: pickup.id } });
      res.json({ success: true, pickup: serializePickup(updated) });
    } catch (error) {
      deps.sendInternalError(res, error, 'production-factory-pickup-confirm');
    }
  });


  // GET /api/production/factory/statements — 工厂月度结算
  app.get('/api/production/factory/statements', ...factoryGuard, async (req, res) => {
    try {
      const factoryId = String(factoryOf(req).factoryId);
      const periodMonth = normalizePeriodMonth(req.query.periodMonth);
      const statements = await prisma.productionStatement.findMany({
        where: { factoryId, status: { not: 'superseded' }, ...(periodMonth ? { periodMonth } : {}) },
        orderBy: [{ periodMonth: 'desc' }, { createdAt: 'desc' }],
        take: 100,
        include: statementInclude
      });
      res.json({ success: true, statements: statements.map(statement => serializeStatement(statement, true)) });
    } catch (error) {
      deps.sendInternalError(res, error, 'production-factory-statements');
    }
  });

  // GET /api/production/factory/statements/:id — 工厂查看结算单
  app.get('/api/production/factory/statements/:id', ...factoryGuard, async (req, res) => {
    try {
      const factoryId = String(factoryOf(req).factoryId);
      const statement = await prisma.productionStatement.findFirst({
        where: { id: req.params.id, factoryId },
        include: statementInclude
      });
      if (!statement) return fail(res, 404, 'PRODUCTION_STATEMENT_NOT_FOUND');
      const messages = await prisma.productionMessage.findMany({
        where: { factoryId, scopeType: 'statement', scopeId: statement.id },
        orderBy: { createdAt: 'asc' },
        take: 200
      });
      res.json({
        success: true,
        statement: serializeStatement(statement, true),
        messages: messages.map(serializeMessage)
      });
    } catch (error) {
      deps.sendInternalError(res, error, 'production-factory-statement-detail');
    }
  });

  // POST /api/production/factory/statements/:id/confirm — 工厂确认结算
  app.post('/api/production/factory/statements/:id/confirm', ...factoryGuard, async (req, res) => {
    try {
      const factory = factoryOf(req);
      const statement = await prisma.productionStatement.findFirst({
        where: { id: req.params.id, factoryId: factory.factoryId }
      });
      if (!statement) return fail(res, 404, 'PRODUCTION_STATEMENT_NOT_FOUND');
      const guard = await prisma.productionStatement.updateMany({
        where: { id: statement.id, factoryId: factory.factoryId, status: 'pending_factory' },
        data: { status: 'confirmed', factoryConfirmedAt: new Date(), confirmedAt: new Date() }
      });
      if (guard.count === 0) return fail(res, 409, 'PRODUCTION_STATEMENT_STATUS_INVALID');
      const updated = await prisma.productionStatement.findUniqueOrThrow({
        where: { id: statement.id },
        include: statementInclude
      });
      res.json({ success: true, statement: serializeStatement(updated, true) });
    } catch (error) {
      deps.sendInternalError(res, error, 'production-factory-statement-confirm');
    }
  });

  // POST /api/production/factory/statements/:id/dispute — 工厂提出异议
  app.post('/api/production/factory/statements/:id/dispute', ...factoryGuard, async (req, res) => {
    try {
      const factory = factoryOf(req);
      const reason = text(req.body?.reason, 1000);
      if (!reason) return fail(res, 400, 'PRODUCTION_INPUT_INVALID');
      const statement = await prisma.productionStatement.findFirst({
        where: { id: req.params.id, factoryId: factory.factoryId }
      });
      if (!statement) return fail(res, 404, 'PRODUCTION_STATEMENT_NOT_FOUND');
      const guard = await prisma.productionStatement.updateMany({
        where: { id: statement.id, factoryId: factory.factoryId, status: 'pending_factory' },
        data: { status: 'disputed', disputeReason: reason }
      });
      if (guard.count === 0) return fail(res, 409, 'PRODUCTION_STATEMENT_STATUS_INVALID');
      res.json({ success: true });
    } catch (error) {
      deps.sendInternalError(res, error, 'production-factory-statement-dispute');
    }
  });


  async function resolveFactoryScope(factoryId: string, scopeType: unknown, scopeId: unknown) {
    if (typeof scopeId !== 'string' || !scopeId) return null;
    if (scopeType === 'order') {
      return prisma.productionOrder.findFirst({ where: { id: scopeId, factoryId }, select: { id: true, factoryId: true, merchantId: true } });
    }
    if (scopeType === 'statement') {
      return prisma.productionStatement.findFirst({ where: { id: scopeId, factoryId }, select: { id: true, factoryId: true, merchantId: true } });
    }
    return null;
  }

  // GET /api/production/factory/messages — 工厂读取单据留言
  app.get('/api/production/factory/messages', ...factoryGuard, async (req, res) => {
    try {
      const factory = factoryOf(req);
      const factoryId = String(factory.factoryId);
      const scope = await resolveFactoryScope(factoryId, req.query.scopeType, req.query.scopeId);
      if (!scope) return fail(res, 404, 'PRODUCTION_SCOPE_NOT_FOUND');
      const messages = await prisma.productionMessage.findMany({
        where: { factoryId, scopeType: String(req.query.scopeType), scopeId: String(req.query.scopeId) },
        orderBy: { createdAt: 'asc' },
        take: 200
      });
      await prisma.productionMessage.updateMany({
        where: { factoryId, scopeType: String(req.query.scopeType), scopeId: String(req.query.scopeId), readByFactoryAt: null },
        data: { readByFactoryAt: new Date() }
      });
      res.json({ success: true, messages: messages.map(serializeMessage) });
    } catch (error) {
      deps.sendInternalError(res, error, 'production-factory-messages');
    }
  });

  // POST /api/production/factory/messages — 工厂发送单据留言
  app.post('/api/production/factory/messages', ...factoryGuard, async (req, res) => {
    try {
      const factory = factoryOf(req);
      const factoryId = String(factory.factoryId);
      const scope = await resolveFactoryScope(factoryId, req.body?.scopeType, req.body?.scopeId);
      const body = text(req.body?.body, 2000);
      if (!scope) return fail(res, 404, 'PRODUCTION_SCOPE_NOT_FOUND');
      if (!body) return fail(res, 400, 'PRODUCTION_INPUT_INVALID');
      const message = await prisma.productionMessage.create({
        data: {
          merchantId: scope.merchantId,
          factoryId,
          scopeType: String(req.body.scopeType),
          scopeId: scope.id,
          authorSide: 'factory',
          authorName: String(factory.memberName || factory.factoryName || '工厂'),
          body,
          readByFactoryAt: new Date()
        }
      });
      res.status(201).json({ success: true, message: serializeMessage(message) });
    } catch (error) {
      deps.sendInternalError(res, error, 'production-factory-message-create');
    }
  });
}


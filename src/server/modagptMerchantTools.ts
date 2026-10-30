import { createHash, randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import BigNumber from 'bignumber.js';
import {
  runModaGptAgentHandoff,
  type ModaGptAgentContext,
  type ModaGptAgentRole,
  type ModaGptToolDefinition,
  type ModaGptToolRuntimeOptions
} from './modagptRuntime';
import {
  exchangeRateCurrencies,
  fetchLatestExchangeRates,
  type ExchangeRateCurrency,
  type LatestExchangeRates
} from './exchangeRates';

type ToolHandler = ModaGptToolRuntimeOptions['handlers'][string];
type ProductDraftInput = {
  styleNo: string;
  name: string;
  category: string;
  subCategory: string;
  season: string;
  wholesalePrice: number;
  rrpPrice: number;
  moq: number;
  packSize: number;
  description: string;
  skus: Array<{ sku: string; color: string; size: string }>;
};
type ProductUpdateInput = ProductDraftInput & { productId: string };
type ProductLifecycleInput = { productId: string; approvalId: string };
type QuoteDraftInput = {
  customerId: string;
  items: Array<{ productId: string; sku: string; quantity: number }>;
  currency?: string;
  notes?: string;
};
type QuoteUpdateInput = {
  quoteId: string;
  approvalId: string;
  items: Array<{ productId: string; sku: string; quantity: number; unitPrice: number }>;
  currency?: string;
  notes?: string;
};
type QuoteActionInput = { quoteId: string; approvalId: string };
type ProcurementDraftInput = {
  supplierId: string;
  items: Array<{ productId: string; variantId: string; quantity: number; unitCost: number }>;
  currency?: string;
  notes?: string;
};
type CurrencyConvertInput = { amount: number; from: string; to: string };
type QuoteDeliveryInput = {
  quoteId: string;
  quoteNo: string;
  taskId: string;
  traceId: string;
  customerId: string;
  companyName: string;
  recipient: string;
  currency: string;
  totalAmount: number;
  validUntil: Date | null;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  leadTimeDays: number | null;
  items: Array<{ styleNo: string; productName: string; sku: string; quantity: number; unitPrice: number }>;
};
type BusinessPeriodInput = { days?: number };

function isBusinessPeriodInput(value: unknown): value is BusinessPeriodInput {
  return isRecord(value)
    && Object.keys(value).every(key => key === 'days')
    && (value.days === undefined || (Number.isSafeInteger(value.days) && Number(value.days) >= 1 && Number(value.days) <= 365));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

export function isCurrencyCode(value: unknown): value is string {
  return typeof value === 'string'
    && /^[A-Z]{3}$/.test(value)
    && Intl.supportedValuesOf('currency').includes(value);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

async function loadApprovedQuoteAction(
  client: PrismaClient | Prisma.TransactionClient,
  merchantId: string,
  input: QuoteActionInput,
  toolId: 'submit_quote' | 'send_quote'
) {
  const [approval, quote] = await Promise.all([
    client.modaGptApproval.findFirst({
      where: {
        id: input.approvalId,
        merchantId,
        resourceId: input.quoteId,
        toolId,
        status: { in: toolId === 'send_quote' ? ['approved', 'processing', 'consumed'] : ['approved', 'consumed'] },
        OR: [
          { status: 'consumed' },
          { status: { in: toolId === 'send_quote' ? ['approved', 'processing'] : ['approved'] }, expiresAt: { gt: new Date() } }
        ]
      },
      select: { id: true, payload: true, status: true }
    }),
    client.salesQuote.findFirst({
      where: { id: input.quoteId, merchantId },
      include: { items: true, customer: { select: { id: true, email: true, status: true, companyName: true } } }
    })
  ]);
  if (!approval) throw new Error('MODAGPT_APPROVAL_NOT_VALID');
  if (!quote) throw new Error('MODAGPT_QUOTE_NOT_FOUND');
  let payload: unknown;
  try {
    payload = JSON.parse(approval.payload);
  } catch {
    throw new Error('MODAGPT_APPROVAL_PAYLOAD_INVALID');
  }
  if (!isRecord(payload)
    || payload.action !== (toolId === 'submit_quote' ? 'submit' : 'send')
    || payload.quoteId !== input.quoteId
    || typeof payload.fingerprint !== 'string') {
    throw new Error('MODAGPT_APPROVAL_PAYLOAD_INVALID');
  }
  if (toolId === 'send_quote'
    && (typeof payload.recipient !== 'string'
      || payload.recipient.trim().toLowerCase() !== quote.customer.email.trim().toLowerCase())) {
    throw new Error('MODAGPT_APPROVAL_STALE');
  }
  const currentFingerprint = quoteSnapshotFingerprint(quote);
  const consumedFingerprint = approval.status === 'consumed'
    ? toolId === 'submit_quote' && quote.status === 'approved'
      ? quoteSnapshotFingerprint({ ...quote, status: 'draft' })
      : toolId === 'send_quote' && quote.status === 'sent'
        ? quoteSnapshotFingerprint({ ...quote, status: 'approved' })
        : null
    : null;
  if (currentFingerprint !== payload.fingerprint && consumedFingerprint !== payload.fingerprint) {
    throw new Error('MODAGPT_APPROVAL_STALE');
  }
  return { approval, quote, payload };
}

function isProductDraftInput(value: unknown): value is ProductDraftInput {
  if (!isRecord(value) || Object.keys(value).some(key =>
    !['styleNo', 'name', 'category', 'subCategory', 'season', 'wholesalePrice', 'rrpPrice', 'moq', 'packSize', 'description', 'skus'].includes(key)
  )) return false;
  return typeof value.styleNo === 'string' && value.styleNo.trim().length > 0 && value.styleNo.length <= 80
    && typeof value.name === 'string' && value.name.trim().length > 0 && value.name.length <= 160
    && typeof value.category === 'string' && value.category.trim().length > 0 && value.category.length <= 80
    && typeof value.subCategory === 'string' && value.subCategory.trim().length > 0 && value.subCategory.length <= 80
    && typeof value.season === 'string' && value.season.trim().length > 0 && value.season.length <= 80
    && typeof value.wholesalePrice === 'number' && Number.isFinite(value.wholesalePrice) && value.wholesalePrice > 0
    && typeof value.rrpPrice === 'number' && Number.isFinite(value.rrpPrice) && value.rrpPrice > 0
    && Number.isSafeInteger(value.moq) && Number(value.moq) > 0
    && Number.isSafeInteger(value.packSize) && Number(value.packSize) > 0
    && typeof value.description === 'string' && value.description.length <= 5_000
    && Array.isArray(value.skus) && value.skus.length > 0 && value.skus.length <= 500
    && value.skus.every(sku => isRecord(sku)
      && Object.keys(sku).every(key => ['sku', 'color', 'size'].includes(key))
      && typeof sku.sku === 'string' && sku.sku.trim().length > 0 && sku.sku.length <= 80
      && typeof sku.color === 'string' && sku.color.length <= 80
      && typeof sku.size === 'string' && sku.size.length <= 40);
}

function isQuoteDraftInput(value: unknown): value is QuoteDraftInput {
  return isRecord(value)
    && Object.keys(value).every(key => ['customerId', 'items', 'currency', 'notes'].includes(key))
    && typeof value.customerId === 'string' && value.customerId.length > 0 && value.customerId.length <= 160
    && (value.currency === undefined || isCurrencyCode(value.currency))
    && Array.isArray(value.items) && value.items.length > 0 && value.items.length <= 100
    && value.items.every(item => isRecord(item)
      && Object.keys(item).every(key => ['productId', 'sku', 'quantity'].includes(key))
      && typeof item.productId === 'string' && item.productId.length > 0 && item.productId.length <= 160
      && typeof item.sku === 'string' && item.sku.length > 0 && item.sku.length <= 80
      && Number.isSafeInteger(item.quantity) && Number(item.quantity) > 0)
    && (value.notes === undefined || value.notes === null || (typeof value.notes === 'string' && value.notes.length <= 2_000));
}

function isQuoteUpdateInput(value: unknown): value is QuoteUpdateInput {
  return isRecord(value)
    && Object.keys(value).every(key => ['quoteId', 'approvalId', 'items', 'currency', 'notes'].includes(key))
    && typeof value.quoteId === 'string' && value.quoteId.length > 0 && value.quoteId.length <= 160
    && typeof value.approvalId === 'string' && value.approvalId.length > 0 && value.approvalId.length <= 160
    && (value.currency === undefined || isCurrencyCode(value.currency))
    && Array.isArray(value.items) && value.items.length > 0 && value.items.length <= 100
    && value.items.every(item => isRecord(item)
      && Object.keys(item).every(key => ['productId', 'sku', 'quantity', 'unitPrice'].includes(key))
      && typeof item.productId === 'string' && item.productId.length > 0 && item.productId.length <= 160
      && typeof item.sku === 'string' && item.sku.length > 0 && item.sku.length <= 80
      && Number.isSafeInteger(item.quantity) && Number(item.quantity) > 0
      && typeof item.unitPrice === 'number' && Number.isFinite(item.unitPrice) && item.unitPrice > 0)
    && (value.notes === undefined || value.notes === null || (typeof value.notes === 'string' && value.notes.length <= 2_000));
}

function isQuoteActionInput(value: unknown): value is QuoteActionInput {
  return isRecord(value)
    && Object.keys(value).length === 2
    && typeof value.quoteId === 'string' && value.quoteId.length > 0 && value.quoteId.length <= 160
    && typeof value.approvalId === 'string' && value.approvalId.length > 0 && value.approvalId.length <= 160;
}

function isProcurementDraftInput(value: unknown): value is ProcurementDraftInput {
  return isRecord(value)
    && Object.keys(value).every(key => ['supplierId', 'items', 'currency', 'notes'].includes(key))
    && typeof value.supplierId === 'string' && value.supplierId.length > 0 && value.supplierId.length <= 160
    && (value.currency === undefined || isCurrencyCode(value.currency))
    && Array.isArray(value.items) && value.items.length > 0 && value.items.length <= 100
    && value.items.every(item => isRecord(item)
      && Object.keys(item).every(key => ['productId', 'variantId', 'quantity', 'unitCost'].includes(key))
      && typeof item.productId === 'string' && item.productId.length > 0 && item.productId.length <= 160
      && typeof item.variantId === 'string' && item.variantId.length > 0 && item.variantId.length <= 160
      && Number.isSafeInteger(item.quantity) && Number(item.quantity) > 0 && Number(item.quantity) <= 2_147_483_647
      && typeof item.unitCost === 'number' && Number.isFinite(item.unitCost)
      && item.unitCost >= 0 && item.unitCost <= 99_999_999.9999
      && Number(item.unitCost.toFixed(4)) === item.unitCost)
    && (value.notes === undefined || value.notes === null || (typeof value.notes === 'string' && value.notes.length <= 2_000));
}

export function calculateProcurementTotal(
  items: ReadonlyArray<{ quantity: number; unitCost: number | string | { toString(): string } }>
): number {
  const total = items.reduce(
    (sum, item) => sum.plus(new BigNumber(String(item.unitCost)).multipliedBy(item.quantity)),
    new BigNumber(0)
  );
  return Number(total.toFixed(2, BigNumber.ROUND_HALF_UP));
}

function isCurrencyConvertInput(value: unknown): value is CurrencyConvertInput {
  return isRecord(value)
    && Object.keys(value).length === 3
    && Object.keys(value).every(key => ['amount', 'from', 'to'].includes(key))
    && typeof value.amount === 'number'
    && Number.isFinite(value.amount)
    && value.amount >= 0
    && value.amount <= Number.MAX_SAFE_INTEGER
    && isCurrencyCode(value.from)
    && isCurrencyCode(value.to);
}

function isExchangeRateCurrency(value: string): value is ExchangeRateCurrency {
  return exchangeRateCurrencies.some(currency => currency === value);
}

export function quoteSnapshotFingerprint(quote: {
  id: string;
  merchantId: string;
  customerId: string;
  status: string;
  currency?: string | null;
  totalQty: number;
  totalAmount: unknown;
  notes: string | null;
  validUntil?: Date | null;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
  leadTimeDays?: number | null;
  items: Array<{
    productId: string;
    sku: string;
    quantity: number;
    unitPrice: unknown;
  }>;
}): string {
  return createHash('sha256').update(stableJson({
    id: quote.id,
    merchantId: quote.merchantId,
    customerId: quote.customerId,
    status: quote.status,
    currency: quote.currency || null,
    totalQty: quote.totalQty,
    totalAmount: Number(quote.totalAmount),
    notes: quote.notes || '',
    validUntil: quote.validUntil?.toISOString() || null,
    paymentTerms: quote.paymentTerms || null,
    deliveryTerms: quote.deliveryTerms || null,
    leadTimeDays: quote.leadTimeDays ?? null,
    items: quote.items.map(item => ({
      productId: item.productId,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice)
    })).sort((left, right) =>
      left.productId.localeCompare(right.productId)
      || left.sku.localeCompare(right.sku)
      || left.quantity - right.quantity
    )
  })).digest('hex');
}

function isProductUpdateInput(value: unknown): value is ProductUpdateInput {
  if (!isRecord(value) || typeof value.productId !== 'string' || !value.productId.trim()) return false;
  const { productId: _productId, ...product } = value;
  return isProductDraftInput(product);
}

function isProductLifecycleInput(value: unknown): value is ProductLifecycleInput {
  return isRecord(value)
    && Object.keys(value).length === 2
    && typeof value.productId === 'string' && value.productId.length > 0 && value.productId.length <= 160
    && typeof value.approvalId === 'string' && value.approvalId.length > 0 && value.approvalId.length <= 160;
}

export function productSnapshotFingerprint(product: {
  styleNo: string;
  name: string;
  category: string;
  subCategory: string;
  season: string;
  wholesalePrice: unknown;
  rrpPrice: unknown;
  moq: number;
  packSize: number;
  description: string;
  skus: string;
  images: string;
  media: string | null;
}): string {
  return createHash('sha256').update(JSON.stringify({
    styleNo: product.styleNo,
    name: product.name,
    category: product.category,
    subCategory: product.subCategory,
    season: product.season,
    wholesalePrice: Number(product.wholesalePrice),
    rrpPrice: Number(product.rrpPrice),
    moq: product.moq,
    packSize: product.packSize,
    description: product.description,
    skus: product.skus,
    images: product.images,
    media: product.media
  })).digest('hex');
}

const objectSchema = { type: 'object', additionalProperties: false } as const;

const definitions: ModaGptToolDefinition[] = [
  {
    name: 'get_products',
    description: 'Read product facts belonging to the authenticated merchant.',
    inputSchema: { ...objectSchema, properties: { query: { type: 'string', maxLength: 120 } } },
    outputSchema: { type: 'object', required: ['products'] },
    permission: 'product.catalog.read',
    riskLevel: 'LOW',
    requiresApproval: false,
    timeoutMs: 10_000,
    retryPolicy: { maxAttempts: 1, idempotent: true },
    auditPolicy: 'required',
    validateInput: value => isRecord(value)
      && Object.keys(value).every(key => key === 'query')
      && (value.query === undefined || (typeof value.query === 'string' && value.query.length <= 120)),
    validateOutput: value => isRecord(value) && Array.isArray(value.products)
  },
  {
    name: 'create_product_draft',
    description: 'Create a tenant-owned RUDA product in draft status; never publish it.',
    inputSchema: {
      ...objectSchema,
      required: ['styleNo', 'name', 'category', 'subCategory', 'season', 'wholesalePrice', 'rrpPrice', 'moq', 'packSize', 'description', 'skus']
    },
    outputSchema: { type: 'object', required: ['productId', 'lifecycleStatus'] },
    permission: 'product.import.draft',
    riskLevel: 'MEDIUM',
    requiresApproval: false,
    timeoutMs: 20_000,
    retryPolicy: { maxAttempts: 1, idempotent: false },
    auditPolicy: 'required',
    validateInput: isProductDraftInput,
    validateOutput: value => isRecord(value)
      && typeof value.productId === 'string'
      && value.lifecycleStatus === 'draft'
  },
  {
    name: 'update_product_draft',
    description: 'Update a merchant-owned RUDA product draft without publishing it.',
    inputSchema: { ...objectSchema, required: ['productId', 'styleNo', 'name', 'category', 'subCategory', 'season', 'wholesalePrice', 'rrpPrice', 'moq', 'packSize', 'description', 'skus'] },
    outputSchema: { type: 'object', required: ['productId', 'lifecycleStatus'] },
    permission: 'product.import.draft',
    riskLevel: 'MEDIUM',
    requiresApproval: false,
    timeoutMs: 20_000,
    retryPolicy: { maxAttempts: 1, idempotent: true },
    auditPolicy: 'required',
    validateInput: isProductUpdateInput,
    validateOutput: value => isRecord(value) && typeof value.productId === 'string' && value.lifecycleStatus === 'draft'
  },
  ...(['publish_product', 'unpublish_product'] as const).map(name => ({
    name,
    description: name === 'publish_product'
      ? 'Publish a verified merchant-owned product only with its persisted approval.'
      : 'Unpublish a merchant-owned product only with its persisted approval.',
    inputSchema: { ...objectSchema, required: ['productId', 'approvalId'] },
    outputSchema: { type: 'object', required: ['productId', 'lifecycleStatus'] },
    permission: 'product.publish',
    riskLevel: 'HIGH' as const,
    requiresApproval: true,
    timeoutMs: 20_000,
    retryPolicy: { maxAttempts: 1, idempotent: true },
    auditPolicy: 'required' as const,
    validateInput: isProductLifecycleInput,
    validateOutput: (value: unknown) => isRecord(value)
      && typeof value.productId === 'string'
      && value.lifecycleStatus === (name === 'publish_product' ? 'published' : 'draft')
  })),
  {
    name: 'get_customers',
    description: 'Search approved customers already linked to this merchant.',
    inputSchema: {
      ...objectSchema,
      required: ['query'],
      properties: { query: { type: 'string', minLength: 1, maxLength: 120 } }
    },
    outputSchema: { type: 'object', required: ['customers'] },
    permission: 'sales.order.create',
    riskLevel: 'LOW',
    requiresApproval: false,
    timeoutMs: 10_000,
    retryPolicy: { maxAttempts: 1, idempotent: true },
    auditPolicy: 'required',
    validateInput: value => isRecord(value)
      && Object.keys(value).length === 1
      && typeof value.query === 'string'
      && value.query.trim().length > 0
      && value.query.length <= 120,
    validateOutput: value => isRecord(value) && Array.isArray(value.customers)
  },
  {
    name: 'create_quote_draft',
    description: 'Create a draft RUDA SalesQuote from merchant-owned published products and approved customer pricing.',
    inputSchema: { ...objectSchema, required: ['customerId', 'items'] },
    outputSchema: { type: 'object', required: ['quoteId', 'status', 'totalAmount'] },
    permission: 'sales.order.create',
    riskLevel: 'MEDIUM',
    requiresApproval: false,
    timeoutMs: 20_000,
    retryPolicy: { maxAttempts: 1, idempotent: false },
    auditPolicy: 'required',
    validateInput: isQuoteDraftInput,
    validateOutput: value => isRecord(value)
      && typeof value.quoteId === 'string'
      && value.status === 'draft'
      && typeof value.totalAmount === 'number'
  },
  {
    name: 'get_quote',
    description: 'Read back a quote draft created for this merchant.',
    inputSchema: {
      ...objectSchema,
      required: ['quoteId'],
      properties: { quoteId: { type: 'string', minLength: 1, maxLength: 160 } }
    },
    outputSchema: { type: 'object', required: ['quote'] },
    permission: 'sales.order.create',
    riskLevel: 'LOW',
    requiresApproval: false,
    timeoutMs: 10_000,
    retryPolicy: { maxAttempts: 1, idempotent: true },
    auditPolicy: 'required',
    validateInput: value => isRecord(value)
      && Object.keys(value).length === 1
      && typeof value.quoteId === 'string'
      && value.quoteId.length > 0
      && value.quoteId.length <= 160,
    validateOutput: value => isRecord(value) && isRecord(value.quote)
  },
  {
    name: 'update_quote',
    description: 'Update a tenant-scoped draft quote only with a persisted approval bound to the current quote snapshot.',
    inputSchema: { ...objectSchema, required: ['quoteId', 'approvalId', 'items'] },
    outputSchema: { type: 'object', required: ['quoteId', 'status', 'totalQty', 'totalAmount'] },
    permission: 'sales.order.create',
    riskLevel: 'HIGH',
    requiresApproval: true,
    timeoutMs: 20_000,
    retryPolicy: { maxAttempts: 1, idempotent: true },
    auditPolicy: 'required',
    validateInput: isQuoteUpdateInput,
    validateOutput: value => isRecord(value)
      && typeof value.quoteId === 'string'
      && value.status === 'draft'
      && Number.isInteger(value.totalQty)
      && typeof value.totalAmount === 'number'
  },
  ...(['submit_quote', 'send_quote'] as const).map(name => ({
    name,
    description: name === 'submit_quote'
      ? 'Submit a draft quote as approved only after explicit merchant approval.'
      : 'Send an approved quote to its persisted customer email only after explicit merchant approval.',
    inputSchema: { ...objectSchema, required: ['quoteId', 'approvalId'] },
    outputSchema: { type: 'object', required: ['quoteId', 'status'] },
    permission: 'sales.quote.manage',
    riskLevel: 'HIGH' as const,
    requiresApproval: true,
    timeoutMs: 30_000,
    retryPolicy: { maxAttempts: 1, idempotent: true },
    auditPolicy: 'required' as const,
    validateInput: isQuoteActionInput,
    validateOutput: value => isRecord(value)
      && typeof value.quoteId === 'string'
      && value.status === (name === 'submit_quote' ? 'approved' : 'sent')
  })),
  {
    name: 'get_suppliers',
    description: 'Search suppliers linked to this merchant.',
    inputSchema: {
      ...objectSchema,
      properties: { query: { type: 'string', maxLength: 120 } }
    },
    outputSchema: { type: 'object', required: ['suppliers'] },
    permission: 'purchase.manage',
    riskLevel: 'LOW',
    requiresApproval: false,
    timeoutMs: 10_000,
    retryPolicy: { maxAttempts: 1, idempotent: true },
    auditPolicy: 'required',
    validateInput: value => isRecord(value)
      && Object.keys(value).every(key => key === 'query')
      && (value.query === undefined || (typeof value.query === 'string' && value.query.length <= 120)),
    validateOutput: value => isRecord(value) && Array.isArray(value.suppliers)
  },
  {
    name: 'create_procurement_draft',
    description: 'Create a draft procurement order (purchase order) for a supplier.',
    inputSchema: { ...objectSchema, required: ['supplierId', 'items'] },
    outputSchema: { type: 'object', required: ['purchaseOrderId', 'status', 'totalAmount'] },
    permission: 'purchase.manage',
    riskLevel: 'MEDIUM',
    requiresApproval: false,
    timeoutMs: 20_000,
    retryPolicy: { maxAttempts: 1, idempotent: false },
    auditPolicy: 'required',
    validateInput: isProcurementDraftInput,
    validateOutput: value => isRecord(value)
      && typeof value.purchaseOrderId === 'string'
      && value.status === 'draft'
      && typeof value.totalAmount === 'number'
  },
  {
    name: 'get_supplier_performance',
    description: 'Analyze performance metrics for a specific supplier.',
    inputSchema: {
      ...objectSchema,
      required: ['supplierId'],
      properties: { supplierId: { type: 'string', minLength: 1, maxLength: 160 } }
    },
    outputSchema: { type: 'object', required: ['supplierId', 'metrics'] },
    permission: 'purchase.manage',
    riskLevel: 'LOW',
    requiresApproval: false,
    timeoutMs: 15_000,
    retryPolicy: { maxAttempts: 1, idempotent: true },
    auditPolicy: 'required',
    validateInput: value => isRecord(value)
      && Object.keys(value).length === 1
      && typeof value.supplierId === 'string'
      && value.supplierId.length > 0
      && value.supplierId.length <= 160,
    validateOutput: value => isRecord(value) && isRecord(value.metrics)
  },
  {
    name: 'currency_convert',
      description: 'Convert currencies using the latest published daily Frankfurter reference rates; this is not a real-time trading quote.',
    inputSchema: {
      ...objectSchema,
      required: ['amount', 'from', 'to'],
      properties: {
        amount: { type: 'number', minimum: 0 },
        from: { type: 'string', minLength: 3, maxLength: 3 },
        to: { type: 'string', minLength: 3, maxLength: 3 }
      }
    },
    outputSchema: { type: 'object', required: ['amount', 'from', 'currency', 'rate', 'rateSource', 'rateDate', 'rateType'] },
    permission: 'business.analytics.read',
    riskLevel: 'LOW',
    requiresApproval: false,
    timeoutMs: 5_000,
    retryPolicy: { maxAttempts: 1, idempotent: true },
    auditPolicy: 'required',
    validateInput: isCurrencyConvertInput,
    validateOutput: (value: unknown) => isRecord(value)
      && typeof value.amount === 'number'
      && typeof value.from === 'string'
      && typeof value.currency === 'string'
      && typeof value.rate === 'number'
      && (value.rateSource === 'Frankfurter' || value.rateSource === 'identity')
      && (value.rateDate === null || (typeof value.rateDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.rateDate)))
      && (value.rateType === 'daily_reference' || value.rateType === 'identity')
  },
  ...([
    'order_summary',
    'sales_summary',
    'inventory_summary',
    'product_performance',
    'customer_performance',
    'finance_summary'
  ] as const).map(name => ({
    name,
    description: `Read tenant-scoped RUDA ${name.replaceAll('_', ' ')} data for business analysis.`,
    inputSchema: {
      ...objectSchema,
      properties: { days: { type: 'integer', minimum: 1, maximum: 365 } }
    },
    outputSchema: { type: 'object', required: ['source', 'days'] },
    permission: 'business.analytics.read',
    riskLevel: 'LOW' as const,
    requiresApproval: false,
    timeoutMs: 15_000,
    retryPolicy: { maxAttempts: 1, idempotent: true },
    auditPolicy: 'required' as const,
    validateInput: isBusinessPeriodInput,
    validateOutput: (value: unknown) => isRecord(value)
      && value.source === 'ruda_database'
      && Number.isInteger(value.days)
  }))
];

export function createModaGptMerchantTools(input: {
  prisma: PrismaClient;
  taskId: string;
  traceId?: string;
  actorId: string;
  employeeId: string | null;
  signal?: AbortSignal;
  assertLease?: () => Promise<void>;
  fetchExchangeRates?: (input: { signal?: AbortSignal }) => Promise<LatestExchangeRates>;
  sendQuote?: (
    merchantId: string,
    quote: QuoteDeliveryInput,
    idempotencyKey: string,
    signal?: AbortSignal
  ) => Promise<{ provider: string; providerMessageId: string }>;
}) {
  const assertExecutionLease = async () => {
    if (input.signal?.aborted) throw new Error('MODAGPT_TOOL_CANCELLED');
    await input.assertLease?.();
    if (input.signal?.aborted) throw new Error('MODAGPT_TOOL_CANCELLED');
  };
  const changeProductLifecycle = async (
    merchantId: string,
    rawInput: unknown,
    targetStatus: 'published' | 'draft'
  ) => {
    if (!isProductLifecycleInput(rawInput)) throw new Error('MODAGPT_PRODUCT_LIFECYCLE_INPUT_INVALID');
    try {
      return await input.prisma.$transaction(async tx => {
      const approval = await tx.modaGptApproval.findFirst({
        where: {
          id: rawInput.approvalId,
          merchantId,
          resourceId: rawInput.productId,
          toolId: targetStatus === 'published' ? 'publish_product' : 'unpublish_product',
          status: 'approved',
          expiresAt: { gt: new Date() }
        },
        select: { id: true, payload: true }
      });
      if (!approval) throw new Error('MODAGPT_APPROVAL_NOT_VALID');
      let approvalPayload: unknown;
      try {
        approvalPayload = JSON.parse(approval.payload);
      } catch {
        throw new Error('MODAGPT_APPROVAL_PAYLOAD_INVALID');
      }
      if (!isRecord(approvalPayload)
        || approvalPayload.productId !== rawInput.productId
        || approvalPayload.action !== targetStatus
        || typeof approvalPayload.fingerprint !== 'string') {
        throw new Error('MODAGPT_APPROVAL_PAYLOAD_INVALID');
      }
      const product = await tx.product.findFirst({
        where: {
          id: rawInput.productId,
          merchantId,
          lifecycleStatus: targetStatus === 'published' ? 'draft' : 'published'
        },
        select: {
          id: true,
          merchantId: true,
          lifecycleStatus: true,
          styleNo: true,
          name: true,
          wholesalePrice: true,
          rrpPrice: true,
          moq: true,
          packSize: true,
          subCategory: true,
          season: true,
          description: true,
          category: true,
          skus: true,
          images: true,
          media: true,
          updatedAt: true
        }
      });
      if (!product) throw new Error('MODAGPT_PRODUCT_LIFECYCLE_SOURCE_INVALID');
      const currentFingerprint = productSnapshotFingerprint(product);
      if (approvalPayload.fingerprint !== currentFingerprint) {
        throw new Error('MODAGPT_APPROVAL_STALE');
      }
      if (targetStatus === 'published') {
        const category = await tx.merchantStoreCategory.findFirst({
          where: { merchantId, slug: product.category, isActive: true },
          select: { id: true }
        });
        let skus: unknown;
        let images: unknown;
        let media: unknown;
        try {
          skus = JSON.parse(product.skus);
          images = JSON.parse(product.images);
          media = product.media ? JSON.parse(product.media) : [];
        } catch {
          throw new Error('MODAGPT_PRODUCT_PUBLISH_DATA_INVALID');
        }
        if (!category
          || !product.styleNo.trim()
          || Number(product.wholesalePrice) <= 0
          || Number(product.rrpPrice) <= 0
          || product.moq <= 0
          || product.packSize <= 0
          || !Array.isArray(skus)
          || skus.length === 0
          || skus.some(sku => !isRecord(sku) || typeof sku.sku !== 'string' || !sku.sku.trim())
          || !Array.isArray(images)
          || !images.some(image => typeof image === 'string' && image.trim())
          || (Array.isArray(media) && media.length > 0 && !media.some(item =>
            isRecord(item) && item.type === 'image' && typeof item.url === 'string' && item.url.trim()
          ))) throw new Error('MODAGPT_PRODUCT_PUBLISH_REQUIREMENTS_NOT_MET');
      }
      await assertExecutionLease();
      const claimed = await tx.modaGptApproval.updateMany({
        where: { id: approval.id, merchantId, status: 'approved', expiresAt: { gt: new Date() } },
        data: { status: 'consumed' }
      });
      if (claimed.count !== 1) throw new Error('MODAGPT_APPROVAL_ALREADY_USED');
      const updated = await tx.product.updateMany({
        where: {
          id: product.id,
          merchantId,
          lifecycleStatus: targetStatus === 'published' ? 'draft' : 'published',
          updatedAt: product.updatedAt
        },
        data: { lifecycleStatus: targetStatus }
      });
      if (updated.count !== 1) throw new Error('MODAGPT_PRODUCT_LIFECYCLE_CONCURRENT_UPDATE');
      const verified = await tx.product.findFirst({
        where: { id: product.id, merchantId, lifecycleStatus: targetStatus },
        select: {
          id: true,
          merchantId: true,
          lifecycleStatus: true,
          skus: true,
          wholesalePrice: true,
          rrpPrice: true,
          moq: true,
          packSize: true
        }
      });
      if (!verified
        || verified.merchantId !== merchantId
        || verified.skus !== product.skus
        || Number(verified.wholesalePrice) !== Number(product.wholesalePrice)
        || Number(verified.rrpPrice) !== Number(product.rrpPrice)
        || verified.moq !== product.moq
        || verified.packSize !== product.packSize) {
        throw new Error('MODAGPT_PRODUCT_LIFECYCLE_VERIFY_FAILED');
      }
      const skuCount = (() => {
        try {
          const parsed: unknown = JSON.parse(verified.skus);
          return Array.isArray(parsed) ? parsed.length : 0;
        } catch {
          return 0;
        }
      })();
      if (skuCount === 0 || Number(verified.wholesalePrice) <= 0 || Number(verified.rrpPrice) <= 0) {
        throw new Error('MODAGPT_PRODUCT_LIFECYCLE_VERIFY_FAILED');
      }
      return {
        productId: verified.id,
        lifecycleStatus: verified.lifecycleStatus,
        merchantId: verified.merchantId,
        skuCount,
        wholesalePrice: Number(verified.wholesalePrice),
        rrpPrice: Number(verified.rrpPrice),
        moq: verified.moq,
        packSize: verified.packSize,
        verified: true
      };
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'MODAGPT_APPROVAL_STALE') {
        await input.prisma.modaGptApproval.updateMany({
          where: { id: rawInput.approvalId, merchantId, status: 'approved' },
          data: { status: 'expired', decisionNote: 'Product changed after approval.' }
        });
      }
      throw error;
    }
  };
  const handlers: Record<string, ToolHandler> = {
    get_products: async (merchantId, rawInput) => {
      if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) {
        throw new Error('MODAGPT_TOOL_INPUT_INVALID');
      }
      const query = isRecord(rawInput) && typeof rawInput.query === 'string' ? rawInput.query.trim() : '';
      const products = await input.prisma.product.findMany({
        where: {
          merchantId,
          ...(query ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { styleNo: { contains: query, mode: 'insensitive' } },
              { brand: { contains: query, mode: 'insensitive' } }
            ]
          } : {})
        },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        select: {
          id: true,
          styleNo: true,
          name: true,
          brand: true,
          category: true,
          wholesalePrice: true,
          lifecycleStatus: true,
          moq: true,
          packSize: true,
          skus: true
        }
      });
      return {
        products: products.map(product => ({
          id: product.id,
          styleNo: product.styleNo,
          name: product.name,
          brand: product.brand,
          category: product.category,
          wholesalePrice: Number(product.wholesalePrice),
          lifecycleStatus: product.lifecycleStatus,
          moq: product.moq,
          packSize: product.packSize,
          skus: (() => {
            try {
              const parsed: unknown = JSON.parse(product.skus);
              if (!Array.isArray(parsed)) throw new Error('invalid');
              return parsed.filter((sku): sku is Record<string, unknown> => isRecord(sku) && typeof sku.sku === 'string')
                .map(sku => ({ sku: sku.sku, color: sku.color, size: sku.size }));
            } catch {
              throw new Error('MODAGPT_PRODUCT_SKU_DATA_INVALID');
            }
          })()
        }))
      };
    },
    create_product_draft: async (merchantId, rawInput) => {
      if (!isProductDraftInput(rawInput)) throw new Error('MODAGPT_PRODUCT_DRAFT_INPUT_INVALID');
      const merchant = await input.prisma.merchant.findUnique({
        where: { id: merchantId },
        select: { id: true, name: true }
      });
      if (!merchant) throw new Error('MODAGPT_MERCHANT_NOT_FOUND');
      const styleNo = rawInput.styleNo.trim();
      const stableProductId = `modagpt-${createHash('sha256').update(input.taskId).digest('hex').slice(0, 48)}`;
      const previouslyCreated = await input.prisma.product.findFirst({
        where: { id: stableProductId, merchantId },
        select: { id: true, styleNo: true, name: true, lifecycleStatus: true, category: true, subCategory: true, season: true, wholesalePrice: true, rrpPrice: true, moq: true, packSize: true, description: true, skus: true }
      });
      if (previouslyCreated) {
        const requestedSkus = JSON.stringify(rawInput.skus.map(sku => ({
          sku: sku.sku.trim(),
          color: sku.color.trim(),
          size: sku.size.trim()
        })));
        if (previouslyCreated.styleNo !== styleNo
          || previouslyCreated.name !== rawInput.name.trim()
          || previouslyCreated.category !== rawInput.category.trim()
          || previouslyCreated.subCategory !== rawInput.subCategory.trim()
          || previouslyCreated.season !== rawInput.season.trim()
          || Number(previouslyCreated.wholesalePrice) !== rawInput.wholesalePrice
          || Number(previouslyCreated.rrpPrice) !== rawInput.rrpPrice
          || previouslyCreated.moq !== rawInput.moq
          || previouslyCreated.packSize !== rawInput.packSize
          || previouslyCreated.description !== rawInput.description.trim()
          || previouslyCreated.skus !== requestedSkus) {
          throw new Error('MODAGPT_TOOL_IDEMPOTENCY_CONFLICT');
        }
        return {
          productId: previouslyCreated.id,
          styleNo: previouslyCreated.styleNo,
          name: previouslyCreated.name,
          lifecycleStatus: previouslyCreated.lifecycleStatus
        };
      }
      const existing = await input.prisma.product.findFirst({ where: { merchantId, styleNo }, select: { id: true } });
      if (existing) throw new Error('MODAGPT_PRODUCT_STYLE_EXISTS');
      const category = await input.prisma.merchantStoreCategory.findFirst({
        where: { merchantId, slug: rawInput.category.trim(), isActive: true },
        select: { slug: true }
      });
      if (!category) throw new Error('MODAGPT_PRODUCT_CATEGORY_UNAVAILABLE');
      const uniqueSkus = new Set(rawInput.skus.map(sku => sku.sku.trim()));
      if (uniqueSkus.size !== rawInput.skus.length) throw new Error('MODAGPT_PRODUCT_SKU_DUPLICATE');
      await assertExecutionLease();
      const created = await input.prisma.product.create({
        data: {
          id: stableProductId,
          styleNo,
          name: rawInput.name.trim(),
          category: rawInput.category.trim(),
          subCategory: rawInput.subCategory.trim(),
          brand: merchant.name,
          season: rawInput.season.trim(),
          images: '[]',
          media: '[]',
          wholesalePrice: rawInput.wholesalePrice,
          rrpPrice: rawInput.rrpPrice,
          moq: rawInput.moq,
          packSize: rawInput.packSize,
          status: 'new',
          inventoryStatus: 'coming_soon',
          origin: '',
          fabric: '',
          composition: '',
          weight: '',
          packaging: '',
          washCare: '',
          description: rawInput.description.trim(),
          skus: JSON.stringify(rawInput.skus.map(sku => ({
            sku: sku.sku.trim(),
            color: sku.color.trim(),
            size: sku.size.trim()
          }))),
          merchantId,
          merchantName: merchant.name,
          visibility: 'private',
          lifecycleStatus: 'draft',
          isExclusiveProtected: true
        },
        select: { id: true, styleNo: true, name: true, lifecycleStatus: true }
      });
      return { productId: created.id, styleNo: created.styleNo, name: created.name, lifecycleStatus: created.lifecycleStatus };
    },
    update_product_draft: async (merchantId, rawInput) => {
      if (!isProductUpdateInput(rawInput)) throw new Error('MODAGPT_PRODUCT_UPDATE_INPUT_INVALID');
      const product = await input.prisma.product.findFirst({
        where: { id: rawInput.productId, merchantId, lifecycleStatus: 'draft' },
        select: { id: true }
      });
      if (!product) throw new Error('MODAGPT_PRODUCT_DRAFT_NOT_FOUND');
      const category = await input.prisma.merchantStoreCategory.findFirst({
        where: { merchantId, slug: rawInput.category.trim(), isActive: true },
        select: { slug: true }
      });
      if (!category) throw new Error('MODAGPT_PRODUCT_CATEGORY_UNAVAILABLE');
      const duplicateStyle = await input.prisma.product.findFirst({
        where: { merchantId, styleNo: rawInput.styleNo.trim(), id: { not: rawInput.productId } },
        select: { id: true }
      });
      if (duplicateStyle) throw new Error('MODAGPT_PRODUCT_STYLE_EXISTS');
      const normalizedSkus = rawInput.skus.map(sku => ({
        sku: sku.sku.trim(),
        color: sku.color.trim(),
        size: sku.size.trim()
      }));
      if (new Set(normalizedSkus.map(sku => sku.sku)).size !== normalizedSkus.length) {
        throw new Error('MODAGPT_PRODUCT_SKU_DUPLICATE');
      }
      await assertExecutionLease();
      const updated = await input.prisma.product.updateMany({
        where: { id: rawInput.productId, merchantId, lifecycleStatus: 'draft' },
        data: {
          styleNo: rawInput.styleNo.trim(),
          name: rawInput.name.trim(),
          category: rawInput.category.trim(),
          subCategory: rawInput.subCategory.trim(),
          season: rawInput.season.trim(),
          wholesalePrice: rawInput.wholesalePrice,
          rrpPrice: rawInput.rrpPrice,
          moq: rawInput.moq,
          packSize: rawInput.packSize,
          description: rawInput.description.trim(),
          skus: JSON.stringify(normalizedSkus)
        }
      });
      if (updated.count !== 1) throw new Error('MODAGPT_PRODUCT_DRAFT_CHANGED');
      return {
        productId: product.id,
        styleNo: rawInput.styleNo.trim(),
        name: rawInput.name.trim(),
        lifecycleStatus: 'draft'
      };
    },
    publish_product: (merchantId, rawInput) => changeProductLifecycle(merchantId, rawInput, 'published'),
    unpublish_product: (merchantId, rawInput) => changeProductLifecycle(merchantId, rawInput, 'draft'),
    get_customers: async (merchantId, rawInput) => {
      const query = (rawInput as { query: string }).query.trim();
      const customers = await input.prisma.customer.findMany({
        where: {
          status: 'approved',
          OR: [
            { orders: { some: { merchantId } } },
            { vaultReqs: { some: { merchantId } } },
            { merchantLinks: { some: { merchantId } } }
          ],
          AND: [{
            OR: [
              { companyName: { contains: query, mode: 'insensitive' } },
              { contactPerson: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } }
            ]
          }]
        },
        take: 10,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, companyName: true, contactPerson: true, country: true }
      });
      return { customers };
    },
    create_quote_draft: async (merchantId, rawInput) => {
      if (!isQuoteDraftInput(rawInput)) throw new Error('MODAGPT_QUOTE_DRAFT_INPUT_INVALID');
      const quote = await input.prisma.$transaction(async tx => {
        const stableQuoteId = createHash('sha256').update(input.taskId).digest('hex').slice(0, 32);
        const previouslyCreated = await tx.salesQuote.findFirst({
          where: { id: stableQuoteId, merchantId },
          select: { id: true, quoteNo: true, status: true, totalQty: true, totalAmount: true, customerId: true, currency: true, notes: true, items: true }
        });
        if (previouslyCreated) {
          const sameItems = Array.isArray(previouslyCreated.items)
            && previouslyCreated.items.length === rawInput.items.length
            && rawInput.items.every(requested => previouslyCreated.items.some((stored: { productId: string; sku: string; quantity: number }) =>
              stored.productId === requested.productId
              && stored.sku === requested.sku
              && stored.quantity === requested.quantity
            ));
          if (previouslyCreated.customerId !== rawInput.customerId
            || (previouslyCreated.currency || null) !== (rawInput.currency || null)
            || (previouslyCreated.notes || '') !== (rawInput.notes?.trim() || '')
            || !sameItems) {
            throw new Error('MODAGPT_TOOL_IDEMPOTENCY_CONFLICT');
          }
          return previouslyCreated;
        }
        const customer = await tx.customer.findFirst({
          where: {
            id: rawInput.customerId,
            status: 'approved',
            OR: [
              { orders: { some: { merchantId } } },
              { vaultReqs: { some: { merchantId } } },
              { merchantLinks: { some: { merchantId } } }
            ]
          },
          select: { id: true, discountRate: true }
        });
        if (!customer) throw new Error('MODAGPT_QUOTE_CUSTOMER_UNAVAILABLE');
        const productIds = [...new Set(rawInput.items.map(item => item.productId))];
        const products = await tx.product.findMany({
          where: { id: { in: productIds }, merchantId, lifecycleStatus: 'published' },
          select: { id: true, styleNo: true, name: true, wholesalePrice: true, moq: true, packSize: true, skus: true }
        });
        const byId = new Map(products.map(product => [product.id, product]));
        const quoteItems: Array<{
          productId: string;
          sku: string;
          styleNo: string;
          productName: string;
          color: string;
          size: string;
          quantity: number;
          unitPrice: number;
        }> = [];
        let totalQty = 0;
        let totalAmount = 0;
        for (const item of rawInput.items) {
          const product = byId.get(item.productId);
          if (!product) throw new Error('MODAGPT_QUOTE_PRODUCT_UNAVAILABLE');
          if (item.quantity < product.moq || item.quantity % Math.max(product.packSize, 1) !== 0) {
            throw new Error('MODAGPT_QUOTE_MOQ_OR_PACK_SIZE_INVALID');
          }
          let skus: Array<{ sku: string; color?: string; size?: string }>;
          try {
            const parsed: unknown = JSON.parse(product.skus);
            if (!Array.isArray(parsed)) throw new Error('invalid');
            skus = parsed.filter((candidate): candidate is { sku: string; color?: string; size?: string } =>
              isRecord(candidate) && typeof candidate.sku === 'string'
            );
          } catch {
            throw new Error('MODAGPT_QUOTE_PRODUCT_SKU_DATA_INVALID');
          }
          const sku = skus.find(candidate => candidate.sku === item.sku);
          if (!sku) throw new Error('MODAGPT_QUOTE_SKU_UNAVAILABLE');
          const unitPrice = Number((Number(product.wholesalePrice) * Number(customer.discountRate || 1)).toFixed(2));
          quoteItems.push({
            productId: product.id,
            sku: item.sku,
            styleNo: product.styleNo,
            productName: product.name,
            color: sku.color || '',
            size: sku.size || '',
            quantity: item.quantity,
            unitPrice
          });
          totalQty += item.quantity;
          totalAmount += item.quantity * unitPrice;
        }
        await assertExecutionLease();
        return tx.salesQuote.create({
          data: {
            id: stableQuoteId,
            quoteNo: `Q-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomUUID().slice(0, 8).toUpperCase()}`,
            merchantId,
            customerId: customer.id,
            createdBy: input.employeeId || input.actorId,
            status: 'draft',
            currency: rawInput.currency || null,
            validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            totalQty,
            totalAmount: Number(totalAmount.toFixed(2)),
            notes: rawInput.notes?.trim() || null,
            items: { create: quoteItems }
          },
          select: { id: true, quoteNo: true, status: true, totalQty: true, totalAmount: true, currency: true }
        });
      });
      return {
        quoteId: quote.id,
        quoteNo: quote.quoteNo,
        status: quote.status,
        totalQty: quote.totalQty,
        totalAmount: Number(quote.totalAmount),
        currency: quote.currency
      };
    },
    get_quote: async (merchantId, rawInput) => {
      if (!isRecord(rawInput) || typeof rawInput.quoteId !== 'string') {
        throw new Error('MODAGPT_TOOL_INPUT_INVALID');
      }
      const quote = await input.prisma.salesQuote.findFirst({
        where: { id: rawInput.quoteId, merchantId },
        include: { items: true }
      });
      if (!quote) throw new Error('MODAGPT_QUOTE_NOT_FOUND');
      return {
        quote: {
          ...quote,
          totalAmount: Number(quote.totalAmount),
          items: quote.items.map(item => ({ ...item, unitPrice: Number(item.unitPrice) }))
        }
      };
    },
    update_quote: async (merchantId, rawInput) => {
      if (!isQuoteUpdateInput(rawInput)) throw new Error('MODAGPT_QUOTE_UPDATE_INPUT_INVALID');
      const approval = await input.prisma.modaGptApproval.findFirst({
        where: {
          id: rawInput.approvalId,
          merchantId,
          resourceId: rawInput.quoteId,
          toolId: 'update_quote',
          status: { in: ['approved', 'consumed'] },
          OR: [
            { status: 'consumed' },
            { status: 'approved', expiresAt: { gt: new Date() } }
          ]
        },
        select: { id: true, payload: true, status: true }
      });
      if (!approval) throw new Error('MODAGPT_APPROVAL_NOT_VALID');
      let approvedPayload: unknown;
      try {
        approvedPayload = JSON.parse(approval.payload);
      } catch {
        throw new Error('MODAGPT_APPROVAL_PAYLOAD_INVALID');
      }
      if (!isRecord(approvedPayload)
        || approvedPayload.action !== 'update'
        || approvedPayload.quoteId !== rawInput.quoteId
        || typeof approvedPayload.fingerprint !== 'string'
        || !isRecord(approvedPayload.request)
        || stableJson(approvedPayload.request) !== stableJson({
          items: rawInput.items,
          ...(rawInput.currency ? { currency: rawInput.currency } : {}),
          notes: rawInput.notes?.trim() || null
        })) throw new Error('MODAGPT_APPROVAL_PAYLOAD_INVALID');
      if (approval.status === 'consumed') {
        const current = await input.prisma.salesQuote.findFirst({
          where: { id: rawInput.quoteId, merchantId },
          include: { items: true }
        });
        const requestedItems = rawInput.items;
        const alreadyApplied = current?.status === 'draft'
          && current.notes === (rawInput.notes?.trim() || null)
          && current.currency === (rawInput.currency || current.currency)
          && current.items.length === requestedItems.length
          && requestedItems.every(item => current.items.some(stored =>
            stored.productId === item.productId
            && stored.sku === item.sku
            && stored.quantity === item.quantity
            && Number(stored.unitPrice) === item.unitPrice
          ));
        if (!current || !alreadyApplied) throw new Error('MODAGPT_APPROVAL_ALREADY_USED');
        return {
          quoteId: current.id,
          status: current.status,
          totalQty: current.totalQty,
          totalAmount: Number(current.totalAmount),
          verified: true
        };
      }
      const currentQuote = await input.prisma.salesQuote.findFirst({
        where: { id: rawInput.quoteId, merchantId },
        include: { items: true }
      });
      if (!currentQuote) throw new Error('MODAGPT_QUOTE_NOT_FOUND');
      if (quoteSnapshotFingerprint(currentQuote) !== approvedPayload.fingerprint) {
        await input.prisma.modaGptApproval.updateMany({
          where: { id: approval.id, merchantId, status: 'approved' },
          data: { status: 'expired', decisionNote: 'Quote changed after approval.' }
        });
        throw new Error('MODAGPT_APPROVAL_STALE');
      }

      try {
        return await input.prisma.$transaction(async tx => {
        const quote = await tx.salesQuote.findFirst({
          where: { id: rawInput.quoteId, merchantId },
          include: { items: true }
        });
        if (!quote || quote.status !== 'draft') throw new Error('MODAGPT_QUOTE_NOT_EDITABLE');
        if (quoteSnapshotFingerprint(quote) !== approvedPayload.fingerprint) {
          throw new Error('MODAGPT_APPROVAL_STALE');
        }
        const customer = await tx.customer.findFirst({
          where: {
            id: quote.customerId,
            status: 'approved',
            OR: [
              { orders: { some: { merchantId } } },
              { vaultReqs: { some: { merchantId } } },
              { merchantLinks: { some: { merchantId } } }
            ]
          },
          select: { id: true }
        });
        if (!customer) throw new Error('MODAGPT_QUOTE_CUSTOMER_UNAVAILABLE');
        const productIds = [...new Set(rawInput.items.map(item => item.productId))];
        const products = await tx.product.findMany({
          where: { id: { in: productIds }, merchantId, lifecycleStatus: 'published' },
          select: { id: true, styleNo: true, name: true, moq: true, packSize: true, skus: true }
        });
        const productById = new Map(products.map(product => [product.id, product]));
        let totalQty = 0;
        let totalAmount = 0;
        const items = rawInput.items.map(item => {
          const product = productById.get(item.productId);
          if (!product) throw new Error('MODAGPT_QUOTE_PRODUCT_UNAVAILABLE');
          if (item.quantity < product.moq || item.quantity % Math.max(product.packSize, 1) !== 0) {
            throw new Error('MODAGPT_QUOTE_MOQ_OR_PACK_SIZE_INVALID');
          }
          let skus: Array<{ sku: string; color?: string; size?: string }>;
          try {
            const parsed: unknown = JSON.parse(product.skus);
            if (!Array.isArray(parsed)) throw new Error('invalid');
            skus = parsed.filter((candidate): candidate is { sku: string; color?: string; size?: string } =>
              isRecord(candidate) && typeof candidate.sku === 'string'
            );
          } catch {
            throw new Error('MODAGPT_QUOTE_PRODUCT_SKU_DATA_INVALID');
          }
          const sku = skus.find(candidate => candidate.sku === item.sku);
          if (!sku) throw new Error('MODAGPT_QUOTE_SKU_UNAVAILABLE');
          totalQty += item.quantity;
          totalAmount += item.quantity * item.unitPrice;
          return {
            productId: product.id,
            sku: item.sku,
            styleNo: product.styleNo,
            productName: product.name,
            color: sku.color || '',
            size: sku.size || '',
            quantity: item.quantity,
            unitPrice: item.unitPrice
          };
        });
        await assertExecutionLease();
        const changedQuote = await tx.salesQuote.updateMany({
          where: {
            id: quote.id,
            merchantId,
            status: 'draft',
            updatedAt: quote.updatedAt
          },
          data: {
            totalQty,
            totalAmount: Number(totalAmount.toFixed(2)),
            currency: rawInput.currency || quote.currency,
            notes: rawInput.notes?.trim() || null
          }
        });
        if (changedQuote.count !== 1) throw new Error('MODAGPT_APPROVAL_STALE');
        await tx.salesQuoteItem.deleteMany({ where: { quoteId: quote.id } });
        await tx.salesQuoteItem.createMany({
          data: items.map(item => ({ ...item, quoteId: quote.id }))
        });
        const claimed = await tx.modaGptApproval.updateMany({
          where: { id: approval.id, merchantId, status: 'approved', expiresAt: { gt: new Date() } },
          data: { status: 'consumed' }
        });
        if (claimed.count !== 1) throw new Error('MODAGPT_APPROVAL_ALREADY_USED');
        await tx.modaGptApproval.updateMany({
          where: {
            merchantId,
            resourceId: quote.id,
            id: { not: approval.id },
            toolId: { in: ['update_quote', 'submit_quote', 'send_quote'] },
            status: { in: ['pending', 'approved'] }
          },
          data: { status: 'expired', decisionNote: 'Quote changed after approval.' }
        });
        const verified = await tx.salesQuote.findFirst({
          where: { id: quote.id, merchantId, status: 'draft' },
          include: { items: true }
        });
        if (!verified
          || verified.totalQty !== totalQty
          || verified.currency !== (rawInput.currency || quote.currency)
          || Number(verified.totalAmount) !== Number(totalAmount.toFixed(2))
          || verified.items.length !== items.length) {
          throw new Error('MODAGPT_QUOTE_UPDATE_VERIFY_FAILED');
        }
        const verifiedItemsMatch = items.every(expected => verified.items.some(actual =>
          actual.productId === expected.productId
          && actual.sku === expected.sku
          && actual.quantity === expected.quantity
          && Number(actual.unitPrice) === expected.unitPrice
        ));
        if (!verifiedItemsMatch || verified.notes !== (rawInput.notes?.trim() || null)) {
          throw new Error('MODAGPT_QUOTE_UPDATE_VERIFY_FAILED');
        }
        return {
          quoteId: verified.id,
          status: verified.status,
          totalQty: verified.totalQty,
          totalAmount: Number(verified.totalAmount),
          verified: true
        };
        });
      } catch (error) {
        if (error instanceof Error && error.message === 'MODAGPT_APPROVAL_STALE') {
          await input.prisma.modaGptApproval.updateMany({
            where: { id: approval.id, merchantId, status: 'approved' },
            data: { status: 'expired', decisionNote: 'Quote changed after approval.' }
          });
        }
        throw error;
      }
    },
    submit_quote: async (merchantId, rawInput) => {
      if (!isQuoteActionInput(rawInput)) throw new Error('MODAGPT_QUOTE_ACTION_INPUT_INVALID');
      try {
        return await input.prisma.$transaction(async tx => {
        const { quote, approval } = await loadApprovedQuoteAction(tx, merchantId, rawInput, 'submit_quote');
        if (approval.status === 'consumed' && quote.status === 'approved') {
          return { quoteId: quote.id, status: quote.status, verified: true };
        }
        if (quote.status !== 'draft') throw new Error('MODAGPT_QUOTE_NOT_SUBMITTABLE');
        await assertExecutionLease();
        const submittedQuote = await tx.salesQuote.updateMany({
          where: { id: quote.id, merchantId, status: 'draft', updatedAt: quote.updatedAt },
          data: { status: 'approved' }
        });
        if (submittedQuote.count !== 1) throw new Error('MODAGPT_APPROVAL_STALE');
        const changed = await tx.modaGptApproval.updateMany({
          where: { id: approval.id, merchantId, status: 'approved', expiresAt: { gt: new Date() } },
          data: { status: 'consumed' }
        });
        if (changed.count !== 1) throw new Error('MODAGPT_APPROVAL_ALREADY_USED');
        await tx.modaGptApproval.updateMany({
          where: {
            merchantId,
            resourceId: quote.id,
            id: { not: approval.id },
            toolId: { in: ['update_quote', 'submit_quote', 'send_quote'] },
            status: { in: ['pending', 'approved'] }
          },
          data: { status: 'expired', decisionNote: 'Quote changed after approval.' }
        });
        const verified = await tx.salesQuote.findFirst({
          where: { id: quote.id, merchantId, status: 'approved' },
          include: { items: true }
        });
        const expected = { ...quote, status: 'approved' };
        if (!verified
          || verified.merchantId !== merchantId
          || verified.customerId !== quote.customerId
          || verified.totalQty !== quote.totalQty
          || Number(verified.totalAmount) !== Number(quote.totalAmount)
          || quoteSnapshotFingerprint(verified) !== quoteSnapshotFingerprint(expected)) {
          throw new Error('MODAGPT_QUOTE_SUBMIT_VERIFY_FAILED');
        }
        return { quoteId: verified.id, status: verified.status, verified: true };
        });
      } catch (error) {
        if (error instanceof Error && error.message === 'MODAGPT_APPROVAL_STALE') {
          await input.prisma.modaGptApproval.updateMany({
            where: { id: rawInput.approvalId, merchantId, status: 'approved' },
            data: { status: 'expired', decisionNote: 'Quote changed after approval.' }
          });
        }
        throw error;
      }
    },
    send_quote: async (merchantId, rawInput) => {
      if (!isQuoteActionInput(rawInput)) throw new Error('MODAGPT_QUOTE_ACTION_INPUT_INVALID');
      if (!input.sendQuote) throw new Error('MODAGPT_QUOTE_SEND_UNAVAILABLE');
      let approvedQuote: Awaited<ReturnType<typeof loadApprovedQuoteAction>>;
      try {
        approvedQuote = await loadApprovedQuoteAction(input.prisma, merchantId, rawInput, 'send_quote');
      } catch (error) {
        if (error instanceof Error && error.message === 'MODAGPT_APPROVAL_STALE') {
          await input.prisma.modaGptApproval.updateMany({
            where: {
              id: rawInput.approvalId,
              merchantId,
              status: { in: ['approved', 'processing'] }
            },
            data: { status: 'expired', decisionNote: 'Quote changed after approval.' }
          });
        }
        throw error;
      }
      const { quote, approval } = approvedQuote;
      if (quote.status === 'sent'
        && quote.deliveryStatus === 'SENT'
        && quote.sentAt
        && quote.sentRecipient
        && quote.sendProvider === 'resend'
        && quote.sendProviderMessageId) {
        return {
          quoteId: quote.id,
          status: 'sent',
          recipient: quote.sentRecipient,
          providerMessageId: quote.sendProviderMessageId,
          verified: true
        };
      }
      if (quote.status !== 'approved') throw new Error('MODAGPT_QUOTE_NOT_SENDABLE');
      if (!isCurrencyCode(quote.currency)) throw new Error('MODAGPT_QUOTE_CURRENCY_REQUIRED');
      if (quote.customer.status !== 'approved' || !quote.customer.email.trim()) {
        throw new Error('MODAGPT_QUOTE_RECIPIENT_UNAVAILABLE');
      }
      if (!input.traceId) throw new Error('MODAGPT_QUOTE_TRACE_ID_REQUIRED');
      await input.prisma.$transaction(async tx => {
        await assertExecutionLease();
        const claimed = await tx.modaGptApproval.updateMany({
          where: {
            id: approval.id,
            merchantId,
            status: { in: ['approved', 'processing'] },
            expiresAt: { gt: new Date() }
          },
          data: { status: 'processing' }
        });
        if (claimed.count !== 1) throw new Error('MODAGPT_APPROVAL_ALREADY_USED');
        const deliveryClaim = await tx.salesQuote.updateMany({
          where: {
            id: quote.id,
            merchantId,
            customerId: quote.customerId,
            status: 'approved',
            updatedAt: quote.updatedAt,
            OR: [{ deliveryStatus: null }, { deliveryStatus: 'FAILED' }, { deliveryStatus: 'SENDING' }]
          },
          data: {
            deliveryStatus: 'SENDING',
            sendProvider: 'resend',
            sentRecipient: quote.customer.email,
            sendTaskId: input.taskId,
            sendTraceId: input.traceId,
            sendFailureReason: null,
            sendError: null,
            sendResult: JSON.stringify({
              provider: 'resend',
              status: 'sending',
              taskId: input.taskId,
              traceId: input.traceId,
              attemptedAt: new Date().toISOString()
            })
          }
        });
        if (deliveryClaim.count !== 1) throw new Error('MODAGPT_QUOTE_SEND_CONCURRENT_UPDATE');
      });
      let delivery: { provider: string; providerMessageId: string };
      try {
        const current = await loadApprovedQuoteAction(input.prisma, merchantId, rawInput, 'send_quote');
        if (quoteSnapshotFingerprint(current.quote) !== approvedQuote.payload.fingerprint
          || current.quote.customer.email.trim().toLowerCase() !== approvedQuote.payload.recipient
          || current.quote.customer.status !== 'approved'
          || (current.quote.validUntil && current.quote.validUntil <= new Date())) {
          throw new Error('MODAGPT_APPROVAL_STALE');
        }
        await assertExecutionLease();
        delivery = await input.sendQuote(merchantId, {
          quoteId: quote.id,
          quoteNo: quote.quoteNo,
          taskId: input.taskId,
          traceId: input.traceId,
          customerId: quote.customerId,
          companyName: quote.customer.companyName,
          recipient: quote.customer.email,
          currency: quote.currency,
          totalAmount: Number(quote.totalAmount),
          validUntil: quote.validUntil,
          paymentTerms: quote.paymentTerms,
          deliveryTerms: quote.deliveryTerms,
          leadTimeDays: quote.leadTimeDays,
          items: quote.items.map(item => ({
            styleNo: item.styleNo,
            productName: item.productName,
            sku: item.sku,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice)
          }))
        }, approval.id, input.signal);
        if (delivery.provider !== 'resend' || !delivery.providerMessageId.trim()) {
          throw new Error('MODAGPT_QUOTE_SEND_PROVIDER_RESULT_INVALID');
        }
      } catch (error) {
        const failure = error instanceof Error ? error.message : 'MODAGPT_QUOTE_SEND_FAILED';
        await input.prisma.salesQuote.updateMany({
          where: {
            id: quote.id,
            merchantId,
            status: 'approved',
            deliveryStatus: 'SENDING',
            sendTaskId: input.taskId,
            sendTraceId: input.traceId
          },
          data: {
            deliveryStatus: 'FAILED',
            sentRecipient: quote.customer.email,
            sendProvider: 'resend',
            sendFailureReason: failure,
            sendError: failure,
            sendResult: JSON.stringify({
              provider: 'resend',
              status: 'failed',
              taskId: input.taskId,
              traceId: input.traceId,
              attemptedAt: new Date().toISOString(),
              failureReason: failure
            })
          }
        });
        await input.prisma.employeeAuditLog.create({
          data: {
            id: randomUUID(),
            merchantId,
            employeeId: input.employeeId,
            action: 'MODAGPT_QUOTE_SEND_FAILED',
            entityType: 'SalesQuote',
            entityId: quote.id,
            metadata: JSON.stringify({
              approvalId: approval.id,
              provider: 'resend',
              errorCode: failure,
              taskId: input.taskId,
              traceId: input.traceId
            }),
            ipAddress: null
          }
        });
        if (failure === 'MODAGPT_APPROVAL_STALE') {
          await input.prisma.modaGptApproval.updateMany({
            where: { id: approval.id, merchantId, status: 'processing' },
            data: { status: 'expired', decisionNote: 'Quote changed after approval.' }
          });
        }
        throw error;
      }
      const now = new Date();
      await input.prisma.$transaction(async tx => {
        const changed = await tx.salesQuote.updateMany({
          where: {
            id: quote.id,
            merchantId,
            customerId: quote.customerId,
            status: 'approved',
            deliveryStatus: 'SENDING',
            sendTaskId: input.taskId,
            sendTraceId: input.traceId
          },
          data: {
            status: 'sent',
            deliveryStatus: 'SENT',
            sentAt: now,
            sentRecipient: quote.customer.email,
            sendProvider: delivery.provider,
            sendProviderMessageId: delivery.providerMessageId,
            sendTaskId: input.taskId,
            sendTraceId: input.traceId,
            sendResult: JSON.stringify({
              provider: delivery.provider,
              providerMessageId: delivery.providerMessageId,
              status: 'SENT',
              taskId: input.taskId,
              traceId: input.traceId,
              recipientEmail: quote.customer.email,
              sentAt: now.toISOString()
            }),
            sendFailureReason: null,
            sendError: null
          }
        });
        if (changed.count !== 1) throw new Error('MODAGPT_QUOTE_SEND_CONCURRENT_UPDATE');
        const consumed = await tx.modaGptApproval.updateMany({
          where: { id: approval.id, merchantId, status: 'processing' },
          data: { status: 'consumed' }
        });
        if (consumed.count !== 1) throw new Error('MODAGPT_APPROVAL_ALREADY_USED');
        await tx.modaGptApproval.updateMany({
          where: {
            merchantId,
            resourceId: quote.id,
            id: { not: approval.id },
            toolId: { in: ['update_quote', 'submit_quote', 'send_quote'] },
            status: { in: ['pending', 'approved'] }
          },
          data: { status: 'expired', decisionNote: 'Quote changed after approval.' }
        });
        await tx.employeeAuditLog.create({
          data: {
            id: randomUUID(),
            merchantId,
            employeeId: input.employeeId,
            action: 'MODAGPT_QUOTE_SENT',
            entityType: 'SalesQuote',
            entityId: quote.id,
            metadata: JSON.stringify({
              approvalId: approval.id,
              provider: delivery.provider,
              providerMessageId: delivery.providerMessageId,
              recipientEmail: quote.customer.email,
              taskId: input.taskId,
              traceId: input.traceId
            }),
            ipAddress: null
          }
        });
      });
      const verified = await input.prisma.salesQuote.findFirst({
        where: { id: quote.id, merchantId, status: 'sent' },
        include: { items: true }
      });
      if (!verified
        || verified.merchantId !== merchantId
        || verified.customerId !== quote.customerId
        || verified.deliveryStatus !== 'SENT'
        || verified.sentRecipient !== quote.customer.email
        || verified.sendProvider !== delivery.provider
        || !verified.sentAt
        || verified.sendProviderMessageId !== delivery.providerMessageId
        || verified.sendTaskId !== input.taskId
        || verified.sendTraceId !== input.traceId
        || Number(verified.totalAmount) !== Number(quote.totalAmount)) {
        throw new Error('MODAGPT_QUOTE_SEND_VERIFY_FAILED');
      }
      return {
        quoteId: verified.id,
        status: verified.status,
        recipient: verified.sentRecipient,
        providerMessageId: verified.sendProviderMessageId,
        verified: true
      };
    },
    order_summary: async (merchantId, rawInput) => {
      if (!isBusinessPeriodInput(rawInput)) throw new Error('MODAGPT_ANALYTICS_INPUT_INVALID');
      const days = rawInput.days || 30;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1_000);
      const orders = await input.prisma.order.findMany({
        where: { merchantId, createdAt: { gte: since }, status: { notIn: ['cancelled', 'returned'] } },
        select: { id: true, status: true, paymentStatus: true, totalQty: true, totalAmount: true, refundAmount: true, createdAt: true },
        take: 2_000,
        orderBy: { createdAt: 'desc' }
      });
      const totalAmount = orders.reduce((sum, order) => sum + Number(order.totalAmount), 0);
      const recordedRefundAmount = orders.reduce((sum, order) => sum + Number(order.refundAmount || 0), 0);
      return {
        source: 'ruda_database',
        days,
        dataAvailable: orders.length > 0,
        orderCount: orders.length,
        totalUnits: orders.reduce((sum, order) => sum + order.totalQty, 0),
        totalAmount: Number(totalAmount.toFixed(2)),
        recordedRefundAmount: Number(recordedRefundAmount.toFixed(2)),
        amountAfterRecordedRefunds: Number((totalAmount - recordedRefundAmount).toFixed(2)),
        byStatus: countBy(orders.map(order => order.status)),
        byPaymentStatus: countBy(orders.map(order => order.paymentStatus)),
        truncated: orders.length === 2_000
      };
    },
    sales_summary: async (merchantId, rawInput) => {
      if (!isBusinessPeriodInput(rawInput)) throw new Error('MODAGPT_ANALYTICS_INPUT_INVALID');
      const days = rawInput.days || 30;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1_000);
      const orders = await input.prisma.order.findMany({
        where: { merchantId, createdAt: { gte: since }, status: { notIn: ['cancelled', 'returned'] } },
        select: { totalAmount: true, totalQty: true, refundAmount: true, createdAt: true },
        take: 2_000,
        orderBy: { createdAt: 'desc' }
      });
      const grossOrderAmount = orders.reduce((sum, order) => sum + Number(order.totalAmount), 0);
      const recordedRefundAmount = orders.reduce((sum, order) => sum + Number(order.refundAmount || 0), 0);
      return {
        source: 'ruda_database',
        days,
        dataAvailable: orders.length > 0,
        orderCount: orders.length,
        currency: null,
        grossSales: Number(grossOrderAmount.toFixed(2)),
        recordedRefundAmount: Number(recordedRefundAmount.toFixed(2)),
        amountAfterRecordedRefunds: Number((grossOrderAmount - recordedRefundAmount).toFixed(2)),
        unitsSold: orders.reduce((sum, order) => sum + order.totalQty, 0),
        averageOrderValue: orders.length
          ? Number((grossOrderAmount / orders.length).toFixed(2))
          : 0,
        truncated: orders.length === 2_000
      };
    },
    inventory_summary: async (merchantId, rawInput) => {
      if (!isBusinessPeriodInput(rawInput)) throw new Error('MODAGPT_ANALYTICS_INPUT_INVALID');
      const days = rawInput.days || 30;
      const balances = await input.prisma.inventoryBalance.findMany({
        where: { merchantId },
        select: {
          onHandQuantity: true,
          reservedQuantity: true,
          inTransitQuantity: true,
          variant: {
            select: {
              sku: true,
            product: { select: { id: true, name: true, merchantId: true, moq: true } }
            }
          }
        },
        take: 5_000
      });
      const tenantBalances = balances.filter(balance => balance.variant.product.merchantId === merchantId);
      return {
        source: 'ruda_database',
        days,
        dataAvailable: tenantBalances.length > 0,
        skuCount: tenantBalances.length,
        onHandUnits: tenantBalances.reduce((sum, balance) => sum + balance.onHandQuantity, 0),
        reservedUnits: tenantBalances.reduce((sum, balance) => sum + balance.reservedQuantity, 0),
        inTransitUnits: tenantBalances.reduce((sum, balance) => sum + balance.inTransitQuantity, 0),
        lowStockSkus: tenantBalances
          .filter(balance => balance.onHandQuantity - balance.reservedQuantity <= balance.variant.product.moq)
          .slice(0, 100)
          .map(balance => ({
            productId: balance.variant.product.id,
            productName: balance.variant.product.name,
            sku: balance.variant.sku,
            available: balance.onHandQuantity - balance.reservedQuantity,
            reorderThreshold: balance.variant.product.moq
          })),
        truncated: balances.length === 5_000
      };
    },
    product_performance: async (merchantId, rawInput) => {
      if (!isBusinessPeriodInput(rawInput)) throw new Error('MODAGPT_ANALYTICS_INPUT_INVALID');
      const days = rawInput.days || 30;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1_000);
      const items = await input.prisma.orderItem.findMany({
        where: {
          merchantId,
          order: { merchantId, createdAt: { gte: since }, status: { notIn: ['cancelled', 'returned'] } }
        },
        select: { productId: true, styleNo: true, productName: true, sku: true, quantity: true, unitPrice: true },
        take: 5_000
      });
      const products = new Map<string, {
        productId: string; styleNo: string; name: string; unitsSold: number; sales: number;
      }>();
      for (const item of items) {
        const key = item.productId || item.styleNo;
        const current = products.get(key) || {
          productId: item.productId,
          styleNo: item.styleNo,
          name: item.productName,
          unitsSold: 0,
          sales: 0
        };
        current.unitsSold += item.quantity;
        current.sales += item.quantity * Number(item.unitPrice);
        products.set(key, current);
      }
      return {
        source: 'ruda_database',
        days,
        dataAvailable: items.length > 0,
        sourceItemCount: items.length,
        products: [...products.values()]
          .map(product => ({ ...product, sales: Number(product.sales.toFixed(2)) }))
          .sort((left, right) => right.sales - left.sales)
          .slice(0, 50),
        truncated: items.length === 5_000 || products.size > 50
      };
    },
    customer_performance: async (merchantId, rawInput) => {
      if (!isBusinessPeriodInput(rawInput)) throw new Error('MODAGPT_ANALYTICS_INPUT_INVALID');
      const days = rawInput.days || 30;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1_000);
      const orders = await input.prisma.order.findMany({
        where: {
          merchantId,
          createdAt: { gte: since },
          status: { notIn: ['cancelled', 'returned'] },
          customerId: { not: null }
        },
        select: { customerId: true, companyName: true, totalAmount: true, totalQty: true },
        take: 2_000
      });
      const customers = new Map<string, {
        customerId: string; companyName: string; orderCount: number; sales: number; units: number;
      }>();
      for (const order of orders) {
        if (!order.customerId) continue;
        const current = customers.get(order.customerId) || {
          customerId: order.customerId,
          companyName: order.companyName,
          orderCount: 0,
          sales: 0,
          units: 0
        };
        current.orderCount += 1;
        current.sales += Number(order.totalAmount);
        current.units += order.totalQty;
        customers.set(order.customerId, current);
      }
      return {
        source: 'ruda_database',
        days,
        dataAvailable: orders.length > 0,
        sourceOrderCount: orders.length,
        customers: [...customers.values()]
          .map(customer => ({ ...customer, sales: Number(customer.sales.toFixed(2)) }))
          .sort((left, right) => right.sales - left.sales)
          .slice(0, 50),
        truncated: orders.length === 2_000 || customers.size > 50
      };
    },
    finance_summary: async (merchantId, rawInput) => {
      if (!isBusinessPeriodInput(rawInput)) throw new Error('MODAGPT_ANALYTICS_INPUT_INVALID');
      const days = rawInput.days || 30;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1_000);
      const invoices = await input.prisma.orderInvoice.findMany({
        where: { merchantId, issueDate: { gte: since } },
        select: { id: true, status: true, totalAmount: true, currency: true },
        take: 2_000
      });
      const totalsByStatusAndCurrency = invoices.reduce<Record<string, Record<string, number>>>((totals, invoice) => {
        totals[invoice.status] ||= {};
        totals[invoice.status][invoice.currency] =
          (totals[invoice.status][invoice.currency] || 0) + Number(invoice.totalAmount);
        return totals;
      }, {});
      return {
        source: 'ruda_database',
        days,
        dataAvailable: invoices.length > 0,
        invoiceCount: invoices.length,
        totalsByStatusAndCurrency: Object.fromEntries(Object.entries(totalsByStatusAndCurrency)
          .map(([status, totals]) => [
            status,
            Object.fromEntries(Object.entries(totals).map(([currency, amount]) => [
              currency,
              Number(amount.toFixed(2))
            ]))
          ])),
        byStatus: countBy(invoices.map(invoice => invoice.status)),
        truncated: invoices.length === 2_000
      };
    },
    get_suppliers: async (merchantId, rawInput) => {
      const query = (isRecord(rawInput) && typeof rawInput.query === 'string' ? rawInput.query : '').trim();
      const suppliers = await input.prisma.supplier.findMany({
        where: {
          merchantId,
          status: 'active',
          ...(query ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { contactName: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } }
            ]
          } : {})
        },
        take: 20,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, name: true, contactName: true, country: true, email: true, leadTimeDays: true }
      });
      return { suppliers };
    },
    create_procurement_draft: async (merchantId, rawInput) => {
      if (!isProcurementDraftInput(rawInput)) throw new Error('MODAGPT_PROCUREMENT_DRAFT_INPUT_INVALID');
      const supplier = await input.prisma.supplier.findFirst({
        where: { id: rawInput.supplierId, merchantId, status: 'active' },
        select: { id: true }
      });
      if (!supplier) throw new Error('MODAGPT_SUPPLIER_UNAVAILABLE');

      const idempotencyKey = `modaui-procurement:${merchantId}:${input.taskId}`;
      const payloadHash = createHash('sha256').update(stableJson(rawInput)).digest('hex');
      const stablePoId = createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 32);
      const procurement = await input.prisma.$transaction(async tx => {
        const previouslyCreated = await tx.merchantPurchaseOrder.findUnique({
          where: { idempotencyKey },
          include: { items: true }
        });
        if (previouslyCreated) {
          if (previouslyCreated.merchantId !== merchantId || previouslyCreated.payloadHash !== payloadHash) {
            throw new Error('MODAGPT_PROCUREMENT_IDEMPOTENCY_CONFLICT');
          }
          return previouslyCreated;
        }

        const productIds = [...new Set(rawInput.items.map(item => item.productId))];
        const products = await tx.product.findMany({
          where: { id: { in: productIds }, merchantId },
          select: { id: true, name: true, styleNo: true, variants: { select: { id: true, sku: true, color: true, size: true } } }
        });

        const productMap = new Map(products.map(p => [p.id, p]));
        const poItems = [];

        for (const item of rawInput.items) {
          const product = productMap.get(item.productId);
          if (!product) throw new Error('MODAGPT_PRODUCT_UNAVAILABLE');
          const variant = product.variants.find(variant => variant.id === item.variantId);
          if (!variant) throw new Error('MODAGPT_VARIANT_UNAVAILABLE');

          poItems.push({
            productId: product.id,
            variantId: variant.id,
            styleNo: product.styleNo,
            productName: product.name,
            sku: variant.sku,
            color: variant.color,
            size: variant.size,
            orderedQuantity: item.quantity,
            unitCost: item.unitCost
          });
        }

        await assertExecutionLease();
        const created = await tx.merchantPurchaseOrder.create({
          data: {
            id: stablePoId,
            purchaseOrderNo: `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomUUID().slice(0, 8).toUpperCase()}`,
            merchantId,
            supplierId: supplier.id,
            status: 'draft',
            idempotencyKey,
            payloadHash,
            currency: rawInput.currency || 'EUR',
            notes: rawInput.notes || null,
            createdBy: input.employeeId || input.actorId,
            items: { create: poItems }
          },
          include: { items: true }
        });
        return created;
      });

      return {
        purchaseOrderId: procurement.id,
        purchaseOrderNo: procurement.purchaseOrderNo,
        status: procurement.status,
        totalAmount: calculateProcurementTotal(procurement.items.map(item => ({
          quantity: item.orderedQuantity,
          unitCost: item.unitCost
        })))
      };
    },
    get_supplier_performance: async (merchantId, rawInput) => {
      if (!isRecord(rawInput) || typeof rawInput.supplierId !== 'string') throw new Error('MODAGPT_TOOL_INPUT_INVALID');
      const supplier = await input.prisma.supplier.findUnique({
        where: { id: rawInput.supplierId },
        select: { id: true, name: true, merchantId: true }
      });
      if (!supplier || supplier.merchantId !== merchantId) throw new Error('MODAGPT_SUPPLIER_NOT_FOUND');

      const orders = await input.prisma.merchantPurchaseOrder.findMany({
        where: { supplierId: supplier.id, merchantId, status: { in: ['ordered', 'partially_received', 'received'] } },
        include: { receipts: { include: { items: true } }, items: true },
        orderBy: { createdAt: 'desc' },
        take: 50
      });

      const totalOrders = orders.length;
      if (totalOrders === 0) {
        return {
          supplierId: supplier.id,
          metrics: { totalOrders: 0, fulfillmentRate: 0, averageLeadTimeDays: 0, ordersWithLeadTime: 0, recentOrderCount: 0 }
        };
      }

      let fulfilledItems = 0;
      let totalOrderedItems = 0;
      let totalLeadTime = 0;
      let ordersWithLeadTime = 0;

      for (const order of orders) {
        for (const item of order.items) {
          if (!Number.isInteger(item.orderedQuantity)
            || item.orderedQuantity < 0
            || !Number.isInteger(item.receivedQuantity)
            || item.receivedQuantity < 0
            || item.receivedQuantity > item.orderedQuantity) {
            throw new Error('MODAGPT_SUPPLIER_PERFORMANCE_DATA_INVALID');
          }
          totalOrderedItems += item.orderedQuantity;
          fulfilledItems += item.receivedQuantity;
        }

        if (order.status === 'received'
          && order.items.some(item => item.receivedQuantity !== item.orderedQuantity)) {
          throw new Error('MODAGPT_SUPPLIER_PERFORMANCE_DATA_INVALID');
        }

        if (order.status === 'received' && order.orderedAt && order.receipts.length > 0) {
          const lastReceipt = order.receipts.reduce((latest, receipt) =>
            receipt.receivedAt > latest.receivedAt ? receipt : latest
          );
          const leadTime = (lastReceipt.receivedAt.getTime() - order.orderedAt.getTime()) / (1000 * 60 * 60 * 24);
          if (leadTime < 0) throw new Error('MODAGPT_SUPPLIER_PERFORMANCE_DATA_INVALID');
          totalLeadTime += leadTime;
          ordersWithLeadTime++;
        }
      }

      return {
        supplierId: supplier.id,
        metrics: {
          totalOrders,
          fulfillmentRate: totalOrderedItems > 0 ? Number((fulfilledItems / totalOrderedItems).toFixed(4)) : 0,
          averageLeadTimeDays: ordersWithLeadTime > 0 ? Number((totalLeadTime / ordersWithLeadTime).toFixed(1)) : 0,
          ordersWithLeadTime,
          recentOrderCount: orders.length
        }
      };
    },
    currency_convert: async (_merchantId, rawInput, signal) => {
      if (!isCurrencyConvertInput(rawInput)) throw new Error('MODAGPT_CURRENCY_INPUT_INVALID');
      const { amount, from, to } = rawInput;
      if (from === to) {
        return {
          amount: Number(amount.toFixed(2)),
          from,
          currency: to,
          rate: 1,
          rateSource: 'identity',
          rateDate: null,
          rateType: 'identity'
        };
      }

      if (!isExchangeRateCurrency(from) || !isExchangeRateCurrency(to)) {
        throw new Error('MODAGPT_CURRENCY_NOT_SUPPORTED');
      }
      const rates = await (input.fetchExchangeRates || fetchLatestExchangeRates)({ signal: signal || input.signal });
      const fromRate = rates.rates[from];
      const toRate = rates.rates[to];
      const rate = toRate / fromRate;
      const convertedAmount = amount * rate;
      if (!Number.isFinite(rate) || rate <= 0 || !Number.isFinite(convertedAmount)) {
        throw new Error('MODAGPT_CURRENCY_CONVERSION_INVALID');
      }
      return {
        amount: Number(convertedAmount.toFixed(2)),
        from,
        currency: to,
        rate: Number(rate.toFixed(8)),
        rateSource: rates.source,
        rateDate: rates.rateDate,
        rateType: 'daily_reference'
      };
    }
  };
  return { definitions, handlers };
}

export function parseProductFactsFromRequest(message: string): {
  name: string | null;
  wholesalePrice: number | null;
  moq: number | null;
} {
  const nameMatch = /(?:上架|创建|新增)(?:这件|这个|一件|一款)?\s*(.{2,80}?)(?=\s*[，,。；;]|批发价|MOQ|起订量|尺码|颜色|$)/i.exec(message);
  const priceMatch = /(?:批发价|批发价格|wholesale(?:\s+price)?)\s*[:：]?\s*[€$]?\s*(\d+(?:\.\d{1,2})?)/i.exec(message);
  const moqMatch = /(?:MOQ|起订量|最低起订量)\s*[:：]?\s*(\d{1,6})/i.exec(message);
  return {
    name: nameMatch?.[1]?.trim() || null,
    wholesalePrice: priceMatch ? Number(priceMatch[1]) : null,
    moq: moqMatch ? Number(moqMatch[1]) : null
  };
}

export function parseQuoteFactsFromRequest(message: string): {
  customerQuery: string | null;
  productQuery: string | null;
  quantity: number | null;
  unitPrice: number | null;
  currency: string | null;
  discountPercent: number | null;
} {
  const customerMatch = /(?:给客户|客户)\s*([^，,。;；]+)/i.exec(message);
  const customerQuery = customerMatch?.[1]
    ?.replace(/\s*(?:做|创建|准备|生成)\s*(?:一个)?\s*报价.*$/i, '')
    .trim() || null;
  const productMatch = /(?:报价\s*[，,:：]?\s*|给客户[^，,。]*[，,]\s*)([^，,。]+?)(?=\s*\d{1,6}\s*(?:件|pcs|pieces))/i.exec(message);
  const quantityMatch = /(\d{1,6})\s*(?:件|pcs|pieces)/i.exec(message);
  const priceMatch = /(?:每件|单价|unit\s+price)\s*[:：]?\s*[€$]?\s*(\d{1,8}(?:[.,]\d{1,2})?)\s*(€|eur|usd|gbp|欧元|美元|英镑)/i.exec(message);
  const discountMatch = /(?:打|折扣|discount)\s*[:：]?\s*(\d{1,2}(?:\.\d+)?)\s*%/i.exec(message);
  const currencyText = priceMatch?.[2]?.toLowerCase();
  const currency = currencyText
    ? ({ '€': 'EUR', eur: 'EUR', 欧元: 'EUR', usd: 'USD', 美元: 'USD', gbp: 'GBP', 英镑: 'GBP' } as Record<string, string>)[currencyText] || null
    : null;
  const price = priceMatch ? Number(priceMatch[1].replace(',', '.')) : null;
  return {
    customerQuery,
    productQuery: productMatch?.[1]?.trim() || null,
    quantity: quantityMatch ? Number(quantityMatch[1]) : null,
    unitPrice: price !== null && Number.isFinite(price) && price > 0 ? price : null,
    currency,
    discountPercent: discountMatch ? Number(discountMatch[1]) : null
  };
}

export async function executeModaGptMerchantDraftWorkflow(input: {
  workflow: 'product_publish' | 'customer_quote_creation';
  context: ModaGptAgentContext;
  runtime: ReturnType<typeof import('./modagptRuntime').createModaGptToolRuntime>;
  inputs: Record<string, unknown>;
  message: string;
}): Promise<{
  status: 'needs_input' | 'draft_created';
  summary: string;
  employee: ModaGptAgentRole;
  steps: string[];
  toolCalls: Array<{ toolId: string; status: 'succeeded' }>;
  artifacts: string[];
  approvalRequired: boolean;
  approvalId: string | null;
  errors: string[];
}> {
  if (input.workflow === 'product_publish') {
    const action = typeof input.inputs.productAction === 'string' ? input.inputs.productAction : 'draft';
    const productInput = action === 'update' && isRecord(input.inputs.product)
      ? { ...input.inputs.product, productId: input.inputs.productId }
      : input.inputs.product;
    if (action === 'update' && !isProductUpdateInput(productInput)) {
      return {
        status: 'needs_input',
        summary: '请提供目标商品 ID，以及完整的款号、名称、商家分类、子分类、季节、批发价、零售价、MOQ、装箱数、描述和 SKU。',
        employee: 'product-creative-manager',
        steps: ['检查草稿更新所需资料'],
        toolCalls: [],
        artifacts: [],
        approvalRequired: false,
        approvalId: null,
        errors: []
      };
    }
    if (action !== 'update' && !isProductDraftInput(input.inputs.product)) {
      const parsed = parseProductFactsFromRequest(input.message);
      return {
        status: 'needs_input',
        summary: `${parsed.name ? `已识别商品名称“${parsed.name}”` : '尚未识别商品名称'}${parsed.wholesalePrice !== null ? `、批发价 ${parsed.wholesalePrice}` : ''}${parsed.moq !== null ? `、MOQ ${parsed.moq}` : ''}。请补充款号、商家分类、子分类、季节、零售价、装箱数和明确 SKU 规格；不会猜测这些商业字段。`,
        employee: 'product-creative-manager',
        steps: ['检查商品资料完整性'],
        toolCalls: [],
        artifacts: [],
        approvalRequired: false,
        approvalId: null,
        errors: []
      };
    }
    const handoff = await runModaGptAgentHandoff({
      context: input.context,
      agentId: 'product-creative-manager',
      outputKey: action === 'update' ? 'productDraftUpdate' : 'productDraft',
      decision: action === 'update'
        ? 'Validate supplied product facts and update only the merchant-owned private product draft.'
        : 'Validate supplied product facts and create a private draft for merchant review.',
      execute: async context => {
        const created = await input.runtime.execute({
          taskId: context.task_id,
          tenantId: context.tenant_id,
          agentId: 'product-creative-manager',
          toolId: action === 'update' ? 'update_product_draft' : 'create_product_draft',
          input: productInput
        });
        const writeTool = action === 'update' ? 'update_product_draft' : 'create_product_draft';
        if (!verifyModaGptMerchantToolResult(writeTool, created.result)) {
          throw new Error('MODAGPT_PRODUCT_DRAFT_VERIFICATION_FAILED');
        }
        const output = created.result as { productId: string; styleNo: string; name: string; lifecycleStatus: string };
        const readback = await input.runtime.execute({
          taskId: context.task_id,
          tenantId: context.tenant_id,
          agentId: 'product-creative-manager',
          toolId: 'get_products',
          input: { query: output.styleNo }
        });
        const products = (readback.result as { products: Array<{ id: string; lifecycleStatus: string }> }).products;
        if (!products.some(product => product.id === output.productId && product.lifecycleStatus === 'draft')) {
          throw new Error('MODAGPT_PRODUCT_DRAFT_READBACK_FAILED');
        }
        return {
          output: { ...output, verified: true },
          toolResults: [
            { toolId: writeTool, result: created.result },
            { toolId: 'get_products', result: readback.result }
          ],
          artifacts: [`Product:${output.productId}`]
        };
      }
    });
    return {
      status: 'draft_created',
      summary: action === 'update'
        ? `已更新并验证商品草稿 ${handoff.output.productId}。尚未发布；请在 RUDA 商品管理中检查商品并补齐图片。`
        : `已创建商品草稿“${handoff.output.name}”（${handoff.output.styleNo}）。草稿仅商家可见，尚未发布；请在 RUDA 商品管理中审核并补齐图片后再上架。`,
      employee: 'product-creative-manager',
      steps: ['Supervisor 选择商品与创意经理', '校验商品必填资料和租户分类', '创建 RUDA 私有商品草稿', '读取商品记录并验证草稿状态'],
      toolCalls: [
        { toolId: action === 'update' ? 'update_product_draft' : 'create_product_draft', status: 'succeeded' },
        { toolId: 'get_products', status: 'succeeded' }
      ],
      artifacts: [`Product:${handoff.output.productId}`],
      approvalRequired: false,
      approvalId: null,
      errors: []
    };
  }

  const quoteInput = input.inputs.quote;
  if (!isQuoteDraftInput(quoteInput)) {
    const facts = parseQuoteFactsFromRequest(input.message);
    const customerQuery = typeof input.inputs.customerQuery === 'string'
      ? input.inputs.customerQuery.trim()
      : facts.customerQuery || '';
    const productQuery = typeof input.inputs.productQuery === 'string'
      ? input.inputs.productQuery.trim()
      : facts.productQuery || '';
    const toolCalls: Array<{ toolId: string; status: 'succeeded' }> = [];
    let customerCandidates: unknown[] = [];
    let productCandidates: unknown[] = [];
    if (customerQuery) {
      const searched = await input.runtime.execute({
        taskId: input.context.task_id,
        tenantId: input.context.tenant_id,
        agentId: 'sales-customer-manager',
        toolId: 'get_customers',
        input: { query: customerQuery }
      });
      input.context.tool_results.push({ tool_id: 'get_customers', result: searched.result });
      customerCandidates = (searched.result as { customers: unknown[] }).customers;
      toolCalls.push({ toolId: 'get_customers', status: 'succeeded' });
    }
    if (productQuery) {
      const searched = await input.runtime.execute({
        taskId: input.context.task_id,
        tenantId: input.context.tenant_id,
        agentId: 'sales-customer-manager',
        toolId: 'get_products',
        input: { query: productQuery }
      });
      input.context.tool_results.push({ tool_id: 'get_products', result: searched.result });
      productCandidates = (searched.result as { products: unknown[] }).products;
      toolCalls.push({ toolId: 'get_products', status: 'succeeded' });
    }
    const candidateSummary = [
      customerCandidates.length
        ? `客户候选：${customerCandidates.map(candidate => isRecord(candidate)
          ? `${String(candidate.companyName)}（${String(candidate.id)}）`
          : '').filter(Boolean).join('、')}。请确认客户 ID。`
        : '',
      productCandidates.length
        ? `商品候选：${productCandidates.map(candidate => isRecord(candidate)
          ? `${String(candidate.name)}（${String(candidate.styleNo)} / ${String(candidate.id)}；SKU：${Array.isArray(candidate.skus)
            ? candidate.skus.map(sku => isRecord(sku) ? String(sku.sku) : '').filter(Boolean).join(', ')
            : '不可用'}；MOQ ${String(candidate.moq)}；装箱 ${String(candidate.packSize)}）`
          : '').filter(Boolean).join('、')}。请确认商品 ID 和 SKU。`
        : ''
    ].filter(Boolean).join(' ');
    const explicitlyExtracted = [
      facts.quantity !== null ? `数量 ${facts.quantity}` : '',
      facts.unitPrice !== null ? `用户明确提供单价 ${facts.unitPrice}${facts.currency ? ` ${facts.currency}` : ''}` : '',
      facts.discountPercent !== null ? `用户明确提供折扣 ${facts.discountPercent}%` : ''
    ].filter(Boolean).join('；');
    return {
      status: 'needs_input',
      summary: `${candidateSummary}${explicitlyExtracted ? ` 已识别：${explicitlyExtracted}。` : ''} 请确认客户、已发布商品、SKU 与数量；报价草稿使用 RUDA 持久化价格。任何自定义价格或折扣必须通过单独审批，币种未在报价记录中明确时不会推断。`,
      employee: 'sales-customer-manager',
      steps: [
        '从自然语言提取客户、商品、数量和明确给定的金额事实',
        ...(customerQuery ? ['通过租户范围 Customer Tool 搜索已关联客户'] : []),
        ...(productQuery ? ['通过租户范围 Product Tool 搜索商品及其 SKU'] : []),
        '等待商家确认 ID、SKU 和财务条件；不创建不完整报价'
      ],
      toolCalls,
      artifacts: [],
      approvalRequired: false,
      approvalId: null,
      errors: []
    };
  }

  const handoff = await runModaGptAgentHandoff({
    context: input.context,
    agentId: 'sales-customer-manager',
    outputKey: 'quoteDraft',
    decision: 'Use only an approved merchant-linked customer, published merchant products, configured MOQ and persisted customer discount to create a draft quote.',
    execute: async context => {
      const created = await input.runtime.execute({
        taskId: context.task_id,
        tenantId: context.tenant_id,
        agentId: 'sales-customer-manager',
        toolId: 'create_quote_draft',
        input: quoteInput
      });
      if (!verifyModaGptMerchantToolResult('create_quote_draft', created.result)) {
        throw new Error('MODAGPT_QUOTE_DRAFT_VERIFICATION_FAILED');
      }
      const output = created.result as {
        quoteId: string;
        quoteNo: string;
        status: string;
        totalQty: number;
        totalAmount: number;
        currency: string | null;
      };
      const readback = await input.runtime.execute({
        taskId: context.task_id,
        tenantId: context.tenant_id,
        agentId: 'sales-customer-manager',
        toolId: 'get_quote',
        input: { quoteId: output.quoteId }
      });
      const quote = (readback.result as { quote: { status: string; totalAmount: number; currency: string | null } | null }).quote;
      if (!quote
        || quote.status !== 'draft'
        || quote.totalAmount !== output.totalAmount
        || quote.currency !== output.currency) {
        throw new Error('MODAGPT_QUOTE_DRAFT_READBACK_FAILED');
      }
      return {
        output: { ...output, verified: true },
        toolResults: [
          { toolId: 'create_quote_draft', result: created.result },
          { toolId: 'get_quote', result: readback.result }
        ],
        artifacts: [`SalesQuote:${output.quoteId}`]
      };
    }
  });
  return {
    status: 'draft_created',
    summary: `已创建报价草稿 ${handoff.output.quoteNo}，共 ${handoff.output.totalQty} 件，金额 ${handoff.output.totalAmount.toFixed(2)}${handoff.output.currency ? ` ${handoff.output.currency}` : '（币种待确认）'}。草稿尚未发送客户；发送、价格变更或正式提交需另行审核。`,
    employee: 'sales-customer-manager',
    steps: ['Supervisor 选择销售与客户经理', '校验客户授权关系、商品归属、SKU、MOQ 与装箱数', '使用 RUDA 客户折扣创建报价草稿', '重新读取报价并核对状态与总额'],
    toolCalls: [
      { toolId: 'create_quote_draft', status: 'succeeded' },
      { toolId: 'get_quote', status: 'succeeded' }
    ],
    artifacts: [`SalesQuote:${handoff.output.quoteId}`],
    approvalRequired: false,
    approvalId: null,
    errors: []
  };
}

export function verifyModaGptMerchantToolResult(toolId: string, result: unknown): boolean {
  if (!isRecord(result)) return false;
  if (toolId === 'create_product_draft' || toolId === 'update_product_draft') {
    return typeof result.productId === 'string'
      && result.lifecycleStatus === 'draft'
      && typeof result.styleNo === 'string';
  }
  if (toolId === 'create_quote_draft') {
    return typeof result.quoteId === 'string'
      && result.status === 'draft'
      && Number.isInteger(result.totalQty)
      && typeof result.totalAmount === 'number'
      && result.totalAmount >= 0
      && (result.currency === null || isCurrencyCode(result.currency));
  }
  return false;
}
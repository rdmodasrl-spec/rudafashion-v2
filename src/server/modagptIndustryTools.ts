import type { PrismaClient } from '@prisma/client';
import {
  getMerchantIndustryTemplate,
  type MerchantIndustryTemplateId
} from '../constants/merchantIndustryTemplates';
import type { ModaGptToolDefinition } from './modagptRuntime';
import { getModaGptIndustryTemplateAssistantProfile } from './modagptCoreEmployees';

type ToolHandler = (merchantId: string, value: unknown, signal: AbortSignal) => Promise<unknown>;
type IndustryAnalysisInput = { days?: number };
type ProductRow = {
  id: string;
  styleNo: string;
  name: string;
  category: string;
  packaging: string;
  fabric: string;
  industryAttributes: string | null;
  variants: Array<{ sku: string; barcode: string | null; isActive: boolean }>;
};
type ProductReviewItem = { styleNo: string; name: string; missingFields: string[] };

const objectSchema = { type: 'object', additionalProperties: false } as const;
const PRODUCT_ROW_LIMIT = 5_000;
const STORE_ROW_LIMIT = 100;
const STOCK_ROW_LIMIT = 20_000;
const SALE_ROW_LIMIT = 5_000;
const RETAIL_BALANCE_ROW_LIMIT = 5_000;
const RETAIL_SALE_ITEM_LIMIT = 100;
const RETAIL_REPLENISHMENT_TARGET_DAYS = 14;
const RETAIL_REPLENISHMENT_LIMIT = 20;
const analysisTemplates = [
  'department_wholesale',
  'bags_wholesale',
  'department_chain_retail',
  'general_retail'
] as const satisfies readonly MerchantIndustryTemplateId[];

export function resolveModaGptIndustryTemplate(input: {
  industry: unknown;
  industryTemplate: unknown;
}): MerchantIndustryTemplateId | null {
  if (input.industryTemplate === undefined || input.industryTemplate === null || input.industryTemplate === '') {
    return null;
  }
  const template = getMerchantIndustryTemplate(input.industryTemplate);
  if (!template) throw new Error('MODAGPT_INDUSTRY_TEMPLATE_INVALID');
  if (typeof input.industry !== 'string'
    || template.merchantIndustry !== input.industry.trim().toUpperCase()) {
    throw new Error('MODAGPT_INDUSTRY_TEMPLATE_MISMATCH');
  }
  return template.id;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isIndustryAnalysisInput(value: unknown): value is IndustryAnalysisInput {
  return isRecord(value)
    && Object.keys(value).every(key => key === 'days')
    && (value.days === undefined
      || (Number.isSafeInteger(value.days) && Number(value.days) >= 1 && Number(value.days) <= 365));
}

function parseAttributes(value: string | null): { attributes: Record<string, unknown>; invalid: boolean } {
  if (!value) return { attributes: {}, invalid: false };
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) return { attributes: {}, invalid: true };
    return { attributes: parsed, invalid: false };
  } catch {
    return { attributes: {}, invalid: true };
  }
}

function hasValue(value: unknown): boolean {
  return typeof value === 'string' ? value.trim().length > 0 : value !== null && value !== undefined;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function summarizeProductReviews(totalCount: number, items: ProductReviewItem[]): string {
  if (!totalCount) return '商品资料字段检查未发现缺项。';
  const examples = items.slice(0, 5).map(item =>
    `${item.styleNo || '无款号'} ${item.name || '未命名商品'}（缺${item.missingFields.join('、')}）`
  );
  const remaining = totalCount - examples.length;
  return `待完善商品 ${totalCount} 件：${examples.join('；')}${remaining ? `；另有 ${remaining} 件未在摘要展开` : ''}。`;
}

function isValidIndustryOutput(value: unknown, templateId: MerchantIndustryTemplateId): boolean {
  return isRecord(value)
    && value.source === 'ruda_database'
    && value.industryTemplate === templateId
    && typeof value.dataAvailable === 'boolean'
    && typeof value.truncated === 'boolean'
    && typeof value.summary === 'string'
    && value.summary.length > 0;
}

function createDefinition(
  name: string,
  description: string,
  templateId: MerchantIndustryTemplateId
): ModaGptToolDefinition {
  return {
    name,
    description,
    inputSchema: {
      ...objectSchema,
      properties: { days: { type: 'integer', minimum: 1, maximum: 365 } }
    },
    outputSchema: {
      type: 'object',
      required: ['source', 'industryTemplate', 'dataAvailable', 'truncated', 'summary']
    },
    permission: 'business.analytics.read',
    riskLevel: 'LOW',
    requiresApproval: false,
    timeoutMs: 20_000,
    retryPolicy: { maxAttempts: 1, idempotent: true },
    auditPolicy: 'required',
    validateInput: isIndustryAnalysisInput,
    validateOutput: value => isValidIndustryOutput(value, templateId)
  };
}

async function loadProducts(prisma: PrismaClient, merchantId: string): Promise<ProductRow[]> {
  return prisma.product.findMany({
    where: { merchantId },
    orderBy: { updatedAt: 'desc' },
    take: PRODUCT_ROW_LIMIT,
    select: {
      id: true,
      styleNo: true,
      name: true,
      category: true,
      packaging: true,
      fabric: true,
      industryAttributes: true,
      variants: {
        where: { isActive: true },
        select: { sku: true, barcode: true, isActive: true },
        take: 500
      }
    }
  });
}

function summarizeDepartmentCatalog(products: ProductRow[], merchantId: string) {
  let invalidAttributeRows = 0;
  let productsNeedingReviewCount = 0;
  const productsNeedingReview: ProductReviewItem[] = [];
  const missing = { category: 0, specification: 0, unit: 0, packaging: 0, barcode: 0 };
  let activeVariantCount = 0;
  let productsWithVariant = 0;
  for (const product of products) {
    const { attributes, invalid } = parseAttributes(product.industryAttributes);
    if (invalid) invalidAttributeRows += 1;
    const variants = product.variants.filter(variant => variant.isActive);
    const missingFields: string[] = [];
    activeVariantCount += variants.length;
    if (variants.length) productsWithVariant += 1;
    if (!hasValue(product.category)) {
      missing.category += 1;
      missingFields.push('分类');
    }
    if (!hasValue(attributes.spec)) {
      missing.specification += 1;
      missingFields.push('规格');
    }
    if (!hasValue(attributes.unit)) {
      missing.unit += 1;
      missingFields.push('计量单位');
    }
    if (!hasValue(product.packaging) && !hasValue(attributes.packaging)) {
      missing.packaging += 1;
      missingFields.push('包装');
    }
    if (!variants.some(variant => hasValue(variant.barcode)) && !hasValue(attributes.barcode)) {
      missing.barcode += 1;
      missingFields.push('条码');
    }
    if (invalid) missingFields.push('行业属性 JSON');
    if (missingFields.length) {
      productsNeedingReviewCount += 1;
      if (productsNeedingReview.length < 20) {
        productsNeedingReview.push({
          styleNo: product.styleNo,
          name: product.name,
          missingFields
        });
      }
    }
  }
  const dataAvailable = products.length > 0;
  const summary = dataAvailable
    ? `百货批发目录读取 ${products.length} 件商品、${activeVariantCount} 个启用 SKU；缺分类 ${missing.category} 件、规格 ${missing.specification} 件、单位 ${missing.unit} 件、包装 ${missing.packaging} 件、条码 ${missing.barcode} 件。${summarizeProductReviews(productsNeedingReviewCount, productsNeedingReview)}${invalidAttributeRows ? `${invalidAttributeRows} 件商品的行业属性 JSON 无效，需人工核对。` : ''}未发现可验证的单位换算关系，不进行换算。`
    : '百货批发商品目录暂无数据；未执行单位换算。';
  return {
    source: 'ruda_database',
    merchantId,
    industryTemplate: 'department_wholesale',
    dataAvailable,
    productCount: products.length,
    productsWithVariant,
    activeVariantCount,
    missingFields: missing,
    productsNeedingReview,
    productsNeedingReviewCount,
    reviewListTruncated: productsNeedingReviewCount > productsNeedingReview.length,
    invalidAttributeRows,
    truncated: products.length === PRODUCT_ROW_LIMIT,
    summary
  };
}

function summarizeBagsCatalog(products: ProductRow[], merchantId: string) {
  let invalidAttributeRows = 0;
  let capacityRecorded = 0;
  let productsNeedingReviewCount = 0;
  const productsNeedingReview: ProductReviewItem[] = [];
  const missing = { category: 0, material: 0, dimensions: 0, sku: 0, barcode: 0 };
  let activeVariantCount = 0;
  for (const product of products) {
    const { attributes, invalid } = parseAttributes(product.industryAttributes);
    if (invalid) invalidAttributeRows += 1;
    const variants = product.variants.filter(variant => variant.isActive);
    const missingFields: string[] = [];
    activeVariantCount += variants.length;
    if (!hasValue(product.category)) {
      missing.category += 1;
      missingFields.push('品类');
    }
    if (!hasValue(attributes.material) && !hasValue(product.fabric)) {
      missing.material += 1;
      missingFields.push('材质');
    }
    if (!hasValue(attributes.dimensions)) {
      missing.dimensions += 1;
      missingFields.push('尺寸');
    }
    if (hasValue(attributes.capacity)) capacityRecorded += 1;
    if (!variants.length) {
      missing.sku += 1;
      missingFields.push('SKU');
    }
    if (!variants.some(variant => hasValue(variant.barcode))) {
      missing.barcode += 1;
      missingFields.push('条码');
    }
    if (invalid) missingFields.push('行业属性 JSON');
    if (missingFields.length) {
      productsNeedingReviewCount += 1;
      if (productsNeedingReview.length < 20) {
        productsNeedingReview.push({
          styleNo: product.styleNo,
          name: product.name,
          missingFields
        });
      }
    }
  }
  const dataAvailable = products.length > 0;
  const summary = dataAvailable
    ? `箱包目录读取 ${products.length} 件商品、${activeVariantCount} 个启用 SKU；缺品类 ${missing.category} 件、材质 ${missing.material} 件、尺寸 ${missing.dimensions} 件、SKU ${missing.sku} 件、条码 ${missing.barcode} 件；${capacityRecorded} 件商品已录入容量资料（可选字段）。${summarizeProductReviews(productsNeedingReviewCount, productsNeedingReview)}${invalidAttributeRows ? `${invalidAttributeRows} 件商品的行业属性 JSON 无效，需人工核对。` : ''}本结果只核对已录入资料，不代表 AI 视觉识别材质。`
    : '箱包商品目录暂无数据；没有执行材质或图片识别。';
  return {
    source: 'ruda_database',
    merchantId,
    industryTemplate: 'bags_wholesale',
    dataAvailable,
    productCount: products.length,
    activeVariantCount,
    missingFields: missing,
    productsNeedingReview,
    productsNeedingReviewCount,
    reviewListTruncated: productsNeedingReviewCount > productsNeedingReview.length,
    capacityRecorded,
    invalidAttributeRows,
    truncated: products.length === PRODUCT_ROW_LIMIT,
    summary
  };
}

function finiteAmount(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount)) throw new Error('MODAGPT_INDUSTRY_AMOUNT_INVALID');
  return amount;
}

function summarizeByCurrency(sales: Array<{ currency: string; totalAmount: unknown }>): Record<string, number> {
  return sales.reduce<Record<string, number>>((totals, sale) => {
    const currency = sale.currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error('MODAGPT_INDUSTRY_CURRENCY_INVALID');
    totals[currency] = Number(((totals[currency] || 0) + finiteAmount(sale.totalAmount)).toFixed(2));
    return totals;
  }, {});
}

function dayWindow(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1_000);
}

async function analyzeChainStores(prisma: PrismaClient, merchantId: string, days: number) {
  const stores = await prisma.merchantStore.findMany({
    where: { merchantId, status: 'active' },
    orderBy: { name: 'asc' },
    take: STORE_ROW_LIMIT,
    select: { id: true, name: true }
  });
  const storeIds = stores.map(store => store.id);
  if (!storeIds.length) {
    return {
      source: 'ruda_database',
      merchantId,
      industryTemplate: 'department_chain_retail',
      days,
      dataAvailable: false,
      storeCount: 0,
      salesCount: 0,
      salesByCurrency: {},
      stockRowCount: 0,
      transferSuggestions: [],
      truncated: stores.length === STORE_ROW_LIMIT,
      summary: '当前商家没有启用门店，无法进行门店销售或库存分布分析。'
    };
  }
  const [stock, sales] = await Promise.all([
    prisma.merchantStoreStock.findMany({
      where: { merchantId, storeId: { in: storeIds } },
      orderBy: { updatedAt: 'desc' },
      take: STOCK_ROW_LIMIT,
      select: { storeId: true, productId: true, sku: true, productName: true, quantity: true }
    }),
    prisma.merchantPosSale.findMany({
      where: { merchantId, storeId: { in: storeIds }, createdAt: { gte: dayWindow(days) } },
      orderBy: { createdAt: 'desc' },
      take: SALE_ROW_LIMIT,
      select: {
        storeId: true,
        totalAmount: true,
        currency: true,
        items: { select: { productId: true, sku: true, productName: true, quantity: true }, take: 100 }
      }
    })
  ]);
  const storeById = new Map(stores.map(store => [store.id, store.name]));
  const stockByKey = new Map<string, number>();
  const productNameByKey = new Map<string, string>();
  const stockRowsByStore = new Map<string, number>();
  const salesByKey = new Map<string, number>();
  const salesByStore = new Map<string, { count: number; totals: Record<string, number> }>();
  for (const row of stock) {
    if (!storeById.has(row.storeId)) continue;
    const key = `${row.storeId}\u0000${row.productId}\u0000${row.sku}`;
    stockByKey.set(key, (stockByKey.get(key) || 0) + row.quantity);
    if (!productNameByKey.has(key)) productNameByKey.set(key, row.productName);
    stockRowsByStore.set(row.storeId, (stockRowsByStore.get(row.storeId) || 0) + 1);
  }
  for (const sale of sales) {
    if (!sale.storeId || !storeById.has(sale.storeId)) continue;
    const storeSummary = salesByStore.get(sale.storeId) || { count: 0, totals: {} };
    storeSummary.count += 1;
    const currency = sale.currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error('MODAGPT_INDUSTRY_CURRENCY_INVALID');
    storeSummary.totals[currency] = Number(((storeSummary.totals[currency] || 0) + finiteAmount(sale.totalAmount)).toFixed(2));
    salesByStore.set(sale.storeId, storeSummary);
    for (const item of sale.items) {
      if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) continue;
      const key = `${sale.storeId}\u0000${item.productId}\u0000${item.sku}`;
      salesByKey.set(key, (salesByKey.get(key) || 0) + item.quantity);
    }
  }
  const daysPerWindow = Math.max(days, 1);
  const suggestions: Array<{
    productId: string;
    sku: string;
    productName: string;
    fromStore: string;
    toStore: string;
    suggestedQuantity: number;
    reason: string;
  }> = [];
  const stockRecords = [...stockByKey.entries()].map(([key, quantity]) => {
    const [storeId, productId, sku] = key.split('\u0000');
    return { storeId, productId, sku, quantity, productName: productNameByKey.get(key) || '' };
  });
  for (const target of stockRecords) {
    const targetSales = salesByKey.get(`${target.storeId}\u0000${target.productId}\u0000${target.sku}`) || 0;
    const targetDailySales = targetSales / daysPerWindow;
    const targetNeed = Math.max(0, Math.floor(targetDailySales * 14 - target.quantity));
    if (!targetNeed) continue;
    for (const source of stockRecords) {
      if (source.productId !== target.productId || source.sku !== target.sku || source.storeId === target.storeId) continue;
      const sourceSales = salesByKey.get(`${source.storeId}\u0000${source.productId}\u0000${source.sku}`) || 0;
      const sourceSurplus = Math.max(0, Math.floor(source.quantity - (sourceSales / daysPerWindow) * 30));
      const suggestedQuantity = Math.min(targetNeed, sourceSurplus);
      if (!suggestedQuantity) continue;
      suggestions.push({
        productId: target.productId,
        sku: target.sku,
        productName: target.productName || source.productName || '未命名商品',
        fromStore: storeById.get(source.storeId) || '',
        toStore: storeById.get(target.storeId) || '',
        suggestedQuantity,
        reason: `目标门店近 ${days} 天有 ${targetSales} 件销售、现存 ${target.quantity} 件；来源门店现存 ${source.quantity} 件。仅为建议，需人工核实。`
      });
      if (suggestions.length >= 20) break;
    }
    if (suggestions.length >= 20) break;
  }
  const salesByCurrency = summarizeByCurrency(sales);
  const storeSummaries = stores.map(store => ({
    store: store.name,
    salesCount: salesByStore.get(store.id)?.count || 0,
    salesByCurrency: salesByStore.get(store.id)?.totals || {},
    stockSkuRows: stockRowsByStore.get(store.id) || 0
  }));
  const truncated = stores.length === STORE_ROW_LIMIT
    || stock.length === STOCK_ROW_LIMIT
    || sales.length === SALE_ROW_LIMIT;
  const suggestionExamples = suggestions.slice(0, 5).map(suggestion =>
    `${suggestion.productName} ${suggestion.sku}：${suggestion.fromStore} → ${suggestion.toStore} ${suggestion.suggestedQuantity} 件`
  );
  return {
    source: 'ruda_database',
    merchantId,
    industryTemplate: 'department_chain_retail',
    days,
    dataAvailable: stores.length > 0,
    storeCount: stores.length,
    salesCount: sales.length,
    salesByCurrency,
    stockRowCount: stock.length,
    storeSummaries,
    transferSuggestions: suggestions,
    truncated,
    summary: `最近 ${days} 天读取 ${stores.length} 家启用门店、${sales.length} 笔门店 POS 销售和 ${stock.length} 条门店库存；按币种汇总销售额 ${Object.entries(salesByCurrency).map(([currency, amount]) => `${amount} ${currency}`).join('、') || '暂无销售'}。生成 ${suggestions.length} 条基于实际销售速度与库存的调拨候选${suggestionExamples.length ? `，示例：${suggestionExamples.join('；')}` : ''}；最多返回 20 条，均须人工核实并通过既有调拨流程执行。${truncated ? '查询达到安全行数上限，结果可能不完整。' : ''}`
  };
}

async function analyzeRetailPos(prisma: PrismaClient, merchantId: string, days: number) {
  const since = dayWindow(days);
  const [sales, products, balances] = await Promise.all([
    prisma.merchantPosSale.findMany({
      where: { merchantId, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: SALE_ROW_LIMIT,
      select: {
        totalAmount: true,
        currency: true,
        items: {
          select: { productId: true, productName: true, sku: true, quantity: true, lineTotal: true },
          take: RETAIL_SALE_ITEM_LIMIT
        }
      }
    }),
    loadProducts(prisma, merchantId),
    prisma.inventoryBalance.findMany({
      where: { merchantId },
      orderBy: { updatedAt: 'desc' },
      take: RETAIL_BALANCE_ROW_LIMIT,
      select: {
        onHandQuantity: true,
        reservedQuantity: true,
        inTransitQuantity: true,
        variant: {
          select: {
            productId: true,
            sku: true,
            product: { select: { merchantId: true, name: true } }
          }
        }
      }
    })
  ]);
  const totalsByCurrency = summarizeByCurrency(sales);
  const unitsSold = new Map<string, number>();
  const productNames = new Map<string, string>();
  const salesBySku = new Map<string, { productId: string; sku: string; productName: string; unitsSold: number }>();
  for (const sale of sales) {
    for (const item of sale.items) {
      if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) continue;
      unitsSold.set(item.productId, (unitsSold.get(item.productId) || 0) + item.quantity);
      if (!productNames.has(item.productId)) productNames.set(item.productId, item.productName);
      const sku = stringValue(item.sku);
      if (!sku) continue;
      const key = `${item.productId}\u0000${sku}`;
      const current = salesBySku.get(key) || {
        productId: item.productId,
        sku,
        productName: item.productName,
        unitsSold: 0
      };
      current.unitsSold += item.quantity;
      salesBySku.set(key, current);
    }
  }
  const stockBySku = new Map<string, {
    productId: string;
    sku: string;
    productName: string;
    onHand: number;
    reserved: number;
    inTransit: number;
  }>();
  for (const balance of balances) {
    const { productId, sku, product } = balance.variant;
    if (product.merchantId !== merchantId || !sku) continue;
    const key = `${productId}\u0000${sku}`;
    const current = stockBySku.get(key) || {
      productId,
      sku,
      productName: product.name,
      onHand: 0,
      reserved: 0,
      inTransit: 0
    };
    current.onHand += balance.onHandQuantity;
    current.reserved += balance.reservedQuantity;
    current.inTransit += balance.inTransitQuantity;
    stockBySku.set(key, current);
  }
  const salesTruncated = sales.length === SALE_ROW_LIMIT
    || sales.some(sale => sale.items.length === RETAIL_SALE_ITEM_LIMIT);
  const inventoryTruncated = balances.length === RETAIL_BALANCE_ROW_LIMIT;
  let matchedSalesSkuCount = 0;
  const replenishmentCandidates = !salesTruncated && !inventoryTruncated
    ? [...salesBySku.values()].flatMap(sold => {
      const stock = stockBySku.get(`${sold.productId}\u0000${sold.sku}`);
      if (!stock) return [];
      matchedSalesSkuCount += 1;
      const available = Math.max(0, stock.onHand - stock.reserved + stock.inTransit);
      const targetStock = Math.ceil(sold.unitsSold / days * RETAIL_REPLENISHMENT_TARGET_DAYS);
      const suggestedQuantity = Math.max(0, targetStock - available);
      return suggestedQuantity > 0
        ? [{
          productId: sold.productId,
          sku: sold.sku,
          productName: sold.productName || stock.productName || '未命名商品',
          unitsSold: sold.unitsSold,
          available,
          targetStock,
          suggestedQuantity
        }]
        : [];
    })
      .sort((left, right) => right.suggestedQuantity - left.suggestedQuantity)
      .slice(0, RETAIL_REPLENISHMENT_LIMIT)
    : [];
  const catalogBarcodeCount = products.filter(product => {
    const { attributes } = parseAttributes(product.industryAttributes);
    return hasValue(attributes.barcode)
      || product.variants.some(variant => variant.isActive && hasValue(variant.barcode));
  }).length;
  const topProducts = [...unitsSold.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 10)
    .map(([productId, quantity]) => ({ productId, productName: productNames.get(productId) || '未命名商品', quantity }));
  const dataAvailable = sales.length > 0 || products.length > 0 || balances.length > 0;
  const truncated = salesTruncated
    || inventoryTruncated
    || products.length === PRODUCT_ROW_LIMIT;
  const replenishmentSummary = truncated
    ? '销售、库存或目录查询达到安全行数上限，未生成补货数量。'
    : balances.length === 0
      ? '没有找到当前商家的库存余额，未把缺失库存当作零库存，也未生成补货数量。'
      : `已匹配 ${matchedSalesSkuCount}/${salesBySku.size} 个有销售的 SKU 与库存；按 14 天覆盖生成 ${replenishmentCandidates.length} 个补货候选${replenishmentCandidates.length
        ? `：${replenishmentCandidates.slice(0, 5).map(candidate => `${candidate.productName} ${candidate.sku} 建议 ${candidate.suggestedQuantity} 件`).join('、')}`
        : ''}。候选仅供人工复核，不是采购单或库存变更。`;
  const summary = dataAvailable
    ? `最近 ${days} 天读取 ${sales.length} 笔 POS 销售，按币种汇总 ${Object.entries(totalsByCurrency).map(([currency, amount]) => `${amount} ${currency}`).join('、') || '暂无销售额'}；销售明细累计 ${[...unitsSold.values()].reduce((total, quantity) => total + quantity, 0)} 件。目录 ${products.length} 件商品中 ${catalogBarcodeCount} 件有有效条码；畅销候选 ${topProducts.slice(0, 5).map(product => `${product.productName}（${product.quantity}件）`).join('、') || '暂无'}。${replenishmentSummary}当前 POS 数据模型未提供退款/成本事实，本分析不计算净销售额或毛利。`
    : '当前商家暂无 POS 销售或商品目录数据；不推断毛利、退款或补货量。';
  return {
    source: 'ruda_database',
    merchantId,
    industryTemplate: 'general_retail',
    days,
    dataAvailable,
    salesCount: sales.length,
    salesByCurrency: totalsByCurrency,
    unitsSold: [...unitsSold.values()].reduce((total, quantity) => total + quantity, 0),
    productsWithBarcode: catalogBarcodeCount,
    productCount: products.length,
    topProducts,
    inventoryDataAvailable: balances.length > 0,
    inventorySkuCount: stockBySku.size,
    salesSkuCount: salesBySku.size,
    matchedSalesSkuCount,
    replenishmentTargetDays: RETAIL_REPLENISHMENT_TARGET_DAYS,
    replenishmentCandidates,
    truncated,
    summary
  };
}

export function createModaGptIndustryTools(input: {
  prisma: PrismaClient;
  industryTemplate: unknown;
}): { definitions: ModaGptToolDefinition[]; handlers: Record<string, ToolHandler> } {
  const profile = getModaGptIndustryTemplateAssistantProfile(input.industryTemplate);
  if (!profile || !analysisTemplates.some(template => template === profile.templateId)) {
    return { definitions: [], handlers: {} };
  }
  const [toolId] = profile.tools;
  const definition = createDefinition(
    toolId,
    `Read-only ${profile.templateId} analysis from merchant-owned RUDA database records.`,
    profile.templateId
  );
  const handler: ToolHandler = async (merchantId, rawInput) => {
    if (!merchantId || !isIndustryAnalysisInput(rawInput)) throw new Error('MODAGPT_INDUSTRY_ANALYSIS_INPUT_INVALID');
    const days = rawInput.days ?? 30;
    if (profile.templateId === 'department_wholesale') {
      const products = await loadProducts(input.prisma, merchantId);
      return summarizeDepartmentCatalog(products, merchantId);
    }
    if (profile.templateId === 'bags_wholesale') {
      const products = await loadProducts(input.prisma, merchantId);
      return summarizeBagsCatalog(products, merchantId);
    }
    if (profile.templateId === 'department_chain_retail') {
      return analyzeChainStores(input.prisma, merchantId, days);
    }
    if (profile.templateId === 'general_retail') {
      return analyzeRetailPos(input.prisma, merchantId, days);
    }
    throw new Error('MODAGPT_INDUSTRY_TEMPLATE_UNSUPPORTED');
  };
  return { definitions: [definition], handlers: { [toolId]: handler } };
}

export function isModaGptIndustryAnalysisTool(toolId: string): boolean {
  return analysisTemplates.some(template =>
    getModaGptIndustryTemplateAssistantProfile(template)?.tools.includes(toolId)
  );
}

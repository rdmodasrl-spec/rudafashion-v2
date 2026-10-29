export function asksForSalesAndOrderMetrics(question: string): boolean {
  const asksAboutOrders = /订单|orders?|ordini?/i.test(question);
  const asksAboutSales = /销售|营业额|营收|成交额|销售额|客单价|平均订单金额|average order value|aov|gmv|revenue|turnover|vendite|fatturato|ricavi|valore medio ordine/i.test(question);
  return asksAboutOrders && asksAboutSales;
}

export function extractMerchantOrderReference(question: string): string | null {
  const labeledReference = question.match(/(?:订单号|订单编号|order\s*(?:no\.?|number|#))\s*[:：#]?\s*([#A-Z0-9-]{3,})/i);
  const hashReference = question.match(/#([A-Z0-9-]{3,})/i);
  const reference = (labeledReference?.[1] || hashReference?.[1] || '').replace(/^#/, '').trim();
  return reference && /\d/.test(reference) ? reference : null;
}

export function merchantOrderReferenceCandidates(reference: string): string[] {
  const normalized = reference.trim().replace(/^#/, '');
  const candidates = [normalized, `#${normalized}`];
  if (/^\d+$/.test(normalized)) candidates.push(`ORD-${normalized}`);
  return [...new Set(candidates)];
}

export function extractMerchantProductIdentifier(question: string): string | null {
  const match = question.match(/(?:sku|条码|barcode|款号|型号|货号|style\s*(?:no\.?|number)?)\s*[:：#]?\s*([A-Z0-9][A-Z0-9_-]{2,})/i);
  return match?.[1]?.trim() || null;
}

type MerchantProductLookupRecord = {
  styleNo: string;
  name: string;
  name_zh: string | null;
  name_it: string | null;
  brand: string;
  category: string;
  subCategory: string;
  season: string;
  fabric: string;
  lifecycleStatus: string;
  visibility: string;
  status: string;
  wholesalePrice: number | { toString(): string };
  moq: number;
};

export function matchMerchantProductCatalog<T extends MerchantProductLookupRecord>(
  question: string,
  products: T[]
): T[] | null {
  const hasSearchIntent = /找|搜索|搜一下|查商品|查下|查找|查询|查一下|列出|有哪些|看看|看下|find|search|list|show me/i.test(question);
  const hasProductContext = /商品|产品|款式|货盘|product|catalog|style|鞋|衣|连衣裙|服装|dress|clothing|fashion/i.test(question);
  if (!hasSearchIntent || !hasProductContext) return null;

  const normalizedQuestion = question.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase();
  const searchCriteria = normalizedQuestion
    .replace(/帮我|请|一下|查商品|查下|查找|查询|查一下|搜索|搜一下|找一下|找找|列出|有哪些|看看|看下|商品|产品|款式|货盘|find|search|list|show me|products?|catalog|styles?/g, '')
    .replace(/[\s\p{P}\p{S}]/gu, '');
  if (!searchCriteria) return null;

  const matches = products.filter(product => {
    const searchableFields = [
      product.styleNo,
      product.name,
      product.name_zh,
      product.name_it,
      product.brand,
      product.category,
      product.subCategory,
      product.season,
      product.fabric
    ].filter((value): value is string => Boolean(value))
      .map(value => value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase());

    return searchableFields.some(value => value.length >= 2 && normalizedQuestion.includes(value));
  });
  return matches.sort((left, right) => left.styleNo.localeCompare(right.styleNo));
}

export function calculateAverageOrderValue(totalAmount: number, orderCount: number): number | null {
  if (!Number.isFinite(totalAmount) || !Number.isInteger(orderCount) || orderCount <= 0) return null;
  return Math.round((totalAmount / orderCount) * 100) / 100;
}

export function asksAboutMerchantPromotions(question: string): boolean {
  return /促销|优惠活动|优惠码|优惠券|折扣活动|满减|打折|promotion|coupon|discount|promozion[ei]|codice sconto|scont[oi]/i.test(question);
}

export function asksForMerchantPromotionReport(question: string): boolean {
  return asksAboutMerchantPromotions(question) &&
    /使用效果|使用情况|使用次数|核销|兑换|用了多少|带来多少|报表|统计|效果|redemption|usage|performance|report|riscatt[oi]|utilizz[oi]|statistiche|andamento|risultati/i.test(question);
}

export function asksForMerchantRefundAnalysis(question: string): boolean {
  return /退款|退货金额|退款金额|已退款|退回金额|refund(?:s|ed)?|return amount|rimbors[oi]|resi/i.test(question) &&
    /统计|分析|金额|多少|总计|合计|趋势|次数|笔数|报告|report|total|amount|trend|count|importo|totale|analisi|statistiche|numero|andamento/i.test(question);
}

export function asksForMerchantRegionalOrderBreakdown(question: string): boolean {
  return /订单|销售|成交|order|sales|revenue|ordini?|vendite|fatturato/i.test(question) &&
    /地区|国家|区域|地域|分布|占比|region|country|geograph|paese|region[ei]|aree?|distribuzione|percentuale/i.test(question);
}

export function asksForMerchantProductAudit(question: string): boolean {
  return /商品|产品|款式|product|catalog|prodott[io]|articol[oi]/i.test(question) &&
    /缺图|无图|没图|缺少图片|没有图片|缺少描述|没有描述|无描述|描述为空|资料不完整|信息不完整|缺少价格|无价格|图片.*(?:缺|没有)|(?:missing|without|no).{0,20}(?:image|photo|description|price)|incomplete|senza immagini|senza descrizione|prezzo mancante|scheda incompleta/i.test(question);
}

export function asksAboutInventoryMovements(question: string): boolean {
  return /库存流水|库存变动|调整记录|库存调整记录|出入库记录|stock movements?|inventory history|adjustment history|movimenti (?:di )?magazzino|storico (?:delle )?scorte|variazioni? (?:di )?magazzino/i.test(question);
}

export function asksAboutStockTransfers(question: string): boolean {
  return /调拨|转仓|转移库存|stock transfers?|inventory transfers?|trasferiment[oi] (?:di )?(?:magazzino|scorte)/i.test(question);
}

export type MerchantAssistantCapabilityGuidance = {
  reply: string;
  actionLabel: string;
  target: 'settings' | 'orders' | 'inventory' | 'materials' | 'production';
};

export function getMerchantAssistantCapabilityGuidance(question: string): MerchantAssistantCapabilityGuidance | null {
  if (/(?:面料|辅料|面辅料|原材料|materials?).*(?:采购|入库|供应商|purchase|receipt)|(?:采购|入库|供应商|purchase|receipt).*(?:面料|辅料|面辅料|原材料|materials?)/i.test(question)) {
    return {
      reply: 'RUDA 已提供商家面辅料台账，可查询当前启用物料和库存、按补货点识别低库存；助手不会代替你创建采购、登记收货或调整库存。成衣向供应商采购订单模块尚未接入。',
      actionLabel: '打开物料台账',
      target: 'materials'
    };
  }
  if (/成衣采购|采购订单|采购单|(?:供应商|商品).{0,4}采购|purchase orders?/i.test(question)) {
    return {
      reply: 'RUDA 目前没有商户成衣采购订单模块，因此我不能查询或创建向供应商采购成衣的采购单。库存页可以查看现货、在途数量和补货建议；自有工厂的面辅料入库是另一套流程，不等于成衣采购订单。',
      actionLabel: '查看库存与补货建议',
      target: 'inventory'
    };
  }
  if (/主题编辑|主题颜色|字体|首页区块|theme editor|theme customization/i.test(question)) {
    return {
      reply: '目前 RUDA 还没有接入主题编辑器，因此我不能直接改首页主题、颜色、字体或区块。我可以帮你先起草页面文案；店铺资料和交易规则可在商家设置中心维护。',
      actionLabel: '打开商家设置中心',
      target: 'settings'
    };
  }
  if (/域名|dns|domain/i.test(question)) {
    return {
      reply: '目前 RUDA 没有接入域名注册、DNS 查询或连接状态管理，我不能替你检查或修改域名。你可以在域名服务商处检查 DNS；店铺资料可在 RUDA 商家设置中心维护。',
      actionLabel: '打开商家设置中心',
      target: 'settings'
    };
  }
  if (/shopify flow|工作流自动化|自动化工作流|flow workflow/i.test(question)) {
    return {
      reply: 'RUDA 目前没有接入 Shopify Flow 或可自动执行的店铺工作流。我可以帮你把流程条件、触发器和通知内容整理成方案，但不会声称已经创建或启用自动化。',
      actionLabel: '查看商家设置',
      target: 'settings'
    };
  }
  if (/官方资料|官方文档|shopify.*(?:功能|规则|设置|文档)|(?:功能|规则|设置).*shopify/i.test(question)) {
    return {
      reply: '我当前没有接入 Shopify 官方资料检索，也不能把 RUDA 的功能说成 Shopify 功能。你可以告诉我具体问题，我会基于 RUDA 当前已有的页面和流程说明；Shopify 规则请以 Shopify 官方帮助中心为准。',
      actionLabel: '查看商家设置',
      target: 'settings'
    };
  }
  if (/店铺流量|访客数|转化率|流量来源|store traffic|conversion rate/i.test(question)) {
    return {
      reply: '目前 RUDA 的访问事件没有按商户店铺归属，不能据此准确报告你店铺的访客数、流量来源或转化率。我可以查询本商户订单和成交表现；不会把平台整体访问量冒充店铺数据。',
      actionLabel: '查看订单与销售',
      target: 'orders'
    };
  }
  return null;
}

type MerchantCustomerLookupRecord = {
  companyName: string;
  city: string;
  country: string;
  tier: string;
  status: string;
};

const customerLocationAliases = [
  ['milan', 'milano', '米兰'],
  ['rome', 'roma', '罗马'],
  ['prato', '普拉托'],
  ['florence', 'firenze', '佛罗伦萨'],
  ['italy', 'italia', '意大利'],
  ['france', 'francia', '法国'],
  ['germany', 'deutschland', '德国'],
  ['spain', 'espana', '西班牙'],
  ['greece', 'grecia', '希腊', '希臘'],
  ['portugal', 'portogallo', '葡萄牙']
];

function normalizeCustomerLookupText(value: string): string {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase();
}

export function matchMerchantCustomerRecords<T extends MerchantCustomerLookupRecord>(
  question: string,
  customers: T[]
): T[] {
  const normalizedQuestion = normalizeCustomerLookupText(question);
  const requestedLocations = customerLocationAliases.filter(aliases =>
    aliases.some(alias => normalizedQuestion.includes(normalizeCustomerLookupText(alias)))
  );
  const requestedTier = /vip|重要客户|大客户|高级客户/i.test(question)
    ? (/大客户|战略合作伙伴/i.test(question) ? 'tier_major' : 'tier_vip')
    : /普通客户|标准客户/i.test(question)
      ? 'tier_standard'
      : null;
  const requestedStatus = /待审核|待审批|pending/i.test(question)
    ? ['pending', 'pending_kyc']
    : /已通过|已批准|已审核|approved|活跃客户/i.test(question)
      ? ['approved']
      : null;

  return customers.filter(customer => {
    const nameMatch = normalizedQuestion.includes(normalizeCustomerLookupText(customer.companyName));
    const city = normalizeCustomerLookupText(customer.city);
    const country = normalizeCustomerLookupText(customer.country);
    const locationMatch = requestedLocations.every(aliases =>
      aliases.some(alias => {
        const normalizedAlias = normalizeCustomerLookupText(alias);
        return [city, country].some(value =>
          value.length >= 2 && (value.includes(normalizedAlias) || normalizedAlias.includes(value))
        );
      })
    );
    const hasLocationFilter = requestedLocations.length > 0;
    const hasAttributeFilter = Boolean(requestedTier || requestedStatus);
    const identityMatch = nameMatch || hasLocationFilter || hasAttributeFilter;
    return identityMatch &&
      (!hasLocationFilter || locationMatch) &&
      (!requestedTier || customer.tier === requestedTier) &&
      (!requestedStatus || requestedStatus.includes(customer.status));
  });
}

export function hasMerchantCustomerLookupCriteria(question: string): boolean {
  const normalizedQuestion = normalizeCustomerLookupText(question);
  const hasLocation = customerLocationAliases.some(aliases =>
    aliases.some(alias => normalizedQuestion.includes(normalizeCustomerLookupText(alias)))
  );
  return hasLocation ||
    /vip|重要客户|大客户|高级客户|普通客户|标准客户|待审核|待审批|已通过|已批准|已审核|approved|pending|活跃客户/i.test(question) ||
    /找|搜索|查找|查询|查一下|列出|名单|list|find|search|show me|client[ei]|buyer/i.test(question);
}

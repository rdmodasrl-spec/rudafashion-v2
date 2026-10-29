/**
 * 七个行业后台的演示商家账号（仅用于功能测试）。
 *
 * 规则：
 * - 只创建/更新 `demo-industry-*` 前缀的隔离数据，命中非演示商家时直接拒绝执行。
 * - 登录邮箱由共享编号映射生成；密码由运行环境提供，仅保存 bcrypt 哈希且不输出。
 * - 行业模板、商品属性、门店/库存能力全部读取 `src/constants` 的权威清单，不在脚本里另建一份。
 *
 * 用法：
 *   INDUSTRY_DEMO_SEED_CONFIRM=CREATE_RUDA_INDUSTRY_DEMO_MERCHANTS \
 *     npx tsx scripts/seed-industry-demo-merchants.ts
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { getMerchantIndustryCapability } from '../src/constants/merchantIndustryCapabilities.js';
import {
  getMerchantIndustryTemplate,
  type MerchantIndustryTemplateId
} from '../src/constants/merchantIndustryTemplates.js';
import {
  getMerchantIndustryDemoEmail,
  merchantIndustryDemoAccounts
} from '../src/constants/merchantIndustryDemoAccounts.js';
import { SINGLE_WAREHOUSE_CODE } from '../src/server/warehouse.js';

const prisma = new PrismaClient();

export const DEMO_SEED_CONFIRMATION = 'CREATE_RUDA_INDUSTRY_DEMO_MERCHANTS';
export const DEMO_ACCOUNT_PASSWORD_ENV = 'INDUSTRY_DEMO_ACCOUNT_PASSWORD';

type DemoProductSeed = {
  name: string;
  category: string;
  wholesalePrice: number;
  rrpPrice: number;
  attributes?: Record<string, string>;
  fabric?: string;
  composition?: string;
};

type DemoMerchantSeed = {
  templateId: MerchantIndustryTemplateId;
  key: string;
  name: string;
  city: string;
  zone: string;
  businessType: string;
  contactPerson: string;
  stylePrefix: string;
  products: DemoProductSeed[];
  stores?: Array<{ code: string; name: string; city: string; address: string; phone: string }>;
};

export const demoMerchantSeeds: readonly DemoMerchantSeed[] = [
  {
    templateId: 'apparel_production_wholesale',
    key: 'apparel-production',
    name: 'DEMO · 服装生产批发商',
    city: 'Prato',
    zone: 'iolo',
    businessType: 'brand_supplier',
    contactPerson: 'RUDA Demo 生产',
    stylePrefix: 'DEMO-AP',
    products: [
      {
        name: '羊毛混纺西装外套',
        category: 'outerwear',
        wholesalePrice: 68,
        rrpPrice: 189,
        fabric: '羊毛混纺',
        composition: '羊毛 60% / 聚酯纤维 40%'
      },
      { name: '真丝印花衬衫', category: 'shirts', wholesalePrice: 42, rrpPrice: 118, fabric: '真丝', composition: '桑蚕丝 100%' },
      { name: '高腰阔腿西裤', category: 'pants', wholesalePrice: 36, rrpPrice: 99, fabric: '粘胶混纺', composition: '粘胶 70% / 尼龙 30%' }
    ]
  },
  {
    templateId: 'apparel_wholesale',
    key: 'apparel-wholesale',
    name: 'DEMO · 服装批发商',
    city: 'Milano',
    zone: 'tavoro',
    businessType: 'wholesaler',
    contactPerson: 'RUDA Demo 服装批发',
    stylePrefix: 'DEMO-AW',
    products: [
      { name: '针织开衫', category: 'knitwear', wholesalePrice: 24, rrpPrice: 69, fabric: '精纺羊毛', composition: '羊毛 100%' },
      { name: '直筒牛仔裤', category: 'jeans', wholesalePrice: 21, rrpPrice: 59, fabric: '牛仔布', composition: '棉 98% / 氨纶 2%' },
      { name: '印花连衣裙', category: 'dresses', wholesalePrice: 27, rrpPrice: 79, fabric: '雪纺', composition: '聚酯纤维 100%' }
    ]
  },
  {
    templateId: 'trading_wholesale',
    key: 'trading-wholesale',
    name: 'DEMO · 贸易批发商',
    city: 'Roma',
    zone: 'tavoro',
    businessType: 'wholesaler',
    contactPerson: 'RUDA Demo 贸易',
    stylePrefix: 'DEMO-TR',
    products: [
      {
        name: '不锈钢保温杯',
        category: 'kitchen',
        wholesalePrice: 6.4,
        rrpPrice: 16.9,
        attributes: { spec: '500ml', unit: '件', supplier: 'DEMO 供应商 A' }
      },
      {
        name: 'A5 线圈笔记本',
        category: 'stationery',
        wholesalePrice: 1.8,
        rrpPrice: 5.9,
        attributes: { spec: '80 页 / 3 本装', unit: '套', supplier: 'DEMO 供应商 B' }
      },
      {
        name: '棉麻收纳筐',
        category: 'home_living',
        wholesalePrice: 4.2,
        rrpPrice: 12.9,
        attributes: { spec: '30 x 30 x 25 cm', unit: '件', supplier: 'DEMO 供应商 C' }
      }
    ]
  },
  {
    templateId: 'department_wholesale',
    key: 'department-wholesale',
    name: 'DEMO · 百货批发商',
    city: 'Bologna',
    zone: 'tavoro',
    businessType: 'wholesaler',
    contactPerson: 'RUDA Demo 百货',
    stylePrefix: 'DEMO-DW',
    products: [
      {
        name: '多功能不粘锅',
        category: 'kitchen',
        wholesalePrice: 12.5,
        rrpPrice: 34.9,
        attributes: { barcode: '2100000000011', spec: '28cm', unit: '件' }
      },
      {
        name: '折叠收纳箱',
        category: 'home_living',
        wholesalePrice: 5.6,
        rrpPrice: 15.9,
        attributes: { barcode: '2100000000028', spec: '45L', unit: '件' }
      },
      {
        name: '儿童益智积木',
        category: 'toys',
        wholesalePrice: 8.9,
        rrpPrice: 24.9,
        attributes: { barcode: '2100000000035', spec: '120 颗粒', unit: '盒' }
      }
    ]
  },
  {
    templateId: 'bags_wholesale',
    key: 'bags-wholesale',
    name: 'DEMO · 箱包批发商',
    city: 'Firenze',
    zone: 'tavoro',
    businessType: 'wholesaler',
    contactPerson: 'RUDA Demo 箱包',
    stylePrefix: 'DEMO-BG',
    products: [
      {
        name: '头层牛皮托特包',
        category: 'bags',
        wholesalePrice: 58,
        rrpPrice: 159,
        attributes: { material: '头层牛皮', dimensions: '35 x 28 x 12 cm' }
      },
      {
        name: '尼龙通勤双肩包',
        category: 'bags',
        wholesalePrice: 26,
        rrpPrice: 79,
        attributes: { material: '高密尼龙', dimensions: '30 x 42 x 14 cm' }
      },
      {
        name: '小牛皮链条包',
        category: 'bags',
        wholesalePrice: 47,
        rrpPrice: 129,
        attributes: { material: '小牛皮', dimensions: '22 x 14 x 7 cm' }
      }
    ]
  },
  {
    templateId: 'department_chain_retail',
    key: 'department-chain-retail',
    name: 'DEMO · 百货连锁店',
    city: 'Milano',
    zone: 'boutique_department',
    businessType: 'retailer',
    contactPerson: 'RUDA Demo 连锁',
    stylePrefix: 'DEMO-CR',
    products: [
      {
        name: '香薰蜡烛礼盒',
        category: 'home_living',
        wholesalePrice: 12,
        rrpPrice: 29.9,
        attributes: { barcode: '2200000000010', spec: '3 支装', unit: '盒' }
      },
      {
        name: '陶瓷马克杯',
        category: 'kitchen',
        wholesalePrice: 5,
        rrpPrice: 12.9,
        attributes: { barcode: '2200000000027', spec: '350ml', unit: '只' }
      },
      {
        name: '旅行洗漱收纳包',
        category: 'bags',
        wholesalePrice: 8,
        rrpPrice: 19.9,
        attributes: { barcode: '2200000000034', spec: '中号', unit: '个' }
      }
    ],
    stores: [
      { code: 'MILANO-01', name: '米兰旗舰店', city: 'Milano', address: 'Via Torino 12, Milano', phone: '+39 02 0000 0001' },
      { code: 'ROMA-01', name: '罗马分店', city: 'Roma', address: 'Via del Corso 88, Roma', phone: '+39 06 0000 0002' }
    ]
  },
  {
    templateId: 'general_retail',
    key: 'general-retail',
    name: 'DEMO · 综合零售商',
    city: 'Torino',
    zone: 'boutique_department',
    businessType: 'retailer',
    contactPerson: 'RUDA Demo 零售',
    stylePrefix: 'DEMO-GR',
    products: [
      {
        name: '便携蓝牙音箱',
        category: 'electronics',
        wholesalePrice: 0,
        rrpPrice: 49.9,
        attributes: { barcode: '2300000000019', spec: '5W', unit: '台' }
      },
      {
        name: '氨基酸洁面乳',
        category: 'beauty',
        wholesalePrice: 0,
        rrpPrice: 18.9,
        attributes: { barcode: '2300000000026', spec: '120ml', unit: '支' }
      },
      {
        name: '桌面收纳笔筒',
        category: 'stationery',
        wholesalePrice: 0,
        rrpPrice: 9.9,
        attributes: { barcode: '2300000000033', spec: '三格', unit: '个' }
      }
    ]
  }
];

/** 行业商品的 SKU 组合：服装/箱包保持颜色+尺寸，其余行业单 SKU。 */
type DemoVariantPlan = {
  sku: string;
  color: string;
  colorCode: string;
  size: string;
  barcode: string;
  stock: number;
  storeStock: number[];
};

function buildVariants(
  seed: DemoMerchantSeed,
  templateId: MerchantIndustryTemplateId,
  productIndex: number
): DemoVariantPlan[] {
  const capability = getMerchantIndustryCapability(templateId);
  const styleNo = `${seed.stylePrefix}-${String(productIndex + 1).padStart(2, '0')}`;
  const colorOptions = capability?.variant.requiresColor
    ? [
        { name: '黑色', code: '#111111', key: 'BK' },
        { name: '米白', code: '#F2EDE4', key: 'IV' }
      ]
    : [{ name: '', code: '', key: 'ST' }];
  const sizeOptions = capability?.variant.requiresSize
    ? capability.variant.sizeLabel === '尺寸'
      ? [{ name: '中号', key: 'M' }, { name: '大号', key: 'L' }]
      : [{ name: 'S', key: 'S' }, { name: 'M', key: 'M' }, { name: 'L', key: 'L' }]
    : [{ name: '', key: '01' }];
  const stockPerVariant = capability?.pricing.primary === 'retail' ? 30 : 12;
  const variants: DemoVariantPlan[] = [];
  colorOptions.forEach((color, colorIndex) => {
    sizeOptions.forEach((size, sizeIndex) => {
      variants.push({
        sku: `${styleNo}-${color.key}-${size.key}`,
        color: color.name,
        colorCode: color.code,
        size: size.name,
        barcode: `9${String(productIndex + 1).padStart(2, '0')}${colorIndex}${sizeIndex}0001`,
        stock: stockPerVariant,
        storeStock: [12, 6]
      });
    });
  });
  return variants;
}

function demoProductId(seed: DemoMerchantSeed, productIndex: number): string {
  return `demo-industry-${seed.key}-${productIndex + 1}`;
}

type DemoMerchantResult = {
  merchantId: string;
  email: string;
  templateId: string;
  workspaceTemplateId: string | null;
  products: number;
  variants: number;
  stores: number;
  orders: number;
  purchaseOrders: number;
  employees: number;
  transfers: number;
  warnings: string[];
};

async function seedMerchant(
  seed: DemoMerchantSeed,
  centralLocationId: string,
  passwordHash: string
): Promise<DemoMerchantResult> {
  const template = getMerchantIndustryTemplate(seed.templateId);
  if (!template) throw new Error(`Unknown industry template: ${seed.templateId}`);
  const capability = getMerchantIndustryCapability(seed.templateId);
  if (!capability) throw new Error(`Missing industry capability: ${seed.templateId}`);
  const email = getMerchantIndustryDemoEmail(seed.templateId);
  if (!email) throw new Error(`Missing demo login account for ${seed.templateId}`);

  const merchantId = `demo-industry-${seed.key}`;
  const storeSlug = merchantId;
  const code = storeSlug.toUpperCase();
  const warnings: string[] = [];

  const existing = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { id: true, name: true, code: true }
  });
  if (existing && (!existing.name.startsWith('DEMO · ') || existing.code !== code)) {
    throw new Error(`Refusing to overwrite non-demo merchant ${merchantId}`);
  }
  const identityConflict = await prisma.merchant.findFirst({
    where: { OR: [{ code }, { storeSlug }], NOT: { id: merchantId } },
    select: { id: true }
  });
  if (identityConflict) throw new Error(`Merchant code or store URL already used by ${identityConflict.id}`);

  const image = `https://modaui.com/demo-products/model-0${(demoMerchantSeeds.indexOf(seed) % 8) + 1}.jpg`;
  const registrationProfile = {
    categories: template.categories.slice(0, 3),
    roles: [
      capability.pricing.primary === 'retail'
        ? 'RETAILER'
        : seed.templateId === 'apparel_production_wholesale'
          ? 'PRODUCER'
          : 'WHOLESALER'
    ]
  };
  const merchantFields = {
    name: seed.name,
    companyLegalName: `${seed.name} · 演示数据`,
    code,
    storeSlug,
    merchantZone: seed.zone,
    businessType: seed.businessType,
    industry: template.merchantIndustry,
    industrySource: 'ADMIN',
    industryTemplate: template.id,
    industryTemplateSource: 'ADMIN',
    industryTemplateInitializedAt: new Date(),
    registrationProfile,
    country: 'Italia',
    country_it: 'Italia',
    country_zh: '意大利',
    city: seed.city,
    city_it: seed.city,
    city_zh: seed.city,
    showroomAddress: `Demo Showroom, ${seed.city}`,
    showroomArea: '120 m²',
    showroomArea_it: '120 m² showroom',
    showroomArea_zh: '120 m² 演示展厅',
    showroomImage: image,
    logo: image,
    banner: image,
    tagline: '演示商家 · 仅用于功能测试',
    tagline_it: 'Demo · solo test funzionale',
    tagline_zh: '演示商家 · 仅用于功能测试',
    description: `RUDA 行业后台演示账号（${template.zh}），数据均为测试用途，不代表真实经营。`,
    description_it: `Account demo RUDA (${template.it}) per test funzionali.`,
    description_zh: `RUDA 行业后台演示账号（${template.zh}），数据均为测试用途。`,
    specialties: JSON.stringify(template.categories.slice(0, 3)),
    foundedYear: 2020,
    contactPerson: seed.contactPerson,
    contactPhone: '+39 000 000 0000',
    contactEmail: email,
    isVerified: true,
    storefrontEnabled: true,
    rating: 5
  };

  await prisma.merchant.upsert({
    where: { id: merchantId },
    update: {
      name: merchantFields.name,
      industry: merchantFields.industry,
      industryTemplate: merchantFields.industryTemplate,
      industryTemplateSource: merchantFields.industryTemplateSource,
      industryTemplateInitializedAt: merchantFields.industryTemplateInitializedAt,
      registrationProfile: merchantFields.registrationProfile,
      contactEmail: merchantFields.contactEmail,
      isVerified: true,
      storefrontEnabled: true
    },
    create: { id: merchantId, ...merchantFields }
  });

  const accountConflict = await prisma.authAccount.findFirst({
    where: { role: 'merchant', merchantId, email: { not: email } },
    select: { id: true, email: true }
  });
  if (accountConflict) throw new Error(`Merchant ${merchantId} already has login account ${accountConflict.email}`);

  await prisma.authAccount.upsert({
    where: { role_email: { role: 'merchant', email } },
    update: { merchantId, merchantCode: code, passwordHash, emailVerifiedAt: new Date() },
    create: {
      role: 'merchant',
      email,
      merchantId,
      merchantCode: code,
      passwordHash,
      emailVerifiedAt: new Date()
    }
  });
  if (existing) warnings.push('商家已存在：已同步模板与登录密码，商品/库存按幂等规则更新');

  let variantCount = 0;
  for (const [productIndex, product] of seed.products.entries()) {
    const productId = demoProductId(seed, productIndex);
    const styleNo = `${seed.stylePrefix}-${String(productIndex + 1).padStart(2, '0')}`;
    const variants = buildVariants(seed, seed.templateId, productIndex);
    variantCount += variants.length;
    const media = [{ id: `${productId}-main`, type: 'image', url: image, role: 'main', source: 'merchant-upload' }];
    const skus = variants.map(variant => ({
      sku: variant.sku,
      color: variant.color,
      colorCode: variant.colorCode,
      size: variant.size,
      barcode: variant.barcode,
      stockCentral: capability.inventory.mode === 'store' ? 0 : variant.stock,
      stockMestre: 0,
      stockMilano: 0,
      reserved: 0,
      isActive: true
    }));
    const productFields = {
      styleNo,
      name: `【演示】${product.name}`,
      category: product.category,
      subCategory: '',
      brand: 'RUDA Demo',
      season: 'DEMO 2026',
      images: JSON.stringify([image]),
      media: JSON.stringify(media),
      wholesalePrice: product.wholesalePrice,
      wholesalePrice100: null,
      bulkPriceMinimumQuantity: 100,
      rrpPrice: product.rrpPrice,
      costPrice: product.wholesalePrice > 0 ? Number((product.wholesalePrice * 0.6).toFixed(2)) : null,
      moq: 1,
      packSize: 1,
      requiresFullCarton: false,
      status: 'new',
      inventoryStatus: 'in_stock',
      origin: 'RUDA 演示数据',
      fabric: product.fabric || '',
      manufacturingProcess: '',
      fit: '',
      composition: product.composition || '',
      weight: '',
      packaging: '',
      washCare: '按产品标签保养',
      description: 'RUDA 行业后台演示商品，仅用于功能测试。',
      skus: JSON.stringify(skus),
      merchantId,
      merchantName: seed.name,
      isExclusiveProtected: false,
      protectionLevel: 'public',
      visibility: capability.pricing.primary === 'retail' ? 'public' : 'wholesale',
      lifecycleStatus: 'published',
      industryAttributes: product.attributes ? JSON.stringify(product.attributes) : null
    };
    await prisma.product.upsert({
      where: { id: productId },
      update: productFields,
      create: { id: productId, ...productFields }
    });

    for (const variantPlan of variants) {
      const variant = await prisma.productVariant.upsert({
        where: { productId_sku: { productId, sku: variantPlan.sku } },
        update: {
          barcode: variantPlan.barcode,
          color: variantPlan.color,
          size: variantPlan.size,
          attributes: JSON.stringify({ colorCode: variantPlan.colorCode }),
          isActive: true
        },
        create: {
          id: crypto.randomUUID(),
          productId,
          sku: variantPlan.sku,
          barcode: variantPlan.barcode,
          color: variantPlan.color,
          size: variantPlan.size,
          attributes: JSON.stringify({ colorCode: variantPlan.colorCode }),
          isActive: true
        }
      });
      if (capability.inventory.mode === 'store') continue;
      const balance = await prisma.inventoryBalance.findUnique({
        where: { variantId_locationId: { variantId: variant.id, locationId: centralLocationId } }
      });
      if (balance) {
        await prisma.inventoryBalance.update({
          where: { id: balance.id },
          data: { onHandQuantity: variantPlan.stock }
        });
      } else {
        await prisma.inventoryBalance.create({
          data: {
            merchantId,
            variantId: variant.id,
            locationId: centralLocationId,
            onHandQuantity: variantPlan.stock,
            reservedQuantity: 0,
            inTransitQuantity: 0
          }
        });
      }
      const movementKey = `demo-seed:${productId}:${variantPlan.sku}`;
      const existingMovement = await prisma.inventoryMovement.findFirst({
        where: { idempotencyKey: movementKey },
        select: { id: true }
      });
      if (!existingMovement) {
        await prisma.inventoryMovement.create({
          data: {
            merchantId,
            variantId: variant.id,
            locationId: centralLocationId,
            quantity: variantPlan.stock,
            movementType: 'inbound',
            referenceType: 'DemoSeed',
            referenceId: productId,
            idempotencyKey: movementKey,
            note: 'RUDA 行业后台演示期初库存'
          }
        });
      }
    }
  }

  let storeCount = 0;
  const seededStoreIds: string[] = [];
  for (const storeSeed of seed.stores || []) {
    const store = await prisma.merchantStore.upsert({
      where: { merchantId_code: { merchantId, code: storeSeed.code } },
      update: {
        name: storeSeed.name,
        city: storeSeed.city,
        address: storeSeed.address,
        phone: storeSeed.phone,
        status: 'active'
      },
      create: {
        merchantId,
        code: storeSeed.code,
        name: storeSeed.name,
        city: storeSeed.city,
        address: storeSeed.address,
        phone: storeSeed.phone,
        status: 'active'
      }
    });
    storeCount += 1;
    seededStoreIds.push(store.id);
    const storeStockQuantity = [12, 6][storeCount - 1] ?? 6;
    for (const [productIndex, product] of seed.products.entries()) {
      const productId = demoProductId(seed, productIndex);
      for (const variantPlan of buildVariants(seed, seed.templateId, productIndex)) {
        await prisma.merchantStoreStock.upsert({
          where: { storeId_productId_sku: { storeId: store.id, productId, sku: variantPlan.sku } },
          update: {},
          create: {
            merchantId,
            storeId: store.id,
            productId,
            sku: variantPlan.sku,
            styleNo: `${seed.stylePrefix}-${String(productIndex + 1).padStart(2, '0')}`,
            productName: `【演示】${product.name}`,
            quantity: storeStockQuantity
          }
        });
      }
    }
  }

  const activity = await seedDemoActivity({ seed, merchantId, passwordHash, storeIds: seededStoreIds, centralLocationId });

  return {
    merchantId,
    email,
    templateId: template.id,
    workspaceTemplateId: template.workspaceTemplateId,
    products: seed.products.length,
    variants: variantCount,
    stores: storeCount,
    orders: activity.orders,
    purchaseOrders: activity.purchaseOrders,
    employees: activity.employees,
    transfers: activity.transfers,
    warnings
  };
}

/**
 * 演示经营数据：订单、采购单、员工、门店调拨。
 *
 * 只写 `demo-industry-*` 商家内的确定性 ID/单号，重复执行是幂等的；
 * 不创建支付流水、不伪造真实收款，也不触碰任何非演示商家。
 */
async function seedDemoActivity(input: {
  seed: DemoMerchantSeed;
  merchantId: string;
  passwordHash: string;
  storeIds: string[];
  centralLocationId: string;
}): Promise<{ orders: number; purchaseOrders: number; employees: number; transfers: number }> {
  const { seed, merchantId, passwordHash, storeIds, centralLocationId } = input;
  const capability = getMerchantIndustryCapability(seed.templateId);
  if (!capability) return { orders: 0, purchaseOrders: 0, employees: 0, transfers: 0 };

  const products = await prisma.product.findMany({
    where: { merchantId, id: { startsWith: `demo-industry-${seed.key}-` } },
    orderBy: { styleNo: 'asc' },
    select: { id: true, styleNo: true, name: true, wholesalePrice: true, rrpPrice: true, merchantName: true }
  });
  if (!products.length) return { orders: 0, purchaseOrders: 0, employees: 0, transfers: 0 };
  const first = products[0];
  const firstSku = await prisma.productVariant.findFirst({
    where: { productId: first.id },
    orderBy: { sku: 'asc' },
    select: { id: true, sku: true, color: true, size: true, barcode: true }
  });
  if (!firstSku) return { orders: 0, purchaseOrders: 0, employees: 0, transfers: 0 };

  // 1) 员工：每个演示商家 1 个；连锁店绑定第一个门店，用于验证门店归属校验。
  const employeeId = `demo-industry-team-${seed.key}`;
  const employeeEmail = `demo-team-${seed.key}@ruda.fashion`;
  await prisma.merchantEmployee.upsert({
    where: { merchantId_email: { merchantId, email: employeeEmail } },
    update: {
      name: 'DEMO · 店长',
      role: 'store_manager',
      storeId: capability.inventory.mode === 'store' ? storeIds[0] ?? null : null,
      active: true
    },
    create: {
      id: employeeId,
      merchantId,
      email: employeeEmail,
      name: 'DEMO · 店长',
      role: 'store_manager',
      storeId: capability.inventory.mode === 'store' ? storeIds[0] ?? null : null,
      passwordHash,
      permissions: JSON.stringify([
        'sales.order.create', 'product.publish', 'pricing.request', 'warehouse.pick', 'warehouse.review',
        'warehouse.pack', 'warehouse.ship', 'return.manage', 'employees.manage', 'purchase.manage'
      ])
    }
  });

  // 2) 订单：两种状态，便于验证订单处理路径。
  const orderSeeds = [
    { suffix: 'PENDING', status: 'pending', paymentStatus: 'unpaid', quantity: 2, daysAgo: 2 },
    { suffix: 'SHIPPED', status: 'shipped', paymentStatus: 'paid', quantity: 1, daysAgo: 6 },
    ...(capability.inventory.mode === 'store'
      ? [{ suffix: 'CONFIRMED', status: 'confirmed', paymentStatus: 'paid', quantity: 1, daysAgo: 3 }]
      : [])
  ];
  const returnCustomerId = `demo-industry-customer-${seed.key}`;
  if (capability.inventory.mode === 'store') {
    await prisma.customer.upsert({
      where: { id: returnCustomerId },
      update: { status: 'approved' },
      create: {
        id: returnCustomerId,
        companyName: 'DEMO 连锁店退货客户',
        vatNumber: `DEMO-${seed.key}`,
        address: 'Demo Street 1',
        city: seed.city,
        country: 'Italia',
        contactPerson: 'DEMO 客户',
        phone: '+39 000 000 0000',
        email: `demo-return-${seed.key}@ruda.fashion`,
        status: 'approved',
        registrationDate: new Date().toISOString().slice(0, 10)
      }
    });
  }
  for (const orderSeed of orderSeeds) {
    const orderNo = `DEMO-${seed.stylePrefix}-${orderSeed.suffix}`;
    const unitPrice = Number(first.wholesalePrice) > 0
      ? Number(first.wholesalePrice)
      : Number(first.rrpPrice);
    const totalAmount = Number((unitPrice * orderSeed.quantity).toFixed(2));
    const createdAt = new Date(Date.now() - orderSeed.daysAgo * 24 * 60 * 60 * 1000);
    const storeId = capability.inventory.mode === 'store' ? storeIds[0] ?? null : null;
    const customerId = storeId && orderSeed.status === 'confirmed' ? returnCustomerId : null;
    const order = await prisma.order.upsert({
      where: { orderNo },
      update: { status: orderSeed.status, paymentStatus: orderSeed.paymentStatus, storeId, customerId },
      create: {
        id: `demo-industry-order-${seed.key}-${orderSeed.suffix.toLowerCase()}`,
        orderNo,
        date: createdAt.toISOString().slice(0, 10),
        customerId,
        companyName: 'DEMO 演示客户',
        totalQty: orderSeed.quantity,
        totalAmount,
        status: orderSeed.status,
        deliveryType: 'shipping',
        paymentMethod: 'bank_transfer',
        paymentStatus: orderSeed.paymentStatus,
        timeline: JSON.stringify([
          { status: 'pending', title: '演示订单已创建', time: createdAt.toISOString(), completed: true },
          ...(orderSeed.status === 'shipped'
            ? [{ status: 'shipped', title: '演示订单已发货', time: new Date().toISOString(), completed: true }]
            : [])
        ]),
        shippingStreet: 'Demo Street 1',
        shippingCity: seed.city,
        shippingCountry: 'Italia',
        shippingZip: '00000',
        shippingRecipient: 'DEMO 演示客户',
        shippingPhone: '+39 000 000 0000',
        notes: 'RUDA 行业后台演示订单',
        merchantId,
        merchantName: first.merchantName || seed.name,
        storeId,
        items: {
          create: [{
            id: `demo-industry-order-item-${seed.key}-${orderSeed.suffix.toLowerCase()}`,
            productId: first.id,
            styleNo: first.styleNo,
            productName: first.name,
            image: '',
            sku: firstSku.sku,
            color: firstSku.color || '',
            size: firstSku.size || '',
            quantity: orderSeed.quantity,
            unitPrice,
            packSize: 1,
            merchantId,
            merchantName: first.merchantName || seed.name
          }]
        }
      }
    });
    if (storeId && ['pending', 'confirmed'].includes(orderSeed.status)) {
      await prisma.stockReservation.upsert({
        where: { id: `demo-industry-reservation-${seed.key}-${orderSeed.suffix.toLowerCase()}` },
        update: {
          orderId: order.id,
          productId: first.id,
          sku: firstSku.sku,
          location: `store:${storeId}`,
          quantity: orderSeed.quantity,
          status: 'reserved'
        },
        create: {
          id: `demo-industry-reservation-${seed.key}-${orderSeed.suffix.toLowerCase()}`,
          orderId: order.id,
          productId: first.id,
          sku: firstSku.sku,
          location: `store:${storeId}`,
          quantity: orderSeed.quantity,
          status: 'reserved'
        }
      });
    }
    if (storeId && orderSeed.status === 'confirmed') {
      await prisma.returnRequest.upsert({
        where: { id: `demo-industry-return-${seed.key}` },
        update: {
          orderId: order.id,
          customerId: returnCustomerId,
          merchantId,
          reason: 'RUDA 行业门店履约退货演示',
          status: 'approved',
          requestedQty: 1,
          items: JSON.stringify([{ productId: first.id, sku: firstSku.sku, quantity: 1 }])
        },
        create: {
          id: `demo-industry-return-${seed.key}`,
          orderId: order.id,
          customerId: returnCustomerId,
          merchantId,
          reason: 'RUDA 行业门店履约退货演示',
          status: 'approved',
          requestedQty: 1,
          items: JSON.stringify([{ productId: first.id, sku: firstSku.sku, quantity: 1 }])
        }
      });
    }
  }

  // 3) 采购单：部分到货，验证已到/未到数量。
  let purchaseOrders = 0;
  if (capability.features.procurement) {
    const supplier = await prisma.supplier.upsert({
      where: { merchantId_name: { merchantId, name: 'DEMO 演示供应商' } },
      update: { status: 'active' },
      create: {
        merchantId,
        name: 'DEMO 演示供应商',
        contactName: 'DEMO 供应联系',
        email: `demo-supplier-${seed.key}@ruda.fashion`,
        country: 'Italia',
        leadTimeDays: 7
      }
    });
    const purchaseOrderNo = `DEMO-${seed.stylePrefix}-PO-1`;
    const seededPurchaseOrder = await prisma.merchantPurchaseOrder.upsert({
      where: { purchaseOrderNo },
      update: { status: 'partially_received' },
      include: { items: true },
      create: {
        id: `demo-industry-po-${seed.key}`,
        purchaseOrderNo,
        merchantId,
        supplierId: supplier.id,
        status: 'partially_received',
        currency: 'EUR',
        expectedAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        orderedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        notes: 'RUDA 行业后台演示采购单（部分到货）',
        createdBy: employeeId,
        items: {
          create: [{
            id: `demo-industry-po-item-${seed.key}`,
            productId: first.id,
            variantId: firstSku.id,
            styleNo: first.styleNo,
            productName: first.name,
            sku: firstSku.sku,
            color: firstSku.color || null,
            size: firstSku.size || null,
            orderedQuantity: 5,
            receivedQuantity: 2,
            unitCost: Number((Number(first.wholesalePrice) * 0.6).toFixed(4))
          }]
        }
      }
    });
    purchaseOrders = 1;

    // 真实流程里“草稿 → 已下单”会把未到货数量写入在途库存；演示脚本直接落库，
    // 这里把在途补齐为剩余未到数量，否则演示商家无法继续完成剩余到货入库。
    const seededItem = seededPurchaseOrder.items[0];
    const outstandingQuantity = seededItem
      ? Math.max(0, seededItem.orderedQuantity - seededItem.receivedQuantity)
      : 0;
    const transitBalance = await prisma.inventoryBalance.findUnique({
      where: { variantId_locationId: { variantId: firstSku.id, locationId: centralLocationId } }
    });
    if (transitBalance) {
      await prisma.inventoryBalance.update({
        where: { id: transitBalance.id },
        data: { inTransitQuantity: outstandingQuantity }
      });
    } else {
      await prisma.inventoryBalance.create({
        data: {
          merchantId,
          variantId: firstSku.id,
          locationId: centralLocationId,
          onHandQuantity: 0,
          reservedQuantity: 0,
          inTransitQuantity: outstandingQuantity
        }
      });
    }
  }

  // 4) 连锁店：一条已完成调拨 + 一条待处理调拨。
  let transfers = 0;
  if (capability.features.transfers && storeIds.length >= 2) {
    const transferSeeds = [
      { suffix: 'DONE', status: 'received' as const },
      { suffix: 'WAIT', status: 'requested' as const }
    ];
    for (const transferSeed of transferSeeds) {
      const transferNo = `DEMO-${seed.stylePrefix}-TR-${transferSeed.suffix}`;
      const dispatchedAt = transferSeed.status === 'received' ? new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) : null;
      const receivedAt = transferSeed.status === 'received' ? new Date(Date.now() - 24 * 60 * 60 * 1000) : null;
      await prisma.merchantStoreTransfer.upsert({
        where: { transferNo },
        update: { status: transferSeed.status, dispatchedAt, receivedAt },
        create: {
          id: `demo-industry-transfer-${seed.key}-${transferSeed.suffix.toLowerCase()}`,
          transferNo,
          merchantId,
          fromStoreId: storeIds[0],
          toStoreId: storeIds[1],
          status: transferSeed.status,
          note: 'RUDA 行业后台演示调拨',
          createdBy: employeeId,
          dispatchedAt,
          receivedAt,
          items: {
            create: [{
              id: `demo-industry-transfer-item-${seed.key}-${transferSeed.suffix.toLowerCase()}`,
              productId: first.id,
              sku: firstSku.sku,
              styleNo: first.styleNo,
              productName: first.name,
              quantity: 2
            }]
          }
        }
      });
      transfers += 1;
    }
  }

  return { orders: orderSeeds.length, purchaseOrders, employees: 1, transfers };
}

async function main() {
  if (process.env.INDUSTRY_DEMO_SEED_CONFIRM !== DEMO_SEED_CONFIRMATION) {
    throw new Error(`Set INDUSTRY_DEMO_SEED_CONFIRM=${DEMO_SEED_CONFIRMATION} to create demo merchants.`);
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  const demoPassword = process.env[DEMO_ACCOUNT_PASSWORD_ENV];
  if (!demoPassword || demoPassword.length < 8) throw new Error(`${DEMO_ACCOUNT_PASSWORD_ENV}_REQUIRED_MIN_8`);
  if (merchantIndustryDemoAccounts.length !== demoMerchantSeeds.length
    || merchantIndustryDemoAccounts.some(account => !demoMerchantSeeds.some(seed => seed.templateId === account.templateId))) {
    throw new Error('INDUSTRY_DEMO_ACCOUNT_MAPPING_INVALID');
  }
  const centralLocation = await prisma.warehouseLocation.findFirst({
    where: { merchantId: null, code: SINGLE_WAREHOUSE_CODE, isActive: true },
    select: { id: true }
  });
  if (!centralLocation) throw new Error('INVENTORY_LOCATION_NOT_CONFIGURED');
  const passwordHash = await bcrypt.hash(demoPassword, 12);
  const results: DemoMerchantResult[] = [];
  for (const seed of demoMerchantSeeds) {
    results.push(await seedMerchant(seed, centralLocation.id, passwordHash));
  }
  console.log(JSON.stringify({ accounts: results }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch(error => {
      console.error('[seed-industry-demo-merchants] failed:', error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

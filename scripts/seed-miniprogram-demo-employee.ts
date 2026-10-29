import 'dotenv/config';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { pathToFileURL } from 'node:url';
import { buildDemoMerchantData, DEMO_SHOWROOMS } from './seed-public-demo-showrooms.js';
import { defaultEmployeePermissions } from '../src/server/employeePermissions.js';
import {
  getMiniProgramDemoAccountIds,
  isIsolatedMiniProgramDemoMerchant,
  MINI_PROGRAM_DEMO_ACCOUNTS
} from '../src/server/miniprogramDemo.js';
import { SINGLE_WAREHOUSE_CODE } from '../src/server/warehouse.js';

const prisma = new PrismaClient();
const TEST_CONFIRMATION = 'CREATE_RUDA_MINIPROGRAM_DEMO_EMPLOYEE';
const PUBLIC_CONFIRMATION = 'CREATE_PUBLIC_RUDA_MINIPROGRAM_DEMO_EMPLOYEE';
const DEFAULT_DEMO_MERCHANT_ID = 'ruda-demo-merchant-03';
const DEMO_EMPLOYEE_NAME = 'RUDA Mini Program Demo Employee';
const DEMO_PRODUCT_MARKER = '【RUDA小程序演示】';

export function buildDemoProducts(merchantId: string, merchantName: string) {
  const merchantKey = crypto.createHash('sha256').update(merchantId).digest('hex').slice(0, 8).toUpperCase();
  const samples = [
    { key: 'KNIT', name: '演示针织上衣', category: 'women', subCategory: '针织', price: 18, stock: 24 },
    { key: 'BAG', name: '演示通勤手袋', category: 'bags', subCategory: '手袋', price: 32, stock: 16 },
    { key: 'SCARF', name: '演示印花丝巾', category: 'accessories', subCategory: '丝巾', price: 12, stock: 30 }
  ];
  return samples.map(sample => {
    const id = `ruda-mini-demo-${merchantKey}-${sample.key.toLowerCase()}`;
    const styleNo = `RDM-${merchantKey}-${sample.key}`;
    const skus = [
      {
        sku: `${styleNo}-01`,
        color: 'Black',
        colorCode: '#111111',
        size: 'One Size',
        stockCentral: sample.stock,
        stockMestre: 0,
        stockMilano: 0,
        reserved: 0
      }
    ];
    const image = `https://modaui.com/demo-products/model-${sample.key === 'KNIT' ? '01' : sample.key === 'BAG' ? '05' : '03'}.jpg`;
    return {
      id,
      styleNo,
      sku: skus[0],
      skus,
      name: `${DEMO_PRODUCT_MARKER}${sample.name}`,
      category: sample.category,
      subCategory: sample.subCategory,
      brand: 'RUDA Demo',
      season: 'DEMO',
      images: JSON.stringify([image]),
      media: JSON.stringify([{ id: `${id}-image`, type: 'image', url: image }]),
      wholesalePrice: sample.price,
      rrpPrice: sample.price * 2.5,
      moq: 1,
      packSize: 1,
      status: 'new',
      inventoryStatus: 'in_stock',
      origin: 'RUDA 演示商品',
      fabric: '演示材质',
      composition: '演示用途，不代表真实商品。',
      weight: '0.3 kg',
      packaging: '演示包装',
      washCare: '按产品标签保养',
      description: 'RUDA 商家小程序演示商品，用于测试商品、库存和收银流程。',
      merchantId,
      merchantName,
      visibility: 'public',
      lifecycleStatus: 'published',
      featuredOnHome: false,
      isExclusiveProtected: false,
      protectionLevel: 'public'
    };
  });
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must target the intended demo database.');
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction && !['development', 'test'].includes(process.env.NODE_ENV || '')) {
    throw new Error('Set NODE_ENV to development, test, or production before seeding the demo employee.');
  }
  if (isProduction) {
    if (process.env.RUDA_MINIPROGRAM_DEMO_PUBLIC_ENABLED !== 'true'
      || process.env.RUDA_MINIPROGRAM_DEMO_PUBLIC_SEED_CONFIRM !== PUBLIC_CONFIRMATION) {
      throw new Error(`Production write refused. To seed only a verified RUDA demo merchant, enable RUDA_MINIPROGRAM_DEMO_PUBLIC_ENABLED and set RUDA_MINIPROGRAM_DEMO_PUBLIC_SEED_CONFIRM=${PUBLIC_CONFIRMATION}.`);
    }
  } else if (process.env.RUDA_MINIPROGRAM_DEMO_SEED_CONFIRM !== TEST_CONFIRMATION) {
    throw new Error(`Write refused. Set RUDA_MINIPROGRAM_DEMO_SEED_CONFIRM=${TEST_CONFIRMATION}.`);
  }
  if (!process.argv.includes('--apply')) {
    throw new Error('Write refused. Pass --apply after verifying the target database and isolated demo merchant.');
  }
  if (process.env.RUDA_MINIPROGRAM_DEMO_CREDENTIALS_ENABLED !== 'true') {
    throw new Error('Set RUDA_MINIPROGRAM_DEMO_CREDENTIALS_ENABLED=true to enable the demo login hint.');
  }
  const merchantId = process.env.RUDA_MINIPROGRAM_DEMO_MERCHANT_ID?.trim() || DEFAULT_DEMO_MERCHANT_ID;
  const demoNumber = /^ruda-demo-merchant-(\d{2})$/.exec(merchantId)?.[1];
  const demoIndex = DEMO_SHOWROOMS.findIndex(showroom => showroom.number === demoNumber);
  if (demoIndex < 0) throw new Error('The demo merchant ID must match a configured RUDA public demo showroom.');
  const password = process.env.RUDA_MINIPROGRAM_DEMO_PASSWORD || '';
  if (password.length < 10) throw new Error('RUDA_MINIPROGRAM_DEMO_PASSWORD must contain at least 10 characters.');

  const configuredMerchantData = buildDemoMerchantData(demoIndex, DEMO_SHOWROOMS[demoIndex]);
  const existingMerchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: {
      id: true,
      name: true,
      code: true,
      storeSlug: true,
      industrySource: true,
      settings: true,
      storefrontSeoTitle: true,
      storefrontEnabled: true,
      isVerified: true
    }
  });
  if (existingMerchant && !isIsolatedMiniProgramDemoMerchant(existingMerchant)) {
    throw new Error('The configured merchant ID is already used by a non-demo merchant.');
  }
  if (!existingMerchant) {
    const identityConflict = await prisma.merchant.findFirst({
      where: {
        OR: [
          { code: configuredMerchantData.code },
          { storeSlug: configuredMerchantData.storeSlug }
        ]
      },
      select: { id: true }
    });
    if (identityConflict) throw new Error('A demo merchant code or store URL is already in use by another merchant.');
  }
  const merchant = existingMerchant || {
    ...configuredMerchantData,
    id: merchantId
  };
  if (!(merchant.storefrontEnabled === true || (merchant.storefrontEnabled == null && merchant.isVerified))) {
    throw new Error('The configured merchant storefront is not enabled for employee login.');
  }
  const existingLocation = await prisma.warehouseLocation.findFirst({
    where: { merchantId: null, code: SINGLE_WAREHOUSE_CODE },
    select: { id: true }
  });
  if (existingLocation) {
    const activeLocation = await prisma.warehouseLocation.findFirst({
      where: { id: existingLocation.id, isActive: true },
      select: { id: true }
    });
    if (!activeLocation) throw new Error(`The shared ${SINGLE_WAREHOUSE_CODE} warehouse exists but is inactive; no records were changed.`);
  }

  const accountIds = getMiniProgramDemoAccountIds(merchant.id);
  const existingMemberships = await prisma.merchantEmployee.findMany({
    where: { email: { equals: MINI_PROGRAM_DEMO_ACCOUNTS.employee.email, mode: 'insensitive' } },
    select: { merchantId: true, name: true }
  });
  if (existingMemberships.some(membership => (
    membership.merchantId !== merchant.id || membership.name !== DEMO_EMPLOYEE_NAME
  ))) {
    throw new Error('The demo employee email is already used outside the isolated demo merchant. No records were changed.');
  }

  const existingAccounts = await prisma.authAccount.findMany({
    where: {
      OR: [
        { id: accountIds.merchantAccountId },
        { id: accountIds.partnerAccountId },
        { role: 'merchant', email: MINI_PROGRAM_DEMO_ACCOUNTS.merchant.email },
        { role: 'partner', email: MINI_PROGRAM_DEMO_ACCOUNTS.partner.email },
        { merchantId: merchant.id },
        { merchantCode: merchant.code },
        { partnerId: accountIds.partnerId }
      ]
    },
    select: { id: true, role: true, email: true, merchantId: true, merchantCode: true, partnerId: true }
  });
  if (existingAccounts.some(account => (
    (account.id === accountIds.merchantAccountId
      && (account.role !== 'merchant' || account.merchantId !== merchant.id || account.email !== MINI_PROGRAM_DEMO_ACCOUNTS.merchant.email))
    || (account.id === accountIds.partnerAccountId
      && (account.role !== 'partner' || account.partnerId !== accountIds.partnerId || account.email !== MINI_PROGRAM_DEMO_ACCOUNTS.partner.email))
    || (account.role === 'merchant'
      && account.email === MINI_PROGRAM_DEMO_ACCOUNTS.merchant.email
      && account.id !== accountIds.merchantAccountId)
    || (account.role === 'partner'
      && account.email === MINI_PROGRAM_DEMO_ACCOUNTS.partner.email
      && account.id !== accountIds.partnerAccountId)
    || (account.merchantId === merchant.id && account.id !== accountIds.merchantAccountId)
    || (account.merchantCode === merchant.code && account.id !== accountIds.merchantAccountId)
    || (account.partnerId === accountIds.partnerId && account.id !== accountIds.partnerAccountId)
  ))) {
    throw new Error('A demo owner or partner account identifier is already used by a different account. No records were changed.');
  }

  const existingPartners = await prisma.partner.findMany({
    where: {
      OR: [
        { id: accountIds.partnerId },
        { partnerCode: accountIds.partnerCode },
        { email: MINI_PROGRAM_DEMO_ACCOUNTS.partner.email }
      ]
    },
    select: { id: true, partnerCode: true, email: true, role: true }
  });
  if (existingPartners.some(partner => (
    partner.id !== accountIds.partnerId
    || partner.partnerCode !== accountIds.partnerCode
    || partner.email !== MINI_PROGRAM_DEMO_ACCOUNTS.partner.email
    || partner.role !== 'agent'
  ))) {
    throw new Error('The demo partner identity is already used by a different account. No records were changed.');
  }

  const products = buildDemoProducts(merchant.id, merchant.name);
  const existingProducts = await prisma.product.findMany({
    where: { id: { in: products.map(product => product.id) } },
    select: { id: true, merchantId: true, name: true }
  });
  if (existingProducts.some(product => (
    product.merchantId !== merchant.id || !product.name.startsWith(DEMO_PRODUCT_MARKER)
  ))) {
    throw new Error('A demo product identifier is already used by a non-demo product. No records were changed.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const permissions = Array.from(new Set(Object.values(defaultEmployeePermissions).flat()));
  const seeded = await prisma.$transaction(async tx => {
    const storedMerchant = await tx.merchant.findUnique({ where: { id: merchant.id }, select: { id: true } });
    if (!storedMerchant) {
      await tx.merchant.create({ data: { ...configuredMerchantData, id: merchant.id } });
    }
    let location = await tx.warehouseLocation.findFirst({
      where: { merchantId: null, code: SINGLE_WAREHOUSE_CODE, isActive: true },
      select: { id: true }
    });
    if (!location) {
      location = await tx.warehouseLocation.create({
        data: {
          id: 'ruda-mini-demo-central-warehouse',
          merchantId: null,
          code: SINGLE_WAREHOUSE_CODE,
          name: 'RUDA Central Warehouse',
          type: 'central',
          country: 'Italia',
          city: 'Prato',
          isActive: true
        },
        select: { id: true }
      });
    }

    await tx.authAccount.upsert({
      where: { id: accountIds.merchantAccountId },
      create: {
        id: accountIds.merchantAccountId,
        role: 'merchant',
        email: MINI_PROGRAM_DEMO_ACCOUNTS.merchant.email,
        merchantId: merchant.id,
        merchantCode: merchant.code,
        passwordHash,
        permissions: '[]',
        emailVerifiedAt: new Date()
      },
      update: {
        role: 'merchant',
        email: MINI_PROGRAM_DEMO_ACCOUNTS.merchant.email,
        merchantId: merchant.id,
        merchantCode: merchant.code,
        passwordHash,
        emailVerifiedAt: new Date()
      }
    });

    const employee = await tx.merchantEmployee.upsert({
      where: { merchantId_email: { merchantId: merchant.id, email: MINI_PROGRAM_DEMO_ACCOUNTS.employee.email } },
      create: {
        merchantId: merchant.id,
        email: MINI_PROGRAM_DEMO_ACCOUNTS.employee.email,
        name: DEMO_EMPLOYEE_NAME,
        passwordHash,
        role: 'store_manager',
        permissions: JSON.stringify(permissions),
        active: true
      },
      update: {
        name: DEMO_EMPLOYEE_NAME,
        passwordHash,
        role: 'store_manager',
        permissions: JSON.stringify(permissions),
        active: true,
        identityId: null
      },
      select: { id: true, email: true, role: true, active: true }
    });

    await tx.partner.upsert({
      where: { id: accountIds.partnerId },
      create: {
        id: accountIds.partnerId,
        partnerCode: accountIds.partnerCode,
        role: 'agent',
        status: 'active',
        name: 'RUDA Mini Program Demo Agent',
        email: MINI_PROGRAM_DEMO_ACCOUNTS.partner.email,
        country: 'Italia',
        city: 'Prato',
        commissionRate: 0
      },
      update: {
        partnerCode: accountIds.partnerCode,
        role: 'agent',
        status: 'active',
        name: 'RUDA Mini Program Demo Agent',
        email: MINI_PROGRAM_DEMO_ACCOUNTS.partner.email,
        country: 'Italia',
        city: 'Prato',
        commissionRate: 0
      }
    });
    await tx.authAccount.upsert({
      where: { id: accountIds.partnerAccountId },
      create: {
        id: accountIds.partnerAccountId,
        role: 'partner',
        email: MINI_PROGRAM_DEMO_ACCOUNTS.partner.email,
        partnerId: accountIds.partnerId,
        passwordHash,
        permissions: '[]',
        emailVerifiedAt: new Date()
      },
      update: {
        role: 'partner',
        email: MINI_PROGRAM_DEMO_ACCOUNTS.partner.email,
        partnerId: accountIds.partnerId,
        passwordHash,
        emailVerifiedAt: new Date()
      }
    });

    for (const product of products) {
      await tx.product.upsert({
        where: { id: product.id },
        create: {
          id: product.id,
          styleNo: product.styleNo,
          name: product.name,
          name_zh: product.name,
          category: product.category,
          subCategory: product.subCategory,
          brand: product.brand,
          season: product.season,
          images: product.images,
          media: product.media,
          wholesalePrice: product.wholesalePrice,
          rrpPrice: product.rrpPrice,
          moq: product.moq,
          packSize: product.packSize,
          status: product.status,
          inventoryStatus: product.inventoryStatus,
          origin: product.origin,
          fabric: product.fabric,
          composition: product.composition,
          weight: product.weight,
          packaging: product.packaging,
          washCare: product.washCare,
          description: product.description,
          skus: JSON.stringify(product.skus),
          merchantId: product.merchantId,
          merchantName: product.merchantName,
          visibility: product.visibility,
          lifecycleStatus: product.lifecycleStatus,
          featuredOnHome: product.featuredOnHome,
          isExclusiveProtected: product.isExclusiveProtected,
          protectionLevel: product.protectionLevel
        },
        update: {
          name: product.name,
          name_zh: product.name,
          category: product.category,
          subCategory: product.subCategory,
          brand: product.brand,
          season: product.season,
          images: product.images,
          media: product.media,
          wholesalePrice: product.wholesalePrice,
          rrpPrice: product.rrpPrice,
          moq: product.moq,
          packSize: product.packSize,
          status: product.status,
          inventoryStatus: product.inventoryStatus,
          origin: product.origin,
          fabric: product.fabric,
          composition: product.composition,
          weight: product.weight,
          packaging: product.packaging,
          washCare: product.washCare,
          description: product.description,
          skus: JSON.stringify(product.skus),
          merchantName: product.merchantName,
          visibility: product.visibility,
          lifecycleStatus: product.lifecycleStatus,
          inventoryVersion: { increment: 1 }
        }
      });
      const variant = await tx.productVariant.upsert({
        where: { productId_sku: { productId: product.id, sku: product.sku.sku } },
        create: {
          productId: product.id,
          sku: product.sku.sku,
          color: product.sku.color,
          size: product.sku.size,
          isActive: true
        },
        update: {
          color: product.sku.color,
          size: product.sku.size,
          isActive: true
        }
      });
      await tx.inventoryBalance.upsert({
        where: { variantId_locationId: { variantId: variant.id, locationId: location.id } },
        create: {
          merchantId: merchant.id,
          variantId: variant.id,
          locationId: location.id,
          onHandQuantity: product.sku.stockCentral,
          reservedQuantity: 0,
          inTransitQuantity: 0
        },
        update: {
          merchantId: merchant.id,
          onHandQuantity: product.sku.stockCentral,
          reservedQuantity: 0,
          inTransitQuantity: 0,
          version: { increment: 1 }
        }
      });
    }
    return { employee, productCount: products.length };
  });

  const [storedMerchant, storedLocation, storedProducts] = await Promise.all([
    prisma.merchant.findUnique({
      where: { id: merchant.id },
      select: { id: true, code: true, storeSlug: true, industrySource: true, settings: true, storefrontSeoTitle: true }
    }),
    prisma.warehouseLocation.findFirst({
      where: { merchantId: null, code: SINGLE_WAREHOUSE_CODE, isActive: true },
      select: { id: true }
    }),
    prisma.product.findMany({
      where: { id: { in: products.map(product => product.id) }, merchantId: merchant.id },
      select: { id: true, skus: true, lifecycleStatus: true }
    })
  ]);
  if (!storedMerchant || !isIsolatedMiniProgramDemoMerchant(storedMerchant)
    || !storedLocation || storedProducts.length !== products.length
    || storedProducts.some(product => product.lifecycleStatus !== 'published'
      || !JSON.parse(product.skus).some((sku: { stockCentral?: number }) => (sku.stockCentral ?? 0) > 0))) {
    throw new Error('Post-write verification failed for the isolated demo merchant, warehouse, or stocked products.');
  }

  console.log(JSON.stringify({
    result: 'demo-employee-seeded',
    merchant: merchant.name,
    accounts: [
      MINI_PROGRAM_DEMO_ACCOUNTS.merchant.email,
      seeded.employee.email,
      MINI_PROGRAM_DEMO_ACCOUNTS.partner.email
    ],
    role: seeded.employee.role,
    active: seeded.employee.active,
    permissions: 'all configured employee permissions',
    products: seeded.productCount,
    note: 'The merchant and employee accounts use the unified mini program login. The agent account uses https://modaui.com/partner. All three accounts and demo products are isolated to the marked RUDA demo environment.'
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch(error => {
      console.error('[seed-miniprogram-demo-employee] failed:', error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

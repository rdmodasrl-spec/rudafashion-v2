import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { Prisma, PrismaClient } from '@prisma/client';
import { pathToFileURL } from 'node:url';
import { defaultEmployeePermissions } from '../src/server/employeePermissions.js';

const prisma = new PrismaClient();

const DEMO_MARKER = 'RUDA_PUBLIC_DEMO_SEED_V1';
const APPLY_CONFIRMATION = 'CREATE_RUDA_PUBLIC_DEMO_DATA';
const CURRENT_SEASON = 'DEMO 2026';
const PASSWORD_ENV = 'RUDA_DEMO_SHARED_PASSWORD';

const demoStoreImages = [
  'https://modaui.com/demo-products/model-01.jpg',
  'https://modaui.com/demo-products/model-02.jpg',
  'https://modaui.com/demo-products/model-03.jpg',
  'https://modaui.com/demo-products/model-04.jpg',
  'https://modaui.com/demo-products/model-05.jpg',
  'https://modaui.com/demo-products/model-06.jpg'
] as const;

const productGalleries: Record<string, readonly string[]> = {
  women: [
    'model-01.jpg', 'category-knitwear.jpg', 'category-blouses.jpg', 'category-dresses.jpg',
    'model-02.jpg', 'category-skirts.jpg', 'category-tailoring.jpg', 'model-05.jpg', 'category-coats.jpg'
  ],
  men: [
    'category-coats.jpg', 'category-pants.jpg', 'category-t-shirts.jpg', 'category-jeans.jpg',
    'model-06.jpg'
  ],
  bags: ['category-bags.jpg', 'category-wallets.jpg', 'category-belts.jpg'],
  accessories: ['category-scarves.jpg', 'category-belts.jpg', 'category-jewelry.jpg', 'category-wallets.jpg']
};

export function buildDemoMerchantData(index: number, showroom: typeof DEMO_SHOWROOMS[number]) {
  const image = demoStoreImages[index % demoStoreImages.length];
  return {
    name: showroom.name,
    companyLegalName: `${showroom.name} Demo S.r.l.`,
    code: `RUDA-DEMO-${showroom.number}`,
    country: 'Italia',
    country_it: 'Italia',
    country_zh: '意大利',
    city: showroom.city,
    city_it: showroom.city,
    city_zh: showroom.city,
    showroomAddress: `RUDA Demo District, ${showroom.city}`,
    showroomArea: '250 m²',
    showroomArea_it: 'Showroom demo 250 m²',
    showroomArea_zh: '250 m² 演示展厅',
    showroomImage: image,
    showroomPanoramicImages: JSON.stringify([image]),
    logo: image,
    banner: image,
    tagline: `RUDA 演示店 · ${showroom.name}`,
    tagline_it: `Showroom demo RUDA · ${showroom.name}`,
    tagline_zh: `RUDA 演示店 · ${showroom.name}`,
    description: `RUDA 官方演示店，展示${showroom.name}的店铺与商品页面。演示内容不代表真实商家、库存或报价。`,
    description_it: `Showroom dimostrativo RUDA ${showroom.name}. Dati e disponibilità non sono reali.`,
    description_zh: `RUDA 官方演示店，展示${showroom.name}的店铺与商品页面。演示内容不代表真实商家、库存或报价。`,
    specialties: JSON.stringify(showroom.products.map(product => product.name)),
    foundedYear: 2020 + index % 5,
    contactPerson: `RUDA Demo Manager ${showroom.number}`,
    contactPhone: '+39 000 000 0000',
    contactEmail: `demo-store-${showroom.number}@ruda.fashion`,
    isVerified: true,
    rating: 4.8,
    publicProductsCount: showroom.products.length,
    protectedVaultCount: 0,
    storeSlug: `ruda-demo-${showroom.number}`,
    merchantZone: showroom.zone,
    industry: showroom.industry === 'LEATHER_GOODS' ? 'OTHER' : showroom.industry,
    industrySource: 'ADMIN',
    storefrontEnabled: true,
    storefrontSeoTitle: `RUDA DEMO · ${showroom.name}`,
    storefrontSeoDescription: `RUDA 官方演示店；仅用于体验，不代表真实商家或商品。`,
    businessType: 'brand_supplier',
    vatNumber: `RUDA-DEMO-${showroom.number}`,
    settings: JSON.stringify({ rudaDemoSeed: DEMO_MARKER })
  };
}

export const DEMO_SHOWROOMS = [
  {
    number: '03', name: 'Atelier Alba', city: 'Prato', industry: 'FASHION_COMPANY', zone: 'iolo',
    products: [
      { name: '轻柔羊毛针织衫', category: 'women', kind: 'public' },
      { name: '认证款混纺针织外套', category: 'women', kind: 'verified' },
      { name: '折扣羊毛针织衫', category: 'women', kind: 'discount' }
    ]
  },
  {
    number: '04', name: 'Moda Prato', city: 'Prato', industry: 'FASHION_COMPANY', zone: 'iolo',
    products: [
      { name: '优雅针织上衣', category: 'women', kind: 'public' },
      { name: '认证款意式羊毛开衫', category: 'women', kind: 'verified' },
      { name: '季末折扣毛衣', category: 'women', kind: 'discount' }
    ]
  },
  {
    number: '05', name: 'Vela Donna', city: 'Milan', industry: 'FASHION_COMPANY', zone: 'tavoro',
    products: [
      { name: '羊毛混纺针织衫', category: 'women', kind: 'public' },
      { name: '认证款限定针织开衫', category: 'women', kind: 'verified' },
      { name: '折扣针织套头衫', category: 'women', kind: 'discount' }
    ]
  },
  { number: '06', name: 'Pelle Toscana', city: 'Florence', industry: 'LEATHER_GOODS', zone: 'leather', products: [{ name: '意式通勤托特包', category: 'bags', kind: 'public' }, { name: '简约肩背包', category: 'bags', kind: 'public' }] },
  { number: '07', name: 'Casa Borsa', city: 'Bologna', industry: 'LEATHER_GOODS', zone: 'leather', products: [{ name: '柔软皮革手提包', category: 'bags', kind: 'public' }, { name: '轻便斜挎包', category: 'bags', kind: 'public' }] },
  { number: '08', name: 'RUDA Trading Hub', city: 'Verona', industry: 'TRADING_COMPANY', zone: 'tavoro', products: [{ name: '商务休闲衬衫', category: 'men', kind: 'public' }, { name: '轻量通勤夹克', category: 'men', kind: 'public' }] },
  { number: '09', name: 'Mercato Select', city: 'Milan', industry: 'DEPARTMENT_STORE', zone: 'boutique_department', products: [{ name: '印花丝巾', category: 'accessories', kind: 'public' }, { name: '皮革腰带', category: 'accessories', kind: 'public' }] },
  { number: '10', name: 'Linea Uniformi', city: 'Rome', industry: 'RESTAURANT', zone: 'boutique_department', products: [{ name: '餐饮工作围裙', category: 'men', kind: 'public' }, { name: '厨师轻便外套', category: 'men', kind: 'public' }] },
  { number: '11', name: 'Boutique Firenze', city: 'Florence', industry: 'RETAIL_STORE', zone: 'boutique_department', products: [{ name: '日常百搭半身裙', category: 'women', kind: 'public' }, { name: '柔软针织上衣', category: 'women', kind: 'public' }] },
  { number: '12', name: 'Urban Moda Retail', city: 'Turin', industry: 'RETAIL_STORE', zone: 'boutique_department', products: [{ name: '都市休闲卫衣', category: 'men', kind: 'public' }, { name: '经典休闲长裤', category: 'men', kind: 'public' }] }
] as const;

export const DEMO_EMPLOYEE_EMAILS = DEMO_SHOWROOMS.map(({ number }) => `${number}@ruda.fashion`);
export const DEMO_BUYER_EMAIL = '13@ruda.fashion';
export const DEMO_BUYER_ID = 'ruda-demo-customer-13';
export const DEMO_BUYER_ACCOUNT_ID = 'ruda-demo-buyer-account-13';

export function buildDemoProducts() {
  return DEMO_SHOWROOMS.flatMap((showroom, showroomIndex) => showroom.products.map((product, productIndex) => {
    const number = String(productIndex + 1).padStart(2, '0');
    const productId = `ruda-demo-product-${showroom.number}-${number}`;
    const styleNo = `RUDA-DEMO-${showroom.number}-${number}`;
    const gallery = productGalleries[product.category];
    const galleryStart = (showroomIndex + productIndex) % gallery.length;
    const images = Array.from({ length: 3 }, (_, index) => (
      `https://modaui.com/demo-products/${gallery[(galleryStart + index) % gallery.length]}`
    ));
    const demoName = `【演示商品】${product.name}`;
    const descriptionZh = `RUDA 官方演示商品，所属演示店：${showroom.name}。商品、价格和库存均为虚构，仅用于页面与流程测试，不可实际采购或履约。`;
    const descriptionIt = `Articolo dimostrativo RUDA dello showroom ${showroom.name}. Prodotto, prezzo e disponibilità sono fittizi; solo per test, non acquistabile.`;
    const isWholesale = product.kind === 'verified';
    const isDiscount = product.kind === 'discount';

    return {
      id: productId,
      styleNo,
      name: `DEMO · ${product.name}`,
      name_it: `DEMO · ${product.name}`,
      name_zh: demoName,
      category: product.category,
      subCategory: product.name,
      brand: `RUDA DEMO · ${showroom.name}`,
      season: CURRENT_SEASON,
      images: JSON.stringify(images),
      media: JSON.stringify(images.map((url, index) => ({ id: `${productId}-image-${index + 1}`, type: 'image', url }))),
      wholesalePrice: isDiscount
        ? 12 + showroomIndex * 2
        : 18 + showroomIndex * 2 + productIndex * 5,
      rrpPrice: 59 + showroomIndex * 4 + productIndex * 12,
      moq: 1,
      packSize: 1,
      status: isDiscount ? 'clearance' : productIndex === 0 ? 'new' : 'hot',
      inventoryStatus: 'coming_soon',
      origin: 'RUDA demo content · not for sale',
      origin_it: 'Contenuto demo RUDA · non in vendita',
      origin_zh: 'RUDA 演示内容 · 非实际销售商品',
      fabric: 'Demo content',
      fabric_it: 'Contenuto demo',
      fabric_zh: '演示内容',
      composition: '演示商品，无实际材质信息。',
      weight: '0',
      packaging: '演示商品，无实际包装信息。',
      washCare: '演示商品，无实际护理信息。',
      description: descriptionZh,
      description_it: descriptionIt,
      description_zh: descriptionZh,
      skus: JSON.stringify([{
        sku: `${styleNo}-01`,
        color: 'Demo',
        colorCode: '#777777',
        size: 'One Size',
        stockCentral: 0,
        stockMestre: 0,
        stockMilano: 0
      }]),
      merchantId: `ruda-demo-merchant-${showroom.number}`,
      merchantName: showroom.name,
      isExclusiveProtected: false,
      protectionLevel: 'public',
      visibility: isWholesale ? 'wholesale' : 'public',
      lifecycleStatus: 'published',
      featuredOnHome: false,
      featuredOnSale: isDiscount
    };
  }));
}

function getSeedPassword() {
  const password = process.env[PASSWORD_ENV];
  if (!password || password.length < 8) {
    throw new Error(`${PASSWORD_ENV} must be set to a password of at least 8 characters.`);
  }
  return password;
}

function assertWriteConfirmation() {
  if (!process.argv.includes('--apply')) {
    throw new Error('Dry run only. Add --apply and set RUDA_DEMO_SEED_CONFIRM=CREATE_RUDA_PUBLIC_DEMO_DATA to write.');
  }
  if (process.env.RUDA_DEMO_SEED_CONFIRM !== APPLY_CONFIRMATION) {
    throw new Error('Write refused: explicit RUDA_DEMO_SEED_CONFIRM is required.');
  }
  if (process.env.NODE_ENV !== 'production') {
    throw new Error('Write refused: run with NODE_ENV=production to target the confirmed production database.');
  }
}

function isMarkedDemoMerchant(merchant: { industrySource: string; settings: string; storefrontSeoTitle: string }) {
  return merchant.industrySource === 'ADMIN'
    && merchant.settings.includes(DEMO_MARKER)
    && merchant.storefrontSeoTitle.startsWith('RUDA DEMO');
}

async function assertNoConflicts(tx: Prisma.TransactionClient) {
  const merchantIds = DEMO_SHOWROOMS.map(({ number }) => `ruda-demo-merchant-${number}`);
  const storeSlugs = DEMO_SHOWROOMS.map(({ number }) => `ruda-demo-${number}`);
  const merchantCodes = DEMO_SHOWROOMS.map(({ number }) => `RUDA-DEMO-${number}`);
  const candidateMerchants = await tx.merchant.findMany({
    where: {
      OR: [
        { id: { in: merchantIds } },
        { storeSlug: { in: storeSlugs } },
        { code: { in: merchantCodes } }
      ]
    },
    select: { id: true, code: true, storeSlug: true, industrySource: true, settings: true, storefrontSeoTitle: true }
  });
  for (const merchant of candidateMerchants) {
    const expectedNumber = DEMO_SHOWROOMS.find(({ number }) => (
      merchant.id === `ruda-demo-merchant-${number}`
      && merchant.code === `RUDA-DEMO-${number}`
      && merchant.storeSlug === `ruda-demo-${number}`
    ));
    if (!expectedNumber || !isMarkedDemoMerchant(merchant)) {
      throw new Error(`Merchant identity conflict detected for an intended demo record (${merchant.id}). No records were changed.`);
    }
  }

  const products = buildDemoProducts();
  const existingProducts = await tx.product.findMany({
    where: {
      OR: [
        { id: { in: products.map(({ id }) => id) } },
        { styleNo: { in: products.map(({ styleNo }) => styleNo) } }
      ]
    },
    select: { id: true, styleNo: true, merchantId: true, description_zh: true, name_zh: true }
  });
  for (const product of existingProducts) {
    const expected = products.find(({ id, styleNo }) => id === product.id && styleNo === product.styleNo);
    if (!expected
      || product.merchantId !== expected.merchantId
      || !product.name_zh?.startsWith('【演示商品】')
      || !product.description_zh?.includes('仅用于页面与流程测试')) {
      throw new Error(`Product identity conflict detected for an intended demo record (${product.id}). No records were changed.`);
    }
  }

  for (const showroom of DEMO_SHOWROOMS) {
    const employeeEmail = `${showroom.number}@ruda.fashion`;
    const employeeMemberships = await tx.merchantEmployee.findMany({
      where: { email: { equals: employeeEmail, mode: 'insensitive' } },
      select: { id: true, email: true, merchantId: true, name: true }
    });
    if (employeeMemberships.some(member => (
      member.id !== `ruda-demo-employee-${showroom.number}`
      || member.email !== employeeEmail
      || member.merchantId !== `ruda-demo-merchant-${showroom.number}`
      || member.name !== `RUDA Demo Manager ${showroom.number}`
    ))) {
      throw new Error(`Employee email conflict detected for ${employeeEmail}. No records were changed.`);
    }
    const customerConflict = await tx.customer.findFirst({
      where: { email: { equals: employeeEmail, mode: 'insensitive' }, id: { not: DEMO_BUYER_ID } },
      select: { id: true }
    });
    if (customerConflict) {
      throw new Error(`Customer email conflict detected for ${employeeEmail}. No records were changed.`);
    }
  }

  const buyerCustomer = await tx.customer.findFirst({
    where: { OR: [{ id: DEMO_BUYER_ID }, { email: { equals: DEMO_BUYER_EMAIL, mode: 'insensitive' } }] },
    select: { id: true, email: true, vatNumber: true }
  });
  if (buyerCustomer && (
    buyerCustomer.id !== DEMO_BUYER_ID
    || buyerCustomer.email.toLowerCase() !== DEMO_BUYER_EMAIL
    || buyerCustomer.vatNumber !== 'RUDA-DEMO-13'
  )) {
    throw new Error('Buyer customer identity conflict detected. No records were changed.');
  }

  const buyerAccount = await tx.authAccount.findFirst({
    where: { OR: [{ id: DEMO_BUYER_ACCOUNT_ID }, { role: 'buyer', email: { equals: DEMO_BUYER_EMAIL, mode: 'insensitive' } }] },
    select: { id: true, role: true, email: true, customerId: true }
  });
  if (buyerAccount && (
    buyerAccount.id !== DEMO_BUYER_ACCOUNT_ID
    || buyerAccount.role !== 'buyer'
    || buyerAccount.email?.toLowerCase() !== DEMO_BUYER_EMAIL
    || buyerAccount.customerId !== DEMO_BUYER_ID
  )) {
    throw new Error('Buyer login identity conflict detected. No records were changed.');
  }
}

async function seed(password: string) {
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction(async tx => {
    await assertNoConflicts(tx);

    for (const [index, showroom] of DEMO_SHOWROOMS.entries()) {
      const merchantId = `ruda-demo-merchant-${showroom.number}`;
      const merchantData = buildDemoMerchantData(index, showroom);

      await tx.merchant.upsert({
        where: { id: merchantId },
        create: { id: merchantId, ...merchantData },
        update: merchantData
      });

      await tx.merchantEmployee.upsert({
        where: { merchantId_email: { merchantId, email: `${showroom.number}@ruda.fashion` } },
        create: {
          id: `ruda-demo-employee-${showroom.number}`,
          merchantId,
          email: `${showroom.number}@ruda.fashion`,
          name: `RUDA Demo Manager ${showroom.number}`,
          passwordHash,
          role: 'store_manager',
          permissions: JSON.stringify(defaultEmployeePermissions.store_manager),
          active: true
        },
        update: {
          name: `RUDA Demo Manager ${showroom.number}`,
          passwordHash,
          role: 'store_manager',
          permissions: JSON.stringify(defaultEmployeePermissions.store_manager),
          active: true
        }
      });
    }

    const products = buildDemoProducts();
    for (const product of products) {
      await tx.product.upsert({
        where: { id: product.id },
        create: product,
        update: product
      });
    }

    await tx.customer.upsert({
      where: { id: DEMO_BUYER_ID },
      create: {
        id: DEMO_BUYER_ID,
        companyName: 'RUDA Demo Buyer',
        vatNumber: 'RUDA-DEMO-13',
        address: 'Demo address · not for delivery',
        city: 'Milan',
        country: 'Italia',
        contactPerson: 'RUDA Demo Buyer',
        phone: '+39 000 000 0013',
        email: DEMO_BUYER_EMAIL,
        businessType: 'Boutique',
        status: 'approved',
        tier: 'tier_standard',
        registrationDate: new Date().toISOString().slice(0, 10),
        approvedAt: new Date().toISOString(),
        onboardingStatus: 'approved'
      },
      update: {
        companyName: 'RUDA Demo Buyer',
        vatNumber: 'RUDA-DEMO-13',
        address: 'Demo address · not for delivery',
        city: 'Milan',
        country: 'Italia',
        contactPerson: 'RUDA Demo Buyer',
        phone: '+39 000 000 0013',
        email: DEMO_BUYER_EMAIL,
        status: 'approved',
        approvedAt: new Date().toISOString(),
        onboardingStatus: 'approved'
      }
    });

    await tx.authAccount.upsert({
      where: { id: DEMO_BUYER_ACCOUNT_ID },
      create: {
        id: DEMO_BUYER_ACCOUNT_ID,
        role: 'buyer',
        email: DEMO_BUYER_EMAIL,
        customerId: DEMO_BUYER_ID,
        passwordHash,
        permissions: '[]'
      },
      update: { passwordHash, customerId: DEMO_BUYER_ID }
    });
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    maxWait: 10000,
    timeout: 30000
  });

}

async function seedDemoShowroomsAndProducts() {
  const products = buildDemoProducts();
  await prisma.$transaction(async tx => {
    await assertNoConflicts(tx);

    for (const [index, showroom] of DEMO_SHOWROOMS.entries()) {
      const merchantId = `ruda-demo-merchant-${showroom.number}`;
      await tx.merchant.upsert({
        where: { id: merchantId },
        create: { id: merchantId, ...buildDemoMerchantData(index, showroom) },
        update: buildDemoMerchantData(index, showroom)
      });
    }

    for (const product of products) {
      await tx.product.upsert({
        where: { id: product.id },
        create: product,
        update: product
      });
    }
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    maxWait: 10000,
    timeout: 30000
  });

  const [merchants, seededProducts] = await Promise.all([
    prisma.merchant.findMany({
      where: { id: { in: DEMO_SHOWROOMS.map(({ number }) => `ruda-demo-merchant-${number}`) } },
      select: { id: true, storeSlug: true, storefrontEnabled: true, industrySource: true, settings: true }
    }),
    prisma.product.findMany({
      where: { id: { in: products.map(({ id }) => id) } },
      select: { id: true, merchantId: true, lifecycleStatus: true, inventoryStatus: true, isExclusiveProtected: true, skus: true }
    })
  ]);

  if (merchants.length !== DEMO_SHOWROOMS.length || seededProducts.length !== products.length) {
    throw new Error('Post-write verification failed: demo showroom or product count does not match.');
  }

  for (const merchant of merchants) {
    if (!merchant.storefrontEnabled
      || merchant.industrySource !== 'ADMIN'
      || !merchant.settings.includes(DEMO_MARKER)) {
      throw new Error(`Post-write verification failed for demo store ${merchant.id}.`);
    }
  }

  for (const product of seededProducts) {
    const sku = JSON.parse(product.skus)[0];
    if (product.lifecycleStatus !== 'published'
      || product.isExclusiveProtected
      || product.inventoryStatus !== 'coming_soon'
      || sku?.stockCentral !== 0
      || !product.merchantId?.startsWith('ruda-demo-merchant-')) {
      throw new Error(`Post-write verification failed for demo product ${product.id}.`);
    }
  }

  console.log(JSON.stringify({
    result: 'demo-showrooms-and-products-seeded-and-verified',
    stores: merchants.length,
    products: seededProducts.length,
    employeeAccountsModified: false,
    buyerAccountModified: false,
    productInventory: 'zero; coming_soon; demo-only'
  }, null, 2));
}

async function verifySeededData(password: string) {
  const expectedProducts = buildDemoProducts();
  const employeeIds = DEMO_SHOWROOMS.map(({ number }) => `ruda-demo-employee-${number}`);
  const [merchants, products, employees, buyerAccount, buyerCustomer] = await Promise.all([
    prisma.merchant.findMany({
      where: { id: { in: DEMO_SHOWROOMS.map(({ number }) => `ruda-demo-merchant-${number}`) } },
      select: { id: true, storeSlug: true, storefrontEnabled: true, industrySource: true, settings: true }
    }),
    prisma.product.findMany({
      where: { id: { in: expectedProducts.map(({ id }) => id) } },
      select: {
        id: true, merchantId: true, visibility: true, status: true, featuredOnSale: true,
        lifecycleStatus: true, isExclusiveProtected: true, inventoryStatus: true, images: true, skus: true
      }
    }),
    prisma.merchantEmployee.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, merchantId: true, email: true, passwordHash: true, role: true, active: true }
    }),
    prisma.authAccount.findUnique({
      where: { id: DEMO_BUYER_ACCOUNT_ID },
      select: { role: true, email: true, customerId: true, passwordHash: true }
    }),
    prisma.customer.findUnique({
      where: { id: DEMO_BUYER_ID },
      select: { email: true, status: true }
    })
  ]);

  if (merchants.length !== DEMO_SHOWROOMS.length || products.length !== expectedProducts.length
    || employees.length !== DEMO_EMPLOYEE_EMAILS.length || !buyerAccount || !buyerCustomer) {
    throw new Error('Post-write verification failed: one or more demo records are missing.');
  }

  for (const merchant of merchants) {
    if (!merchant.storefrontEnabled || merchant.industrySource !== 'ADMIN' || !merchant.settings.includes(DEMO_MARKER)) {
      throw new Error(`Post-write verification failed for demo store ${merchant.id}.`);
    }
  }

  const productById = new Map(products.map(product => [product.id, product]));
  for (const expected of expectedProducts) {
    const product = productById.get(expected.id);
    if (!product
      || product.merchantId !== expected.merchantId
      || product.visibility !== expected.visibility
      || product.status !== expected.status
      || product.featuredOnSale !== expected.featuredOnSale
      || product.lifecycleStatus !== 'published'
      || product.isExclusiveProtected
      || product.inventoryStatus !== 'coming_soon'
      || JSON.parse(product.images).length !== 3
      || JSON.parse(product.skus)[0]?.stockCentral !== 0) {
      throw new Error(`Post-write verification failed for demo product ${expected.id}.`);
    }
  }

  for (const employee of employees) {
    if (!employee.active
      || employee.role !== 'store_manager'
      || !await bcrypt.compare(password, employee.passwordHash)) {
      throw new Error(`Post-write verification failed for demo employee ${employee.id}.`);
    }
  }
  if (buyerAccount.role !== 'buyer'
    || buyerAccount.email !== DEMO_BUYER_EMAIL
    || buyerAccount.customerId !== DEMO_BUYER_ID
    || !await bcrypt.compare(password, buyerAccount.passwordHash)
    || buyerCustomer.email !== DEMO_BUYER_EMAIL
    || buyerCustomer.status !== 'approved') {
    throw new Error('Post-write verification failed for demo buyer account.');
  }

  console.log(JSON.stringify({
    result: 'seeded-and-verified',
    stores: merchants.length,
    products: products.length,
    publicProducts: products.filter(product => product.visibility === 'public').length,
    verifiedOnlyProducts: products.filter(product => product.visibility === 'wholesale').length,
    discountedProducts: products.filter(product => product.featuredOnSale).length,
    employees: employees.length,
    buyer: DEMO_BUYER_EMAIL,
    imagesPerProduct: 3,
    inventory: 'zero; coming_soon and demo-only'
  }, null, 2));
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.');
  }
  if (process.argv.includes('--check') && !process.argv.includes('--apply')) {
    if (process.env.NODE_ENV !== 'production') {
      throw new Error('Read-only preflight requires NODE_ENV=production to select the confirmed database configuration.');
    }
    await prisma.$transaction(
      tx => assertNoConflicts(tx),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    console.log(JSON.stringify({
      result: 'preflight-clean',
      stores: DEMO_SHOWROOMS.length,
      products: buildDemoProducts().length,
      employeeAccounts: DEMO_EMPLOYEE_EMAILS.length,
      buyerAccount: DEMO_BUYER_EMAIL
    }, null, 2));
    return;
  }
  if (process.argv.includes('--check')) {
    throw new Error('Choose either --check or --apply, not both.');
  }
  assertWriteConfirmation();
  if (process.argv.includes('--showrooms-and-products')) {
    await seedDemoShowroomsAndProducts();
    return;
  }
  const password = getSeedPassword();
  await seed(password);
  await verifySeededData(password);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch(error => {
      console.error('[seed-public-demo-showrooms] failed:', error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

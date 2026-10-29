import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { Prisma, PrismaClient } from '@prisma/client';
import { getIsolatedE2ETestDatabaseUrl } from './e2eTestDatabaseSafety';
import { SINGLE_WAREHOUSE_CODE } from '../src/server/warehouse';

const databaseUrl = getIsolatedE2ETestDatabaseUrl({
  nodeEnv: process.env.NODE_ENV,
  testDatabaseUrl: process.env.E2E_TEST_DATABASE_URL,
  applicationDatabaseUrl: process.env.DATABASE_URL,
  allowRemoteDatabase: process.env.E2E_ALLOW_REMOTE_DATABASE
});
const employeeEmail = process.env.E2E_MERCHANT_EMAIL?.trim().toLowerCase();
const employeePassword = process.env.E2E_MERCHANT_PASSWORD;
const merchantId = process.env.E2E_MERCHANT_ID || 'e2e_merchant';
const productId = process.env.E2E_PRODUCT_ID || 'e2e_product';
const buyerId = process.env.E2E_BUYER_ID || 'e2e_buyer';

async function main() {
  if (!employeeEmail || !employeeEmail.includes('@') || !employeePassword || employeePassword.length < 16) {
    throw new Error('E2E_MERCHANT_EMAIL_AND_16_CHARACTER_PASSWORD_REQUIRED');
  }
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const passwordHash = await bcrypt.hash(employeePassword, 12);
    await prisma.merchant.upsert({
      where: { id: merchantId },
      update: {
        settings: JSON.stringify({ pos: { requireOpenShift: true, returnWindowDays: 30 } }),
        isVerified: true
      },
      create: {
        id: merchantId,
        storeSlug: 'e2e-test-merchant',
        name: 'E2E Test Merchant',
        companyLegalName: 'E2E Test Merchant Ltd',
        industry: 'FASHION_COMPANY',
        code: 'E2E-MERCHANT',
        country: 'Italy',
        city: 'Prato',
        showroomAddress: 'Test address',
        showroomArea: 'Test',
        showroomImage: '',
        logo: '',
        banner: '',
        tagline: 'Automated test fixture',
        description: 'Isolated test data only.',
        specialties: '[]',
        foundedYear: 2020,
        contactPerson: 'Test Operator',
        contactPhone: '+390000000000',
        contactEmail: employeeEmail,
        settings: JSON.stringify({ pos: { requireOpenShift: true, returnWindowDays: 30 } }),
        isVerified: true
      }
    });
    await prisma.merchantEmployee.upsert({
      where: { merchantId_email: { merchantId, email: employeeEmail } },
      update: {
        name: 'E2E Test Operator',
        passwordHash,
        role: 'store_manager',
        permissions: JSON.stringify([
          'sales.order.create',
          'employees.manage',
          'return.manage',
          'inventory.stock.read'
        ]),
        active: true
      },
      create: {
        id: 'e2e_employee',
        merchantId,
        email: employeeEmail,
        name: 'E2E Test Operator',
        passwordHash,
        role: 'store_manager',
        permissions: JSON.stringify([
          'sales.order.create',
          'employees.manage',
          'return.manage',
          'inventory.stock.read'
        ]),
        active: true
      }
    });
    await prisma.customer.upsert({
      where: { id: buyerId },
      update: { status: 'approved' },
      create: {
        id: buyerId,
        companyName: 'E2E Test Buyer Ltd',
        vatNumber: 'E2E-BUYER-VAT',
        address: 'E2E Test Address',
        city: 'Milan',
        country: 'IT',
        contactPerson: 'E2E Buyer',
        phone: '+390000000001',
        email: 'buyer@example.test',
        status: 'approved',
        registrationDate: new Date().toISOString()
      }
    });
    await prisma.product.upsert({
      where: { id: productId },
      update: {
        lifecycleStatus: 'published',
        merchantId,
        skus: JSON.stringify([{ sku: 'E2E-SKU-1', color: 'Black', size: 'M', stockCentral: 20, reserved: 0 }]),
        inventoryVersion: { increment: 1 }
      },
      create: {
        id: productId,
        styleNo: 'E2E-STYLE-1',
        name: 'E2E Test Product',
        name_it: 'Prodotto di test E2E',
        name_zh: '端到端测试商品',
        category: 'women',
        subCategory: 'tops',
        brand: 'RUDA E2E',
        season: 'all-season',
        images: '[]',
        wholesalePrice: new Prisma.Decimal(10),
        rrpPrice: new Prisma.Decimal(20),
        status: 'new',
        inventoryStatus: 'in_stock',
        origin: 'Italy',
        fabric: 'Cotton',
        composition: '100% cotton',
        weight: '0.2kg',
        packaging: 'Standard',
        washCare: 'Standard',
        description: 'Fixture product for isolated end-to-end tests.',
        skus: JSON.stringify([{ sku: 'E2E-SKU-1', color: 'Black', size: 'M', stockCentral: 20, reserved: 0 }]),
        merchantId,
        merchantName: 'E2E Test Merchant',
        lifecycleStatus: 'published',
        inventoryVersion: 0
      }
    });

    let location = await prisma.warehouseLocation.findFirst({
      where: { merchantId: null, code: SINGLE_WAREHOUSE_CODE }
    });
    if (!location) {
      location = await prisma.warehouseLocation.create({
        data: {
          id: 'e2e_central_warehouse',
          merchantId: null,
          code: SINGLE_WAREHOUSE_CODE,
          name: 'E2E Central Warehouse',
          type: 'central',
          isActive: true
        }
      });
    }
    const variant = await prisma.productVariant.upsert({
      where: { productId_sku: { productId, sku: 'E2E-SKU-1' } },
      update: { isActive: true, color: 'Black', size: 'M' },
      create: { id: 'e2e_variant_1', productId, sku: 'E2E-SKU-1', color: 'Black', size: 'M' }
    });
    await prisma.inventoryBalance.upsert({
      where: { variantId_locationId: { variantId: variant.id, locationId: location.id } },
      update: { merchantId, onHandQuantity: 20, reservedQuantity: 0, inTransitQuantity: 0 },
      create: {
        id: 'e2e_inventory_balance_1',
        merchantId,
        variantId: variant.id,
        locationId: location.id,
        onHandQuantity: 20,
        reservedQuantity: 0,
        inTransitQuantity: 0
      }
    });
    console.log(JSON.stringify({
      status: 'seeded',
      database: new URL(databaseUrl).pathname.replace(/^\/+/, ''),
      merchantId,
      employeeEmail,
      productId,
      buyerId,
      sku: 'E2E-SKU-1'
    }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'E2E_SEED_FAILED');
  process.exitCode = 1;
});

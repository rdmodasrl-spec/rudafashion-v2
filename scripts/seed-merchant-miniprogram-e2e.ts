import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { getIsolatedE2ETestDatabaseUrl } from './e2eTestDatabaseSafety';

/**
 * 商家小程序接口集成校验用的隔离数据。
 * 只允许写入隔离测试库（getIsolatedE2ETestDatabaseUrl 会拒绝生产库）。
 */
const databaseUrl = getIsolatedE2ETestDatabaseUrl({
  nodeEnv: process.env.NODE_ENV,
  testDatabaseUrl: process.env.E2E_TEST_DATABASE_URL,
  applicationDatabaseUrl: process.env.DATABASE_URL,
  allowRemoteDatabase: process.env.E2E_ALLOW_REMOTE_DATABASE
});

const passwordA = process.env.E2E_MERCHANT_PASSWORD;
const emailA = process.env.E2E_MERCHANT_EMAIL?.trim().toLowerCase();
const emailAViewer = process.env.E2E_VIEWER_EMAIL?.trim().toLowerCase();
const emailB = process.env.E2E_SECOND_MERCHANT_EMAIL?.trim().toLowerCase();

const merchantA = 'e2e_mm_merchant_a';
const merchantB = 'e2e_mm_merchant_b';
const customerA = 'e2e_mm_customer_a';
const customerB = 'e2e_mm_customer_b';

const merchantCreate = (id: string, name: string, code: string, storeSlug: string, contactEmail: string) => ({
  id,
  storeSlug,
  name,
  companyLegalName: `${name} Ltd`,
  industry: 'FASHION_COMPANY' as const,
  code,
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
  contactEmail,
  settings: JSON.stringify({}),
  isVerified: true
});

const customerCreate = (id: string, companyName: string) => ({
  id,
  companyName,
  vatNumber: `${id}-VAT`,
  address: 'Test Address',
  city: 'Milan',
  country: 'IT',
  contactPerson: 'Test Buyer',
  phone: '+390000000001',
  email: `${id}@example.test`,
  status: 'approved',
  registrationDate: new Date().toISOString()
});

async function main() {
  if (!passwordA || passwordA.length < 16) throw new Error('E2E_MERCHANT_PASSWORD_TOO_SHORT');
  if (!emailA || !emailAViewer || !emailB) throw new Error('E2E_EMAILS_REQUIRED');

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const passwordHash = await bcrypt.hash(passwordA, 12);

    await prisma.merchant.upsert({
      where: { id: merchantA },
      update: { contactEmail: emailA, isVerified: true },
      create: merchantCreate(merchantA, 'MM Merchant A', 'MM-A', 'mm-merchant-a', emailA)
    });
    await prisma.merchant.upsert({
      where: { id: merchantB },
      update: { contactEmail: emailB, isVerified: true },
      create: merchantCreate(merchantB, 'MM Merchant B', 'MM-B', 'mm-merchant-b', emailB)
    });

    const employees = [
      { id: 'e2e_mm_ops_a', merchantId: merchantA, email: emailA, permissions: ['purchase.manage', 'sales.order.create', 'store_manager', 'inventory.stock.read'], role: 'store_manager' },
      { id: 'e2e_mm_viewer_a', merchantId: merchantA, email: emailAViewer, permissions: ['inventory.stock.read'], role: 'warehouse' },
      { id: 'e2e_mm_ops_b', merchantId: merchantB, email: emailB, permissions: ['purchase.manage', 'sales.order.create', 'store_manager'], role: 'store_manager' }
    ];
    for (const employee of employees) {
      await prisma.merchantEmployee.upsert({
        where: { merchantId_email: { merchantId: employee.merchantId, email: employee.email } },
        update: { passwordHash, permissions: JSON.stringify(employee.permissions), role: employee.role, active: true },
        create: {
          id: employee.id,
          merchantId: employee.merchantId,
          email: employee.email,
          name: `E2E ${employee.id}`,
          passwordHash,
          role: employee.role,
          permissions: JSON.stringify(employee.permissions),
          active: true
        }
      });
    }

    await prisma.customer.upsert({ where: { id: customerA }, update: { status: 'approved' }, create: customerCreate(customerA, 'MM Customer A Ltd') });
    await prisma.customer.upsert({ where: { id: customerB }, update: { status: 'approved' }, create: customerCreate(customerB, 'MM Customer B Ltd') });

    await prisma.merchantCustomerLink.upsert({
      where: { merchantId_customerId: { merchantId: merchantA, customerId: customerA } },
      update: { status: 'active' },
      create: { merchantId: merchantA, customerId: customerA, status: 'active' }
    });
    await prisma.merchantCustomerLink.upsert({
      where: { merchantId_customerId: { merchantId: merchantB, customerId: customerB } },
      update: { status: 'active' },
      create: { merchantId: merchantB, customerId: customerB, status: 'active' }
    });

    await prisma.supplier.upsert({
      where: { merchantId_name: { merchantId: merchantA, name: 'MM Supplier A' } },
      update: { status: 'active' },
      create: { id: 'e2e_mm_supplier_a', merchantId: merchantA, name: 'MM Supplier A', contactName: 'Alice', phone: '+39', email: 'a@supplier.test', country: 'Italy', leadTimeDays: 7 }
    });
    await prisma.supplier.upsert({
      where: { merchantId_name: { merchantId: merchantA, name: 'MM Supplier A2' } },
      update: { status: 'active' },
      create: { id: 'e2e_mm_supplier_a2', merchantId: merchantA, name: 'MM Supplier A2' }
    });
    await prisma.supplier.upsert({
      where: { merchantId_name: { merchantId: merchantB, name: 'MM Supplier B' } },
      update: { status: 'active' },
      create: { id: 'e2e_mm_supplier_b', merchantId: merchantB, name: 'MM Supplier B' }
    });

    await prisma.merchantCounterparty.upsert({
      where: { id_merchantId: { id: 'e2e_mm_cp_a', merchantId: merchantA } },
      update: { companyName: 'MM Counterparty A' },
      create: { id: 'e2e_mm_cp_a', merchantId: merchantA, companyName: 'MM Counterparty A', contactName: 'Carla', phone: '+39', email: 'cp@example.test', country: 'Italy', city: 'Prato' }
    });
    await prisma.merchantCounterparty.upsert({
      where: { id_merchantId: { id: 'e2e_mm_cp_b', merchantId: merchantB } },
      update: { companyName: 'MM Counterparty B' },
      create: { id: 'e2e_mm_cp_b', merchantId: merchantB, companyName: 'MM Counterparty B' }
    });

    await prisma.notificationEvent.upsert({
      where: { idempotencyKey: 'e2e-mm-notice-open' },
      update: { recipient: emailA, channel: 'in_app', status: 'sent', businessStatus: 'open', readAt: null },
      create: {
        id: 'e2e_mm_notice_open',
        eventType: 'order.created',
        channel: 'in_app',
        recipient: emailA,
        payload: JSON.stringify({ title: '新订单', message: 'E2E 通知（待处理）' }),
        status: 'sent',
        businessStatus: 'open',
        idempotencyKey: 'e2e-mm-notice-open'
      }
    });
    await prisma.notificationEvent.upsert({
      where: { idempotencyKey: 'e2e-mm-notice-resolved' },
      update: { recipient: emailA, channel: 'in_app', status: 'sent', businessStatus: 'resolved' },
      create: {
        id: 'e2e_mm_notice_resolved',
        eventType: 'order.created',
        channel: 'in_app',
        recipient: emailA,
        payload: JSON.stringify({ title: '新订单', message: 'E2E 通知（已处理）' }),
        status: 'sent',
        businessStatus: 'resolved',
        idempotencyKey: 'e2e-mm-notice-resolved'
      }
    });

    await prisma.merchantGrowthReferral.upsert({
      where: { referredMerchantId: merchantB },
      update: { referrerMerchantId: merchantA, status: 'pending' },
      create: {
        id: 'e2e_mm_referral',
        referrerMerchantId: merchantA,
        referredMerchantId: merchantB,
        referralCodeSnapshot: 'MM-REF-1',
        status: 'pending',
        qualificationDeadline: new Date(Date.now() + 30 * 24 * 3600 * 1000)
      }
    });

    console.log('merchant-miniprogram e2e seed ready');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

function getIsolatedTestDatabaseUrl(value: string | undefined): string {
  if (process.env.NODE_ENV !== 'test' || !value) {
    throw new Error('AI_GROWTH_SEED_REQUIRES_TEST_DATABASE_URL');
  }
  const url = new URL(value);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, '').split('/')[0] || '');
  if (!/(^|[-_])(test|e2e)([-_]|$)/i.test(databaseName)) {
    throw new Error('AI_GROWTH_SEED_DATABASE_NAME_MUST_INCLUDE_TEST_OR_E2E');
  }
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
    throw new Error('AI_GROWTH_SEED_DATABASE_MUST_BE_LOOPBACK');
  }
  return value;
}

async function main() {
  const databaseUrl = getIsolatedTestDatabaseUrl(process.env.DATABASE_URL);
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const suffix = randomUUID().replaceAll('-', '');
  const now = new Date().toISOString();

  try {
    const merchant = await prisma.merchant.create({
      data: {
        id: `growth-test-${suffix}`,
        storeSlug: `growth-test-${suffix}`,
        name: 'AI Growth Integration Merchant',
        companyLegalName: 'AI Growth Integration Merchant Ltd',
        industry: 'FASHION_COMPANY',
        code: `GROWTH-${suffix}`,
        country: 'Italy',
        city: 'Prato',
        showroomAddress: 'Isolated test address',
        showroomArea: 'Test',
        showroomImage: '',
        logo: '',
        banner: '',
        tagline: 'Isolated integration fixture',
        description: 'Temporary test data in a disposable PostgreSQL database.',
        specialties: '[]',
        foundedYear: 2020,
        contactPerson: 'Integration Test',
        contactPhone: '+390000000000',
        contactEmail: `merchant-${suffix}@example.test`
      },
      select: { id: true }
    });
    const customer = await prisma.customer.create({
      data: {
        id: `growth-customer-${suffix}`,
        companyName: 'AI Growth Integration Customer',
        vatNumber: `GROWTH-${suffix}`,
        address: 'Isolated test address',
        city: 'Prato',
        country: 'IT',
        contactPerson: 'Integration Customer',
        phone: '+390000000001',
        email: `customer-${suffix}@example.test`,
        status: 'approved',
        registrationDate: now,
        approvedAt: now
      },
      select: { id: true }
    });
    await prisma.merchantCustomerLink.create({
      data: { merchantId: merchant.id, customerId: customer.id }
    });

    console.log('Seeded one merchant, one approved customer, and one merchant-customer link in the disposable test database.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'AI_GROWTH_SEED_FAILED');
  process.exitCode = 1;
});
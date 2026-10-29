import 'dotenv/config';
import assert from 'node:assert/strict';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import {
  createPaidOrderPartnerCommissions,
  createPartnerCommissionReversals
} from '../../src/server/partnerGrowth';

const databaseUrl = process.env.PARTNER_TEST_DATABASE_URL;
if (process.env.NODE_ENV !== 'test') throw new Error('PARTNER_POSTGRES_INTEGRATION_REQUIRES_NODE_ENV_TEST');
if (!databaseUrl) throw new Error('PARTNER_TEST_DATABASE_URL_REQUIRED');

const parsedTestUrl = new URL(databaseUrl);
const databaseName = decodeURIComponent(parsedTestUrl.pathname.replace(/^\//, '').split('/')[0] || '');
if (!/(^|[-_])(test|e2e)([-_]|$)/i.test(databaseName)) {
  throw new Error('PARTNER_TEST_DATABASE_NAME_MUST_INCLUDE_TEST_OR_E2E');
}
if (process.env.DATABASE_URL) {
  const configuredUrl = new URL(process.env.DATABASE_URL);
  if (configuredUrl.host === parsedTestUrl.host && configuredUrl.pathname === parsedTestUrl.pathname) {
    throw new Error('PARTNER_TEST_DATABASE_MUST_NOT_MATCH_APPLICATION_DATABASE');
  }
}
if (!['localhost', '127.0.0.1', '::1'].includes(parsedTestUrl.hostname)
  && process.env.ALLOW_REMOTE_PARTNER_TEST_DATABASE !== 'true') {
  throw new Error('REMOTE_PARTNER_TEST_DATABASE_REQUIRES_EXPLICIT_OPT_IN');
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

test('PostgreSQL commission ledger is attribution-bound, serialized, replay-safe, and proportionally reversed', async () => {
  const suffix = crypto.randomUUID().replaceAll('-', '');
  const partnerIds = [crypto.randomUUID(), crypto.randomUUID()];
  const campaignId = crypto.randomUUID();
  const customerId = crypto.randomUUID();
  const referralId = crypto.randomUUID();
  const orderIds = [crypto.randomUUID(), crypto.randomUUID()];
  const refundIds = [crypto.randomUUID(), crypto.randomUUID()];
  try {
    await prisma.partner.createMany({
      data: partnerIds.map((id, index) => ({
        id,
        partnerCode: `ITAG${suffix}${index}`,
        role: 'agent',
        status: 'active',
        name: `Commission integration partner ${index}`,
        email: `commission-${suffix}-${index}@example.test`,
        commissionRate: 20
      }))
    });
    await prisma.partnerCampaign.create({
      data: {
        id: campaignId,
        partnerId: partnerIds[1],
        campaignCode: `ICM${suffix}`,
        name: 'Cross-partner campaign',
        channel: 'instagram'
      }
    });
    await prisma.customer.create({
      data: {
        id: customerId,
        companyName: `Commission integration customer ${suffix}`,
        vatNumber: `VAT-${suffix}`,
        address: 'Integration address',
        city: 'Milan',
        country: 'IT',
        contactPerson: 'Integration contact',
        phone: `+390000${suffix.slice(0, 8)}`,
        email: `commission-customer-${suffix}@example.test`,
        registrationDate: new Date().toISOString()
      }
    });
    await prisma.partnerReferral.create({
      data: {
        id: referralId,
        customerId,
        partnerId: partnerIds[0]
      }
    });
    for (const [index, id] of orderIds.entries()) {
      await prisma.order.create({
        data: {
          id,
          orderNo: `IC-${suffix}-${index}`,
          date: new Date().toISOString(),
          companyName: `Commission integration customer ${suffix}`,
          totalQty: 1,
          totalAmount: 100,
          status: 'confirmed',
          deliveryType: 'shipping',
          paymentMethod: 'card',
          paymentStatus: 'paid',
          timeline: '[]',
          shippingStreet: 'Integration street',
          shippingCity: 'Milan',
          shippingCountry: 'IT',
          shippingZip: '20100',
          partnerReferralId: referralId,
          partnerId: partnerIds[0]
        }
      });
    }

    await prisma.partnerReferral.update({
      where: { id: referralId },
      data: { campaignId }
    });
    await assert.rejects(
      prisma.$transaction(transaction => createPaidOrderPartnerCommissions(transaction, orderIds[0])),
      { message: 'PARTNER_COMMISSION_ATTRIBUTION_INCONSISTENT' }
    );
    assert.equal(await prisma.partnerCommissionEntry.count({ where: { orderId: orderIds[0] } }), 0);
    await prisma.partnerReferral.update({ where: { id: referralId }, data: { campaignId: null } });

    await assert.rejects(prisma.$transaction(async transaction => {
      await createPaidOrderPartnerCommissions(transaction, orderIds[0]);
      throw new Error('INTEGRATION_FORCE_COMMISSION_ROLLBACK');
    }), /INTEGRATION_FORCE_COMMISSION_ROLLBACK/);
    assert.equal(await prisma.partnerCommissionEntry.count({ where: { orderId: orderIds[0] } }), 0);

    await Promise.all([
      prisma.$transaction(transaction => createPaidOrderPartnerCommissions(transaction, orderIds[0])),
      prisma.$transaction(transaction => createPaidOrderPartnerCommissions(transaction, orderIds[0]))
    ]);
    const commissions = await prisma.partnerCommissionEntry.findMany({
      where: { orderId: orderIds[0], entryType: 'commission' }
    });
    assert.equal(commissions.length, 1);
    assert.equal(Number(commissions[0].amount), 20);
    assert.equal(await prisma.partnerAuditEvent.count({
      where: { action: 'commission_created', entityId: orderIds[0] }
    }), 1);
    assert.ok((await prisma.partnerReferral.findUniqueOrThrow({ where: { id: referralId } })).firstPaidAt);

    await prisma.refundTransaction.create({
      data: {
        id: refundIds[0],
        paymentTransactionId: `payment-${suffix}-0`,
        orderId: orderIds[0],
        amount: 33.33,
        status: 'succeeded'
      }
    });
    await prisma.$transaction(transaction => createPartnerCommissionReversals(transaction, orderIds[0], refundIds[0]));
    const firstReversal = await prisma.partnerCommissionEntry.findFirstOrThrow({
      where: { orderId: orderIds[0], entryType: 'reversal' }
    });
    assert.equal(Number(firstReversal.amount), -6.67);

    await prisma.refundTransaction.create({
      data: {
        id: refundIds[1],
        paymentTransactionId: `payment-${suffix}-1`,
        orderId: orderIds[0],
        amount: 66.67,
        status: 'succeeded'
      }
    });
    await Promise.all([
      prisma.$transaction(transaction => createPartnerCommissionReversals(transaction, orderIds[0], refundIds[1])),
      prisma.$transaction(transaction => createPartnerCommissionReversals(transaction, orderIds[0], refundIds[1]))
    ]);
    await Promise.all([
      prisma.$transaction(transaction => createPartnerCommissionReversals(transaction, orderIds[0], refundIds[0])),
      prisma.$transaction(transaction => createPartnerCommissionReversals(transaction, orderIds[0], refundIds[0]))
    ]);
    const reversals = await prisma.partnerCommissionEntry.findMany({
      where: { orderId: orderIds[0], entryType: 'reversal' }
    });
    assert.equal(reversals.length, 2);
    assert.equal(reversals.reduce((sum, entry) => sum + Number(entry.amount), 0), -20);
    assert.equal(await prisma.partnerAuditEvent.count({
      where: { action: 'commission_refund_reversed', entityId: commissions[0].id }
    }), 2);
    assert.equal(await prisma.partnerCommissionEntry.count({ where: { orderId: orderIds[1] } }), 0);
  } finally {
    await prisma.partnerCommissionEntry.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.partnerAuditEvent.deleteMany({ where: { entityId: { in: [...orderIds, ...refundIds] } } });
    await prisma.refundTransaction.deleteMany({ where: { id: { in: refundIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.partnerReferral.deleteMany({ where: { id: referralId } });
    await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.partnerCampaign.deleteMany({ where: { id: campaignId } });
    await prisma.partner.deleteMany({ where: { id: { in: partnerIds } } });
    await prisma.$disconnect();
  }
});

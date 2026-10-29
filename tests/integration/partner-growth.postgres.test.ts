import 'dotenv/config';
import assert from 'node:assert/strict';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import { getPartnerScopeIds, persistPartnerReferralFromClick } from '../../src/server/partnerGrowth';

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

test('PostgreSQL Partner scopes isolate cities and exclude inactive descendants', async () => {
  const suffix = crypto.randomUUID().replaceAll('-', '');
  const partners = [
    { id: crypto.randomUUID(), partnerCode: `ITP${suffix}A`, role: 'partner', status: 'active', parentId: null },
    { id: crypto.randomUUID(), partnerCode: `ITC${suffix}A`, role: 'city_agent', status: 'active', parentId: null },
    { id: crypto.randomUUID(), partnerCode: `ITA${suffix}A`, role: 'agent', status: 'active', parentId: null },
    { id: crypto.randomUUID(), partnerCode: `ITA${suffix}P`, role: 'agent', status: 'paused', parentId: null },
    { id: crypto.randomUUID(), partnerCode: `ITP${suffix}B`, role: 'partner', status: 'active', parentId: null },
    { id: crypto.randomUUID(), partnerCode: `ITC${suffix}B`, role: 'city_agent', status: 'active', parentId: null },
    { id: crypto.randomUUID(), partnerCode: `ITA${suffix}B`, role: 'agent', status: 'active', parentId: null }
  ];
  const customerIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  const campaignIds = [crypto.randomUUID(), crypto.randomUUID()];
  const clickIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  const referralIds = [crypto.randomUUID(), crypto.randomUUID()];

  try {
    for (const partner of partners) {
      await prisma.partner.create({
        data: {
          ...partner,
          name: `Integration ${partner.role}`,
          email: `${partner.partnerCode.toLowerCase()}@example.test`,
          ...(partner.id === partners[1].id || partner.id === partners[5].id
            ? { parentId: partner.id === partners[1].id ? partners[0].id : partners[4].id }
            : {}),
          ...(partner.id === partners[2].id || partner.id === partners[3].id
            ? { parentId: partners[1].id }
            : {}),
          ...(partner.id === partners[6].id ? { parentId: partners[5].id } : {})
        }
      });
    }

    for (let index = 0; index < customerIds.length; index += 1) {
      await prisma.customer.create({
        data: {
          id: customerIds[index],
          companyName: `Integration customer ${suffix}-${index}`,
          vatNumber: `IT-${suffix}-${index}`,
          address: 'Integration address',
          city: 'Milan',
          country: 'IT',
          contactPerson: 'Integration contact',
          phone: `+390000${suffix.slice(0, 8)}${index}`,
          email: `customer-${suffix}-${index}@example.test`,
          registrationDate: new Date().toISOString()
        }
      });
    }

    await prisma.partnerCampaign.createMany({
      data: [
        { id: campaignIds[0], partnerId: partners[2].id, campaignCode: `ICA${suffix}A`, name: 'City A campaign', channel: 'instagram' },
        { id: campaignIds[1], partnerId: partners[6].id, campaignCode: `ICA${suffix}B`, name: 'City B campaign', channel: 'instagram' }
      ]
    });
    await prisma.partnerReferral.createMany({
      data: [
        {
          id: referralIds[0], customerId: customerIds[0], partnerId: partners[2].id,
          cityPartnerId: partners[1].id, networkPartnerId: partners[0].id, campaignId: campaignIds[0]
        },
        {
          id: referralIds[1], customerId: customerIds[1], partnerId: partners[6].id,
          cityPartnerId: partners[5].id, networkPartnerId: partners[4].id, campaignId: campaignIds[1]
        }
      ]
    });
    await prisma.partnerReferralClick.createMany({
      data: [
        {
          id: clickIds[0],
          partnerId: partners[2].id,
          campaignId: campaignIds[0],
          visitorKeyHash: suffix + suffix,
          source: 'instagram',
          landingPath: '/integration/city-a'
        },
        {
          id: clickIds[1],
          partnerId: partners[6].id,
          campaignId: campaignIds[1],
          visitorKeyHash: suffix.slice(0, 16) + suffix.slice(0, 16) + suffix,
          source: 'instagram',
          landingPath: '/integration/city-b'
        },
        {
          id: clickIds[2],
          partnerId: partners[2].id,
          campaignId: campaignIds[1],
          visitorKeyHash: suffix.slice(0, 8).repeat(8),
          source: 'instagram',
          landingPath: '/integration/campaign-owner-mismatch'
        },
        {
          id: clickIds[3],
          partnerId: partners[2].id,
          campaignId: campaignIds[0],
          visitorKeyHash: suffix.slice(0, 8).repeat(8),
          source: 'link',
          landingPath: '/integration/campaign-source-mismatch'
        }
      ]
    });

    assert.equal(await prisma.$transaction(transaction =>
      persistPartnerReferralFromClick(transaction, customerIds[2], clickIds[2])
    ), false);
    assert.equal(await prisma.$transaction(transaction =>
      persistPartnerReferralFromClick(transaction, customerIds[2], clickIds[3])
    ), false);
    assert.equal(await prisma.partnerReferral.count({ where: { customerId: customerIds[2] } }), 0);
    const attributionRace = await Promise.all([
      prisma.$transaction(transaction => persistPartnerReferralFromClick(transaction, customerIds[2], clickIds[0])),
      prisma.$transaction(transaction => persistPartnerReferralFromClick(transaction, customerIds[2], clickIds[1]))
    ]);
    assert.equal(attributionRace.filter(Boolean).length, 1);
    const firstTouchReferral = await prisma.partnerReferral.findUniqueOrThrow({
      where: { customerId: customerIds[2] },
      include: { campaign: { select: { partnerId: true } } }
    });
    assert.equal(new Set<string>([partners[2].id, partners[6].id]).has(firstTouchReferral.partnerId), true);
    assert.equal(firstTouchReferral.campaign?.partnerId, firstTouchReferral.partnerId);
    assert.equal(firstTouchReferral.source, 'instagram');

    const cityScope = await getPartnerScopeIds(prisma, partners[1].id);
    assert.deepEqual(new Set(cityScope), new Set([partners[1].id, partners[2].id]));
    assert.equal(cityScope.includes(partners[3].id), false);
    assert.equal(cityScope.includes(partners[5].id), false);
    assert.equal(cityScope.includes(partners[6].id), false);

    const visibleReferrals = await prisma.partnerReferral.findMany({
      where: { partnerId: { in: cityScope }, customerId: customerIds[0] },
      select: { id: true, partnerId: true, campaignId: true }
    });
    assert.deepEqual(visibleReferrals, [{
      id: referralIds[0],
      partnerId: partners[2].id,
      campaignId: campaignIds[0]
    }]);
    const visibleCampaigns = await prisma.partnerCampaign.findMany({
      where: { partnerId: { in: cityScope } },
      select: { id: true, partnerId: true }
    });
    assert.deepEqual(visibleCampaigns, [{ id: campaignIds[0], partnerId: partners[2].id }]);

    await assert.rejects(
      prisma.partnerReferral.create({
        data: {
          customerId: customerIds[0],
          partnerId: partners[6].id,
          cityPartnerId: partners[5].id,
          networkPartnerId: partners[4].id
        }
      }),
      error => Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'P2002')
    );
  } finally {
    await prisma.partnerReferral.deleteMany({ where: { customerId: { in: customerIds } } });
    await prisma.partnerReferralClick.deleteMany({ where: { id: { in: clickIds } } });
    await prisma.partnerCampaign.deleteMany({ where: { id: { in: campaignIds } } });
    await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
    await prisma.partner.deleteMany({ where: { id: { in: partners.map(partner => partner.id) } } });
    await prisma.$disconnect();
  }
});

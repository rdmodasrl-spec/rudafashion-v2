import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGrowthReferralBreakdown, mergeGrowthReferralDaily } from '../src/server/growthAttribution';

test('merges daily referral facts into the existing UTC trend and leaves empty dates at zero', () => {
  const result = mergeGrowthReferralDaily([
    { day: '2026-10-03', pageViews: 4, referralClicks: 0, referralRegistrations: 0, unknownRegistrations: 0, referralFirstPaid: 0 },
    { day: '2026-10-04', pageViews: 0, referralClicks: 0, referralRegistrations: 0, unknownRegistrations: 0, referralFirstPaid: 0 },
    { day: '2026-10-05', pageViews: 2, referralClicks: 0, referralRegistrations: 0, unknownRegistrations: 0, referralFirstPaid: 0 }
  ], [
    { day: '2026-10-03', clicks: 9, registrations: 2, unknownRegistrations: 1, firstPaid: 1 },
    { day: '2026-10-05', clicks: 3, registrations: 0, unknownRegistrations: 2, firstPaid: 2 },
    { day: '2026-10-06', clicks: 100, registrations: 50, unknownRegistrations: 20, firstPaid: 20 }
  ]);

  assert.deepEqual(result, [
    { day: '2026-10-03', pageViews: 4, referralClicks: 9, referralRegistrations: 2, unknownRegistrations: 1, referralFirstPaid: 1 },
    { day: '2026-10-04', pageViews: 0, referralClicks: 0, referralRegistrations: 0, unknownRegistrations: 0, referralFirstPaid: 0 },
    { day: '2026-10-05', pageViews: 2, referralClicks: 3, referralRegistrations: 0, unknownRegistrations: 2, referralFirstPaid: 2 }
  ]);
});

test('joins persisted referral registrations and first-paid facts by partner, campaign and source', () => {
  const result = buildGrowthReferralBreakdown(
    [
      { partnerId: 'partner_a', campaignId: 'campaign_a', source: 'link', count: 32 },
      { partnerId: 'partner_d', campaignId: null, source: 'qr', count: 12 }
    ],
    [
      { partnerId: 'partner_a', campaignId: 'campaign_a', source: 'link', count: 8 },
      { partnerId: 'partner_b', campaignId: null, source: 'manual', count: 2 }
    ],
    [
      { partnerId: 'partner_a', campaignId: 'campaign_a', source: 'link', count: 3 },
      { partnerId: 'partner_c', campaignId: null, source: 'event', count: 1 }
    ]
  );
  assert.deepEqual(result.map(({ partnerId, campaignId, source, clicks, registrations, firstPaid }) =>
    ({ partnerId, campaignId, source, clicks, registrations, firstPaid })
  ), [
    { partnerId: 'partner_a', campaignId: 'campaign_a', source: 'link', clicks: 32, registrations: 8, firstPaid: 3 },
    { partnerId: 'partner_b', campaignId: null, source: 'manual', clicks: 0, registrations: 2, firstPaid: 0 },
    { partnerId: 'partner_c', campaignId: null, source: 'event', clicks: 0, registrations: 0, firstPaid: 1 },
    { partnerId: 'partner_d', campaignId: null, source: 'qr', clicks: 12, registrations: 0, firstPaid: 0 }
  ]);
  assert.equal(result.find(item => item.partnerId === 'partner_a')?.clicks, 32);
  assert.equal(result.find(item => item.partnerId === 'partner_b')?.clicks, 0);
  assert.equal(result.find(item => item.partnerId === 'partner_d')?.clicks, 12);
});

test('does not merge otherwise similar referrals across partner or campaign boundaries', () => {
  const result = buildGrowthReferralBreakdown([
    { partnerId: 'partner_a', campaignId: 'campaign_a', source: 'link', count: 1 },
    { partnerId: 'partner_a', campaignId: 'campaign_b', source: 'link', count: 2 },
    { partnerId: 'partner_b', campaignId: 'campaign_a', source: 'link', count: 3 }
  ], [
    { partnerId: 'partner_a', campaignId: 'campaign_a', source: 'link', count: 1 },
    { partnerId: 'partner_a', campaignId: 'campaign_b', source: 'link', count: 2 },
    { partnerId: 'partner_b', campaignId: 'campaign_a', source: 'link', count: 3 }
  ], []);
  assert.equal(result.length, 3);
  assert.deepEqual(result.map(item => item.registrations), [3, 2, 1]);
  assert.deepEqual(result.map(item => item.clicks), [3, 2, 1]);
  assert.ok(result.every(item => item.firstPaid === 0));
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateCommissionAllocations,
  calculateCommissionReversal,
  isAllowedPartnerParent,
  isPartnerRole,
  isPartnerStatus,
  partnerCodePrefix
} from '../src/server/partnerGrowth';
import { isPartnerCampaignChannel } from '../src/shared/partnerCampaignChannels';

test('partner campaign channels cover agreed launch markets without enabling Telegram', () => {
  assert.equal(isPartnerCampaignChannel('wechat_official'), true);
  assert.equal(isPartnerCampaignChannel('google_ads'), true);
  assert.equal(isPartnerCampaignChannel('whatsapp'), true);
  assert.equal(isPartnerCampaignChannel('telegram'), false);
});

test('partner role, status, parent hierarchy and ID prefixes are explicit', () => {
  assert.equal(isPartnerRole('agent'), true);
  assert.equal(isPartnerRole('owner'), false);
  assert.equal(isPartnerStatus('active'), true);
  assert.equal(isPartnerStatus('approved'), false);
  assert.equal(isAllowedPartnerParent('agent', 'city_agent'), true);
  assert.equal(isAllowedPartnerParent('agent', 'partner'), false);
  assert.equal(isAllowedPartnerParent('city_agent', 'partner'), true);
  assert.equal(isAllowedPartnerParent('partner', null), true);
  assert.equal(partnerCodePrefix('city_agent'), 'CITY');
});

test('commission allocations calculate cents and omit zero-rate recipients', () => {
  assert.deepEqual(calculateCommissionAllocations(99.99, [
    { partnerId: 'agent-1', role: 'agent', rate: 10 },
    { partnerId: 'city-1', role: 'city_agent', rate: 5 },
    { partnerId: 'network-1', role: 'partner', rate: 0 }
  ]), [
    { partnerId: 'agent-1', role: 'agent', rate: 10, basisAmount: 99.99, amount: 10 },
    { partnerId: 'city-1', role: 'city_agent', rate: 5, basisAmount: 99.99, amount: 5 }
  ]);
});

test('commission allocations reject invalid totals, duplicates and negative bases', () => {
  assert.throws(() => calculateCommissionAllocations(1, [
    { partnerId: 'a', role: 'agent', rate: 60 },
    { partnerId: 'b', role: 'city_agent', rate: 40.01 }
  ]), { message: 'PARTNER_COMMISSION_TOTAL_RATE_EXCEEDED' });
  assert.throws(() => calculateCommissionAllocations(1, [
    { partnerId: 'a', role: 'agent', rate: 1 },
    { partnerId: 'a', role: 'city_agent', rate: 1 }
  ]), { message: 'PARTNER_COMMISSION_RECIPIENT_INVALID' });
  assert.throws(() => calculateCommissionAllocations(-1, []), { message: 'PARTNER_COMMISSION_BASIS_INVALID' });
  assert.throws(() => calculateCommissionAllocations(1, [
    { partnerId: 'a', role: 'agent', rate: 101 }
  ]), { message: 'PARTNER_COMMISSION_RATE_INVALID' });
});

test('commission refund reversals prorate cumulative refunds and consume rounding remainder', () => {
  const firstRefund = calculateCommissionReversal(20, 100, 33.33, 0);
  const secondRefund = calculateCommissionReversal(20, 100, 66.67, Math.abs(firstRefund));
  const finalRefund = calculateCommissionReversal(20, 100, 100, Math.abs(firstRefund + secondRefund));

  assert.deepEqual([firstRefund, secondRefund, finalRefund], [-6.67, -6.66, -6.67]);
  assert.equal(firstRefund + secondRefund + finalRefund, -20);
  assert.equal(calculateCommissionReversal(20, 100, 140, 4), -16);
  assert.equal(calculateCommissionReversal(20, 100, 40, 10), 0);
});

test('commission refund reversals reject invalid financial inputs', () => {
  assert.throws(() => calculateCommissionReversal(20, 0, 10, 0), {
    message: 'PARTNER_COMMISSION_REVERSAL_INPUT_INVALID'
  });
  assert.throws(() => calculateCommissionReversal(20, 100, -1, 0), {
    message: 'PARTNER_COMMISSION_REVERSAL_INPUT_INVALID'
  });
});

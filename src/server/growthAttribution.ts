export type GrowthReferralBreakdown = {
  key: string;
  partnerId: string;
  campaignId: string | null;
  source: string;
  clicks: number;
  registrations: number;
  firstPaid: number;
};

export type ReferralAggregate = {
  partnerId: string;
  campaignId: string | null;
  source: string;
  count: number;
};

export type GrowthDailyReferralAggregate = {
  day: string;
  clicks: number;
  registrations: number;
  unknownRegistrations: number;
  firstPaid: number;
};

export type GrowthDailyReferralMetrics = {
  day: string;
  referralClicks: number;
  referralRegistrations: number;
  unknownRegistrations: number;
  referralFirstPaid: number;
};

export function mergeGrowthReferralDaily<T extends GrowthDailyReferralMetrics>(
  daily: readonly T[],
  referralDaily: readonly GrowthDailyReferralAggregate[]
): T[] {
  const referralByDay = new Map(referralDaily.map(item => [item.day, item]));
  return daily.map(day => {
    const referral = referralByDay.get(day.day);
    return referral
      ? {
          ...day,
          referralClicks: referral.clicks,
          referralRegistrations: referral.registrations,
          unknownRegistrations: referral.unknownRegistrations,
          referralFirstPaid: referral.firstPaid
        }
      : day;
  });
}

export function buildGrowthReferralBreakdown(
  clicks: readonly ReferralAggregate[],
  registrations: readonly ReferralAggregate[],
  firstPaid: readonly ReferralAggregate[]
): GrowthReferralBreakdown[] {
  const groups = new Map<string, GrowthReferralBreakdown>();
  const getGroup = (item: ReferralAggregate) => {
    const key = JSON.stringify([item.partnerId, item.campaignId, item.source]);
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        partnerId: item.partnerId,
        campaignId: item.campaignId,
        source: item.source,
        clicks: 0,
        registrations: 0,
        firstPaid: 0
      };
      groups.set(key, group);
    }
    return group;
  };
  for (const item of clicks) getGroup(item).clicks = item.count;
  for (const item of registrations) getGroup(item).registrations = item.count;
  for (const item of firstPaid) getGroup(item).firstPaid = item.count;
  return [...groups.values()].sort((left, right) =>
    right.registrations - left.registrations || right.firstPaid - left.firstPaid
    || right.clicks - left.clicks || left.key.localeCompare(right.key)
  );
}

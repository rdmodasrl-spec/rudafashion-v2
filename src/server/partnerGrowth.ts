import { Prisma, type PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

export const partnerRoles = ['agent', 'city_agent', 'partner'] as const;
export type PartnerRole = (typeof partnerRoles)[number];

export const partnerStatuses = ['pending', 'active', 'paused', 'disabled'] as const;
export type PartnerStatus = (typeof partnerStatuses)[number];

export type CommissionRecipient = {
  partnerId: string;
  role: PartnerRole;
  rate: number;
};

export type CommissionAllocation = CommissionRecipient & {
  basisAmount: number;
  amount: number;
};

const codePrefix: Record<PartnerRole, string> = {
  agent: 'AG',
  city_agent: 'CITY',
  partner: 'PARTNER'
};

export function isPartnerRole(value: unknown): value is PartnerRole {
  return typeof value === 'string' && partnerRoles.includes(value as PartnerRole);
}

export function isPartnerStatus(value: unknown): value is PartnerStatus {
  return typeof value === 'string' && partnerStatuses.includes(value as PartnerStatus);
}

export function partnerCodePrefix(role: PartnerRole): string {
  return codePrefix[role];
}

export async function getPartnerScopeIds(prisma: Pick<PrismaClient, '$queryRaw'>, partnerId: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    WITH RECURSIVE partner_scope("id") AS (
      SELECT "id" FROM "Partner" WHERE "id" = ${partnerId}
      UNION
      SELECT child."id"
      FROM "Partner" child
      INNER JOIN partner_scope parent ON child."parentId" = parent."id"
      WHERE child."status" = 'active'
    )
    SELECT "id" FROM partner_scope
  `);
  return rows.map(row => row.id);
}

export function isAllowedPartnerParent(role: PartnerRole, parentRole: string | null): boolean {
  if (role === 'partner') return parentRole === null;
  if (role === 'city_agent') return parentRole === null || parentRole === 'partner';
  return parentRole === null || parentRole === 'city_agent';
}

export async function persistPartnerReferralFromClick(
  transaction: Prisma.TransactionClient,
  customerId: string,
  clickId: string
): Promise<boolean> {
  const click = await transaction.partnerReferralClick.findUnique({
    where: { id: clickId },
    include: { partner: true, campaign: true }
  });
  if (!click || click.partner.status !== 'active' || !isPartnerRole(click.partner.role)) return false;
  if (click.campaignId && (
    !click.campaign
    || click.campaign.partnerId !== click.partnerId
    || click.campaign.status !== 'active'
    || click.source !== click.campaign.channel
  )) return false;

  const ancestors: Array<{ id: string; role: string; status: string }> = [];
  let childRole: PartnerRole = click.partner.role;
  let parentId = click.partner.parentId;
  let depth = 0;
  while (parentId && depth < 2) {
    depth += 1;
    const parent = await transaction.partner.findUnique({
      where: { id: parentId },
      select: { id: true, role: true, status: true, parentId: true }
    });
    if (!parent) return false;
    if (!isPartnerRole(parent.role) || !isAllowedPartnerParent(childRole, parent.role)) return false;
    if (parent.status === 'active') ancestors.push(parent);
    childRole = parent.role;
    parentId = parent.parentId;
  }
  if (parentId) return false;
  if (!isAllowedPartnerParent(childRole, null)) return false;

  const cityPartner = click.partner.role === 'city_agent'
    ? click.partner
    : ancestors.find(ancestor => ancestor.role === 'city_agent');
  const networkPartner = click.partner.role === 'partner'
    ? click.partner
    : ancestors.find(ancestor => ancestor.role === 'partner');
  const result = await transaction.partnerReferral.createMany({
    data: [{
      id: randomUUID(),
      customerId,
      partnerId: click.partnerId,
      cityPartnerId: cityPartner?.id || null,
      networkPartnerId: networkPartner?.id || null,
      campaignId: click.campaignId,
      source: click.source,
      landingPath: click.landingPath,
      firstClickAt: click.clickedAt
    }],
    skipDuplicates: true
  });
  return result.count === 1;
}

export function calculateCommissionAllocations(
  basisAmount: number,
  recipients: CommissionRecipient[]
): CommissionAllocation[] {
  if (!Number.isFinite(basisAmount) || basisAmount < 0 || basisAmount > 1_000_000_000_000) {
    throw new Error('PARTNER_COMMISSION_BASIS_INVALID');
  }
  const uniquePartners = new Set<string>();
  let totalRate = 0;
  const normalized = recipients.map(recipient => {
    if (!recipient.partnerId || uniquePartners.has(recipient.partnerId)) {
      throw new Error('PARTNER_COMMISSION_RECIPIENT_INVALID');
    }
    uniquePartners.add(recipient.partnerId);
    if (!isPartnerRole(recipient.role) || !Number.isFinite(recipient.rate) || recipient.rate < 0 || recipient.rate > 100) {
      throw new Error('PARTNER_COMMISSION_RATE_INVALID');
    }
    totalRate += recipient.rate;
    return recipient;
  });
  if (totalRate > 100) throw new Error('PARTNER_COMMISSION_TOTAL_RATE_EXCEEDED');

  return normalized
    .filter(recipient => recipient.rate > 0)
    .map(recipient => ({
      ...recipient,
      basisAmount: Number(basisAmount.toFixed(2)),
      amount: Number((basisAmount * recipient.rate / 100).toFixed(2))
    }))
    .filter(allocation => allocation.amount > 0);
}

export function calculateCommissionReversal(
  originalAmount: number,
  basisAmount: number,
  cumulativeRefundAmount: number,
  alreadyReversedAmount: number
): number {
  if (
    !Number.isFinite(originalAmount) || originalAmount < 0
    || !Number.isFinite(basisAmount) || basisAmount <= 0
    || !Number.isFinite(cumulativeRefundAmount) || cumulativeRefundAmount < 0
    || !Number.isFinite(alreadyReversedAmount) || alreadyReversedAmount < 0
  ) {
    throw new Error('PARTNER_COMMISSION_REVERSAL_INPUT_INVALID');
  }

  const targetReversalCents = Math.round(
    originalAmount * Math.min(cumulativeRefundAmount, basisAmount) / basisAmount * 100
  );
  const alreadyReversedCents = Math.round(alreadyReversedAmount * 100);
  const reversalCents = Math.max(0, targetReversalCents - alreadyReversedCents);
  return reversalCents === 0 ? 0 : -reversalCents / 100;
}

export async function lockPartnerCommissionOrder(
  transaction: Prisma.TransactionClient,
  orderId: string
): Promise<boolean> {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE
  `);
  return rows.length > 0;
}

export async function createPaidOrderPartnerCommissions(
  transaction: Prisma.TransactionClient,
  orderId: string
): Promise<void> {
  if (!await lockPartnerCommissionOrder(transaction, orderId)) return;

  const order = await transaction.order.findUnique({
    where: { id: orderId },
    include: {
      partnerReferral: { include: { campaign: { select: { partnerId: true } } } },
      partner: true,
      partnerCityAgent: true,
      partnerNetwork: true
    }
  });
  if (!order || order.paymentStatus !== 'paid' || order.status === 'cancelled'
    || order.refundStatus !== 'none' || Number(order.refundAmount || 0) > 0
    || !order.partnerReferral || !order.partner) return;

  const referral = order.partnerReferral;
  if (
    referral.partnerId !== order.partner.id
    || referral.cityPartnerId !== order.partnerCityAgentId
    || referral.networkPartnerId !== order.partnerNetworkId
    || (referral.campaign && referral.campaign.partnerId !== referral.partnerId)
  ) throw new Error('PARTNER_COMMISSION_ATTRIBUTION_INCONSISTENT');

  const chain = [order.partner, order.partnerCityAgent, order.partnerNetwork]
    .filter((partner): partner is NonNullable<typeof partner> => Boolean(partner && partner.status === 'active' && isPartnerRole(partner.role)))
    .filter((partner, index, all) => all.findIndex(item => item.id === partner.id) === index);
  const recipients = chain.flatMap(partner => {
    if (!isPartnerRole(partner.role)) return [];
    return [{
      partnerId: partner.id,
      role: partner.role,
      rate: Number(
        partner.role === 'agent' ? partner.commissionRate
          : partner.role === 'city_agent' ? partner.cityCommissionRate
            : partner.partnerCommissionRate
      )
    }];
  });
  const basisAmount = Number(order.totalAmount);
  const allocations = calculateCommissionAllocations(Math.max(0, basisAmount), recipients);
  const created = allocations.length
    ? await transaction.partnerCommissionEntry.createMany({
      data: allocations.map(allocation => ({
        id: randomUUID(),
        referralId: referral.id,
        orderId: order.id,
        partnerId: allocation.partnerId,
        role: allocation.role,
        entryType: 'commission',
        basisAmount: allocation.basisAmount,
        rate: allocation.rate,
        amount: allocation.amount,
        status: 'pending',
        idempotencyKey: `commission:${order.id}:${allocation.partnerId}`
      })),
      skipDuplicates: true
    })
    : { count: 0 };

  await transaction.partnerReferral.updateMany({
    where: { id: referral.id, firstPaidAt: null },
    data: { firstPaidAt: new Date() }
  });
  if (!created.count) return;

  await transaction.partnerAuditEvent.create({
    data: {
      id: randomUUID(),
      operatorId: 'system',
      action: 'commission_created',
      entityType: 'order',
      entityId: order.id,
      metadata: JSON.stringify({
        partnerReferralId: referral.id,
        allocations: allocations.map(({ partnerId, amount, rate }) => ({ partnerId, amount, rate }))
      })
    }
  });
}

export async function createPartnerCommissionReversals(
  transaction: Prisma.TransactionClient,
  orderId: string,
  refundId: string,
  knownCumulativeRefundAmount?: number
): Promise<void> {
  if (!await lockPartnerCommissionOrder(transaction, orderId)) {
    throw new Error('PARTNER_COMMISSION_REFUND_ORDER_NOT_FOUND');
  }

  const refund = await transaction.refundTransaction.findUnique({ where: { id: refundId } });
  if (!refund || refund.orderId !== orderId || refund.status !== 'succeeded') return;

  const [successfulRefunds, originalEntries] = await Promise.all([
    knownCumulativeRefundAmount === undefined
      ? transaction.refundTransaction.aggregate({
        where: { orderId, status: 'succeeded' },
        _sum: { amount: true }
      })
      : Promise.resolve(null),
    transaction.partnerCommissionEntry.findMany({
      where: { orderId, entryType: 'commission', status: { not: 'cancelled' } }
    })
  ]);
  const cumulativeRefundAmount = knownCumulativeRefundAmount === undefined
    ? Number(successfulRefunds?._sum.amount || 0)
    : knownCumulativeRefundAmount;

  for (const entry of originalEntries) {
    const existingReversals = await transaction.partnerCommissionEntry.aggregate({
      where: { reversalOfId: entry.id, entryType: 'reversal', status: { not: 'cancelled' } },
      _sum: { amount: true }
    });
    const alreadyReversedAmount = Math.abs(Number(existingReversals._sum.amount || 0));
    const reversalAmount = calculateCommissionReversal(
      Number(entry.amount),
      Number(entry.basisAmount),
      cumulativeRefundAmount,
      alreadyReversedAmount
    );
    if (reversalAmount === 0) continue;

    const reversal = await transaction.partnerCommissionEntry.create({
      data: {
        id: randomUUID(),
        referralId: entry.referralId,
        orderId: entry.orderId,
        partnerId: entry.partnerId,
        role: entry.role,
        entryType: 'reversal',
        basisAmount: Number(refund.amount),
        rate: entry.rate,
        amount: reversalAmount,
        status: 'approved',
        idempotencyKey: `refund:${refund.id}:commission:${entry.id}`,
        sourceRefundId: refund.id,
        reversalOfId: entry.id
      }
    });
    await transaction.partnerAuditEvent.create({
      data: {
        id: randomUUID(),
        partnerId: entry.partnerId,
        operatorId: 'system',
        action: 'commission_refund_reversed',
        entityType: 'commission',
        entityId: entry.id,
        metadata: JSON.stringify({
          reversalEntryId: reversal.id,
          refundId: refund.id,
          orderId,
          amount: reversalAmount,
          cumulativeRefundAmount
        })
      }
    });
  }
}

import { PrismaClient } from '@prisma/client';

export interface WebhookEventRecord {
  id: string;
  provider: string;
  providerEventId: string;
  eventType: string;
  payload: string;
}

export class WebhookIdempotencyStore {
  constructor(private prisma: PrismaClient) {}

  async isAlreadyProcessed(provider: string, providerEventId: string): Promise<boolean> {
    if (!provider || !providerEventId) return false;
    const existing = await this.prisma.paymentWebhookEvent.findUnique({
      where: { provider_providerEventId: { provider, providerEventId } },
      select: { id: true }
    });
    return Boolean(existing);
  }

  async recordEvent(params: {
    id: string;
    provider: string;
    providerEventId: string;
    eventType: string;
    payload: string;
  }): Promise<boolean> {
    const result = await this.prisma.paymentWebhookEvent.createMany({
      data: [{ ...params }],
      skipDuplicates: true
    });
    return result.count > 0;
  }

  async findPaymentByProviderPaymentId(
    provider: string,
    providerPaymentId: string | null | undefined
  ) {
    if (!provider || !providerPaymentId) return null;
    return this.prisma.paymentTransaction.findFirst({
      where: { provider, providerPaymentId }
    });
  }

  async updatePaymentTransactionById(
    id: string,
    data: { status?: string; providerPaymentId?: string | null }
  ) {
    return this.prisma.paymentTransaction.update({ where: { id }, data });
  }
}

export function isEmptyProviderPaymentId(value: string | null | undefined): boolean {
  return value === null || value === undefined || String(value).trim() === '';
}

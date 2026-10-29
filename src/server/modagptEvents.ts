import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { ModaGptTaskQueue } from './modagptTaskQueue';
import type { ModaGptTaskInput } from './modagptTaskQueue';

export const modaGptBusinessEventTypes = [
  'order.created',
  'order.completed',
  'product.created',
  'product.updated',
  'inventory.changed',
  'inventory.low',
  'customer.created',
  'customer.inactive',
  'quote.created',
  'quote.accepted',
  'quote.rejected',
  'payment.completed',
  'campaign.created',
  'creative.generated',
  'agent.task.completed',
  'approval.accepted',
  'approval.rejected',
  'sales.anomaly',
  'trend.detected'
] as const;

export type ModaGptBusinessEventType = (typeof modaGptBusinessEventTypes)[number];

export type ModaGptBusinessEvent = {
  type: ModaGptBusinessEventType;
  eventId: string;
  merchantId: string;
  occurredAt: string;
  data: Record<string, unknown>;
};

export function createModaGptEventTaskInput(
  event: ModaGptBusinessEvent
): ModaGptTaskInput & { merchantId: string; tenantId: string; traceId: string; idempotencyKey: string; goal: string } {
  if (!modaGptBusinessEventTypes.includes(event.type)) throw new Error('MODAGPT_EVENT_TYPE_INVALID');
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(event.eventId)) {
    throw new Error('MODAGPT_EVENT_ID_INVALID');
  }
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(event.merchantId)) {
    throw new Error('MODAGPT_EVENT_MERCHANT_INVALID');
  }
  if (
    typeof event.occurredAt !== 'string'
    || !Number.isFinite(Date.parse(event.occurredAt))
    || !event.data
    || typeof event.data !== 'object'
    || Array.isArray(event.data)
    || containsSensitiveField(event.data)
  ) throw new Error('MODAGPT_EVENT_PAYLOAD_INVALID');
  const idempotencyKey = `event:${createHash('sha256')
    .update(JSON.stringify([event.merchantId, event.type, event.eventId]))
    .digest('hex')}`;
  const payload = {
    version: 1,
    type: event.type,
    eventId: event.eventId,
    occurredAt: new Date(event.occurredAt).toISOString(),
    data: event.data
  };
  return {
    taskType: 'ai.event',
    merchantId: event.merchantId,
    tenantId: event.merchantId,
    actorId: 'system:outbox',
    traceId: idempotencyKey,
    goal: `Process ${event.type} event ${event.eventId}`,
    priority: 0,
    context: payload,
    idempotencyKey,
    payload
  };
}

export async function enqueueModaGptEventsInTransaction(
  transaction: Pick<Prisma.TransactionClient, 'modaGptTask'>,
  events: readonly ModaGptBusinessEvent[]
): Promise<void> {
  if (!events.length) return;
  const tasks = events.map(createModaGptEventTaskInput);
  await transaction.modaGptTask.createMany({
    data: tasks.map(task => ({
      taskType: task.taskType,
      merchantId: task.merchantId ?? null,
      tenantId: task.tenantId ?? null,
      actorId: task.actorId ?? null,
      traceId: task.traceId,
      parentTaskId: task.parentTaskId ?? null,
      goal: task.goal,
      priority: task.priority ?? 0,
      agentId: task.agentId ?? null,
      context: JSON.stringify(task.context ?? task.payload),
      plan: task.plan === undefined ? null : JSON.stringify(task.plan),
      idempotencyKey: task.idempotencyKey ?? null,
      payload: JSON.stringify(task.payload),
      maxAttempts: task.maxAttempts ?? 5
    }))
  });
}

function containsSensitiveField(value: unknown, depth = 0): boolean {
  if (depth > 8) return true;
  if (Array.isArray(value)) return value.some(entry => containsSensitiveField(entry, depth + 1));
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, entry]) => {
    const normalizedKey = key.replace(/[^a-z]/gi, '').toLowerCase();
    return /(?:email|phone|address|card|iban|password|token|ip|fullname)$/.test(normalizedKey)
      || containsSensitiveField(entry, depth + 1);
  });
}

export async function publishModaGptEvent(
  queue: ModaGptTaskQueue,
  event: ModaGptBusinessEvent
): Promise<{ id: string; deduplicated: boolean }> {
  const task = await queue.enqueue(createModaGptEventTaskInput(event));
  return { id: task.id, deduplicated: task.deduplicated };
}

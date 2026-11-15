import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';

export const MAX_STUDIO_PROJECT_PAYLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_STUDIO_PROJECT_TITLE_LENGTH = 160;
export const MAX_STUDIO_PROJECT_IDEMPOTENCY_KEY_LENGTH = 160;

export type MerchantStudioProjectInput = {
  title: string;
  payload: Prisma.InputJsonObject;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (isRecord(value)) {
    const entries = Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function normalizeMerchantStudioProjectInput(value: unknown):
  | { ok: true; input: MerchantStudioProjectInput; payloadBytes: number }
  | { ok: false; reason: 'invalid_title' | 'invalid_payload' | 'payload_too_large' } {
  if (!isRecord(value) || typeof value.title !== 'string') return { ok: false, reason: 'invalid_title' };
  const title = value.title.trim();
  if (!title || title.length > MAX_STUDIO_PROJECT_TITLE_LENGTH) return { ok: false, reason: 'invalid_title' };
  if (!isRecord(value.payload)) return { ok: false, reason: 'invalid_payload' };
  const serializedPayload = JSON.stringify(value.payload);
  if (serializedPayload === undefined) return { ok: false, reason: 'invalid_payload' };
  const payloadBytes = Buffer.byteLength(serializedPayload, 'utf8');
  if (payloadBytes > MAX_STUDIO_PROJECT_PAYLOAD_BYTES) return { ok: false, reason: 'payload_too_large' };
  return {
    ok: true,
    input: { title, payload: JSON.parse(serializedPayload) as Prisma.InputJsonObject },
    payloadBytes
  };
}

export function normalizeMerchantStudioProjectIdempotencyKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const key = value.trim();
  return key.length > 0 && key.length <= MAX_STUDIO_PROJECT_IDEMPOTENCY_KEY_LENGTH ? key : null;
}

export function hashMerchantStudioProjectInput(input: MerchantStudioProjectInput): string {
  return createHash('sha256').update(stableJson(input)).digest('hex');
}

export function normalizeMerchantStudioProjectExpectedRevision(value: unknown): number | null {
  return Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : null;
}

export function hasOnlyMerchantStudioProjectFields(value: unknown, fields: readonly string[]): boolean {
  return isRecord(value) && Object.keys(value).every(key => fields.includes(key));
}

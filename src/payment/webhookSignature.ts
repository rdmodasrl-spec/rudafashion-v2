import { createHmac, timingSafeEqual } from 'node:crypto';

const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 300;

export function verifyStripeWebhookSignature(
  payload: Buffer | string,
  signatureHeader: string,
  secret: string,
  nowSeconds = Date.now() / 1000
): boolean {
  if (!secret || !Number.isFinite(nowSeconds)) return false;

  let timestamp: string | undefined;
  const signatures: string[] = [];
  for (const component of signatureHeader.split(',')) {
    const separator = component.indexOf('=');
    if (separator < 0) continue;
    const key = component.slice(0, separator).trim();
    const value = component.slice(separator + 1).trim();
    if (key === 't' && timestamp === undefined) timestamp = value;
    if (key === 'v1' && /^[\da-f]{64}$/i.test(value)) signatures.push(value);
  }

  if (!timestamp || !/^\d+$/.test(timestamp) || signatures.length === 0) return false;
  const timestampSeconds = Number(timestamp);
  if (!Number.isSafeInteger(timestampSeconds) ||
      Math.abs(nowSeconds - timestampSeconds) > STRIPE_SIGNATURE_TOLERANCE_SECONDS) {
    return false;
  }

  const signedPayload = `${timestamp}.${typeof payload === 'string' ? payload : payload.toString('utf8')}`;
  const expected = createHmac('sha256', secret).update(signedPayload).digest();
  return signatures.some(signature => timingSafeEqual(Buffer.from(signature, 'hex'), expected));
}

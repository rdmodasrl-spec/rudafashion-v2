export interface MerchantStripeCredentials {
  secretKey: string;
  accountId: string;
  livemode: boolean;
}

export interface StripeCheckoutRequest {
  amount: number;
  currency: string;
  reference: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
}

export interface StripeCheckout {
  sessionId: string;
  checkoutUrl: string;
}

export interface StripeCheckoutStatus {
  sessionId: string;
  status: string;
  paymentStatus: string;
  amount: number;
  currency: string;
  paymentIntentId: string | null;
}

async function stripeRequest<T>(
  credentials: MerchantStripeCredentials,
  path: string,
  options: RequestInit = {},
  idempotencyKey?: string
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`https://api.stripe.com${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${credentials.secretKey}`,
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey.slice(0, 255) } : {}),
        ...options.headers
      }
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const code = response.status === 401 ? 'STRIPE_CREDENTIALS_INVALID' : `STRIPE_API_${response.status}`;
      throw new Error(code);
    }
    if (!payload || typeof payload !== 'object') throw new Error('STRIPE_RESPONSE_INVALID');
    return payload as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function validateMerchantStripeKey(secretKey: string): Promise<{ accountId: string; livemode: boolean }> {
  if (!/^sk_(test|live)_[A-Za-z0-9]+$/.test(secretKey) || secretKey.length > 512) {
    throw new Error('STRIPE_CREDENTIALS_INVALID');
  }
  const response = await stripeRequest<{ id?: string; livemode?: boolean }>(
    { secretKey, accountId: '', livemode: false },
    '/v1/account',
    { method: 'GET' }
  );
  if (!response.id || typeof response.livemode !== 'boolean') throw new Error('STRIPE_ACCOUNT_RESPONSE_INVALID');
  const keyIsLive = secretKey.startsWith('sk_live_');
  if (response.livemode !== keyIsLive) throw new Error('STRIPE_KEY_MODE_MISMATCH');
  return { accountId: response.id, livemode: response.livemode };
}

export async function createMerchantStripeCheckout(
  credentials: MerchantStripeCredentials,
  request: StripeCheckoutRequest,
  idempotencyKey: string
): Promise<StripeCheckout> {
  const body = new URLSearchParams({
    mode: 'payment',
    'payment_method_types[0]': 'card',
    'line_items[0][price_data][currency]': request.currency.toLowerCase(),
    'line_items[0][price_data][product_data][name]': request.description.slice(0, 500),
    'line_items[0][price_data][unit_amount]': String(Math.round(request.amount * 100)),
    'line_items[0][quantity]': '1',
    'metadata[orderNo]': request.reference.slice(0, 500),
    success_url: request.successUrl,
    cancel_url: request.cancelUrl
  });
  const session = await stripeRequest<{ id?: string; url?: string }>(
    credentials,
    '/v1/checkout/sessions',
    { method: 'POST', body },
    idempotencyKey
  );
  if (!session.id || !session.url) throw new Error('STRIPE_CHECKOUT_URL_MISSING');
  return { sessionId: session.id, checkoutUrl: session.url };
}

export async function retrieveMerchantStripeCheckout(
  credentials: MerchantStripeCredentials,
  sessionId: string
): Promise<StripeCheckoutStatus> {
  const session = await stripeRequest<{
    id?: string;
    status?: string;
    payment_status?: string;
    amount_total?: number;
    currency?: string;
    payment_intent?: string | { id?: string } | null;
  }>(credentials, `/v1/checkout/sessions/${encodeURIComponent(sessionId)}?expand%5B%5D=payment_intent`, { method: 'GET' });
  const paymentIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent?.id || null;
  return {
    sessionId: session.id || '',
    status: session.status || 'unknown',
    paymentStatus: session.payment_status || 'unpaid',
    amount: Number(session.amount_total || 0) / 100,
    currency: String(session.currency || ''),
    paymentIntentId
  };
}

export async function expireMerchantStripeCheckout(
  credentials: MerchantStripeCredentials,
  sessionId: string
): Promise<string> {
  const session = await stripeRequest<{ status?: string }>(
    credentials,
    `/v1/checkout/sessions/${encodeURIComponent(sessionId)}/expire`,
    { method: 'POST', body: new URLSearchParams() }
  );
  return session.status || 'unknown';
}

export async function createMerchantStripeRefund(
  credentials: MerchantStripeCredentials,
  paymentIntentId: string,
  amount: number,
  idempotencyKey: string
): Promise<{ refundId: string; status: string }> {
  const body = new URLSearchParams({
    payment_intent: paymentIntentId,
    amount: String(Math.round(amount * 100))
  });
  const refund = await stripeRequest<{ id?: string; status?: string }>(
    credentials,
    '/v1/refunds',
    { method: 'POST', body },
    idempotencyKey
  );
  if (!refund.id) throw new Error('STRIPE_REFUND_REFERENCE_MISSING');
  return { refundId: refund.id, status: refund.status || 'pending' };
}

export async function retrieveMerchantStripeRefund(
  credentials: MerchantStripeCredentials,
  refundId: string
): Promise<{ refundId: string; status: string }> {
  const refund = await stripeRequest<{ id?: string; status?: string }>(
    credentials,
    `/v1/refunds/${encodeURIComponent(refundId)}`,
    { method: 'GET' }
  );
  if (!refund.id) throw new Error('STRIPE_REFUND_REFERENCE_MISSING');
  return { refundId: refund.id, status: refund.status || 'pending' };
}

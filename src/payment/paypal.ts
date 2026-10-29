export type PayPalEnvironment = 'sandbox' | 'live';

export interface PayPalCredentials {
  clientId: string;
  clientSecret: string;
  environment: PayPalEnvironment;
}

export interface PayPalCheckoutRequest {
  amount: number;
  currency: string;
  reference: string;
  description: string;
  returnUrl: string;
  cancelUrl: string;
}

export interface PayPalCheckout {
  orderId: string;
  approvalUrl: string;
}

export interface PayPalCapture {
  status: string;
  captureId: string | null;
  amount: number;
  currency: string;
}

function apiBase(environment: PayPalEnvironment): string {
  return environment === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

async function paypalRequest<T>(
  credentials: PayPalCredentials,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${apiBase(credentials.environment)}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers
      }
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(response.status === 401 ? 'PAYPAL_CREDENTIALS_INVALID' : `PAYPAL_API_${response.status}`);
    }
    if (!payload || typeof payload !== 'object') throw new Error('PAYPAL_RESPONSE_INVALID');
    return payload as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function accessToken(credentials: PayPalCredentials): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${apiBase(credentials.environment)}/v1/oauth2/token`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body: 'grant_type=client_credentials'
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new Error(response.status === 401 ? 'PAYPAL_CREDENTIALS_INVALID' : `PAYPAL_AUTH_${response.status}`);
    const token = payload && typeof payload === 'object' && 'access_token' in payload
      ? (payload as { access_token?: unknown }).access_token
      : null;
    if (typeof token !== 'string' || !token) throw new Error('PAYPAL_ACCESS_TOKEN_MISSING');
    return token;
  } finally {
    clearTimeout(timeout);
  }
}

export async function validatePayPalCredentials(credentials: PayPalCredentials): Promise<void> {
  await accessToken(credentials);
}

export async function createPayPalCheckout(
  credentials: PayPalCredentials,
  request: PayPalCheckoutRequest
): Promise<PayPalCheckout> {
  const token = await accessToken(credentials);
  const payload = await paypalRequest<{
    id?: string;
    links?: Array<{ href?: string; rel?: string }>;
  }>(credentials, '/v2/checkout/orders', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'PayPal-Request-Id': `ruda-${request.reference}`.slice(0, 108)
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: request.reference.slice(0, 64),
        custom_id: request.reference.slice(0, 127),
        description: request.description.slice(0, 127),
        amount: {
          currency_code: request.currency.toUpperCase(),
          value: request.amount.toFixed(2)
        }
      }],
      application_context: {
        user_action: 'PAY_NOW',
        shipping_preference: 'NO_SHIPPING',
        return_url: request.returnUrl,
        cancel_url: request.cancelUrl
      }
    })
  });
  const approvalUrl = payload.links?.find(link => link.rel === 'approve' || link.rel === 'payer-action')?.href;
  if (!payload.id || !approvalUrl) throw new Error('PAYPAL_APPROVAL_URL_MISSING');
  return { orderId: payload.id, approvalUrl };
}

export async function capturePayPalCheckout(
  credentials: PayPalCredentials,
  orderId: string,
  idempotencyKey: string
): Promise<PayPalCapture> {
  const token = await accessToken(credentials);
  const payload = await paypalRequest<{
    status?: string;
    purchase_units?: Array<{
      payments?: {
        captures?: Array<{
          id?: string;
          status?: string;
          amount?: { value?: string; currency_code?: string };
        }>;
      };
    }>;
  }>(credentials, `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'PayPal-Request-Id': idempotencyKey.slice(0, 108)
    },
    body: '{}'
  });
  const capture = payload.purchase_units?.flatMap(unit => unit.payments?.captures || [])[0];
  return {
    status: capture?.status || payload.status || 'UNKNOWN',
    captureId: capture?.id || null,
    amount: Number(capture?.amount?.value || 0),
    currency: String(capture?.amount?.currency_code || '')
  };
}

export async function refundPayPalCapture(
  credentials: PayPalCredentials,
  captureId: string,
  amount: number,
  currency: string,
  idempotencyKey: string
): Promise<{ status: string; refundId: string | null }> {
  const token = await accessToken(credentials);
  const payload = await paypalRequest<{ id?: string; status?: string }>(
    credentials,
    `/v2/payments/captures/${encodeURIComponent(captureId)}/refund`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'PayPal-Request-Id': idempotencyKey.slice(0, 108)
      },
      body: JSON.stringify({
        amount: { value: amount.toFixed(2), currency_code: currency.toUpperCase() }
      })
    }
  );
  return { status: payload.status || 'UNKNOWN', refundId: payload.id || null };
}

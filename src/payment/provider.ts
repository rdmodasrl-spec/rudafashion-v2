/**
 * Payment integration boundary.
 *
 * Providers run on the server only. Credentials are never accepted from the
 * browser; unsupported or unconfigured providers remain on the safe placeholder.
 */
export type PaymentProviderId = 'manual' | 'stripe' | 'adyen' | 'custom';

export interface PaymentRequest {
  orderId: string;
  amount: number;
  currency: string;
  description?: string;
  successUrl?: string;
  cancelUrl?: string;
}

export interface RefundRequest {
  orderId: string;
  amount: number;
  currency: string;
  reason?: string;
  providerPaymentId?: string;
  idempotencyKey?: string;
}

export interface SubscriptionCheckoutRequest {
  billingId: string;
  merchantId: string;
  customerEmail: string;
  planId: string;
  planName: string;
  amountMinor: number;
  currency: string;
  interval: 'month';
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
  automaticTax: boolean;
}

export interface PaymentProvider {
  readonly id: PaymentProviderId;
  createPayment(request: PaymentRequest): Promise<{ status: 'not_configured' | 'pending'; providerReference?: string; checkoutUrl?: string }>;
  createSubscriptionCheckout(request: SubscriptionCheckoutRequest): Promise<{ status: 'not_configured' | 'pending'; providerReference?: string; checkoutUrl?: string }>;
  setSubscriptionCancelAtPeriodEnd(providerSubscriptionId: string, cancel: boolean): Promise<{ status: 'not_configured' | 'pending' }>;
  refundPayment(request: RefundRequest): Promise<{ status: 'not_configured' | 'pending'; providerReference?: string }>;
}

export interface PaymentIntegrationStatus {
  provider: PaymentProviderId;
  enabled: boolean;
  credentialsConfigured: boolean;
  supportsPayments: boolean;
  supportsRefunds: boolean;
  supportsSubscriptions: boolean;
  billingMode: 'test' | 'live' | null;
  stripeTestMode: boolean;
  stripeLiveMode: boolean;
  billingTestPurchasesEnabled: boolean;
  billingLivePurchasesEnabled: boolean;
  automaticTaxConfigured: boolean;
  webhookConfigured: boolean;
  mode: 'placeholder' | 'configured';
}

const supportedProviders = new Set<PaymentProviderId>(['manual', 'stripe', 'adyen', 'custom']);

function configuredProvider(): PaymentProviderId {
  const value = (process.env.PAYMENT_PROVIDER || 'manual').toLowerCase() as PaymentProviderId;
  return supportedProviders.has(value) ? value : 'manual';
}

export function getPaymentIntegrationStatus(): PaymentIntegrationStatus {
  const provider = configuredProvider();
  const enabled = process.env.PAYMENT_ENABLED === 'true';
  const secret = process.env.PAYMENT_PROVIDER_SECRET || '';
  const credentialsConfigured = Boolean(secret);
  const configured = provider === 'stripe' && enabled && credentialsConfigured;
  const billingModeSetting = process.env.MODAGPT_BILLING_MODE;
  const billingMode = billingModeSetting === undefined || billingModeSetting === 'test'
    ? 'test'
    : billingModeSetting === 'live'
      ? 'live'
      : null;
  const validStripeApiBase = isStripeApiBase(process.env.STRIPE_API_BASE_URL);
  const stripeTestMode = provider === 'stripe'
    && /^sk_test_[A-Za-z0-9]+$/.test(secret)
    && validStripeApiBase;
  const stripeLiveMode = provider === 'stripe'
    && /^sk_live_[A-Za-z0-9]+$/.test(secret)
    && validStripeApiBase;
  const billingTestPurchasesEnabled = billingMode === 'test'
    && stripeTestMode
    && process.env.MODAGPT_BILLING_TEST_PURCHASES_ENABLED === 'true';
  const billingLivePurchasesEnabled = billingMode === 'live'
    && stripeLiveMode
    && process.env.MODAGPT_BILLING_LIVE_PURCHASES_ENABLED === 'true';
  const automaticTaxConfigured = process.env.BILLING_STRIPE_AUTOMATIC_TAX === 'true';
  const webhookSecret = billingMode === 'live'
    ? process.env.MODAGPT_BILLING_STRIPE_WEBHOOK_SECRET
    : process.env.PAYMENT_WEBHOOK_SECRET;
  const webhookConfigured = Boolean(webhookSecret);
  return {
    provider,
    enabled,
    credentialsConfigured,
    supportsPayments: configured,
    supportsRefunds: configured,
    supportsSubscriptions: configured && (
      (billingMode === 'test' && stripeTestMode)
      || (billingMode === 'live' && stripeLiveMode)
    ),
    billingMode,
    stripeTestMode,
    stripeLiveMode,
    billingTestPurchasesEnabled,
    billingLivePurchasesEnabled,
    automaticTaxConfigured,
    webhookConfigured,
    mode: configured ? 'configured' : 'placeholder'
  };
}

function isStripeApiBase(value: string | undefined) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && url.hostname === 'api.stripe.com'
      && (url.pathname === '/' || url.pathname === '')
      && !url.username
      && !url.password
      && !url.search
      && !url.hash;
  } catch {
    return false;
  }
}

/**
 * Safe default used by order/refund flows until a provider is explicitly
 * configured. It makes the integration state observable without pretending a
 * payment or refund was sent.
 */
export class PlaceholderPaymentProvider implements PaymentProvider {
  readonly id: PaymentProviderId = 'manual';

  async createPayment(_request: PaymentRequest) {
    return { status: 'not_configured' as const };
  }

  async createSubscriptionCheckout(_request: SubscriptionCheckoutRequest) {
    return { status: 'not_configured' as const };
  }

  async setSubscriptionCancelAtPeriodEnd(_providerSubscriptionId: string, _cancel: boolean) {
    return { status: 'not_configured' as const };
  }

  async refundPayment(_request: RefundRequest) {
    return { status: 'not_configured' as const };
  }
}

class StripePaymentProvider implements PaymentProvider {
  readonly id = 'stripe' as const;
  private readonly secret = process.env.PAYMENT_PROVIDER_SECRET || '';
  private readonly apiBase = process.env.STRIPE_API_BASE_URL || 'https://api.stripe.com';

  private async request(path: string, body: URLSearchParams, idempotencyKey?: string) {
    const response = await fetch(`${this.apiBase}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {})
      },
      body
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`STRIPE_API_${response.status}:${payload?.error?.message || 'REQUEST_FAILED'}`);
    return payload as { id?: string; url?: string; customer?: string; subscription?: string };
  }

  async createPayment(request: PaymentRequest) {
    const body = new URLSearchParams({
      mode: 'payment',
      'line_items[0][price_data][currency]': request.currency.toLowerCase(),
      'line_items[0][price_data][product_data][name]': request.description || `RUDA order ${request.orderId}`,
      'line_items[0][price_data][unit_amount]': String(Math.round(request.amount * 100)),
      'line_items[0][quantity]': '1',
      'metadata[orderId]': request.orderId,
      ...(request.successUrl ? { success_url: request.successUrl } : {}),
      ...(request.cancelUrl ? { cancel_url: request.cancelUrl } : {})
    });
    const session = await this.request('/v1/checkout/sessions', body);
    return { status: 'pending' as const, providerReference: session.id, checkoutUrl: session.url };
  }

  async createSubscriptionCheckout(request: SubscriptionCheckoutRequest) {
    const status = getPaymentIntegrationStatus();
    const testCheckoutEnabled = status.billingMode === 'test'
      && status.stripeTestMode
      && status.billingTestPurchasesEnabled;
    const liveCheckoutEnabled = status.billingMode === 'live'
      && status.stripeLiveMode
      && status.billingLivePurchasesEnabled;
    if (!status.supportsSubscriptions || (!testCheckoutEnabled && !liveCheckoutEnabled)) {
      throw new Error('STRIPE_BILLING_MODE_NOT_ENABLED');
    }
    if (!request.automaticTax || request.currency.toUpperCase() !== 'EUR'
      || request.interval !== 'month'
      || !Number.isSafeInteger(request.amountMinor)
      || request.amountMinor <= 0) {
      throw new Error('STRIPE_SUBSCRIPTION_CHECKOUT_INPUT_INVALID');
    }
    const metadata: Record<string, string> = {
      billingId: request.billingId,
      merchantId: request.merchantId,
      planId: request.planId
    };
    const body = new URLSearchParams({
      mode: 'subscription',
      customer_email: request.customerEmail,
      client_reference_id: request.billingId,
      'line_items[0][price_data][currency]': request.currency.toLowerCase(),
      'line_items[0][price_data][product_data][name]': `RUDA ModaUI ${request.planName}`,
      'line_items[0][price_data][unit_amount]': String(request.amountMinor),
      'line_items[0][price_data][recurring][interval]': request.interval,
      'line_items[0][quantity]': '1',
      'billing_address_collection': 'required',
      'tax_id_collection[enabled]': 'true',
      'subscription_data[metadata][billingId]': metadata.billingId,
      'subscription_data[metadata][merchantId]': metadata.merchantId,
      'subscription_data[metadata][planId]': metadata.planId,
      success_url: request.successUrl,
      cancel_url: request.cancelUrl,
      ...(request.automaticTax ? { 'automatic_tax[enabled]': 'true' } : {}),
      ...Object.fromEntries(Object.entries(metadata).map(([key, value]) => [`metadata[${key}]`, value]))
    });
    const session = await this.request('/v1/checkout/sessions', body, request.idempotencyKey);
    if (!session.id || !session.url) throw new Error('STRIPE_SUBSCRIPTION_CHECKOUT_RESPONSE_INVALID');
    return { status: 'pending' as const, providerReference: session.id, checkoutUrl: session.url };
  }

  async setSubscriptionCancelAtPeriodEnd(providerSubscriptionId: string, cancel: boolean) {
    if (!providerSubscriptionId || providerSubscriptionId.length > 160) {
      throw new Error('STRIPE_SUBSCRIPTION_REFERENCE_INVALID');
    }
    await this.request(
      `/v1/subscriptions/${encodeURIComponent(providerSubscriptionId)}`,
      new URLSearchParams({ cancel_at_period_end: String(cancel) })
    );
    return { status: 'pending' as const };
  }

  async refundPayment(request: RefundRequest) {
    if (!request.providerPaymentId) throw new Error('STRIPE_PAYMENT_REFERENCE_REQUIRED');
    const refund = await this.request('/v1/refunds', new URLSearchParams({
      payment_intent: request.providerPaymentId,
      amount: String(Math.round(request.amount * 100)),
      ...(request.reason ? { 'metadata[reason]': request.reason } : {})
    }), request.idempotencyKey);
    return { status: 'pending' as const, providerReference: refund.id };
  }
}

export function createPaymentProvider(): PaymentProvider {
  const status = getPaymentIntegrationStatus();
  if (status.provider === 'stripe' && status.enabled && status.credentialsConfigured) return new StripePaymentProvider();
  return new PlaceholderPaymentProvider();
}

export const paymentProvider: PaymentProvider = {
  get id() {
    return createPaymentProvider().id;
  },
  createPayment: request => createPaymentProvider().createPayment(request),
  createSubscriptionCheckout: request => createPaymentProvider().createSubscriptionCheckout(request),
  setSubscriptionCancelAtPeriodEnd: (providerSubscriptionId, cancel) =>
    createPaymentProvider().setSubscriptionCancelAtPeriodEnd(providerSubscriptionId, cancel),
  refundPayment: request => createPaymentProvider().refundPayment(request)
};

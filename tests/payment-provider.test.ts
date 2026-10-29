import { createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createPaymentProvider, PlaceholderPaymentProvider, getPaymentIntegrationStatus } from '../src/payment/provider';
import { isPosPaymentMethod, posPaymentMethods, requiresPosPaymentConfirmation } from '../src/utils/posPaymentMethods';
import { capturePayPalCheckout, createPayPalCheckout, validatePayPalCredentials } from '../src/payment/paypal';
import { createMerchantStripeCheckout, retrieveMerchantStripeCheckout, validateMerchantStripeKey } from '../src/payment/merchantStripe';
import { verifyStripeWebhookSignature } from '../src/payment/webhookSignature';

test('Stripe webhook verification accepts any valid v1 signature during secret rotation', () => {
  const payload = '{"type":"payment_intent.succeeded"}';
  const timestamp = 1_800_000_000;
  const secret = 'whsec_test_secret';
  const signature = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');

  assert.equal(
    verifyStripeWebhookSignature(payload, `t=${timestamp},v1=${'0'.repeat(64)},v1=${signature}`, secret, timestamp),
    true
  );
  assert.equal(verifyStripeWebhookSignature(payload, `t=${timestamp},v1=${'0'.repeat(64)}`, secret, timestamp), false);
});

test('Stripe webhook verification rejects malformed and stale signatures without throwing', () => {
  const payload = '{}';
  const timestamp = 1_800_000_000;
  const secret = 'whsec_test_secret';
  const signature = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');

  assert.equal(verifyStripeWebhookSignature(payload, `t=${timestamp - 301},v1=${signature}`, secret, timestamp), false);
  assert.equal(verifyStripeWebhookSignature(payload, `t=${timestamp},v1=not-hex`, secret, timestamp), false);
  assert.equal(verifyStripeWebhookSignature(payload, `t=${timestamp},v1=${'0'.repeat(63)}g`, secret, timestamp), false);
  assert.equal(verifyStripeWebhookSignature(payload, `t=${timestamp},v1=${signature}`, '', timestamp), false);
});

test('payment integration stays disabled until provider and server secret are configured', () => {
  const previous = {
    provider: process.env.PAYMENT_PROVIDER,
    enabled: process.env.PAYMENT_ENABLED,
    secret: process.env.PAYMENT_PROVIDER_SECRET
  };

  delete process.env.PAYMENT_PROVIDER;
  delete process.env.PAYMENT_ENABLED;
  delete process.env.PAYMENT_PROVIDER_SECRET;

  const status = getPaymentIntegrationStatus();
  assert.equal(status.provider, 'manual');
  assert.equal(status.enabled, false);
  assert.equal(status.credentialsConfigured, false);
  assert.equal(status.mode, 'placeholder');

  if (previous.provider === undefined) delete process.env.PAYMENT_PROVIDER;
  else process.env.PAYMENT_PROVIDER = previous.provider;
  if (previous.enabled === undefined) delete process.env.PAYMENT_ENABLED;
  else process.env.PAYMENT_ENABLED = previous.enabled;
  if (previous.secret === undefined) delete process.env.PAYMENT_PROVIDER_SECRET;
  else process.env.PAYMENT_PROVIDER_SECRET = previous.secret;
});

test('only the implemented Stripe provider enables real payment flows', () => {
  const previous = {
    provider: process.env.PAYMENT_PROVIDER,
    enabled: process.env.PAYMENT_ENABLED,
    secret: process.env.PAYMENT_PROVIDER_SECRET,
    apiBase: process.env.STRIPE_API_BASE_URL,
    billingMode: process.env.MODAGPT_BILLING_MODE,
    testPurchases: process.env.MODAGPT_BILLING_TEST_PURCHASES_ENABLED,
    livePurchases: process.env.MODAGPT_BILLING_LIVE_PURCHASES_ENABLED,
    webhookSecret: process.env.PAYMENT_WEBHOOK_SECRET,
    liveWebhookSecret: process.env.MODAGPT_BILLING_STRIPE_WEBHOOK_SECRET
  };

  try {
    delete process.env.STRIPE_API_BASE_URL;
    delete process.env.MODAGPT_BILLING_MODE;
    delete process.env.MODAGPT_BILLING_TEST_PURCHASES_ENABLED;
    delete process.env.MODAGPT_BILLING_LIVE_PURCHASES_ENABLED;
    delete process.env.PAYMENT_WEBHOOK_SECRET;
    delete process.env.MODAGPT_BILLING_STRIPE_WEBHOOK_SECRET;
    process.env.PAYMENT_PROVIDER = 'adyen';
    process.env.PAYMENT_ENABLED = 'true';
    process.env.PAYMENT_PROVIDER_SECRET = 'configured-secret';
    assert.equal(getPaymentIntegrationStatus().supportsPayments, false);

    process.env.PAYMENT_PROVIDER = 'stripe';
    assert.equal(getPaymentIntegrationStatus().supportsPayments, true);
    assert.equal(getPaymentIntegrationStatus().supportsSubscriptions, false);
    process.env.PAYMENT_PROVIDER_SECRET = 'sk_test_configured123';
    assert.equal(getPaymentIntegrationStatus().supportsSubscriptions, true);
    assert.equal(getPaymentIntegrationStatus().stripeTestMode, true);
    assert.equal(getPaymentIntegrationStatus().billingTestPurchasesEnabled, false);
    process.env.MODAGPT_BILLING_TEST_PURCHASES_ENABLED = 'true';
    assert.equal(getPaymentIntegrationStatus().billingTestPurchasesEnabled, true);
    process.env.PAYMENT_PROVIDER_SECRET = 'sk_live_configured123';
    assert.equal(getPaymentIntegrationStatus().supportsSubscriptions, false);
    assert.equal(getPaymentIntegrationStatus().stripeTestMode, false);
    assert.equal(getPaymentIntegrationStatus().billingTestPurchasesEnabled, false);

    process.env.MODAGPT_BILLING_MODE = 'live';
    assert.equal(getPaymentIntegrationStatus().supportsSubscriptions, true);
    assert.equal(getPaymentIntegrationStatus().stripeLiveMode, true);
    assert.equal(getPaymentIntegrationStatus().billingLivePurchasesEnabled, false);
    process.env.MODAGPT_BILLING_LIVE_PURCHASES_ENABLED = 'true';
    assert.equal(getPaymentIntegrationStatus().billingLivePurchasesEnabled, true);
    process.env.PAYMENT_WEBHOOK_SECRET = 'whsec_shared_test';
    assert.equal(getPaymentIntegrationStatus().webhookConfigured, false);
    process.env.MODAGPT_BILLING_STRIPE_WEBHOOK_SECRET = 'whsec_live_specific';
    assert.equal(getPaymentIntegrationStatus().webhookConfigured, true);
    process.env.MODAGPT_BILLING_MODE = 'invalid';
    assert.equal(getPaymentIntegrationStatus().supportsSubscriptions, false);
  } finally {
    if (previous.provider === undefined) delete process.env.PAYMENT_PROVIDER;
    else process.env.PAYMENT_PROVIDER = previous.provider;
    if (previous.enabled === undefined) delete process.env.PAYMENT_ENABLED;
    else process.env.PAYMENT_ENABLED = previous.enabled;
    if (previous.secret === undefined) delete process.env.PAYMENT_PROVIDER_SECRET;
    else process.env.PAYMENT_PROVIDER_SECRET = previous.secret;
    if (previous.apiBase === undefined) delete process.env.STRIPE_API_BASE_URL;
    else process.env.STRIPE_API_BASE_URL = previous.apiBase;
    if (previous.billingMode === undefined) delete process.env.MODAGPT_BILLING_MODE;
    else process.env.MODAGPT_BILLING_MODE = previous.billingMode;
    if (previous.testPurchases === undefined) delete process.env.MODAGPT_BILLING_TEST_PURCHASES_ENABLED;
    else process.env.MODAGPT_BILLING_TEST_PURCHASES_ENABLED = previous.testPurchases;
    if (previous.livePurchases === undefined) delete process.env.MODAGPT_BILLING_LIVE_PURCHASES_ENABLED;
    else process.env.MODAGPT_BILLING_LIVE_PURCHASES_ENABLED = previous.livePurchases;
    if (previous.webhookSecret === undefined) delete process.env.PAYMENT_WEBHOOK_SECRET;
    else process.env.PAYMENT_WEBHOOK_SECRET = previous.webhookSecret;
    if (previous.liveWebhookSecret === undefined) delete process.env.MODAGPT_BILLING_STRIPE_WEBHOOK_SECRET;
    else process.env.MODAGPT_BILLING_STRIPE_WEBHOOK_SECRET = previous.liveWebhookSecret;
  }
});

test('Stripe Checkout uses supplied success and cancel URLs', async () => {
  const previous = {
    provider: process.env.PAYMENT_PROVIDER,
    enabled: process.env.PAYMENT_ENABLED,
    secret: process.env.PAYMENT_PROVIDER_SECRET
  };
  const previousFetch = globalThis.fetch;
  let requestBody = '';
  try {
    process.env.PAYMENT_PROVIDER = 'stripe';
    process.env.PAYMENT_ENABLED = 'true';
    process.env.PAYMENT_PROVIDER_SECRET = 'configured-secret';
    globalThis.fetch = async (_input, init) => {
      requestBody = String(init?.body || '');
      return new Response(JSON.stringify({ id: 'cs_test_1', url: 'https://checkout.example/session' }), { status: 200 });
    };

    const result = await createPaymentProvider().createPayment({
      orderId: 'order-1',
      amount: 75,
      currency: 'EUR',
      successUrl: 'https://shop.example/success',
      cancelUrl: 'https://shop.example/cancel'
    });
    const body = new URLSearchParams(requestBody);
    assert.equal(result.checkoutUrl, 'https://checkout.example/session');
    assert.equal(body.get('success_url'), 'https://shop.example/success');
    assert.equal(body.get('cancel_url'), 'https://shop.example/cancel');
  } finally {
    globalThis.fetch = previousFetch;
    if (previous.provider === undefined) delete process.env.PAYMENT_PROVIDER;
    else process.env.PAYMENT_PROVIDER = previous.provider;
    if (previous.enabled === undefined) delete process.env.PAYMENT_ENABLED;
    else process.env.PAYMENT_ENABLED = previous.enabled;
    if (previous.secret === undefined) delete process.env.PAYMENT_PROVIDER_SECRET;
    else process.env.PAYMENT_PROVIDER_SECRET = previous.secret;
  }
});

test('Stripe subscription checkout uses recurring EUR price, tax collection, metadata, and idempotency', async () => {
  const previous = {
    provider: process.env.PAYMENT_PROVIDER,
    enabled: process.env.PAYMENT_ENABLED,
    secret: process.env.PAYMENT_PROVIDER_SECRET,
    apiBase: process.env.STRIPE_API_BASE_URL,
    billingMode: process.env.MODAGPT_BILLING_MODE,
    testPurchases: process.env.MODAGPT_BILLING_TEST_PURCHASES_ENABLED
  };
  const previousFetch = globalThis.fetch;
  let requestBody = '';
  let requestHeaders: HeadersInit | undefined;
  try {
    process.env.PAYMENT_PROVIDER = 'stripe';
    process.env.PAYMENT_ENABLED = 'true';
    process.env.PAYMENT_PROVIDER_SECRET = 'sk_test_configured123';
    process.env.MODAGPT_BILLING_MODE = 'test';
    process.env.MODAGPT_BILLING_TEST_PURCHASES_ENABLED = 'true';
    delete process.env.STRIPE_API_BASE_URL;
    globalThis.fetch = async (_input, init) => {
      requestBody = String(init?.body || '');
      requestHeaders = init?.headers;
      return new Response(JSON.stringify({ id: 'cs_subscription_1', url: 'https://checkout.example/subscription' }), { status: 200 });
    };
    const result = await createPaymentProvider().createSubscriptionCheckout({
      billingId: 'billing-payment-1',
      merchantId: 'merchant-1',
      customerEmail: 'billing@example.test',
      planId: 'BUSINESS',
      planName: 'Business',
      amountMinor: 9900,
      currency: 'EUR',
      interval: 'month',
      successUrl: 'https://shop.example/?billing=success',
      cancelUrl: 'https://shop.example/?billing=cancelled',
      idempotencyKey: 'checkout-idempotency-1',
      automaticTax: true
    });
    const body = new URLSearchParams(requestBody);
    assert.equal(result.status, 'pending');
    assert.equal(result.checkoutUrl, 'https://checkout.example/subscription');
    assert.equal(body.get('mode'), 'subscription');
    assert.equal(body.get('line_items[0][price_data][currency]'), 'eur');
    assert.equal(body.get('line_items[0][price_data][unit_amount]'), '9900');
    assert.equal(body.get('line_items[0][price_data][recurring][interval]'), 'month');
    assert.equal(body.get('automatic_tax[enabled]'), 'true');
    assert.equal(body.get('tax_id_collection[enabled]'), 'true');
    assert.equal(body.get('subscription_data[metadata][merchantId]'), 'merchant-1');
    assert.equal(new Headers(requestHeaders).get('Idempotency-Key'), 'checkout-idempotency-1');
  } finally {
    globalThis.fetch = previousFetch;
    if (previous.provider === undefined) delete process.env.PAYMENT_PROVIDER;
    else process.env.PAYMENT_PROVIDER = previous.provider;
    if (previous.enabled === undefined) delete process.env.PAYMENT_ENABLED;
    else process.env.PAYMENT_ENABLED = previous.enabled;
    if (previous.secret === undefined) delete process.env.PAYMENT_PROVIDER_SECRET;
    else process.env.PAYMENT_PROVIDER_SECRET = previous.secret;
    if (previous.apiBase === undefined) delete process.env.STRIPE_API_BASE_URL;
    else process.env.STRIPE_API_BASE_URL = previous.apiBase;
    if (previous.billingMode === undefined) delete process.env.MODAGPT_BILLING_MODE;
    else process.env.MODAGPT_BILLING_MODE = previous.billingMode;
    if (previous.testPurchases === undefined) delete process.env.MODAGPT_BILLING_TEST_PURCHASES_ENABLED;
    else process.env.MODAGPT_BILLING_TEST_PURCHASES_ENABLED = previous.testPurchases;
  }
});

test('Stripe Billing rejects mode mismatches and non-Stripe API hosts', async () => {
  const previous = {
    provider: process.env.PAYMENT_PROVIDER,
    enabled: process.env.PAYMENT_ENABLED,
    secret: process.env.PAYMENT_PROVIDER_SECRET,
    apiBase: process.env.STRIPE_API_BASE_URL,
    billingMode: process.env.MODAGPT_BILLING_MODE
  };
  try {
    process.env.PAYMENT_PROVIDER = 'stripe';
    process.env.PAYMENT_ENABLED = 'true';
    process.env.MODAGPT_BILLING_MODE = 'test';
    process.env.PAYMENT_PROVIDER_SECRET = 'sk_live_configured123';
    delete process.env.STRIPE_API_BASE_URL;
    assert.equal(getPaymentIntegrationStatus().supportsSubscriptions, false);
    await assert.rejects(
      createPaymentProvider().createSubscriptionCheckout({
        billingId: 'billing-payment-1',
        merchantId: 'merchant-1',
        customerEmail: 'billing@example.test',
        planId: 'BUSINESS',
        planName: 'Business',
        amountMinor: 9900,
        currency: 'EUR',
        interval: 'month',
        successUrl: 'https://shop.example/?billing=success',
        cancelUrl: 'https://shop.example/?billing=cancelled',
        idempotencyKey: 'checkout-idempotency-1',
        automaticTax: true
      }),
      /STRIPE_BILLING_MODE_NOT_ENABLED/
    );

    process.env.PAYMENT_PROVIDER_SECRET = 'sk_test_configured123';
    process.env.STRIPE_API_BASE_URL = 'https://attacker.example';
    assert.equal(getPaymentIntegrationStatus().supportsSubscriptions, false);
  } finally {
    if (previous.provider === undefined) delete process.env.PAYMENT_PROVIDER;
    else process.env.PAYMENT_PROVIDER = previous.provider;
    if (previous.enabled === undefined) delete process.env.PAYMENT_ENABLED;
    else process.env.PAYMENT_ENABLED = previous.enabled;
    if (previous.secret === undefined) delete process.env.PAYMENT_PROVIDER_SECRET;
    else process.env.PAYMENT_PROVIDER_SECRET = previous.secret;
    if (previous.apiBase === undefined) delete process.env.STRIPE_API_BASE_URL;
    else process.env.STRIPE_API_BASE_URL = previous.apiBase;
    if (previous.billingMode === undefined) delete process.env.MODAGPT_BILLING_MODE;
    else process.env.MODAGPT_BILLING_MODE = previous.billingMode;
  }
});

test('Stripe Live subscription checkout requires explicit live mode and sends recurring EUR checkout', async () => {
  const previous = {
    provider: process.env.PAYMENT_PROVIDER,
    enabled: process.env.PAYMENT_ENABLED,
    secret: process.env.PAYMENT_PROVIDER_SECRET,
    apiBase: process.env.STRIPE_API_BASE_URL,
    billingMode: process.env.MODAGPT_BILLING_MODE,
    livePurchases: process.env.MODAGPT_BILLING_LIVE_PURCHASES_ENABLED,
    webhookSecret: process.env.MODAGPT_BILLING_STRIPE_WEBHOOK_SECRET,
    automaticTax: process.env.BILLING_STRIPE_AUTOMATIC_TAX
  };
  const previousFetch = globalThis.fetch;
  let requestBody = '';
  try {
    process.env.PAYMENT_PROVIDER = 'stripe';
    process.env.PAYMENT_ENABLED = 'true';
    process.env.PAYMENT_PROVIDER_SECRET = 'sk_live_configured123';
    process.env.MODAGPT_BILLING_MODE = 'live';
    process.env.MODAGPT_BILLING_LIVE_PURCHASES_ENABLED = 'true';
    process.env.MODAGPT_BILLING_STRIPE_WEBHOOK_SECRET = 'whsec_live_configured';
    process.env.BILLING_STRIPE_AUTOMATIC_TAX = 'true';
    delete process.env.STRIPE_API_BASE_URL;
    assert.equal(getPaymentIntegrationStatus().supportsSubscriptions, true);
    assert.equal(getPaymentIntegrationStatus().webhookConfigured, true);
    globalThis.fetch = async (_input, init) => {
      requestBody = String(init?.body || '');
      return new Response(JSON.stringify({ id: 'cs_live_1', url: 'https://checkout.example/live' }), { status: 200 });
    };

    const result = await createPaymentProvider().createSubscriptionCheckout({
      billingId: 'billing-live-1',
      merchantId: 'merchant-1',
      customerEmail: 'billing@example.test',
      planId: 'BUSINESS',
      planName: 'Business',
      amountMinor: 9900,
      currency: 'EUR',
      interval: 'month',
      successUrl: 'https://shop.example/?billing=success',
      cancelUrl: 'https://shop.example/?billing=cancelled',
      idempotencyKey: 'checkout-live-idempotency',
      automaticTax: true
    });
    assert.equal(result.status, 'pending');
    assert.equal(result.providerReference, 'cs_live_1');
    assert.equal(new URLSearchParams(requestBody).get('mode'), 'subscription');
  } finally {
    globalThis.fetch = previousFetch;
    if (previous.provider === undefined) delete process.env.PAYMENT_PROVIDER;
    else process.env.PAYMENT_PROVIDER = previous.provider;
    if (previous.enabled === undefined) delete process.env.PAYMENT_ENABLED;
    else process.env.PAYMENT_ENABLED = previous.enabled;
    if (previous.secret === undefined) delete process.env.PAYMENT_PROVIDER_SECRET;
    else process.env.PAYMENT_PROVIDER_SECRET = previous.secret;
    if (previous.apiBase === undefined) delete process.env.STRIPE_API_BASE_URL;
    else process.env.STRIPE_API_BASE_URL = previous.apiBase;
    if (previous.billingMode === undefined) delete process.env.MODAGPT_BILLING_MODE;
    else process.env.MODAGPT_BILLING_MODE = previous.billingMode;
    if (previous.livePurchases === undefined) delete process.env.MODAGPT_BILLING_LIVE_PURCHASES_ENABLED;
    else process.env.MODAGPT_BILLING_LIVE_PURCHASES_ENABLED = previous.livePurchases;
    if (previous.webhookSecret === undefined) delete process.env.MODAGPT_BILLING_STRIPE_WEBHOOK_SECRET;
    else process.env.MODAGPT_BILLING_STRIPE_WEBHOOK_SECRET = previous.webhookSecret;
    if (previous.automaticTax === undefined) delete process.env.BILLING_STRIPE_AUTOMATIC_TAX;
    else process.env.BILLING_STRIPE_AUTOMATIC_TAX = previous.automaticTax;
  }
});

test('Stripe refunds reuse the persisted idempotency key on provider retries', async () => {
  const previous = {
    provider: process.env.PAYMENT_PROVIDER,
    enabled: process.env.PAYMENT_ENABLED,
    secret: process.env.PAYMENT_PROVIDER_SECRET
  };
  const previousFetch = globalThis.fetch;
  let requestHeaders: HeadersInit | undefined;
  try {
    process.env.PAYMENT_PROVIDER = 'stripe';
    process.env.PAYMENT_ENABLED = 'true';
    process.env.PAYMENT_PROVIDER_SECRET = 'configured-secret';
    globalThis.fetch = async (_input, init) => {
      requestHeaders = init?.headers;
      return new Response(JSON.stringify({ id: 're_test_1' }), { status: 200 });
    };
    const result = await createPaymentProvider().refundPayment({
      orderId: 'order-1',
      amount: 15,
      currency: 'EUR',
      providerPaymentId: 'pi_test_1',
      idempotencyKey: 'refund:return-1'
    });
    assert.equal(result.providerReference, 're_test_1');
    assert.equal(new Headers(requestHeaders).get('Idempotency-Key'), 'refund:return-1');
  } finally {
    globalThis.fetch = previousFetch;
    if (previous.provider === undefined) delete process.env.PAYMENT_PROVIDER;
    else process.env.PAYMENT_PROVIDER = previous.provider;
    if (previous.enabled === undefined) delete process.env.PAYMENT_ENABLED;
    else process.env.PAYMENT_ENABLED = previous.enabled;
    if (previous.secret === undefined) delete process.env.PAYMENT_PROVIDER_SECRET;
    else process.env.PAYMENT_PROVIDER_SECRET = previous.secret;
  }
});

test('placeholder provider never pretends to charge or refund', async () => {
  const provider = new PlaceholderPaymentProvider();
  assert.deepEqual(await provider.createPayment({ orderId: 'order-1', amount: 10, currency: 'EUR' }), {
    status: 'not_configured'
  });
  assert.deepEqual(await provider.refundPayment({ orderId: 'order-1', amount: 10, currency: 'EUR' }), {
    status: 'not_configured'
  });
});

test('POS records AliPay, WeChat Pay, card, and IBAN transfer distinctly', () => {
  assert.deepEqual(posPaymentMethods, ['cash', 'alipay', 'wechat_pay', 'credit_card', 'bank_transfer', 'net_30']);
  for (const method of ['alipay', 'wechat_pay', 'credit_card']) {
    assert.equal(isPosPaymentMethod(method), true);
    assert.equal(requiresPosPaymentConfirmation(method), true);
  }
  assert.equal(isPosPaymentMethod('bank_transfer'), true);
  assert.equal(requiresPosPaymentConfirmation('bank_transfer'), false);
  assert.equal(isPosPaymentMethod('paypal'), false);
});

test('PayPal credentials validate against the selected environment and reject invalid credentials', async () => {
  const previousFetch = globalThis.fetch;
  let requestedUrl = '';
  try {
    globalThis.fetch = async input => {
      requestedUrl = String(input);
      return new Response(JSON.stringify({ access_token: 'access-token' }), { status: 200 });
    };
    await validatePayPalCredentials({ clientId: 'client-id-123', clientSecret: 'secret-123456', environment: 'live' });
    assert.equal(requestedUrl, 'https://api-m.paypal.com/v1/oauth2/token');

    globalThis.fetch = async () => new Response(JSON.stringify({ error: 'invalid_client' }), { status: 401 });
    await assert.rejects(
      validatePayPalCredentials({ clientId: 'wrong-id-123', clientSecret: 'wrong-secret', environment: 'sandbox' }),
      { message: 'PAYPAL_CREDENTIALS_INVALID' }
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('PayPal checkout and capture preserve amount, currency, and request idempotency', async () => {
  const previousFetch = globalThis.fetch;
  const requested: Array<{ url: string; init?: RequestInit }> = [];
  try {
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      requested.push({ url, init });
      if (url.endsWith('/v1/oauth2/token')) {
        return new Response(JSON.stringify({ access_token: 'access-token' }), { status: 200 });
      }
      if (url.endsWith('/v2/checkout/orders')) {
        return new Response(JSON.stringify({
          id: 'paypal-order-1',
          links: [{ rel: 'approve', href: 'https://www.paypal.com/checkout/pay?token=paypal-order-1' }]
        }), { status: 201 });
      }
      return new Response(JSON.stringify({
        status: 'COMPLETED',
        purchase_units: [{ payments: { captures: [{
          id: 'capture-1',
          status: 'COMPLETED',
          amount: { value: '125.50', currency_code: 'EUR' }
        }] } }]
      }), { status: 201 });
    };
    const credentials = { clientId: 'client-id-123', clientSecret: 'secret-123456', environment: 'sandbox' as const };
    const checkout = await createPayPalCheckout(credentials, {
      amount: 125.5,
      currency: 'EUR',
      reference: 'order-1',
      description: 'RUDA order order-1',
      returnUrl: 'https://shop.example/return',
      cancelUrl: 'https://shop.example/cancel'
    });
    assert.deepEqual(checkout, {
      orderId: 'paypal-order-1',
      approvalUrl: 'https://www.paypal.com/checkout/pay?token=paypal-order-1'
    });
    const createBody = JSON.parse(String(requested[1].init?.body));
    assert.equal(createBody.purchase_units[0].amount.value, '125.50');
    assert.equal(createBody.purchase_units[0].amount.currency_code, 'EUR');
    assert.equal(createBody.application_context.return_url, 'https://shop.example/return');

    const capture = await capturePayPalCheckout(credentials, 'paypal-order-1', 'ruda-capture-key');
    assert.deepEqual(capture, { status: 'COMPLETED', captureId: 'capture-1', amount: 125.5, currency: 'EUR' });
    const captureRequest = requested.find(request => request.url.endsWith('/capture'));
    assert.equal(new Headers(captureRequest?.init?.headers).get('PayPal-Request-Id'), 'ruda-capture-key');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('merchant Stripe keys are validated and checkout is created directly on that account', async () => {
  const previousFetch = globalThis.fetch;
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  try {
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      requests.push({ url, init });
      if (url.endsWith('/v1/account')) {
        return new Response(JSON.stringify({ id: 'acct_merchant_1', livemode: false }), { status: 200 });
      }
      if (url.endsWith('/v1/checkout/sessions')) {
        return new Response(JSON.stringify({ id: 'cs_test_merchant_1', url: 'https://checkout.stripe.com/c/pay/cs_test_merchant_1' }), { status: 200 });
      }
      return new Response(JSON.stringify({
        id: 'cs_test_merchant_1',
        status: 'complete',
        payment_status: 'paid',
        amount_total: 7499,
        currency: 'eur',
        payment_intent: { id: 'pi_merchant_1' }
      }), { status: 200 });
    };
    const account = await validateMerchantStripeKey('sk_test_merchantsecret123456');
    assert.deepEqual(account, { accountId: 'acct_merchant_1', livemode: false });
    assert.equal(requests[0].url, 'https://api.stripe.com/v1/account');
    assert.equal(new Headers(requests[0].init?.headers).get('Authorization'), 'Bearer sk_test_merchantsecret123456');

    const credentials = { secretKey: 'sk_test_merchantsecret123456', ...account };
    const checkout = await createMerchantStripeCheckout(credentials, {
      amount: 74.99,
      currency: 'EUR',
      reference: '#ORDER-1',
      description: 'RUDA order #ORDER-1',
      successUrl: 'https://shop.example/account?stripe=return&session_id={CHECKOUT_SESSION_ID}',
      cancelUrl: 'https://shop.example/account?stripe=cancelled'
    }, 'ruda-test-idempotency');
    assert.equal(checkout.sessionId, 'cs_test_merchant_1');
    assert.equal(checkout.checkoutUrl, 'https://checkout.stripe.com/c/pay/cs_test_merchant_1');
    const checkoutRequest = requests[1];
    assert.equal(new Headers(checkoutRequest.init?.headers).get('Idempotency-Key'), 'ruda-test-idempotency');
    const body = new URLSearchParams(String(checkoutRequest.init?.body));
    assert.equal(body.get('line_items[0][price_data][unit_amount]'), '7499');
    assert.equal(body.get('success_url'), 'https://shop.example/account?stripe=return&session_id={CHECKOUT_SESSION_ID}');

    const status = await retrieveMerchantStripeCheckout(credentials, checkout.sessionId);
    assert.deepEqual(status, {
      sessionId: 'cs_test_merchant_1',
      status: 'complete',
      paymentStatus: 'paid',
      amount: 74.99,
      currency: 'eur',
      paymentIntentId: 'pi_merchant_1'
    });
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('merchant Stripe rejects publishable keys and test/live key mismatches', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ id: 'acct_test', livemode: false }), { status: 200 });
  try {
    await assert.rejects(validateMerchantStripeKey('pk_test_publishable-key'), { message: 'STRIPE_CREDENTIALS_INVALID' });
    await assert.rejects(validateMerchantStripeKey('sk_live_secretkey123456'), { message: 'STRIPE_KEY_MODE_MISMATCH' });
  } finally {
    globalThis.fetch = previousFetch;
  }
});

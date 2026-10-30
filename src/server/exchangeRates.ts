export const exchangeRateCurrencies = ['EUR', 'USD', 'CNY', 'GBP', 'JPY', 'CHF'] as const;

export type ExchangeRateCurrency = (typeof exchangeRateCurrencies)[number];

export type LatestExchangeRates = {
  base: 'EUR';
  rates: Record<ExchangeRateCurrency, number>;
  rateDate: string;
  updatedAt: string;
  source: 'Frankfurter';
};

const MAX_RATE_AGE_MS = 7 * 24 * 60 * 60 * 1_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export async function fetchLatestExchangeRates(input: {
  signal?: AbortSignal;
  now?: Date;
} = {}): Promise<LatestExchangeRates> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('EXCHANGE_RATES_TIMEOUT')), 5_000);
  const abortFromCaller = () => controller.abort(input.signal?.reason);
  if (input.signal?.aborted) abortFromCaller();
  else input.signal?.addEventListener('abort', abortFromCaller, { once: true });

  try {
    const response = await fetch(
      'https://api.frankfurter.app/latest?from=EUR&to=USD,CNY,GBP,JPY,CHF',
      { signal: controller.signal }
    );
    if (!response.ok) throw new Error(`EXCHANGE_RATES_PROVIDER_${response.status}`);

    const payload: unknown = await response.json();
    if (!isRecord(payload) || payload.base !== 'EUR' || typeof payload.date !== 'string'
      || !/^\d{4}-\d{2}-\d{2}$/.test(payload.date)
      || !isRecord(payload.rates)) {
      throw new Error('EXCHANGE_RATES_INVALID_RESPONSE');
    }

    const rateDate = payload.date;
    const asOf = new Date(`${rateDate}T00:00:00.000Z`);
    if (Number.isNaN(asOf.getTime()) || asOf.toISOString().slice(0, 10) !== rateDate) {
      throw new Error('EXCHANGE_RATES_INVALID_RESPONSE');
    }
    const ageMs = (input.now || new Date()).getTime() - asOf.getTime();
    if (ageMs < -24 * 60 * 60 * 1_000 || ageMs > MAX_RATE_AGE_MS) {
      throw new Error('EXCHANGE_RATES_STALE');
    }

    const rates: Record<ExchangeRateCurrency, number> = {
      EUR: 1,
      USD: 0,
      CNY: 0,
      GBP: 0,
      JPY: 0,
      CHF: 0
    };
    for (const currency of exchangeRateCurrencies) {
      if (currency === 'EUR') continue;
      const rate = payload.rates[currency];
      if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
        throw new Error('EXCHANGE_RATES_INVALID_RESPONSE');
      }
      rates[currency] = rate;
    }

    return {
      base: 'EUR',
      rates,
      rateDate,
      updatedAt: asOf.toISOString(),
      source: 'Frankfurter'
    };
  } finally {
    clearTimeout(timeout);
    input.signal?.removeEventListener('abort', abortFromCaller);
  }
}

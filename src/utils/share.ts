import { parseLocalizedPath } from '../shared/seo';
import { merchantStorefrontUrl } from '../shared/merchantStoreUrl';

export type SharePayload = {
  title: string;
  text: string;
  path?: string;
  source?: string;
};

export type StoredPartnerReferral = {
  partnerCode: string;
  campaignCode: string;
  visitorKey: string;
  landingPath: string;
  capturedAt: string;
  clickId?: string;
};

const partnerReferralKey = 'ruda_partner_referral';
const partnerVisitorKey = 'ruda_partner_visitor';

export function getStoredPartnerReferral(): StoredPartnerReferral | null {
  try {
    const stored = localStorage.getItem(partnerReferralKey);
    if (!stored) return null;
    const value = JSON.parse(stored) as Partial<StoredPartnerReferral>;
    if (!value.partnerCode || !value.visitorKey || !value.capturedAt) return null;
    return value as StoredPartnerReferral;
  } catch {
    return null;
  }
}

export function getMerchantStoreUrl(merchant: { id: string; slug?: string | null; storeSlug?: string | null }): string {
  const slug = merchant.storeSlug || merchant.slug || merchant.id;
  const language = parseLocalizedPath(window.location.pathname).language || 'it';
  return merchantStorefrontUrl(slug, language);
}

export function getProductPath(productId: string): string {
  return `/product/${encodeURIComponent(productId)}`;
}

export function buildShareUrl(path = window.location.href, source = 'ruda'): string {
  const url = new URL(path, window.location.origin);
  url.searchParams.set('utm_source', 'share');
  url.searchParams.set('utm_medium', 'web');
  url.searchParams.set('utm_campaign', 'ruda_b2b');
  url.searchParams.set('utm_content', source);
  url.searchParams.set('ref', source);
  return url.toString();
}

export function rememberReferral(): void {
  const params = new URLSearchParams(window.location.search);
  const partnerCode = params.get('ref')?.trim().toUpperCase() || '';
  if (!/^(?:AG|CITY|PARTNER)\d{6}$/.test(partnerCode)) return;

  let visitorKey = '';
  try {
    visitorKey = localStorage.getItem(partnerVisitorKey) || crypto.randomUUID();
    localStorage.setItem(partnerVisitorKey, visitorKey);
  } catch (error) {
    console.error('[partner-referral] could not persist visitor key', error);
    return;
  }

  const click: StoredPartnerReferral = {
    partnerCode,
    campaignCode: (params.get('campaign') || '').trim().slice(0, 80),
    visitorKey,
    landingPath: `${window.location.pathname}${window.location.hash}`.slice(0, 500),
    capturedAt: new Date().toISOString()
  };
  let firstTouch = getStoredPartnerReferral();
  if (!firstTouch) {
    firstTouch = click;
    try {
      localStorage.setItem(partnerReferralKey, JSON.stringify(firstTouch));
    } catch (error) {
      console.error('[partner-referral] could not persist first-touch attribution', error);
    }
  }
  void fetch('/api/partner/referral-click', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(click)
  }).then(async response => {
    const result = await response.json();
    if (!response.ok || result?.success !== true || typeof result.clickId !== 'string') {
      throw new Error(typeof result?.error === 'string' ? result.error : `REFERRAL_TRACKING_FAILED_${response.status}`);
    }
    const current = getStoredPartnerReferral();
    if (
      current?.visitorKey === visitorKey
      && current.partnerCode === click.partnerCode
      && current.campaignCode === click.campaignCode
      && current.landingPath === click.landingPath
      && !current.clickId
    ) {
      localStorage.setItem(partnerReferralKey, JSON.stringify({ ...current, clickId: result.clickId }));
    }
  }).catch(error => {
    console.error('[partner-referral] click tracking failed', error);
  });
}

export function recordShare(source = 'ruda', channel = 'native'): void {
  try {
    const key = 'ruda_share_events';
    const events = JSON.parse(localStorage.getItem(key) || '[]') as Array<Record<string, string>>;
    events.push({ source, channel, createdAt: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(events.slice(-100)));
  } catch (error) {
    console.error('[share] could not record share event', error);
  }
}

export async function shareOrCopy(
  payload: SharePayload,
  channel: 'native' | 'copy' | 'wechat' = 'native'
): Promise<'shared' | 'copied'> {
  const url = buildShareUrl(payload.path, payload.source);
  if (channel === 'native' && typeof navigator.share === 'function') {
    await navigator.share({ title: payload.title, text: payload.text, url });
    recordShare(payload.source, 'native');
    return 'shared';
  }
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(`${payload.text}\n${url}`);
    recordShare(payload.source, channel === 'native' ? 'native' : channel);
    return 'copied';
  }
  const input = document.createElement('textarea');
  input.value = `${payload.text}\n${url}`;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  let copied = false;
  try {
    input.select();
    copied = document.execCommand('copy');
  } finally {
    input.remove();
  }
  if (!copied) throw new Error('SHARE_COPY_FAILED');
  recordShare(payload.source, channel === 'native' ? 'copy' : channel);
  return 'copied';
}

import { apiPost } from '../api/client';

export type MarketingEventName =
  | 'page_view'
  | 'ai_open'
  | 'ai_question'
  | 'buyer_registration_view'
  | 'merchant_application_view';

const analyticsConsentKey = 'ruda_analytics_consent';

export function getMarketingAnalyticsConsent(): 'granted' | 'denied' | 'unknown' {
  try {
    const value = localStorage.getItem(analyticsConsentKey);
    return value === 'granted' || value === 'denied' ? value : 'unknown';
  } catch (error) {
    console.warn('[marketing-analytics-consent]', error);
    return 'unknown';
  }
}

export function hasMarketingAnalyticsConsent() {
  return getMarketingAnalyticsConsent() === 'granted';
}

export function setMarketingAnalyticsConsent(consent: 'granted' | 'denied') {
  try {
    localStorage.setItem(analyticsConsentKey, consent);
    return true;
  } catch (error) {
    console.error('[marketing-analytics-consent-save]', error);
    return false;
  }
}

export async function trackMarketingEvent(event: MarketingEventName, page: string) {
  if (!hasMarketingAnalyticsConsent()) return;
  const params = new URLSearchParams(window.location.search);
  try {
    await apiPost('/api/marketing/events', {
      event,
      consent: true,
      page,
      source: params.get('utm_source') || '',
      campaign: params.get('utm_campaign') || '',
      medium: params.get('utm_medium') || ''
    });
  } catch (error) {
    console.warn('[marketing-analytics-event]', error);
  }
}

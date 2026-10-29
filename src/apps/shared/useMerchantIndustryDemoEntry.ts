import { useEffect, useRef, useState } from 'react';
import { useB2B } from '../../context/B2BContext';
import { getMerchantIndustryDemoAccountByCode } from '../../constants/merchantIndustryDemoAccounts';

function requestedDemoCode(): string | null {
  return new URLSearchParams(window.location.search).get('industryDemo');
}

function clearRequestedDemoCode(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('industryDemo');
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

export function useMerchantIndustryDemoEntry(booted: boolean, enabled = true) {
  const { authRole, authMerchantId, loginAsMerchantDemo } = useB2B();
  const [loading, setLoading] = useState(() => Boolean(getMerchantIndustryDemoAccountByCode(requestedDemoCode())));
  const [failed, setFailed] = useState(false);
  const attemptedCode = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    if (!booted) return;

    const code = requestedDemoCode();
    const account = getMerchantIndustryDemoAccountByCode(code);
    if (!code || !account || attemptedCode.current === code) return;
    attemptedCode.current = code;

    if (authRole === 'merchant' && authMerchantId === account.merchantId) {
      clearRequestedDemoCode();
      setLoading(false);
      return;
    }

    setLoading(true);
    setFailed(false);
    void loginAsMerchantDemo(account.templateId).then(success => {
      if (success) {
        clearRequestedDemoCode();
        setFailed(false);
      } else {
        setFailed(true);
      }
      setLoading(false);
    }, () => {
      setFailed(true);
      setLoading(false);
    });
  }, [authMerchantId, authRole, booted, enabled, loginAsMerchantDemo]);

  return { loading, failed };
}

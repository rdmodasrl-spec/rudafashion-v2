import React, { useEffect, useRef, useState } from 'react';
import { useB2B } from '../../../../context/B2BContext';

declare global {
  interface Window {
    google?: any;
  }
}

interface GoogleSignInButtonProps {
  role: 'buyer' | 'merchant' | 'company' | 'customer';
  intent?: 'login' | 'register';
  industry?: string;
}

let initializedGoogleClientConfig = '';
let activeGoogleHandler: ((credential: string) => Promise<void>) | null = null;

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({ role, intent = 'login', industry }) => {
  const { loginWithGoogle, merchantLoginError, lang, localizeCopy } = useB2B();
  const isZh = lang === 'zh';
  const buttonRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [googleClientId, setGoogleClientId] = useState('');
  const loginWithGoogleRef = useRef(loginWithGoogle);
  const roleRef = useRef(role);
  const isZhRef = useRef(isZh);
  loginWithGoogleRef.current = loginWithGoogle;
  roleRef.current = role;
  isZhRef.current = isZh;

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/providers', { credentials: 'include' })
      .then(response => response.ok ? response.json() as Promise<{ google?: { enabled?: boolean; clientId?: string | null; allowedOrigins?: string[] } }> : Promise.reject(new Error('PROVIDER_STATUS_FAILED')))
      .then(data => {
        if (cancelled) return;
        if (!data.google?.enabled || !data.google.clientId) {
          setError(localizeCopy('Google 登录暂不可用，请稍后重试或联系平台管理员。', 'Accesso Google non disponibile. Riprova più tardi o contatta l’assistenza.'));
          return;
        }
        const allowedOrigins = data.google.allowedOrigins || [];
        if (allowedOrigins.length > 0 && !allowedOrigins.includes(window.location.origin)) {
          setError(isZh
            ? `Google 登录未开放当前地址：${window.location.origin}。请使用正式域名，或将此地址加入 Google OAuth 授权来源。`
            : `Google non è attivo per ${window.location.origin}. Usa il dominio ufficiale o autorizza questo indirizzo nelle impostazioni OAuth.`);
          return;
        }
        setGoogleClientId(data.google.clientId);
      })
      .catch(() => {
        if (!cancelled) setError(localizeCopy('无法读取 Google 登录配置，请检查网络后重试。', 'Impossibile caricare la configurazione Google. Controlla la connessione e riprova.'));
      });
    return () => { cancelled = true; };
  }, [isZh, localizeCopy]);

  useEffect(() => {
    if (role !== 'merchant' || !merchantLoginError) return;
    const messages: Record<string, string> = {
      MERCHANT_APPLICATION_REQUIRED: localizeCopy('此 Google 账号尚未关联商家工作区。请先创建商家账号，再使用相同邮箱登录。', 'Questo account Google non è collegato a un workspace merchant. Crea prima un account merchant con la stessa email.'),
      REQUIRE_INDUSTRY: localizeCopy('创建商家账号前必须选择所属行业。', 'Seleziona il settore prima di creare l’account merchant.'),
      INVALID_INDUSTRY: localizeCopy('所选行业无效，请重新选择。', 'Il settore selezionato non è valido. Scegline un altro.'),
      GOOGLE_ACCOUNT_NOT_VERIFIED: localizeCopy('Google 邮箱尚未验证，请先在 Google 账号中完成邮箱验证。', 'L’email Google non è verificata. Completa prima la verifica dell’account Google.'),
      GOOGLE_LOGIN_NOT_CONFIGURED: localizeCopy('平台尚未完成 Google 登录配置，请联系管理员。', 'L’accesso Google non è configurato. Contatta l’amministratore.'),
      AUTH_RATE_LIMITED: localizeCopy('Google 登录尝试过于频繁，请稍后再试。', 'Troppi tentativi di accesso Google. Riprova più tardi.')
    };
    setError(messages[merchantLoginError.code] || localizeCopy('Google 登录未完成，请检查弹窗权限或稍后重试。', 'Accesso Google non completato. Controlla i popup o riprova più tardi.'));
  }, [localizeCopy, merchantLoginError, role]);

  useEffect(() => {
    if (role !== 'merchant') return;
    const url = new URL(window.location.href);
    const errorCode = url.searchParams.get('google_login_error');
    if (!errorCode) return;

    const messages: Record<string, string> = {
      GOOGLE_CSRF_FAILED: localizeCopy('Google 登录验证已过期，请重新点击登录。', 'Verifica Google scaduta. Avvia di nuovo l’accesso.'),
      GOOGLE_LOGIN_NOT_CONFIGURED: localizeCopy('平台尚未完成 Google 登录配置，请联系管理员。', 'L’accesso Google non è configurato. Contatta l’amministratore.'),
      GOOGLE_ACCOUNT_NOT_VERIFIED: localizeCopy('Google 邮箱尚未验证，请先在 Google 账号中完成邮箱验证。', 'L’email Google non è verificata. Completa prima la verifica dell’account Google.'),
      MERCHANT_APPLICATION_REQUIRED: localizeCopy('此 Google 账号尚未关联商家工作区。请先创建商家账号，再使用相同邮箱登录。', 'Questo account Google non è collegato a un workspace merchant. Crea prima un account merchant con la stessa email.'),
      REQUIRE_INDUSTRY: localizeCopy('创建商家账号前必须选择所属行业。', 'Seleziona il settore prima di creare l’account merchant.'),
      INVALID_INDUSTRY: localizeCopy('所选行业无效，请重新选择。', 'Il settore selezionato non è valido. Scegline un altro.'),
      AUTH_RATE_LIMITED: localizeCopy('Google 登录尝试过于频繁，请稍后再试。', 'Troppi tentativi di accesso Google. Riprova più tardi.')
    };
    setError(messages[errorCode] || localizeCopy('Google 登录未完成，请重试。', 'Accesso Google non completato. Riprova.'));
    url.searchParams.delete('google_login_error');
    window.history.replaceState(window.history.state, '', url);
  }, [localizeCopy, role]);

  useEffect(() => {
    if (!googleClientId || !buttonRef.current) return;
    let cancelled = false;

    const renderButton = () => {
      if (cancelled || !window.google?.accounts?.id || !buttonRef.current) return;
      const isMerchantRedirect = roleRef.current === 'merchant';
      const isMerchantRegistration = isMerchantRedirect && intent === 'register';
      activeGoogleHandler = async (credential: string) => {
        const ok = await loginWithGoogleRef.current(credential, roleRef.current);
        if (!ok) setError(roleRef.current === 'customer'
          ? (isZhRef.current ? 'Google 登录失败，请稍后重试' : 'Accesso Google non riuscito. Riprova.')
          : roleRef.current === 'merchant'
          ? (isZhRef.current ? '该 Google 账号尚未被授权为商户' : 'Questo account Google non è autorizzato come merchant.')
          : roleRef.current === 'company'
            ? (isZhRef.current ? 'Google 零售商登录失败，请稍后重试' : 'Accesso Google non riuscito. Riprova.')
          : (isZhRef.current ? 'Google 登录失败，请稍后重试' : 'Accesso Google non riuscito. Riprova.'));
      };
      buttonRef.current.innerHTML = '';
      const clientConfigKey = `${googleClientId}:${isMerchantRegistration ? `merchant-register-redirect:${industry || ''}` : isMerchantRedirect ? 'merchant-login-redirect' : 'popup'}`;
      if (initializedGoogleClientConfig !== clientConfigKey) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          ...(isMerchantRedirect ? {
            ux_mode: 'redirect',
            login_uri: `${window.location.origin}/api/auth/${isMerchantRegistration ? 'register' : 'login'}/google/redirect/merchant${isMerchantRegistration && industry ? `?industry=${encodeURIComponent(industry)}` : ''}`
          } : {
            use_fedcm_for_button: true
          }),
          callback: (response: { credential?: string }) => {
            if (!response.credential) {
              setError(isZhRef.current ? 'Google 登录凭证无效' : 'Credenziali Google non valide.');
              return;
            }
            setError('');
            void activeGoogleHandler?.(response.credential);
          },
          error_callback: (error: { type?: string }) => {
            setError(error.type === 'popup_failed_to_open'
              ? (isZhRef.current ? 'Google 登录窗口被浏览器拦截。请允许此网站打开弹窗后重试。' : 'Il browser ha bloccato la finestra Google. Consenti i popup per questo sito e riprova.')
              : error.type === 'popup_closed'
                ? (isZhRef.current ? 'Google 登录窗口已关闭，尚未完成登录。' : 'La finestra Google è stata chiusa prima del completamento.')
                : (isZhRef.current ? 'Google 登录窗口未能打开，请检查浏览器弹窗设置。' : 'Impossibile aprire Google. Controlla le impostazioni dei popup.'));
          }
        });
        initializedGoogleClientConfig = clientConfigKey;
      }
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: 'icon',
        theme: 'outline',
        size: 'small',
        shape: 'square',
        locale: isZh ? 'zh_CN' : 'it'
      });
      setReady(true);
    };

    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      if (window.google?.accounts?.id) renderButton();
      else existing.addEventListener('load', renderButton, { once: true });
    } else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = renderButton;
      script.onerror = () => setError(localizeCopy("Google 登录组件加载失败", "Impossibile caricare l’accesso Google."));
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
    };
  }, [googleClientId, industry, intent, lang, role]);

  if (!googleClientId) {
    return error ? <div role="alert" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{error}</div> : null;
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {!(intent === 'register' && role === 'merchant') && (
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-neutral-400">
          <span className="h-px flex-1 bg-neutral-200" />
          <span>{localizeCopy("或使用 Google", "oppure continua con Google")}</span>
          <span className="h-px flex-1 bg-neutral-200" />
        </div>
      )}
      <div role="group" aria-label={localizeCopy('使用 Google 登录或注册', 'Accedi o registrati con Google')} ref={buttonRef} className={`min-h-8 flex justify-center ${ready ? '' : 'opacity-0'}`} />
      {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}
    </div>
  );
};

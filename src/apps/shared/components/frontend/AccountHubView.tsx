import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { PhoneNumberInput, formatInternationalPhoneNumber } from '../common/PhoneNumberInput';
import { countryCallingCodes, phoneCountryOptions } from '../../../../constants/countries';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Copy,
  LogIn,
} from 'lucide-react';
import { ApiError, apiGet, apiPost, apiPut } from '../../../../api/client';
import { useB2B } from '../../../../context/B2BContext';
import { useModuleAvailability } from '../../moduleAvailability';
import { WeChatLoginButton } from '../auth/WeChatLoginButton';
import { LanguagePicker } from '../common/LanguagePicker';
import type { SupportedCurrency } from '../../../../types/b2b';
import type { Order, SolanaPaymentDetails } from '../../../../types/b2b';
import { UnifiedAuthEntry } from '../auth/UnifiedAuthEntry';
import { RegistrationEntry } from '../auth/RegistrationEntry';

const currencies: SupportedCurrency[] = ['EUR', 'USD', 'CNY', 'GBP', 'JPY', 'CHF'];
const LazyMyBusinessPortal = lazy(() => import('../buyer/MyBusinessPortal').then(module => ({ default: module.MyBusinessPortal })));
type FashionAccountSummary = {
  account: {
    id: string;
    displayName: string;
    bio: string | null;
    avatarUrl: string | null;
    identities: string[];
  };
  stats: { posts: number; saved: number; following: number; followers: number };
  posts: Array<{ id: string; title: string; image: string; createdAt: string; mediaType: string; publicationStatus: string }>;
  savedPosts: Array<{ id: string; title: string; image: string; createdAt: string; mediaType: string }>;
  followingIds: string[];
};

export const AccountHubView: React.FC = () => {
  const {
    authRole,
    authCustomerAccount,
    authBuyer,
    currentCustomer,
    lang,
    displayCurrency,
    setDisplayCurrency,
    monochromeMode,
    setMonochromeMode,
    accountPreferencesSynced,
    accountPreferencesSyncError,
    addNotification,
    replaceOrderFromServer,
    logout,
    setCurrentView, localizeCopy,
    t,
  } = useB2B();
  const { fashionEnabled } = useModuleAvailability();
  const [showBusinessWorkspace, setShowBusinessWorkspace] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [showEnterpriseRegistration, setShowEnterpriseRegistration] = useState(false);
  const [activePanel, setActivePanel] = useState<'fashion' | 'settings' | 'support' | 'join' | 'services' | null>(null);
  const [fashionAccount, setFashionAccount] = useState<FashionAccountSummary | null>(null);
  const [fashionAccountLoading, setFashionAccountLoading] = useState(false);
  const [fashionAccountError, setFashionAccountError] = useState('');
  const [fashionDisplayName, setFashionDisplayName] = useState('');
  const [fashionBio, setFashionBio] = useState('');
  const [fashionProfileBusy, setFashionProfileBusy] = useState(false);
  const [fashionProfileError, setFashionProfileError] = useState('');
  const [fashionLinkRole, setFashionLinkRole] = useState<'consumer' | 'buyer' | 'company' | 'merchant'>('consumer');
  const [fashionLinkIdentifier, setFashionLinkIdentifier] = useState('');
  const [fashionLinkPassword, setFashionLinkPassword] = useState('');
  const [fashionLinkBusy, setFashionLinkBusy] = useState(false);
  const [fashionLinkError, setFashionLinkError] = useState('');
  const [supportName, setSupportName] = useState(authBuyer?.companyName || currentCustomer?.companyName || authCustomerAccount?.email || authCustomerAccount?.phone || '');
  const [supportEmail, setSupportEmail] = useState(authCustomerAccount?.email || '');
  const [supportPhoneCountry, setSupportPhoneCountry] = useState(() => {
    const phoneDigits = (authCustomerAccount?.phone || '').replace(/\D/g, '');
    return [...phoneCountryOptions]
      .sort((a, b) => countryCallingCodes[b].length - countryCallingCodes[a].length)
      .find(country => phoneDigits.startsWith(countryCallingCodes[country])) || (lang === 'it' ? 'Italy' : 'France');
  });
  const [supportPhone, setSupportPhone] = useState(() => {
    const rawPhone = authCustomerAccount?.phone || '';
    const digits = rawPhone.replace(/\D/g, '');
    const callingCode = countryCallingCodes[supportPhoneCountry] || '';
    return rawPhone.startsWith('+') && callingCode && digits.startsWith(callingCode)
      ? digits.slice(callingCode.length)
      : rawPhone;
  });
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportBusy, setSupportBusy] = useState(false);
  const [supportError, setSupportError] = useState('');
  const [supportSubmitted, setSupportSubmitted] = useState(false);
  const [solanaPayment, setSolanaPayment] = useState<SolanaPaymentDetails | null>(null);
  const [solanaPaymentError, setSolanaPaymentError] = useState('');
  const [solanaRequestCopied, setSolanaRequestCopied] = useState(false);
  const paypalReturnStarted = useRef<string | null>(null);
  const stripeReturnStarted = useRef<string | null>(null);
  const solanaPaymentStarted = useRef<string | null>(null);
  const replaceOrderFromServerRef = useRef(replaceOrderFromServer);
  replaceOrderFromServerRef.current = replaceOrderFromServer;
  const addNotificationRef = useRef(addNotification);
  addNotificationRef.current = addNotification;
  const isIt = lang === 'it';
  const signedInBuyer = authRole === 'buyer' || authRole === 'company';
  const signedIn = signedInBuyer || ['customer', 'consumer', 'merchant'].includes(authRole);
  const canSyncPreferences = ['buyer', 'company', 'merchant', 'customer'].includes(authRole);
  const customerName = authBuyer?.companyName || currentCustomer?.companyName || authCustomerAccount?.email || authCustomerAccount?.phone;

  const copySolanaPaymentRequest = async () => {
    if (!solanaPayment?.uri) return;
    try {
      await navigator.clipboard.writeText(solanaPayment.uri);
      setSolanaRequestCopied(true);
      addNotification('success', '支付请求已复制', '请粘贴到支持 Solana Pay 的钱包中，并在钱包内核对后确认。');
      window.setTimeout(() => setSolanaRequestCopied(false), 2500);
    } catch (error) {
      addNotification('warning', '复制失败', error instanceof Error ? error.message : '浏览器未允许访问剪贴板，请使用二维码付款。');
    }
  };

  useEffect(() => {
    if (!supportName && customerName) setSupportName(customerName);
  }, [customerName, supportName]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('wechat_login');
    const error = params.get('wechat_login_error');
    if (!result && !error) return;
    if (result === 'bound') {
      addNotificationRef.current('success', localizeCopy('微信已绑定', 'WeChat collegato'), localizeCopy('此微信账号现在可以用于登录当前买家账户。', 'WeChat può ora accedere a questo account buyer.'));
    } else if (result === 'success') {
      addNotificationRef.current('success', localizeCopy('微信登录成功', 'Accesso WeChat riuscito'), localizeCopy('新买家账户需补全企业资料并通过审核后才能下单。', 'Completa il profilo aziendale e attendi la verifica prima di ordinare.'));
    } else if (error) {
      const message = error === 'WECHAT_ACCOUNT_ALREADY_LINKED'
        ? localizeCopy('该微信已绑定到其他买家账户。', 'Questo account WeChat è collegato a un altro buyer.')
        : error === 'WECHAT_AUTH_DENIED'
          ? localizeCopy('你取消了微信授权。', 'Hai annullato l’autorizzazione WeChat.')
          : error === 'WECHAT_NOT_CONFIGURED'
            ? localizeCopy('平台尚未完成服务号登录配置。', 'L’accesso del servizio WeChat non è configurato.')
            : error === 'WECHAT_STATE_INVALID'
              ? localizeCopy('微信登录验证已过期，请重新发起登录。', 'Verifica WeChat scaduta. Avvia di nuovo l’accesso.')
              : localizeCopy('微信登录未完成，请稍后重试或联系平台客服。', 'Accesso WeChat non completato. Riprova o contatta l’assistenza.');
      addNotificationRef.current('warning', localizeCopy('微信登录失败', 'Accesso WeChat non riuscito'), message);
    }
    params.delete('wechat_login');
    params.delete('wechat_login_error');
    const query = params.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
  }, [localizeCopy]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paypalStatus = params.get('paypal');
    if (paypalStatus !== 'return' && paypalStatus !== 'cancelled') return;
    const clearPaypalReturn = () => {
      params.delete('paypal');
      params.delete('order');
      params.delete('token');
      const query = params.toString();
      window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
    };
    if (paypalStatus === 'cancelled') {
      clearPaypalReturn();
      addNotificationRef.current('info', 'PayPal 付款已取消', '订单仍为待付款状态；如需继续，请在订单页面联系商家。');
      return;
    }
    if (!signedInBuyer) return;
    const paypalOrderId = params.get('token');
    const orderNo = params.get('order');
    const requestKey = `${paypalOrderId || ''}:${orderNo || ''}`;
    if (!paypalOrderId || !orderNo) {
      clearPaypalReturn();
      addNotificationRef.current('warning', 'PayPal 回跳信息不完整', '未能取得 PayPal 订单编号，请联系商家核对订单。');
      return;
    }
    if (paypalReturnStarted.current === requestKey) return;
    paypalReturnStarted.current = requestKey;
    apiPost<{ success: true; payment: { status: string }; order?: Order }>('/api/payments/paypal/capture', { paypalOrderId, orderNo })
      .then(result => {
        if (result.order) replaceOrderFromServerRef.current(result.order);
        clearPaypalReturn();
        addNotificationRef.current('success', 'PayPal 付款成功', '付款已由服务端确认，订单状态已更新。');
      })
      .catch(error => {
        paypalReturnStarted.current = null;
        addNotificationRef.current('warning', 'PayPal 付款确认失败', error instanceof Error ? error.message : '请勿重复付款；稍后刷新页面重试或联系商家核对。');
      });
  }, [signedInBuyer]);

  useEffect(() => {
    const orderId = new URLSearchParams(window.location.search).get('solanaOrder');
    if (!orderId || !signedInBuyer || solanaPaymentStarted.current === orderId) return;
    solanaPaymentStarted.current = orderId;
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const checkPayment = async () => {
      try {
        const result = await apiGet<{ success: true; payment: SolanaPaymentDetails; order: Order }>(
          `/api/payments/solana/${encodeURIComponent(orderId)}`
        );
        if (!active) return;
        setSolanaPayment(result.payment);
        setSolanaPaymentError('');
        if (result.payment.status === 'paid') {
          replaceOrderFromServerRef.current(result.order);
          addNotificationRef.current('success', 'Solana Pay 付款成功', '链上转账已验证，订单状态已更新并可供商家处理。');
          return;
        }
        if (result.payment.status === 'expired' || result.payment.status === 'late_payment') return;
        retryTimer = setTimeout(checkPayment, 2_000);
      } catch (error) {
        if (!active) return;
        const retryable = !(error instanceof ApiError) || [408, 429, 500, 502, 503, 504].includes(error.status);
        setSolanaPaymentError(error instanceof Error ? error.message : 'Solana 付款状态读取失败');
        if (retryable) retryTimer = setTimeout(checkPayment, 5_000);
      }
    };
    void checkPayment();
    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
      solanaPaymentStarted.current = null;
    };
  }, [signedInBuyer]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stripeStatus = params.get('stripe');
    if (stripeStatus !== 'return' && stripeStatus !== 'cancelled') return;
    const clearStripeReturn = () => {
      params.delete('stripe');
      params.delete('order');
      params.delete('session_id');
      const query = params.toString();
      window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
    };
    if (stripeStatus === 'cancelled') {
      clearStripeReturn();
      addNotificationRef.current('info', 'Stripe 付款已取消', '订单仍为待付款状态；如需继续付款，请联系商家。');
      return;
    }
    if (!signedInBuyer) return;
    const sessionId = params.get('session_id');
    const orderNo = params.get('order');
    const requestKey = `${sessionId || ''}:${orderNo || ''}`;
    if (!sessionId || !orderNo) {
      clearStripeReturn();
      addNotificationRef.current('warning', 'Stripe 回跳信息不完整', '未能取得 Stripe 结账编号，请联系商家核对订单。');
      return;
    }
    if (stripeReturnStarted.current === requestKey) return;
    stripeReturnStarted.current = requestKey;
    apiPost<{ success: true; payment: { status: string }; order?: Order }>('/api/payments/stripe/confirm', { sessionId, orderNo })
      .then(result => {
        if (result.order) replaceOrderFromServerRef.current(result.order);
        clearStripeReturn();
        addNotificationRef.current('success', 'Stripe 付款成功', 'Stripe 已确认付款，订单状态已更新。');
      })
      .catch(error => {
        stripeReturnStarted.current = null;
        addNotificationRef.current('warning', 'Stripe 付款确认失败', error instanceof Error ? error.message : '请勿重复付款；稍后刷新页面重试或联系商家核对。');
      });
  }, [signedInBuyer]);

  useEffect(() => {
    const openSignIn = () => setShowSignIn(true);
    try {
      if (window.sessionStorage.getItem('ruda:open-customer-login') === '1') {
        window.sessionStorage.removeItem('ruda:open-customer-login');
        openSignIn();
      }
    } catch (error) {
      console.warn('[customer-login-navigation]', error);
    }
    window.addEventListener('ruda:open-customer-login', openSignIn);
    return () => window.removeEventListener('ruda:open-customer-login', openSignIn);
  }, []);

  useEffect(() => {
    if (!signedIn || authRole === 'admin') {
      setFashionAccount(null);
      return;
    }
    let active = true;
    setFashionAccountLoading(true);
    setFashionAccountError('');
    apiPost('/api/fashion/account/activate', {})
      .then(() => apiGet<FashionAccountSummary & { success: true }>('/api/fashion/account/me'))
      .then(result => {
        if (active) {
          setFashionAccount(result);
          setFashionDisplayName(result.account.displayName);
          setFashionBio(result.account.bio || '');
        }
      })
      .catch(error => {
        if (active) setFashionAccountError(error instanceof Error ? error.message : 'FASHION_ACCOUNT_LOAD_FAILED');
      })
      .finally(() => {
        if (active) setFashionAccountLoading(false);
      });
    return () => {
      active = false;
    };
  }, [authRole, signedIn]);

  const submitFashionAccountLink = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFashionLinkBusy(true);
    setFashionLinkError('');
    try {
      await apiPost('/api/fashion/account/link', {
        role: fashionLinkRole,
        identifier: fashionLinkIdentifier,
        password: fashionLinkPassword
      });
      setFashionLinkIdentifier('');
      setFashionLinkPassword('');
      const updated = await apiGet<FashionAccountSummary & { success: true }>('/api/fashion/account/me');
      setFashionAccount(updated);
      setFashionDisplayName(updated.account.displayName);
      setFashionBio(updated.account.bio || '');
      addNotification('success', localizeCopy('账号已验证并关联', 'Account collegato'), localizeCopy('业务权限保持不变；Tik 内容现在归属这个统一账户。', 'I permessi commerciali restano invariati; i contenuti Tik appartengono ora a questo account.'));
    } catch (error) {
      setFashionLinkError(error instanceof Error ? error.message : 'FASHION_IDENTITY_VERIFICATION_FAILED');
    } finally {
      setFashionLinkBusy(false);
    }
  };

  const saveFashionProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFashionProfileBusy(true);
    setFashionProfileError('');
    try {
      const result = await apiPut<{ success: true; account: FashionAccountSummary['account'] }>('/api/fashion/account/profile', {
        displayName: fashionDisplayName,
        bio: fashionBio
      });
      if (fashionAccount) setFashionAccount({ ...fashionAccount, account: result.account });
      setFashionDisplayName(result.account.displayName);
      setFashionBio(result.account.bio || '');
      addNotification('success', localizeCopy('Tik 资料已保存', 'Profilo Tik salvato'), localizeCopy('此资料只用于你的创作者主页，不会更改商城或商家资料。', 'Queste informazioni valgono solo per il profilo creator e non modificano i dati commerciali.'));
    } catch (error) {
      setFashionProfileError(error instanceof Error ? error.message : 'FASHION_PROFILE_UPDATE_FAILED');
    } finally {
      setFashionProfileBusy(false);
    }
  };

  const submitSupportRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSupportError('');
    setSupportSubmitted(false);
    if (!supportEmail.trim() && !supportPhone.trim()) {
      setSupportError(localizeCopy('请至少填写邮箱或联系电话。', 'Inserisci un indirizzo email o un numero di telefono.'));
      return;
    }
    setSupportBusy(true);
    try {
      await apiPost('/api/support-requests', {
        name: supportName.trim(),
        email: supportEmail.trim(),
        phone: formatInternationalPhoneNumber(supportPhoneCountry, supportPhone),
        subject: supportSubject.trim(),
        message: supportMessage.trim()
      });
      setSupportSubject('');
      setSupportMessage('');
      setSupportSubmitted(true);
      addNotification('success', localizeCopy('咨询已提交', 'Richiesta inviata'), localizeCopy('RUDA 客服团队会通过你留下的联系方式回复。', 'Il team RUDA ti risponderà usando i recapiti indicati.'));
    } catch (error) {
      const message = error instanceof Error ? error.message : (localizeCopy('请稍后重试。', 'Riprova più tardi.'));
      setSupportError(localizeCopy("提交失败：{{RUDA_ARG_0}}", "Invio non riuscito: {{RUDA_ARG_0}}", [String(message)]));
    } finally {
      setSupportBusy(false);
    }
  };

  const destinations = [
    { label: localizeCopy('RUDA 特价', 'Catalogo sconti'), view: 'catalog' as const },
    { label: localizeCopy('品牌商家', 'Showroom partner'), view: 'showrooms' as const },
    { label: localizeCopy('生产商家', 'Produttori'), view: 'showrooms' as const, path: '/producers' },
    { label: localizeCopy('批发商家', 'Grossisti'), view: 'showrooms' as const, path: '/wholesalers' },
    { label: localizeCopy('零售商家', 'Rivenditori'), view: 'showrooms' as const, path: '/retailers' },
    { label: localizeCopy('RUDA 时尚', 'RUDA Fashion'), view: 'fashion_trends' as const },
  ].filter(item => fashionEnabled || item.view !== 'fashion_trends');

  const navigate = (view: typeof destinations[number]['view'], path?: string) => {
    setCurrentView(view);
    if (path) window.history.pushState({}, '', path);
    else if (view === 'catalog') window.history.pushState({}, '', '/catalog');
    else if (view === 'showrooms') window.history.pushState({}, '', '/showrooms');
    else if (view === 'fashion_trends') window.history.pushState({}, '', '/trends');
  };

  if (showEnterpriseRegistration && !signedIn) {
    return <RegistrationEntry initialPath="enterprise" onBack={() => setShowEnterpriseRegistration(false)} />;
  }

  if (showSignIn && !signedIn) {
    return (
      <UnifiedAuthEntry
        onBack={() => setShowSignIn(false)}
        onRegister={() => {
          setShowSignIn(false);
          setShowEnterpriseRegistration(true);
        }}
      />
    );
  }

  if (showBusinessWorkspace && signedInBuyer) {
    return (
      <div className="ui-page-shell">
        <button type="button" onClick={() => setShowBusinessWorkspace(false)} className="mb-5 text-xs font-semibold text-neutral-600 hover:text-black">
          ← {localizeCopy('返回功能中心', 'Impostazioni e servizi')}
        </button>
        <Suspense fallback={<div className="py-12 text-center text-sm text-neutral-500">{localizeCopy('正在加载采购商工作台...', 'Caricamento area aziendale...')}</div>}>
          <LazyMyBusinessPortal />
        </Suspense>
      </div>
    );
  }

  const panelTitles = {
    fashion: localizeCopy('Tik 创作者', 'Profilo Tik'),
    settings: localizeCopy('设置', 'Impostazioni'),
    support: localizeCopy('联系平台客服', 'Assistenza RUDA'),
    join: localizeCopy('申请入驻', 'Diventa partner'),
    services: localizeCopy('平台服务', 'Esplora RUDA')
  };
  const menuItems = [
    { key: 'fashion' as const, label: localizeCopy('Tik 创作者', 'Profilo Tik') },
    { key: 'settings' as const, label: localizeCopy('设置', 'Impostazioni') },
    { key: 'support' as const, label: localizeCopy('客服', 'Supporto RUDA') },
    { key: 'join' as const, label: localizeCopy('申请入驻', 'Diventa partner') },
    { key: 'services' as const, label: localizeCopy('探索 RUDA', 'Esplora RUDA') }
  ];

  return (
    <div className="ui-page-shell max-w-3xl space-y-4 pb-8">
      <header className="border-b border-neutral-300 pb-4 pt-2">
        <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-neutral-500">RUDA / MY RUDA</p>
        {activePanel ? (
          <div className="mt-2 flex items-center gap-3">
            <button type="button" onClick={() => setActivePanel(null)} className="shrink-0 text-xs font-semibold text-neutral-500 hover:text-neutral-950">
              {localizeCopy('返回我的', 'Indietro')}
            </button>
            <h1 className="font-serif text-2xl font-medium tracking-tight text-neutral-950">{panelTitles[activePanel]}</h1>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-serif text-3xl font-medium tracking-tight text-neutral-950">{localizeCopy('我的 RUDA', 'Il tuo spazio RUDA')}</h1>
              {customerName && <p className="mt-1 text-xs text-neutral-500">{customerName}</p>}
            </div>
            <div className="flex items-center gap-2">
              {signedInBuyer && (
                <button type="button" onClick={() => setShowBusinessWorkspace(true)} className="inline-flex min-h-9 items-center gap-1.5 bg-neutral-950 px-3 text-[11px] font-semibold text-white hover:bg-neutral-700">
                  {localizeCopy('采购商工作台', 'Area aziendale')} <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              )}
              {authRole === 'merchant' && (
                <button type="button" onClick={() => setCurrentView('merchant_portal')} className="inline-flex min-h-9 items-center gap-1.5 bg-neutral-950 px-3 text-[11px] font-semibold text-white hover:bg-neutral-700">
                  {localizeCopy('商家工作台', 'Area negozio')} <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              )}
              {!signedIn && (
                <button type="button" onClick={() => setShowSignIn(true)} className="inline-flex min-h-9 items-center gap-1.5 border border-neutral-300 px-3 text-[11px] font-semibold text-neutral-800 hover:border-neutral-950">
                  <LogIn className="h-3.5 w-3.5" /> {localizeCopy('登录', 'Accedi')}
                </button>
              )}
              {authRole === 'customer' && (
                <button type="button" onClick={logout} className="inline-flex min-h-9 items-center border border-neutral-300 px-3 text-[11px] font-semibold text-neutral-800 hover:border-neutral-950">
                  {localizeCopy('退出', 'Esci')}
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {solanaPayment && <section aria-live="polite" className={`rounded-2xl border p-4 sm:p-5 ${solanaPayment.status === 'paid' ? 'border-emerald-200 bg-emerald-50' : ['late_payment', 'review', 'expired'].includes(solanaPayment.status) ? 'border-amber-200 bg-amber-50' : 'border-violet-200 bg-violet-50'}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-neutral-950">
              {solanaPayment.status === 'paid' ? 'Solana Pay 已确认到账' : solanaPayment.status === 'expired' ? '付款报价已过期' : solanaPayment.status === 'late_payment' ? '检测到过期时间后的转账' : solanaPayment.status === 'review' ? '付款需要人工核对' : '等待 Solana 钱包付款'}
            </h2>
            <p className="mt-1 text-xs leading-5 text-neutral-700">订单金额 €{Number(solanaPayment.eurAmount).toFixed(2)} · 扫码支付 {Number(solanaPayment.tokenAmount).toFixed(6)} {solanaPayment.tokenSymbol}</p>
            <p className="mt-1 text-xs leading-5 text-neutral-700">分账：商家收到 {Number(solanaPayment.merchantAmount).toFixed(6)} {solanaPayment.tokenSymbol}（{((1 - Number(solanaPayment.commissionRate)) * 100).toFixed(2)}%） · RUDA 平台服务费 {Number(solanaPayment.commissionAmount).toFixed(6)} {solanaPayment.tokenSymbol}（{(Number(solanaPayment.commissionRate) * 100).toFixed(2)}%）</p>
          </div>
          {solanaPayment.status === 'paid' && solanaPayment.signature && <a href={`https://explorer.solana.com/tx/${encodeURIComponent(solanaPayment.signature)}`} target="_blank" rel="noreferrer noopener" className="text-xs font-semibold text-emerald-800 underline">查看链上交易</a>}
        </div>
        {solanaPayment.status === 'pending' && <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="mx-auto flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-950 px-3 py-1.5 text-[10px] font-extrabold tracking-wide text-white shadow-sm">
                <svg aria-hidden="true" viewBox="0 0 32 24" className="h-4 w-5">
                  <defs><linearGradient id="solana-mark-gradient" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stopColor="#9945FF" /><stop offset="100%" stopColor="#14F195" /></linearGradient></defs>
                  <path fill="url(#solana-mark-gradient)" d="M5 2h25l-4 4H1l4-4Zm0 8h25l-4 4H1l4-4Zm0 8h25l-4 4H1l4-4Z" />
                </svg>
                SOLANA · SPL
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[10px] font-extrabold tracking-wide text-blue-800">
                <span aria-hidden="true" className="grid h-4 w-4 place-items-center rounded-full bg-blue-600 text-[9px] text-white">$</span>
                {solanaPayment.tokenSymbol}
              </span>
            </div>
            <div className="rounded-xl bg-white p-3"><QRCodeSVG value={solanaPayment.uri} size={220} level="M" includeMargin /></div>
            <button type="button" onClick={() => void copySolanaPaymentRequest()} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-semibold text-violet-900 hover:bg-violet-50">
              {solanaRequestCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {solanaRequestCopied ? 'Payment Request Copied（已复制）' : 'Copy Payment Request（复制支付请求）'}
            </button>
            <p className="max-w-[260px] break-all text-center text-[10px] leading-4 text-neutral-500">复制后可粘贴至支持 Solana Pay Transaction Request 的钱包；付款前请核对网络与金额。</p>
          </div>
          <div className="space-y-2 text-xs leading-5 text-neutral-700">
            <h3 className="font-semibold text-neutral-900">Solana Pay 支付说明</h3>
            <p>1. 打开支持 Solana 网络的钱包 App（Phantom、Solflare 或 OKX 钱包）。</p>
            <p>2. 使用钱包的“扫一扫”扫描二维码，并确认当前网络为 Solana (SPL)。</p>
            <p>3. 核对订单金额与分账：{Number(solanaPayment.merchantAmount).toFixed(6)} {solanaPayment.tokenSymbol} 支付给商家，{Number(solanaPayment.commissionAmount).toFixed(6)} {solanaPayment.tokenSymbol} 为 RUDA 平台技术服务费；确认无误后在钱包中批准交易。</p>
            <p className="font-semibold text-neutral-900">重要提示：仅支持存放在 Solana (SPL) 主网上的 USDC 或 EURC。请勿从其他网络转账。</p>
            <p>钱包需留有少量 SOL 用于网络费；首次创建收款代币账户时还可能产生账户租金。实际费用由钱包在确认前显示，可能随网络和账户状态变化，不是固定的 0.01 SOL。</p>
            <p>报价汇率：1 EUR = {Number(solanaPayment.exchangeRate).toFixed(6)} {solanaPayment.tokenSymbol}（{solanaPayment.exchangeRateSource}）</p>
            <p>汇率数据更新时间：{new Date(solanaPayment.exchangeRateUpdatedAt).toLocaleString()} · 报价有效至：{new Date(solanaPayment.expiresAt).toLocaleString()}</p>
            <p>RUDA 每 2 秒向 Solana 主网核验一次；未完成链上验证前不会把订单标记为已付款。</p>
          </div>
        </div>}
        {solanaPayment.status === 'expired' && <p className="mt-2 text-xs leading-5 text-amber-900">二维码已过期，请勿再向该地址付款；如已发起转账，请联系商家核对订单。库存仍需由商家确认后处理。</p>}
        {solanaPayment.status === 'late_payment' && <p className="mt-2 text-xs leading-5 text-amber-900">链上检测到转账，但交易时间晚于锁定报价或订单已取消。系统不会自动把订单标记为已付款，请联系商家人工核对到账。</p>}
        {solanaPayment.status === 'review' && <p className="mt-2 text-xs leading-5 text-amber-900">检测到该付款编号相关交易，但收款方、资产、金额或确认时间需要人工核对。订单尚未标记为已付款，请联系商家。</p>}
        {solanaPaymentError && <p role="alert" className="mt-2 text-xs text-rose-800">状态检查暂时失败：{solanaPaymentError}。页面会继续重试；请勿重复付款。</p>}
      </section>}

      <nav aria-label={localizeCopy('我的功能菜单', 'Menu personale')} className="flex w-full gap-5 overflow-x-auto border-y border-neutral-200 bg-white pt-3 text-xs font-semibold sm:gap-8">
        <button type="button" onClick={() => setCurrentView('orders')} className="shrink-0 border-b-2 border-transparent pb-3 text-neutral-600 hover:text-neutral-950">
          {localizeCopy('订单', 'Ordini')}
        </button>
        {menuItems.map(item => (
          <button
            key={item.key}
            type="button"
            aria-current={activePanel === item.key ? 'page' : undefined}
            onClick={() => setActivePanel(item.key)}
            className={`shrink-0 border-b-2 pb-3 ${activePanel === item.key ? 'border-neutral-950 text-neutral-950' : 'border-transparent text-neutral-600 hover:text-neutral-950'}`}
          >
            {item.label}
          </button>
        ))}
      </nav>
      {activePanel === 'fashion' ? (
        <section aria-label={localizeCopy('Tik 统一创作者账户', 'Account creator Tik')} className="space-y-4">
          {!signedIn ? (
            <div className="border border-neutral-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-neutral-950">{localizeCopy('登录后管理你的 Tik', 'Accedi per gestire il tuo Tik')}</h2>
              <p className="mt-2 text-xs leading-5 text-neutral-600">{localizeCopy('游客可以继续浏览和点赞；发布、关注和收藏需要登录 RUDA 账户。', 'Gli ospiti possono continuare a esplorare e mettere Mi piace; per pubblicare, seguire e salvare serve un account RUDA.')}</p>
              <button type="button" onClick={() => setShowSignIn(true)} className="mt-4 inline-flex min-h-10 items-center gap-2 bg-neutral-950 px-4 text-xs font-semibold text-white hover:bg-neutral-700">
                <LogIn className="h-4 w-4" /> {localizeCopy('登录', 'Accedi')}
              </button>
            </div>
          ) : fashionAccountLoading ? (
            <p role="status" className="py-8 text-center text-xs text-neutral-500">{localizeCopy('正在加载 Tik 账户…', 'Caricamento account Tik…')}</p>
          ) : fashionAccountError ? (
            <p role="alert" className="border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">{localizeCopy('Tik 账户暂时无法加载：{{RUDA_ARG_0}}', 'Impossibile caricare l’account Tik: {{RUDA_ARG_0}}', [fashionAccountError])}</p>
          ) : fashionAccount ? (
            <>
              <div className="flex flex-wrap items-center gap-4 border border-neutral-200 bg-white p-5">
                {fashionAccount.account.avatarUrl ? (
                  <img src={fashionAccount.account.avatarUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
                ) : (
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-neutral-100 text-lg font-semibold text-neutral-500">{fashionAccount.account.displayName.slice(0, 1).toUpperCase()}</span>
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-semibold text-neutral-950">{fashionAccount.account.displayName}</h2>
                  <p className="mt-1 text-[10px] text-neutral-500">{localizeCopy('统一创作者账户', 'Account creator unificato')} · {fashionAccount.account.identities.length} {localizeCopy('个已验证身份', 'identità verificate')}</p>
                  {fashionAccount.account.bio && <p className="mt-2 text-xs text-neutral-600">{fashionAccount.account.bio}</p>}
                </div>
              </div>
              <form onSubmit={event => void saveFashionProfile(event)} className="grid gap-2 border border-neutral-200 bg-white p-4 sm:grid-cols-2">
                <label className="text-[10px] font-semibold text-neutral-600">
                  {localizeCopy('创作者名称', 'Nome creator')}
                  <input required maxLength={80} value={fashionDisplayName} onChange={event => setFashionDisplayName(event.target.value)} className="mt-1.5 min-h-10 w-full border border-neutral-200 px-3 text-xs font-normal text-neutral-900" />
                </label>
                <label className="text-[10px] font-semibold text-neutral-600">
                  {localizeCopy('个人简介', 'Bio')}
                  <input maxLength={300} value={fashionBio} onChange={event => setFashionBio(event.target.value)} className="mt-1.5 min-h-10 w-full border border-neutral-200 px-3 text-xs font-normal text-neutral-900" />
                </label>
                {fashionProfileError && <p role="alert" className="text-[11px] text-rose-700 sm:col-span-2">{localizeCopy('资料保存失败：{{RUDA_ARG_0}}', 'Impossibile salvare il profilo: {{RUDA_ARG_0}}', [fashionProfileError])}</p>}
                <button type="submit" disabled={fashionProfileBusy} className="min-h-9 bg-neutral-950 px-4 text-[11px] font-semibold text-white disabled:opacity-50 sm:col-span-2">
                  {fashionProfileBusy ? localizeCopy('正在保存…', 'Salvataggio…') : localizeCopy('保存 Tik 资料', 'Salva profilo Tik')}
                </button>
              </form>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  [localizeCopy('作品', 'Post'), fashionAccount.stats.posts],
                  [localizeCopy('收藏', 'Salvati'), fashionAccount.stats.saved],
                  [localizeCopy('关注', 'Seguiti'), fashionAccount.stats.following],
                  [localizeCopy('粉丝', 'Follower'), fashionAccount.stats.followers]
                ].map(([label, value]) => (
                  <div key={String(label)} className="border border-neutral-200 bg-white px-3 py-4 text-center">
                    <p className="text-lg font-semibold text-neutral-950">{value}</p>
                    <p className="mt-1 text-[10px] text-neutral-500">{label}</p>
                  </div>
                ))}
              </div>
              <section className="border border-neutral-200 bg-white p-4">
                <h3 className="text-xs font-semibold text-neutral-950">{localizeCopy('已关联的 RUDA 身份', 'Identità RUDA collegate')}</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {fashionAccount.account.identities.map(provider => (
                    <span key={provider} className="border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-[10px] font-medium text-neutral-700">
                      {provider === 'consumer' ? localizeCopy('消费者账户', 'Account consumatore') : provider === 'account_identity' ? localizeCopy('采购商 / 企业 / 商家', 'Buyer / azienda / negozio') : localizeCopy('RUDA 账户', 'Account RUDA')}
                    </span>
                  ))}
                </div>
                <form onSubmit={event => void submitFashionAccountLink(event)} className="mt-4 grid gap-2 border-t border-neutral-100 pt-4 sm:grid-cols-2">
                  <label className="text-[10px] font-semibold text-neutral-600">
                    {localizeCopy('要关联的账户类型', 'Tipo di account')}
                    <select value={fashionLinkRole} onChange={event => setFashionLinkRole(event.target.value as typeof fashionLinkRole)} className="mt-1.5 min-h-10 w-full border border-neutral-200 bg-white px-2 text-xs font-normal text-neutral-900">
                      <option value="consumer">{localizeCopy('消费者', 'Consumatore')}</option>
                      <option value="buyer">{localizeCopy('采购商', 'Buyer')}</option>
                      <option value="company">{localizeCopy('企业', 'Azienda')}</option>
                      <option value="merchant">{localizeCopy('商家', 'Negozio')}</option>
                    </select>
                  </label>
                  <label className="text-[10px] font-semibold text-neutral-600">
                    {localizeCopy('账户邮箱、电话或商家编号', 'Email, telefono o codice negozio')}
                    <input required autoComplete="username" maxLength={254} value={fashionLinkIdentifier} onChange={event => setFashionLinkIdentifier(event.target.value)} className="mt-1.5 min-h-10 w-full border border-neutral-200 px-3 text-xs font-normal text-neutral-900" />
                  </label>
                  <label className="text-[10px] font-semibold text-neutral-600 sm:col-span-2">
                    {localizeCopy('重新验证密码', 'Verifica di nuovo la password')}
                    <input required type="password" autoComplete="current-password" maxLength={200} value={fashionLinkPassword} onChange={event => setFashionLinkPassword(event.target.value)} className="mt-1.5 min-h-10 w-full border border-neutral-200 px-3 text-xs font-normal text-neutral-900" />
                  </label>
                  {fashionLinkError && <p role="alert" className="text-[11px] text-rose-700 sm:col-span-2">{localizeCopy('身份验证或关联失败：{{RUDA_ARG_0}}', 'Verifica o collegamento non riusciti: {{RUDA_ARG_0}}', [fashionLinkError])}</p>}
                  <p className="text-[10px] leading-4 text-neutral-500 sm:col-span-2">{localizeCopy('密码只用于本次向 RUDA 验证身份，不会保存；关联只统一 Tik 归属，不会授予或扩大商家、采购或企业权限。', 'La password viene usata solo per questa verifica e non viene salvata; il collegamento unifica Tik senza concedere o ampliare permessi commerciali.')}</p>
                  <button type="submit" disabled={fashionLinkBusy} className="min-h-10 bg-neutral-950 px-4 text-xs font-semibold text-white disabled:opacity-50 sm:col-span-2">
                    {fashionLinkBusy ? localizeCopy('正在验证…', 'Verifica in corso…') : localizeCopy('验证并关联账户', 'Verifica e collega account')}
                  </button>
                </form>
              </section>
              <section className="border border-neutral-200 bg-white p-4">
                <h3 className="text-xs font-semibold text-neutral-950">{localizeCopy('我的作品', 'I miei contenuti')}</h3>
                {fashionAccount.posts.length ? (
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {fashionAccount.posts.map(post => (
                      <article key={post.id} className="overflow-hidden border border-neutral-100">
                        {post.image && <img src={post.image} alt="" className="aspect-square w-full object-cover" loading="lazy" />}
                        <p className="truncate px-2 pt-2 text-[10px] font-medium text-neutral-800">{post.title}</p>
                        <p className="px-2 pb-2 pt-1 text-[9px] text-neutral-500">{post.publicationStatus === 'approved' ? localizeCopy('已发布', 'Pubblicato') : localizeCopy('审核中', 'In revisione')}</p>
                      </article>
                    ))}
                  </div>
                ) : <p className="mt-2 text-xs text-neutral-500">{localizeCopy('还没有作品。', 'Non hai ancora pubblicato contenuti.')}</p>}
              </section>
              <section className="border border-neutral-200 bg-white p-4">
                <h3 className="text-xs font-semibold text-neutral-950">{localizeCopy('我的收藏', 'I miei salvati')}</h3>
                {fashionAccount.savedPosts.length ? (
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {fashionAccount.savedPosts.map(post => (
                      <article key={post.id} className="overflow-hidden border border-neutral-100">
                        {post.image && <img src={post.image} alt="" className="aspect-square w-full object-cover" loading="lazy" />}
                        <p className="truncate p-2 text-[10px] font-medium text-neutral-800">{post.title}</p>
                      </article>
                    ))}
                  </div>
                ) : <p className="mt-2 text-xs text-neutral-500">{localizeCopy('还没有收藏内容。', 'Non hai ancora salvato contenuti.')}</p>}
              </section>
            </>
          ) : null}
        </section>
      ) : activePanel === 'settings' ? (
        <section aria-label={localizeCopy('账户偏好设置', 'Preferenze account')} className="space-y-3">
          <p className="text-[11px] text-neutral-500" role="status">
            {canSyncPreferences
              ? accountPreferencesSynced
                ? (localizeCopy('偏好已同步到 RUDA 账户，可在其他设备恢复。', 'Sincronizzato con il tuo account RUDA.'))
                : accountPreferencesSyncError
                  ? (localizeCopy('偏好同步失败，请检查网络后重试。', 'Sincronizzazione non riuscita. Controlla la connessione.'))
                  : (localizeCopy('正在同步账户偏好…', 'Sincronizzazione in corso...'))
              : (localizeCopy('偏好保存在本设备；登录账户后可同步。', 'Le preferenze vengono salvate su questo dispositivo.'))}
          </p>
          <div className="divide-y divide-neutral-200 border-y border-neutral-200 bg-white">
            <div className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-semibold">{localizeCopy('网站语言', 'Lingua')}</p>
              </div>
              <LanguagePicker />
            </div>
            <div className="py-3">
              <p className="text-sm font-semibold">{localizeCopy('展示货币', 'Valuta')}</p>
              <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                {currencies.map(currency => <button key={currency} type="button" onClick={() => setDisplayCurrency(currency)} aria-pressed={displayCurrency === currency} className={`min-h-8 border px-2 text-[11px] font-semibold ${displayCurrency === currency ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-300 text-neutral-700 hover:border-neutral-950'}`}>{currency}</button>)}
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="text-sm font-semibold">{localizeCopy('黑白显示模式', 'Modalità bianco e nero')}</p>
              </div>
              <button type="button" role="switch" aria-checked={monochromeMode} aria-label={localizeCopy('黑白显示模式', 'Modalità bianco e nero')} onClick={() => void setMonochromeMode(!monochromeMode)} className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${monochromeMode ? 'bg-neutral-950' : 'bg-neutral-300'}`}>
                <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${monochromeMode ? 'translate-x-5' : 'translate-x-1'}`} />
              </button>
            </div>
            <button type="button" onClick={() => window.dispatchEvent(new Event('ruda:open-analytics-consent'))} className="flex min-h-10 w-full items-center justify-between py-3 text-left text-sm font-semibold text-neutral-800 hover:text-neutral-500">
              {t('analyticsPrivacySettings')}
            </button>
            {authRole === 'buyer' && (
              <div className="space-y-2 py-3">
                <p className="text-sm font-semibold">{localizeCopy('账号登录方式', 'Accesso account')}</p>
                <p className="text-xs leading-5 text-neutral-500">{localizeCopy('绑定后可使用当前微信登录此买家账户；不会变更企业资料或审核状态。', 'Collega WeChat per accedere a questo account buyer senza modificare il profilo o la verifica.')}</p>
                <WeChatLoginButton intent="bind" />
              </div>
            )}
          </div>
        </section>
      ) : activePanel === 'support' ? (
        <section aria-label={localizeCopy('联系平台客服', 'Contatta RUDA')} className="border border-neutral-200 bg-white p-4 sm:p-5">
          <p className="mb-4 text-xs leading-5 text-neutral-500">{localizeCopy('填写问题和联系方式，客服工单会提交至平台总后台，由团队跟进处理。', 'Descrivi la tua richiesta. Il team ti ricontatterà usando email o telefono.')}</p>
          <form onSubmit={event => void submitSupportRequest(event)} className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-neutral-700">{localizeCopy('姓名', 'Nome')}<input required maxLength={120} value={supportName} onChange={event => setSupportName(event.target.value)} className="mt-1.5 min-h-10 w-full border border-neutral-200 bg-neutral-50 px-3 text-sm font-normal outline-none focus:border-neutral-700" /></label>
            <label className="text-xs font-semibold text-neutral-700">{localizeCopy('邮箱（或电话）', 'Email (o telefono)')}<input type="email" maxLength={254} value={supportEmail} onChange={event => setSupportEmail(event.target.value)} placeholder="name@example.com" className="mt-1.5 min-h-10 w-full border border-neutral-200 bg-neutral-50 px-3 text-sm font-normal outline-none focus:border-neutral-700" /></label>
            <label className="text-xs font-semibold text-neutral-700">{localizeCopy('联系电话（或邮箱）', 'Telefono (o email)')}<PhoneNumberInput country={supportPhoneCountry} onCountryChange={setSupportPhoneCountry} value={supportPhone} onChange={setSupportPhone} maxLength={32} className="mt-1.5 min-h-10 w-full" inputClassName="bg-neutral-50 text-sm focus:border-neutral-700 focus:ring-0" countrySelectClassName="min-h-10 text-xs" /></label>
            <label className="text-xs font-semibold text-neutral-700">{localizeCopy('咨询主题', 'Oggetto')}<input required maxLength={120} value={supportSubject} onChange={event => setSupportSubject(event.target.value)} className="mt-1.5 min-h-10 w-full border border-neutral-200 bg-neutral-50 px-3 text-sm font-normal outline-none focus:border-neutral-700" /></label>
            <label className="text-xs font-semibold text-neutral-700 sm:col-span-2">{localizeCopy('问题描述', 'Messaggio')}<textarea required minLength={10} maxLength={4000} rows={4} value={supportMessage} onChange={event => setSupportMessage(event.target.value)} placeholder={localizeCopy('请描述问题（至少 10 个字符）...', 'Scrivi almeno 10 caratteri...')} className="mt-1.5 w-full resize-y border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-normal outline-none focus:border-neutral-700" /></label>
            {supportError && <p role="alert" className="text-xs text-rose-700 sm:col-span-2">{supportError}</p>}
            {supportSubmitted && <p role="status" className="text-xs text-emerald-700 sm:col-span-2">{localizeCopy('咨询已登记，已同步到 RUDA 平台后台。', 'La richiesta è stata registrata nel sistema RUDA.')}</p>}
            <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
              <p className="text-[11px] text-neutral-500">{localizeCopy('邮箱和电话至少填写一项。', 'È necessario indicare almeno un recapito.')}</p>
              <button type="submit" disabled={supportBusy} className="inline-flex min-h-10 items-center bg-neutral-950 px-4 text-xs font-semibold text-white hover:bg-neutral-700 disabled:cursor-wait disabled:opacity-50">{supportBusy ? (localizeCopy('提交中…', 'Invio...')) : (localizeCopy('提交客服咨询', 'Invia richiesta'))}</button>
            </div>
          </form>
        </section>
      ) : activePanel === 'join' ? (
        <section className="border border-neutral-200 bg-white p-5 sm:p-6">
          <h2 className="font-serif text-2xl font-medium">{localizeCopy('让你的时尚生意连接欧洲市场。', 'Porta la tua attività nella moda europea.')}</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">{localizeCopy('生产商、批发商、零售商均可申请入驻，展示商品并拓展欧洲商业合作。', 'Candidati come produttore, grossista o rivenditore e presenta il tuo business alla rete RUDA.')}</p>
          <button type="button" onClick={() => setCurrentView('register_wholesale')} className="mt-5 inline-flex min-h-10 items-center bg-neutral-950 px-4 text-xs font-semibold text-white hover:bg-neutral-700">{localizeCopy('开始申请入驻', 'Richiedi l’accesso')}</button>
        </section>
      ) : activePanel === 'services' ? (
        <nav aria-label={localizeCopy('RUDA 平台服务', 'Servizi RUDA')} className="divide-y divide-neutral-200 border-y border-neutral-200 bg-white">
          {destinations.map(item => {
            return <button key={item.label} type="button" onClick={() => navigate(item.view, item.path)} className="flex min-h-12 w-full items-center px-3 py-2.5 text-left text-sm font-semibold text-neutral-800 hover:bg-neutral-50 sm:px-4">{item.label}</button>;
          })}
        </nav>
      ) : null}
    </div>
  );
};

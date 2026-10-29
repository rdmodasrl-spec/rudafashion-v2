import React, { useState } from 'react';
import { useB2B } from '../../../../context/B2BContext';
import { GoogleSignInButton } from './GoogleSignInButton';
import { AuthErrorMessage, AuthField, AuthPasswordField, AuthPrimaryButton, AuthShell } from './AuthShell';
import { DEFAULT_MERCHANT_INDUSTRY_TEMPLATE_ID, merchantIndustryTemplates } from '../../../../constants/merchantIndustryTemplates';
import { PORTAL_DOMAINS } from '../../../../shared/portalDomains';

type MerchantLoginProps = {
  initialMode?: 'login' | 'register';
  merchantCenter?: boolean;
  onBack?: () => void;
  onSwitchToRegister?: () => void;
};

export const MerchantLogin: React.FC<MerchantLoginProps> = ({ initialMode = 'login', merchantCenter = false, onBack, onSwitchToRegister }) => {
  const {
    loginAsMerchant,
    loginAsMerchantDemo,
    requestMerchantPasswordReset,
    resetMerchantPassword,
    registerMerchantQuick,
    merchantLoginError,
    t,
    localizeCopy
  } = useB2B();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot-password'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [resetCodeSent, setResetCodeSent] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [industry, setIndustry] = useState(DEFAULT_MERCHANT_INDUSTRY_TEMPLATE_ID);
  const [loading, setLoading] = useState(false);
  const [demoLoginIndustry, setDemoLoginIndustry] = useState('');
  const [accountCreated, setAccountCreated] = useState(false);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const hostname = window.location.hostname.toLowerCase();
  const isB2BPortal = hostname === PORTAL_DOMAINS.merchant || hostname === PORTAL_DOMAINS.ai;
  const showMerchantCenterTitle = merchantCenter || isB2BPortal;
  const openRegistration = () => {
    setErr('');
    setNotice('');
    if (onSwitchToRegister) {
      onSwitchToRegister();
      return;
    }
    if (isB2BPortal) {
      window.location.assign('https://modaui.com/register-wholesale?registration=merchant');
      return;
    }
    setMode('register');
  };
  React.useEffect(() => {
    if (new URLSearchParams(window.location.search).get('mode') === 'register') {
      if (onSwitchToRegister) {
        onSwitchToRegister();
        return;
      }
      setMode('register');
    }
  }, [onSwitchToRegister]);
  React.useEffect(() => {
    if (!merchantLoginError) return;
    if (merchantLoginError.code === 'AUTH_RATE_LIMITED' || merchantLoginError.code === 'REQUEST_FAILED_429') {
      const retryMinutes = Math.max(1, Math.ceil((merchantLoginError.retryAfter || 900) / 60));
      setErr(t('authTooManyAttempts').replace('{minutes}', String(retryMinutes)));
    } else if (merchantLoginError.code === 'MERCHANT_PENDING_REVIEW') {
      setErr(t('authMerchantPending'));
    } else if (merchantLoginError.code === 'MERCHANT_APPLICATION_REQUIRED') {
      setErr(t('authMerchantAccessRequired'));
    } else if (merchantLoginError.code === 'MERCHANT_NOT_FOUND' || merchantLoginError.code === 'WRONG_PASSWORD') {
      setErr(t('authMerchantInvalidLogin'));
    } else {
      setErr(`${t('authLoginFailed')}: ${merchantLoginError.code}`);
    }
  }, [merchantLoginError, t]);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const ok = await loginAsMerchant(email, password);
      if (!ok) {
        setErr(t('authLoginFailed'));
      }
    } catch {
      setErr(t('authLoginFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (industryTemplateId: string) => {
    setErr('');
    setDemoLoginIndustry(industryTemplateId);
    try {
      const ok = await loginAsMerchantDemo(industryTemplateId);
      if (!ok) setErr(localizeCopy('演示商家暂不可用，请稍后重试。', 'Demo non disponibile. Riprova più tardi.'));
    } finally {
      setDemoLoginIndustry('');
    }
  };

  const submitApplication = async (event: React.FormEvent) => {
    event.preventDefault();
    setErr('');
    setNotice('');
    const selectedTemplate = merchantIndustryTemplates.find(template => template.id === industry);
    if (!selectedTemplate || selectedTemplate.status !== 'open') {
      setErr(localizeCopy('请选择已开放的行业后台。', 'Seleziona un backoffice di settore aperto.'));
      return;
    }
    if (password.length < 8) {
      setErr(t('authPasswordTooShort'));
      return;
    }
    if (password !== confirmPassword) {
      setErr(t('authPasswordMismatch'));
      return;
    }
    setLoading(true);
    try {
      const submitted = await registerMerchantQuick(
        email,
        password,
        storeName.trim() || undefined,
        undefined,
        industry
      );
      if (submitted) setAccountCreated(true);
      else setErr(t('authMerchantApplicationError'));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setErr('');
    setNotice('');
    setLoading(true);
    try {
      if (!resetCodeSent) {
        const result = await requestMerchantPasswordReset(email);
        if (!result.ok) {
          setErr(localizeCopy(
            result.error === 'EMAIL_VERIFICATION_NOT_CONFIGURED' || result.error === 'EMAIL_DELIVERY_FAILED'
              ? '邮箱暂时无法发送找回验证码，请联系平台管理员。'
              : '无法发送找回验证码，请稍后重试。',
            'Impossibile inviare il codice di recupero. Riprova più tardi o contatta l’amministratore.'
          ));
          return;
        }
        setResetCodeSent(true);
        setNotice(localizeCopy('如果此邮箱已注册商家账号，找回验证码将发送到该邮箱。', 'Se l’email è associata a un account merchant, riceverai un codice di recupero.'));
        return;
      }
      if (password.length < 8) {
        setErr(t('authPasswordTooShort'));
        return;
      }
      if (password !== confirmPassword) {
        setErr(t('authPasswordMismatch'));
        return;
      }
      const result = await resetMerchantPassword(email, verificationCode, password);
      if (!result.ok) {
        setErr(localizeCopy('验证码错误或已过期，请重新获取后重试。', 'Codice non valido o scaduto. Richiedine uno nuovo.'));
        return;
      }
      setMode('login');
      setPassword('');
      setConfirmPassword('');
      setVerificationCode('');
      setResetCodeSent(false);
      setNotice(localizeCopy('密码已更新，请使用新密码登录。', 'Password aggiornata. Accedi con la nuova password.'));
    } finally {
      setLoading(false);
    }
  };

  if (accountCreated) {
    return (
      <AuthShell title={t('authMerchantSubmittedTitle')} subtitle={t('authMerchantSubmittedSubtitle')}>
        <div className="space-y-4 p-5 sm:p-7">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {t('authMerchantReviewNotice')}
          </div>
          <button type="button" onClick={() => { setMode('login'); setAccountCreated(false); }} className="w-full rounded-lg bg-black py-2.5 text-sm font-semibold text-white">
            {t('authMerchantReturnLogin')}
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={mode === 'register' ? undefined : mode === 'login' ? (showMerchantCenterTitle ? localizeCopy('企业中心', 'Centro aziendale') : t('authMerchantLoginTitle')) : localizeCopy('找回商家密码', 'Recupera password merchant')}
      showBrand={!isB2BPortal}
      subtitle={mode === 'login'
        ? undefined
        : mode === 'register' ? undefined : localizeCopy('通过商家注册邮箱验证并设置新密码。', 'Verifica l’email merchant e imposta una nuova password.')}
      compact={mode === 'register'}
    >
        <div className={`${mode === 'register' ? 'px-4 pt-4 sm:px-6' : 'px-6 pt-6 sm:px-8'}`}>
          {onBack && (
            <button type="button" onClick={onBack} className="mb-3 text-xs font-semibold text-neutral-600 hover:text-neutral-950">
              {localizeCopy('返回', 'Indietro')}
            </button>
          )}
        </div>
        <form onSubmit={mode === 'login' ? handle : mode === 'register' ? submitApplication : handlePasswordReset} className={`${mode === 'register' ? 'space-y-3 p-4 sm:p-6' : 'space-y-4 p-5 sm:p-7'}`}>
            <AuthField
              label={mode === 'login' ? t('authMerchantEmailPhone') : t('authMerchantRegisterEmail')}
              type={mode === 'login' ? 'text' : 'email'}
              value={email}
              onChange={event => setEmail(event.target.value.trim())}
              autoComplete="username"
              required
              compact={mode === 'register'}
            />

            {mode === 'register' && (
              <>
                <label className="block text-xs font-semibold text-neutral-700">
                  {localizeCopy('经营类型（当前正式开放）', 'Tipo attività aperto')}
                  <select
                    value={industry}
                    onChange={event => setIndustry(event.target.value as typeof industry)}
                    required
                    className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base font-normal text-neutral-900"
                  >
                    {merchantIndustryTemplates.map(template => (
                      <option key={template.id} value={template.id} disabled={template.status !== 'open'}>
                        {localizeCopy(template.zh, template.it)}{template.status === 'open' ? '' : localizeCopy('（暂未开放）', ' (non ancora aperto)')}
                      </option>
                    ))}
                  </select>
                </label>
                <AuthField label={t('authMerchantStoreName')} value={storeName} onChange={event => setStoreName(event.target.value)} compact />
              </>
            )}

            {mode !== 'forgot-password' || resetCodeSent ? (
              <AuthPasswordField
                label={mode === 'login' ? t('authPassword') : localizeCopy('新密码', 'Nuova password')}
                value={password}
                onChange={event => setPassword(event.target.value)}
                minLength={mode === 'login' ? undefined : 8}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder={mode === 'register' ? t('authMerchantPasswordMin') : undefined}
                required
                compact={mode === 'register'}
              />
            ) : null}

            {mode === 'register' && (
              <AuthPasswordField label={t('authConfirmPassword')} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} autoComplete="new-password" required compact />
            )}

            {mode === 'forgot-password' && resetCodeSent && (
              <AuthField
                label={localizeCopy('邮箱验证码', 'Codice email')}
                value={verificationCode}
                onChange={event => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
              />
            )}
            {mode === 'forgot-password' && resetCodeSent && (
              <AuthPasswordField label={t('authConfirmPassword')} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} autoComplete="new-password" required />
            )}
            {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{notice}</div>}
            {err && <AuthErrorMessage>{err}</AuthErrorMessage>}

            <AuthPrimaryButton
              type="submit"
              disabled={loading}
            >
              {loading
                ? t('authProcessing')
                : mode === 'login'
                  ? t('authMerchantLoginButton')
                  : mode === 'register'
                      ? t('authMerchantCreateAccountButton')
                      : resetCodeSent
                      ? localizeCopy('更新密码', 'Aggiorna password')
                      : localizeCopy('发送找回验证码', 'Invia codice di recupero')}
            </AuthPrimaryButton>
            {mode === 'login' && (
              <>
                <button type="button" onClick={() => { setMode('forgot-password'); setErr(''); setNotice(''); setResetCodeSent(false); setVerificationCode(''); }} className="w-full text-xs font-semibold text-neutral-600 hover:text-black">
                  {localizeCopy('忘记密码？通过邮箱找回', 'Password dimenticata? Recuperala via email')}
                </button>
                <button type="button" onClick={openRegistration} className="w-full text-xs font-semibold text-neutral-600 hover:text-black">
                  {t('authMerchantNewAccount')}
                </button>
                <section aria-labelledby="merchant-demo-heading" className="border-t border-neutral-200 pt-4">
                  <h2 id="merchant-demo-heading" className="text-sm font-semibold text-neutral-900">
                    RUDA 七行业闭环演示
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-neutral-600">
                    独立演示商家与测试数据，不影响正式商家。
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {merchantIndustryTemplates.filter(template => template.status === 'open').map(template => (
                      <button
                        key={template.id}
                        type="button"
                        disabled={loading || Boolean(demoLoginIndustry)}
                        onClick={() => void handleDemoLogin(template.id)}
                        className="min-h-10 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-left text-xs font-medium text-neutral-800 transition hover:border-neutral-700 hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {demoLoginIndustry === template.id
                          ? localizeCopy(`正在进入${template.zh}…`, `Accesso a ${template.it}…`)
                          : localizeCopy(template.zh, template.it)}
                      </button>
                    ))}
                  </div>
                </section>
              </>
            )}
            {mode === 'forgot-password' && (
              <button type="button" onClick={() => { setMode('login'); setErr(''); setNotice(''); setResetCodeSent(false); setVerificationCode(''); }} className="w-full text-xs font-semibold text-neutral-600 hover:text-black">
                {localizeCopy('返回登录', 'Torna all’accesso')}
              </button>
            )}
        </form>
        <div className={`${mode === 'register' ? 'px-4 pb-4 sm:px-6 sm:pb-6' : 'px-5 pb-6 sm:px-7'}`}>
          {mode !== 'forgot-password' && (mode !== 'register' || industry
            ? <GoogleSignInButton role="merchant" intent={mode === 'register' ? 'register' : 'login'} industry={industry} />
            : <p className="text-center text-xs text-neutral-500">{localizeCopy('使用 Google 注册前，请先在表单中选择行业。', 'Seleziona il settore nel modulo prima di registrarti con Google.')}</p>)}
        </div>
    </AuthShell>
  );
};

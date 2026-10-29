import React, { useState } from 'react';
import { useB2B } from '../../../../context/B2BContext';
import { ArrowLeft, Mail, User } from 'lucide-react';
import { AuthShell } from '../auth/AuthShell';
import { AuthField, AuthPasswordField, AuthPrimaryButton } from '../auth/AuthShell';
import { formatInternationalPhoneNumber, PhoneNumberInput } from '../common/PhoneNumberInput';

const CardShell: React.FC<React.PropsWithChildren<{
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onSwitchAccount?: () => void;
}>>
  = ({ children, title, subtitle, onBack, onSwitchAccount }) => {
  const { t, localizeCopy } = useB2B();
  return (
  <AuthShell
    title={title}
    subtitle={subtitle}
    onBack={onSwitchAccount}
    backLabel={localizeCopy('切换账号类型', 'Cambia tipo di account')}
  >
      <div className="p-6">
        {onBack && (
          <button type="button" onClick={onBack} className="mb-5 inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-950 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> {t('authBackHome')}
          </button>
        )}
        {children}
      </div>
  </AuthShell>
  );
};

export const ConsumerLogin: React.FC<{ onBackToAuth?: () => void }> = ({ onBackToAuth }) => {
  const { loginAsConsumer, setCurrentView, t } = useB2B();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    await loginAsConsumer(email.trim(), password);
    setLoading(false);
  };
  return (
    <CardShell
      title={t('authRetailSignIn')}
      onBack={onBackToAuth ? undefined : () => setCurrentView('home')}
      onSwitchAccount={onBackToAuth}
    >
      <form onSubmit={submit} className="space-y-4">
        <AuthField label={t('authEmail')} type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" />
        <AuthPasswordField label={t('authPassword')} autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} placeholder={t('authPassword')} />
        <AuthPrimaryButton type="submit" disabled={loading}>
          {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : null}
          {loading ? t('authSignInLoading') : t('authSignIn')}
        </AuthPrimaryButton>
      </form>
      <div className="mt-6 pt-5 border-t border-neutral-200/70">
        <button type="button" onClick={() => setCurrentView('register_wholesale')} className="ui-secondary-button w-full">
          {t('authCreateAccount')}
        </button>
      </div>
    </CardShell>
  );
};

export const ConsumerRegister: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { registerConsumer, setCurrentView, t, localizeCopy } = useB2B();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPwd: '', phone: '', country: 'Italy', newsletter: false });
  const [phoneCountry, setPhoneCountry] = useState('Italy');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);
  const patch = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(prev => ({ ...prev, [k]: v }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPwd) { alert(t('authPasswordMismatch')); return; }
    if (!acceptedTerms || !acceptedPrivacy) {
      alert(localizeCopy('请先阅读并分别同意服务条款和隐私政策。', 'Leggi e accetta i Termini di servizio e l’Informativa sulla privacy.'));
      return;
    }
    setLoading(true);
    const ok = await registerConsumer({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      password: form.password,
      phone: form.phone ? formatInternationalPhoneNumber(phoneCountry, form.phone) : undefined,
      country: form.country || undefined,
      newsletterOptIn: !!form.newsletter,
      acceptedTerms,
      acceptedPrivacy
    });
    setLoading(false);
    if (!ok) return;
    setCurrentView('consumer_store');
  };
  return (
    <CardShell title={t('authRetailCreate')} onBack={onBack || (() => setCurrentView('home'))}>
      <form onSubmit={submit} className="space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="ui-section-title block mb-1.5">{t('authRetailLastName')}</span>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input required value={form.lastName} onChange={e => patch('lastName', e.target.value)} className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/50 text-sm focus:border-neutral-900 focus:bg-white focus:outline-none" />
            </div>
          </label>
          <label className="block">
            <span className="ui-section-title block mb-1.5">{t('authRetailFirstName')}</span>
            <input required value={form.firstName} onChange={e => patch('firstName', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/50 text-sm focus:border-neutral-900 focus:bg-white focus:outline-none" />
          </label>
        </div>
        <label className="block">
          <span className="ui-section-title block mb-1.5">{t('authEmail')}</span>
          <div className="relative">
            <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input type="email" required value={form.email} onChange={e => patch('email', e.target.value)} className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/50 text-sm focus:border-neutral-900 focus:bg-white focus:outline-none" />
          </div>
        </label>
        <label className="block">
          <span className="ui-section-title block mb-1.5">{t('authRetailPhoneOptional')}</span>
          <PhoneNumberInput
            country={phoneCountry}
            onCountryChange={country => { setPhoneCountry(country); patch('country', country); }}
            value={form.phone}
            onChange={phone => patch('phone', phone)}
            className="w-full"
            inputClassName="border-neutral-200 bg-neutral-50/50 focus:border-neutral-900 focus:bg-white focus:outline-none"
            placeholder="333 1234567"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <AuthPasswordField label={t('authPassword')} required minLength={8} value={form.password} onChange={e => patch('password', e.target.value)} placeholder={t('authRetailPasswordRule')} className="py-2.5" />
          </div>
          <div>
            <AuthPasswordField label={t('authConfirmPassword')} required minLength={8} value={form.confirmPwd} onChange={e => patch('confirmPwd', e.target.value)} className="py-2.5" />
          </div>
        </div>
        <label className="flex items-start gap-2 py-1 cursor-pointer select-none">
          <input type="checkbox" checked={form.newsletter} onChange={e => patch('newsletter', e.target.checked)} className="mt-1 w-4 h-4 accent-neutral-900" />
          <span className="text-xs text-neutral-600 leading-5">
            {t('authRetailNewsletter')}
          </span>
        </label>
        <label className="flex items-start gap-2 py-1 text-xs leading-5 text-neutral-600">
          <input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} className="mt-1 h-4 w-4 accent-neutral-900" />
          <span>{localizeCopy('我已阅读并同意', 'Ho letto e accetto')} <a href="/about#terms" className="font-semibold text-neutral-900 underline">{localizeCopy('《服务条款》', 'i Termini di servizio')}</a></span>
        </label>
        <label className="flex items-start gap-2 py-1 text-xs leading-5 text-neutral-600">
          <input type="checkbox" checked={acceptedPrivacy} onChange={e => setAcceptedPrivacy(e.target.checked)} className="mt-1 h-4 w-4 accent-neutral-900" />
          <span>{localizeCopy('我已阅读并同意', 'Ho letto e accetto')} <a href="/about#privacy" className="font-semibold text-neutral-900 underline">{localizeCopy('《隐私政策》', 'l’Informativa sulla privacy')}</a></span>
        </label>
        <button type="submit" disabled={loading} className="ui-primary-button w-full flex items-center justify-center gap-2 disabled:opacity-60">
          {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
          {loading ? t('authSubmitting') : t('authRetailSubmit')}
        </button>
      </form>
      <div className="mt-5 pt-4 border-t border-neutral-200/70 text-center">
        <button type="button" onClick={() => setCurrentView('consumer_login')} className="ui-secondary-button w-full">
          {t('authSignIn')}
        </button>
      </div>
    </CardShell>
  );
};

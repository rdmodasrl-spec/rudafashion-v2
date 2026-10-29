import React, { useEffect, useState } from 'react';
import { ArrowRight, Mail, Smartphone } from 'lucide-react';
import { useB2B } from '../../../../context/B2BContext';
import { GoogleSignInButton } from './GoogleSignInButton';
import { AuthShell } from './AuthShell';
import { formatInternationalPhoneNumber, PhoneNumberInput } from '../common/PhoneNumberInput';

type LoginChannel = 'email' | 'phone';

const errorMessages: Record<string, { zh: string; it: string }> = {
  EMAIL_VERIFICATION_NOT_CONFIGURED: { zh: '邮箱验证码服务暂不可用，请稍后重试。', it: 'La verifica email non è disponibile al momento.' },
  SMS_VERIFICATION_NOT_CONFIGURED: { zh: '短信验证码服务暂不可用，请稍后重试。', it: 'La verifica SMS non è disponibile al momento.' },
  EMAIL_DELIVERY_FAILED: { zh: '验证码发送失败，请检查邮箱后重试。', it: 'Invio del codice non riuscito.' },
  SMS_DELIVERY_FAILED: { zh: '短信发送失败，请检查手机号后重试。', it: 'Invio dell’SMS non riuscito.' },
  VERIFICATION_CODE_COOLDOWN: { zh: '操作太频繁，请稍后再试。', it: 'Attendi prima di richiedere un altro codice.' },
  VERIFICATION_METHOD_DISABLED: { zh: '此验证方式暂不可用。', it: 'Questo metodo di verifica non è disponibile.' },
  INVALID_OR_EXPIRED_CODE: { zh: '验证码错误或已过期，请重新获取。', it: 'Codice non valido o scaduto.' },
  VALID_EMAIL_REQUIRED: { zh: '请输入有效的邮箱地址。', it: 'Inserisci un indirizzo email valido.' },
  VALID_E164_PHONE_REQUIRED: { zh: '请输入带国家区号的手机号，例如 +393331234567。', it: 'Inserisci il numero con prefisso internazionale, ad esempio +393331234567.' }
};

export const CustomerLogin: React.FC<{ onBackToHub?: () => void }> = ({ onBackToHub }) => {
  const { requestCustomerLoginCode, verifyCustomerLoginCode, lang, localizeCopy } = useB2B();
  const isZh = lang === 'zh';
  const [channel, setChannel] = useState<LoginChannel>('email');
  const [destination, setDestination] = useState('');
  const [phoneCountry, setPhoneCountry] = useState('Italy');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setInterval(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const messageFor = (key?: string) => {
    if (!key) return localizeCopy("操作失败，请稍后重试。", "Operazione non riuscita. Riprova.");
    const translated = errorMessages[key];
    return translated ? (isZh ? translated.zh : translated.it) : key;
  };

  const requestCode = async () => {
    setError('');
    setLoading(true);
    const result = await requestCustomerLoginCode(channel, requestDestination);
    setLoading(false);
    if (!result.ok) {
      setError(messageFor(result.error));
      if (result.retryAfter) setCooldown(result.retryAfter);
      return;
    }
    setCodeSent(true);
    setCooldown(result.retryAfter || 60);
  };

  const verifyCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    const result = await verifyCustomerLoginCode(channel, requestDestination, code);
    setLoading(false);
    if (!result.ok) setError(messageFor(result.error));
  };

  const DestinationIcon = channel === 'email' ? Mail : Smartphone;
  const requestDestination = channel === 'phone'
    ? formatInternationalPhoneNumber(phoneCountry, destination)
    : destination;

  return (
    <AuthShell
      onBack={onBackToHub}
      backLabel={localizeCopy('返回', 'Indietro')}
    >
      <form onSubmit={verifyCode} className="space-y-5 p-6 sm:p-8">
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-neutral-100 p-1">
          {(['email', 'phone'] as const).map(option => (
            <button
              key={option}
              type="button"
              aria-pressed={channel === option}
              onClick={() => {
                setChannel(option);
                setDestination('');
                setCodeSent(false);
                setCode('');
                setError('');
              }}
              className={`min-h-10 rounded-md text-xs font-semibold transition-colors ${channel === option ? 'bg-white text-neutral-950 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}
            >
              {option === 'email' ? (localizeCopy("邮箱", "Email")) : (localizeCopy("手机号", "Telefono"))}
            </button>
          ))}
        </div>

        <div>
          <label htmlFor="customer-login-destination" className="mb-1.5 block text-xs font-semibold text-neutral-600">
            {channel === 'email' ? (localizeCopy("邮箱地址", "Indirizzo email")) : (localizeCopy("手机号", "Telefono"))}
          </label>
          <div className="relative">
            <DestinationIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            {channel === 'email' ? <input
              id="customer-login-destination"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={destination}
              onChange={event => setDestination(event.target.value)}
              placeholder="name@example.com"
              required
              className="w-full rounded-lg border border-neutral-300 py-2.5 pl-10 pr-3 text-sm transition-all focus:border-black focus:outline-none focus:ring-2 focus:ring-black"
            /> : <PhoneNumberInput
              id="customer-login-destination"
              country={phoneCountry}
              onCountryChange={country => { setPhoneCountry(country); setCodeSent(false); setCode(''); setError(''); }}
              value={destination}
              onChange={phone => { setDestination(phone); setCodeSent(false); setCode(''); setError(''); }}
              placeholder="333 1234567"
              className="pl-10"
            />}
          </div>
        </div>

        {codeSent && (
          <div>
            <label htmlFor="customer-login-code" className="mb-1.5 block text-xs font-semibold text-neutral-600">
              {localizeCopy("6 位验证码", "Codice a 6 cifre")}
            </label>
            <input
              id="customer-login-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={event => setCode(event.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              required
              className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm tracking-[0.3em] focus:border-black focus:outline-none focus:ring-2 focus:ring-black"
            />
            <button type="button" onClick={() => void requestCode()} disabled={loading || cooldown > 0} className="mt-2 text-xs font-semibold text-neutral-600 underline disabled:no-underline disabled:opacity-50">
              {cooldown > 0
                ? (isZh ? `${cooldown} 秒后可重新发送` : `Riprova tra ${cooldown}s`)
                : (localizeCopy("重新发送验证码", "Invia di nuovo il codice"))}
            </button>
          </div>
        )}

        {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        {!codeSent ? (
          <button type="button" onClick={() => void requestCode()} disabled={loading || !destination.trim()} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 disabled:opacity-60">
            {loading ? (localizeCopy("正在发送…", "Invio…")) : (localizeCopy("登录 / 注册", "Accedi / Registrati"))}
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button type="submit" disabled={loading || code.length !== 6} className="flex min-h-11 w-full items-center justify-center rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 disabled:opacity-60">
            {loading ? (localizeCopy("验证中…", "Verifica…")) : (localizeCopy("验证并继续", "Verifica e continua"))}
          </button>
        )}

        <GoogleSignInButton role="customer" />

      </form>
    </AuthShell>
  );
};

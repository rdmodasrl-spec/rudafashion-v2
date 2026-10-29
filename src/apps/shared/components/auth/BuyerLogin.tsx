import React, { useEffect, useState } from 'react';
import { useB2B } from '../../../../context/B2BContext';
import { GoogleSignInButton } from './GoogleSignInButton';
import { WeChatLoginButton } from './WeChatLoginButton';
import { AuthErrorMessage, AuthField, AuthPasswordField, AuthPrimaryButton, AuthShell } from './AuthShell';

export const BuyerLogin: React.FC<{ onSwitchToRegister: () => void; onBackToAuth?: () => void }> = ({ onSwitchToRegister, onBackToAuth }) => {
  const { loginAsBusiness, t, localizeCopy } = useB2B();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('wechat_login');
    const error = params.get('wechat_login_error');
    if (result === 'success') {
      setNotice(localizeCopy('微信登录成功；如为新账户，请补全企业资料并等待审核。', 'Accesso WeChat riuscito. Completa il profilo aziendale e attendi la verifica.'));
    } else if (result === 'bound') {
      setNotice(localizeCopy('微信账号绑定成功，现在可以使用微信登录。', 'WeChat è collegato. Ora puoi usarlo per accedere.'));
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
      setErr(message);
    } else {
      return;
    }
    params.delete('wechat_login');
    params.delete('wechat_login_error');
    const query = params.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
  }, [localizeCopy]);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const ok = await loginAsBusiness(identifier, password);
      if (!ok) {
        setErr(t('authBuyerInvalid'));
      }
    } catch (e) {
      setErr(t('authBuyerInvalid'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={localizeCopy('企业中心', 'Centro aziendale')}
      showBrand={false}
      onBack={onBackToAuth}
      backLabel={localizeCopy('返回', 'Indietro')}
    >
        <form onSubmit={handle} className="space-y-4 p-5 sm:p-7">
            <AuthField label={t('authEmailOrPhone')} type="text" value={identifier} onChange={event => setIdentifier(event.target.value)} placeholder={t('authEmailOrPhone')} autoComplete="username" required />
            <AuthPasswordField label={t('authPassword')} value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required />

            {err && <AuthErrorMessage>{err}</AuthErrorMessage>}
            {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}

            <AuthPrimaryButton
              type="submit"
              disabled={loading}
            >
              {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
              {loading ? t('authSignInLoading') : t('authSignIn')}
            </AuthPrimaryButton>

            <GoogleSignInButton role="buyer" />
            <WeChatLoginButton />

            <button
              type="button"
              onClick={onSwitchToRegister}
              className="min-h-11 w-full rounded-lg border border-neutral-300 bg-white py-2.5 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50 flex items-center justify-center gap-2"
            >
              {t('authCreateAccount')}
            </button>
        </form>
    </AuthShell>
  );
};

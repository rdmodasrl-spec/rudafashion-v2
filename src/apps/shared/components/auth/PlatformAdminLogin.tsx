import React, { useState } from 'react';
import { Shield } from 'lucide-react';
import { useB2B } from '../../../../context/B2BContext';
import { AuthErrorMessage, AuthField, AuthPasswordField, AuthPrimaryButton, AuthShell } from './AuthShell';

export const PlatformAdminLogin: React.FC<{ onBackToAuth?: () => void }> = ({ onBackToAuth }) => {
  const { loginAsAdmin, adminLoginError, t, localizeCopy } = useB2B();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const displayedError = adminLoginError === 'ADMIN_NOT_FOUND' || adminLoginError === 'WRONG_PASSWORD'
      ? t('authAdminCredentialsInvalid')
      : adminLoginError === 'ADMIN_OTP_REQUIRED' || adminLoginError === 'INVALID_OTP'
        ? t('authAdminOtpInvalid')
        : adminLoginError === 'ADMIN_2FA_CONFIGURATION_INVALID'
          ? t('authAdminTwoFactorConfig')
    : err;

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const ok = await loginAsAdmin(username, password, otp || undefined);
      if (!ok) {
        setErr(t('authLoginFailed'));
      }
    } catch {
      setErr(t('authLoginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={localizeCopy('RUDA中心', 'Centro RUDA')}
      showBrand={false}
      onBack={onBackToAuth}
      backLabel={localizeCopy('返回', 'Indietro')}
    >
          <form onSubmit={handle} className="space-y-4 p-5 sm:p-7">
            <AuthField label={t('authAdminUsername')} value={username} onChange={event => setUsername(event.target.value.trim())} autoComplete="username" required />
            <AuthPasswordField label={t('authPassword')} value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required />
            {(adminLoginError === 'ADMIN_OTP_REQUIRED' || adminLoginError === 'INVALID_OTP') && (
              <AuthField
                label={localizeCopy('6 位动态验证码或一次性恢复码', 'Codice dinamico a 6 cifre o codice di recupero monouso')}
                inputMode="text"
                autoComplete="one-time-code"
                value={otp}
                onChange={event => setOtp(event.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20).toUpperCase())}
                maxLength={20}
                autoFocus
              />
            )}
            {displayedError && <AuthErrorMessage>{displayedError}</AuthErrorMessage>}

            <AuthPrimaryButton
              type="submit"
              disabled={loading}
            >
              <Shield className="h-4 w-4" />
              {loading
                ? t('authAdminVerifying')
                : t('authAdminSubmit')}
            </AuthPrimaryButton>
          </form>
    </AuthShell>
  );
};

import React, { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { apiPost, ApiError } from '../../../../api/client';
import { useB2B } from '../../../../context/B2BContext';
import { PasswordInput } from '../common/PasswordInput';
import { MINIMUM_PASSWORD_LENGTH } from '../../../../shared/passwordPolicy';

type PasswordChangeFormProps = {
  audience: 'admin' | 'merchant';
};

export const PasswordChangeForm: React.FC<PasswordChangeFormProps> = ({ audience }) => {
  const { localizeCopy } = useB2B();
  const minimumPasswordLength = MINIMUM_PASSWORD_LENGTH;
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (newPassword.length < minimumPasswordLength || newPassword.trim().length < minimumPasswordLength) {
      const message = audience === 'admin'
        ? localizeCopy('管理员密码至少需要 12 个字符。', 'La password admin deve contenere almeno 12 caratteri.')
        : localizeCopy('新密码至少需要 12 个字符。', 'La nuova password deve contenere almeno 12 caratteri.');
      setError(message);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(localizeCopy('两次输入的新密码不一致。', 'Le nuove password non corrispondono.'));
      return;
    }
    if (newPassword === currentPassword) {
      setError(localizeCopy('新密码不能与当前密码相同。', 'La nuova password deve essere diversa da quella attuale.'));
      return;
    }

    setBusy(true);
    try {
      await apiPost(`/api/auth/${audience}/password/change`, { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess(localizeCopy('密码修改成功。', 'Password aggiornata correttamente.'));
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.code === 'CURRENT_PASSWORD_INVALID') {
        setError(localizeCopy('当前密码不正确，请重试。', 'La password attuale non è corretta.'));
      } else if (requestError instanceof ApiError && requestError.status === 401) {
        setError(localizeCopy('登录状态已过期，请重新登录后再修改密码。', 'La sessione è scaduta. Accedi di nuovo per modificare la password.'));
      } else {
        setError(requestError instanceof Error
          ? requestError.message
          : localizeCopy('密码修改失败，请稍后重试。', 'Impossibile aggiornare la password. Riprova.'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-neutral-800" />
        <h2 className="text-sm font-bold text-neutral-950">
          {localizeCopy('修改登录密码', 'Modifica password')}
        </h2>
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        {audience === 'admin'
          ? localizeCopy('修改后，管理员新密码至少需要 12 个字符。', 'La nuova password admin deve contenere almeno 12 caratteri.')
          : localizeCopy('修改后新密码立即生效，至少 12 个字符。', 'La nuova password è attiva subito e deve contenere almeno 12 caratteri.')}
      </p>
      <form onSubmit={submit} className="mt-4 max-w-xl space-y-3">
        <PasswordInput
          aria-label={localizeCopy('当前密码', 'Password attuale')}
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={event => setCurrentPassword(event.target.value)}
          placeholder={localizeCopy('当前密码', 'Password attuale')}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 pr-10 text-sm"
        />
        <PasswordInput
          aria-label={localizeCopy(`新密码（至少 ${minimumPasswordLength} 个字符）`, `Nuova password (min. ${minimumPasswordLength} caratteri)`)}
          autoComplete="new-password"
          minLength={minimumPasswordLength}
          required
          value={newPassword}
          onChange={event => setNewPassword(event.target.value)}
          placeholder={localizeCopy(`新密码（至少 ${minimumPasswordLength} 个字符）`, `Nuova password (min. ${minimumPasswordLength} caratteri)`)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 pr-10 text-sm"
        />
        <PasswordInput
          aria-label={localizeCopy('确认新密码', 'Conferma nuova password')}
          autoComplete="new-password"
          minLength={minimumPasswordLength}
          required
          value={confirmPassword}
          onChange={event => setConfirmPassword(event.target.value)}
          placeholder={localizeCopy('确认新密码', 'Conferma nuova password')}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 pr-10 text-sm"
        />
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        {success && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{success}</p>}
        <button type="submit" disabled={busy} className="rounded-lg bg-neutral-950 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">
          {busy ? localizeCopy('正在保存…', 'Salvataggio…') : localizeCopy('更新密码', 'Aggiorna password')}
        </button>
      </form>
    </section>
  );
};

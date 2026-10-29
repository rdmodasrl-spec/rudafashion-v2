import React, { useState } from 'react';
import { apiPost } from '../../../../api/client';
import { useB2B } from '../../../../context/B2BContext';
import { AuthErrorMessage, AuthField, AuthPasswordField, AuthPrimaryButton, AuthShell } from './AuthShell';

type Props = { onSuccess: () => void; onBackToAuth?: () => void };
type EmployeeWorkspace = { id: string; name: string; code: string; employeeName: string; role: string };

export const EmployeeLogin: React.FC<Props> = ({ onSuccess, onBackToAuth }) => {
  const { t, localizeCopy } = useB2B();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [workspaces, setWorkspaces] = useState<EmployeeWorkspace[]>([]);
  const submit = async (event?: React.FormEvent, merchantId?: string) => {
    event?.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await apiPost<{ requiresMerchantSelection?: boolean; merchants?: EmployeeWorkspace[] }>(
        '/api/auth/login/employee',
        { email, password, ...(merchantId ? { merchantId } : {}) }
      );
      if (result.requiresMerchantSelection) {
        setWorkspaces(result.merchants || []);
      } else {
        onSuccess();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('authSignIn'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title={localizeCopy('企业中心', 'Centro aziendale')}
      showBrand={false}
      onBack={onBackToAuth}
      backLabel={localizeCopy('返回', 'Indietro')}
    >
      <form onSubmit={event => void submit(event)} className="space-y-4 p-5 sm:p-7">
        <AuthField label={t('authEmployeeEmail')} type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} />
        <AuthPasswordField label={t('authPassword')} autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} />
        {error && <AuthErrorMessage>{error}</AuthErrorMessage>}
        {workspaces.length > 0 && (
          <div className="space-y-2" aria-label={t('authEmployeeWorkspace')}>
            <p className="text-sm font-medium text-neutral-700">{t('authEmployeeWorkspacePrompt')}</p>
            {workspaces.map(workspace => (
              <button
                key={workspace.id}
                type="button"
                disabled={busy}
                onClick={() => void submit(undefined, workspace.id)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-3 text-left text-sm hover:border-neutral-900 disabled:opacity-50"
              >
                <span className="block font-semibold">{workspace.name}</span>
                <span className="mt-1 block text-xs text-neutral-500">{workspace.employeeName} · {workspace.role}</span>
              </button>
            ))}
          </div>
        )}
        <AuthPrimaryButton disabled={busy}>{busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}{busy ? t('authSignInLoading') : t('authSignIn')}</AuthPrimaryButton>
      </form>
    </AuthShell>
  );
};

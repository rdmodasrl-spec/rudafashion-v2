import React from 'react';
import { useState } from 'react';
import { useB2B } from '../../../../context/B2BContext';
import { CustomerLogin } from './CustomerLogin';
import { AuthShell } from './AuthShell';
import { RegistrationPortal } from './RegistrationPortal';

type RegistrationPath = 'choose' | 'frontend' | 'enterprise';

export const RegistrationEntry: React.FC<{ onBack?: () => void; initialPath?: RegistrationPath }> = ({ onBack, initialPath }) => {
  const { localizeCopy, setCurrentView } = useB2B();
  const directEnterpriseRegistration = initialPath === 'enterprise'
    || new URLSearchParams(window.location.search).get('registration') === 'enterprise';
  const [registrationPath, setRegistrationPath] = useState<RegistrationPath>(
    initialPath || (directEnterpriseRegistration ? 'enterprise' : 'choose')
  );
  const goBack = onBack || (() => setCurrentView('home'));
  const backFromEnterprise = () => {
    if (directEnterpriseRegistration) goBack();
    else setRegistrationPath('choose');
  };

  if (registrationPath === 'frontend') {
    return (
      <CustomerLogin
        onBackToHub={() => setRegistrationPath('choose')}
      />
    );
  }
  if (registrationPath === 'enterprise') {
    return <RegistrationPortal onBack={backFromEnterprise} />;
  }

  return (
    <AuthShell
      title={undefined}
      onBack={goBack}
      backLabel={localizeCopy('返回', 'Indietro')}
    >
      <div className="grid grid-cols-2 gap-2 p-5 sm:p-7">
        <button
          type="button"
          onClick={() => setRegistrationPath('frontend')}
          className="min-h-12 border border-neutral-300 px-4 py-3 text-sm font-semibold text-neutral-900 transition-colors hover:border-neutral-950"
        >
          {localizeCopy('前端', 'Sito')}
        </button>
        <button
          type="button"
          onClick={() => setRegistrationPath('enterprise')}
          className="min-h-12 border border-neutral-300 px-4 py-3 text-sm font-semibold text-neutral-900 transition-colors hover:border-neutral-950"
        >
          {localizeCopy('企业中心', 'Centro aziendale')}
        </button>
      </div>
    </AuthShell>
  );
};

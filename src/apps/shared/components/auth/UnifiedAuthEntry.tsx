import React, { useState } from 'react';
import { useB2B } from '../../../../context/B2BContext';
import { BuyerLogin } from './BuyerLogin';
import { CustomerLogin } from './CustomerLogin';
import { EmployeeLogin } from './EmployeeLogin';
import { MerchantLogin } from './MerchantLogin';
import { PlatformAdminLogin } from './PlatformAdminLogin';
import { AuthShell } from './AuthShell';
import { ConsumerLogin } from '../consumer/ConsumerAuth';

export type AuthAccountType = 'customer' | 'buyer' | 'consumer' | 'merchant' | 'employee' | 'admin';

type UnifiedAuthEntryProps = {
  initialRole?: AuthAccountType;
  merchantCenter?: boolean;
  onBack?: () => void;
  onEmployeeSuccess?: () => void;
  onRegister?: () => void;
};

export const UnifiedAuthEntry: React.FC<UnifiedAuthEntryProps> = ({
  initialRole,
  merchantCenter = false,
  onBack,
  onEmployeeSuccess,
  onRegister
}) => {
  const { localizeCopy, setCurrentView } = useB2B();
  const [selectedRole, setSelectedRole] = useState<AuthAccountType | null>(initialRole || null);
  const frontendRole = initialRole && ['customer', 'consumer'].includes(initialRole) ? initialRole : 'customer';
  const backendRole = initialRole && ['buyer', 'merchant', 'employee', 'admin'].includes(initialRole) ? initialRole : 'buyer';
  const showRegistration = () => {
    if (onRegister) onRegister();
    else setCurrentView('register_wholesale');
  };

  if (selectedRole === 'customer') {
    return (
      <CustomerLogin
        onBackToHub={() => setSelectedRole(null)}
      />
    );
  }
  if (selectedRole === 'buyer') {
    return (
      <BuyerLogin
        onBackToAuth={() => setSelectedRole(null)}
        onSwitchToRegister={showRegistration}
      />
    );
  }
  if (selectedRole === 'consumer') {
    return <ConsumerLogin onBackToAuth={() => setSelectedRole(null)} />;
  }
  if (selectedRole === 'merchant') {
    return <MerchantLogin merchantCenter={merchantCenter} onBack={() => setSelectedRole(null)} onSwitchToRegister={showRegistration} />;
  }
  if (selectedRole === 'employee') {
    return <EmployeeLogin onSuccess={onEmployeeSuccess || (() => window.location.reload())} onBackToAuth={() => setSelectedRole(null)} />;
  }
  if (selectedRole === 'admin') {
    return <PlatformAdminLogin onBackToAuth={() => setSelectedRole(null)} />;
  }

  return (
    <AuthShell
      title={undefined}
      onBack={onBack}
      backLabel={localizeCopy('返回', 'Indietro')}
    >
      <div className="space-y-3 p-5 sm:p-7">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSelectedRole(frontendRole)}
            className="min-h-12 border border-neutral-300 px-4 py-3 text-sm font-semibold text-neutral-900 transition-colors hover:border-neutral-950"
          >
            {localizeCopy('前端', 'Sito')}
          </button>
          <button
            type="button"
            onClick={() => setSelectedRole(backendRole)}
            className="min-h-12 border border-neutral-300 px-4 py-3 text-sm font-semibold text-neutral-900 transition-colors hover:border-neutral-950"
          >
            {localizeCopy('企业中心', 'Centro aziendale')}
          </button>
        </div>
      </div>
    </AuthShell>
  );
};

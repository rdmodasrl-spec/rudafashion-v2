import React from 'react';
import { ArrowLeft, Eye, EyeOff, type LucideIcon } from 'lucide-react';
import { useB2B } from '../../../../context/B2BContext';
import { LanguagePicker } from '../common/LanguagePicker';

type AuthShellProps = {
  title?: string;
  subtitle?: string;
  compact?: boolean;
  showBrand?: boolean;
  onBack?: () => void;
  backLabel?: string;
  children: React.ReactNode;
};

export const AuthLanguageSelector: React.FC = () => {
  return <LanguagePicker align="right" />;
};

export const AuthShell: React.FC<AuthShellProps> = ({ title, subtitle, compact = false, showBrand = true, onBack, backLabel, children }) => (
  <main className={`flex min-h-screen items-center justify-center bg-neutral-50 text-neutral-950 ${compact ? 'px-3 py-5 sm:px-4 sm:py-10' : 'px-4 py-8 sm:py-12'}`}>
    <div className={`w-full ${compact ? 'max-w-sm' : 'max-w-md'}`}>
      <div className={`flex items-center justify-between ${compact ? 'mb-2' : 'mb-3'}`}>
        {onBack ? (
          <button type="button" onClick={onBack} className="inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-neutral-600 hover:text-neutral-950">
            <ArrowLeft className="h-3.5 w-3.5" />
            {backLabel || '返回'}
          </button>
        ) : <span />}
        <AuthLanguageSelector />
      </div>
      <header className={`text-center ${compact ? 'mb-4' : 'mb-5 sm:mb-6'}`}>
        {showBrand && <div className={`text-center ${compact ? 'mb-2' : 'mb-3'}`}>
          <span className={`font-brand-display block font-normal leading-none tracking-[0.12em] text-neutral-950 ${compact ? 'text-2xl' : 'text-3xl'}`}>RUDAFASHION</span>
        </div>}
        {!compact && title && <h1 className="text-2xl font-bold tracking-tight">{title}</h1>}
        {!compact && subtitle && <p className="mx-auto mt-2 max-w-sm text-sm leading-5 text-neutral-600">{subtitle}</p>}
      </header>
      <section className={`overflow-hidden rounded-2xl border border-neutral-200 bg-white ${compact ? 'shadow-[0_12px_40px_rgba(15,23,42,0.06)]' : 'shadow-sm'}`}>
        {children}
      </section>
    </div>
  </main>
);

type AuthFieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon?: LucideIcon;
  compact?: boolean;
};

const fieldClassName = 'w-full rounded-lg border border-neutral-300 bg-white py-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 disabled:bg-neutral-100';

export const AuthField: React.FC<AuthFieldProps> = ({ label, icon: Icon, compact = false, className = '', ...inputProps }) => (
  <label className={`block ${compact ? 'space-y-1' : 'space-y-1.5'}`}>
    <span className={`block font-medium text-neutral-700 ${compact ? 'text-xs' : 'text-sm'}`}>{label}</span>
    <span className="relative block">
      {Icon && <Icon aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />}
      <input {...inputProps} className={`${fieldClassName} ${compact ? 'py-2 text-base' : ''} ${Icon ? 'pl-10 pr-3' : 'px-3'} ${className}`} />
    </span>
  </label>
);

type AuthPasswordFieldProps = Omit<AuthFieldProps, 'icon' | 'type'>;

export const AuthPasswordField: React.FC<AuthPasswordFieldProps> = ({ label, compact = false, className = '', ...inputProps }) => {
  const { t } = useB2B();
  const [visible, setVisible] = React.useState(false);
  return (
    <label className={`block ${compact ? 'space-y-1' : 'space-y-1.5'}`}>
      <span className={`block font-medium text-neutral-700 ${compact ? 'text-xs' : 'text-sm'}`}>{label}</span>
      <span className="relative block">
        <input {...inputProps} type={visible ? 'text' : 'password'} className={`${fieldClassName} ${compact ? 'py-2 text-base' : 'py-3'} pl-3 pr-11 ${className}`} />
        <button
          type="button"
          onClick={() => setVisible(value => !value)}
          aria-label={visible ? t('authHidePassword') : t('authShowPassword')}
          title={visible ? t('authHidePassword') : t('authShowPassword')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-950"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </span>
    </label>
  );
};

export const AuthPrimaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = '', children, ...props }) => (
  <button {...props} className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}>
    {children}
  </button>
);

export const AuthErrorMessage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{children}</p>
);

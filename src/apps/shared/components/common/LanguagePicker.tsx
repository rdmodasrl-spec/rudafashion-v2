import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, Globe2 } from 'lucide-react';
import { useB2B } from '../../../../context/B2BContext';
import { LANGUAGE_OPTIONS } from '../../../../i18n/translations';

type LanguagePickerProps = {
  align?: 'left' | 'right';
  placement?: 'bottom' | 'top';
  className?: string;
  disabled?: boolean;
};

export const LanguagePicker: React.FC<LanguagePickerProps> = ({
  align = 'right',
  placement = 'bottom',
  className = '',
  disabled = false
}) => {
  const { languagePreference, setLang, setAutoLanguage, t } = useB2B();
  const [open, setOpen] = useState(false);
  const menuId = `language-picker-${useId()}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const closeOnPointerOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', closeOnPointerOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnPointerOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const chooseAutomatic = () => {
    setAutoLanguage();
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative inline-flex ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={t('authLanguageSelect')}
        aria-expanded={open}
        aria-controls={menuId}
        title={t('authLanguageSelect')}
        disabled={disabled}
        onClick={() => setOpen(value => !value)}
        className="inline-flex h-6 w-6 items-center justify-center rounded-none border border-neutral-300 text-neutral-600 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Globe2 aria-hidden="true" className="h-3 w-3" />
      </button>
      {open && (
        <div
          id={menuId}
          role="group"
          aria-label={t('authLanguageSelect')}
          className={`absolute z-[100] max-h-72 min-w-48 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-1.5 text-neutral-900 shadow-xl ${
            placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
          } ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          <button
            type="button"
            aria-pressed={languagePreference === 'auto'}
            onClick={chooseAutomatic}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
          >
            <span>{t('authLanguageAuto')}</span>
            {languagePreference === 'auto' && <Check aria-hidden="true" className="h-3.5 w-3.5" />}
          </button>
          {LANGUAGE_OPTIONS.map(language => (
            <button
              key={language.code}
              type="button"
              aria-pressed={languagePreference === language.code}
              onClick={() => {
                setLang(language.code);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
            >
              <span>{language.nativeName}</span>
              {languagePreference === language.code && <Check aria-hidden="true" className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

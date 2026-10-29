import React from 'react';
import { countryCallingCodes, phoneCountryOptions } from '../../../../constants/countries';

type PhoneNumberInputProps = {
  country: string;
  onCountryChange?: (country: string) => void;
  value: string;
  onChange: (value: string) => void;
  id?: string;
  className?: string;
  inputClassName?: string;
  countrySelectClassName?: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  autoComplete?: string;
  disabled?: boolean;
};

export const formatInternationalPhoneNumber = (country: string, phone: string) => {
  const callingCode = countryCallingCodes[country];
  if (!callingCode) throw new Error(`No calling code is configured for ${country}`);
  const digits = phone.replace(/\D/g, '');
  if (phone.trimStart().startsWith('+')) return digits ? `+${digits}` : '';
  const nationalNumber = country === 'Italy' ? digits : digits.replace(/^0+/, '');
  return nationalNumber ? `+${callingCode}${nationalNumber}` : '';
};

export const PhoneNumberInput: React.FC<PhoneNumberInputProps> = ({
  country,
  onCountryChange,
  value,
  onChange,
  id,
  className = '',
  inputClassName = '',
  countrySelectClassName = '',
  placeholder,
  required,
  maxLength,
  autoComplete = 'tel-national',
  disabled
}) => {
  const callingCode = countryCallingCodes[country];
  if (!callingCode) throw new Error(`No calling code is configured for ${country}`);

  return (
    <div className={`flex min-w-0 ${className}`}>
      {onCountryChange ? (
        <select
          aria-label="国家/地区区号"
          value={country}
          onChange={event => onCountryChange(event.target.value)}
          disabled={disabled}
          className={`max-w-[55%] shrink-0 rounded-l-lg border border-r-0 border-neutral-300 bg-neutral-50 px-2 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-black ${countrySelectClassName}`}
        >
          {phoneCountryOptions.map(option => (
            <option key={option} value={option}>{option} (+{countryCallingCodes[option]})</option>
          ))}
        </select>
      ) : (
        <span className="inline-flex shrink-0 items-center rounded-l-lg border border-r-0 border-neutral-300 bg-neutral-50 px-3 text-sm text-neutral-700">
          +{callingCode}
        </span>
      )}
      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete={autoComplete}
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        maxLength={maxLength}
        disabled={disabled}
        className={`min-w-0 flex-1 rounded-r-lg border border-neutral-300 px-3 py-2.5 text-sm focus:border-black focus:outline-none focus:ring-2 focus:ring-black ${inputClassName}`}
      />
    </div>
  );
};

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

export const PasswordInput: React.FC<PasswordInputProps> = ({ className = '', ...inputProps }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input {...inputProps} type={visible ? 'text' : 'password'} className={className} />
      <button
        type="button"
        onClick={() => setVisible(value => !value)}
        aria-label={visible ? '隐藏密码' : '显示密码'}
        title={visible ? '隐藏密码' : '显示密码'}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
};

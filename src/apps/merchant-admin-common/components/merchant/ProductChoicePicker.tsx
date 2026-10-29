import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Plus, Search, X } from 'lucide-react';

interface ProductChoiceOption {
  zh: string;
  it: string;
}

interface ProductChoicePickerProps {
  label: string;
  values: string[];
  options: ReadonlyArray<ProductChoiceOption>;
  onChange: (values: string[]) => void;
  multiple?: boolean;
  isItalian?: boolean;
  commonCount?: number;
  kind?: 'default' | 'color';
  placeholder?: string;
  disabled?: boolean;
}

const COLOR_HEX: Record<string, string> = {
  黑色: '#171717', nero: '#171717',
  白色: '#ffffff', bianco: '#ffffff',
  米白: '#f1ece2', avorio: '#f1ece2',
  灰色: '#9ca3af', grigio: '#9ca3af',
  卡其: '#b8a582', cachi: '#b8a582',
  棕色: '#7c4a2d', marrone: '#7c4a2d',
  藏青: '#1f2a44', blu: '#1f2a44',
  酒红: '#6d1f2c', bordeaux: '#6d1f2c',
  绿色: '#3f6b4f', verde: '#3f6b4f',
  牛仔蓝: '#4a6f94'
};

const colorHex = (label: string) => COLOR_HEX[label.trim().toLowerCase()] || COLOR_HEX[label.trim()] || '#d4d4d4';

/**
 * 颜色 / 尺码等选项的点选面板。
 * 用按钮 + 弹层代替原生 select，保留原有 PRODUCT_CHOICES 选项数据与写入字段。
 */
export const ProductChoicePicker: React.FC<ProductChoicePickerProps> = ({
  label,
  values,
  options,
  onChange,
  multiple = true,
  isItalian = false,
  commonCount,
  kind = 'default',
  placeholder,
  disabled
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const optionLabel = (option: ProductChoiceOption) => (isItalian ? option.it : option.zh);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => searchRef.current?.focus(), 30);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return options;
    return options.filter(option => `${option.zh} ${option.it}`.toLowerCase().includes(keyword));
  }, [options, query]);

  const toggleValue = (optionValue: string) => {
    if (multiple) {
      onChange(values.includes(optionValue) ? values.filter(item => item !== optionValue) : [...values, optionValue]);
      return;
    }
    onChange([optionValue]);
    setOpen(false);
  };

  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-neutral-700">{label}</span>
        {multiple && values.length > 0 && (
          <button type="button" onClick={() => onChange([])} className="text-[11px] font-medium text-neutral-500 underline-offset-2 hover:text-neutral-900 hover:underline">
            清空
          </button>
        )}
      </div>

      {multiple ? (
        <div className={`flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-neutral-200 bg-white p-1.5 ${disabled ? 'opacity-60' : ''}`}>
          {values.map(value => {
            const option = options.find(item => item.zh === value || item.it === value);
            const text = option ? optionLabel(option) : value;
            return (
              <span key={value} className="inline-flex items-center gap-1 rounded-md bg-neutral-100 py-1 pl-2 pr-1 text-xs font-medium text-neutral-800">
                {kind === 'color' && <span className="h-3 w-3 rounded-full border border-neutral-300" style={{ background: colorHex(value) }} aria-hidden="true" />}
                {text}
                {!disabled && (
                  <button type="button" onClick={() => onChange(values.filter(item => item !== value))} aria-label={`移除${text}`} className="grid h-5 w-5 place-items-center rounded text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900">
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                )}
              </span>
            );
          })}
          <button
            type="button"
            disabled={disabled}
            onClick={() => setOpen(true)}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-dashed border-neutral-300 px-2 text-xs font-medium text-neutral-600 hover:border-neutral-900 hover:text-neutral-900 disabled:cursor-not-allowed"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {values.length === 0 ? (placeholder || `选择${label}`) : '添加'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-neutral-300 bg-white px-3 text-left text-sm text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:cursor-not-allowed disabled:bg-neutral-50"
        >
          <span className={values[0] ? 'truncate' : 'truncate text-neutral-400'}>{values[0] || placeholder || `选择${label}`}</span>
          <span className="text-[11px] text-neutral-500" aria-hidden="true">选择</span>
        </button>
      )}


      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" role="presentation" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`选择${label}`}
            onClick={event => event.stopPropagation()}
            className="flex max-h-[80dvh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:max-w-lg sm:rounded-xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-neutral-950">选择{label}</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label="关闭选项" className="grid h-8 w-8 place-items-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="border-b border-neutral-100 px-4 py-2.5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder={`搜索${label}`}
                  className="h-9 w-full rounded-lg border border-neutral-200 bg-neutral-50 pl-8 pr-3 text-sm outline-none focus:border-neutral-500 focus:bg-white"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
              {filtered.length === 0 && <p className="px-2 py-6 text-center text-sm text-neutral-500">没有匹配的选项</p>}
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {filtered.map(option => {
                  const optionValue = optionLabel(option);
                  const selected = values.includes(optionValue);
                  const showDivider = commonCount !== undefined && commonCount > 0 && options.indexOf(option) === commonCount;
                  return (
                    <React.Fragment key={`${option.zh}-${option.it}`}>
                      {showDivider && (
                        <p className="col-span-full mt-2 border-t border-neutral-100 px-2 pt-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">更多选项</p>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleValue(optionValue)}
                        aria-pressed={selected}
                        className={`flex min-h-10 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                          selected ? 'bg-neutral-950 text-white' : 'text-neutral-800 hover:bg-neutral-100'
                        }`}
                      >
                        {kind === 'color' && (
                          <span
                            className={`h-4 w-4 shrink-0 rounded-full border ${selected ? 'border-white/60' : 'border-neutral-300'}`}
                            style={{ background: colorHex(option.zh) }}
                            aria-hidden="true"
                          />
                        )}
                        <span className="min-w-0 flex-1 truncate">{optionLabel(option)}</span>
                        {selected && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-neutral-200 px-4 py-3">
              <span className="text-xs text-neutral-500">{multiple ? `已选 ${values.length} 项` : '单选'}</span>
              <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-lg bg-neutral-950 px-5 text-sm font-semibold text-white hover:bg-neutral-800">
                完成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

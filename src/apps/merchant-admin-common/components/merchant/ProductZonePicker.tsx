import React from 'react';
import { Check, Package, ShieldCheck, Tag } from 'lucide-react';
import { PRODUCT_ZONE_OPTIONS, type ProductZone } from '../../../../utils/productZone';

interface ProductZonePickerProps {
  value: ProductZone;
  onChange: (zone: ProductZone) => void;
  isItalian?: boolean;
  error?: string;
  disabled?: boolean;
  /** 新建商品时在用户明确选择前不预选任何分区。 */
  hasSelection?: boolean;
}

const ZONE_ICONS = {
  private: ShieldCheck,
  new: Package,
  clearance: Tag
} as const;

/**
 * 商品分区卡片（商家 Web 与商家手机 Web 共用）。
 * 选项来自 PRODUCT_ZONE_OPTIONS，写入仍走现有 visibility / status / 授权保护字段。
 */
export const ProductZonePicker: React.FC<ProductZonePickerProps> = ({ value, onChange, isItalian = false, error, disabled, hasSelection = true }) => (
  <fieldset id="product-zone-card" className="min-w-0" disabled={disabled}>
    <legend className="sr-only">产品分区</legend>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" role="radiogroup" aria-label="产品分区">
      {PRODUCT_ZONE_OPTIONS.map(option => {
        const Icon = ZONE_ICONS[option.value];
        const selected = hasSelection && value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`flex min-h-24 w-full items-start gap-3 rounded-xl border bg-white p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:cursor-not-allowed disabled:opacity-60 ${
              selected
                ? 'border-neutral-950 ring-1 ring-neutral-950'
                : 'border-neutral-200 hover:border-neutral-400'
            }`}
          >
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${selected ? 'bg-neutral-950 text-white' : 'bg-neutral-100 text-neutral-700'}`}>
              <Icon className="h-4.5 w-4.5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-neutral-950">
                {isItalian ? option.italianLabel : option.label}
              </span>
              <span className="mt-1 block text-xs leading-5 text-neutral-500">
                {isItalian ? option.italianDescription : option.description}
              </span>
            </span>
            {selected && (
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-neutral-950 text-white" aria-hidden="true">
                <Check className="h-3 w-3" />
              </span>
            )}
          </button>
        );
      })}
    </div>
    {error && <p role="alert" className="mt-2 text-xs font-medium text-red-700">{error}</p>}
  </fieldset>
);

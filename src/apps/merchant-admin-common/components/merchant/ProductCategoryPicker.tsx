import React from 'react';
import { PRODUCT_CATEGORIES, getProductCategoryLabel } from '../../../../constants/productCategories';

interface ProductCategoryPickerProps {
  value: string;
  onChange: (value: string) => void;
  isItalian: boolean;
  disabled?: boolean;
}

/**
 * 一级分类选择器（商家 Web 与商家移动 Web 共用）。
 * 分类目录来自 PRODUCT_CATEGORIES，不接受调用方自行传入选项，避免出现第二套分类枚举。
 */
export const ProductCategoryPicker: React.FC<ProductCategoryPickerProps> = ({ value, onChange, isItalian, disabled }) => (
  <fieldset className="min-w-0" disabled={disabled}>
    <legend className="mb-1.5 text-xs font-medium text-neutral-700">一级分类</legend>
    <div className="grid grid-cols-3 gap-1.5 min-[480px]:grid-cols-4 xl:grid-cols-6" role="radiogroup" aria-label="一级分类">
      {PRODUCT_CATEGORIES.map(category => {
        const selected = value === category.value;
        return (
          <button
            key={category.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(category.value)}
            className={`h-9 min-w-0 truncate rounded-md border px-1.5 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 ${selected ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 disabled:opacity-50'}`}
          >
            {getProductCategoryLabel(category.value, isItalian)}
          </button>
        );
      })}
    </div>
  </fieldset>
);

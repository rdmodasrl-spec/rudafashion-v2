import React from 'react';
import { Check } from 'lucide-react';

interface ProductEditorStepBarProps {
  step: 1 | 2;
  onStepClick?: (step: 1 | 2) => void;
  isItalian?: boolean;
}

const STEPS = [
  { step: 1 as const, zh: '上传媒体', it: 'Carica media' },
  { step: 2 as const, zh: '商品信息', it: 'Dettagli prodotto' }
];

/** 发布商品两步进度条，桌面与手机共用。 */
export const ProductEditorStepBar: React.FC<ProductEditorStepBarProps> = ({ step, onStepClick, isItalian = false }) => (
  <ol className="flex items-center gap-2" aria-label={isItalian ? 'Avanzamento pubblicazione' : '发布进度'}>
    {STEPS.map((item, index) => {
      const active = step === item.step;
      const done = step > item.step;
      const interactive = Boolean(onStepClick) && (done || active);
      const content = (
        <>
          <span
            className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-semibold tabular-nums ${
              active
                ? 'border-neutral-950 bg-neutral-950 text-white'
                : done
                  ? 'border-neutral-900 bg-white text-neutral-900'
                  : 'border-neutral-300 bg-white text-neutral-400'
            }`}
          >
            {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : item.step}
          </span>
          <span className={`whitespace-nowrap text-xs font-semibold ${active ? 'text-neutral-950' : done ? 'text-neutral-800' : 'text-neutral-400'}`}>
            {isItalian ? item.it : item.zh}
          </span>
        </>
      );
      return (
        <li key={item.step} className="flex items-center gap-2">
          {interactive ? (
            <button
              type="button"
              onClick={() => onStepClick?.(item.step)}
              aria-current={active ? 'step' : undefined}
              className="flex items-center gap-2 rounded-md py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
            >
              {content}
            </button>
          ) : (
            <span className="flex items-center gap-2 py-1" aria-current={active ? 'step' : undefined}>{content}</span>
          )}
          {index === 0 && <span className={`h-px w-6 sm:w-12 ${step === 2 ? 'bg-neutral-900' : 'bg-neutral-200'}`} aria-hidden="true" />}
        </li>
      );
    })}
  </ol>
);

import React from 'react';

interface ProductFormSectionProps {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}

/** 发布商品表单的分区卡片，桌面与手机端共用同一视觉规范。 */
export const ProductFormSection: React.FC<ProductFormSectionProps> = ({ title, hint, action, children, className = '', id }) => (
  <section id={id} className={`rounded-xl border border-neutral-200 bg-white p-4 sm:p-5 ${className}`}>
    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-neutral-100 pb-3">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-neutral-950">{title}</h3>
        {hint && <p className="mt-1 text-xs leading-5 text-neutral-500">{hint}</p>}
      </div>
      {action}
    </div>
    <div className="mt-4">{children}</div>
  </section>
);

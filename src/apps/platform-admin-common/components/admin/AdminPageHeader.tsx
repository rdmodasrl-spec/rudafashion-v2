import React from 'react';

export const AdminPageHeader: React.FC<{
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ title, description, actions }) => (
  <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-3">
    <div className="min-w-0">
      <h1 className="text-lg font-semibold tracking-tight text-neutral-950 sm:text-xl">{title}</h1>
      {description && <p className="mt-1 text-xs leading-5 text-neutral-500">{description}</p>}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </header>
);

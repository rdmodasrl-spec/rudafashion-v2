import React from 'react';

export type MerchantSettingsTone = 'ready' | 'manual' | 'unavailable';

export type MerchantSettingsScopeItem = {
  label: string;
  state: string;
  tone: MerchantSettingsTone;
  detail?: string;
};

export type MerchantSettingsFact = {
  label: string;
  value: React.ReactNode;
};

const toneClasses: Record<MerchantSettingsTone, { dot: string; chip: string }> = {
  ready: { dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  manual: { dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-800 ring-amber-200' },
  unavailable: { dot: 'bg-neutral-400', chip: 'bg-neutral-100 text-neutral-500 ring-neutral-200' }
};

export const MerchantSettingsSummary: React.FC<{
  summary: string;
  status?: { label: string; tone: MerchantSettingsTone };
  actions?: React.ReactNode;
}> = ({ summary, status, actions }) => (
  <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2.5">
        {status && <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${toneClasses[status.tone].dot}`} />}
        <div className="min-w-0">
          <p className="text-xs leading-5 text-neutral-700">{summary}</p>
          {status && <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${toneClasses[status.tone].chip}`}>{status.label}</span>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  </section>
);

export const MerchantSettingsStatusChip: React.FC<{ label: string; tone: MerchantSettingsTone }> = ({ label, tone }) => (
  <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${toneClasses[tone].chip}`}>{label}</span>
);

export const MerchantSettingsCard: React.FC<{
  id?: string;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ id, title, description, actions, children, className }) => (
  <section id={id} className={`scroll-mt-6 rounded-2xl border border-neutral-200 bg-white shadow-sm ${className || ''}`}>
    {(title || actions) && (
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-neutral-100 px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          {title && <h2 className="text-sm font-bold text-neutral-900">{title}</h2>}
          {description && <p className="mt-1 text-[11px] leading-5 text-neutral-500">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </header>
    )}
    <div className="px-4 py-4 sm:px-5">{children}</div>
  </section>
);

export const MerchantSettingsScopeList: React.FC<{ items: MerchantSettingsScopeItem[] }> = ({ items }) => (
  <ul className="space-y-2">
    {items.map(item => (
      <li key={item.label} className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-neutral-100 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-neutral-900">{item.label}</p>
          {item.detail && <p className="mt-0.5 text-[11px] leading-5 text-neutral-500">{item.detail}</p>}
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${toneClasses[item.tone].chip}`}>{item.state}</span>
      </li>
    ))}
  </ul>
);

export const MerchantSettingsFacts: React.FC<{ facts: MerchantSettingsFact[] }> = ({ facts }) => (
  <dl className="divide-y divide-neutral-100">
    {facts.map(fact => (
      <div key={fact.label} className="flex flex-wrap items-start justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
        <dt className="text-xs text-neutral-500">{fact.label}</dt>
        <dd className="max-w-[65%] break-words text-right text-xs font-semibold text-neutral-900">{fact.value}</dd>
      </div>
    ))}
  </dl>
);

export const MerchantSettingsNote: React.FC<{ children: React.ReactNode; tone?: 'neutral' | 'warning' }> = ({ children, tone = 'neutral' }) => (
  <p
    role="note"
    className={`rounded-xl border px-3.5 py-3 text-[11px] leading-5 ${
      tone === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : 'border-neutral-200 bg-neutral-50 text-neutral-600'
    }`}
  >
    {children}
  </p>
);

export const merchantSettingsSecondaryButtonClass =
  'rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50';

export const merchantSettingsPrimaryButtonClass =
  'rounded-lg bg-neutral-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-700';

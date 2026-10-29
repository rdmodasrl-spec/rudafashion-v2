/**
 * 行业后台公共基础组件。
 *
 * 只放跨行业稳定的展示原语；不包含任何 templateId 判断或行业业务文案。
 * 行业差异由各行业 manifest / 页面表达。
 */
import React from 'react';
import { ChevronLeft, ChevronRight, Loader2, Search, X } from 'lucide-react';

export function formatMoney(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  return `€${(Number.isFinite(amount) ? amount : 0).toFixed(2)}`;
}

export function formatCount(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? String(Math.trunc(amount)) : '0';
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  busy?: boolean;
}> = ({ variant = 'secondary', size = 'md', busy = false, className = '', children, disabled, ...rest }) => {
  const tone = variant === 'primary'
    ? 'bg-neutral-950 text-white hover:bg-neutral-800 disabled:bg-neutral-400'
    : variant === 'danger'
      ? 'border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:text-red-300'
      : variant === 'ghost'
        ? 'text-neutral-600 hover:bg-neutral-100 disabled:text-neutral-300'
        : 'border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50 disabled:text-neutral-400';
  const sizing = size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm';
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-md font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-1 disabled:cursor-not-allowed ${tone} ${sizing} ${className}`}
      disabled={disabled || busy}
      {...rest}
    >
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
};

export const PageHeader: React.FC<{ title: string; description?: string; actions?: React.ReactNode }> = ({ title, description, actions }) => (
  <div className="flex flex-col gap-3 border-b border-neutral-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h1 className="text-xl font-bold tracking-tight text-neutral-950">{title}</h1>
      {description ? <p className="mt-1 text-sm text-neutral-500">{description}</p> : null}
    </div>
    {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
  </div>
);

export const SectionCard: React.FC<{
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, description, actions, children, className = '' }) => (
  <section className={`rounded-lg border border-neutral-200 bg-white ${className}`}>
    <div className="flex flex-col gap-2 border-b border-neutral-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-sm font-bold text-neutral-950">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-neutral-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
    <div className="p-4">{children}</div>
  </section>
);

export const KpiCard: React.FC<{ label: string; value: React.ReactNode; hint?: string }> = ({ label, value, hint }) => (
  <div className="rounded-lg border border-neutral-200 bg-white p-4">
    <p className="text-xs font-medium text-neutral-500">{label}</p>
    <p className="mt-2 text-2xl font-bold tabular-nums text-neutral-950">{value}</p>
    {hint ? <p className="mt-1 text-xs text-neutral-400">{hint}</p> : null}
  </div>
);

export const KpiGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
);

export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const statusTones: Record<StatusTone, string> = {
  neutral: 'border-neutral-200 bg-neutral-50 text-neutral-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-red-200 bg-red-50 text-red-700',
  info: 'border-sky-200 bg-sky-50 text-sky-700'
};

export const StatusPill: React.FC<{ tone?: StatusTone; children: React.ReactNode }> = ({ tone = 'neutral', children }) => (
  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${statusTones[tone]}`}>{children}</span>
);

export type DataColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
};

export function DataTable<T>({ columns, rows, rowKey, emptyText, minWidth = 720, onRowClick }: {
  columns: ReadonlyArray<DataColumn<T>>;
  rows: readonly T[];
  rowKey: (row: T) => string;
  emptyText: string;
  minWidth?: number;
  onRowClick?: (row: T) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        <thead className="bg-neutral-50 text-xs font-medium text-neutral-500">
          <tr>
            {columns.map(column => (
              <th key={column.key} className={`px-3 py-2.5 ${column.align === 'right' ? 'text-right' : ''}`}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {rows.map(row => (
            <tr
              key={rowKey(row)}
              className={onRowClick ? 'cursor-pointer hover:bg-neutral-50' : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map(column => (
                <td key={column.key} className={`px-3 py-3 align-middle text-neutral-700 ${column.align === 'right' ? 'text-right tabular-nums' : ''} ${column.className || ''}`}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={columns.length} className="px-3 py-10 text-center text-sm text-neutral-500">{emptyText}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export const EmptyState: React.FC<{ title: string; description?: string; action?: React.ReactNode }> = ({ title, description, action }) => (
  <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-10 text-center">
    <p className="text-sm font-semibold text-neutral-800">{title}</p>
    {description ? <p className="max-w-md text-sm text-neutral-500">{description}</p> : null}
    {action}
  </div>
);

export const SearchInput: React.FC<{ value: string; onChange: (value: string) => void; placeholder: string }> = ({ value, onChange, placeholder }) => (
  <label className="relative flex h-10 w-full items-center sm:w-72">
    <Search className="pointer-events-none absolute left-3 h-4 w-4 text-neutral-400" />
    <input
      value={value}
      onChange={event => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-full w-full rounded-md border border-neutral-300 bg-white pl-9 pr-3 text-sm text-neutral-900 outline-none focus:border-neutral-950"
    />
  </label>
);

export const FormField: React.FC<{ label: string; required?: boolean; error?: string; help?: string; children: React.ReactNode }> = ({ label, required, error, help, children }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-semibold text-neutral-700">
      {label}{required ? <span className="ml-0.5 text-red-600">*</span> : null}
    </span>
    {children}
    {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : help ? <span className="mt-1 block text-xs text-neutral-400">{help}</span> : null}
  </label>
);

export const inputClass = 'h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-neutral-950 disabled:bg-neutral-100';

export const ErrorBanner: React.FC<{ message: string; onDismiss?: () => void }> = ({ message, onDismiss }) => (
  <div role="alert" className="flex items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
    <span>{message}</span>
    {onDismiss ? (
      <button type="button" onClick={onDismiss} className="rounded p-0.5 text-red-500 hover:bg-red-100" aria-label="关闭提示">
        <X className="h-4 w-4" />
      </button>
    ) : null}
  </div>
);


export const Modal: React.FC<{ open: boolean; title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }> = ({ open, title, onClose, children, footer, wide }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="presentation">
      <div className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-xl bg-white shadow-xl sm:rounded-xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-xl'}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <h2 className="text-sm font-bold text-neutral-950">{title}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-neutral-500 hover:bg-neutral-100" aria-label="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer ? <div className="flex items-center justify-end gap-2 border-t border-neutral-200 px-4 py-3">{footer}</div> : null}
      </div>
    </div>
  );
};

export const Pagination: React.FC<{ page: number; pageSize: number; total: number; onChange: (page: number) => void }> = ({ page, pageSize, total, onChange }) => {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <div className="flex items-center justify-between gap-3 pt-3 text-xs text-neutral-500">
      <span>第 {page} / {pageCount} 页，共 {total} 条</span>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" onClick={() => onChange(Math.max(1, page - 1))} disabled={page <= 1} aria-label="上一页">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onChange(Math.min(pageCount, page + 1))} disabled={page >= pageCount} aria-label="下一页">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export const LoadingBlock: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center justify-center gap-2 py-10 text-sm text-neutral-500">
    <Loader2 className="h-4 w-4 animate-spin" />
    <span>{label}</span>
  </div>
);

export const TextLinkButton: React.FC<{ children: React.ReactNode; onClick: () => void }> = ({ children, onClick }) => (
  <button type="button" onClick={onClick} className="text-xs font-semibold text-neutral-900 underline underline-offset-2 hover:text-neutral-600">
    {children}
  </button>
);


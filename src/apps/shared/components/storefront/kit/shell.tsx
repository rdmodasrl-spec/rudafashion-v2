/**
 * 店铺模板构件：外壳、标题、指标、页脚。
 *
 * 21 套模板共用这些构件，但每套的「结构」由自己决定：外壳 tone（编辑/工具/百货/零售/工厂）、
 * 导航形态（见 nav.tsx）、商品栅格形态（见 product.tsx）、详情形态（见 detail.tsx）都不同。
 * 这里只提供排版与语义，不提供业务判断，也不放宽任何授权（授权在 useStorefrontData 完成）。
 */
import React from 'react';
import type { StorefrontData } from '../useStorefrontData';

export type ShellTone = 'editorial' | 'utility' | 'department' | 'retail' | 'factory';

const TONE: Record<ShellTone, { page: string; header: string }> = {
  editorial: { page: 'bg-white text-neutral-900', header: 'border-b border-neutral-200 bg-white' },
  utility: { page: 'bg-neutral-50 text-neutral-900', header: 'border-b border-neutral-300 bg-white' },
  department: { page: 'bg-white text-neutral-900', header: 'border-b-2 border-neutral-900 bg-white' },
  retail: { page: 'bg-neutral-50 text-neutral-900', header: 'border-b border-neutral-200 bg-white/95 backdrop-blur' },
  factory: { page: 'bg-neutral-950 text-neutral-100', header: 'border-b border-neutral-800 bg-neutral-950' }
};

export const StoreShell: React.FC<{
  tone?: ShellTone;
  children: React.ReactNode;
  header: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ tone = 'editorial', header, footer, children }) => {
  const t = TONE[tone];
  return (
    <div className={`min-h-screen ${t.page}`}>
      <header className={`sticky top-0 z-40 ${t.header}`}>{header}</header>
      <main>{children}</main>
      {footer}
    </div>
  );
};

export const StoreFooter: React.FC<{ data: StorefrontData; tone?: ShellTone; note?: string }> = ({ data, tone = 'editorial', note }) => {
  const dark = tone === 'factory';
  const merchant = data.merchant;
  return (
    <footer className={`border-t ${dark ? 'border-neutral-800 bg-neutral-950 text-neutral-300' : 'border-neutral-200 bg-white text-neutral-600'}`}>
      <div className="mx-auto grid max-w-[1400px] gap-6 px-5 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className={`text-sm font-semibold tracking-tight ${dark ? 'text-white' : 'text-neutral-900'}`}>{merchant?.name || 'RUDA'}</p>
          <p className="mt-2 text-xs leading-5">{merchant?.companyLegalName || ''}</p>
          {merchant?.foundedYear ? <p className="mt-1 text-xs">成立于 {merchant.foundedYear}</p> : null}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em]">联系</p>
          <p className="mt-2 text-xs leading-5">{data.contact.phone || '—'}</p>
          <p className="text-xs leading-5">{data.contact.email || '—'}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em]">地址</p>
          <p className="mt-2 text-xs leading-5">{data.contact.address || '—'}</p>
          {data.contact.city ? <p className="text-xs leading-5">{data.contact.city}</p> : null}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em]">说明</p>
          <p className="mt-2 text-xs leading-5">{note || '价格与库存以商家确认的订单为准。'}</p>
        </div>
      </div>
      <div className={`border-t px-5 py-4 text-center text-xs ${dark ? 'border-neutral-800 text-neutral-500' : 'border-neutral-200 text-neutral-500'}`}>
        © {new Date().getFullYear()} {merchant?.name || 'RUDA'} · 由 RUDA 提供技术支持
      </div>
    </footer>
  );
};

export const SectionHeading: React.FC<{
  kicker?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  align?: 'left' | 'center';
  dark?: boolean;
}> = ({ kicker, title, description, action, align = 'left', dark = false }) => (
  <div className={`flex flex-wrap items-end justify-between gap-3 ${align === 'center' ? 'justify-center text-center' : ''}`}>
    <div className={align === 'center' ? 'mx-auto max-w-2xl' : 'min-w-0'}>
      {kicker ? <p className="text-xs uppercase tracking-[0.24em] text-neutral-500">{kicker}</p> : null}
      <h2 className={`mt-2 text-xl font-semibold tracking-tight sm:text-2xl ${dark ? 'text-white' : 'text-neutral-900'}`}>{title}</h2>
      {description ? <p className={`mt-2 max-w-2xl text-xs leading-6 ${dark ? 'text-neutral-400' : 'text-neutral-600'}`}>{description}</p> : null}
    </div>
    {action}
  </div>
);

export const MetricRow: React.FC<{ items: Array<{ label: string; value: string }>; dark?: boolean }> = ({ items, dark = false }) => (
  <dl className={`grid grid-cols-2 divide-x sm:grid-cols-4 ${dark ? 'divide-neutral-800' : 'divide-neutral-200'}`}>
    {items.map(item => (
      <div key={item.label} className="px-4 py-3 first:pl-0">
        <dt className="text-xs uppercase tracking-[0.14em] text-neutral-500">{item.label}</dt>
        <dd className={`mt-1 text-base font-semibold tabular-nums ${dark ? 'text-white' : 'text-neutral-900'}`}>{item.value}</dd>
      </div>
    ))}
  </dl>
);

export const Tag: React.FC<{ children: React.ReactNode; tone?: 'solid' | 'outline' | 'muted' }> = ({ children, tone = 'outline' }) => {
  const cls = tone === 'solid'
    ? 'bg-neutral-900 text-white border-neutral-900'
    : tone === 'muted'
      ? 'bg-neutral-100 text-neutral-700 border-transparent'
      : 'border-neutral-300 text-neutral-700';
  return <span className={`inline-flex items-center border px-2 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
};

export const EmptyBlock: React.FC<{ title: string; description?: string; action?: React.ReactNode }> = ({ title, description, action }) => (
  <div className="grid place-items-center border border-dashed border-neutral-300 px-6 py-16 text-center">
    <div>
      <p className="text-sm font-semibold text-neutral-800">{title}</p>
      {description ? <p className="mt-2 text-xs leading-6 text-neutral-500">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  </div>
);

/** 授权提示：未登录时说明为什么看不到价格，而不是显示假价格。 */
export const AuthNotice: React.FC<{ data: StorefrontData; dark?: boolean }> = ({ data, dark = false }) => {
  if (data.isWholesaleAuthorized) return null;
  const hidden = data.hiddenWholesaleCount;
  return (
    <div className={`border px-4 py-3 text-xs leading-6 ${dark ? 'border-neutral-700 bg-neutral-900 text-neutral-300' : 'border-neutral-300 bg-neutral-50 text-neutral-700'}`}>
      批发价格与库存仅对已通过审核的采购账号可见。
      {hidden > 0 ? ` 当前还有 ${hidden} 款批发商品未展示。` : ''}
      {' '}请使用采购账号登录，或联系商家开通授权。
    </div>
  );
};

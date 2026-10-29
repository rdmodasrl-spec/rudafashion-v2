/**
 * 行业后台外壳：只渲染行业清单传入的导航，不自行判断行业。
 */
import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeftRight, MonitorSmartphone, Store } from 'lucide-react';
import type { MerchantIndustryModuleKey } from '../../../constants/merchantIndustryCapabilities';

export type IndustryWorkspaceModuleProps = {
  mobileMode?: boolean;
  onBackToDesktop?: () => void;
  embedded?: boolean;
  activeSection?: MerchantIndustryModuleKey;
  onSectionChange?: (key: MerchantIndustryModuleKey) => void;
};

export type IndustryNavItem = {
  key: MerchantIndustryModuleKey;
  label: string;
  icon: LucideIcon;
};

export type IndustryWorkspaceShellProps = {
  workspaceName: string;
  merchantName: string;
  nav: readonly IndustryNavItem[];
  active: MerchantIndustryModuleKey;
  onNavigate: (key: MerchantIndustryModuleKey) => void;
  mobileMode?: boolean;
  onBackToDesktop?: () => void;
  embedded?: boolean;
  children: React.ReactNode;
};

export const IndustryWorkspaceShell: React.FC<IndustryWorkspaceShellProps> = ({
  workspaceName,
  merchantName,
  nav,
  active,
  onNavigate,
  mobileMode = false,
  onBackToDesktop,
  embedded = false,
  children
}) => (
  embedded ? <>{children}</> : <div className={`min-h-screen bg-neutral-100 ${mobileMode ? 'text-[15px]' : ''}`}>
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white">
      <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-3 px-3 py-2.5 sm:px-5">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-neutral-950">{workspaceName}</p>
          <p className="truncate text-xs text-neutral-500">{merchantName}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {mobileMode && onBackToDesktop ? (
            <button
              type="button"
              onClick={onBackToDesktop}
              className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-2 py-1 text-xs font-semibold text-neutral-700"
            >
              <MonitorSmartphone className="h-3.5 w-3.5" />电脑端
            </button>
          ) : null}
        </div>
      </div>
    </header>
    <div className={`mx-auto flex w-full max-w-[1440px] ${mobileMode ? 'flex-col' : 'flex-col lg:flex-row'}`}>
      <nav
        aria-label="行业后台导航"
        className={mobileMode
          ? 'sticky top-[52px] z-20 flex gap-1 overflow-x-auto border-b border-neutral-200 bg-white px-2 py-2'
          : 'shrink-0 border-b border-neutral-200 bg-white p-2 lg:w-56 lg:border-b-0 lg:border-r lg:p-3'}
      >
        {nav.map(item => {
          const Icon = item.icon;
          const selected = item.key === active;
          return (
            <button
              key={item.key}
              type="button"
              aria-current={selected ? 'page' : undefined}
              onClick={() => onNavigate(item.key)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${
                selected ? 'bg-neutral-950 text-white' : 'text-neutral-600 hover:bg-neutral-100'
              } ${mobileMode ? '' : 'w-full justify-start'}`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <main className="min-w-0 flex-1 px-3 py-4 sm:px-5 sm:py-5">{children}</main>
    </div>
  </div>
);

export const IndustryQuickActions: React.FC<{
  items: ReadonlyArray<{ label: string; icon?: LucideIcon; onClick: () => void }>;
}> = ({ items }) => (
  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
    {items.map(item => {
      const Icon = item.icon;
      return (
        <button
          key={item.label}
          type="button"
          onClick={item.onClick}
          className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-3 py-3 text-left text-sm font-semibold text-neutral-900 hover:border-neutral-400"
        >
          <span>{item.label}</span>
          {Icon ? <Icon className="h-4 w-4 text-neutral-500" /> : <ArrowLeftRight className="h-4 w-4 text-neutral-400" />}
        </button>
      );
    })}
  </div>
);

export const StoreEmptyIcon = Store;

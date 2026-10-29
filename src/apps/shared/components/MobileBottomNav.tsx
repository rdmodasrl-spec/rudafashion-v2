import React from 'react';
import { Bot, House, Shirt, Store, UserRound } from 'lucide-react';
import { useB2B } from '../../../context/B2BContext';
import { useModuleAvailability } from '../moduleAvailability';

type NavigationTab = {
  id: string;
  label: string;
  onClick: () => void;
  isActive: boolean;
};

export const MobileBottomNav: React.FC = () => {
  const { currentView, setCurrentView, localizeCopy } = useB2B();
  const { fashionEnabled, modauiEnabled } = useModuleAvailability();

  // Merchant and employee portals render their own task navigation. Rendering
  // the buyer bar here would cover the mobile controls at the bottom.
  if (currentView === 'merchant_portal') {
    return null;
  }

  // Hide on admin dashboard to avoid overlapping ERP controls, unless user wants to go back
  if (currentView === 'admin' || currentView === 'platform_admin') {
    return (
      <nav 
        id="mobile-admin-bottom-bar"
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-black text-white border-t border-neutral-800 px-4 py-3 flex items-center justify-between shadow-2xl safe-area-bottom"
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
          <span className="text-xs font-mono font-bold tracking-widest uppercase">
            {localizeCopy('RUDA 平台总控', 'RUDA Direzione')}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setCurrentView('catalog')}
          className="px-3 py-1.5 bg-white text-black text-xs font-bold rounded hover:bg-neutral-200 transition-colors cursor-pointer"
        >
          {localizeCopy('返回前台选款', 'Torna al Catalogo')}
        </button>
      </nav>
    );
  }

  const tabs: NavigationTab[] = [
    {
      id: 'home',
      label: localizeCopy('首页', 'Home'),
      onClick: () => setCurrentView('home'),
      isActive: currentView === 'home',
    },
    {
      id: 'showrooms',
      label: localizeCopy('找店', 'Negozi'),
      onClick: () => {
        setCurrentView('showrooms');
        if (window.location.pathname !== '/showrooms') {
          window.history.pushState({}, '', '/showrooms');
        }
      },
      isActive: currentView === 'showrooms' || currentView === 'merchant_store',
    },
    {
      id: 'ai',
      label: 'ModaUI',
      onClick: () => setCurrentView('ai_team_preview'),
      isActive: currentView === 'ai_team_preview',
    },
    {
      id: 'fashion_trends',
      label: localizeCopy('时尚', 'Moda'),
      onClick: () => {
        setCurrentView('fashion_trends');
        if (window.location.pathname !== '/trends') {
          window.history.pushState({}, '', '/trends');
        }
      },
      isActive: currentView === 'fashion_trends',
    },
    {
      id: 'account',
      label: localizeCopy('我的', 'Account'),
      onClick: () => setCurrentView('account'),
      isActive: currentView === 'account' || currentView === 'consumer_account',
    },
  ].filter(tab => (modauiEnabled || tab.id !== 'ai') && (fashionEnabled || tab.id !== 'fashion_trends'));

  return (
    <nav 
      id="mobile-app-bottom-nav"
      aria-label="Mobile Navigation"
      className="mobile-app-bottom-nav md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#e8e6e2] px-2 py-1 flex items-center justify-around select-none safe-area-bottom"
    >
      {tabs.map((tab) => {
        const isActive = tab.isActive;

        return (
          <button
            key={tab.id}
            id={`mobile-nav-${tab.id}`}
            type="button"
            onClick={tab.onClick}
            className={`relative flex min-w-[54px] min-h-[48px] flex-col items-center justify-center gap-1 px-2 py-1 transition-colors cursor-pointer ${
              isActive ? 'text-neutral-950 font-semibold' : 'text-[#555] hover:text-neutral-900'
            }`}
          >
            {tab.id === 'home' && <House className="h-[22px] w-[22px]" strokeWidth={1.6} />}
            {tab.id === 'showrooms' && <Store className="h-[22px] w-[22px]" strokeWidth={1.6} />}
            {tab.id === 'ai' && <Bot className="h-[22px] w-[22px]" strokeWidth={1.6} />}
            {tab.id === 'fashion_trends' && <Shirt className="h-[22px] w-[22px]" strokeWidth={1.6} />}
            {tab.id === 'account' && <UserRound className="h-[22px] w-[22px]" strokeWidth={1.6} />}
            <span className="text-[10px] tracking-tight">
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

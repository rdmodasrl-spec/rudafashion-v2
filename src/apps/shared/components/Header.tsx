import React, { useState } from 'react';
import { UserCircle, Bot } from 'lucide-react';
import { useB2B } from '../../../context/B2BContext';
import { merchantIndustries } from '../../../constants/merchantIndustries';
import { useModuleAvailability } from '../moduleAvailability';

const headerIconButtonClass = 'flex h-6 w-6 shrink-0 items-center justify-center rounded-none text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-black';

export const Header: React.FC = () => {
  const {
    currentView,
    setCurrentView,
    t,
    authRole,
    authBuyer,
    authMerchant,
    authCustomerAccount,
    authCompanyId,
    authAdminName,
    logout,
    returnToAdminPortal,
    setShowBuyerRegister,
    setActiveBuyerTab, localizeCopy,
  } = useB2B();

  const [showAccountMenu, setShowAccountMenu] = useState(false);
  // 平台全局开关：关闭时尚时只隐藏入口，历史内容与数据保留。
  const { fashionEnabled } = useModuleAvailability();

  const openCustomerLogin = () => {
    try {
      window.sessionStorage.setItem('ruda:open-customer-login', '1');
    } catch (error) {
      console.warn('[customer-login-navigation]', error);
    }
    setCurrentView('account');
    window.dispatchEvent(new Event('ruda:open-customer-login'));
  };

  // ================================
  // 🔴 PLATFORM ADMIN HEADER (super-admin / admin)
  // ================================
  if (authRole === 'admin') {
    return (
      <header className="sticky top-0 z-40 shadow-md">
        <div className="bg-black text-white text-xs px-4 py-1.5 border-b border-neutral-800">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-white font-bold">
                {localizeCopy("RUDA 平台管理中心", "RUDA Gestione Piattaforma")}
                <span className="ml-2 px-2 py-0.5 rounded bg-emerald-600 text-[10px] font-black tracking-widest animate-pulse">
                  {localizeCopy("运营中", "OPERATIVO")}
                </span>
              </span>
              <span className="hidden lg:inline-flex items-center gap-1 text-neutral-400">
                {localizeCopy("运营管理 · 生产商审核 · 财务结算 · 合规管理", "Gestione · Produttori · Finanza · Conformità")}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-neutral-900/70 px-2.5 py-1 rounded-lg border border-neutral-700">
                <UserCircle className="h-3.5 w-3.5 text-emerald-300" />
                <span className="font-bold text-white">{authAdminName || 'SuperAdmin'}</span>
                <span className="text-neutral-400 text-[10px]">平台</span>
                <button
                  type="button"
                  onClick={() => void returnToAdminPortal()}
                  className="ml-1 px-2 py-0.5 text-neutral-200 hover:text-white hover:bg-black rounded flex items-center gap-1 transition-colors cursor-pointer text-[10px] font-semibold border border-neutral-600 hover:border-emerald-500"
                >
                  {localizeCopy("返回总后台", "Back to admin")}
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="px-2 py-0.5 text-neutral-200 hover:text-white hover:bg-black rounded flex items-center gap-1 transition-colors cursor-pointer text-[10px] font-semibold border border-neutral-600 hover:border-emerald-500"
                >
                  {localizeCopy("退出", "Logout")}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white border-b border-neutral-200 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div onClick={() => setCurrentView('platform_admin')} className="cursor-pointer flex items-center gap-2.5 shrink-0">
              <div className="portal-logo-mark w-9 h-9 flex items-center justify-center font-serif text-lg font-bold tracking-tighter rounded-md shadow">
                R
              </div>
              <div>
                <div className="font-serif font-black text-lg tracking-wider text-neutral-900">RUDA · 平台管理</div>
                <div className="hidden sm:block text-[10px] text-neutral-500 uppercase tracking-widest">
                  {localizeCopy("运营管理 · 生产商合规与服务", "Gestione produttori e conformità")}
                </div>
              </div>
            </div>
            <div className="text-right text-[11px] text-neutral-600 hidden md:block">
              <div className="font-semibold text-neutral-900">
                {localizeCopy("管理员中心 · 操作全程留痕", "Area amministratori · Operazioni registrate")}
              </div>
              <div className="font-mono text-neutral-500">
                {new Date().toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </header>
    );
  }

  // ================================
  // 🟡 MERCHANT SELLER HEADER (/merchant)
  // ================================
  if (authRole === 'merchant' && authMerchant && currentView === 'merchant_portal') {
    return (
      <header className="sticky top-0 z-40 shadow-md">
        <div className="bg-black text-white text-xs px-4 py-1.5 border-b border-neutral-800">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-white font-bold">
                {localizeCopy("RUDA 生产商中心", "RUDA Producer Center")}
              </span>
              <span className="hidden lg:inline-flex items-center gap-1 text-neutral-300/90">
                {localizeCopy("商品管理 · 订单发货 · 库存管理 · 财务结算", "Catalogo · Spedizioni · Magazzino · Pagamenti")}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => { window.location.href = '/'; }}
                className="px-2.5 py-1.5 text-neutral-100 hover:text-white hover:bg-black rounded flex items-center gap-1.5 transition-colors cursor-pointer text-[10px] font-semibold border border-neutral-600 hover:border-emerald-500"
              >
                {t('navStorefront')}
              </button>
              <div className="flex items-center gap-2 bg-neutral-900/60 px-2.5 py-1 rounded-lg border border-neutral-700">
                <div
                  className="w-6 h-6 rounded bg-emerald-500 text-black flex items-center justify-center font-black text-xs"
                  title={authMerchant.companyLegalName}
                >
                  {authMerchant.code ? authMerchant.code.slice(0, 2).toUpperCase() : 'M'}
                </div>
                <div className="leading-tight">
                  <div className="font-bold text-white text-[11px]">{authMerchant.name}</div>
                  <div className="text-neutral-300 text-[9px] font-mono">{authMerchant.code || authMerchant.id}</div>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="ml-1 px-2 py-0.5 text-neutral-200 hover:text-white hover:bg-black rounded flex items-center gap-1 transition-colors cursor-pointer text-[10px] font-semibold border border-neutral-600 hover:border-emerald-500"
                >
                  {localizeCopy("退出", "Logout")}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white border-b border-neutral-200 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div onClick={() => setCurrentView('merchant_portal')} className="cursor-pointer flex items-center gap-2.5 shrink-0">
              <img
                src="/merchant-app-logo.png"
                alt="RUDA Fashion"
                className="w-9 h-9 rounded-md object-cover shadow"
              />
              <div>
                <div className="font-serif font-black text-lg tracking-wider text-neutral-900">RUDA · 生产商中心</div>
                <div className="hidden sm:block text-[10px] text-neutral-500 uppercase tracking-widest">
                  {localizeCopy('商户管理 · {{RUDA_ARG_0}}, {{RUDA_ARG_1}}', 'Gestione fornitore · {{RUDA_ARG_0}}, {{RUDA_ARG_1}}', [String(authMerchant.city), String(authMerchant.country)])}
                </div>
              </div>
            </div>
            <div className="text-right text-[11px] text-neutral-600 hidden md:block">
              <div className="font-semibold">{localizeCopy("现货直发 · 当日配货 · 次日出库", "In-Stock · Same-day Picking · Next-day Dispatch")}</div>
              <div className="font-mono text-neutral-500">
                {t('currencyEu')} · DHL / GLS / Bartolini
              </div>
            </div>
          </div>
        </div>
      </header>
    );
  }

  // ================================
  // 🛍️ DEFAULT: BUYER FRONTEND (首页/选款/展厅等)
  //  - 如果批发商已登录，显示批发商信息和退出
  //  - 未登录则显示"登录/注册"入口
  // ================================
  const isBuyerLoggedIn = authRole === 'buyer';
  const isMerchantLoggedIn = authRole === 'merchant' && Boolean(authMerchant);
  const hasSession = authRole !== 'guest' && authRole !== 'consumer';
  const directoryNav = [
    { label: localizeCopy('首页', 'Home'), path: '/', view: 'home' as const },
    { label: localizeCopy('潮流时尚', 'Moda'), path: '/trends', view: 'fashion_trends' as const },
    { label: localizeCopy('特价市场', 'Outlet'), path: '/catalog', view: 'catalog' as const },
    { label: localizeCopy('找店', 'Trova negozio'), path: '/showrooms', view: 'showrooms' as const },
    ...merchantIndustries.map(industry => ({
      label: localizeCopy(industry.zh, industry.it),
      path: `/showrooms?businessIndustry=${industry.id}`,
      view: 'showrooms' as const
    }))
  ].filter(item => fashionEnabled || item.view !== 'fashion_trends');
  const navigateDirectory = (path: string, view: 'home' | 'fashion_trends' | 'catalog' | 'showrooms') => {
    setCurrentView(view);
    if (window.location.pathname !== path) window.history.pushState({}, '', path);
    else if (window.location.search !== new URL(path, window.location.origin).search) window.history.pushState({}, '', path);
    window.dispatchEvent(new Event('ruda:directory-navigation'));
  };

  return (
    <header className={`sticky top-0 z-40 bg-white border-b border-neutral-200 shadow-xs ${currentView === 'home' ? 'mobile-editorial-hide-header' : ''}`}>
      {/* Main Bar */}
      <div className="max-w-7xl mx-auto grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1 px-4 py-3 sm:py-4">
        <div
          onClick={() => setCurrentView('home')}
          className="col-start-2 row-start-1 cursor-pointer text-center"
        >
          <span className="font-serif text-4xl font-medium tracking-[0.12em] text-neutral-950 sm:text-5xl">RUDA</span>
          <p className="text-[10px] font-semibold uppercase tracking-[0.42em] text-neutral-500 sm:text-xs">FASHION</p>
        </div>

        <div className="col-start-3 row-start-1 ml-auto flex items-center justify-end gap-1">
          <div className="relative block">
            <button
              id="account-menu-toggle"
              type="button"
              onClick={() => setShowAccountMenu(!showAccountMenu)}
              aria-label={hasSession ? localizeCopy("我的 RUDA", "My RUDA") : localizeCopy("登录", "Sign in")}
              title={hasSession ? localizeCopy("我的 RUDA", "My RUDA") : localizeCopy("登录", "Sign in")}
              aria-expanded={showAccountMenu}
              aria-controls="account-dropdown-menu"
              className={headerIconButtonClass}
            >
              <UserCircle className="h-3.5 w-3.5" />
            </button>

            {showAccountMenu && (
              <div
                id="account-dropdown-menu"
                className="absolute left-0 mt-2 w-72 bg-white border border-neutral-200 rounded-xl shadow-xl p-3 z-50"
              >
                <button
                  type="button"
                  onClick={() => { setCurrentView('account'); setShowAccountMenu(false); }}
                  className="w-full rounded-lg px-2 py-2 text-left text-xs font-semibold text-neutral-800 hover:bg-neutral-100"
                >
                  {localizeCopy("设置", "Impostazioni")}
                </button>
                <div className="my-2 border-t border-neutral-100" />
                {!hasSession ? (
                  <>
                    <button
                      id="header-sign-in-btn"
                      type="button"
                      onClick={() => { setShowAccountMenu(false); openCustomerLogin(); }}
                      className="w-full rounded-lg px-2 py-2 text-left text-xs font-semibold text-neutral-800 hover:bg-neutral-100"
                    >
                      {localizeCopy("登录", "Sign in")}
                    </button>
                    <button
                      id="header-register-account-btn"
                      type="button"
                      onClick={() => { setShowAccountMenu(false); setCurrentView('register_wholesale'); }}
                      className="w-full rounded-lg px-2 py-2 text-left text-xs font-semibold text-neutral-800 hover:bg-neutral-100"
                    >
                      {localizeCopy("注册", "Registrati")}
                    </button>
                  </>
                ) : isMerchantLoggedIn && authMerchant ? (
                  <>
                    <div className="mb-2 rounded-xl bg-neutral-950 px-3 py-3 text-white">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">{t('navMerchantBusiness')}</div>
                      <div className="mt-1 truncate font-bold">{authMerchant.name}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { window.location.href = '/merchant'; }}
                      className="w-full rounded-lg bg-black px-3 py-2.5 text-left text-xs font-bold text-white"
                    >
                      {localizeCopy("进入商务后台", "Apri l’area business")}
                    </button>
                    <button
                      type="button"
                      onClick={() => { logout(); setShowAccountMenu(false); }}
                      className="mt-2 w-full rounded-lg border border-neutral-200 px-3 py-2 text-left text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
                    >
                      {localizeCopy("退出登录", "Sign out")}
                    </button>
                  </>
                ) : isBuyerLoggedIn && authBuyer ? (
                  <>
                    <div className="px-2 py-2 mb-1 rounded-lg bg-black text-white">
                      <div className="text-[11px] text-neutral-300 uppercase tracking-widest">
                        {localizeCopy("已登录批发商账户", "WHOLESALER CONNECTED")}
                      </div>
                      <div className="font-bold truncate">{authBuyer.companyName}</div>
                      <div className="text-[10px] text-neutral-300 font-mono">
                        {authBuyer.city}, {authBuyer.country} · VAT {authBuyer.vatNumber}
                      </div>
                    </div>
                    <div className="border-t border-neutral-100 my-2"></div>
                    <button
                      type="button"
                      onClick={() => { setActiveBuyerTab('dashboard'); setCurrentView('account'); setShowAccountMenu(false); }}
                      className="w-full text-left px-2 py-2 text-black font-bold hover:bg-neutral-100 rounded flex items-center gap-1.5 cursor-pointer text-xs"
                    >
                      {t('navMyBusiness')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCurrentView('orders'); setShowAccountMenu(false); }}
                      className="w-full text-left px-2 py-2 text-neutral-800 font-semibold hover:bg-neutral-100 rounded flex items-center gap-1.5 cursor-pointer text-xs"
                    >
                      {t('ordersTitle')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCurrentView('purchase_order'); setShowAccountMenu(false); }}
                      className="w-full text-left px-2 py-2 text-neutral-800 font-semibold hover:bg-neutral-100 rounded flex items-center gap-1.5 cursor-pointer text-xs"
                    >
                      {localizeCopy("采购单快速下单", "Purchase Order Upload")}
                    </button>
                    <div className="border-t border-neutral-100 mt-2 pt-2"></div>
                    <button
                      type="button"
                      onClick={() => { logout(); setShowAccountMenu(false); }}
                      className="w-full text-left px-2 py-2 text-black font-semibold hover:bg-neutral-100 rounded flex items-center gap-1.5 cursor-pointer text-xs border border-neutral-200 hover:border-emerald-400"
                    >
                      {localizeCopy("安全退出登录", "Secure Logout")}
                    </button>
                  </>
                ) : authRole === 'company' ? (
                  <>
                    <div className="mb-2 rounded-xl bg-neutral-950 px-3 py-3 text-white">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">MY RUDA</div>
                      <div className="mt-1 font-bold">{localizeCopy("零售商账户", "Retailer account")}</div>
                      <div className="mt-1 text-[10px] text-neutral-400">ID · {authCompanyId?.slice(0, 8) || '—'}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setShowBuyerRegister(true); setShowAccountMenu(false); }}
                      className="w-full rounded-lg bg-black px-3 py-2.5 text-left text-xs font-bold text-white"
                    >
                      {localizeCopy("完善零售商资料", "Complete retailer profile")}
                    </button>
                    <button
                      type="button"
                      onClick={() => { logout(); setShowAccountMenu(false); }}
                      className="mt-2 w-full rounded-lg border border-neutral-200 px-3 py-2 text-left text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
                    >
                      {localizeCopy("退出登录", "Sign out")}
                    </button>
                  </>
                ) : authRole === 'customer' && authCustomerAccount ? (
                  <>
                    <div className="mb-2 rounded-xl bg-neutral-950 px-3 py-3 text-white">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">{localizeCopy("客户账户", "Account cliente")}</div>
                      <div className="mt-1 truncate font-bold">{authCustomerAccount.email || authCustomerAccount.phone || localizeCopy("已登录", "Connesso")}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setCurrentView('account'); setShowAccountMenu(false); }}
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-left text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
                    >
                      {localizeCopy("我的账户", "Il mio account")}
                    </button>
                    <button
                      type="button"
                      onClick={() => { logout(); setShowAccountMenu(false); }}
                      className="mt-2 w-full rounded-lg border border-neutral-200 px-3 py-2 text-left text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
                    >
                      {localizeCopy("退出登录", "Sign out")}
                    </button>
                  </>
                ) : null}
              </div>
            )}
          </div>
          {currentView === 'home' && (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event('ruda:open-platform-support'))}
              aria-label={localizeCopy("打开 AI 客服", "Apri assistenza AI")}
              title={localizeCopy("AI 客服", "Assistenza AI")}
              className={`${headerIconButtonClass} lg:hidden`}
            >
              <Bot className="h-3 w-3" strokeWidth={1.8} />
            </button>
          )}

        </div>
      </div>

      <nav aria-label={localizeCopy("商家与特价导航", "Navigazione showroom e offerte")} className="hidden border-t border-neutral-200 md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-start gap-6 overflow-x-auto px-4 py-3 lg:justify-center lg:gap-7">
          {directoryNav.map(item => {
            const itemUrl = new URL(item.path, window.location.origin);
            const isIndustryLink = itemUrl.searchParams.has('businessIndustry');
            const currentUrl = new URL(window.location.href);
            const isActive = isIndustryLink
              ? currentView === 'showrooms' && currentUrl.searchParams.get('businessIndustry') === itemUrl.searchParams.get('businessIndustry')
              : item.path === '/catalog'
              ? currentView === 'catalog'
              : item.path === '/'
                ? currentView === 'home'
                : item.path === '/trends'
                  ? currentView === 'fashion_trends'
                  : window.location.pathname === item.path && !currentUrl.searchParams.has('businessIndustry');
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => navigateDirectory(item.path, item.view)}
                aria-current={isActive ? 'page' : undefined}
                className={`shrink-0 border-b pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors ${
                  isActive
                    ? 'border-neutral-950 text-neutral-950'
                    : 'border-transparent text-neutral-600 hover:border-neutral-400 hover:text-neutral-950'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

    </header>
  );
};

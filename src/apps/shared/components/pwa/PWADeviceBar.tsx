import React from 'react';
import { 
  Smartphone, 
  Monitor, 
  Download, 
  Bell, 
  Sparkles, 
  Layers, 
  Store, 
  ShieldCheck, 
  Building2,
  CheckCircle2,
  ChevronDown
} from 'lucide-react';
import { useB2B } from '../../../../context/B2BContext';
import { usePWAInstall } from '../../../../hooks/usePWAInstall';

export const PWADeviceBar: React.FC = () => {
  const { 
    deviceMode, 
    setDeviceMode,
    currentView,
    setCurrentView,
    setShowPWAInstallModal,
    setShowPWANotifications,
    merchantMobileMode,
    setMerchantMobileMode,
    adminMobileMode,
    setAdminMobileMode
    ,lang, localizeCopy
  } = useB2B();

  const { isInstalled } = usePWAInstall();
  const isIt = lang === 'it';

  return (
    <aside 
      id="pwa-global-device-bar"
      aria-label={localizeCopy('PWA 状态与设备模式', 'Stato app e modalità dispositivo')}
      className="bg-neutral-950 text-white text-xs border-b border-neutral-800/80 px-3 py-1.5 flex items-center justify-between select-none z-50 sticky top-0"
    >
      {/* Left: Brand & PWA badge */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold tracking-wider text-neutral-300">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="font-serif font-black text-white tracking-widest">RUDA</span>
          <span className="hidden sm:inline text-neutral-500">·</span>
          <span className="hidden sm:inline text-neutral-400 text-[10px]">{localizeCopy('应用已就绪', 'APP PRONTA')}</span>
        </div>

        {/* Install APP CTA Button */}
        <button
          id="pwa-install-app-header-btn"
          onClick={() => setShowPWAInstallModal(true)}
          className="flex items-center gap-1 px-2 py-0.8 rounded-full bg-amber-400 text-neutral-950 text-[10px] font-extrabold hover:bg-amber-300 active:scale-95 transition-all shadow-xs cursor-pointer ml-1"
        >
          <Download className="w-3 h-3 stroke-[2.5]" />
          <span>{isInstalled ? (localizeCopy('已安装应用', 'App installata')) : (localizeCopy('安装应用', 'Installa app'))}</span>
        </button>

        {/* Push Notification Center CTA Button */}
        <button
          id="pwa-notification-bell-btn"
          onClick={() => setShowPWANotifications(true)}
          className="flex items-center gap-1 px-2 py-0.8 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[10px] font-semibold transition-colors cursor-pointer"
        >
          <Bell className="w-3 h-3 text-amber-400" />
          <span className="hidden xs:inline">{localizeCopy('推送通知', 'Notifiche')}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
        </button>
      </div>

      {/* Right: Dual Mode Switcher (Web 电脑版 vs 手机 PWA 体验版) & Quick Portals */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Quick Portal Switcher Pills */}
        <div className="hidden md:flex items-center bg-neutral-900 border border-neutral-800 rounded-lg p-0.5 text-[10px]">
          <button
            onClick={() => setCurrentView('account')}
            className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
              currentView === 'account' ? 'bg-neutral-800 text-white font-bold' : 'text-neutral-400 hover:text-white'
            }`}
          >
            {localizeCopy('买手业务', 'Area buyer')}
          </button>
          <button
            onClick={() => {
              setCurrentView('merchant_portal');
              setMerchantMobileMode(true);
            }}
            className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
              currentView === 'merchant_portal' ? 'bg-neutral-800 text-white font-bold' : 'text-neutral-400 hover:text-white'
            }`}
          >
            {localizeCopy('商家手机后台', 'Area fornitori')}
          </button>
          <button
            onClick={() => {
              setCurrentView('platform_admin');
              setAdminMobileMode(true);
            }}
            className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
              currentView === 'platform_admin' ? 'bg-neutral-800 text-white font-bold' : 'text-neutral-400 hover:text-white'
            }`}
          >
            {localizeCopy('平台管理', 'Gestione piattaforma')}
          </button>
        </div>

        {/* View Mode Switcher: Desktop Web vs Mobile PWA Frame */}
        <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-lg p-0.5">
          <button
            id="viewmode-responsive-btn"
            onClick={() => setDeviceMode('responsive')}
            title={localizeCopy('电脑端布局', 'Versione desktop')}
            className={`flex items-center gap-1 px-2 py-0.8 rounded text-[11px] font-semibold transition-all cursor-pointer ${
              deviceMode === 'responsive' 
                ? 'bg-neutral-800 text-white shadow-2xs' 
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Monitor className="w-3 h-3" />
            <span className="hidden sm:inline">{localizeCopy('电脑版', 'Desktop')}</span>
          </button>
          <button
            id="viewmode-mobile-preview-btn"
            onClick={() => setDeviceMode('mobile_preview')}
            title={localizeCopy('手机版应用预览', 'Anteprima mobile')}
            className={`flex items-center gap-1 px-2 py-0.8 rounded text-[11px] font-semibold transition-all cursor-pointer ${
              deviceMode === 'mobile_preview' 
                ? 'bg-amber-400 text-neutral-950 font-bold shadow-2xs' 
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Smartphone className="w-3 h-3" />
            <span>{localizeCopy('手机版应用', 'Mobile')}</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

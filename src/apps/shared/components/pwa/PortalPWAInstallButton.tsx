import React from 'react';
import { Download } from 'lucide-react';
import { PWAInstallModal } from './PWAInstallModal';
import { usePWAInstall } from '../../../../hooks/usePWAInstall';
import { useB2B } from '../../../../context/B2BContext';
import { PORTAL_DOMAINS } from '../../../../shared/portalDomains';

export const PortalPWAInstallButton: React.FC = () => {
  const { lang, localizeCopy } = useB2B();
  const [open, setOpen] = React.useState(false);
  const host = window.location.hostname.toLowerCase();
  const isEmployee = host === PORTAL_DOMAINS.employee || window.location.pathname.startsWith('/employee');
  const storageKey = isEmployee ? 'ruda_xs_employee' : `ruda_${host.replace(/\./g, '_') || 'pwa'}`;
  const { isInstalled, dismissPrompt } = usePWAInstall(storageKey);
  const isIt = lang === 'it';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={localizeCopy('下载 APP', 'Scarica app')}
        className="fixed right-2 top-[calc(0.35rem+env(safe-area-inset-top))] z-[55] flex items-center gap-1 rounded-full bg-neutral-950/90 px-2 py-1 text-[10px] font-bold text-white shadow-md backdrop-blur transition hover:bg-neutral-800"
      >
        <Download className="h-3 w-3" />
        {isInstalled ? (localizeCopy('已安装', 'Installata')) : (localizeCopy('下载', 'Installa'))}
      </button>
      <PWAInstallModal
        isOpen={open}
        onClose={() => {
          dismissPrompt();
          setOpen(false);
        }}
        storageKey={storageKey}
      />
    </>
  );
};

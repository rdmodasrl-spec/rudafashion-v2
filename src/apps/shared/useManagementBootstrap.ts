import { useEffect, useState } from 'react';
import { useB2B } from '../../context/B2BContext';

export function useManagementBootstrap() {
  const { initRouteFromURL } = useB2B();
  const [portalZone, setPortalZone] = useState<'merchant' | 'employee' | 'admin' | null>(null);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    const zone = initRouteFromURL();
    const appTarget = document.documentElement.dataset.rudaApp;

    let effectiveZone: 'merchant' | 'employee' | 'admin' | null = null;
    if (zone === 'merchant' || zone === 'employee' || zone === 'admin') {
      effectiveZone = zone;
    } else if (appTarget === 'merchant-admin-web') {
      effectiveZone = 'merchant';
    } else if (appTarget === 'merchant-admin-mobile') {
      effectiveZone = 'employee';
    } else if (appTarget === 'platform-admin-web' || appTarget === 'platform-admin-mobile') {
      effectiveZone = 'admin';
    }

    if (effectiveZone) setPortalZone(effectiveZone);
    const timer = window.setTimeout(() => setBooted(true), 30);
    return () => window.clearTimeout(timer);
  }, []);

  return { booted, portalZone };
}

import { useState, useEffect } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall(storageKey = 'ruda_pwa') {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstallPromptModal, setShowInstallPromptModal] = useState(false);

  useEffect(() => {
    // Check if running in standalone mode (installed PWA)
    const checkStandalone = 
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes('android-app://');

    setIsStandalone(checkStandalone);
    setIsInstalled(checkStandalone);

    // Check if device is iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(ua) && !(window as unknown as { MSStream?: boolean }).MSStream;
    setIsIOS(isAppleDevice);

    // Listen to beforeinstallprompt event (Chromium, Android, Edge)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowInstallPromptModal(false);
      localStorage.setItem(`${storageKey}_installed`, 'true');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Check if user dismissed prompt recently
    const dismissedAt = localStorage.getItem(`${storageKey}_prompt_dismissed`);
    const installed = localStorage.getItem(`${storageKey}_installed`);
    
    // Automatically suggest prompt on first visit after 2 seconds if not installed
    if (!checkStandalone && !installed && !dismissedAt) {
      const timer = setTimeout(() => {
        setShowInstallPromptModal(true);
      }, 2500);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async (): Promise<boolean> => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
        setShowInstallPromptModal(false);
        localStorage.setItem(`${storageKey}_installed`, 'true');
        return true;
      }
      return false;
    }
    return false;
  };

  const dismissPrompt = (dontAskAgain = false) => {
    setShowInstallPromptModal(false);
    if (dontAskAgain) {
      localStorage.setItem(`${storageKey}_prompt_dismissed`, Date.now().toString());
    }
  };

  return {
    isInstallable: !!deferredPrompt || isIOS,
    isInstalled,
    isIOS,
    isStandalone,
    showInstallPromptModal,
    setShowInstallPromptModal,
    install,
    dismissPrompt
  };
}

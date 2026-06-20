'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaInstallValue {
  /** Hay un evento de instalación diferido (Android/Chrome) → se puede llamar prompt(). */
  canPrompt: boolean;
  /** iOS/Safari: no hay prompt nativo, hay que instruir (Compartir → Agregar a inicio). */
  isIos: boolean;
  /** La app ya corre instalada (standalone). */
  isStandalone: boolean;
  /** Lanza el prompt nativo. Devuelve el resultado o 'unavailable' si no hay evento. */
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

const PwaInstallContext = createContext<PwaInstallValue | null>(null);

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function detectIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Provee el estado de instalación de la PWA a toda la app. Captura UNA sola vez el
 * evento `beforeinstallprompt` y registra el service worker, de modo que tanto el
 * banner (`InstallPrompt`) como el botón permanente del menú (`NavMenu`) compartan
 * el mismo evento diferido (que solo puede usarse una vez).
 */
export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    setIsStandalone(detectStandalone());
    setIsIos(detectIos());

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => { setDeferred(null); setIsStandalone(true); };

    window.addEventListener('beforeinstallprompt', onBIP);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferred) return 'unavailable';
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    return outcome;
  };

  return (
    <PwaInstallContext.Provider value={{ canPrompt: !!deferred, isIos, isStandalone, promptInstall }}>
      {children}
    </PwaInstallContext.Provider>
  );
}

/** Devuelve el estado de instalación, o null si se usa fuera del provider. */
export function usePwaInstall(): PwaInstallValue | null {
  return useContext(PwaInstallContext);
}

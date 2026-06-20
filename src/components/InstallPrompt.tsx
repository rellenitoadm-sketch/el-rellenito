'use client';

import { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';
import { useOnboarding } from './Onboarding';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'rl_install_dismissed';

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Banner para instalar la PWA en la pantalla de inicio.
 * - Android/Chrome: usa el evento beforeinstallprompt → botón "Instalar".
 * - iOS/Safari: no hay prompt nativo → muestra instrucciones (Compartir → Agregar a inicio).
 * Se oculta si ya está instalada (standalone) o si el usuario lo descartó.
 * También registra el service worker (requisito para instalar / offline básico).
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const { activeTour } = useOnboarding();

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    if (isStandalone()) return;
    let dismissed = false;
    try { dismissed = localStorage.getItem(DISMISS_KEY) === '1'; } catch {}
    if (dismissed) return;

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', onBIP);

    // iOS no dispara beforeinstallprompt.
    if (isIos()) { setIosHint(true); setShow(true); }

    return () => window.removeEventListener('beforeinstallprompt', onBIP);
  }, []);

  const dismiss = () => {
    setShow(false);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') setShow(false);
    setDeferred(null);
  };

  // Se oculta durante un tutorial y reaparece al terminarlo (no se descarta solo).
  if (!show || activeTour) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-1.5rem)] max-w-md">
      <div className="card flex items-center gap-3 p-3" style={{ boxShadow: 'var(--sh-3)' }}>
        <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0" style={{ background: 'var(--brand-soft)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold" style={{ color: 'var(--text-1)' }}>Instala El Rellenito</p>
          {iosHint ? (
            <p className="text-[11.5px] leading-snug" style={{ color: 'var(--text-2)' }}>
              Toca <Share className="inline w-3.5 h-3.5 align-text-bottom" /> y luego “Agregar a inicio”.
            </p>
          ) : (
            <p className="text-[11.5px]" style={{ color: 'var(--text-2)' }}>Acceso directo en tu pantalla de inicio.</p>
          )}
        </div>
        {!iosHint && (
          <button
            onClick={install}
            className="btn btn-primary flex-shrink-0"
            style={{ padding: '8px 14px', fontSize: '13px', minHeight: 44 }}
          >
            <Download className="w-4 h-4" /> Instalar
          </button>
        )}
        <button
          onClick={dismiss}
          aria-label="Cerrar"
          className="flex items-center justify-center flex-shrink-0"
          style={{ minWidth: 44, minHeight: 44, color: 'var(--text-3)' }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

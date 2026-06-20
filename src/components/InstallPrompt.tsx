'use client';

import { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';
import { useOnboarding } from './Onboarding';
import { usePwaInstall } from './PwaInstall';

const DISMISS_KEY = 'rl_install_dismissed';

/**
 * Banner para instalar la PWA en la pantalla de inicio.
 * - Android/Chrome: usa el evento beforeinstallprompt (vía PwaInstallProvider) → botón "Instalar".
 * - iOS/Safari: no hay prompt nativo → muestra instrucciones (Compartir → Agregar a inicio).
 * Se oculta si ya está instalada (standalone), si el usuario lo descartó, o mientras
 * hay un tutorial en curso. El botón permanente del menú (NavMenu) no se descarta.
 */
export default function InstallPrompt() {
  const { activeTour } = useOnboarding();
  const pwa = usePwaInstall();
  const [dismissed, setDismissed] = useState(true); // true hasta leer localStorage

  useEffect(() => {
    try { setDismissed(localStorage.getItem(DISMISS_KEY) === '1'); } catch { setDismissed(false); }
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
  };

  const install = async () => {
    if (!pwa) return;
    const outcome = await pwa.promptInstall();
    if (outcome === 'accepted') setDismissed(true);
  };

  if (!pwa || pwa.isStandalone || dismissed || activeTour) return null;
  // Solo tiene sentido el banner si se puede lanzar el prompt (Android) o instruir (iOS).
  if (!pwa.canPrompt && !pwa.isIos) return null;
  const iosHint = !pwa.canPrompt; // aquí, sin prompt nativo ⇒ es iOS

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[84] w-[calc(100%-1.5rem)] max-w-md">
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

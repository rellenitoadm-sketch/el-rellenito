'use client';

import { useEffect, useState } from 'react';
import { Download, X, Share, ChevronDown, Plus, Check } from 'lucide-react';
import { useOnboarding } from './Onboarding';
import { usePwaInstall } from './PwaInstall';

const DISMISS_KEY = 'rl_install_dismissed';

/** Navegadores embebidos (Instagram, Facebook, etc.) donde NO se puede instalar a inicio. */
function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /FBAN|FBAV|Instagram|Line\/|Twitter|MicroMessenger|TikTok|Snapchat/i.test(navigator.userAgent || '');
}

/**
 * Banner para instalar la PWA en la pantalla de inicio.
 * - Android/Chrome: usa beforeinstallprompt (vía PwaInstallProvider) → botón "Instalar".
 * - iOS/Safari: no hay prompt nativo → botón "Cómo instalar" que abre un modal
 *   con los pasos exactos (Compartir → Agregar a inicio → Confirmar).
 * Se oculta si ya está instalada, si el usuario lo descartó, en navegadores in-app,
 * o mientras hay un tutorial en curso.
 */
export default function InstallPrompt() {
  const { activeTour } = useOnboarding();
  const pwa = usePwaInstall();
  const [dismissed, setDismissed] = useState(true); // true hasta leer localStorage
  const [inApp, setInApp] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    try { setDismissed(localStorage.getItem(DISMISS_KEY) === '1'); } catch { setDismissed(false); }
    setInApp(isInAppBrowser());
  }, []);

  // Cerrar el modal con Escape.
  useEffect(() => {
    if (!showSteps) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowSteps(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showSteps]);

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
  // Solo tiene sentido si se puede lanzar el prompt (Android) o instruir (iOS Safari).
  if (!pwa.canPrompt && !pwa.isIos) return null;
  const iosHint = !pwa.canPrompt; // aquí, sin prompt nativo ⇒ es iOS
  // En navegadores in-app de iOS no se puede instalar → no mostrar nada.
  if (iosHint && inApp) return null;

  return (
    <>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[84] w-[calc(100%-1.5rem)] max-w-md">
        <div className="card flex items-center gap-3 p-3" style={{ boxShadow: 'var(--sh-3)' }}>
          <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0" style={{ background: 'var(--brand-soft)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-192.png" alt="" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold" style={{ color: 'var(--text-1)' }}>Instala El Rellenito</p>
            <p className="text-[11.5px]" style={{ color: 'var(--text-2)' }}>Acceso directo en tu pantalla de inicio.</p>
          </div>
          {iosHint ? (
            <button
              onClick={() => setShowSteps(true)}
              className="btn btn-primary flex-shrink-0"
              style={{ padding: '8px 14px', fontSize: '13px', minHeight: 44 }}
            >
              <Share className="w-4 h-4" /> Cómo instalar
            </button>
          ) : (
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

      {/* Modal de pasos para iOS */}
      {showSteps && (
        <div className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label="Cómo instalar en iPhone">
          <div className="absolute inset-0 bg-black/55" onClick={() => setShowSteps(false)} />
          <div className="relative w-full max-w-sm rounded-t-3xl sm:rounded-3xl overflow-hidden" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <p className="font-bold text-[15px]" style={{ color: 'var(--text-1)' }}>Instalar en tu iPhone</p>
              <button onClick={() => setShowSteps(false)} aria-label="Cerrar" className="p-1" style={{ color: 'var(--text-3)' }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-4 py-4 space-y-3.5">
              <Step n={1} icon={<Share className="w-4 h-4" />}>
                Toca el botón <b>Compartir</b> en la barra de Safari.
              </Step>
              <Step n={2} icon={<ChevronDown className="w-4 h-4" />}>
                <b>Desliza hacia abajo</b> en el menú que aparece.
              </Step>
              <Step n={3} icon={<Plus className="w-4 h-4" />}>
                Toca <b>“Agregar a inicio”</b> (Add to Home Screen).
              </Step>
              <Step n={4} icon={<Check className="w-4 h-4" />}>
                Confirma con <b>“Agregar”</b>. ¡Listo, queda en tu pantalla de inicio!
              </Step>
            </div>
            <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => setShowSteps(false)} className="btn btn-primary w-full" style={{ minHeight: 46 }}>
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Step({ n, icon, children }: { n: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold" style={{ background: 'var(--brand)', color: '#fff' }}>
        {n}
      </span>
      <p className="text-[13.5px] leading-snug flex-1 pt-0.5" style={{ color: 'var(--text-2)' }}>
        {children}
      </p>
      <span className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5" style={{ background: 'var(--surface-2)', color: 'var(--brand-deep)' }}>
        {icon}
      </span>
    </div>
  );
}

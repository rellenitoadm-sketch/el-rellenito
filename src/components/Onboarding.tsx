'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

/**
 * Onboarding interactivo guiado por pasos. Oscurece la pantalla y resalta
 * (spotlight) secuencialmente cada parte explicada mediante un recorte hecho con
 * box-shadow sobre el rect del elemento (se mide en runtime, sin posiciones fijas).
 * Cada tutorial se muestra UNA sola vez (estado en LocalStorage).
 */
interface Step {
  /** Valor del atributo data-tour del elemento a resaltar. */
  target: string;
  title: string;
  body: string;
}

const CATALOG_STEPS: Step[] = [
  { target: 'mayor', title: 'Al Detal y Al Mayor', body: 'Compra por unidad o cambia a pedidos al mayor para eventos y volumen.' },
  { target: 'categories', title: 'Categorías', body: 'Salta directo a tequeños, pasapalos, panadería y más con esta barra.' },
  { target: 'currency', title: 'Moneda', body: 'Ve los precios en pesos, dólares o bolívares. Tú eliges.' },
  { target: 'view', title: 'Lista o cuadrícula', body: 'Cambia cómo se ven los productos según tu preferencia.' },
  { target: 'menu', title: 'Menú', body: 'Aquí encuentras inicio, categorías, contacto e información.' },
  { target: 'info', title: 'El Rellenito', body: 'Horario y estado del negocio siempre a la vista. ¡Listo para pedir!' },
];

const CART_STEPS: Step[] = [
  { target: 'cart-items', title: 'Tus productos', body: 'Revisa lo que llevas y ajusta las cantidades con los botones.' },
  { target: 'cart-subtotal', title: 'Subtotal', body: 'Aquí ves el total de tu pedido en la moneda elegida.' },
  { target: 'cart-checkout', title: 'Finalizar', body: 'Continúa para elegir pago móvil o transferencia y confirmar tu pedido.' },
];

const KEYS = {
  catalog: 'rl_tour_catalog_v1',
  cart: 'rl_tour_cart_v1',
} as const;

interface OnboardingContextValue {
  maybeStartCatalog: () => void;
  maybeStartCart: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<null | 'catalog' | 'cart'>(null);

  const maybeStart = useCallback((which: 'catalog' | 'cart') => {
    if (typeof window === 'undefined') return;
    setActive(prev => {
      if (prev) return prev; // no interrumpir un tutorial en curso
      try { if (localStorage.getItem(KEYS[which])) return prev; } catch { return prev; }
      return which;
    });
  }, []);

  const maybeStartCatalog = useCallback(() => maybeStart('catalog'), [maybeStart]);
  const maybeStartCart = useCallback(() => maybeStart('cart'), [maybeStart]);

  const finish = useCallback((which: 'catalog' | 'cart') => {
    try { localStorage.setItem(KEYS[which], '1'); } catch { /* ignore */ }
    setActive(null);
  }, []);

  return (
    <OnboardingContext.Provider value={{ maybeStartCatalog, maybeStartCart }}>
      {children}
      <AnimatePresence>
        {active === 'catalog' && <Tour key="catalog" steps={CATALOG_STEPS} onClose={() => finish('catalog')} />}
        {active === 'cart' && <Tour key="cart" steps={CART_STEPS} onClose={() => finish('cart')} />}
      </AnimatePresence>
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be inside OnboardingProvider');
  return ctx;
}

const PAD = 8; // margen del recorte alrededor del elemento

function Tour({ steps, onClose }: { steps: Step[]; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[i];
  const isLast = i === steps.length - 1;

  // Mide (y sigue) el elemento objetivo del paso actual.
  useEffect(() => {
    const find = () => document.querySelector(`[data-tour="${step.target}"]`) as HTMLElement | null;
    const el = find();
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const measure = () => {
      const t = find();
      setRect(t ? t.getBoundingClientRect() : null);
    };
    measure();
    // Sigue al elemento mientras el scroll suave termina.
    const id = window.setInterval(measure, 100);
    const stop = window.setTimeout(() => window.clearInterval(id), 900);
    window.addEventListener('resize', measure);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(stop);
      window.removeEventListener('resize', measure);
    };
  }, [step.target]);

  // Escape salta el tutorial.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const next = () => { if (isLast) onClose(); else setI(n => n + 1); };

  // La tarjeta va arriba si el elemento está en la mitad inferior; si no, abajo.
  const cardAtTop = rect ? rect.top + rect.height / 2 > window.innerHeight / 2 : false;

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label="Tutorial">
      {/* Capa que bloquea la interacción con el fondo (UI congelada). */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      {/* Spotlight: recorte con box-shadow gigante. Si no hay objetivo, oscurece todo. */}
      {rect ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute pointer-events-none"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            borderRadius: 14,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.72)',
            transition: 'top 0.2s, left 0.2s, width 0.2s, height 0.2s',
          }}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.72)' }} />
      )}

      {/* Tarjeta de texto + controles */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute left-4 right-4 z-[92]"
        style={cardAtTop ? { top: 'calc(env(safe-area-inset-top, 0px) + 16px)' } : { bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
      >
        <div className="mx-auto w-full max-w-[420px] rounded-2xl p-4" style={{ background: 'var(--surface)', boxShadow: 'var(--sh-3, 0 10px 40px rgba(0,0,0,0.35))' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--brand-deep)' }}>
                Paso {i + 1} de {steps.length}
              </p>
              <h3 className="text-[16px] font-bold leading-tight" style={{ color: 'var(--text-1)' }}>{step.title}</h3>
            </div>
            <button onClick={onClose} aria-label="Saltar tutorial" className="p-1 flex-shrink-0" style={{ color: 'var(--text-3)' }}>
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-[13.5px] mt-2 leading-relaxed" style={{ color: 'var(--text-2)' }}>{step.body}</p>

          <div className="flex items-center justify-between mt-4">
            <button onClick={onClose} className="text-[13px] font-medium" style={{ color: 'var(--text-3)' }}>
              Saltar
            </button>
            <div className="flex items-center gap-1.5">
              {steps.map((_, idx) => (
                <span key={idx} className="w-1.5 h-1.5 rounded-full" style={{ background: idx === i ? 'var(--brand)' : 'var(--border)' }} />
              ))}
            </div>
            <button
              onClick={next}
              className="btn btn-primary"
              style={{ minHeight: 40, padding: '8px 18px', fontSize: 14 }}
            >
              {isLast ? 'Listo' : 'Siguiente'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

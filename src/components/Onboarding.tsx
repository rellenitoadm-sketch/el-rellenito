'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

/**
 * Onboarding interactivo guiado por pasos. Oscurece la pantalla y resalta
 * (spotlight) secuencialmente cada parte explicada mediante un recorte hecho con
 * box-shadow sobre el rect del elemento (se mide en runtime). El spotlight se
 * mueve con animación de resorte y late suavemente; la tarjeta entra/sale con
 * transición por paso. Cada tutorial se muestra UNA sola vez (LocalStorage).
 */
interface Step {
  /** Valor del atributo data-tour del elemento a resaltar. */
  target: string;
  title: string;
  body: string;
}

const STEPS: Record<TourId, Step[]> = {
  home: [
    { target: 'home-detal', title: 'Compra Al Detal', body: 'Pide por unidad para tu casa: tequeños, pan, postres y más.' },
    { target: 'home-mayor', title: 'Pedidos Al Mayor', body: 'Para eventos y volumen, con precios especiales y combos.' },
    { target: 'home-menu', title: 'Menú', body: 'Aquí abres el menú: inicio, categorías, pedidos al mayor, contacto e información.' },
    { target: 'home-intro', title: 'Quiénes somos', body: 'Recetas propias hechas en La Concordia. Desliza para ver horarios y contacto.' },
  ],
  catalog: [
    { target: 'mayor', title: 'Al Detal y Al Mayor', body: 'Cambia entre compra por unidad y pedidos al mayor cuando quieras.' },
    { target: 'categories', title: 'Categorías', body: 'Salta directo a tequeños, pasapalos, panadería y más.' },
    { target: 'currency', title: 'Moneda', body: 'Ve los precios en pesos, dólares o bolívares.' },
    { target: 'view', title: 'Lista o cuadrícula', body: 'Cambia cómo se ven los productos.' },
    { target: 'menu', title: 'Menú', body: 'Inicio, categorías, contacto e información.' },
    { target: 'info', title: 'El Rellenito', body: 'Horario y estado del negocio siempre a la vista.' },
  ],
  mayor: [
    { target: 'wmayor-categories', title: 'Categorías al mayor', body: 'Navega las categorías disponibles para pedidos por volumen.' },
    { target: 'search', title: 'Buscador', body: 'Encuentra rápido cualquier producto por su nombre.' },
    { target: 'currency', title: 'Moneda', body: 'Mismos precios en pesos, dólares o bolívares.' },
    { target: 'view', title: 'Lista o cuadrícula', body: 'Elige cómo prefieres ver los productos.' },
    { target: 'wmayor-menu', title: 'Menú', body: 'Abre el menú para ir a inicio, categorías, contacto o información.' },
    { target: 'wmayor-back', title: 'Volver', body: 'Regresa al inicio cuando quieras desde aquí.' },
  ],
  cart: [
    { target: 'cart-items', title: 'Tus productos', body: 'Revisa lo que llevas. Usa los botones – y + para ajustar la cantidad o la papelera para quitar un producto.' },
    { target: 'cart-items', title: 'Servicio de fritos', body: 'En los productos que lo permiten verás el interruptor “Fritos”: actívalo para recibirlos YA FRITOS, listos para comer. Suma un pequeño recargo por bandeja.' },
    { target: 'cart-subtotal', title: 'Subtotal', body: 'El total de tu pedido en la moneda elegida. El envío se calcula aparte al finalizar.' },
    { target: 'cart-checkout', title: 'Finalizar', body: 'Continúa para elegir entrega, datos, cómo pagar y confirmar.' },
  ],
  checkout: [
    { target: 'checkout-delivery', title: 'Cómo lo recibes', body: 'Elige entre entrega a domicilio o retiro en la tienda.' },
    { target: 'checkout-location', title: '¿Dónde te lo llevamos?', body: 'Comparte tu ubicación por GPS o escribe tu dirección. El costo del envío se confirma por WhatsApp.' },
    { target: 'checkout-data', title: 'Tus datos', body: 'Tu nombre y WhatsApp para confirmar el pedido y coordinar la entrega.' },
    { target: 'checkout-payment', title: 'Método de pago', body: 'Elige pago móvil, transferencia, efectivo u otra opción y verás los datos para pagar.' },
    { target: 'checkout-summary', title: 'Resumen', body: 'Revisa los productos, el subtotal y el total antes de confirmar.' },
    { target: 'checkout-confirm', title: 'Confirmar pedido', body: 'Confirma. Quedará registrado y te contactaremos por WhatsApp.' },
  ],
  wcheckout: [
    { target: 'wco-summary', title: 'Tu pedido al mayor', body: 'Revisa los productos y ajusta cantidades. Recuerda: al mayor hay una cantidad mínima por producto.' },
    { target: 'wco-date', title: 'Agenda la entrega', body: 'Elige la fecha y hora. Los pedidos al mayor se agendan con mínimo 24 horas de anticipación.' },
    { target: 'wco-data', title: 'Tus datos y dirección', body: 'Tu nombre, WhatsApp y la dirección de entrega. Puedes precisar la ubicación con GPS (opcional).' },
    { target: 'wco-payment', title: 'Anticipo y pago', body: 'Elige cuánto adelantar (mínimo 50%) y el método de pago. Sube el comprobante para continuar.' },
    { target: 'wco-confirm', title: 'Confirmar y pagar anticipo', body: 'Confirma tu pedido al mayor. Te contactaremos por WhatsApp para terminar de coordinar.' },
  ],
  admin: [
    { target: 'admin-title', title: 'Panel El Rellenito', body: 'Desde aquí gestionas todo el negocio. Te muestro lo principal.' },
    { target: 'admin-tabs', title: 'Secciones', body: 'Pedidos, Productos, Métricas y Clientes. Toca cada una para gestionarla; te guío dentro de cada sección al abrirla.' },
    { target: 'orders-views', title: 'Pedidos: filtros', body: 'Filtra entre pedidos de hoy, al mayor o el historial de 30 días.' },
    { target: 'orders-alerts', title: 'Alertas de pedidos', body: 'Actívalas para oír un sonido y recibir notificación en el celular cuando entre un pedido nuevo.' },
    { target: 'orders-kpis', title: 'Resumen del día', body: 'Cuántos pedidos hay, cuántos están por verificar y el total facturado.' },
    { target: 'orders-list', title: 'Gestionar un pedido', body: 'En cada pedido apruebas el pago, lo marcas en camino o entregado y abres el mapa o el WhatsApp del cliente.' },
    { target: 'admin-logout', title: 'Cerrar sesión', body: 'Sal del panel de forma segura cuando termines.' },
  ],
  adminStaff: [
    { target: 'admin-title', title: 'Panel del equipo', body: 'Bienvenido. Aquí atiendes los pedidos y mantienes los productos al día.' },
    { target: 'admin-tabs', title: 'Tus secciones', body: 'Como equipo ves Pedidos y Productos. (Métricas y Clientes son solo del administrador.)' },
    { target: 'orders-views', title: 'Pedidos: filtros', body: 'Filtra entre pedidos de hoy, al mayor o el historial de 30 días.' },
    { target: 'orders-alerts', title: 'Alertas de pedidos', body: 'Actívalas para oír un sonido y recibir notificación en el celular cuando entre un pedido nuevo.' },
    { target: 'orders-kpis', title: 'Resumen del día', body: 'Cuántos pedidos hay, cuántos están por verificar y el total facturado.' },
    { target: 'orders-list', title: 'Gestionar un pedido', body: 'En cada pedido verificas el pago, lo marcas en camino o entregado y contactas al cliente por WhatsApp.' },
    { target: 'admin-logout', title: 'Cerrar sesión', body: 'Sal del panel de forma segura cuando termines tu turno.' },
  ],
  adminProductos: [
    { target: 'products-rate', title: 'Tasa del día', body: 'La tasa BCV (Bs y COP) del día. Recárgala con el botón cuando lo necesites.' },
    { target: 'products-toolbar', title: 'Buscar y categorías', body: 'Busca un producto por nombre o entra a gestionar tus categorías.' },
    { target: 'products-cats', title: 'Filtrar por categoría', body: 'Filtra por categoría. “Incompletos” reúne los productos a los que les falta información.' },
    { target: 'products-add', title: 'Crear y editar', body: 'Crea un producto nuevo con +. Toca uno existente para editar precios, foto, umbral al mayor y el servicio de fritos.' },
  ],
  adminMetricas: [
    { target: 'metrics-revenue', title: 'Ingresos y pedidos', body: 'Ingresos y pedidos de hoy y del mes, con el ticket promedio.' },
    { target: 'metrics-visits', title: 'Visitas', body: 'Cuántas personas visitan tu página y a qué horas.' },
    { target: 'metrics-top', title: 'Más vendidos', body: 'Tus productos más vendidos en los últimos 30 días.' },
  ],
  adminCrm: [
    { target: 'crm-stats', title: 'Tus clientes', body: 'Cuántos clientes tienes y el valor total que han comprado.' },
    { target: 'crm-search', title: 'Buscar cliente', body: 'Encuentra un cliente por su nombre o número de teléfono.' },
    { target: 'crm-list', title: 'Ficha del cliente', body: 'De cada cliente ves cuánto ha gastado, sus pedidos y su WhatsApp directo.' },
  ],
};

type TourId =
  | 'home' | 'catalog' | 'mayor' | 'cart' | 'checkout' | 'wcheckout'
  | 'admin' | 'adminStaff' | 'adminProductos' | 'adminMetricas' | 'adminCrm';

const KEY_PREFIX = 'rl_tour_';
const VERSION = 'v2';

interface OnboardingContextValue {
  maybeStart: (which: TourId) => void;
  /** Tutorial en curso (o null). Lo usan banners/overlays para no estorbar. */
  activeTour: TourId | null;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<TourId | null>(null);

  const maybeStart = useCallback((which: TourId) => {
    if (typeof window === 'undefined') return;
    setActive(prev => {
      if (prev) return prev; // no interrumpir un tutorial en curso
      try { if (localStorage.getItem(`${KEY_PREFIX}${which}_${VERSION}`)) return prev; } catch { return prev; }
      return which;
    });
  }, []);

  const finish = useCallback((which: TourId) => {
    try { localStorage.setItem(`${KEY_PREFIX}${which}_${VERSION}`, '1'); } catch { /* ignore */ }
    setActive(null);
  }, []);

  return (
    <OnboardingContext.Provider value={{ maybeStart, activeTour: active }}>
      {children}
      <AnimatePresence>
        {active && <Tour key={active} steps={STEPS[active]} onClose={() => finish(active)} />}
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
    const id = window.setInterval(measure, 80);
    const stop = window.setTimeout(() => window.clearInterval(id), 1000);
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

  const cardAtTop = rect ? rect.top + rect.height / 2 > window.innerHeight / 2 : false;
  const box = rect
    ? { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }
    : null;
  const spring = { type: 'spring' as const, stiffness: 260, damping: 28 };

  return (
    <motion.div
      className="fixed inset-0 z-[100]"
      role="dialog"
      aria-modal="true"
      aria-label="Tutorial"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Capa que bloquea la interacción con el fondo (UI congelada). */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      {box ? (
        <>
          {/* Spotlight: recorte con box-shadow gigante, animado al moverse. */}
          <motion.div
            className="absolute pointer-events-none"
            initial={false}
            animate={box}
            transition={spring}
            style={{ borderRadius: 14, boxShadow: '0 0 0 9999px rgba(0,0,0,0.72)' }}
          />
          {/* Anillo que late alrededor del elemento resaltado. */}
          <motion.div
            className="absolute pointer-events-none"
            initial={false}
            animate={box}
            transition={spring}
            style={{ borderRadius: 14 }}
          >
            <motion.span
              className="absolute inset-0"
              style={{ borderRadius: 14, boxShadow: '0 0 0 2px var(--brand)' }}
              animate={{ scale: [1, 1.05, 1], opacity: [0.85, 0.25, 0.85] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            />
          </motion.div>
        </>
      ) : (
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.72)' }} />
      )}

      {/* Tarjeta de texto + controles */}
      <motion.div
        className="absolute left-4 right-4 z-[92]"
        style={cardAtTop ? { top: 'calc(env(safe-area-inset-top, 0px) + 16px)' } : { bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
        initial={{ opacity: 0, y: cardAtTop ? -16 : 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      >
        <div className="mx-auto w-full max-w-[420px] rounded-2xl p-4" style={{ background: 'var(--surface)', boxShadow: 'var(--sh-3, 0 10px 40px rgba(0,0,0,0.35))' }}>
          <div className="flex items-start justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--brand-deep)' }}>
              Paso {i + 1} de {steps.length}
            </p>
            <button onClick={onClose} aria-label="Saltar tutorial" className="p-1 -mt-1 -mr-1 flex-shrink-0" style={{ color: 'var(--text-3)' }}>
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="relative overflow-hidden mt-1" style={{ minHeight: 70 }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
              >
                <h3 className="text-[16px] font-bold leading-tight" style={{ color: 'var(--text-1)' }}>{step.title}</h3>
                <p className="text-[13.5px] mt-1.5 leading-relaxed" style={{ color: 'var(--text-2)' }}>{step.body}</p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex items-center justify-between mt-4">
            <button onClick={onClose} className="text-[13px] font-medium" style={{ color: 'var(--text-3)' }}>
              Saltar
            </button>
            <div className="flex items-center gap-1.5">
              {steps.map((_, idx) => (
                <motion.span
                  key={idx}
                  className="h-1.5 rounded-full"
                  animate={{ width: idx === i ? 18 : 6, backgroundColor: idx === i ? 'var(--brand)' : 'var(--border)' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              ))}
            </div>
            <motion.button
              onClick={next}
              whileTap={{ scale: 0.95 }}
              className="btn btn-primary"
              style={{ minHeight: 40, padding: '8px 18px', fontSize: 14 }}
            >
              {isLast ? 'Listo' : 'Siguiente'}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

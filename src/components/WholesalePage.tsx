'use client';

import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Minus, Plus, ShoppingBag, Check, X, CalendarDays, MapPin, Navigation, Loader2, AlertCircle, Lock } from 'lucide-react';
import { useProducts } from './ProductsContext';
import { useCategories } from './CategoriesContext';
import { useCurrency } from './CurrencyContext';
import { useProductModal } from './ProductModal';
import { useOnboarding } from './Onboarding';
import NavMenu from './NavMenu';
import FilterRow, { type ViewMode } from './FilterRow';
import WholesaleDatePicker from './WholesaleDatePicker';
import PaymentTabs from './PaymentTabs';
import PaymentDetails from './PaymentDetails';
import ProofUpload, { type ProofData } from './ProofUpload';
import type { PaymentMethodId } from '@/lib/payments';
import { toCop, isPricedIn, CURRENCY_NAME, wholesaleThreshold } from '@/lib/rates';
import { useGeolocationZone } from '@/hooks/useGeolocationZone';

interface WholesaleCartItem {
  id: string;
  name: string;
  price_usd: number;
  price_cop?: number | null;
  qty: number;
  /** Cantidad mínima de compra al mayor (umbral del producto, default 10). */
  min: number;
}

interface WholesalePageProps {
  onBack: () => void;
  /** Navegar a una sección informativa (footer) desde el menú. */
  onNavInfo?: (id: string) => void;
}

export default function WholesalePage({ onBack, onNavInfo }: WholesalePageProps) {
  const { format, rates, currency } = useCurrency();
  const { products } = useProducts();
  const { order, labelOf } = useCategories();
  const { open: openDetail } = useProductModal();
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const { maybeStart } = useOnboarding();

  // Tutorial de la sección Al Mayor la primera vez que se entra.
  useEffect(() => {
    const t = setTimeout(() => maybeStart('mayor'), 600);
    return () => clearTimeout(t);
  }, [maybeStart]);

  const WHOLESALE_BY_CAT = useMemo(() => {
    const q = search.trim().toLowerCase();
    const wholesale = products.filter(p =>
      (p.type === 'mayorista' || p.type === 'ambos') &&
      (!q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)),
    );
    return order
      .map(cat => ({ cat, items: wholesale.filter(p => p.category === cat) }))
      .filter(g => g.items.length > 0);
  }, [products, order, search]);

  const [cart, setCart] = useState<WholesaleCartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [notes, setNotes] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>('pago_movil');
  const [advancePct, setAdvancePct] = useState(50);
  const [proofData, setProofData] = useState<ProofData | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [submitError, setSubmitError] = useState('');

  // Ubicación de entrega por GPS (opcional)
  const {
    coords,
    zone: locZone,
    address: locAddress,
    loading: gpsLoading,
    error: gpsError,
    detect: handleGPS,
    reset: resetLoc,
  } = useGeolocationZone();

  // Al mayor hay una cantidad MÍNIMA por producto (= su umbral mayorista, default
  // 10). Un producto nuevo entra directamente con esa cantidad; no se puede bajar
  // de ahí (al intentar restar por debajo del mínimo, se quita del pedido).
  const addToCart = (id: string, name: string, price_usd: number, price_cop: number | null | undefined, min: number) => {
    const minQty = Math.max(1, min);
    setCart(prev => {
      const existing = prev.find(i => i.id === id);
      if (existing) return prev.map(i => i.id === id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id, name, price_usd, price_cop: price_cop ?? null, qty: minQty, min: minQty }];
    });
  };

  const updateQty = (id: string, qty: number) => {
    setCart(prev => {
      const item = prev.find(i => i.id === id);
      if (!item) return prev;
      if (qty < item.min) return prev.filter(i => i.id !== id); // por debajo del mínimo → quitar
      return prev.map(i => i.id === id ? { ...i, qty } : i);
    });
  };

  // Tutorial del checkout mayorista la primera vez que se abre (tiene su propio
  // flujo: resumen, agenda, datos+dirección, anticipo y confirmación).
  useEffect(() => {
    if (!checkoutOpen) return;
    const t = setTimeout(() => maybeStart('wcheckout'), 450);
    return () => clearTimeout(t);
  }, [checkoutOpen, maybeStart]);

  const totalUsd = cart.reduce((s, i) => s + i.price_usd * i.qty, 0);
  const totalCop = cart.reduce((s, i) => s + toCop(i.price_usd, i.price_cop, rates) * i.qty, 0);
  const itemCount = cart.reduce((s, i) => s + i.qty, 0);
  const advanceUsd = totalUsd * (advancePct / 100);
  const remainingUsd = totalUsd - advanceUsd;
  const advanceCop = totalCop * (advancePct / 100);
  const remainingCop = totalCop - advanceCop;

  // Ningún ítem del carrito puede estar bloqueado (sin precio en la moneda activa).
  const hasBlocked = cart.some(i => !isPricedIn(i, currency));

  const canConfirm =
    cart.length > 0 &&
    !hasBlocked &&
    selectedDate !== null &&
    selectedTime !== null &&
    name.trim().length > 0 &&
    whatsapp.trim().length > 0 &&
    (paymentMethod === 'efectivo' || proofData !== null);

  const scrollToCat = (cat: string) => {
    document.getElementById(`wmayor-${cat}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setLoading(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_wholesale: true,
          customer_name: name,
          customer_whatsapp: whatsapp,
          delivery_type: (coords || manualAddress.trim()) ? 'delivery' : 'retiro',
          delivery_zone: locZone?.zone.name ?? null,
          delivery_cost_cop: 0,
          delivery_address: coords
            ? [locAddress, manualAddress.trim() || null, `https://maps.google.com/?q=${coords.lat},${coords.lng}`].filter(Boolean).join(' · ')
            : (manualAddress.trim() || null),
          items: cart.map(i => ({ id: i.id, name: i.name, qty: i.qty, price_usd: i.price_usd, price_cop: i.price_cop ?? null })),
          total_usd: totalUsd,
          total_cop: totalCop,
          currency_shown: currency,
          payment_method: paymentMethod,
          payment_proof_ref: proofData?.type === 'reference' ? proofData.reference : null,
          notes: notes || null,
          status: 'pendiente',
          advance_pct: advancePct,
          advance_usd: advanceUsd,
          remaining_usd: remainingUsd,
          scheduled_date: selectedDate?.toISOString().split('T')[0] ?? null,
          scheduled_time: selectedTime,
        }),
      });

      if (!res.ok) {
        setSubmitError('Error al registrar el pedido. Intenta de nuevo.');
        return;
      }

      const data = await res.json() as { id?: string };
      setOrderNumber(data.id ?? `RL-MAY-${Date.now().toString().slice(-6)}`);
      setSubmitted(true);
    } catch {
      setSubmitError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // ── SUCCESS ──
  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
        style={{ background: 'var(--bg-main)' }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="w-20 h-20 rounded-full bg-[var(--brand-orange)] flex items-center justify-center mb-6"
          style={{ boxShadow: 'var(--glow-md)' }}
        >
          <Check className="w-10 h-10 text-white" strokeWidth={2.5} />
        </motion.div>
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>¡Pedido recibido!</h2>
        <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Número de pedido:</p>
        <p className="text-lg font-bold mb-4" style={{ color: 'var(--brand-orange)' }}>{orderNumber}</p>
        <p className="text-sm mb-6 max-w-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Te contactaremos por WhatsApp para confirmar tu pedido al mayor del{' '}
          {selectedDate?.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}{' '}
          ({selectedTime}).
        </p>
        <button onClick={onBack} className="btn-gradient text-white font-bold px-6 py-3 rounded-2xl">
          Volver al menú
        </button>
      </motion.div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-main)' }}>
      {/* Sticky header + category nav */}
      <div className="sticky top-0 z-40">
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ background: 'var(--gradient-section)' }}
        >
          <button
            onClick={onBack}
            aria-label="Volver al menú"
            data-tour="wmayor-back"
            className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <p className="text-white font-bold text-sm uppercase tracking-wide">Pedidos Al Mayor</p>
            <p className="text-white/80 text-[10px]">Precios especiales · Agenda con 24h de anticipación</p>
          </div>
          <NavMenu
            variant="hero"
            triggerTour="wmayor-menu"
            onHome={onBack}
            onMayorClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            onCategory={scrollToCat}
            onInfo={onNavInfo}
          />
        </div>
        {/* Category pills */}
        <nav data-tour="wmayor-categories" className="flex gap-2 overflow-x-auto scrollbar-none px-4 py-2 border-b"
          style={{ background: 'var(--bg-main)', borderColor: 'var(--border)' }}>
          {WHOLESALE_BY_CAT.map(({ cat }) => (
            <button
              key={cat}
              onClick={() => scrollToCat(cat)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors"
              style={{ background: 'var(--surface)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }}
            >
              {labelOf(cat)}
            </button>
          ))}
        </nav>
        {/* Buscador + moneda + vista (paridad con Al Detal) */}
        <FilterRow
          search={search}
          onSearchChange={setSearch}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      </div>

      {/* Products by category */}
      <div className="px-4 pb-28 pt-3 space-y-6">
        {WHOLESALE_BY_CAT.length === 0 && (
          <div className="text-center py-16">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No encontramos productos con esa búsqueda.</p>
          </div>
        )}
        {WHOLESALE_BY_CAT.map(({ cat, items }) => (
          <section key={cat} id={`wmayor-${cat}`} className="scroll-mt-40">
            <h2 className="text-sm font-bold uppercase tracking-widest mb-3"
              style={{ color: 'var(--brand-orange)' }}>
              {labelOf(cat)}
            </h2>
            <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-2.5'}>
              {items.map(p => {
                const item = cart.find(i => i.id === p.id);
                const qty = item?.qty ?? 0;
                const priced = isPricedIn(p, currency);
                const minQty = wholesaleThreshold(p);
                const showDetail = () => openDetail(
                  p,
                  () => addToCart(p.id, p.name, p.wholesale_price_usd, p.wholesale_price_cop, minQty),
                  { priceOverride: { price_usd: p.wholesale_price_usd, price_cop: p.wholesale_price_cop } },
                );
                const placeholder = <span className="font-bold" style={{ color: 'var(--text-3)' }}>{p.name.charAt(0).toUpperCase()}</span>;
                const priceEl = priced ? (
                  <div>
                    <p className="text-sm font-bold" style={{ color: 'var(--brand-orange)' }}>
                      {format(p.wholesale_price_usd, p.wholesale_price_cop)}
                    </p>
                    <p className="text-[10.5px] font-medium" style={{ color: 'var(--text-muted)' }}>Mínimo {minQty} und.</p>
                  </div>
                ) : (
                  <p className="text-xs font-semibold inline-flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                    <Lock className="w-3 h-3" /> No disp. en {CURRENCY_NAME[currency]}
                  </p>
                );
                const qtyControls = !priced ? (
                  <span className="inline-flex items-center justify-center w-11 h-11" style={{ color: 'var(--text-muted)' }}>
                    <Lock className="w-4 h-4" />
                  </span>
                ) : qty > 0 ? (
                  <div className="flex items-center gap-1.5 rounded-xl px-2 py-1.5 border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                    <button onClick={() => updateQty(p.id, qty - 1)} aria-label="Restar" className="w-11 h-11 rounded-full flex items-center justify-center" style={{ color: 'var(--brand-orange)' }}>
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-sm font-bold w-4 text-center" style={{ color: 'var(--text-primary)' }}>{qty}</span>
                    <button onClick={() => addToCart(p.id, p.name, p.wholesale_price_usd, p.wholesale_price_cop, minQty)} aria-label="Sumar" className="w-11 h-11 rounded-full bg-[var(--brand-orange)] flex items-center justify-center text-white">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => addToCart(p.id, p.name, p.wholesale_price_usd, p.wholesale_price_cop, minQty)}
                    aria-label={`Agregar ${p.name} (mínimo ${minQty})`}
                    className="text-white text-xs font-bold px-3 py-2 rounded-xl btn-gradient"
                    style={{ minHeight: 44 }}
                  >
                    + Agregar
                  </button>
                );

                if (viewMode === 'grid') {
                  return (
                    <div key={p.id} className="rounded-2xl border overflow-hidden flex flex-col" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                      <div className="relative w-full aspect-square flex items-center justify-center text-4xl cursor-pointer" style={{ background: 'var(--surface-2)' }}
                        onClick={showDetail} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showDetail(); } }} role="button" tabIndex={0} aria-label={`Ver detalle de ${p.name}`}>
                        {p.image_url ? <Image src={p.image_url} alt={p.name} fill className="object-cover" sizes="50vw" /> : placeholder}
                      </div>
                      <div className="p-2.5 flex flex-col flex-1">
                        <p className="text-[13px] font-semibold leading-tight line-clamp-2 cursor-pointer" style={{ color: 'var(--text-primary)' }} onClick={showDetail}>{p.name}</p>
                        <div className="mt-1">{priceEl}</div>
                        <div className="mt-auto pt-2">{qtyControls}</div>
                      </div>
                    </div>
                  );
                }
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-2xl p-3 border"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                  >
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center text-2xl flex-shrink-0 cursor-pointer"
                      style={{ background: 'var(--surface-2)' }}
                      onClick={showDetail} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showDetail(); } }}
                      role="button" tabIndex={0} aria-label={`Ver detalle de ${p.name}`}>
                      {p.image_url ? (
                        <Image src={p.image_url} alt={p.name} fill className="object-cover" sizes="48px" />
                      ) : placeholder}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold leading-tight cursor-pointer" style={{ color: 'var(--text-primary)' }} onClick={showDetail}>{p.name}</p>
                      <div className="mt-0.5">{priceEl}</div>
                    </div>
                    <div className="flex-shrink-0">{qtyControls}</div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* Floating cart button */}
      <AnimatePresence>
        {itemCount > 0 && !checkoutOpen && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="fixed bottom-4 left-4 right-4 z-40 flex justify-center"
          >
            <button
              onClick={() => setCheckoutOpen(true)}
              className="w-full max-w-sm flex items-center justify-between text-white font-bold px-5 py-4 rounded-2xl shadow-2xl btn-gradient glow-orange"
            >
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5" />
                <span className="text-sm">Ver pedido · {itemCount} {itemCount === 1 ? 'ítem' : 'ítems'}</span>
              </div>
              <span className="text-base font-bold">{format(totalUsd, totalCop)}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Checkout drawer */}
      <AnimatePresence>
        {checkoutOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => setCheckoutOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-50 rounded-t-3xl overflow-hidden"
              style={{ maxHeight: '94vh', background: 'var(--surface)' }}
            >
              <div className="flex flex-col" style={{ maxHeight: '94vh' }}>
                {/* Drawer header */}
                <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
                  <h2 className="font-bold uppercase tracking-wide text-sm" style={{ color: 'var(--text-primary)' }}>
                    Tu pedido al mayor
                  </h2>
                  <button onClick={() => setCheckoutOpen(false)} aria-label="Cerrar" className="p-1" style={{ color: 'var(--text-muted)' }}>
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

                  {/* 1. Resumen */}
                  <section data-tour="wco-summary">
                    <h3 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--brand-orange)' }}>
                      Resumen
                    </h3>
                    <div className="rounded-2xl p-3 border space-y-2" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                      {cart.map(i => (
                        <div key={i.id} className="flex items-center justify-between gap-2">
                          <span className="text-sm flex-1" style={{ color: 'var(--text-secondary)' }}>{i.name}</span>
                          <div className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                            <button onClick={() => updateQty(i.id, i.qty - 1)} aria-label="Restar" className="w-8 h-8 flex items-center justify-center" style={{ color: 'var(--brand-orange)' }}><Minus className="w-3 h-3" /></button>
                            <span className="text-xs font-bold w-4 text-center" style={{ color: 'var(--text-primary)' }}>{i.qty}</span>
                            <button onClick={() => addToCart(i.id, i.name, i.price_usd, i.price_cop, i.min)} aria-label="Sumar" className="w-8 h-8 rounded-full bg-[var(--brand-orange)] flex items-center justify-center text-white"><Plus className="w-3 h-3" /></button>
                          </div>
                          {isPricedIn(i, currency) ? (
                            <span className="text-sm font-semibold w-16 text-right" style={{ color: 'var(--text-primary)' }}>{format(i.price_usd * i.qty, i.price_cop != null ? i.price_cop * i.qty : null)}</span>
                          ) : (
                            <span className="text-[11px] font-semibold w-16 text-right inline-flex items-center justify-end gap-1" style={{ color: 'var(--destructive)' }}><Lock className="w-3 h-3" /> N/D</span>
                          )}
                        </div>
                      ))}
                      <div className="border-t pt-2 flex justify-between" style={{ borderColor: 'var(--border)' }}>
                        <span className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>Total:</span>
                        <span className="text-base font-black" style={{ color: 'var(--brand-orange)' }}>{format(totalUsd, totalCop)}</span>
                      </div>
                    </div>
                  </section>

                  {/* 2. Calendario */}
                  <section data-tour="wco-date">
                    <h3 className="text-xs font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5" style={{ color: 'var(--brand-orange)' }}>
                      <CalendarDays className="w-3.5 h-3.5" /> Agenda tu entrega
                    </h3>
                    <p className="text-[11px] mb-3" style={{ color: 'var(--text-muted)' }}>
                      Los pedidos al mayor se agendan con mínimo 24 horas de anticipación.
                    </p>
                    <WholesaleDatePicker
                      selectedDate={selectedDate}
                      selectedTime={selectedTime}
                      onDateChange={setSelectedDate}
                      onTimeChange={setSelectedTime}
                    />
                  </section>

                  {/* 3. Datos */}
                  <section data-tour="wco-data">
                    <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--brand-orange)' }}>
                      Tus datos
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Nombre completo *</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="María García" autoComplete="name" className="field" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>WhatsApp *</label>
                        <input type="tel" inputMode="tel" autoComplete="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="+58 412-000-0000" className="field" />
                      </div>

                      {/* Ubicación de entrega: dirección escrita + GPS opcional */}
                      <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Dirección de entrega</label>
                        <input
                          type="text"
                          value={manualAddress}
                          onChange={e => setManualAddress(e.target.value)}
                          placeholder="Calle, barrio, edificio, punto de referencia…"
                          className="field"
                        />
                        {/* GPS: opcional para precisar la ubicación */}
                        <div className="mt-2">
                          {!coords ? (
                            <>
                              <button
                                type="button"
                                onClick={handleGPS}
                                disabled={gpsLoading}
                                className="w-full inline-flex items-center justify-center gap-2 py-2 rounded-xl border text-xs font-semibold transition-colors disabled:opacity-60"
                                style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--brand-orange)' }}
                              >
                                {gpsLoading
                                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Detectando…</>
                                  : <><Navigation className="w-3.5 h-3.5" /> Agregar ubicación GPS (opcional)</>
                                }
                              </button>
                              {gpsError && (
                                <p className="text-[11px] mt-1.5 flex items-center gap-1" style={{ color: 'var(--destructive)' }}>
                                  <AlertCircle className="w-3.5 h-3.5" /> {gpsError}
                                </p>
                              )}
                            </>
                          ) : (
                            <div className="rounded-xl p-2.5 border flex items-center gap-2"
                              style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                              <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--brand-orange)' }} />
                              <div className="flex-1 min-w-0">
                                {locZone && (
                                  <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>GPS: {locZone.zone.name}</p>
                                )}
                                {locAddress && (
                                  <p className="text-[10px] mt-0.5 line-clamp-1" style={{ color: 'var(--text-muted)' }}>{locAddress}</p>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={resetLoc}
                                className="text-[11px] font-semibold flex-shrink-0 underline"
                                style={{ color: 'var(--text-secondary)' }}
                              >
                                Quitar
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Notas adicionales</label>
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Instrucciones especiales, punto de referencia..." rows={2} className="field resize-none" />
                      </div>
                    </div>
                  </section>

                  {/* 4. Anticipo */}
                  <section data-tour="wco-payment">
                    <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--brand-orange)' }}>
                      Pago del anticipo
                    </h3>
                    <div className="rounded-2xl p-4 space-y-3 border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                      <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                        ¿Cuánto deseas adelantar? <span style={{ color: 'var(--text-muted)' }}>(mínimo 50%)</span>
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {[50, 75, 100].map(pct => {
                          const active = advancePct === pct;
                          return (
                            <button
                              key={pct}
                              onClick={() => setAdvancePct(pct)}
                              className="py-2 rounded-xl text-sm font-bold border transition-all"
                              style={active
                                ? { background: 'var(--gradient-button)', color: '#fff', borderColor: 'transparent', boxShadow: 'var(--glow-sm)' }
                                : { background: 'var(--surface)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }
                              }
                            >
                              {pct}%
                            </button>
                          );
                        })}
                      </div>
                      <div className="border-t pt-2 flex justify-between" style={{ borderColor: 'var(--border)' }}>
                        <span className="text-sm font-bold" style={{ color: 'var(--brand-orange)' }}>Anticipo ({advancePct}%):</span>
                        <span className="text-base font-black" style={{ color: 'var(--brand-orange)' }}>{format(advanceUsd, advanceCop)}</span>
                      </div>
                      {remainingUsd > 0 && (
                        <div className="flex justify-between">
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Saldo al recibir:</span>
                          <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{format(remainingUsd, remainingCop)}</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-3">
                      <PaymentTabs selected={paymentMethod} onSelect={setPaymentMethod} />
                    </div>
                    <div className="mt-3">
                      <PaymentDetails methodId={paymentMethod} />
                    </div>
                    {paymentMethod !== 'efectivo' && (
                      <div className="mt-3">
                        <ProofUpload value={proofData} onChange={setProofData} />
                      </div>
                    )}
                  </section>
                </div>

                {/* Confirm CTA */}
                <div className="px-4 pb-5 pt-3 border-t flex-shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                  {submitError && (
                    <p className="text-xs mb-2 text-center" style={{ color: 'var(--destructive)' }}>{submitError}</p>
                  )}
                  <button
                    onClick={handleConfirm}
                    disabled={!canConfirm || loading}
                    data-tour="wco-confirm"
                    className="w-full text-white font-bold py-4 rounded-2xl text-base transition-all btn-gradient glow-orange disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Enviando...' : `Confirmar y pagar anticipo ${format(advanceUsd, advanceCop)}`}
                  </button>
                  {hasBlocked && (
                    <p className="text-center text-xs mt-2" style={{ color: 'var(--destructive)' }}>
                      Tienes productos sin precio en {CURRENCY_NAME[currency]}. Cambia de moneda o quítalos.
                    </p>
                  )}
                  {!canConfirm && !hasBlocked && !submitError && (
                    <p className="text-center text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                      Elige fecha, hora, tus datos y el comprobante para continuar
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

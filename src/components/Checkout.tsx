'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Truck, Store, X, Loader2, MapPin, CheckCircle, Navigation, AlertCircle } from 'lucide-react';
import { useCart } from './CartContext';
import { useCurrency } from './CurrencyContext';
import PaymentTabs from './PaymentTabs';
import PaymentDetails from './PaymentDetails';
import ProofUpload, { type ProofData } from './ProofUpload';
import { deliveryZones } from '@/lib/zones';
import { type PaymentMethodId } from '@/lib/payments';
import { useGeolocationZone } from '@/hooks/useGeolocationZone';

interface CheckoutProps {
  onClose: () => void;
}

type Step = 'form' | 'success';

const retiroZone = deliveryZones.find(z => z.id === 'retiro')!;

function fadeUp(delay: number) {
  return {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.3 },
  };
}

export default function Checkout({ onClose }: CheckoutProps) {
  const { items, totalUsd, clearCart } = useCart();
  const { rates, currency, format } = useCurrency();

  const [step, setStep] = useState<Step>('form');
  const [orderId, setOrderId] = useState<string>('');

  const [deliveryType, setDeliveryType] = useState<'delivery' | 'retiro'>('delivery');

  // Ubicación por GPS — única fuente de la zona/precio (no manipulable)
  const {
    coords,
    zone: detected,
    address: resolvedAddress,
    loading: gpsLoading,
    error: gpsError,
    detect: handleGPS,
    reset: resetLocation,
  } = useGeolocationZone();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressDetail, setAddressDetail] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>('pago_movil');
  const [proof, setProof] = useState<ProofData | null>(null);

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');

  const isDelivery = deliveryType === 'delivery';
  const deliveryCostUsd = isDelivery && detected ? detected.zone.cost_cop / rates.cop_per_usd : 0;
  const grandTotalUsd = totalUsd + deliveryCostUsd;

  const needsProof = paymentMethod !== 'efectivo';
  const proofValid = !needsProof || !!proof;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Ingresa tu nombre';
    if (!phone.trim()) e.phone = 'Ingresa tu WhatsApp';
    if (isDelivery && !detected) e.location = 'Detecta tu ubicación para calcular el envío';
    if (needsProof && !proof) e.proof = 'Adjunta el comprobante de pago';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleConfirm = async () => {
    if (!validate()) return;
    setLoading(true);
    setSubmitError('');

    const mapsUrl = coords ? `https://maps.google.com/?q=${coords.lat},${coords.lng}` : '';
    const deliveryAddress = isDelivery
      ? [addressDetail.trim(), resolvedAddress, mapsUrl].filter(Boolean).join(' · ')
      : null;

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: name,
          customer_whatsapp: phone,
          delivery_type: deliveryType,
          delivery_zone: isDelivery ? detected?.zone.name ?? null : 'Retiro en tienda',
          delivery_cost_cop: isDelivery ? detected?.zone.cost_cop ?? 0 : 0,
          delivery_address: deliveryAddress,
          items: items.map(i => ({ id: i.id, name: i.name, qty: i.quantity, price_usd: i.price_usd })),
          total_usd: grandTotalUsd,
          currency_shown: currency,
          payment_method: paymentMethod,
          payment_proof_ref: proof?.type === 'reference' ? proof.reference : null,
          payment_proof_url: proof?.type === 'image' ? proof.imagePreview : null,
          notes: notes || null,
          status: 'pendiente',
        }),
      });

      if (!res.ok) {
        setSubmitError('Error al registrar el pedido. Intenta de nuevo.');
        return;
      }

      const data = await res.json() as { id?: string };
      setOrderId(data.id ?? `RL-${Date.now()}`);
      clearCart();
      setStep('success');
    } catch {
      setSubmitError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'success') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center h-full px-6 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
          className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
          style={{ background: 'var(--success-soft)' }}
        >
          <CheckCircle className="w-10 h-10" style={{ color: 'var(--success)' }} />
        </motion.div>
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-1)' }}>¡Pedido recibido!</h2>
        <p className="text-sm mb-1" style={{ color: 'var(--text-2)' }}>Número de pedido:</p>
        <p className="text-lg font-bold mb-4" style={{ color: 'var(--brand)' }}>{orderId}</p>
        <p className="text-sm max-w-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>
          Verificaremos tu pago y nos pondremos en contacto contigo pronto por WhatsApp.
        </p>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onClose}
          className="mt-8 w-full btn-gradient text-white font-bold py-4 rounded-2xl"
        >
          Cerrar
        </motion.button>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <h2 className="font-bold text-base uppercase tracking-wide" style={{ color: 'var(--text-1)' }}>Finalizar pedido</h2>
        <button onClick={onClose} aria-label="Cerrar" className="p-1" style={{ color: 'var(--text-3)' }}>
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-5 pt-4">

        {/* Delivery type */}
        <motion.div {...fadeUp(0)}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-2)' }}>Método de entrega</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'delivery' as const, label: 'Domicilio', Icon: Truck },
              { id: 'retiro' as const, label: 'Retiro en tienda', Icon: Store },
            ].map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setDeliveryType(id)}
                className="flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold transition-all"
                style={deliveryType === id
                  ? { borderColor: 'var(--brand)', background: 'var(--brand-soft)', color: 'var(--brand-deep)' }
                  : { borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-2)' }
                }
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Location (delivery) */}
        {isDelivery && (
          <motion.div {...fadeUp(0.06)}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-2)' }}>
              Tu ubicación
            </p>

            {!detected ? (
              <div
                className="rounded-2xl p-4 border text-center"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
              >
                <MapPin className="w-7 h-7 mx-auto mb-2" style={{ color: 'var(--brand)' }} />
                <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-1)' }}>
                  Calcula tu envío con tu ubicación
                </p>
                <p className="text-xs mb-3 leading-relaxed" style={{ color: 'var(--text-3)' }}>
                  Detectamos tu zona automáticamente por GPS para cobrarte el envío correcto.
                </p>
                <button
                  type="button"
                  onClick={handleGPS}
                  disabled={gpsLoading}
                  className="w-full inline-flex items-center justify-center gap-2 text-white font-bold py-3 rounded-xl btn-gradient disabled:opacity-60"
                >
                  {gpsLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Detectando…</>
                    : <><Navigation className="w-4 h-4" /> Usar mi ubicación</>
                  }
                </button>
                {gpsError && (
                  <p className="text-xs mt-2 flex items-center justify-center gap-1" style={{ color: 'var(--danger)' }}>
                    <AlertCircle className="w-3.5 h-3.5" /> {gpsError}
                  </p>
                )}
                {errors.location && !gpsError && (
                  <p className="text-xs mt-2" style={{ color: 'var(--danger)' }}>{errors.location}</p>
                )}
                <p className="text-[11px] mt-3" style={{ color: 'var(--text-3)' }}>
                  ¿No puedes compartir ubicación? Elige <strong>Retiro en tienda</strong>.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div
                  className="rounded-2xl p-3.5 border"
                  style={{ background: 'var(--success-soft)', borderColor: 'rgba(22,163,74,0.35)' }}
                >
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--success)' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold" style={{ color: '#15803D' }}>
                        Zona: {detected.zone.name}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>
                        Envío: <strong>{detected.zone.cost_cop === 0 ? 'Gratis' : format(deliveryCostUsd)}</strong>
                      </p>
                      {resolvedAddress && (
                        <p className="text-[11px] mt-1 line-clamp-2" style={{ color: 'var(--text-3)' }}>
                          📍 {resolvedAddress}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={resetLocation}
                      className="text-[11px] font-semibold flex-shrink-0 underline"
                      style={{ color: 'var(--text-2)' }}
                    >
                      Cambiar
                    </button>
                  </div>
                  {detected.outOfCoverage && (
                    <p className="text-[11px] mt-2 flex items-center gap-1" style={{ color: 'var(--warning)' }}>
                      <AlertCircle className="w-3.5 h-3.5" />
                      Estás fuera de la cobertura habitual; confirmaremos el envío por WhatsApp.
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="co-addr-detail" className="text-xs mb-1 block" style={{ color: 'var(--text-2)' }}>
                    Detalles para el repartidor (opcional)
                  </label>
                  <input
                    id="co-addr-detail"
                    type="text"
                    placeholder="Casa/apto, color, punto de referencia…"
                    value={addressDetail}
                    onChange={e => setAddressDetail(e.target.value)}
                    className="field"
                  />
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Retiro info */}
        {!isDelivery && (
          <motion.div {...fadeUp(0.06)}
            className="rounded-2xl p-3.5 border flex items-start gap-2"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
          >
            <Store className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--brand)' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Retiro en tienda · Gratis</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{retiroZone.neighborhoods}</p>
            </div>
          </motion.div>
        )}

        {/* Customer data */}
        <motion.div {...fadeUp(0.12)} className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>Tus datos</p>

          <div>
            <label htmlFor="co-name" className="text-xs mb-1 block" style={{ color: 'var(--text-2)' }}>Nombre completo *</label>
            <input id="co-name" type="text" placeholder="Ej. María Pérez" value={name}
              onChange={e => setName(e.target.value)}
              className={`field ${errors.name ? 'field-error' : ''}`}
            />
            {errors.name && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="co-phone" className="text-xs mb-1 block" style={{ color: 'var(--text-2)' }}>WhatsApp *</label>
            <input id="co-phone" type="tel" placeholder="+58 424 123 4567" value={phone}
              onChange={e => setPhone(e.target.value)}
              className={`field ${errors.phone ? 'field-error' : ''}`}
            />
            {errors.phone && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.phone}</p>}
          </div>

          <div>
            <label htmlFor="co-notes" className="text-xs mb-1 block" style={{ color: 'var(--text-2)' }}>Notas (opcional)</label>
            <textarea id="co-notes" placeholder="Ej. sin cebolla, tocar el timbre…" value={notes}
              onChange={e => setNotes(e.target.value)} rows={2}
              className="field resize-none"
            />
          </div>
        </motion.div>

        {/* Payment */}
        <motion.div {...fadeUp(0.18)}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-2)' }}>Método de pago</p>
          <PaymentTabs selected={paymentMethod} onSelect={(m) => { setPaymentMethod(m); setProof(null); }} />
          <div className="mt-2"><PaymentDetails methodId={paymentMethod} /></div>
        </motion.div>

        {/* Proof upload */}
        {needsProof && (
          <motion.div {...fadeUp(0.24)}>
            <ProofUpload value={proof} onChange={setProof} />
            {errors.proof && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.proof}</p>}
          </motion.div>
        )}

        {/* Order summary */}
        <motion.div {...fadeUp(0.3)}
          className="rounded-xl p-3 border space-y-1.5"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
        >
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-2)' }}>Resumen</p>
          {items.map(item => (
            <div key={item.id} className="flex justify-between text-xs" style={{ color: 'var(--text-2)' }}>
              <span>{item.quantity}× {item.name}</span>
              <span>{format(item.price_usd * item.quantity)}</span>
            </div>
          ))}
          <div className="border-t pt-1.5 mt-1.5 space-y-1" style={{ borderColor: 'var(--border)' }}>
            <div className="flex justify-between text-xs" style={{ color: 'var(--text-2)' }}>
              <span>Subtotal</span><span>{format(totalUsd)}</span>
            </div>
            {isDelivery && (
              <div className="flex justify-between text-xs" style={{ color: 'var(--text-2)' }}>
                <span>Envío {detected ? `(${detected.zone.name})` : ''}</span>
                <span style={{ color: detected ? (detected.zone.cost_cop === 0 ? 'var(--success)' : 'inherit') : 'var(--text-3)' }}>
                  {detected ? (detected.zone.cost_cop === 0 ? 'Gratis' : format(deliveryCostUsd)) : 'Según ubicación'}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold pt-1" style={{ color: 'var(--text-1)' }}>
              <span>TOTAL</span>
              <span style={{ color: 'var(--brand)' }}>{format(grandTotalUsd)}</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* CTA */}
      <div className="px-4 pb-5 pt-3 border-t" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        {submitError && (
          <p className="text-xs mb-2 text-center" style={{ color: 'var(--danger)' }}>{submitError}</p>
        )}
        <motion.button
          onClick={handleConfirm}
          disabled={loading || !proofValid}
          whileTap={{ scale: 0.97 }}
          className="w-full flex items-center justify-center gap-2 text-white font-bold py-4 rounded-2xl text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed btn-gradient glow-orange"
        >
          {loading
            ? <><Loader2 className="w-5 h-5 animate-spin" /> Confirmando…</>
            : needsProof && !proof
              ? 'Adjunta el comprobante para continuar'
              : 'Confirmar pedido'
          }
        </motion.button>
        <p className="text-center text-xs mt-2" style={{ color: 'var(--text-3)' }}>
          Tu pedido quedará registrado. Te contactaremos para confirmar.
        </p>
      </div>
    </div>
  );
}

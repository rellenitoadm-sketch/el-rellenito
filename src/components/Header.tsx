'use client';

import { useRef, type ReactNode } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ChevronRight, MapPin, Star } from 'lucide-react';
import type { OpenStatus } from '@/lib/businessHours';

interface HeaderProps {
  onMayorClick: () => void;
  status: OpenStatus;
  /**
   * Si se pasa, el hero muestra DOS CTAs (Al Detal + Al Mayor) — se usa en el
   * Home informativo. Si se omite, muestra solo "Pedidos al Mayor" (vista detal).
   */
  onDetalClick?: () => void;
  /** Slot superior-izquierdo del hero (p.ej. el menú hamburguesa en Home). */
  topLeft?: ReactNode;
}

/**
 * Hero in normal document flow — scrolls away naturally (no scroll-linked
 * height/opacity transforms, which were causing the jank). The persistent
 * brand + nav live in the sticky TopBar + CategoryTabs below it.
 */
export default function Header({ onMayorClick, status, onDetalClick, topLeft }: HeaderProps) {
  // Gesto secreto para entrar al panel: 5 toques rápidos en el logo grande.
  const taps = useRef<number[]>([]);
  const handleSecretTap = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter(t => now - t < 1500), now];
    if (taps.current.length >= 5) {
      taps.current = [];
      window.dispatchEvent(new CustomEvent('staff-unlock'));
    }
  };

  return (
    <header className="relative w-full overflow-hidden" style={{ background: 'var(--grad-hero)' }}>
      {/* Subtle dot texture */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '22px 22px' }}
      />

      {/* Menú (u otro control) en la esquina superior izquierda del hero */}
      {topLeft && (
        <div className="absolute top-3 left-3 z-20">
          {topLeft}
        </div>
      )}

      {/* Social icons */}
      <div className="absolute top-3 right-3 flex flex-col gap-2 z-20">
        <a
          href="https://wa.me/584247207067"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="WhatsApp"
          className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/35 backdrop-blur transition-colors flex items-center justify-center"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.553 4.122 1.523 5.855L0 24l6.338-1.498A11.933 11.933 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.795 9.795 0 01-5.007-1.376l-.36-.213-3.762.889.952-3.665-.235-.375A9.796 9.796 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z" />
          </svg>
        </a>
        <a
          href="https://instagram.com/Elrellenito_"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Instagram"
          className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/35 backdrop-blur transition-colors flex items-center justify-center"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
          </svg>
        </a>
      </div>

      {/* Hero content — normal flow */}
      <div className="relative flex flex-col items-center text-center text-white px-5 pt-7 pb-6">
        {/* H1 de la página (oculto visualmente; SEO + lectores de pantalla).
            La marca ya se comunica por el logo. */}
        <h1 className="sr-only">Pasapalos El Rellenito — Tequeños y pasapalos en La Concordia</h1>

        {/* Circular logo (full mark: chef + El Rellenito) */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.45, type: 'spring', stiffness: 200, damping: 18 }}
        >
          <div
            onClick={handleSecretTap}
            className="w-[196px] h-[196px] rounded-full overflow-hidden p-[3px] select-none"
            style={{ background: 'var(--brand)', boxShadow: '0 14px 44px rgba(0,0,0,0.28), 0 0 0 1px rgba(255,255,255,0.25)' }}
          >
            <div
              className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
              style={{ background: 'var(--brand)' }}
            >
              <Image
                src="/logo-hero.png"
                alt="Pasapalos El Rellenito"
                width={392}
                height={392}
                priority
                className="object-contain w-full h-full"
              />
            </div>
          </div>
        </motion.div>

        {/* Rating + location */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-2 text-[11.5px] text-white/95 mt-3"
        >
          <span className="inline-flex items-center gap-1">
            <Star className="w-3 h-3 fill-current" />
            <span className="font-semibold">4.5</span>
          </span>
          <span className="text-white/40">·</span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            La Concordia
          </span>
        </motion.div>

        {/* Status chip */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="mt-2.5"
        >
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold"
            style={{ background: 'rgba(255,255,255,0.96)', color: status.open ? '#15803D' : '#92400E' }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: status.open ? '#16A34A' : '#D97706' }} />
            {status.label}
          </span>
        </motion.div>

        {/* CTA(s) — en el Home se muestran dos (Al Detal + Al Mayor); en la vista
            detal, solo el de mayor. */}
        {onDetalClick ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.36 }}
            className="mt-4 flex flex-wrap items-center justify-center gap-2.5"
          >
            <button
              onClick={onDetalClick}
              data-tour="home-detal"
              className="inline-flex items-center gap-1 bg-white text-[var(--brand-deep)] text-[13px] font-bold px-5 py-2.5 rounded-full shadow-md hover:shadow-lg active:scale-[0.98] transition-all"
            >
              Pedidos al Detal
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onMayorClick}
              data-tour="home-mayor"
              className="inline-flex items-center gap-1 bg-white text-[var(--brand-deep)] text-[13px] font-bold px-5 py-2.5 rounded-full shadow-md hover:shadow-lg active:scale-[0.98] transition-all"
            >
              Pedidos al Mayor
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ) : (
          <motion.button
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.36 }}
            onClick={onMayorClick}
            className="mt-3.5 inline-flex items-center gap-1 bg-white text-[var(--brand-deep)] text-[12.5px] font-bold px-5 py-2.5 rounded-full shadow-md hover:shadow-lg active:scale-[0.98] transition-all"
          >
            Pedidos al Mayor
            <ChevronRight className="w-3.5 h-3.5" />
          </motion.button>
        )}
      </div>
    </header>
  );
}

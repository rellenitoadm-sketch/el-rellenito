'use client';

import { motion } from 'framer-motion';
import { ShoppingBag, Boxes, ChevronRight } from 'lucide-react';
import Header from './Header';
import Footer from './Footer';
import type { OpenStatus } from '@/lib/businessHours';

interface HomeProps {
  status: OpenStatus;
  onDetal: () => void;
  onMayor: () => void;
}

/**
 * Página principal (Home) puramente informativa y de marca. NO muestra el
 * catálogo: invita a elegir entre comprar Al Detal o pedir Al Mayor. El detalle
 * informativo (quiénes somos, FAQ, horarios, contacto) vive en el Footer.
 */
export default function Home({ status, onDetal, onMayor }: HomeProps) {
  return (
    <div>
      {/* Hero de marca con los dos accesos */}
      <Header status={status} onDetalClick={onDetal} onMayorClick={onMayor} />

      {/* Presentación + accesos claros a cada flujo de venta */}
      <section className="px-5 pt-7 pb-2 text-center">
        <h2 className="t-h2" style={{ color: 'var(--text-1)' }}>
          Pasapalos y panadería artesanal
        </h2>
        <p className="text-sm leading-relaxed mt-2 mb-6" style={{ color: 'var(--text-2)' }}>
          Tequeños, masas, pan, postres y combos hechos con recetas propias en La Concordia.
          Elige cómo quieres comprar.
        </p>

        <div className="grid grid-cols-1 gap-3 text-left">
          <motion.button
            onClick={onDetal}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="flex items-center gap-3.5 p-4 rounded-2xl border active:scale-[0.99] transition-transform"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--sh-1)' }}
          >
            <span
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--brand-soft)', color: 'var(--brand-deep)' }}
            >
              <ShoppingBag className="w-5 h-5" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[15px] font-bold" style={{ color: 'var(--text-1)' }}>Al Detal</span>
              <span className="block text-[12.5px]" style={{ color: 'var(--text-3)' }}>Compra por unidad para tu casa</span>
            </span>
            <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--text-3)' }} />
          </motion.button>

          <motion.button
            onClick={onMayor}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="flex items-center gap-3.5 p-4 rounded-2xl border active:scale-[0.99] transition-transform"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--sh-1)' }}
          >
            <span
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--brand-soft)', color: 'var(--brand-deep)' }}
            >
              <Boxes className="w-5 h-5" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[15px] font-bold" style={{ color: 'var(--text-1)' }}>Al Mayor</span>
              <span className="block text-[12.5px]" style={{ color: 'var(--text-3)' }}>Pedidos por volumen para eventos</span>
            </span>
            <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--text-3)' }} />
          </motion.button>
        </div>
      </section>

      <Footer />
    </div>
  );
}

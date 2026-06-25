'use client';

import { motion, useReducedMotion } from 'framer-motion';
import Header from './Header';
import Footer from './Footer';
import NavMenu from './NavMenu';
import type { OpenStatus } from '@/lib/businessHours';

interface HomeProps {
  status: OpenStatus;
  onDetal: () => void;
  onMayor: () => void;
  /** Ir al catálogo Al Detal y desplazarse a una categoría. */
  onNavCategory: (cat: string) => void;
  /** Ir a una sección informativa del footer. */
  onNavInfo: (id: string) => void;
}

/**
 * Página principal (Home) puramente informativa y de marca. NO muestra el
 * catálogo: el hero ocupa casi toda la pantalla, enfocado en la marca y los dos
 * accesos (Al Detal / Al Mayor). La sección informativa (descripción + Footer)
 * vive más abajo y aparece con una animación suave al hacer scroll.
 */
export default function Home({ status, onDetal, onMayor, onNavCategory, onNavInfo }: HomeProps) {
  const reduce = useReducedMotion();
  // Aparición suave al entrar en viewport (desactivada si el usuario prefiere
  // menos movimiento). Easing de salida sin rebote.
  const reveal = {
    initial: reduce ? false : { opacity: 0, y: 24 },
    whileInView: reduce ? undefined : { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.3 },
    transition: reduce ? undefined : { duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  };

  return (
    <div>
      {/* Hero de marca a casi pantalla completa con los dos accesos + menú */}
      <Header
        fullHeight
        status={status}
        onDetalClick={onDetal}
        onMayorClick={onMayor}
        topLeft={
          <NavMenu
            variant="hero"
            triggerTour="home-menu"
            onMayorClick={onMayor}
            onCategory={onNavCategory}
            onInfo={onNavInfo}
          />
        }
      />

      {/* Presentación breve — se descubre al hacer scroll */}
      <motion.section {...reveal} data-tour="home-intro" className="px-5 pt-10 pb-4 text-center">
        <h2 className="t-h2" style={{ color: 'var(--text-1)' }}>
          Pasapalos y panadería artesanal
        </h2>
        <p className="text-sm leading-relaxed mt-2" style={{ color: 'var(--text-2)' }}>
          Tequeños, masas, pan, postres y combos hechos con recetas propias en La Concordia.
          Elige cómo quieres comprar.
        </p>
      </motion.section>

      <motion.div {...reveal}>
        <Footer />
      </motion.div>
    </div>
  );
}

'use client';

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
 * catálogo: invita a elegir entre comprar Al Detal o pedir Al Mayor desde el
 * hero. El detalle informativo (quiénes somos, FAQ, horarios, contacto) vive en
 * el Footer.
 */
export default function Home({ status, onDetal, onMayor, onNavCategory, onNavInfo }: HomeProps) {
  return (
    <div>
      {/* Hero de marca con los dos accesos + menú hamburguesa */}
      <Header
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

      {/* Presentación breve */}
      <section data-tour="home-intro" className="px-5 pt-7 pb-2 text-center">
        <h2 className="t-h2" style={{ color: 'var(--text-1)' }}>
          Pasapalos y panadería artesanal
        </h2>
        <p className="text-sm leading-relaxed mt-2" style={{ color: 'var(--text-2)' }}>
          Tequeños, masas, pan, postres y combos hechos con recetas propias en La Concordia.
          Elige cómo quieres comprar.
        </p>
      </section>

      <Footer />
    </div>
  );
}

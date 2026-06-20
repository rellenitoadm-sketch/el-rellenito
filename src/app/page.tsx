'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import Home from '@/components/Home';
import Header from '@/components/Header';
import TopBar from '@/components/TopBar';
import CategoryTabs from '@/components/CategoryTabs';
import FilterRow, { type ViewMode } from '@/components/FilterRow';
import ProductList from '@/components/ProductList';
import CartButton from '@/components/CartButton';
import Cart from '@/components/Cart';
import AddedToast from '@/components/AddedToast';
import StaffUnlock from '@/components/StaffUnlock';
import VisitTracker from '@/components/VisitTracker';
import CookieBanner from '@/components/CookieBanner';
import Footer from '@/components/Footer';
import WholesalePage from '@/components/WholesalePage';
import InstallPrompt from '@/components/InstallPrompt';
import { useOnboarding } from '@/components/Onboarding';
import { getOpenStatus, type OpenStatus } from '@/lib/businessHours';

// Arquitectura de 3 vistas: Home informativo, catálogo Al Detal y catálogo Al Mayor.
type AppView = 'home' | 'detal' | 'mayor';

export default function HomePage() {
  const [view, setView] = useState<AppView>('home');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [status, setStatus] = useState<OpenStatus>({ open: true, label: 'Abierto · Hasta las 7 PM' });
  const { maybeStart } = useOnboarding();

  // Compute open/closed client-side (TZ-correct) and refresh every minute.
  useEffect(() => {
    setStatus(getOpenStatus());
    const t = setInterval(() => setStatus(getOpenStatus()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Tutoriales: Home la primera vez que se entra; catálogo al entrar a "Al Detal".
  useEffect(() => {
    const which = view === 'home' ? 'home' : view === 'detal' ? 'catalog' : null;
    if (!which) return;
    const t = setTimeout(() => maybeStart(which), 700);
    return () => clearTimeout(t);
  }, [view, maybeStart]);

  // Navegación desde el menú hamburguesa de Home/Al Mayor.
  // Categoría → abre el catálogo Al Detal y se desplaza a su sección.
  const goToDetalCategory = (cat: string) => {
    setView('detal');
    setTimeout(() => document.getElementById(`section-${cat}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 360);
  };
  // Sección informativa (footer) → vive en Home/Detal; desde Al Mayor vuelve a Home.
  const goToInfoSection = (id: string) => {
    setView(v => (v === 'mayor' ? 'home' : v));
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 360);
  };

  return (
    <MotionConfig reducedMotion="user">
    <main className="app-shell">
      <AnimatePresence mode="wait">
        {view === 'home' ? (
          <motion.div
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Home
              status={status}
              onDetal={() => setView('detal')}
              onMayor={() => setView('mayor')}
              onNavCategory={goToDetalCategory}
              onNavInfo={goToInfoSection}
            />
          </motion.div>
        ) : view === 'detal' ? (
          <motion.div
            key="detal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: '-5%' }}
            transition={{ duration: 0.2 }}
          >
            {/* Hero — normal flow, scrolls away (no jank) */}
            <Header onMayorClick={() => setView('mayor')} status={status} />

            {/* Sticky nav stack: brand bar + category tabs + filters */}
            <div className="sticky top-0 z-40" style={{ boxShadow: 'var(--sh-2)' }}>
              <TopBar
                status={status}
                onMayorClick={() => setView('mayor')}
                onHome={() => setView('home')}
              />
              <CategoryTabs onMayorClick={() => setView('mayor')} revalidationKey={search} />
              <FilterRow
                search={search}
                onSearchChange={setSearch}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
              />
            </div>

            <ProductList search={search} viewMode={viewMode} />
            <Footer />
          </motion.div>
        ) : (
          <motion.div
            key="mayor"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <WholesalePage onBack={() => setView('home')} onNavInfo={goToInfoSection} />
          </motion.div>
        )}
      </AnimatePresence>

      <CartButton />
      <Cart />
      <AddedToast />
      <StaffUnlock />
      <VisitTracker />
      <CookieBanner />
      <InstallPrompt />
    </main>
    </MotionConfig>
  );
}

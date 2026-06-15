'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
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
import { getOpenStatus, type OpenStatus } from '@/lib/businessHours';

type AppView = 'catalog' | 'mayor';

export default function HomePage() {
  const [view, setView] = useState<AppView>('catalog');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [status, setStatus] = useState<OpenStatus>({ open: true, label: 'Abierto · Hasta las 7 PM' });

  // Compute open/closed client-side (TZ-correct) and refresh every minute.
  useEffect(() => {
    setStatus(getOpenStatus());
    const t = setInterval(() => setStatus(getOpenStatus()), 60_000);
    return () => clearInterval(t);
  }, []);

  return (
    <MotionConfig reducedMotion="user">
    <main className="app-shell">
      <AnimatePresence mode="wait">
        {view === 'catalog' ? (
          <motion.div
            key="catalog"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: '-5%' }}
            transition={{ duration: 0.2 }}
          >
            {/* Hero — normal flow, scrolls away (no jank) */}
            <Header onMayorClick={() => setView('mayor')} status={status} />

            {/* Sticky nav stack: brand bar + category tabs + filters */}
            <div className="sticky top-0 z-40" style={{ boxShadow: 'var(--sh-2)' }}>
              <TopBar status={status} onMayorClick={() => setView('mayor')} />
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
            <WholesalePage onBack={() => setView('catalog')} />
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

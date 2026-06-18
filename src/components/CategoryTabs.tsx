'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useCategories } from './CategoriesContext';

interface CategoryTabsProps {
  onMayorClick: () => void;
  /** Changing this key causes IntersectionObserver to re-register all sections. */
  revalidationKey?: string;
}

export default function CategoryTabs({ onMayorClick, revalidationKey }: CategoryTabsProps) {
  const { order, labelOf } = useCategories();
  const [active, setActive] = useState<string>('TODOS');
  const scrollingRef  = useRef(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derivado de las categorías dinámicas (fuente única).
  const tabs = useMemo(
    () => [{ id: 'TODOS', label: 'Todos' }, ...order.map(c => ({ id: c, label: labelOf(c) }))],
    [order, labelOf],
  );
  const orderKey = order.join(',');

  // Re-register IO whenever revalidationKey or the category set changes.
  useEffect(() => {
    const sectionIds = order;
    const observer = new IntersectionObserver(
      entries => {
        if (scrollingRef.current) return;
        let topEntry: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (!topEntry || entry.boundingClientRect.top < topEntry.boundingClientRect.top) {
              topEntry = entry;
            }
          }
        }
        if (topEntry) setActive(topEntry.target.id.replace('section-', ''));
      },
      // rootMargin aligned with scroll-mt-52 (208px) + sticky bar (~52px)
      { threshold: 0.15, rootMargin: '-160px 0px -55% 0px' }
    );

    sectionIds.forEach(id => {
      const el = document.getElementById(`section-${id}`);
      if (el) observer.observe(el);
    });

    // Slightly higher threshold (160px) so TODOS activates only near the true top
    const handleScroll = () => { if (window.scrollY < 160) setActive('TODOS'); };
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
    };
  }, [revalidationKey, orderKey]);

  const handleClick = (id: string) => {
    // Clear any pending timer from a previous click
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);

    if (id === 'TODOS') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setActive('TODOS');
    } else {
      const el = document.getElementById(`section-${id}`);
      if (el) {
        scrollingRef.current = true;
        setActive(id);
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        scrollTimerRef.current = setTimeout(() => { scrollingRef.current = false; }, 900);
      }
    }
  };

  return (
    <nav
      aria-label="Categorías"
      data-tour="categories"
      className="flex items-center gap-1 overflow-x-auto px-4 scrollbar-none border-b"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {tabs.map(tab => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => handleClick(tab.id)}
            className="relative flex-shrink-0 inline-flex items-center justify-center px-3 min-h-[44px] text-[13px] transition-colors
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-1 rounded-sm"
            style={{
              color: isActive ? 'var(--text-1)' : 'var(--text-3)',
              fontWeight: isActive ? 700 : 500,
            }}
          >
            {tab.label}
            {isActive && (
              <motion.span
                layoutId="catUnderline"
                className="absolute left-2 right-2 -bottom-px h-[2px] rounded-full"
                style={{ background: 'var(--brand)' }}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
          </button>
        );
      })}

      {/* Al Mayor — visual separation + accent */}
      <div data-tour="mayor" className="flex-shrink-0 pl-2 ml-1 border-l py-2" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={onMayorClick}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-bold transition-all
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-1"
          style={{
            background: 'var(--brand-soft)',
            color: 'var(--brand-deep)',
          }}
        >
          <Sparkles className="w-3 h-3" />
          Al Mayor
        </button>
      </div>
    </nav>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X, Home, Sparkles, ChevronRight, Shield } from 'lucide-react';
import { categories, categoryLabels } from '@/lib/products';

interface NavMenuProps {
  onMayorClick: () => void;
}

/**
 * Menú de navegación (hamburguesa) para la barra superior.
 * Drawer lateral con: inicio, categorías (scroll a su sección), pedidos al mayor,
 * contacto y privacidad. Vive dentro del TopBar (solo en la vista catálogo),
 * por lo que las secciones de categoría siempre existen al abrirlo.
 */
export default function NavMenu({ onMayorClick }: NavMenuProps) {
  const [open, setOpen] = useState(false);

  // Cerrar con Escape + bloquear el scroll del fondo mientras está abierto.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const goHome = () => {
    setOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToCategory = (cat: string) => {
    setOpen(false);
    // Espera a que cierre el drawer (desbloquea el scroll) antes de desplazar.
    setTimeout(() => {
      document.getElementById(`section-${cat}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 220);
  };

  const goMayor = () => {
    setOpen(false);
    onMayorClick();
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
        style={{ background: 'var(--surface-2)', color: 'var(--text-1)' }}
        aria-label="Abrir menú"
        aria-expanded={open}
      >
        <Menu className="w-[18px] h-[18px]" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[70]"
              style={{ background: 'rgba(0,0,0,0.5)' }}
              onClick={() => setOpen(false)}
            />

            {/* Drawer */}
            <motion.nav
              aria-label="Menú principal"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              className="fixed top-0 right-0 bottom-0 z-[71] w-[82%] max-w-[320px] flex flex-col overflow-hidden"
              style={{ background: 'var(--surface)', boxShadow: 'var(--sh-3, 0 10px 40px rgba(0,0,0,0.25))' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3.5 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0" style={{ background: 'var(--brand-soft)' }}>
                    <Image src="/logo-circle.png" alt="El Rellenito" width={36} height={36} className="object-cover w-full h-full" />
                  </div>
                  <p className="text-[15px] font-bold truncate" style={{ color: 'var(--text-1)', fontFamily: 'var(--font-playfair)' }}>
                    El Rellenito
                  </p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ color: 'var(--text-3)' }}
                  aria-label="Cerrar menú"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto py-2">
                <button onClick={goHome} className="nav-row">
                  <Home className="w-[18px] h-[18px]" style={{ color: 'var(--text-2)' }} />
                  <span>Inicio</span>
                </button>

                <button onClick={goMayor} className="nav-row">
                  <Sparkles className="w-[18px] h-[18px]" style={{ color: 'var(--brand)' }} />
                  <span style={{ color: 'var(--brand-deep)', fontWeight: 700 }}>Pedidos al Mayor</span>
                  <ChevronRight className="w-4 h-4 ml-auto" style={{ color: 'var(--text-3)' }} />
                </button>

                <p className="px-4 pt-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
                  Categorías
                </p>
                {categories.map(cat => (
                  <button key={cat} onClick={() => goToCategory(cat)} className="nav-row">
                    <span>{categoryLabels[cat]}</span>
                    <ChevronRight className="w-4 h-4 ml-auto" style={{ color: 'var(--text-3)' }} />
                  </button>
                ))}

                <p className="px-4 pt-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
                  Contacto
                </p>
                <a
                  href="https://wa.me/584247207067"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nav-row"
                  onClick={() => setOpen(false)}
                >
                  <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" style={{ fill: '#1faa52' }}>
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.553 4.122 1.523 5.855L0 24l6.338-1.498A11.933 11.933 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.795 9.795 0 01-5.007-1.376l-.36-.213-3.762.889.952-3.665-.235-.375A9.796 9.796 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z" />
                  </svg>
                  <span>WhatsApp</span>
                </a>
                <a
                  href="https://instagram.com/Elrellenito_"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nav-row"
                  onClick={() => setOpen(false)}
                >
                  <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" style={{ fill: 'var(--text-2)' }}>
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                  <span>Instagram</span>
                </a>

                <div className="my-2 border-t" style={{ borderColor: 'var(--border)' }} />
                <a href="/privacidad" className="nav-row" onClick={() => setOpen(false)}>
                  <Shield className="w-[18px] h-[18px]" style={{ color: 'var(--text-3)' }} />
                  <span>Política de privacidad</span>
                </a>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>

      <style jsx>{`
        .nav-row {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          font-size: 14px;
          font-weight: 500;
          color: var(--text-1);
          text-align: left;
          transition: background-color 0.15s;
        }
        .nav-row:hover {
          background: var(--surface-2);
        }
      `}</style>
    </>
  );
}

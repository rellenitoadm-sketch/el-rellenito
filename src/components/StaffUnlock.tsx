'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Delete, Lock, Check, X } from 'lucide-react';

const PIN_LENGTH = 6;
const HINT_COOKIE = 'staff_hint';

function hasHintCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some(c => c.trim().startsWith(`${HINT_COOKIE}=`));
}

/**
 * Hidden staff access — a full-screen "vault" pinpad.
 * It is opened by a secret gesture (5 taps on the TopBar logo → window event
 * 'staff-unlock'), never by a visible link. On devices that have logged in
 * before, a discreet shortcut appears; customers see nothing.
 */
export default function StaffUnlock() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [status, setStatus] = useState<'idle' | 'checking' | 'error' | 'success'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [showShortcut, setShowShortcut] = useState(false);

  useEffect(() => { setShowShortcut(hasHintCookie()); }, []);

  // Clear the pad back to an empty, idle state.
  const resetPad = useCallback(() => { setPin(''); setStatus('idle'); }, []);
  // Open the vault on a fresh pad.
  const openVault = useCallback(() => { setOpen(true); resetPad(); }, [resetPad]);

  // Entrada del equipo: si este dispositivo YA tiene una sesión válida (cookie de
  // 30 días), entra directo al panel SIN volver a pedir el PIN. Si no, abre el pinpad.
  const gateOpen = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/me');
      if (res.ok) { router.push('/admin/dashboard'); return; }
    } catch { /* sin red → cae al pinpad */ }
    openVault();
  }, [router, openVault]);

  // Secret gesture from the TopBar logo (5 taps) → puerta con sesión persistente.
  useEffect(() => {
    window.addEventListener('staff-unlock', gateOpen);
    return () => window.removeEventListener('staff-unlock', gateOpen);
  }, [gateOpen]);

  // Lock body scroll while the vault is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const submit = useCallback(async (fullPin: string) => {
    setStatus('checking');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: fullPin }),
      });
      if (res.ok) {
        setStatus('success');
        setTimeout(() => router.push('/admin/dashboard'), 650);
      } else {
        const data = await res.json().catch(() => ({} as { error?: string }));
        setStatus('error');
        setErrorMsg(res.status === 429 ? (data.error ?? 'Demasiados intentos') : 'Código incorrecto');
        setTimeout(resetPad, 950);
      }
    } catch {
      setStatus('error');
      setErrorMsg('Error de conexión');
      setTimeout(resetPad, 950);
    }
  }, [router, resetPad]);

  const press = (digit: string) => {
    if (status === 'checking' || status === 'success') return;
    setPin(prev => {
      if (prev.length >= PIN_LENGTH) return prev;
      const next = prev + digit;
      if (next.length === PIN_LENGTH) submit(next);
      return next;
    });
  };

  const backspace = () => {
    if (status === 'checking' || status === 'success') return;
    setStatus('idle');
    setPin(prev => prev.slice(0, -1));
  };

  return (
    <>
      {showShortcut && !open && (
        <button
          onClick={gateOpen}
          aria-label="Acceso del equipo"
          className="fixed bottom-3 left-3 z-30 w-9 h-9 rounded-full flex items-center justify-center opacity-20 hover:opacity-90 transition-opacity"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
        >
          <Lock className="w-4 h-4 text-white" />
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-6"
            style={{ background: 'radial-gradient(circle at 50% 28%, #2a1245 0%, #0b0713 72%)' }}
          >
            <button
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              className="absolute top-5 right-5 w-10 h-10 rounded-full flex items-center justify-center text-white/40 hover:text-white/80 transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            >
              <X className="w-5 h-5" />
            </button>

            <motion.div
              animate={status === 'error' ? { x: [-9, 9, -7, 7, 0] } : { x: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center"
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
                style={{
                  background: status === 'success' ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                {status === 'success'
                  ? <Check className="w-7 h-7" style={{ color: '#4ade80' }} />
                  : <Lock className="w-6 h-6 text-white/65" />}
              </div>

              <div className="flex gap-3.5 mb-3">
                {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                  <motion.span
                    key={i}
                    animate={{ scale: pin.length === i + 1 ? [1, 1.45, 1] : 1 }}
                    transition={{ duration: 0.2 }}
                    className="w-3 h-3 rounded-full"
                    style={{
                      background: status === 'error'
                        ? '#f87171'
                        : i < pin.length ? '#ffffff' : 'rgba(255,255,255,0.16)',
                    }}
                  />
                ))}
              </div>

              <p
                className="text-[12px] h-5 mb-8"
                style={{ color: status === 'error' ? '#f87171' : 'rgba(255,255,255,0.38)' }}
              >
                {status === 'error' ? errorMsg : status === 'checking' ? 'Verificando…' : 'Ingresa tu código'}
              </p>
            </motion.div>

            <div className="grid grid-cols-3 gap-4">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
                <KeypadButton key={d} onClick={() => press(d)}>{d}</KeypadButton>
              ))}
              <span />
              <KeypadButton onClick={() => press('0')}>0</KeypadButton>
              <KeypadButton onClick={backspace} ariaLabel="Borrar"><Delete className="w-5 h-5" /></KeypadButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function KeypadButton({
  children,
  onClick,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  ariaLabel?: string;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      onClick={onClick}
      aria-label={ariaLabel}
      className="w-[70px] h-[70px] rounded-full flex items-center justify-center text-[26px] font-light text-white"
      style={{
        background: 'rgba(255,255,255,0.07)',
        border: '1px solid rgba(255,255,255,0.12)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {children}
    </motion.button>
  );
}

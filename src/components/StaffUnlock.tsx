'use client';

import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Delete, Lock, Check, X } from 'lucide-react';

const PIN_LENGTH = 6;
const HINT_COOKIE = 'staff_hint';

function hasHintCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some(c => c.trim().startsWith(`${HINT_COOKIE}=`));
}
/** La cookie no emite eventos: basta con leerla al montar. */
const subscribeNever = () => () => { /* sin suscripción */ };

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
  // La cookie solo existe en el navegador: en el servidor se renderiza sin atajo.
  const showShortcut = useSyncExternalStore(subscribeNever, hasHintCookie, () => false);

  // El teclado físico escribe más rápido de lo que React re-renderiza, así que
  // las teclas leen el PIN de un ref, no del estado.
  const pinRef = useRef('');
  const statusRef = useRef(status);

  const writePin = useCallback((value: string) => {
    pinRef.current = value;
    setPin(value);
  }, []);
  const writeStatus = useCallback((value: typeof status) => {
    statusRef.current = value;
    setStatus(value);
  }, []);

  // Clear the pad back to an empty, idle state.
  const resetPad = useCallback(() => { writePin(''); writeStatus('idle'); }, [writePin, writeStatus]);
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
    writeStatus('checking');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: fullPin }),
      });
      if (res.ok) {
        writeStatus('success');
        setTimeout(() => router.push('/admin/dashboard'), 650);
      } else {
        const data = await res.json().catch(() => ({} as { error?: string }));
        writeStatus('error');
        setErrorMsg(res.status === 429 ? (data.error ?? 'Demasiados intentos') : 'Código incorrecto');
        setTimeout(resetPad, 950);
      }
    } catch {
      writeStatus('error');
      setErrorMsg('Error de conexión');
      setTimeout(resetPad, 950);
    }
  }, [router, resetPad, writeStatus]);

  const press = useCallback((digit: string) => {
    if (statusRef.current === 'checking' || statusRef.current === 'success') return;
    if (pinRef.current.length >= PIN_LENGTH) return;
    const next = pinRef.current + digit;
    writePin(next);
    if (next.length === PIN_LENGTH) submit(next);
  }, [submit, writePin]);

  const backspace = useCallback(() => {
    if (statusRef.current === 'checking' || statusRef.current === 'success') return;
    writeStatus('idle');
    writePin(pinRef.current.slice(0, -1));
  }, [writePin, writeStatus]);

  // Teclado físico (portátil): dígitos, borrar y Esc. En el teléfono no estorba.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (/^\d$/.test(e.key)) { e.preventDefault(); press(e.key); }
      else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); backspace(); }
      else if (e.key === 'Escape') setOpen(false);
    };
    // Pegar el código (gestor de contraseñas) también entra.
    const onPaste = (e: ClipboardEvent) => {
      const digits = (e.clipboardData?.getData('text') ?? '').replace(/\D/g, '');
      if (!digits) return;
      e.preventDefault();
      for (const d of digits.slice(0, PIN_LENGTH)) press(d);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('paste', onPaste);
    };
  }, [open, press, backspace]);

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
      type="button"
      whileTap={{ scale: 0.88 }}
      // Sin foco: si no, en el portátil la barra espaciadora repetiría la última tecla.
      onMouseDown={e => e.preventDefault()}
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

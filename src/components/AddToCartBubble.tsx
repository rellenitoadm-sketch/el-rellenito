'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';

interface Bubble {
  id: number;
  x: number;
  y: number;
}

interface BubbleContextValue {
  triggerBubble: (x: number, y: number) => void;
}

const BubbleContext = createContext<BubbleContextValue | null>(null);

export function BubbleProvider({ children }: { children: ReactNode }) {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const idRef = useRef(0);

  const triggerBubble = useCallback((x: number, y: number) => {
    const id = idRef.current++;
    setBubbles(prev => [...prev, { id, x, y }]);
    setTimeout(() => {
      setBubbles(prev => prev.filter(b => b.id !== id));
    }, 800);
  }, []);

  // Target: bottom-center of screen (where CartButton lives)
  const targetX = typeof window !== 'undefined' ? window.innerWidth / 2 : 200;
  const targetY = typeof window !== 'undefined' ? window.innerHeight - 60 : 700;

  return (
    <BubbleContext.Provider value={{ triggerBubble }}>
      {children}
      <div className="pointer-events-none fixed inset-0 z-[999]" aria-hidden="true">
        <AnimatePresence>
          {bubbles.map(bubble => (
            <motion.div
              key={bubble.id}
              initial={{
                x: bubble.x - 16,
                y: bubble.y - 16,
                scale: 0,
                opacity: 1,
              }}
              animate={{
                x: targetX - 16,
                y: targetY - 16,
                scale: [0, 1.3, 0.6],
                opacity: [1, 1, 0],
              }}
              transition={{ duration: 0.65, ease: [0.4, 0, 0.2, 1] }}
              className="absolute w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg"
              style={{ background: 'var(--gradient-button)', boxShadow: 'var(--glow-sm)' }}
            >
              +1
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </BubbleContext.Provider>
  );
}

export function useBubble() {
  const ctx = useContext(BubbleContext);
  if (!ctx) throw new Error('useBubble must be inside BubbleProvider');
  return ctx;
}

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag } from 'lucide-react';
import { useCart } from './CartContext';
import { useCurrency } from './CurrencyContext';
import { cartTotals } from '@/lib/rates';

export default function CartButton() {
  const { items, itemCount, openCart } = useCart();
  const { format, rates, currency } = useCurrency();

  // Totales SOLO de los ítems con precio nativo en la moneda activa: los
  // bloqueados (sin precio en esta moneda) no suman al total mostrado.
  const { totalUsd, totalCop } = cartTotals(items, currency, rates);

  return (
    <AnimatePresence>
      {itemCount > 0 && (
        <motion.div
          id="cart-btn"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="fixed bottom-4 left-4 right-4 z-40 flex justify-center"
        >
          <motion.button
            onClick={openCart}
            whileTap={{ scale: 0.97 }}
            className="w-full max-w-sm flex items-center justify-between text-white font-bold px-5 py-4 rounded-2xl shadow-2xl btn-gradient glow-orange"
            aria-label="Ver carrito"
          >
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ rotate: [0, -10, 10, 0] }}
                transition={{ duration: 0.4 }}
                key={itemCount}
              >
                <ShoppingBag className="w-5 h-5" />
              </motion.div>
              <span className="text-sm">
                {itemCount} {itemCount === 1 ? 'producto' : 'productos'}
              </span>
            </div>
            <motion.span
              key={totalUsd}
              initial={{ scale: 1.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-base font-bold"
            >
              {format(totalUsd, totalCop)}
            </motion.span>
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

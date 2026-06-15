'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, MessageCircle, ExternalLink, MapPin, Clock } from 'lucide-react';
import GravixLogo from './GravixLogo';

const WA_NUMBER = '584247207067';

const FAQ = [
  {
    q: '¿Hacen tortas personalizadas?',
    a: 'Sí, con mínimo 24 horas de anticipación. Escríbenos por WhatsApp para confirmar diseño y sabor.',
  },
  {
    q: '¿Venden al mayor?',
    a: 'Sí, tenemos precios especiales al mayor para masas y tequeños. Entra a la sección "Al Mayor" desde el menú principal.',
  },
  {
    q: '¿Cuáles son las zonas de entrega?',
    a: 'Cubrimos La Concordia, Centro/Catedral, Pueblo Nuevo y Tariba/Pirineos. Pedidos al mayor: entrega gratis en ruta definida.',
  },
  {
    q: '¿A qué hora está disponible el servicio de frito?',
    a: 'El servicio de frito está disponible desde las 8:30 AM.',
  },
  {
    q: '¿Aceptan pagos desde Colombia?',
    a: 'Sí, aceptamos Bancolombia y Nequi además de Pago Móvil, Zelle, Binance y efectivo.',
  },
  {
    q: '¿Puedo hacer un pedido para días después?',
    a: 'Claro. Puedes reservar con anticipación. Para tortas o pedidos al mayor, mínimo 24 horas antes.',
  },
  {
    q: '¿Cómo sé que mi pedido llegó?',
    a: 'Al confirmar, recibirás un número de pedido. Nos pondremos en contacto contigo para coordinar la entrega.',
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b last:border-0" style={{ borderColor: 'var(--border-light)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-3 text-left gap-3 focus:outline-none"
      >
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{q}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex-shrink-0"
        >
          <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <p className="pb-3 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Footer() {
  const pqrsLink = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent('Hola, quiero dejar un PQRS sobre mi experiencia con El Rellenito. Mi comentario es:')}`;
  const waLink = `https://wa.me/${WA_NUMBER}`;
  const igLink = 'https://instagram.com/Elrellenito_';

  return (
    <footer className="mt-8 border-t" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
      {/* Brand + contact */}
      <div className="px-5 pt-8 pb-6 border-b" style={{ borderColor: 'var(--border-light)' }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border" style={{ borderColor: 'var(--border)' }}>
            <Image src="/logo-circle.png" alt="El Rellenito" width={40} height={40} className="object-cover w-full h-full" />
          </div>
          <div>
            <p className="font-bold text-sm leading-tight" style={{ color: 'var(--text-primary)' }}>El Rellenito</p>
            <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>Panadería y Pastelería</p>
          </div>
        </div>
        <p className="text-xs mb-4 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Especialistas en masa fácil, tequeños, pan artesanal y mucho más desde La Concordia, San Cristóbal, Táchira.
        </p>
        <div className="flex gap-3">
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-[#1faa52] bg-[#25D366]/12 border border-[#25D366]/30 rounded-full px-3 py-1.5 font-medium"
          >
            <MessageCircle className="w-3 h-3" />
            WhatsApp
          </a>
          <a
            href={igLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-[#c01f57] bg-[#E1306C]/12 border border-[#E1306C]/30 rounded-full px-3 py-1.5 font-medium"
          >
            <ExternalLink className="w-3 h-3" />
            @Elrellenito_
          </a>
        </div>
      </div>

      {/* Quiénes somos */}
      <div className="px-5 py-6 border-b" style={{ borderColor: 'var(--border-light)' }}>
        <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--brand-orange)' }}>
          Quiénes somos
        </h3>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          El Rellenito nació en San Cristóbal, Táchira, con el sueño de llevar masa fácil artesanal y pasapalos de calidad a cada hogar.
          Trabajamos con ingredientes frescos y recetas propias, ofreciendo tequeños, panes, postres y combos que conquistan a toda la familia.
          Hoy atendemos pedidos al detal y al mayor, con domicilio en las principales zonas de la ciudad.
        </p>
      </div>

      {/* FAQ */}
      <div className="px-5 py-6 border-b" style={{ borderColor: 'var(--border-light)' }}>
        <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--brand-orange)' }}>
          Preguntas frecuentes
        </h3>
        <div>
          {FAQ.map(item => (
            <FaqItem key={item.q} q={item.q} a={item.a} />
          ))}
        </div>
      </div>

      {/* PQRS */}
      <div className="px-5 py-6 border-b" style={{ borderColor: 'var(--border-light)' }}>
        <h3 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--brand-orange)' }}>
          PQRS
        </h3>
        <p className="text-xs mb-3 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          ¿Tienes una queja, petición, reclamo o sugerencia? Escríbenos directamente y te responderemos lo antes posible.
        </p>
        <a
          href={pqrsLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-white text-sm font-semibold px-4 py-2.5 rounded-xl btn-gradient"
        >
          <MessageCircle className="w-4 h-4" />
          Enviar PQRS por WhatsApp
        </a>
      </div>

      {/* Info + copyright */}
      <div className="px-5 py-5 space-y-2">
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <Clock className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--brand-orange)' }} />
          Lunes – Sábado · 8:00 AM – 7:00 PM
        </div>
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <MapPin className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--brand-orange)' }} />
          La Concordia, San Cristóbal, Táchira, Venezuela
        </div>
        <p className="text-xs pt-2" style={{ color: 'var(--text-muted)' }}>
          © {new Date().getFullYear()} El Rellenito · San Cristóbal, Táchira, Venezuela
        </p>
        <Link href="/privacidad" className="text-[11px] underline inline-block mt-1" style={{ color: 'var(--text-muted)' }}>
          Política de Privacidad y Cookies
        </Link>
        <div className="flex items-center justify-center gap-1.5 pt-3 opacity-70 hover:opacity-100 transition-opacity">
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>by</span>
          <GravixLogo height={20} />
        </div>
      </div>
    </footer>
  );
}

import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de Privacidad y Cookies — El Rellenito',
  description: 'Cómo El Rellenito recolecta, usa y protege tus datos personales.',
};

const UPDATED = '2 de junio de 2026';

export default function PrivacidadPage() {
  return (
    <main className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-10 px-4 py-3 flex items-center gap-3 border-b backdrop-blur-md"
        style={{ background: 'rgba(255,255,255,0.9)', borderColor: 'var(--border)' }}
      >
        <Link
          href="/"
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}
          aria-label="Volver"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full overflow-hidden" style={{ background: '#fff' }}>
            <Image src="/logo-circle.png" alt="" width={32} height={32} className="object-cover w-full h-full" />
          </div>
          <h1 className="text-[15px] font-bold" style={{ color: 'var(--text-1)' }}>Privacidad y Cookies</h1>
        </div>
      </div>

      <article className="max-w-2xl mx-auto px-5 py-8 space-y-6">
        <p className="text-[12px]" style={{ color: 'var(--text-3)' }}>Última actualización: {UPDATED}</p>

        <Section title="1. Quiénes somos">
          El Rellenito es un negocio de panadería y pastelería ubicado en La Concordia, San Cristóbal,
          Táchira, Venezuela. Esta política explica cómo tratamos tu información cuando usas nuestra
          plataforma de pedidos en línea.
        </Section>

        <Section title="2. Qué datos recolectamos">
          Solo recolectamos lo necesario para procesar tu pedido:
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><strong>Datos de contacto:</strong> nombre y número de WhatsApp.</li>
            <li><strong>Datos de entrega:</strong> tu ubicación (GPS) o dirección, solo si eliges domicilio.</li>
            <li><strong>Datos del pedido:</strong> productos, montos y método de pago elegido.</li>
            <li><strong>Comprobante de pago:</strong> referencia o imagen que adjuntes voluntariamente.</li>
            <li><strong>Métricas anónimas:</strong> visitas a la página (sin identificarte personalmente).</li>
          </ul>
        </Section>

        <Section title="3. Cómo usamos tus datos">
          Usamos tu información únicamente para: preparar y entregar tu pedido, contactarte por WhatsApp
          para confirmar o coordinar la entrega, verificar tu pago, y mejorar nuestro servicio. Nunca
          vendemos ni compartimos tus datos con terceros para fines publicitarios.
        </Section>

        <Section title="4. Ubicación (GPS)">
          Si eliges entrega a domicilio, solicitamos tu ubicación para calcular la zona y el costo de
          envío correctos. Compartir tu ubicación es opcional: si prefieres no hacerlo, puedes elegir
          “Retiro en tienda”. Tu ubicación se usa solo para esa entrega.
        </Section>

        <Section title="5. Cookies y almacenamiento local">
          Usamos:
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><strong>Cookies esenciales:</strong> mantienen la sesión del personal en el panel administrativo. No se usan para rastrear clientes.</li>
            <li><strong>Almacenamiento local del navegador:</strong> recuerda tu carrito y tu preferencia de moneda mientras navegas.</li>
            <li><strong>Métricas de visita anónimas:</strong> contamos visitas para conocer horas pico, sin identificarte.</li>
          </ul>
          No usamos cookies de publicidad ni rastreadores de terceros.
        </Section>

        <Section title="6. Con quién compartimos datos">
          Tu pedido se procesa con apoyo de proveedores de infraestructura (alojamiento de datos en
          Supabase y, para mensajería, WhatsApp/Meta). Estos proveedores solo procesan los datos
          necesarios para que el servicio funcione y bajo sus propias políticas de seguridad.
        </Section>

        <Section title="7. Cuánto tiempo conservamos tus datos">
          Conservamos los datos de pedidos el tiempo necesario para la operación del negocio y el
          cumplimiento de obligaciones. Puedes solicitar la eliminación de tus datos personales
          escribiéndonos por WhatsApp.
        </Section>

        <Section title="8. Tus derechos">
          Puedes solicitar acceder, corregir o eliminar tus datos personales en cualquier momento
          contactándonos por WhatsApp al{' '}
          <a href="https://wa.me/584247207067" className="font-semibold underline" style={{ color: 'var(--brand)' }}>
            +58 424 720 7067
          </a>.
        </Section>

        <Section title="9. Contacto">
          Para cualquier duda sobre esta política o sobre el tratamiento de tus datos, escríbenos por
          WhatsApp. Estaremos encantados de ayudarte.
        </Section>

        <div className="pt-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[13px] font-semibold px-4 py-2.5 rounded-xl"
            style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}
          >
            <ArrowLeft className="w-4 h-4" /> Volver al inicio
          </Link>
        </div>
      </article>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[15px] font-bold mb-2" style={{ color: 'var(--text-1)' }}>{title}</h2>
      <div className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>{children}</div>
    </section>
  );
}

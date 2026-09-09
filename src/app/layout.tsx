import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';
import { CartProvider } from '@/components/CartContext';
import { CurrencyProvider } from '@/components/CurrencyContext';
import { BubbleProvider } from '@/components/AddToCartBubble';
import { ProductsProvider } from '@/components/ProductsContext';
import { CategoriesProvider } from '@/components/CategoriesContext';
import { ProductModalProvider } from '@/components/ProductModal';
import { OnboardingProvider } from '@/components/Onboarding';
import { PwaInstallProvider } from '@/components/PwaInstall';
import StaffAlerts from '@/components/StaffAlerts';
import WakeLock from '@/components/WakeLock';
import RouteTrackingProvider from '@/components/RouteTracking';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const playfair = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://elrellenito.com'),
  title: 'El Rellenito — Panadería y Pastelería Artesanal',
  description:
    'Tequeños, masas, pasapalos, panadería y pasteles artesanales en San Cristóbal, Táchira. Pedidos con entrega a domicilio. Lunes a sábado 8 AM – 7 PM.',
  keywords: 'tequeños, panadería, pastelería, pasapalos, San Cristóbal, Táchira, Venezuela, delivery',
  alternates: {
    canonical: '/',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'El Rellenito',
    statusBarStyle: 'default',
  },
  // `appleWebApp.capable` emite el `mobile-web-app-capable` moderno, que iOS solo
  // entiende desde 16.4. Sin el nombre heredado, un iPhone más viejo instala la
  // app pero la abre con la barra de Safari encima en vez de a pantalla completa.
  other: {
    'apple-mobile-web-app-capable': 'yes',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48', type: 'image/x-icon' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'El Rellenito — Panadería y Pastelería Artesanal',
    description: 'Tequeños, masas, pasapalos y más. Delivery en San Cristóbal.',
    locale: 'es_VE',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#FF5100',
  colorScheme: 'dark',
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Bakery',
  name: 'El Rellenito',
  image: 'https://elrellenito.com/logo-full.png',
  url: 'https://elrellenito.com',
  telephone: '+584247207067',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'La Concordia, San Cristóbal',
    addressRegion: 'Táchira',
    addressCountry: 'VE',
  },
  openingHoursSpecification: {
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    opens: '08:00',
    closes: '19:00',
  },
  servesCuisine: 'Venezolana',
  sameAs: ['https://instagram.com/Elrellenito_'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${playfair.variable} h-full`}
    >
      <body className="min-h-full antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <CurrencyProvider>
          <CategoriesProvider>
          <ProductsProvider>
            <CartProvider>
              <BubbleProvider>
                <ProductModalProvider>
                  <OnboardingProvider>
                    <PwaInstallProvider>
                      <RouteTrackingProvider>
                        {children}
                      </RouteTrackingProvider>
                      <StaffAlerts />
                      <WakeLock />
                    </PwaInstallProvider>
                  </OnboardingProvider>
                </ProductModalProvider>
              </BubbleProvider>
            </CartProvider>
          </ProductsProvider>
          </CategoriesProvider>
        </CurrencyProvider>
      </body>
    </html>
  );
}

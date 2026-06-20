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
  title: 'El Rellenito — Panadería y Pastelería Artesanal',
  description:
    'Tequeños, masas, pasapalos, panadería y pasteles artesanales en San Cristóbal, Táchira. Pedidos con entrega a domicilio. Lunes a sábado 8 AM – 7 PM.',
  keywords: 'tequeños, panadería, pastelería, pasapalos, San Cristóbal, Táchira, Venezuela, delivery',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'El Rellenito',
    statusBarStyle: 'default',
  },
  icons: {
    icon: '/icon-192.png',
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
        <CurrencyProvider>
          <CategoriesProvider>
          <ProductsProvider>
            <CartProvider>
              <BubbleProvider>
                <ProductModalProvider>
                  <OnboardingProvider>
                    <PwaInstallProvider>
                      {children}
                      <StaffAlerts />
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

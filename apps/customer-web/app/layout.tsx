import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';
import { Header } from '@/components/Header';
import { Footer, TabBar } from '@/components/Footer';

export const metadata: Metadata = {
  title: { default: 'Send Koro — local food, fairer for everyone', template: '%s · Send Koro' },
  description: 'Order from New York restaurants that keep 100% of their food sales. Every fee shown before you pay; 100% of tips go to couriers.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Send Koro',
  appleWebApp: { capable: true, title: 'Send Koro', statusBarStyle: 'default' },
  icons: { icon: [{ url: '/favicon.ico', sizes: '48x48' }, { url: '/favicon.svg', type: 'image/svg+xml' }], apple: '/icons/apple-touch-icon.png' },
};

export const viewport: Viewport = { themeColor: '#0B3B6E', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Providers>
          <Header />
          <main>{children}</main>
          <Footer />
          <TabBar />
        </Providers>
      </body>
    </html>
  );
}

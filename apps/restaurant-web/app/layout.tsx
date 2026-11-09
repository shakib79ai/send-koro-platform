import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';
import { Shell } from '@/components/Shell';

export const metadata: Metadata = {
  title: { default: 'Send Koro for Restaurants', template: '%s · Send Koro for Restaurants' },
  description: 'Live orders, menu, earnings and settings for Send Koro restaurants. $0 commission.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Send Koro Restaurants',
  appleWebApp: { capable: true, title: 'SK Restaurants', statusBarStyle: 'black-translucent' },
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
      <body><Providers><Shell>{children}</Shell></Providers></body>
    </html>
  );
}

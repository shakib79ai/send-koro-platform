'use client';
import { useEffect } from 'react';
import { SessionProvider } from '@/lib/session';
import { CartProvider } from '@/lib/cart';

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);
  return <SessionProvider><CartProvider>{children}</CartProvider></SessionProvider>;
}

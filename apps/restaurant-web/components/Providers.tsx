'use client';
import { useEffect } from 'react';
import { PortalProvider } from '@/lib/portal';

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);
  return <PortalProvider>{children}</PortalProvider>;
}

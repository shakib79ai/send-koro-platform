'use client';
import { AdminProvider } from '@/lib/admin';
export function Providers({ children }: { children: React.ReactNode }) { return <AdminProvider>{children}</AdminProvider>; }

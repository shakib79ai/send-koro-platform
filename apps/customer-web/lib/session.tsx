'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, loadSession, saveSession, Session } from './api';
import type { Address } from './types';

interface Ctx {
  session: Session | null;
  ready: boolean;
  addresses: Address[];
  selectedAddress: Address | null;
  selectAddress: (id: string) => void;
  reloadAddresses: () => Promise<void>;
  signOut: () => Promise<void>;
}
const SessionContext = createContext<Ctx | null>(null);
const ADDR_KEY = 'sk.address';

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const reloadAddresses = useCallback(async () => {
    if (!loadSession()) { setAddresses([]); return; }
    try { setAddresses(await api<Address[]>('/me/addresses')); } catch { setAddresses([]); }
  }, []);

  useEffect(() => {
    const sync = () => { setSession(loadSession()); };
    sync();
    try { setSelectedId(localStorage.getItem(ADDR_KEY)); } catch { /* ignore */ }
    setReady(true);
    window.addEventListener('sk-session', sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('sk-session', sync); window.removeEventListener('storage', sync); };
  }, []);

  useEffect(() => { void reloadAddresses(); }, [session?.user.id, reloadAddresses]);

  const selectedAddress = addresses.find((a) => a.id === selectedId) ?? addresses.find((a) => a.isDefault) ?? addresses[0] ?? null;
  const selectAddress = (id: string) => { setSelectedId(id); try { localStorage.setItem(ADDR_KEY, id); } catch { /* ignore */ } };
  const signOut = async () => {
    const s = loadSession();
    if (s) await api('/auth/sign-out', { body: { refreshToken: s.refreshToken }, auth: false }).catch(() => undefined);
    saveSession(null);
    setAddresses([]);
  };

  return <SessionContext.Provider value={{ session, ready, addresses, selectedAddress, selectAddress, reloadAddresses, signOut }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const c = useContext(SessionContext);
  if (!c) throw new Error('useSession outside SessionProvider');
  return c;
}

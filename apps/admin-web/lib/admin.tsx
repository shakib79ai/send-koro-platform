'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { api, loadSession, saveSession, Session } from './api';

interface Ctx { session: Session | null; ready: boolean; signOut: () => Promise<void> }
const AdminContext = createContext<Ctx | null>(null);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sync = () => setSession(loadSession());
    sync(); setReady(true);
    window.addEventListener('sk-session', sync);
    return () => window.removeEventListener('sk-session', sync);
  }, []);
  const signOut = async () => {
    const s = loadSession();
    if (s) await api('/auth/sign-out', { body: { refreshToken: s.refreshToken }, auth: false }).catch(() => undefined);
    saveSession(null);
  };
  return <AdminContext.Provider value={{ session, ready, signOut }}>{children}</AdminContext.Provider>;
}
export function useAdmin() { const c = useContext(AdminContext); if (!c) throw new Error('useAdmin outside AdminProvider'); return c; }

/** Fetch helper for pages: { data, error, reload }. */
export function useData<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!path) return;
    let live = true;
    api<T>(path).then((d) => { if (live) { setData(d); setError(''); } }).catch((e) => live && setError(e?.message ?? 'Failed to load'));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, n, ...deps]);
  return { data, error, reload: () => setN((x) => x + 1) };
}

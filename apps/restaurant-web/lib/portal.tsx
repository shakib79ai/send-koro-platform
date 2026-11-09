'use client';
/** Signed-in staff member, their restaurants, and the one currently shown. */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, loadSession, saveSession, Session } from './api';
import type { Restaurant } from './types';

interface Ctx {
  session: Session | null; ready: boolean;
  restaurants: { id: string; name: string; myRole: string }[];
  restaurant: Restaurant | null;
  role: 'owner' | 'manager' | 'staff' | null;
  select: (id: string) => void;
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
}
const PortalContext = createContext<Ctx | null>(null);
const KEY = 'sk.restaurant';

export function PortalProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [restaurants, setRestaurants] = useState<Ctx['restaurants']>([]);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setSession(loadSession());
    sync();
    try { setSelected(localStorage.getItem(KEY)); } catch { /* ignore */ }
    window.addEventListener('sk-session', sync);
    return () => window.removeEventListener('sk-session', sync);
  }, []);

  const reload = useCallback(async () => {
    if (!loadSession()) { setRestaurants([]); setRestaurant(null); setReady(true); return; }
    try {
      const mine = await api<Ctx['restaurants']>('/restaurants/mine');
      setRestaurants(mine);
      const id = mine.find((r) => r.id === selected)?.id ?? mine[0]?.id;
      setRestaurant(id ? await api<Restaurant>(`/restaurants/${id}`) : null);
    } catch { setRestaurant(null); } finally { setReady(true); }
  }, [selected]);

  useEffect(() => { void reload(); }, [session?.user.id, reload]);

  const select = (id: string) => { setSelected(id); try { localStorage.setItem(KEY, id); } catch { /* ignore */ } };
  const signOut = async () => {
    const s = loadSession();
    if (s) await api('/auth/sign-out', { body: { refreshToken: s.refreshToken }, auth: false }).catch(() => undefined);
    saveSession(null);
  };
  const role = (restaurants.find((r) => r.id === restaurant?.id)?.myRole as Ctx['role']) ?? null;
  return <PortalContext.Provider value={{ session, ready, restaurants, restaurant, role, select, reload, signOut }}>{children}</PortalContext.Provider>;
}

export function usePortal() {
  const c = useContext(PortalContext);
  if (!c) throw new Error('usePortal outside PortalProvider');
  return c;
}

export const canManage = (role: Ctx['role']) => role === 'owner' || role === 'manager';
export const isOwner = (role: Ctx['role']) => role === 'owner';

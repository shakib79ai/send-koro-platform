'use client';
/**
 * One cart per restaurant location, kept in localStorage. Prices here are for display only —
 * the API re-prices everything at checkout and the receipt it returns is what the customer pays.
 */
import { createContext, useContext, useEffect, useState } from 'react';

export interface CartLine { key: string; itemId: string; name: string; quantity: number; optionIds: string[]; optionNames: string[]; unitCents: number; note?: string }
export interface Cart { locationId: string; restaurantName: string; lines: CartLine[] }

interface Ctx {
  cart: Cart | null;
  count: number;
  subtotalCents: number;
  add: (locationId: string, restaurantName: string, line: Omit<CartLine, 'key'>) => { replaced: boolean };
  setQuantity: (key: string, quantity: number) => void;
  clear: () => void;
}
const CartContext = createContext<Ctx | null>(null);
const KEY = 'sk.cart';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  useEffect(() => { try { const s = localStorage.getItem(KEY); if (s) setCart(JSON.parse(s)); } catch { /* ignore */ } }, []);
  const persist = (c: Cart | null) => { setCart(c); try { if (c) localStorage.setItem(KEY, JSON.stringify(c)); else localStorage.removeItem(KEY); } catch { /* ignore */ } };

  const add: Ctx['add'] = (locationId, restaurantName, line) => {
    const replaced = !!cart && cart.locationId !== locationId && cart.lines.length > 0;
    const base: Cart = !cart || replaced ? { locationId, restaurantName, lines: [] } : cart;
    const key = `${line.itemId}:${[...line.optionIds].sort().join(',')}:${line.note ?? ''}`;
    const existing = base.lines.find((l) => l.key === key);
    const lines = existing ? base.lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(50, l.quantity + line.quantity) } : l)) : [...base.lines, { ...line, key }];
    persist({ ...base, lines });
    return { replaced };
  };
  const setQuantity = (key: string, quantity: number) => {
    if (!cart) return;
    const lines = quantity <= 0 ? cart.lines.filter((l) => l.key !== key) : cart.lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(50, quantity) } : l));
    persist(lines.length ? { ...cart, lines } : null);
  };
  const count = cart?.lines.reduce((a, l) => a + l.quantity, 0) ?? 0;
  const subtotalCents = cart?.lines.reduce((a, l) => a + l.unitCents * l.quantity, 0) ?? 0;
  return <CartContext.Provider value={{ cart, count, subtotalCents, add, setQuantity, clear: () => persist(null) }}>{children}</CartContext.Provider>;
}

export function useCart() {
  const c = useContext(CartContext);
  if (!c) throw new Error('useCart outside CartProvider');
  return c;
}

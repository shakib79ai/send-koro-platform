'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useSession } from '@/lib/session';
import { useCart } from '@/lib/cart';
import { AddressSheet } from './AddressSheet';
import { CartSheet } from './CartSheet';
import { BrandLogo } from './BrandLogo';

export function Logo() {
  return <BrandLogo height={34} />;
}

export function Header() {
  const { session, selectedAddress } = useSession();
  const { count } = useCart();
  const [addrOpen, setAddrOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  return (
    <header className="header">
      <div className="container">
        <Link href="/" aria-label="Send Koro home"><Logo /></Link>
        <button className="addr-btn" onClick={() => setAddrOpen(true)}>
          <span className="k">Deliver now to</span>
          <span className="v">{selectedAddress ? `${labelOf(selectedAddress)} · ${selectedAddress.line1}` : 'Add an address'}</span>
        </button>
        <div className="spacer" />
        <nav className="row hide-sm" style={{ gap: 4 }}>
          <Link className="nav-link" href="/orders">Orders</Link>
          <Link className="nav-link" href="/help">Help</Link>
          {session ? <Link className="nav-link" href="/account">{session.user.name?.split(' ')[0] ?? 'Account'}</Link> : <Link className="nav-link" href="/sign-in">Sign in / Sign up</Link>}
        </nav>
        <button className="cart-pill" onClick={() => setCartOpen(true)} aria-label={`Cart, ${count} items`}>
          <span className="label">Cart</span><span className="ico" aria-hidden>🛒</span><span className="n">{count}</span>
        </button>
      </div>
      {addrOpen && <AddressSheet onClose={() => setAddrOpen(false)} />}
      {cartOpen && <CartSheet onClose={() => setCartOpen(false)} />}
    </header>
  );
}

export const labelOf = (a: { label: string; customLabel?: string | null }) => a.label === 'other' ? a.customLabel || 'Other' : a.label === 'home' ? 'Home' : 'Office';

'use client';
import Link from 'next/link';
import { useCart } from '@/lib/cart';
import { usd } from '@/lib/money';

export function CartLines() {
  const { cart, setQuantity } = useCart();
  if (!cart) return <p className="muted">Your cart is empty.</p>;
  return (
    <div className="stack" style={{ gap: 10 }}>
      {cart.lines.map((l) => (
        <div key={l.key} className="row" style={{ alignItems: 'flex-start' }}>
          <div className="spacer">
            <div className="bold">{l.name}</div>
            {l.optionNames.length > 0 && <div className="tiny muted">{l.optionNames.join(' · ')}</div>}
            <div className="small muted">{usd(l.unitCents)}</div>
          </div>
          <div className="qty">
            <button aria-label="Fewer" onClick={() => setQuantity(l.key, l.quantity - 1)}>−</button>
            <span>{l.quantity}</span>
            <button aria-label="More" onClick={() => setQuantity(l.key, l.quantity + 1)}>+</button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CartSheet({ onClose }: { onClose: () => void }) {
  const { cart, subtotalCents } = useCart();
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Your cart">
        <div className="hd row between"><div><h2>Your cart</h2>{cart && <div className="small muted">{cart.restaurantName}</div>}</div><button className="btn sm" onClick={onClose}>Close</button></div>
        <div className="bd"><CartLines /></div>
        {cart && (
          <div className="ft stack">
            <div className="row between"><span className="muted">Food subtotal</span><b>{usd(subtotalCents)}</b></div>
            <p className="tiny muted" style={{ margin: 0 }}>Tax, delivery and tip are shown line by line at checkout. No card fees, ever.</p>
            <Link href="/checkout" className="btn primary block" onClick={onClose}>Go to checkout</Link>
          </div>
        )}
      </div>
    </div>
  );
}

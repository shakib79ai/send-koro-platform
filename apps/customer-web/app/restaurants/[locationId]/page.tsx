'use client';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useCart } from '@/lib/cart';
import type { MenuItem, RestaurantPage } from '@/lib/types';
import { usd } from '@/lib/money';
import { ItemModal } from '@/components/ItemModal';
import { CartLines } from '@/components/CartSheet';
import { deliveryOffer } from '@/components/RestaurantCard';

function feeText(f: RestaurantPage['fees'][number]) {
  const amount = [f.rateBps ? `${f.rateBps / 100}%` : null, f.fixedCents ? usd(f.fixedCents) : null].filter(Boolean).join(' + ');
  return `${f.label}: ${amount}${f.minFoodCents ? ` on orders over ${usd(f.minFoodCents)}` : ''}`;
}

export default function RestaurantPageView({ params }: { params: Promise<{ locationId: string }> }) {
  const { locationId } = use(params);
  const [data, setData] = useState<RestaurantPage | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<MenuItem | null>(null);
  const [toast, setToast] = useState('');
  const { add, cart, subtotalCents } = useCart();

  useEffect(() => {
    api<RestaurantPage>(`/catalog/locations/${locationId}`, { auth: false }).then(setData).catch((e) => setError(e instanceof ApiError ? e.message : 'Couldn’t load the menu.'));
  }, [locationId]);

  if (error) return <div className="container" style={{ paddingTop: 32 }}><div className="error">{error}</div></div>;
  if (!data) return <div className="container" style={{ paddingTop: 32 }}><div className="skeleton" style={{ height: 160 }} /></div>;

  const sections = [...data.menu.categories.filter((c) => c.items.length), ...(data.menu.uncategorized.length ? [{ id: 'more', name: data.menu.categories.length ? 'More' : 'Menu', items: data.menu.uncategorized }] : [])];
  const soldOut = (i: MenuItem) => !i.available || (i.soldOutUntil && new Date(i.soldOutUntil) > new Date());
  const offer = deliveryOffer(data);
  const thisCart = cart?.locationId === locationId;

  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <div className="card pad" style={{ marginBottom: 16 }}>
        <div className="row between" style={{ flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 32 }}>{data.name}</h1>
            <div className="muted small">{[data.cuisine, data.address].filter(Boolean).join(' · ')}</div>
          </div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {data.open ? <span className="badge green">Open · {data.prepMinutes} min prep</span> : <span className="badge gray">Closed now</span>}
            {data.busy && <span className="badge red">Busy — a little slower</span>}
            {offer && <span className="badge orange">{offer}</span>}
          </div>
        </div>
        {data.fees.length > 0 && <div className="note" style={{ marginTop: 12 }}><b>Fees set by {data.name}:</b> {data.fees.map(feeText).join(' · ')}</div>}
        <p className="tiny muted" style={{ margin: '10px 0 0' }}>{data.taxNote}</p>
      </div>

      <nav className="cat-nav">{sections.map((s) => <a key={s.id} className="chip" href={`#c-${s.id}`}>{s.name}</a>)}</nav>

      <div className="menu-layout">
        <div className="stack" style={{ gap: 28 }}>
          {sections.map((s) => (
            <section key={s.id} id={`c-${s.id}`} className="stack">
              <h2>{s.name}</h2>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                {s.items.map((i) => (
                  <button key={i.id} className={`item ${soldOut(i) ? 'sold' : ''}`} disabled={!!soldOut(i) || !data.open} onClick={() => setOpen(i)}>
                    <div className="spacer">
                      <div className="bold">{i.name}</div>
                      {i.description && <div className="small muted" style={{ margin: '4px 0' }}>{i.description}</div>}
                      <div className="small">{soldOut(i) ? <span className="badge gray">Sold out</span> : usd(i.priceCents)}</div>
                    </div>
                    {i.imageUrl ? <img className="thumb" src={i.imageUrl} alt="" /> : null}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
        <aside className="card pad sticky">
          <h3 style={{ marginBottom: 12 }}>Your order</h3>
          {thisCart ? <><CartLines /><div className="row between" style={{ margin: '14px 0' }}><span className="muted">Food subtotal</span><b>{usd(subtotalCents)}</b></div><Link href="/checkout" className="btn primary block">Go to checkout</Link></> : <p className="muted small">Add items to start your order.</p>}
        </aside>
      </div>

      {open && (
        <ItemModal item={open} onClose={() => setOpen(null)} onAdd={(quantity, optionIds, optionNames, unitCents, note) => {
          const { replaced } = add(locationId, data.name, { itemId: open.id, name: open.name, quantity, optionIds, optionNames, unitCents, note });
          setOpen(null);
          setToast(replaced ? `Started a new cart at ${data.name}` : `Added to cart`);
          setTimeout(() => setToast(''), 2500);
        }} />
      )}
      {toast && <div className="success" style={{ position: 'fixed', bottom: 84, left: '50%', transform: 'translateX(-50%)', zIndex: 60, boxShadow: 'var(--shadow)' }}>{toast}</div>}
    </div>
  );
}

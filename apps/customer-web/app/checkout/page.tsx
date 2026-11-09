'use client';
/**
 * Checkout. Prices come only from the API preview; the receipt it returns is exactly what the card
 * is charged. Stripe.js is initialised with the RESTAURANT's account (direct charge). The card is
 * authorised when the order is placed and charged only when the restaurant accepts.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { api, ApiError } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { useSession } from '@/lib/session';
import { usd } from '@/lib/money';
import type { Receipt as R } from '@/lib/types';
import { Receipt } from '@/components/Receipt';
import { labelOf } from '@/components/Header';
import { AddressSheet } from '@/components/AddressSheet';

interface Preview { receipt: R; etaMinutes: number; restaurant: { id: string; name: string }; stripeAccount: string | null }
interface Placed { order: { id: string }; payment: { clientSecret: string; stripeAccount: string } | null }

const PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
const stripeCache = new Map<string, Promise<Stripe | null>>();
const stripeFor = (acct: string) => {
  if (!stripeCache.has(acct)) stripeCache.set(acct, loadStripe(PK, { stripeAccount: acct }).catch(() => null));
  return stripeCache.get(acct)!;
};
const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export default function CheckoutPage() {
  const { session, ready, selectedAddress, addresses, selectAddress } = useSession();
  const { cart, clear } = useCart();
  const router = useRouter();
  const [fulfilment, setFulfilment] = useState<'delivery' | 'pickup'>('delivery');
  const [tipChoice, setTipChoice] = useState<number | 'custom'>(18);
  const [customTip, setCustomTip] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [addrOpen, setAddrOpen] = useState(false);

  const foodEstimate = cart?.lines.reduce((a, l) => a + l.unitCents * l.quantity, 0) ?? 0;
  const tipCents = fulfilment === 'pickup' ? 0 : tipChoice === 'custom' ? Math.max(0, Math.round(parseFloat(customTip || '0') * 100)) : Math.round((foodEstimate * tipChoice) / 100);

  const body = useMemo(() => cart && ({
    locationId: cart.locationId, fulfilment, addressId: fulfilment === 'delivery' ? selectedAddress?.id : undefined,
    lines: cart.lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity, optionIds: l.optionIds, note: l.note })), tipCents,
  }), [cart, fulfilment, selectedAddress?.id, tipCents]);

  useEffect(() => {
    if (!session || !body || (fulfilment === 'delivery' && !body.addressId)) { setPreview(null); return; }
    let live = true;
    setLoading(true); setError('');
    const t = setTimeout(() => {
      api<Preview>('/orders/preview', { body }).then((p) => live && setPreview(p)).catch((e) => { if (live) { setPreview(null); setError(e instanceof ApiError ? e.message : 'Couldn’t price your order.'); } }).finally(() => live && setLoading(false));
    }, 300);
    return () => { live = false; clearTimeout(t); };
  }, [session, body, fulfilment]);

  if (!ready) return null;
  if (!session) return <Centered><h2>Sign in to check out</h2><p className="muted">Your cart is saved.</p><Link className="btn primary" href="/sign-in?next=/checkout">Sign in / Sign up</Link></Centered>;
  if (!cart) return <Centered><h2>Your cart is empty</h2><Link className="btn primary" href="/">Find food</Link></Centered>;

  const tipOptions = [15, 18, 20];
  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <div className="row between"><h1 style={{ fontSize: 30 }}>Checkout</h1><span className="small muted">Secure checkout · Stripe</span></div>
      <div className="two-col" style={{ marginTop: 16 }}>
        <div className="stack" style={{ gap: 16 }}>
          <div className="card pad stack">
            <div className="row between"><h3>{fulfilment === 'delivery' ? 'Deliver to' : 'Pick up'}</h3><div className="seg"><button className={fulfilment === 'delivery' ? 'on' : ''} onClick={() => setFulfilment('delivery')}>Delivery</button><button className={fulfilment === 'pickup' ? 'on' : ''} onClick={() => setFulfilment('pickup')}>Pickup</button></div></div>
            {fulfilment === 'delivery' ? (
              addresses.length ? (
                <>
                  <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                    {addresses.map((a) => <button key={a.id} className={`chip ${selectedAddress?.id === a.id ? 'on' : ''}`} onClick={() => selectAddress(a.id)}>{labelOf(a)}</button>)}
                    <button className="chip" onClick={() => setAddrOpen(true)}>+ New</button>
                  </div>
                  {selectedAddress && <div className="small"><b>{selectedAddress.line1}{selectedAddress.line2 ? `, ${selectedAddress.line2}` : ''}</b><div className="muted">{selectedAddress.city}, {selectedAddress.state} {selectedAddress.postalCode}{selectedAddress.dropoffInstructions ? ` · “${selectedAddress.dropoffInstructions}”` : ''}</div></div>}
                </>
              ) : <button className="btn" onClick={() => setAddrOpen(true)}>+ Add a delivery address</button>
            ) : <p className="small muted">Collect from {cart.restaurantName}. We’ll tell you when it’s ready.</p>}
          </div>

          {fulfilment === 'delivery' && (
            <div className="card pad stack">
              <div className="row between"><h3>Tip your courier</h3><span className="badge green">100% goes to them</span></div>
              <div className="tips">
                {tipOptions.map((p) => <button key={p} className={tipChoice === p ? 'on' : ''} onClick={() => setTipChoice(p)}>{p}%<div className="tiny muted">{usd(Math.round((foodEstimate * p) / 100))}</div></button>)}
                <button className={tipChoice === 'custom' ? 'on' : ''} onClick={() => setTipChoice('custom')}>Other</button>
              </div>
              {tipChoice === 'custom' && <input className="input" inputMode="decimal" placeholder="Tip amount, e.g. 5.00" value={customTip} onChange={(e) => setCustomTip(e.target.value.replace(/[^\d.]/g, ''))} />}
              <p className="tiny muted" style={{ margin: 0 }}>Paid in full to your courier after the order is delivered.</p>
            </div>
          )}

          <div className="card pad stack">
            <h3>Payment</h3>
            {!PK ? <div className="error">Payments aren’t configured (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY).</div>
              : preview?.stripeAccount && body ? (
                <Elements key={preview.stripeAccount} stripe={stripeFor(preview.stripeAccount)} options={{ mode: 'payment', amount: preview.receipt.totalCents, currency: 'usd', captureMethod: 'manual', appearance: { theme: 'stripe', variables: { colorPrimary: '#FF7A00', borderRadius: '10px', fontFamily: 'Inter, system-ui, sans-serif' } } }}>
                  <PayForm preview={preview} body={body} onDone={(orderId) => { clear(); router.push(`/orders/${orderId}?placed=1`); }} onPriceChanged={(msg) => { setError(msg); setPreview(null); }} />
                </Elements>
              ) : preview && !preview.stripeAccount ? <div className="error">{preview.restaurant.name} can’t take card payments yet. Please try again later.</div>
              : <p className="small muted">{loading ? 'Pricing your order…' : fulfilment === 'delivery' && !selectedAddress ? 'Choose an address to see your total.' : 'Pricing your order…'}</p>}
          </div>
        </div>

        <aside className="card pad stack sticky summary-first">
          <div className="row"><div className="badge orange" style={{ fontSize: 14 }}>{cart.restaurantName.split(' ').map((w) => w[0]).slice(0, 2).join('')}</div><div><b>{cart.restaurantName}</b><div className="tiny muted">{cart.lines.reduce((a, l) => a + l.quantity, 0)} items · {fulfilment === 'delivery' ? 'Delivery' : 'Pickup'}{preview ? ` · about ${preview.etaMinutes} min` : ''}</div></div></div>
          {error && <div className="error">{error}</div>}
          {preview ? <Receipt receipt={preview.receipt} /> : <div className="skeleton" style={{ height: 180 }} />}
        </aside>
      </div>
      {addrOpen && <AddressSheet onClose={() => setAddrOpen(false)} />}
    </div>
  );
}

function PayForm({ preview, body, onDone, onPriceChanged }: { preview: Preview; body: object; onDone: (orderId: string) => void; onPriceChanged: (msg: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const key = useRef(newKey()); // same key for retries of this checkout → one order
  const [stripeFailed, setStripeFailed] = useState(false);
  useEffect(() => { const t = setTimeout(() => { if (!stripe) setStripeFailed(true); }, 8000); if (stripe) setStripeFailed(false); return () => clearTimeout(t); }, [stripe]);

  useEffect(() => { elements?.update({ amount: preview.receipt.totalCents }); }, [elements, preview.receipt.totalCents]);

  const place = async () => {
    if (!stripe || !elements) return;
    setBusy(true); setError('');
    try {
      const { error: submitError } = await elements.submit();
      if (submitError) { setError(submitError.message ?? 'Check your payment details'); return; }
      const placed = await api<Placed>('/orders', { body: { ...body, idempotencyKey: key.current, expectedTotalCents: preview.receipt.totalCents } });
      if (placed.payment) {
        const { error: confirmError } = await stripe.confirmPayment({
          elements, clientSecret: placed.payment.clientSecret, redirect: 'if_required',
          confirmParams: { return_url: `${window.location.origin}/orders/${placed.order.id}?placed=1` },
        });
        if (confirmError) { setError(confirmError.message ?? 'Your card was not accepted'); return; }
      }
      await api(`/orders/${placed.order.id}/payment-confirmed`, { method: 'POST' }).catch(() => undefined);
      onDone(placed.order.id);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'price_changed') { key.current = newKey(); onPriceChanged(e.message); }
      else setError(e instanceof ApiError ? e.message : 'Something went wrong. You have not been charged.');
    } finally { setBusy(false); }
  };

  return (
    <div className="stack">
      <PaymentElement options={{ layout: 'tabs', wallets: { applePay: 'auto', googlePay: 'auto' } }} />
      {stripeFailed && <div className="error">The secure payment form didn’t load. Check your connection or turn off content blockers, then refresh.</div>}
      {error && <div className="error">{error}</div>}
      <button className="btn primary block" onClick={place} disabled={busy || !stripe}>{busy ? 'Placing order…' : `Place order · ${usd(preview.receipt.totalCents)}`}</button>
      <p className="tiny muted center" style={{ margin: 0 }}>Your card is charged only when {preview.restaurant.name} accepts. If they don’t, the hold is released. No card fees.</p>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="container" style={{ paddingTop: 64 }}><div className="card pad stack center" style={{ maxWidth: 420, margin: '0 auto', alignItems: 'center' }}>{children}</div></div>;
}

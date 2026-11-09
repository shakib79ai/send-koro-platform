'use client';
/** List your restaurant: details → location → hours → taxes → delivery fee → Stripe payouts → go live. */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { usePortal } from '@/lib/portal';
import type { Restaurant } from '@/lib/types';
import { LocationForm } from '@/components/LocationForm';
import { HoursEditor } from '@/components/HoursEditor';
import { TaxForm } from '@/components/TaxForm';
import { DeliveryFeeForm } from '@/components/DeliveryFeeForm';
import { useAction } from '@/components/ui';
import { BrandLogo } from '@/components/BrandLogo';

export default function Setup() {
  const { session, ready, restaurant, reload, select, signOut } = usePortal();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cuisine, setCuisine] = useState('');
  const { busy, run, Status } = useAction();
  if (!ready) return null;
  if (!session) { router.replace('/sign-in'); return null; }

  const steps: { key: keyof Restaurant['checklist'] | 'details'; title: string; done: boolean }[] = [
    { key: 'details', title: 'Restaurant details', done: !!restaurant },
    { key: 'location', title: 'Store location & delivery area', done: !!restaurant?.checklist.location },
    { key: 'hours', title: 'Opening hours', done: !!restaurant?.checklist.hours },
    { key: 'taxResponsibility', title: 'Sales tax', done: !!restaurant?.checklist.taxResponsibility },
    { key: 'deliveryFeeRule', title: 'Who pays for delivery', done: !!restaurant?.checklist.deliveryFeeRule },
    { key: 'payouts', title: 'Get paid with Stripe', done: !!restaurant?.checklist.payouts },
  ];
  const current = steps.find((s) => !s.done)?.key ?? 'done';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      <div className="mobile-top" style={{ display: 'flex' }}><BrandLogo tone="reversed" height={28} />{restaurant?.status === 'live' ? <Link className="btn sm" href="/">Go to live orders</Link> : <button className="btn sm" onClick={signOut}>Sign out</button>}</div>
      <div className="container" style={{ maxWidth: 900, paddingTop: 28, paddingBottom: 60 }}>
        <h1>List your restaurant. <span style={{ color: 'var(--orange)' }}>Keep every dollar</span> of food sales.</h1>
        <p className="muted">Flat monthly plan from $50, first month free. Takes about 10 minutes. Have ready: your NYS Sales Tax Certificate of Authority, NYC Health permit and bank details (Stripe asks for your EIN and identity on its secure pages).</p>
        <div className="setup-grid" style={{ marginTop: 20 }}>
          <div className="card pad stack" style={{ gap: 8 }}>
            {steps.map((s, i) => <div key={s.key} className="row small" style={{ fontWeight: current === s.key ? 700 : 500, color: s.done ? 'var(--green)' : current === s.key ? 'var(--ink)' : 'var(--muted)' }}><span>{s.done ? '✓' : i + 1}</span>{s.title}</div>)}
            <div className="row small" style={{ fontWeight: current === 'done' ? 700 : 500, color: restaurant?.status === 'live' ? 'var(--green)' : 'var(--muted)' }}><span>{restaurant?.status === 'live' ? '✓' : 7}</span>Go live</div>
          </div>
          <div className="card pad stack">
            {current === 'details' && (<>
              <h2>Restaurant details</h2>
              <div className="field"><label htmlFor="n">Store name (as customers will see it)</label><input id="n" className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="form-grid">
                <div className="field"><label htmlFor="e">Business email</label><input id="e" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="field"><label htmlFor="c">Cuisine</label><input id="c" className="input" placeholder="Bangladeshi" value={cuisine} onChange={(e) => setCuisine(e.target.value)} /></div>
              </div>
              <Status />
              <button className="btn primary" style={{ alignSelf: 'flex-start' }} disabled={busy || name.length < 2 || !email.includes('@')} onClick={() => run(async () => { const r = await api<{ id: string }>('/restaurants', { body: { name, contactEmail: email, cuisine: cuisine || undefined } }); select(r.id); await reload(); })}>Continue</button>
            </>)}
            {current === 'location' && <><h2>Store location & delivery area</h2><LocationForm /></>}
            {current === 'hours' && restaurant && <><h2>Opening hours</h2><p className="small muted">For {restaurant.locations[0].name}. You can set hours for other locations later.</p><HoursEditor location={restaurant.locations[0]} /></>}
            {current === 'taxResponsibility' && <><h2>Sales tax</h2><TaxForm /></>}
            {current === 'deliveryFeeRule' && <><h2>Who pays for delivery?</h2><DeliveryFeeForm /></>}
            {current === 'payouts' && restaurant && <Payouts restaurantId={restaurant.id} />}
            {current === 'done' && restaurant && <GoLive restaurant={restaurant} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Payouts({ restaurantId }: { restaurantId: string }) {
  const { reload } = usePortal();
  const { busy, run, Status } = useAction();
  return (<>
    <h2>Get paid with Stripe</h2>
    <p className="small">Customer food payments go straight to <b>your own Stripe account</b> — never to Send Koro. Stripe verifies your business, identity and bank on its secure pages.</p>
    <Status />
    <div className="row">
      <button className="btn primary" disabled={busy} onClick={() => run(async () => { const { url } = await api<{ url: string }>(`/restaurants/${restaurantId}/payouts/onboarding-link`, { method: 'POST' }); window.location.href = url; }, 'Opening Stripe…')}>Connect Stripe</button>
      <button className="btn" onClick={() => run(reload, 'Checked')}>I’ve finished on Stripe</button>
    </div>
  </>);
}

function GoLive({ restaurant }: { restaurant: Restaurant }) {
  const { reload } = usePortal();
  const router = useRouter();
  const { busy, run, Status } = useAction();
  if (restaurant.status === 'live') return <><h2>You’re live 🎉</h2><p>Customers nearby can order now. Keep this screen open on a tablet to hear new orders.</p><Link className="btn primary" href="/" style={{ alignSelf: 'flex-start' }}>Open live orders</Link></>;
  return (<>
    <h2>Ready to go live</h2>
    <p className="small">Your first month is free. After that your plan is based on last month’s food sales — from $50 a month, with $0 commission.</p>
    <p className="small muted">Next: add your menu. You can go live now and add items right after.</p>
    <Status />
    <div className="row"><button className="btn primary" disabled={busy} onClick={() => run(async () => { await api(`/restaurants/${restaurant.id}/go-live`, { method: 'POST' }); await reload(); router.push('/menu'); }, 'You’re live!')}>Go live</button><Link className="btn" href="/menu">Add menu first</Link></div>
  </>);
}

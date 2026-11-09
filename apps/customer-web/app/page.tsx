'use client';
import Link from 'next/link';
import { useState } from 'react';
import { RestaurantList } from '@/components/RestaurantList';

const CRAVINGS = ['Biryani', 'Pizza', 'Halal', 'Burgers', 'Thai', 'Sushi', 'Vegan', 'Desserts'];

export default function Home() {
  const [mode, setMode] = useState<'delivery' | 'pickup'>('delivery');
  return (
    <div className="container">
      <section className="hero">
        <span className="badge orange">Restaurants keep 100% of food sales</span>
        <h1 style={{ marginTop: 14 }}>Your favorite local food.<br /><span className="accent">Fairer</span> for everyone.</h1>
        <p>Menu prices set by the restaurant. Delivery at courier cost. Every fee shown before you pay — and 100% of your tip goes to the courier.</p>
        <div className="row" style={{ marginTop: 18, flexWrap: 'wrap' }}>
          <Link href="/search" className="btn primary">Find food</Link>
          <div className="seg"><button className={mode === 'delivery' ? 'on' : ''} onClick={() => setMode('delivery')}>Delivery</button><button className={mode === 'pickup' ? 'on' : ''} onClick={() => setMode('pickup')}>Pickup</button></div>
        </div>
        <div className="stats"><div><b>$0</b><span>commission on food</span></div><div><b>100%</b><span>of tips to couriers</span></div><div><b>NYC</b><span>boroughs</span></div></div>
      </section>

      <h2>What are you craving?</h2>
      <div className="cat-nav" style={{ marginTop: 10 }}>{CRAVINGS.map((c) => <Link key={c} className="chip" href={`/search?q=${encodeURIComponent(c)}`}>{c}</Link>)}</div>

      <div className="row between" style={{ marginTop: 28, marginBottom: 12 }}>
        <div><h2>Free delivery near you</h2><p className="small muted" style={{ margin: '4px 0 0' }}>Paid for by the restaurant — not added to your food price.</p></div>
        <Link className="link small" href="/search?offers=1">See all</Link>
      </div>
      <RestaurantList mode={mode} onlyOffers />

      <section className="promise">
        <div className="card"><h3>Real menu prices</h3><p className="small muted">Restaurants pay a flat monthly fee, not a cut of your order — so there’s no reason to mark prices up.</p></div>
        <div className="card"><h3>Tips go 100% to couriers</h3><p className="small muted">We never keep any part of your tip, and we never use it to cover fees.</p></div>
        <div className="card"><h3>Every fee, line by line</h3><p className="small muted">See food, tax, delivery and tip separately before you tap Place order. No surprises.</p></div>
      </section>

      <h2 style={{ marginBottom: 12 }}>All restaurants</h2>
      <RestaurantList mode={mode} />
    </div>
  );
}

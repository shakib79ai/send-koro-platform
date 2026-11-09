'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { RestaurantList } from '@/components/RestaurantList';

function SearchInner() {
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [mode, setMode] = useState<'delivery' | 'pickup'>('delivery');
  const [offers, setOffers] = useState(params.get('offers') === '1');
  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <h1 style={{ fontSize: 30 }}>Search</h1>
      <div className="row" style={{ margin: '14px 0', flexWrap: 'wrap' }}>
        <input className="input" style={{ maxWidth: 480 }} placeholder="Restaurant or cuisine" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        <div className="seg"><button className={mode === 'delivery' ? 'on' : ''} onClick={() => setMode('delivery')}>Delivery</button><button className={mode === 'pickup' ? 'on' : ''} onClick={() => setMode('pickup')}>Pickup</button></div>
        <button className={`chip ${offers ? 'on' : ''}`} onClick={() => setOffers(!offers)}>Free delivery deals</button>
      </div>
      <RestaurantList q={q.trim()} mode={mode} onlyOffers={offers} />
    </div>
  );
}

export default function SearchPage() { return <Suspense><SearchInner /></Suspense>; }

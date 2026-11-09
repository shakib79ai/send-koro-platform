'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { NearbyRestaurant } from '@/lib/types';
import { RestaurantCard, deliveryOffer } from './RestaurantCard';

/** Default location (Flatiron) until the customer adds an address. */
const FALLBACK = { lat: 40.7411, lng: -73.9897 };

export function useNearby(q = '') {
  const { selectedAddress } = useSession();
  const at = selectedAddress ?? FALLBACK;
  const [data, setData] = useState<NearbyRestaurant[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    setData(null);
    const t = setTimeout(() => {
      api<NearbyRestaurant[]>(`/catalog/restaurants?lat=${at.lat}&lng=${at.lng}${q ? `&q=${encodeURIComponent(q)}` : ''}`, { auth: false })
        .then((d) => live && setData(d)).catch(() => live && setError('Couldn’t load restaurants. Check your connection.'));
    }, q ? 250 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [at.lat, at.lng, q]);
  return { data, error, usingFallback: !selectedAddress };
}

export function RestaurantList({ q = '', mode, onlyOffers = false }: { q?: string; mode: 'delivery' | 'pickup'; onlyOffers?: boolean }) {
  const { data, error } = useNearby(q);
  if (error) return <div className="error">{error}</div>;
  if (!data) return <div className="grid cards">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 210 }} />)}</div>;
  const list = data.filter((r) => (mode === 'delivery' ? r.delivers : r.pickup) && (!onlyOffers || deliveryOffer(r)));
  if (!list.length) return <div className="card pad center muted">{q ? `No restaurants match “${q}”.` : 'No restaurants deliver here yet. We’re adding NYC restaurants every week.'}</div>;
  return <div className="grid cards">{list.map((r) => <RestaurantCard key={r.locationId} r={r} />)}</div>;
}

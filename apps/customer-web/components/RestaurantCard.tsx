import Link from 'next/link';
import type { NearbyRestaurant } from '@/lib/types';
import { miles, usd } from '@/lib/money';

export function deliveryOffer(r: Pick<NearbyRestaurant, 'deliveryRule'>): string | null {
  const k = r.deliveryRule?.rule?.kind;
  if (k === 'restaurant_pays') return 'Free delivery';
  if (k === 'free_above' && r.deliveryRule?.rule.minFoodCents != null) return `Free delivery on ${usd(r.deliveryRule.rule.minFoodCents)}+`;
  if (k === 'split_fixed' || k === 'split_percent') return 'Restaurant pays part of delivery';
  return null;
}

export function RestaurantCard({ r }: { r: NearbyRestaurant }) {
  const offer = deliveryOffer(r);
  const initials = r.name.split(' ').map((w) => w[0]).slice(0, 2).join('');
  return (
    <Link href={`/restaurants/${r.locationId}`} className={`card r-card ${r.open ? '' : 'closed'}`}>
      <div className="cover">
        {initials}
        {offer && <span className="badge orange tag">{offer}</span>}
        <span className="eta">{r.open ? `${r.prepMinutes + 15}–${r.prepMinutes + 30} min` : 'Closed'}</span>
      </div>
      <div className="body">
        <div className="row between"><h3>{r.name}</h3>{r.open ? (r.busy ? <span className="badge red">Busy</span> : <span className="badge green">Open</span>) : <span className="badge gray">Closed</span>}</div>
        <div className="small muted">{[r.cuisine, miles(r.distanceMeters), r.delivers ? 'Delivery' : null, r.pickup ? 'Pickup' : null].filter(Boolean).join(' · ')}</div>
      </div>
    </Link>
  );
}

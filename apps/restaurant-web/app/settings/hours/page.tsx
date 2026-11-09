'use client';
import { useState } from 'react';
import { usePortal } from '@/lib/portal';
import { HoursEditor } from '@/components/HoursEditor';

export default function Hours() {
  const { restaurant } = usePortal();
  const [id, setId] = useState<string>('');
  if (!restaurant) return null;
  const loc = restaurant.locations.find((l) => l.id === id) ?? restaurant.locations[0];
  if (!loc) return <p className="muted">Add a location first.</p>;
  return (
    <div style={{ maxWidth: 760 }}>
      <div className="page-head"><div><h1>Hours</h1><p className="small muted" style={{ margin: '4px 0 0' }}>New York time. To close for a holiday, pause the location on Live orders.</p></div>
        {restaurant.locations.length > 1 && <select className="input" style={{ width: 'auto' }} value={loc.id} onChange={(e) => setId(e.target.value)}>{restaurant.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>}</div>
      <div className="card pad"><HoursEditor key={loc.id} location={loc} /></div>
    </div>
  );
}

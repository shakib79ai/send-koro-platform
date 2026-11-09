'use client';
import { useState } from 'react';
import { usePortal, isOwner } from '@/lib/portal';
import { LocationForm } from '@/components/LocationForm';
import { percentFromPpm } from '@/components/ui';

export default function Locations() {
  const { restaurant, role } = usePortal();
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  if (!restaurant) return null;
  return (
    <div style={{ maxWidth: 820 }}>
      <div className="page-head"><div><h1>Locations & delivery area</h1><p className="small muted" style={{ margin: '4px 0 0' }}>One plan covers all your locations.</p></div>{isOwner(role) && editing !== 'new' && <button className="btn primary" onClick={() => setEditing('new')}>+ Add location</button>}</div>
      {editing === 'new' && <div className="card pad" style={{ marginBottom: 16 }}><h3 style={{ marginBottom: 12 }}>New location</h3><LocationForm onSaved={() => setEditing(null)} /></div>}
      {restaurant.locations.map((l) => (
        <div key={l.id} className="card pad" style={{ marginBottom: 12 }}>
          {editing === l.id ? <LocationForm location={l} onSaved={() => setEditing(null)} /> : (
            <div className="row between" style={{ flexWrap: 'wrap' }}>
              <div><b>{l.name}</b><div className="small muted">{l.line1}, {l.city}, {l.state} {l.postalCode}</div><div className="tiny muted">Delivers within {(l.deliveryRadiusMeters / 1609.344).toFixed(1)} mi · prep {l.prepMinutes} min · tax {percentFromPpm(l.taxRatePpm)}% · {[l.deliveryEnabled && 'delivery', l.pickupEnabled && 'pickup'].filter(Boolean).join(' & ')}</div></div>
              <button className="btn sm" onClick={() => setEditing(l.id)}>Edit</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

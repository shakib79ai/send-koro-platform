'use client';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { usePortal } from '@/lib/portal';
import type { Location } from '@/lib/types';
import { useAction } from './ui';

interface Match { line1: string; city: string; state: string; postalCode: string; lat: number; lng: number; matched: string }
const MILE = 1609.344;

export function LocationForm({ location, onSaved }: { location?: Location; onSaved?: (l: Location & { taxSuggestion?: { ratePpm: number | null; note: string } }) => void }) {
  const { restaurant, reload } = usePortal();
  const [name, setName] = useState(location?.name ?? '');
  const [phone, setPhone] = useState(location?.phone ?? '');
  const [query, setQuery] = useState(location ? `${location.line1}, ${location.city}, ${location.state} ${location.postalCode}` : '');
  const [addr, setAddr] = useState<Match | null>(location ? { line1: location.line1, city: location.city, state: location.state, postalCode: location.postalCode, lat: location.lat, lng: location.lng, matched: '' } : null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [radiusMi, setRadiusMi] = useState(location ? +(location.deliveryRadiusMeters / MILE).toFixed(1) : 3);
  const [prep, setPrep] = useState(location?.prepMinutes ?? 20);
  const [delivery, setDelivery] = useState(location?.deliveryEnabled ?? true);
  const [pickup, setPickup] = useState(location?.pickupEnabled ?? true);
  const { busy, run, Status } = useAction();
  const [lookupError, setLookupError] = useState('');
  if (!restaurant) return null;

  const lookup = async () => {
    setLookupError('');
    try { const r = await api<Match[]>(`/geocode?address=${encodeURIComponent(query)}`, { auth: false }); setMatches(r); if (r.length === 1) setAddr(r[0]); if (!r.length) setLookupError('Address not found. Include the street number, city and ZIP.'); }
    catch (e) { setLookupError(e instanceof ApiError ? e.message : 'Address lookup failed'); }
  };
  const toE164 = (p: string) => { const d = p.replace(/\D/g, ''); return d.length === 10 ? `+1${d}` : d.length === 11 && d.startsWith('1') ? `+${d}` : undefined; };

  const save = () => run(async () => {
    if (!addr) throw new ApiError(400, 'address', 'Find and confirm the store address first');
    const body = { name, phone: toE164(phone), line1: addr.line1, city: addr.city, state: addr.state, postalCode: addr.postalCode.slice(0, 5), lat: addr.lat, lng: addr.lng, deliveryRadiusMeters: Math.round(radiusMi * MILE), prepMinutes: prep, deliveryEnabled: delivery, pickupEnabled: pickup };
    const saved = location
      ? await api<Location>(`/restaurants/locations/${location.id}`, { method: 'PATCH', body })
      : await api<Location>(`/restaurants/${restaurant.id}/locations`, { body });
    await reload(); onSaved?.(saved);
  });

  return (
    <div className="stack">
      <div className="form-grid">
        <div className="field"><label htmlFor="ln">Location name</label><input id="ln" className="input" placeholder="Flatiron" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field"><label htmlFor="lp">Store phone (couriers call this)</label><input id="lp" className="input" type="tel" placeholder="(917) 555-0101" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      </div>
      <div className="field"><label htmlFor="la">Store address</label>
        <div className="row"><input id="la" className="input" value={query} onChange={(e) => { setQuery(e.target.value); setAddr(null); }} placeholder="12 W 21st St, New York, NY 10010" /><button type="button" className="btn" onClick={lookup} disabled={query.trim().length < 5}>Find</button></div>
      </div>
      {matches.length > 1 && !addr && <div className="stack" style={{ gap: 6 }}>{matches.map((m) => <button key={m.matched} type="button" className="rule" onClick={() => setAddr(m)}>{m.matched}</button>)}</div>}
      {addr && <div className="success small">✓ {addr.line1}, {addr.city}, {addr.state} {addr.postalCode}</div>}
      {lookupError && <div className="error">{lookupError}</div>}
      <div className="form-grid">
        <div className="field"><label htmlFor="lr">Delivery area (miles from the store)</label><input id="lr" className="input" type="number" step={0.5} min={0.5} max={10} value={radiusMi} onChange={(e) => setRadiusMi(Number(e.target.value))} /></div>
        <div className="field"><label htmlFor="pm">Usual prep time (minutes)</label><input id="pm" className="input" type="number" min={5} max={120} value={prep} onChange={(e) => setPrep(Number(e.target.value))} /></div>
      </div>
      <div className="row" style={{ gap: 20 }}>
        <label className="row small"><input type="checkbox" checked={delivery} onChange={(e) => setDelivery(e.target.checked)} /> Delivery</label>
        <label className="row small"><input type="checkbox" checked={pickup} onChange={(e) => setPickup(e.target.checked)} /> Pickup</label>
      </div>
      <p className="tiny muted" style={{ margin: 0 }}>Send Koro is available in New York and California for now.</p>
      <Status />
      <button className="btn primary" style={{ alignSelf: 'flex-start' }} onClick={save} disabled={busy || !name || !addr}>{location ? 'Save location' : 'Add location'}</button>
    </div>
  );
}

'use client';
/** Home / Office / Other address with a lookup that fills in coordinates (needed for delivery range and couriers). */
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { Address } from '@/lib/types';

interface Match { line1: string; city: string; state: string; postalCode: string; lat: number; lng: number; matched: string }

export interface AddressDraft { label: Address['label']; customLabel?: string; line1: string; line2?: string; city: string; state: string; postalCode: string; lat: number; lng: number; dropoffInstructions?: string; isDefault?: boolean }

export function AddressForm({ onSave, saveLabel = 'Save address', initialLabel = 'home' }: { onSave: (a: AddressDraft) => Promise<void> | void; saveLabel?: string; initialLabel?: Address['label'] }) {
  const [label, setLabel] = useState<Address['label']>(initialLabel);
  const [customLabel, setCustomLabel] = useState('');
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [picked, setPicked] = useState<Match | null>(null);
  const [line2, setLine2] = useState('');
  const [instructions, setInstructions] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const lookup = async () => {
    setError(''); setBusy(true); setPicked(null);
    try {
      const r = await api<Match[]>(`/geocode?address=${encodeURIComponent(query)}`, { auth: false });
      setMatches(r);
      if (!r.length) setError('We couldn’t find that address. Include the street number, city and ZIP.');
      if (r.length === 1) setPicked(r[0]);
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Address lookup failed'); } finally { setBusy(false); }
  };

  const save = async () => {
    if (!picked) return;
    setBusy(true); setError('');
    try {
      await onSave({ label, customLabel: label === 'other' ? customLabel || 'Other' : undefined, line1: picked.line1, line2: line2 || undefined, city: picked.city, state: picked.state, postalCode: picked.postalCode, lat: picked.lat, lng: picked.lng, dropoffInstructions: instructions || undefined });
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Could not save the address'); } finally { setBusy(false); }
  };

  return (
    <div className="stack">
      <div className="seg" role="tablist" aria-label="Address type">
        {(['home', 'office', 'other'] as const).map((l) => <button key={l} type="button" className={label === l ? 'on' : ''} onClick={() => setLabel(l)}>{l === 'home' ? 'Home' : l === 'office' ? 'Office' : 'Other'}</button>)}
      </div>
      {label === 'other' && <div className="field"><label htmlFor="cl">Name this place</label><input id="cl" className="input" placeholder="e.g. Gym, Mom’s" value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} maxLength={40} /></div>}
      <div className="field">
        <label htmlFor="q">Street address</label>
        <div className="row">
          <input id="q" className="input" placeholder="350 5th Ave, New York, NY 10118" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void lookup(); } }} />
          <button type="button" className="btn" onClick={lookup} disabled={busy || query.trim().length < 5}>Find</button>
        </div>
      </div>
      {matches.length > 1 && (
        <div className="stack" style={{ gap: 6 }}>
          {matches.map((m) => <button type="button" key={m.matched} className={`addr-opt ${picked?.matched === m.matched ? 'on' : ''}`} onClick={() => setPicked(m)}>{m.matched}</button>)}
        </div>
      )}
      {picked && (
        <>
          <div className="success small">✓ {picked.line1}, {picked.city}, {picked.state} {picked.postalCode}</div>
          <div className="field"><label htmlFor="l2">Apt, suite or floor</label><input id="l2" className="input" value={line2} onChange={(e) => setLine2(e.target.value)} placeholder="Apt 4B" /></div>
          <div className="field"><label htmlFor="ins">Note for the courier</label><input id="ins" className="input" value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Front desk, buzz 4B…" maxLength={300} /></div>
        </>
      )}
      {error && <div className="error">{error}</div>}
      <button type="button" className="btn primary block" onClick={save} disabled={!picked || busy}>{saveLabel}</button>
    </div>
  );
}

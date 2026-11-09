'use client';
/** Sales tax is the restaurant's responsibility. Send Koro never collects, files or pays it. */
import { useState } from 'react';
import { api } from '@/lib/api';
import { usePortal, isOwner } from '@/lib/portal';
import { percentFromPpm, useAction } from './ui';

export function TaxForm({ onSaved }: { onSaved?: () => void }) {
  const { restaurant, role, reload } = usePortal();
  const [rates, setRates] = useState<Record<string, string>>(() => Object.fromEntries((restaurant?.locations ?? []).map((l) => [l.id, percentFromPpm(l.taxRatePpm)])));
  const [agree, setAgree] = useState(false);
  const { busy, run, Status } = useAction();
  if (!restaurant) return null;
  const owner = isOwner(role);
  const accepted = !!restaurant.taxResponsibilityAcceptedAt;

  const save = () => run(async () => {
    for (const l of restaurant.locations) {
      const ppm = Math.round(parseFloat(rates[l.id] || '0') * 10_000);
      if (ppm !== l.taxRatePpm) await api(`/restaurants/locations/${l.id}/tax-rate`, { method: 'PUT', body: { taxRatePpm: ppm } });
    }
    if (!accepted && agree) await api(`/restaurants/${restaurant.id}/tax-responsibility`, { method: 'POST' });
    await reload(); onSaved?.();
  });

  return (
    <div className="stack">
      <div className="note">You set your sales tax rate and you report and pay it to the state. The tax goes to your Stripe account with the food payment. <b>Send Koro never collects, files or pays sales tax.</b></div>
      {restaurant.locations.map((l) => (
        <div key={l.id} className="row between" style={{ flexWrap: 'wrap' }}>
          <div><b>{l.name}</b><div className="small muted">{l.line1}, {l.city}, {l.state} {l.postalCode}</div></div>
          <div className="row" style={{ gap: 6 }}><input className="input" style={{ width: 110 }} inputMode="decimal" disabled={!owner} value={rates[l.id] ?? ''} onChange={(e) => setRates({ ...rates, [l.id]: e.target.value.replace(/[^\d.]/g, '') })} /><span className="muted">%</span></div>
        </div>
      ))}
      {restaurant.locations.some((l) => l.state === 'NY') && <p className="tiny muted" style={{ margin: 0 }}>New York City combined rate is 8.875%. Check yours at tax.ny.gov.</p>}
      {accepted ? (
        <div className="success small">✓ You accepted responsibility for sales tax on {new Date(restaurant.taxResponsibilityAcceptedAt!).toLocaleDateString()}.</div>
      ) : (
        <label className="rule" style={{ cursor: owner ? 'pointer' : 'default' }}>
          <input type="checkbox" checked={agree} disabled={!owner} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 3 }} />
          <span><b>I’m responsible for charging, reporting and paying sales tax.</b><span className="small muted" style={{ display: 'block' }}>Required before you can take orders. Only an owner can accept.</span></span>
        </label>
      )}
      <Status />
      {owner && <button className="btn primary" style={{ alignSelf: 'flex-start' }} onClick={save} disabled={busy || (!accepted && !agree)}>Save</button>}
    </div>
  );
}

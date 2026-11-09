'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { usePortal, isOwner } from '@/lib/portal';
import { usd } from '@/lib/money';
import type { Fee } from '@/lib/types';
import { TaxForm } from '@/components/TaxForm';
import { MoneyInput, useAction } from '@/components/ui';

const KINDS: { kind: Fee['kind']; label: string; help: string }[] = [
  { kind: 'service_charge', label: 'Service charge', help: 'Taxable in New York.' },
  { kind: 'mandatory_gratuity', label: 'Mandatory gratuity', help: 'Untaxed only if it’s listed separately, labelled “gratuity”, and paid 100% to staff.' },
  { kind: 'packaging_fee', label: 'Packaging fee', help: 'For containers and bags.' },
  { kind: 'large_order_fee', label: 'Large-order fee', help: 'Only on orders over an amount you set.' },
];

export default function Taxes() {
  const { restaurant, role, reload } = usePortal();
  const [draft, setDraft] = useState<{ kind: Fee['kind']; label: string; ratePct: string; fixedCents: number | null; minFoodCents: number | null; taxable: boolean } | null>(null);
  const { busy, run, Status } = useAction();
  if (!restaurant) return null;
  const owner = isOwner(role);
  const fees = restaurant.fees.filter((f) => f.active);

  const save = () => draft && run(async () => {
    await api(`/restaurants/${restaurant.id}/fees`, { body: { kind: draft.kind, label: draft.label, rateBps: draft.ratePct ? Math.round(parseFloat(draft.ratePct) * 100) : null, fixedCents: draft.fixedCents, minFoodCents: draft.minFoodCents, taxable: draft.kind === 'service_charge' ? true : draft.taxable } });
    setDraft(null); await reload();
  }, 'Fee added');

  return (
    <div style={{ maxWidth: 820 }}>
      <div className="page-head"><div><h1>Taxes & fees</h1><p className="small muted" style={{ margin: '4px 0 0' }}>Your tax rate, your responsibility. Fees you add are shown on your menu and in the cart before payment.</p></div></div>
      <div className="card pad" style={{ marginBottom: 16 }}><h3 style={{ marginBottom: 12 }}>Sales tax</h3><TaxForm /></div>
      <div className="card pad stack">
        <div className="row between"><h3>Service charges & extra fees</h3>{owner && !draft && <button className="btn sm" onClick={() => setDraft({ kind: 'service_charge', label: 'Service charge', ratePct: '', fixedCents: null, minFoodCents: null, taxable: true })}>+ Add fee</button>}</div>
        {!fees.length && !draft && <p className="small muted">No extra fees. Customers pay your menu prices, tax, and delivery (if you choose).</p>}
        {fees.map((f) => (
          <div key={f.id} className="row between" style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
            <div><b>{f.label}</b> <span className="small muted">· {[f.rateBps ? `${f.rateBps / 100}% of food` : null, f.fixedCents ? usd(f.fixedCents) : null].filter(Boolean).join(' + ')}{f.minFoodCents ? ` · orders over ${usd(f.minFoodCents)}` : ''} · {f.taxable ? 'taxed' : 'not taxed'}</span></div>
            {owner && <button className="btn sm" onClick={() => run(async () => { await api(`/restaurants/fees/${f.id}`, { method: 'DELETE' }); await reload(); }, 'Fee removed')}>Remove</button>}
          </div>
        ))}
        {draft && (
          <div className="card" style={{ padding: 14 }}>
            <div className="form-grid">
              <div className="field"><label>Type</label><select className="input" value={draft.kind} onChange={(e) => { const k = e.target.value as Fee['kind']; setDraft({ ...draft, kind: k, label: KINDS.find((x) => x.kind === k)!.label, taxable: k !== 'mandatory_gratuity' }); }}>{KINDS.map((k) => <option key={k.kind} value={k.kind}>{k.label}</option>)}</select></div>
              <div className="field"><label>Label customers see</label><input className="input" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} /></div>
              <div className="field"><label>Percent of food (optional)</label><input className="input" inputMode="decimal" value={draft.ratePct} onChange={(e) => setDraft({ ...draft, ratePct: e.target.value.replace(/[^\d.]/g, '') })} placeholder="e.g. 10" /></div>
              <div className="field"><label>Fixed amount (optional)</label><MoneyInput cents={draft.fixedCents} onChange={(c) => setDraft({ ...draft, fixedCents: c })} /></div>
              {draft.kind === 'large_order_fee' && <div className="field"><label>Only on orders over</label><MoneyInput cents={draft.minFoodCents} onChange={(c) => setDraft({ ...draft, minFoodCents: c })} /></div>}
            </div>
            <p className="tiny muted">{KINDS.find((k) => k.kind === draft.kind)!.help}</p>
            {draft.kind === 'mandatory_gratuity' && <label className="row small"><input type="checkbox" checked={!draft.taxable} onChange={(e) => setDraft({ ...draft, taxable: !e.target.checked })} /> 100% of this gratuity is paid to staff (so it isn’t taxed)</label>}
            <Status />
            <div className="row" style={{ marginTop: 10 }}><button className="btn primary" onClick={save} disabled={busy || !draft.label || (!draft.ratePct && !draft.fixedCents)}>Add fee</button><button className="btn" onClick={() => setDraft(null)}>Cancel</button></div>
          </div>
        )}
        {!draft && <Status />}
      </div>
    </div>
  );
}

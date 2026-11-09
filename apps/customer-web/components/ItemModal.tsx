'use client';
import { useMemo, useState } from 'react';
import type { MenuItem } from '@/lib/types';
import { usd } from '@/lib/money';

export function ItemModal({ item, onAdd, onClose }: { item: MenuItem; onAdd: (quantity: number, optionIds: string[], optionNames: string[], unitCents: number, note?: string) => void; onClose: () => void }) {
  const [qty, setQty] = useState(1);
  const [picked, setPicked] = useState<Record<string, string[]>>(() => Object.fromEntries(item.groups.map((g) => [g.id, g.minSelect === 1 && g.maxSelect === 1 && g.options[0]?.available ? [g.options[0].id] : []])));
  const [note, setNote] = useState('');

  const toggle = (groupId: string, optionId: string, single: boolean, max: number) => setPicked((p) => {
    const cur = p[groupId] ?? [];
    if (single) return { ...p, [groupId]: [optionId] };
    if (cur.includes(optionId)) return { ...p, [groupId]: cur.filter((x) => x !== optionId) };
    if (cur.length >= max) return p;
    return { ...p, [groupId]: [...cur, optionId] };
  });

  const { unit, valid, names, ids } = useMemo(() => {
    let unit = item.priceCents; const names: string[] = []; const ids: string[] = []; let valid = true;
    for (const g of item.groups) {
      const sel = picked[g.id] ?? [];
      if (sel.length < g.minSelect || sel.length > g.maxSelect) valid = false;
      for (const o of g.options.filter((o) => sel.includes(o.id))) { unit += o.priceCents; names.push(o.name); ids.push(o.id); }
    }
    return { unit, valid, names, ids };
  }, [item, picked]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={item.name}>
        <div className="hd">
          {item.imageUrl && <img src={item.imageUrl} alt="" style={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: 12, marginBottom: 12 }} />}
          <div className="row between"><h2>{item.name}</h2><button className="btn sm" onClick={onClose}>Close</button></div>
          {item.description && <p className="muted small">{item.description}</p>}
          {(item.allergens.length > 0 || item.dietary.length > 0) && (
            <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
              {item.dietary.map((d) => <span key={d} className="badge green">{d}</span>)}
              {item.allergens.map((a) => <span key={a} className="badge gray">Contains {a}</span>)}
            </div>
          )}
        </div>
        <div className="bd stack">
          {item.groups.map((g) => {
            const single = g.maxSelect === 1;
            return (
              <div key={g.id}>
                <div className="row between"><h3>{g.name}</h3><span className="tiny muted">{g.minSelect > 0 ? `Required · choose ${g.minSelect === g.maxSelect ? g.minSelect : `${g.minSelect}–${g.maxSelect}`}` : `Optional · up to ${g.maxSelect}`}</span></div>
                {g.options.map((o) => (
                  <label key={o.id} className="opt" style={{ opacity: o.available ? 1 : 0.5 }}>
                    <input type={single ? 'radio' : 'checkbox'} name={g.id} disabled={!o.available} checked={(picked[g.id] ?? []).includes(o.id)} onChange={() => toggle(g.id, o.id, single, g.maxSelect)} />
                    <span className="spacer">{o.name}{!o.available && ' (unavailable)'}</span>
                    {o.priceCents > 0 && <span className="small muted">+{usd(o.priceCents)}</span>}
                  </label>
                ))}
              </div>
            );
          })}
          <div className="field"><label htmlFor="note">Special instructions</label><input id="note" className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="No onions, extra spicy…" /></div>
        </div>
        <div className="ft row">
          <div className="qty"><button onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Fewer">−</button><span>{qty}</span><button onClick={() => setQty(Math.min(50, qty + 1))} aria-label="More">+</button></div>
          <button className="btn primary spacer" disabled={!valid} onClick={() => onAdd(qty, ids, names, unit, note || undefined)}>Add {qty} to cart · {usd(unit * qty)}</button>
        </div>
      </div>
    </div>
  );
}

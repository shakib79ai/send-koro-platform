'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { usePortal, canManage } from '@/lib/portal';
import { usd } from '@/lib/money';
import type { Menu, MenuItem } from '@/lib/types';
import { MoneyInput, Switch, useAction } from '@/components/ui';

interface GroupDraft { name: string; minSelect: number; maxSelect: number; options: { name: string; priceCents: number }[] }
interface ItemDraft { id?: string; categoryId: string | null; name: string; description: string; priceCents: number; allergens: string; dietary: string; taxable: boolean; imageUrl: string; groups: GroupDraft[] }

const blank = (categoryId: string | null): ItemDraft => ({ categoryId, name: '', description: '', priceCents: 0, allergens: '', dietary: '', taxable: true, imageUrl: '', groups: [] });
const toDraft = (i: MenuItem): ItemDraft => ({
  id: i.id, categoryId: i.categoryId, name: i.name, description: i.description ?? '', priceCents: i.priceCents, allergens: i.allergens.join(', '), dietary: i.dietary.join(', '),
  taxable: i.taxable, imageUrl: i.imageUrl ?? '', groups: i.groups.map((g) => ({ name: g.name, minSelect: g.minSelect, maxSelect: g.maxSelect, options: g.options.map((o) => ({ name: o.name, priceCents: o.priceCents })) })),
});

export default function MenuPage() {
  const { restaurant, role } = usePortal();
  const [menu, setMenu] = useState<Menu | null>(null);
  const [editing, setEditing] = useState<ItemDraft | null>(null);
  const [newCat, setNewCat] = useState('');
  const { run, Status } = useAction();
  const manager = canManage(role);

  const load = useCallback(async () => { if (restaurant) setMenu(await api<Menu>(`/restaurants/${restaurant.id}/menu`)); }, [restaurant]);
  useEffect(() => { void load(); }, [load]);
  if (!restaurant) return null;

  const soldOut = (i: MenuItem) => !i.available || (!!i.soldOutUntil && new Date(i.soldOutUntil) > new Date());
  const setAvailability = (i: MenuItem, available: boolean, minutes?: number) => run(async () => {
    await api(`/restaurants/menu/items/${i.id}/availability`, { method: 'PATCH', body: { available, soldOutMinutes: minutes ?? null } }); await load();
  }, available ? `${i.name} is back on` : `${i.name} marked sold out`);
  const sections = [...(menu?.categories ?? []), ...(menu?.uncategorized.length ? [{ id: '', name: 'No category', sortOrder: 999, items: menu.uncategorized }] : [])];

  return (
    <div>
      <div className="page-head">
        <div><h1>Menu</h1><p className="small muted" style={{ margin: '4px 0 0' }}>Your prices are the prices customers pay — no markup needed with $0 commission.</p></div>
        {manager && <button className="btn primary" onClick={() => setEditing(blank(menu?.categories[0]?.id ?? null))}>+ Add item</button>}
      </div>
      <Status />
      {manager && (
        <div className="row" style={{ marginBottom: 16, maxWidth: 480 }}>
          <input className="input" placeholder="New category, e.g. Mains" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
          <button className="btn" disabled={!newCat.trim()} onClick={() => run(async () => { await api(`/restaurants/${restaurant.id}/menu/categories`, { body: { name: newCat.trim(), sortOrder: (menu?.categories.length ?? 0) + 1 } }); setNewCat(''); await load(); }, 'Category added')}>Add category</button>
        </div>
      )}
      {!menu ? <div className="skeleton" style={{ height: 200 }} /> : !sections.length ? <div className="card pad muted center">No items yet. Add your first dish.</div> : sections.map((c) => (
        <div key={c.id || 'none'} className="card" style={{ marginBottom: 16 }}>
          <div className="row between" style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}><h3>{c.name}</h3>{manager && c.id && <button className="btn sm" onClick={() => setEditing(blank(c.id))}>+ Item</button>}</div>
          <table className="t">
            <tbody>
              {c.items.map((i) => (
                <tr key={i.id}>
                  <td><b>{i.name}</b>{i.groups.length > 0 && <span className="tiny muted"> · {i.groups.map((g) => g.name).join(', ')}</span>}{i.description && <div className="tiny muted">{i.description}</div>}</td>
                  <td style={{ width: 100 }}>{usd(i.priceCents)}</td>
                  <td style={{ width: 230 }}>
                    <div className="row">
                      <Switch on={!soldOut(i)} label={`${i.name} available`} onChange={(v) => setAvailability(i, v)} />
                      <span className="small">{soldOut(i) ? (i.soldOutUntil && new Date(i.soldOutUntil) > new Date() ? `Sold out until ${new Date(i.soldOutUntil).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Sold out') : 'Available'}</span>
                      {!soldOut(i) && <button className="btn sm" onClick={() => setAvailability(i, false, 240)} title="Back automatically in 4 hours">4h</button>}
                    </div>
                  </td>
                  <td style={{ width: 80 }}>{manager && <button className="btn sm" onClick={() => setEditing(toDraft(i))}>Edit</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {editing && menu && <ItemEditor draft={editing} categories={menu.categories} restaurantId={restaurant.id} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} />}
    </div>
  );
}

function ItemEditor({ draft, categories, restaurantId, onClose, onSaved }: { draft: ItemDraft; categories: Menu['categories']; restaurantId: string; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<ItemDraft>(draft);
  const { busy, run, Status } = useAction();
  const set = (p: Partial<ItemDraft>) => setD({ ...d, ...p });
  const setGroup = (gi: number, p: Partial<GroupDraft>) => set({ groups: d.groups.map((g, i) => (i === gi ? { ...g, ...p } : g)) });
  const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

  const save = () => run(async () => {
    const body = { categoryId: d.categoryId, name: d.name, description: d.description || undefined, priceCents: d.priceCents, allergens: list(d.allergens), dietary: list(d.dietary), taxable: d.taxable, imageUrl: d.imageUrl || undefined,
      groups: d.groups.map((g) => ({ ...g, options: g.options.filter((o) => o.name.trim()) })).filter((g) => g.name.trim() && g.options.length) };
    if (d.id) await api(`/restaurants/menu/items/${d.id}`, { method: 'PATCH', body }); else await api(`/restaurants/${restaurantId}/menu/items`, { body });
    onSaved();
  });
  const remove = () => run(async () => { if (d.id && confirm(`Remove ${d.name} from the menu?`)) { await api(`/restaurants/menu/items/${d.id}`, { method: 'DELETE' }); onSaved(); } });

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <div className="hd row between"><h2>{d.id ? 'Edit item' : 'New item'}</h2><button className="btn sm" onClick={onClose}>Close</button></div>
        <div className="bd stack">
          <div className="form-grid">
            <div className="field"><label>Name</label><input className="input" value={d.name} onChange={(e) => set({ name: e.target.value })} /></div>
            <div className="field"><label>Price</label><MoneyInput cents={d.priceCents} onChange={(c) => set({ priceCents: c ?? 0 })} /></div>
          </div>
          <div className="field"><label>Description</label><textarea className="input" rows={2} value={d.description} onChange={(e) => set({ description: e.target.value })} /></div>
          <div className="form-grid">
            <div className="field"><label>Category</label><select className="input" value={d.categoryId ?? ''} onChange={(e) => set({ categoryId: e.target.value || null })}><option value="">No category</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div className="field"><label>Photo URL (optional)</label><input className="input" value={d.imageUrl} onChange={(e) => set({ imageUrl: e.target.value })} placeholder="https://…" /></div>
          </div>
          <div className="form-grid">
            <div className="field"><label>Allergens (comma separated)</label><input className="input" value={d.allergens} onChange={(e) => set({ allergens: e.target.value })} placeholder="dairy, nuts" /></div>
            <div className="field"><label>Dietary labels</label><input className="input" value={d.dietary} onChange={(e) => set({ dietary: e.target.value })} placeholder="vegetarian, halal" /></div>
          </div>
          <label className="row small"><input type="checkbox" checked={d.taxable} onChange={(e) => set({ taxable: e.target.checked })} /> Charge sales tax on this item (uses your rate)</label>
          <div className="row between"><h3>Options</h3><button className="btn sm" onClick={() => set({ groups: [...d.groups, { name: '', minSelect: 0, maxSelect: 1, options: [{ name: '', priceCents: 0 }] }] })}>+ Option group</button></div>
          {d.groups.map((g, gi) => (
            <div key={gi} className="card" style={{ padding: 12 }}>
              <div className="form-grid">
                <div className="field"><label>Group name</label><input className="input" value={g.name} onChange={(e) => setGroup(gi, { name: e.target.value })} placeholder="Spice level" /></div>
                <div className="row">
                  <div className="field"><label>Min</label><input className="input" type="number" min={0} value={g.minSelect} onChange={(e) => setGroup(gi, { minSelect: Number(e.target.value) })} /></div>
                  <div className="field"><label>Max</label><input className="input" type="number" min={1} value={g.maxSelect} onChange={(e) => setGroup(gi, { maxSelect: Number(e.target.value) })} /></div>
                </div>
              </div>
              {g.options.map((o, oi) => (
                <div key={oi} className="row" style={{ marginTop: 8 }}>
                  <input className="input" value={o.name} placeholder="Option" onChange={(e) => setGroup(gi, { options: g.options.map((x, k) => (k === oi ? { ...x, name: e.target.value } : x)) })} />
                  <div style={{ width: 150 }}><MoneyInput cents={o.priceCents} onChange={(c) => setGroup(gi, { options: g.options.map((x, k) => (k === oi ? { ...x, priceCents: c ?? 0 } : x)) })} /></div>
                  <button className="btn sm" onClick={() => setGroup(gi, { options: g.options.filter((_, k) => k !== oi) })}>✕</button>
                </div>
              ))}
              <div className="row" style={{ marginTop: 8 }}><button className="btn sm" onClick={() => setGroup(gi, { options: [...g.options, { name: '', priceCents: 0 }] })}>+ Option</button><span className="spacer" /><button className="link small" onClick={() => set({ groups: d.groups.filter((_, k) => k !== gi) })}>Remove group</button></div>
              <p className="tiny muted" style={{ margin: '6px 0 0' }}>Min 1 makes it required (e.g. choose a size). Max is how many a customer can pick.</p>
            </div>
          ))}
          <Status />
        </div>
        <div className="ft row">{d.id && <button className="btn" onClick={remove}>Remove</button>}<span className="spacer" /><button className="btn primary" onClick={save} disabled={busy || !d.name.trim()}>Save item</button></div>
      </div>
    </div>
  );
}

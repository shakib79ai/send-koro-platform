'use client';
/**
 * "Who pays for delivery" — the restaurant's choice, saved as a new versioned consent in the payments
 * service each time it changes. The customer sees one "Delivery fee" line and any discount below it.
 */
import { useState } from 'react';
import { api } from '@/lib/api';
import { usePortal, isOwner } from '@/lib/portal';
import { usd } from '@/lib/money';
import type { DeliveryRule } from '@/lib/types';
import { MoneyInput, useAction } from './ui';

const EXAMPLE_FEE = 780; // average Uber Direct quote in NYC

function customerPays(rule: DeliveryRule, fee: number, food: number, cap?: number | null) {
  let r = 0;
  if (rule.kind === 'restaurant_pays') r = fee;
  if (rule.kind === 'split_fixed') r = Math.min(fee, rule.restaurantCents);
  if (rule.kind === 'split_percent') r = Math.floor((fee * rule.restaurantBps) / 10000);
  if (rule.kind === 'free_above') r = food >= rule.minFoodCents ? fee : Math.min(fee, rule.belowRestaurantCents ?? 0);
  if (cap != null) r = Math.min(r, cap);
  return { restaurant: r, customer: fee - r };
}

export function DeliveryFeeForm({ onSaved }: { onSaved?: () => void }) {
  const { restaurant, role, reload } = usePortal();
  const current = restaurant?.deliveryRule;
  const [rule, setRule] = useState<DeliveryRule>(current?.rule ?? { kind: 'customer_pays' });
  const [cap, setCap] = useState<number | null>(current?.perOrderCapCents ?? null);
  const [budget, setBudget] = useState<number | null>(current?.monthlyBudgetCents ?? null);
  const { busy, run, Status } = useAction();
  if (!restaurant) return null;
  const owner = isOwner(role);

  const options: { kind: DeliveryRule['kind']; title: string; sub: string }[] = [
    { kind: 'customer_pays', title: 'Customer pays delivery', sub: 'The customer pays the full delivery fee.' },
    { kind: 'restaurant_pays', title: 'Free delivery (you pay)', sub: 'You pay the whole delivery fee on every order.' },
    { kind: 'split_fixed', title: 'You pay a fixed amount', sub: 'You cover up to a set amount; the customer pays the rest.' },
    { kind: 'split_percent', title: 'You pay a percentage', sub: 'You cover a share of the fee; the customer pays the rest.' },
    { kind: 'free_above', title: 'Free above an order amount', sub: 'Free delivery when food is over an amount, with optional help below it.' },
  ];
  const pick = (k: DeliveryRule['kind']) => setRule(
    k === 'split_fixed' ? { kind: k, restaurantCents: 300 } : k === 'split_percent' ? { kind: k, restaurantBps: 5000 } : k === 'free_above' ? { kind: k, minFoodCents: 3500, belowRestaurantCents: 0 } : { kind: k },
  );
  const ex = customerPays(rule, EXAMPLE_FEE, 3000, cap);

  const save = () => run(async () => {
    await api(`/restaurants/${restaurant.id}/delivery-fee`, { method: 'PUT', body: { rule, perOrderCapCents: cap, monthlyBudgetCents: budget } });
    await reload(); onSaved?.();
  }, 'Saved. New orders use this rule from now on.');

  return (
    <div className="stack">
      {!owner && <div className="note">Only an owner can change who pays for delivery.</div>}
      <div className="stack" style={{ gap: 8 }}>
        {options.map((o) => (
          <button key={o.kind} type="button" disabled={!owner} className={`rule ${rule.kind === o.kind ? 'on' : ''}`} onClick={() => pick(o.kind)}>
            <input type="radio" readOnly checked={rule.kind === o.kind} style={{ accentColor: 'var(--orange)', marginTop: 3 }} />
            <div><div className="bold">{o.title}</div><div className="small muted">{o.sub}</div></div>
          </button>
        ))}
      </div>
      {rule.kind === 'split_fixed' && <div className="field"><label>You pay up to</label><MoneyInput cents={rule.restaurantCents} onChange={(c) => setRule({ kind: 'split_fixed', restaurantCents: c ?? 0 })} /></div>}
      {rule.kind === 'split_percent' && (
        <div className="field"><label>You pay (% of the delivery fee)</label>
          <input className="input" type="number" min={0} max={100} value={rule.restaurantBps / 100} onChange={(e) => setRule({ kind: 'split_percent', restaurantBps: Math.round(Math.min(100, Math.max(0, Number(e.target.value))) * 100) })} /></div>
      )}
      {rule.kind === 'free_above' && (
        <div className="form-grid">
          <div className="field"><label>Free when food is at least</label><MoneyInput cents={rule.minFoodCents} onChange={(c) => setRule({ ...rule, minFoodCents: c ?? 0 })} /></div>
          <div className="field"><label>Below that, you pay up to</label><MoneyInput cents={rule.belowRestaurantCents ?? 0} onChange={(c) => setRule({ ...rule, belowRestaurantCents: c ?? 0 })} /></div>
        </div>
      )}
      {rule.kind !== 'customer_pays' && (
        <div className="form-grid">
          <div className="field"><label>Most you pay on one order (optional)</label><MoneyInput cents={cap} onChange={setCap} placeholder="No limit" /></div>
          <div className="field"><label>Monthly delivery budget (optional)</label><MoneyInput cents={budget} onChange={setBudget} placeholder="No budget" /><span className="tiny muted">After the budget is used, customers pay delivery until next month.</span></div>
        </div>
      )}
      <div className="note">
        <b>Example:</b> {usd(3000)} order with a {usd(EXAMPLE_FEE)} delivery fee → customer pays <b>{usd(ex.customer)}</b>, you pay <b>{usd(ex.restaurant)}</b>.
        Customers see one “Delivery fee” line{ex.restaurant ? <> and “{ex.restaurant >= EXAMPLE_FEE ? `Free delivery from ${restaurant.name}` : `${restaurant.name} pays part`}”</> : null}. The courier company is never named.
      </div>
      {restaurant.deliveryRuleVersion != null && <p className="tiny muted" style={{ margin: 0 }}>Current rule: version {restaurant.deliveryRuleVersion}. Every change is recorded with who made it and when.</p>}
      <Status />
      {owner && <button className="btn primary" style={{ alignSelf: 'flex-start' }} onClick={save} disabled={busy}>Save delivery rule</button>}
    </div>
  );
}

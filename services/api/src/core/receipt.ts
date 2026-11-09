/**
 * Customer receipt lines. Never names the courier company (rule 4) and never has a card
 * processing line (rule 5). The total must equal the payments service's Q exactly.
 */
import type { Cents } from './money';
import type { PricedCart } from './cart';

export interface PaymentsAllocation { F: Cents; S: Cents; X: Cents; D: Cents; C: Cents; R: Cents; T: Cents; Q: Cents }
export interface ReceiptLine { label: string; amountCents: Cents; kind: 'food' | 'fee' | 'tax' | 'delivery' | 'delivery_discount' | 'tip' }

export function buildReceipt(cart: PricedCart, a: PaymentsAllocation, restaurantName: string) {
  if (a.F !== cart.foodCents || a.S !== cart.serviceChargeCents || a.X !== cart.taxCents) {
    throw new Error('Receipt mismatch: cart and payments allocation disagree');
  }
  const lines: ReceiptLine[] = [{ label: 'Subtotal', amountCents: a.F, kind: 'food' }];
  for (const f of cart.fees) lines.push({ label: f.label, amountCents: f.amountCents, kind: 'fee' });
  if (a.X) lines.push({ label: 'Sales tax', amountCents: a.X, kind: 'tax' });
  if (a.D) {
    lines.push({ label: 'Delivery fee', amountCents: a.D, kind: 'delivery' });
    if (a.R) lines.push({ label: a.R >= a.D ? `Free delivery from ${restaurantName}` : `${restaurantName} pays part`, amountCents: -a.R, kind: 'delivery_discount' });
  }
  if (a.T) lines.push({ label: 'Courier tip', amountCents: a.T, kind: 'tip' });
  const total = lines.reduce((s, l) => s + l.amountCents, 0);
  if (total !== a.Q) throw new Error(`Receipt total ${total} ≠ charged total ${a.Q}`);
  return { lines, totalCents: a.Q, taxNote: `Sales tax is set and paid by ${restaurantName}.` };
}

/**
 * Cart pricing: items + modifiers → food subtotal F, restaurant fees → S, restaurant-set tax → X.
 * Send Koro never collects or remits tax: X is computed from the RESTAURANT'S rate and paid to the
 * restaurant with the food (CLAUDE.md rule 7). Customers never pay a card processing fee (rule 5).
 *
 * Example ($ in cents): 2 × Chicken Biryani 1450 + raita 150 → F = 2·(1450+150) = 3200.
 *   Service charge 10% (taxable) = 320. Tax 8.875% on 3200 + 320 = 3520 → 312. S = 320, X = 312.
 */
import { assertCents, Cents, percentOf, ppmOf } from './money';

export interface MenuItemForPricing {
  id: string; name: string; priceCents: Cents; taxable: boolean; available: boolean; soldOutUntil?: Date | null;
  groups: { id: string; name: string; minSelect: number; maxSelect: number; options: { id: string; name: string; priceCents: Cents; available: boolean }[] }[];
}
export interface CartLineInput { itemId: string; quantity: number; optionIds?: string[]; note?: string }
export interface FeeForPricing {
  id: string; kind: 'service_charge' | 'mandatory_gratuity' | 'packaging_fee' | 'large_order_fee';
  label: string; rateBps?: number | null; fixedCents?: Cents | null; minFoodCents?: Cents | null; taxable: boolean;
}

export interface PricedLine {
  itemId: string; name: string; quantity: number; unitCents: Cents; lineCents: Cents; taxable: boolean;
  options: { id: string; group: string; name: string; priceCents: Cents }[]; note?: string;
}
export interface PricedCart {
  lines: PricedLine[];
  foodCents: Cents;
  fees: { id: string; kind: FeeForPricing['kind']; label: string; amountCents: Cents; taxable: boolean }[];
  serviceChargeCents: Cents; // S: all restaurant fees together (payments sees one S)
  taxableBaseCents: Cents;
  taxRatePpm: number;
  taxCents: Cents; // X
}

export class CartError extends Error {
  constructor(public readonly code: 'empty_cart' | 'unknown_item' | 'unavailable' | 'bad_options' | 'bad_quantity', message: string) { super(message); }
}

export function priceCart(input: { lines: CartLineInput[]; menu: Map<string, MenuItemForPricing>; fees: FeeForPricing[]; taxRatePpm: number; now?: Date }): PricedCart {
  const now = input.now ?? new Date();
  if (!input.lines.length) throw new CartError('empty_cart', 'Your cart is empty');
  const lines: PricedLine[] = input.lines.map((l) => {
    if (!Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > 50) throw new CartError('bad_quantity', 'Quantity must be 1–50');
    const item = input.menu.get(l.itemId);
    if (!item) throw new CartError('unknown_item', 'An item in your cart is no longer on the menu');
    if (!item.available || (item.soldOutUntil && item.soldOutUntil > now)) throw new CartError('unavailable', `${item.name} is sold out`);
    const chosen = new Set(l.optionIds ?? []);
    const options: PricedLine['options'] = [];
    for (const g of item.groups) {
      const picked = g.options.filter((o) => chosen.has(o.id));
      if (picked.length < g.minSelect || picked.length > g.maxSelect) throw new CartError('bad_options', `Choose ${g.minSelect === g.maxSelect ? g.minSelect : `${g.minSelect}–${g.maxSelect}`} for ${g.name}`);
      for (const o of picked) {
        if (!o.available) throw new CartError('unavailable', `${o.name} is unavailable`);
        options.push({ id: o.id, group: g.name, name: o.name, priceCents: assertCents(o.priceCents) });
        chosen.delete(o.id);
      }
    }
    if (chosen.size) throw new CartError('bad_options', `Unknown option for ${item.name}`);
    const unit = assertCents(item.priceCents) + options.reduce((a, o) => a + o.priceCents, 0);
    return { itemId: item.id, name: item.name, quantity: l.quantity, unitCents: unit, lineCents: unit * l.quantity, taxable: item.taxable, options, note: l.note };
  });
  const foodCents = lines.reduce((a, l) => a + l.lineCents, 0);
  const taxableFood = lines.filter((l) => l.taxable).reduce((a, l) => a + l.lineCents, 0);

  const fees = input.fees
    .filter((f) => f.minFoodCents == null || foodCents >= f.minFoodCents)
    .map((f) => {
      // NY: a mandatory gratuity is untaxed only if separately stated, labelled a gratuity and paid
      // 100% to staff — the restaurant attests that via `taxable: false`. A service charge is taxable.
      const taxable = f.kind === 'service_charge' ? true : f.taxable;
      const amount = (f.rateBps ? percentOf(foodCents, f.rateBps) : 0) + (f.fixedCents ? assertCents(f.fixedCents) : 0);
      return { id: f.id, kind: f.kind, label: f.label, amountCents: amount, taxable };
    })
    .filter((f) => f.amountCents > 0);
  const serviceChargeCents = fees.reduce((a, f) => a + f.amountCents, 0);
  const taxableBaseCents = taxableFood + fees.filter((f) => f.taxable).reduce((a, f) => a + f.amountCents, 0);
  const taxCents = ppmOf(taxableBaseCents, input.taxRatePpm);
  return { lines, foodCents, fees, serviceChargeCents, taxableBaseCents, taxRatePpm: input.taxRatePpm, taxCents };
}

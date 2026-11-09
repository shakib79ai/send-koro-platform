/** Integer-cent helpers. The only rounding is half-up on basis-point percentages. */
export type Cents = number;

export function assertCents(n: number, label = 'amount'): Cents {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`${label} must be whole cents ≥ 0 (got ${n})`);
  return n;
}

/** amount × bps / 10 000, rounded half-up. 8.875% of $10.00 = 89¢. */
export function percentOf(amountCents: Cents, bps: number): Cents {
  assertCents(amountCents);
  if (!Number.isInteger(bps) || bps < 0) throw new Error('bps must be a whole number ≥ 0');
  return Math.floor((amountCents * bps + 5000) / 10000);
}

/** Splits `total` across `weights` so the parts always add up exactly (largest remainder). */
export function splitProportionally(total: Cents, weights: number[]): Cents[] {
  assertCents(total);
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!weights.length) return [];
  if (sum <= 0) {
    const base = Math.floor(total / weights.length);
    return weights.map((_, i) => base + (i < total - base * weights.length ? 1 : 0));
  }
  const raw = weights.map((w) => (total * w) / sum);
  const parts = raw.map(Math.floor);
  let left = total - parts.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (const [, i] of order) { if (left <= 0) break; parts[i] += 1; left -= 1; }
  return parts;
}

/** amount × ppm / 1 000 000, rounded half-up. Used for tax rates like 8.875% (88 750 ppm). */
export function ppmOf(amountCents: Cents, ppm: number): Cents {
  assertCents(amountCents);
  if (!Number.isInteger(ppm) || ppm < 0 || ppm > 1_000_000) throw new Error('ppm must be a whole number 0–1 000 000');
  return Math.floor((amountCents * ppm + 500_000) / 1_000_000);
}

export const formatUsd = (c: Cents) => `${c < 0 ? '−' : ''}$${(Math.abs(c) / 100).toFixed(2)}`;

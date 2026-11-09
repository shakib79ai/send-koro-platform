/** Restaurant plan bands (BUSINESS_MODEL.md). Display copy only — billing is computed by the payments service. */
export const BANDS = [
  { upToCents: 250_000, priceCents: 5_000, range: 'Up to $2,500' },
  { upToCents: 500_000, priceCents: 10_000, range: '$2,500.01 – $5,000' },
  { upToCents: 750_000, priceCents: 15_000, range: '$5,000.01 – $7,500' },
  { upToCents: 1_000_000, priceCents: 25_000, range: '$7,500.01 – $10,000' },
  { upToCents: 1_500_000, priceCents: 35_000, range: '$10,000.01 – $15,000' },
  { upToCents: Infinity, priceCents: 50_000, range: 'Over $15,000' },
] as const;
export const bandFor = (netFoodCents: number) => BANDS.findIndex((b) => netFoodCents <= b.upToCents);

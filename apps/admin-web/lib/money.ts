/** Display only. All amounts arrive from the API in integer cents. */
const fmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const usd = (cents: number) => `${cents < 0 ? '−' : ''}$${fmt.format(Math.abs(cents) / 100)}`;
export const miles = (meters: number) => `${(meters / 1609.344).toFixed(1)} mi`;

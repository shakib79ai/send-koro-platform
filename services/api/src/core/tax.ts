/**
 * Sales tax is the RESTAURANT's responsibility (rule 7). We only suggest a rate from the address;
 * the restaurant confirms or changes it and accepts responsibility before taking orders.
 *
 * Launch states are limited to those whose marketplace-facilitator law does NOT make the platform
 * collect tax on restaurant meals. NY: facilitator rules don't cover restaurant food sold through
 * platforms like ours. CA: delivery network companies are excluded. GA (meal platforms > $100k) is
 * blocked. Add a state only after legal review (BUSINESS_MODEL.md).
 */
export const LAUNCH_STATES = new Set(['NY', 'CA']);
export const BLOCKED_STATES: Record<string, string> = {
  GA: 'Georgia’s marketplace law would make Send Koro collect tax on restaurant meals.',
};

/** Suggested combined rates in parts per million. A suggestion only — rates change; restaurants confirm. */
const NYC_ZIP_PREFIXES = ['100', '101', '102', '103', '104', '110', '111', '112', '113', '114', '116'];
export function suggestTaxRatePpm(state: string, postalCode: string): { ratePpm: number | null; note: string } {
  if (state === 'NY' && NYC_ZIP_PREFIXES.some((p) => postalCode.startsWith(p))) return { ratePpm: 88_750, note: 'New York City combined rate 8.875%. Confirm it with NYS Tax.' };
  if (state === 'NY') return { ratePpm: null, note: 'Rates differ by county in New York State. Look yours up at tax.ny.gov.' };
  if (state === 'CA') return { ratePpm: null, note: 'California rates differ by city. Look yours up at cdtfa.ca.gov.' };
  return { ratePpm: null, note: 'Enter the rate for your address.' };
}

export function stateLaunchCheck(state: string): { allowed: boolean; reason?: string } {
  if (BLOCKED_STATES[state]) return { allowed: false, reason: BLOCKED_STATES[state] };
  if (!LAUNCH_STATES.has(state)) return { allowed: false, reason: `Send Koro isn’t available in ${state} yet.` };
  return { allowed: true };
}

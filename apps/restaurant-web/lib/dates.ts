/** New York calendar boundaries as UTC instants. */
function nyOffsetMinutes(at: Date) {
  const s = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'shortOffset' }).formatToParts(at).find((p) => p.type === 'timeZoneName')!.value;
  const m = s.match(/GMT([+-]\d+)(?::(\d+))?/);
  return m ? Number(m[1]) * 60 + Math.sign(Number(m[1])) * Number(m[2] ?? 0) : 0;
}
export function nyDate(y: number, m: number, d: number) {
  const guess = Date.UTC(y, m, d);
  return new Date(guess - nyOffsetMinutes(new Date(guess + 12 * 3600_000)) * 60_000);
}
export function nyParts(at = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at).map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month) - 1, d: Number(p.day) };
}
export const startOfToday = () => { const { y, m, d } = nyParts(); return nyDate(y, m, d); };
export const startOfMonth = (offset = 0) => { const { y, m } = nyParts(); return nyDate(y, m + offset, 1); };

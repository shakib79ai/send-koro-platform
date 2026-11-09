/**
 * Opening hours in the location's own time zone. A close time earlier than the open time runs past
 * midnight. 23:59 means "until midnight" (inclusive), and open == close means open all day.
 */
export interface HoursRow { dayOfWeek: number; opensAt: string; closesAt: string }

function localParts(at: Date, timeZone: string) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, x.value]));
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return { day, minutes: Number(p.hour) * 60 + Number(p.minute) };
}
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

export function isOpenAt(hours: HoursRow[], timeZone: string, at: Date): boolean {
  const { day, minutes } = localParts(at, timeZone);
  const yesterday = (day + 6) % 7;
  return hours.some((h) => {
    const o = toMin(h.opensAt);
    const c = h.closesAt.startsWith('23:59') ? 1440 : toMin(h.closesAt);
    if (c === o) return h.dayOfWeek === day; // 24 hours
    if (c > o) return h.dayOfWeek === day && minutes >= o && minutes < c;
    // overnight: open from o today until c tomorrow
    return (h.dayOfWeek === day && minutes >= o) || (h.dayOfWeek === yesterday && minutes < c);
  });
}

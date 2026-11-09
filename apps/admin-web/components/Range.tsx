'use client';
import { useMemo, useState } from 'react';
import { startOfMonth, startOfToday } from '@/lib/dates';

export const RANGES = {
  today: { label: 'Today', get: () => [startOfToday(), new Date(Date.now() + 60_000)] },
  month: { label: 'This month', get: () => [startOfMonth(0), new Date(Date.now() + 60_000)] },
  last: { label: 'Last month', get: () => [startOfMonth(-1), startOfMonth(0)] },
  d90: { label: '90 days', get: () => [new Date(Date.now() - 90 * 86_400_000), new Date(Date.now() + 60_000)] },
} as const;
export type RangeKey = keyof typeof RANGES;
export const rangeQuery = (k: RangeKey) => { const [f, t] = RANGES[k].get(); return `from=${f.toISOString()}&to=${t.toISOString()}`; };

/** Stable query string for a range: computed once per selection, so it doesn't refetch on every render. */
export function useRange(initial: RangeKey = 'month') {
  const [range, setRange] = useState<RangeKey>(initial);
  const query = useMemo(() => rangeQuery(range), [range]);
  return { range, setRange, query };
}

export function RangePicker({ value, onChange }: { value: RangeKey; onChange: (k: RangeKey) => void }) {
  return <div className="seg">{(Object.keys(RANGES) as RangeKey[]).map((k) => <button key={k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{RANGES[k].label}</button>)}</div>;
}

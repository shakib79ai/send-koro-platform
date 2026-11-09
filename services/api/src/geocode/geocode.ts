/**
 * Address → coordinates for saved addresses. Default: the US Census Bureau geocoder (free, no
 * key, US addresses only). Swap for Google/Mapbox later for autocomplete-as-you-type.
 */
export interface GeocodeResult { line1: string; city: string; state: string; postalCode: string; lat: number; lng: number; matched: string }

interface CensusMatch {
  matchedAddress: string;
  coordinates: { x: number; y: number };
  addressComponents: { fromAddress?: string; preQualifier?: string; preDirection?: string; preType?: string; streetName?: string; suffixType?: string; suffixDirection?: string; city: string; state: string; zip: string };
}

export function parseCensus(json: unknown): GeocodeResult[] {
  const matches = (json as { result?: { addressMatches?: CensusMatch[] } })?.result?.addressMatches ?? [];
  return matches.slice(0, 5).map((m) => {
    const c = m.addressComponents;
    const street = [c.fromAddress, c.preDirection, c.preType, c.streetName, c.suffixType, c.suffixDirection].filter(Boolean).join(' ');
    const title = (s: string) => s.toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase());
    return { line1: title(street), city: title(c.city), state: c.state, postalCode: c.zip, lat: m.coordinates.y, lng: m.coordinates.x, matched: m.matchedAddress };
  });
}

export async function geocodeUs(address: string, fetchImpl: typeof fetch = fetch): Promise<GeocodeResult[]> {
  const url = new URL('https://geocoding.geo.census.gov/geocoder/locations/onelineaddress');
  url.search = new URLSearchParams({ address, benchmark: 'Public_AR_Current', format: 'json' }).toString();
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Geocoder ${res.status}`);
  return parseCensus(await res.json());
}

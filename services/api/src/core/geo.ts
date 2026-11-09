export interface Point { lat: number; lng: number }

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Straight-line distance in metres. */
export function haversineMeters(a: Point, b: Point): number {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/**
 * Rough street estimate used when no routing service is configured: Manhattan grid factor 1.3,
 * average courier speed 4.5 m/s (bike/e-bike in traffic), plus a fixed handoff time per stop.
 * Replace with a routing API (Google Routes / Mapbox) for production offers.
 */
export function estimateRoute(stops: Point[], handoffSecondsPerStop = 180) {
  let meters = 0;
  for (let i = 1; i < stops.length; i++) meters += Math.round(haversineMeters(stops[i - 1], stops[i]) * 1.3);
  const seconds = Math.round(meters / 4.5) + handoffSecondsPerStop * (stops.length - 1);
  return { distanceMeters: meters, durationSeconds: seconds };
}

/** Public browsing: nearby live restaurants and their menus. No courier or payment details here. */
import { and, eq, inArray } from 'drizzle-orm';
import type { Db } from '../db/client';
import { locationHours, locations, restaurantFees, restaurants } from '../db/schema';
import { haversineMeters, Point } from '../core/geo';
import { isOpenAt } from '../core/hours';
import { notFound } from '../common/http';
import type { MenuService } from '../menu/menu.service';

export class CatalogService {
  constructor(private readonly db: Db, private readonly menu: MenuService, private readonly now: () => Date = () => new Date()) {}

  async locationState(l: typeof locations.$inferSelect, hours: { dayOfWeek: number; opensAt: string; closesAt: string }[]) {
    const now = this.now();
    const open = l.acceptingOrders && isOpenAt(hours, l.timezone, now);
    const busy = !!l.busyUntil && l.busyUntil > now;
    return { open, busy, prepMinutes: l.prepMinutes + (busy ? 15 : 0) };
  }

  async nearby(at: Point, opts: { q?: string; limit?: number } = {}) {
    const rows = await this.db.select({ l: locations, r: restaurants }).from(locations)
      .innerJoin(restaurants, eq(restaurants.id, locations.restaurantId)).where(eq(restaurants.status, 'live'));
    const hours = rows.length ? await this.db.select().from(locationHours).where(inArray(locationHours.locationId, rows.map((x) => x.l.id))) : [];
    const q = opts.q?.toLowerCase().trim();
    const out = [];
    for (const { l, r } of rows) {
      const distanceMeters = haversineMeters(at, l);
      const delivers = l.deliveryEnabled && distanceMeters <= l.deliveryRadiusMeters;
      if (!delivers && !l.pickupEnabled) continue;
      if (q && !r.name.toLowerCase().includes(q) && !(r.cuisine ?? '').toLowerCase().includes(q)) continue;
      const st = await this.locationState(l, hours.filter((h) => h.locationId === l.id));
      out.push({
        restaurantId: r.id, locationId: l.id, name: r.name, cuisine: r.cuisine, address: `${l.line1}, ${l.city}`,
        distanceMeters, delivers, pickup: l.pickupEnabled, ...st, deliveryRule: r.deliveryRule,
      });
    }
    return out.sort((a, b) => Number(b.open) - Number(a.open) || a.distanceMeters - b.distanceMeters).slice(0, opts.limit ?? 50);
  }

  async restaurant(locationId: string) {
    const [row] = await this.db.select({ l: locations, r: restaurants }).from(locations).innerJoin(restaurants, eq(restaurants.id, locations.restaurantId))
      .where(and(eq(locations.id, locationId), eq(restaurants.status, 'live')));
    if (!row) throw notFound('Restaurant');
    const hours = await this.db.select().from(locationHours).where(eq(locationHours.locationId, locationId));
    const fees = await this.db.select().from(restaurantFees).where(and(eq(restaurantFees.restaurantId, row.r.id), eq(restaurantFees.active, true)));
    const menu = await this.menu.menu(row.r.id);
    return {
      restaurantId: row.r.id, locationId, name: row.r.name, cuisine: row.r.cuisine, address: `${row.l.line1}, ${row.l.city}, ${row.l.state} ${row.l.postalCode}`,
      lat: row.l.lat, lng: row.l.lng, hours, ...(await this.locationState(row.l, hours)),
      // Fees must be shown on the menu before payment (BUSINESS_MODEL.md).
      fees: fees.map((f) => ({ kind: f.kind, label: f.label, rateBps: f.rateBps, fixedCents: f.fixedCents, minFoodCents: f.minFoodCents })),
      taxRatePpm: row.l.taxRatePpm, taxNote: `Sales tax is set and paid by ${row.r.name}.`,
      deliveryRule: row.r.deliveryRule, menu,
    };
  }
}

/**
 * Seed the core API.
 *   npm run db:seed -- --admin +19175550123 "Your Name"     create the first admin (sign in with that phone)
 *   npm run db:seed -- --demo                                demo restaurant in Flatiron with a menu (needs the payments service running)
 * Never run --demo against production.
 */
import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { createDb } from '../src/db/client';
import * as t from '../src/db/schema';
import { HttpPaymentsClient } from '../src/integrations/payments.client';
import { RestaurantsService } from '../src/restaurants/restaurants.service';
import { MenuService } from '../src/menu/menu.service';

async function main() {
  const args = process.argv.slice(2);
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const { db, pool } = createDb(url);
  try {
    const ai = args.indexOf('--admin');
    if (ai >= 0) {
      const phone = args[ai + 1], name = args[ai + 2] ?? 'Admin';
      if (!/^\+[1-9]\d{7,14}$/.test(phone ?? '')) throw new Error('Usage: --admin +19175550123 "Name"');
      await db.insert(t.users).values({ phone, role: 'admin', name }).onConflictDoUpdate({ target: [t.users.phone, t.users.role], set: { name, disabledAt: null } });
      console.log(`Admin ready: ${phone}. Sign in to the admin console with that number.`);
    }
    if (args.includes('--demo')) {
      if (process.env.NODE_ENV === 'production') throw new Error('Refusing to create demo data in production');
      const payments = new HttpPaymentsClient(process.env.PAYMENTS_URL ?? 'http://localhost:3000', process.env.PAYMENTS_INTERNAL_KEY ?? '');
      const restaurants = new RestaurantsService(db, payments);
      const menu = new MenuService(db, restaurants);
      const phone = '+19175550100';
      const [owner] = await db.insert(t.users).values({ phone, role: 'restaurant_staff', name: 'Demo Owner', email: 'owner@dhaka.test' })
        .onConflictDoUpdate({ target: [t.users.phone, t.users.role], set: { name: 'Demo Owner' } }).returning();
      const me = { id: owner.id, role: 'restaurant_staff' as const, phone };
      const existing = await restaurants.mine(me);
      if (existing.length) { console.log(`Demo restaurant already exists: ${existing[0].id}`); return; }
      const r = await restaurants.create(me, { name: 'Dhaka Kitchen', contactEmail: 'owner@dhaka.test', cuisine: 'Bangladeshi' });
      const loc = await restaurants.addLocation(me, r.id, { name: 'Flatiron', phone: '+19175550101', line1: '12 W 21st St', city: 'New York', state: 'NY', postalCode: '10010', lat: 40.7411, lng: -73.9897 });
      await restaurants.setHours(me, loc.id, Array.from({ length: 7 }, (_, d) => ({ dayOfWeek: d, opensAt: '10:00', closesAt: '23:00' })));
      await restaurants.acceptTaxResponsibility(me, r.id);
      await restaurants.setDeliveryRule(me, r.id, { rule: { kind: 'free_above', minFoodCents: 3500, belowRestaurantCents: 200 } });
      const mains = await menu.addCategory(me, r.id, { name: 'Mains', sortOrder: 1 });
      const sides = await menu.addCategory(me, r.id, { name: 'Sides', sortOrder: 2 });
      await menu.addItem(me, r.id, { categoryId: mains.id, name: 'Kacchi Biryani', priceCents: 1695, description: 'Slow-cooked mutton and basmati, dum style', allergens: ['dairy'],
        groups: [{ name: 'Spice', minSelect: 1, maxSelect: 1, options: [{ name: 'Mild', priceCents: 0 }, { name: 'Medium', priceCents: 0 }, { name: 'Hot', priceCents: 0 }] }, { name: 'Add-ons', minSelect: 0, maxSelect: 3, options: [{ name: 'Extra egg', priceCents: 150 }, { name: 'Borhani', priceCents: 350 }] }] });
      await menu.addItem(me, r.id, { categoryId: mains.id, name: 'Chicken Roast', priceCents: 1450, description: 'Wedding-style, sweet and rich', allergens: ['dairy', 'nuts'] });
      await menu.addItem(me, r.id, { categoryId: sides.id, name: 'Beguni (4)', priceCents: 595, dietary: ['vegetarian'] });
      await menu.addItem(me, r.id, { categoryId: sides.id, name: 'Mango Lassi', priceCents: 495, allergens: ['dairy'], dietary: ['vegetarian'] });
      const [row] = await db.select().from(t.restaurants).where(eq(t.restaurants.id, r.id));
      console.log(`Demo restaurant ${row.name} (${row.id}). Finish Stripe onboarding for it in the restaurant portal, then press "Go live".`);
      console.log(`Restaurant portal sign-in: ${phone}`);
    }
    if (ai < 0 && !args.includes('--demo')) console.log('Nothing to do. Use --admin <phone> <name> and/or --demo.');
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });

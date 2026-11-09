/** Menu editor: categories, items, modifier groups/options, sold-out toggles. */
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import type { Db } from '../db/client';
import { menuCategories, menuItems, modifierGroups, modifierOptions } from '../db/schema';
import type { MenuItemForPricing } from '../core/cart';
import { notFound } from '../common/http';
import type { AuthUser } from '../auth/auth.guard';
import type { RestaurantsService } from '../restaurants/restaurants.service';

export interface ItemInput {
  categoryId?: string | null; name: string; description?: string; priceCents: number; imageUrl?: string;
  allergens?: string[]; dietary?: string[]; taxable?: boolean; available?: boolean; sortOrder?: number;
  groups?: { name: string; minSelect: number; maxSelect: number; options: { name: string; priceCents: number; available?: boolean }[] }[];
}

export class MenuService {
  constructor(private readonly db: Db, private readonly restaurants: RestaurantsService) {}

  /** Full menu tree. `publicOnly` hides deleted items (and is used by the customer catalog). */
  async menu(restaurantId: string) {
    const cats = await this.db.select().from(menuCategories).where(eq(menuCategories.restaurantId, restaurantId)).orderBy(asc(menuCategories.sortOrder));
    const items = await this.db.select().from(menuItems).where(and(eq(menuItems.restaurantId, restaurantId), isNull(menuItems.deletedAt))).orderBy(asc(menuItems.sortOrder), asc(menuItems.name));
    const groups = items.length ? await this.db.select().from(modifierGroups).where(inArray(modifierGroups.itemId, items.map((i) => i.id))).orderBy(asc(modifierGroups.sortOrder)) : [];
    const options = groups.length ? await this.db.select().from(modifierOptions).where(inArray(modifierOptions.groupId, groups.map((g) => g.id))).orderBy(asc(modifierOptions.sortOrder)) : [];
    const withGroups = items.map((i) => ({
      ...i,
      groups: groups.filter((g) => g.itemId === i.id).map((g) => ({ ...g, options: options.filter((o) => o.groupId === g.id) })),
    }));
    return {
      categories: cats.map((c) => ({ ...c, items: withGroups.filter((i) => i.categoryId === c.id) })),
      uncategorized: withGroups.filter((i) => !i.categoryId || !cats.some((c) => c.id === i.categoryId)),
    };
  }

  async forPricing(restaurantId: string, itemIds: string[]): Promise<Map<string, MenuItemForPricing>> {
    if (!itemIds.length) return new Map();
    const items = await this.db.select().from(menuItems).where(and(eq(menuItems.restaurantId, restaurantId), inArray(menuItems.id, itemIds), isNull(menuItems.deletedAt)));
    const groups = items.length ? await this.db.select().from(modifierGroups).where(inArray(modifierGroups.itemId, items.map((i) => i.id))) : [];
    const options = groups.length ? await this.db.select().from(modifierOptions).where(inArray(modifierOptions.groupId, groups.map((g) => g.id))) : [];
    return new Map(items.map((i) => [i.id, {
      id: i.id, name: i.name, priceCents: i.priceCents, taxable: i.taxable, available: i.available, soldOutUntil: i.soldOutUntil,
      groups: groups.filter((g) => g.itemId === i.id).map((g) => ({ id: g.id, name: g.name, minSelect: g.minSelect, maxSelect: g.maxSelect, options: options.filter((o) => o.groupId === g.id).map((o) => ({ id: o.id, name: o.name, priceCents: o.priceCents, available: o.available })) })),
    }]));
  }

  async addCategory(user: AuthUser, restaurantId: string, input: { name: string; sortOrder?: number }) {
    await this.restaurants.requireMember(user, restaurantId, 'manager');
    const [c] = await this.db.insert(menuCategories).values({ ...input, restaurantId }).returning();
    return c;
  }

  async updateCategory(user: AuthUser, id: string, input: { name?: string; sortOrder?: number }) {
    const [c] = await this.db.select().from(menuCategories).where(eq(menuCategories.id, id));
    if (!c) throw notFound('Category');
    await this.restaurants.requireMember(user, c.restaurantId, 'manager');
    const [row] = await this.db.update(menuCategories).set(input).where(eq(menuCategories.id, id)).returning();
    return row;
  }

  async addItem(user: AuthUser, restaurantId: string, input: ItemInput) {
    await this.restaurants.requireMember(user, restaurantId, 'manager');
    return this.db.transaction(async (tx) => {
      const { groups, ...item } = input;
      const [row] = await tx.insert(menuItems).values({ ...item, restaurantId }).returning();
      await writeGroups(tx as unknown as Db, row.id, groups ?? []);
      return row;
    });
  }

  async updateItem(user: AuthUser, id: string, input: Partial<ItemInput>) {
    const item = await this.loadItem(id);
    await this.restaurants.requireMember(user, item.restaurantId, 'manager');
    return this.db.transaction(async (tx) => {
      const { groups, ...rest } = input;
      const [row] = await tx.update(menuItems).set({ ...rest, updatedAt: new Date() }).where(eq(menuItems.id, id)).returning();
      if (groups) {
        await tx.delete(modifierGroups).where(eq(modifierGroups.itemId, id));
        await writeGroups(tx as unknown as Db, id, groups);
      }
      return row;
    });
  }

  /** Staff can mark items sold out (until a time, or until turned back on). */
  async setAvailability(user: AuthUser, id: string, input: { available: boolean; soldOutMinutes?: number | null }) {
    const item = await this.loadItem(id);
    await this.restaurants.requireMember(user, item.restaurantId, 'staff');
    const soldOutUntil = !input.available && input.soldOutMinutes ? new Date(Date.now() + input.soldOutMinutes * 60_000) : null;
    const [row] = await this.db.update(menuItems).set({ available: input.available || !!soldOutUntil, soldOutUntil, updatedAt: new Date() }).where(eq(menuItems.id, id)).returning();
    return row;
  }

  async removeItem(user: AuthUser, id: string) {
    const item = await this.loadItem(id);
    await this.restaurants.requireMember(user, item.restaurantId, 'manager');
    await this.db.update(menuItems).set({ deletedAt: new Date() }).where(eq(menuItems.id, id));
    return { ok: true };
  }

  private async loadItem(id: string) {
    const [i] = await this.db.select().from(menuItems).where(and(eq(menuItems.id, id), isNull(menuItems.deletedAt)));
    if (!i) throw notFound('Menu item');
    return i;
  }
}

async function writeGroups(tx: Db, itemId: string, groups: NonNullable<ItemInput['groups']>) {
  for (const [gi, g] of groups.entries()) {
    const [grp] = await tx.insert(modifierGroups).values({ itemId, name: g.name, minSelect: g.minSelect, maxSelect: g.maxSelect, sortOrder: gi }).returning();
    if (g.options.length) await tx.insert(modifierOptions).values(g.options.map((o, oi) => ({ groupId: grp.id, name: o.name, priceCents: o.priceCents, available: o.available ?? true, sortOrder: oi })));
  }
}

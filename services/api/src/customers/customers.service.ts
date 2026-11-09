/** Saved addresses (Home / Office / Other, one default) and push device tokens. */
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { Db } from '../db/client';
import { addresses, deviceTokens } from '../db/schema';
import { notFound } from '../common/http';

export interface AddressInput {
  label: 'home' | 'office' | 'other'; customLabel?: string; line1: string; line2?: string; city: string; state: string; postalCode: string;
  lat: number; lng: number; dropoffInstructions?: string; isDefault?: boolean;
}

export class CustomersService {
  constructor(private readonly db: Db) {}

  list(userId: string) {
    return this.db.select().from(addresses).where(and(eq(addresses.userId, userId), isNull(addresses.deletedAt))).orderBy(desc(addresses.isDefault), desc(addresses.createdAt));
  }

  async get(userId: string, id: string) {
    const [a] = await this.db.select().from(addresses).where(and(eq(addresses.id, id), eq(addresses.userId, userId), isNull(addresses.deletedAt)));
    if (!a) throw notFound('Address');
    return a;
  }

  async add(userId: string, input: AddressInput) {
    return this.db.transaction(async (tx) => {
      const existing = await tx.select({ id: addresses.id }).from(addresses).where(and(eq(addresses.userId, userId), isNull(addresses.deletedAt)));
      const makeDefault = input.isDefault || existing.length === 0;
      if (makeDefault) await tx.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, userId));
      const [a] = await tx.insert(addresses).values({ ...input, userId, isDefault: makeDefault }).returning();
      return a;
    });
  }

  async update(userId: string, id: string, input: Partial<AddressInput>) {
    await this.get(userId, id);
    return this.db.transaction(async (tx) => {
      if (input.isDefault) await tx.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, userId));
      const [a] = await tx.update(addresses).set(input).where(eq(addresses.id, id)).returning();
      return a;
    });
  }

  async remove(userId: string, id: string) {
    const a = await this.get(userId, id);
    await this.db.update(addresses).set({ deletedAt: new Date(), isDefault: false }).where(eq(addresses.id, id));
    if (a.isDefault) {
      const [next] = await this.list(userId);
      if (next) await this.db.update(addresses).set({ isDefault: true }).where(eq(addresses.id, next.id));
    }
    return { ok: true };
  }

  async registerDevice(userId: string, platform: 'ios' | 'android' | 'web', token: string) {
    await this.db.insert(deviceTokens).values({ userId, platform, token }).onConflictDoUpdate({ target: deviceTokens.token, set: { userId, platform } });
    return { ok: true };
  }
}

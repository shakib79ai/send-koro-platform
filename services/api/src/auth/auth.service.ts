/**
 * Phone sign-in: one page for sign in and sign up (as in the designs). A 6-digit code is sent by
 * SMS; codes are stored hashed, expire in 10 minutes, allow 5 attempts, and are rate-limited.
 * Access tokens are short-lived JWTs; refresh tokens are random, stored hashed and rotated on use.
 */
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import type { JwtService } from '@nestjs/jwt';
import type { Db } from '../db/client';
import { otpCodes, refreshTokens, users } from '../db/schema';
import type { SmsSender } from '../integrations/sms';
import { AppError, badRequest } from '../common/http';
import type { Role } from './auth.guard';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const CODE_TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_HOUR = 5;

export interface AuthConfig { accessTtlSeconds: number; refreshTtlDays: number; pepper: string }

export class AuthService {
  constructor(private readonly db: Db, private readonly jwt: JwtService, private readonly sms: SmsSender, private readonly cfg: AuthConfig, private readonly now: () => Date = () => new Date()) {}

  private hashCode(phone: string, role: Role, code: string) { return sha256(`${this.cfg.pepper}:${phone}:${role}:${code}`); }

  async requestCode(phone: string, role: Role): Promise<{ sent: true; expiresInSeconds: number }> {
    if (role === 'admin') {
      // Admins are created by another admin (or the seed script); no self sign-up.
      const [u] = await this.db.select().from(users).where(and(eq(users.phone, phone), eq(users.role, 'admin')));
      if (!u) return { sent: true, expiresInSeconds: CODE_TTL_MS / 1000 }; // don't reveal which numbers are admins
    }
    const since = new Date(this.now().getTime() - 3600_000);
    const [{ n }] = await this.db.select({ n: sql<number>`count(*)::int` }).from(otpCodes)
      .where(and(eq(otpCodes.phone, phone), eq(otpCodes.role, role), gt(otpCodes.createdAt, since)));
    if (n >= MAX_CODES_PER_HOUR) throw new AppError(400, 'too_many_codes', 'Too many codes requested. Try again in an hour.');
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.db.insert(otpCodes).values({ phone, role, codeHash: this.hashCode(phone, role, code), expiresAt: new Date(this.now().getTime() + CODE_TTL_MS) });
    await this.sms.send(phone, `${code} is your Send Koro code. It expires in 10 minutes. Don't share it.`);
    return { sent: true, expiresInSeconds: CODE_TTL_MS / 1000 };
  }

  async verifyCode(phone: string, role: Role, code: string, profile?: { name?: string; email?: string }) {
    const [row] = await this.db.select().from(otpCodes)
      .where(and(eq(otpCodes.phone, phone), eq(otpCodes.role, role), isNull(otpCodes.usedAt), gt(otpCodes.expiresAt, this.now())))
      .orderBy(desc(otpCodes.createdAt)).limit(1);
    if (!row || row.attempts >= MAX_ATTEMPTS) throw badRequest('code_invalid', 'That code has expired. Request a new one.');
    const a = Buffer.from(row.codeHash, 'hex'), b = Buffer.from(this.hashCode(phone, role, code), 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      await this.db.update(otpCodes).set({ attempts: row.attempts + 1 }).where(eq(otpCodes.id, row.id));
      throw badRequest('code_invalid', 'That code is not right.');
    }
    const [used] = await this.db.update(otpCodes).set({ usedAt: this.now() }).where(and(eq(otpCodes.id, row.id), isNull(otpCodes.usedAt))).returning();
    if (!used) throw badRequest('code_invalid', 'That code was already used.');

    let [user] = await this.db.select().from(users).where(and(eq(users.phone, phone), eq(users.role, role)));
    const isNew = !user;
    if (!user) {
      if (role === 'admin') throw badRequest('code_invalid', 'That code is not right.');
      [user] = await this.db.insert(users).values({ phone, role, name: profile?.name, email: profile?.email })
        .onConflictDoUpdate({ target: [users.phone, users.role], set: { phone } }).returning();
    } else if (profile?.name || profile?.email) {
      [user] = await this.db.update(users).set({ name: profile.name ?? user.name, email: profile.email ?? user.email }).where(eq(users.id, user.id)).returning();
    }
    if (user.disabledAt) throw new AppError(403, 'account_disabled', 'This account is disabled. Contact support.');
    return { ...(await this.issue(user)), isNew, user: publicUser(user) };
  }

  async refresh(refreshToken: string) {
    const hash = sha256(refreshToken);
    const [row] = await this.db.update(refreshTokens).set({ revokedAt: this.now() })
      .where(and(eq(refreshTokens.tokenHash, hash), isNull(refreshTokens.revokedAt), gt(refreshTokens.expiresAt, this.now()))).returning();
    if (!row) throw new AppError(400, 'refresh_invalid', 'Please sign in again.');
    const [user] = await this.db.select().from(users).where(eq(users.id, row.userId));
    if (!user || user.disabledAt) throw new AppError(403, 'account_disabled', 'This account is disabled.');
    return { ...(await this.issue(user)), user: publicUser(user) };
  }

  async signOut(refreshToken: string) {
    await this.db.update(refreshTokens).set({ revokedAt: this.now() }).where(eq(refreshTokens.tokenHash, sha256(refreshToken)));
    return { ok: true };
  }

  async me(userId: string) {
    const [u] = await this.db.select().from(users).where(eq(users.id, userId));
    return u ? publicUser(u) : null;
  }

  async updateMe(userId: string, p: { name?: string; email?: string }) {
    const [u] = await this.db.update(users).set(p).where(eq(users.id, userId)).returning();
    return publicUser(u);
  }

  private async issue(user: typeof users.$inferSelect) {
    const accessToken = this.jwt.sign({ sub: user.id, role: user.role, phone: user.phone, typ: 'access' }, { expiresIn: this.cfg.accessTtlSeconds });
    const refreshToken = randomBytes(32).toString('base64url');
    await this.db.insert(refreshTokens).values({ userId: user.id, tokenHash: sha256(refreshToken), expiresAt: new Date(this.now().getTime() + this.cfg.refreshTtlDays * 86_400_000) });
    return { accessToken, refreshToken, expiresInSeconds: this.cfg.accessTtlSeconds };
  }
}

export const publicUser = (u: typeof users.$inferSelect) => ({ id: u.id, phone: u.phone, role: u.role, name: u.name, email: u.email });

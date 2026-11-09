/**
 * Production-safe admin tasks (compiled into dist/):
 *   node dist/cli.js create-admin +19175550123 "Your Name"
 */
import 'dotenv/config';
import { createDb } from './db/client';
import { users } from './db/schema';

async function main() {
  const [cmd, phone, name = 'Admin'] = process.argv.slice(2);
  if (cmd !== 'create-admin' || !/^\+[1-9]\d{7,14}$/.test(phone ?? '')) {
    console.error('Usage: node dist/cli.js create-admin +19175550123 "Your Name"');
    process.exit(2);
  }
  const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
  try {
    await db.insert(users).values({ phone, role: 'admin', name }).onConflictDoUpdate({ target: [users.phone, users.role], set: { name, disabledAt: null } });
    console.log(`Admin ready: ${phone}. Sign in to the admin console with that number.`);
  } finally { await pool.end(); }
}
main().catch((e) => { console.error((e as Error).message); process.exit(1); });

import 'dotenv/config';
import path from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from './client';

export async function runMigrations(databaseUrl: string) {
  const { db, pool } = createDb(databaseUrl);
  try {
    await migrate(db, { migrationsFolder: path.resolve(__dirname, '../../drizzle') });
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  runMigrations(url).then(() => console.log('Migrations applied'));
}

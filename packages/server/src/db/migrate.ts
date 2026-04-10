import path from 'node:path';
import { config } from 'dotenv';

// Load .env from monorepo root
config({ path: path.resolve(__dirname, '../../../../.env') });

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

const { Pool } = pg;

async function runMigrations() {
  const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: path.resolve(__dirname, './migrations') });
  console.log('Migrations applied successfully');
  await pool.end();
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

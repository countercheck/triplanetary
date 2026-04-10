import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Load .env from monorepo root (four levels up: src/db → src → server → packages → root)
config({ path: resolve(__dirname, "../../../../.env") });
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env["DATABASE_URL"],
});

const db = drizzle(pool);

await migrate(db, { migrationsFolder: "./src/db/migrations" });
console.log("Migrations applied successfully");
await pool.end();

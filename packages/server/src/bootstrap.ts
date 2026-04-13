import path from "node:path";
import { config } from "dotenv";

// Load .env BEFORE any other module is evaluated.
// In CJS, static `import` statements in index.ts (and everything it imports)
// compile to require() calls that execute when require('./index') runs below —
// i.e. AFTER this config() call. This guarantees every module body that reads
// process.env (db/client Pool, bgio/server origins, etc.) sees the .env values.
config({ path: path.resolve(__dirname, "../../../.env") });

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("./index");

# Triplanetary — Codebase Guide

Digital adaptation of the Triplanetary board game (vector movement, solar system setting).

## Architecture

Single-port design: one Koa server (boardgame.io's built-in Koa app) handles everything.

```
localhost:3000  — Vite dev server (proxies /api/*, /games/*, /socket.io → :8000)
localhost:8000  — Single Koa server (boardgame.io)
    ├── /games/*         boardgame.io match CRUD + WebSocket transport
    ├── /api/auth/*      register, login, logout, me
    └── /api/health      health check
```

## Monorepo Structure

```
triplanetary/
├── packages/
│   ├── shared/    @triplanetary/shared  — game types, API types, scenario constants, bgio Game stub
│   ├── server/    @triplanetary/server  — Koa server, Drizzle ORM, auth middleware
│   └── client/    @triplanetary/client  — Vite + React + React Router + TanStack Query
├── docker-compose.yml   PostgreSQL 17 on port 5433
├── turbo.json
└── tsconfig.base.json
```

## Module System — CRITICAL

**`shared` and `server` are CommonJS** — no `"type": "module"` in their package.json. boardgame.io 0.50.x is CJS-only with no ESM exports map; any ESM import of it fails.

**`client` is ESM** — has `"type": "module"`, uses Vite's bundler module resolution.

**Server dev runner is `ts-node --transpile-only`** — NOT `tsx`. tsx v4's ESM loader pollutes the CJS module cache causing `TypeError: getGeneratorFunction is not a function` in passport.

**Do not** add `"type": "module"` to `packages/shared` or `packages/server`.  
**Do not** switch the server dev runner back to `tsx watch`.

## Key Implementation Details

### Body Parser Placement
`koa-bodyparser` is scoped to the `/api` router, NOT app-level middleware. Putting it at app-level consumes the request stream before boardgame.io's own `co-body` parser can read it, causing `InternalServerError: stream is not readable` on match creation.

```typescript
// packages/server/src/index.ts — correct pattern
const apiRouter = new Router({ prefix: '/api' });
apiRouter.use(bodyParser());   // ← only /api routes
```

### Database
- PostgreSQL 17 via Docker Compose on **port 5433** (5432 conflicts with local Postgres)
- `DATABASE_URL=postgresql://triplanetary:triplanetary@localhost:5433/triplanetary`
- Drizzle ORM with `node-postgres` (`pg` package)
- Custom migration runner at `packages/server/src/db/migrate.ts` (run via `tsx`) — drizzle-kit's built-in `migrate` command fails with CJS/ESM resolution issues in this project

### Session Store
Custom pg-backed session store in `packages/server/src/api/middleware/session.ts` (get/set/destroy against the `session` table). Not connect-pg-simple.

### Shared Package
Must be built before server or client can import it. `turbo dev` handles this via `dependsOn: ["^build"]`.

## Common Commands

```bash
# Start everything
pnpm dev                          # turbo: builds shared, then starts server + client watchers

# Individual packages
pnpm --filter @triplanetary/server dev
pnpm --filter @triplanetary/client dev

# Database
docker compose up -d              # start Postgres on :5433
pnpm db:migrate                   # run Drizzle migrations
pnpm db:generate                  # generate migrations from schema changes
pnpm --filter @triplanetary/server db:studio  # Drizzle Studio

# Tests
pnpm test                         # all packages
pnpm --filter @triplanetary/server test
pnpm --filter @triplanetary/client test

# Build
pnpm build
pnpm --filter @triplanetary/shared build
```

## Testing

- **Server**: Vitest + Supertest integration tests against a real Postgres DB (Docker). `vitest.config.ts` sets `DATABASE_URL` env.
- **Client**: Vitest + jsdom + MSW (Mock Service Worker) for API mocking. No real server needed.
- Server tests live in `packages/server/src/__tests__/`
- Client tests live in `packages/client/src/__tests__/`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | pnpm workspaces + Turbo |
| Language | TypeScript 5.8, strict mode |
| Game framework | boardgame.io 0.50.x |
| Server | Koa (via boardgame.io) + @koa/router |
| Auth | koa-passport (LocalStrategy) + koa-session + bcryptjs |
| Database | PostgreSQL 17, Drizzle ORM, node-postgres |
| Client | Vite 6 + React 19 + React Router 7 + TanStack Query 5 |
| Testing | Vitest everywhere; Supertest (server); MSW (client) |
| Dev runner | ts-node --transpile-only (server), Vite HMR (client) |

## Phase Status

- **Phase 0** ✅ — Monorepo scaffold, auth, lobby, match creation
- **Phase 1a** ✅ — Map editor, SVG hex renderer, canonical map seed (merged to main)
- **Phase 1b** ✅ — Bi-Planetary game engine: vector movement, gravity, simultaneous astrogation, win condition, Board/HUD UI (branch: feature/phase-1b-game-engine)
- **Phase 2** — Extended scenarios (Triplanetary, combat, ordnance)
- **Phase 3** — Lobby refinements, multiplayer polish
- **Phase 4** — AI bot

---

## Decision Log

Append entries here whenever an architectural, convention, or tooling decision is made.

### Single-port Koa server (boardgame.io + custom routes)
boardgame.io's built-in Koa server is the only backend process. Custom `/api/*` routes mount directly on its Koa app rather than a separate server. Avoids a second port and proxying complexity. All custom middleware must be Koa-compatible; boardgame.io's internal routing conventions must be respected.

### CommonJS for `shared` and `server` packages
boardgame.io 0.50.x ships CJS-only with no ESM exports map — any ESM import fails. Do not add `"type": "module"` to `packages/shared` or `packages/server`. `packages/client` is ESM (Vite handles bundling).

### ts-node --transpile-only as server dev runner (not tsx)
tsx v4's ESM loader pollutes the CJS module cache, causing `TypeError: getGeneratorFunction is not a function` in koa-passport. Do not switch back to `tsx watch`. Note: transpile-only skips type checking at dev-server startup — run `pnpm typecheck` separately.

### bodyParser scoped to /api router
`koa-bodyparser` at app-level consumes the request stream before boardgame.io's `co-body` parser runs → `InternalServerError: stream is not readable` on match creation. Scope it to the `/api` Router only.

### PostgreSQL on port 5433
Port 5432 conflicts with a locally installed PostgreSQL. All connection strings and CI service definitions target `:5433`.

### Custom pg session store (not connect-pg-simple)
connect-pg-simple has CJS/ESM resolution issues in this module setup. Hand-rolled store in `session.ts` using plain `pool.query`. Expire column uses `NOW() + ($n * INTERVAL '1 millisecond')` — passing a JS `Date` into a `timestamp WITHOUT TIME ZONE` column strips timezone and causes `expire > NOW()` comparisons to fail.

### Custom migration runner (not drizzle-kit migrate)
drizzle-kit's `migrate` CLI fails with CJS/ESM resolution errors. Migrations are applied via `packages/server/src/db/migrate.ts` (run with `tsx`). New migration files must be manually registered in `meta/_journal.json`. CI calls `pnpm --filter @triplanetary/server db:migrate` (bypasses turbo) so `DATABASE_URL` reaches the subprocess.

### Turbo env passthrough: declare env vars in turbo.json
Turbo v2 does not forward env vars to task subprocesses unless declared under `"env": [...]` in the task config. Any task that reads env vars at runtime must declare them there.

### Vite alias: @triplanetary/shared → TypeScript source
Vite/Rollup cannot statically analyse `__exportStar` from tsc's CJS output — named exports appear missing at bundle time. `vite.config.ts` aliases `@triplanetary/shared` to `../shared/src/index.ts`. The server still imports from the compiled `dist/`.

### Vitest fork isolation for server integration tests
`pool: 'forks'` + `poolOptions: { forks: { isolate: true } }` in `packages/server/vitest.config.ts`. Without this, `pool.end()` in one test file's `afterAll` terminates the shared pg Pool used by concurrently-running test files.

### Per-file email namespacing for server integration tests
Test files run concurrently. A broad `DELETE FROM users` in one file's `beforeAll` races with another file's user registration. Each file owns a unique email prefix and cleans up only its own rows:

| File | Namespace |
|---|---|
| `auth.test.ts` | `test@example.com` |
| `auth-validation.test.ts` | `auth-val-*@test.com` |
| `maps.test.ts` | `mapeditor-*@test.com` |
| `maps-export.test.ts` | `export-test@test.com` |
| `session.test.ts` | `test-session-*` (session table only) |

New integration test files must choose a unique prefix and clean up only that prefix.

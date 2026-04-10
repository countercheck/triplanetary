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
- **Phase 1** — Map Editor + SVG hex map renderer
- **Phase 2** — Game engine (vector movement, gravity, combat)
- **Phase 3** — Lobby refinements, multiplayer polish
- **Phase 4** — AI bot

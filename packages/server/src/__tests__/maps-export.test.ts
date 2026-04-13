import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import type { Server } from "node:http";
import Koa from "koa";
import Router from "@koa/router";
import bodyParser from "koa-bodyparser";
import { createSessionMiddleware } from "../api/middleware/session.js";
import { passportInit, passportSession } from "../api/middleware/passport.js";
import authRouter from "../api/routes/auth.js";
import mapsRouter from "../api/routes/maps.js";
import { pool, db } from "../db/client.js";
import { maps } from "../db/schema.js";
import type { HexData } from "@triplanetary/shared";

function buildTestApp(): Koa {
  const app = new Koa();
  app.keys = ["test-secret"];
  app.use(createSessionMiddleware(app));
  app.use(passportInit);
  app.use(passportSession);
  const api = new Router({ prefix: "/api" });
  api.use(bodyParser());
  api.use(authRouter.routes());
  api.use(mapsRouter.routes());
  app.use(api.routes());
  return app;
}

const BLANK_DATA: HexData = {
  meta: {
    name: "Export Test",
    version: "1.0",
    hexSize: 48,
    orientation: "pointy",
  },
  bodies: {},
  hexes: {},
  bases: {},
};

let server: Server;
let agent: ReturnType<typeof supertest.agent>;
let mapId: string;

beforeAll(async () => {
  await pool.query("DELETE FROM users WHERE email = 'export-test@test.com'");
  await pool.query("DELETE FROM maps WHERE name LIKE 'Export%'");

  const app = buildTestApp();
  server = app.listen(0);

  await supertest(server).post("/api/auth/register").send({
    email: "export-test@test.com",
    password: "pass",
    displayName: "Exporter",
  });
  await pool.query("UPDATE users SET is_admin = TRUE WHERE email = $1", [
    "export-test@test.com",
  ]);

  agent = supertest.agent(server);
  await agent
    .post("/api/auth/login")
    .send({ email: "export-test@test.com", password: "pass" });

  const [row] = await db
    .insert(maps)
    .values({
      name: "Export Test Map",
      version: "1.0",
      data: BLANK_DATA,
    })
    .returning({ id: maps.id });
  mapId = row!.id;
});

afterAll(async () => {
  await pool.query("DELETE FROM maps WHERE name LIKE 'Export%'");
  await pool.query("DELETE FROM users WHERE email = 'export-test@test.com'");
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

describe("GET /api/maps/:id/export — filename sanitization", () => {
  it("returns a JSON file attachment with a clean filename", async () => {
    const res = await agent.get(`/api/maps/${mapId}/export`);
    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toMatch(
      /^attachment; filename="/,
    );
    expect(res.headers["content-type"]).toMatch(/application\/json/);
  });

  it("strips quotes from map name in Content-Disposition", async () => {
    const [row] = await db
      .insert(maps)
      .values({
        name: 'Export "Quoted" Map',
        version: "1.0",
        data: BLANK_DATA,
      })
      .returning({ id: maps.id });

    const res = await agent.get(`/api/maps/${row!.id}/export`);
    const disposition = res.headers["content-disposition"] as string;
    // Quotes inside the filename value must be stripped
    const filenameMatch = disposition.match(/filename="([^"]+)"/);
    expect(filenameMatch).not.toBeNull();
    const filename = filenameMatch![1]!;
    expect(filename).not.toContain('"');
    expect(filename).toMatch(/^[a-z0-9\-_.]+$/);
  });

  it("strips control characters from map name", async () => {
    const [row] = await db
      .insert(maps)
      .values({
        name: "Export\x0aInjected\x0dMap",
        version: "1.0",
        data: BLANK_DATA,
      })
      .returning({ id: maps.id });

    const res = await agent.get(`/api/maps/${row!.id}/export`);
    const disposition = res.headers["content-disposition"] as string;
    expect(disposition).not.toMatch(/[\x00-\x1f]/);
  });

  it("returns 404 for a nonexistent map id", async () => {
    const res = await agent.get(
      "/api/maps/00000000-0000-0000-0000-000000000000/export",
    );
    expect(res.status).toBe(404);
  });

  it("returns 401 for unauthenticated requests", async () => {
    const res = await supertest(server).get(`/api/maps/${mapId}/export`);
    expect(res.status).toBe(401);
  });

  it("response body is valid JSON matching the stored data", async () => {
    const res = await agent.get(`/api/maps/${mapId}/export`);
    expect(() => JSON.parse(res.text)).not.toThrow();
    const parsed = JSON.parse(res.text) as HexData;
    expect(parsed.meta.name).toBe("Export Test");
  });
});

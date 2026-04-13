import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import type { Server } from "node:http";
import Koa from "koa";
import Router from "@koa/router";
import bodyParser from "koa-bodyparser";
import { createSessionMiddleware } from "../api/middleware/session";
import { passportInit, passportSession } from "../api/middleware/passport";
import authRouter from "../api/routes/auth";
import healthRouter from "../api/routes/health";
import mapsRouter from "../api/routes/maps";
import { pool } from "../db/client";

function buildTestApp(): Koa {
  const app = new Koa();
  app.keys = ["test-secret"];
  app.use(createSessionMiddleware(app));
  app.use(passportInit);
  app.use(passportSession);
  const router = new Router();
  const api = new Router({ prefix: "/api" });
  api.use(bodyParser());
  api.use(authRouter.routes());
  api.use(healthRouter.routes());
  api.use(mapsRouter.routes());
  router.use(api.routes());
  app.use(router.routes());
  return app;
}

let server: Server;
let adminAgent: ReturnType<typeof supertest.agent>;
let userAgent: ReturnType<typeof supertest.agent>;
let anonRequest: ReturnType<typeof supertest>;

beforeAll(async () => {
  await pool.query(
    "DELETE FROM users WHERE email IN ('mapeditor-admin@test.com','mapeditor-user@test.com')",
  );
  await pool.query("DELETE FROM maps WHERE name LIKE 'Test Map%'");

  const app = buildTestApp();
  server = app.listen(0);
  anonRequest = supertest(server);

  // Register + promote admin
  await supertest(server)
    .post("/api/auth/register")
    .send({
      email: "mapeditor-admin@test.com",
      password: "pass",
      displayName: "Admin",
    });
  await pool.query("UPDATE users SET is_admin = TRUE WHERE email = $1", [
    "mapeditor-admin@test.com",
  ]);

  // Register user
  await supertest(server)
    .post("/api/auth/register")
    .send({
      email: "mapeditor-user@test.com",
      password: "pass",
      displayName: "User",
    });

  // Login via agents (agents persist cookies)
  adminAgent = supertest.agent(server);
  await adminAgent
    .post("/api/auth/login")
    .send({ email: "mapeditor-admin@test.com", password: "pass" });

  userAgent = supertest.agent(server);
  await userAgent
    .post("/api/auth/login")
    .send({ email: "mapeditor-user@test.com", password: "pass" });
});

afterAll(async () => {
  server.close();
  await pool.query(
    "DELETE FROM users WHERE email IN ('mapeditor-admin@test.com','mapeditor-user@test.com')",
  );
  await pool.query("DELETE FROM maps WHERE name LIKE 'Test Map%'");
});

describe("GET /api/maps", () => {
  it("returns 200 with array for any authenticated user", async () => {
    const res = await userAgent.get("/api/maps");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("returns 401 for unauthenticated requests", async () => {
    const res = await anonRequest.get("/api/maps");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/maps", () => {
  const payload = {
    name: "Test Map 1",
    version: "1.0",
    data: {
      meta: {
        name: "Test Map 1",
        version: "1.0",
        hexSize: 48,
        orientation: "pointy",
      },
      bodies: {},
      hexes: { "0,0": { type: "space" } },
      bases: {},
    },
  };

  it("creates a map as admin — 201 with id", async () => {
    const res = await adminAgent.post("/api/maps").send(payload);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe("Test Map 1");
  });

  it("returns 403 for non-admin user", async () => {
    const res = await userAgent.post("/api/maps").send(payload);
    expect(res.status).toBe(403);
  });
});

describe("GET /api/maps/:id", () => {
  let createdId: string;

  beforeAll(async () => {
    const res = await adminAgent.post("/api/maps").send({
      name: "Test Map 2",
      version: "1.0",
      data: {
        meta: {
          name: "Test Map 2",
          version: "1.0",
          hexSize: 48,
          orientation: "pointy",
        },
        bodies: {},
        hexes: {},
        bases: {},
      },
    });
    createdId = res.body.id;
  });

  it("returns full map data by id", async () => {
    const res = await userAgent.get(`/api/maps/${createdId}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.meta.name).toBe("Test Map 2");
  });

  it("returns 404 for unknown id", async () => {
    const res = await userAgent.get(
      "/api/maps/00000000-0000-0000-0000-000000000000",
    );
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/maps/:id", () => {
  let createdId: string;

  beforeAll(async () => {
    const res = await adminAgent.post("/api/maps").send({
      name: "Test Map 3",
      version: "1.0",
      data: {
        meta: {
          name: "Test Map 3",
          version: "1.0",
          hexSize: 48,
          orientation: "pointy",
        },
        bodies: {},
        hexes: {},
        bases: {},
      },
    });
    createdId = res.body.id;
  });

  it("updates map data as admin", async () => {
    const updated = {
      name: "Test Map 3 Updated",
      version: "1.1",
      data: {
        meta: {
          name: "Test Map 3 Updated",
          version: "1.1",
          hexSize: 48,
          orientation: "pointy",
        },
        bodies: { terra: { center: "0,4", radius: 1, gravityRings: 1 } },
        hexes: {},
        bases: {},
      },
    };
    const res = await adminAgent.put(`/api/maps/${createdId}`).send(updated);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Test Map 3 Updated");
  });

  it("returns 403 for non-admin", async () => {
    const res = await userAgent.put(`/api/maps/${createdId}`).send({});
    expect(res.status).toBe(403);
  });
});

describe("GET /api/maps/:id/export", () => {
  let createdId: string;

  beforeAll(async () => {
    const res = await adminAgent.post("/api/maps").send({
      name: "Test Map Export",
      version: "1.0",
      data: {
        meta: {
          name: "Test Map Export",
          version: "1.0",
          hexSize: 48,
          orientation: "pointy",
        },
        bodies: {},
        hexes: {},
        bases: {},
      },
    });
    createdId = res.body.id;
  });

  it("returns JSON file download", async () => {
    const res = await userAgent.get(`/api/maps/${createdId}/export`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.headers["content-disposition"]).toMatch(/attachment/);
  });
});

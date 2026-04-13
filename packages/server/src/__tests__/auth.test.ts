import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import type { Server } from "node:http";
import Koa from "koa";
import Router from "@koa/router";
import bodyParser from "koa-bodyparser";
import { createSessionMiddleware } from "../api/middleware/session.js";
import { passportInit, passportSession } from "../api/middleware/passport.js";
import authRouter from "../api/routes/auth.js";
import healthRouter from "../api/routes/health.js";
import { pool } from "../db/client.js";

function buildTestApp(): Koa {
  const app = new Koa();
  app.keys = ["test-secret"];
  app.use(createSessionMiddleware(app));
  app.use(passportInit);
  app.use(passportSession);
  const api = new Router({ prefix: "/api" });
  api.use(bodyParser());
  api.use(authRouter.routes());
  api.use(healthRouter.routes());
  app.use(api.routes());
  return app;
}

let server: Server;
let request: ReturnType<typeof supertest>;

beforeAll(async () => {
  await pool.query("DELETE FROM users WHERE email = 'test@example.com'");
  const app = buildTestApp();
  server = app.listen(0);
  request = supertest(server);
});

afterAll(() => {
  server.close();
});

describe("POST /api/auth/register", () => {
  it("returns 201 and user object without passwordHash", async () => {
    const res = await request.post("/api/auth/register").send({
      email: "test@example.com",
      password: "password123",
      displayName: "Tester",
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      email: "test@example.com",
      displayName: "Tester",
    });
    expect(res.body).not.toHaveProperty("passwordHash");
    expect(res.body).not.toHaveProperty("password_hash");
  });

  it("returns 409 when email already registered", async () => {
    const res = await request.post("/api/auth/register").send({
      email: "test@example.com",
      password: "password123",
      displayName: "Dupe",
    });

    expect(res.status).toBe(409);
  });
});

describe("POST /api/auth/login", () => {
  it("returns 200 and sets a session cookie", async () => {
    const res = await request
      .post("/api/auth/login")
      .send({ email: "test@example.com", password: "password123" });

    expect(res.status).toBe(200);
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("returns 401 for wrong password", async () => {
    const res = await request
      .post("/api/auth/login")
      .send({ email: "test@example.com", password: "wrongpassword" });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/me", () => {
  it("returns 200 with user when authenticated", async () => {
    const agent = supertest.agent(server);
    await agent
      .post("/api/auth/login")
      .send({ email: "test@example.com", password: "password123" });

    const res = await agent.get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      email: "test@example.com",
      displayName: "Tester",
    });
  });

  it("returns 401 without a session", async () => {
    const res = await request.get("/api/auth/me");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("returns 200 and subsequent /me returns 401", async () => {
    const agent = supertest.agent(server);
    await agent
      .post("/api/auth/login")
      .send({ email: "test@example.com", password: "password123" });

    const logout = await agent.post("/api/auth/logout");
    expect(logout.status).toBe(200);

    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(401);
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import type { Server } from 'node:http';
import Koa from 'koa';
import Router from '@koa/router';
import bodyParser from 'koa-bodyparser';
import { createSessionMiddleware } from '../api/middleware/session.js';
import { passportInit, passportSession } from '../api/middleware/passport.js';
import authRouter from '../api/routes/auth.js';
import { pool } from '../db/client.js';

function buildTestApp(): Koa {
  const app = new Koa();
  app.keys = ['test-secret'];
  const router = new Router();
  app.use(bodyParser());
  app.use(createSessionMiddleware(app));
  app.use(passportInit);
  app.use(passportSession);
  router.use('/api', authRouter.routes());
  app.use(router.routes());
  return app;
}

let server: Server;
let request: ReturnType<typeof supertest>;

beforeAll(async () => {
  await pool.query("DELETE FROM users WHERE email LIKE 'auth-val-%'");
  const app = buildTestApp();
  server = app.listen(0);
  request = supertest(server);
});

afterAll(() => {
  server.close();
});

describe('POST /api/auth/register — input validation', () => {
  it('returns 400 when email is missing', async () => {
    const res = await request
      .post('/api/auth/register')
      .send({ password: 'pass123', displayName: 'Test' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('returns 400 when password is missing', async () => {
    const res = await request
      .post('/api/auth/register')
      .send({ email: 'auth-val-nopw@test.com', displayName: 'Test' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when displayName is missing', async () => {
    const res = await request
      .post('/api/auth/register')
      .send({ email: 'auth-val-noname@test.com', password: 'pass123' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when body is empty', async () => {
    const res = await request.post('/api/auth/register').send({});
    expect(res.status).toBe(400);
  });

  it('does not expose passwordHash in the 201 response', async () => {
    const res = await request.post('/api/auth/register').send({
      email: 'auth-val-ok@test.com',
      password: 'securepassword',
      displayName: 'Val User',
    });
    expect(res.status).toBe(201);
    expect(res.body).not.toHaveProperty('passwordHash');
    expect(res.body).not.toHaveProperty('password_hash');
  });
});

describe('POST /api/auth/login — input validation', () => {
  it('returns 401 for a nonexistent email', async () => {
    const res = await request
      .post('/api/auth/login')
      .send({ email: 'nobody@nowhere.com', password: 'anything' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for empty credentials', async () => {
    const res = await request.post('/api/auth/login').send({});
    expect(res.status).toBe(401);
  });
});

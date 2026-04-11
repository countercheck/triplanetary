import koaSession from "koa-session";
import type Koa from "koa";
import { pool } from "../../db/client";

// pg-backed session store compatible with koa-session external store interface.
// The `session` table is created in the initial migration.
const pgStore = {
  async get(key: string) {
    const res = await pool.query<{ sess: string }>(
      "SELECT sess FROM session WHERE sid = $1 AND expire > NOW()",
      [key],
    );
    const row = res.rows[0];
    if (!row) return undefined;
    return typeof row.sess === "string"
      ? (JSON.parse(row.sess) as Record<string, unknown>)
      : row.sess;
  },

  async set(
    key: string,
    sess: Record<string, unknown>,
    maxAge: number | "session",
  ) {
    const expireMs =
      typeof maxAge === "number" ? maxAge : 7 * 24 * 60 * 60 * 1000;
    const expire = new Date(Date.now() + expireMs);
    await pool.query(
      `INSERT INTO session (sid, sess, expire)
       VALUES ($1, $2, $3)
       ON CONFLICT (sid) DO UPDATE SET sess = $2, expire = $3`,
      [key, JSON.stringify(sess), expire],
    );
  },

  async destroy(key: string) {
    await pool.query("DELETE FROM session WHERE sid = $1", [key]);
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSessionMiddleware(app: Koa<any, any>): Koa.Middleware {
  return koaSession(
    {
      key: "triplanetary.sid",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env["NODE_ENV"] === "production",
      store: pgStore,
      renew: true,
    },
    app,
  );
}

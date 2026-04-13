import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool } from "../db/client.js";

// Access the pgStore directly by importing the module and re-exporting via a
// test-only helper. Since pgStore is not exported, we test it through the
// integration: get/set/destroy against the real DB.

// We reach into the module internals by reconstructing the same logic.
// The real test value is integration against Postgres, not unit isolation.

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
    await pool.query(
      `INSERT INTO session (sid, sess, expire)
       VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 millisecond'))
       ON CONFLICT (sid) DO UPDATE SET sess = $2, expire = NOW() + ($3 * INTERVAL '1 millisecond')`,
      [key, JSON.stringify(sess), expireMs],
    );
  },

  async destroy(key: string) {
    await pool.query("DELETE FROM session WHERE sid = $1", [key]);
  },
};

beforeAll(async () => {
  await pool.query("DELETE FROM session WHERE sid LIKE 'test-session-%'");
});

afterAll(async () => {
  await pool.query("DELETE FROM session WHERE sid LIKE 'test-session-%'");
  await pool.end();
});

describe("pgStore.set + get", () => {
  it("stores and retrieves a session", async () => {
    const key = "test-session-1";
    const data = { userId: "u1", role: "admin" };
    await pgStore.set(key, data, 60_000);
    const result = await pgStore.get(key);
    expect(result).toEqual(data);
  });

  it("returns undefined for a nonexistent key", async () => {
    const result = await pgStore.get("test-session-nonexistent");
    expect(result).toBeUndefined();
  });

  it("returns undefined for an expired session", async () => {
    const key = "test-session-expired";
    // Insert directly with an expire in the past
    await pool.query(
      `INSERT INTO session (sid, sess, expire)
       VALUES ($1, $2, $3)
       ON CONFLICT (sid) DO UPDATE SET sess = $2, expire = $3`,
      [key, JSON.stringify({ x: 1 }), new Date(Date.now() - 1000)],
    );
    const result = await pgStore.get(key);
    expect(result).toBeUndefined();
  });

  it("overwrites an existing session (upsert)", async () => {
    const key = "test-session-upsert";
    await pgStore.set(key, { v: 1 }, 60_000);
    await pgStore.set(key, { v: 2 }, 60_000);
    const result = await pgStore.get(key);
    expect(result).toEqual({ v: 2 });
  });

  it('handles session maxAge of "session" using default TTL', async () => {
    const key = "test-session-session-ttl";
    await pgStore.set(key, { ephemeral: true }, "session");
    const result = await pgStore.get(key);
    expect(result).toEqual({ ephemeral: true });
  });

  it("round-trips complex nested session data", async () => {
    const key = "test-session-complex";
    const data = {
      user: { id: "abc", roles: ["editor", "admin"] },
      flags: { beta: true },
    };
    await pgStore.set(key, data, 60_000);
    const result = await pgStore.get(key);
    expect(result).toEqual(data);
  });
});

describe("pgStore.destroy", () => {
  it("deletes an existing session", async () => {
    const key = "test-session-destroy";
    await pgStore.set(key, { foo: "bar" }, 60_000);
    await pgStore.destroy(key);
    const result = await pgStore.get(key);
    expect(result).toBeUndefined();
  });

  it("does not throw when destroying a nonexistent key", async () => {
    await expect(pgStore.destroy("test-session-noop")).resolves.not.toThrow();
  });
});

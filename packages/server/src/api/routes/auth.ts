import Router from "@koa/router";
import passport from "koa-passport";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { users } from "../../db/schema";

const router = new Router();

router.post("/auth/register", async (ctx) => {
  const { email, password, displayName } = ctx.request.body as {
    email?: string;
    password?: string;
    displayName?: string;
  };

  if (!email || !password || !displayName) {
    ctx.status = 400;
    ctx.body = { error: "email, password, and displayName are required" };
    return;
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length > 0) {
    ctx.status = 409;
    ctx.body = { error: "Email already registered" };
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await db
    .insert(users)
    .values({ email, passwordHash, displayName })
    .returning({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      isAdmin: users.isAdmin,
    });

  const user = result[0]!;

  await new Promise<void>((resolve, reject) => {
    ctx.login(user, (err: unknown) =>
      err
        ? reject(err instanceof Error ? err : new Error(String(err)))
        : resolve(),
    );
  });

  ctx.status = 201;
  ctx.body = user;
});

router.post("/auth/login", async (ctx, next) => {
  return passport.authenticate(
    "local",
    (err: Error | null, user: false | { id: string }) => {
      if (err) {
        ctx.status = 500;
        ctx.body = { error: "Internal server error" };
        return;
      }
      if (!user) {
        ctx.status = 401;
        ctx.body = { error: "Invalid credentials" };
        return;
      }

      return ctx.login(user).then(() => {
        ctx.status = 200;
        ctx.body = user;
      });
    },
  )(ctx, next);
});

router.post("/auth/logout", async (ctx) => {
  ctx.logout();
  ctx.status = 200;
  ctx.body = { ok: true };
});

router.get("/auth/me", (ctx) => {
  if (!ctx.isAuthenticated()) {
    ctx.status = 401;
    ctx.body = { error: "Not authenticated" };
    return;
  }
  ctx.body = ctx.state["user"] as Record<string, unknown>;
});

export default router;

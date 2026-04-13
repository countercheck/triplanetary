import type { Context, Next } from 'koa';

export async function requireAdmin(ctx: Context, next: Next): Promise<void> {
  const user = ctx.state['user'] as { isAdmin?: boolean } | undefined;
  if (!user) {
    ctx.status = 401;
    ctx.body = { error: 'Authentication required' };
    return;
  }
  if (!user.isAdmin) {
    ctx.status = 403;
    ctx.body = { error: 'Admin access required' };
    return;
  }
  await next();
}

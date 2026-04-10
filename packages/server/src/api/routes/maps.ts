import Router from '@koa/router';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { maps } from '../../db/schema';
import { requireAdmin } from '../middleware/requireAdmin';
import type { HexData } from '@triplanetary/shared';

const router = new Router();

// GET /api/maps — list all maps (metadata only) — any authed user
router.get('/maps', async (ctx) => {
  if (!ctx.state['user']) {
    ctx.status = 401;
    ctx.body = { error: 'Unauthenticated' };
    return;
  }
  const rows = await db
    .select({
      id: maps.id,
      name: maps.name,
      version: maps.version,
      isCanonical: maps.isCanonical,
      createdAt: maps.createdAt,
      updatedAt: maps.updatedAt,
    })
    .from(maps)
    .orderBy(maps.name);
  ctx.body = rows;
});

// GET /api/maps/:id — full map with data — any authed user
router.get('/maps/:id', async (ctx) => {
  if (!ctx.state['user']) {
    ctx.status = 401;
    ctx.body = { error: 'Unauthenticated' };
    return;
  }
  const [row] = await db
    .select()
    .from(maps)
    .where(eq(maps.id, ctx.params['id'] ?? ''));
  if (!row) {
    ctx.status = 404;
    ctx.body = { error: 'Map not found' };
    return;
  }
  ctx.body = row;
});

// POST /api/maps — create map — admin only
router.post('/maps', requireAdmin, async (ctx) => {
  const body = ctx.request.body as { name: string; version?: string; data: HexData };
  if (!body.name || !body.data) {
    ctx.status = 400;
    ctx.body = { error: 'name and data required' };
    return;
  }
  const [row] = await db
    .insert(maps)
    .values({
      name: body.name,
      version: body.version ?? '1.0',
      data: body.data,
    })
    .returning();
  ctx.status = 201;
  ctx.body = row;
});

// PUT /api/maps/:id — update map — admin only
router.put('/maps/:id', requireAdmin, async (ctx) => {
  const body = ctx.request.body as Partial<{ name: string; version: string; data: HexData }>;
  const id = ctx.params['id'] ?? '';
  const [existing] = await db
    .select({ id: maps.id })
    .from(maps)
    .where(eq(maps.id, id));
  if (!existing) {
    ctx.status = 404;
    ctx.body = { error: 'Map not found' };
    return;
  }
  const [updated] = await db
    .update(maps)
    .set({
      ...(body.name    !== undefined && { name: body.name }),
      ...(body.version !== undefined && { version: body.version }),
      ...(body.data    !== undefined && { data: body.data }),
      updatedAt: new Date(),
    })
    .where(eq(maps.id, id))
    .returning();
  ctx.body = updated;
});

// GET /api/maps/:id/export — download as JSON file — any authed user
router.get('/maps/:id/export', async (ctx) => {
  if (!ctx.state['user']) {
    ctx.status = 401;
    ctx.body = { error: 'Unauthenticated' };
    return;
  }
  const [row] = await db
    .select()
    .from(maps)
    .where(eq(maps.id, ctx.params['id'] ?? ''));
  if (!row) {
    ctx.status = 404;
    ctx.body = { error: 'Map not found' };
    return;
  }
  const filename = `${row.name.replace(/\s+/g, '-').toLowerCase()}-v${row.version}.json`;
  ctx.set('Content-Disposition', `attachment; filename="${filename}"`);
  ctx.set('Content-Type', 'application/json');
  ctx.body = JSON.stringify(row.data, null, 2);
});

export default router;

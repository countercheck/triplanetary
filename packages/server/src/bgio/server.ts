import { Server } from 'boardgame.io/server';
import { TriplanetaryGame } from '@triplanetary/shared';

const origins = (process.env['BGIO_ALLOWED_ORIGINS'] ?? 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim());

export const bgioServer = Server({
  games: [TriplanetaryGame],
  origins,
});

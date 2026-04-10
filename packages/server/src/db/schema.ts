import { pgTable, uuid, varchar, boolean, timestamp, smallint, unique } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id:           uuid('id').defaultRandom().primaryKey(),
  email:        varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  displayName:  varchar('display_name', { length: 100 }).notNull(),
  avatar:       varchar('avatar', { length: 255 }),
  isAdmin:      boolean('is_admin').default(false).notNull(),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
});

export const games = pgTable('games', {
  id:          uuid('id').defaultRandom().primaryKey(),
  bgioMatchId: varchar('bgio_match_id', { length: 100 }).notNull().unique(),
  scenarioId:  varchar('scenario_id', { length: 50 }).notNull(),
  status:      varchar('status', { length: 20 }).notNull().default('waiting'),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
});

export const gamePlayers = pgTable('game_players', {
  id:          uuid('id').defaultRandom().primaryKey(),
  gameId:      uuid('game_id').references(() => games.id).notNull(),
  userId:      uuid('user_id').references(() => users.id).notNull(),
  playerIndex: smallint('player_index').notNull(),
  faction:     varchar('faction', { length: 50 }),
  result:      varchar('result', { length: 20 }),
}, (t) => [
  unique('uniq_game_player').on(t.gameId, t.playerIndex),
]);

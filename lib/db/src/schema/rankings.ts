import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import type { z } from 'zod/v4';

export const playersTable = pgTable('sudoku_players', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
export const rankedGamesTable = pgTable('sudoku_ranked_games', {
  id: uuid('id').primaryKey(),
  playerId: uuid('player_id').notNull().references(() => playersTable.id),
  size: integer('size').notNull(),
  difficulty: text('difficulty').notNull(),
  puzzle: jsonb('puzzle').$type<number[]>().notNull(),
  solution: jsonb('solution').$type<number[]>().notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  elapsedMs: integer('elapsed_ms'),
}, (table) => [
  index('sudoku_ranked_player_start').on(table.playerId, table.startedAt),
  index('sudoku_ranked_period').on(table.size, table.difficulty, table.completedAt),
]);
export const insertPlayerSchema = createInsertSchema(playersTable);
export const insertRankedGameSchema = createInsertSchema(rankedGamesTable);
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type InsertRankedGame = z.infer<typeof insertRankedGameSchema>;

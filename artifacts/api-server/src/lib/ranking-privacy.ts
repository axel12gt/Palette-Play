import { sql } from 'drizzle-orm';
import { db } from '@workspace/db';
import { rankingPeriod } from './ranking-rules';

// Retention and leaderboard resets share Eastern calendar boundaries.
export const rankingCutoff = (now = new Date()) =>
  rankingPeriod('monthly', now).start;

// Shared locks keep issuance/deletion safe while the hourly sweep takes an exclusive lock.
export const rankingWriteLock = sql`select pg_advisory_xact_lock_shared(hashtext('sudoku-ranking-retention'))`;
let nextSweep = 0;
let running: Promise<void> | null = null;

export async function purgeExpiredRankingData(now = new Date()): Promise<void> {
  const cutoff = rankingCutoff(now);
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('sudoku-ranking-retention'))`);
    await tx.execute(sql`delete from sudoku_ranked_games
      where coalesce(completed_at, started_at) < ${cutoff}`);
    await tx.execute(sql`delete from sudoku_players p where p.created_at < ${cutoff}
      and not exists (select 1 from sudoku_ranked_games g where g.player_id = p.id)`);
  });
}

export function cleanupRankingDataIfDue(): Promise<void> {
  if (running) return running;
  if (Date.now() < nextSweep) return Promise.resolve();
  running = purgeExpiredRankingData().then(() => {
    const now = new Date();
    const nextMonth = rankingPeriod('monthly', now).end.getTime();
    // The first request in a new month triggers cleanup even if the last sweep
    // was less than an hour ago.
    nextSweep = Math.min(now.getTime() + 3600000, nextMonth);
  }).finally(() => { running = null; });
  return running;
}

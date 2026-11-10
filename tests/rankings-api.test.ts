import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import app from '../artifacts/api-server/src/app';
import { pool } from '../lib/db/src/index';
import { solvePuzzle } from '../lib/sudoku/src/index';
import { rankingPeriod } from '../artifacts/api-server/src/lib/ranking-rules';
import { purgeExpiredRankingData, rankingCutoff } from '../artifacts/api-server/src/lib/ranking-privacy';

test('ranked API validates owner, solution, expiry, server timing, duplicates and period rankings', async () => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}/api`;
  const players: string[] = [];
  const call = async (path: string, method = 'GET', data?: unknown, token?: string) => {
    const response = await fetch(`${base}${path}`, {
      method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    return { status: response.status, body: response.status === 204 ? null : await response.json() };
  };
  try {
    const a = await call('/players', 'POST'), b = await call('/players', 'POST');
    assert.equal(a.status, 201); assert.equal(b.status, 201);
    players.push(a.body.id, b.body.id);
    assert.ok(!('tokenHash' in a.body));
    const input = { size: 4, difficulty: 'very-easy' };
    assert.equal((await call('/ranked-games', 'POST', input)).status, 401);
    assert.equal((await call('/ranked-games', 'POST', { ...input, size: 5 }, a.body.token)).status, 400);
    const issued = await call('/ranked-games', 'POST', input, a.body.token);
    assert.equal(issued.status, 201);
    assert.ok(!('solution' in issued.body));
    const solution = solvePuzzle(issued.body.puzzle, 4)!;
    assert.equal((await call(`/ranked-games/${issued.body.id}/complete`, 'POST', { board: solution }, b.body.token)).status, 404);
    assert.equal((await call(`/ranked-games/${issued.body.id}/complete`, 'POST', { board: [] }, a.body.token)).status, 400);
    assert.equal((await call(`/ranked-games/${issued.body.id}/complete`, 'POST', { board: Array(16).fill(1) }, a.body.token)).status, 400);
    await pool.query(`UPDATE sudoku_ranked_games SET started_at = now() - interval '10 seconds' WHERE id = $1`, [issued.body.id]);
    const results = await Promise.all([0, 1].map(() => call(`/ranked-games/${issued.body.id}/complete`, 'POST',
      { board: solution, elapsedMs: 1 }, a.body.token)));
    for (const result of results) { assert.equal(result.status, 200); assert.ok(result.body.elapsedMs >= 10000); }
    assert.equal(results[0].body.elapsedMs, results[1].body.elapsedMs);
    const [{ count }] = (await pool.query('SELECT count(*)::int AS count FROM sudoku_ranked_games WHERE player_id=$1 AND completed_at IS NOT NULL', [a.body.id])).rows;
    assert.equal(count, 1);
    const expired = await call('/ranked-games', 'POST', input, a.body.token);
    await pool.query(`UPDATE sudoku_ranked_games SET started_at = now() - interval '8 days', expires_at = now() - interval '1 day' WHERE id=$1`, [expired.body.id]);
    assert.equal((await call(`/ranked-games/${expired.body.id}/complete`, 'POST',
      { board: solvePuzzle(expired.body.puzzle, 4) }, a.body.token)).status, 410);
    const board = await call('/leaderboards?size=4&difficulty=very-easy&kind=weekly', 'GET', undefined, a.body.token);
    assert.equal(board.status, 200); assert.equal(board.body.ownRank.playerId, a.body.id);
    assert.equal(board.body.ownRank.value, 1);
    const otherMode = await call('/leaderboards?size=6&difficulty=very-easy&kind=weekly', 'GET', undefined, a.body.token);
    assert.equal(otherMode.body.ownRank, null);
    const otherLevel = await call('/leaderboards?size=4&difficulty=expert&kind=weekly', 'GET', undefined, a.body.token);
    assert.equal(otherLevel.body.ownRank, null);
    const bGame = await call('/ranked-games', 'POST', input, b.body.token);
    await pool.query(`UPDATE sudoku_ranked_games SET started_at=now()-interval '10 seconds' WHERE id=$1`, [bGame.body.id]);
    await call(`/ranked-games/${bGame.body.id}/complete`, 'POST', { board: solvePuzzle(bGame.body.puzzle, 4) }, b.body.token);
    // Set identical server fixture times to verify deterministic tied standings.
    await pool.query('UPDATE sudoku_ranked_games SET elapsed_ms=12000 WHERE player_id = ANY($1::uuid[]) AND completed_at IS NOT NULL', [players]);
    const ties = await call('/leaderboards?size=4&difficulty=very-easy&kind=speed', 'GET', undefined, b.body.token);
    assert.equal(ties.body.entries.find((e: any) => e.playerId === a.body.id).rank, ties.body.ownRank.rank);
    assert.equal(ties.body.ownRank.value, 12000);
    // Move only our fixture to just before this week's boundary: monthly totals include it when applicable.
    const period = rankingPeriod('weekly');
    const previousWeek = new Date(period.start.getTime() - 1);
    await pool.query('UPDATE sudoku_ranked_games SET completed_at=$1 WHERE id=$2', [previousWeek, bGame.body.id]);
    const reset = await call('/leaderboards?size=4&difficulty=very-easy&kind=weekly', 'GET', undefined, b.body.token);
    assert.equal(reset.body.ownRank, null);
    const month = await call('/leaderboards?size=4&difficulty=very-easy&kind=monthly', 'GET', undefined, b.body.token);
    assert.equal(month.body.ownRank?.value ?? 0, previousWeek >= rankingPeriod('monthly').start ? 1 : 0);
    const speedReset = await call('/leaderboards?size=4&difficulty=very-easy&kind=speed', 'GET', undefined, b.body.token);
    assert.equal(speedReset.body.ownRank, null);
    assert.equal((await call('/leaderboards?size=4&difficulty=very-easy&kind=unknown')).status, 400);
    const fresh = await call('/ranked-games', 'POST', input, a.body.token);
    // Guaranteed too-short server time, regardless of how long the test client takes.
    await pool.query(`UPDATE sudoku_ranked_games SET started_at=now()+interval '1 second' WHERE id=$1`, [fresh.body.id]);
    assert.equal((await call(`/ranked-games/${fresh.body.id}/complete`, 'POST',
      { board: solvePuzzle(fresh.body.puzzle, 4) }, a.body.token)).status, 400);

    // Deletion is authenticated, self-scoped, transactional and retryable.
    assert.equal((await call('/players/me', 'DELETE')).status, 401);
    assert.equal((await call('/players/me', 'DELETE', undefined, 'invalid')).status, 401);
    assert.equal((await call('/players/me', 'DELETE', undefined, a.body.token)).status, 204);
    assert.equal((await call('/players/me', 'DELETE', undefined, a.body.token)).status, 204);
    assert.equal((await pool.query('SELECT id FROM sudoku_players WHERE id=$1', [a.body.id])).rowCount, 0);
    assert.equal((await pool.query('SELECT id FROM sudoku_ranked_games WHERE player_id=$1', [a.body.id])).rowCount, 0);
    assert.equal((await pool.query('SELECT id FROM sudoku_players WHERE id=$1', [b.body.id])).rowCount, 1);
    assert.equal((await call('/ranked-games', 'POST', input, a.body.token)).status, 401);
    const afterDelete = await call('/leaderboards?size=4&difficulty=very-easy&kind=weekly');
    assert.ok(!afterDelete.body.entries.some((entry: { playerId: string }) => entry.playerId === a.body.id));

    // Sweep boundary: previous-month results and idle profiles go; midnight on day one is retained.
    const c = await call('/players', 'POST'), d = await call('/players', 'POST');
    players.push(c.body.id, d.body.id);
    const old = await call('/ranked-games', 'POST', input, c.body.token);
    const recent = await call('/ranked-games', 'POST', input, d.body.token);
    const now = new Date(), cutoff = rankingCutoff(now);
    assert.equal(cutoff.toISOString(), rankingPeriod('monthly', now).start.toISOString());
    for (const [date, expected] of [
      ['2028-02-29T23:59:59.999Z', '2028-02-01T05:00:00.000Z'],
      ['2028-03-01T00:00:00.000Z', '2028-02-01T05:00:00.000Z'],
      ['2027-01-01T00:00:00.000Z', '2026-12-01T05:00:00.000Z'],
      ['2026-12-31T23:59:59.999Z', '2026-12-01T05:00:00.000Z'],
      ['2026-11-01T00:30:00+02:00', '2026-10-01T04:00:00.000Z'],
      ['2026-11-01T03:59:59.999Z', '2026-10-01T04:00:00.000Z'],
      ['2026-11-01T04:00:00.000Z', '2026-11-01T04:00:00.000Z'],
      ['2027-01-01T05:00:00.000Z', '2027-01-01T05:00:00.000Z'],
    ]) assert.equal(rankingCutoff(new Date(date)).toISOString(), expected);
    await pool.query('UPDATE sudoku_players SET created_at=$1 WHERE id=ANY($2::uuid[])',
      [new Date(cutoff.getTime() - 86400000), [c.body.id, d.body.id]]);
    await pool.query('UPDATE sudoku_ranked_games SET started_at=$1, completed_at=$1, elapsed_ms=10000 WHERE id=$2',
      [new Date(cutoff.getTime() - 1), old.body.id]);
    await pool.query('UPDATE sudoku_ranked_games SET started_at=$1 WHERE id=$2',
      [cutoff, recent.body.id]);
    await purgeExpiredRankingData(now);
    assert.equal((await pool.query('SELECT id FROM sudoku_players WHERE id=$1', [c.body.id])).rowCount, 0);
    assert.equal((await pool.query('SELECT id FROM sudoku_ranked_games WHERE id=$1', [old.body.id])).rowCount, 0);
    assert.equal((await pool.query('SELECT id FROM sudoku_players WHERE id=$1', [d.body.id])).rowCount, 1);
    assert.equal((await pool.query('SELECT id FROM sudoku_ranked_games WHERE id=$1', [recent.body.id])).rowCount, 1);
    assert.equal((await call('/players/me', 'DELETE', undefined, c.body.token)).status, 204);

    // A previous-month unfinished puzzle cannot become a current-month score,
    // even before the next physical sweep and even with a future expiry.
    const monthExpired = await call('/ranked-games', 'POST', input, d.body.token);
    await pool.query('UPDATE sudoku_ranked_games SET started_at=$1 WHERE id=$2',
      [new Date(cutoff.getTime() - 1), monthExpired.body.id]);
    assert.equal((await call(`/ranked-games/${monthExpired.body.id}/complete`, 'POST',
      { board: solvePuzzle(monthExpired.body.puzzle, 4) }, d.body.token)).status, 410);

    // Deletion racing issuance must not recreate a profile or leave orphan games.
    const e = await call('/players', 'POST');
    players.push(e.body.id);
    const racing = await Promise.all([
      call('/ranked-games', 'POST', input, e.body.token),
      call('/players/me', 'DELETE', undefined, e.body.token),
    ]);
    assert.ok([201, 401].includes(racing[0].status));
    assert.equal(racing[1].status, 204);
    assert.equal((await pool.query('SELECT id FROM sudoku_ranked_games WHERE player_id=$1', [e.body.id])).rowCount, 0);
  } finally {
    await pool.query('DELETE FROM sudoku_ranked_games WHERE player_id=ANY($1::uuid[])', [players]);
    await pool.query('DELETE FROM sudoku_players WHERE id=ANY($1::uuid[])', [players]);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  }
});

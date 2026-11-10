import { Router, type Request, type IRouter } from 'express';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { and, eq, gte, isNull, sql } from 'drizzle-orm';
import { db, pool, playersTable, rankedGamesTable } from '@workspace/db';
import { generatePuzzle } from '@workspace/sudoku';
import {
  RegisterPlayerResponse, StartRankedGameBody, StartRankedGameResponse,
  CompleteRankedGameParams, CompleteRankedGameBody, CompleteRankedGameResponse,
  GetLeaderboardQueryParams, GetLeaderboardResponse,
} from '@workspace/api-zod';
import { matchesSolution, rankingPeriod } from '../lib/ranking-rules';
import { cleanupRankingDataIfDue, rankingCutoff, rankingWriteLock } from '../lib/ranking-privacy';

const router: IRouter = Router();
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const bearerFor = (req: Request) => req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
async function playerFor(req: Request) {
  const bearer = bearerFor(req);
  if (!bearer) return null;
  const [player] = await db.select({ id: playersTable.id, name: playersTable.name })
    .from(playersTable).where(eq(playersTable.tokenHash, hash(bearer))).limit(1);
  return player ?? null;
}
router.use(async (_req, _res, next): Promise<void> => {
  await cleanupRankingDataIfDue();
  next();
});
router.delete('/players/me', async (req, res): Promise<void> => {
  const bearer = bearerFor(req);
  if (!bearer) { res.status(401).json({ error: 'The device ranking token is required.' }); return; }
  await db.transaction(async (tx) => {
    await tx.execute(rankingWriteLock);
    const [player] = await tx.select({ id: playersTable.id }).from(playersTable)
      .where(eq(playersTable.tokenHash, hash(bearer))).limit(1);
    if (!player) return; // Idempotent after an interrupted request.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${player.id}))`);
    await tx.delete(rankedGamesTable).where(eq(rankedGamesTable.playerId, player.id));
    await tx.delete(playersTable).where(eq(playersTable.id, player.id));
  });
  res.status(204).send();
});
// Bound work/memory from anonymous requests. Database limits also constrain authenticated issuance.
const limits = new Map<string, { count: number; until: number }>();
function allow(key: string, max: number) {
  const now = Date.now();
  for (const [key, value] of limits) if (value.until <= now) limits.delete(key);
  const value = limits.get(key) ?? { count: 0, until: now + 3600000 };
  value.count++;
  limits.set(key, value);
  return value.count <= max;
}
router.post('/players', async (req, res): Promise<void> => {
  if (!allow(`register:${req.ip}`, 100)) { res.status(429).json({ error: 'Too many new players. Try again later.' }); return; }
  const token = randomBytes(32).toString('hex'), id = randomUUID();
  const names = ['Coral', 'Teal', 'Amber', 'Indigo', 'Mint', 'Rose'];
  const name = `${names[randomBytes(1)[0] % names.length]} Owl ${id.slice(0, 8).toUpperCase()}`;
  await db.insert(playersTable).values({ id, name, tokenHash: hash(token) });
  res.status(201).json(RegisterPlayerResponse.parse({ id, name, token }));
});
router.post('/ranked-games', async (req, res): Promise<void> => {
  const body = StartRankedGameBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: 'Choose a valid board size and difficulty.' }); return; }
  const player = await playerFor(req);
  if (!player) { res.status(401).json({ error: 'Your player identity is unavailable.' }); return; }
  if (!allow(`issue:${req.ip}`, 300)) { res.status(429).json({ error: 'Too many puzzle requests. Try again later.' }); return; }
  // Serialize per-player issuance so parallel requests cannot bypass the persisted cap.
  const issued = await db.transaction(async (tx) => {
    await tx.execute(rankingWriteLock);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${player.id}))`);
    const [stillExists] = await tx.select({ id: playersTable.id }).from(playersTable)
      .where(eq(playersTable.id, player.id)).limit(1);
    if (!stillExists) return 'deleted' as const;
    const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(rankedGamesTable)
      .where(and(eq(rankedGamesTable.playerId, player.id), gte(rankedGamesTable.startedAt, new Date(Date.now() - 3600000))));
    if (count >= 30) return null;
    const { size, difficulty } = body.data;
    const puzzle = generatePuzzle(difficulty, randomBytes(24).toString('hex'), size);
    const startedAt = new Date(), expiresAt = new Date(startedAt.getTime() + 7 * 86400000), id = randomUUID();
    await tx.insert(rankedGamesTable).values({ id, playerId: player.id, size, difficulty,
      puzzle: puzzle.puzzle, solution: puzzle.solution, startedAt, expiresAt });
    return { id, puzzle: puzzle.puzzle, size, difficulty, startedAt: startedAt.toISOString(), expiresAt: expiresAt.toISOString() };
  });
  if (issued === 'deleted') { res.status(401).json({ error: 'This ranking profile has been deleted.' }); return; }
  if (!issued) { res.status(429).json({ error: 'You can start up to 30 ranked puzzles per hour.' }); return; }
  res.status(201).json(StartRankedGameResponse.parse(issued));
});
router.post('/ranked-games/:id/complete', async (req, res): Promise<void> => {
  const params = CompleteRankedGameParams.safeParse(req.params), body = CompleteRankedGameBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: 'Invalid completion.' }); return; }
  const player = await playerFor(req);
  if (!player) { res.status(401).json({ error: 'Player identity required.' }); return; }
  if (!allow(`submit:${player.id}`, 300)) { res.status(429).json({ error: 'Too many submissions.' }); return; }
  const [game] = await db.select().from(rankedGamesTable).where(and(
    eq(rankedGamesTable.id, params.data.id), eq(rankedGamesTable.playerId, player.id))).limit(1);
  if (!game) { res.status(404).json({ error: 'Ranked puzzle not found.' }); return; }
  const cutoff = rankingCutoff();
  if ((game.completedAt ?? game.startedAt) < cutoff) {
    res.status(410).json({ error: 'This ranked puzzle expired at the calendar-month reset.' }); return;
  }
  if (!matchesSolution(body.data.board, game.puzzle, game.solution)) { res.status(400).json({ error: 'The board does not solve this puzzle.' }); return; }
  // Retried successful requests are idempotent: never count twice.
  if (game.completedAt && game.elapsedMs !== null) {
    res.json(CompleteRankedGameResponse.parse({ accepted: true, elapsedMs: game.elapsedMs })); return;
  }
  const now = new Date(), elapsedMs = now.getTime() - game.startedAt.getTime();
  if (now >= game.expiresAt) { res.status(410).json({ error: 'This ranked puzzle expired after seven days.' }); return; }
  if (elapsedMs < 1000) { res.status(400).json({ error: 'Completion time is too short.' }); return; }
  const [recorded] = await db.update(rankedGamesTable).set({ completedAt: now, elapsedMs })
    .where(and(eq(rankedGamesTable.id, game.id), isNull(rankedGamesTable.completedAt)))
    .returning({ elapsedMs: rankedGamesTable.elapsedMs });
  if (!recorded) {
    const [existing] = await db.select({ elapsedMs: rankedGamesTable.elapsedMs }).from(rankedGamesTable).where(eq(rankedGamesTable.id, game.id));
    if (!existing) { res.status(410).json({ error: 'This ranked puzzle is no longer available.' }); return; }
    res.json(CompleteRankedGameResponse.parse({ accepted: true, elapsedMs: existing.elapsedMs })); return;
  }
  res.json(CompleteRankedGameResponse.parse({ accepted: true, elapsedMs: recorded.elapsedMs }));
});
router.get('/leaderboards', async (req, res): Promise<void> => {
  // Numeric enum unions are not coerced by codegen. Normalize the query boundary explicitly.
  const query = GetLeaderboardQueryParams.safeParse({
    ...req.query,
    size: typeof req.query.size === 'string' && /^[469]$/.test(req.query.size)
      ? Number(req.query.size) : req.query.size,
  });
  if (!query.success) { res.status(400).json({ error: 'Invalid leaderboard filters.' }); return; }
  const { size, difficulty, kind } = query.data;
  const player = await playerFor(req);
  const { start, end } = rankingPeriod(kind);
  const retainedStart = new Date(Math.max(start.getTime(), rankingCutoff().getTime()));
  // Only the aggregate expression/order are dynamic, from this fixed allowlist.
  const metric = kind === 'speed' ? 'MIN(g.elapsed_ms)' : 'COUNT(*)';
  const order = kind === 'speed' ? 'ASC' : 'DESC';
  const result = await pool.query(`
    WITH totals AS (
      SELECT p.id AS "playerId", p.name, ${metric}::int AS value
      FROM sudoku_ranked_games g JOIN sudoku_players p ON p.id = g.player_id
      WHERE g.size = $1 AND g.difficulty = $2 AND g.completed_at >= $3 AND g.completed_at < $4
      GROUP BY p.id, p.name
    ), ranked AS (
      SELECT *, DENSE_RANK() OVER (ORDER BY value ${order})::int AS rank FROM totals
    )
    SELECT * FROM ranked WHERE "playerId" IN
      (SELECT "playerId" FROM ranked ORDER BY rank, "playerId" LIMIT 100)
      OR "playerId" = $5 ORDER BY rank, "playerId"
  `, [size, difficulty, retainedStart, end, player?.id ?? null]);
  const ownRank = result.rows.find((row) => row.playerId === player?.id) ?? null;
  res.json(GetLeaderboardResponse.parse({ kind, periodStart: start.toISOString(), periodEnd: end.toISOString(),
    entries: result.rows.filter((row) => row.rank <= 100).slice(0, 100), ownRank }));
});
export default router;

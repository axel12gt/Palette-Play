export type RankingKind = 'weekly' | 'monthly' | 'speed';

// Periods are half-open UTC ranges, with weeks starting Monday at 00:00.
export function rankingPeriod(kind: RankingKind, now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (kind === 'monthly') start.setUTCDate(1);
  else start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  const end = new Date(start);
  if (kind === 'monthly') end.setUTCMonth(end.getUTCMonth() + 1);
  else end.setUTCDate(end.getUTCDate() + 7);
  return { start, end };
}

export function matchesSolution(board: number[], puzzle: number[], solution: number[]): boolean {
  return board.length === solution.length && board.every((value, index) =>
    Number.isInteger(value) && value === solution[index] &&
    (!puzzle[index] || value === puzzle[index]));
}

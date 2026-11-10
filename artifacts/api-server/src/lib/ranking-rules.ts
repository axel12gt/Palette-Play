export type RankingKind = 'weekly' | 'monthly' | 'speed';

export const RANKING_TIME_ZONE = 'America/New_York';
const easternClock = new Intl.DateTimeFormat('en-US', {
  timeZone: RANKING_TIME_ZONE, hourCycle: 'h23',
  year: 'numeric', month: 'numeric', day: 'numeric',
  hour: 'numeric', minute: 'numeric', second: 'numeric',
});

function easternParts(date: Date) {
  const parts = Object.fromEntries(easternClock.formatToParts(date)
    .filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
  return { year: parts.year, month: parts.month, day: parts.day,
    hour: parts.hour, minute: parts.minute, second: parts.second };
}

// Calendar arithmetic is done on a date-only UTC carrier, then each boundary
// is converted separately to New York midnight. A DST week is not always 168 hours.
function easternMidnight(calendarDate: Date): Date {
  const target = calendarDate.getTime();
  let instant = target;
  for (let attempt = 0; attempt < 3; attempt++) {
    const parts = easternParts(new Date(instant));
    const rendered = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const correction = target - rendered;
    instant += correction;
    if (correction === 0) break;
  }
  return new Date(instant);
}

// Half-open Eastern calendar periods; weeks start Monday at midnight EST/EDT.
export function rankingPeriod(kind: RankingKind, now = new Date()) {
  const parts = easternParts(now);
  const start = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (kind === 'monthly') start.setUTCDate(1);
  else start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  const end = new Date(start);
  if (kind === 'monthly') end.setUTCMonth(end.getUTCMonth() + 1);
  else end.setUTCDate(end.getUTCDate() + 7);
  return { start: easternMidnight(start), end: easternMidnight(end) };
}

export function matchesSolution(board: number[], puzzle: number[], solution: number[]): boolean {
  return board.length === solution.length && board.every((value, index) =>
    Number.isInteger(value) && value === solution[index] &&
    (!puzzle[index] || value === puzzle[index]));
}

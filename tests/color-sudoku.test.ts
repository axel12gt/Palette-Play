import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boardModes, countSolutions, difficulties, generatePuzzle, getCandidates, isPlacementValid, solvePuzzle } from '../lib/sudoku/src/index';
import { buildGame, detachOnlineRankings, parseSavedGame, snapshot } from '../artifacts/color-sudoku-mobile/lib/game-state';
import { rankingPeriod, matchesSolution } from '../artifacts/api-server/src/lib/ranking-rules';

test('online deletion preserves offline board, notes, timer, history and earned themes', () => {
  const game = buildGame('medium', 'pastel', null, 6, 6);
  const index = game.board.indexOf(0);
  game.notes[index] = [1, 3];
  game.history.push(snapshot(game));
  game.board[index] = game.solution[index];
  game.elapsedSeconds = 83;
  game.rankedId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  game.pendingResults = [{ id: game.rankedId, board: [...game.solution] }];
  game.rankingAccepted = true;
  const offline = detachOnlineRankings(game);
  assert.deepEqual(offline.board, game.board);
  assert.deepEqual(offline.notes, game.notes);
  assert.deepEqual(offline.history, game.history);
  assert.equal(offline.theme, game.theme);
  assert.equal(offline.completedGames, game.completedGames);
  assert.equal(offline.elapsedSeconds, game.elapsedSeconds);
  assert.equal(offline.rankedId, null);
  assert.deepEqual(offline.pendingResults, []);
  assert.equal(offline.rankingAccepted, false);
  assert.equal(game.rankedId, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
});

for (const mode of boardModes) {
  for (const level of difficulties) {
    test(`${mode.size}×${mode.size} ${level.label}: seeded generation and unique solutions`, () => {
      for (let seed = 0; seed < 5; seed++) {
        const puzzle = generatePuzzle(level.id, `regression-${seed}`, mode.size);
        assert.equal(puzzle.puzzle.length, mode.size ** 2);
        assert.equal(countSolutions(puzzle.puzzle, 2, mode.size), 1);
        assert.deepEqual(solvePuzzle(puzzle.puzzle, mode.size), puzzle.solution);
        assert.deepEqual(generatePuzzle(level.id, `regression-${seed}`, mode.size), puzzle);
        for (let i = 0; i < puzzle.solution.length; i++) {
          assert.ok(isPlacementValid(puzzle.solution, i, puzzle.solution[i], mode.size));
          if (puzzle.puzzle[i]) assert.equal(puzzle.puzzle[i], puzzle.solution[i]);
          else assert.ok(getCandidates(puzzle.puzzle, i, mode.size).includes(puzzle.solution[i]));
        }
        assert.ok(puzzle.puzzle.includes(0));
      }
    });
  }
  test(`${mode.size}×${mode.size}: round-trip board, notes, undo, timer, paused home and ranked ticket`, () => {
    const game = buildGame('medium', 'classic', null, 3, mode.size);
    const i = game.board.indexOf(0);
    game.history.push(snapshot(game));
    game.notes[i] = [1, 2];
    game.elapsedSeconds = 79;
    game.selectedCell = i; game.selectedColor = 2; game.notesMode = true;
    game.rankedId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    game.pendingResults = [{ id: 'bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee', board: [...game.solution] }];
    const restored = parseSavedGame(JSON.stringify(game));
    assert.equal(restored.screen, 'home');
    assert.equal(restored.paused, true);
    assert.equal(restored.elapsedSeconds, 79);
    assert.equal(restored.size, mode.size);
    assert.deepEqual(restored.board, game.board);
    assert.deepEqual(restored.notes, game.notes);
    assert.deepEqual(restored.history, game.history);
    assert.equal(restored.rankedId, game.rankedId);
    assert.equal(restored.selectedCell, i);
    assert.equal(restored.selectedColor, 2);
    assert.equal(restored.notesMode, true);
    assert.equal(restored.completedGames, 3);
    assert.deepEqual(restored.pendingResults, game.pendingResults);
  });
}
test('strict save validation rejects damaged values and changed starting clues', () => {
  const game = buildGame('easy', 'classic', null, 0, 4);
  for (const bad of [null, {}, { ...game, board: [0] }, { ...game, elapsedSeconds: -2 },
    { ...game, notes: game.notes.map(() => [8]) }, { ...game, theme: 'unknown' },
    { ...game, solution: Array(16).fill(1) }]) {
    assert.throws(() => parseSavedGame(JSON.stringify(bad)));
  }
  const clue = game.clues.findIndex(Boolean);
  game.board[clue] = 0;
  assert.throws(() => parseSavedGame(JSON.stringify(game)));
});
test('legacy 9×9 saves migrate without losing progress', () => {
  const game: any = buildGame('easy', 'classic', null, 2, 9);
  delete game.size; delete game.screen; delete game.rankedId; delete game.hasPuzzle;
  const saved = parseSavedGame(JSON.stringify(game));
  assert.equal(saved.size, 9); assert.equal(saved.hasPuzzle, true);
  assert.deepEqual(saved.board, game.board);
});
test('invalid grids, wrong completions and conflicting rows cannot pass validation', () => {
  assert.equal(countSolutions(Array(16).fill(1), 2, 4), 0);
  assert.equal(countSolutions([0], 2, 4), 0);
  const puzzle = generatePuzzle('expert', 'invalid-test', 6);
  assert.ok(matchesSolution(puzzle.solution, puzzle.puzzle, puzzle.solution));
  assert.equal(matchesSolution(puzzle.puzzle, puzzle.puzzle, puzzle.solution), false);
  assert.equal(matchesSolution([], puzzle.puzzle, puzzle.solution), false);
});
test('Eastern weeks start Monday, months roll over, boundaries and leap day are correct', () => {
  const week = rankingPeriod('weekly', new Date('2026-11-08T23:59:59.999Z'));
  assert.equal(week.start.toISOString(), '2026-11-02T05:00:00.000Z');
  assert.equal(week.end.toISOString(), '2026-11-09T05:00:00.000Z');
  assert.equal(rankingPeriod('speed', week.end).start.toISOString(), week.end.toISOString());
  const year = rankingPeriod('monthly', new Date('2026-12-31T23:59:59.999Z'));
  assert.equal(year.end.toISOString(), '2027-01-01T05:00:00.000Z');
  assert.equal(rankingPeriod('monthly', new Date('2028-02-29')).end.toISOString(), '2028-03-01T05:00:00.000Z');
  // UTC midnight does not prematurely advance the Eastern month or week.
  assert.equal(rankingPeriod('monthly', new Date('2027-01-01T04:59:59.999Z')).start.toISOString(), '2026-12-01T05:00:00.000Z');
  assert.equal(rankingPeriod('monthly', new Date('2027-01-01T05:00:00.000Z')).start.toISOString(), '2027-01-01T05:00:00.000Z');
  assert.equal(rankingPeriod('weekly', new Date('2026-07-06T03:59:59.999Z')).end.toISOString(), '2026-07-06T04:00:00.000Z');
  assert.equal(rankingPeriod('weekly', new Date('2026-07-06T04:00:00.000Z')).start.toISOString(), '2026-07-06T04:00:00.000Z');
});
test('Eastern reset boundaries follow daylight saving in both directions', () => {
  const spring = rankingPeriod('weekly', new Date('2026-03-08T12:00:00Z'));
  assert.equal(spring.start.toISOString(), '2026-03-02T05:00:00.000Z');
  assert.equal(spring.end.toISOString(), '2026-03-09T04:00:00.000Z');
  assert.equal(spring.end.getTime() - spring.start.getTime(), 167 * 3600000);
  const fall = rankingPeriod('speed', new Date('2026-11-01T12:00:00Z'));
  assert.equal(fall.start.toISOString(), '2026-10-26T04:00:00.000Z');
  assert.equal(fall.end.toISOString(), '2026-11-02T05:00:00.000Z');
  assert.equal(fall.end.getTime() - fall.start.getTime(), 169 * 3600000);
  const march = rankingPeriod('monthly', new Date('2026-03-15T12:00:00Z'));
  assert.equal(march.start.toISOString(), '2026-03-01T05:00:00.000Z');
  assert.equal(march.end.toISOString(), '2026-04-01T04:00:00.000Z');
  const november = rankingPeriod('monthly', new Date('2026-11-15T12:00:00Z'));
  assert.equal(november.start.toISOString(), '2026-11-01T04:00:00.000Z');
  assert.equal(november.end.toISOString(), '2026-12-01T05:00:00.000Z');
});

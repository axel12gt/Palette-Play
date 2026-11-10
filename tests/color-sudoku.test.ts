import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boardModes, countSolutions, difficulties, generatePuzzle, getCandidates, isPlacementValid, solvePuzzle } from '../lib/sudoku/src/index';
import { buildGame, parseSavedGame, snapshot } from '../artifacts/color-sudoku-mobile/lib/game-state';
import { rankingPeriod, matchesSolution } from '../artifacts/api-server/src/lib/ranking-rules';

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
test('UTC weeks start Monday, months roll over, boundaries and leap day are correct', () => {
  const week = rankingPeriod('weekly', new Date('2026-11-08T23:59:59.999Z'));
  assert.equal(week.start.toISOString(), '2026-11-02T00:00:00.000Z');
  assert.equal(week.end.toISOString(), '2026-11-09T00:00:00.000Z');
  assert.equal(rankingPeriod('speed', week.end).start.toISOString(), week.end.toISOString());
  const year = rankingPeriod('monthly', new Date('2026-12-31T23:59:59.999Z'));
  assert.equal(year.end.toISOString(), '2027-01-01T00:00:00.000Z');
  assert.equal(rankingPeriod('monthly', new Date('2028-02-29')).end.toISOString(), '2028-03-01T00:00:00.000Z');
});

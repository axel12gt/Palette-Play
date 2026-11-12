# Palette Play — standalone HTML edition

Build from the repository root:

```sh
node artifacts/color-sudoku/standalone/build.mjs
```

Open `generated-artifacts/Palette-Play.html` in a browser. It is one self-contained
HTML file with bundled JavaScript and CSS; it needs no server, installation,
internet connection, ad SDK, Stripe, RevenueCat, or account. JavaScript must be
enabled. You can also host the file on any static web server.

This edition reuses the existing web game's 9×9 board, five difficulty levels,
daily puzzle, notes, color highlighting, drag/tap controls, undo, pause, and earned
themes. Hints are free. It does not include the native app's 4×4 / 6×6 boards or
online leaderboards. No online score is created or uploaded.

Progress uses separate browser-local storage keys and does not overwrite the
existing web or mobile save. Local file storage behavior depends on the browser;
keep using the same file/browser, or serve it from a stable static URL for more
predictable persistence. A visible warning appears if storage is unavailable.
Clearing browser data removes saved progress.

The build also writes a preview copy at
`artifacts/color-sudoku/public/palette-play-offline.html`. Both generated files are
excluded from Git; rerun the build to regenerate them. The original game and
mobile monetization plans remain unchanged.

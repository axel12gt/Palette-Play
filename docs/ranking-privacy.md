# Ranking privacy and retention

The owner selected **the current UTC calendar month** for online ranking data retention.

## Data and visibility

Offline practice, puzzle moves, pencil marks, elapsed practice time and earned themes are saved on the device.
Opening Rankings or starting ranked play registers a pseudonymous player with a random display name.
The device stores a bearer key; the ranking database stores only its SHA-256 hash.
The database also stores server-issued puzzles and solutions, mode and difficulty, issuance/expiry/completion timestamps and elapsed ranked time.
Public rankings expose the random display name, player ID, standing and aggregate solve count or best time.
The game does not ask for names, email addresses, dates of birth or locations.

## Retention

Completed records are retained for the UTC calendar month of completion, not a rolling number of days.
They expire at 00:00 UTC on the first of the next month, including results earned on the final day.
Unfinished games expire at the same boundary based on issuance month, or after seven days, whichever comes first.
Leaderboard queries exclude previous-month results even between cleanup runs.
Cleanup runs on server startup, hourly while running, and before ranking requests if due;
the first ranking request in a new month always triggers a sweep.
It deletes expired games and then profiles created before the current month with no retained games.
If the server is stopped, overdue records are removed on its next startup/request.
Cleanup failure is logged and ranking requests fail rather than claiming cleanup succeeded.

Monthly rankings are calendar-month UTC rankings.
Weekly completion and speed rankings are intersected with the current month: they lose previous-month
results at month rollover even if the week has not ended. This is disclosed in the app.

## Immediate deletion

Add-ons → Privacy & online data explains the consequences and requires confirmation.
`DELETE /api/players/me` requires the device bearer key and atomically deletes only that player's games and profile.
The operation is idempotent so a lost response can be retried with the same key.
The app records deletion intent before contacting the server and keeps the key if deletion fails.
After deletion it clears ranking credentials/cache, detaches the saved board from ranking,
and removes queued submissions without deleting local puzzle progress or theme unlocks.
Online rankings stay disabled until the player explicitly enables them. A replacement profile cannot recover deleted results.
Lost device storage has no email recovery; old inaccessible profiles expire under the same retention policy.

These controls cover the application's live ranking database. They do not purge infrastructure logs,
database backups or previously downloaded copies of public rankings.
This explanation is not a store-compliance certification or a substitute for a release privacy-policy review.
Advertising and billing remain disabled.

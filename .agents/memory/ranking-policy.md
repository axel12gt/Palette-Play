---
name: Ranking trust and timing
description: Why ranked games are separate from offline practice and include time away
---

Only server-issued puzzles qualify for online rankings. Ranked time is server wall-clock time from issuance to accepted completion, including pauses and time away; offline practice keeps its own paused timer.

**Why:** Client-reported durations and locally generated seeds can be forged. The ranking needs a consistent server-owned clock without preventing offline practice or saved-game resume.

**How to apply:** Keep this distinction visible in the UI. Validate the result against the issuing server's puzzle and count each issued puzzle at most once. A valid solution is not proof of human play; do not promise bot-proof leaderboards without additional fair-play measures.
